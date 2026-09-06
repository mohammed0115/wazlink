"""Seed the Phase-1 plan catalogue (`B8_PLAN_CATALOG` §6).

The figures live in `apps.entitlements.catalog`, not here, so the migration and
the test fixture that repopulates a truncated database cannot drift apart.
"""

from django.db import migrations

from apps.entitlements.catalog import PLANS, seed_catalog


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
    """Reverse only what this created, and only while unused.

    A plan version a subscription is committed to is protected by its own
    RESTRICT foreign key, so a reversal after real use fails loudly rather than
    orphaning an entitlement grant.
    """
    Plan = apps.get_model("entitlements", "Plan")
    Plan.objects.using(schema_editor.connection.alias).filter(
        code__in=[code for code, *_ in PLANS]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("entitlements", "0001_initial")]

    operations = [migrations.RunPython(seed, unseed)]
