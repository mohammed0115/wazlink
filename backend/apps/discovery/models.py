"""discovery (L4) — at I2 this is SCHEMA + UpsertBusiness normalization ONLY.

No job orchestration, no port, no adapter and no provider is reachable here
(T-MIG-6). Discovery FEATURES land at I3.
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel, VersionedModel


class Business(PublicIdModel, TimestampedModel, VersionedModel):
    """A discovered business. Owned by discovery; CRM never writes it (T-MIG-5)."""

    PUBLIC_ID_PREFIX = "BIZ"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="businesses"
    )
    name = models.CharField(max_length=250)
    city = models.CharField(max_length=120, blank=True)
    category = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    website = models.URLField(max_length=400, blank=True)
    merged_into = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="merged_from"
    )

    class Meta:
        db_table = "businesses"
        indexes = [models.Index(fields=["workspace", "name"])]


class BusinessIdentity(TimestampedModel):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="identities")
    identity_kind = models.CharField(max_length=40)
    identity_value = models.CharField(max_length=300)

    class Meta:
        db_table = "business_identities"
        constraints = [
            models.UniqueConstraint(
                fields=["business", "identity_kind", "identity_value"], name="uq_business_identity"
            ),
        ]


class DiscoveryJob(PublicIdModel, TimestampedModel, VersionedModel):
    """Schema only at I2. No job is created or executed before I3."""

    PUBLIC_ID_PREFIX = "DJOB"

    STATUS_CHOICES = [
        ("queued", "queued"),
        ("running", "running"),
        ("succeeded", "succeeded"),
        ("failed", "failed"),
        ("cancelled", "cancelled"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="discovery_jobs"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")
    requested_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="discovery_jobs"
    )

    class Meta:
        db_table = "discovery_jobs"


class DiscoveryQuery(TimestampedModel):
    job = models.ForeignKey(DiscoveryJob, on_delete=models.CASCADE, related_name="queries")
    term = models.CharField(max_length=300)
    location = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "discovery_queries"


class DiscoveryResult(TimestampedModel):
    job = models.ForeignKey(DiscoveryJob, on_delete=models.CASCADE, related_name="results")
    business = models.ForeignKey(
        Business, on_delete=models.RESTRICT, null=True, blank=True, related_name="results"
    )
    raw_payload = models.JSONField(default=dict)

    class Meta:
        db_table = "discovery_results"
