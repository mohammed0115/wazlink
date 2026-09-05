"""workspaces (L2) — tenant root, memberships, invitations, role catalog."""

from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

from common.models import PublicIdModel, TimestampedModel, VersionedModel
from common.permissions_catalog import ROLE_RANK, WORKSPACE_ROLES


class Workspace(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "WS"

    STATUS_CHOICES = [
        ("active", "active"),
        ("suspended", "suspended"),
        ("archived", "archived"),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        db_table = "workspaces"

    def __str__(self) -> str:
        return self.public_id


class Role(TimestampedModel):
    """The frozen role catalog. Phase 1 has EXACTLY six roles; there is no
    role #7 and custom roles are deferred (B1-D-009)."""

    code = models.CharField(max_length=20, unique=True)
    rank = models.PositiveIntegerField()

    class Meta:
        db_table = "roles"
        ordering = ["-rank"]

    def __str__(self) -> str:
        return self.code

    @classmethod
    def seed(cls) -> None:
        for code in WORKSPACE_ROLES:
            cls.objects.update_or_create(code=code, defaults={"rank": ROLE_RANK[code]})


class MembershipQuerySet(models.QuerySet):
    def active(self):
        return self.filter(status="active")


class Membership(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "MEM"

    STATUS_CHOICES = [
        ("active", "active"),
        ("suspended", "suspended"),
        ("removed", "removed"),
    ]

    workspace = models.ForeignKey(Workspace, on_delete=models.RESTRICT, related_name="memberships")
    user = models.ForeignKey("accounts.User", on_delete=models.RESTRICT, related_name="memberships")
    role = models.CharField(max_length=20, choices=[(r, r) for r in WORKSPACE_ROLES])
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    objects = MembershipQuerySet.as_manager()

    class Meta:
        db_table = "memberships"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "user"], name="uq_membership_ws_user"),
        ]

    def __str__(self) -> str:
        return f"{self.public_id}:{self.role}"

    @property
    def rank(self) -> int:
        return ROLE_RANK.get(self.role, 0)


class Invitation(PublicIdModel, TimestampedModel, VersionedModel):
    """An invitation to join a workspace.

    The RAW token is NEVER stored in plaintext — only its hash (frozen B1
    token-security requirement). Entropy is 32 bytes and is not weakened.
    """

    PUBLIC_ID_PREFIX = "INV"
    TOKEN_BYTES = 32

    STATUS_CHOICES = [
        ("pending", "pending"),
        ("accepted", "accepted"),
        ("cancelled", "cancelled"),
        ("expired", "expired"),
    ]

    workspace = models.ForeignKey(Workspace, on_delete=models.RESTRICT, related_name="invitations")
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=[(r, r) for r in WORKSPACE_ROLES])
    token_hash = models.CharField(max_length=128, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    invited_by = models.ForeignKey(Membership, on_delete=models.RESTRICT, related_name="issued_invitations")
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "invitations"
        constraints = [
            # One pending invitation per (workspace, email).
            models.UniqueConstraint(
                fields=["workspace", "email"],
                condition=models.Q(status="pending"),
                name="uq_invitation_pending_ws_email",
            ),
        ]

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    @classmethod
    def issue_token(cls) -> tuple[str, str]:
        raw = secrets.token_urlsafe(cls.TOKEN_BYTES)
        return raw, cls.hash_token(raw)

    @classmethod
    def default_expiry(cls) -> timezone.datetime:
        return timezone.now() + timedelta(days=7)

    def is_pending(self) -> bool:
        return self.status == "pending" and self.expires_at > timezone.now()
