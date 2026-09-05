"""workspaces commands — the only write path for tenancy."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import DomainConflict, EntityNotFound, PermissionDeniedError, ValidationFailed
from common.outbox import publish_event
from common.permissions_catalog import ROLE_RANK, WORKSPACE_ROLES

from ..models import Invitation, Membership, Workspace


def _unique_slug(name: str) -> str:
    base = slugify(name)[:180] or "workspace"
    candidate, suffix = base, 1
    while Workspace.objects.filter(slug=candidate).exists():
        suffix += 1
        candidate = f"{base}-{suffix}"
    return candidate


@transaction.atomic
def create_workspace(*, user, name: str) -> tuple[Workspace, Membership]:
    """Create a workspace. The creator becomes its Owner."""
    if not (name or "").strip():
        raise ValidationFailed("A workspace name is required.")

    workspace = Workspace.objects.create(name=name.strip(), slug=_unique_slug(name))
    membership = Membership.objects.create(workspace=workspace, user=user, role="owner", status="active")
    write_audit(
        workspace=workspace,
        actor_membership=membership,
        action="workspace.created",
        target_type="workspace",
        target_ref=workspace.public_id,
        changed_fields=["name", "slug"],
    )
    return workspace, membership


@transaction.atomic
def invite_member(*, context, email: str, role: str) -> tuple[Invitation, str]:
    """Invite a member. Returns the invitation and the RAW token (once).

    The raw token is NEVER stored — only its hash.
    """
    normalized = (email or "").strip().lower()
    if not normalized:
        raise ValidationFailed("An email address is required.")
    if role not in WORKSPACE_ROLES:
        raise ValidationFailed("That role does not exist.")
    if role == "owner":
        raise PermissionDeniedError("An owner cannot be created by invitation.")

    # Rank guard: a manager may invite only below manager rank.
    if ROLE_RANK[role] >= context.membership.rank:
        raise PermissionDeniedError("You cannot invite at or above your own rank.")

    if Membership.objects.filter(
        workspace=context.workspace, user__email=normalized, status="active"
    ).exists():
        raise DomainConflict("That person is already a member of this workspace.")
    if Invitation.objects.filter(workspace=context.workspace, email=normalized, status="pending").exists():
        raise DomainConflict("An invitation for that address is already pending.")

    raw, token_hash = Invitation.issue_token()
    invitation = Invitation.objects.create(
        workspace=context.workspace,
        email=normalized,
        role=role,
        token_hash=token_hash,
        invited_by=context.membership,
        expires_at=Invitation.default_expiry(),
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="invitation.created",
        target_type="invitation",
        target_ref=invitation.public_id,
        changed_fields=["email", "role"],
    )
    return invitation, raw  # the raw token never touches the database


@transaction.atomic
def accept_invitation(*, user, raw_token: str) -> Membership:
    invitation = (
        Invitation.objects.select_for_update()
        .select_related("workspace")
        .filter(token_hash=Invitation.hash_token(raw_token))
        .first()
    )
    if invitation is None or not invitation.is_pending():
        raise ValidationFailed("This invitation is not valid.")
    if invitation.email != user.email:
        raise PermissionDeniedError("This invitation was issued to a different address.")

    membership, created = Membership.objects.get_or_create(
        workspace=invitation.workspace,
        user=user,
        defaults={"role": invitation.role, "status": "active"},
    )
    if not created and membership.status != "active":
        membership.status = "active"
        membership.role = invitation.role
        membership.save(update_fields=["status", "role", "updated_at"])

    invitation.status = "accepted"
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["status", "accepted_at", "updated_at"])

    write_audit(
        workspace=invitation.workspace,
        actor_membership=membership,
        action="invitation.accepted",
        target_type="membership",
        target_ref=membership.public_id,
    )
    return membership


@transaction.atomic
def change_member_role(
    *, context, membership_public_id: str, new_role: str, expected_version: int | None
) -> Membership:
    if new_role not in WORKSPACE_ROLES:
        raise ValidationFailed("That role does not exist.")
    if new_role == "owner":
        raise PermissionDeniedError("Ownership is transferred, never assigned.")

    target = (
        Membership.objects.select_for_update()
        .filter(workspace=context.workspace, public_id=membership_public_id)
        .first()
    )
    if target is None:
        raise EntityNotFound("The requested resource was not found.")
    if target.id == context.membership.id:
        raise PermissionDeniedError("You cannot change your own role.")

    require_version(target, expected_version)

    # Rank guards: actor rank must exceed both the current and the new rank.
    if context.membership.rank <= target.rank or context.membership.rank <= ROLE_RANK[new_role]:
        raise PermissionDeniedError("You cannot change a role at or above your own rank.")

    before = target.role
    target.role = new_role
    bump_version(target)
    target.save(update_fields=["role", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="membership.role_changed",
        target_type="membership",
        target_ref=target.public_id,
        changed_fields=["role"],
        metadata={"before": before, "after": new_role},
    )
    publish_event(
        workspace=context.workspace,
        event_type="MembershipRoleChanged",
        aggregate_type="membership",
        aggregate_ref=target.public_id,
        payload={"role": new_role},
    )
    return target


@transaction.atomic
def switch_active_workspace(*, session, workspace_public_id: str) -> Workspace:
    """Switch the session's active workspace.

    Authority comes from a live membership; a workspace the user is not a
    member of resolves 404 and never confirms its existence.
    """
    membership = (
        Membership.objects.select_related("workspace")
        .filter(user=session.user, workspace__public_id=workspace_public_id, status="active")
        .first()
    )
    if membership is None:
        raise EntityNotFound("The requested resource was not found.")

    session.active_workspace = membership.workspace
    session.save(update_fields=["active_workspace", "updated_at"])
    return membership.workspace


__all__ = [
    "create_workspace",
    "invite_member",
    "accept_invitation",
    "change_member_role",
    "switch_active_workspace",
]
