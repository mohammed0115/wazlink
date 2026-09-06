"""platform_async (L3) — the B12 async substrate.

This module holds NO domain command implementation. Cross-layer invocation is
by REGISTERED NAME through common/dispatch.py (B14_03 §6 rule 13).
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel


class OutboxEvent(PublicIdModel, TimestampedModel):
    """Written in the SAME transaction as the domain change it describes."""

    PUBLIC_ID_PREFIX = "OBX"

    STATUS_CHOICES = [
        ("pending", "pending"),
        ("dispatched", "dispatched"),
        ("failed", "failed"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="outbox_events"
    )
    event_type = models.CharField(max_length=100, db_index=True)
    aggregate_type = models.CharField(max_length=60)
    aggregate_ref = models.CharField(max_length=60)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    attempts = models.PositiveIntegerField(default=0)
    correlation_id = models.CharField(max_length=64, blank=True)
    causation_id = models.CharField(max_length=64, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "outbox_events"
        ordering = ["created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]


class WorkerExecution(TimestampedModel):
    """Worker execution record.

    Deliberately carries NO lease and NO fencing column: a heartbeat-stale
    running row is classified UNKNOWN by reconciliation and is operator-gated,
    never auto-re-executed (B12-D-A020).
    """

    STATUS_CHOICES = [
        ("running", "running"),
        ("succeeded", "succeeded"),
        ("failed", "failed"),
        ("unknown", "unknown"),
    ]

    task_name = models.CharField(max_length=120)
    queue = models.CharField(max_length=40)
    idempotency_key = models.CharField(max_length=200, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="running")
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    detail = models.JSONField(default=dict)

    class Meta:
        db_table = "worker_executions"


class ProviderRequestAttempt(TimestampedModel):
    provider = models.CharField(max_length=40)
    operation = models.CharField(max_length=80)
    outcome = models.CharField(max_length=30, default="pending")
    status_code = models.IntegerField(null=True, blank=True)
    detail = models.JSONField(default=dict)

    class Meta:
        db_table = "provider_request_attempts"


class WebhookReceipt(TimestampedModel):
    """The FIRST of frozen B5's two independent duplicate defences.

    `(provider, external_id)` is UNIQUE, so a redelivered callback resolves to
    the existing receipt rather than opening a second one — decided by the
    database, not by an `if exists()` that a concurrent delivery could slip
    between. The constraint is partial because a payload carrying no provider
    identity has nothing to dedup on; such a receipt is recorded and never
    claimed to be new.
    """

    STATUS_CHOICES = [
        ("queued", "queued"),
        ("processed", "processed"),
        ("rejected", "rejected"),
    ]

    provider = models.CharField(max_length=40)
    signature_verified = models.BooleanField(default=False)
    external_id = models.CharField(max_length=200, blank=True, db_index=True)
    payload_digest = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")

    class Meta:
        db_table = "webhook_receipts"
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "external_id"],
                condition=~Q(external_id=""),
                name="uq_webhook_receipt_identity",
            ),
        ]


class IntegrationConnection(TimestampedModel):
    """An operator-facing integration connection.

    Absent credentials are represented safely as not_configured. No fake
    production credential is ever invented.
    """

    STATUS_CHOICES = [
        ("not_connected", "not_connected"),
        ("not_configured", "not_configured"),
        ("configured", "configured"),
        ("enabled", "enabled"),
        ("disabled", "disabled"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace",
        on_delete=models.RESTRICT,
        related_name="integrations",
        null=True,
        blank=True,
    )
    provider = models.CharField(max_length=40)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default="not_connected")
    # REFERENCE NAMES only. Never a credential value.
    credential_refs = models.JSONField(default=list)
    configuration_valid = models.BooleanField(default=False)

    class Meta:
        db_table = "integration_connections"


class IntegrationHealthSnapshot(TimestampedModel):
    connection = models.ForeignKey(
        IntegrationConnection, on_delete=models.CASCADE, related_name="health_snapshots"
    )
    healthy = models.BooleanField(default=False)
    detail = models.JSONField(default=dict)

    class Meta:
        db_table = "integration_health_snapshots"


class PlatformDeadLetter(TimestampedModel):
    """A dead letter carries a command NAME and a REFERENCE payload
    (FI-B12-05) — never an embedded copy of domain state."""

    STATUS_CHOICES = [
        ("dead", "dead"),
        ("replayed", "replayed"),
        ("abandoned", "abandoned"),
    ]

    command_name = models.CharField(max_length=120)
    reference_payload = models.JSONField(default=dict)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="dead")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "platform_dead_letters"


class PlatformReconciliationCase(TimestampedModel):
    STATUS_CHOICES = [("open", "open"), ("resolved", "resolved")]

    case_class = models.CharField(max_length=20)
    subject_ref = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    detail = models.JSONField(default=dict)

    class Meta:
        db_table = "platform_reconciliation_cases"
