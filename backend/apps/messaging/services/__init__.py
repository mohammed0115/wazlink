"""messaging commands — B5.

**There is exactly ONE send path, `send_message`, and its actor is a human**
(`PD-013`, `B5-D-A021`, `B14_15` §2). It requires an `AuthorizationContext`
carrying a real membership and enforces `message.send` through the ordinary
pipeline. There is no system sender, no agent sender, no second send command
and no confidence threshold that bypasses it. An AI draft is text a human
places in a composer; it becomes a message only when that human submits it
here, and the message's sender remains the human with an `ai_assisted` tag.

Inbound is the mirror image: verify, receipt, resolve, ingest. **No inbound
message creates a Lead or a Customer.** An unrecognised number opens an
UNLINKED conversation with `identity_state='unresolved'`, and a human decides
who it is — because guessing an identity from a phone number is exactly the
kind of automatic write that is impossible to unwind.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event
from common.ports import ports
from common.provider_ports import (
    OutboundMessageRequest,
    ProviderError,
    ProviderNotConfigured,
    ProviderTimeout,
    ProviderUnknownOutcome,
    providers,
)

from ..models import (
    CONVERSATION_CLOSED,
    CONVERSATION_OPEN,
    DIRECTION_INBOUND,
    DIRECTION_OUTBOUND,
    HANDLING_MODES,
    IDENTITY_AMBIGUOUS,
    IDENTITY_RESOLVED,
    IDENTITY_UNRESOLVED,
    MESSAGE_FAILED,
    MESSAGE_QUEUED,
    MESSAGE_RECEIVED,
    MESSAGE_SENT,
    MESSAGE_UNKNOWN,
    MODE_AI_PAUSED,
    MODE_HUMAN,
    STATUS_RANK,
    Conversation,
    Message,
    MessageDelivery,
    Participant,
    Template,
)

MAX_BODY_CHARS = 4000
# CB-03. Enforced BEFORE any parse: an oversized body is refused unread.
WEBHOOK_MAX_BODY_BYTES = 512 * 1024

FAILURE_NOT_CONFIGURED = "provider_not_configured"
FAILURE_REFUSED = "provider_refused"
FAILURE_UNKNOWN = "provider_outcome_unknown"


def normalize_address(raw: str) -> str:
    """One canonical form for a phone address.

    Identity resolution and conversation uniqueness both key on this, so it has
    to be the same function in both places — a second normalizer would silently
    create a second identity space.
    """
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())
    return f"+{digits}" if digits else ""


# --------------------------------------------------------------------------
# Identity resolution (B5 §3, via identity's public selector).
# --------------------------------------------------------------------------


def resolve_party(*, workspace, address: str) -> tuple[str, object | None, object | None]:
    """Resolve an address to a CRM party. Returns `(identity_state, contact, customer)`.

    Resolution NEVER crosses a workspace boundary — `workspace` is part of every
    lookup, so a cross-tenant match is not expressible.

    An EXISTING CRM Contact resolves here whether or not it ever went through
    Discovery. That is the point: messaging depends on `crm` and `identity`, and
    on Discovery not at all.
    """
    from apps.crm.models import Contact
    from apps.identity.models import PartyIdentifier

    normalized = normalize_address(address)
    if not normalized:
        return IDENTITY_UNRESOLVED, None, None

    contacts = list(
        Contact.objects.filter(workspace=workspace, phone__in=(normalized, address))[:3]
    )
    if not contacts:
        identifiers = PartyIdentifier.objects.filter(
            workspace=workspace, identifier_kind="phone", identifier_value=normalized, party_type="contact"
        ).values_list("party_id", flat=True)[:3]
        contacts = list(Contact.objects.filter(workspace=workspace, id__in=list(identifiers)))

    if not contacts:
        return IDENTITY_UNRESOLVED, None, None
    if len(contacts) > 1:
        # Frozen: ambiguity is REPORTED, never resolved by picking one. An
        # arbitrary merge here would be invisible and irreversible.
        return IDENTITY_AMBIGUOUS, None, None

    contact = contacts[0]
    customer = getattr(contact, "customer", None)
    return IDENTITY_RESOLVED, contact, customer


# --------------------------------------------------------------------------
# Conversations.
# --------------------------------------------------------------------------


def _link_identity(conversation: Conversation, workspace, address: str) -> None:
    state, contact, customer = resolve_party(workspace=workspace, address=address)
    conversation.identity_state = state
    conversation.contact = contact
    conversation.customer = customer
    # NOTHING is created here. An unresolved peer stays unresolved until a
    # human says who they are (B14_15 §3).


@transaction.atomic
def open_or_get_conversation(*, workspace, address: str, channel: str = "whatsapp") -> Conversation:
    """One ongoing conversation per counterparty, decided by a UNIQUE CONSTRAINT.

    Two inbound messages arriving together cannot open two conversations: the
    loser's `IntegrityError` resolves to the winner's row.
    """
    normalized = normalize_address(address)
    if not normalized:
        raise ValidationFailed("An inbound message carried no usable address.")

    existing = Conversation.objects.filter(
        workspace=workspace, channel=channel, peer_address=normalized
    ).first()
    if existing is not None:
        return existing

    conversation = Conversation(workspace=workspace, channel=channel, peer_address=normalized)
    _link_identity(conversation, workspace, normalized)
    try:
        with transaction.atomic():
            conversation.save()
    except IntegrityError:
        return Conversation.objects.get(workspace=workspace, channel=channel, peer_address=normalized)

    Participant.objects.get_or_create(
        conversation=conversation, address=normalized, defaults={"role": "peer"}
    )
    # Routing is applied at OPEN time, inside this transaction, so the counter
    # advance and the assignment commit together.
    _apply_assignment(conversation)

    publish_event(
        workspace=workspace,
        event_type="ConversationOpened",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"channel": channel, "identity_state": conversation.identity_state},
    )
    return conversation


def _apply_assignment(conversation: Conversation) -> None:
    """messaging(L6) -> assignment(L4). Downward, and the frozen direction."""
    from apps.assignment.services import next_assignee_ref

    assignee_ref = next_assignee_ref(workspace=conversation.workspace, subject_kind="conversation")
    if not assignee_ref:
        return
    from apps.workspaces.models import Membership

    membership = Membership.objects.filter(
        workspace=conversation.workspace, public_id=assignee_ref
    ).first()
    if membership is None:
        return
    conversation.assigned_to = membership
    conversation.save(update_fields=["assigned_to", "updated_at"])


@transaction.atomic
def assign_conversation(
    *, context, conversation: Conversation, membership_ref: str = "", expected_version: int | None = None
) -> Conversation:
    require_version(conversation, expected_version, required=False)
    lock_aggregate(conversation)

    membership = None
    if membership_ref:
        from apps.workspaces.models import Membership

        membership = Membership.objects.filter(
            workspace=context.workspace, public_id=membership_ref, status="active"
        ).first()
        if membership is None:
            # A cross-workspace membership resolves to 404, never 403.
            raise EntityNotFound("The requested resource was not found.")

    conversation.assigned_to = membership
    bump_version(conversation)
    conversation.save(update_fields=["assigned_to", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="conversation.assigned",
        target_type="conversation",
        target_ref=conversation.public_id,
        changed_fields=["assigned_to"],
        metadata={"assignee_ref": membership.public_id if membership else None},
    )
    publish_event(
        workspace=context.workspace,
        event_type="ConversationAssigned",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"assignee_ref": membership.public_id if membership else None},
    )
    return conversation


@transaction.atomic
def set_conversation_status(
    *, context, conversation: Conversation, status: str, expected_version: int | None = None
) -> Conversation:
    if status not in (CONVERSATION_OPEN, CONVERSATION_CLOSED):
        raise ValidationFailed("A conversation is either open or closed.")
    require_version(conversation, expected_version, required=False)
    lock_aggregate(conversation)
    if conversation.status == status:
        raise DomainConflict("This conversation is already in that state.", {"status": status})

    conversation.status = status
    bump_version(conversation)
    conversation.save(update_fields=["status", "version", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action=f"conversation.{'closed' if status == CONVERSATION_CLOSED else 'reopened'}",
        target_type="conversation",
        target_ref=conversation.public_id,
        changed_fields=["status"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="ConversationClosed" if status == CONVERSATION_CLOSED else "ConversationReopened",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"status": status},
    )
    return conversation


@transaction.atomic
def mark_read(*, context, conversation: Conversation) -> Conversation:
    lock_aggregate(conversation)
    conversation.unread_count = 0
    conversation.save(update_fields=["unread_count", "updated_at"])
    return conversation


# --------------------------------------------------------------------------
# CA-02 — handling mode and human takeover.
# --------------------------------------------------------------------------


@transaction.atomic
def set_handling_mode(
    *, context, conversation: Conversation, mode: str, expected_version: int | None = None
) -> Conversation:
    """`SetConversationHandlingMode`.

    `ai_assisted` authorises DRAFTING and nothing more. No mode in this
    vocabulary authorises a send, which is why the send guard does not consult
    handling mode at all.
    """
    if mode not in HANDLING_MODES:
        raise ValidationFailed("That handling mode is not supported.")
    require_version(conversation, expected_version, required=False)
    lock_aggregate(conversation)

    before = conversation.handling_mode
    if before == mode:
        raise DomainConflict("This conversation is already in that mode.", {"handling_mode": mode})

    conversation.handling_mode = mode
    bump_version(conversation)
    conversation.save(update_fields=["handling_mode", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="conversation.handling_mode_changed",
        target_type="conversation",
        target_ref=conversation.public_id,
        changed_fields=["handling_mode"],
        metadata={"before": before, "after": mode},
    )
    publish_event(
        workspace=context.workspace,
        event_type="ConversationHandlingModeChanged",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"before": before, "after": mode},
    )
    return conversation


@transaction.atomic
def start_human_takeover(
    *, context, conversation: Conversation, expected_version: int | None = None
) -> Conversation:
    """`StartHumanTakeover` — a row-locked compare-and-set.

    Two agents grabbing one conversation at the same instant serialize on the
    lock: the first sets `takeover_by`, and the second finds it already set and
    is refused. Exactly one human owns the takeover, always — an in-memory
    check would let both believe they had it.
    """
    require_version(conversation, expected_version, required=False)
    lock_aggregate(conversation)

    if conversation.takeover_by_id is not None:
        raise DomainConflict(
            "Another member has already taken over this conversation.",
            {"reason": "takeover_already_held", "holder_ref": conversation.takeover_by.public_id},
        )

    before = conversation.handling_mode
    conversation.takeover_by = context.membership
    conversation.takeover_at = timezone.now()
    # Taking over PAUSES the AI immediately. Proposal generation re-reads the
    # mode at execution time, so work already queued stops too (FI-B12-05).
    conversation.handling_mode = MODE_AI_PAUSED
    bump_version(conversation)
    conversation.save(
        update_fields=["takeover_by", "takeover_at", "handling_mode", "version", "updated_at"]
    )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="conversation.takeover_started",
        target_type="conversation",
        target_ref=conversation.public_id,
        changed_fields=["takeover_by", "handling_mode"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="HumanTakeoverStarted",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"before_mode": before, "after_mode": MODE_AI_PAUSED},
    )
    return conversation


@transaction.atomic
def end_human_takeover(
    *, context, conversation: Conversation, expected_version: int | None = None
) -> Conversation:
    require_version(conversation, expected_version, required=False)
    lock_aggregate(conversation)
    if conversation.takeover_by_id is None:
        raise DomainConflict("This conversation is not under takeover.")
    if conversation.takeover_by_id != context.membership.id:
        raise DomainConflict(
            "Only the member holding this takeover may end it.",
            {"reason": "takeover_not_held_by_actor"},
        )

    conversation.takeover_by = None
    conversation.takeover_at = None
    conversation.handling_mode = MODE_HUMAN
    bump_version(conversation)
    conversation.save(
        update_fields=["takeover_by", "takeover_at", "handling_mode", "version", "updated_at"]
    )
    publish_event(
        workspace=context.workspace,
        event_type="HumanTakeoverEnded",
        aggregate_type="conversation",
        aggregate_ref=conversation.public_id,
        payload={"after_mode": MODE_HUMAN},
    )
    return conversation


# --------------------------------------------------------------------------
# THE send path. One command. Human actor. No alternative route exists.
# --------------------------------------------------------------------------


@transaction.atomic
def send_message(
    *,
    context,
    conversation: Conversation,
    body: str = "",
    template: Template | None = None,
    template_variables: tuple[str, ...] = (),
    ai_assisted: bool = False,
) -> Message:
    """`SendMessage` / `SendTemplateMessage`. **Human actor only.**

    Guard order is deliberate and matches frozen B5: consent and the service
    window are evaluated **before** any provider call, so a refused send leaves
    no `provider_request_attempts` row and costs nothing. Refusing after the
    call would have already delivered the message.

    `ai_assisted` records that a draft was used. It does NOT change who sent
    this — `sent_by` is the human, always (`AT-B4-2`).
    """
    # A human membership is structurally required: there is no code path that
    # reaches this command without one, because the authorization pipeline
    # cannot build a context without a membership.
    if getattr(context, "membership", None) is None:
        raise ValidationFailed("A message requires a human sender.")

    lock_aggregate(conversation)
    if conversation.status == CONVERSATION_CLOSED:
        raise DomainConflict("This conversation is closed.", {"status": conversation.status})

    now = timezone.now()
    if template is not None:
        if template.status != "approved":
            raise DomainConflict(
                "Only an approved template may be sent.",
                {"reason": "template_not_approved", "template_status": template.status},
            )
        outbound = OutboundMessageRequest(
            to_phone=conversation.peer_address,
            kind="template",
            template_name=template.name,
            template_language=template.language,
            template_variables=tuple(template_variables),
        )
        preview = template.body
    else:
        text = (body or "").strip()
        if not text:
            raise ValidationFailed("A message body is required.")
        if len(text) > MAX_BODY_CHARS:
            raise ValidationFailed("That message is too long.")
        # Frozen B5 + the provider's own rule: free-form text is only
        # deliverable inside the customer service window. Refusing here is the
        # difference between a clear error and a silent provider rejection.
        if not conversation.within_service_window(now):
            raise DomainConflict(
                "This conversation is outside the customer service window; send an approved template.",
                {"reason": "outside_service_window"},
            )
        outbound = OutboundMessageRequest(to_phone=conversation.peer_address, kind="text", body=text)
        preview = text

    message = Message.objects.create(
        workspace=context.workspace,
        conversation=conversation,
        direction=DIRECTION_OUTBOUND,
        status=MESSAGE_QUEUED,
        body=preview[:MAX_BODY_CHARS],
        kind="template" if template is not None else "text",
        template_name=template.name if template is not None else "",
        sent_by=context.membership,
        ai_assisted=ai_assisted,
        occurred_at=now,
    )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="message.queued",
        target_type="message",
        target_ref=message.public_id,
        changed_fields=["status"],
        metadata={"conversation_ref": conversation.public_id, "ai_assisted": ai_assisted},
    )
    publish_event(
        workspace=context.workspace,
        event_type="MessageQueued",
        aggregate_type="message",
        aggregate_ref=message.public_id,
        payload={"conversation_ref": conversation.public_id, "direction": DIRECTION_OUTBOUND},
    )
    # The provider call happens in the worker, AFTER this transaction commits —
    # so a rolled-back send cannot have already left the building.
    transaction.on_commit(
        lambda: _enqueue_send(str(message.id), outbound)
    )
    return message


def _enqueue_send(message_id: str, outbound: OutboundMessageRequest) -> None:
    from common.dispatch import task_registry

    task_registry.enqueue("messaging.send_outbound_message", message_id=message_id)


def deliver_outbound(*, message_id) -> Message | None:
    """The worker half of the ONE send path. Idempotent; never resends.

    An `unknown` outcome is recorded as `unknown` and a `P-1` case is opened. It
    is NEVER retried: a duplicate WhatsApp message is the exact harm
    `B12-D-A020` exists to prevent, and the recipient cannot un-receive one.
    """
    message = Message.objects.select_related("conversation", "workspace").filter(pk=message_id).first()
    if message is None:
        return None

    # Claim in PostgreSQL: only an UNCLAIMED queued message may be sent, and
    # only once. The claim is written durably before this transaction commits,
    # because the provider call happens after it — a lock alone is released too
    # early, and two workers would each pay for, and each deliver, this message.
    with transaction.atomic():
        claimed = (
            Message.objects.select_for_update()
            .filter(pk=message.pk, status=MESSAGE_QUEUED, send_claimed_at__isnull=True)
            .first()
        )
        if claimed is None:
            return Message.objects.get(pk=message.pk)
        claimed.send_claimed_at = timezone.now()
        claimed.save(update_fields=["send_claimed_at", "updated_at"])
        message = claimed

    conversation = message.conversation
    outbound = (
        OutboundMessageRequest(
            to_phone=conversation.peer_address,
            kind="template",
            template_name=message.template_name,
            template_language="en",
        )
        if message.kind == "template"
        else OutboundMessageRequest(to_phone=conversation.peer_address, kind="text", body=message.body)
    )

    # Attempt row BEFORE the call (B12-D-A021), so a crash leaves evidence.
    attempt = ports.require("provider_attempts").open(provider="whatsapp", operation="send_message")
    try:
        result = providers.require("whatsapp").send(outbound)
    except ProviderNotConfigured as exc:
        return _settle_failure(message, attempt, FAILURE_NOT_CONFIGURED, exc)
    except (ProviderUnknownOutcome, ProviderTimeout) as exc:
        return _settle_unknown(message, attempt, exc)
    except ProviderError as exc:
        return _settle_failure(message, attempt, FAILURE_REFUSED, exc)

    ports.require("provider_attempts").settle(attempt=attempt, outcome="known_success")
    with transaction.atomic():
        Message.objects.filter(pk=message.pk).update(
            status=MESSAGE_SENT,
            provider_message_id=result.provider_message_id,
            updated_at=timezone.now(),
        )
        Conversation.objects.filter(pk=conversation.pk).update(
            last_message_at=timezone.now(), updated_at=timezone.now()
        )
    publish_event(
        workspace=message.workspace,
        event_type="MessageSent",
        aggregate_type="message",
        aggregate_ref=message.public_id,
        payload={"conversation_ref": conversation.public_id},
    )
    return Message.objects.get(pk=message.pk)


def _settle_failure(message: Message, attempt, failure_code: str, exc) -> Message:
    ports.require("provider_attempts").settle(attempt=attempt, outcome="known_failure")
    with transaction.atomic():
        Message.objects.filter(pk=message.pk).update(
            status=MESSAGE_FAILED, failure_code=failure_code, updated_at=timezone.now()
        )
    return Message.objects.get(pk=message.pk)


def _settle_unknown(message: Message, attempt, exc) -> Message:
    """B12-D-A020. The message may or may not have been delivered.

    It is recorded `unknown`, surfaced to a human through reconciliation, and
    never automatically resent. There is no override flag or configuration that
    changes this.
    """
    ports.require("provider_attempts").settle(attempt=attempt, outcome="unknown")
    with transaction.atomic():
        Message.objects.filter(pk=message.pk).update(
            status=MESSAGE_UNKNOWN, failure_code=FAILURE_UNKNOWN, updated_at=timezone.now()
        )
    ports.require("reconciliation").open_case(
        case_class="P-1",
        subject_ref=message.public_id,
        detail={"note": "outbound message outcome unknown; never auto-resent"},
    )
    return Message.objects.get(pk=message.pk)


# --------------------------------------------------------------------------
# Inbound.
# --------------------------------------------------------------------------


def ingest_inbound(*, workspace, inbound) -> Message | None:
    """Ingest ONE normalized inbound message. At most once, ever.

    The `(workspace, provider_message_id)` unique constraint is the durable
    guarantee: a redelivered callback — even one racing another delivery on a
    second connection — inserts nothing the second time.
    """
    if not inbound.provider_message_id:
        return None

    conversation = open_or_get_conversation(workspace=workspace, address=inbound.from_phone)
    occurred = inbound.occurred_at or datetime.now(UTC)

    try:
        with transaction.atomic():
            message = Message.objects.create(
                workspace=workspace,
                conversation=conversation,
                direction=DIRECTION_INBOUND,
                status=MESSAGE_RECEIVED,
                body=(inbound.body or "")[:MAX_BODY_CHARS],
                kind=inbound.kind or "text",
                provider_message_id=inbound.provider_message_id,
                occurred_at=occurred,
            )
    except IntegrityError:
        # Already ingested. This is a NO-OP, not an error: the provider is
        # entitled to redeliver, and B12 requires a 200 for a duplicate.
        return Message.objects.filter(
            workspace=workspace, provider_message_id=inbound.provider_message_id
        ).first()

    with transaction.atomic():
        locked = Conversation.objects.select_for_update().get(pk=conversation.pk)
        locked.last_message_at = occurred
        # The service window is measured from THEIR message.
        locked.last_inbound_at = occurred
        locked.unread_count += 1
        if locked.status == CONVERSATION_CLOSED:
            locked.status = CONVERSATION_OPEN  # a new inbound reopens it
        locked.save(
            update_fields=["last_message_at", "last_inbound_at", "unread_count", "status", "updated_at"]
        )
        if inbound.profile_name:
            Participant.objects.filter(conversation=locked, address=locked.peer_address).update(
                display_name=inbound.profile_name[:120]
            )

    publish_event(
        workspace=workspace,
        event_type="MessageReceived",
        aggregate_type="message",
        aggregate_ref=message.public_id,
        payload={
            "conversation_ref": conversation.public_id,
            "identity_state": conversation.identity_state,
        },
    )
    return message


def apply_provider_status(*, workspace, status_update) -> Message | None:
    """Apply ONE delivery status. Monotonic and idempotent.

    Two independent defences, exactly as frozen B5 specifies. The receipt layer
    absorbs a duplicate callback; this layer absorbs it again through the
    `(message, status)` unique constraint. Neither is a substitute for the
    other — the receipt layer can be bypassed by a provider that re-sends with
    a new event id, and the status layer cannot see that two callbacks arrived.

    An out-of-order `read` arriving before `delivered` INFERS the states it
    skipped rather than regressing (`AT-STATE-6`).
    """
    message = Message.objects.filter(
        workspace=workspace, provider_message_id=status_update.provider_message_id
    ).first()
    if message is None:
        return None

    incoming_rank = STATUS_RANK.get(status_update.status)
    with transaction.atomic():
        locked = Message.objects.select_for_update().get(pk=message.pk)

        if status_update.status == MESSAGE_FAILED:
            MessageDelivery.objects.get_or_create(
                message=locked,
                status=MESSAGE_FAILED,
                defaults={
                    "provider_timestamp": status_update.occurred_at,
                    "error_class": status_update.error_class[:60],
                },
            )
            if locked.status != MESSAGE_FAILED:
                locked.status = MESSAGE_FAILED
                locked.save(update_fields=["status", "updated_at"])
            return locked

        if incoming_rank is None:
            return locked  # unsupported status: absorbed, never an error

        current_rank = STATUS_RANK.get(locked.status, -1)
        # Infer everything between: a `read` that overtook `delivered` means
        # delivery DID happen, so the history records it rather than losing it.
        for name, rank in sorted(STATUS_RANK.items(), key=lambda item: item[1]):
            if current_rank < rank <= incoming_rank:
                MessageDelivery.objects.get_or_create(
                    message=locked,
                    status=name,
                    defaults={"provider_timestamp": status_update.occurred_at},
                )
        if incoming_rank > current_rank:
            locked.status = status_update.status
            locked.save(update_fields=["status", "updated_at"])
        return locked


def receipt_identity(raw_body: bytes) -> str:
    return hashlib.sha256(raw_body).hexdigest()


__all__ = [
    "normalize_address",
    "resolve_party",
    "open_or_get_conversation",
    "assign_conversation",
    "set_conversation_status",
    "mark_read",
    "set_handling_mode",
    "start_human_takeover",
    "end_human_takeover",
    "send_message",
    "deliver_outbound",
    "ingest_inbound",
    "apply_provider_status",
    "receipt_identity",
    "WEBHOOK_MAX_BODY_BYTES",
]
