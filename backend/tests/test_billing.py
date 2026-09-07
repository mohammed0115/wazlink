"""I9 — Billing / Entitlements / Tap.

Every assertion reads durable PostgreSQL state or a structural fact, never a
status code alone. The frozen sources are read directly:

*   `B8_CHECKOUT_PAYMENT_MODEL` §2 — the price is SERVER-SIDE, from the quote.
*   `B8_CHECKOUT_PAYMENT_MODEL` §8 — a redirect is UX evidence and mutates
    nothing; only a webhook or reconciliation moves a Payment.
*   `B8_WEBHOOK_MODEL` §2/§4/§6 — unverified never reaches the domain;
    duplicates are absorbed; a backward transition is discarded.
*   `B8_REVENUE_FIREWALL` — a captured platform payment creates NO revenue.
*   `B14_03` §6b — `AssignWorkspacePlan` is written inside the subscription
    transaction and carries no amount, currency, payment or card fact.
"""

from __future__ import annotations

import json
import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection, connections
from django.utils import timezone

from apps.billing.models import (
    Invoice,
    Payment,
    PaymentAttempt,
    Subscription,
    UpgradeQuote,
)
from apps.billing.services import (
    _open_payment,
    bootstrap_workspace_subscription,
    cancel_subscription,
    create_upgrade_quote,
    process_payment_webhook,
    start_checkout,
    subscription_for,
    sweep_pending_payments,
)
from apps.entitlements.models import WorkspacePlanAssignment
from common.provider_ports import providers

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def tap():
    return providers.require("payments")


def _callback(charge_id: str, status: str = "CAPTURED", amount: str = "299.0000") -> bytes:
    return json.dumps(
        {
            "id": charge_id,
            "amount": amount,
            "currency": "SAR",
            "status": status,
            "reference": {"gateway": "gw-1", "payment": "pay-1"},
            "transaction": {"created": "1700000000"},
            "customer": {"id": "cus_stub_x"},
        }
    ).encode()


def _deliver(client, raw: bytes, *, signature: str | None = None):
    from adapters.tap import StubTapAdapter

    return client.post(
        "/webhooks/tap",
        data=raw,
        content_type="application/json",
        headers={"hashstring": StubTapAdapter.sign(raw) if signature is None else signature},
    )


# ---------------------------------------------------------------- bootstrap
def test_every_workspace_has_exactly_one_subscription(actor):
    """`B8` §1/§2. Uniqueness is a DATABASE constraint, not a check."""
    a = actor()
    first = bootstrap_workspace_subscription(workspace=a.workspace)
    second = bootstrap_workspace_subscription(workspace=a.workspace)
    assert first.pk == second.pk
    assert Subscription.objects.filter(workspace=a.workspace).count() == 1
    # Bootstrap lands on `active`/STARTER — never `trialing` (B8-D-B001).
    assert first.status == "active"
    assert first.plan_version.plan.code == "PLAN-STARTER"


def test_bootstrap_is_race_safe_under_concurrency(actor):
    """Two consumers of one WorkspaceCreated must not create two rows."""
    a = actor()
    barrier = threading.Barrier(4, timeout=20)
    errors: list[Exception] = []

    def worker():
        try:
            barrier.wait()
            bootstrap_workspace_subscription(workspace=a.workspace)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    [t.start() for t in threads]
    [t.join(60) for t in threads]
    assert errors == [], f"a concurrent bootstrap leaked: {errors}"
    assert Subscription.objects.filter(workspace=a.workspace).count() == 1


# ---------------------------------------------------------------- pricing
def test_a_client_supplied_amount_is_never_used(actor, auth_client):
    """The price comes from the SERVER-ISSUED quote (`B8_CHECKOUT` §2)."""
    a = actor()
    subscription_for(a.workspace)
    api = auth_client(a)
    response = api.post(
        "/api/v1/billing/checkout",
        {"plan_code": "PLAN-GROWTH", "amount": "1.0000", "currency": "USD", "total": "0.01"},
        format="json",
    )
    assert response.status_code == 201, response.data
    payment = Payment.objects.get(workspace=a.workspace)
    # The catalogue price, not the client's.
    assert payment.amount == Decimal("299.0000")
    assert payment.currency == "SAR"
    quote = UpgradeQuote.objects.get(workspace=a.workspace)
    assert quote.amount == Decimal("299.0000")


