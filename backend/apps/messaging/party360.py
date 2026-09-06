"""messaging's Party360 section provider AND its Timeline contributor.

This module imports `common/` only. It never imports the composer, never
imports another contributor, and never enumerates the registry
(`B14_03` §6 rule 12). It supplies its OWN message entries and nothing else —
`analytics` merges.

Both surfaces activate at I6 and at no earlier slice (`T-P360-3`, `T-P360-14`).
"""

from __future__ import annotations

from common.party360.contracts import (
    Section,
    SectionState,
    SubjectRef,
    TimelineCursor,
    TimelineEntry,
    TimelineEntryPage,
)

from .models import Conversation, Message


def _conversation_queryset(workspace_id, subject: SubjectRef):
    """Resolve the subject's conversations from messaging's OWN tables."""
    queryset = Conversation.objects.filter(workspace_id=workspace_id)
    if subject.kind == "lead":
        return queryset.filter(lead__public_id=subject.public_id)
    if subject.kind == "customer":
        return queryset.filter(customer__public_id=subject.public_id)
    return queryset.none()


class ConversationsSectionProvider:
    section_name = "conversations"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        # This provider enforces ITS OWN domain's permission. A caller holding
        # lead.view but not conversation.view gets the key ABSENT — never an
        # empty list, which would itself disclose that conversations exist.
        if not actor.has("conversation.view"):
            return Section(self.section_name, SectionState.UNAVAILABLE)

        rows = list(
            _conversation_queryset(workspace_ref.id, subject)
            .select_related("assigned_to")
            .order_by("-last_message_at", "-created_at")[:10]
        )
        if not rows:
            return Section(self.section_name, SectionState.UNAVAILABLE)
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "conversation_ref": row.public_id,
                    "channel": row.channel,
                    "status": row.status,
                    "handling_mode": row.handling_mode,
                    "unread_count": row.unread_count,
                    "last_message_at": row.last_message_at,
                    "assigned_to_ref": row.assigned_to.public_id if row.assigned_to_id else None,
                }
                for row in rows
            ],
        )


class MessagingTimelineContributor:
    """messaging's TimelineEntryProvider — its OWN message entries only.

    It enforces `conversation.view` and returns nothing when the actor lacks it,
    so an unauthorized entry is ABSENT from the merged timeline rather than
    present as a placeholder that would itself disclose the conversation exists.
    """

    source_domain = "messaging"

    def fetch(self, workspace_ref, subject_ref, actor_context, query_context) -> TimelineEntryPage:
        if not actor_context.has("conversation.view"):
            return TimelineEntryPage(entries=[], has_more=False)

        conversations = _conversation_queryset(workspace_ref.id, subject_ref)
        queryset = Message.objects.filter(conversation__in=conversations).select_related(
            "conversation", "sent_by"
        )

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
                source_domain="messaging",
                occurred_at=row.occurred_at or row.created_at,
                recorded_at=row.created_at,
                actor=row.sent_by.public_id if row.sent_by_id else None,
                summary=(
                    "Message sent" if row.direction == "outbound" else "Message received"
                ),
                change={"direction": row.direction, "status": row.status},
                target_ref=subject_ref.public_id,
                source_resource_ref=row.conversation.public_id,
                source_event_type=f"message.{row.direction}",
                # REQUIRED for a cross-domain entry: the merge dedups on
                # (source_domain, source_event_id).
                source_event_id=row.public_id,
            )
            for row in rows
        ]
        next_cursor = (
            TimelineCursor(entries[-1].occurred_at, entries[-1].entry_id) if has_more and entries else None
        )
        return TimelineEntryPage(entries=entries, has_more=has_more, next_cursor=next_cursor)


__all__ = ["ConversationsSectionProvider", "MessagingTimelineContributor"]
