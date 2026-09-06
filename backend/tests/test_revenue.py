"""I10 — Revenue / Attribution + Tax.

The frozen sources, read directly:

*   `B9_REVENUE_FIREWALL` §2 — the nine non-identities, chief among them
    **Won Deal != Recognized Revenue**.
*   `B9_REVENUE_FIREWALL` §4 — B9 has ZERO event consumers. That absence is
    what makes the firewall structural rather than policed.
*   `B9_REVERSAL_MODEL` §4/§4.1/§4.1a — the caller supplies **gross only**;
    `net` is derived by a running-total allocation.
*   `B9_RBAC_TENANCY` §2a — every response carrying a `Money` needs
    `revenue.view`, conjunctively.
*   `B10` — the seller bootstraps at `unknown`; nothing asserts an exemption.
"""

from __future__ import annotations

import threading
from decimal import Decimal

import pytest
from django.db import connections
from django.utils import timezone

from apps.revenue.models import (
    AttributionTouchpoint,
    RevenueAttribution,
    RevenueEvent,
    RevenueReversal,
)
from apps.revenue.services import record_revenue_event, record_touchpoint, reverse_revenue_event
from common.errors import ValidationFailed

pytestmark = pytest.mark.django_db(transaction=True)


def _recognize(context, *, gross="1000.0000", net="1000.0000", source="DEAL-TEST0001", **kw):
    return record_revenue_event(
        context=context,
        source_type=kw.pop("source_type", "deal"),
        source_entity_type=kw.pop("source_entity_type", "deal"),
        source_public_id=source,
        gross=gross,
        net=net,
        currency=kw.pop("currency", "SAR"),
        **kw,
    )


# ------------------------------------------------------------ THE FIREWALL
def test_at_fw_1_a_won_deal_creates_no_revenue(actor):
    """`AT-FW-1` **(NC)**. The single most important assertion in the pack."""
    from apps.crm.services import create_lead
    from apps.pipeline.services import close_deal, create_deal

    a = actor()
    lead = create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": "Acme", "phone": "+966500000001"},
    )
    deal = create_deal(context=a.context, lead=lead, title="Big one", value="50000.0000")
    deal = close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    assert deal.status == "won"
    # WON_DEAL_EQUALS_REVENUE = FALSE, asserted on durable state.
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 0
    assert RevenueAttribution.objects.count() == 0


def test_at_fw_4_a_captured_platform_payment_creates_no_revenue(actor):
    """`AT-FW-4`/`AT-FW-5`/`AT-FW-8`. Platform billing is not customer revenue."""
    from apps.billing.services import start_checkout, subscription_for

    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    from apps.billing.services import process_payment_webhook
    from common.provider_ports import PaymentWebhookEvent

    process_payment_webhook(
        event=PaymentWebhookEvent(
            provider_event_identity="fw",
            provider_payment_ref=payment.provider_payment_ref,
            status="captured",
        )
    )
    payment.refresh_from_db()
    assert payment.status == "captured"
    assert RevenueEvent.objects.count() == 0


def test_at_fw_nc_a_platform_billing_ref_is_refused_as_a_source(actor):
    """`B9-AF-007`. `PAY-*`/`INV-BILL-*`/`SUB-*` are categorically not sources."""
    a = actor()
    for ref in ("PAY-ABCDEFGHIJKLMNOP", "INV-BILL-ABCDEFGHIJKLMNOP", "SUB-ABCDEFGHIJKLMNOP"):
        with pytest.raises(ValidationFailed):
            _recognize(a.context, source=ref, source_type="payment", source_entity_type="payment")
    assert RevenueEvent.objects.count() == 0


