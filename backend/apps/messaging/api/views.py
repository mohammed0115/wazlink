"""messaging API — the Team Inbox and the ONE send endpoint."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.errors import EntityNotFound
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import Conversation, Template
from ..selectors import (
    conversation_payload,
    conversations_for,
    inbox,
    message_payload,
    messages_for,
    templates_for,
)
from ..services import (
    assign_conversation,
    end_human_takeover,
    mark_read,
    send_message,
    set_conversation_status,
    set_handling_mode,
    start_human_takeover,
)


def _conversation(context, conversation_ref: str) -> Conversation:
    return resolve_in_workspace(conversations_for(context.workspace), context, public_id=conversation_ref)


class ConversationListView(WazlinkAPIView):
    permission_code = "conversation.view"

    def get(self, request):
        context = self.context(request)
        queryset = inbox(context.workspace, request.query_params.dict())
        items, next_cursor = paginate(
            queryset, request, order_fields=("-last_message_at", "-created_at", "-id")
        )
        return Response(
            {
                "items": [conversation_payload(row) for row in items],
                "next_cursor": next_cursor,
            }
        )


class ConversationDetailView(WazlinkAPIView):
    permission_code = "conversation.view"

    def get(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = _conversation(context, conversation_ref)
        items, next_cursor = paginate(
            messages_for(conversation), request, order_fields=("-occurred_at", "-created_at", "-id")
        )
        payload = conversation_payload(conversation, include_latest=False)
        payload["messages"] = [message_payload(m) for m in items]
        payload["next_cursor"] = next_cursor
        return Response(payload)


class MessageSendView(WazlinkAPIView):
    """`POST /messages` — the ONLY send endpoint that exists.

    `message.send` is a HUMAN permission held by a membership. There is no
    service account, no agent identity and no second endpoint (`PD-013`).
    """

    permission_code = "message.send"

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        conversation = _conversation(context, data.get("conversation_ref", ""))
        message = send_message(
            context=context,
            conversation=conversation,
            body=data.get("body", ""),
            # A human may declare that a draft helped. It changes the tag, never
            # the sender: `sent_by` remains this membership (AT-B4-2).
            ai_assisted=bool(data.get("ai_assisted", False)),
        )
        return Response(message_payload(message), status=202)


class TemplateMessageSendView(WazlinkAPIView):
    """`POST /messages/template` — the same command, the same human actor."""

    permission_code = "message.send"

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        conversation = _conversation(context, data.get("conversation_ref", ""))
        template = Template.objects.filter(
            workspace=context.workspace, public_id=data.get("template_ref", "")
        ).first()
        if template is None:
            raise EntityNotFound("The requested resource was not found.")
        message = send_message(
            context=context,
            conversation=conversation,
            template=template,
            template_variables=tuple(data.get("variables") or []),
            ai_assisted=bool(data.get("ai_assisted", False)),
        )
        return Response(message_payload(message), status=202)


class ConversationAssignView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = assign_conversation(
            context=context,
            conversation=_conversation(context, conversation_ref),
            membership_ref=(request.data or {}).get("membership_ref", ""),
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))


class ConversationReadView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = mark_read(context=context, conversation=_conversation(context, conversation_ref))
        return Response(conversation_payload(conversation))


class ConversationArchiveView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = set_conversation_status(
            context=context,
            conversation=_conversation(context, conversation_ref),
            status="closed",
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))


class ConversationReopenView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = set_conversation_status(
            context=context,
            conversation=_conversation(context, conversation_ref),
            status="open",
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))


class ConversationHandlingModeView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = set_handling_mode(
            context=context,
            conversation=_conversation(context, conversation_ref),
            mode=(request.data or {}).get("handling_mode", ""),
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))


class ConversationTakeoverView(WazlinkAPIView):
    permission_code = "conversation.view"

    def post(self, request, conversation_ref: str):
        """Start a takeover; `DELETE` ends the one this member holds."""
        context = self.context(request)
        conversation = start_human_takeover(
            context=context,
            conversation=_conversation(context, conversation_ref),
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))

    def delete(self, request, conversation_ref: str):
        context = self.context(request)
        conversation = end_human_takeover(
            context=context,
            conversation=_conversation(context, conversation_ref),
            expected_version=parse_if_match(request),
        )
        return Response(conversation_payload(conversation))


class TemplateListView(WazlinkAPIView):
    permission_code = "conversation.view"

    def get(self, request):
        context = self.context(request)
        return Response(
            {
                "items": [
                    {
                        "template_ref": t.public_id,
                        "name": t.name,
                        "language": t.language,
                        "status": t.status,
                        "body": t.body,
                    }
                    for t in templates_for(context.workspace)
                ]
            }
        )


__all__ = [
    "ConversationListView",
    "ConversationDetailView",
    "MessageSendView",
    "TemplateMessageSendView",
    "ConversationAssignView",
    "ConversationReadView",
    "ConversationArchiveView",
    "ConversationReopenView",
    "ConversationHandlingModeView",
    "ConversationTakeoverView",
    "TemplateListView",
]
