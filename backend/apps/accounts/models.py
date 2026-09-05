"""accounts (L1) — the user identity root. Owns users, credentials, email tokens."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone

from common.models import PublicIdModel, TimestampedModel


class UserManager(BaseUserManager):
    def create_user(self, email: str, password: str | None = None, **extra):
        if not email:
            raise ValueError("A user requires an email address.")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("email_verified_at", timezone.now())
        return self.create_user(email, password, **extra)


class User(PublicIdModel, TimestampedModel, AbstractBaseUser):
    PUBLIC_ID_PREFIX = "USER"

    STATUS_CHOICES = [("active", "active"), ("suspended", "suspended"), ("deleted", "deleted")]

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    email_verified_at = models.DateTimeField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.public_id

    @property
    def is_active(self) -> bool:
        return self.status == "active"

    @property
    def is_email_verified(self) -> bool:
        return self.email_verified_at is not None

    def has_perm(self, perm, obj=None) -> bool:  # Django admin only
        return self.is_superuser

    def has_module_perms(self, app_label) -> bool:  # Django admin only
        return self.is_superuser


class UserCredential(TimestampedModel):
    """Credential history, separate from the user row."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="credentials")
    password_hash = models.CharField(max_length=255)
    retired_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_credentials"


class UserEmailToken(TimestampedModel):
    """Email verification / password reset tokens.

    The RAW token is NEVER stored — only its hash. Entropy is not weakened.
    """

    PURPOSE_CHOICES = [("verify_email", "verify_email"), ("reset_password", "reset_password")]
    TOKEN_BYTES = 32

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="email_tokens")
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    token_hash = models.CharField(max_length=128, db_index=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "user_email_tokens"

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def issue(cls, user: User, purpose: str, ttl_hours: int = 24) -> tuple[UserEmailToken, str]:
        raw = secrets.token_urlsafe(cls.TOKEN_BYTES)
        token = cls.objects.create(
            user=user,
            purpose=purpose,
            token_hash=cls.hash_token(raw),
            expires_at=timezone.now() + timedelta(hours=ttl_hours),
        )
        return token, raw  # the raw value is returned once and never persisted

    def is_usable(self) -> bool:
        return self.consumed_at is None and self.expires_at > timezone.now()


__all__ = ["User", "UserCredential", "UserEmailToken", "check_password", "make_password"]
