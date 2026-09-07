"""I14 — Support / SLA / merge / calendar / reporting.

Frozen sources, read directly:

*   `B2_TASK_APPOINTMENT_MODEL` / `B7` `CA-12` — the three new triggers and the
    `create_ticket` action at tier `auto_safe`.
*   `B14_18` I14 — a breach is emitted **exactly once** per
    `(ticket, policy, clock)`; the 11 report sections derive no revenue from
    Deals, Quotes, pipeline value or counts; merge is human-only,
    reason-required and single-workspace.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.support.models import Ticket, TicketActivity, TicketSlaClock
from apps.support.services import (
    assign_ticket,
    change_ticket_status,
    create_ticket,
    reopen_ticket,
    resolve_ticket,
    sla_breach_sweep,
)
from common.errors import DomainConflict, ValidationFailed

pytestmark = pytest.mark.django_db(transaction=True)


# ---------------------------------------------------------------- T-TKT
def test_t_tkt_1_a_ticket_is_created_with_its_clocks_running(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="Printer down", priority="high")
    assert ticket.status == "open"
    clocks = TicketSlaClock.objects.filter(ticket=ticket)
    assert clocks.count() == 2
    assert {c.kind for c in clocks} == {"first_response", "resolution"}
    assert all(c.state == "running" for c in clocks)
    assert TicketActivity.objects.filter(ticket=ticket, kind="created").count() == 1


def test_t_tkt_2_assign_resolve_reopen_walk_the_lifecycle(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="Login issue")
    ticket = assign_ticket(context=a.context, ticket=ticket, membership=a.membership)
    assert ticket.assigned_to_id == a.membership.pk

    ticket = resolve_ticket(context=a.context, ticket=ticket)
    assert ticket.status == "resolved" and ticket.resolved_at is not None
    assert all(c.state == "stopped" for c in TicketSlaClock.objects.filter(ticket=ticket))

    ticket = reopen_ticket(context=a.context, ticket=ticket)
    assert ticket.status == "open" and ticket.reopened_count == 1
    resolution = TicketSlaClock.objects.get(ticket=ticket, kind="resolution")
    assert resolution.state == "running"


def test_t_tkt_3_a_cross_workspace_assignee_is_refused(actor):
    one = actor(email="s1@example.test", workspace_name="S1")
    two = actor(email="s2@example.test", workspace_name="S2")
    ticket = create_ticket(context=one.context, subject="x")
    with pytest.raises(ValidationFailed):
        assign_ticket(context=one.context, ticket=ticket, membership=two.membership)


def test_t_tkt_4_an_unresolved_ticket_cannot_be_reopened(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="x")
    with pytest.raises(DomainConflict):
        reopen_ticket(context=a.context, ticket=ticket)


def test_t_tkt_5_a_ticket_touches_no_financial_table():
    """Support is operational. A money column would make it a quiet finance
    surface with none of the finance controls."""
    columns = {f.name for f in Ticket._meta.get_fields()}
    for forbidden in ("amount", "value", "currency", "revenue", "gross", "net", "invoice", "payment"):
        assert forbidden not in columns, f"a ticket carries {forbidden}"


# ---------------------------------------------------------------- T-SLA
def test_t_sla_1_a_paused_clock_does_not_accrue(actor):
    """Counting wall-clock would make the SLA measure the customer's reply."""
    a = actor()
    ticket = create_ticket(context=a.context, subject="Waiting on customer")
    clock = TicketSlaClock.objects.get(ticket=ticket, kind="first_response")
    TicketSlaClock.objects.filter(pk=clock.pk).update(
        running_since=timezone.now() - timedelta(minutes=10)
    )

    change_ticket_status(context=a.context, ticket=ticket, status="pending")
    clock.refresh_from_db()
    assert clock.state == "paused"
    paused_at = clock.elapsed_seconds
    assert paused_at >= 600

    # Time passes while paused. Nothing accrues.
    TicketSlaClock.objects.filter(pk=clock.pk).update(
        updated_at=timezone.now() - timedelta(minutes=30)
    )
    clock.refresh_from_db()
    assert clock.elapsed_seconds == paused_at


