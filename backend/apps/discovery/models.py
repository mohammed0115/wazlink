"""discovery (L4) — B3 Discovery. Provider-free domain (B14_16 §1).

**No vendor identifier appears in this module** — not in a field name, a choice
value, a default or a docstring example (`T-DISC-1`). `source_provider` holds
whatever the bound adapter calls itself; the domain never compares it to a
literal and never branches on it.

> **Schema note (I3).** `M04` at I2 was specified to create these tables
> "exactly as frozen B3 specifies", but shipped a reduced subset: the job
> carried no attempt, progress, counter, completion or failure columns, no
> execution table existed, and `businesses` carried no provider identity — so
> the frozen B3 job state machine and `B3-INV-4` upsert identity were not
> expressible. I3 completes `M04` to its frozen shape. Every operation is
> ADDITIVE (`T-MIG-4`): no column is dropped, narrowed or retyped. The one
> non-additive-looking change is the `status` CHOICES list, which moves to the
> frozen `B3-D-A006` five-state vocabulary; it is safe because no job row can
> exist before this slice (`T-MIG-6` asserts the feature was unreachable), and
> `choices` is a Python-level validation that leaves the column type untouched.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

# The frozen B3 job states. JOB_STATE_COUNT = 5 (B3-D-A006). A sixth state is
# prohibited: partial success is a PROPERTY of a completed job, not a state.
JOB_PENDING = "pending"
JOB_PROCESSING = "processing"
JOB_COMPLETED = "completed"
JOB_FAILED = "failed"
JOB_CANCELLED = "cancelled"

JOB_TERMINAL_STATES = (JOB_COMPLETED, JOB_FAILED, JOB_CANCELLED)
JOB_STATE_COUNT = 5

# B3-D-A031: an architectural safety bound, NOT an operational tuning knob.
MAX_JOB_ATTEMPTS = 3
MAX_ACTOR_RETRIES_PER_JOB = 2

# Execution outcomes (B3 §6). Which ones COUNT AS SUCCESS is a domain rule and
# lives here beside them, so no caller re-derives it.
# `running` is a DURABLE claim, not a terminal outcome. It exists because the
# provider call cannot happen inside the claiming transaction — a network call
# under a row lock is exactly what B3 refuses for the aggregate — so the claim
# must survive the commit that releases the lock. Without it two workers both
# read `pending` and both pay the provider (B12-D-A021's cost concern), even
# though the unique constraints keep the durable data correct.
#
# A `running` row left behind by a dead worker is NOT auto-repaired: it is
# heartbeat-stale work, classified by reconciliation class `P-3` and
# operator-gated (B14_09 §2, §4).
OUTCOME_RUNNING = "running"
OUTCOME_SUCCEEDED = "succeeded"
OUTCOME_PAGE_LIMIT_REACHED = "page_limit_reached"
OUTCOME_RESULT_LIMIT_REACHED = "result_limit_reached"
OUTCOME_PROVIDER_NO_MATCH = "provider_no_match"
OUTCOME_FAILED_RETRYABLE_EXHAUSTED = "failed_retryable_exhausted"
OUTCOME_FAILED_PERMANENT = "failed_permanent"
OUTCOME_CANCELLED = "cancelled"
OUTCOME_UNKNOWN = "unknown"

SUCCESS_OUTCOMES = frozenset(
    {
        OUTCOME_SUCCEEDED,
        OUTCOME_PAGE_LIMIT_REACHED,
        OUTCOME_RESULT_LIMIT_REACHED,
        OUTCOME_PROVIDER_NO_MATCH,
    }
)
LIMIT_OUTCOMES = frozenset({OUTCOME_PAGE_LIMIT_REACHED, OUTCOME_RESULT_LIMIT_REACHED})
TERMINAL_OUTCOMES = SUCCESS_OUTCOMES | {
    OUTCOME_FAILED_RETRYABLE_EXHAUSTED,
    OUTCOME_FAILED_PERMANENT,
    OUTCOME_CANCELLED,
    OUTCOME_UNKNOWN,
}

# Completion shapes (B3 §6). Additive: a client that ignores them is correct.
COMPLETION_FULL = "full"
COMPLETION_PARTIAL = "partial"
COMPLETION_EMPTY = "empty"
COMPLETION_TRUNCATED = "truncated"

# The closed, SAFE failure vocabulary (B3-INV-3). A provider error string,
# endpoint, credential, HTTP body or stack detail never appears in a job row.
FAILURE_NOT_CONFIGURED = "provider_not_configured"
FAILURE_RATE_LIMITED = "provider_rate_limited"
FAILURE_TEMPORARY = "provider_temporarily_unavailable"
FAILURE_PERMANENT = "provider_refused"
FAILURE_INVALID_RESPONSE = "provider_response_invalid"
FAILURE_TIMEOUT = "provider_timeout"
FAILURE_UNKNOWN = "provider_outcome_unknown"
FAILURE_PLANNING = "job_planning_failed"


class Business(PublicIdModel, TimestampedModel, VersionedModel):
    """A discovered business. Owned by discovery; CRM never writes it (T-MIG-5).

    Identity is `(workspace_id, provider_external_id)` (`B3-INV-4`,
    `B14_16` §2): the same external record observed twice — by a retry, a
    second query in the same job, or a job months later — UPSERTS this row
    rather than creating a second one. The constraint is partial so a Business
    that never came from a provider is still insertable.
    """

    PUBLIC_ID_PREFIX = "BIZ"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="businesses"
    )
    name = models.CharField(max_length=250)
    city = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    website = models.URLField(max_length=400, blank=True)
    merged_into = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="merged_from"
    )

    # --- I3: the frozen B3 identity and normalized attributes ---
    # OPAQUE. The domain never parses it and never infers a vendor from it.
    provider_external_id = models.CharField(max_length=200, blank=True, db_index=True)
    source_provider = models.CharField(max_length=40, blank=True)
    address_text = models.CharField(max_length=400, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    rating = models.FloatField(null=True, blank=True)
    review_count = models.PositiveIntegerField(null=True, blank=True)
    first_observed_at = models.DateTimeField(null=True, blank=True)
    last_observed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "businesses"
        indexes = [models.Index(fields=["workspace", "name"])]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "provider_external_id"],
                condition=~Q(provider_external_id=""),
                name="uq_business_provider_identity",
            ),
        ]


class BusinessIdentity(TimestampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="identities")
    identity_kind = models.CharField(max_length=40)
    identity_value = models.CharField(max_length=300)

    class Meta:
        db_table = "business_identities"
        constraints = [
            models.UniqueConstraint(
                fields=["business", "identity_kind", "identity_value"], name="uq_business_identity"
            ),
        ]


class DiscoveryJob(PublicIdModel, TimestampedModel, VersionedModel):
    """The B3 job aggregate and its five-state machine."""

    PUBLIC_ID_PREFIX = "DJOB"

    STATUS_CHOICES = [
        (JOB_PENDING, JOB_PENDING),
        (JOB_PROCESSING, JOB_PROCESSING),
        (JOB_COMPLETED, JOB_COMPLETED),
        (JOB_FAILED, JOB_FAILED),
        (JOB_CANCELLED, JOB_CANCELLED),
    ]
    COMPLETION_CHOICES = [
        (COMPLETION_FULL, COMPLETION_FULL),
        (COMPLETION_PARTIAL, COMPLETION_PARTIAL),
        (COMPLETION_EMPTY, COMPLETION_EMPTY),
        (COMPLETION_TRUNCATED, COMPLETION_TRUNCATED),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="discovery_jobs"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=JOB_PENDING)
    requested_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="discovery_jobs"
    )

    # --- I3: the frozen B3 job columns ---
    # Which PORT to use. Not which vendor: the binding decides that.
    source = models.CharField(max_length=40, default="place_search")
    result_limit = models.PositiveIntegerField(default=60)
    attempt_no = models.PositiveIntegerField(default=1)
    progress = models.PositiveSmallIntegerField(default=0)

    # B3 §4.1 — invariant: found - duplicate = deduplicated, at every write.
    found_count = models.PositiveIntegerField(default=0)
    duplicate_count = models.PositiveIntegerField(default=0)
    deduplicated_count = models.PositiveIntegerField(default=0)
    failed_query_count = models.PositiveIntegerField(default=0)

    completion_kind = models.CharField(max_length=20, choices=COMPLETION_CHOICES, blank=True)
    failure_code = models.CharField(max_length=60, blank=True)
    failure_message = models.CharField(max_length=300, blank=True)

    started_at = models.DateTimeField(null=True, blank=True)
    attempt_started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancellation_requested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "discovery_jobs"
        indexes = [models.Index(fields=["workspace", "status"])]

    @property
    def is_terminal(self) -> bool:
        return self.status in JOB_TERMINAL_STATES

    @property
    def results_visible(self) -> bool:
        """B3-INV-8: results are visible IFF the job is `completed`.

        Persistence is not visibility — rows are written as each page commits so
        a crash loses no paid provider work, and are simply not served until the
        job terminates successfully.
        """
        return self.status == JOB_COMPLETED


class DiscoveryQuery(TimestampedModel):
    """One (term, location) combination — the PLAN.

    The plan is preserved across retries unchanged (B3 §3.3); what a retry
    creates is a new set of executions against the same plan.
    """

    job = models.ForeignKey(DiscoveryJob, on_delete=models.CASCADE, related_name="queries")
    term = models.CharField(max_length=300)
    location = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "discovery_queries"
        constraints = [
            models.UniqueConstraint(fields=["job", "term", "location"], name="uq_discovery_query"),
        ]


class DiscoveryQueryExecution(TimestampedModel):
    """One ATTEMPT at one query. Retained forever; a retry adds, never rewrites.

    `(query, attempt_no)` is the execution identity AND the worker's
    idempotency key: a redelivered task re-claims the same row rather than
    opening a second execution, so a duplicate delivery cannot double-charge
    the provider or double-count results.
    """

    OUTCOME_CHOICES = [
        ("pending", "pending"),
        (OUTCOME_RUNNING, OUTCOME_RUNNING),
        (OUTCOME_SUCCEEDED, OUTCOME_SUCCEEDED),
        (OUTCOME_PAGE_LIMIT_REACHED, OUTCOME_PAGE_LIMIT_REACHED),
        (OUTCOME_RESULT_LIMIT_REACHED, OUTCOME_RESULT_LIMIT_REACHED),
        (OUTCOME_PROVIDER_NO_MATCH, OUTCOME_PROVIDER_NO_MATCH),
        (OUTCOME_FAILED_RETRYABLE_EXHAUSTED, OUTCOME_FAILED_RETRYABLE_EXHAUSTED),
        (OUTCOME_FAILED_PERMANENT, OUTCOME_FAILED_PERMANENT),
        (OUTCOME_CANCELLED, OUTCOME_CANCELLED),
        (OUTCOME_UNKNOWN, OUTCOME_UNKNOWN),
    ]

    job = models.ForeignKey(DiscoveryJob, on_delete=models.CASCADE, related_name="executions")
    query = models.ForeignKey(DiscoveryQuery, on_delete=models.CASCADE, related_name="executions")
    attempt_no = models.PositiveIntegerField(default=1)
    outcome = models.CharField(max_length=40, choices=OUTCOME_CHOICES, default="pending")
    # From the CLOSED safe vocabulary only. Never a provider string.
    failure_code = models.CharField(max_length=60, blank=True)
    result_count = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "discovery_query_executions"
        constraints = [
            models.UniqueConstraint(
                fields=["query", "attempt_no"], name="uq_discovery_query_execution"
            ),
        ]
        indexes = [models.Index(fields=["job", "outcome"])]

    @property
    def is_terminal(self) -> bool:
        return self.outcome in TERMINAL_OUTCOMES


class DiscoveryResult(TimestampedModel):
    """One observation of one Business by one execution.

    `(execution, business)` is unique: within an execution the same Business is
    recorded once. Across executions it is recorded again on purpose — a later
    attempt genuinely re-observed the world at a new instant, and B3 §3.3 keeps
    that provenance.
    """

    job = models.ForeignKey(DiscoveryJob, on_delete=models.CASCADE, related_name="results")
    execution = models.ForeignKey(
        DiscoveryQueryExecution,
        on_delete=models.CASCADE,
        related_name="results",
        null=True,
        blank=True,
    )
    business = models.ForeignKey(
        Business, on_delete=models.RESTRICT, null=True, blank=True, related_name="results"
    )
    # A BOUNDED normalized snapshot — never the provider's raw body, and never
    # business truth (B14_16 §2, T-DISC-7).
    raw_payload = models.JSONField(default=dict)

    class Meta:
        db_table = "discovery_results"
        constraints = [
            models.UniqueConstraint(
                fields=["execution", "business"],
                condition=Q(execution__isnull=False, business__isnull=False),
                name="uq_discovery_result_observation",
            ),
        ]
        indexes = [models.Index(fields=["job"])]
