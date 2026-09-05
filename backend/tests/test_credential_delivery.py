"""MAJOR-1 regression — credential-class tokens leave through ONE seam only.

Frozen rules under test:
  B1-D-A19 / B1_PRIVACY_AUDIT_MODEL Rule P-1  — a raw invitation, verification
      or reset token is returned to a client ZERO times, not once, and never
      reaches a log line, an audit row, an event payload, the outbox or a
      Celery argument.
  B1-D-A22 / B1_API_DTO_CONTRACTS §3.1        — POST invitations returns the
      `Invitation` DTO; the raw token is a field of no response.
  B1_AUTH_SESSION_DESIGN §3.7                 — POST /auth/register is always
      `202 Empty`, indistinguishable for a fresh and an existing address.

Every assertion below scans for the REAL token value, not for a key name: a
token that leaked under a different key, nested, or concatenated would still
be caught.
"""

from __future__ import annotations

import json

import pytest

pytestmark = [pytest.mark.django_db, pytest.mark.security]

PASSWORD = "correct-horse-battery"


def _anon():
    from rest_framework.test import APIClient

    return APIClient()


def _durable_surfaces() -> str:
    """Every durable observability surface, serialized for substring scanning."""
    from apps.auditlog.models import AuditLog
    from apps.platform_async.models import OutboxEvent

    return json.dumps(
        {
            "audit": list(AuditLog.objects.values()),
            "outbox": list(OutboxEvent.objects.values()),
        },
        default=str,
    )


# --------------------------------------------------------------------------
# Registration
# --------------------------------------------------------------------------


def test_register_returns_202_empty_and_no_token(delivered):
    response = _anon().post(
        "/api/v1/auth/register",
        {"email": "fresh@example.test", "password": PASSWORD, "full_name": "Fresh"},
        format="json",
    )

    assert response.status_code == 202
    assert response.content == b"", "frozen contract is `202 Empty`"

    raw = delivered.token_for("verify_email")
    assert raw, "the token must still reach the out-of-band boundary"
    # The REAL token value, not the key name.
    assert raw not in response.content.decode(errors="ignore")


@pytest.mark.nc
def test_register_token_is_absent_from_every_durable_surface(delivered):
    _anon().post(
        "/api/v1/auth/register",
        {"email": "scan@example.test", "password": PASSWORD},
        format="json",
    )
    raw = delivered.token_for("verify_email")
    assert raw

    surfaces = _durable_surfaces()
    assert raw not in surfaces, "the raw verification token reached audit or the outbox"

    # And the database stores only its hash.
    from apps.accounts.models import UserEmailToken

    row = UserEmailToken.objects.get(purpose="verify_email")
    assert row.token_hash == UserEmailToken.hash_token(raw)
    for field in row._meta.fields:
        assert getattr(row, field.name, None) != raw


@pytest.mark.nc
def test_register_token_is_absent_from_log_records(delivered, caplog):
    import logging

    with caplog.at_level(logging.DEBUG):
        _anon().post(
            "/api/v1/auth/register",
            {"email": "logs@example.test", "password": PASSWORD},
            format="json",
        )
    raw = delivered.token_for("verify_email")
    assert raw

    emitted = "\n".join(record.getMessage() for record in caplog.records)
    assert raw not in emitted


def test_the_scan_is_not_vacuous(delivered):
    """A scan that could never find anything would pass a leaking build."""
    _anon().post(
        "/api/v1/auth/register",
        {"email": "vacuity@example.test", "password": PASSWORD},
        format="json",
    )
    raw = delivered.token_for("verify_email")
    # The token is a real, long, high-entropy value — so "not in" is meaningful.
    assert raw and len(raw) >= 40
    # And a surface that genuinely contains it IS detected by the same check.
    assert raw in json.dumps({"leaked": raw})


# --------------------------------------------------------------------------
# Registration anti-enumeration
# --------------------------------------------------------------------------


@pytest.mark.nc
def test_register_is_indistinguishable_for_existing_and_fresh_addresses(delivered):
    """The anti-enumeration control, compared semantically rather than by code.

    Status, body, error code, message and response shape must all match.
    """
    anon = _anon()
    first = anon.post(
        "/api/v1/auth/register", {"email": "taken@example.test", "password": PASSWORD}, format="json"
    )
    existing = anon.post(
        "/api/v1/auth/register", {"email": "taken@example.test", "password": PASSWORD}, format="json"
    )
    fresh = anon.post(
        "/api/v1/auth/register", {"email": "brandnew@example.test", "password": PASSWORD}, format="json"
    )

    assert first.status_code == 202
    assert existing.status_code == fresh.status_code == 202
    assert existing.content == fresh.content == b""
    assert existing.headers.get("Content-Type") == fresh.headers.get("Content-Type")

    # No second user, and no second credential row, for the duplicate.
    from apps.accounts.models import User, UserCredential

    assert User.objects.filter(email="taken@example.test").count() == 1
    assert UserCredential.objects.filter(user__email="taken@example.test").count() == 1


