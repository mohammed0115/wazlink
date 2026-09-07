"""files commands (B11) — the ten ordered validation gates, in order.

`G1`-`G4` reject cheaply, before bandwidth is spent. **None of them is a
security control**: every security-relevant decision is `G5`-`G10`, and all of
those run against MEASURED bytes. An attacker who lies at `G1`-`G4` gains
nothing but a later rejection.

The allow-list is CLOSED, so an unlisted type is denied by default with no
blocklist to maintain. `image/svg+xml`, `text/html` and every XML/script type
are excluded as a class: an SVG served same-origin is a stored-XSS primitive,
and excluding it is cheaper and more certain than sanitizing it.
"""

from __future__ import annotations

import hashlib
import secrets
import unicodedata
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.errors import DomainConflict, EntityNotFound, QuotaExhausted, ValidationFailed
from common.ports import ports
from common.provider_ports import providers

from ..models import (
    LIFECYCLE_AVAILABLE,
    LIFECYCLE_FAILED,
    LIFECYCLE_PENDING,
    SUBJECT_TYPES,
    FileAsset,
    FileAttachment,
    WorkspaceStorageUsage,
)

# `B11_FILE_VALIDATION` §6 — narrow, per-family, evidence-seeded.
ALLOWED_CONTENT_TYPES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
        "audio/ogg",
        "audio/mpeg",
        "video/mp4",
    }
)
# Never allowed at any tier, excluded as a CLASS rather than enumerated.
ACTIVE_CONTENT_TYPES = frozenset(
    {"text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml"}
)

# Types that mean the same thing. A substitution inside a group is accepted.
EQUIVALENCE_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({"text/csv", "text/plain"}),
    frozenset({"application/zip", "application/x-zip-compressed"}),
    frozenset({"audio/mpeg", "audio/mp3"}),
)

MAX_FILE_BYTES = 25 * 1024 * 1024  # deployment configuration, not architecture
WORKSPACE_STORAGE_CEILING_BYTES = 5 * 1024 * 1024 * 1024
UPLOAD_INTENT_TTL_MINUTES = 30
DOWNLOAD_TICKET_TTL_SECONDS = 120

# Content sniffing by magic number. Deliberately small and explicit: a library
# would be a dependency, and B14_34 keeps adapters stdlib-only.
_MAGIC: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"%PDF-", "application/pdf"),
    (b"OggS", "audio/ogg"),
    (b"ID3", "audio/mpeg"),
    (b"\xff\xfb", "audio/mpeg"),
)

# Single-use download tickets, held behind `SingleUseTokenPort` with a durable
# re-authorization on redemption. The ticket is NOT a capability: redeeming it
# re-runs the whole authorization chain, so a leaked ticket grants nothing on
# its own.
#
# The store is a PORT rather than a module-level dict because a dict is
# process-local: a ticket issued by one Gunicorn worker could not be redeemed
# by another, and every ticket outstanding at a restart became unredeemable.
# That failed closed — the holder saw a 404 rather than a leak — but it broke
# legitimate downloads in any deployment with more than one worker.
#
# It is not a B11 table either, and that is contract, not preference:
# `B11_STORAGE_MODEL` states that no B11 table, column or JSONB key holds a
# download ticket, and `B11_DOMAIN_MODEL` classes a ticket as a short-lived
# access capability rather than a business record.


# --------------------------------------------------------------------------
# Filename normalization (B11-D-A011)
# --------------------------------------------------------------------------
_STRIPPED = {*range(0x00, 0x20), 0x7F, 0x2028, 0x2029, *range(0x202A, 0x202F), *range(0x2066, 0x206A)}


