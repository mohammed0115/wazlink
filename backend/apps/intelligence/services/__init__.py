"""intelligence commands — B4. **This module EXECUTES NOTHING** (`B4-D-A012`).

It scores, explains and recommends. It creates no Lead, no task, no deal, no
conversation and no message; it writes only its own three tables. A
recommendation is a rendered opinion, and nothing in this module can act on one.

The deterministic/AI boundary is a hard rule, not a preference (`B4-D-A008`):

*   **Class A — deterministic.** Website present, phone present, review volume,
    rating, data completeness, catalogue gap. Computed from normalized B3
    fields. **The provider is never called to restate a fact we can establish**,
    which is why an unconfigured or failing provider still yields a real score.
*   **Class B/C — AI-assisted.** A summary and an outreach angle. Bounded,
    validated, and **never score-affecting** — so a hallucination cannot move a
    number, only add prose that a human reads.

That split is what makes a provider failure a `partial` completion rather than a
lost analysis.
"""

from __future__ import annotations

import hashlib
import json
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, ValidationFailed
from common.outbox import publish_event
from common.ports import ports
from common.provider_ports import (
    INTENT_QUALIFY_LEAD,
    AIRequest,
    ProviderError,
    ProviderInvalidResponse,
    ProviderNotConfigured,
    ProviderUnknownOutcome,
    providers,
)

from ..models import (
    CATEGORY_ACTIVITY,
    CATEGORY_CONTEXT,
    CATEGORY_DATA_COMPLETENESS,
    CATEGORY_DIGITAL_MATURITY,
    CATEGORY_REACHABILITY,
    CATEGORY_SERVICE_FIT,
    CATEGORY_TO_COMPONENT,
    COMPLETION_FULL,
    COMPLETION_PARTIAL,
    FAILURE_PROVIDER_UNKNOWN,
    FAILURE_SUBJECT_MISSING,
    MAX_OVERALL_SCORE,
    POLARITY_GAP,
    POLARITY_NEUTRAL,
    POLARITY_POSITIVE,
    POLARITY_UNKNOWN,
    RUN_CANCELLED,
    RUN_COMPLETED,
    RUN_FAILED,
    RUN_IN_FLIGHT,
    RUN_QUEUED,
    RUN_RUNNING,
    SCORE_COMPONENTS,
    SCORING_MODEL_VERSION,
    SOURCE_AI_EXTRACTED,
    SOURCE_DETERMINISTIC,
    TIER_HIGH,
    TIER_LOW,
    TIER_MEDIUM,
    AIUsageRecord,
    IntelligenceRun,
    IntelligenceSignal,
)

# Frozen cost bound. Like B3's attempt bound this is an ARCHITECTURAL limit on
# provider spend, not an operational tuning knob.
MAX_ANALYSES_PER_WORKSPACE_PER_HOUR = 60
MAX_RECOMMENDATIONS = 5

TIER_THRESHOLDS = ((70, TIER_HIGH), (40, TIER_MEDIUM))

# Below this many OBSERVED input fields, the run has an opinion about nothing:
# it completes and says so rather than publishing a confident-looking zero.
MIN_EVIDENCE_FIELDS = 2


# --------------------------------------------------------------------------
# The input snapshot — what the analysis actually read.
# --------------------------------------------------------------------------


def build_snapshot(business) -> dict:
    """The BOUNDED set of fields the analysis reads.

    It is deliberately narrow. It is what gets hashed for reuse, what gets
    retained for audit, and — after masking — the only thing that could ever
    reach a provider, so every field added here is a field sent outside.
    """
    return {
        "name": business.name or "",
        "category": business.category or "",
        "city": business.city or "",
        "has_phone": bool(business.phone),
        "has_website": bool(business.website),
        "rating": business.rating,
        "review_count": business.review_count,
    }


def snapshot_hash(snapshot: dict) -> str:
    """Stable over key order, so an equivalent snapshot always reuses."""
    return hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


# --------------------------------------------------------------------------
# Class A — deterministic signals. No provider call may produce any of these.
# --------------------------------------------------------------------------


