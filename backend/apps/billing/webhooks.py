"""The Tap webhook gateway (`B12_WEBHOOK_GATEWAY`, `B8_WEBHOOK_MODEL`).

The order of operations is the security contract, identical in shape to the
WhatsApp gateway because the property is identical:

    bound the body  ->  verify the signature  ->  receipt  ->  fast ack  ->  enqueue

`B8_WEBHOOK_MODEL` §2 states the consequence plainly: **an unverified webhook
never reaches `ProcessPaymentWebhook` at all.** That is structural here — the
`verify_webhook` call returns before any parse, and the only path to the domain
runs through a `queued` receipt.

Workspace resolution never reads a tenant identifier out of the payload (§3).
`PaymentWebhookEvent` carries no such field, so the unsafe path is
unrepresentable rather than merely unused; the tenant is found by looking the
opaque charge reference up against WazLink's own `payments` row.
"""

from __future__ import annotations

import hashlib
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from common.dispatch import task_registry
from common.ports import ports
from common.provider_ports import ProviderError, ProviderNotConfigured, providers

PROVIDER = "tap"
# CB-03, enforced PRE-PARSE. A payment callback is small; anything larger is
# refused unread rather than buffered.
WEBHOOK_MAX_BODY_BYTES = 256_000


def receipt_identity(raw_body: bytes) -> str:
    return hashlib.sha256(raw_body).hexdigest()


def _event_to_dict(event) -> dict:
    """WazLink's own normalized shape. No signature, no raw body, no card fact."""
    return {
        "provider_event_identity": event.provider_event_identity,
        "provider_payment_ref": event.provider_payment_ref,
        "provider_customer_ref": event.provider_customer_ref,
        "status": event.status,
        "amount": event.amount,
        "currency": event.currency,
        "requires_reconciliation": event.requires_reconciliation,
    }


def event_from_payload(payload: dict):
    from common.provider_ports import PaymentWebhookEvent

    return PaymentWebhookEvent(
        provider_event_identity=payload.get("provider_event_identity", ""),
        provider_payment_ref=payload.get("provider_payment_ref", ""),
        provider_customer_ref=payload.get("provider_customer_ref", ""),
        status=payload.get("status", ""),
        amount=payload.get("amount", ""),
        currency=payload.get("currency", ""),
        requires_reconciliation=bool(payload.get("requires_reconciliation")),
    )


def _route_workspace(event):
    """Resolve the tenant from WazLink's OWN rows (`B8_WEBHOOK_MODEL` §3).

    Zero or ambiguous matches are quarantined and alerted, never guessed.
    """
    from .models import Payment

    if not event.provider_payment_ref:
        return None
    payment = (
        Payment.objects.select_related("workspace")
        .filter(provider=PROVIDER, provider_payment_ref=event.provider_payment_ref)
        .first()
    )
    return payment.workspace if payment is not None else None


@csrf_exempt
@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def tap_webhook(request):
    adapter = providers.require("payments")

    raw_body = request.body or b""
    if len(raw_body) > WEBHOOK_MAX_BODY_BYTES:
        return JsonResponse({"status": "rejected"}, status=413)

    headers = {"hashstring": request.headers.get("hashstring", "")}
    if not adapter.verify_webhook(raw_body=raw_body, headers=headers):
        # The ONLY 401 this endpoint returns. Unconfigured verifies nothing and
        # therefore refuses — fail closed, never trust.
        return JsonResponse({"status": "unauthorized"}, status=401)

    try:
        event = adapter.parse_webhook(raw_body)
    except (ProviderError, ProviderNotConfigured, ValueError, json.JSONDecodeError):
        return JsonResponse({"status": "ignored"}, status=200)

    if event.unsupported or not event.provider_event_identity:
        return JsonResponse({"status": "ignored"}, status=200)

    receipt, created = ports.require("webhook_receipts").record(
        provider=PROVIDER,
        external_id=event.provider_event_identity,
        payload_digest=receipt_identity(raw_body),
        signature_verified=True,
    )
    if not created:
        # Duplicate absorbed at the RECEIPT layer. The domain never runs — the
        # first of the two independent defences B8 §4 requires.
        return JsonResponse({"status": "duplicate"}, status=200)

    workspace = _route_workspace(event)
    if workspace is None:
        receipt.status = "rejected"
        receipt.save(update_fields=["status", "updated_at"])
        ports.require("reconciliation").open_case(
            case_class="P-7",
            subject_ref=event.provider_event_identity[:120],
            detail={"note": "unresolved workspace binding; quarantined, never guessed"},
        )
        return JsonResponse({"status": "unrouted"}, status=200)

    receipt.workspace = workspace
    receipt.normalized = _event_to_dict(event)
    receipt.save(update_fields=["workspace", "normalized", "updated_at"])

    task_registry.enqueue("billing.process_payment_webhook", receipt_id=str(receipt.pk))
    return JsonResponse({"status": "accepted"}, status=200)


__all__ = ["tap_webhook", "event_from_payload", "receipt_identity", "PROVIDER"]
