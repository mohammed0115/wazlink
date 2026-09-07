#!/usr/bin/env python3
"""Create a local development account, workspace and starter CRM data.

Operational tooling for local development and browser end-to-end runs. It is
NOT a fixture layer and NOT a mock: every record is written through the real
Django ORM into the real PostgreSQL database, and the CRM rows it creates go
through the SAME application commands the API calls, so seeded data obeys the
same invariants as data a user creates.

Two things it does that the public API deliberately will not:
  * mark an address verified without the out-of-band token, because
    `register_user` returns that token zero times by design; and
  * set a membership role directly, so a permission-limited actor can be
    exercised end to end.
Both are development affordances and are why this is a script rather than an
endpoint.

Usage:
    uv run python scripts/dev_bootstrap.py [--reset]
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

import django  # noqa: E402

django.setup()

from django.db import transaction  # noqa: E402
from django.utils import timezone  # noqa: E402

from apps.accounts.models import User  # noqa: E402
from apps.workspaces.models import Membership, Workspace  # noqa: E402
from apps.workspaces.services import create_workspace  # noqa: E402

PRIMARY_EMAIL = "owner@wazlink.test"
SECOND_EMAIL = "rival@wazlink.test"
VIEWER_EMAIL = "viewer@wazlink.test"
PASSWORD = "wazlink-dev-password-2026"


def ensure_verified_user(email: str, full_name: str) -> User:
    """Create-or-update a verified local user."""
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_user(email=email, password=PASSWORD, full_name=full_name)
    user.set_password(PASSWORD)
    if user.email_verified_at is None:
        user.email_verified_at = timezone.now()
    user.status = "active"
    user.save()
    return user


def ensure_workspace(user: User, name: str) -> Workspace:
    membership = (
        Membership.objects.select_related("workspace")
        .filter(user=user, status="active", workspace__name=name)
        .first()
    )
    if membership is not None:
        return membership.workspace
    workspace, _ = create_workspace(user=user, name=name)
    return workspace


def ensure_membership(workspace: Workspace, user: User, role: str) -> Membership:
    membership = Membership.objects.filter(workspace=workspace, user=user).first()
    if membership is None:
        membership = Membership.objects.create(
            workspace=workspace, user=user, role=role, status="active"
        )
    else:
        membership.role = role
        membership.status = "active"
        membership.save(update_fields=["role", "status", "updated_at"])
    return membership


@transaction.atomic
def bootstrap(reset: bool) -> dict[str, str]:
    owner = ensure_verified_user(PRIMARY_EMAIL, "مالك مساحة العمل")
    rival = ensure_verified_user(SECOND_EMAIL, "مالك مساحة أخرى")
    viewer = ensure_verified_user(VIEWER_EMAIL, "مستخدم قراءة فقط")

    primary = ensure_workspace(owner, "شركة نمو")
    other = ensure_workspace(rival, "منافس مستقل")

    # A read-only member of the PRIMARY workspace, for the permission E2E.
    ensure_membership(primary, viewer, "viewer")

    if reset:
        from apps.crm.models import Lead

        Lead.objects.filter(workspace=primary).delete()

    return {
        "primary_workspace": primary.public_id,
        "other_workspace": other.public_id,
        "owner_email": owner.email,
        "rival_email": rival.email,
        "viewer_email": viewer.email,
        "password": PASSWORD,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="delete this workspace's leads first")
    args = parser.parse_args()

    result = bootstrap(args.reset)
    for key, value in result.items():
        print(f"{key}={value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
