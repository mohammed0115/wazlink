"""intelligence (L6) — B4 AI Lead Intelligence. **B4 EXECUTES NOTHING**.

Three decisions from frozen B4 shape every table here:

*   **`B4-D-A001`: intelligence attaches to a BUSINESS, never to a Lead.** A
    Lead never owns, caches or receives a copy of a score, signal or
    recommendation. A Business is analysable long before any Lead exists, and
    keying by Lead would let one real-world company acquire two divergent
    intelligence histories the moment it converted.
*   **`B4-D-A003`: five run states** — `queued`, `running`, `completed`,
    `failed`, `cancelled`. Partial success is a PROPERTY of a completed run
    (`completion_kind`), not a sixth state, and staleness is computed at read
    time rather than stored.
*   **`B4-D-A009`: named score components, never one opaque number.** The score
    is arithmetic over signals, and every signal is retained, so any score can
    be explained down to the evidence that produced it.

A run is **immutable evidence of one analysis over one input snapshot**. A
re-analysis opens a NEW run and never rewrites a finished one — the opposite of
B3's retry model, deliberately: B3 retries an execution, B4 retries an opinion,
and two opinions from different moments are each meaningful history.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

RUN_QUEUED = "queued"
RUN_RUNNING = "running"
RUN_COMPLETED = "completed"
RUN_FAILED = "failed"
RUN_CANCELLED = "cancelled"

RUN_STATE_COUNT = 5
RUN_IN_FLIGHT = (RUN_QUEUED, RUN_RUNNING)
RUN_TERMINAL = (RUN_COMPLETED, RUN_FAILED, RUN_CANCELLED)

COMPLETION_FULL = "full"
COMPLETION_PARTIAL = "partial"

# The five frozen score components and their maxima (B4_SCORING_MODEL §1).
# `overall = sum(components)`, bounded 0..100.
SCORE_COMPONENTS: dict[str, int] = {
    "activity": 25,
    "digital_opportunity": 30,
    "reachability": 20,
    "service_fit": 15,
    "data_quality": 10,
}
MAX_OVERALL_SCORE = sum(SCORE_COMPONENTS.values())

# The six frozen signal categories. Four map to a score component; `CONTEXT` is
# user-visible but never score-affecting.
CATEGORY_ACTIVITY = "ACTIVITY"
CATEGORY_DIGITAL_MATURITY = "DIGITAL_MATURITY"
CATEGORY_REACHABILITY = "REACHABILITY"
CATEGORY_SERVICE_FIT = "SERVICE_FIT"
CATEGORY_DATA_COMPLETENESS = "DATA_COMPLETENESS"
CATEGORY_CONTEXT = "CONTEXT"

CATEGORY_TO_COMPONENT = {
    CATEGORY_ACTIVITY: "activity",
    CATEGORY_DIGITAL_MATURITY: "digital_opportunity",
    CATEGORY_REACHABILITY: "reachability",
    CATEGORY_SERVICE_FIT: "service_fit",
    CATEGORY_DATA_COMPLETENESS: "data_quality",
}

# Frozen frontend vocabulary. `unknown` is NOT `gap`: a missing rating is "not
# observed", never "observed as bad" (FB-08), and can never move the score.
POLARITY_POSITIVE = "positive"
POLARITY_GAP = "gap"
POLARITY_UNKNOWN = "unknown"
POLARITY_NEUTRAL = "neutral"

SOURCE_DETERMINISTIC = "deterministic"
SOURCE_AI_EXTRACTED = "ai_extracted"

TIER_HIGH = "high"
TIER_MEDIUM = "medium"
TIER_LOW = "low"

# The CLOSED failure vocabulary. A raw provider message never appears in a run
# (B4 §6, mirroring B3-INV-3).
FAILURE_PROVIDER_UNAVAILABLE = "provider_unavailable"
FAILURE_PROVIDER_INVALID_OUTPUT = "provider_invalid_output"
FAILURE_PROVIDER_UNKNOWN = "provider_outcome_unknown"
FAILURE_SUBJECT_MISSING = "subject_missing"

SCORING_MODEL_VERSION = 1


class IntelligenceRun(PublicIdModel, TimestampedModel, VersionedModel):
    """One analysis over one input snapshot. Immutable once terminal."""

    PUBLIC_ID_PREFIX = "ANL"

    STATUS_CHOICES = [(s, s) for s in (RUN_QUEUED, RUN_RUNNING, RUN_COMPLETED, RUN_FAILED, RUN_CANCELLED)]
    COMPLETION_CHOICES = [(COMPLETION_FULL, COMPLETION_FULL), (COMPLETION_PARTIAL, COMPLETION_PARTIAL)]
    TIER_CHOICES = [(TIER_HIGH, TIER_HIGH), (TIER_MEDIUM, TIER_MEDIUM), (TIER_LOW, TIER_LOW)]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="intelligence_runs"
    )
    # String reference — no Python import of another app's model (T-ARCH-3).
    business = models.ForeignKey(
        "discovery.Business", on_delete=models.RESTRICT, related_name="intelligence_runs"
    )
    requested_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="intelligence_runs"
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=RUN_QUEUED)
    completion_kind = models.CharField(max_length=20, choices=COMPLETION_CHOICES, blank=True)

    # The reuse identity: the same snapshot analysed twice reuses the first
    # answer instead of paying the provider again (B4 §4 reproducibility).
    input_hash = models.CharField(max_length=64, db_index=True)
    # A BOUNDED snapshot of the fields the analysis actually read. It is what
    # makes a score reproducible and auditable after the Business moves on.
    input_snapshot = models.JSONField(default=dict)
    input_snapshot_version = models.PositiveIntegerField(default=1)
    scoring_model_version = models.PositiveIntegerField(default=SCORING_MODEL_VERSION)

    overall_score = models.PositiveSmallIntegerField(default=0)
    tier = models.CharField(max_length=10, choices=TIER_CHOICES, blank=True)
    components = models.JSONField(default=dict)
    confidence = models.FloatField(null=True, blank=True)
    # Distinct from "every component scored 0": the run did not have enough
    # evidence to hold an opinion at all (B4_SCORING_MODEL §6).
    insufficient_evidence = models.BooleanField(default=False)

    # Presentation-only, never score-affecting. No field here admits a send —
    # asserted by `T-B4-1` (B5-D-A021, PD-013).
    recommendations = models.JSONField(default=list)

    # `is_current` advances ONLY to a new completed run. A failed or cancelled
    # re-analysis never regresses a Business from "we know its score" to "we
    # know nothing" (B4 §4).
    is_current = models.BooleanField(default=False)

    failure_code = models.CharField(max_length=60, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "intelligence_runs"
        indexes = [
            models.Index(fields=["workspace", "business", "-created_at"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            # At most ONE in-flight run per snapshot. This is the concurrency
            # guard: two simultaneous requests for the same unchanged Business
            # cannot both open an analysis and both pay the provider.
            models.UniqueConstraint(
                fields=["business", "input_hash"],
                condition=Q(status__in=RUN_IN_FLIGHT),
                name="uq_intelligence_run_in_flight",
            ),
            # At most ONE current run per Business. The "what do we believe
            # about this business" pointer cannot become ambiguous.
            models.UniqueConstraint(
                fields=["business"],
                condition=Q(is_current=True),
                name="uq_intelligence_run_current",
            ),
        ]

    @property
    def is_terminal(self) -> bool:
        return self.status in RUN_TERMINAL

    def is_stale_against(self, business_version: int) -> bool:
        """Staleness is COMPUTED, never stored (B4-D-A003 rationale).

        Storing it would need a sweep to stay accurate and would make the answer
        ambiguous during the sweep's lag.
        """
        return self.input_snapshot_version < business_version


class IntelligenceSignal(TimestampedModel):
    """One piece of evidence. Every signal is user-visible: B4 defines none hidden.

    Signals are what make the score explainable — the score is arithmetic over
    these rows, so any number can be traced to the observations behind it.
    """

    CATEGORY_CHOICES = [
        (c, c)
        for c in (
            CATEGORY_ACTIVITY,
            CATEGORY_DIGITAL_MATURITY,
            CATEGORY_REACHABILITY,
            CATEGORY_SERVICE_FIT,
            CATEGORY_DATA_COMPLETENESS,
            CATEGORY_CONTEXT,
        )
    ]
    POLARITY_CHOICES = [
        (p, p) for p in (POLARITY_POSITIVE, POLARITY_GAP, POLARITY_UNKNOWN, POLARITY_NEUTRAL)
    ]
    SOURCE_CHOICES = [
        (SOURCE_DETERMINISTIC, SOURCE_DETERMINISTIC),
        (SOURCE_AI_EXTRACTED, SOURCE_AI_EXTRACTED),
    ]

    run = models.ForeignKey(IntelligenceRun, on_delete=models.CASCADE, related_name="signals")
    signal_code = models.CharField(max_length=60)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    polarity = models.CharField(max_length=20, choices=POLARITY_CHOICES)
    strength = models.IntegerField(default=0)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_DETERMINISTIC)
    score_affecting = models.BooleanField(default=True)
    # WHICH observed fields made this signal fire. Field names and observed
    # values from the snapshot — never a prompt and never a completion.
    evidence = models.JSONField(default=dict)

    class Meta:
        db_table = "intelligence_signals"
        constraints = [
            models.UniqueConstraint(fields=["run", "signal_code"], name="uq_intelligence_signal"),
        ]


class AIUsageRecord(TimestampedModel):
    """AGGREGATE-ONLY provider telemetry (B14_14 §6).

    Deliberately absent: prompt text, completion text, model name, provider
    error code, and the provider's own stop-reason field. Those are exactly what
    `B14_14` §3 forbids from reaching a database column, and a usage table is the
    likeliest place for them to accumulate unnoticed.

    This is telemetry, kept separate from business truth. It is NOT billing:
    no price, currency or rate is stored, because Wave 3 owns that decision.
    """

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="ai_usage_records"
    )
    run = models.ForeignKey(
        IntelligenceRun, on_delete=models.CASCADE, related_name="usage_records", null=True, blank=True
    )
    # The PORT's name, not a vendor's ("ai", "whatsapp"). Swapping the adapter
    # behind a port must not change what this column says.
    port_name = models.CharField(max_length=40)
    operation = models.CharField(max_length=60)
    input_units = models.PositiveIntegerField(default=0)
    output_units = models.PositiveIntegerField(default=0)
    total_units = models.PositiveIntegerField(default=0)
    outcome = models.CharField(max_length=30, default="known_success")

    class Meta:
        db_table = "ai_usage_records"
        indexes = [models.Index(fields=["workspace", "-created_at"])]