def test_t_rev_4_nc_no_module_other_than_revenue_writes_revenue_events():
    """`T-REV-4` **(NC)**, asserted structurally over every app."""
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps"
    offenders = []
    for path in root.rglob("*.py"):
        module = path.relative_to(root).parts[0]
        if module == "revenue":
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("apps.revenue"):
                offenders.append(f"{module}: {node.module}")
            elif isinstance(node, ast.Import):
                offenders += [
                    f"{module}: {alias.name}"
                    for alias in node.names
                    if alias.name.startswith("apps.revenue")
                ]
    assert offenders == [], f"a non-revenue module imports revenue: {offenders}"


def test_b9_declares_no_event_consumer():
    """`B9-D-A002` **(NC)**. The firewall is an ABSENCE, so assert the absence."""
    import ast
    import pathlib

    # Scanned as CODE, not as text: the module's own prose explains the absence
    # it is asserting, and a substring search would flag the explanation.
    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "revenue"
    forbidden = {"receiver", "post_save", "pre_save", "post_delete", "Signal"}
    offenders = []
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and "signals" in (node.module or ""):
                offenders.append(f"{path.name}: imports {node.module}")
            if isinstance(node, ast.Name) and node.id in forbidden:
                offenders.append(f"{path.name}: references {node.id}")
            if isinstance(node, ast.Attribute) and node.attr in forbidden:
                offenders.append(f"{path.name}: references .{node.attr}")
    assert offenders == [], f"revenue declares an event consumer: {offenders}"

    # And no handler is registered for another domain's event anywhere.
    from common.dispatch import command_registry

    for name in ("DealWon", "PaymentSucceeded", "SubscriptionActivated", "RecordRevenueEvent"):
        assert not command_registry.is_registered(name), f"{name} is dispatchable into revenue"


# ------------------------------------------------------------ RECOGNITION
def test_recognition_writes_exactly_one_event_and_one_outbox_row(actor):
    a = actor()
    event = _recognize(a.context)
    assert event.status == "recognized"
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 1
    from apps.platform_async.models import OutboxEvent

    assert OutboxEvent.objects.filter(event_type="RevenueRecognized").count() == 1


def test_the_same_source_cannot_be_recognized_twice(actor):
    """The duplicate-recognition guard, released only by FULL reversal."""
    a = actor()
    _recognize(a.context, source="DEAL-ONCE000001")
    with pytest.raises(Exception):  # noqa: B017 - DomainConflict or IntegrityError
        _recognize(a.context, source="DEAL-ONCE000001", idempotency_key="different-key")
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 1


def test_recognition_replays_idempotently(actor):
    a = actor()
    first = _recognize(a.context, idempotency_key="k-1")
    second = _recognize(a.context, idempotency_key="k-1")
    assert first.pk == second.pk
    assert RevenueEvent.objects.count() == 1


def test_amount_guards(actor):
    a = actor()
    with pytest.raises(ValidationFailed):
        _recognize(a.context, gross="0", net="0")
    with pytest.raises(ValidationFailed):
        _recognize(a.context, gross="100.0000", net="200.0000")  # net > gross
    with pytest.raises(ValidationFailed):
        _recognize(a.context, gross="1.00001", net="1.00001")  # scale > 4
    with pytest.raises(ValidationFailed):
        _recognize(a.context, currency="RIYAL")
    assert RevenueEvent.objects.count() == 0


def test_a_future_recognition_is_refused(actor):
    from datetime import timedelta

    a = actor()
    with pytest.raises(ValidationFailed):
        record_revenue_event(
            context=a.context,
            source_type="deal",
            source_entity_type="deal",
            source_public_id="DEAL-FUTURE00001",
            gross="10.0000",
            net="10.0000",
            currency="SAR",
            recognized_at=timezone.now() + timedelta(days=1),
        )


