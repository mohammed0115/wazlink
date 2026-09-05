"""Shared pytest fixtures."""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")


@pytest.fixture(autouse=True)
def _registries_populated():
    """The composition root populates the registries at app-ready time; this
    guarantees it for every test regardless of import order."""
    from config.registry import register_all

    register_all()
    yield


@pytest.fixture
def api():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def make_user(db):
    def _make(email="user@example.test", password="correct-horse-battery", verified=True):
        from django.utils import timezone

        from apps.accounts.models import User

        user = User.objects.create_user(email=email, password=password)
        if verified:
            user.email_verified_at = timezone.now()
            user.save(update_fields=["email_verified_at"])
        return user

    return _make


@pytest.fixture
def make_workspace(db):
    def _make(user, name="Acme", role="owner"):
        import uuid

        from django.utils.text import slugify

        from apps.workspaces.models import Membership, Workspace

        workspace = Workspace.objects.create(name=name, slug=f"{slugify(name)}-{uuid.uuid4().hex[:8]}")
        membership = Membership.objects.create(workspace=workspace, user=user, role=role, status="active")
        return workspace, membership

    return _make


@pytest.fixture
def make_session(db):
    def _make(user, workspace=None):
        from apps.identity_access.models import Session

        session, raw = Session.issue(user, active_workspace=workspace)
        return session, raw

    return _make


@pytest.fixture
def context_for(db):
    """Build an AuthorizationContext directly, for service-level tests."""

    def _make(user, workspace, membership):
        from common.authz import AuthorizationContext
        from common.permissions_catalog import permissions_for_role

        return AuthorizationContext(
            user=user,
            session=None,
            workspace=workspace,
            membership=membership,
            role=membership.role,
            permissions=permissions_for_role(membership.role),
        )

    return _make


@pytest.fixture
def actor(db, make_user, make_workspace, make_session, context_for):
    """A ready-to-use owner actor: user + workspace + membership + context."""

    class Actor:
        pass

    def _make(email="owner@example.test", role="owner", workspace_name="Acme"):
        user = make_user(email=email)
        workspace, membership = make_workspace(user, name=workspace_name, role=role)
        session, token = make_session(user, workspace)
        a = Actor()
        a.user, a.workspace, a.membership = user, workspace, membership
        a.session, a.token = session, token
        a.context = context_for(user, workspace, membership)
        return a

    return _make


@pytest.fixture
def auth_client(api):
    def _make(actor_obj):
        from rest_framework.test import APIClient

        client = APIClient()
        client.credentials(HTTP_X_SESSION_TOKEN=actor_obj.token)
        return client

    return _make
