"""T-ISO-* — cross-workspace isolation. THE HARD GATE.

A user from Workspace A must never retrieve or mutate Workspace B data, and the
refusal must be 404 ENTITY_NOT_FOUND — never 403, which would confirm the
object exists (Doctrine R-2).
"""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.django_db, pytest.mark.security]


@pytest.fixture
def two_workspaces(actor):
    """Two fully independent tenants."""
    a = actor(email="a@example.test", workspace_name="Alpha")
    b = actor(email="b@example.test", workspace_name="Bravo")
    return a, b


def _seed(owner):
    """Create one of every Wave 1 subject inside a workspace."""
    from apps.crm.services import create_lead
    from apps.customers.services import create_customer
    from apps.pipeline.services import create_deal

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Dana Reed", "phone": "+966500000001"},
    )
    customer = create_customer(
        context=owner.context,
        party_kind="organization",
        name="Northwind",
    )
    deal = create_deal(context=owner.context, title="Renewal", customer=customer, value=1000)
    from apps.crm.selectors import primary_contact_for

    return {"lead": lead, "customer": customer, "deal": deal, "contact": primary_contact_for(lead)}


def test_iso_1_cross_workspace_lead_read_is_404(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(f"/api/v1/leads/{seeded['lead'].public_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_iso_2_cross_workspace_customer_read_is_404(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(f"/api/v1/customers/{seeded['customer'].public_id}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_iso_3_cross_workspace_deal_read_is_404(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(f"/api/v1/deals/{seeded['deal'].public_id}")
    assert response.status_code == 404


def test_iso_4_cross_workspace_contact_read_is_404(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(f"/api/v1/contacts/{seeded['contact'].public_id}")
    assert response.status_code == 404


def test_iso_5_cross_workspace_mutation_is_404(two_workspaces, auth_client):
    """A mutation must be refused with the same non-disclosing status."""
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).post(
        f"/api/v1/leads/{seeded['lead'].public_id}/status",
        {"status": "qualified"},
        format="json",
        HTTP_IF_MATCH="1",
    )
    assert response.status_code == 404


def test_iso_6_cross_workspace_deal_close_is_404(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).post(
        f"/api/v1/deals/{seeded['deal'].public_id}/close",
        {"outcome": "won"},
        format="json",
        HTTP_IF_MATCH="1",
    )
    assert response.status_code == 404


def test_iso_7_list_endpoints_never_leak_another_tenant(two_workspaces, auth_client):
    a, b = two_workspaces
    _seed(a)
    for path in ("/api/v1/leads", "/api/v1/customers", "/api/v1/deals", "/api/v1/contacts"):
        payload = auth_client(b).get(path).json()
        assert payload["items"] == [], f"{path} leaked another workspace's rows"


def test_iso_8_timeline_never_leaks_another_tenant(two_workspaces, auth_client):
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(f"/api/v1/leads/{seeded['lead'].public_id}/timeline")
    assert response.status_code == 404


@pytest.mark.nc
def test_iso_9_the_owner_CAN_read_its_own_rows(two_workspaces, auth_client):
    """Non-vacuity control: the isolation tests above must fail for the RIGHT
    reason. The same requests succeed for the owning workspace."""
    a, _ = two_workspaces
    seeded = _seed(a)
    client = auth_client(a)
    assert client.get(f"/api/v1/leads/{seeded['lead'].public_id}").status_code == 200
    assert client.get(f"/api/v1/customers/{seeded['customer'].public_id}").status_code == 200
    assert client.get(f"/api/v1/deals/{seeded['deal'].public_id}").status_code == 200
    assert client.get(f"/api/v1/leads/{seeded['lead'].public_id}/timeline").status_code == 200


def test_iso_10_client_supplied_workspace_id_is_ignored(two_workspaces, auth_client):
    """The client NEVER supplies its workspace. Authority comes from the
    session's active_workspace alone (FI-B0-07)."""
    a, b = two_workspaces
    seeded = _seed(a)
    response = auth_client(b).get(
        "/api/v1/leads",
        {"workspace_id": str(a.workspace.id), "workspace_ref": a.workspace.public_id},
    )
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert seeded["lead"].public_id not in response.content.decode()


def test_iso_11_client_supplied_role_is_ignored(actor, auth_client):
    """The client never supplies its role. A viewer claiming to be owner stays
    a viewer."""
    viewer = actor(email="v@example.test", role="viewer")
    response = auth_client(viewer).post(
        "/api/v1/leads",
        {"origin_type": "manual", "role": "owner", "primary_contact": {"name": "Nope"}},
        format="json",
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


def test_iso_12_unauthorized_permission_mutation_is_refused(actor, auth_client):
    """A role without the permission cannot mutate, whatever the frontend shows."""
    viewer = actor(email="v2@example.test", role="viewer")
    owner = actor(email="o2@example.test", workspace_name="Alpha")
    seeded = _seed(owner)

    # Put the viewer in the SAME workspace so this is a permission test, not
    # an isolation test.
    from apps.workspaces.models import Membership

    Membership.objects.create(workspace=owner.workspace, user=viewer.user, role="viewer", status="active")
    viewer.session.active_workspace = owner.workspace
    viewer.session.save(update_fields=["active_workspace"])

    response = auth_client(viewer).post(
        f"/api/v1/leads/{seeded['lead'].public_id}/status",
        {"status": "qualified"},
        format="json",
        HTTP_IF_MATCH="1",
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


def test_iso_13_unauthenticated_request_is_401(api):
    response = api.get("/api/v1/leads")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_iso_14_revoked_session_is_refused(actor, auth_client):
    a = actor(email="rev@example.test")
    client = auth_client(a)
    assert client.get("/api/v1/leads").status_code == 200
    a.session.revoke()
    assert client.get("/api/v1/leads").status_code == 401