def test_the_checkout_view_reads_no_amount_field():
    """(NC) Structural: no amount-shaped key is read from a request body."""
    import inspect

    from apps.billing.api import views

    source = inspect.getsource(views)
    for forbidden in ('"amount"', '"currency"', '"price"', '"total"'):
        assert forbidden not in source, f"the billing API reads {forbidden} from a request"


# ---------------------------------------------------------------- idempotency
def test_one_quote_yields_at_most_one_payment(actor):
    """`uq_payment_quote` — a DATABASE fact, independent of any header."""
    a = actor()
    subscription_for(a.workspace)
    quote = create_upgrade_quote(context=a.context, plan_code="PLAN-GROWTH")
    start_checkout(context=a.context, plan_code="PLAN-GROWTH", quote=quote)

    from common.errors import DomainConflict

    with pytest.raises(DomainConflict):
        start_checkout(context=a.context, plan_code="PLAN-GROWTH", quote=quote)
    assert Payment.objects.filter(workspace=a.workspace).count() == 1


def test_the_provider_idempotency_key_is_the_payment_public_id(actor, tap):
    """`B8-X-006`: derived from PAY-*, never client-supplied, never regenerated."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    assert tap.charges[-1].payment_ref == payment.public_id


def test_a_provider_retry_under_one_key_creates_one_charge(actor, tap):
    """Tap's own 24h window is a BACKSTOP; the same key returns the original."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    from common.provider_ports import ChargeRequest

    again = tap.create_charge(
        ChargeRequest(payment_ref=payment.public_id, amount="299.0000", currency="SAR")
    )
    assert again.provider_payment_ref == payment.provider_payment_ref
    assert len(tap.charges) == 1


# ---------------------------------------------------------------- webhooks
def test_an_unverified_webhook_never_reaches_the_domain(actor, client, tap):
    """`B8_WEBHOOK_MODEL` §2. The ONLY 401 this endpoint returns."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    before = payment.status

    response = _deliver(client, _callback(payment.provider_payment_ref), signature="forged")
    assert response.status_code == 401
    payment.refresh_from_db()
    assert payment.status == before, "an unverified callback mutated a Payment"
    assert Invoice.objects.count() == 0


def test_a_verified_webhook_captures_and_activates(actor, client):
    """The frozen §6 sequence, end to end, on durable state."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")

    assert _deliver(client, _callback(payment.provider_payment_ref)).status_code == 200
    from apps.billing.tasks import process_payment_webhook_task
    from apps.platform_async.models import WebhookReceipt

    receipt = WebhookReceipt.objects.get(provider="tap")
    process_payment_webhook_task(receipt_id=str(receipt.pk))

    payment.refresh_from_db()
    assert payment.status == "captured"
    subscription = Subscription.objects.get(workspace=a.workspace)
    assert subscription.status == "active"
    assert subscription.plan_version.plan.code == "PLAN-GROWTH"
    # The entitlement grant committed WITH the subscription transition.
    assignment = WorkspacePlanAssignment.objects.get(workspace=a.workspace)
    assert assignment.plan_version.plan.code == "PLAN-GROWTH"
    assert Invoice.objects.filter(workspace=a.workspace, status="paid").count() == 1


