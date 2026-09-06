"""assignment API — routing rules."""

from __future__ import annotations

from rest_framework.response import Response

from common.concurrency import parse_if_match
from common.views import WazlinkAPIView

from ..selectors import rule_payload, rules_for
from ..services import resolve_rule, upsert_assignment_rule


class AssignmentRuleListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "assignment.manage")
        return Response({"items": [rule_payload(rule) for rule in rules_for(context.workspace)]})

    def post(self, request):
        context = self.context(request, "assignment.manage")
        data = request.data or {}
        rule = upsert_assignment_rule(
            context=context,
            name=data.get("name", ""),
            member_refs=data.get("member_refs") or [],
            strategy=data.get("strategy", "round_robin"),
            position=int(data.get("position") or 0),
            active=bool(data.get("active", True)),
        )
        return Response(rule_payload(rule), status=201)


class AssignmentRuleDetailView(WazlinkAPIView):
    permission_code = "assignment.manage"

    def patch(self, request, rule_ref: str):
        context = self.context(request)
        rule = resolve_rule(workspace=context.workspace, rule_ref=rule_ref)
        data = request.data or {}
        rule = upsert_assignment_rule(
            context=context,
            rule=rule,
            name=data.get("name", rule.name),
            member_refs=data.get("member_refs", rule.member_refs),
            strategy=data.get("strategy", rule.strategy),
            position=int(data.get("position", rule.position)),
            active=bool(data.get("active", rule.active)),
            expected_version=parse_if_match(request),
        )
        return Response(rule_payload(rule))


__all__ = ["AssignmentRuleListCreateView", "AssignmentRuleDetailView"]
