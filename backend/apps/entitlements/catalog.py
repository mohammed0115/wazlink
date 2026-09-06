"""The Phase-1 plan catalogue as DATA (`B8_PLAN_CATALOG` §6, `B8-D-B008`).

It lives here, not inside a migration, because two callers need exactly the
same figures: the seed migration that populates a real database, and the test
fixture that repopulates one after a transactional test truncates it. Two
copies would drift, and the drift would be invisible until a limit test
started asserting a number production had moved away from.

These figures are Product-Owner-adjustable catalogue data. Changing one is a
`PlanVersion` publish, never a code change, and nothing in the domain branches
on a specific value.
"""

from __future__ import annotations

# The five frozen metric codes. A sixth requires a controlled amendment.
METRICS = ("leads", "discoveryRuns", "seats", "automationRuns", "aiAnalyses")

# (code, name, capabilities, quotas)
PLANS: list[tuple[str, str, dict[str, bool], dict[str, int]]] = [
    (
        "PLAN-STARTER",
        "Starter",
        # `automation.rules` is denied EXPLICITLY rather than by absence: an
        # explicit denial survives a refactor that an absence does not, even
        # though §3's default-deny rule would already refuse it.
        {"discovery.basic": True, "crm.core": True, "export.csv": True, "automation.rules": False},
        {"leads": 200, "discoveryRuns": 10, "seats": 3, "automationRuns": 0, "aiAnalyses": 20},
    ),
    (
        "PLAN-GROWTH",
        "Growth",
        {
            "discovery.basic": True,
            "crm.core": True,
            "export.csv": True,
            "pipeline.core": True,
            "inbox.copilot": True,
            "automation.rules": True,
        },
        {"leads": 1000, "discoveryRuns": 50, "seats": 10, "automationRuns": 200, "aiAnalyses": 100},
    ),
    (
        "PLAN-SCALE",
        "Scale",
        # SCALE differs from GROWTH by LIMIT, not by capability (`FB-B8-004`).
        {
            "discovery.basic": True,
            "crm.core": True,
            "export.csv": True,
            "pipeline.core": True,
            "inbox.copilot": True,
            "automation.rules": True,
        },
        {"leads": 5000, "discoveryRuns": 250, "seats": 30, "automationRuns": 1000, "aiAnalyses": 500},
    ),
]


def seed_catalog(*, Plan, PlanVersion, PlanCapability, QuotaDefinition, PlanVersionQuota, using=None):
    """Idempotently write the catalogue through the model classes given.

    The models are PARAMETERS so a migration can pass its historical
    `apps.get_model` versions and a fixture can pass the live ones — the same
    figures either way, with no import of a migration module from test code.
    """

    def manager(model):
        return model.objects.using(using) if using else model.objects

    for metric in METRICS:
        manager(QuotaDefinition).get_or_create(metric=metric, defaults={"period": "month"})

    for index, (code, name, capabilities, quotas) in enumerate(PLANS, start=1):
        plan, _ = manager(Plan).get_or_create(
            code=code, defaults={"name": name, "public_id": f"PLAN-{index:04d}"}
        )
        version, _ = manager(PlanVersion).get_or_create(
            plan=plan, version_number=1, defaults={"is_current": True, "public_id": f"PLANV-{index:04d}"}
        )
        for capability, enabled in capabilities.items():
            manager(PlanCapability).get_or_create(
                plan_version=version, capability=capability, defaults={"enabled": enabled}
            )
        for metric, limit in quotas.items():
            definition = manager(QuotaDefinition).get(metric=metric)
            manager(PlanVersionQuota).get_or_create(
                plan_version=version, quota=definition, defaults={"limit_value": limit}
            )


__all__ = ["PLANS", "METRICS", "seed_catalog"]
