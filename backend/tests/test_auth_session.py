"""B1 session, membership and invitation invariants."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


@pytest.mark.security
def test_invitation_raw_token_is_never_stored_in_plaintext(actor, delivered):
    from apps.workspaces.models import Invitation
    from apps.workspaces.services import invite_member

    a = actor()
    invitation = invite_member(context=a.context, email="new@example.test", role="member")
    raw = delivered.token_for("invitation")
    assert raw, "the token must reach the delivery boundary"

    stored = Invitation.objects.get(pk=invitation.pk)
    assert stored.token_hash != raw
    assert raw not in stored.token_hash
    # The raw value appears in NO column of the row.
    for field in stored._meta.fields:
        assert getattr(stored, field.name, None) != raw


@pytest.mark.security
def test_invitation_token_entropy_is_not_weakened():
    from apps.workspaces.models import Invitation

    assert Invitation.TOKEN_BYTES >= 32
    raw, _ = Invitation.issue_token()
    assert len(raw) >= 40


@pytest.mark.security
def test_session_token_is_stored_only_as_a_hash(actor):
    from apps.identity_access.models import Session

    a = actor()
    stored = Session.objects.get(pk=a.session.pk)
    assert stored.token_hash != a.token
    assert Session.hash_token(a.token) == stored.token_hash


def test_zero_workspace_login_succeeds(make_user, api):
    """A user with no workspace can log in; the session simply has none."""
    make_user(email="lonely@example.test", password="correct-horse-battery")
    response = api.post(
        "/api/v1/auth/login",
        {"email": "lonely@example.test", "password": "correct-horse-battery"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["has_workspace"] is False
    assert response.json()["active_workspace_ref"] is None


def test_workspace_scoped_request_without_a_workspace_is_404(make_user, make_session, api):
    from rest_framework.test import APIClient

    user = make_user(email="nows@example.test")
    _session, token = make_session(user, None)
    client = APIClient()
    client.credentials(HTTP_X_SESSION_TOKEN=token)

    response = client.get("/api/v1/leads")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WORKSPACE_NOT_FOUND"


def test_unverified_email_blocks_workspace_operations(make_user, make_workspace, make_session):
    from rest_framework.test import APIClient

    user = make_user(email="unverified@example.test", verified=False)
    workspace, _membership = make_workspace(user)
    _session, token = make_session(user, workspace)

    client = APIClient()
    client.credentials(HTTP_X_SESSION_TOKEN=token)
    response = client.get("/api/v1/leads")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "EMAIL_VERIFICATION_REQUIRED"


def test_suspended_membership_is_refused(actor, auth_client):
    a = actor()
    a.membership.status = "suspended"
    a.membership.save(update_fields=["status"])

    response = auth_client(a).get("/api/v1/leads")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MEMBERSHIP_INACTIVE"


def test_removed_membership_does_not_disclose_the_workspace(actor, auth_client):
    """A removed member must get WORKSPACE_NOT_FOUND, never MEMBERSHIP_INACTIVE,
    so removal cannot be distinguished from non-existence."""
    a = actor()
    a.membership.status = "removed"
    a.membership.save(update_fields=["status"])

    response = auth_client(a).get("/api/v1/leads")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "WORKSPACE_NOT_FOUND"


def test_role_change_rank_guards(actor):
    from apps.workspaces.models import Membership
    from apps.workspaces.services import change_member_role
    from common.errors import PermissionDeniedError

    owner = actor()
    from apps.accounts.models import User

    target_user = User.objects.create_user(email="t@example.test", password="x" * 14)
    target = Membership.objects.create(
        workspace=owner.workspace, user=target_user, role="admin", status="active"
    )

    # Owner may demote an admin.
    changed = change_member_role(
        context=owner.context,
        membership_public_id=target.public_id,
        new_role="sales",
        expected_version=target.version,
    )
    assert changed.role == "sales"

    # Nobody may assign owner by role change: ownership is transferred.
    with pytest.raises(PermissionDeniedError):
        change_member_role(
            context=owner.context,
            membership_public_id=target.public_id,
            new_role="owner",
            expected_version=changed.version,
        )


def test_self_role_change_is_refused(actor):
    from apps.workspaces.services import change_member_role
    from common.errors import PermissionDeniedError

    a = actor()
    with pytest.raises(PermissionDeniedError):
        change_member_role(
            context=a.context,
            membership_public_id=a.membership.public_id,
            new_role="admin",
            expected_version=a.membership.version,
        )


def test_manager_cannot_invite_at_or_above_own_rank(actor, delivered):
    from apps.workspaces.services import invite_member
    from common.errors import PermissionDeniedError

    manager = actor(email="mgr@example.test", role="manager")
    with pytest.raises(PermissionDeniedError):
        invite_member(context=manager.context, email="x@example.test", role="admin")

    invitation = invite_member(context=manager.context, email="ok@example.test", role="member")
    assert invitation.role == "member"


def test_invitation_accept_binds_to_the_invited_address(actor, make_user, delivered):
    from apps.workspaces.services import accept_invitation, invite_member
    from common.errors import PermissionDeniedError

    a = actor()
    invite_member(context=a.context, email="invited@example.test", role="member")
    # The raw token reaches the invitee ONLY through the delivery boundary.
    raw = delivered.token_for("invitation")

    wrong = make_user(email="someoneelse@example.test")
    with pytest.raises(PermissionDeniedError):
        accept_invitation(user=wrong, raw_token=raw)

    right = make_user(email="invited@example.test")
    membership = accept_invitation(user=right, raw_token=raw)
    assert membership.role == "member"


def test_session_revocation_takes_effect_immediately(actor, auth_client):
    a = actor()
    client = auth_client(a)
    assert client.get("/api/v1/leads").status_code == 200
    client.post("/api/v1/auth/logout", format="json")
    assert client.get("/api/v1/leads").status_code == 401


def test_login_does_not_distinguish_bad_user_from_bad_password(make_user, api):
    make_user(email="real@example.test", password="correct-horse-battery")
    missing = api.post(
        "/api/v1/auth/login", {"email": "nobody@example.test", "password": "whatever12345"}, format="json"
    )
    wrong = api.post(
        "/api/v1/auth/login", {"email": "real@example.test", "password": "wrongpassword12"}, format="json"
    )
    assert missing.status_code == wrong.status_code == 401

    # Identical in every disclosing field. request_id differs by design: it is a
    # per-request correlation id and carries no information about the account.
    def disclosing(response):
        error = response.json()["error"]
        return {k: v for k, v in error.items() if k != "request_id"}

    assert disclosing(missing) == disclosing(wrong)
    assert disclosing(missing)["code"] == "AUTH_REQUIRED"
