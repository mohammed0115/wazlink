"""identity_access (L2) — the session registry."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

from common.models import PublicIdModel, TimestampedModel

IDLE_TIMEOUT = timedelta(hours=12)
ABSOLUTE_TIMEOUT = timedelta(days=14)


class SessionManager(models.Manager):
    def for_token(self, raw_token: str):
        """Resolve a raw token to a usable session, or None.

        The raw token is never stored; lookup is by hash.
        """
        if not raw_token:
            return None
        session = (
            self.select_related("user", "active_workspace")
            .filter(token_hash=Session.hash_token(raw_token))
            .first()
        )
        if session is None or not session.is_usable():
            return None
        return session


class Session(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "SESS"
    TOKEN_BYTES = 32

    STATUS_CHOICES = [("active", "active"), ("revoked", "revoked")]

    user = models.ForeignKey("accounts.User", on_delete=models.CASCADE, related_name="sessions")
    token_hash = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    # The ONLY source of workspace authority. A client-supplied workspace_id is
    # never read (FI-B0-07).
    active_workspace = models.ForeignKey(
        "workspaces.Workspace",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_sessions",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=400, blank=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    objects = SessionManager()

    class Meta:
        db_table = "sessions"

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def issue(cls, user, *, active_workspace=None, ip_address=None, user_agent="") -> tuple:
        raw = secrets.token_urlsafe(cls.TOKEN_BYTES)
        session = cls.objects.create(
            user=user,
            token_hash=cls.hash_token(raw),
            active_workspace=active_workspace,
            ip_address=ip_address,
            user_agent=user_agent[:400],
            expires_at=timezone.now() + ABSOLUTE_TIMEOUT,
        )
        return session, raw

    def is_usable(self) -> bool:
        if self.status != "active":
            return False
        now = timezone.now()
        if self.expires_at <= now:
            return False
        return self.last_seen_at + IDLE_TIMEOUT > now

    def revoke(self) -> None:
        self.status = "revoked"
        self.revoked_at = timezone.now()
        self.save(update_fields=["status", "revoked_at", "updated_at"])

    def touch(self) -> None:
        self.last_seen_at = timezone.now()
        self.save(update_fields=["last_seen_at", "updated_at"])