def test_a_duplicate_webhook_applies_once(actor, client):
    """`B8` §4 — the receipt layer absorbs it; the domain never runs twice."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    raw = _callback(payment.provider_payment_ref)

    first = _deliver(client, raw)
    second = _deliver(client, raw)
    third = _deliver(client, raw)
    assert first.json()["status"] == "accepted"
    assert second.json()["status"] == "duplicate"
    assert third.json()["status"] == "duplicate"

    from apps.billing.tasks import process_payment_webhook_task
    from apps.platform_async.models import WebhookReceipt

    for receipt in WebhookReceipt.objects.filter(provider="tap"):
        process_payment_webhook_task(receipt_id=str(receipt.pk))
        process_payment_webhook_task(receipt_id=str(receipt.pk))

    assert Invoice.objects.filter(workspace=a.workspace).count() == 1
    assert WorkspacePlanAssignment.objects.filter(workspace=a.workspace).count() == 1


def test_a_backward_transition_is_discarded(actor):
    """`B8_WEBHOOK_MODEL` §6 — order independence without provider ordering."""
    from common.provider_ports import PaymentWebhookEvent

    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")

    process_payment_webhook(
        event=PaymentWebhookEvent(
            provider_event_identity="e1",
            provider_payment_ref=payment.provider_payment_ref,
            status="captured",
        )
    )
    payment.refresh_from_db()
    assert payment.status == "captured"

    # A STALE `pending` arriving late must not move it backwards.
    process_payment_webhook(
        event=PaymentWebhookEvent(
            provider_event_identity="e0",
            provider_payment_ref=payment.provider_payment_ref,
            status="pending",
        )
    )
    payment.refresh_from_db()
    assert payment.status == "captured"


def test_an_unresolvable_webhook_is_quarantined_never_guessed(actor, client):
    """`B8_WEBHOOK_MODEL` §3. Zero matches => quarantine + case, never a guess."""
    a = actor()
    subscription_for(a.workspace)
    response = _deliver(client, _callback("chg_does_not_exist"))
    assert response.status_code == 200
    assert response.json()["status"] == "unrouted"
    from apps.platform_async.models import PlatformReconciliationCase

    assert PlatformReconciliationCase.objects.filter(case_class="P-7").exists()


def test_an_unmapped_provider_status_fails_closed(actor):
    """The fail-closed rule: `pending` + reconciliation, never captured/failed."""
    from adapters.tap import normalize_status

    status, needs = normalize_status(status="SOMETHING-TAP-INVENTED-LATER")
    assert status == "pending" and needs is True
    for unknown in ("901", "801", "304"):
        status, needs = normalize_status(code=unknown)
        assert status == "pending" and needs is True


# ---------------------------------------------------------------- concurrency
def test_concurrent_webhooks_apply_one_capture(actor):
    """Race the SAME logical capture across real connections."""
    from common.provider_ports import PaymentWebhookEvent

    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    barrier = threading.Barrier(4, timeout=20)
    errors: list[Exception] = []

    def worker():
        try:
            barrier.wait()
            process_payment_webhook(
                event=PaymentWebhookEvent(
                    provider_event_identity="race",
                    provider_payment_ref=payment.provider_payment_ref,
                    status="captured",
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    [t.start() for t in threads]
    [t.join(60) for t in threads]

    assert errors == [], f"a concurrent webhook leaked: {errors}"
    assert Invoice.objects.filter(workspace=a.workspace).count() == 1, "double entitlement/invoice"
    assert WorkspacePlanAssignment.objects.filter(workspace=a.workspace).count() == 1
    payment.refresh_from_db()
    assert payment.status == "captured"


def test_concurrent_checkouts_on_one_quote_yield_one_payment(actor):
    """The unique index decides, not the pre-check."""
    a = actor()
    subscription_for(a.workspace)
    quote = create_upgrade_quote(context=a.context, plan_code="PLAN-GROWTH")
    barrier = threading.Barrier(4, timeout=20)
    outcomes: list[str] = []

    def worker():
        try:
            barrier.wait()
            start_checkout(context=a.context, plan_code="PLAN-GROWTH", quote=quote)
            outcomes.append("ok")
        except Exception:  # noqa: BLE001
            outcomes.append("refused")
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(4)]
    [t.start() for t in threads]
    [t.join(60) for t in threads]

    assert Payment.objects.filter(workspace=a.workspace).count() == 1
    assert outcomes.count("ok") == 1, f"more than one checkout succeeded: {outcomes}"


# ---------------------------------------------------------------- firewall
def test_t_rev_3_nc_a_captured_payment_creates_no_revenue_event(actor, client):
    """`T-REV-3` **(NC)**. Platform billing is not customer revenue."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    _deliver(client, _callback(payment.provider_payment_ref))
    from apps.billing.tasks import process_payment_webhook_task
    from apps.platform_async.models import WebhookReceipt

    for receipt in WebhookReceipt.objects.filter(provider="tap"):
        process_payment_webhook_task(receipt_id=str(receipt.pk))

    payment.refresh_from_db()
    assert payment.status == "captured"

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema='public' AND table_name='revenue_events'"""
        )
        if cursor.fetchone():
            cursor.execute("SELECT count(*) FROM revenue_events")
            assert cursor.fetchone()[0] == 0, "a platform payment created a RevenueEvent"


def test_t_ent_7_nc_entitlements_imports_nothing_from_billing():
    """`T-ENT-7` **(NC)**. The dependency runs one way only."""
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "entitlements"
    offenders = []
    for path in root.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("apps.billing"):
                offenders.append(str(path))
            elif isinstance(node, ast.Import):
                offenders += [a.name for a in node.names if a.name.startswith("apps.billing")]
    assert offenders == [], f"entitlements imports billing: {offenders}"


def test_t_ent_6_nc_assign_workspace_plan_carries_no_money():
    """`T-ENT-6` **(NC)**. The signature has nowhere to put an amount."""
    import inspect

    from apps.entitlements.services import assign_workspace_plan

    parameters = set(inspect.signature(assign_workspace_plan).parameters)
    for forbidden in ("amount", "currency", "payment", "invoice", "card", "price"):
        assert forbidden not in parameters, f"AssignWorkspacePlan accepts {forbidden}"
    assert parameters == {"workspace", "plan_version", "status"}


def test_no_card_or_credential_data_is_stored_anywhere():
    """`B13_PAYMENT_FINANCIAL_SECURITY`. No PAN, CVV or key column exists."""
    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT table_name, column_name FROM information_schema.columns
               WHERE table_schema='public'
                 AND (column_name ILIKE '%%card%%' OR column_name ILIKE '%%pan%%'
                      OR column_name ILIKE '%%cvv%%' OR column_name ILIKE '%%secret%%'
                      OR column_name ILIKE '%%api_key%%')"""
        )
        found = cursor.fetchall()

    # A `*_secret_ref` column holds a REFERENCE NAME resolved from the
    # environment at call time — the pattern B14_13 prescribes — so it is the
    # opposite of a stored credential. Anything else matching is a real leak.
    offenders = [(table, column) for table, column in found if not column.endswith("_secret_ref")]
    assert offenders == [], f"a credential-shaped column exists: {offenders}"


