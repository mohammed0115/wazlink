"""revenue API — thin transport.

Every operation returning a `Money` requires `revenue.view` CONJUNCTIVELY with
whatever else it needs (`B9-D-A038`). Under today's matrix the conjunction is
redundant for the write operations — no role holds `revenue.recognize` without
`revenue.view` — and it is stated anyway, because relying on that would make
the rule true by coincidence of the current role assignments rather than by
construction.
"""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.idempotency import key_from
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import (
    attribution_ladder,
    revenue_event_payload,
    revenue_events_for,
    revenue_summary,
    reversal_payload,
    reversals_for,
)
from ..services import record_revenue_event, record_touchpoint, reverse_revenue_event


class RevenueEventListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "revenue.view")
        items, next_cursor = paginate(revenue_events_for(context.workspace), request)
        return Response(
            {"items": [revenue_event_payload(e) for e in items], "next_cursor": next_cursor}
        )

    def post(self, request):
        context = self.context(request, "revenue.recognize")
        # The conjunctive money guard, stated per operation.
        self.context(request, "revenue.view")
        data = request.data or {}
        source_ref = data.get("source_ref") or {}
        event = record_revenue_event(
            context=context,
            source_type=data.get("source_type", ""),
            source_entity_type=source_ref.get("entity_type", ""),
            source_public_id=source_ref.get("public_id", ""),
            gross=(data.get("gross") or {}).get("amount"),
            net=(data.get("net") or {}).get("amount"),
            currency=(data.get("gross") or {}).get("currency", ""),
            idempotency_key=data.get("idempotency_key", ""),
            note=data.get("note", ""),
        )
        return Response(revenue_event_payload(event), status=201)


class RevenueEventReverseView(WazlinkAPIView):
    def post(self, request, event_ref: str):
        context = self.context(request, "revenue.reverse")
        self.context(request, "revenue.view")
        event = resolve_in_workspace(
            revenue_events_for(context.workspace), context, public_id=event_ref
        )
        data = request.data or {}
        reversal = reverse_revenue_event(
            context=context,
            event=event,
            # `gross` ONLY. A caller-supplied `net` has no parameter to bind to.
            gross=(data.get("gross") or {}).get("amount"),
            reason=data.get("reason", ""),
            evidence_ref=data.get("evidence_ref", ""),
            note=data.get("note", ""),
            # The frozen `Idempotency-Key` HEADER, never a body field
            # (`B1_CONCURRENCY_IDEMPOTENCY` §3: no request DTO carries one).
            idempotency_key=key_from(request),
        )
        return Response(reversal_payload(reversal), status=201)


class RevenueReversalListView(WazlinkAPIView):
    permission_code = "revenue.view"

    def get(self, request):
        context = self.context(request)
        items, next_cursor = paginate(reversals_for(context.workspace), request)
        return Response({"items": [reversal_payload(r) for r in items], "next_cursor": next_cursor})


class RevenueSummaryView(WazlinkAPIView):
    permission_code = "revenue.view"

    def get(self, request):
        context = self.context(request)
        return Response({"totals": revenue_summary(context.workspace)})


class AttributionView(WazlinkAPIView):
    def get(self, request):
        # BOTH, conjunctively: it is an analytics surface AND it carries money.
        context = self.context(request, "analytics.view")
        self.context(request, "revenue.view")
        return Response({"ladder": attribution_ladder(context.workspace)})


class AttributionTouchpointView(WazlinkAPIView):
    permission_code = "attribution.manage"

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        source_ref = data.get("source_ref") or {}
        touchpoint = record_touchpoint(
            context=context,
            subject_type=data.get("subject_type", ""),
            subject_public_id=data.get("subject_ref", ""),
            source_type=data.get("source_type", ""),
            source_entity_type=source_ref.get("entity_type", ""),
            source_public_id=source_ref.get("public_id", ""),
            origin_kind=data.get("origin_kind", ""),
            position=data.get("position", 1),
            source_code=data.get("source_code", ""),
            channel=data.get("channel", ""),
            campaign=data.get("campaign", ""),
            idempotency_key=data.get("idempotency_key", ""),
        )
        # Carries NO amount — a touchpoint never has one.
        return Response(
            {
                "id": touchpoint.public_id,
                "subject_ref": touchpoint.subject_public_id,
                "origin_kind": touchpoint.origin_kind,
                "position": touchpoint.position,
                "occurred_at": touchpoint.occurred_at,
            },
            status=201,
        )
