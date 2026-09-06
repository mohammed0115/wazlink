"""I11 — Files / Storage completion.

Frozen sources, read directly:

*   `B11_FILE_VALIDATION` §2 — the ten gates, in order. `G1`-`G4` are cheap
    rejections and are **not** security controls; `G5`-`G10` run against
    measured bytes and are.
*   `B11_FILE_VALIDATION` §3/§4 — three content-type columns, never collapsed;
    a detected type outside the declared type's equivalence group is REJECTED,
    because a `.pdf` that is really an `.html` is the stored-XSS vector.
*   `B11_STORAGE_KEY_MODEL` §2/§4 — no client input reaches the key, and
    tenancy is decided by authorization, never by parsing it.
*   `B11_DELETION_RETENTION_MODEL` — no hard delete in Phase 1; `legal` files
    are undeletable.
"""

from __future__ import annotations

import base64
import hashlib

import pytest

from apps.files.models import FileAsset, FileAttachment, WorkspaceStorageUsage
from apps.files.services import (
    ACTIVE_CONTENT_TYPES,
    MAX_FILE_BYTES,
    attach_file,
    delete_file,
    detach_file,
    detect_content_type,
    issue_download_ticket,
    normalize_filename,
    redeem_download_ticket,
    request_upload,
    upload_content,
)
from common.errors import DomainConflict, EntityNotFound, ValidationFailed

pytestmark = pytest.mark.django_db(transaction=True)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64
HTML = b"<html><script>alert(1)</script></html>"


def _intent(context, *, filename="photo.png", content_type="image/png", **kw):
    return request_upload(context=context, filename=filename, content_type=content_type, **kw)


# ---------------------------------------------------------------- G1 filenames
def test_g1_filename_normalization_and_rejections():
    assert normalize_filename("  report.pdf  ") == "report.pdf"
    # NFC: two spellings of the same name are the same string.
    assert normalize_filename("café.png") == normalize_filename("café.png")
    # Control characters are a log- and header-injection primitive.
    assert "\n" not in normalize_filename("a\nb.png")
    # Bidi overrides are STRIPPED, not banned — Arabic must keep working.
    assert normalize_filename("‮جرب.png") == "جرب.png"
    for bad in ("", "   ", "../etc/passwd", "a/b.png", "a\\b.png", ".", ".."):
        with pytest.raises(ValidationFailed):
            normalize_filename(bad)
    with pytest.raises(ValidationFailed):
        normalize_filename("x" * 300 + ".png")


def test_arabic_filenames_survive_the_round_trip(actor):
    a = actor()
    asset = _intent(a.context, filename="فاتورة.pdf", content_type="application/pdf")
    assert asset.original_filename == "فاتورة.pdf"
    # And an ASCII-safe derivative exists for the header.
    assert asset.safe_display_filename
    assert asset.safe_display_filename.isascii()


# ---------------------------------------------------------------- G2/G3/G4
def test_g2_the_allow_list_is_closed_and_active_content_is_excluded(actor):
    a = actor()
    for blocked in sorted(ACTIVE_CONTENT_TYPES):
        with pytest.raises(ValidationFailed):
            _intent(a.context, content_type=blocked)
    # Not on the list at all -> denied by default, no blocklist needed.
    with pytest.raises(ValidationFailed):
        _intent(a.context, content_type="application/x-msdownload")
    assert FileAsset.objects.count() == 0


def test_g3_a_declared_oversize_is_refused_before_bytes_are_spent(actor):
    a = actor()
    with pytest.raises(ValidationFailed):
        _intent(a.context, declared_size=MAX_FILE_BYTES + 1)
    assert FileAsset.objects.count() == 0


# ---------------------------------------------------------------- G5..G10
def test_g5_a_measured_oversize_is_refused(actor, monkeypatch):
    import apps.files.services as service_module

    a = actor()
    monkeypatch.setattr(service_module, "MAX_FILE_BYTES", 128)
    asset = _intent(a.context)
    with pytest.raises(ValidationFailed):
        upload_content(context=a.context, asset=asset, content=PNG + b"\x00" * 512)
    asset.refresh_from_db()
    assert asset.lifecycle_state == "failed"
    assert asset.failure_reason == "file_too_large"


