"""T-TRACKB-* / T-CA01-* / T-CA15-* — CRM_WITHOUT_DISCOVERY.

HARD PRODUCT INVARIANT. A Lead or Customer must participate fully in CRM
without ever having come from Discovery, and NOTHING may be fabricated to
make that work: no Business, no Discovery Job, no provenance, no provider.
"""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def _counts(workspace):
    from apps.crm.models import LeadProvenance
    from apps.discovery.models import Business, DiscoveryJob

    return {
        "discovery_jobs": DiscoveryJob.objects.filter(workspace=workspace).count(),
        "businesses": Business.objects.filter(workspace=workspace).count(),
        "provenance": LeadProvenance.objects.filter(lead__workspace=workspace).count(),
    }


def test_trackb_1_manual_customer_and_contact_with_zero_discovery(actor):
    from apps.crm.models import Task
    from apps.customers.services import create_customer

    a = actor()
    customer = create_customer(
        context=a.context,
        party_kind="organization",
        name="Northwind Trading",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001", "email": "dana@northwind.test"},
    )
    assert customer.public_id.startswith("CUS-")
    assert customer.business_id is None

    from apps.crm.services import create_task

    create_task(context=a.context, title="Call Dana")
    assert Task.objects.filter(workspace=a.workspace).count() == 1

    # The load-bearing assertion.
    assert _counts(a.workspace) == {"discovery_jobs": 0, "businesses": 0, "provenance": 0}


def test_trackb_2_person_customer_has_exactly_one_contact(actor):
    from apps.customers.models import CustomerContact
    from apps.customers.services import create_customer

    a = actor()
    customer = create_customer(
        context=a.context,
        party_kind="person",
        name="Sara Khan",
        primary_contact={"name": "Sara Khan", "phone": "+966500000002"},
    )
    assert customer.party_kind == "person"
    assert customer.business_id is None
    assert CustomerContact.objects.filter(customer=customer, unlinked_at__isnull=True).count() == 1
    assert _counts(a.workspace)["discovery_jobs"] == 0


def test_trackb_2b_person_customer_refuses_a_second_contact(actor):
    """CUS-3: exactly one Contact."""
    from apps.customers.services import create_customer, link_contact
    from common.errors import DomainConflict

    a = actor()
    customer = create_customer(
        context=a.context,
        party_kind="person",
        name="Sara Khan",
        primary_contact={"name": "Sara Khan"},
    )
    with pytest.raises(DomainConflict):
        link_contact(context=a.context, customer=customer, primary_contact={"name": "Someone Else"})


def test_trackb_3_manual_lead_creates_no_business_job_or_provenance(actor):
    """CA-01 negative control, stated as plainly as it can be."""
    from apps.crm.services import create_lead

    a = actor()
    lead = create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": "Omar Aziz", "phone": "+966500000003"},
    )
    assert lead.business_id is None  # no fabricated Business
    assert lead.source_job_id is None  # no fabricated Discovery Job
    assert lead.converted_at is None  # CA-01: nullable for non-discovery
    assert lead.origin_type == "manual"
    assert _counts(a.workspace) == {"discovery_jobs": 0, "businesses": 0, "provenance": 0}


def test_trackb_4_csv_import_creates_no_discovery_artifacts(actor):
    from apps.imports.services import commit_batch, create_import_batch, set_mapping

    a = actor()
    csv_text = "name,phone\nAcme Ltd,+966500000010\nBeta LLC,+966500000011\n"
    batch = create_import_batch(context=a.context, target_kind="customer", raw_csv=csv_text)
    set_mapping(context=a.context, batch=batch, mapping={"name": "name", "phone": "phone"})
    batch = commit_batch(context=a.context, batch=batch)

    from apps.customers.models import Customer

    assert Customer.objects.filter(workspace=a.workspace).count() == 2
    assert _counts(a.workspace) == {"discovery_jobs": 0, "businesses": 0, "provenance": 0}


