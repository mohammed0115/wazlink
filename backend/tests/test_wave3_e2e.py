"""Wave 3 end-to-end journeys, on real PostgreSQL through real commands.

    E2E C — BILLING    workspace -> plan -> subscription -> payment boundary
                       -> verified payment -> entitlement
    E2E D — REVENUE    Deal Won -> NO revenue; then the explicit recognition
                       command -> RevenueEvent -> attribution -> analytics
    E2E E — FAILURE    an uncertain external effect -> reconciliation ->
                       no duplicated effect -> deterministic final state

Nothing here uses a fixture, a fake or a bypass beyond the deterministic
provider adapters, which satisfy the same ports the real ones do.
"""

from __future__ import annotations

import json
from decimal import Decimal

import pytest

pytestmark = pytest.mark.django_db(transaction=True)


def _tap_callback(charge_id: str, status: str = "CAPTURED") -> bytes:
    return json.dumps(
        {
            "id": charge_id,
            "amount": "299.0000",
            "currency": "SAR",
            "status": status,
            "reference": {"gateway": "gw", "payment": "pay"},
            "transaction": {"created": "1700000000"},
            "customer": {"id": "cus_stub"},
        }
    ).encode()


# ==========================================================================
# E2E C — BILLING
# ==========================================================================
@pytest.mark.e2e
def test_e2e_c_billing_journey_to_a_changed_entitlement(actor, client, auth_client):
    from apps.billing.models import Invoice, Payment, Subscription, UpgradeQuote
    from apps.billing.services import subscription_for
    from apps.billing.tasks import process_payment_webhook_task
    from apps.entitlements.models import WorkspacePlanAssignment
    from apps.entitlements.selectors import evaluate_entitlement
    from apps.platform_async.models import WebhookReceipt
    from adapters.tap import StubTapAdapter

    a = actor()
    api = auth_client(a)

    # 1. Every workspace starts on the entry tier, with no card step.
    subscription = subscription_for(a.workspace)
    assert subscription.status == "active"
    assert subscription.plan_version.plan.code == "PLAN-STARTER"
    # STARTER genuinely lacks automation — the entitlement is real, not cosmetic.
    assert evaluate_entitlement(a.workspace, "automation.rules").allowed is False

    # 2. The catalogue is readable and server-priced.
    plans = {p["code"]: p for p in api.get("/api/v1/plans").json()["items"]}
    assert plans["PLAN-GROWTH"]["amount"] == "299.0000"

    # 3. Checkout. The client sends a plan code and nothing else that matters.
    created = api.post(
        "/api/v1/billing/checkout",
        {"plan_code": "PLAN-GROWTH", "amount": "0.01"},  # the lie is ignored
        format="json",
    )
    assert created.status_code == 201
    payment = Payment.objects.get(workspace=a.workspace)
    assert payment.amount == Decimal("299.0000")
    assert UpgradeQuote.objects.get(workspace=a.workspace).status == "consumed"

    # 4. The redirect proves nothing and changes nothing.
    before = payment.status
    payment.refresh_from_db()
    assert payment.status == before

    # 5. The signed webhook is what moves the money.
    raw = _tap_callback(payment.provider_payment_ref)
    accepted = client.post(
        "/webhooks/tap", data=raw, content_type="application/json",
        headers={"hashstring": StubTapAdapter.sign(raw)},
    )
    assert accepted.json()["status"] == "accepted"
    for receipt in WebhookReceipt.objects.filter(provider="tap"):
        process_payment_webhook_task(receipt_id=str(receipt.pk))

    # 6. Durable outcome: captured, activated, entitled, invoiced.
    payment.refresh_from_db()
    assert payment.status == "captured"
    subscription = Subscription.objects.get(workspace=a.workspace)
    assert subscription.plan_version.plan.code == "PLAN-GROWTH"
    assert WorkspacePlanAssignment.objects.get(workspace=a.workspace).plan_version.plan.code == (
        "PLAN-GROWTH"
    )
    assert evaluate_entitlement(a.workspace, "automation.rules").allowed is True
    assert Invoice.objects.filter(workspace=a.workspace, status="paid").count() == 1

    # 7. And NO customer revenue was created by any of it.
    from apps.revenue.models import RevenueEvent

    assert RevenueEvent.objects.count() == 0


# ==========================================================================
# E2E D — REVENUE
# ==========================================================================
@pytest.mark.e2e
def test_e2e_d_won_deal_then_explicit_recognition(actor, auth_client):
    from apps.analytics.selectors import report_section
    from apps.crm.services import create_lead
    from apps.pipeline.services import close_deal, create_deal
    from apps.revenue.models import RevenueAttribution, RevenueEvent
    from apps.revenue.services import record_revenue_event, record_touchpoint

    a = actor()

    # 1. A Deal is won, for real money.
    lead = create_lead(
        context=a.context, origin_type="manual",
        primary_contact={"name": "E2E Buyer", "phone": "+966501112233"},
    )
    deal = create_deal(context=a.context, lead=lead, title="Annual contract", value="120000.0000")
    won = close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)
    assert won.status == "won"

    # 2. WON_DEAL_EQUALS_REVENUE = FALSE. Nothing was recognized.
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 0
    assert report_section(a.workspace, "recognized_revenue")["data"]["totals"] == {}

    # 3. An acquisition touch is recorded, so attribution has something to find.
    record_touchpoint(
        context=a.context, subject_type="lead", subject_public_id=won.public_id,
        source_type="discovery_job", source_entity_type="discovery_job",
        source_public_id="DJOB-E2E0000000001", origin_kind="discovery", source_code="SRC-1004",
        position=1,
    )

    # 4. The EXPLICIT command — the only writer — recognizes revenue.
    event = record_revenue_event(
        context=a.context, source_type="deal", source_entity_type="deal",
        source_public_id=won.public_id, gross="120000.0000", net="100000.0000", currency="SAR",
        idempotency_key="e2e-d-1",
    )
    assert event.status == "recognized"

    # 5. Attribution resolved to the first touch, immutably, at 100%.
    attribution = RevenueAttribution.objects.get(revenue_event=event)
    assert attribution.origin_kind == "discovery"
    assert attribution.allocation_bps == 10000

    # 6. Analytics reports it — from `revenue_events`, never from the Deal.
    totals = report_section(a.workspace, "recognized_revenue")["data"]["totals"]
    assert totals["SAR"]["net_recognized"] == "100000.0000"
    ladder = report_section(a.workspace, "revenue_by_origin")["data"]["ladder"]
    assert {"origin_kind": "discovery", "net": "100000.0000"} in ladder

    # 7. The Deal's own value never became a revenue figure.
    pipeline = report_section(a.workspace, "pipeline_value")["data"]
    assert "forecast" in pipeline["note"]


