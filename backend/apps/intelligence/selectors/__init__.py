"""intelligence read models. No writes."""

from __future__ import annotations

from ..models import IntelligenceRun


def runs_for(workspace):
    return IntelligenceRun.objects.filter(workspace=workspace).select_related("business")


def current_for(workspace, business_id):
    """The Business's standing opinion, or None.

    Only a COMPLETED run is ever current, so this never returns a half-formed
    or failed analysis as though it were an answer.
    """
    return IntelligenceRun.objects.filter(
        workspace=workspace, business_id=business_id, is_current=True
    ).first()


def signal_payload(signal) -> dict:
    return {
        "signal_code": signal.signal_code,
        "category": signal.category,
        "polarity": signal.polarity,
        "strength": signal.strength,
        "source": signal.source,
        "score_affecting": signal.score_affecting,
        "evidence": signal.evidence,
    }


def run_payload(run: IntelligenceRun, *, include_signals: bool = True) -> dict:
    """The explainable analysis DTO.

    It carries the score AND the evidence that produced it, because a score a
    user cannot interrogate is not intelligence — it is a number.

    It carries no prompt, no completion, no model name and no provider error:
    `failure_code` is from the closed vocabulary only.
    """
    payload = {
        "analysis_ref": run.public_id,
        "business_ref": run.business.public_id if run.business_id else None,
        "status": run.status,
        "completion_kind": run.completion_kind or None,
        "overall_score": run.overall_score,
        "tier": run.tier or None,
        "components": run.components,
        "confidence": run.confidence,
        "insufficient_evidence": run.insufficient_evidence,
        "recommendations": run.recommendations,
        "is_current": run.is_current,
        # Staleness is COMPUTED at read time against the subject's live version.
        "is_stale": (
            run.is_stale_against(run.business.version) if run.business_id and run.is_current else False
        ),
        "scoring_model_version": run.scoring_model_version,
        "failure_code": run.failure_code or None,
        "completed_at": run.completed_at,
        "version": run.version,
    }
    if include_signals:
        payload["signals"] = [signal_payload(s) for s in run.signals.order_by("category", "signal_code")]
    return payload


__all__ = ["runs_for", "current_for", "run_payload", "signal_payload"]