def test_t_sla_2_resuming_starts_a_fresh_interval(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="x")
    change_ticket_status(context=a.context, ticket=ticket, status="pending")
    change_ticket_status(context=a.context, ticket=ticket, status="open")
    clock = TicketSlaClock.objects.get(ticket=ticket, kind="first_response")
    assert clock.state == "running"
    assert clock.running_since is not None


def test_t_sla_3_a_breach_is_emitted_exactly_once(actor):
    """The identity is `(ticket, policy, clock)`, and it is a DATABASE fact."""
    from apps.platform_async.models import OutboxEvent

    a = actor()
    ticket = create_ticket(context=a.context, subject="Overdue", priority="urgent")
    TicketSlaClock.objects.filter(ticket=ticket).update(
        running_since=timezone.now() - timedelta(days=30)
    )

    first = sla_breach_sweep()
    assert first == 2  # both clocks breached

    # Re-run the sweep repeatedly. A redelivered sweep emits NOTHING further.
    for _ in range(3):
        assert sla_breach_sweep() == 0

    events = OutboxEvent.objects.filter(event_type="TicketSlaBreached", aggregate_ref=ticket.public_id)
    assert events.count() == 2, f"a breach was emitted more than once: {events.count()}"


def test_t_sla_4_the_sweep_reports_and_never_acts(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="Overdue", priority="urgent")
    TicketSlaClock.objects.filter(ticket=ticket).update(
        running_since=timezone.now() - timedelta(days=30)
    )
    before_status, before_assignee, before_priority = (
        ticket.status,
        ticket.assigned_to_id,
        ticket.priority,
    )
    sla_breach_sweep()

    ticket.refresh_from_db()
    # Nothing escalated, reassigned, reprioritized or closed.
    assert (ticket.status, ticket.assigned_to_id, ticket.priority) == (
        before_status,
        before_assignee,
        before_priority,
    )


def test_a_paused_clock_never_breaches(actor):
    a = actor()
    ticket = create_ticket(context=a.context, subject="x", priority="urgent")
    change_ticket_status(context=a.context, ticket=ticket, status="pending")
    TicketSlaClock.objects.filter(ticket=ticket).update(elapsed_seconds=999999)
    assert sla_breach_sweep() == 0
    assert TicketSlaClock.objects.filter(ticket=ticket, breached_at__isnull=False).count() == 0


# ---------------------------------------------------------------- T-MERGE
def test_t_merge_1_a_merge_is_human_only_and_reason_required(actor):
    from apps.customers.services import create_customer
    from apps.identity.services import merge_parties

    a = actor()
    survivor = create_customer(context=a.context, party_kind="organization", name="Acme Ltd")
    loser = create_customer(context=a.context, party_kind="organization", name="ACME Limited")

    for empty in ("", "   "):
        with pytest.raises(ValidationFailed):
            merge_parties(
                context=a.context, party_type="customer", surviving=survivor, losing=loser,
                reason=empty,
            )

    record = merge_parties(
        context=a.context, party_type="customer", surviving=survivor, losing=loser,
        reason="duplicate created by import",
    )
    assert record.surviving_id == survivor.pk
    assert record.merged_id == loser.pk
    assert record.reason == "duplicate created by import"


def test_t_merge_2_nc_no_cross_workspace_merge(actor):
    from apps.customers.services import create_customer
    from apps.identity.services import merge_parties

    one = actor(email="m1@example.test", workspace_name="M1")
    two = actor(email="m2@example.test", workspace_name="M2")
    survivor = create_customer(context=one.context, party_kind="organization", name="A")
    foreign = create_customer(context=two.context, party_kind="organization", name="B")

    with pytest.raises(ValidationFailed):
        merge_parties(
            context=one.context, party_type="customer", surviving=survivor, losing=foreign,
            reason="looks the same",
        )


