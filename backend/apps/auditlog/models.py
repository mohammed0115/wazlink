"""auditlog (L3) — the append-only audit trail."""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel


class AuditLog(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "AUD"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="audit_logs"
    )
    actor_membership = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="audit_rows",
    )
    actor_user = models.ForeignKey(
        "accounts.User", on_delete=models.RESTRICT, null=True, blank=True, related_name="audit_rows"
    )
    action = models.CharField(max_length=100, db_index=True)
    target_type = models.CharField(max_length=60)
    target_ref = models.CharField(max_length=60, blank=True)
    # FIELD NAMES only — never values.
    changed_fields = models.JSONField(default=list)
    metadata = models.JSONField(default=dict)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["workspace", "-created_at"])]
