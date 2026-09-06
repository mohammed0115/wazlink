"""aiagent commands — the governed agent (`B14_14` §7).

**`AgentSendMessage` is deliberately not created.** There is no command in this
module that reaches a provider, and `accept_proposal` dispatches only through a
closed allow-list of owning-domain commands — none of which is a send.

**The agent holds no permissions.** Accepting invokes the owning domain's
ordinary command as the ACCEPTING HUMAN, checked by that domain's own guard. So
a member who may not create a task cannot obtain one by accepting a proposal,
and there is no elevated service identity anywhere in the flow.

Handling mode is re-read AT EXECUTION (`FI-B12-05`). A human taking over pauses
the AI immediately, and work already queued stops too — because the worker
checks the current mode rather than the mode that was true when it was queued.
"""

from __future__ import annotations

import hashlib
import json

from django.db import IntegrityError, transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, PermissionDeniedError, ValidationFailed
from common.outbox import publish_event
from common.provider_ports import (
    INTENT_ANSWER_FROM_KNOWLEDGE,
    INTENT_DRAFT_REPLY,
    INTENT_SUMMARIZE_CONVERSATION,
    AICitation,
    AIRequest,
    ProviderError,
    ProviderNotConfigured,
    ProviderUnknownOutcome,
    providers,
)

from ..models import (
    PROHIBITED_PROPOSAL_KINDS,
    PROPOSAL_ABANDONED,
    PROPOSAL_ACCEPTED,
    PROPOSAL_KIND_TIERS,
    PROPOSAL_PENDING,
    PROPOSAL_REJECTED,
    SESSION_CLOSED,
    SESSION_OPEN,
    TIER_EXECUTE,
    TIER_PROPOSE,
    AgentProposal,
    AgentSession,
)

# The intents this module may ask the provider for. Every one is drafting,
# summarizing or answering — none of them acts.
ALLOWED_INTENTS = (INTENT_DRAFT_REPLY, INTENT_SUMMARIZE_CONVERSATION, INTENT_ANSWER_FROM_KNOWLEDGE)

INTENT_TO_KIND = {
    INTENT_DRAFT_REPLY: "draft_reply",
    INTENT_SUMMARIZE_CONVERSATION: "conversation_summary",
    INTENT_ANSWER_FROM_KNOWLEDGE: "knowledge_answer",
}

# The CLOSED allow-list of commands a human may trigger by accepting. Each is an
# owning domain's ordinary command and runs as the human. There is deliberately
# no entry that sends anything.
ACCEPTABLE_COMMANDS = {"create_task": "CreateTask", "create_contact": "AddContact"}

MAX_CONTEXT_MESSAGES = 8
MAX_MESSAGE_CHARS = 400


def _context_hash(payload: dict) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()
    ).hexdigest()


# --------------------------------------------------------------------------
# Sessions.
# --------------------------------------------------------------------------


@transaction.atomic
def start_agent_session(*, context, conversation) -> AgentSession:
    """`StartAgentSession`. One open session per conversation."""
    if conversation.workspace_id != context.workspace.id:
        raise ValidationFailed("That conversation is not in this workspace.")

    existing = AgentSession.objects.filter(conversation=conversation, status=SESSION_OPEN).first()
    if existing is not None:
        return existing
    try:
        with transaction.atomic():
            session = AgentSession.objects.create(
                workspace=context.workspace,
                conversation=conversation,
                opened_by=context.membership,
            )
    except IntegrityError:
        return AgentSession.objects.get(conversation=conversation, status=SESSION_OPEN)

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="agent.session_started",
        target_type="agent_session",
        target_ref=session.public_id,
        changed_fields=["status"],
    )
    return session


@transaction.atomic
def close_agent_session(*, context, session: AgentSession) -> AgentSession:
    lock_aggregate(session)
    session.status = SESSION_CLOSED
    bump_version(session)
    session.save(update_fields=["status", "version", "updated_at"])
    return session


# --------------------------------------------------------------------------
# Generation — the worker path. EFFECT-FREE by construction.
# --------------------------------------------------------------------------


def _masked_context(conversation, messages) -> dict:
    """`PD-002` masking applied BEFORE egress, not after.

    Minimum-necessary context: the recent conversation text a reply must answer,
    and nothing identifying. The counterparty's phone number, the contact's
    name, the customer record and every internal identifier stay behind — none
    of them helps write a reply, and all of them are PII once they leave.
    """
    return {
        "channel": conversation.channel,
        "handling_mode": conversation.handling_mode,
        "recent_messages": [
            {"direction": m.direction, "text": (m.body or "")[:MAX_MESSAGE_CHARS]}
            for m in messages
        ],
    }