def normalize_filename(raw: str) -> str:
    """NFC, control- and bidi-stripped, path separators REJECTED not stripped.

    Bidi overrides are stripped rather than banned because WazLink is
    Arabic-first: banning RTL text would break genuine filenames, while
    stripping the override characters removes the `report.<RLO>gpj.exe`
    display attack and leaves Arabic working.
    """
    text = unicodedata.normalize("NFC", raw or "")
    text = "".join(ch for ch in text if ord(ch) not in _STRIPPED).strip()
    if not text:
        raise ValidationFailed("A filename is required.")
    # A filename containing a path separator has no legitimate reading.
    if "/" in text or "\\" in text or text in (".", ".."):
        raise ValidationFailed("That filename is not acceptable.")
    if len(text.encode("utf-8")) > 255:
        raise ValidationFailed("That filename is too long.")
    return text


def safe_display_name(normalized: str) -> str:
    ascii_form = unicodedata.normalize("NFKD", normalized).encode("ascii", "ignore").decode("ascii")
    cleaned = "".join(ch for ch in ascii_form if ch.isalnum() or ch in "._- ").strip()
    return cleaned or "download"


# --------------------------------------------------------------------------
# Storage key — a pure function of server-generated values
# --------------------------------------------------------------------------
def build_storage_key(*, workspace, file_id, created_at) -> str:
    env = getattr(settings, "ENVIRONMENT", "local")
    # NO extension: appending `.pdf` would reintroduce extension-derived
    # content typing at the storage layer, which the application layer spends
    # its length removing.
    return f"{env}/w/{workspace.id}/{created_at:%Y}/{created_at:%m}/{file_id}"


# --------------------------------------------------------------------------
# G1-G4 — RequestUpload
# --------------------------------------------------------------------------
@transaction.atomic
def request_upload(
    *, context, filename: str, content_type: str, declared_size: int | None = None,
    retention_class: str = "product",
) -> FileAsset:
    name = normalize_filename(filename)  # G1

    declared = (content_type or "").strip().lower()
    if declared in ACTIVE_CONTENT_TYPES or declared not in ALLOWED_CONTENT_TYPES:  # G2
        raise ValidationFailed("That file type is not allowed.")

    if declared_size is not None and int(declared_size) > MAX_FILE_BYTES:  # G3
        raise ValidationFailed("That file is too large.")

    usage = _usage_row(context.workspace)  # G4 — provisional headroom
    provisional = int(declared_size or 0)
    if usage.logical_bytes + usage.in_flight_bytes + provisional > WORKSPACE_STORAGE_CEILING_BYTES:
        raise QuotaExhausted("This workspace has no storage headroom.")

    asset = FileAsset.objects.create(
        workspace=context.workspace,
        lifecycle_state=LIFECYCLE_PENDING,
        storage_object_state="unwritten",
        original_filename=name,
        filename=name,
        safe_display_filename=safe_display_name(name),
        declared_content_type=declared,
        # The allow-list MEMBER the declared value matched — not the raw string.
        content_type=declared,
        detected_content_type=None,
        access_class="private",
        retention_class=retention_class if retention_class in ("product", "legal") else "product",
        uploaded_by=context.membership,
        upload_expires_at=timezone.now() + timedelta(minutes=UPLOAD_INTENT_TTL_MINUTES),
    )
    asset.storage_key = build_storage_key(
        workspace=context.workspace, file_id=asset.id, created_at=asset.created_at
    )
    asset.save(update_fields=["storage_key", "updated_at"])

    WorkspaceStorageUsage.objects.filter(pk=usage.pk).update(
        in_flight_bytes=usage.in_flight_bytes + provisional
    )
    return asset


# --------------------------------------------------------------------------
# G5-G10 — UploadFileContent + FinalizeUpload
# --------------------------------------------------------------------------
def detect_content_type(content: bytes) -> str:
    for magic, media_type in _MAGIC:
        if content.startswith(magic):
            return media_type
    if content[4:12] == b"ftypmp42" or content[4:8] == b"ftyp":
        return "video/mp4"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    # Inconclusive. An unidentifiable binary is not stored on anyone's say-so.
    return "application/octet-stream"


def _same_group(a: str, b: str) -> bool:
    return any(a in group and b in group for group in EQUIVALENCE_GROUPS)


