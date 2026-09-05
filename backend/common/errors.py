"""Frozen B0 error envelope and the DRF exception handler.

The envelope NEVER leaks internal IDs, SQL, stack traces, or the existence of
another workspace's object.
"""

from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


class WazlinkError(APIException):
    """Base for every domain error carrying a frozen error code."""

    status_code = status.HTTP_400_BAD_REQUEST
    error_code = "INVALID_REQUEST"

    def __init__(self, message: str | None = None, details: dict[str, Any] | None = None):
        self.message = message or self.__class__.__doc__ or self.error_code
        self.details = details or {}
        super().__init__(self.message)


class AuthRequired(WazlinkError):
    """Authentication is required."""

    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "AUTH_REQUIRED"


class SessionRevoked(WazlinkError):
    """This session is no longer active."""

    status_code = status.HTTP_401_UNAUTHORIZED
    error_code = "SESSION_REVOKED"


class EmailVerificationRequired(WazlinkError):
    """Email verification is required."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "EMAIL_VERIFICATION_REQUIRED"


class WorkspaceNotFound(WazlinkError):
    """No workspace resolves for this request."""

    status_code = status.HTTP_404_NOT_FOUND
    error_code = "WORKSPACE_NOT_FOUND"


class MembershipInactive(WazlinkError):
    """This membership is not active."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "MEMBERSHIP_INACTIVE"


class WorkspaceInactive(WazlinkError):
    """This workspace state does not permit the operation."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "WORKSPACE_INACTIVE"


class PermissionDeniedError(WazlinkError):
    """The role does not grant this operation."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "PERMISSION_DENIED"


class EntityNotFound(WazlinkError):
    """The target is not visible within the active workspace."""

    status_code = status.HTTP_404_NOT_FOUND
    error_code = "ENTITY_NOT_FOUND"


class EntitlementLocked(WazlinkError):
    """The workspace plan does not include this capability."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "ENTITLEMENT_LOCKED"


class QuotaExhausted(WazlinkError):
    """No allowance remains for this metric and period."""

    status_code = status.HTTP_403_FORBIDDEN
    error_code = "QUOTA_EXHAUSTED"


class StaleVersion(WazlinkError):
    """The supplied version does not match the current version."""

    status_code = status.HTTP_409_CONFLICT
    error_code = "STALE_VERSION"


class IdempotencyConflict(WazlinkError):
    """This idempotency key was reused with a different request body."""

    status_code = status.HTTP_409_CONFLICT
    error_code = "IDEMPOTENCY_CONFLICT"


class ValidationFailed(WazlinkError):
    """The request failed validation."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "VALIDATION_FAILED"


class DomainConflict(WazlinkError):
    """A domain invariant refused this operation."""

    status_code = status.HTTP_409_CONFLICT
    error_code = "CONFLICT"


def build_envelope(
    code: str, message: str, details: dict[str, Any] | None = None, request_id: str = ""
) -> dict[str, Any]:
    """The frozen B0 error envelope."""
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": request_id,
        }
    }


def wazlink_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    request = context.get("request")
    request_id = getattr(request, "request_id", "") if request is not None else ""

    if isinstance(exc, WazlinkError):
        return Response(
            build_envelope(exc.error_code, exc.message, exc.details, request_id),
            status=exc.status_code,
        )

    # A bare 404 must never disclose whether the object exists in another tenant.
    if isinstance(exc, Http404):
        return Response(
            build_envelope("ENTITY_NOT_FOUND", "The requested resource was not found.", {}, request_id),
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, PermissionDenied):
        return Response(
            build_envelope("PERMISSION_DENIED", "This operation is not permitted.", {}, request_id),
            status=status.HTTP_403_FORBIDDEN,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    if isinstance(detail, dict) and "error" in detail:
        return response

    code = "VALIDATION_FAILED" if response.status_code == 400 else "REQUEST_FAILED"
    if response.status_code == 400:
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    response.data = build_envelope(
        code,
        "The request could not be processed.",
        {"fields": detail} if isinstance(detail, dict) else {},
        request_id,
    )
    return response
