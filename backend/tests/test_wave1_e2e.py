"""WAVE1_E2E — the full required path, exercised through the HTTP API only.

  1  create/authenticate a user      7  read Lead / Party360
  2  create/select a Workspace       8  create a Deal
  3  establish a Membership          9  close and retrieve the Deal
  4  create a Customer              10  verify PostgreSQL persistence/read-back
  5  create a Contact               11  verify a Won Deal created NO revenue
  6  create a manual Lead           12  verify Workspace B cannot reach A
     WITHOUT Discovery                  plus Lead -> Customer conversion

Nothing here uses a fixture, a fake or a bypass: every step is a real request
against the real database.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

pytestmark = [pytest.mark.django_db, pytest.mark.e2e]

PASSWORD = "correct-horse-battery-staple"


def _client(token: str | None = None) -> APIClient:
    client = APIClient()
    if token:
        client.credentials(HTTP_X_SESSION_TOKEN=token)
    return client


def _register_and_login(email: str, delivered) -> str:
    """Steps 1: register, verify the email, log in. Returns the session token.

    The verification token is obtained from the OUT-OF-BAND delivery boundary,
    never from the HTTP response — the frozen `202 Empty` carries no body.
    """
    anon = _client()

    registered = anon.post(
        "/api/v1/auth/register",
        {"email": email, "password": PASSWORD, "full_name": "Test Owner"},
        format="json",
    )
    assert registered.status_code == 202, registered.content
    assert not registered.content, "202 Empty carries no body"
    verification_token = delivered.token_for("verify_email")
    assert verification_token, "the token must reach the delivery boundary"

    verified = anon.post("/api/v1/auth/verify-email", {"token": verification_token}, format="json")
    assert verified.status_code == 200
    assert verified.json()["email_verified"] is True

    logged_in = anon.post("/api/v1/auth/login", {"email": email, "password": PASSWORD}, format="json")
    assert logged_in.status_code == 200, logged_in.content
    body = logged_in.json()
    # Zero-workspace login SUCCEEDS and says so, rather than failing.
    assert body["has_workspace"] is False
    assert body["active_workspace_ref"] is None
    return body["session_token"]


def test_wave1_end_to_end(delivered):
    # ---- 1. create / authenticate a user --------------------------------
    token = _register_and_login("owner@wave1.test", delivered)
    client = _client(token)

    # ---- 2 & 3. create a workspace; membership is established ------------
    created = client.post("/api/v1/workspaces", {"name": "Wave One Co"}, format="json")
    assert created.status_code == 201, created.content
    workspace_ref = created.json()["workspace_ref"]
    assert created.json()["role"] == "owner"

    switched = client.post(f"/api/v1/workspaces/{workspace_ref}/switch", format="json")
    assert switched.status_code == 200
    assert switched.json()["active_workspace_ref"] == workspace_ref

    members = client.get("/api/v1/workspaces/members").json()
    assert len(members["items"]) == 1
    assert members["items"][0]["role"] == "owner"

    entitlements = client.get("/api/v1/entitlements").json()
    assert entitlements["role"] == "owner"
    assert "lead.create" in entitlements["permissions"]

    # ---- 4 & 5. create a Customer with a Contact -------------------------
    customer_response = client.post(
        "/api/v1/customers",
        {
            "party_kind": "organization",
            "name": "Northwind Trading",
            "primary_contact": {
                "name": "Dana Reed",
                "phone": "+966500000001",
                "email": "dana@northwind.test",
            },
        },
        format="json",
    )
    assert customer_response.status_code == 201, customer_response.content
    customer_ref = customer_response.json()["customer_ref"]
    assert customer_response.json()["party_kind"] == "organization"

    contacts = client.get("/api/v1/contacts").json()
    assert any(c["full_name"] == "Dana Reed" for c in contacts["items"])

    # ---- 6. create a manual Lead WITHOUT Discovery -----------------------
    lead_response = client.post(
        "/api/v1/leads",
        {"origin_type": "manual", "primary_contact": {"name": "Omar Aziz", "phone": "+966500000003"}},
        format="json",
    )
    assert lead_response.status_code == 201, lead_response.content
    lead_body = lead_response.json()
    lead_ref = lead_body["lead_ref"]

    assert lead_body["business_ref"] is None  # no fabricated Business
    assert lead_body["display_name"] == "Omar Aziz"  # CA-15 display identity
    assert lead_body["display_source"] == "contact"

    from apps.crm.models import LeadProvenance
    from apps.discovery.models import Business, DiscoveryJob

    assert DiscoveryJob.objects.count() == 0
    assert Business.objects.count() == 0
    assert LeadProvenance.objects.count() == 0

    # ---- 7. read the Lead / Party360 -------------------------------------
    detail = client.get(f"/api/v1/leads/{lead_ref}")
    assert detail.status_code == 200
    detail_body = detail.json()
    assert detail_body["lead"]["lead_ref"] == lead_ref
    assert detail_body["contacts"][0]["full_name"] == "Omar Aziz"
    assert "business" not in detail_body  # key-absent, not null
    assert detail_body["activities"], "the timeline should carry LeadCreated"

    timeline = client.get(f"/api/v1/leads/{lead_ref}/timeline").json()
    assert {e["source_domain"] for e in timeline["items"]} == {"crm"}

    # ---- Lead -> Customer conversion -------------------------------------
    converted = client.post(
        f"/api/v1/leads/{lead_ref}/convert-customer",
        {"party_kind": "organization"},
        format="json",
        HTTP_IF_MATCH=str(lead_body["version"]),
    )
    assert converted.status_code == 201, converted.content
    converted_ref = converted.json()["customer_ref"]
    assert converted.json()["origin_kind"] == "conversion"

    # The Lead is RETAINED, and conversion is idempotent.
    assert client.get(f"/api/v1/leads/{lead_ref}").status_code == 200
    replay = client.post(
        f"/api/v1/leads/{lead_ref}/convert-customer",
        {"party_kind": "organization"},
        format="json",
        HTTP_IF_MATCH="1",
    )
    assert replay.status_code == 409
    # Still no fabricated Discovery provenance after conversion.
    assert LeadProvenance.objects.count() == 0

    # ---- 8. create a Deal -------------------------------------------------
    deal_response = client.post(
        "/api/v1/deals",
        {"title": "Northwind Renewal", "customer_ref": customer_ref, "value": "50000.00"},
        format="json",
    )
    assert deal_response.status_code == 201, deal_response.content
    deal_body = deal_response.json()
    deal_ref = deal_body["deal_ref"]
    assert deal_body["status"] == "open"

    pipelines = client.get("/api/v1/pipelines").json()
    stages = pipelines["items"][0]["stages"]
    assert len(stages) == 5

    moved = client.post(
        f"/api/v1/deals/{deal_ref}/stage",
        {"stage_ref": stages[2]["stage_ref"]},
        format="json",
        HTTP_IF_MATCH=str(deal_body["version"]),
    )
    assert moved.status_code == 200
    assert moved.json()["stage"]["name"] == "Proposal"

    # ---- 9. close the Deal Won and retrieve it ----------------------------
    closed = client.post(
        f"/api/v1/deals/{deal_ref}/close",
        {"outcome": "won"},
        format="json",
        HTTP_IF_MATCH=str(moved.json()["version"]),
    )
    assert closed.status_code == 200, closed.content
    assert closed.json()["status"] == "won"

    retrieved = client.get(f"/api/v1/deals/{deal_ref}").json()
    assert retrieved["status"] == "won"
    assert retrieved["value"] == "50000.00"

    # ---- 10. verify PostgreSQL persistence and read-back ------------------
    from django.db import connection

    assert connection.vendor == "postgresql"

    with connection.cursor() as cursor:
        cursor.execute("SELECT status, value::text FROM deals WHERE public_id = %s", [deal_ref])
        row = cursor.fetchone()
    assert row == ("won", "50000.00"), "the deal did not persist to PostgreSQL"

    # Read back through a brand-new client and session: durable, not cached.
    fresh_token = (
        _client()
        .post(
            "/api/v1/auth/login",
            {"email": "owner@wave1.test", "password": PASSWORD},
            format="json",
        )
        .json()["session_token"]
    )
    fresh = _client(fresh_token)
    assert fresh.get(f"/api/v1/deals/{deal_ref}").json()["status"] == "won"
    assert fresh.get(f"/api/v1/leads/{lead_ref}").status_code == 200
    assert fresh.get(f"/api/v1/customers/{customer_ref}").status_code == 200

    # The merged timeline now carries CRM + Pipeline, in one deterministic order.
    merged = fresh.get(f"/api/v1/leads/{lead_ref}/timeline").json()
    keys = [(e["occurred_at"], e["entry_id"]) for e in merged["items"]]
    assert keys == sorted(keys, reverse=True)

    # ---- 11. a Won Deal created NO recognized revenue ---------------------
    # The register exists from Wave 3 onward, so the assertion is on ROWS, not
    # on the table's absence — a strictly stronger statement.
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
              AND (table_name LIKE '%%revenue%%' OR table_name LIKE '%%attribution%%')
            ORDER BY table_name
        """)
        tables = [row[0] for row in cursor.fetchall()]
    assert "revenue_events" in tables, "the revenue register is missing"
    with connection.cursor() as cursor:
        for table in tables:
            cursor.execute(f"SELECT count(*) FROM {table}")  # noqa: S608 - catalog-derived
            assert cursor.fetchone()[0] == 0, f"a Won Deal produced revenue truth in {table}"

    # ---- 12. Workspace B cannot reach Workspace A -------------------------
    other_token = _register_and_login("intruder@wave1.test", delivered)
    other = _client(other_token)
    other.post("/api/v1/workspaces", {"name": "Other Co"}, format="json")

    for path in (
        f"/api/v1/leads/{lead_ref}",
        f"/api/v1/customers/{customer_ref}",
        f"/api/v1/customers/{converted_ref}",
        f"/api/v1/deals/{deal_ref}",
        f"/api/v1/leads/{lead_ref}/timeline",
    ):
        response = other.get(path)
        assert response.status_code == 404, f"{path} leaked to another workspace"
        assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"

    # And a cross-workspace MUTATION is refused the same way.
    assert (
        other.post(
            f"/api/v1/deals/{deal_ref}/close",
            {"outcome": "lost", "loss_reason": "x"},
            format="json",
            HTTP_IF_MATCH="1",
        ).status_code
        == 404
    )

    # Its own lists stay empty — no row of A's is visible anywhere.
    for path in ("/api/v1/leads", "/api/v1/customers", "/api/v1/deals"):
        assert other.get(path).json()["items"] == []


