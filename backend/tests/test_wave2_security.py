"""Wave 2 security negative controls (§56).

The cross-workspace, webhook and firewall controls live with their own slices.
This file covers what spans slices: optimistic concurrency on the NEW versioned
aggregates, and the credential boundary across every Wave 2 surface at once.
"""

from __future__ import annotations

import json
import os

import pytest
from django.utils import timezone

pytestmark = [pytest.mark.django_db, pytest.mark.security]

SENTINEL = {
    "GOOGLE_PLACES_API_KEY": "sentinel-places-key-DO-NOT-LEAK",
    "OPENAI_API_KEY": "sentinel-openai-key-DO-NOT-LEAK",
    "WHATSAPP_ACCESS_TOKEN": "sentinel-wa-token-DO-NOT-LEAK",
    "WHATSAPP_APP_SECRET": "sentinel-wa-secret-DO-NOT-LEAK",
    "WHATSAPP_VERIFY_TOKEN": "sentinel-wa-verify-DO-NOT-LEAK",
    "SCRAPING_API_KEY": "sentinel-scraping-key-DO-NOT-LEAK",
}


@pytest.fixture
def owner(actor):
    return actor(email="sec-owner@example.test", role="owner", workspace_name="SecOwner")


@pytest.fixture
def sentinel_env(monkeypatch):
    for name, value in SENTINEL.items():
        monkeypatch.setenv(name, value)
    return SENTINEL


# --------------------------------------------------------------------------
# Stale If-Match on every NEW versioned aggregate.
# --------------------------------------------------------------------------


def _conversation(owner):
    from apps.messaging.models import Conversation

    return Conversation.objects.create(
        workspace=owner.workspace, peer_address="+966500606060", last_inbound_at=timezone.now()
    )


def test_a_stale_if_match_is_refused_on_every_wave_2_aggregate(owner, auth_client):
    """ADR-010 holds for the aggregates Wave 2 introduced.

    A consumed version must be refused with `409 STALE_VERSION` and write
    nothing — the same contract Wave 1 already proved for Deal, Lead and
    Customer.
    """
    from apps.assignment.services import upsert_assignment_rule
    from apps.automation.services import activate_revision, create_rule
    from apps.knowledge.services import create_article

    api = auth_client(owner)
    conversation = _conversation(owner)

    article = create_article(context=owner.context, title="Versioned", body="Body text.")
    rule = create_rule(
        context=owner.context,
        name="versioned-rule",
        trigger_type="lead_created",
        actions=[{"action_type": "create_task", "params": {"title": "T"}}],
    )
    activate_revision(context=owner.context, rule=rule)
    assignment_rule = upsert_assignment_rule(
        context=owner.context, name="versioned-assignment", member_refs=[owner.membership.public_id]
    )

    cases = [
        (
            "conversation",
            "post",
            f"/api/v1/conversations/{conversation.public_id}/handling-mode",
            {"handling_mode": "ai_assisted"},
        ),
        ("knowledge", "post", f"/api/v1/knowledge/articles/{article.public_id}/publish", {}),
        ("automation", "patch", f"/api/v1/automation/rules/{rule.public_id}", {"status": "paused"}),
        (
            "assignment",
            "patch",
            f"/api/v1/assignment/rules/{assignment_rule.public_id}",
            {"name": "renamed", "member_refs": [owner.membership.public_id]},
        ),
    ]

    for label, method, path, body in cases:
        # A version no aggregate can currently hold. Using "1" would be wrong:
        # a freshly created row IS at version 1, so the header would match.
        stale = getattr(api, method)(path, body, format="json", HTTP_IF_MATCH="999")
        assert stale.status_code == 409, f"{label}: expected 409, got {stale.status_code}"
        assert stale.json()["error"]["code"] == "STALE_VERSION", label


def test_a_consumed_version_cannot_apply_a_change_twice(owner, auth_client):
    """The Wave 1 lesson, re-proved on a Wave 2 aggregate."""
    conversation = _conversation(owner)
    api = auth_client(owner)

    first = api.post(
        f"/api/v1/conversations/{conversation.public_id}/handling-mode",
        {"handling_mode": "ai_assisted"},
        format="json",
        HTTP_IF_MATCH=str(conversation.version),
    )
    assert first.status_code == 200

    replay = api.post(
        f"/api/v1/conversations/{conversation.public_id}/handling-mode",
        {"handling_mode": "human"},
        format="json",
        HTTP_IF_MATCH=str(conversation.version),
    )
    assert replay.status_code == 409
    conversation.refresh_from_db()
    assert conversation.handling_mode == "ai_assisted", "a consumed version applied a second change"


# --------------------------------------------------------------------------
# The credential boundary, across every Wave 2 surface at once.
# --------------------------------------------------------------------------


def test_no_provider_credential_appears_on_any_wave_2_api_surface(owner, auth_client, sentinel_env):
    """With sentinel credentials set, sweep every Wave 2 read surface."""
    api = auth_client(owner)
    surfaces = [
        "/api/v1/discovery/jobs",
        "/api/v1/discovery/sources",
        "/api/v1/intelligence/analyses",
        "/api/v1/conversations",
        "/api/v1/templates",
        "/api/v1/assignment/rules",
        "/api/v1/knowledge/articles",
        "/api/v1/agent/proposals",
        "/api/v1/automation/rules",
        "/api/v1/automation/runs",
    ]
    for path in surfaces:
        response = api.get(path)
        assert response.status_code == 200, f"{path} -> {response.status_code}"
        body = response.content.decode()
        for name, value in sentinel_env.items():
            assert value not in body, f"{name} leaked on {path}"