def test_t_merge_3_nc_no_immutable_finance_row_is_rewritten(actor):
    """A merge changes who a party is, never what was recognized."""
    from apps.customers.services import create_customer
    from apps.identity.services import merge_parties
    from apps.revenue.models import RevenueEvent
    from apps.revenue.services import record_revenue_event

    a = actor()
    survivor = create_customer(context=a.context, party_kind="organization", name="Survivor")
    loser = create_customer(context=a.context, party_kind="organization", name="Loser")
    event = record_revenue_event(
        context=a.context, source_type="deal", source_entity_type="deal",
        source_public_id="DEAL-MERGE0000001", gross="500.0000", net="500.0000", currency="SAR",
    )
    before = (event.gross_amount, event.net_amount, event.source_public_id, event.status)

    merge_parties(
        context=a.context, party_type="customer", surviving=survivor, losing=loser,
        reason="duplicate",
    )
    event = RevenueEvent.objects.get(pk=event.pk)
    assert (event.gross_amount, event.net_amount, event.source_public_id, event.status) == before


def test_t_merge_4_nc_there_is_no_automatic_merge():
    """No automation action, no signal and no sweep reaches `MergeParties`."""
    from apps.automation.models import ACTION_TYPES

    for action in ACTION_TYPES:
        assert "merge" not in action, f"an automation action performs a merge: {action}"

    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps"
    offenders = []
    for path in root.rglob("*.py"):
        module = path.relative_to(root).parts[0]
        if module == "identity":
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("apps.identity"):
                names = [alias.name for alias in node.names]
                if "merge_parties" in names:
                    offenders.append(module)
    assert offenders == [], f"a module outside identity invokes merge: {offenders}"


def test_a_merged_party_cannot_be_merged_twice(actor):
    from apps.customers.services import create_customer
    from apps.identity.services import merge_parties

    a = actor()
    survivor = create_customer(context=a.context, party_kind="organization", name="S")
    loser = create_customer(context=a.context, party_kind="organization", name="L")
    merge_parties(
        context=a.context, party_type="customer", surviving=survivor, losing=loser, reason="dup"
    )
    with pytest.raises(DomainConflict):
        merge_parties(
            context=a.context, party_type="customer", surviving=survivor, losing=loser, reason="again"
        )


# ---------------------------------------------------------------- T-CAL
def test_t_cal_1_the_calendar_unions_tasks_and_appointments(actor):
    from apps.crm.selectors import calendar_entries
    from apps.crm.services import create_appointment, create_task

    a = actor()
    now = timezone.now()
    create_task(context=a.context, title="Call back", due_at=now + timedelta(hours=2))
    create_appointment(
        context=a.context, title="Demo", starts_at=now + timedelta(hours=1),
        ends_at=now + timedelta(hours=2),
    )
    entries = calendar_entries(a.workspace)
    assert {e["kind"] for e in entries} == {"task", "appointment"}
    # Deterministic order, with the public id as the tiebreak.
    assert entries == sorted(entries, key=lambda e: (e["occurs_at"], e["entry_id"]))


def test_t_cal_2_the_calendar_is_tenant_isolated(actor, auth_client):
    from apps.crm.services import create_task

    one = actor(email="c1@example.test", workspace_name="C1")
    two = actor(email="c2@example.test", workspace_name="C2")
    create_task(context=one.context, title="Private", due_at=timezone.now() + timedelta(hours=1))
    assert auth_client(two).get("/api/v1/activities/calendar").json()["items"] == []


# ---------------------------------------------------------------- T-RPT
def test_t_rpt_1_every_revenue_figure_comes_from_revenue_events(actor):
    """The 11 sections derive no revenue from Deals, Quotes or pipeline value."""
    from apps.analytics.selectors import REPORT_SECTIONS, report_section
    from apps.crm.services import create_lead
    from apps.pipeline.services import close_deal, create_deal

    a = actor()
    lead = create_lead(
        context=a.context, origin_type="manual",
        primary_contact={"name": "R", "phone": "+966501234567"},
    )
    deal = create_deal(context=a.context, lead=lead, title="Big", value="90000.0000")
    close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    assert len(REPORT_SECTIONS) == 11
    revenue = report_section(a.workspace, "recognized_revenue")
    # A Won Deal worth 90,000 contributes NOTHING to recognized revenue.
    assert revenue["data"]["totals"] == {}

    pipeline = report_section(a.workspace, "pipeline_value")
    assert "forecast" in pipeline["data"]["note"]


