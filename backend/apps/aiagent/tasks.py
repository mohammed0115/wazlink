"""aiagent Celery tasks. Queue named EXPLICITLY (B14_09 §3)."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="aiagent.generate_agent_proposal", queue="providers.slow", bind=True)
def generate_agent_proposal_task(self, session_id: str, intent: str = "draft_reply"):
    """Identity `(session, intent, context_hash)`; mode re-read at execution.

    Generation is EFFECT-FREE, so abandoning an `unknown` provider outcome is
    safe — a consequence of PD-013 forbidding the agent from sending, not an
    exception to B12-D-A020.
    """
    from .services import generate_proposal

    proposal = generate_proposal(session_id=session_id, intent=intent)
    return {"proposal_ref": getattr(proposal, "public_id", "")}


__all__ = ["generate_agent_proposal_task"]
