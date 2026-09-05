"""Session authentication, through the class B session port.

Authority is derived SERVER-SIDE from the session row. The client never
supplies its role, workspace or permissions.
"""

from __future__ import annotations

from typing import Any

from rest_framework.authentication import BaseAuthentication

from .ports import ports

SESSION_COOKIE = "wazlink_session"
SESSION_HEADER = "X-Session-Token"


class WazlinkSessionAuthentication(BaseAuthentication):
    def authenticate(self, request: Any):
        token = request.COOKIES.get(SESSION_COOKIE) or request.headers.get(SESSION_HEADER)
        if not token:
            return None

        session = ports.require("session").resolve(token)
        if session is None:
            return None

        request.wazlink_session = session
        return (session.user, session)
