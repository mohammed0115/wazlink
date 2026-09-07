"""support commands (B2 task/appointment model, B7 CA-12). I14.

The SLA clock is the interesting part. It accumulates **running time only**:
pausing stores the elapsed seconds so far and clears `running_since`, and
resuming starts a fresh interval. Counting wall-clock instead would make the
SLA measure how long the customer took to reply, which is not what anyone
agreed to.

The breach sweep REPORTS. It emits `TicketSlaBreached` once per
`(ticket, policy, clock)` — enforced by a unique constraint plus a write-once
`breached_at` — and it escalates, reassigns and closes nothing.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event

from ..models import (
    CLOCK_KINDS,
    CLOCK_PAUSED,
    CLOCK_RUNNING,
    CLOCK_STOPPED,
    TICKET_CLOSED,
    TICKET_OPEN,
    TICKET_PENDING,
    TICKET_PRIORITIES,
    TICKET_RESOLVED,
    SlaPolicy,
    Ticket,
    TicketActivity,
    TicketSlaClock,
)

DEFAULT_POLICIES = {
    "urgent": (15, 240),
    "high": (30, 480),
    "normal": (60, 1440),
    "low": (240, 4320),
}


def ensure_sla_policies(workspace) -> None:
    """Seed the default policies lazily. Figures are DATA, not architecture."""
    for priority, (first_response, resolution) in DEFAULT_POLICIES.items():
        SlaPolicy.objects.get_or_create(
            workspace=workspace,
            priority=priority,
            active=True,
            defaults={
                "name": f"{priority.title()} priority",
                "first_response_minutes": first_response,
                "resolution_minutes": resolution,
            },
        )


@transaction.atomic
def create_ticket(
    *, context, subject: str, body: str = "", priority: str = "normal",
    subject_type: str = "", subject_ref: str = "", assigned_to=None,
) -> Ticket:
    if not (subject or "").strip():
        raise ValidationFailed("A ticket needs a subject.")
    if priority not in TICKET_PRIORITIES:
        raise ValidationFailed("That is not a recognized priority.")

    ensure_sla_policies(context.workspace)
    ticket = Ticket.objects.create(
        workspace=context.workspace,
        subject=subject.strip()[:250],
        body=body or "",
        status=TICKET_OPEN,
        priority=priority,
        subject_type=subject_type[:20],
        subject_ref=subject_ref[:60],
        assigned_to=assigned_to,
        created_by=context.membership,
    )
    _activity(context, ticket, "created")
    _start_clocks(ticket)

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="support.ticket_created",
        target_type="ticket",
        target_ref=ticket.public_id,
    )
    publish_event(
        workspace=context.workspace,
        event_type="TicketCreated",
        aggregate_type="ticket",
        aggregate_ref=ticket.public_id,
        payload={"priority": priority},
    )
    return ticket


def _start_clocks(ticket: Ticket) -> None:
    policy = SlaPolicy.objects.filter(
        workspace=ticket.workspace, priority=ticket.priority, active=True
    ).first()
    if policy is None:
        return
    now = timezone.now()
    for kind in CLOCK_KINDS:
        target = policy.first_response_minutes if kind == "first_response" else policy.resolution_minutes
        TicketSlaClock.objects.get_or_create(
            ticket=ticket,
            policy=policy,
            kind=kind,
            defaults={
                "workspace": ticket.workspace,
                "state": CLOCK_RUNNING,
                "target_minutes": target,
                "running_since": now,
            },
        )


def _activity(context, ticket: Ticket, kind: str, detail: dict | None = None) -> TicketActivity:
    return TicketActivity.objects.create(
        workspace=ticket.workspace,
        ticket=ticket,
        kind=kind,
        detail=detail or {},
        actor_membership=getattr(context, "membership", None),
    )


@transaction.atomic
def assign_ticket(*, context, ticket: Ticket, membership, expected_version=None) -> Ticket:
    if ticket.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested ticket was not found.")
    require_version(ticket, expected_version, required=False)
    if membership is not None and membership.workspace_id != context.workspace.id:
        # A cross-tenant assignee would hand one workspace's work to another's
        # member. Refused, not silently ignored.
        raise ValidationFailed("That member does not belong to this workspace.")

    ticket.assigned_to = membership
    bump_version(ticket)
    ticket.save(update_fields=["assigned_to", "version", "updated_at"])
    assignee = str(membership.pk) if membership is not None else None
    _activity(context, ticket, "assigned", {"assignee": assignee})
    publish_event(
        workspace=context.workspace,
        event_type="TicketAssigned",
        aggregate_type="ticket",
        aggregate_ref=ticket.public_id,
        payload={},
    )
    return ticket


@transaction.atomic
def change_ticket_status(*, context, ticket: Ticket, status: str, expected_version=None) -> Ticket:
    """`pending` PAUSES the clocks; `open` resumes them."""
    if ticket.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested ticket was not found.")
    require_version(ticket, expected_version, required=False)
    if status not in (TICKET_OPEN, TICKET_PENDING):
        raise ValidationFailed("Use resolve or reopen for that transition.")
    if ticket.status in (TICKET_RESOLVED, TICKET_CLOSED):
        raise DomainConflict("Reopen this ticket before changing its status.")

    ticket.status = status
    bump_version(ticket)
    ticket.save(update_fields=["status", "version", "updated_at"])
    _activity(context, ticket, "status_changed", {"status": status})

    for clock in TicketSlaClock.objects.filter(ticket=ticket).exclude(state=CLOCK_STOPPED):
        if status == TICKET_PENDING:
            _pause(clock)
        else:
            _resume(clock)
    return ticket


@transaction.atomic
def resolve_ticket(*, context, ticket: Ticket, expected_version=None) -> Ticket:
    if ticket.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested ticket was not found.")
    require_version(ticket, expected_version, required=False)
    if ticket.status == TICKET_RESOLVED:
        return ticket

    ticket.status = TICKET_RESOLVED
    ticket.resolved_at = timezone.now()
    bump_version(ticket)
    ticket.save(update_fields=["status", "resolved_at", "version", "updated_at"])
    _activity(context, ticket, "resolved")

    for clock in TicketSlaClock.objects.filter(ticket=ticket).exclude(state=CLOCK_STOPPED):
        _stop(clock)

    publish_event(
        workspace=context.workspace,
        event_type="TicketResolved",
        aggregate_type="ticket",
        aggregate_ref=ticket.public_id,
        payload={},
    )
    return ticket


@transaction.atomic
def reopen_ticket(*, context, ticket: Ticket, expected_version=None) -> Ticket:
    if ticket.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested ticket was not found.")
    require_version(ticket, expected_version, required=False)
    if ticket.status not in (TICKET_RESOLVED, TICKET_CLOSED):
        raise DomainConflict("Only a resolved ticket can be reopened.")

    ticket.status = TICKET_OPEN
    ticket.resolved_at = None
    ticket.reopened_count += 1
    bump_version(ticket)
    ticket.save(update_fields=["status", "resolved_at", "reopened_count", "version", "updated_at"])
    _activity(context, ticket, "reopened")

    # The RESOLUTION clock restarts; a breach already emitted is not un-emitted.
    for clock in TicketSlaClock.objects.filter(ticket=ticket, kind="resolution"):
        clock.state = CLOCK_RUNNING
        clock.running_since = timezone.now()
        clock.stopped_at = None
        clock.save(update_fields=["state", "running_since", "stopped_at", "updated_at"])

    publish_event(
        workspace=context.workspace,
        event_type="TicketReopened",
        aggregate_type="ticket",
        aggregate_ref=ticket.public_id,
        payload={},
    )
    return ticket


# --------------------------------------------------------------------------
# The clock
# --------------------------------------------------------------------------
def _accrue(clock: TicketSlaClock, *, now=None) -> int:
    """Running seconds so far. Paused time is never counted."""
    now = now or timezone.now()
    total = clock.elapsed_seconds
    if clock.state == CLOCK_RUNNING and clock.running_since is not None:
        total += int((now - clock.running_since).total_seconds())
    return total


def _pause(clock: TicketSlaClock, *, now=None) -> None:
    if clock.state != CLOCK_RUNNING:
        return
    clock.elapsed_seconds = _accrue(clock, now=now)
    clock.state = CLOCK_PAUSED
    clock.running_since = None
    clock.save(update_fields=["elapsed_seconds", "state", "running_since", "updated_at"])


def _resume(clock: TicketSlaClock, *, now=None) -> None:
    if clock.state != CLOCK_PAUSED:
        return
    clock.state = CLOCK_RUNNING
    clock.running_since = now or timezone.now()
    clock.save(update_fields=["state", "running_since", "updated_at"])


def _stop(clock: TicketSlaClock, *, now=None) -> None:
    clock.elapsed_seconds = _accrue(clock, now=now)
    clock.state = CLOCK_STOPPED
    clock.running_since = None
    clock.stopped_at = now or timezone.now()
    clock.save(
        update_fields=["elapsed_seconds", "state", "running_since", "stopped_at", "updated_at"]
    )


def sla_breach_sweep(*, now=None) -> int:
    """Report a breach exactly ONCE per (ticket, policy, clock). Never acts.

    Idempotence is a database fact: the clock row is unique on the triple, and
    `breached_at` is written once. A redelivered sweep re-reads a row that
    already carries it and emits nothing.
    """
    now = now or timezone.now()
    breached = 0
    for clock in TicketSlaClock.objects.filter(state=CLOCK_RUNNING, breached_at__isnull=True):
        if _accrue(clock, now=now) <= clock.target_minutes * 60:
            continue
        with transaction.atomic():
            locked = TicketSlaClock.objects.select_for_update().get(pk=clock.pk)
            if locked.breached_at is not None:
                continue  # a competitor already emitted it
            locked.breached_at = now
            locked.save(update_fields=["breached_at", "updated_at"])
            publish_event(
                workspace=locked.workspace,
                event_type="TicketSlaBreached",
                aggregate_type="ticket",
                aggregate_ref=locked.ticket.public_id,
                payload={"clock": locked.kind, "policy": locked.policy.public_id},
            )
        breached += 1
    # Nothing was escalated, reassigned or closed. Reporting is the whole job.
    return breached


__all__ = [
    "create_ticket",
    "assign_ticket",
    "change_ticket_status",
    "resolve_ticket",
    "reopen_ticket",
    "sla_breach_sweep",
    "ensure_sla_policies",
    "DEFAULT_POLICIES",
]
