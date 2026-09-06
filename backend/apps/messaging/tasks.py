"""messaging Celery tasks. Queues named EXPLICITLY (B14_09 §1, §3).

Every payload is a DURABLE REFERENCE and every worker re-reads authoritative
state from PostgreSQL (`FI-B12-05`). No raw credential, no signature and no
domain object passes through a queue argument.
"""

from __future__ import annotations

from celery import shared_task


@shared_task(name="messaging.send_outbound_message", queue="providers.fast", bind=True)
def send_outbound_message_task(self, message_id: str):
    """The worker half of the ONE send path.

    `unknown` NEVER resends: a duplicate WhatsApp message is the exact harm
    `B12-D-A020` prevents, and a recipient cannot un-receive one.
    """
    from .services import deliver_outbound

    message = deliver_outbound(message_id=message_id)
    return {"message_ref": getattr(message, "public_id", ""), "status": getattr(message, "status", "")}


def _receipt(receipt_id):
    from apps.platform_async.models import WebhookReceipt

    return WebhookReceipt.objects.select_related("workspace").filter(pk=receipt_id).first()


@shared_task(name="messaging.process_webhook_receipt", queue="webhooks", bind=True)
def process_webhook_receipt_task(self, receipt_id: str):
    """Ingest the inbound messages a verified receipt carries.

    Idempotent twice over: the receipt row is already deduped on
    `(provider, external_id)`, and each message is deduped again on
    `(workspace, provider_message_id)`.
    """
    from .services import ingest_inbound
    from .webhooks import inbound_from_payload

    receipt = _receipt(receipt_id)
    if receipt is None or receipt.workspace_id is None:
        return {"ingested": 0}

    ingested = [
        ingest_inbound(workspace=receipt.workspace, inbound=inbound)
        for inbound in inbound_from_payload(receipt.normalized)
    ]
    receipt.status = "processed"
    receipt.save(update_fields=["status", "updated_at"])
    return {"ingested": len([m for m in ingested if m is not None])}


@shared_task(name="messaging.apply_provider_status", queue="webhooks", bind=True)
def apply_provider_status_task(self, receipt_id: str):
    """Apply delivery statuses. Monotonic; a duplicate is a no-op."""
    from .services import apply_provider_status
    from .webhooks import statuses_from_payload

    receipt = _receipt(receipt_id)
    if receipt is None or receipt.workspace_id is None:
        return {"applied": 0}

    applied = [
        apply_provider_status(workspace=receipt.workspace, status_update=status)
        for status in statuses_from_payload(receipt.normalized)
    ]
    receipt.status = "processed"
    receipt.save(update_fields=["status", "updated_at"])
    return {"applied": len([m for m in applied if m is not None])}


__all__ = ["send_outbound_message_task", "process_webhook_receipt_task", "apply_provider_status_task"]
