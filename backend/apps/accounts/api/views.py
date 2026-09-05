"""accounts API — registration, verification, password."""

from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from common.errors import AuthRequired, ValidationFailed

from ..services import change_password, register_user, verify_email


class RegisterView(APIView):
    authentication_classes: list = []

    def post(self, request):
        data = request.data or {}
        user, raw_token = register_user(
            email=data.get("email", ""),
            password=data.get("password", ""),
            full_name=data.get("full_name", ""),
        )
        # The raw token is delivered out of band in production. It is surfaced
        # here only so a local/test caller can complete the flow; it is never
        # written to the database and never logged.
        return Response(
            {
                "user": {
                    "user_ref": user.public_id,
                    "email": user.email,
                    "email_verified": user.is_email_verified,
                },
                "verification_token": raw_token,
            },
            status=201,
        )


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
