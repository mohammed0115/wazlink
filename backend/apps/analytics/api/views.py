"""The composed read endpoints — Lead 360, Customer 360 and the merged timeline.

These are served by analytics's composers and ROUTED FROM config/. crm and
customers compose nothing, and neither imports messaging or pipeline.
"""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.errors import ValidationFailed
from common.pagination import page_size_from
from common.party360.contracts import QueryContext, SubjectRef
from common.views import WazlinkAPIView

from ..composers import (
    decode_timeline_cursor,
    encode_timeline_cursor,
    party360_composer,
    serialize_timeline_entry,
    timeline_composer,
)


class Lead360View(WazlinkAPIView):
    """GET /leads/{id} — the frozen Lead360 shape, served by the composer.

    Path, DTO, permission and status codes are unchanged; only the composing
    module differs. A section the actor may not read and a section whose slice
    has not shipped are BOTH key-absent.
    """

    permission_code = "lead.view"

    def get(self, request, lead_ref: str):
        context = self.context(request)
        from apps.crm.models import Lead

        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        subject = SubjectRef(
            kind="lead",
            public_id=lead.public_id,
            internal_id=lead.id,
            # The subject owner supplies its own related refs, so a lower-layer
            # contributor never imports upward to find its subject.
            related={"business_ref": lead.business.public_id if lead.business_id else None},
        )

        sections = party360_composer.compose(context.workspace_ref, subject, context.actor)

        # activities[] is the FIRST PAGE of the same merge, from the same composer.
        page = timeline_composer.compose(
            context.workspace_ref,
            subject,
            context.actor,
            QueryContext(cursor=decode_timeline_cursor(""), limit=25),
        )
        sections["activities"] = [serialize_timeline_entry(e) for e in page.entries]
        return Response(sections)


class Customer360View(WazlinkAPIView):
    permission_code = "customer.view"

    def get(self, request, customer_ref: str):
        context = self.context(request)
        from apps.customers.models import Customer

        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        subject = SubjectRef(
            kind="customer",
            public_id=customer.public_id,
            internal_id=customer.id,
            related={"business_ref": customer.business.public_id if customer.business_id else None},
        )
        sections = party360_composer.compose(context.workspace_ref, subject, context.actor)
        page = timeline_composer.compose(
            context.workspace_ref,
            subject,
            context.actor,
            QueryContext(cursor=decode_timeline_cursor(""), limit=25),
        )
        sections["activities"] = [serialize_timeline_entry(e) for e in page.entries]
        return Response(sections)


class LeadTimelineView(WazlinkAPIView):
    """GET /api/v1/leads/{id}/timeline — the frozen B2-D-B009 operation.

    Merged at READ TIME from every registered contributor, ordered
    (occurred_at DESC, entry_id DESC) with an opaque cursor. Nothing is
    persisted by this read.
    """

    permission_code = "lead.view"

    def get(self, request, lead_ref: str):
        context = self.context(request)
        from apps.crm.models import Lead

        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        subject = SubjectRef(kind="lead", public_id=lead.public_id, internal_id=lead.id)

        query = QueryContext(
            cursor=decode_timeline_cursor(request.query_params.get("cursor", "")),
            limit=page_size_from(request),
        )
        page = timeline_composer.compose(context.workspace_ref, subject, context.actor, query)
        return Response(
            {
                "items": [serialize_timeline_entry(e) for e in page.entries],
                "has_more": page.has_more,
                "next_cursor": encode_timeline_cursor(page.next_cursor),
            }
        )


class RegisteredSectionsView(WazlinkAPIView):
    """Diagnostic: which sections and timeline contributors are registered."""

    permission_code = "workspace.view"

    def get(self, request):
        self.context(request)
        from common.party360.registry import timeline_contributor_registry

        return Response(
            {
                "sections": party360_composer.registered_sections(),
                "timeline_contributors": timeline_contributor_registry.registered_domains(),
            }
        )


__all__ = [
    "Lead360View",
    "Customer360View",
    "LeadTimelineView",
    "RegisteredSectionsView",
    "ValidationFailed",
]