# ------------------------------------------------------------ REVERSAL
def test_a_reversal_requires_an_idempotency_key(actor):
    """A financial reversal never invents its own key.

    A key derived from `(event, amount, reason)` would silently merge two
    genuinely distinct reversals of the same amount — an ordinary thing when a
    refund is split — so the command refuses instead.
    """
    a = actor()
    event = _recognize(a.context, gross="100.0000", net="100.0000")
    with pytest.raises(ValidationFailed):
        reverse_revenue_event(context=a.context, event=event, gross="10.0000", reason="refund")
    assert RevenueReversal.objects.count() == 0

    first = reverse_revenue_event(
        context=a.context, event=event, gross="10.0000", reason="refund", idempotency_key="k"
    )
    replay = reverse_revenue_event(
        context=a.context, event=event, gross="10.0000", reason="refund", idempotency_key="k"
    )
    assert first.pk == replay.pk, "a replay under one key created a second reversal"
    distinct = reverse_revenue_event(
        context=a.context, event=event, gross="10.0000", reason="refund", idempotency_key="k2"
    )
    assert distinct.pk != first.pk, "two distinct reversals collapsed into one"


def test_a_reversal_derives_net_and_never_accepts_one(actor):
    """`B9-D-A033`. `net` has no parameter to arrive in."""
    import inspect

    parameters = set(inspect.signature(reverse_revenue_event).parameters)
    assert "net" not in parameters, "a reversal accepts a caller-supplied net"

    a = actor()
    event = _recognize(a.context, gross="1000.0000", net="800.0000")
    reversal = reverse_revenue_event(
        context=a.context, event=event, gross="500.0000", reason="refund", idempotency_key="r1"
    )
    # 500 * 800/1000 = 400 exactly.
    assert reversal.net_amount == Decimal("400.0000")
    event.refresh_from_db()
    assert event.status == "partially_reversed"


def test_gross_exhaustion_exhausts_net_exactly(actor):
    """The running-total theorem: the last reversal takes exactly the residual."""
    a = actor()
    event = _recognize(a.context, gross="1000.0000", net="333.0000")
    # Three DISTINCT reversals, two of them identical in amount and reason —
    # which is exactly the case a derived key would have collapsed.
    reverse_revenue_event(
        context=a.context, event=event, gross="333.3333", reason="refund", idempotency_key="a"
    )
    reverse_revenue_event(
        context=a.context, event=event, gross="333.3333", reason="refund", idempotency_key="b"
    )
    reverse_revenue_event(
        context=a.context, event=event, gross="333.3334", reason="refund", idempotency_key="c"
    )

    event.refresh_from_db()
    total_net = sum(r.net_amount for r in RevenueReversal.objects.filter(revenue_event=event))
    total_gross = sum(r.gross_amount for r in RevenueReversal.objects.filter(revenue_event=event))
    assert total_gross == Decimal("1000.0000")
    # EXACTLY N — this is what a per-reversal rounding would have missed.
    assert total_net == Decimal("333.0000")
    assert event.status == "reversed"


def test_at_revr_4_nc_a_reversal_beyond_the_remaining_amount_is_refused(actor):
    a = actor()
    event = _recognize(a.context, gross="100.0000", net="100.0000")
    with pytest.raises(ValidationFailed):
        reverse_revenue_event(
            context=a.context, event=event, gross="101.0000", reason="refund", idempotency_key="over"
        )
    assert RevenueReversal.objects.count() == 0


def test_a_reversed_event_releases_its_source_for_re_recognition(actor):
    """The partial unique index predicate, exercised on real PostgreSQL."""
    a = actor()
    event = _recognize(a.context, source="DEAL-RELEASE0001", gross="100.0000", net="100.0000")
    reverse_revenue_event(
        context=a.context, event=event, gross="100.0000", reason="correction", idempotency_key="full"
    )
    event.refresh_from_db()
    assert event.status == "reversed"
    # Now — and only now — the same source may be recognized again.
    again = _recognize(a.context, source="DEAL-RELEASE0001", idempotency_key="fresh")
    assert again.pk != event.pk
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 2


