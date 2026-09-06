"""billing read models (B8_READ_MODELS_QUERY). Workspace-scoped, always."""

from __future__ import annotations

from ..models import Invoice, Payment, Subscription, UpgradeQuote


def subscription_payload(subscription: Subscription) -> dict:
    return {
        "id": subscription.public_id,
        "status": subscription.status,
        "plan_code": subscription.plan_version.plan.code,
        "plan_name": subscription.plan_version.plan.name,
        "current_period_start": subscription.current_period_start,
        "current_period_end": subscription.current_period_end,
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "pending_plan_code": (
            subscription.pending_plan_version.plan.code
            if subscription.pending_plan_version_id
            else None
        ),
        "version": subscription.version,
    }


def plan_catalog() -> list[dict]:
    """The public plan catalogue. Global, not workspace-scoped."""
    from apps.entitlements.models import PlanCapability, PlanVersion

    from ..services import DEFAULT_CURRENCY, PLAN_PRICES

    rows = []
    for version in PlanVersion.objects.select_related("plan").filter(is_current=True).order_by("plan__code"):
        rows.append(
            {
                "code": version.plan.code,
                "name": version.plan.name,
                "amount": f"{PLAN_PRICES.get(version.plan.code, 0):.4f}",
                "currency": DEFAULT_CURRENCY,
                "capabilities": sorted(
                    PlanCapability.objects.filter(plan_version=version, enabled=True).values_list(
                        "capability", flat=True
                    )
                ),
            }
        )
    return rows


def invoices_for(workspace):
    return Invoice.objects.filter(workspace=workspace).order_by("-issued_at", "-public_id")


def invoice_payload(invoice: Invoice) -> dict:
    return {
        "id": invoice.public_id,
        "status": invoice.status,
        "total": f"{invoice.total:.4f}",
        "currency": invoice.currency,
        "issued_at": invoice.issued_at,
        "lines": [
            {"description": line.description, "amount": f"{line.amount:.4f}", "currency": line.currency}
            for line in invoice.lines.all()
        ],
    }


def payments_for(workspace):
    return Payment.objects.filter(workspace=workspace).order_by("-created_at", "-public_id")


def payment_payload(payment: Payment) -> dict:
    """The client-safe payment shape.

    `provider_payment_ref` is deliberately ABSENT: it is provider execution
    state, and the tenant surface has no need of it.
    """
    return {
        "id": payment.public_id,
        "status": payment.status,
        "amount": f"{payment.amount:.4f}",
        "currency": payment.currency,
        "created_at": payment.created_at,
    }


def quotes_for(workspace):
    return UpgradeQuote.objects.filter(workspace=workspace).order_by("-created_at")


__all__ = [
    "subscription_payload",
    "plan_catalog",
    "invoices_for",
    "invoice_payload",
    "payments_for",
    "payment_payload",
    "quotes_for",
]
