"""customers' Party360 section provider — the customer profile root."""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import Customer, CustomerContact


class CustomerProfileSectionProvider:
    section_name = "profile"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "customer"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("customer.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        customer = (
            Customer.objects.select_related("owner_membership", "business")
            .filter(workspace_id=workspace_ref.id, public_id=subject.public_id)
            .first()
        )
        if customer is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        return Section(
            self.section_name,
            SectionState.PRESENT,
            {
                "customer_ref": customer.public_id,
                "party_kind": customer.party_kind,
                "name": customer.name,
                "origin_kind": customer.origin_kind,
                "status": customer.status,
                "owner_ref": customer.owner_membership.public_id,
                "business_ref": customer.business.public_id if customer.business else None,
                "version": customer.version,
            },
        )


class CustomerContactsSectionProvider:
    section_name = "contacts"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "customer"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("contact.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        from apps.crm.selectors import contact_payload  # customers(L6) -> crm(L5), downward

        links = (
            CustomerContact.objects.select_related("contact")
            .filter(
                workspace_id=workspace_ref.id, customer__public_id=subject.public_id, unlinked_at__isnull=True
            )
            .order_by("-is_primary", "created_at")
        )
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {**contact_payload(link.contact, role=actor.role), "is_primary": link.is_primary}
                for link in links
            ],
        )
