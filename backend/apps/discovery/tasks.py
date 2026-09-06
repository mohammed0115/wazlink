"""discovery Celery tasks — queue named EXPLICITLY (B14_09 §1, §3).

The task is a THIN wrapper: it carries a durable identifier, re-reads
authoritative state from PostgreSQL, and delegates to the service. It holds no
business rule, so the worker path and a direct call are the same code
(`FI-B12-05`).

A raw credential never appears in a task argument — the payload is one job id.
"""

from __future__ import annotations

from celery import shared_task


@shared_task(name="discovery.run_discovery_job", queue="providers.slow", bind=True)
def run_discovery_job_task(self, job_id: str):
    """B14_09 §3: identity `job_id`, queue `providers.slow`.

    Idempotent by construction — the service claims each execution in
    PostgreSQL, so a redelivery calls no provider and double-counts nothing.
    """
    from .services import run_discovery_job

    job = run_discovery_job(job_id=job_id)
    return {"job_ref": getattr(job, "public_id", ""), "status": getattr(job, "status", "")}


@shared_task(name="discovery.sweep_stale_executions", queue="maintenance")
def sweep_stale_executions_task():
    """Reconciliation class `P-3` on the frozen `maintenance` queue.

    Deliberately starvable (`FI-B12-10`): opening a case late is harmless,
    whereas letting a sweep compete with tenant-facing provider work is not.
    """
    from .services import sweep_stale_executions

    return {"cases_opened": sweep_stale_executions()}


__all__ = ["run_discovery_job_task", "sweep_stale_executions_task"]
