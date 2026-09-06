"""The WhatsApp webhook gateway (`B12_WEBHOOK_GATEWAY`, `B14_15` §3).

The order of operations here is the security contract, and it is deliberate:

    bound the body  ->  verify the signature  ->  receipt  ->  fast ack  ->  enqueue

Nothing is parsed before the signature is verified, and nothing is verified
before the body is bounded. Parsing first would hand an unauthenticated caller a
JSON decoder; bounding second would hand them memory.

The frozen status contract is narrow and is followed exactly: **`401` only on
an invalid signature.** A duplicate, malformed, unsupported or unroutable
callback answers `200`, because telling the provider to redeliver something
WazLink will never accept produces an infinite redelivery loop.
"""

from __future__ import annotations

import json

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from common.dispatch import task_registry
from common.ports import ports
from common.provider_ports import (
    InboundMessage,
    InboundStatus,
    ProviderError,
    ProviderNotConfigured,
    providers,
)

from .services import WEBHOOK_MAX_BODY_BYTES, receipt_identity

PROVIDER = "whatsapp"


def _envelope_to_dict(envelope) -> dict:
    """WazLink's own normalized shape. Carries no signature and no raw body."""
    return {
        "provider_event_identity": envelope.provider_event_identity,
        "provider_account_id": envelope.provider_account_id,
        "messages": [
            {
                "provider_message_id": m.provider_message_id,
                "from_phone": m.from_phone,
                "body": m.body,
                "kind": m.kind,
                "occurred_at": m.occurred_at.isoformat() if m.occurred_at else None,
                "profile_name": m.profile_name,
                "provider_account_id": m.provider_account_id,
            }
            for m in envelope.messages
        ],
        "statuses": [
            {
                "provider_message_id": s.provider_message_id,
                "status": s.status,
                "occurred_at": s.occurred_at.isoformat() if s.occurred_at else None,
                "recipient_phone": s.recipient_phone,
                "error_class": s.error_class,
            }
            for s in envelope.statuses
        ],
    }


def inbound_from_payload(payload: dict):
    """Rebuild normalized inbound messages from a stored receipt."""
    from datetime import datetime

    for raw in payload.get("messages") or []:
        occurred = raw.get("occurred_at")
        yield InboundMessage(
            provider_message_id=raw.get("provider_message_id", ""),
            from_phone=raw.get("from_phone", ""),
            body=raw.get("body", ""),
            kind=raw.get("kind", "text"),
            occurred_at=datetime.fromisoformat(occurred) if occurred else None,
            profile_name=raw.get("profile_name", ""),
            provider_account_id=raw.get("provider_account_id", ""),
        )


def statuses_from_payload(payload: dict):
    from datetime import datetime

    for raw in payload.get("statuses") or []:
        occurred = raw.get("occurred_at")
        yield InboundStatus(
            provider_message_id=raw.get("provider_message_id", ""),
            status=raw.get("status", ""),
            occurred_at=datetime.fromisoformat(occurred) if occurred else None,
            recipient_phone=raw.get("recipient_phone", ""),
            error_class=raw.get("error_class", ""),
        )


def _route_workspace(envelope):
    """Map the provider account to ONE tenant, or None.

    An unroutable callback is QUARANTINED and reported as reconciliation class
    `P-7`. It is never guessed onto a workspace: delivering one tenant's
    customer message into another tenant's inbox is unrecoverable, and a
    single-tenant deployment "obviously" being the right answer is exactly the
    assumption that breaks on the second tenant.
    """
    from apps.platform_async.models import IntegrationConnection

    if not envelope.provider_account_id:
        return None
    connection = (
        IntegrationConnection.objects.filter(
            provider=PROVIDER, provider_account_id=envelope.provider_account_id
        )
        .select_related("workspace")
        .first()
    )
    return connection.workspace if connection is not None else None


@csrf_exempt
@api_view(["GET", "POST"])
@authentication_classes([])
@permission_classes([])
def whatsapp_webhook(request):
    adapter = providers.require("whatsapp")

    # --- GET: subscription verification -----------------------------------
    if request.method == "GET":
        challenge = adapter.verify_subscription(
            mode=request.GET.get("hub.mode", ""),
            token=request.GET.get("hub.verify_token", ""),
            challenge=request.GET.get("hub.challenge", ""),
        )
        if challenge is None:
            return HttpResponse(status=403)
        return HttpResponse(challenge, status=200, content_type="text/plain")

    # --- POST: bound, then verify, then parse -----------------------------
    raw_body = request.body or b""
    if len(raw_body) > WEBHOOK_MAX_BODY_BYTES:
        # CB-03, enforced PRE-PARSE. Refused unread.
        return JsonResponse({"status": "rejected"}, status=413)

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not adapter.verify_signature(raw_body=raw_body, signature_header=signature):
        # The ONLY 401 this endpoint returns. With no app secret configured the
        # adapter answers False, so an unverifiable callback is refused rather
        # than trusted — the fail-closed behaviour B14_15 §7 requires.
        return JsonResponse({"status": "unauthorized"}, status=401)

    try:
        envelope = adapter.parse_webhook(raw_body)
    except (ProviderError, ProviderNotConfigured, ValueError, json.JSONDecodeError):
        # Malformed: 200. Redelivery would never succeed.
        return JsonResponse({"status": "ignored"}, status=200)

    if envelope.unsupported:
        return JsonResponse({"status": "ignored"}, status=200)

    workspace = _route_workspace(envelope)
    digest = receipt_identity(raw_body)

    receipt, created = ports.require("webhook_receipts").record(
        provider=PROVIDER,
        external_id=envelope.provider_event_identity,
        payload_digest=digest,
        signature_verified=True,
    )
    if not created:
        # Duplicate absorbed at the RECEIPT layer — the first of frozen B5's
        # two independent defences. The domain never even runs.
        return JsonResponse({"status": "duplicate"}, status=200)

    if workspace is None:
        receipt.status = "rejected"
        receipt.save(update_fields=["status", "updated_at"])
        ports.require("reconciliation").open_case(
            case_class="P-7",
            subject_ref=envelope.provider_event_identity[:120],
            detail={"note": "unresolved workspace binding; quarantined, never guessed"},
        )
        return JsonResponse({"status": "unrouted"}, status=200)

    receipt.workspace = workspace
    receipt.normalized = _envelope_to_dict(envelope)
    receipt.save(update_fields=["workspace", "normalized", "updated_at"])

    # Fast acknowledge, then process asynchronously. The task carries the
    # RECEIPT REFERENCE only; the worker re-reads the durable row.
    if envelope.messages:
        task_registry.enqueue("messaging.process_webhook_receipt", receipt_id=str(receipt.pk))
    if envelope.statuses:
        task_registry.enqueue("messaging.apply_provider_status", receipt_id=str(receipt.pk))

    return JsonResponse({"status": "accepted"}, status=200)


__all__ = ["whatsapp_webhook", "inbound_from_payload", "statuses_from_payload", "PROVIDER"]
