"""aiagent API — sessions and proposals.

There is deliberately NO send endpoint here. Accepting a draft returns its text;
a human then posts it through messaging's own `/messages` endpoint, which
enforces its own permission, consent and service-window guards.
"""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.dispatch import task_registry
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import proposal_payload, proposals_for, session_payload, sessions_for
from ..services import accept_proposal, reject_proposal, start_agent_session


class AgentSessionCreateView(WazlinkAPIView):
    permission_code = "ai.use"

    def post(self, request):
        from apps.messaging.selectors import conversations_for

        context = self.context(request)
        conversation = resolve_in_workspace(
            conversations_for(context.workspace),
            context,
            public_id=(request.data or {}).get("conversation_ref", ""),
        )
        session = start_agent_session(context=context, conversation=conversation)
        return Response(session_payload(session), status=201)


class AgentProposalListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "ai.use")
        queryset = proposals_for(context.workspace)
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request)
        return Response(
            {"items": [proposal_payload(p) for p in items], "next_cursor": next_cursor}
        )

    def post(self, request):
        """Request a proposal. `202`: generation runs on `providers.slow`."""
        context = self.context(request, "ai.use")
        session = resolve_in_workspace(
            sessions_for(context.workspace),
            context,
            public_id=(request.data or {}).get("session_ref", ""),
        )
        task_registry.enqueue(
            "aiagent.generate_agent_proposal",
            session_id=str(session.id),
            intent=(request.data or {}).get("intent", "draft_reply"),
        )
        return Response(session_payload(session), status=202)


class AgentProposalAcceptView(WazlinkAPIView):
    """A HUMAN accepts. The owning domain's command then runs as that human."""

    permission_code = "ai.use"

    def post(self, request, proposal_ref: str):
        context = self.context(request)
        proposal = resolve_in_workspace(
            proposals_for(context.workspace), context, public_id=proposal_ref
        )
        proposal = accept_proposal(
            context=context, proposal=proposal, expected_version=parse_if_match(request)
        )
        return Response(proposal_payload(proposal))


class AgentProposalRejectView(WazlinkAPIView):
    permission_code = "ai.use"

    def post(self, request, proposal_ref: str):
        context = self.context(request)
        proposal = resolve_in_workspace(
            proposals_for(context.workspace), context, public_id=proposal_ref
        )
        proposal = reject_proposal(
            context=context, proposal=proposal, expected_version=parse_if_match(request)
        )
        return Response(proposal_payload(proposal))


__all__ = [
    "AgentSessionCreateView",
    "AgentProposalListCreateView",
    "AgentProposalAcceptView",
    "AgentProposalRejectView",
]
