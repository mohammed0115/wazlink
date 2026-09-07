"""Seed the Phase-1 plan catalogue (`B8_PLAN_CATALOG` §6).

The figures live in `apps.entitlements.catalog`, not here, so the migration and
the test fixture that repopulates a truncated database cannot drift apart.
"""

from django.db import migrations

from apps.entitlements.catalog import METRICS, PLANS, seed_catalog


def seed(apps, schema_editor):
    seed_catalog(
        Plan=apps.get_model("entitlements", "Plan"),
        PlanVersion=apps.get_model("entitlements", "PlanVersion"),
        PlanCapability=apps.get_model("entitlements", "PlanCapability"),
        QuotaDefinition=apps.get_model("entitlements", "QuotaDefinition"),
        PlanVersionQuota=apps.get_model("entitlements", "PlanVersionQuota"),
        using=schema_editor.connection.alias,
    )


def unseed(apps, schema_editor):
    """Reverse only what this created, in dependency order, and only if unused.

    The children must go first: `PlanVersion.plan` is a RESTRICT foreign key,
    so deleting the `Plan` rows directly fails even when nothing at all is
    using them — the constraint is protecting the version rows, not the
    entitlement grant. Removing quotas, capabilities and versions first leaves
    the `Plan` deletable.

    What still fails loudly, correctly, is a reversal after real use: a
    `PlanVersion` a subscription or a workspace assignment points at is held by
    ITS own RESTRICT foreign key, and no amount of ordering gets around that.
    That is the guard worth keeping — an entitlement grant must never be
    orphaned by a rollback.
    """
    alias = schema_editor.connection.alias
    Plan = apps.get_model("entitlements", "Plan")
    PlanVersion = apps.get_model("entitlements", "PlanVersion")
    PlanCapability = apps.get_model("entitlements", "PlanCapability")
    PlanVersionQuota = apps.get_model("entitlements", "PlanVersionQuota")
    QuotaDefinition = apps.get_model("entitlements", "QuotaDefinition")

    codes = [code for code, *_ in PLANS]
    plans = Plan.objects.using(alias).filter(code__in=codes)
    versions = PlanVersion.objects.using(alias).filter(plan__in=plans)

    PlanVersionQuota.objects.using(alias).filter(plan_version__in=versions).delete()
    PlanCapability.objects.using(alias).filter(plan_version__in=versions).delete()
    versions.delete()
    plans.delete()
    QuotaDefinition.objects.using(alias).filter(metric__in=METRICS).delete()


class Migration(migrations.Migration):
    dependencies = [("entitlements", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