def test_the_tap_secret_never_reaches_a_response_or_audit(actor, auth_client, monkeypatch):
    a = actor()
    subscription_for(a.workspace)
    monkeypatch.setenv("TAP_SECRET_KEY", "sk_test_SENTINEL_VALUE_0123456789")
    api = auth_client(a)
    body = api.get("/api/v1/billing/subscription").content.decode()
    assert "SENTINEL" not in body
    from apps.auditlog.models import AuditLog

    for row in AuditLog.objects.all():
        assert "SENTINEL" not in json.dumps(row.metadata)


# ---------------------------------------------------------------- lifecycle
def test_cancel_is_period_end_only_and_reactivation_undoes_it(actor):
    a = actor()
    subscription_for(a.workspace)
    subscription = cancel_subscription(context=a.context)
    assert subscription.cancel_at_period_end is True
    # Still ACTIVE: Phase 1 grants access to the period end (B8 §3).
    assert subscription.status == "active"

    from apps.billing.services import reactivate_subscription

    subscription = reactivate_subscription(context=a.context)
    assert subscription.cancel_at_period_end is False


def test_the_period_sweep_walks_cancelled_then_expired(actor):
    from datetime import timedelta

    from apps.billing.services import sweep_subscription_periods

    a = actor()
    subscription = subscription_for(a.workspace)
    cancel_subscription(context=a.context)
    # An ELAPSED period moves both bounds: `ck_subscription_period` requires
    # end > start, so rewinding only the end would describe an impossible row.
    Subscription.objects.filter(pk=subscription.pk).update(
        current_period_start=timezone.now() - timedelta(days=31),
        current_period_end=timezone.now() - timedelta(days=1),
    )
    assert sweep_subscription_periods() >= 1
    subscription.refresh_from_db()
    assert subscription.status == "expired"


