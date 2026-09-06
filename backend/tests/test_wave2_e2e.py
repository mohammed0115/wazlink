"""Wave 2 product E2E — the real journey, end to end, on deterministic fakes.

Three journeys, each a hard Wave 2 gate:

1.  **Discovery -> AI.** A job produces Businesses; intelligence explains them.
2.  **CRM -> WhatsApp -> AI assist.** An existing Contact with NO Discovery
    provenance converses, is drafted for, and is answered by a HUMAN.
3.  **Automation.** An eligible trigger produces a follow-up task exactly once,
    and cannot bypass the human-send gate.

Every provider is a deterministic fake bound behind the real port, so nothing
here reaches a network and nothing is mocked away.
"""

from __future__ import annotations

import json

import pytest
from django.utils import timezone

pytestmark = [pytest.mark.django_db, pytest.mark.e2e]


@pytest.fixture
def workspace_actor(actor):
    return actor(email="e2e-owner@example.test", role="owner", workspace_name="Wave2E2E")


@pytest.fixture
def whatsapp(workspace_actor):
    from apps.platform_async.models import IntegrationConnection
    from common.provider_ports import providers

    IntegrationConnection.objects.create(
        workspace=workspace_actor.workspace,
        provider="whatsapp",
        status="enabled",
        provider_account_id="PN-E2E",
        configuration_valid=True,
    )
    return providers.require("whatsapp")


def _inbound(from_phone, text, message_id):
    return json.dumps(
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {"phone_number_id": "PN-E2E"},
                                "contacts": [{"wa_id": from_phone, "profile": {"name": "Customer"}}],
                                "messages": [
                                    {
                                        "id": message_id,
                                        "from": from_phone,
                                        "timestamp": str(int(timezone.now().timestamp())),
                                        "type": "text",
                                        "text": {"body": text},
                                    }
                                ],
                            }
                        }
                    ]
                }
            ],
        }
    ).encode()


def _deliver(client, body):
    """Post a signed callback and run the workers it schedules."""
    from adapters.whatsapp import StubWhatsAppAdapter
    from apps.messaging.tasks import process_webhook_receipt_task
    from common.dispatch import task_registry

    task_registry.enqueued.clear()
    response = client.post(
        "/webhooks/whatsapp",
        data=body,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=StubWhatsAppAdapter.sign(body),
    )
    for name, payload in list(task_registry.enqueued):
        if name == "messaging.process_webhook_receipt":
            process_webhook_receipt_task(payload["receipt_id"])
    return response


# ==========================================================================
# E2E 1 — DISCOVERY -> AI INTELLIGENCE (§48)
# ==========================================================================


def test_e2e_discovery_to_intelligence_with_explainable_output(workspace_actor, auth_client):
    """Workspace -> job -> Businesses -> analysis -> score, signals, next steps."""
    from apps.discovery.models import Business, DiscoveryJob
    from apps.discovery.services import run_discovery_job
    from apps.intelligence.models import IntelligenceRun
    from apps.intelligence.services import run_intelligence_analysis

    api = auth_client(workspace_actor)

    # 1. An authenticated user creates a Discovery job.
    created = api.post(
        "/api/v1/discovery/jobs",
        {"terms": ["dental clinic"], "locations": ["Riyadh"], "result_limit": 20},
        format="json",
    )
    assert created.status_code == 202
    job_ref = created.json()["job_ref"]

    # 2. The worker executes it against the bound (fake) provider.
    run_discovery_job(job_id=DiscoveryJob.objects.get(public_id=job_ref).id)

    # 3. Businesses are persisted and the results are served.
    results = api.get(f"/api/v1/discovery/jobs/{job_ref}/results")
    assert results.status_code == 200
    business_ref = results.json()["items"][0]["business"]["business_ref"]
    assert Business.objects.filter(workspace=workspace_actor.workspace).count() == 3

    # 4. AI intelligence is requested for one of them.
    analysis = api.post("/api/v1/intelligence/analyses", {"business_ref": business_ref}, format="json")
    assert analysis.status_code == 202
    analysis_ref = analysis.json()["analysis_ref"]
    run_intelligence_analysis(run_id=IntelligenceRun.objects.get(public_id=analysis_ref).id)

    # 5. The score is retrievable AND explainable.
    detail = api.get(f"/api/v1/intelligence/analyses/{analysis_ref}").json()
    assert detail["status"] == "completed"
    assert detail["overall_score"] == sum(detail["components"].values())
    assert detail["signals"], "a score with no evidence is not intelligence"
    assert detail["recommendations"], "the journey must reach a recommendation"
    assert detail["tier"] in ("high", "medium", "low")

    # 6. Retrying the whole journey duplicates nothing.
    run_discovery_job(job_id=DiscoveryJob.objects.get(public_id=job_ref).id)
    run_intelligence_analysis(run_id=IntelligenceRun.objects.get(public_id=analysis_ref).id)
    assert Business.objects.filter(workspace=workspace_actor.workspace).count() == 3
    assert IntelligenceRun.objects.filter(workspace=workspace_actor.workspace).count() == 1


