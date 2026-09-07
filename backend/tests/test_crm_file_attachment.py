"""Attaching a file to a CRM party from a client that only knows public ids.

`POST /files/{ref}/attachments` takes the subject's INTERNAL database id, which
the API never discloses — every DTO carries public ids only. A browser
therefore cannot use it, and calling it without the id violates the NOT NULL on
`file_attachments.subject_id`.

The fix is the layering rule the codebase already uses for custom fields: the
SUBJECT OWNER exposes the route and delegates DOWNWARD to files. `files` is
L3 and may not import `crm` (L5) or `customers` (L6), so the route cannot live
there. Resolving the subject in the owning app is also the safer shape — the
internal id is derived AFTER `resolve_in_workspace` has proved the caller may
see the subject, instead of being accepted from the request body.
"""

from __future__ import annotations

import base64

import pytest

from apps.crm.services import create_lead
from apps.customers.services import create_customer
from apps.files.models import FileAttachment
from apps.files.services import request_upload, upload_content

pytestmark = pytest.mark.django_db(transaction=True)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _available_asset(context, filename="photo.png"):
    asset = request_upload(context=context, filename=filename, content_type="image/png")
    return upload_content(context=context, asset=asset, content=PNG)


def _lead(context):
    return create_lead(context=context, origin_type="manual", primary_contact={"name": "نورة"})


def test_a_lead_file_attaches_by_public_id_alone(actor, auth_client):
    a = actor()
    client = auth_client(a)
    lead = _lead(a.context)
    asset = _available_asset(a.context)

    response = client.post(
        f"/api/v1/leads/{lead.public_id}/files",
        {"file_ref": asset.public_id},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert response.data["subject_ref"] == lead.public_id
    assert response.data["state"] == "active"

    row = FileAttachment.objects.get(file_asset=asset, subject_type="lead")
    # The internal id was derived server-side; the client never sent one.
    assert row.subject_id == lead.id
    assert row.workspace_id == a.workspace.id


def test_the_attachment_appears_in_the_lead_360_files_section(actor, auth_client):
    a = actor()
    client = auth_client(a)
    lead = _lead(a.context)
    asset = _available_asset(a.context, filename="عرض.png")

    client.post(f"/api/v1/leads/{lead.public_id}/files", {"file_ref": asset.public_id}, format="json")

    response = client.get(f"/api/v1/leads/{lead.public_id}")
    assert response.status_code == 200
    files = response.data.get("files")
    assert files is not None, "the files section was omitted for an actor that may read it"
    assert [f["file_ref"] for f in files] == [asset.public_id]
    assert files[0]["filename"] == "عرض.png"


def test_a_customer_file_attaches_the_same_way(actor, auth_client):
    a = actor()
    client = auth_client(a)
    customer = create_customer(
        context=a.context, party_kind="organization", name="شركة نمو", origin_kind="manual"
    )
    asset = _available_asset(a.context)

    response = client.post(
        f"/api/v1/customers/{customer.public_id}/files",
        {"file_ref": asset.public_id},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert FileAttachment.objects.get(file_asset=asset).subject_id == customer.id


def test_attaching_twice_is_an_idempotent_replay_not_a_duplicate(actor, auth_client):
    a = actor()
    client = auth_client(a)
    lead = _lead(a.context)
    asset = _available_asset(a.context)
    body = {"file_ref": asset.public_id}

    first = client.post(f"/api/v1/leads/{lead.public_id}/files", body, format="json")
    second = client.post(f"/api/v1/leads/{lead.public_id}/files", body, format="json")

    assert first.status_code == second.status_code == 201
    assert FileAttachment.objects.filter(file_asset=asset, subject_type="lead").count() == 1


def test_a_file_from_another_workspace_is_not_found_never_forbidden(actor, auth_client):
    mine = actor(email="mine@example.test", workspace_name="Mine")
    theirs = actor(email="theirs@example.test", workspace_name="Theirs")
    lead = _lead(mine.context)
    foreign_asset = _available_asset(theirs.context)

    response = auth_client(mine).post(
        f"/api/v1/leads/{lead.public_id}/files",
        {"file_ref": foreign_asset.public_id},
        format="json",
    )
    # 404, never 403: a 403 would confirm the file exists in another tenant.
    assert response.status_code == 404
    assert response.data["error"]["code"] == "ENTITY_NOT_FOUND"
    assert not FileAttachment.objects.filter(file_asset=foreign_asset).exists()


def test_a_lead_from_another_workspace_is_not_found(actor, auth_client):
    mine = actor(email="mine2@example.test", workspace_name="Mine2")
    theirs = actor(email="theirs2@example.test", workspace_name="Theirs2")
    foreign_lead = _lead(theirs.context)
    asset = _available_asset(mine.context)

    response = auth_client(mine).post(
        f"/api/v1/leads/{foreign_lead.public_id}/files",
        {"file_ref": asset.public_id},
        format="json",
    )
    assert response.status_code == 404
    assert not FileAttachment.objects.filter(file_asset=asset).exists()


def test_a_viewer_may_not_attach(actor, auth_client):
    owner = actor(email="owner-f@example.test", workspace_name="Shared")
    lead = _lead(owner.context)
    asset = _available_asset(owner.context)

    viewer = actor(email="viewer-f@example.test", role="viewer", workspace_name="ViewerOnly")
    response = auth_client(viewer).post(
        f"/api/v1/leads/{lead.public_id}/files",
        {"file_ref": asset.public_id},
        format="json",
    )
    # The viewer lacks file.upload, and the lead is in another workspace: the
    # permission check runs first, so this is 403 rather than a tenancy 404.
    assert response.status_code == 403
    assert response.data["error"]["code"] == "PERMISSION_DENIED"


def test_a_pending_file_cannot_be_attached_before_its_bytes_land(actor, auth_client):
    a = actor()
    client = auth_client(a)
    lead = _lead(a.context)
    # Intent only — no content, so the asset is not `available`.
    pending = request_upload(context=a.context, filename="x.png", content_type="image/png")

    response = client.post(
        f"/api/v1/leads/{lead.public_id}/files", {"file_ref": pending.public_id}, format="json"
    )
    assert response.status_code == 409
    assert not FileAttachment.objects.filter(file_asset=pending).exists()


def test_base64_content_upload_round_trips(actor, auth_client):
    """The browser path sends bytes as base64 through the JSON contract."""
    a = actor()
    client = auth_client(a)
    asset = request_upload(context=a.context, filename="b64.png", content_type="image/png")

    response = client.put(
        f"/api/v1/files/{asset.public_id}/content",
        {"content": base64.b64encode(PNG).decode()},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["lifecycle_state"] == "available"
    assert response.data["size_bytes"] == len(PNG)
