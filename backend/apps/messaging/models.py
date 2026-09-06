"""messaging (L6) — B5 conversations and WhatsApp (M16, M17, M23-adjacent).

Three invariants shape these tables, and each is enforced by PostgreSQL rather
than by application care:

*   **A provider message is ingested at most once.** `messages` is unique on
    `(workspace, provider_message_id)`, so a redelivered webhook cannot become
    a second Message even if two deliveries race. This is the SECOND of frozen
    B5's two independent defences; the first is the webhook receipt.
*   **A delivery status is applied at most once, monotonically.**
    `message_deliveries` is unique on `(message, status)`, and status only ever
    advances — an out-of-order `read` before `delivered` infers `delivered`
    first rather than regressing (`AT-STATE-6`).
*   **`handling_mode` defaults to `'human'`** (`CA-02`, M17), which reproduces
    today's behaviour for every existing row and means AI assistance is
    something a human opts into, never a default they must discover and
    disable.

**There is exactly ONE send path and its actor is a human** (`PD-013`,
`B5-D-A021`). No column here records an AI sender, and no state admits one.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

# Frozen: enum(2). CA-02 does NOT widen it — the state machine's fan-out is
# unchanged, and handling mode is a separate, orthogonal column.
CONVERSATION_OPEN = "open"
CONVERSATION_CLOSED = "closed"

# CA-02 handling mode. `ai_assisted` means the AI may DRAFT; it never means the
# AI may send. `ai_paused` is what a human takeover sets.
MODE_HUMAN = "human"
MODE_AI_ASSISTED = "ai_assisted"
MODE_AI_PAUSED = "ai_paused"
HANDLING_MODES = (MODE_AI_ASSISTED, MODE_HUMAN, MODE_AI_PAUSED)

IDENTITY_RESOLVED = "resolved"
IDENTITY_UNRESOLVED = "unresolved"
IDENTITY_AMBIGUOUS = "ambiguous"

DIRECTION_INBOUND = "inbound"
DIRECTION_OUTBOUND = "outbound"

# Frozen B5 message lifecycle. `unknown` is terminal and NEVER resent.
MESSAGE_QUEUED = "queued"
MESSAGE_SENT = "sent"
MESSAGE_DELIVERED = "delivered"
MESSAGE_READ = "read"
MESSAGE_FAILED = "failed"
MESSAGE_RECEIVED = "received"
MESSAGE_UNKNOWN = "unknown"

# Monotonic rank. A status may only ever move UP this ladder.
STATUS_RANK = {
    MESSAGE_QUEUED: 0,
    MESSAGE_SENT: 1,
    MESSAGE_DELIVERED: 2,
    MESSAGE_READ: 3,
}

# The customer service window (B5_CUSTOMER_SERVICE_WINDOW). Outside it, only an
# approved template may be sent — a provider rule frozen B5 already encodes.
SERVICE_WINDOW_HOURS = 24


class Conversation(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "CONV"

    STATUS_CHOICES = [(CONVERSATION_OPEN, CONVERSATION_OPEN), (CONVERSATION_CLOSED, CONVERSATION_CLOSED)]
    MODE_CHOICES = [(m, m) for m in HANDLING_MODES]
    IDENTITY_CHOICES = [
        (IDENTITY_RESOLVED, IDENTITY_RESOLVED),
        (IDENTITY_UNRESOLVED, IDENTITY_UNRESOLVED),
        (IDENTITY_AMBIGUOUS, IDENTITY_AMBIGUOUS),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="conversations"
    )
    channel = models.CharField(max_length=30, default="whatsapp")
    # The counterparty's normalized address. Unique per workspace and channel:
    # one ongoing conversation per person, not one per inbound burst.
    peer_address = models.CharField(max_length=64)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=CONVERSATION_OPEN)

    # CA-02, M17. Default 'human' reproduces prior behaviour for every row.
    handling_mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_HUMAN)
    takeover_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="conversation_takeovers",
    )
    takeover_at = models.DateTimeField(null=True, blank=True)

    # Identity resolution (B5 §3). An unresolved conversation is opened UNLINKED
    # and creates NO Lead and NO Customer — a human decides who this is.
    identity_state = models.CharField(max_length=20, choices=IDENTITY_CHOICES, default=IDENTITY_UNRESOLVED)
    contact = models.ForeignKey(
        "crm.Contact", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )
    lead = models.ForeignKey(
        "crm.Lead", on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations"
    )

    assigned_to = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="assigned_conversations",
    )
    last_message_at = models.DateTimeField(null=True, blank=True)
    # When the counterparty last wrote. The service window is measured from
    # HERE — from their message, never from ours.
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    unread_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "conversations"
        indexes = [
            models.Index(fields=["workspace", "status", "-last_message_at"]),
            models.Index(fields=["workspace", "assigned_to"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "channel", "peer_address"], name="uq_conversation_peer"
            ),
            models.CheckConstraint(
                condition=Q(handling_mode__in=HANDLING_MODES), name="ck_conversation_handling_mode"
            ),
        ]

    def within_service_window(self, now) -> bool:
        """Frozen B5. Free-form text is only permitted inside this window."""
        from datetime import timedelta

        if self.last_inbound_at is None:
            return False
        return now - self.last_inbound_at <= timedelta(hours=SERVICE_WINDOW_HOURS)


class Participant(TimestampedModel):
    """Who is in a conversation. A membership participant is an agent; an
    address participant is the counterparty."""

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participants")
    membership = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="conversation_participations",
    )
    address = models.CharField(max_length=64, blank=True)
    display_name = models.CharField(max_length=120, blank=True)
    role = models.CharField(max_length=20, default="peer")

    class Meta:
        db_table = "participants"
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "address"],
                condition=~Q(address=""),
                name="uq_participant_address",
            ),
        ]


class Message(PublicIdModel, TimestampedModel, VersionedModel):
    """One message. `(workspace, provider_message_id)` is UNIQUE.

    That constraint is the durable at-most-once guarantee for inbound ingestion
    AND the reason an outbound send can be reconciled: the provider's own id is
    the identity, so a redelivered callback has nowhere to insert a duplicate.
    """

    PUBLIC_ID_PREFIX = "MSG"

    DIRECTION_CHOICES = [(DIRECTION_INBOUND, DIRECTION_INBOUND), (DIRECTION_OUTBOUND, DIRECTION_OUTBOUND)]
    STATUS_CHOICES = [
        (s, s)
        for s in (
            MESSAGE_QUEUED,
            MESSAGE_SENT,
            MESSAGE_DELIVERED,
            MESSAGE_READ,
            MESSAGE_FAILED,
            MESSAGE_RECEIVED,
            MESSAGE_UNKNOWN,
        )
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="messages"
    )
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=MESSAGE_QUEUED)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=30, default="text")
    template_name = models.CharField(max_length=120, blank=True)

    # The HUMAN who sent it. Outbound messages always have one: there is no
    # system sender and no agent sender (PD-013).
    sent_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="sent_messages",
    )
    # Frozen AT-B4-2: an AI-drafted message is still sent BY the human. This
    # flag records that assistance was used; it never changes who sent it.
    ai_assisted = models.BooleanField(default=False)

    provider_message_id = models.CharField(max_length=200, blank=True, db_index=True)
    failure_code = models.CharField(max_length=60, blank=True)
    occurred_at = models.DateTimeField(null=True, blank=True)

    # The DURABLE send claim. It is a separate column rather than a new status
    # because the frozen B5 message vocabulary is not ours to widen.
    #
    # It has to be durable: the provider call cannot happen inside the claiming
    # transaction, so the row lock is released before the call. Without this
    # column two workers both read `queued` and BOTH send — and a duplicate
    # WhatsApp message reaches a real customer, which is precisely the harm
    # B12-D-A020 exists to prevent and which no compensation can undo.
    #
    # A claim left behind by a dead worker is NEVER auto-released: the message
    # may already have been delivered. It becomes a `P-3` case for a human.
    send_claimed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "messages"
        indexes = [models.Index(fields=["conversation", "-created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "provider_message_id"],
                condition=~Q(provider_message_id=""),
                name="uq_message_provider_identity",
            ),
        ]


class MessageDelivery(TimestampedModel):
    """One applied status transition. `(message, status)` is UNIQUE.

    The uniqueness is the second duplicate defence: even if the receipt layer
    is bypassed, applying `delivered` twice inserts once.
    """

    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="deliveries")
    status = models.CharField(max_length=20)
    provider_timestamp = models.DateTimeField(null=True, blank=True)
    error_class = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "message_deliveries"
        constraints = [
            models.UniqueConstraint(fields=["message", "status"], name="uq_message_delivery"),
        ]


class Template(PublicIdModel, TimestampedModel):
    """An approved provider template — the ONLY thing sendable outside the
    customer service window (frozen B5, confirmed against the provider's own
    documentation in `B14_15` §1)."""

    PUBLIC_ID_PREFIX = "TPL"

    STATUS_CHOICES = [("draft", "draft"), ("approved", "approved"), ("rejected", "rejected")]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="message_templates"
    )
    name = models.CharField(max_length=120)
    language = models.CharField(max_length=10, default="en")
    body = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    class Meta:
        db_table = "templates"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "name", "language"], name="uq_template_identity"
            ),
        ]
