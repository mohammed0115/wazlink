"""Shared API view base. Every endpoint runs the 16-step pipeline."""

from __future__ import annotations

from typing import Any

from rest_framework.views import APIView

from .authz import AuthorizationContext, authorize


class WazlinkAPIView(APIView):
    """Base view. Subclasses declare the permission their operation requires."""

    permission_code: str | None = None
    operation: str = ""
    safety_class: str = "normal"

    def context(self, request: Any, permission: str | None = None) -> AuthorizationContext:
        return authorize(
            request,
            permission if permission is not None else self.permission_code,
            operation=self.operation,
            safety_class=self.safety_class,
        )


def ok(data: Any, status: int = 200):
    from rest_framework.response import Response

    return Response(data, status=status)
