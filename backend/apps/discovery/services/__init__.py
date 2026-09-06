"""discovery commands — B3 Discovery jobs.

**The domain is provider-free.** It reaches a provider only through
`common.provider_ports`, so no vendor name, endpoint, field name or error code
exists in this module (`T-DISC-1`). Swapping the bound adapter changes nothing
here (`T-DISC-2`).

Two integrity rules carry this slice, and both are enforced by PostgreSQL
rather than by Python:

*   **Business identity** is `(workspace_id, provider_external_id)` under a
    unique constraint (`B3-INV-4`). Re-observing an external record UPSERTS.
*   **Execution identity** is `(query, attempt_no)` under a unique constraint,
    claimed with `SELECT ... FOR UPDATE`. A redelivered task, a second worker
    and a concurrent retry all converge on ONE execution row, so provider work
    is never double-charged and results are never double-counted.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, ValidationFailed
from common.outbox import publish_event
from common.ports import ports
from common.provider_ports import (
    NormalizedBusinessResult,
    PlaceSearchRequest,
    ProviderError,
    ProviderInvalidResponse,
    ProviderNotConfigured,
    ProviderPermanentFailure,
    ProviderRateLimited,
    ProviderTemporaryFailure,
    ProviderTimeout,
    ProviderUnknownOutcome,
    providers,
)

from ..models import (
    COMPLETION_EMPTY,
    COMPLETION_FULL,
    COMPLETION_PARTIAL,
    COMPLETION_TRUNCATED,
    FAILURE_INVALID_RESPONSE,
    FAILURE_NOT_CONFIGURED,
    FAILURE_PERMANENT,
    FAILURE_PLANNING,
    FAILURE_RATE_LIMITED,
    FAILURE_TEMPORARY,
    FAILURE_TIMEOUT,
    FAILURE_UNKNOWN,
    JOB_CANCELLED,
    JOB_COMPLETED,
    JOB_FAILED,
    JOB_PENDING,
    JOB_PROCESSING,
    LIMIT_OUTCOMES,
    MAX_JOB_ATTEMPTS,
    OUTCOME_CANCELLED,
    OUTCOME_FAILED_PERMANENT,
    OUTCOME_FAILED_RETRYABLE_EXHAUSTED,
    OUTCOME_PROVIDER_NO_MATCH,
    OUTCOME_RESULT_LIMIT_REACHED,
    OUTCOME_RUNNING,
    OUTCOME_SUCCEEDED,
    OUTCOME_UNKNOWN,
    SUCCESS_OUTCOMES,
    Business,
    DiscoveryJob,
    DiscoveryQuery,
    DiscoveryQueryExecution,
    DiscoveryResult,
)

# B3-D-A018 / B3-D-A032. Independent counters: neither borrows the other's
# capacity. Both are counted in PostgreSQL — never in Redis, which is not
# authoritative business state.
MAX_JOBS_PER_WORKSPACE_PER_HOUR = 10
MAX_RETRIES_PER_WORKSPACE_PER_HOUR = 10

MAX_QUERY_COMBINATIONS = 20
MAX_RESULT_LIMIT = 200

# Provider failure class -> the CLOSED safe failure vocabulary. This mapping is
# the only place the two vocabularies meet; nothing downstream sees a provider
# exception type.
_FAILURE_CODES = {
    ProviderNotConfigured: FAILURE_NOT_CONFIGURED,
    ProviderRateLimited: FAILURE_RATE_LIMITED,
    ProviderTemporaryFailure: FAILURE_TEMPORARY,
    ProviderPermanentFailure: FAILURE_PERMANENT,
    ProviderInvalidResponse: FAILURE_INVALID_RESPONSE,
    ProviderTimeout: FAILURE_TIMEOUT,
    ProviderUnknownOutcome: FAILURE_UNKNOWN,
}

_SAFE_FAILURE_MESSAGES = {
    FAILURE_NOT_CONFIGURED: "This discovery source is not configured.",
    FAILURE_RATE_LIMITED: "The discovery source is rate limited. Try again later.",
    FAILURE_TEMPORARY: "The discovery source is temporarily unavailable.",
    FAILURE_PERMANENT: "The discovery source refused this request.",
    FAILURE_INVALID_RESPONSE: "The discovery source returned an unusable response.",
    FAILURE_TIMEOUT: "The discovery source did not answer in time.",
    FAILURE_UNKNOWN: "The outcome of this discovery request is unknown.",
    FAILURE_PLANNING: "This discovery request could not be planned.",
}


def _failure_code_for(exc: ProviderError) -> str:
    for error_type, code in _FAILURE_CODES.items():
        if isinstance(exc, error_type):
            return code
    return FAILURE_PERMANENT


def failure_message_for(code: str) -> str:
    """A translated, SAFE message. Never a provider string (B3-INV-3)."""
    return _SAFE_FAILURE_MESSAGES.get(code, "This discovery request failed.")


# --------------------------------------------------------------------------
# UpsertBusiness — the frozen B3-INV-4 identity command.
# --------------------------------------------------------------------------


def upsert_business(*, workspace, result: NormalizedBusinessResult) -> tuple[Business, bool]:
    """Create or refresh the Business for a normalized provider record.

    Identity is `(workspace, provider_external_id)`, held by a UNIQUE
    CONSTRAINT. Two workers observing the same record concurrently therefore
    cannot both insert: one wins, the other's `IntegrityError` resolves to the
    winner's row. An `if exists()` test could not do this — between the test
    and the insert, the competitor commits.

    The constraint is per WORKSPACE, so two tenants observing the same real
    business each own a separate row and neither can see the other
    (`T-DISC-3`).
    """
    external_id = (result.provider_external_id or "").strip()[:200]
    if not external_id:
        raise ValidationFailed("A provider result carried no identity.")

    fields = {
        "name": result.name[:250],
        "city": (result.city or "")[:120],
        "category": (result.category or "")[:120],
        "phone": (result.phone or "")[:40],
        "website": (result.website or "")[:400],
        "address_text": (result.address_text or "")[:400],
        "latitude": result.latitude,
        "longitude": result.longitude,
        "rating": result.rating,
        "review_count": result.review_count,
        "source_provider": (result.source_provider or "")[:40],
        "last_observed_at": result.observed_at,
    }

    try:
        with transaction.atomic():
            business, created = Business.objects.get_or_create(
                workspace=workspace,
                provider_external_id=external_id,
                defaults={**fields, "first_observed_at": result.observed_at},
            )
    except IntegrityError:
        # A competitor won the race. Its row IS the identity — adopt it.
        business, created = (
            Business.objects.get(workspace=workspace, provider_external_id=external_id),
            False,
        )

    if not created:
        for key, value in fields.items():
            setattr(business, key, value)
        business.save(update_fields=[*fields, "updated_at"])

    return business, created


# --------------------------------------------------------------------------
# CreateDiscoveryJob
# --------------------------------------------------------------------------


def _within_hour(workspace, **filters) -> int:
    since = timezone.now() - timedelta(hours=1)
    return DiscoveryJob.objects.filter(workspace=workspace, **filters, created_at__gte=since).count()


@transaction.atomic
def create_discovery_job(
    *,
    context,
    terms: list[str],
    locations: list[str] | None = None,
    result_limit: int = 60,
    source: str = "place_search",
) -> DiscoveryJob:
    """Admit a job and persist its plan. NO provider is called here.

    Admission order is cheapest-first (B3 §3.2.1): shape, then bound, then rate.
    A rejection at any step writes nothing and calls no provider.
    """
    cleaned_terms = [t.strip() for t in (terms or []) if (t or "").strip()]
    if not cleaned_terms:
        raise ValidationFailed("At least one search term is required.")
    cleaned_locations = [loc.strip() for loc in (locations or []) if (loc or "").strip()] or [""]

    combinations = [(term, loc) for term in cleaned_terms for loc in cleaned_locations]
    if len(combinations) > MAX_QUERY_COMBINATIONS:
        raise ValidationFailed(
            f"A job may plan at most {MAX_QUERY_COMBINATIONS} term/location combinations.",
            {"combinations": len(combinations), "max": MAX_QUERY_COMBINATIONS},
        )

    if _within_hour(context.workspace) >= MAX_JOBS_PER_WORKSPACE_PER_HOUR:
        raise DomainConflict(
            "This workspace has reached its hourly discovery job limit.",
            {"reason": "job_rate_limited", "max_per_hour": MAX_JOBS_PER_WORKSPACE_PER_HOUR},
        )

    job = DiscoveryJob.objects.create(
        workspace=context.workspace,
        requested_by=context.membership,
        status=JOB_PENDING,
        source=(source or "place_search")[:40],
        result_limit=max(1, min(int(result_limit or 60), MAX_RESULT_LIMIT)),
    )
    for term, location in combinations:
        DiscoveryQuery.objects.create(job=job, term=term[:300], location=location[:200])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="discovery.job_created",
        target_type="discovery_job",
        target_ref=job.public_id,
        changed_fields=["status", "source"],
        metadata={"combinations": len(combinations)},
    )
    publish_event(
        workspace=context.workspace,
        event_type="DiscoveryJobCreated",
        aggregate_type="discovery_job",
        aggregate_ref=job.public_id,
        payload={"combinations": len(combinations), "source": job.source},
    )
    return job


@transaction.atomic
def cancel_discovery_job(*, context, job: DiscoveryJob, expected_version: int | None = None) -> DiscoveryJob:
    """B3 §7. Accepted only from a non-terminal state.

    Cancel and completion take the SAME row lock, so exactly one wins. If
    completion committed first the job is `completed` and this returns `409` —
    correct, because the work genuinely finished.
    """
    require_version(job, expected_version, required=False)
    lock_aggregate(job)
    if job.is_terminal:
        raise DomainConflict(
            "This job has already finished.",
            {"reason": "job_already_terminal", "job_status": job.status},
        )

    now = timezone.now()
    job.status = JOB_CANCELLED
    job.cancellation_requested_at = now
    # completed_at stays NULL for a cancelled job (frozen B3 §8).
    bump_version(job)
    job.save(update_fields=["status", "cancellation_requested_at", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="discovery.job_cancelled",
        target_type="discovery_job",
        target_ref=job.public_id,
        changed_fields=["status"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="DiscoveryJobCancelled",
        aggregate_type="discovery_job",
        aggregate_ref=job.public_id,
        payload={"status": JOB_CANCELLED},
    )
    return job


@transaction.atomic
def retry_discovery_job(*, context, job: DiscoveryJob, expected_version: int | None = None) -> DiscoveryJob:
    """B3 §3.2 transitions 8/9. A retry is a NEW ATTEMPT, not a state reversal.

    The attempt bound is evaluated BEFORE any side effect, under the same row
    lock that serializes the increment — so two concurrent retries can never
    both open attempt 2, and cancellation can never restore a spent attempt.
    """
    require_version(job, expected_version, required=False)
    lock_aggregate(job)

    if job.status not in (JOB_FAILED, JOB_CANCELLED):
        raise DomainConflict(
            "This job cannot be retried.",
            {"reason": "job_not_retryable", "job_status": job.status},
        )
    if job.attempt_no >= MAX_JOB_ATTEMPTS:
        raise DomainConflict(
            "This job has used every available attempt.",
            {
                "reason": "attempt_limit_reached",
                "attempt_no": job.attempt_no,
                "max_job_attempts": MAX_JOB_ATTEMPTS,
            },
        )
    if _within_hour(context.workspace, attempt_no__gt=1) >= MAX_RETRIES_PER_WORKSPACE_PER_HOUR:
        raise DomainConflict(
            "This workspace has reached its hourly retry limit.",
            {"reason": "actor_retry_rate_limited", "max_per_hour": MAX_RETRIES_PER_WORKSPACE_PER_HOUR},
        )

    job.attempt_no += 1
    job.status = JOB_PENDING
    # Counters and failure reset; results and previous executions are RETAINED.
    job.progress = 0
    job.found_count = job.duplicate_count = job.deduplicated_count = job.failed_query_count = 0
    job.completion_kind = ""
    job.failure_code = job.failure_message = ""
    job.completed_at = None
    job.cancellation_requested_at = None
    bump_version(job)
    job.save(
        update_fields=[
            "attempt_no", "status", "progress", "found_count", "duplicate_count",
            "deduplicated_count", "failed_query_count", "completion_kind", "failure_code",
            "failure_message", "completed_at", "cancellation_requested_at", "version", "updated_at",
        ]
    )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="discovery.job_retried",
        target_type="discovery_job",
        target_ref=job.public_id,
        changed_fields=["status", "attempt_no"],
        metadata={"attempt_no": job.attempt_no},
    )
    return job


# --------------------------------------------------------------------------
# Execution — the worker path. Called by tasks.py, never by a view.
# --------------------------------------------------------------------------


def _claim_execution(*, job: DiscoveryJob, query: DiscoveryQuery) -> DiscoveryQueryExecution | None:
    """Take exclusive ownership of this (query, attempt) execution, or None.

    A competitor BLOCKS on the lock and, under READ COMMITTED, re-evaluates the
    `outcome='pending'` predicate against the newly committed row — finding it
    `running` and standing down. The unique constraint on `(query, attempt_no)`
    makes the row itself the mutual exclusion, so a redelivered task claims
    nothing new.

    The claim is written DURABLY as `running` before this returns, because the
    provider call happens after the claiming transaction commits. A lock alone
    would be released at that commit and both workers would then pay the
    provider for the same query — the durable data would still be correct, but
    the cost bound `MAX_JOB_ATTEMPTS` exists to enforce would not be.
    """
    execution, _ = DiscoveryQueryExecution.objects.get_or_create(
        job=job, query=query, attempt_no=job.attempt_no
    )
    claimed = (
        DiscoveryQueryExecution.objects.select_for_update()
        .filter(pk=execution.pk, outcome="pending")
        .first()
    )
    if claimed is None:
        return None
    claimed.outcome = OUTCOME_RUNNING
    claimed.started_at = timezone.now()
    claimed.save(update_fields=["outcome", "started_at", "updated_at"])
    return claimed


def _ingest(*, job: DiscoveryJob, execution: DiscoveryQueryExecution, results) -> int:
    """Record one page of normalized results. Maintains the B3 §4.1 identity.

    `found - duplicate = deduplicated` holds at EVERY counter write because the
    three deltas are computed together and applied in one atomic statement.
    """
    found = duplicate = deduplicated = 0
    for result in results:
        found += 1
        business, _ = upsert_business(workspace=job.workspace, result=result)
        already_seen = DiscoveryResult.objects.filter(
            job=job, business=business, execution__attempt_no=job.attempt_no
        ).exists()
        if already_seen:
            duplicate += 1
            continue
        try:
            with transaction.atomic():
                DiscoveryResult.objects.create(
                    job=job,
                    execution=execution,
                    business=business,
                    raw_payload={
                        "provider_external_id": result.provider_external_id,
                        "source_provider": result.source_provider,
                        "observed_at": result.observed_at.isoformat(),
                    },
                )
            deduplicated += 1
        except IntegrityError:
            # A concurrent worker recorded the same observation first.
            duplicate += 1

    if found:
        DiscoveryJob.objects.filter(pk=job.pk).update(
            found_count=F("found_count") + found,
            duplicate_count=F("duplicate_count") + duplicate,
            deduplicated_count=F("deduplicated_count") + deduplicated,
            updated_at=timezone.now(),
        )
        DiscoveryQueryExecution.objects.filter(pk=execution.pk).update(
            result_count=F("result_count") + deduplicated
        )
    return deduplicated


def _run_one_execution(*, job: DiscoveryJob, query: DiscoveryQuery) -> None:
    """One execution, its own transaction boundary per page.

    A failing execution NEVER rolls back a sibling's committed results: the
    paid-for provider work of the siblings stands, which is exactly why a
    20-combination job with 19 successes completes `partial` rather than
    failing (B3 §6).
    """
    with transaction.atomic():
        execution = _claim_execution(job=job, query=query)
        if execution is None:
            return  # Another worker owns this execution. At most one may run it.
        execution_pk = execution.pk

    port = providers.require("place_search")
    ingested = 0
    page_token = ""
    outcome = OUTCOME_SUCCEEDED
    failure_code = ""

    try:
        while True:
            # Cancellation is observed at each checkpoint (B3 §7 step 4). A call
            # already in flight is allowed to finish and its page IS ingested —
            # the cost was incurred and discarding the evidence is strictly worse.
            if DiscoveryJob.objects.filter(pk=job.pk, status=JOB_CANCELLED).exists():
                outcome = OUTCOME_CANCELLED
                break

            page = port.search(
                PlaceSearchRequest(term=query.term, location=query.location, page_token=page_token)
            )
            execution = DiscoveryQueryExecution.objects.get(pk=execution_pk)
            ingested += _ingest(job=job, execution=execution, results=page.results)

            if ingested >= job.result_limit:
                outcome = OUTCOME_RESULT_LIMIT_REACHED
                break
            page_token = page.next_page_token
            if not page_token:
                outcome = OUTCOME_SUCCEEDED if ingested else OUTCOME_PROVIDER_NO_MATCH
                break
    except ProviderUnknownOutcome as exc:
        # B12-D-A020. An unknown outcome is recorded and surfaced, never repeated.
        outcome, failure_code = OUTCOME_UNKNOWN, _failure_code_for(exc)
    except (ProviderRateLimited, ProviderTemporaryFailure, ProviderTimeout) as exc:
        outcome, failure_code = OUTCOME_FAILED_RETRYABLE_EXHAUSTED, _failure_code_for(exc)
    except ProviderError as exc:
        outcome, failure_code = OUTCOME_FAILED_PERMANENT, _failure_code_for(exc)

    with transaction.atomic():
        DiscoveryQueryExecution.objects.filter(pk=execution_pk, outcome=OUTCOME_RUNNING).update(
            outcome=outcome,
            failure_code=failure_code,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )

    if outcome == OUTCOME_UNKNOWN:
        # B12-D-A020 / T-DISC-4. An unknown provider outcome opens a `P-1` case
        # and is NEVER blindly repeated: the execution row is already terminal,
        # so a redelivered task claims nothing and calls no provider. Only a
        # human, through reconciliation, decides what happens next.
        ports.require("reconciliation").open_case(
            case_class="P-1",
            subject_ref=job.public_id,
            detail={"execution_id": str(execution_pk), "failure_code": failure_code},
        )


def _finalize(job_pk) -> None:
    """Derive the job's terminal state from its executions (B3 §6)."""
    with transaction.atomic():
        job = DiscoveryJob.objects.select_for_update().get(pk=job_pk)
        executions = list(job.executions.filter(attempt_no=job.attempt_no))
        if not executions or any(not e.is_terminal for e in executions):
            return
        if job.status == JOB_CANCELLED:
            return  # A human's cancellation outranks a worker's completion.

        succeeded = [e for e in executions if e.outcome in SUCCESS_OUTCOMES]
        job.failed_query_count = len(executions) - len(succeeded)
        job.progress = 100
        job.completed_at = timezone.now()

        if not succeeded:
            job.status = JOB_FAILED
            first = next((e for e in executions if e.failure_code), None)
            job.failure_code = first.failure_code if first else FAILURE_PERMANENT
            job.failure_message = failure_message_for(job.failure_code)
        else:
            job.status = JOB_COMPLETED
            if any(e.outcome in LIMIT_OUTCOMES for e in executions):
                job.completion_kind = COMPLETION_TRUNCATED
            elif job.failed_query_count:
                job.completion_kind = COMPLETION_PARTIAL
            elif all(e.outcome == OUTCOME_PROVIDER_NO_MATCH for e in executions):
                job.completion_kind = COMPLETION_EMPTY
            else:
                job.completion_kind = COMPLETION_FULL

        bump_version(job)
        job.save(
            update_fields=[
                "status", "progress", "completed_at", "completion_kind", "failed_query_count",
                "failure_code", "failure_message", "version", "updated_at",
            ]
        )

    publish_event(
        workspace=job.workspace,
        event_type="JobSucceeded" if job.status == JOB_COMPLETED else "DiscoveryJobFailed",
        aggregate_type="discovery_job",
        aggregate_ref=job.public_id,
        payload={
            "status": job.status,
            "completion_kind": job.completion_kind,
            "deduplicated_count": job.deduplicated_count,
        },
    )


