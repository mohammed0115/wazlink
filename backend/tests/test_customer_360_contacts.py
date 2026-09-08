"""Customer 360 must show the Customer's Contacts.

`CustomerContactsSectionProvider` existed and was correct; it was simply never
registered in the composition root, so `GET /customers/{ref}` returned no
`contacts` key at all and the React section — which renders only when the key
is present — stayed silently absent. A contact added through the Customer 360
page was written to `customer_contacts`, returned `201`, and then vanished on
reload.

It matters most for a `party_kind='person'` Customer. That row deliberately
holds NO phone and NO email (the frozen person-Customer invariant: an
individual Customer's identity lives on its single linked Contact), so with the
section missing there was no surface anywhere on that Customer's own 360
showing how to contact them.

`04_PRODUCT_DOMAIN_EXPANSION.md` §4 and `05_CUSTOMER_ACCOUNT_CONTACT_MODEL.md`
§10 require Customer 360 to generalize Lead 360 — including Contacts;
`07_FRONTEND_GAP_PLAN.md` N2 lists the section explicitly.
"""

from __future__ import annotations

import pytest

from apps.crm.models import Contact
from apps.customers.services import create_customer, link_contact

pytestmark = pytest.mark.django_db(transaction=True)


def _org(context, name="شركة الأفق"):
    return create_customer(
        context=context,
        party_kind="organization",
        name=name,
        origin_kind="manual",
        primary_contact={"name": "نورة العتيبي", "phone": "+966500000201"},
    )


def _person(context, name="فيصل الشمري"):
    return create_customer(
        context=context,
        party_kind="person",
        name=name,
        origin_kind="manual",
        primary_contact={
            "name": name,
            "phone": "+966500000202",
            "email": "faisal@example.test",
        },
    )


def test_an_organization_customer_360_carries_its_contacts(actor, auth_client):
    a = actor()
    customer = _org(a.context)

    response = auth_client(a).get(f"/api/v1/customers/{customer.public_id}")

    assert response.status_code == 200
    contacts = response.data.get("contacts")
    assert contacts is not None, "the contacts section must be present, not key-absent"
    assert [c["full_name"] for c in contacts] == ["نورة العتيبي"]
    assert contacts[0]["is_primary"] is True


