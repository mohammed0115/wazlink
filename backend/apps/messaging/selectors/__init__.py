"""messaging read models — the Team Inbox.

The inbox is a VIEW over messaging truth, not a competing store. There is no
inbox table, no denormalized copy of a message and no second source of "what is
the latest message" — every field below is read from `conversations` and
`messages` at request time.
"""

from __future__ import annotations

from ..models import Conversation, Message, Template


def conversations_for(workspace):
    return Conversation.objects.filter(workspace=workspace).select_related(
        "assigned_to", "contact", "customer", "takeover_by"
    )


def messages_for(conversation):
    return Message.objects.filter(conversation=conversation).select_related("sent_by")


def templates_for(workspace):
    return Template.objects.filter(workspace=workspace).order_by("name", "language")


def _latest_message(conversation: Conversation) -> Message | None:
    return conversation.messages.order_by("-occurred_at", "-created_at").first()


def message_payload(message: Message) -> dict:
    return {
        "message_ref": message.public_id,
        "direction": message.direction,
        "status": message.status,
        "body": message.body,
        "kind": message.kind,
        "template_name": message.template_name or None,
        # WHO sent it. An AI-drafted message still reports the human.
        "sent_by_ref": message.sent_by.public_id if message.sent_by_id else None,
        "ai_assisted": message.ai_assisted,
        "failure_code": message.failure_code or None,
        "occurred_at": message.occurred_at,
        "version": message.version,
    }


def conversation_payload(conversation: Conversation, *, include_latest: bool = True) -> dict:
    latest = _latest_message(conversation) if include_latest else None
    return {
        "conversation_ref": conversation.public_id,
        "channel": conversation.channel,
        "status": conversation.status,
        "handling_mode": conversation.handling_mode,
        "identity_state": conversation.identity_state,
        "peer_address": conversation.peer_address,
        "contact_ref": conversation.contact.public_id if conversation.contact_id else None,
        "customer_ref": conversation.customer.public_id if conversation.customer_id else None,
        "assigned_to_ref": conversation.assigned_to.public_id if conversation.assigned_to_id else None,
        "takeover_by_ref": conversation.takeover_by.public_id if conversation.takeover_by_id else None,
        "unread_count": conversation.unread_count,
        "last_message_at": conversation.last_message_at,
        "latest_message": message_payload(latest) if latest else None,
        "version": conversation.version,
    }


def inbox(workspace, filters: dict):
    """The Team Inbox query. Filters are frozen: assigned, unassigned, mode, status."""
    queryset = conversations_for(workspace)
    if (status := filters.get("status")) in ("open", "closed"):
        queryset = queryset.filter(status=status)
    if (mode := filters.get("handling_mode")) is not None and mode:
        queryset = queryset.filter(handling_mode=mode)
    if filters.get("unassigned") == "true":
        queryset = queryset.filter(assigned_to__isnull=True)
    elif assignee := filters.get("assigned_to"):
        queryset = queryset.filter(assigned_to__public_id=assignee)
    if filters.get("unread") == "true":
        queryset = queryset.filter(unread_count__gt=0)
    return queryset


__all__ = [
    "conversations_for",
    "messages_for",
    "templates_for",
    "conversation_payload",
    "message_payload",
    "inbox",
]