def upload_content(*, context, asset: FileAsset, content: bytes, claimed_checksum: str = "") -> FileAsset:
    """Receive bytes and finalize. Gates G5-G10, against measured reality."""
    if asset.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested file was not found.")
    if asset.lifecycle_state != LIFECYCLE_PENDING:
        raise DomainConflict("This upload has already been completed.")

    if len(content) > MAX_FILE_BYTES:  # G5 — measured, not declared
        _fail(asset, "file_too_large")
        raise ValidationFailed("That file is too large.")
    if len(content) == 0:  # G6
        _fail(asset, "empty_file")
        raise ValidationFailed("An empty file cannot be stored.")

    detected = detect_content_type(content)
    if detected not in ALLOWED_CONTENT_TYPES:  # G7
        _fail(asset, "type_not_allowed")
        raise ValidationFailed("That file type is not allowed.")
    if detected != asset.declared_content_type and not _same_group(
        detected, asset.declared_content_type
    ):  # G8
        # A `.pdf` that is really an `.html` is the classic stored-XSS vector.
        _fail(asset, "mime_mismatch")
        raise ValidationFailed("That file type is not allowed.")

    checksum = hashlib.sha256(content).hexdigest()
    if claimed_checksum and claimed_checksum.lower() != checksum:  # G9
        _fail(asset, "integrity_mismatch")
        raise ValidationFailed("The file failed its integrity check.")

    with transaction.atomic():  # G10 — authoritative reservation under a lock
        usage = WorkspaceStorageUsage.objects.select_for_update().get(pk=asset.workspace_id)
        if usage.logical_bytes + len(content) > WORKSPACE_STORAGE_CEILING_BYTES:
            _fail(asset, "quota_exhausted")
            raise QuotaExhausted("This workspace has no storage headroom.")

        providers.require("storage").put(
            storage_key=asset.storage_key, content=content, content_type=detected
        )

        asset.detected_content_type = detected
        asset.content_type = detected  # overwritten once, with the SERVER's finding
        asset.size_bytes = len(content)
        asset.checksum = checksum
        asset.lifecycle_state = LIFECYCLE_AVAILABLE
        asset.storage_object_state = "present"
        asset.upload_expires_at = None
        asset.save(
            update_fields=[
                "detected_content_type",
                "content_type",
                "size_bytes",
                "checksum",
                "lifecycle_state",
                "storage_object_state",
                "upload_expires_at",
                "updated_at",
            ]
        )
        usage.logical_bytes += len(content)
        usage.in_flight_bytes = max(0, usage.in_flight_bytes - len(content))
        usage.save(update_fields=["logical_bytes", "in_flight_bytes", "updated_at"])
    return asset


def _fail(asset: FileAsset, reason: str) -> None:
    asset.lifecycle_state = LIFECYCLE_FAILED
    asset.failure_reason = reason
    asset.save(update_fields=["lifecycle_state", "failure_reason", "updated_at"])


# --------------------------------------------------------------------------
# Download — a ticket that is NOT a capability
# --------------------------------------------------------------------------
def issue_download_ticket(*, context, asset: FileAsset) -> str:
    if asset.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested file was not found.")
    if asset.lifecycle_state != LIFECYCLE_AVAILABLE:
        raise DomainConflict("This file is not available for download.")
    token = secrets.token_urlsafe(32)
    ports.require("single_use_tokens").put(
        token=token,
        # Identities only. No filename, no storage key, no bytes — a ticket
        # names WHICH file is being asked for and nothing about it.
        payload={"file_id": str(asset.id), "workspace_id": str(context.workspace.id)},
        ttl_seconds=DOWNLOAD_TICKET_TTL_SECONDS,
    )
    return token