def test_a_person_customer_360_carries_the_contact_holding_its_identity(actor, auth_client):
    """The `customers` row has no phone/email; the Contact is the only source."""
    a = actor()
    customer = _person(a.context)

    response = auth_client(a).get(f"/api/v1/customers/{customer.public_id}")

    assert response.status_code == 200
    contacts = response.data["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["phone"] == "+966500000202"
    assert contacts[0]["email"] == "faisal@example.test"
    # The invariant that makes this section load-bearing.
    assert not hasattr(customer, "phone")
    assert not hasattr(customer, "email")


def test_a_contact_added_after_creation_is_visible_on_the_next_read(actor, auth_client):
    """The regression in one test: add, re-read, still there."""
    a = actor()
    customer = _org(a.context)

    added = auth_client(a).post(
        f"/api/v1/customers/{customer.public_id}/contacts",
        {"primary_contact": {"name": "عبدالله القحطاني", "phone": "+966500000204"}},
        format="json",
    )
    assert added.status_code == 201

    reread = auth_client(a).get(f"/api/v1/customers/{customer.public_id}")
    names = [c["full_name"] for c in reread.data["contacts"]]
    assert "عبدالله القحطاني" in names, "a contact added through the API must survive a re-read"


def test_re_reading_does_not_multiply_contacts(actor, auth_client):
    a = actor()
    customer = _org(a.context)

    first = auth_client(a).get(f"/api/v1/customers/{customer.public_id}").data["contacts"]
    second = auth_client(a).get(f"/api/v1/customers/{customer.public_id}").data["contacts"]

    assert len(first) == len(second) == 1
    assert first[0]["contact_ref"] == second[0]["contact_ref"]


def test_an_unlinked_contact_disappears_from_the_section(actor, auth_client):
    a = actor()
    customer = _org(a.context)
    contact = Contact.objects.get(full_name="نورة العتيبي")
    extra = Contact.objects.create(
        workspace=a.workspace, full_name="مؤقت", phone="+966500000299"
    )
    link_contact(context=a.context, customer=customer, contact_ref=extra.public_id)

    before = auth_client(a).get(f"/api/v1/customers/{customer.public_id}").data["contacts"]
    assert len(before) == 2

    auth_client(a).delete(
        f"/api/v1/customers/{customer.public_id}/contacts/{extra.public_id}"
    )

    after = auth_client(a).get(f"/api/v1/customers/{customer.public_id}").data["contacts"]
    assert [c["contact_ref"] for c in after] == [contact.public_id]


def test_another_workspaces_customer_exposes_nothing(actor, auth_client):
    mine = actor(email="mine-c@example.test", workspace_name="MineC")
    theirs = actor(email="theirs-c@example.test", workspace_name="TheirsC")
    foreign = _org(theirs.context, name="سري")

    response = auth_client(mine).get(f"/api/v1/customers/{foreign.public_id}")

    assert response.status_code == 404
    assert response.data["error"]["code"] == "ENTITY_NOT_FOUND"


def test_a_viewer_sees_the_section_with_contact_pii_masked(actor, auth_client, make_user):
    """The section is permission-filtered like every other, and Contact PII is
    masked for Viewer on every surface — this one included."""
    owner = actor(email="own-c@example.test", workspace_name="MaskC")
    customer = _org(owner.context)

    from rest_framework.test import APIClient

    from apps.identity_access.models import Session
    from apps.workspaces.models import Membership

    viewer_user = make_user(email="viewer-c@example.test")
    Membership.objects.create(
        workspace=owner.workspace, user=viewer_user, role="viewer", status="active"
    )
    _, token = Session.issue(viewer_user, active_workspace=owner.workspace)
    client = APIClient()
    client.credentials(HTTP_X_SESSION_TOKEN=token)

    response = client.get(f"/api/v1/customers/{customer.public_id}")

    assert response.status_code == 200
    contacts = response.data["contacts"]
    assert len(contacts) == 1
    assert contacts[0]["masked"] is True
    assert contacts[0]["full_name"] != "نورة العتيبي"
    assert contacts[0]["phone"] != "+966500000201"


def test_the_section_is_registered_in_the_composition_root():
    """The root cause, asserted directly: an unregistered provider is dead code
    no matter how correct its body is."""
    from common.party360.contracts import SubjectRef
    from common.party360.registry import section_registry

    subject = SubjectRef(kind="customer", public_id="CUS-X", internal_id=None, related={})
    names = {p.section_name for p in section_registry.providers_for(subject)}
    assert "contacts" in names, "the customer contacts provider must be registered"


def test_two_domains_may_contribute_the_same_section_name():
    """The second root cause. `SectionRegistry` was keyed by section NAME, so
    registering the customer `contacts` provider silently EVICTED the crm one
    and simply moved the bug from Customer 360 to Lead 360. Both must survive,
    and `supports()` — not the key — must decide which one answers."""
    from common.party360.contracts import SubjectRef
    from common.party360.registry import section_registry

    lead = SubjectRef(kind="lead", public_id="LEAD-X", internal_id=None, related={})
    customer = SubjectRef(kind="customer", public_id="CUS-X", internal_id=None, related={})

    for_lead = [p for p in section_registry.providers_for(lead) if p.section_name == "contacts"]
    for_customer = [
        p for p in section_registry.providers_for(customer) if p.section_name == "contacts"
    ]

    assert len(for_lead) == 1, "the lead contacts provider must survive registration"
    assert len(for_customer) == 1, "the customer contacts provider must survive registration"
    assert type(for_lead[0]) is not type(for_customer[0]), "each kind has its own provider"


def test_a_lead_360_still_carries_its_own_contacts(actor, auth_client):
    """The eviction guard, end to end: fixing Customer 360 must not cost
    Lead 360 the section it already had."""
    from apps.crm.services import create_lead

    a = actor()
    lead = create_lead(
        context=a.context, origin_type="manual", primary_contact={"name": "سارة المهندس"}
    )

    response = auth_client(a).get(f"/api/v1/leads/{lead.public_id}")

    assert response.status_code == 200
    assert [c["full_name"] for c in response.data["contacts"]] == ["سارة المهندس"]