def _deterministic_signals(snapshot: dict) -> list[dict]:
    """Evidence-backed signals over observed fields only (`B4-D-A007`).

    Every `unknown`-polarity signal carries `strength=0` and
    `score_affecting=False`. That is the frozen rule, not an oversight: a
    missing rating is "not observed", never "observed as bad", so it must not
    be able to depress a score (FB-08).
    """
    signals: list[dict] = []

    def add(code, category, polarity, strength, evidence, score_affecting=True):
        signals.append(
            {
                "signal_code": code,
                "category": category,
                "polarity": polarity,
                "strength": strength,
                "source": SOURCE_DETERMINISTIC,
                "score_affecting": score_affecting and strength != 0,
                "evidence": evidence,
            }
        )

    # --- ACTIVITY: evidence of a real, operating business ---
    reviews = snapshot.get("review_count")
    if reviews is None:
        add("review_volume_unknown", CATEGORY_ACTIVITY, POLARITY_UNKNOWN, 0,
            {"field": "review_count"}, score_affecting=False)
    elif reviews >= 50:
        add("strong_review_volume", CATEGORY_ACTIVITY, POLARITY_POSITIVE, 15, {"review_count": reviews})
    elif reviews >= 10:
        add("moderate_review_volume", CATEGORY_ACTIVITY, POLARITY_POSITIVE, 8, {"review_count": reviews})
    else:
        add("low_review_volume", CATEGORY_ACTIVITY, POLARITY_GAP, 2, {"review_count": reviews})

    rating = snapshot.get("rating")
    if rating is None:
        add("rating_unknown", CATEGORY_ACTIVITY, POLARITY_UNKNOWN, 0, {"field": "rating"},
            score_affecting=False)
    elif rating >= 4.0:
        add("strong_rating", CATEGORY_ACTIVITY, POLARITY_POSITIVE, 10, {"rating": rating})
    else:
        add("modest_rating", CATEGORY_ACTIVITY, POLARITY_NEUTRAL, 4, {"rating": rating})

    # --- DIGITAL_MATURITY: the gap WazLink sells into ---
    if snapshot.get("has_website"):
        add("website_present", CATEGORY_DIGITAL_MATURITY, POLARITY_POSITIVE, 10, {"has_website": True})
    else:
        # A missing website is a GAP, not missing data: absence IS the observation.
        add("no_website", CATEGORY_DIGITAL_MATURITY, POLARITY_GAP, 30, {"has_website": False})

    # --- REACHABILITY ---
    if snapshot.get("has_phone"):
        add("phone_present", CATEGORY_REACHABILITY, POLARITY_POSITIVE, 20, {"has_phone": True})
    else:
        add("no_phone", CATEGORY_REACHABILITY, POLARITY_GAP, 0, {"has_phone": False},
            score_affecting=False)

    # --- SERVICE_FIT: a catalogue join, not a judgement ---
    if not snapshot.get("has_website"):
        add("service_fit_web_presence", CATEGORY_SERVICE_FIT, POLARITY_GAP, 15,
            {"gap": "web_presence"})

    # --- DATA_COMPLETENESS: feeds both the component and the confidence ---
    present = sum(
        1
        for key in ("name", "category", "city")
        if snapshot.get(key)
    ) + sum(1 for key in ("has_phone", "has_website") if snapshot.get(key))
    add("data_completeness", CATEGORY_DATA_COMPLETENESS, POLARITY_NEUTRAL, min(present * 2, 10),
        {"fields_observed": present})

    # --- CONTEXT: user-visible, never score-affecting ---
    if snapshot.get("city") or snapshot.get("category"):
        add("market_context", CATEGORY_CONTEXT, POLARITY_NEUTRAL, 0,
            {"city": snapshot.get("city"), "category": snapshot.get("category")},
            score_affecting=False)

    return signals


def score_from(signals: list[dict]) -> tuple[int, dict[str, int], float]:
    """Pure arithmetic over signals. All judgement lives one layer down.

    Returns `(overall, components, confidence)`. Given the same snapshot and
    scoring model version this is bit-for-bit reproducible, which is what makes
    a score defensible to the user who is looking at it.
    """
    components = dict.fromkeys(SCORE_COMPONENTS, 0)
    for signal in signals:
        if not signal.get("score_affecting"):
            continue
        component = CATEGORY_TO_COMPONENT.get(signal["category"])
        if component is None:
            continue
        components[component] += int(signal.get("strength") or 0)

    for name, maximum in SCORE_COMPONENTS.items():
        components[name] = max(0, min(components[name], maximum))

    overall = min(sum(components.values()), MAX_OVERALL_SCORE)
    # Confidence follows observed evidence, not the score. A high score from
    # thin evidence must NOT read as a confident one.
    observed = sum(1 for s in signals if s["polarity"] != POLARITY_UNKNOWN)
    confidence = round(min(1.0, observed / max(len(signals), 1)), 2)
    return overall, components, confidence


