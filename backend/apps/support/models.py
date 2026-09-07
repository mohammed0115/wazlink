"""support (L8) — tickets and SLA (M26).

Two properties are load-bearing and both are refusals:

*   **A ticket touches no financial table.** There is no amount, no currency,
    no revenue reference and no billing reference anywhere below. Support is
    an operational domain, and giving it a money column would make it a
    second, quieter finance surface.
*   **The SLA sweep REPORTS a breach; it never acts on one.** `TicketSlaBreached`
    is emitted exactly once per `(ticket, policy, clock)` — that triple is a
    unique constraint, not a convention — and nothing escalates, reassigns or
    closes anything automatically.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

TICKET_OPEN = "open"
TICKET_PENDING = "pending"
TICKET_RESOLVED = "resolved"
TICKET_CLOSED = "closed"
TICKET_STATUSES = (TICKET_OPEN, TICKET_PENDING, TICKET_RESOLVED, TICKET_CLOSED)

TICKET_PRIORITIES = ("low", "normal", "high", "urgent")

# A clock PAUSES while the ticket is waiting on the customer: counting that
# time against the team would make the SLA measure the customer's response.
CLOCK_RUNNING = "running"
CLOCK_PAUSED = "paused"
CLOCK_STOPPED = "stopped"
CLOCK_STATES = (CLOCK_RUNNING, CLOCK_PAUSED, CLOCK_STOPPED)

CLOCK_KINDS = ("first_response", "resolution")

ACTIVITY_KINDS = ("created", "assigned", "status_changed", "resolved", "reopened", "note")


class SlaPolicy(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "TKT"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="sla_policies"
    )
    name = models.CharField(max_length=120)
    priority = models.CharField(max_length=20, default="normal")
    first_response_minutes = models.PositiveIntegerField(default=60)
    resolution_minutes = models.PositiveIntegerField(default=1440)
    active = models.BooleanField(default=True)

    class Meta:
        db_table = "sla_policies"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "priority"],
                condition=Q(active=True),
                name="uq_sla_policy_priority",
            ),
            models.CheckConstraint(
                condition=Q(priority__in=TICKET_PRIORITIES), name="ck_sla_policy_priority"
            ),
        ]


class Ticket(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "TKT"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="tickets"
    )
    subject = models.CharField(max_length=250)
    body = models.TextField(blank=True)
    status = models.CharField(max_length=20, default=TICKET_OPEN)
    priority = models.CharField(max_length=20, default="normal")
    # Polymorphic subject by PUBLIC ID — the same house pattern the revenue
    # source and the file attachment use. No FK to a CRM aggregate, so support
    # never becomes a second owner of customer truth.
    subject_type = models.CharField(max_length=20, blank=True)
    subject_ref = models.CharField(max_length=60, blank=True)
    assigned_to = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        related_name="assigned_tickets",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="created_tickets", null=True
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    reopened_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "tickets"
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "assigned_to"]),
            models.Index(fields=["workspace", "subject_type", "subject_ref"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(status__in=TICKET_STATUSES), name="ck_ticket_status"),
            models.CheckConstraint(
                condition=Q(priority__in=TICKET_PRIORITIES), name="ck_ticket_priority"
            ),
        ]


class TicketActivity(PublicIdModel, TimestampedModel):
    """Append-only. The ticket's own history, never edited."""

    PUBLIC_ID_PREFIX = "TKT"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="ticket_activities"
    )
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="activities")
    kind = models.CharField(max_length=30)
    detail = models.JSONField(default=dict, blank=True)
    actor_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="ticket_activities", null=True
    )

    class Meta:
        db_table = "ticket_activities"
        indexes = [models.Index(fields=["workspace", "ticket", "created_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(kind__in=ACTIVITY_KINDS), name="ck_ticket_activity_kind")
        ]


class TicketSlaClock(TimestampedModel):
    """One clock per `(ticket, policy, kind)`.

    `breached_at` is set ONCE. The breach event's identity is the triple below,
    and `uq_ticket_sla_clock` is what makes "exactly once" a database fact
    rather than a sweep that remembers what it already did.
    """

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="ticket_sla_clocks"
    )
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="sla_clocks")
    policy = models.ForeignKey(SlaPolicy, on_delete=models.RESTRICT, related_name="clocks")
    kind = models.CharField(max_length=30)
    state = models.CharField(max_length=20, default=CLOCK_RUNNING)
    target_minutes = models.PositiveIntegerField(default=60)
    # Accumulated RUNNING time only. Paused time is never added, which is the
    # whole point of pausing.
    elapsed_seconds = models.PositiveIntegerField(default=0)
    running_since = models.DateTimeField(null=True, blank=True)
    breached_at = models.DateTimeField(null=True, blank=True)
    stopped_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ticket_sla_clocks"
        indexes = [models.Index(fields=["workspace", "state"])]
        constraints = [
            models.UniqueConstraint(
                fields=["ticket", "policy", "kind"], name="uq_ticket_sla_clock"
            ),
            models.CheckConstraint(condition=Q(state__in=CLOCK_STATES), name="ck_sla_clock_state"),
            models.CheckConstraint(condition=Q(kind__in=CLOCK_KINDS), name="ck_sla_clock_kind"),
        ]