def test_e2e_discovery_is_tenant_isolated_and_survives_provider_absence(actor, auth_client):
    from adapters.places import GooglePlacesAdapter
    from apps.discovery.models import Business
    from apps.discovery.services import create_discovery_job, run_discovery_job
    from common.provider_ports import providers

    one = actor(email="e2e-t1@example.test", workspace_name="E2ETenantOne")
    two = actor(email="e2e-t2@example.test", workspace_name="E2ETenantTwo")

    for who in (one, two):
        job = create_discovery_job(context=who.context, terms=["clinic"], locations=["Riyadh"])
        run_discovery_job(job_id=job.id)

    # Identical external records; completely disjoint rows.
    assert Business.objects.filter(workspace=one.workspace).count() == 3
    assert Business.objects.filter(workspace=two.workspace).count() == 3
    other = Business.objects.filter(workspace=two.workspace).first()
    assert auth_client(one).get(f"/api/v1/businesses/{other.public_id}").status_code == 404

    # With no credential, Discovery degrades and the platform does not.
    previous = providers.place_search
    try:
        providers.bind(place_search=GooglePlacesAdapter())  # no key in the environment
        job = create_discovery_job(context=one.context, terms=["clinic"], locations=["Jeddah"])
        failed = run_discovery_job(job_id=job.id)
    finally:
        providers.bind(place_search=previous)

    assert failed.status == "failed"
    assert failed.failure_code == "provider_not_configured"
    assert auth_client(one).get("/api/v1/leads").status_code == 200


# ==========================================================================
# E2E 2 — CRM -> WHATSAPP -> AI ASSIST -> HUMAN SEND (§49). HARD GATE.
# ==========================================================================