def test_duplicate_registration_notifies_the_address_owner_instead(delivered):
    """Frozen §3.7: an existing address gets an account-exists notification and
    nothing is created — the branch is visible only to the mailbox owner."""
    anon = _anon()
    anon.post(
        "/api/v1/auth/register", {"email": "owner@example.test", "password": PASSWORD}, format="json"
    )
    anon.post(
        "/api/v1/auth/register", {"email": "owner@example.test", "password": PASSWORD}, format="json"
    )

    assert delivered.kinds() == ["verify_email", "account_exists"]
    # The duplicate branch carries no token at all.
    assert delivered.items[-1]["raw_token"] == ""

    from apps.accounts.models import UserEmailToken

    assert UserEmailToken.objects.count() == 1


def test_malformed_input_is_not_an_enumeration_oracle(delivered):
    """A short password must fail identically whether or not the account exists."""
    anon = _anon()
    anon.post(
        "/api/v1/auth/register", {"email": "known@example.test", "password": PASSWORD}, format="json"
    )

    on_existing = anon.post(
        "/api/v1/auth/register", {"email": "known@example.test", "password": "short"}, format="json"
    )
    on_fresh = anon.post(
        "/api/v1/auth/register", {"email": "unknown@example.test", "password": "short"}, format="json"
    )

    def _without_request_id(payload):
        # request_id is a per-request correlation UUID and is SUPPOSED to
        # differ; everything else must match byte for byte.
        error = dict(payload["error"])
        error.pop("request_id")
        return error

    assert on_existing.status_code == on_fresh.status_code
    assert _without_request_id(on_existing.json()) == _without_request_id(on_fresh.json())


# --------------------------------------------------------------------------
# Invitations
# --------------------------------------------------------------------------


def test_invitation_response_carries_no_raw_token(actor, auth_client, delivered):
    a = actor()
    response = auth_client(a).post(
        "/api/v1/invitations", {"email": "invitee@example.test", "role": "sales"}, format="json"
    )

    assert response.status_code == 201
    body = response.json()

    raw = delivered.token_for("invitation")
    assert raw, "the token must still reach the out-of-band boundary"
    # Scan the whole serialized body for the REAL value, under any key.
    assert raw not in json.dumps(body, default=str)
    assert "invitation_token" not in body

    # The frozen `Invitation` DTO shape, with the address masked on creation.
    assert body["email_masked"] == "i***@example.test"
    assert "email" not in body, "the raw address is masked on every surface"
    for field in ("invitation_ref", "workspace_ref", "role", "status", "invited_by", "version"):
        assert field in body


@pytest.mark.nc
def test_invitation_token_is_absent_from_every_durable_surface(actor, auth_client, delivered):
    a = actor()
    auth_client(a).post(
        "/api/v1/invitations", {"email": "scanme@example.test", "role": "member"}, format="json"
    )
    raw = delivered.token_for("invitation")
    assert raw

    assert raw not in _durable_surfaces(), "the raw invitation token reached audit or the outbox"

    from apps.workspaces.models import Invitation

    stored = Invitation.objects.get(email="scanme@example.test")
    assert stored.token_hash == Invitation.hash_token(raw)
    for field in stored._meta.fields:
        assert getattr(stored, field.name, None) != raw


def test_the_delivered_invitation_token_still_works(actor, make_user, delivered):
    """The seam must deliver a USABLE credential — a fix that merely broke the
    flow would be no fix at all."""
    from apps.workspaces.services import accept_invitation, invite_member

    a = actor()
    invite_member(context=a.context, email="works@example.test", role="member")
    raw = delivered.token_for("invitation")

    invitee = make_user(email="works@example.test")
    membership = accept_invitation(user=invitee, raw_token=raw)
    assert membership.role == "member"


def test_no_api_surface_returns_a_credential_token(actor, auth_client, delivered):
    """Direct-command path parity: the commands hand tokens to the boundary and
    return domain objects, so no view can echo one even by accident."""
    from apps.accounts.services import register_user
    from apps.workspaces.services import invite_member

    assert register_user(email="parity@example.test", password=PASSWORD) is None

    a = actor()
    result = invite_member(context=a.context, email="parity2@example.test", role="member")
    from apps.workspaces.models import Invitation

    assert isinstance(result, Invitation)
