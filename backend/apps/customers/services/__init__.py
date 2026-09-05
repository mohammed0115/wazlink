"""customers commands — the commercial party write path."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event

from ..models import PARTY_KINDS, Customer, CustomerContact


@transaction.atomic
def create_customer(
    *,
    context,
    party_kind: str,
    name: str,
    origin_kind: str = "manual",
    business=None,
    owner_membership=None,
    primary_contact: dict | None = None,
    contact_ref: str | None = None,
) -> Customer:
    """CreateCustomer.

    A Track-B Customer needs NO Business, NO DiscoveryJob and no provider, and
    none is fabricated. A `person` Customer must have EXACTLY ONE Contact
    (CUS-3), so one is required at creation.
    """
    if party_kind not in PARTY_KINDS:
        raise ValidationFailed("party_kind must be 'organization' or 'person'.")
    if not (name or "").strip():
        raise ValidationFailed("A customer name is required.")

    if party_kind == "person" and not (primary_contact or contact_ref):
        raise ValidationFailed(
            "A person customer requires exactly one contact.", {"field": "primary_contact"}
        )

    customer = Customer.objects.create(
        workspace=context.workspace,
        party_kind=party_kind,
        name=name.strip(),
        origin_kind=origin_kind,
        business=business,
        owner_membership=owner_membership or context.membership,
    )

    if primary_contact or contact_ref:
        link_contact(
            context=context,
            customer=customer,
            primary_contact=primary_contact,
            contact_ref=contact_ref,
            is_primary=True,
            _skip_version=True,
        )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="customer.created",
        target_type="customer",
        target_ref=customer.public_id,
        changed_fields=["party_kind", "name", "origin_kind"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="CustomerCreated",
        aggregate_type="customer",
        aggregate_ref=customer.public_id,
        payload={"party_kind": party_kind},
    )
    return customer


@transaction.atomic
def update_customer(
    *,
    context,
    customer: Customer,
    expected_version: int | None,
    name: str | None = None,
    party_kind: str | None = None,
) -> Customer:
    require_version(customer, expected_version)

    # party_kind is IMMUTABLE after creation.
    if party_kind is not None and party_kind != customer.party_kind:
        raise DomainConflict("party_kind is immutable.", {"field": "party_kind"})

    changed: list[str] = []
    if name is not None and name.strip() and name.strip() != customer.name:
        customer.name = name.strip()
        changed.append("name")

    if changed:
        bump_version(customer)
        customer.save(update_fields=[*changed, "version", "updated_at"])
        write_audit(
            workspace=context.workspace,
            actor_membership=context.membership,
            action="customer.updated",
            target_type="customer",
            target_ref=customer.public_id,
            changed_fields=changed,
        )
    return customer


@transaction.atomic
def archive_customer(*, context, customer: Customer, expected_version: int | None) -> Customer:
    """Archive only. There is no DELETE /customers/{id}."""
    require_version(customer, expected_version)
    if customer.status == "archived":
        raise DomainConflict("This customer is already archived.")
    customer.status = "archived"
    customer.archived_at = timezone.now()
    bump_version(customer)
    customer.save(update_fields=["status", "archived_at", "version", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="customer.archived",
        target_type="customer",
        target_ref=customer.public_id,
        changed_fields=["status"],
    )
    return customer


@transaction.atomic
def link_contact(
    *,
    context,
    customer: Customer,
    primary_contact: dict | None = None,
    contact_ref: str | None = None,
    is_primary: bool = False,
    _skip_version: bool = False,
):
    from apps.crm.models import Contact
    from apps.crm.services import _resolve_or_create_contact
    from apps.identity.services import register_identifier

    contact = _resolve_or_create_contact(context, primary_contact, contact_ref)
    if contact is None:
        raise ValidationFailed("A contact is required.")

    active = CustomerContact.objects.filter(customer=customer, unlinked_at__isnull=True)
    # CUS-3: a person Customer has EXACTLY ONE Contact.
    if customer.party_kind == "person" and active.exclude(contact=contact).exists():
        raise DomainConflict("A person customer may have exactly one contact.", {"reason": "cus_3"})

    if is_primary:
        active.update(is_primary=False)

    link, _ = CustomerContact.objects.get_or_create(
        customer=customer,
        contact=contact,
        unlinked_at=None,
        defaults={"workspace": context.workspace, "is_primary": is_primary},
    )
    register_identifier(workspace=context.workspace, contact=contact, party_type="contact")
    assert isinstance(contact, Contact)
    return link


@transaction.atomic
def unlink_contact(*, context, customer: Customer, contact_ref: str) -> None:
    link = (
        CustomerContact.objects.select_related("contact")
        .filter(customer=customer, contact__public_id=contact_ref, unlinked_at__isnull=True)
        .first()
    )
    if link is None:
        raise EntityNotFound("The requested resource was not found.")

    remaining = (
        CustomerContact.objects.filter(customer=customer, unlinked_at__isnull=True)
        .exclude(id=link.id)
        .count()
    )
    # Refused if it is the sole Contact of a person Customer (CUS-3).
    if customer.party_kind == "person" and remaining == 0:
        raise DomainConflict("A person customer must retain exactly one contact.", {"reason": "cus_3"})

    link.unlinked_at = timezone.now()
    link.save(update_fields=["unlinked_at", "updated_at"])


@transaction.atomic
def convert_lead_to_customer(*, context, lead, party_kind: str, expected_version: int | None) -> Customer:
    """ConvertLeadToCustomer.

    The Lead is RETAINED. Conversion is idempotent per Lead and fabricates NO
    Discovery provenance.
    """
    from apps.crm.selectors import primary_contact_for
    from apps.crm.services import record_activity

    if party_kind not in PARTY_KINDS:
        raise ValidationFailed("party_kind must be 'organization' or 'person'.")
    require_version(lead, expected_version)

    existing = Customer.objects.filter(workspace=context.workspace, converted_from_lead=lead).first()
    if existing is not None:
        raise DomainConflict("This lead has already been converted.", {"customer_ref": existing.public_id})

    contact = primary_contact_for(lead)
    name = lead.business.name if lead.business_id else (contact.full_name if contact else "")
    if not name:
        raise ValidationFailed("This lead has no resolvable name to convert.")

    customer = Customer.objects.create(
        workspace=context.workspace,
        party_kind=party_kind,
        name=name,
        origin_kind="conversion",
        # The Business link is carried across only if the Lead genuinely had one.
        business=lead.business if lead.business_id else None,
        converted_from_lead=lead,
        owner_membership=lead.owner_membership,
    )
    if contact is not None:
        CustomerContact.objects.create(
            workspace=context.workspace, customer=customer, contact=contact, is_primary=True
        )

    record_activity(
        workspace=context.workspace,
        lead=lead,
        activity_type="LeadConverted",
        actor_membership=context.membership,
        summary="Converted to customer",
        change={"customer_ref": customer.public_id},
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="lead.converted_to_customer",
        target_type="customer",
        target_ref=customer.public_id,
        changed_fields=["converted_from_lead"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="LeadConvertedToCustomer",
        aggregate_type="customer",
        aggregate_ref=customer.public_id,
        payload={"lead_ref": lead.public_id},
    )
    return customer


__all__ = [
    "create_customer",
    "update_customer",
    "archive_customer",
    "link_contact",
    "unlink_contact",
    "convert_lead_to_customer",
]