def test_g6_an_empty_file_is_refused(actor):
    a = actor()
    asset = _intent(a.context)
    with pytest.raises(ValidationFailed):
        upload_content(context=a.context, asset=asset, content=b"")
    asset.refresh_from_db()
    assert asset.lifecycle_state == "failed"


def test_g7_g8_a_disguised_html_upload_is_refused(actor):
    """The classic stored-XSS vector: declared `application/pdf`, really HTML."""
    a = actor()
    asset = _intent(a.context, filename="invoice.pdf", content_type="application/pdf")
    with pytest.raises(ValidationFailed):
        upload_content(context=a.context, asset=asset, content=HTML)
    asset.refresh_from_db()
    assert asset.lifecycle_state == "failed"
    assert asset.failure_reason in ("type_not_allowed", "mime_mismatch")
    # Nothing was written to storage.
    from common.provider_ports import providers

    assert providers.require("storage").exists(storage_key=asset.storage_key) is False


def test_g8_a_declared_png_that_is_really_a_pdf_is_refused(actor):
    a = actor()
    asset = _intent(a.context, filename="x.png", content_type="image/png")
    with pytest.raises(ValidationFailed):
        upload_content(context=a.context, asset=asset, content=PDF)
    asset.refresh_from_db()
    assert asset.failure_reason == "mime_mismatch"


def test_g9_a_checksum_mismatch_is_a_rejection_never_an_override(actor):
    a = actor()
    asset = _intent(a.context)
    with pytest.raises(ValidationFailed):
        upload_content(context=a.context, asset=asset, content=PNG, claimed_checksum="deadbeef")
    asset.refresh_from_db()
    assert asset.lifecycle_state == "failed"


def test_a_valid_upload_finalizes_with_server_computed_truth(actor):
    a = actor()
    asset = _intent(a.context)
    asset = upload_content(
        context=a.context, asset=asset, content=PNG, claimed_checksum=hashlib.sha256(PNG).hexdigest()
    )
    assert asset.lifecycle_state == "available"
    assert asset.detected_content_type == "image/png"
    assert asset.content_type == "image/png"  # overwritten with the SERVER's finding
    assert asset.size_bytes == len(PNG)
    assert asset.checksum == hashlib.sha256(PNG).hexdigest()
    usage = WorkspaceStorageUsage.objects.get(pk=a.workspace.pk)
    assert usage.logical_bytes == len(PNG)


def test_the_three_content_type_columns_are_never_collapsed(actor):
    """`B11-D-A010`. Claimed, detected and canonical are different facts."""
    a = actor()
    asset = _intent(a.context, filename="a.jpg", content_type="image/jpeg")
    # At `pending`: canonical holds the ALLOW-LIST MEMBER, detected is null.
    assert asset.content_type == "image/jpeg"
    assert asset.detected_content_type is None
    columns = {f.name for f in FileAsset._meta.get_fields()}
    assert {"declared_content_type", "detected_content_type", "content_type"} <= columns


# ---------------------------------------------------------------- storage key
def test_a_traversal_filename_is_rejected_outright(actor):
    a = actor()
    for attempt in ("../../etc/passwd.png", "..\\..\\win.png", "/etc/shadow.png"):
        with pytest.raises(ValidationFailed):
            _intent(a.context, filename=attempt)


def test_the_key_is_a_pure_function_of_server_values(actor):
    a = actor()
    asset = _intent(a.context, filename="my report (final).png")
    key = asset.storage_key
    # No filename fragment, no extension, no public id.
    assert "report" not in key and "final" not in key
    assert not key.endswith(".png")
    assert asset.public_id not in key
    # Exactly the frozen shape.
    assert key.startswith(f"test/w/{a.workspace.id}/") or key.startswith(f"local/w/{a.workspace.id}/")
    assert key.endswith(str(asset.id))