def test_at_revr_5_nc_concurrent_reversals_cannot_together_exceed_the_event(actor):
    """Race four reversals that would together overshoot. Real connections."""
    a = actor()
    event = _recognize(a.context, gross="100.0000", net="100.0000")
    barrier = threading.Barrier(4, timeout=20)
    outcomes: list[str] = []

    def worker(index: int):
        def inner():
            try:
                barrier.wait()
                reverse_revenue_event(
                    context=a.context,
                    event=event,
                    gross="40.0000",
                    reason="refund",
                    idempotency_key=f"race-{index}",
                )
                outcomes.append("ok")
            except Exception:  # noqa: BLE001
                outcomes.append("refused")
            finally:
                connections.close_all()

        return inner

    threads = [threading.Thread(target=worker(i)) for i in range(4)]
    [t.start() for t in threads]
    [t.join(60) for t in threads]

    total = sum(r.gross_amount for r in RevenueReversal.objects.filter(revenue_event=event))
    assert total <= Decimal("100.0000"), f"reversals exceeded the event: {total}"
    assert outcomes.count("ok") == 2, f"expected exactly two 40.00 reversals: {outcomes}"


def test_concurrent_recognition_of_one_source_yields_one_event(actor):
    a = actor()
    barrier = threading.Barrier(4, timeout=20)
    outcomes: list[str] = []

    def worker(index: int):
        def inner():
            try:
                barrier.wait()
                _recognize(a.context, source="DEAL-RACE000001", idempotency_key=f"r-{index}")
                outcomes.append("ok")
            except Exception:  # noqa: BLE001
                outcomes.append("refused")
            finally:
                connections.close_all()

        return inner

    threads = [threading.Thread(target=worker(i)) for i in range(4)]
    [t.start() for t in threads]
    [t.join(60) for t in threads]
    assert RevenueEvent.objects.filter(workspace=a.workspace).count() == 1
    assert outcomes.count("ok") == 1, f"more than one recognition committed: {outcomes}"


# ------------------------------------------------------------ ATTRIBUTION
def test_t_rev_5_a_track_b_customer_recognizes_and_reports_unattributed(actor):
    """`T-REV-5`/`AT-TRACK-3/4`. CRM-without-Discovery is not an error path."""
    from apps.revenue.selectors import attribution_ladder

    a = actor()
    event = _recognize(a.context, source="DEAL-TRACKB00001")
    assert event.status == "recognized"
    # No touchpoint anywhere: no attribution row, and NO refusal.
    assert RevenueAttribution.objects.filter(revenue_event=event).count() == 0

    ladder = attribution_ladder(a.workspace)
    unattributed = next(row for row in ladder if row["origin_kind"] == "unattributed")
    assert unattributed["net"] == "1000.0000"


def test_a_discovery_origin_recognition_attributes_to_its_first_touch(actor):
    a = actor()
    record_touchpoint(
        context=a.context,
        subject_type="lead",
        subject_public_id="DEAL-ATTRIB00001",
        source_type="discovery_job",
        source_entity_type="discovery_job",
        source_public_id="DJOB-ABCDEFGHIJKLMNOP",
        origin_kind="discovery",
        source_code="SRC-1004",
        position=1,
    )
    event = _recognize(a.context, source="DEAL-ATTRIB00001")
    attribution = RevenueAttribution.objects.get(revenue_event=event)
    assert attribution.origin_kind == "discovery"
    assert attribution.model == "first_touch"
    assert attribution.allocation_bps == 10000
    assert attribution.candidate_kind == "touchpoint"


def test_at_track_5_nc_an_attribution_snapshot_is_immutable(actor):
    """A later touchpoint never rewrites a resolved snapshot."""
    a = actor()
    record_touchpoint(
        context=a.context,
        subject_type="lead",
        subject_public_id="DEAL-IMMUT000001",
        source_type="discovery_job",
        source_entity_type="discovery_job",
        source_public_id="DJOB-AAAAAAAAAAAAAAAA",
        origin_kind="discovery",
        position=1,
    )
    event = _recognize(a.context, source="DEAL-IMMUT000001")
    original = RevenueAttribution.objects.get(revenue_event=event)

    record_touchpoint(
        context=a.context,
        subject_type="lead",
        subject_public_id="DEAL-IMMUT000001",
        source_type="lead",
        source_entity_type="lead",
        source_public_id="LEAD-BBBBBBBBBBBBBBBB",
        origin_kind="referral",
        position=2,
    )
    original.refresh_from_db()
    assert original.origin_kind == "discovery"
    assert RevenueAttribution.objects.filter(revenue_event=event).count() == 1


