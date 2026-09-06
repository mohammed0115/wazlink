"""discovery read models. No writes (B14_03 §2)."""

from __future__ import annotations

from ..models import Business, DiscoveryJob, DiscoveryResult


def jobs_for(workspace):
    return DiscoveryJob.objects.filter(workspace=workspace).select_related("requested_by")


def businesses_for(workspace):
    return Business.objects.filter(workspace=workspace)


def results_for(job: DiscoveryJob):
    """Only ever called once `B3-INV-8` has been satisfied by the caller."""
    return (
        DiscoveryResult.objects.filter(job=job, execution__attempt_no=job.attempt_no)
        .select_related("business", "execution__query")
        .order_by("business__name", "id")
    )


def quota_state(workspace) -> dict:
    """What a client may know about its own consumption. No provider facts."""
    from datetime import timedelta

    from django.utils import timezone

    from ..services import MAX_JOBS_PER_WORKSPACE_PER_HOUR

    since = timezone.now() - timedelta(hours=1)
    used = DiscoveryJob.objects.filter(workspace=workspace, created_at__gte=since).count()
    return {
        "jobs_last_hour": used,
        "jobs_per_hour_limit": MAX_JOBS_PER_WORKSPACE_PER_HOUR,
        "remaining": max(0, MAX_JOBS_PER_WORKSPACE_PER_HOUR - used),
    }


__all__ = ["jobs_for", "businesses_for", "results_for", "quota_state"]
