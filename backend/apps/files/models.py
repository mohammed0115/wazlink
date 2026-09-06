"""files (L3) — the SINGLE storage authority (B11; M05, extended at I11).

`T-FILE-1`: there is no second file table anywhere in WazLink. Every domain
that needs a byte stream attaches to a `FileAsset`; none of them stores one.

Three properties are structural, not procedural:

*   **The storage key contains no client input.** Its shape is
    `<env>/w/<workspace_uuid>/<yyyy>/<mm>/<file_uuid>` — every variable segment
    is a server-generated UUID or a zero-padded integer. There is no user
    string to sanitize, so there is no sanitizer to get wrong, and traversal is
    unreachable rather than filtered (`B11_STORAGE_KEY_MODEL` §2).
*   **Tenancy is decided by AUTHORIZATION, never by parsing that key.** The
    `w/<workspace_uuid>/` prefix exists so an operational mistake is
    *contained*, not so a correct decision is *made* (§4).
*   **Three content-type columns, never collapsed.** What the client claimed,
    what the server detected, and the canonical presentation value are
    different facts with different authority (`B11-D-A010`).
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel

# The frozen five. No sixth is insertable.
LIFECYCLE_PENDING = "pending"
LIFECYCLE_AVAILABLE = "available"
LIFECYCLE_QUARANTINED = "quarantined"
LIFECYCLE_FAILED = "failed"
LIFECYCLE_ARCHIVED = "archived"
LIFECYCLE_STATES = (
    LIFECYCLE_PENDING,
    LIFECYCLE_AVAILABLE,
    LIFECYCLE_QUARANTINED,
    LIFECYCLE_FAILED,
    LIFECYCLE_ARCHIVED,
)

STORAGE_OBJECT_STATES = ("unwritten", "present", "purge_pending", "purged", "purge_failed")

# `private` is the ONLY Phase-1 value. There is no public or signed-URL path.
ACCESS_CLASSES = ("private",)
# `legal` files are undeletable (`B11_DELETION_RETENTION_MODEL`).
RETENTION_CLASSES = ("product", "legal")

# `CA-10` — extended by the group that first uses each value.
SUBJECT_TYPES = (
    "message_media",
    "tax_document_artifact",
    "customer",
    "ticket",
    "kb_article",
    "import_batch",
    "lead",
)

ATTACHMENT_STATES = ("active", "detached")


class FileAsset(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "FILE"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="file_assets"
    )
    lifecycle_state = models.CharField(max_length=20, default=LIFECYCLE_PENDING)
    storage_object_state = models.CharField(max_length=20, default="unwritten")
    storage_key = models.CharField(max_length=500, blank=True)

    # Display data. Stored verbatim after normalization, used for NOTHING else.
    original_filename = models.CharField(max_length=300, default="")
    safe_display_filename = models.CharField(max_length=300, blank=True)
    # Kept for the Wave 1 shape; mirrors `original_filename`.
    filename = models.CharField(max_length=300, default="")

    # --- the three content-type columns, deliberately distinct -------------
    # What the client CLAIMED. Evidence only, never authority.
    declared_content_type = models.CharField(max_length=120, blank=True)
    # What the SERVER FOUND. Null until finalize, because no bytes exist before.
    detected_content_type = models.CharField(max_length=120, blank=True, null=True)
    # The CANONICAL presentation value. Never null: at `pending` it holds the
    # allow-list member the declared value matched — a closed server-controlled
    # vocabulary, not client input — and finalize overwrites it with the
    # detected type.
    content_type = models.CharField(max_length=120, default="")

    size_bytes = models.BigIntegerField(null=True, blank=True)
    checksum = models.CharField(max_length=64, blank=True, null=True)
    access_class = models.CharField(max_length=20, default="private")
    retention_class = models.CharField(max_length=20, default="product")

    uploaded_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        related_name="uploaded_files",
        null=True,
        blank=True,
    )
    upload_expires_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.CharField(max_length=60, blank=True)
    # Operator-only. NEVER in a client response.
    failure_detail = models.TextField(blank=True)
    quarantine_reason = models.CharField(max_length=200, blank=True)
    deletion_reason = models.CharField(max_length=200, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "file_assets"
        indexes = [
            models.Index(fields=["workspace", "lifecycle_state"]),
            models.Index(fields=["lifecycle_state", "upload_expires_at"]),
            models.Index(fields=["workspace", "archived_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "storage_key"],
                condition=~Q(storage_key=""),
                name="uq_file_asset_storage_key",
            ),
            models.CheckConstraint(
                condition=Q(lifecycle_state__in=LIFECYCLE_STATES), name="ck_file_lifecycle"
            ),
            models.CheckConstraint(
                condition=Q(storage_object_state__in=STORAGE_OBJECT_STATES),
                name="ck_file_storage_object_state",
            ),
            models.CheckConstraint(condition=Q(access_class__in=ACCESS_CLASSES), name="ck_file_access"),
            models.CheckConstraint(
                condition=Q(retention_class__in=RETENTION_CLASSES), name="ck_file_retention"
            ),
            # An `available` file is STRUCTURALLY incapable of lacking its
            # verification data. The check names `detected_content_type`, not
            # `content_type`: the latter is non-null from insert, so asserting
            # it here would prove nothing — what must be true is that a server
            # detection actually happened.
            models.CheckConstraint(
                condition=~Q(lifecycle_state=LIFECYCLE_AVAILABLE)
                | (
                    Q(checksum__isnull=False)
                    & Q(size_bytes__isnull=False)
                    & Q(detected_content_type__isnull=False)
                ),
                name="ck_file_available_is_verified",
            ),
        ]


class FileAttachment(TimestampedModel):
    """Polymorphic link by `(subject_type, subject_id)` — no FK to a subject.

    A `detached` row is NEVER deleted: it is the durable proof that lets the
    orphan sweep distinguish "never attached" from "attached once and released".
    """

    file_asset = models.ForeignKey(FileAsset, on_delete=models.RESTRICT, related_name="attachments")
    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="file_attachments"
    )
    subject_type = models.CharField(max_length=40, default="")
    subject_id = models.UUIDField()
    subject_ref = models.CharField(max_length=60, blank=True)
    state = models.CharField(max_length=20, default="active")
    attached_by = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        related_name="file_attachments",
        null=True,
        blank=True,
    )
    detached_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "file_attachments"
        indexes = [
            models.Index(fields=["workspace", "subject_type", "subject_id"]),
            models.Index(fields=["file_asset"]),
        ]
        constraints = [
            # A duplicate ACTIVE link is impossible, which turns a repeated
            # attach into an idempotent replay rather than a second row.
            models.UniqueConstraint(
                fields=["file_asset", "subject_type", "subject_id"],
                condition=Q(state="active"),
                name="uq_file_attachment_active",
            ),
            models.CheckConstraint(
                condition=Q(subject_type__in=SUBJECT_TYPES), name="ck_file_attachment_subject"
            ),
            models.CheckConstraint(
                condition=Q(state__in=ATTACHMENT_STATES), name="ck_file_attachment_state"
            ),
        ]


class WorkspaceStorageUsage(TimestampedModel):
    """One lazily-created row per workspace. Absent reads as ZERO, never as
    unlimited — the same fail-closed rule the entitlement counters follow."""

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="storage_usage", primary_key=True
    )
    logical_bytes = models.BigIntegerField(default=0)
    in_flight_bytes = models.BigIntegerField(default=0)

    class Meta:
        db_table = "workspace_storage_usage"
        constraints = [
            models.CheckConstraint(
                condition=Q(logical_bytes__gte=0) & Q(in_flight_bytes__gte=0),
                name="ck_storage_usage_non_negative",
            ),
        ]
