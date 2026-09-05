"""imports (L8) — CSV import foundation (GAP-008).

imports invokes OWNING-DOMAIN COMMANDS, never target tables (B14_03 §6 rule 7).
Row-level outcomes: there is NO transaction-wide rollback requirement — a row
that fails is recorded and surfaced; committed rows stand.
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel, VersionedModel

TARGET_KINDS = ("lead", "customer", "contact")


class ImportBatch(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "IMP"

    STATUS_CHOICES = [
        ("created", "created"),
        ("mapped", "mapped"),
        ("dry_run", "dry_run"),
        ("committing", "committing"),
        ("completed", "completed"),
        ("failed", "failed"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="import_batches"
    )
    target_kind = models.CharField(max_length=20, choices=[(t, t) for t in TARGET_KINDS])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="created")
    mapping = models.JSONField(default=dict)
    source_file = models.ForeignKey(
        "files.FileAsset",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="import_batches",
    )
    raw_csv = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="import_batches"
    )
    committed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "import_batches"


class ImportRow(TimestampedModel):
    """Per-row identity is (batch_id, row_number) — the idempotency key.

    An `unknown` outcome is recorded and surfaced to a human, NEVER
    re-executed automatically (B12-D-A020).
    """

    OUTCOME_CHOICES = [
        ("pending", "pending"),
        ("created", "created"),
        ("skipped", "skipped"),
        ("failed", "failed"),
        ("unknown", "unknown"),
    ]

    batch = models.ForeignKey(ImportBatch, on_delete=models.CASCADE, related_name="rows")
    row_number = models.PositiveIntegerField()
    raw = models.JSONField(default=dict)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default="pending")
    error_message = models.CharField(max_length=400, blank=True)
    created_ref = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "import_rows"
        constraints = [
            models.UniqueConstraint(fields=["batch", "row_number"], name="uq_import_row"),
        ]