def run_discovery_job(*, job_id) -> DiscoveryJob:
    """The worker entry point. IDEMPOTENT and safe to redeliver.

    A redelivered task finds every execution already terminal, claims nothing,
    calls no provider, and simply re-derives the same terminal job state.
    """
    job = DiscoveryJob.objects.select_related("workspace").filter(pk=job_id).first()
    if job is None or job.is_terminal:
        return job

    with transaction.atomic():
        locked = DiscoveryJob.objects.select_for_update().get(pk=job.pk)
        if locked.status == JOB_PENDING:
            now = timezone.now()
            locked.status = JOB_PROCESSING
            locked.attempt_started_at = now
            locked.started_at = locked.started_at or now
            locked.save(update_fields=["status", "attempt_started_at", "started_at", "updated_at"])
        elif locked.status != JOB_PROCESSING:
            return locked
        job = locked

    queries = list(job.queries.order_by("term", "location"))
    if not queries:
        with transaction.atomic():
            DiscoveryJob.objects.filter(pk=job.pk).update(
                status=JOB_FAILED,
                failure_code=FAILURE_PLANNING,
                failure_message=failure_message_for(FAILURE_PLANNING),
                completed_at=timezone.now(),
                updated_at=timezone.now(),
            )
        return DiscoveryJob.objects.get(pk=job.pk)

    total = len(queries)
    for index, query in enumerate(queries, start=1):
        _run_one_execution(job=job, query=query)
        # Progress is EXECUTION-based, so it is monotonic within an attempt and
        # never revisable downward. 100 is written only at terminal state.
        DiscoveryJob.objects.filter(pk=job.pk).exclude(status=JOB_CANCELLED).update(
            progress=min(99, (100 * index) // total)
        )

    _finalize(job.pk)
    return DiscoveryJob.objects.get(pk=job.pk)


@transaction.atomic
def merge_business(*, context, source: Business, target: Business) -> Business:
    """MergeBusiness. The source is retained and points at its survivor."""
    if source.pk == target.pk:
        raise ValidationFailed("A business cannot be merged into itself.")
    if source.workspace_id != target.workspace_id:
        raise ValidationFailed("Businesses from different workspaces cannot be merged.")

    lock_aggregate(source)
    if source.merged_into_id:
        raise DomainConflict("This business has already been merged.")

    source.merged_into = target
    bump_version(source)
    source.save(update_fields=["merged_into", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="discovery.business_merged",
        target_type="business",
        target_ref=source.public_id,
        changed_fields=["merged_into"],
        metadata={"surviving_ref": target.public_id},
    )
    publish_event(
        workspace=context.workspace,
        event_type="BusinessMerged",
        aggregate_type="business",
        aggregate_ref=source.public_id,
        payload={"surviving_ref": target.public_id},
    )
    return source


__all__ = [
    "create_discovery_job",
    "cancel_discovery_job",
    "retry_discovery_job",
    "run_discovery_job",
    "upsert_business",
    "merge_business",
    "failure_message_for",
    "sweep_stale_executions",
    "MAX_JOBS_PER_WORKSPACE_PER_HOUR",
    "MAX_RETRIES_PER_WORKSPACE_PER_HOUR",
]


# --------------------------------------------------------------------------
# Reconciliation — class P-3. Report only, NEVER auto-repair (B14_09 §4).
# --------------------------------------------------------------------------

# How long a claim may stay `running` before it is considered heartbeat-stale.
# It is longer than the `providers.slow` ceiling on purpose: a sweep that fires
# while legitimate work is still in flight would manufacture false cases.
STALE_EXECUTION_MINUTES = 45


def sweep_stale_executions(*, now=None) -> int:
    """Open a `P-3` case for every claim a dead worker left behind.

    This is the counterpart to the durable `running` claim. The claim is what
    stops two workers paying the provider twice; this sweep is what stops such
    a claim becoming a silent permanent stall.

    It **repairs nothing**. It does not release the claim, re-queue the
    execution or move the job, because a `running` execution may have already
    reached the provider — re-running it is exactly the duplicate spend the
    claim exists to prevent. A human decides, through reconciliation.
    """
    cutoff = (now or timezone.now()) - timedelta(minutes=STALE_EXECUTION_MINUTES)
    stale = DiscoveryQueryExecution.objects.filter(
        outcome=OUTCOME_RUNNING, started_at__lt=cutoff
    ).select_related("job")

    opened = 0
    for execution in stale:
        ports.require("reconciliation").open_case(
            case_class="P-3",
            subject_ref=execution.job.public_id,
            detail={
                "execution_id": str(execution.pk),
                "claimed_at": execution.started_at.isoformat() if execution.started_at else "",
                "note": "heartbeat-stale discovery execution; operator-gated, never auto-repeated",
            },
        )
        opened += 1
    return opened
