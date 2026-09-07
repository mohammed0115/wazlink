"""support workers. The SLA sweep REPORTS a breach; it never acts on one."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="support.sla_breach_sweep", queue="maintenance")
def sla_breach_sweep_task() -> int:
    from .services import sla_breach_sweep

    return sla_breach_sweep()


__all__ = ["sla_breach_sweep_task"]