def test_the_storage_adapter_refuses_an_escaping_key():
    """Belt and braces: even a forged key that reached the adapter is refused."""
    from common.provider_ports import ProviderNotConfigured, providers

    storage = providers.require("storage")
    with pytest.raises(ProviderNotConfigured):
        storage.put(storage_key="../../escape", content=b"x", content_type="image/png")


# ---------------------------------------------------------------- download
def test_a_download_ticket_is_single_use(actor):
    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    ticket = issue_download_ticket(context=a.context, asset=asset)

    got, content = redeem_download_ticket(context=a.context, token=ticket)
    assert got.pk == asset.pk and content == PNG
    # Second redemption of the SAME ticket fails.
    with pytest.raises(EntityNotFound):
        redeem_download_ticket(context=a.context, token=ticket)


def test_a_ticket_is_not_a_capability_across_tenants(actor):
    """Redemption re-runs the whole chain against the CURRENT actor."""
    one = actor(email="f1@example.test", workspace_name="F1")
    two = actor(email="f2@example.test", workspace_name="F2")
    asset = upload_content(context=one.context, asset=_intent(one.context), content=PNG)
    ticket = issue_download_ticket(context=one.context, asset=asset)

    with pytest.raises(EntityNotFound):
        redeem_download_ticket(context=two.context, token=ticket)


def test_a_pending_file_is_not_downloadable(actor):
    a = actor()
    asset = _intent(a.context)
    with pytest.raises(DomainConflict):
        issue_download_ticket(context=a.context, asset=asset)


def test_no_signed_public_url_exists_anywhere():
    """`B11` Phase 1: `access_class` is `private` only."""
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "files"
    source = " ".join(p.read_text() for p in root.rglob("*.py"))
    for forbidden in ("presigned", "generate_presigned_url", "signed_url", "public-read"):
        assert forbidden not in source, f"a public URL path exists: {forbidden}"


def test_the_download_response_sets_nosniff_and_a_safe_disposition(actor, auth_client):
    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    api = auth_client(a)
    ticket = api.get(f"/api/v1/files/{asset.public_id}/download").json()["ticket"]
    response = api.get(f"/api/v1/files/{asset.public_id}/download?ticket={ticket}")
    assert response.status_code == 200
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "attachment;" in response["Content-Disposition"]


# ---------------------------------------------------------------- attach
def test_attaching_twice_is_an_idempotent_replay(actor):
    import uuid

    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    subject = uuid.uuid4()
    first = attach_file(context=a.context, asset=asset, subject_type="customer", subject_id=subject)
    second = attach_file(context=a.context, asset=asset, subject_type="customer", subject_id=subject)
    assert first.pk == second.pk
    assert FileAttachment.objects.filter(file_asset=asset, state="active").count() == 1


def test_a_detached_row_is_marked_never_deleted(actor):
    import uuid

    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    attachment = attach_file(
        context=a.context, asset=asset, subject_type="ticket", subject_id=uuid.uuid4()
    )
    detach_file(context=a.context, attachment=attachment)
    attachment.refresh_from_db()
    assert attachment.state == "detached"
    # The row survives — it is the proof that makes the orphan test safe.
    assert FileAttachment.objects.filter(pk=attachment.pk).exists()


def test_an_unknown_subject_type_is_refused(actor):
    import uuid

    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    with pytest.raises(ValidationFailed):
        attach_file(context=a.context, asset=asset, subject_type="invoice", subject_id=uuid.uuid4())


# ---------------------------------------------------------------- retention
def test_a_legal_class_file_cannot_be_deleted(actor):
    a = actor()
    asset = _intent(a.context, retention_class="legal")
    asset = upload_content(context=a.context, asset=asset, content=PNG)
    with pytest.raises(DomainConflict):
        delete_file(context=a.context, asset=asset)
    asset.refresh_from_db()
    assert asset.lifecycle_state == "available"


