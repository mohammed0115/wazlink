"""crm (L5) — the CRM aggregate root set (frozen B2).

CRM imports NEITHER messaging NOR pipeline. The merged timeline is composed by
analytics, not by crm (B14_03 §5e). crm supplies only its own crm_activities
entries through its TimelineEntryProvider.

Constraint state is the post-CA-01 / post-CA-15 target: this is a greenfield
schema with zero pre-existing Leads, so the amendments' target invariants are
the initial invariants. No Business, Job or provenance is ever fabricated.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.utils import timezone

from common.models import PublicIdModel, TimestampedModel, VersionedModel

# CA-01 target: origin_type widened from ('discovery') to five values.
ORIGIN_TYPES = ("discovery", "manual", "import", "api", "form")
LEAD_STATUSES = ("new", "contacted", "qualified", "unqualified", "nurturing")
LEAD_PRIORITIES = ("high", "medium", "low")


class Lead(PublicIdModel, TimestampedModel, VersionedModel):
    """The Lead aggregate.

    NOTE (frozen B2 §1, normative): name, company_name, city, category, phone,
    email and website are EXPLICITLY ABSENT from this table. A Business-less
    Lead gets its display identity from its primary Contact at READ TIME
    (CA-15) — no identifying attribute is ever copied onto this row.
    """

    PUBLIC_ID_PREFIX = "LEAD"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="leads")
    # CA-01: nullable. A manual Lead has NO Business and none is fabricated.
    business = models.ForeignKey(
        "discovery.Business",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="leads",
    )
    origin_type = models.CharField(max_length=20, choices=[(o, o) for o in ORIGIN_TYPES], default="manual")
    source_job = models.ForeignKey(
        "discovery.DiscoveryJob",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="converted_leads",
    )
    owner_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="owned_leads"
    )
    status = models.CharField(max_length=20, choices=[(s, s) for s in LEAD_STATUSES], default="new")
    priority = models.CharField(max_length=10, choices=[(p, p) for p in LEAD_PRIORITIES], default="medium")
    last_activity_at = models.DateTimeField(default=timezone.now)
    next_activity_at = models.DateTimeField(null=True, blank=True)
    # CA-01: nullable; required only for origin_type='discovery'.
    converted_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "leads"
        constraints = [
            # CA-01 target conditional invariants, enforced in the DATABASE.
            models.CheckConstraint(
                condition=~Q(origin_type="discovery") | Q(business__isnull=False),
                name="ck_lead_discovery_requires_business",
            ),
            models.CheckConstraint(
                condition=~Q(origin_type="discovery") | Q(converted_at__isnull=False),
                name="ck_lead_discovery_requires_converted_at",
            ),
            models.CheckConstraint(
                condition=(
                    Q(archived_at__isnull=True)
                    | Q(converted_at__isnull=True)
                    | Q(archived_at__gte=models.F("converted_at"))
                ),
                name="ck_lead_archived_after_converted",
            ),
            # CRM-INV-10, scoped by CA-01 to business_id IS NOT NULL.
            models.UniqueConstraint(
                fields=["workspace", "business"],
                condition=Q(archived_at__isnull=True, business__isnull=False),
                name="uq_lead_active_per_business",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "-last_activity_at"]),
        ]

    def __str__(self) -> str:
        return self.public_id

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    def touch_activity(self, when=None) -> None:
        """last_activity_at is MONOTONIC — it never moves backwards, even when
        events arrive out of order (GREATEST semantics)."""
        candidate = when or timezone.now()
        if self.last_activity_at is None or candidate > self.last_activity_at:
            self.last_activity_at = candidate


class LeadTag(TimestampedModel):
    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="lead_tags")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="tags")
    tag = models.CharField(max_length=40)
    created_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="created_lead_tags"
    )

    class Meta:
        db_table = "lead_tags"
        constraints = [
            models.UniqueConstraint(fields=["lead", "tag"], name="uq_lead_tag"),
        ]


class LeadProvenance(TimestampedModel):
    """Provenance snapshot for a DISCOVERY lead.

    A non-Discovery Lead gets NO provenance row. Fake provenance is never
    written (CA-01 negative control).
    """

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="provenance")
    source_kind = models.CharField(max_length=40)
    snapshot = models.JSONField(default=dict)

    class Meta:
        db_table = "lead_provenance"


class Contact(PublicIdModel, TimestampedModel, VersionedModel):
    """A human reachability identity. Owns phone/email truth.

    CRM-INV-18: there is deliberately NO unique index on phone or email — the
    same human may legitimately appear more than once and de-duplication is a
    human decision, not a constraint violation.
    """

    PUBLIC_ID_PREFIX = "CT"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="contacts")
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    title = models.CharField(max_length=120, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "contacts"
        indexes = [models.Index(fields=["workspace", "full_name"])]
        # NO unique index on phone/email (CRM-INV-18).

    def __str__(self) -> str:
        return self.public_id


class LeadContact(TimestampedModel):
    """Lead <-> Contact link carrying the primary flag.

    Partial unique (lead) WHERE is_primary AND unlinked_at IS NULL already
    guarantees AT MOST ONE primary Contact per Lead (frozen B2_CONTACT_MODEL §3).
    CA-15 adds the conditional AT LEAST ONE half for Business-less Leads, which
    is enforced in the command, not by a constraint.
    """

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="lead_contacts")
    contact = models.ForeignKey(Contact, on_delete=models.RESTRICT, related_name="lead_contacts")
    is_primary = models.BooleanField(default=False)
    unlinked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lead_contacts"
        constraints = [
            models.UniqueConstraint(
                fields=["lead"],
                condition=Q(is_primary=True, unlinked_at__isnull=True),
                name="uq_lead_single_primary_contact",
            ),
            models.UniqueConstraint(
                fields=["lead", "contact"],
                condition=Q(unlinked_at__isnull=True),
                name="uq_lead_contact_active_link",
            ),
        ]


class Task(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "TASK"

    STATUS_CHOICES = [
        ("open", "open"),
        ("completed", "completed"),
        ("cancelled", "cancelled"),
    ]

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="tasks")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="tasks")
    title = models.CharField(max_length=250)
    due_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    assignee_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="assigned_tasks"
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "tasks"
        indexes = [models.Index(fields=["workspace", "status", "due_at"])]

    @property
    def is_overdue(self) -> bool:
        """Overdue is DERIVED, never stored (frozen B2)."""
        return self.status == "open" and self.due_at is not None and self.due_at < timezone.now()


class Appointment(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "APPT"

    STATUS_CHOICES = [
        ("scheduled", "scheduled"),
        ("completed", "completed"),
        ("cancelled", "cancelled"),
        ("no_show", "no_show"),
    ]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="appointments"
    )
    lead = models.ForeignKey(
        Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="appointments"
    )
    title = models.CharField(max_length=250)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")
    owner_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="appointments"
    )

    class Meta:
        db_table = "appointments"
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=models.F("starts_at")),
                name="ck_appointment_ends_after_starts",
            ),
        ]
        indexes = [models.Index(fields=["workspace", "starts_at"])]


class Note(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "NOTE"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="notes")
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()
    author_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="notes"
    )

    class Meta:
        db_table = "notes"


class CrmActivity(PublicIdModel, TimestampedModel):
    """CRM-owned timeline entries. APPEND-ONLY.

    CRM-INV-13, PERMANENTLY: a cross-domain entry (Messaging, Pipeline) is
    NEVER copied into this table. The merged timeline is composed at read time
    by analytics; this table holds CRM's OWN entries and nothing else.
    """

    PUBLIC_ID_PREFIX = "ACT"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="crm_activities"
    )
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    subject_type = models.CharField(max_length=20, default="lead")
    subject_id = models.UUIDField(null=True, blank=True)
    activity_type = models.CharField(max_length=60)
    summary = models.CharField(max_length=400, blank=True)
    change = models.JSONField(default=dict)
    occurred_at = models.DateTimeField(default=timezone.now)
    actor_membership = models.ForeignKey(
        "workspaces.Membership",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="crm_activities",
    )

    class Meta:
        db_table = "crm_activities"
        ordering = ["-occurred_at", "-public_id"]
        indexes = [
            models.Index(fields=["workspace", "lead", "-occurred_at"]),
        ]
