"""intelligence API — analyses. Thin views over B4 commands."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.dispatch import task_registry
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import IntelligenceRun
from ..selectors import run_payload, runs_for
from ..services import cancel_analysis, reanalyze, request_analysis


def _business_for(context, business_ref: str):
    """Resolve the subject inside the tenant boundary.

    intelligence(L6) reads discovery(L4) — downward, and the only direction the
    layer walk permits.
    """
    from apps.discovery.models import Business

    return resolve_in_workspace(Business.objects.all(), context, public_id=business_ref)


class AnalysisListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "ai.use")
        queryset = runs_for(context.workspace).prefetch_related("signals")
        if business_ref := request.query_params.get("business_ref"):
            queryset = queryset.filter(business__public_id=business_ref)
        if request.query_params.get("current") == "true":
            queryset = queryset.filter(is_current=True)
        items, next_cursor = paginate(queryset, request)
        return Response(
            {"items": [run_payload(run) for run in items], "next_cursor": next_cursor}
        )

    def post(self, request):
        """`RequestAnalysis`. Reuse is a SUCCESS, not a conflict.

        An identical snapshot returns the standing answer with `200`; a genuinely
        new analysis returns `202`, because the work continues asynchronously.
        """
        context = self.context(request, "ai.use")
        business = _business_for(context, (request.data or {}).get("business_ref", ""))
        run, created = request_analysis(context=context, business=business)
        if created:
            task_registry.enqueue("intelligence.run_intelligence_analysis", run_id=str(run.id))
        return Response(run_payload(run), status=202 if created else 200)


class AnalysisDetailView(WazlinkAPIView):
    permission_code = "ai.use"

    def get(self, request, analysis_ref: str):
        context = self.context(request)
        run = resolve_in_workspace(
            runs_for(context.workspace).prefetch_related("signals"), context, public_id=analysis_ref
        )
        return Response(run_payload(run))


class AnalysisReanalyzeView(WazlinkAPIView):
    permission_code = "ai.use"

    def post(self, request, analysis_ref: str):
        """A re-analysis opens a NEW run; the addressed one is never rewritten."""
        context = self.context(request)
        previous = resolve_in_workspace(
            runs_for(context.workspace), context, public_id=analysis_ref
        )
        run, created = reanalyze(context=context, business=previous.business)
        if created:
            task_registry.enqueue("intelligence.run_intelligence_analysis", run_id=str(run.id))
        return Response(run_payload(run), status=202 if created else 200)


class AnalysisCancelView(WazlinkAPIView):
    permission_code = "ai.use"

    def post(self, request, analysis_ref: str):
        context = self.context(request)
        run = resolve_in_workspace(runs_for(context.workspace), context, public_id=analysis_ref)
        run = cancel_analysis(context=context, run=run, expected_version=parse_if_match(request))
        return Response(run_payload(run))


__all__ = [
    "AnalysisListCreateView",
    "AnalysisDetailView",
    "AnalysisReanalyzeView",
    "AnalysisCancelView",
    "IntelligenceRun",
]
