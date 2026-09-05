"""identity_access API — login, logout, sessions."""

from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from common.authentication import SESSION_COOKIE
from common.errors import AuthRequired

from ..services import login, logout, revoke_all_sessions, revoke_session


def _session_payload(session, raw_token: str | None = None) -> dict:
    workspace = session.active_workspace
    payload = {
        "session_ref": session.public_id,
        "user": {
            "user_ref": session.user.public_id,
            "email": session.user.email,
            "email_verified": session.user.is_email_verified,
        },
        # A zero-workspace session is valid and says so explicitly.
        "active_workspace_ref": workspace.public_id if workspace else None,
        "has_workspace": workspace is not None,
    }
    if raw_token:
        payload["session_token"] = raw_token
    return payload


class LoginView(APIView):
    authentication_classes: list = []

    def post(self, request):
        data = request.data or {}
        session, raw = login(request=request, email=data.get("email", ""), password=data.get("password", ""))
        response = Response(_session_payload(session, raw))
        response.set_cookie(
            SESSION_COOKIE,
            raw,
            httponly=True,
            samesite="Lax",
            secure=request.is_secure(),
        )
        return response


class LogoutView(APIView):
    def post(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None:
            raise AuthRequired("Authentication is required.")
        logout(session=session)
        response = Response({"status": "logged_out"})
        response.delete_cookie(SESSION_COOKIE)
        return response


class SessionListView(APIView):
    def get(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None:
            raise AuthRequired("Authentication is required.")
        from ..models import Session

        rows = Session.objects.filter(user=session.user, status="active").order_by("-created_at")
        return Response(
            {
                "items": [
                    {
                        "session_ref": row.public_id,
                        "created_at": row.created_at,
                        "last_seen_at": row.last_seen_at,
                        "current": row.id == session.id,
                    }
                    for row in rows
                ]
            }
        )


class SessionRevokeView(APIView):
    def delete(self, request, session_ref: str):
        session = getattr(request, "wazlink_session", None)
        if session is None:
            raise AuthRequired("Authentication is required.")
        revoke_session(user=session.user, session_public_id=session_ref)
        return Response(status=204)


class SessionRevokeAllView(APIView):
    def post(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None:
            raise AuthRequired("Authentication is required.")
        count = revoke_all_sessions(user=session.user, keep=session)
        return Response({"revoked": count})
