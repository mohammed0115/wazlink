"""assignment (L4) — routing rules and their counters (`GAP-022`, M23).

Pulled forward from I14 to I6 because P0 `GAP-013` (the team inbox) depends on
it: an inbox without ownership is a shared mailbox, not a routed queue.

**The round-robin counter is a PostgreSQL row taken under `SELECT ... FOR
UPDATE` — never Redis** (CRM-INV-11). Redis is not authoritative business
state, and a counter that can silently reset on an eviction produces exactly
the failure this table exists to prevent: two agents handed the same
conversation, or one agent handed every conversation.
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel, VersionedModel

STRATEGY_ROUND_ROBIN = "round_robin"
STRATEGY_FIXED = "fixed"
STRATEGIES = (STRATEGY_ROUND_ROBIN, STRATEGY_FIXED)

SUBJECT_CONVERSATION = "conversation"
SUBJECT_KINDS = (SUBJECT_CONVERSATION,)


class AssignmentRule(PublicIdModel, TimestampedModel, VersionedModel):
    """One routing rule. Rules are tried in `position` order; the first
    applicable rule wins, so ordering is a product decision the operator makes
    explicitly rather than an emergent property of insertion order."""

    PUBLIC_ID_PREFIX = "ASR"

    STRATEGY_CHOICES = [(s, s) for s in STRATEGIES]
    SUBJECT_CHOICES = [(s, s) for s in SUBJECT_KINDS]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="assignment_rules"
    )
    name = models.CharField(max_length=120)
    subject_kind = models.CharField(max_length=30, choices=SUBJECT_CHOICES, default=SUBJECT_CONVERSATION)
    strategy = models.CharField(max_length=30, choices=STRATEGY_CHOICES, default=STRATEGY_ROUND_ROBIN)
    # Candidate memberships, in a stable order. Stored as PUBLIC IDs so a rule
    # carries no FK into a list and reordering is one write.
    member_refs = models.JSONField(default=list)
    active = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "assignment_rules"
        indexes = [models.Index(fields=["workspace", "subject_kind", "position"])]
        constraints = [
            models.UniqueConstraint(fields=["workspace", "name"], name="uq_assignment_rule_name"),
        ]


class AssignmentCounter(TimestampedModel):
    """The round-robin cursor. ONE row per rule, locked on every advance.

    `cursor` is monotonic and never reset by the domain: fairness is a property
    of the sequence, and resetting it would silently re-favour whoever happens
    to be first in the member list.
    """

    rule = models.OneToOneField(AssignmentRule, on_delete=models.CASCADE, related_name="counter")
    cursor = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "assignment_counters"