def test_t_rpt_2_a_recognized_event_appears_in_the_revenue_section(actor):
    from apps.analytics.selectors import report_section
    from apps.revenue.services import record_revenue_event

    a = actor()
    record_revenue_event(
        context=a.context, source_type="deal", source_entity_type="deal",
        source_public_id="DEAL-RPT000000001", gross="1200.0000", net="1000.0000", currency="SAR",
    )
    totals = report_section(a.workspace, "recognized_revenue")["data"]["totals"]
    assert totals["SAR"]["net_recognized"] == "1000.0000"


def test_t_rpt_3_an_unknown_section_fails_closed(actor):
    from apps.analytics.selectors import report_section

    a = actor()
    assert report_section(a.workspace, "made_up_section")["state"] == "unavailable"


def test_a_monetary_report_section_requires_revenue_view(actor, auth_client):
    """`B9-D-A038`. `analytics.view` alone never returns money."""
    member = actor(email="rp@example.test", role="member", workspace_name="Rp")
    api = auth_client(member)
    # Non-monetary sections are readable.
    assert api.get("/api/v1/analytics/ticket_volume").status_code == 200
    # Monetary ones are not.
    assert api.get("/api/v1/analytics/recognized_revenue").status_code == 403
    assert api.get("/api/v1/analytics/revenue_by_origin").status_code == 403


# ---------------------------------------------------------------- CA-12
def test_ca_12_registers_three_triggers_and_an_auto_safe_create_ticket():
    from apps.automation.models import ACTION_TIERS, TRIGGER_TYPES

    for trigger in ("customer_created", "ticket_created", "sla_breached"):
        assert trigger in TRIGGER_TYPES
    assert ACTION_TIERS["create_ticket"] == "auto_safe"
    # And `send_message` is STILL mandatorily approval-required (T-AUTO-1).
    assert ACTION_TIERS["send_message"] == "approval_required"


def test_an_automation_rule_can_create_a_ticket_without_approval(actor, auth_client):
    from apps.automation.services import evaluate_event, execute_run

    a = actor()
    api = auth_client(a)
    created = api.post(
        "/api/v1/automation/rules",
        {
            "name": "Auto ticket",
            "trigger_type": "customer_created",
            "actions": [{"action_type": "create_ticket", "params": {"subject": "Welcome check"}}],
            "activate": True,
        },
        format="json",
    )
    assert created.status_code == 201
    assert created.json()["actions"][0]["safety_tier"] == "auto_safe"

    runs = evaluate_event(
        workspace=a.workspace, trigger_type="customer_created",
        source_event_id="evt-ticket-1", payload={"entity_ref": "CUS-TEST0000000001"},
    )
    execute_run(run_id=runs[0].pk, actor_context=a.context)
    assert Ticket.objects.filter(workspace=a.workspace, subject="Welcome check").count() == 1


# ---------------------------------------------------------------- tenancy
def test_tickets_are_tenant_isolated(actor, auth_client):
    one = actor(email="ti1@example.test", workspace_name="Ti1")
    two = actor(email="ti2@example.test", workspace_name="Ti2")
    ticket = create_ticket(context=one.context, subject="Secret")
    api = auth_client(two)
    assert api.get("/api/v1/tickets").json()["items"] == []
    assert api.get(f"/api/v1/tickets/{ticket.public_id}").status_code == 404


def test_the_ticket_api_journey(actor, auth_client):
    a = actor()
    api = auth_client(a)
    created = api.post(
        "/api/v1/tickets", {"subject": "Cannot log in", "priority": "high"}, format="json"
    )
    assert created.status_code == 201
    ref = created.json()["id"]
    detail = api.get(f"/api/v1/tickets/{ref}").json()
    assert len(detail["sla"]) == 2
    assert api.post(f"/api/v1/tickets/{ref}/resolve").json()["status"] == "resolved"
    assert api.post(f"/api/v1/tickets/{ref}/reopen").json()["status"] == "open"


def test_a_viewer_cannot_create_a_ticket(actor, auth_client):
    viewer = actor(email="tv@example.test", role="viewer", workspace_name="Tv")
    response = auth_client(viewer).post("/api/v1/tickets", {"subject": "x"}, format="json")
    assert response.status_code == 403