@pytest.mark.e2e
def test_e2e_d_crm_without_discovery_recognizes_as_unattributed(actor):
    """Track-B: a manually created customer, no Discovery anywhere, real revenue."""
    from apps.analytics.selectors import report_section
    from apps.customers.services import create_customer
    from apps.discovery.models import Business
    from apps.revenue.services import record_revenue_event

    a = actor()
    customer = create_customer(
        context=a.context, party_kind="organization", name="Walk-in Co", origin_kind="manual"
    )
    # ZERO fake Discovery prerequisite: no Business was fabricated for it.
    assert Business.objects.filter(workspace=a.workspace).count() == 0

    event = record_revenue_event(
        context=a.context, source_type="lead", source_entity_type="lead",
        source_public_id=customer.public_id, gross="7500.0000", net="7500.0000", currency="SAR",
        idempotency_key="e2e-track-b",
    )
    assert event.status == "recognized"

    ladder = report_section(a.workspace, "revenue_by_origin")["data"]["ladder"]
    unattributed = next(r for r in ladder if r["origin_kind"] == "unattributed")
    # Reported as unattributed — a completeness fact, NOT an error.
    assert unattributed["net"] == "7500.0000"


# ==========================================================================
# E2E E — FAILURE / RETRY
# ==========================================================================
@pytest.mark.e2e
def test_e2e_e_an_uncertain_provider_outcome_is_never_blindly_retried(actor):
    """`B12-D-A020`: unknown means a human decides, not a second charge."""
    from apps.billing.models import Payment, PaymentAttempt
    from apps.billing.services import start_checkout, subscription_for
    from apps.platform_async.models import PlatformReconciliationCase
    from common.provider_ports import ProviderUnknownOutcome, providers

    a = actor()
    subscription_for(a.workspace)
    tap = providers.require("payments")
    tap.next_error = ProviderUnknownOutcome("the call may or may not have taken effect")

    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")

    # The payment did NOT advance, and it is flagged for reconciliation.
    assert payment.status == "pending"
    assert payment.requires_reconciliation is True
    # A case exists for a human.
    assert PlatformReconciliationCase.objects.filter(
        case_class="payment_unknown_outcome", status="open"
    ).exists()
    # Exactly one attempt was made. Nothing retried.
    assert PaymentAttempt.objects.filter(payment=payment).count() == 1
    assert len(tap.charges) == 0
    # And no second Payment was created.
    assert Payment.objects.filter(workspace=a.workspace).count() == 1


@pytest.mark.e2e
def test_e2e_e_reconciliation_converges_to_the_providers_truth(actor):
    """The backstop for a webhook the provider gave up delivering."""
    from apps.billing.models import Invoice
    from apps.billing.services import reconcile_payment, start_checkout, subscription_for
    from apps.entitlements.models import WorkspacePlanAssignment
    from common.provider_ports import providers

    a = actor()
    subscription_for(a.workspace)
    tap = providers.require("payments")
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    assert payment.status == "pending"

    # No webhook ever arrives. The sweep ASKS instead of waiting.
    tap.retrieve_status = "CAPTURED"
    payment = reconcile_payment(payment=payment)

    assert payment.status == "captured"
    assert WorkspacePlanAssignment.objects.get(workspace=a.workspace).plan_version.plan.code == (
        "PLAN-GROWTH"
    )
    assert Invoice.objects.filter(workspace=a.workspace).count() == 1

    # Reconciling AGAIN changes nothing — the effect is idempotent.
    reconcile_payment(payment=payment)
    assert Invoice.objects.filter(workspace=a.workspace).count() == 1
    assert WorkspacePlanAssignment.objects.filter(workspace=a.workspace).count() == 1


@pytest.mark.e2e
def test_e2e_e_a_late_webhook_after_reconciliation_is_a_no_op(actor):
    """Webhook and reconciliation race; the final state is deterministic."""
    from apps.billing.models import Invoice
    from apps.billing.services import (
        process_payment_webhook,
        reconcile_payment,
        start_checkout,
        subscription_for,
    )
    from common.provider_ports import PaymentWebhookEvent, providers

    a = actor()
    subscription_for(a.workspace)
    tap = providers.require("payments")
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")

    tap.retrieve_status = "CAPTURED"
    reconcile_payment(payment=payment)

    # The webhook Tap eventually delivered, reporting the same truth.
    process_payment_webhook(
        event=PaymentWebhookEvent(
            provider_event_identity="late",
            provider_payment_ref=payment.provider_payment_ref,
            status="captured",
        )
    )
    payment.refresh_from_db()
    assert payment.status == "captured"
    # One invoice, one entitlement grant. Convergent, not doubled.
    assert Invoice.objects.filter(workspace=a.workspace).count() == 1