def test_a_payment_attempt_is_written_before_the_provider_call(actor):
    """`B12-D-A021` — evidence exists even if the process dies mid-call."""
    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    attempts = PaymentAttempt.objects.filter(payment=payment).order_by("attempt_number")
    assert attempts.count() >= 1
    assert attempts.first().kind == "create"


def test_tenant_isolation_on_every_billing_surface(actor, auth_client):
    one = actor(email="one@example.test", workspace_name="One")
    two = actor(email="two@example.test", workspace_name="Two")
    subscription_for(one.workspace)
    subscription_for(two.workspace)
    start_checkout(context=one.context, plan_code="PLAN-GROWTH")

    api = auth_client(two)
    payments = api.get("/api/v1/billing/payments").json()["items"]
    assert payments == []
    invoices = api.get("/api/v1/billing/invoices").json()["items"]
    assert invoices == []
    subscription = api.get("/api/v1/billing/subscription").json()
    assert subscription["id"] == Subscription.objects.get(workspace=two.workspace).public_id


def test_a_viewer_cannot_start_a_checkout(actor, auth_client):
    viewer = actor(email="v@example.test", role="viewer", workspace_name="Vw")
    subscription_for(viewer.workspace)
    api = auth_client(viewer)
    response = api.post("/api/v1/billing/checkout", {"plan_code": "PLAN-GROWTH"}, format="json")
    assert response.status_code == 403
    assert Payment.objects.filter(workspace=viewer.workspace).count() == 0


# ------------------------------------------- RECONCILIATION SWEEP (B8 §7)
#
# `B8_RECONCILIATION_MODEL` §7 defines the sweep as TWO limbs:
#
#   1. every Payment in `pending`/`authorized` past the window;
#   2. every Payment whose most recent `payment_attempts` row is older than the
#      window with no terminal status.
#
# Limb 2 is what sees the state limb 1 cannot: a process killed between the
# provider accepting a charge and the local commit of `provider_payment_ref`.
def _age(payment, attempt=None, hours=3):
    when = timezone.now() - timedelta(hours=hours)
    Payment.objects.filter(pk=payment.pk).update(created_at=when)
    if attempt is not None:
        PaymentAttempt.objects.filter(pk=attempt.pk).update(occurred_at=when)
    payment.refresh_from_db()


def _crash_shaped(actor_obj):
    """The hard-crash shape: durable Payment + OPEN attempt + NO provider ref.

    Built through the real `_open_payment` step, so it is the exact state the
    checkout leaves behind when the process dies after `create_charge` returns
    and before the transaction that persists the reference commits.
    """
    quote = create_upgrade_quote(context=actor_obj.context, plan_code="PLAN-GROWTH")
    payment = _open_payment(context=actor_obj.context, quote=quote)
    attempt = PaymentAttempt.objects.create(
        payment=payment, attempt_number=1, kind="create", outcome_status=""
    )
    _age(payment, attempt)
    return payment, attempt


def test_limb_1_a_stale_pending_payment_is_reconciled(actor, tap):
    a = actor()
    subscription_for(a.workspace)
    tap.next_status = "PENDING"
    tap.retrieve_status = "CAPTURED"
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    _age(payment)

    assert sweep_pending_payments() >= 1
    payment.refresh_from_db()
    assert payment.status == "captured"


def test_limb_2_a_stale_open_attempt_with_a_reference_is_looked_up(actor, tap):
    """Limb 2, lookup branch: the capability exists, so it is used — read-only."""
    a = actor()
    subscription_for(a.workspace)
    tap.next_status = "PENDING"
    tap.retrieve_status = "CAPTURED"
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    # Out of limb 1's reach (wrong status) but squarely inside limb 2.
    Payment.objects.filter(pk=payment.pk).update(status="created")
    attempt = PaymentAttempt.objects.filter(payment=payment).first()
    PaymentAttempt.objects.filter(pk=attempt.pk).update(outcome_status="")
    _age(payment, attempt)

    sweep_pending_payments()
    payment.refresh_from_db()
    assert payment.status == "captured"


