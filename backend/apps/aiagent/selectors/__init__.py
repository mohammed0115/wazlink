"""aiagent read models."""

from __future__ import annotations

from ..models import AgentProposal, AgentSession


def sessions_for(workspace):
    return AgentSession.objects.filter(workspace=workspace).select_related("conversation")


def proposals_for(workspace):
    return AgentProposal.objects.filter(workspace=workspace).select_related("session", "accepted_by")


def proposal_payload(proposal: AgentProposal) -> dict:
    """The proposal DTO.

    It carries the drafted TEXT and its citations, and nothing that could be
    mistaken for an action: no channel, no recipient, no send flag. `tier` is
    rendered so a client can show what a human is being asked to do.
    """
    return {
        "proposal_ref": proposal.public_id,
        "session_ref": proposal.session.public_id,
        "kind": proposal.proposal_kind,
        "tier": proposal.tier,
        "status": proposal.status,
        "text": (proposal.payload or {}).get("text", ""),
        "citations": proposal.citations,
        "confidence": proposal.confidence,
        "accepted_by_ref": proposal.accepted_by.public_id if proposal.accepted_by_id else None,
        "resulting_command": proposal.resulting_command or None,
        "resulting_ref": proposal.resulting_ref or None,
        "version": proposal.version,
    }


def session_payload(session: AgentSession) -> dict:
    return {
        "session_ref": session.public_id,
        "conversation_ref": session.conversation.public_id,
        "status": session.status,
        "version": session.version,
    }


__all__ = ["sessions_for", "proposals_for", "proposal_payload", "session_payload"]