def generate_proposal(*, session_id, intent: str = INTENT_DRAFT_REPLY) -> AgentProposal | None:
    """`GenerateAgentProposal` — a SYSTEM command with no human actor.

    It is effect-free: it writes one `agent_proposals` row and nothing else. That
    is why abandoning an `unknown` provider outcome is safe here — a consequence
    of `PD-013` forbidding the agent from sending, not an exception to
    `B12-D-A020`.
    """
    if intent not in ALLOWED_INTENTS:
        raise ValidationFailed("That agent intent is not permitted.")

    session = (
        AgentSession.objects.select_related("conversation", "workspace")
        .filter(pk=session_id, status=SESSION_OPEN)
        .first()
    )
    if session is None:
        return None

    # Mode is re-read AT EXECUTION, never trusted from when this was queued
    # (FI-B12-05). A human who took over between queueing and running has
    # already stopped the AI, and this is where that takes effect.
    conversation = session.conversation
    if conversation.handling_mode != "ai_assisted":
        return None

    from apps.messaging.selectors import messages_for

    messages = list(messages_for(conversation).order_by("-created_at")[:MAX_CONTEXT_MESSAGES])[::-1]
    masked = _masked_context(conversation, messages)
    context_hash = _context_hash({"intent": intent, "context": masked})

    existing = AgentProposal.objects.filter(
        session=session, intent=intent, context_hash=context_hash
    ).first()
    if existing is not None:
        # Identity `(session, intent, context_hash)`: a redelivered generation
        # converges here rather than opening a second proposal, and pays the
        # provider nothing.
        return existing

    # Grounding: PUBLISHED articles only, from THIS workspace.
    from apps.knowledge.selectors import kb_retrieval

    last_inbound = next((m for m in reversed(messages) if m.direction == "inbound"), None)
    grounding = kb_retrieval(
        workspace=session.workspace, query=(last_inbound.body if last_inbound else "")
    )
    citations = tuple(
        AICitation(article_ref=row["article_ref"], version=row["version"], excerpt=row["excerpt"])
        for row in grounding
    )
    masked["knowledge"] = [
        {"article_ref": c.article_ref, "version": c.version, "excerpt": c.excerpt} for c in citations
    ]

    try:
        result = providers.require("ai").generate(
            AIRequest(
                intent=intent,
                workspace_ref=session.workspace.public_id,
                context=masked,
                grounding=citations,
            )
        )
    except ProviderNotConfigured:
        # The inbox keeps working; there are simply no proposals.
        return None
    except ProviderUnknownOutcome:
        return None
    except ProviderError:
        return None

    if result.abstained or not result.content:
        return None

    # Only cite articles that are STILL published and in this workspace. A
    # provider-returned citation is untrusted input like any other, and an
    # article archived since retrieval must stop being quotable immediately.
    allowed = {row["article_ref"]: row["version"] for row in grounding}
    verified = [
        {"article_ref": c.article_ref, "version": allowed[c.article_ref]}
        for c in result.citations
        if c.article_ref in allowed
    ]

    kind = INTENT_TO_KIND[intent]
    try:
        with transaction.atomic():
            proposal = AgentProposal.objects.create(
                workspace=session.workspace,
                session=session,
                proposal_kind=kind,
                intent=intent,
                context_hash=context_hash,
                payload={"text": result.content},
                citations=verified,
                confidence=result.confidence,
            )
    except IntegrityError:
        return AgentProposal.objects.get(session=session, intent=intent, context_hash=context_hash)

    publish_event(
        workspace=session.workspace,
        event_type="AgentProposalCreated",
        aggregate_type="agent_proposal",
        aggregate_ref=proposal.public_id,
        payload={"kind": kind, "tier": proposal.tier, "citation_count": len(verified)},
    )
    return proposal


# --------------------------------------------------------------------------
# Accept / reject — the HUMAN gate.
# --------------------------------------------------------------------------


