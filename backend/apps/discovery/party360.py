"""discovery's Party360 section provider — the optional `business` section.

discovery is L4 and must never reach up into crm (L5). The subject's
business_ref is supplied by the composing view through SubjectRef.related, so
this provider resolves only its OWN table.
"""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import Business


class BusinessSectionProvider:
    section_name = "business"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("business.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        business_ref = (subject.related or {}).get("business_ref")
        # A Business-less subject yields an ABSENT section. No Business is ever
        # fabricated to satisfy the response shape.
        if not business_ref:
            return Section(self.section_name, SectionState.UNAVAILABLE)

        business = Business.objects.filter(workspace_id=workspace_ref.id, public_id=business_ref).first()
        if business is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)

        return Section(
            self.section_name,
            SectionState.PRESENT,
            {
                "business_ref": business.public_id,
                "name": business.name,
                "city": business.city,
                "category": business.category,
                "phone": business.phone,
                "website": business.website,
            },
        )