def test_trackb_5_every_surface_renders_with_a_non_empty_display_name(actor, auth_client):
    """No response may contain a null-Business rendering error."""
    from apps.crm.services import create_lead

    a = actor()
    lead = create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": "Omar Aziz", "phone": "+966500000003"},
    )
    client = auth_client(a)

    listing = client.get("/api/v1/leads").json()
    assert listing["items"][0]["display_name"] == "Omar Aziz"
    assert listing["items"][0]["display_source"] == "contact"
    assert listing["items"][0]["business_ref"] is None  # nullable, not fabricated

    detail = client.get(f"/api/v1/leads/{lead.public_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["lead"]["display_name"] == "Omar Aziz"
    # The optional business section is KEY-ABSENT, not null and not a stub.
    assert "business" not in body


def test_ca15_1_business_less_lead_requires_a_primary_contact(actor):
    """Omitting it returns 422 and WRITES NOTHING."""
    from apps.crm.models import Lead
    from apps.crm.services import create_lead
    from common.errors import ValidationFailed

    a = actor()
    with pytest.raises(ValidationFailed):
        create_lead(context=a.context, origin_type="manual")
    assert Lead.objects.filter(workspace=a.workspace).count() == 0


def test_ca15_1b_api_returns_422_and_writes_nothing(actor, auth_client):
    from apps.crm.models import Lead

    a = actor()
    response = auth_client(a).post("/api/v1/leads", {"origin_type": "manual"}, format="json")
    assert response.status_code == 422
    assert Lead.objects.filter(workspace=a.workspace).count() == 0


def test_ca01_no_pii_column_was_added_to_leads(actor):
    """Frozen B2 §1 is normative: leads carries NO identifying attribute."""
    from apps.crm.models import Lead

    columns = {f.name for f in Lead._meta.get_fields() if hasattr(f, "attname")}
    for forbidden in (
        "name",
        "company_name",
        "city",
        "category",
        "phone",
        "email",
        "website",
        "display_name",
    ):
        assert forbidden not in columns, f"leads gained a forbidden column: {forbidden}"


def test_ca01_discovery_lead_still_requires_business_and_converted_at(actor):
    """Track-A behaviour is unchanged: the widened constraint still binds
    origin_type='discovery'."""
    from django.db.utils import IntegrityError

    from apps.crm.models import Lead

    a = actor()
    with pytest.raises(IntegrityError):
        Lead.objects.create(
            workspace=a.workspace,
            origin_type="discovery",
            business=None,
            owner_membership=a.membership,
            converted_at=None,
        )


def test_ca01_track_a_conversion_writes_provenance(actor):
    """A DISCOVERY lead DOES get provenance — the negative controls above are
    about not FABRICATING it, not about removing it."""
    from apps.crm.services import convert_business_to_lead
    from apps.discovery.models import Business

    a = actor()
    business = Business.objects.create(
        workspace=a.workspace, name="Discovered Co", city="Riyadh", category="retail"
    )
    lead = convert_business_to_lead(context=a.context, business=business)

    assert lead.business_id == business.id
    assert lead.converted_at is not None
    counts = _counts(a.workspace)
    assert counts["provenance"] == 1
    assert counts["businesses"] == 1
    # Still no DiscoveryJob: UpsertBusiness is normalization only at I2.
    assert counts["discovery_jobs"] == 0


@pytest.mark.nc
def test_mig_6_no_discovery_job_port_or_adapter_is_reachable():
    """T-MIG-6 (NC): the Discovery SCHEMA exists; the Discovery FEATURE does not."""
    import pathlib

    discovery = pathlib.Path(__file__).resolve().parent.parent / "apps" / "discovery"
    assert not (discovery / "ports.py").exists()
    assert not (discovery / "adapters").exists()
    assert not (discovery / "tasks.py").exists()

    adapters = pathlib.Path(__file__).resolve().parent.parent / "adapters"
    assert not adapters.exists(), "no provider adapter ships in Wave 1"


@pytest.mark.nc
def test_mig_5_no_crm_code_writes_a_discovery_owned_table():
    """T-MIG-5 (NC): businesses/business_identities/discovery_jobs are written
    only by discovery."""
    import ast
    import pathlib

    crm_root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "crm"
    writes = []
    for path in crm_root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            # Business.objects.create(...) / .update(...) from crm would be a write.
            if isinstance(node, ast.Attribute) and node.attr in ("create", "update", "bulk_create", "delete"):
                source = ast.unparse(node)
                if any(
                    owned in source
                    for owned in (
                        "Business.objects",
                        "BusinessIdentity.objects",
                        "DiscoveryJob.objects",
                        "DiscoveryResult.objects",
                    )
                ):
                    writes.append(f"{path.name}: {source}")
    assert writes == [], f"crm writes a discovery-owned table: {writes}"
