"""entitlements selectors — read entitlements-owned rows ONLY.

An absent workspace_plan_assignments row resolves to the frozen default
PLAN-STARTER — fail-closed to the LOWEST tier, never to unlimited (T-ENT-5).
"""

from __future__ import annotations

from dataclasses import dataclass

from django.utils import timezone

from ..models import (
    DEFAULT_PLAN_CODE,
    PlanCapability,
    PlanVersion,
    PlanVersionQuota,
    UsageCounter,
    WorkspacePlanAssignment,
)


@dataclass(frozen=True)
class EntitlementDecision:
    allowed: bool
    plan_code: str
    reason: str = ""


@dataclass(frozen=True)
class QuotaDecision:
    allowed: bool
    limit: int
    used: int
    reason: str = ""


def resolve_plan_version(workspace) -> PlanVersion | None:
    """Resolve the workspace's plan version, fail-closed to the default tier."""
    assignment = (
        WorkspacePlanAssignment.objects.select_related("plan_version__plan")
        .filter(workspace=workspace, status="active")
        .first()
    )
    if assignment is not None:
        return assignment.plan_version
    # No assignment row => the frozen default, never unlimited.
    return (
        PlanVersion.objects.select_related("plan")
        .filter(plan__code=DEFAULT_PLAN_CODE, is_current=True)
        .first()
    )


def evaluate_entitlement(workspace, capability: str) -> EntitlementDecision:
    plan_version = resolve_plan_version(workspace)
    if plan_version is None:
        return EntitlementDecision(False, DEFAULT_PLAN_CODE, "no_plan_resolved")
    enabled = PlanCapability.objects.filter(
        plan_version=plan_version, capability=capability, enabled=True
    ).exists()
    return EntitlementDecision(enabled, plan_version.plan.code, "" if enabled else "capability_not_in_plan")


def _period_key() -> str:
    now = timezone.now()
    return f"{now.year:04d}-{now.month:02d}"


def evaluate_quota(workspace, metric: str, amount: int = 1) -> QuotaDecision:
    plan_version = resolve_plan_version(workspace)
    if plan_version is None:
        return QuotaDecision(False, 0, 0, "no_plan_resolved")

    row = (
        PlanVersionQuota.objects.select_related("quota")
        .filter(plan_version=plan_version, quota__metric=metric)
        .first()
    )
    if row is None:
        # No quota defined for this metric on this plan: not quota-limited.
        return QuotaDecision(True, -1, 0)

    if row.limit_value == -1:
        return QuotaDecision(True, -1, 0)

    counter = UsageCounter.objects.filter(
        workspace=workspace, metric=metric, period_key=_period_key()
    ).first()
    used = counter.used if counter else 0
    return QuotaDecision(
        used + amount <= row.limit_value,
        row.limit_value,
        used,
        "" if used + amount <= row.limit_value else "quota_exhausted",
    )


__all__ = [
    "EntitlementDecision",
    "QuotaDecision",
    "evaluate_entitlement",
    "evaluate_quota",
    "resolve_plan_version",
]