def redeem_download_ticket(*, context, token: str) -> tuple[FileAsset, bytes]:
    """SINGLE USE, and the full authorization chain runs again on redemption.

    The ticket narrows *which* file is being asked for; it never substitutes
    for deciding whether this actor may have it. That is why a leaked ticket
    is worth nothing, and why there is no signed public URL in Phase 1.
    """
    # Single use, and TAKEN rather than read: the store deletes atomically, so
    # two concurrent redemptions cannot both succeed. Expiry is enforced by the
    # store's own TTL, which is why no timestamp travels in the payload.
    record = ports.require("single_use_tokens").take(token=token)
    if not record:
        raise EntityNotFound("The requested file was not found.")

    asset = FileAsset.objects.filter(pk=record["file_id"]).first()
    if asset is None or asset.workspace_id != context.workspace.id:
        # Re-authorized against the CURRENT actor, not the issuing one.
        raise EntityNotFound("The requested file was not found.")
    if asset.lifecycle_state != LIFECYCLE_AVAILABLE:
        raise DomainConflict("This file is not available for download.")
    return asset, providers.require("storage").get(storage_key=asset.storage_key)


# --------------------------------------------------------------------------
# Attach / detach / delete
# --------------------------------------------------------------------------
@transaction.atomic
def attach_file(*, context, asset: FileAsset, subject_type: str, subject_id, subject_ref: str = ""):
    if asset.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested file was not found.")
    if subject_type not in SUBJECT_TYPES:
        raise ValidationFailed("That is not an attachable subject type.")
    if asset.lifecycle_state != LIFECYCLE_AVAILABLE:
        raise DomainConflict("Only an available file can be attached.")

    existing = FileAttachment.objects.filter(
        file_asset=asset, subject_type=subject_type, subject_id=subject_id, state="active"
    ).first()
    if existing is not None:
        return existing  # the unique index makes a repeat an idempotent replay
    return FileAttachment.objects.create(
        file_asset=asset,
        workspace=context.workspace,
        subject_type=subject_type,
        subject_id=subject_id,
        subject_ref=subject_ref[:60],
        state="active",
        attached_by=context.membership,
    )


@transaction.atomic
def detach_file(*, context, attachment: FileAttachment) -> FileAttachment:
    if attachment.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested attachment was not found.")
    if attachment.state == "detached":
        return attachment
    # Marked, never deleted: the row is the durable proof that this file WAS
    # attached once, which is what makes the orphan sweep's test safe.
    attachment.state = "detached"
    attachment.detached_at = timezone.now()
    attachment.save(update_fields=["state", "detached_at", "updated_at"])
    return attachment


@transaction.atomic
def delete_file(*, context, asset: FileAsset, reason: str = "") -> FileAsset:
    """Phase 1 has NO hard delete. `legal`-class files cannot be deleted at all."""
    if asset.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested file was not found.")
    if asset.retention_class == "legal":
        raise DomainConflict("A legal-retention file cannot be deleted.")
    if FileAttachment.objects.filter(file_asset=asset, state="active").exists():
        raise DomainConflict("Detach this file before deleting it.")

    asset.lifecycle_state = "archived"
    asset.archived_at = timezone.now()
    asset.deletion_reason = reason[:200]
    asset.save(update_fields=["lifecycle_state", "archived_at", "deletion_reason", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="file.deleted",
        target_type="file_asset",
        target_ref=asset.public_id,
        metadata={"reason": reason[:200]},
    )
    return asset


def sweep_orphan_files(*, now=None) -> int:
    """Expire `pending` intents whose bytes never arrived. Report, never repair."""
    now = now or timezone.now()
    stale = FileAsset.objects.filter(lifecycle_state=LIFECYCLE_PENDING, upload_expires_at__lte=now)
    count = 0
    for asset in stale:
        _fail(asset, "upload_expired")
        count += 1
    return count


def _usage_row(workspace) -> WorkspaceStorageUsage:
    row, _ = WorkspaceStorageUsage.objects.get_or_create(workspace=workspace)
    return row


__all__ = [
    "request_upload",
    "upload_content",
    "issue_download_ticket",
    "redeem_download_ticket",
    "attach_file",
    "detach_file",
    "delete_file",
    "sweep_orphan_files",
    "normalize_filename",
    "detect_content_type",
    "build_storage_key",
    "ALLOWED_CONTENT_TYPES",
    "ACTIVE_CONTENT_TYPES",
    "MAX_FILE_BYTES",
]
