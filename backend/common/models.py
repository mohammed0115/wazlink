"""Shared model primitives. NO business rules live here."""

from __future__ import annotations

import uuid

from django.db import models

from .public_ids import generate_public_id


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class PublicIdModel(models.Model):
    """A model with an internal UUID PK and an immutable public identifier."""

    PUBLIC_ID_PREFIX: str = ""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    public_id = models.CharField(max_length=40, unique=True, editable=False)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.public_id:
            self.public_id = generate_public_id(self.PUBLIC_ID_PREFIX)
        return super().save(*args, **kwargs)


class VersionedModel(models.Model):
    """ADR-010 optimistic concurrency."""

    version = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True


class WorkspaceScopedModel(models.Model):
    """Every workspace-owned durable row carries its tenant column (CRM-INV-1)."""

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="+")

    class Meta:
        abstract = True
