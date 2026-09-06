"""aiagent (L8) — the governed agent (`GAP-014`, M24).

**No provider field exists here** (`B14_14` §3): no model name, no token count,
no stop-reason field, no provider error code. Those live behind `AIProviderPort`
and stop there, which is what lets the provider change without a migration.

(`T-AI-5` greps these packages for provider identifiers, so this file names none
even in prose — a column name that appears in a docstring is a column name one
edit away from existing.)

The authority ladder is a DOMAIN concept, enforced in this module above the
port (`B14_14` §7). It is expressed as data below so it can be asserted rather
than reviewed:

| Tier | What it means |
|---|---|
| `execute` | the agent may do this itself — retrieve, summarize, DRAFT |
| `propose` | the agent may offer it; a HUMAN accepts, and the owning domain's
              own command then runs as that human |
| `recommend` | rendered only; nothing acts on it |

**Sending a customer-facing message is in NO tier.** There is no
`AgentSendMessage` command, no proposal kind that maps to a send, and no
confidence value that promotes a proposal into an action. The agent also holds
NO permissions of its own: accepting a proposal invokes the owning domain's
ordinary command as the accepting human, checked by that domain's own guard.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

# --- The authority ladder, as data -----------------------------------------

TIER_EXECUTE = "execute"
TIER_PROPOSE = "propose"
TIER_RECOMMEND = "recommend"

# Proposal kinds and the tier each sits in. A kind absent from this map cannot
# be created — there is no "other" bucket to grow a send into.
PROPOSAL_KIND_TIERS: dict[str, str] = {
    # MAY EXECUTE — the agent produces these itself. A draft is TEXT: it is
    # placed in a composer and a human sends it, or it is discarded.
    "draft_reply": TIER_EXECUTE,
    "conversation_summary": TIER_EXECUTE,
    "knowledge_answer": TIER_EXECUTE,
    # MAY PROPOSE — typed, human-confirmable, executed by the owning domain.
    "create_task": TIER_PROPOSE,
    "create_contact": TIER_PROPOSE,
    # MAY RECOMMEND — rendered only.
    "next_action": TIER_RECOMMEND,
}
PROPOSAL_KINDS = tuple(PROPOSAL_KIND_TIERS)

# Named explicitly so the prohibition is testable rather than merely absent.
# Nothing in this module may create a proposal of these kinds, and no command
# exists that would execute one.
PROHIBITED_PROPOSAL_KINDS = (
    "send_message",
    "send_whatsapp",
    "send_template",
    "recognize_revenue",
    "change_billing",
    "change_permissions",
    "merge_identities",
)

SESSION_OPEN = "open"
SESSION_CLOSED = "closed"

PROPOSAL_PENDING = "pending"
PROPOSAL_ACCEPTED = "accepted"
PROPOSAL_REJECTED = "rejected"
PROPOSAL_ABANDONED = "abandoned"
PROPOSAL_TERMINAL = (PROPOSAL_ACCEPTED, PROPOSAL_REJECTED, PROPOSAL_ABANDONED)


class AgentSession(PublicIdModel, TimestampedModel, VersionedModel):
    """One assistance session, scoped to one conversation."""

    PUBLIC_ID_PREFIX = "AGS"

    STATUS_CHOICES = [(SESSION_OPEN, SESSION_OPEN), (SESSION_CLOSED, SESSION_CLOSED)]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="agent_sessions"
    )
    # String reference — no cross-app model import (T-ARCH-3).
    conversation = models.ForeignKey(
        "messaging.Conversation", on_delete=models.CASCADE, related_name="agent_sessions"
    )
    opened_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="agent_sessions"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=SESSION_OPEN)

    class Meta:
        db_table = "agent_sessions"
        constraints = [
            models.UniqueConstraint(
                fields=["conversation"],
                condition=Q(status=SESSION_OPEN),
                name="uq_agent_session_open",
            ),
        ]


class AgentProposal(PublicIdModel, TimestampedModel, VersionedModel):
    """Something the agent offers. Nothing here has taken effect.

    A proposal is inert by construction: `payload` is typed content, and the
    only thing that can act on it is `accept_proposal`, which runs the owning
    domain's command as the accepting human.
    """

    PUBLIC_ID_PREFIX = "AGP"

    KIND_CHOICES = [(k, k) for k in PROPOSAL_KINDS]
    STATUS_CHOICES = [
        (s, s) for s in (PROPOSAL_PENDING, PROPOSAL_ACCEPTED, PROPOSAL_REJECTED, PROPOSAL_ABANDONED)
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="agent_proposals"
    )
    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name="proposals")
    proposal_kind = models.CharField(max_length=40, choices=KIND_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PROPOSAL_PENDING)
    payload = models.JSONField(default=dict)
    # Which PUBLISHED articles grounded this, with the version each was read at.
    citations = models.JSONField(default=list)
    confidence = models.FloatField(null=True, blank=True)

    # The idempotency identity: (session, intent, context_hash). A redelivered
    # generation converges on this row rather than opening a second proposal.
    intent = models.CharField(max_length=40)
    context_hash = models.CharField(max_length=64, db_index=True)

    # Set ONLY by a human accepting. `resulting_command` names the owning
    # domain's command that then ran — evidence that the agent did not act.
    accepted_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="accepted_proposals",
    )
    accepted_at = models.DateTimeField(null=True, blank=True)
    resulting_command = models.CharField(max_length=60, blank=True)
    resulting_ref = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "agent_proposals"
        indexes = [models.Index(fields=["workspace", "status", "-created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "intent", "context_hash"], name="uq_agent_proposal_identity"
            ),
            # Structural, not merely conventional: a proposal kind outside the
            # ladder cannot be stored, so a send-shaped proposal has nowhere to
            # exist even if some future code path tried to create one.
            models.CheckConstraint(
                condition=Q(proposal_kind__in=PROPOSAL_KINDS), name="ck_agent_proposal_kind"
            ),
        ]

    @property
    def tier(self) -> str:
        return PROPOSAL_KIND_TIERS.get(self.proposal_kind, TIER_RECOMMEND)

    @property
    def is_terminal(self) -> bool:
        return self.status in PROPOSAL_TERMINAL
