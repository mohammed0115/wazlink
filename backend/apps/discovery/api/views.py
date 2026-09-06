"""discovery API — jobs, results and businesses.

Views are THIN: they resolve, delegate to a command or selector, and shape a
DTO. No business rule is decided here (`B14_03` §2).
"""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.dispatch import task_registry
from common.errors import DomainConflict
from common.pagination import paginate
from common.provider_ports import ProviderNotConfigured, providers
from common.views import WazlinkAPIView

from ..models import Business, DiscoveryJob
from ..selectors import businesses_for, jobs_for, quota_state, results_for
from ..services import cancel_discovery_job, create_discovery_job, retry_discovery_job


def job_payload(job: DiscoveryJob) -> dict:
    return {
        "job_ref": job.public_id,
        "status": job.status,
        "source": job.source,
        "progress": job.progress,
        "attempt_no": job.attempt_no,
        "result_limit": job.result_limit,
        "found_count": job.found_count,
        "duplicate_count": job.duplicate_count,
        "deduplicated_count": job.deduplicated_count,
        "failed_query_count": job.failed_query_count,
        "completion_kind": job.completion_kind or None,
        # SAFE vocabulary only — never a provider string (B3-INV-3).
        "failure_code": job.failure_code or None,
        "failure_message": job.failure_message or None,
        "queries": [
            {"term": q.term, "location": q.location} for q in job.queries.order_by("term", "location")
        ],
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "created_at": job.created_at,
        "version": job.version,
    }


def business_payload(business: Business) -> dict:
    return {
        "business_ref": business.public_id,
        "name": business.name,
        "category": business.category,
        "city": business.city,
        "address_text": business.address_text,
        "phone": business.phone,
        "website": business.website,
        "latitude": business.latitude,
        "longitude": business.longitude,
        "rating": business.rating,
        "review_count": business.review_count,
        # The PORT's own name, carried as data. The client learns which source
        # produced the record without the domain naming a vendor.
        "source_provider": business.source_provider or None,
        "merged_into_ref": business.merged_into.public_id if business.merged_into_id else None,
        "version": business.version,
    }


class DiscoveryJobListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "discovery.view")
        queryset = jobs_for(context.workspace).prefetch_related("queries")
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request)
        return Response(
            {
                "items": [job_payload(job) for job in items],
                "next_cursor": next_cursor,
                "quota": quota_state(context.workspace),
            }
        )

    def post(self, request):
        context = self.context(request, "discovery.run")
        data = request.data or {}
        terms = data.get("terms") or ([data["term"]] if data.get("term") else [])
        job = create_discovery_job(
            context=context,
            terms=terms,
            locations=data.get("locations") or ([data["location"]] if data.get("location") else []),
            result_limit=data.get("result_limit", 60),
            source=data.get("source", "place_search"),
        )
        # 202: work continues asynchronously and the response carries the
        # DURABLE row, never an optimistic guess (B14_06 §1).
        task_registry.enqueue("discovery.run_discovery_job", job_id=str(job.id))
        return Response(job_payload(job), status=202)


class DiscoveryJobDetailView(WazlinkAPIView):
    permission_code = "discovery.view"

    def get(self, request, job_ref: str):
        context = self.context(request)
        job = resolve_in_workspace(
            jobs_for(context.workspace).prefetch_related("queries"), context, public_id=job_ref
        )
        return Response(job_payload(job))


class DiscoveryJobCancelView(WazlinkAPIView):
    permission_code = "discovery.run"

    def post(self, request, job_ref: str):
        context = self.context(request)
        job = resolve_in_workspace(jobs_for(context.workspace), context, public_id=job_ref)
        job = cancel_discovery_job(context=context, job=job, expected_version=parse_if_match(request))
        return Response(job_payload(job))


class DiscoveryJobRetryView(WazlinkAPIView):
    """Frozen B3 §3.2 — a retry opens a NEW ATTEMPT, bounded at three."""

    permission_code = "discovery.run"

    def post(self, request, job_ref: str):
        context = self.context(request)
        job = resolve_in_workspace(jobs_for(context.workspace), context, public_id=job_ref)
        job = retry_discovery_job(context=context, job=job, expected_version=parse_if_match(request))
        task_registry.enqueue("discovery.run_discovery_job", job_id=str(job.id))
        return Response(job_payload(job), status=202)


class DiscoveryJobResultsView(WazlinkAPIView):
    permission_code = "discovery.view"

    def get(self, request, job_ref: str):
        context = self.context(request)
        job = resolve_in_workspace(jobs_for(context.workspace), context, public_id=job_ref)
        # B3-INV-8 — persistence is not visibility. Rows exist from the first
        # committed page; they are simply not served until the job completes.
        if not job.results_visible:
            raise DomainConflict(
                "Results are not available for this job yet.",
                {"reason": "results_not_available", "job_status": job.status},
            )
        items, next_cursor = paginate(results_for(job), request, order_fields=("business__name", "id"))
        return Response(
            {
                "items": [
                    {
                        "business": business_payload(result.business),
                        "term": result.execution.query.term if result.execution_id else "",
                        "location": result.execution.query.location if result.execution_id else "",
                    }
                    for result in items
                    if result.business_id
                ],
                "next_cursor": next_cursor,
                "completion_kind": job.completion_kind or None,
            }
        )


class BusinessDetailView(WazlinkAPIView):
    permission_code = "business.view"

    def get(self, request, business_ref: str):
        context = self.context(request)
        business = resolve_in_workspace(
            businesses_for(context.workspace).select_related("merged_into"),
            context,
            public_id=business_ref,
        )
        return Response(business_payload(business))


class DiscoverySourceStatusView(WazlinkAPIView):
    """Operator-safe provider status. NO credential value is ever rendered."""

    permission_code = "integration.manage"

    def get(self, request):
        self.context(request)
        payload = []
        for name in ("place_search", "scraping"):
            try:
                adapter = providers.require(name)
                status = adapter.status()
                enableable = (
                    getattr(adapter, "verification_scheme_available", lambda: True)()
                    and status.configuration_valid
                )
            except ProviderNotConfigured:
                payload.append(
                    {"port": name, "status": "not_connected", "configuration_valid": False,
                     "can_enable": False, "credential_refs": [], "detail": ""}
                )
                continue
            payload.append(
                {
                    "port": name,
                    "status": status.status,
                    "configuration_valid": status.configuration_valid,
                    "can_enable": bool(enableable),
                    # REFERENCE NAMES, never values.
                    "credential_refs": list(status.credential_refs),
                    "detail": status.detail,
                }
            )
        return Response({"items": payload})


__all__ = [
    "DiscoveryJobListCreateView",
    "DiscoveryJobDetailView",
    "DiscoveryJobCancelView",
    "DiscoveryJobRetryView",
    "DiscoveryJobResultsView",
    "BusinessDetailView",
    "DiscoverySourceStatusView",
    "job_payload",
    "business_payload",
]
