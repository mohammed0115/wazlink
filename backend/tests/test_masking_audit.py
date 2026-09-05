"""PD-002 masking, audit and outbox behaviour."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def _viewer_in(owner, actor_factory, email="viewer@example.test"):
    from apps.workspaces.models import Membership

    viewer = actor_factory(email=email, role="viewer")
    Membership.objects.create(workspace=owner.workspace, user=viewer.user, role="viewer", status="active")
    viewer.session.active_workspace = owner.workspace
    viewer.session.save(update_fields=["active_workspace"])
    return viewer


@pytest.mark.security
def test_mask_1_viewer_sees_masked_contact_pii(actor, auth_client):
    from apps.crm.services import create_lead

    owner = actor(email="own@example.test")
    create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001", "email": "dana@northwind.test"},
    )

    viewer = _viewer_in(owner, actor)
    body = auth_client(viewer).get("/api/v1/contacts").json()
    item = body["items"][0]

    assert item["masked"] is True
    assert item["phone"] != "+966500000001"
    assert "dana@northwind.test" != item["email"]
    assert item["full_name"] != "Dana Reed"


@pytest.mark.security
def test_mask_2_non_viewer_sees_unmasked_pii(actor, auth_client):
    from apps.crm.services import create_lead

    owner = actor(email="own2@example.test")
    create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001"},
    )

    item = auth_client(owner).get("/api/v1/contacts").json()["items"][0]
    assert item["masked"] is False
    assert item["phone"] == "+966500000001"
    assert item["full_name"] == "Dana Reed"


@pytest.mark.security
def test_mask_3_ca15_display_name_is_masked_for_viewer_on_the_list(actor, auth_client):
    """A Contact-derived display_name is Contact PII on EVERY surface."""
    from apps.crm.services import create_lead

    owner = actor(email="own3@example.test")
    create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001"},
    )

    viewer = _viewer_in(owner, actor)
    item = auth_client(viewer).get("/api/v1/leads").json()["items"][0]
    assert item["display_source"] == "contact"
    assert item["display_name"] != "Dana Reed"


@pytest.mark.security
def test_mask_4_masking_happens_server_side_not_in_the_serializer(actor):
    """The selector returns already-masked values, so nothing downstream can
    accidentally emit the real one."""
    from apps.crm.models import Contact
    from apps.crm.selectors import contact_payload

    a = actor()
    contact = Contact.objects.create(
        workspace=a.workspace, full_name="Dana Reed", phone="+966500000001", email="d@x.test"
    )
    masked = contact_payload(contact, role="viewer")
    assert "+966500000001" not in str(masked)
    assert "Dana Reed" not in str(masked)


@pytest.mark.security
def test_contact_pii_never_enters_an_event_payload(actor):
    from apps.crm.services import create_lead
    from apps.platform_async.models import OutboxEvent

    a = actor()
    create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001", "email": "dana@northwind.test"},
    )

    blob = str(list(OutboxEvent.objects.values_list("payload", flat=True)))
    assert "Dana Reed" not in blob
    assert "+966500000001" not in blob
    assert "dana@northwind.test" not in blob


@pytest.mark.security
def test_contact_pii_never_enters_an_audit_payload(actor):
    from apps.auditlog.models import AuditLog
    from apps.crm.services import create_lead

    a = actor()
    create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001"},
    )

    blob = str(list(AuditLog.objects.values_list("metadata", flat=True)))
    assert "Dana Reed" not in blob
    assert "+966500000001" not in blob


def test_every_mutation_writes_an_audit_row(actor):
    from apps.auditlog.models import AuditLog
    from apps.customers.services import create_customer

    a = actor()
    before = AuditLog.objects.filter(workspace=a.workspace).count()
    create_customer(context=a.context, party_kind="organization", name="Northwind")
    rows = AuditLog.objects.filter(workspace=a.workspace)
    assert rows.count() == before + 1

    row = rows.order_by("-created_at").first()
    assert row.action == "customer.created"
    assert row.actor_membership_id == a.membership.id
    # FIELD NAMES, never values.
    assert "name" in row.changed_fields


def test_outbox_row_is_written_in_the_same_transaction(actor):
    """T-ASYNC-3: the event is atomic with the state it describes."""
    from django.db import transaction

    from apps.customers.models import Customer
    from apps.customers.services import create_customer
    from apps.platform_async.models import OutboxEvent

    a = actor()
    try:
        with transaction.atomic():
            create_customer(context=a.context, party_kind="organization", name="Rollback Co")
            raise RuntimeError("forced rollback")
    except RuntimeError:
        pass

    # Neither the row nor its event survives — they rolled back together.
    assert not Customer.objects.filter(name="Rollback Co").exists()
    assert not OutboxEvent.objects.filter(
        payload__contains={"party_kind": "organization"}, aggregate_type="customer"
    ).exists()


def test_public_ids_are_opaque_and_prefixed(actor):
    from apps.customers.services import create_customer
    from common.public_ids import is_valid_public_id

    a = actor()
    customer = create_customer(context=a.context, party_kind="organization", name="X")
    assert is_valid_public_id(customer.public_id, "CUS")
    # The internal UUID is never the public identifier.
    assert str(customer.id) not in customer.public_id


@pytest.mark.nc
def test_unregistered_public_id_prefix_is_refused():
    from common.public_ids import UnregisteredPrefixError, generate_public_id

    with pytest.raises(UnregisteredPrefixError):
        generate_public_id("NOPE")