@transaction.atomic
def accept_proposal(*, context, proposal: AgentProposal, expected_version: int | None = None):
    """`AcceptAgentProposal` — a HUMAN command. Returns `(proposal, result)`.

    Accepting a `draft_reply` does **not** send it. It marks the draft accepted
    and hands the text back for a human to place in the composer; that human
    then invokes the ordinary `SendMessage` path, which enforces its own
    permission, consent and service-window guards. There is no branch here that
    reaches messaging.

    Accepting a `propose`-tier proposal invokes the owning domain's command **as
    this human**, so that domain's guard decides — the agent lends no authority.
    """
    require_version(proposal, expected_version, required=False)
    lock_aggregate(proposal)
    if proposal.is_terminal:
        raise DomainConflict(
            "This proposal has already been resolved.",
            {"reason": "proposal_already_resolved", "status": proposal.status},
        )

    tier = proposal.tier
    result_ref, command_name = "", ""

    if tier == TIER_PROPOSE:
        command_name = ACCEPTABLE_COMMANDS.get(proposal.proposal_kind, "")
        if not command_name:
            # Unreachable through the model's CHECK constraint; refused anyway
            # rather than trusted, because this is the authority boundary.
            raise PermissionDeniedError("That proposal kind cannot be executed.")
        result_ref = _execute_accepted(context=context, proposal=proposal)

    proposal.status = PROPOSAL_ACCEPTED
    proposal.accepted_by = context.membership
    proposal.accepted_at = timezone.now()
    proposal.resulting_command = command_name
    proposal.resulting_ref = result_ref
    bump_version(proposal)
    proposal.save(
        update_fields=[
            "status", "accepted_by", "accepted_at", "resulting_command", "resulting_ref",
            "version", "updated_at",
        ]
    )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="agent.proposal_accepted",
        target_type="agent_proposal",
        target_ref=proposal.public_id,
        changed_fields=["status"],
        metadata={"kind": proposal.proposal_kind, "resulting_command": command_name},
    )
    publish_event(
        workspace=context.workspace,
        event_type="AgentProposalAccepted",
        aggregate_type="agent_proposal",
        aggregate_ref=proposal.public_id,
        payload={"kind": proposal.proposal_kind, "resulting_command": command_name},
    )
    return proposal


def _execute_accepted(*, context, proposal: AgentProposal) -> str:
    """Invoke the owning domain's OWN command, as the human who accepted.

    aiagent(L8) -> crm(L5) is downward and legal. What matters more is that the
    command runs under the human's context: `create_task` resolves `task.manage`
    for THIS member, so accepting cannot obtain an authority the member lacks.
    """
    payload = proposal.payload or {}

    if proposal.proposal_kind == "create_task":
        if not context.has("task.manage"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.crm.services import create_task

        task = create_task(
            context=context,
            title=(payload.get("title") or payload.get("text") or "Follow up")[:200],
        )
        return task.public_id

    if proposal.proposal_kind == "create_contact":
        if not context.has("contact.manage"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.crm.models import Contact

        contact = Contact.objects.create(
            workspace=context.workspace,
            full_name=(payload.get("name") or "Unnamed contact")[:160],
            phone=(payload.get("phone") or "")[:40],
            source="manual",
        )
        return contact.public_id

    raise PermissionDeniedError("That proposal kind cannot be executed.")


@transaction.atomic
def reject_proposal(
    *, context, proposal: AgentProposal, expected_version: int | None = None
) -> AgentProposal:
    require_version(proposal, expected_version, required=False)
    lock_aggregate(proposal)
    if proposal.is_terminal:
        raise DomainConflict(
            "This proposal has already been resolved.",
            {"reason": "proposal_already_resolved", "status": proposal.status},
        )

    proposal.status = PROPOSAL_REJECTED
    bump_version(proposal)
    proposal.save(update_fields=["status", "version", "updated_at"])
    publish_event(
        workspace=context.workspace,
        event_type="AgentProposalRejected",
        aggregate_type="agent_proposal",
        aggregate_ref=proposal.public_id,
        payload={"kind": proposal.proposal_kind},
    )
    return proposal


def authority_tier_for(kind: str) -> str:
    """The ladder, queryable. A kind outside it has no tier and no path."""
    if kind in PROHIBITED_PROPOSAL_KINDS:
        raise PermissionDeniedError("The agent has no authority for that operation.")
    if kind not in PROPOSAL_KIND_TIERS:
        raise ValidationFailed("That proposal kind does not exist.")
    return PROPOSAL_KIND_TIERS[kind]


__all__ = [
    "start_agent_session",
    "close_agent_session",
    "generate_proposal",
    "accept_proposal",
    "reject_proposal",
    "authority_tier_for",
    "ALLOWED_INTENTS",
    "ACCEPTABLE_COMMANDS",
    "PROPOSAL_PENDING",
    "PROPOSAL_ABANDONED",
    "TIER_EXECUTE",
]
