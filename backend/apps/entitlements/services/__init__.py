"""entitlements commands (L3). The DOWNWARD half of `billing -> entitlements`.

`AssignWorkspacePlan` is the only way a plan grant changes, and its signature
is the enforcement of `T-ENT-6`: it accepts a workspace and a plan version and
**nothing else**. There is no amount parameter, no currency, no payment, no
invoice and no card fact — not because callers are trusted to omit them, but
because there is nowhere to put them.

`entitlements` imports nothing from `billing` (`T-ENT-7`). The dependency runs
one way, downward, and this module is the bottom of it.
"""

from __future__ import annotations

from django.db import transaction

from common.errors import ValidationFailed

from ..models import DEFAULT_PLAN_CODE, PlanVersion, WorkspacePlanAssignment


@transaction.atomic
def assign_workspace_plan(*, workspace, plan_version: PlanVersion, status: str = "active"):
    """Commit an entitlement grant. Called INSIDE the caller's transaction.

    Being `atomic` rather than opening its own connection is deliberate: the
    frozen sequence (`B14_03` §6b) requires the grant and the subscription
    transition to commit together or not at all, so this participates in the
    caller's transaction as a savepoint rather than escaping it.
    """
    if plan_version is None:
        raise ValidationFailed("A plan version is required to assign a plan.")

    assignment, _ = WorkspacePlanAssignment.objects.update_or_create(
        workspace=workspace,
        defaults={"plan_version": plan_version, "status": status},
    )
    return assignment


def default_plan_version() -> PlanVersion | None:
    """The frozen entry tier. A bootstrap lands here, never on unlimited."""
    return (
        PlanVersion.objects.select_related("plan")
        .filter(plan__code=DEFAULT_PLAN_CODE, is_current=True)
        .first()
    )


__all__ = ["assign_workspace_plan", "default_plan_version"]
