"""intelligence Celery tasks. Queue named EXPLICITLY (B14_09 §3)."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="intelligence.run_intelligence_analysis", queue="providers.slow", bind=True)
def run_intelligence_analysis_task(self, run_id: str):
    """Identity `(business, input_hash)`, carried by the run row itself.

    The payload is one durable reference; the worker re-reads authoritative
    state from PostgreSQL rather than trusting anything in the message.
    """
    from .services import run_intelligence_analysis

    run = run_intelligence_analysis(run_id=run_id)
    return {"analysis_ref": getattr(run, "public_id", ""), "status": getattr(run, "status", "")}


__all__ = ["run_intelligence_analysis_task"]
