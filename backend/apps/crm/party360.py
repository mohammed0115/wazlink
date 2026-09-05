"""crm's Party360 section providers and its Timeline contributor.

This module imports common/ ONLY. It never imports the composer, never imports
another contributor, and never enumerates the registry (B14_03 §6 rule 12).

crm supplies its own crm_activities entries and NOTHING else.
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

from .models import Appointment, CrmActivity, Lead, LeadContact, Note, Task
from .selectors import contact_payload, display_projection


def _lead_for(workspace_ref: WorkspaceRef, subject: SubjectRef) -> Lead | None:
    if subject.kind != "lead":
        return None
    return (
        Lead.objects.select_related("business", "owner_membership")
        .filter(workspace_id=workspace_ref.id, public_id=subject.public_id)
        .first()
    )


class LeadSectionProvider:
    section_name = "lead"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "lead"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("lead.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        lead = _lead_for(workspace_ref, subject)
        if lead is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        payload = {
            "lead_ref": lead.public_id,
            "status": lead.status,
            "priority": lead.priority,
            "origin_type": lead.origin_type,
            "owner_ref": lead.owner_membership.public_id,
            "last_activity_at": lead.last_activity_at,
            "converted_at": lead.converted_at,
            "archived": lead.is_archived,
            "version": lead.version,
        }
        payload.update(display_projection(lead, role=actor.role))
        return Section(self.section_name, SectionState.PRESENT, payload)


class ContactsSectionProvider:
    section_name = "contacts"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "lead"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("contact.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        lead = _lead_for(workspace_ref, subject)
        if lead is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        links = (
            LeadContact.objects.select_related("contact")
            .filter(lead=lead, unlinked_at__isnull=True)
            .order_by("-is_primary", "created_at")
        )
        # Masking happens HERE, before serialization.
        items = [
            {**contact_payload(link.contact, role=actor.role), "is_primary": link.is_primary}
            for link in links
        ]
        return Section(self.section_name, SectionState.PRESENT, items)


class TasksSectionProvider:
    section_name = "tasks"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "lead"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("task.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        lead = _lead_for(workspace_ref, subject)
        if lead is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        rows = Task.objects.filter(lead=lead).order_by("due_at", "created_at")
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "task_ref": r.public_id,
                    "title": r.title,
                    "status": r.status,
                    "due_at": r.due_at,
                    "overdue": r.is_overdue,
                    "version": r.version,
                }
                for r in rows
            ],
        )


class AppointmentsSectionProvider:
    section_name = "appointments"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "lead"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("appointment.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        lead = _lead_for(workspace_ref, subject)
        if lead is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        rows = Appointment.objects.filter(lead=lead).order_by("starts_at")
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "appointment_ref": r.public_id,
                    "title": r.title,
                    "starts_at": r.starts_at,
                    "ends_at": r.ends_at,
                    "status": r.status,
                }
                for r in rows
            ],
        )


class NotesSectionProvider:
    section_name = "notes"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind == "lead"

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("lead.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        lead = _lead_for(workspace_ref, subject)
        if lead is None:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        rows = Note.objects.filter(lead=lead).order_by("-created_at")
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [{"note_ref": r.public_id, "body": r.body, "created_at": r.created_at} for r in rows],
        )


class CrmTimelineContributor:
    """crm's TimelineEntryProvider — its OWN crm_activities entries only.

    It enforces crm's own activity visibility. It knows nothing about
    Messaging or Pipeline entries and imports neither module.
    """

    source_domain = "crm"

    def fetch(
        self,
        workspace_ref: WorkspaceRef,
        subject_ref: SubjectRef,
        actor_context: ActorContext,
        query_context: QueryContext,
    ) -> TimelineEntryPage:
        if not actor_context.has("lead.view"):
            # Unauthorized entries are simply ABSENT — no placeholder, no count.
            return TimelineEntryPage(entries=[], has_more=False)

        queryset = CrmActivity.objects.select_related("actor_membership").filter(
            workspace_id=workspace_ref.id
        )
        if subject_ref.kind == "lead":
            queryset = queryset.filter(lead__public_id=subject_ref.public_id)
        else:
            return TimelineEntryPage(entries=[], has_more=False)

        cursor = query_context.cursor
        if cursor and not cursor.is_empty():
            from django.db.models import Q

            queryset = queryset.filter(
                Q(occurred_at__lt=cursor.occurred_at)
                | Q(occurred_at=cursor.occurred_at, public_id__lt=cursor.entry_id)
            )

        limit = query_context.limit
        rows = list(queryset.order_by("-occurred_at", "-public_id")[: limit + 1])
        has_more = len(rows) > limit
        rows = rows[:limit]

        entries = [
            TimelineEntry(
                entry_id=row.public_id,
                source_domain="crm",
                occurred_at=row.occurred_at,
                recorded_at=row.created_at,
                actor=row.actor_membership.public_id if row.actor_membership else None,
                summary=row.summary,
                change=row.change,
                target_ref=subject_ref.public_id,
                source_resource_ref=row.public_id,
                source_event_type=row.activity_type,
                # NULL for CRM-owned entries: entry_id is already the identity.
                source_event_id=None,
            )
            for row in rows
        ]
        next_cursor = (
            TimelineCursor(entries[-1].occurred_at, entries[-1].entry_id) if has_more and entries else None
        )
        return TimelineEntryPage(entries=entries, has_more=has_more, next_cursor=next_cursor)


__all__ = [
    "LeadSectionProvider",
    "ContactsSectionProvider",
    "TasksSectionProvider",
    "AppointmentsSectionProvider",
    "NotesSectionProvider",
    "CrmTimelineContributor",
]