def test_e2e_crm_contact_without_discovery_converses_and_a_human_sends(
    workspace_actor, whatsapp, client, auth_client, django_capture_on_commit_callbacks
):
    """The Wave 2 gate: CRM works, and converses, with no Discovery anywhere."""
    from apps.aiagent.models import AgentProposal
    from apps.aiagent.services import generate_proposal
    from apps.crm.services import create_lead
    from apps.discovery.models import Business, DiscoveryJob
    from apps.knowledge.services import create_article, publish_article
    from apps.messaging.models import Conversation, Message
    from apps.messaging.tasks import send_outbound_message_task
    from common.dispatch import task_registry

    api = auth_client(workspace_actor)
    phone = "+966501234567"

    # 1. An existing CRM Contact — created MANUALLY, no Discovery.
    lead = create_lead(
        context=workspace_actor.context,
        origin_type="manual",
        primary_contact={"name": "Existing Customer", "phone": phone},
    )
    assert lead.business_id is None
    assert not Business.objects.filter(workspace=workspace_actor.workspace).exists()
    assert not DiscoveryJob.objects.filter(workspace=workspace_actor.workspace).exists()

    # A published KB article to ground the draft.
    article = publish_article(
        context=workspace_actor.context,
        article=create_article(
            context=workspace_actor.context,
            title="Website pricing",
            body="Our website design package starts at 3000 SAR and takes two weeks.",
        ),
    )

    # 2. An inbound WhatsApp message arrives by webhook.
    accepted = _deliver(client, _inbound(phone, "How much is a website?", "wamid.e2e.1"))
    assert accepted.status_code == 200

    # 3. Identity resolution linked it to the EXISTING contact — no Discovery.
    conversation = Conversation.objects.get(workspace=workspace_actor.workspace)
    assert conversation.identity_state == "resolved"
    assert conversation.contact.full_name == "Existing Customer"
    Conversation.objects.filter(pk=conversation.pk).update(lead=lead)

    # 4. It appears in the Team Inbox.
    inbox = api.get("/api/v1/conversations").json()
    assert len(inbox["items"]) == 1
    assert inbox["items"][0]["latest_message"]["body"] == "How much is a website?"

    # 5. The human switches to AI-assisted and the agent DRAFTS.
    api.post(
        f"/api/v1/conversations/{conversation.public_id}/handling-mode",
        {"handling_mode": "ai_assisted"},
        format="json",
    )
    session = api.post(
        "/api/v1/agent/sessions", {"conversation_ref": conversation.public_id}, format="json"
    )
    assert session.status_code == 201

    from apps.aiagent.models import AgentSession

    proposal = generate_proposal(
        session_id=AgentSession.objects.get(public_id=session.json()["session_ref"]).id
    )
    assert proposal is not None
    assert proposal.citations[0]["article_ref"] == article.public_id  # grounded, with a citation

    # 6. NO outbound provider call has happened. This is the firewall.
    assert len(whatsapp.sent) == 0
    assert not Message.objects.filter(
        workspace=workspace_actor.workspace, direction="outbound"
    ).exists()

    # 7. The human accepts the draft — still nothing is sent.
    accepted_proposal = api.post(
        f"/api/v1/agent/proposals/{proposal.public_id}/accept", {}, format="json"
    )
    assert accepted_proposal.status_code == 200
    assert len(whatsapp.sent) == 0
    assert AgentProposal.objects.get(pk=proposal.pk).status == "accepted"

    # 8. The HUMAN invokes Send, through messaging's own frozen command.
    task_registry.enqueued.clear()
    with django_capture_on_commit_callbacks(execute=True):
        sent = api.post(
            "/api/v1/messages",
            {
                "conversation_ref": conversation.public_id,
                "body": accepted_proposal.json()["text"],
                "ai_assisted": True,
            },
            format="json",
        )
    assert sent.status_code == 202
    for name, payload in task_registry.enqueued:
        if name == "messaging.send_outbound_message":
            send_outbound_message_task(payload["message_id"])

    # 9. The provider was called EXACTLY ONCE, by a human.
    assert len(whatsapp.sent) == 1
    outbound = Message.objects.get(workspace=workspace_actor.workspace, direction="outbound")
    assert outbound.status == "sent"
    assert outbound.sent_by_id == workspace_actor.membership.id
    assert outbound.ai_assisted is True  # assistance is TAGGED, not attributed

    # 10. The conversation is visible in Party360 and on the merged timeline.
    lead_360 = api.get(f"/api/v1/leads/{lead.public_id}").json()
    assert "conversations" in lead_360
    timeline = api.get(f"/api/v1/leads/{lead.public_id}/timeline").json()
    domains = {entry["source_domain"] for entry in timeline["items"]}
    assert {"crm", "messaging"} <= domains

    # 11. And STILL no Discovery artifact exists anywhere in this journey.
    assert not Business.objects.filter(workspace=workspace_actor.workspace).exists()
    assert not DiscoveryJob.objects.filter(workspace=workspace_actor.workspace).exists()


# ==========================================================================
# E2E 3 — AUTOMATION (§50)
# ==========================================================================


def test_e2e_automation_produces_a_follow_up_task_exactly_once(
    workspace_actor, whatsapp, client, auth_client
):
    """`ConversationReceived` -> rule -> follow-up Task, once and only once."""
    from apps.automation.services import evaluate_event, execute_run
    from apps.crm.models import Task
    from apps.messaging.models import Conversation

    api = auth_client(workspace_actor)

    rule = api.post(
        "/api/v1/automation/rules",
        {
            "name": "Follow up on every inbound",
            "trigger_type": "conversation_received",
            "actions": [{"action_type": "create_task", "params": {"title": "Reply to customer"}}],
            "activate": True,
        },
        format="json",
    )
    assert rule.status_code == 201
    assert rule.json()["actions"][0]["safety_tier"] == "auto_safe"

    _deliver(client, _inbound("+966509876543", "Hello there", "wamid.e2e.auto"))
    conversation = Conversation.objects.get(workspace=workspace_actor.workspace)

    runs = evaluate_event(
        workspace=workspace_actor.workspace,
        trigger_type="conversation_received",
        source_event_id="evt-e2e-auto",
        payload={"entity_ref": conversation.public_id},
    )
    assert len(runs) == 1
    execute_run(run_id=runs[0].pk, actor_context=workspace_actor.context)

    assert Task.objects.filter(workspace=workspace_actor.workspace).count() == 1

    # Duplicate event, worker retry, concurrent-shaped repetition: still once.
    evaluate_event(
        workspace=workspace_actor.workspace,
        trigger_type="conversation_received",
        source_event_id="evt-e2e-auto",
        payload={"entity_ref": conversation.public_id},
    )
    for _ in range(3):
        execute_run(run_id=runs[0].pk, actor_context=workspace_actor.context)
    assert Task.objects.filter(workspace=workspace_actor.workspace).count() == 1


