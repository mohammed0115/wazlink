"""pipeline API — deals and the pipeline board."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import Deal, Pipeline, PipelineStage
from ..services import close_deal, create_deal, ensure_default_pipeline, move_deal_stage


def deal_payload(deal: Deal) -> dict:
    return {
        "deal_ref": deal.public_id,
        "title": deal.title,
        # Forecast value. This is NOT recognized revenue.
        "value": str(deal.value),
        "currency": deal.currency,
        "weighted_value": str(deal.weighted_value),
        "status": deal.status,
        "stage": {
            "stage_ref": deal.stage.public_id,
            "name": deal.stage.name,
            "position": deal.stage.position,
        },
        "pipeline_ref": deal.pipeline.public_id,
        "lead_ref": deal.lead.public_id if deal.lead_id else None,
        "customer_ref": deal.customer.public_id if deal.customer_id else None,
        "owner_ref": deal.owner_membership.public_id,
        "loss_reason": deal.loss_reason,
        "closed_at": deal.closed_at,
        "version": deal.version,
    }


class PipelineListView(WazlinkAPIView):
    permission_code = "deal.view"

    def get(self, request):
        context = self.context(request)
        ensure_default_pipeline(workspace=context.workspace)
        rows = Pipeline.objects.prefetch_related("stages").filter(workspace=context.workspace)
        return Response(
            {
                "items": [
                    {
                        "pipeline_ref": p.public_id,
                        "name": p.name,
                        "is_default": p.is_default,
                        "stages": [
                            {
                                "stage_ref": s.public_id,
                                "name": s.name,
                                "position": s.position,
                                "probability": str(s.probability),
                            }
                            for s in p.stages.order_by("position")
                        ],
                    }
                    for p in rows
                ]
            }
        )


class DealListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "deal.view")
        queryset = Deal.objects.select_related(
            "stage", "pipeline", "owner_membership", "lead", "customer"
        ).filter(workspace=context.workspace)
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request)
        return Response({"items": [deal_payload(d) for d in items], "next_cursor": next_cursor})

    def post(self, request):
        context = self.context(request, "deal.create")
        data = request.data or {}

        lead = customer = None
        if lead_ref := data.get("lead_ref"):
            from apps.crm.models import Lead

            lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        if customer_ref := data.get("customer_ref"):
            from apps.customers.models import Customer

            customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)

        deal = create_deal(
            context=context,
            title=data.get("title", ""),
            lead=lead,
            customer=customer,
            value=data.get("value", 0),
            currency=data.get("currency", "SAR"),
        )
        return Response(deal_payload(deal), status=201)


class DealDetailView(WazlinkAPIView):
    permission_code = "deal.view"

    def get(self, request, deal_ref: str):
        context = self.context(request)
        deal = resolve_in_workspace(
            Deal.objects.select_related("stage", "pipeline", "owner_membership"),
            context,
            public_id=deal_ref,
        )
        return Response(deal_payload(deal))


class DealStageView(WazlinkAPIView):
    permission_code = "deal.update"

    def post(self, request, deal_ref: str):
        context = self.context(request)
        deal = resolve_in_workspace(
            Deal.objects.select_related("stage", "pipeline"), context, public_id=deal_ref
        )
        deal = move_deal_stage(
            context=context,
            deal=deal,
            stage_ref=(request.data or {}).get("stage_ref", ""),
            expected_version=parse_if_match(request),
        )
        return Response(deal_payload(deal))


class DealCloseView(WazlinkAPIView):
    # deal.close is gated ABOVE ordinary update.
    permission_code = "deal.close"

    def post(self, request, deal_ref: str):
        context = self.context(request)
        deal = resolve_in_workspace(
            Deal.objects.select_related("stage", "pipeline"), context, public_id=deal_ref
        )
        data = request.data or {}
        deal = close_deal(
            context=context,
            deal=deal,
            outcome=data.get("outcome", ""),
            loss_reason=data.get("loss_reason", ""),
            expected_version=parse_if_match(request),
        )
        return Response(deal_payload(deal))


__all__ = [
    "PipelineListView",
    "DealListCreateView",
    "DealDetailView",
    "DealStageView",
    "DealCloseView",
    "deal_payload",
    "PipelineStage",
]
