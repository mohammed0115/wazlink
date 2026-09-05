"""identity_access commands — login, logout, session revocation."""

from __future__ import annotations

from django.db import transaction

from common.errors import AuthRequired, EntityNotFound
from common.net import client_ip
from common.ports import ports

from ..models import Session


@transaction.atomic
def login(*, request, email: str, password: str) -> tuple[Session, str]:
    """Authenticate and open a session.

    Zero-workspace login SUCCEEDS: the session opens with
    active_workspace = NULL and the caller is told to create or join one.
    """
    from apps.accounts.services import authenticate  # L2 -> L1, downward

    user = authenticate(email=email, password=password)
    if user is None:
        # Never distinguish 'no such user' from 'wrong password'.
        raise AuthRequired("Those credentials are not valid.")

    # workspaces is the SAME layer (L2), so it cannot be imported. The initial
    # active workspace is resolved through the class B membership port, whose
    # implementation config/ binds. Zero-workspace login is a first-class
    # outcome: the session opens with active_workspace = NULL.
    workspace = ports.require("membership").initial_workspace_for(user)

    session, raw = Session.issue(
        user,
        active_workspace=workspace,
        ip_address=client_ip(request) or None,
        user_agent=request.headers.get("User-Agent", ""),
    )
    return session, raw


def logout(*, session: Session) -> None:
    session.revoke()


def revoke_session(*, user, session_public_id: str) -> Session:
    session = Session.objects.filter(user=user, public_id=session_public_id).first()
    if session is None:
        raise EntityNotFound("The requested resource was not found.")
    session.revoke()
    return session


def revoke_all_sessions(*, user, keep: Session | None = None) -> int:
    queryset = Session.objects.filter(user=user, status="active")
    if keep is not None:
        queryset = queryset.exclude(id=keep.id)
    count = 0
    for session in queryset:
        session.revoke()
        count += 1
    return count


__all__ = ["login", "logout", "revoke_session", "revoke_all_sessions"]
