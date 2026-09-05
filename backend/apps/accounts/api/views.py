"""accounts API — registration, verification, password."""

from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import AuthRequired, ValidationFailed

from ..services import change_password, register_user, verify_email


class RegisterView(APIView):
    """POST /auth/register — frozen `202 Empty` (B1_API_DTO_CONTRACTS §1).

    The response carries NO body: no user reference, no email echo, no
    verification state and — above all — no verification token. Registering a
    fresh address and registering one that already exists produce the identical
    202 with the identical empty body, which is the anti-enumeration control.
    """

    authentication_classes: list = []

    def post(self, request):
        data = request.data or {}
        register_user(
            email=data.get("email", ""),
            password=data.get("password", ""),
            full_name=data.get("full_name", ""),
        )
        return Response(status=202)


class VerifyEmailView(APIView):
    authentication_classes: list = []

    def post(self, request):
        token = (request.data or {}).get("token", "")
        if not token:
            raise ValidationFailed("A verification token is required.")
        user = verify_email(raw_token=token)
        return Response({"user_ref": user.public_id, "email_verified": True})


class ChangePasswordView(APIView):
    def post(self, request):
        session = getattr(request, "wazlink_session", None)
        if session is None:
            raise AuthRequired("Authentication is required.")
        data = request.data or {}
        change_password(
            user=session.user,
            current_password=data.get("current_password", ""),
            new_password=data.get("new_password", ""),
        )
        return Response({"status": "password_changed"})