def test_no_provider_credential_reaches_an_audit_row_an_event_or_a_log(
    owner, sentinel_env, caplog, client
):
    import logging

    from apps.auditlog.models import AuditLog
    from apps.discovery.services import create_discovery_job
    from apps.platform_async.models import IntegrationConnection, OutboxEvent

    IntegrationConnection.objects.create(
        workspace=owner.workspace, provider="whatsapp", status="enabled",
        provider_account_id="PN-SEC", configuration_valid=True,
    )

    with caplog.at_level(logging.DEBUG):
        create_discovery_job(context=owner.context, terms=["clinic"], locations=["Riyadh"])
        body = json.dumps(
            {
                "entry": [
                    {
                        "changes": [
                            {
                                "value": {
                                    "metadata": {"phone_number_id": "PN-SEC"},
                                    "messages": [
                                        {
                                            "id": "wamid.sec.1",
                                            "from": "+966500707070",
                                            "timestamp": str(int(timezone.now().timestamp())),
                                            "type": "text",
                                            "text": {"body": "hello"},
                                        }
                                    ],
                                }
                            }
                        ]
                    }
                ]
            }
        ).encode()
        from adapters.whatsapp import StubWhatsAppAdapter

        client.post(
            "/webhooks/whatsapp",
            data=body,
            content_type="application/json",
            HTTP_X_HUB_SIGNATURE_256=StubWhatsAppAdapter.sign(body),
        )

    haystacks = {
        "logs": " ".join(record.getMessage() for record in caplog.records),
        "audit": " ".join(f"{row.action}{row.metadata}" for row in AuditLog.objects.all()),
        "outbox": " ".join(f"{row.event_type}{row.payload}" for row in OutboxEvent.objects.all()),
    }
    for where, haystack in haystacks.items():
        for name, value in sentinel_env.items():
            assert value not in haystack, f"{name} leaked into {where}"
        # The signature header is a credential-equivalent and is never retained.
        assert "sha256=" not in haystack, f"a signature leaked into {where}"


def test_the_integration_surface_exposes_reference_names_never_values(owner, auth_client, sentinel_env):
    """B14_11 §1: a connection carries REFERENCE NAMES, never credential values."""
    response = auth_client(owner).get("/api/v1/discovery/sources")
    rendered = response.content.decode()
    body = response.json()

    assert body["items"], "the surface must actually list connections"
    for item in body["items"]:
        assert item["credential_refs"], f"{item['port']} listed no credential refs"
        for ref in item["credential_refs"]:
            # An environment-variable NAME: upper snake case, nothing else.
            assert ref == ref.upper(), ref
            assert all(ch.isalnum() or ch == "_" for ch in ref), ref
            # And the VALUE behind that name is nowhere in the response.
            assert os.environ.get(ref, "\0") not in rendered, f"{ref}'s value leaked"


def test_provider_configuration_is_not_writable_through_a_tenant_api(owner, auth_client):
    """V1 secret source is the server environment (B14_11 §1).

    No tenant API accepts a credential, so there is no endpoint through which
    one could be stored, echoed or logged.
    """
    api = auth_client(owner)
    for path in ("/api/v1/discovery/sources", "/api/v1/templates"):
        response = api.post(path, {"api_key": "attempt-to-set-a-secret"}, format="json")
        assert response.status_code in (403, 405), f"{path} accepted a write: {response.status_code}"


def test_an_unauthorized_member_cannot_read_the_provider_surface(actor, auth_client):
    sales = actor(email="sec-sales@example.test", role="sales", workspace_name="SecSales")
    denied = auth_client(sales).get("/api/v1/discovery/sources")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_every_wave_2_provider_reports_not_configured_rather_than_crashing(monkeypatch):
    """Absent credentials are a STATE, never an exception (§40, §41)."""
    from adapters.openai import OpenAIAdapter
    from adapters.places import GooglePlacesAdapter
    from adapters.scraping import UnselectedScrapingAdapter
    from adapters.whatsapp import MetaWhatsAppAdapter
    from common.provider_ports import NOT_CONFIGURED

    for name in SENTINEL:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)

    for adapter in (GooglePlacesAdapter(), OpenAIAdapter(), MetaWhatsAppAdapter(),
                    UnselectedScrapingAdapter()):
        status = adapter.status()
        assert status.status == NOT_CONFIGURED, adapter.provider_name
        assert status.configuration_valid is False
        # And the status itself carries only reference NAMES.
        assert all(ref.isupper() for ref in status.credential_refs)


def test_a_provider_failure_never_reaches_a_tenant_as_a_stack_trace(owner, auth_client):
    """§41. Provider failures map onto the frozen error envelope."""
    from apps.discovery.services import create_discovery_job, run_discovery_job
    from common.provider_ports import ProviderPermanentFailure, providers

    stub = providers.require("place_search")
    original = stub.search
    try:
        stub.search = lambda _r: (_ for _ in ()).throw(
            ProviderPermanentFailure(
                "Traceback: urllib.error.HTTPError 403 at https://provider.example/v1?key=SENTINEL",
                provider="place_search",
            )
        )
        job = create_discovery_job(context=owner.context, terms=["x"], locations=["Riyadh"])
        run_discovery_job(job_id=job.id)
    finally:
        stub.search = original

    body = auth_client(owner).get(f"/api/v1/discovery/jobs/{job.public_id}").content.decode()
    for leak in ("Traceback", "urllib", "provider.example", "SENTINEL", "403"):
        assert leak not in body, f"provider detail leaked: {leak}"
