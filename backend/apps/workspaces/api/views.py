"""workspaces API — workspaces, members, invitations."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import authorize, resolve_in_workspace
from common.concurrency import parse_if_match
from common.errors import AuthRequired, ValidationFailed
from common.masking import mask_email
from common.views import WazlinkAPIView

from ..models import Membership, Workspace
from ..services import (
    accept_invitation,
    change_member_role,
    create_workspace,
    invite_member,
    switch_active_workspace,
)


def _workspace_payload(workspace: Workspace, membership: Membership | None = None) -> dict:
    payload = {
        "workspace_ref": workspace.public_id,
        "name": workspace.name,
        "slug": workspace.slug,
        "status": workspace.status,
        "version": workspace.version,
    }
    if membership is not None:
        payload["role"] = membership.role
    return payload


class WorkspaceListCreateView(WazlinkAPIView):
    """Listing a user's own workspaces is a pre-workspace operation, so it
    reads the session directly rather than the workspace-scoped pipeline."""

    def get(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None or not session.is_usable():
            raise AuthRequired("Authentication is required.")
        memberships = (
            Membership.objects.select_related("workspace")
            .filter(user=session.user, status="active")
            .order_by("created_at")
        )
        return Response({"items": [_workspace_payload(m.workspace, m) for m in memberships]})

    def post(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None or not session.is_usable():
            raise AuthRequired("Authentication is required.")
        if session.user.email_verified_at is None:
            from common.errors import EmailVerificationRequired

            raise EmailVerificationRequired("Email verification is required.")

        name = (request.data or {}).get("name", "")
        workspace, membership = create_workspace(user=session.user, name=name)

        # First workspace becomes active immediately.
        if session.active_workspace is None:
            session.active_workspace = workspace
            session.save(update_fields=["active_workspace", "updated_at"])

        return Response(_workspace_payload(workspace, membership), status=201)


class WorkspaceSwitchView(WazlinkAPIView):
    def post(self, request, workspace_ref: str):
        session = getattr(request, "wazlink_session", None)
        if session is None or not session.is_usable():
            raise AuthRequired("Authentication is required.")
        workspace = switch_active_workspace(session=session, workspace_public_id=workspace_ref)
        return Response({"active_workspace_ref": workspace.public_id})


class MemberListView(WazlinkAPIView):
    permission_code = "member.view"

    def get(self, request):
        context = self.context(request)
        rows = (
            Membership.objects.select_related("user")
            .filter(workspace=context.workspace)
            .exclude(status="removed")
            .order_by("created_at")
        )
        return Response(
            {
                "items": [
                    {
                        "membership_ref": row.public_id,
                        "user_ref": row.user.public_id,
                        "email": row.user.email,
                        "role": row.role,
                        "status": row.status,
                        "version": row.version,
                    }
                    for row in rows
                ]
            }
        )


def invitation_payload(invitation) -> dict:
    """The frozen `Invitation` DTO (B1_API_DTO_CONTRACTS §3).

    The raw token is NOT a field of this DTO and is returned by no operation.
    The address is `email_masked` on EVERY surface including creation, so one
    response shape can never leak what another masks.
    """
    return {
        "invitation_ref": invitation.public_id,
        "workspace_ref": invitation.workspace.public_id,
        "email_masked": mask_email(invitation.email),
        "role": invitation.role,
        "status": invitation.status,
        "invited_by": invitation.invited_by.public_id,
        "expires_at": invitation.expires_at,
        "accepted_at": invitation.accepted_at,
        "created_at": invitation.created_at,
        "version": invitation.version,
    }


class InvitationCreateView(WazlinkAPIView):
    permission_code = "member.invite"

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        invitation = invite_member(
            context=context, email=data.get("email", ""), role=data.get("role", "member")
        )
        return Response(invitation_payload(invitation), status=201)


class InvitationAcceptView(WazlinkAPIView):
    def post(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None or not session.is_usable():
            raise AuthRequired("Authentication is required.")
        token = (request.data or {}).get("token", "")
        if not token:
            raise ValidationFailed("An invitation token is required.")
        membership = accept_invitation(user=session.user, raw_token=token)
        return Response(
            {
                "membership_ref": membership.public_id,
                "role": membership.role,
                "workspace_ref": membership.workspace.public_id,
            },
            status=201,
        )


class MembershipRoleView(WazlinkAPIView):
    permission_code = "member.role.change"

    def patch(self, request, membership_ref: str):
        context = self.context(request)
        membership = change_member_role(
            context=context,
            membership_public_id=membership_ref,
            new_role=(request.data or {}).get("role", ""),
            expected_version=parse_if_match(request),
        )
        return Response(
            {"membership_ref": membership.public_id, "role": membership.role, "version": membership.version}
        )


__all__ = [
    "WorkspaceListCreateView",
    "WorkspaceSwitchView",
    "MemberListView",
    "InvitationCreateView",
    "InvitationAcceptView",
    "MembershipRoleView",
    "authorize",
    "resolve_in_workspace",
]
