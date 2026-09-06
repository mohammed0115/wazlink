"""revenue (L7) — the recognition register and first-touch attribution (M21).

**This is the only module in WazLink that may write recognized revenue**, and
the strongest statement in `B9_REVENUE_FIREWALL` is an absence:

> **B9 has zero event consumers** (`B9-D-A002`).

There is no handler here for `DealWon`, `PaymentSucceeded`,
`SubscriptionActivated` or anything else. `RecordRevenueEvent` is invoked by a
human membership holding `revenue.recognize`, and by nothing else — so
"Won Deal ⇒ Recognized Revenue" is not a rule this module declines to
implement, it is a path that does not exist.

Immutability is likewise structural: `revenue_events` and `revenue_reversals`
carry **no** `deleted_at`, **no** `archived_at` and **no** `version`. A wrong
amount is corrected by a reversal plus a fresh recognition — an auditable
compensating pair — never by a mutation (`B9-D-A010`).
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel

# The closed source set (`B9-D-A005`). Five, exactly.
SOURCE_TYPES = ("deal", "lead", "business", "payment", "invoice")

# The three derived states. No `draft`, no `pending`, no `void`: an event
# exists only once recognition has been decided.
STATUS_RECOGNIZED = "recognized"
STATUS_PARTIALLY_REVERSED = "partially_reversed"
STATUS_REVERSED = "reversed"
REVENUE_STATUSES = (STATUS_RECOGNIZED, STATUS_PARTIALLY_REVERSED, STATUS_REVERSED)

REVERSAL_REASONS = ("refund", "chargeback", "correction", "duplicate", "cancellation", "write_off")

TOUCHPOINT_SUBJECTS = ("business", "lead")
TOUCHPOINT_SOURCE_TYPES = ("discovery_job", "discovery_result", "lead", "business")
ORIGIN_KINDS = ("discovery", "import", "manual", "api", "form", "referral", "other")

CANDIDATE_KINDS = ("touchpoint", "derived_provenance")

# The WazLink PRODUCT limit — 12 integer digits. Deliberately far below what
# NUMERIC(18,4) permits: an amount above this is far more likely a misplaced
# decimal or a minor/major-unit confusion than a commercial fact.
AMOUNT_PRODUCT_MAX = 999999999999.9999


class RevenueEvent(PublicIdModel, TimestampedModel):
    """One recognition decision. Created once, never updated except `status`."""

    PUBLIC_ID_PREFIX = "REV"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="revenue_events"
    )
    source_type = models.CharField(max_length=20)
    # The polymorphic pair REPLACES typed deal_id/payment_id columns; the
    # frozen DTO says so in terms, and re-adding them would contradict it.
    source_entity_type = models.CharField(max_length=40)
    source_public_id = models.CharField(max_length=60)
    gross_amount = models.DecimalField(max_digits=18, decimal_places=4)
    net_amount = models.DecimalField(max_digits=18, decimal_places=4)
    currency = models.CharField(max_length=3)
    recognized_at = models.DateTimeField()
    status = models.CharField(max_length=20, default=STATUS_RECOGNIZED)
    recognized_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="revenue_events"
    )
    idempotency_key = models.CharField(max_length=120)
    note = models.TextField(blank=True)

    class Meta:
        db_table = "revenue_events"
        indexes = [
            models.Index(fields=["workspace", "recognized_at"]),
            models.Index(fields=["workspace", "currency", "recognized_at"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "source_entity_type", "source_public_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "idempotency_key"], name="uq_revenue_events_idempotency"
            ),
            # The duplicate-recognition guard. The predicate releases a source
            # ONLY when the event is fully reversed in BOTH folds, so a source
            # is never re-recognizable while net revenue survives.
            models.UniqueConstraint(
                fields=["workspace", "source_type", "source_entity_type", "source_public_id"],
                condition=~Q(status=STATUS_REVERSED),
                name="uq_revenue_events_source",
            ),
            models.CheckConstraint(
                condition=Q(gross_amount__gt=0), name="ck_revenue_events_gross_positive"
            ),
            models.CheckConstraint(condition=Q(net_amount__gt=0), name="ck_revenue_events_net_positive"),
            models.CheckConstraint(
                condition=Q(net_amount__lte=models.F("gross_amount")),
                name="ck_revenue_events_net_le_gross",
            ),
            models.CheckConstraint(
                condition=Q(gross_amount__lte=AMOUNT_PRODUCT_MAX),
                name="ck_revenue_events_gross_product_max",
            ),
            models.CheckConstraint(
                condition=Q(net_amount__lte=AMOUNT_PRODUCT_MAX), name="ck_revenue_events_net_product_max"
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"), name="ck_revenue_events_currency"
            ),
            models.CheckConstraint(
                condition=Q(status__in=REVENUE_STATUSES), name="ck_revenue_events_status"
            ),
            models.CheckConstraint(
                condition=Q(source_type__in=SOURCE_TYPES), name="ck_revenue_events_source_type"
            ),
        ]


class RevenueReversal(PublicIdModel, TimestampedModel):
    """Append-only. `net` is DERIVED, never accepted from a caller.

    `ck_..._net_non_negative` admits `0` because exactly one legal row has it:
    the terminal gross-cleanup that closes a rounding residual
    (`B9_REVERSAL_MODEL` §4.1a). Whether a given row is that one depends on the
    sums of its siblings and on its parent, which no single-row CHECK can see —
    so the shape is admitted here and the case is decided in the command, under
    the event's row lock.
    """

    PUBLIC_ID_PREFIX = "REVR"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="revenue_reversals"
    )
    revenue_event = models.ForeignKey(
        RevenueEvent, on_delete=models.RESTRICT, related_name="reversals"
    )
    gross_amount = models.DecimalField(max_digits=18, decimal_places=4)
    net_amount = models.DecimalField(max_digits=18, decimal_places=4)
    currency = models.CharField(max_length=3)
    reason = models.CharField(max_length=20)
    evidence_ref = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    reversed_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="revenue_reversals"
    )
    reversed_at = models.DateTimeField()
    idempotency_key = models.CharField(max_length=120)

    class Meta:
        db_table = "revenue_reversals"
        indexes = [
            models.Index(fields=["revenue_event"]),
            models.Index(fields=["workspace", "reversed_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "idempotency_key"], name="uq_revenue_reversals_idempotency"
            ),
            models.CheckConstraint(
                condition=Q(gross_amount__gt=0), name="ck_revenue_reversals_gross_positive"
            ),
            models.CheckConstraint(
                condition=Q(net_amount__gte=0), name="ck_revenue_reversals_net_non_negative"
            ),
            models.CheckConstraint(
                condition=Q(net_amount__lte=models.F("gross_amount")),
                name="ck_revenue_reversals_net_le_gross",
            ),
            models.CheckConstraint(
                condition=Q(gross_amount__lte=AMOUNT_PRODUCT_MAX),
                name="ck_revenue_reversals_gross_product_max",
            ),
            models.CheckConstraint(
                condition=Q(currency__regex=r"^[A-Z]{3}$"), name="ck_revenue_reversals_currency"
            ),
            models.CheckConstraint(
                condition=Q(reason__in=REVERSAL_REASONS), name="ck_revenue_reversals_reason"
            ),
        ]


class AttributionTouchpoint(PublicIdModel, TimestampedModel):
    """An acquisition touch. Carries NO amount — attribution never mutates money."""

    PUBLIC_ID_PREFIX = "ATT"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="attribution_touchpoints"
    )
    subject_type = models.CharField(max_length=20)
    subject_public_id = models.CharField(max_length=60)
    source_type = models.CharField(max_length=30)
    source_entity_type = models.CharField(max_length=40)
    source_public_id = models.CharField(max_length=60)
    # The acquisition-CHANNEL dimension. Not an entity reference.
    origin_kind = models.CharField(max_length=20)
    # A DiscoverySource contract string (e.g. `SRC-1004`). Never an EntityRef,
    # never workspace-resolved.
    source_code = models.CharField(max_length=40, blank=True)
    occurred_at = models.DateTimeField()
    position = models.PositiveIntegerField()
    channel = models.CharField(max_length=60, blank=True)
    campaign = models.CharField(max_length=120, blank=True)
    recorded_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="attribution_touchpoints"
    )
    idempotency_key = models.CharField(max_length=120)

    class Meta:
        db_table = "attribution_touchpoints"
        indexes = [
            models.Index(fields=["workspace", "subject_type", "subject_public_id", "occurred_at"]),
            models.Index(fields=["workspace", "occurred_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "idempotency_key"], name="uq_attribution_idempotency"
            ),
            models.UniqueConstraint(
                fields=["workspace", "subject_type", "subject_public_id", "position"],
                name="uq_attribution_position",
            ),
            models.CheckConstraint(condition=Q(position__gte=1), name="ck_attribution_position"),
            models.CheckConstraint(
                condition=Q(subject_type__in=TOUCHPOINT_SUBJECTS), name="ck_attribution_subject_type"
            ),
            models.CheckConstraint(
                condition=Q(source_type__in=TOUCHPOINT_SOURCE_TYPES), name="ck_attribution_source_type"
            ),
            models.CheckConstraint(
                condition=Q(origin_kind__in=ORIGIN_KINDS), name="ck_attribution_origin_kind"
            ),
        ]


class RevenueAttribution(TimestampedModel):
    """The IMMUTABLE first-touch snapshot for one event.

    `UNIQUE(revenue_event)` is the structural guarantee against
    over-attribution: one event, at most one attribution, 10000 basis points.
    A later Lead/Deal/Business edit never rewrites this row.
    """

    revenue_event = models.OneToOneField(
        RevenueEvent, on_delete=models.RESTRICT, related_name="attribution"
    )
    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="revenue_attributions"
    )
    touchpoint = models.ForeignKey(
        AttributionTouchpoint,
        on_delete=models.RESTRICT,
        related_name="attributions",
        null=True,
        blank=True,
    )
    candidate_kind = models.CharField(max_length=30)
    derived_result_public_id = models.CharField(max_length=60, blank=True)
    origin_kind = models.CharField(max_length=20)
    source_code = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=20, default="first_touch")
    allocation_bps = models.PositiveIntegerField(default=10000)
    source_type = models.CharField(max_length=20)
    source_entity_type = models.CharField(max_length=40)
    source_public_id = models.CharField(max_length=60)
    discovery_job_public_id = models.CharField(max_length=60, blank=True)
    business_public_id = models.CharField(max_length=60, blank=True)
    lead_public_id = models.CharField(max_length=60, blank=True)
    deal_public_id = models.CharField(max_length=60, blank=True)
    acquired_at = models.DateTimeField()
    resolved_at = models.DateTimeField()

    class Meta:
        db_table = "revenue_attributions"
        indexes = [
            models.Index(fields=["workspace", "origin_kind"]),
            models.Index(fields=["workspace", "discovery_job_public_id"]),
            models.Index(fields=["workspace", "source_type", "source_entity_type", "source_public_id"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(allocation_bps=10000), name="ck_attribution_allocation"),
            models.CheckConstraint(condition=Q(model="first_touch"), name="ck_attribution_model"),
            models.CheckConstraint(
                condition=Q(candidate_kind__in=CANDIDATE_KINDS), name="ck_attribution_candidate_kind"
            ),
            models.CheckConstraint(
                condition=Q(origin_kind__in=ORIGIN_KINDS), name="ck_revattr_origin_kind"
            ),
            # The two resolution sources are mutually exclusive and each is
            # fully identified — expressible on a single row, so it IS a CHECK.
            models.CheckConstraint(
                condition=(
                    Q(candidate_kind="touchpoint", touchpoint__isnull=False, derived_result_public_id="")
                    | Q(candidate_kind="derived_provenance", touchpoint__isnull=True)
                    & ~Q(derived_result_public_id="")
                ),
                name="ck_revattr_candidate_exclusive",
            ),
        ]
