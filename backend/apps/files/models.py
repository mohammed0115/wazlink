"""files (L3) — attachments by subject (B11_DOMAIN_ATTACHMENT_MODEL)."""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel


class FileAsset(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "FILE"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="file_assets"
    )
    filename = models.CharField(max_length=300)
    content_type = models.CharField(max_length=120)
    size_bytes = models.BigIntegerField(default=0)
    storage_key = models.CharField(max_length=500, blank=True)
    uploaded_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="uploaded_files"
    )

    class Meta:
        db_table = "file_assets"


class FileAttachment(TimestampedModel):
    """Polymorphic attachment by (subject_type, subject_id) — no FK to a subject."""

    file_asset = models.ForeignKey(FileAsset, on_delete=models.CASCADE, related_name="attachments")
    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="file_attachments"
    )
    subject_type = models.CharField(max_length=40)
    subject_id = models.UUIDField()

    class Meta:
        db_table = "file_attachments"
        indexes = [models.Index(fields=["workspace", "subject_type", "subject_id"])]
