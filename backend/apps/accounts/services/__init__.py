"""accounts commands — the only write path for users and credentials."""

from __future__ import annotations

from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from common.delivery import ACCOUNT_EXISTS, VERIFY_EMAIL, deliver_credential, new_command_id
from common.errors import ValidationFailed

from ..models import User, UserCredential, UserEmailToken


def _notify_account_exists(normalized_email: str, command_id: str) -> None:
    """The frozen duplicate branch: notify the address owner, create nothing.

    This travels the same seam as a real verification, so the two branches are
    indistinguishable to the caller — only the mailbox owner learns which one
    happened, which is exactly the property the anti-enumeration control buys.
    """
    existing = User.objects.filter(email=normalized_email).only("public_id").first()
    deliver_credential(
        kind=ACCOUNT_EXISTS,
        subject_ref=existing.public_id if existing is not None else "",
        command_id=command_id,
    )


@transaction.atomic
def register_user(*, email: str, password: str, full_name: str = "") -> None:
    """RegisterUser — frozen B1_AUTH_SESSION_DESIGN §3.7.

    Returns NOTHING. The raw verification token leaves this transaction only
    through the out-of-band delivery boundary: it is returned to the caller
    zero times, not once (B1-D-A19), and the row stores sha256 only.

    Both branches — fresh address and already-registered — end in the same
    silent success, so an unauthenticated caller cannot learn from the status
    code, body, error code, message or response shape whether an account
    exists. Input validation runs FIRST and identically in both branches, so a
    malformed request is not an oracle either.
    """
    normalized = (email or "").strip().lower()
    if not normalized:
        raise ValidationFailed("An email address is required.")
    if len(password or "") < 12:
        raise ValidationFailed("The password must be at least 12 characters.")

    command_id = new_command_id()

    if User.objects.filter(email=normalized).exists():
        _notify_account_exists(normalized, command_id)
        return None

    try:
        # Inner block so the unique-index race leaves the outer transaction
        # usable; R15 requires the loser to return the same 202 and create
        # nothing.
        with transaction.atomic():
            user = User.objects.create_user(email=normalized, password=password, full_name=full_name)
            UserCredential.objects.create(user=user, password_hash=user.password)
            _token, raw = UserEmailToken.issue(user, "verify_email")
    except IntegrityError:
        if not User.objects.filter(email=normalized).exists():
            raise  # not the email-uniqueness race; never swallow a real fault
        _notify_account_exists(normalized, command_id)
        return None

    deliver_credential(
        kind=VERIFY_EMAIL, subject_ref=user.public_id, raw_token=raw, command_id=command_id
    )
    return None


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
