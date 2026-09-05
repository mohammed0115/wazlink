"""The frozen 16-step B1 authorization pipeline — implemented ONCE, here.

Ordering is frozen and load-bearing. No authorization decision is cached
(B1-D-006): membership, role and matrix are read per request inside the
request transaction.

Three rules with no exception:
  1. The client NEVER supplies its role, workspace or permissions.
  2. Masking is server-side, in the selector, before serialization.
  3. The frontend grants no authorization.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .errors import (
    AuthRequired,
    EmailVerificationRequired,
    EntitlementLocked,
    EntityNotFound,
    MembershipInactive,
    PermissionDeniedError,
    QuotaExhausted,
    SessionRevoked,
    WorkspaceInactive,
    WorkspaceNotFound,
)
from .party360.contracts import ActorContext, WorkspaceRef
from .permissions_catalog import grants, is_conditional, permissions_for_role
from .ports import ports

# Operations that may proceed without a verified email (step 4 exemption list).
VERIFICATION_EXEMPT = frozenset(
    {
        "auth.logout",
        "auth.verify_email",
        "auth.resend_verification",
        "auth.password.change",
        "session.self.manage",
    }
)


@dataclass
class AuthorizationContext:
    """The resolved result of the pipeline. Server-derived in full."""

    user: Any
    session: Any
    workspace: Any
    membership: Any
    role: str
    permissions: frozenset[str]

    @property
    def actor(self) -> ActorContext:
        return ActorContext(
            user_id=self.user.id,
            membership_id=self.membership.id,
            workspace_id=self.workspace.id,
            role=self.role,
            permissions=self.permissions,
        )

    @property
    def workspace_ref(self) -> WorkspaceRef:
        return WorkspaceRef(id=self.workspace.id, public_id=self.workspace.public_id)

    def has(self, permission: str) -> bool:
        return permission in self.permissions


def authorize(
    request: Any, permission: str | None = None, *, operation: str = "", safety_class: str = "normal"
) -> AuthorizationContext:
    """Run steps 1-12 of the frozen pipeline.

    Steps 13-16 (concurrency, idempotency, domain invariant, allow+audit+outbox)
    are enforced by the command itself, which owns that state.
    """
    # --- 1. Authenticated -------------------------------------------------
    session = getattr(request, "wazlink_session", None)
    if session is None:
        raise AuthRequired("Authentication is required.")

    # --- 2. Session valid -------------------------------------------------
    if not session.is_usable():
        raise SessionRevoked("This session is no longer active.")

    user = session.user

    # --- 3. User usable ---------------------------------------------------
    if user.status != "active":
        raise AuthRequired("Authentication is required.")

    # --- 4. Email verified (unless exempt) --------------------------------
    if user.email_verified_at is None and operation not in VERIFICATION_EXEMPT:
        raise EmailVerificationRequired("Email verification is required.")

    # --- 5. Workspace resolved --------------------------------------------
    # Derived from sessions.active_workspace_id. A client-supplied workspace_id
    # is NEVER read (FI-B0-07). A no-workspace session terminates here.
    workspace = session.active_workspace
    if workspace is None:
        raise WorkspaceNotFound("No active workspace for this session.")

    # --- 6. Membership active ---------------------------------------------
    # Resolved through the class B membership port: common/ imports nothing
    # from apps/ (rule 3, T-ARCH-8).
    membership = ports.require("membership").resolve(workspace, user)
    if membership is None or membership.status == "removed":
        # Never disclose that the workspace exists.
        raise WorkspaceNotFound("No active workspace for this session.")
    if membership.status == "suspended":
        raise MembershipInactive("This membership is suspended.")

    # --- 7. Workspace state ------------------------------------------------
    if workspace.status != "active" and safety_class != "read_only":
        raise WorkspaceInactive("This workspace state does not permit the operation.")

    role = membership.role
    permissions = permissions_for_role(role)

    context = AuthorizationContext(
        user=user,
        session=session,
        workspace=workspace,
        membership=membership,
        role=role,
        permissions=permissions,
    )

    # --- 8. RBAC permission ------------------------------------------------
    if permission is not None and not grants(permission, role):
        raise PermissionDeniedError("This operation is not permitted.")

    return context


def require_permission(context: AuthorizationContext, permission: str) -> None:
    """Step 8, applied to an already-resolved context."""
    if not grants(permission, context.role):
        raise PermissionDeniedError("This operation is not permitted.")


def resolve_in_workspace(queryset: Any, context: AuthorizationContext, **lookup: Any) -> Any:
    """Step 9 — tenant-scoped object resolution. THE IDOR CONTROL.

    A cross-workspace reference resolves to 404 ENTITY_NOT_FOUND, never 400 and
    never 403 (Doctrine R-2): a 403 would confirm the object exists.
    """
    instance = queryset.filter(workspace=context.workspace, **lookup).first()
    if instance is None:
        raise EntityNotFound("The requested resource was not found.")
    return instance


def enforce_object_condition(
    context: AuthorizationContext, permission: str, *, owner_membership_id: Any = None
) -> None:
    """Step 10 — object-level condition for CONDITIONAL grants.

    A conditional cell means: allowed only after the stated object condition
    passes. For ownership-scoped grants that condition is own-record scope.
    """
    if not is_conditional(permission, context.role):
        return
    if owner_membership_id is None:
        # Workspace-scope conditional: already satisfied by step 9.
        return
    if owner_membership_id != context.membership.id:
        raise PermissionDeniedError("This operation is not permitted.")


def check_entitlement(context: AuthorizationContext, capability: str) -> None:
    """Step 11 — entitlement, through the class B entitlement port."""
    decision = ports.require("entitlement").evaluate_entitlement(context.workspace, capability)
    if not decision.allowed:
        raise EntitlementLocked("This plan does not include the requested capability.")


def check_quota(context: AuthorizationContext, metric: str, amount: int = 1) -> None:
    """Step 12 — quota, through the class B entitlement port."""
    decision = ports.require("entitlement").evaluate_quota(context.workspace, metric, amount)
    if not decision.allowed:
        raise QuotaExhausted("No allowance remains for this metric and period.")
