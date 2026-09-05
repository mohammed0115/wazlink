"""customfields' Party360 section provider — typed values for the subject."""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import CustomFieldValue


class CustomFieldsSectionProvider:
    section_name = "custom_fields"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer", "contact")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        # Reading values follows the subject's own read permission.
        required = "customer.view" if subject.kind == "customer" else "lead.view"
        if not actor.has(required):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        rows = (
            CustomFieldValue.objects.select_related("definition")
            .filter(
                workspace_id=workspace_ref.id,
                subject_type=subject.kind,
                subject_id=subject.internal_id,
                definition__archived_at__isnull=True,
            )
            .order_by("definition__key")
        )
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "key": row.definition.key,
                    "label": row.definition.label,
                    "field_type": row.definition.field_type,
                    "value": row.typed_value(),
                }
                for row in rows
            ],
        )
