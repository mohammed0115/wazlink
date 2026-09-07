"""support's Party360 section provider.

Imports `common/` only. It never imports the composer and never enumerates the
registry (`B14_03` §6 rule 12); it supplies its OWN ticket entries, and
`analytics` merges.

The section flips `unavailable -> present` at I14 and at no earlier slice
(`T-P360-5`).
"""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import Ticket


class TicketsSectionProvider:
    section_name = "tickets"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        # This provider enforces ITS OWN domain's permission. A caller holding
        # `customer.view` but not `ticket.view` gets the key ABSENT — never an
        # empty list, which would itself disclose that tickets exist.
        if not actor.has("ticket.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        rows = list(
            Ticket.objects.filter(
                workspace_id=workspace_ref.id, subject_ref=subject.public_id
            ).order_by("-created_at")[:10]
        )
        if not rows:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "ticket_ref": row.public_id,
                    "subject": row.subject,
                    "status": row.status,
                    "priority": row.priority,
                    "assigned_to_ref": row.assigned_to.public_id if row.assigned_to_id else None,
                    "created_at": row.created_at,
                    # NO amount, no currency: a ticket touches no finance table.
                }
                for row in rows
            ],
        )


__all__ = ["TicketsSectionProvider"]
