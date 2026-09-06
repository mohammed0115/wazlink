"""automation API — rules, runs and the approval queue."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import approval_queue, rule_payload, rules_for, run_payload, runs_for
from ..services import activate_revision, approve_run, create_rule, pause_rule, reject_run


class AutomationRuleListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "automation.rule.view")
        items, next_cursor = paginate(rules_for(context.workspace), request)
        return Response({"items": [rule_payload(r) for r in items], "next_cursor": next_cursor})

    def post(self, request):
        context = self.context(request, "automation.rule.manage")
        data = request.data or {}
        rule = create_rule(
            context=context,
            name=data.get("name", ""),
            trigger_type=data.get("trigger_type", ""),
            actions=data.get("actions") or [],
            conditions=data.get("conditions") or [],
        )
        if data.get("activate"):
            rule = activate_revision(context=context, rule=rule)
        return Response(rule_payload(rule), status=201)


class AutomationRuleDetailView(WazlinkAPIView):
    def get(self, request, rule_ref: str):
        context = self.context(request, "automation.rule.view")
        rule = resolve_in_workspace(rules_for(context.workspace), context, public_id=rule_ref)
        return Response(rule_payload(rule))

    def patch(self, request, rule_ref: str):
        """Activate or pause. A rule's DEFINITION changes only by a new revision."""
        context = self.context(request, "automation.rule.manage")
        rule = resolve_in_workspace(rules_for(context.workspace), context, public_id=rule_ref)
        status_value = (request.data or {}).get("status", "")
        if status_value == "paused":
            rule = pause_rule(context=context, rule=rule, expected_version=parse_if_match(request))
        elif status_value == "active":
            rule = activate_revision(
                context=context, rule=rule, expected_version=parse_if_match(request)
            )
        return Response(rule_payload(rule))


class AutomationRunListView(WazlinkAPIView):
    permission_code = "automation.rule.view"

    def get(self, request):
        context = self.context(request)
        queryset = runs_for(context.workspace).prefetch_related("steps")
        if request.query_params.get("awaiting_approval") == "true":
            queryset = approval_queue(context.workspace).prefetch_related("steps")
        elif status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request)
        return Response({"items": [run_payload(r) for r in items], "next_cursor": next_cursor})


class AutomationRunApproveView(WazlinkAPIView):
    """The HUMAN gate. Nothing approval-tier executes without passing here."""

    permission_code = "automation.run.approve"

    def post(self, request, run_ref: str):
        context = self.context(request)
        run = resolve_in_workspace(runs_for(context.workspace), context, public_id=run_ref)
        run = approve_run(
            context=context,
            run=run,
            reason=(request.data or {}).get("reason", ""),
            expected_version=parse_if_match(request),
        )
        return Response(run_payload(run))


class AutomationRunRejectView(WazlinkAPIView):
    permission_code = "automation.run.approve"

    def post(self, request, run_ref: str):
        context = self.context(request)
        run = resolve_in_workspace(runs_for(context.workspace), context, public_id=run_ref)
        run = reject_run(
            context=context,
            run=run,
            reason=(request.data or {}).get("reason", ""),
            expected_version=parse_if_match(request),
        )
        return Response(run_payload(run))


__all__ = [
    "AutomationRuleListCreateView",
    "AutomationRuleDetailView",
    "AutomationRunListView",
    "AutomationRunApproveView",
    "AutomationRunRejectView",
]
