"""platform_async maintenance workers. Report-only, always (B14_09 §4)."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="platform.reconciliation_sweep", queue="maintenance")
def reconciliation_sweep_task() -> int:
    from .services import reconciliation_sweep

    return reconciliation_sweep()


@shared_task(name="platform.integration_health_check", queue="providers.fast")
def integration_health_check_task() -> int:
    from .services import integration_health_check

    return integration_health_check()


__all__ = ["reconciliation_sweep_task", "integration_health_check_task"]