def test_one_touch_per_ordinal_per_subject(actor):
    from common.errors import DomainConflict

    a = actor()
    record_touchpoint(
        context=a.context,
        subject_type="lead",
        subject_public_id="LEAD-POS0000000001",
        source_type="lead",
        source_entity_type="lead",
        source_public_id="LEAD-POS0000000001",
        origin_kind="manual",
        position=1,
    )
    with pytest.raises(DomainConflict):
        record_touchpoint(
            context=a.context,
            subject_type="lead",
            subject_public_id="LEAD-POS0000000001",
            source_type="lead",
            source_entity_type="lead",
            source_public_id="LEAD-POS0000000001",
            origin_kind="import",
            position=1,
            idempotency_key="second",
        )
    assert AttributionTouchpoint.objects.count() == 1


def test_a_touchpoint_carries_no_amount_column():
    """Attribution never mutates money — so it holds none."""
    columns = {f.name for f in AttributionTouchpoint._meta.get_fields()}
    for forbidden in ("amount", "gross", "net", "value", "currency"):
        assert forbidden not in columns, f"a touchpoint carries {forbidden}"


# ------------------------------------------------------------ RBAC / money
def test_at_rbac_2_nc_revenue_view_alone_cannot_recognize(actor, auth_client):
    """`revenue.view` is not sufficient. `manager` holds view but not recognize."""
    manager = actor(email="m@example.test", role="manager", workspace_name="Mg")
    api = auth_client(manager)
    response = api.post(
        "/api/v1/revenue/events",
        {
            "source_type": "deal",
            "source_ref": {"entity_type": "deal", "public_id": "DEAL-RBAC00000001"},
            "gross": {"amount": "10.0000", "currency": "SAR"},
            "net": {"amount": "10.0000", "currency": "SAR"},
        },
        format="json",
    )
    assert response.status_code == 403
    assert RevenueEvent.objects.count() == 0


def test_at_api_8_nc_analytics_view_alone_returns_no_money(actor, auth_client):
    """`B9-D-A038`. A broad analytics grant never becomes a finance grant."""
    member = actor(email="mem@example.test", role="member", workspace_name="Mem")
    from common.permissions_catalog import grants

    assert grants("analytics.view", "member") is True
    assert grants("revenue.view", "member") is False

    api = auth_client(member)
    assert api.get("/api/v1/attribution").status_code == 403
    assert api.get("/api/v1/revenue").status_code == 403


def test_revenue_is_tenant_isolated(actor, auth_client):
    one = actor(email="r1@example.test", workspace_name="R1")
    two = actor(email="r2@example.test", workspace_name="R2")
    _recognize(one.context, source="DEAL-ISO000000001")

    api = auth_client(two)
    assert api.get("/api/v1/revenue/events").json()["items"] == []
    totals = api.get("/api/v1/revenue").json()["totals"]
    assert totals == {}


def test_no_customer_pii_lives_in_a_b9_table():
    """`AT-SEC-5` **(NC)**. The finance tables carry references, not people."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT table_name, column_name FROM information_schema.columns
               WHERE table_schema='public'
                 AND table_name IN ('revenue_events','revenue_reversals',
                                    'attribution_touchpoints','revenue_attributions')
                 AND (column_name ILIKE '%%email%%' OR column_name ILIKE '%%phone%%'
                      OR column_name ILIKE '%%address%%' OR column_name ILIKE '%%full_name%%')"""
        )
        assert cursor.fetchall() == []


