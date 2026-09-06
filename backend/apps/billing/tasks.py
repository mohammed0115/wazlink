"""billing workers (B14_09). Each carries a REFERENCE and re-reads durable state.

`charge_payment` runs on `providers.fast`; `process_payment_webhook` on
`webhooks`; the sweeps on `maintenance`. An `unknown` outcome is NEVER retried
(`B12-D-A020`) — that rule lives in the service, and the task inherits it by
not adding a retry of its own.
"""

from __future__ import annotations

from celery import shared_task

from .webhooks import event_from_payload


@shared_task(name="billing.process_payment_webhook", queue="webhooks")
def process_payment_webhook_task(*, receipt_id: str) -> str:
    """Re-read the durable receipt and apply it exactly once."""
    from apps.platform_async.models import WebhookReceipt

    from .services import process_payment_webhook

    receipt = WebhookReceipt.objects.filter(pk=receipt_id).first()
    if receipt is None or receipt.status == "processed":
        return "skipped"

    payment = process_payment_webhook(event=event_from_payload(receipt.normalized or {}))
    receipt.status = "processed"
    receipt.save(update_fields=["status", "updated_at"])
    return payment.public_id if payment is not None else "unresolved"


@shared_task(name="billing.charge_payment", queue="providers.fast")
def charge_payment_task(*, payment_id: str) -> str:
    """Reconcile one payment against the provider. Read-only at the provider."""
    from .models import Payment
    from .services import reconcile_payment

    payment = Payment.objects.filter(pk=payment_id).first()
    if payment is None:
        return "missing"
    return reconcile_payment(payment=payment).status


@shared_task(name="billing.sweep_pending_payments", queue="maintenance")
def sweep_pending_payments_task() -> int:
    from .services import sweep_pending_payments

    return sweep_pending_payments()


@shared_task(name="billing.sweep_subscription_periods", queue="maintenance")
def sweep_subscription_periods_task() -> int:
    from .services import sweep_subscription_periods

    return sweep_subscription_periods()


__all__ = [
    "process_payment_webhook_task",
    "charge_payment_task",
    "sweep_pending_payments_task",
    "sweep_subscription_periods_task",
]