def test_wave1_requires_no_provider_credential(monkeypatch, delivered):
    """DEMO 0: starting with ZERO provider credentials must succeed."""
    for variable in (
        "OPENAI_API_KEY",
        "WHATSAPP_ACCESS_TOKEN",
        "GOOGLE_PLACES_API_KEY",
        "TAP_SECRET_KEY",
        "SCRAPING_API_KEY",
    ):
        monkeypatch.delenv(variable, raising=False)

    token = _register_and_login("noproviders@wave1.test", delivered)
    client = _client(token)
    client.post("/api/v1/workspaces", {"name": "No Providers Co"}, format="json")

    created = client.post(
        "/api/v1/customers",
        {
            "party_kind": "person",
            "name": "Sara Khan",
            "primary_contact": {"name": "Sara Khan", "phone": "+966500000009"},
        },
        format="json",
    )
    assert created.status_code == 201


def test_health_and_readiness_are_not_provider_dependent(monkeypatch):
    for variable in ("OPENAI_API_KEY", "WHATSAPP_ACCESS_TOKEN", "GOOGLE_PLACES_API_KEY"):
        monkeypatch.delenv(variable, raising=False)

    client = _client()
    assert client.get("/health").status_code == 200
    ready = client.get("/ready")
    assert ready.status_code == 200, ready.content
    assert ready.json()["checks"]["database"] == "ok"