def test_revenue_amounts_are_numeric_not_float():
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT column_name, data_type FROM information_schema.columns
               WHERE table_schema='public' AND table_name='revenue_events'
                 AND column_name IN ('gross_amount','net_amount')"""
        )
        for _, data_type in cursor.fetchall():
            assert data_type == "numeric", f"a revenue amount is {data_type}, not numeric"


# ------------------------------------------------------------ TAX (B10)
def test_the_seller_bootstraps_at_unknown_never_asserting_an_exemption(actor):
    """`B10-D-A016`. The platform must be able to say it does not know."""
    from apps.tax.services import bootstrap_legal_entity, current_profile

    entity = bootstrap_legal_entity()
    profile = current_profile(entity)
    assert profile.zatca_applicability == "unknown"
    assert profile.applicability_reason == ""


def test_an_applicability_change_requires_a_reason_and_versions_the_profile(actor):
    from apps.tax.models import TaxProfile
    from apps.tax.services import bootstrap_legal_entity, set_zatca_applicability

    a = actor()
    entity = bootstrap_legal_entity()
    with pytest.raises(ValidationFailed):
        set_zatca_applicability(
            context=a.context, entity=entity, applicability="not_applicable", reason="  "
        )

    profile = set_zatca_applicability(
        context=a.context,
        entity=entity,
        applicability="not_applicable",
        reason="Owner-supplied: the operating entity is below the ZATCA threshold.",
    )
    assert profile.version_number == 2
    # The OLD version is closed, not edited — a document issued under it keeps
    # its own snapshot.
    assert TaxProfile.objects.filter(legal_entity=entity).count() == 2
    assert TaxProfile.objects.filter(legal_entity=entity, effective_to__isnull=True).count() == 1


def test_no_tax_is_computed_while_the_seller_has_no_obligation(actor):
    from apps.tax.services import bootstrap_legal_entity, issue_tax_invoice

    a = actor()
    entity = bootstrap_legal_entity()
    invoice = issue_tax_invoice(
        context=a.context,
        entity=entity,
        lines=[{"description": "Subscription", "quantity": 1, "unit_price": "299.0000"}],
    )
    assert invoice.subtotal == Decimal("299.0000")
    assert invoice.tax_total == Decimal("0.0000")
    assert invoice.total == Decimal("299.0000")


def test_zatca_submission_is_refused_while_not_enabled(actor):
    from apps.tax.services import bootstrap_legal_entity, issue_tax_invoice, submit_to_zatca
    from common.errors import DomainConflict

    a = actor()
    entity = bootstrap_legal_entity()
    invoice = issue_tax_invoice(
        context=a.context, entity=entity, lines=[{"description": "x", "unit_price": "1.0000"}]
    )
    with pytest.raises(DomainConflict):
        submit_to_zatca(context=a.context, invoice=invoice)


def test_no_zatca_adapter_is_built():
    """(NC) `B14_18` defers it. An unbuilt adapter cannot be half-built."""
    import pathlib

    adapters = pathlib.Path(__file__).resolve().parent.parent / "adapters"
    assert not (adapters / "zatca").exists(), "an unscheduled ZATCA adapter was built"


def test_tax_holds_no_credential_value():
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='public' AND table_name='tax_profiles'"""
        )
        columns = {row[0] for row in cursor.fetchall()}
    # A POINTER only. No certificate, no private key, no plaintext.
    assert "csid_secret_ref" in columns
    for forbidden in ("csid", "certificate", "private_key", "csid_value"):
        assert forbidden not in columns


def test_tax_has_no_write_path_to_revenue_or_billing():
    """The restated firewall, one domain further."""
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "tax"
    offenders = []
    for path in root.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            module = ""
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
            if module.startswith(("apps.revenue", "apps.billing")):
                offenders.append(module)
    assert offenders == [], f"tax reaches a finance table: {offenders}"
