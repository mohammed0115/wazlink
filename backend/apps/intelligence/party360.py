"""intelligence's Party360 section provider — the `intelligence` section.

The section flips `unavailable -> present` at I4 and at no earlier slice
(`T-P360-2`). intelligence is L6 and reaches nothing upward: the subject's
`business_ref` is supplied by the composing view through `SubjectRef.related`,
so this provider resolves only its OWN tables.
"""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import IntelligenceRun
from .selectors import run_payload


class IntelligenceSectionProvider:
    section_name = "intelligence"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        # This provider enforces ITS OWN domain's permission. The composer
        # cannot widen the decision and never sees why a section was absent.
        if not actor.has("ai.use"):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        business_ref = (subject.related or {}).get("business_ref")
        if not business_ref:
            # B4-D-A001: intelligence attaches to a BUSINESS. A subject with no
            # Business has no intelligence — and none is fabricated for it.
            return Section(self.section_name, SectionState.UNAVAILABLE)

        run = (
            IntelligenceRun.objects.select_related("business")
            .filter(
                workspace_id=workspace_ref.id,
                business__public_id=business_ref,
                is_current=True,
            )
            .first()
        )
        if run is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        return Section(self.section_name, SectionState.PRESENT, run_payload(run))


__all__ = ["IntelligenceSectionProvider"]