def test_limb_2_the_hard_crash_shape_is_detected_and_escalated(actor, tap):
    """The defect this limb exists for.

    Payment `created`, attempt open, no provider reference — Tap may already
    have taken the money. It must be DETECTED, ESCALATED, and never repeated.
    """
    from apps.platform_async.models import PlatformReconciliationCase

    a = actor()
    subscription_for(a.workspace)
    payment, _ = _crash_shaped(a)
    charges_before = len(tap.charges)

    assert sweep_pending_payments() >= 1

    payment.refresh_from_db()
    assert payment.requires_reconciliation is True
    # UNKNOWN EXTERNAL EFFECT != FAILED EFFECT.
    assert payment.status not in ("failed", "cancelled")
    # Never a mutating repeat (`B12_RECONCILIATION_MODEL` P-1).
    assert len(tap.charges) == charges_before
    cases = PlatformReconciliationCase.objects.filter(
        case_class="P-1", subject_ref=payment.public_id
    )
    assert cases.count() == 1


def test_a_recent_open_attempt_is_not_swept_early(actor):
    """The window is real: a checkout in flight must not be escalated."""
    from apps.platform_async.models import PlatformReconciliationCase

    a = actor()
    subscription_for(a.workspace)
    quote = create_upgrade_quote(context=a.context, plan_code="PLAN-GROWTH")
    payment = _open_payment(context=a.context, quote=quote)
    PaymentAttempt.objects.create(payment=payment, attempt_number=1, kind="create")

    sweep_pending_payments()
    payment.refresh_from_db()
    assert payment.requires_reconciliation is False
    assert not PlatformReconciliationCase.objects.filter(subject_ref=payment.public_id).exists()


def test_a_terminal_payment_is_never_re_swept(actor, tap):
    a = actor()
    subscription_for(a.workspace)
    tap.next_status = "CAPTURED"
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    attempt = PaymentAttempt.objects.filter(payment=payment).first()
    PaymentAttempt.objects.filter(pk=attempt.pk).update(outcome_status="")
    _age(payment, attempt)
    invoices = Invoice.objects.filter(payments__pk=payment.pk).count()

    sweep_pending_payments()
    payment.refresh_from_db()
    assert payment.status == "captured"
    assert payment.requires_reconciliation is False
    assert Invoice.objects.filter(payments__pk=payment.pk).count() == invoices


def test_concurrent_sweeps_open_exactly_one_case(actor, tap):
    """Six workers, one escalation. The flag on the row is the guard."""
    from apps.platform_async.models import PlatformReconciliationCase

    a = actor()
    subscription_for(a.workspace)
    payment, _ = _crash_shaped(a)
    charges_before = len(tap.charges)

    def worker() -> None:
        try:
            sweep_pending_payments()
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker) for _ in range(6)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert (
        PlatformReconciliationCase.objects.filter(
            case_class="P-1", subject_ref=payment.public_id
        ).count()
        == 1
    )
    assert len(tap.charges) == charges_before


def test_repeated_sweeps_are_idempotent(actor):
    from apps.platform_async.models import PlatformReconciliationCase

    a = actor()
    subscription_for(a.workspace)
    payment, _ = _crash_shaped(a)
    for _ in range(5):
        sweep_pending_payments()
    assert (
        PlatformReconciliationCase.objects.filter(
            case_class="P-1", subject_ref=payment.public_id
        ).count()
        == 1
    )


def test_the_sweep_does_not_cross_tenants(actor):
    from apps.platform_async.models import PlatformReconciliationCase

    one = actor(email="s1@example.test", workspace_name="S1")
    two = actor(email="s2@example.test", workspace_name="S2")
    subscription_for(one.workspace)
    subscription_for(two.workspace)
    crashed, _ = _crash_shaped(one)
    healthy = _open_payment(
        context=two.context,
        quote=create_upgrade_quote(context=two.context, plan_code="PLAN-GROWTH"),
    )

    sweep_pending_payments()

    crashed.refresh_from_db()
    healthy.refresh_from_db()
    assert crashed.requires_reconciliation is True
    assert healthy.requires_reconciliation is False
    case = PlatformReconciliationCase.objects.get(case_class="P-1", subject_ref=crashed.public_id)
    assert case.subject_ref == crashed.public_id