def test_deletion_is_soft_with_no_hard_delete_path(actor):
    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    asset = delete_file(context=a.context, asset=asset, reason="no longer needed")
    assert asset.lifecycle_state == "archived"
    assert asset.archived_at is not None
    # The ROW survives. Phase 1 has no hard delete.
    assert FileAsset.objects.filter(pk=asset.pk).exists()


def test_an_attached_file_cannot_be_deleted(actor):
    import uuid

    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    attach_file(context=a.context, asset=asset, subject_type="customer", subject_id=uuid.uuid4())
    with pytest.raises(DomainConflict):
        delete_file(context=a.context, asset=asset)


# ---------------------------------------------------------------- tenancy / NC
def test_t_file_1_nc_b11_is_the_single_storage_authority():
    """`T-FILE-1` **(NC)**. No second file table exists anywhere."""
    from django.db import connection

    with connection.cursor() as cursor:
        # `%%file%%` would also match `tax_pro-FILE-s`, so match the WORD:
        # a storage-shaped table starts with, or contains, `file`/`upload`/
        # `attachment`/`document` as its own underscore-delimited segment.
        cursor.execute(
            r"""SELECT table_name FROM information_schema.tables
                WHERE table_schema='public'
                  AND table_name ~ '(^|_)(files?|uploads?|attachments?|documents?)(_|$)'
                ORDER BY table_name"""
        )
        tables = {row[0] for row in cursor.fetchall()}
    assert tables == {"file_assets", "file_attachments"}, f"a second storage authority exists: {tables}"


def test_files_are_tenant_isolated(actor, auth_client):
    one = actor(email="t1@example.test", workspace_name="T1")
    two = actor(email="t2@example.test", workspace_name="T2")
    asset = upload_content(context=one.context, asset=_intent(one.context), content=PNG)

    api = auth_client(two)
    assert api.get(f"/api/v1/files/{asset.public_id}").status_code == 404
    assert api.get(f"/api/v1/files/{asset.public_id}/download").status_code == 404


def test_the_client_payload_leaks_no_detection_or_storage_detail(actor, auth_client):
    a = actor()
    asset = upload_content(context=a.context, asset=_intent(a.context), content=PNG)
    body = auth_client(a).get(f"/api/v1/files/{asset.public_id}").json()
    for forbidden in ("storage_key", "declared_content_type", "detected_content_type", "failure_detail"):
        assert forbidden not in body, f"the file DTO leaks {forbidden}"


def test_the_api_upload_journey_end_to_end(actor, auth_client):
    a = actor()
    api = auth_client(a)
    created = api.post(
        "/api/v1/files/upload-intent",
        {"filename": "shot.png", "content_type": "image/png", "size_bytes": len(PNG)},
        format="json",
    )
    assert created.status_code == 201
    ref = created.json()["id"]
    uploaded = api.put(
        f"/api/v1/files/{ref}/content",
        {"content": base64.b64encode(PNG).decode()},
        format="json",
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["lifecycle_state"] == "available"


def test_a_viewer_cannot_upload(actor, auth_client):
    viewer = actor(email="fv@example.test", role="viewer", workspace_name="FV")
    response = auth_client(viewer).post(
        "/api/v1/files/upload-intent",
        {"filename": "x.png", "content_type": "image/png"},
        format="json",
    )
    assert response.status_code == 403


def test_the_expiry_sweep_fails_stale_intents(actor):
    from datetime import timedelta

    from django.utils import timezone

    from apps.files.services import sweep_orphan_files

    a = actor()
    asset = _intent(a.context)
    FileAsset.objects.filter(pk=asset.pk).update(
        upload_expires_at=timezone.now() - timedelta(minutes=1)
    )
    assert sweep_orphan_files() == 1
    asset.refresh_from_db()
    assert asset.lifecycle_state == "failed"
    assert asset.failure_reason == "upload_expired"


def test_detection_is_by_content_never_by_extension():
    assert detect_content_type(PNG) == "image/png"
    assert detect_content_type(PDF) == "application/pdf"
    # Unidentifiable is NOT stored on anyone's say-so.
    assert detect_content_type(b"\x00\x01\x02\x03") == "application/octet-stream"