def test_e2e_automation_cannot_bypass_the_human_send_firewall(
    workspace_actor, whatsapp, client, auth_client, django_capture_on_commit_callbacks
):
    """The prohibition, end to end and from every direction."""
    from apps.automation.models import AutomationRun
    from apps.automation.services import evaluate_event
    from apps.messaging.models import Conversation, Message

    api = auth_client(workspace_actor)
    _deliver(client, _inbound("+966505555555", "Any offers?", "wamid.e2e.fire"))
    conversation = Conversation.objects.get(workspace=workspace_actor.workspace)

    created = api.post(
        "/api/v1/automation/rules",
        {
            "name": "Auto responder",
            "trigger_type": "conversation_received",
            "actions": [
                {
                    "action_type": "send_message",
                    "params": {"conversation_ref": conversation.public_id, "body": "Auto reply"},
                }
            ],
            "activate": True,
        },
        format="json",
    )
    # The tier is APPROVAL_REQUIRED and the rule author could not choose it.
    assert created.json()["actions"][0]["safety_tier"] == "approval_required"

    runs = evaluate_event(
        workspace=workspace_actor.workspace,
        trigger_type="conversation_received",
        source_event_id="evt-e2e-fire",
        payload={"conversation_ref": conversation.public_id},
    )
    run = AutomationRun.objects.get(pk=runs[0].pk)

    # Firing sent NOTHING; it stopped at the human gate.
    assert run.status == "awaiting_approval"
    assert len(whatsapp.sent) == 0
    assert not Message.objects.filter(
        workspace=workspace_actor.workspace, direction="outbound"
    ).exists()

    # It surfaces in the approval queue for a human to decide.
    queue = api.get("/api/v1/automation/runs?awaiting_approval=true").json()
    assert [item["run_ref"] for item in queue["items"]] == [run.public_id]

    # A human rejects it: still nothing sent, every step skipped.
    rejected = api.post(f"/api/v1/automation/runs/{run.public_id}/reject",
                        {"reason": "Not appropriate"}, format="json")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert len(whatsapp.sent) == 0
    assert not Message.objects.filter(
        workspace=workspace_actor.workspace, direction="outbound"
    ).exists()


# ==========================================================================
# Wave 1 invariants, still true at the end of Wave 2.
# ==========================================================================


def test_e2e_won_deal_is_still_not_recognized_revenue(workspace_actor, auth_client):
    """`WON_DEAL_EQUALS_REVENUE = FALSE`, after everything Wave 2 added."""
    from apps.crm.services import create_lead
    from apps.pipeline.services import close_deal, create_deal

    lead = create_lead(
        context=workspace_actor.context,
        origin_type="manual",
        primary_contact={"name": "Deal Contact", "phone": "+966507777777"},
    )
    deal = create_deal(context=workspace_actor.context, title="Website build", lead=lead, value=50000)
    won = close_deal(context=workspace_actor.context, deal=deal, outcome="won",
                     expected_version=deal.version)

    assert won.status == "won"
    body = auth_client(workspace_actor).get(f"/api/v1/deals/{won.public_id}").json()
    assert "recognized_revenue" not in body and "revenue" not in body

    # No domain created a revenue row either — none of them can. Wave 3 adds
    # the register, so this asserts emptiness rather than absence: a Won Deal
    # reaching the one writer would be caught here, and previously could not be.
    from apps.revenue.models import RevenueAttribution, RevenueEvent

    assert RevenueEvent.objects.count() == 0, "a Won Deal reached the revenue register"
    assert RevenueAttribution.objects.count() == 0
