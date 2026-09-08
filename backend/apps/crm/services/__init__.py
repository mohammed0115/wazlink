"""crm commands — the only write path for the CRM aggregate.

crm imports NEITHER apps.messaging NOR apps.pipeline. It contributes only its
own crm_activities entries to the merged timeline, through the registry.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event

from ..models import Contact, CrmActivity, Lead, LeadContact, LeadTag, Note, Task

# Activity types that qualify as activity on the Lead (frozen B2 §4).
QUALIFYING = frozenset(
    {
        "LeadCreated",
        "LeadStatusChanged",
        "LeadPriorityChanged",
        "LeadOwnerChanged",
        "LeadTagAdded",
        "LeadTagRemoved",
        "ContactAdded",
        "ContactUpdated",
        "ContactRemoved",
        "TaskCreated",
        "TaskUpdated",
        "TaskAssigned",
        "TaskCompleted",
        "TaskCancelled",
        "AppointmentCreated",
        "AppointmentRescheduled",
        "AppointmentCancelled",
        "AppointmentCompleted",
        "AppointmentNoShowRecorded",
        "NoteAdded",
        "NoteRemoved",
    }
)


def record_activity(
    *,
    workspace,
    lead: Lead | None,
    activity_type: str,
    actor_membership,
    summary: str = "",
    change: dict[str, Any] | None = None,
    occurred_at=None,
) -> CrmActivity:
    """Append a CRM-owned activity.

    CRM-INV-13: only CRM's OWN entries are ever written here. A Messaging or
    Pipeline entry is NEVER copied into this table.
    """
    when = occurred_at or timezone.now()
    activity = CrmActivity.objects.create(
        workspace=workspace,
        lead=lead,
        subject_type="lead",
        subject_id=lead.id if lead else None,
        activity_type=activity_type,
        summary=summary,
        change=change or {},
        occurred_at=when,
        actor_membership=actor_membership,
    )
    # last_activity_at is monotonic and only qualifying events move it.
    if lead is not None and activity_type in QUALIFYING:
        lead.touch_activity(when)
        lead.save(update_fields=["last_activity_at", "updated_at"])
    return activity


def _guard_not_archived(lead: Lead) -> None:
    """Every CRM mutation on an archived Lead is 409 (frozen B2 §7)."""
    if lead.is_archived:
        raise DomainConflict("This lead is archived.", {"reason": "lead_archived"})


@transaction.atomic
def create_lead(
    *,
    context,
    origin_type: str = "manual",
    business=None,
    owner_membership=None,
    primary_contact: dict[str, Any] | None = None,
    contact_ref: str | None = None,
) -> Lead:
    """CreateLead — CA-01 + CA-15.

    A manual/import/api/form Lead needs NO Business, NO DiscoveryJob and NO
    provenance, and NONE is fabricated. When business_ref is absent a primary
    Contact is REQUIRED and is resolved-or-created in the SAME transaction;
    omitting it returns 422 and writes nothing.
    """
    from apps.identity.services import register_identifier

    if origin_type not in ("manual", "import", "api", "form", "discovery"):
        raise ValidationFailed("That lead origin is not supported.")
    if origin_type == "whatsapp":  # explicitly rejected by CA-01
        raise ValidationFailed("That lead origin is not supported.")
    if origin_type == "discovery" and business is None:
        raise ValidationFailed("A discovery lead requires a business reference.")

    # CA-15: primary_contact is REQUIRED when business_ref is absent.
    if business is None and not primary_contact and not contact_ref:
        raise ValidationFailed(
            "A lead without a business requires a primary contact.",
            {"field": "primary_contact"},
        )

    owner = owner_membership or context.membership

    lead = Lead.objects.create(
        workspace=context.workspace,
        business=business,
        origin_type=origin_type,
        owner_membership=owner,
        # converted_at is set ONLY for a discovery lead (CA-01 constraint 4).
        converted_at=timezone.now() if origin_type == "discovery" else None,
        last_activity_at=timezone.now(),
    )

    # Resolve-or-create the primary Contact in the same transaction.
    if business is None or primary_contact or contact_ref:
        contact = _resolve_or_create_contact(context, primary_contact, contact_ref)
        if contact is not None:
            LeadContact.objects.create(lead=lead, contact=contact, is_primary=True)
            register_identifier(workspace=context.workspace, contact=contact, party_type="contact")

    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="LeadCreated",
        actor_membership=context.membership,
        summary="Lead created",
        change={"origin_type": origin_type},
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="lead.created",
        target_type="lead",
        target_ref=lead.public_id,
        changed_fields=["origin_type", "owner_membership"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="LeadCreated",
        aggregate_type="lead",
        aggregate_ref=lead.public_id,
        payload={"origin_type": origin_type},
    )
    return lead


def _resolve_or_create_contact(
    context, primary_contact: dict[str, Any] | None, contact_ref: str | None
) -> Contact | None:
    if contact_ref:
        contact = Contact.objects.filter(workspace=context.workspace, public_id=contact_ref).first()
        if contact is None:
            # A cross-workspace reference resolves 404, never 400.
            raise EntityNotFound("The requested resource was not found.")
        return contact
    if not primary_contact:
        return None
    if primary_contact.get("contact_ref"):
        return _resolve_or_create_contact(context, None, primary_contact["contact_ref"])
    name = (primary_contact.get("name") or "").strip()
    if not name:
        raise ValidationFailed("A primary contact requires a name.", {"field": "name"})
    return Contact.objects.create(
        workspace=context.workspace,
        full_name=name,
        phone=(primary_contact.get("phone") or "").strip(),
        email=(primary_contact.get("email") or "").strip(),
    )


@transaction.atomic
def convert_business_to_lead(*, context, business, owner_membership=None) -> Lead:
    """Track A: convert a discovered Business into a Lead."""
    from ..models import LeadProvenance

    existing = Lead.objects.filter(
        workspace=context.workspace, business=business, archived_at__isnull=True
    ).first()
    if existing is not None:
        raise DomainConflict("This business already has an active lead.")

    lead = create_lead(
        context=context,
        origin_type="discovery",
        business=business,
        owner_membership=owner_membership,
    )
    # Provenance is written ONLY for a discovery lead.
    LeadProvenance.objects.create(
        lead=lead,
        source_kind="discovery",
        snapshot={"business_ref": business.public_id, "name": business.name},
    )
    return lead


@transaction.atomic
def set_lead_status(*, context, lead: Lead, status: str, expected_version: int | None) -> Lead:
    from ..models import LEAD_STATUSES

    if status not in LEAD_STATUSES:
        raise ValidationFailed("That lead status does not exist.")
    # Lock BEFORE the state guard: `archived_at` must be read under the lock,
    # not from the snapshot this request opened with.
    require_version(lead, expected_version)
    _guard_not_archived(lead)

    before = lead.status
    lead.status = status
    bump_version(lead)
    lead.save(update_fields=["status", "version", "updated_at"])

    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="LeadStatusChanged",
        actor_membership=context.membership,
        summary=f"Status {before} to {status}",
        change={"before": before, "after": status},
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="lead.status_changed",
        target_type="lead",
        target_ref=lead.public_id,
        changed_fields=["status"],
        metadata={"before": before, "after": status},
    )
    return lead


@transaction.atomic
def set_lead_priority(*, context, lead: Lead, priority: str, expected_version: int | None) -> Lead:
    from ..models import LEAD_PRIORITIES

    if priority not in LEAD_PRIORITIES:
        raise ValidationFailed("That priority does not exist.")
    require_version(lead, expected_version)
    _guard_not_archived(lead)

    before = lead.priority
    lead.priority = priority
    bump_version(lead)
    lead.save(update_fields=["priority", "version", "updated_at"])
    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="LeadPriorityChanged",
        actor_membership=context.membership,
        summary=f"Priority {before} to {priority}",
        change={"before": before, "after": priority},
    )
    return lead


@transaction.atomic
def assign_lead_owner(*, context, lead: Lead, owner_ref: str, expected_version: int | None) -> Lead:
    """`AssignLeadOwner` — frozen B2 command.

    Guard order is the contract, not a preference (`B2_STATE_MACHINES.md` §1.2):
    `If-Match` -> not archived -> target Membership `active` in this workspace
    -> `to <> from`. Locking first is what makes `archived_at` and the current
    owner read committed truth rather than the snapshot the request opened with.

    The two rejection shapes are deliberately DIFFERENT and must not be merged:
    a Membership in another workspace is `404 ENTITY_NOT_FOUND` (`AT-OWN-3` —
    a `409` would confirm it exists), while a Membership that is in THIS
    workspace but not `active` is `409 CONFLICT`·`owner_membership_inactive`
    (`AT-OWN-2`). Collapsing them would leak cross-tenant existence.
    """
    from apps.workspaces.models import Membership

    require_version(lead, expected_version)
    _guard_not_archived(lead)

    # Workspace scope FIRST, status second — see the docstring.
    target = Membership.objects.filter(
        workspace=context.workspace, public_id=(owner_ref or "").strip()
    ).first()
    if target is None:
        raise EntityNotFound("The requested resource was not found.")
    if target.status != "active":
        raise DomainConflict(
            "That member is not active in this workspace.",
            {"reason": "owner_membership_inactive"},
        )

    before = lead.owner_membership
    if before is not None and before.id == target.id:
        # `to == from` is 400, never a silent 200: a silent success would emit
        # an event and bump a version for a change that did not happen,
        # corrupting the timeline and every `If-Match` a concurrent client
        # holds (`B2_STATE_MACHINES.md` §1.2).
        raise ValidationFailed(
            "That member already owns this lead.", {"field": "owner_ref"}
        )

    before_ref = before.public_id if before is not None else None
    lead.owner_membership = target
    bump_version(lead)
    lead.save(update_fields=["owner_membership", "version", "updated_at"])

    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="LeadOwnerChanged",
        actor_membership=context.membership,
        # Frozen activity summary shape (`B2_CRM_ACTIVITY_VOCABULARY.md` §1).
        summary=f"owner:{before_ref}→{target.public_id}",
        change={"before": before_ref, "after": target.public_id},
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="lead.owner_changed",
        target_type="lead",
        target_ref=lead.public_id,
        changed_fields=["owner_membership"],
        metadata={"before": before_ref, "after": target.public_id},
    )
    publish_event(
        workspace=context.workspace,
        event_type="LeadOwnerChanged",
        aggregate_type="lead",
        aggregate_ref=lead.public_id,
        # Frozen payload: refs only, no PII.
        payload={
            "lead_ref": lead.public_id,
            "from_owner_ref": before_ref,
            "to_owner_ref": target.public_id,
        },
    )
    return lead


@transaction.atomic
def archive_lead(*, context, lead: Lead, expected_version: int | None) -> Lead:
    """Archive. No cascade: contacts, tasks, notes and activities are retained."""
    require_version(lead, expected_version)
    _guard_not_archived(lead)
    lead.archived_at = timezone.now()
    bump_version(lead)
    lead.save(update_fields=["archived_at", "version", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="lead.archived",
        target_type="lead",
        target_ref=lead.public_id,
        changed_fields=["archived_at"],
    )
    return lead


@transaction.atomic
def add_contact_to_lead(
    *,
    context,
    lead: Lead,
    name: str = "",
    phone: str = "",
    email: str = "",
    contact_ref: str | None = None,
    is_primary: bool = False,
) -> Contact:
    _guard_not_archived(lead)
    contact = _resolve_or_create_contact(
        context,
        {"name": name, "phone": phone, "email": email} if not contact_ref else None,
        contact_ref,
    )
    if contact is None:
        raise ValidationFailed("A contact name is required.")

    if is_primary:
        LeadContact.objects.filter(lead=lead, is_primary=True, unlinked_at__isnull=True).update(
            is_primary=False
        )

    LeadContact.objects.get_or_create(
        lead=lead,
        contact=contact,
        unlinked_at=None,
        defaults={"is_primary": is_primary},
    )
    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="ContactAdded",
        actor_membership=context.membership,
        summary="Contact linked",
    )
    # Contact PII is deliberately absent from the event and audit payloads.
    publish_event(
        workspace=context.workspace,
        event_type="ContactAdded",
        aggregate_type="lead",
        aggregate_ref=lead.public_id,
        payload={"contact_ref": contact.public_id},
    )
    return contact


@transaction.atomic
def create_task(
    *, context, title: str, lead: Lead | None = None, due_at=None, assignee_membership=None
) -> Task:
    if not (title or "").strip():
        raise ValidationFailed("A task title is required.")
    if lead is not None:
        _guard_not_archived(lead)
    task = Task.objects.create(
        workspace=context.workspace,
        lead=lead,
        title=title.strip(),
        due_at=due_at,
        assignee_membership=assignee_membership or context.membership,
    )
    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="TaskCreated",
        actor_membership=context.membership,
        summary=f"Task: {task.title}",
    )
    return task


@transaction.atomic
def complete_task(*, context, task: Task, expected_version: int | None) -> Task:
    require_version(task, expected_version)
    task.status = "completed"
    task.completed_at = timezone.now()
    bump_version(task)
    task.save(update_fields=["status", "completed_at", "version", "updated_at"])
    record_activity(
        workspace=context.workspace,
        lead=task.lead,
        activity_type="TaskCompleted",
        actor_membership=context.membership,
        summary=f"Task completed: {task.title}",
    )
    return task


@transaction.atomic
def create_appointment(*, context, title: str, starts_at, ends_at, lead: Lead | None = None):
    from ..models import Appointment

    if ends_at <= starts_at:
        raise ValidationFailed("An appointment must end after it starts.")
    if lead is not None:
        _guard_not_archived(lead)

    # Overlap is a WARNING, not a refusal (frozen B2 appointment contract).
    overlapping = Appointment.objects.filter(
        workspace=context.workspace,
        owner_membership=context.membership,
        status="scheduled",
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    ).exists()

    appointment = Appointment.objects.create(
        workspace=context.workspace,
        lead=lead,
        title=title,
        starts_at=starts_at,
        ends_at=ends_at,
        owner_membership=context.membership,
    )
    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="AppointmentCreated",
        actor_membership=context.membership,
        summary=f"Appointment: {title}",
    )
    appointment.overlap_warning = overlapping  # read-time advisory, never stored
    return appointment


@transaction.atomic
def add_note(*, context, lead: Lead, body: str) -> Note:
    _guard_not_archived(lead)
    if not (body or "").strip():
        raise ValidationFailed("A note body is required.")
    note = Note.objects.create(
        workspace=context.workspace,
        lead=lead,
        body=body.strip(),
        author_membership=context.membership,
    )
    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="NoteAdded",
        actor_membership=context.membership,
        summary="Note added",
    )
    return note


@transaction.atomic
def add_tag(*, context, lead: Lead, tag: str) -> LeadTag:
    _guard_not_archived(lead)
    cleaned = (tag or "").strip()
    if not cleaned or len(cleaned) > 40:
        raise ValidationFailed("A tag must be between 1 and 40 characters.")
    row, created = LeadTag.objects.get_or_create(
        lead=lead,
        tag=cleaned,
        defaults={"workspace": context.workspace, "created_by_membership": context.membership},
    )
    if created:
        record_activity(
            workspace=context.workspace,
            lead=lead,
            activity_type="LeadTagAdded",
            actor_membership=context.membership,
            summary=f"Tag {cleaned}",
        )
    return row


__all__ = [
    "create_lead",
    "convert_business_to_lead",
    "set_lead_status",
    "set_lead_priority",
    "assign_lead_owner",
    "archive_lead",
    "add_contact_to_lead",
    "create_task",
    "complete_task",
    "create_appointment",
    "add_note",
    "add_tag",
    "record_activity",
]
