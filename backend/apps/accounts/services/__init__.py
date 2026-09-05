"""accounts commands — the only write path for users and credentials."""

from __future__ import annotations

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from common.errors import DomainConflict, ValidationFailed

from ..models import User, UserCredential, UserEmailToken


@transaction.atomic
def register_user(*, email: str, password: str, full_name: str = "") -> tuple[User, str]:
    """Register. Returns the user and the RAW verification token (returned once)."""
    normalized = (email or "").strip().lower()
    if not normalized:
        raise ValidationFailed("An email address is required.")
    if len(password or "") < 12:
        raise ValidationFailed("The password must be at least 12 characters.")
    if User.objects.filter(email=normalized).exists():
        raise DomainConflict("An account with that email already exists.")

    user = User.objects.create_user(email=normalized, password=password, full_name=full_name)
    UserCredential.objects.create(user=user, password_hash=user.password)
    _token, raw = UserEmailToken.issue(user, "verify_email")
    return user, raw


@transaction.atomic
def verify_email(*, raw_token: str) -> User:
    token = (
        UserEmailToken.objects.select_related("user")
        .filter(token_hash=UserEmailToken.hash_token(raw_token), purpose="verify_email")
        .first()
    )
    if token is None or not token.is_usable():
        raise ValidationFailed("This verification link is not valid.")

    token.consumed_at = timezone.now()
    token.save(update_fields=["consumed_at", "updated_at"])

    user = token.user
    if user.email_verified_at is None:
        user.email_verified_at = timezone.now()
        user.save(update_fields=["email_verified_at", "updated_at"])
    return user


@transaction.atomic
def change_password(*, user: User, current_password: str, new_password: str) -> User:
    if not check_password(current_password, user.password):
        raise ValidationFailed("The current password is incorrect.")
    if len(new_password or "") < 12:
        raise ValidationFailed("The password must be at least 12 characters.")

    UserCredential.objects.filter(user=user, retired_at__isnull=True).update(retired_at=timezone.now())
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    UserCredential.objects.create(user=user, password_hash=user.password)
    return user


def authenticate(*, email: str, password: str) -> User | None:
    """Credential check. Returns None on ANY failure — the caller must not
    distinguish 'no such user' from 'wrong password'."""
    user = User.objects.filter(email=(email or "").strip().lower()).first()
    if user is None:
        make_password(password or "")  # constant-ish work; do not leak by timing
        return None
    if user.status != "active":
        return None
    if not check_password(password or "", user.password):
        return None
    return user


__all__ = ["register_user", "verify_email", "change_password", "authenticate"]
