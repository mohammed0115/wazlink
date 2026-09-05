"""customers (L6) — the COMMERCIAL PARTY (GAP-001).

Customer is the commercial party. There is deliberately NO second
commercial-party aggregate named Account. Contact remains the human
reachability identity and keeps phone/email truth — no PII moves here.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

PARTY_KINDS = ("organization", "person")
ORIGIN_KINDS = ("manual", "import", "api", "conversion", "discovery")


class Customer(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "CUS"

    STATUS_CHOICES = [("active", "active"), ("archived", "archived")]

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="customers")
    # party_kind is IMMUTABLE after creation (enforced in UpdateCustomer).
    party_kind = models.CharField(max_length=20, choices=[(k, k) for k in PARTY_KINDS])
    name = models.CharField(max_length=250)
    origin_kind = models.CharField(max_length=20, choices=[(o, o) for o in ORIGIN_KINDS], default="manual")
    # Optional: a Track-B Customer has NO Business and none is fabricated.
    business = models.ForeignKey(
        "discovery.Business",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="customers",
    )
    converted_from_lead = models.ForeignKey(
        "crm.Lead",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_customers",
    )
    owner_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="owned_customers"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "customers"
        constraints = [
            # A Lead converts at most once (idempotency / duplicate protection).
            models.UniqueConstraint(
                fields=["converted_from_lead"],
                condition=Q(converted_from_lead__isnull=False),
                name="uq_customer_per_converted_lead",
            ),
        ]
        indexes = [models.Index(fields=["workspace", "status", "name"])]

    def __str__(self) -> str:
        return self.public_id


class CustomerContact(TimestampedModel):
    """Owned by `customers` (B14_03 §3 row 15, V-M02 settled).

    CUS-3: a `person` Customer has EXACTLY ONE Contact — the link cannot be
    removed if it is the sole Contact, and a second cannot be added.
    """

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="customer_contacts"
    )
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="customer_contacts")
    contact = models.ForeignKey("crm.Contact", on_delete=models.RESTRICT, related_name="customer_links")
    is_primary = models.BooleanField(default=False)
    unlinked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "customer_contacts"
        constraints = [
            models.UniqueConstraint(
                fields=["customer"],
                condition=Q(is_primary=True, unlinked_at__isnull=True),
                name="uq_customer_single_primary_contact",
            ),
            models.UniqueConstraint(
                fields=["customer", "contact"],
                condition=Q(unlinked_at__isnull=True),
                name="uq_customer_contact_active_link",
            ),
        ]
