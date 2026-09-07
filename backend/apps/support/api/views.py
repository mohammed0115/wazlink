"""support API — thin transport."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import sla_clocks_for, ticket_payload, tickets_for
from ..services import (
    assign_ticket,
    change_ticket_status,
    create_ticket,
    reopen_ticket,
    resolve_ticket,
)


class TicketListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "ticket.view")
        rows = tickets_for(context.workspace)
        status_filter = request.GET.get("status", "")
        if status_filter:
            rows = rows.filter(status=status_filter)
        items, next_cursor = paginate(rows, request)
        return Response({"items": [ticket_payload(t) for t in items], "next_cursor": next_cursor})

    def post(self, request):
        context = self.context(request, "ticket.create")
        data = request.data or {}
        ticket = create_ticket(
            context=context,
            subject=data.get("subject", ""),
            body=data.get("body", ""),
            priority=data.get("priority", "normal"),
            subject_type=data.get("subject_type", ""),
            subject_ref=data.get("subject_ref", ""),
        )
        return Response(ticket_payload(ticket), status=201)


class TicketDetailView(WazlinkAPIView):
    def get(self, request, ticket_ref: str):
        context = self.context(request, "ticket.view")
        ticket = resolve_in_workspace(tickets_for(context.workspace), context, public_id=ticket_ref)
        payload = ticket_payload(ticket)
        payload["sla"] = sla_clocks_for(ticket)
        return Response(payload)

    def patch(self, request, ticket_ref: str):
        context = self.context(request, "ticket.update")
        ticket = resolve_in_workspace(tickets_for(context.workspace), context, public_id=ticket_ref)
        ticket = change_ticket_status(
            context=context,
            ticket=ticket,
            status=(request.data or {}).get("status", ""),
            expected_version=parse_if_match(request),
        )
        return Response(ticket_payload(ticket))


class TicketAssignView(WazlinkAPIView):
    permission_code = "ticket.assign"

    def post(self, request, ticket_ref: str):
        from apps.workspaces.models import Membership

        context = self.context(request)
        ticket = resolve_in_workspace(tickets_for(context.workspace), context, public_id=ticket_ref)
        assignee_ref = (request.data or {}).get("assignee_ref", "")
        membership = (
            Membership.objects.filter(workspace=context.workspace, public_id=assignee_ref).first()
            if assignee_ref
            else None
        )
        ticket = assign_ticket(
            context=context,
            ticket=ticket,
            membership=membership,
            expected_version=parse_if_match(request),
        )
        return Response(ticket_payload(ticket))


class TicketResolveView(WazlinkAPIView):
    permission_code = "ticket.resolve"

    def post(self, request, ticket_ref: str):
        context = self.context(request)
        ticket = resolve_in_workspace(tickets_for(context.workspace), context, public_id=ticket_ref)
        return Response(
            ticket_payload(
                resolve_ticket(context=context, ticket=ticket, expected_version=parse_if_match(request))
            )
        )


class TicketReopenView(WazlinkAPIView):
    permission_code = "ticket.update"

    def post(self, request, ticket_ref: str):
        context = self.context(request)
        ticket = resolve_in_workspace(tickets_for(context.workspace), context, public_id=ticket_ref)
        return Response(
            ticket_payload(
                reopen_ticket(context=context, ticket=ticket, expected_version=parse_if_match(request))
            )
        )
