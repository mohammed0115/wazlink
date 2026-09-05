"""entitlements API — the workspace's plan and the actor's resolved authority.

entitlements is L3 and imports no higher module: the workspace and role reach
it through common's authorization context (class B).
"""

from __future__ import annotations

from rest_framework.response import Response

from common.permissions_catalog import permissions_for_role
from common.views import WazlinkAPIView

from ..selectors import resolve_plan_version


class EntitlementView(WazlinkAPIView):
    permission_code = "workspace.view"

    def get(self, request):
        context = self.context(request)
        plan_version = resolve_plan_version(context.workspace)
        return Response(
            {
                "plan_code": plan_version.plan.code if plan_version else "PLAN-STARTER",
                "role": context.role,
                # Server-derived. The client never supplies these.
                "permissions": sorted(permissions_for_role(context.role)),
            }
        )
