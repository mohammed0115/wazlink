"""crm selectors — read models. NO writes. Masking is applied HERE, before
serialization (PD-002).
"""

from __future__ import annotations

from typing import Any

from common.masking import mask_email, mask_name, mask_phone
from common.permissions_catalog import ROLE_VIEWER

from ..models import Appointment, Contact, Lead, LeadContact, Task


def primary_contact_for(lead: Lead) -> Contact | None:
    link = (
        LeadContact.objects.select_related("contact")
        .filter(lead=lead, is_primary=True, unlinked_at__isnull=True)
        .first()
    )
    return link.contact if link else None


def display_projection(lead: Lead, *, role: str = "") -> dict[str, Any]:
    """CA-15 display projection.

    display_name / display_subtitle / display_source are READ-TIME projections,
    never stored columns and never authoritative. display_source is emitted so
    a client never has to infer the branch.

    A Contact-derived display_name is Contact PII and is MASKED for Viewer on
    every surface.
    """
    if lead.business_id is not None:
        business = lead.business
        return {
            "display_name": business.name,
            "display_subtitle": business.city or business.category or "",
            "display_source": "business",
        }

    contact = primary_contact_for(lead)
    if contact is None:
        # A Business-less Lead always has a primary Contact by CA-15; this
        # branch keeps the read path total rather than raising on old data.
        return {"display_name": "", "display_subtitle": "", "display_source": "contact"}

    name = contact.full_name
    subtitle = contact.title or contact.email or contact.phone or ""
    if role == ROLE_VIEWER:
        name = mask_name(name)
        subtitle = mask_email(subtitle) if "@" in subtitle else mask_phone(subtitle)
    return {"display_name": name, "display_subtitle": subtitle, "display_source": "contact"}


def contact_payload(contact: Contact, *, role: str = "") -> dict[str, Any]:
    """Viewer sees masked phone and email."""
    if role == ROLE_VIEWER:
        return {
            "contact_ref": contact.public_id,
            "full_name": mask_name(contact.full_name),
            "phone": mask_phone(contact.phone),
            "email": mask_email(contact.email),
            "title": contact.title,
            "masked": True,
        }
    return {
        "contact_ref": contact.public_id,
        "full_name": contact.full_name,
        "phone": contact.phone,
        "email": contact.email,
        "title": contact.title,
        "masked": False,
    }


def lead_list_item(lead: Lead, *, role: str = "") -> dict[str, Any]:
    """LeadListItem. CA-15: business_* fields are NULLABLE; the display block
    is always present."""
    business = lead.business
    payload = {
        "lead_ref": lead.public_id,
        "status": lead.status,
        "priority": lead.priority,
        "origin_type": lead.origin_type,
        "owner_ref": lead.owner_membership.public_id,
        # AT-OWN-4: a Lead whose owner Membership is no longer `active` keeps
        # that owner — it is never silently reassigned — and says so, because
        # the list is the only surface where "these need a new owner" is
        # visible. `owner_membership` is already select_related, so this costs
        # no extra query.
        "owner_inactive": lead.owner_membership.status != "active",
        "last_activity_at": lead.last_activity_at,
        "version": lead.version,
        "archived": lead.is_archived,
        # Nullable, never fabricated.
        "business_ref": business.public_id if business else None,
        "business_name": business.name if business else None,
        "business_city": business.city if business else None,
        "business_category": business.category if business else None,
    }
    payload.update(display_projection(lead, role=role))
    return payload


def lead_queryset(context, *, include_archived: bool = False):
    queryset = Lead.objects.select_related("business", "owner_membership").filter(workspace=context.workspace)
    if not include_archived:
        queryset = queryset.filter(archived_at__isnull=True)
    return queryset


def filter_leads(context, params: dict[str, Any]):
    queryset = lead_queryset(context, include_archived=params.get("include_archived") == "true")

    if status := params.get("status"):
        queryset = queryset.filter(status=status)
    if priority := params.get("priority"):
        queryset = queryset.filter(priority=priority)
    if owner := params.get("owner"):
        queryset = queryset.filter(owner_membership__public_id=owner)
    if tag := params.get("tag"):
        queryset = queryset.filter(tags__tag=tag)
    # city / category NEVER match a Business-less Lead (CA-15).
    if city := params.get("city"):
        queryset = queryset.filter(business__isnull=False, business__city__icontains=city)
    if category := params.get("category"):
        queryset = queryset.filter(business__isnull=False, business__category__icontains=category)
    if q := params.get("q"):
        from django.db.models import Q

        queryset = queryset.filter(
            Q(business__name__icontains=q)
            | Q(lead_contacts__contact__full_name__icontains=q, lead_contacts__unlinked_at__isnull=True)
        ).distinct()
    return queryset


__all__ = [
    "primary_contact_for",
    "display_projection",
    "contact_payload",
    "lead_list_item",
    "lead_queryset",
    "filter_leads",
]


# --------------------------------------------------------------------------
# Calendar (I14) — the union of tasks and appointments, one ordered stream.
# --------------------------------------------------------------------------
def calendar_entries(workspace, *, start=None, end=None) -> list[dict]:
    """One ordered stream over both activity kinds.

    A union rather than two lists, because "what is on my calendar" is one
    question; answering it with two lists pushes the interleaving onto every
    caller and guarantees they each do it slightly differently.
    """
    entries: list[dict] = []

    tasks = Task.objects.filter(workspace=workspace)
    if start is not None:
        tasks = tasks.filter(due_at__gte=start)
    if end is not None:
        tasks = tasks.filter(due_at__lte=end)
    for task in tasks.exclude(due_at__isnull=True):
        entries.append(
            {
                "entry_id": task.public_id,
                "kind": "task",
                "title": task.title,
                "occurs_at": task.due_at,
                "status": task.status,
            }
        )

    appointments = Appointment.objects.filter(workspace=workspace)
    if start is not None:
        appointments = appointments.filter(starts_at__gte=start)
    if end is not None:
        appointments = appointments.filter(starts_at__lte=end)
    for appointment in appointments:
        entries.append(
            {
                "entry_id": appointment.public_id,
                "kind": "appointment",
                "title": appointment.title,
                "occurs_at": appointment.starts_at,
                "status": appointment.status,
            }
        )

    # Deterministic: the timestamp, then the public id as the tiebreak, so two
    # entries at the same instant never swap order between requests.
    entries.sort(key=lambda e: (e["occurs_at"], e["entry_id"]))
    return entries