def tier_for(score: int) -> str:
    for threshold, tier in TIER_THRESHOLDS:
        if score >= threshold:
            return tier
    return TIER_LOW


# --------------------------------------------------------------------------
# RequestAnalysis / Reanalyze / CancelAnalysis.
# --------------------------------------------------------------------------


def _reusable_run(business, input_hash) -> IntelligenceRun | None:
    """A completed run over an identical snapshot IS the answer.

    Re-deriving it would pay the provider again for a result guaranteed to be
    identical (`B4` §4). Reuse is scoped to the Business, and a Business belongs
    to exactly one workspace — so no result is ever shared across tenants
    (`B4-D-A028`).
    """
    return (
        IntelligenceRun.objects.filter(
            business=business, input_hash=input_hash, status=RUN_COMPLETED
        )
        .order_by("-created_at")
        .first()
    )


@transaction.atomic
def request_analysis(*, context, business, force: bool = False) -> tuple[IntelligenceRun, bool]:
    """Admit an analysis. Returns `(run, created)`.

    `created=False` means an existing answer was reused or an analysis was
    already in flight — never that anything failed.
    """
    if business.workspace_id != context.workspace.id:
        # Should be unreachable through the API (resolution is tenant-scoped),
        # but a command must not rely on its callers to hold a tenant boundary.
        raise ValidationFailed("That business is not in this workspace.")

    snapshot = build_snapshot(business)
    input_hash = snapshot_hash(snapshot)

    if not force:
        reusable = _reusable_run(business, input_hash)
        if reusable is not None:
            return reusable, False

    in_flight = IntelligenceRun.objects.filter(
        business=business, input_hash=input_hash, status__in=RUN_IN_FLIGHT
    ).first()
    if in_flight is not None:
        return in_flight, False

    since = timezone.now() - timedelta(hours=1)
    if (
        IntelligenceRun.objects.filter(workspace=context.workspace, created_at__gte=since).count()
        >= MAX_ANALYSES_PER_WORKSPACE_PER_HOUR
    ):
        raise DomainConflict(
            "This workspace has reached its hourly analysis limit.",
            {"reason": "analysis_rate_limited", "max_per_hour": MAX_ANALYSES_PER_WORKSPACE_PER_HOUR},
        )

    try:
        # The INSERT gets its own savepoint. A constraint violation inside the
        # enclosing transaction would otherwise poison it, and the recovery
        # query below — the whole point of catching this — could not run.
        with transaction.atomic():
            run = IntelligenceRun.objects.create(
                workspace=context.workspace,
                business=business,
                requested_by=context.membership,
                status=RUN_QUEUED,
                input_hash=input_hash,
                input_snapshot=snapshot,
                input_snapshot_version=business.version,
                scoring_model_version=SCORING_MODEL_VERSION,
            )
    except IntegrityError:
        # A concurrent request opened the in-flight run first. The UNIQUE
        # CONSTRAINT is the arbiter, so exactly one analysis exists and only
        # one provider call will ever be made for this snapshot.
        existing = IntelligenceRun.objects.filter(
            business=business, input_hash=input_hash, status__in=RUN_IN_FLIGHT
        ).first()
        if existing is None:
            raise
        return existing, False

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="intelligence.analysis_requested",
        target_type="intelligence_run",
        target_ref=run.public_id,
        changed_fields=["status"],
        metadata={"business_ref": business.public_id},
    )
    return run, True


@transaction.atomic
def reanalyze(*, context, business) -> tuple[IntelligenceRun, bool]:
    """A re-analysis opens a NEW run and never rewrites a finished one.

    History is the point: a run is evidence of one opinion at one moment, and
    two opinions from different moments are each individually meaningful
    (`B4` §7).
    """
    return request_analysis(context=context, business=business, force=True)


