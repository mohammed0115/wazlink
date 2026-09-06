"""automation (L9) — B7 rules, runs and the approval queue (M19).

Two frozen decisions dominate this module:

*   **Every action maps to exactly ONE governed domain command**, invoked
    through that domain's unmodified admission sequence. No action writes
    another domain's table, and `automation` therefore grants no authority it
    did not already have to give.
*   **`send_message` is `approval_required`, mandatorily and
    non-configurably** (`B7_ACTION_CATALOG` §3, `T-AUTO-1`). The action exists —
    frozen B5 reserves this caller deliberately — but a human approves EVERY
    automation-initiated send, every time. There is no `auto_safe` override for
    a rule author to set, which is why it is a property of the catalog below
    rather than a column on a rule.

The excluded list is equally load-bearing and is named rather than merely
absent: `close_won_deal`, `close_lost_deal`, `change_deal_value`,
`change_deal_probability`, `create_revenue`, `create_attribution` and
`delete_lead` cannot be stored, scheduled or executed by any path here.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

# --- Triggers (B7_TRIGGER_CATALOG §2) --------------------------------------
# Phase 1 only. `scheduled` is excluded: no delay action and no `waiting` run
# state exists, so a time trigger would have nothing to reach.
TRIGGER_TYPES = (
    "lead_created",
    "lead_status_changed",
    "lead_priority_changed",
    "lead_owner_changed",
    "task_created",
    "task_completed",
    "appointment_created",
    "appointment_completed",
    "appointment_no_show",
    "deal_created",
    "deal_stage_changed",
    "deal_won",
    "deal_lost",
    "conversation_received",
    "manual",
)

# --- Safety tiers ----------------------------------------------------------
TIER_AUTO_SAFE = "auto_safe"
TIER_APPROVAL_REQUIRED = "approval_required"

# --- Actions (B7_ACTION_CATALOG §2) ----------------------------------------
# The tier is a property of the ACTION, not of the rule that uses it. A rule
# author cannot lower one, because there is no field to lower it with.
ACTION_TIERS: dict[str, str] = {
    "create_task": TIER_AUTO_SAFE,
    "create_followup_task": TIER_AUTO_SAFE,
    "schedule_appointment": TIER_APPROVAL_REQUIRED,
    "change_lead_priority": TIER_APPROVAL_REQUIRED,
    "change_lead_status": TIER_APPROVAL_REQUIRED,
    "assign_lead_owner": TIER_APPROVAL_REQUIRED,
    "escalate_to_manager": TIER_APPROVAL_REQUIRED,
    "move_deal_stage": TIER_APPROVAL_REQUIRED,
    # MANDATORY, never auto_safe, not configurable per rule (T-AUTO-1).
    "send_message": TIER_APPROVAL_REQUIRED,
    "stop_execution": TIER_AUTO_SAFE,
}
ACTION_TYPES = tuple(ACTION_TIERS)

# Named so the prohibition is testable rather than merely missing. None of
# these is reachable by any path in this module.
EXCLUDED_ACTION_TYPES = (
    "close_won_deal",
    "close_lost_deal",
    "change_deal_value",
    "change_deal_probability",
    "create_revenue",
    "create_attribution",
    "delete_lead",
)

RULE_DRAFT = "draft"
RULE_ACTIVE = "active"
RULE_PAUSED = "paused"

RUN_PENDING = "pending"
RUN_AWAITING_APPROVAL = "awaiting_approval"
RUN_RUNNING = "running"
RUN_SUCCEEDED = "succeeded"
RUN_FAILED = "failed"
RUN_REJECTED = "rejected"
RUN_BLOCKED = "blocked"
RUN_TERMINAL = (RUN_SUCCEEDED, RUN_FAILED, RUN_REJECTED, RUN_BLOCKED)

# Loop prevention: an action that itself emits a trigger cannot recurse forever.
MAX_RUN_DEPTH = 3


class AutomationRule(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "AUT"

    STATUS_CHOICES = [(s, s) for s in (RULE_DRAFT, RULE_ACTIVE, RULE_PAUSED)]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="automation_rules"
    )
    name = models.CharField(max_length=120)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=RULE_DRAFT)
    active_revision = models.ForeignKey(
        "AutomationRuleRevision",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_for",
    )
    created_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="automation_rules"
    )

    class Meta:
        db_table = "automation_rules"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "name"], name="uq_automation_rule_name"),
        ]


class AutomationRuleRevision(TimestampedModel):
    """An immutable snapshot of a rule's definition.

    Editing a rule creates a NEW revision. A run records which revision it ran,
    so "why did this fire" stays answerable after the rule is edited.
    """

    rule = models.ForeignKey(AutomationRule, on_delete=models.CASCADE, related_name="revisions")
    revision_no = models.PositiveIntegerField()
    trigger_type = models.CharField(max_length=40, choices=[(t, t) for t in TRIGGER_TYPES])

    class Meta:
        db_table = "automation_rule_revisions"
        constraints = [
            models.UniqueConstraint(fields=["rule", "revision_no"], name="uq_automation_revision"),
            models.CheckConstraint(
                condition=Q(trigger_type__in=TRIGGER_TYPES), name="ck_automation_trigger_type"
            ),
        ]


class AutomationCondition(TimestampedModel):
    """One condition over the frozen `event.*` namespace.

    `field` is matched against the event payload only — never against a live
    object graph — which is what keeps the condition engine from traversing into
    another domain's secrets or provider payloads.
    """

    OPERATORS = ("eq", "ne", "in", "gt", "lt", "contains", "exists")

    revision = models.ForeignKey(
        AutomationRuleRevision, on_delete=models.CASCADE, related_name="conditions"
    )
    field = models.CharField(max_length=80)
    operator = models.CharField(max_length=20, choices=[(o, o) for o in OPERATORS], default="eq")
    value = models.JSONField(default=dict)

    class Meta:
        db_table = "automation_conditions"


class AutomationAction(TimestampedModel):
    """One step. Its safety tier comes from the CATALOG, never from this row."""

    revision = models.ForeignKey(
        AutomationRuleRevision, on_delete=models.CASCADE, related_name="actions"
    )
    position = models.PositiveIntegerField(default=0)
    action_type = models.CharField(max_length=40, choices=[(a, a) for a in ACTION_TYPES])
    params = models.JSONField(default=dict)

    class Meta:
        db_table = "automation_actions"
        ordering = ["position"]
        constraints = [
            # An excluded action cannot be STORED, so it can never be scheduled
            # or executed regardless of what a future code path attempts.
            models.CheckConstraint(
                condition=Q(action_type__in=ACTION_TYPES), name="ck_automation_action_type"
            ),
        ]

    @property
    def safety_tier(self) -> str:
        return ACTION_TIERS.get(self.action_type, TIER_APPROVAL_REQUIRED)


class AutomationInboxRecord(TimestampedModel):
    """The consumer inbox. Dedup on `(workspace_id, source_event_id)`.

    This is the class `C` half of event consumption: automation never imports a
    producer, it consumes the producer's event and records having done so. The
    unique constraint is what makes a redelivered event a no-op rather than a
    second execution.
    """

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="automation_inbox"
    )
    source_event_id = models.CharField(max_length=64)
    trigger_type = models.CharField(max_length=40)

    class Meta:
        db_table = "automation_inbox_records"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "source_event_id"], name="uq_automation_inbox"
            ),
        ]


class AutomationRun(PublicIdModel, TimestampedModel, VersionedModel):
    """One evaluation of one rule against one event."""

    PUBLIC_ID_PREFIX = "AGA"

    STATUS_CHOICES = [
        (s, s)
        for s in (
            RUN_PENDING,
            RUN_AWAITING_APPROVAL,
            RUN_RUNNING,
            RUN_SUCCEEDED,
            RUN_FAILED,
            RUN_REJECTED,
            RUN_BLOCKED,
        )
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="automation_runs"
    )
    rule = models.ForeignKey(AutomationRule, on_delete=models.CASCADE, related_name="runs")
    revision = models.ForeignKey(
        AutomationRuleRevision, on_delete=models.RESTRICT, related_name="runs"
    )
    trigger_type = models.CharField(max_length=40)
    source_event_id = models.CharField(max_length=64, blank=True, db_index=True)
    entity_ref = models.CharField(max_length=60, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=RUN_PENDING)
    # Re-entrancy bound. A run caused by another run's action carries depth+1.
    depth = models.PositiveSmallIntegerField(default=0)
    event_payload = models.JSONField(default=dict)
    failure_code = models.CharField(max_length=60, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "automation_runs"
        indexes = [models.Index(fields=["workspace", "status", "-created_at"])]
        constraints = [
            # One run per (rule, event). The dedup that makes a redelivered
            # event — or two workers racing one — execute the rule ONCE.
            models.UniqueConstraint(
                fields=["rule", "source_event_id"],
                condition=~Q(source_event_id=""),
                name="uq_automation_run_event",
            ),
        ]

    @property
    def is_terminal(self) -> bool:
        return self.status in RUN_TERMINAL


class AutomationStepRun(TimestampedModel):
    """One action's execution inside a run. `(run, position)` is unique.

    That constraint is why a retried run cannot execute a step twice: the step
    row already exists and already carries its outcome.
    """

    # `running` is a DURABLE claim. The governed command it dispatches cannot
    # run inside the claiming transaction, so the row lock is released before
    # the command executes — without a persisted claim two workers both read
    # `pending` and the action happens twice.
    STATUS_CHOICES = [
        (s, s) for s in ("pending", "running", "succeeded", "failed", "skipped", "awaiting_approval")
    ]

    run = models.ForeignKey(AutomationRun, on_delete=models.CASCADE, related_name="steps")
    position = models.PositiveIntegerField(default=0)
    action_type = models.CharField(max_length=40)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="pending")
    # The public id the governed command returned — evidence of what ran.
    result_ref = models.CharField(max_length=60, blank=True)
    failure_code = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "automation_step_runs"
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["run", "position"], name="uq_automation_step"),
        ]


class AutomationApproval(TimestampedModel):
    """The human gate. One per run, and a run cannot execute without it.

    A `send_message` step reaches a provider only after a member holding
    `automation.run.approve` has decided here — and the send then runs as THAT
    human through messaging's unmodified admission sequence.
    """

    STATUS_CHOICES = [("pending", "pending"), ("approved", "approved"), ("rejected", "rejected")]

    run = models.OneToOneField(AutomationRun, on_delete=models.CASCADE, related_name="approval")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    decided_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="automation_approvals",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    reason = models.TextField(blank=True)

    class Meta:
        db_table = "automation_approvals"
