"""entitlements (L3) — plan catalogue and quota truth.

entitlements NEVER reads billing. The direction is billing(L4) -> entitlements(L3),
downward (B14_03 §6b, T-ENT-4..7).
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel

DEFAULT_PLAN_CODE = "PLAN-STARTER"


class Plan(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "PLAN"

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "plans"


class PlanVersion(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "PLANV"

    plan = models.ForeignKey(Plan, on_delete=models.RESTRICT, related_name="versions")
    version_number = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(default=True)

    class Meta:
        db_table = "plan_versions"
        constraints = [
            models.UniqueConstraint(fields=["plan", "version_number"], name="uq_planversion"),
        ]


class PlanCapability(TimestampedModel):
    plan_version = models.ForeignKey(PlanVersion, on_delete=models.CASCADE, related_name="capabilities")
    capability = models.CharField(max_length=80)
    enabled = models.BooleanField(default=True)

    class Meta:
        db_table = "plan_capabilities"
        constraints = [
            models.UniqueConstraint(fields=["plan_version", "capability"], name="uq_plan_capability"),
        ]


class QuotaDefinition(TimestampedModel):
    metric = models.CharField(max_length=60, unique=True)
    period = models.CharField(max_length=20, default="month")

    class Meta:
        db_table = "quota_definitions"


class PlanVersionQuota(TimestampedModel):
    plan_version = models.ForeignKey(PlanVersion, on_delete=models.CASCADE, related_name="quotas")
    quota = models.ForeignKey(QuotaDefinition, on_delete=models.RESTRICT, related_name="plan_rows")
    limit_value = models.IntegerField(default=0)  # -1 means unlimited, explicitly

    class Meta:
        db_table = "plan_version_quotas"
        constraints = [
            models.UniqueConstraint(fields=["plan_version", "quota"], name="uq_planversion_quota"),
        ]


class WorkspacePlanAssignment(PublicIdModel, TimestampedModel):
    """Entitlement truth, NOT commercial truth.

    Carries a plan-version reference and a status. It carries no amount, no
    currency, no payment, no invoice and no card fact (T-ENT-6).
    """

    PUBLIC_ID_PREFIX = "WPA"

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="plan_assignment"
    )
    plan_version = models.ForeignKey(PlanVersion, on_delete=models.RESTRICT, related_name="assignments")
    status = models.CharField(max_length=20, default="active")

    class Meta:
        db_table = "workspace_plan_assignments"


class UsageCounter(TimestampedModel):
    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="usage_counters"
    )
    metric = models.CharField(max_length=60)
    period_key = models.CharField(max_length=20)
    used = models.IntegerField(default=0)

    class Meta:
        db_table = "usage_counters"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "metric", "period_key"], name="uq_usage_counter"),
        ]


class UsageLedger(TimestampedModel):
    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="usage_ledger"
    )
    metric = models.CharField(max_length=60)
    delta = models.IntegerField(default=0)
    reason = models.CharField(max_length=120, blank=True)

    class Meta:
        db_table = "usage_ledger"