@transaction.atomic
def cancel_analysis(*, context, run: IntelligenceRun, expected_version: int | None = None) -> IntelligenceRun:
    require_version(run, expected_version, required=False)
    lock_aggregate(run)
    if run.is_terminal:
        raise DomainConflict(
            "This analysis has already finished.",
            {"reason": "run_already_terminal", "run_status": run.status},
        )

    run.status = RUN_CANCELLED
    run.completed_at = timezone.now()
    bump_version(run)
    run.save(update_fields=["status", "completed_at", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="intelligence.analysis_cancelled",
        target_type="intelligence_run",
        target_ref=run.public_id,
        changed_fields=["status"],
    )
    return run


# --------------------------------------------------------------------------
# The worker.
# --------------------------------------------------------------------------


def _record_usage(run, usage, outcome: str) -> None:
    """Aggregate counters only. No prompt, no completion, no model name."""
    AIUsageRecord.objects.create(
        workspace=run.workspace,
        run=run,
        port_name="ai",
        operation=INTENT_QUALIFY_LEAD,
        input_units=usage.input_units,
        output_units=usage.output_units,
        total_units=usage.total_units,
        outcome=outcome,
    )


def _masked_context(snapshot: dict) -> dict:
    """PD-002 masking applied BEFORE egress, not after.

    Only the fields a qualitative judgement genuinely needs leave the system.
    The phone number and website URL are reduced to booleans: whether a channel
    exists is the analysable fact, and the value itself is contact PII with no
    analytical use.
    """
    return {
        "category": snapshot.get("category", ""),
        "city": snapshot.get("city", ""),
        "has_phone": bool(snapshot.get("has_phone")),
        "has_website": bool(snapshot.get("has_website")),
        "rating": snapshot.get("rating"),
        "review_count": snapshot.get("review_count"),
    }


def _ai_layer(run) -> tuple[list[dict], list[dict], str]:
    """Class B/C. Returns `(signals, recommendations, outcome)`.

    A failure here is NOT a failed run: the deterministic score already stands,
    so the run completes `partial`. That is the frozen partial-success rule and
    the reason an unconfigured provider still yields usable intelligence.
    """
    try:
        result = providers.require("ai").generate(
            AIRequest(
                intent=INTENT_QUALIFY_LEAD,
                workspace_ref=run.workspace.public_id,
                context=_masked_context(run.input_snapshot),
            )
        )
    except ProviderNotConfigured:
        return [], [], "not_configured"
    except ProviderUnknownOutcome:
        # Generation is EFFECT-FREE, so an unknown outcome costs nothing to
        # abandon. This is a consequence of the safety design, not an exception
        # to B12-D-A020.
        return [], [], FAILURE_PROVIDER_UNKNOWN
    except (ProviderInvalidResponse, ProviderError):
        return [], [], "provider_failed"

    _record_usage(run, result.usage, "known_success")
    if result.abstained or not result.content:
        return [], [], "abstained"

    # AI output is PRESENTATION-ONLY: strength 0, score_affecting False. A
    # hallucination can add prose a human reads; it can never move a number.
    signals = [
        {
            "signal_code": "ai_qualitative_summary",
            "category": CATEGORY_CONTEXT,
            "polarity": POLARITY_NEUTRAL,
            "strength": 0,
            "source": SOURCE_AI_EXTRACTED,
            "score_affecting": False,
            "evidence": {"confidence": result.confidence},
        }
    ]
    recommendations = [
        {
            "kind": "outreach_angle",
            "title": "Suggested outreach angle",
            "body": result.content[:1200],
            # Presentation only. There is deliberately no channel, no
            # recipient, no template and no auto-apply field: nothing here can
            # be turned into a send (T-B4-1, PD-013).
            "confidence": result.confidence,
            "requires_human_action": True,
        }
    ]
    return signals, recommendations[:MAX_RECOMMENDATIONS], "ok"


def run_intelligence_analysis(*, run_id) -> IntelligenceRun | None:
    """The worker entry point. Idempotent and safe to redeliver.

    Claim, analyse, persist. A redelivered task finds the run terminal and does
    nothing — it never re-scores, never re-calls the provider, and never opens
    a second competing truth for the same snapshot.
    """
    run = IntelligenceRun.objects.select_related("business", "workspace").filter(pk=run_id).first()
    if run is None or run.is_terminal:
        return run

    # Claim in PostgreSQL. Two workers cannot both analyse one run: the loser's
    # `status='queued'` predicate no longer matches after the winner commits.
    with transaction.atomic():
        claimed = IntelligenceRun.objects.select_for_update().filter(pk=run.pk, status=RUN_QUEUED).first()
        if claimed is None:
            return IntelligenceRun.objects.get(pk=run.pk)
        claimed.status = RUN_RUNNING
        claimed.started_at = timezone.now()
        claimed.save(update_fields=["status", "started_at", "updated_at"])
        run = claimed

    business = run.business
    if business is None:
        return _fail(run, FAILURE_SUBJECT_MISSING)

    signals = _deterministic_signals(run.input_snapshot)
    # Evidence is what was OBSERVED, not what was inferred from absence. A gap
    # signal derived from a missing website is a conclusion, not an
    # observation, so counting it here would let an empty record look
    # well-evidenced.
    observed = sum(
        1
        for key in ("name", "category", "city", "has_phone", "has_website", "rating", "review_count")
        if run.input_snapshot.get(key) not in (None, "", False)
    )
    ai_signals, recommendations, ai_outcome = _ai_layer(run)

    overall, components, confidence = score_from(signals)

    with transaction.atomic():
        locked = IntelligenceRun.objects.select_for_update().get(pk=run.pk)
        if locked.status != RUN_RUNNING:
            # Cancelled under us. A cancellation outranks a late completion, and
            # the provider spend already recorded is retained for telemetry.
            return locked

        for signal in signals + ai_signals:
            IntelligenceSignal.objects.update_or_create(
                run=locked, signal_code=signal["signal_code"], defaults=signal
            )

        locked.status = RUN_COMPLETED
        locked.completion_kind = COMPLETION_FULL if ai_outcome == "ok" else COMPLETION_PARTIAL
        locked.overall_score = overall
        locked.components = components
        locked.confidence = confidence
        locked.tier = tier_for(overall)
        locked.insufficient_evidence = observed < MIN_EVIDENCE_FIELDS
        locked.recommendations = recommendations
        locked.completed_at = timezone.now()
        bump_version(locked)
        locked.save(
            update_fields=[
                "status", "completion_kind", "overall_score", "components", "confidence", "tier",
                "insufficient_evidence", "recommendations", "completed_at", "version", "updated_at",
            ]
        )
        _advance_current(locked)

    # Frozen: LeadIntelligenceCompleted does NOT move last_activity_at
    # (CRM-INV-12). It is an announcement, and no consumer may treat it as CRM
    # activity — which is why this module writes no CRM row at all.
    publish_event(
        workspace=locked.workspace,
        event_type="LeadIntelligenceCompleted",
        aggregate_type="intelligence_run",
        aggregate_ref=locked.public_id,
        payload={
            "business_ref": business.public_id,
            "score": overall,
            "tier": locked.tier,
            "completion_kind": locked.completion_kind,
        },
    )
    return IntelligenceRun.objects.get(pk=locked.pk)


def _advance_current(run: IntelligenceRun) -> None:
    """The current pointer advances ONLY to a newly completed run.

    A failed or cancelled re-analysis therefore never regresses a Business from
    "we know its score" to "we know nothing" (B4 §4). It also never moves
    backwards: an older snapshot completing late does not displace a newer one.
    """
    current = IntelligenceRun.objects.filter(business=run.business, is_current=True).first()
    if current is not None:
        if current.pk == run.pk:
            return
        if current.input_snapshot_version > run.input_snapshot_version:
            return  # A newer opinion already stands; do not regress it.
        IntelligenceRun.objects.filter(pk=current.pk).update(is_current=False)
    IntelligenceRun.objects.filter(pk=run.pk).update(is_current=True)


def _fail(run: IntelligenceRun, failure_code: str) -> IntelligenceRun:
    """A failure records a CLOSED code and preserves the previous answer."""
    with transaction.atomic():
        IntelligenceRun.objects.filter(pk=run.pk, status=RUN_RUNNING).update(
            status=RUN_FAILED,
            failure_code=failure_code,
            completed_at=timezone.now(),
            updated_at=timezone.now(),
        )
    if failure_code == FAILURE_PROVIDER_UNKNOWN:
        ports.require("reconciliation").open_case(
            case_class="P-1", subject_ref=run.public_id, detail={"failure_code": failure_code}
        )
    return IntelligenceRun.objects.get(pk=run.pk)


__all__ = [
    "build_snapshot",
    "snapshot_hash",
    "score_from",
    "tier_for",
    "request_analysis",
    "reanalyze",
    "cancel_analysis",
    "run_intelligence_analysis",
    "MAX_ANALYSES_PER_WORKSPACE_PER_HOUR",
]
