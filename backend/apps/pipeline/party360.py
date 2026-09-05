"""pipeline's Party360 section provider and Timeline contributor.

The `deals` section is EntityRef[] ONLY: no value, stage or probability
crosses into the 360 (frozen B2_LEAD360_READ_MODEL §2, T-P360-4).
"""

from __future__ import annotations

from common.party360.contracts import (
    ActorContext,
    QueryContext,
    Section,
    SectionState,
    SubjectRef,
    TimelineCursor,
    TimelineEntry,
    TimelineEntryPage,
    WorkspaceRef,
)

from .models import Deal


class DealsSectionProvider:
    section_name = "deals"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("deal.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        filters = {"workspace_id": workspace_ref.id}
        if subject.kind == "lead":
            filters["lead__public_id"] = subject.public_id
        else:
            filters["customer__public_id"] = subject.public_id

        rows = Deal.objects.filter(**filters).order_by("-created_at")
        # EntityRef[] only — deliberately NO value, stage or probability.
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [{"deal_ref": row.public_id, "title": row.title} for row in rows],
        )


class PipelineTimelineContributor:
    """pipeline's own deal entries, enforcing deal.view and existing masking.

    crm never imports this module: the composer reaches it through the registry.
    """

    source_domain = "pipeline"

    def fetch(
        self,
        workspace_ref: WorkspaceRef,
        subject_ref: SubjectRef,
        actor_context: ActorContext,
        query_context: QueryContext,
    ) -> TimelineEntryPage:
        # Authorization is enforced by THIS contributor, not by the composer.
        if not actor_context.has("deal.view"):
            # Absent, with no placeholder, count or gap marker — the absence
            # cannot be distinguished from a source that has not shipped.
            return TimelineEntryPage(entries=[], has_more=False)

        filters = {"workspace_id": workspace_ref.id}
        if subject_ref.kind == "lead":
            filters["lead__public_id"] = subject_ref.public_id
        elif subject_ref.kind == "customer":
            filters["customer__public_id"] = subject_ref.public_id
        else:
            return TimelineEntryPage(entries=[], has_more=False)

        rows = list(Deal.objects.filter(**filters).order_by("-created_at")[: query_context.limit + 1])
        has_more = len(rows) > query_context.limit
        rows = rows[: query_context.limit]

        entries = [
            TimelineEntry(
                entry_id=row.public_id,
                source_domain="pipeline",
                occurred_at=row.closed_at or row.created_at,
                recorded_at=row.created_at,
                actor=row.owner_membership.public_id,
                summary=f"Deal {row.status}: {row.title}",
                change={"status": row.status},
                target_ref=subject_ref.public_id,
                source_resource_ref=row.public_id,
                source_event_type=f"Deal{row.status.capitalize()}",
                # Cross-domain entries carry a source_event_id for read-time dedup.
                source_event_id=f"deal:{row.public_id}:{row.status}",
            )
            for row in rows
        ]
        next_cursor = (
            TimelineCursor(entries[-1].occurred_at, entries[-1].entry_id) if has_more and entries else None
        )
        return TimelineEntryPage(entries=entries, has_more=has_more, next_cursor=next_cursor)


__all__ = ["DealsSectionProvider", "PipelineTimelineContributor"]
