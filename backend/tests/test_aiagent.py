"""I13 — AI Agent / OpenAI + Knowledge base. Frozen B4/B5/B7 + `B14_14`.

`T-WA-7` and `T-CA02-5..6` live HERE and not at I6, because before `aiagent`
existed they would have passed vacuously — there was no AI path to trace. Now
there is one, and these tests trace it.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

pytestmark = pytest.mark.django_db

APPS_ROOT = pathlib.Path(__file__).resolve().parent.parent / "apps"


@pytest.fixture
def owner(actor):
    return actor(email="agent-owner@example.test", role="owner", workspace_name="AgentOwner")


@pytest.fixture
def ai_stub():
    from common.provider_ports import providers

    return providers.require("ai")


@pytest.fixture
def conversation(owner):
    """An open, AI-assisted conversation with one inbound message."""
    from django.utils import timezone

    from apps.messaging.models import Conversation, Message

    conversation = Conversation.objects.create(
        workspace=owner.workspace,
        peer_address="+966500123456",
        handling_mode="ai_assisted",
        last_inbound_at=timezone.now(),
    )
    Message.objects.create(
        workspace=owner.workspace,
        conversation=conversation,
        direction="inbound",
        status="received",
        body="Do you offer website design and what does it cost?",
        provider_message_id="wamid.agent.1",
        occurred_at=timezone.now(),
    )
    return conversation


def _published_article(owner, title="Website design pricing", body="Website design starts at 3000 SAR."):
    from apps.knowledge.services import create_article, publish_article

    article = create_article(context=owner.context, title=title, body=body)
    return publish_article(context=owner.context, article=article)


def _session(owner, conversation):
    from apps.aiagent.services import start_agent_session

    return start_agent_session(context=owner.context, conversation=conversation)


def imported_modules(root: pathlib.Path) -> set[str]:
    """Modules actually IMPORTED under `root`, by AST — never by grep."""
    found: set[str] = set()
    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                found.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                found.add(node.module)
    return found


# --------------------------------------------------------------------------
# T-WA-7 (NC) — THE SEND FIREWALL. Non-vacuous: `aiagent` exists.
# --------------------------------------------------------------------------


def test_wa_7_nc_no_ai_path_reaches_the_send_command():
    """Trace every call path from `aiagent` and `adapters/openai`.

    Vacuity guard first: this test would pass trivially if `aiagent` did not
    exist, so it asserts the module IS present before asserting what it cannot
    reach.
    """
    aiagent = APPS_ROOT / "aiagent"
    assert aiagent.exists(), "T-WA-7 would be vacuous without aiagent"
    assert (aiagent / "services" / "__init__.py").read_text().strip(), "aiagent has no commands"

    # 1. aiagent imports NO send command and no messaging service module.
    names: set[str] = set()
    for path in aiagent.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and node.module:
                names.update(f"{node.module}.{a.name}" for a in node.names)
            elif isinstance(node, ast.Import):
                names.update(a.name for a in node.names)

    forbidden = [
        name
        for name in names
        if name.startswith("apps.messaging.services") or name.endswith(".send_message")
        or name.endswith(".deliver_outbound")
    ]
    assert forbidden == [], f"an AI path imported the send command: {forbidden}"

    # 2. aiagent never touches the whatsapp provider port.
    source = " ".join(path.read_text() for path in aiagent.rglob("*.py"))
    assert 'require("whatsapp")' not in source
    assert "OutboundMessageRequest" not in source

    # 3. The openai adapter reaches no app at all.
    adapters_openai = APPS_ROOT.parent / "adapters" / "openai"
    for path in adapters_openai.rglob("*.py"):
        text = path.read_text()
        assert "from apps." not in text and "import apps." not in text


def test_ai_1_nc_no_ai_owned_send_command_exists():
    """`AgentSendMessage` is deliberately not created — and cannot appear."""
    from apps.aiagent import services

    exported = set(services.__all__)
    for forbidden in ("AgentSendMessage", "agent_send_message", "send_message", "send"):
        assert forbidden not in exported

    # And no proposal kind maps to a send: the model's CHECK constraint means a
    # send-shaped proposal has nowhere to exist.
    from apps.aiagent.models import PROHIBITED_PROPOSAL_KINDS, PROPOSAL_KINDS

    assert not set(PROPOSAL_KINDS) & set(PROHIBITED_PROPOSAL_KINDS)
    for kind in PROPOSAL_KINDS:
        assert "send" not in kind


def test_ai_2_nc_a_send_shaped_proposal_cannot_be_stored(owner, conversation):
    """The prohibition is STRUCTURAL, not conventional."""
    from django.db import IntegrityError, transaction

    from apps.aiagent.models import AgentProposal

    session = _session(owner, conversation)
    with pytest.raises(IntegrityError), transaction.atomic():
        AgentProposal.objects.create(
            workspace=owner.workspace,
            session=session,
            proposal_kind="send_message",
            intent="draft_reply",
            context_hash="x" * 64,
            payload={"text": "hi"},
        )


def test_the_authority_ladder_refuses_a_prohibited_operation(owner):
    from apps.aiagent.services import authority_tier_for
    from common.errors import PermissionDeniedError

    assert authority_tier_for("draft_reply") == "execute"
    assert authority_tier_for("create_task") == "propose"
    assert authority_tier_for("next_action") == "recommend"

    for prohibited in ("send_message", "recognize_revenue", "change_permissions", "merge_identities"):
        with pytest.raises(PermissionDeniedError):
            authority_tier_for(prohibited)


def test_accepting_a_draft_does_not_send_it(owner, conversation, ai_stub, auth_client):
    """The load-bearing behaviour: accept marks the draft; a HUMAN then sends."""
    from apps.aiagent.services import generate_proposal
    from apps.messaging.models import Message
    from common.provider_ports import providers

    _published_article(owner)
    session = _session(owner, conversation)
    proposal = generate_proposal(session_id=session.id)
    assert proposal is not None

    wa = providers.require("whatsapp")
    before_sent, before_messages = len(wa.sent), Message.objects.filter(direction="outbound").count()

    accepted = auth_client(owner).post(
        f"/api/v1/agent/proposals/{proposal.public_id}/accept", {}, format="json"
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    # NOTHING was sent and no outbound message was even created.
    assert len(wa.sent) == before_sent
    assert Message.objects.filter(direction="outbound").count() == before_messages
    assert accepted.json()["resulting_command"] is None


def test_the_agent_holds_no_permissions_of_its_own(owner, actor, conversation, ai_stub):
    """Accepting runs the owning domain's command AS THE HUMAN.

    A member who may not create a task cannot obtain one by accepting.
    """
    from apps.aiagent.models import AgentProposal
    from apps.aiagent.services import accept_proposal
    from apps.crm.models import Task
    from common.authz import AuthorizationContext
    from common.errors import PermissionDeniedError
    from common.permissions_catalog import permissions_for_role

    session = _session(owner, conversation)
    proposal = AgentProposal.objects.create(
        workspace=owner.workspace,
        session=session,
        proposal_kind="create_task",
        intent="draft_reply",
        context_hash="t" * 64,
        payload={"title": "Follow up on pricing"},
    )

    # A viewer holds neither task.manage nor any agent authority.
    powerless = AuthorizationContext(
        user=owner.user,
        session=None,
        workspace=owner.workspace,
        membership=owner.membership,
        role="viewer",
        permissions=permissions_for_role("viewer") - {"task.manage"},
    )
    with pytest.raises(PermissionDeniedError):
        accept_proposal(context=powerless, proposal=proposal)
    assert not Task.objects.filter(workspace=owner.workspace).exists()

    # The same proposal, accepted by a member who DOES hold the permission.
    accepted = accept_proposal(context=owner.context, proposal=proposal)
    assert accepted.resulting_command == "CreateTask"
    assert Task.objects.filter(workspace=owner.workspace).count() == 1


# --------------------------------------------------------------------------
# T-CA02-5..6 — the AI half of GAP-012, now executable.
# --------------------------------------------------------------------------


def test_ca02_5_queued_ai_work_rereads_the_mode_at_execution(owner, conversation, ai_stub):
    """`FI-B12-05`. A takeover between queueing and running stops the work."""
    from apps.aiagent.models import AgentProposal
    from apps.aiagent.services import generate_proposal
    from apps.messaging.services import start_human_takeover

    session = _session(owner, conversation)

    # A human takes over AFTER the work would have been queued.
    start_human_takeover(context=owner.context, conversation=conversation)

    assert generate_proposal(session_id=session.id) is None
    assert not AgentProposal.objects.filter(session=session).exists()
    assert ai_stub.requests == [], "the provider was called despite the takeover"


def test_ca02_6_no_proposal_is_generated_outside_ai_assisted_mode(owner, conversation, ai_stub):
    from apps.aiagent.services import generate_proposal
    from apps.messaging.models import Conversation

    session = _session(owner, conversation)
    for mode in ("human", "ai_paused"):
        Conversation.objects.filter(pk=conversation.pk).update(handling_mode=mode)
        assert generate_proposal(session_id=session.id) is None
    assert ai_stub.requests == []

    Conversation.objects.filter(pk=conversation.pk).update(handling_mode="ai_assisted")
    assert generate_proposal(session_id=session.id) is not None


# --------------------------------------------------------------------------
# T-KB-1..3 — grounding and citations.
# --------------------------------------------------------------------------


def test_kb_1_retrieval_returns_published_articles_only(owner):
    from apps.knowledge.selectors import kb_retrieval
    from apps.knowledge.services import archive_article, create_article

    published = _published_article(owner, title="Published pricing", body="Pricing is 3000 SAR.")
    create_article(context=owner.context, title="Draft pricing", body="Draft pricing note.")
    archived = _published_article(owner, title="Old pricing", body="Old pricing was 2000 SAR.")
    archive_article(context=owner.context, article=archived)

    refs = {row["article_ref"] for row in kb_retrieval(workspace=owner.workspace, query="pricing")}
    assert refs == {published.public_id}


def test_kb_2_retrieval_never_crosses_a_workspace(actor, owner):
    from apps.knowledge.selectors import kb_retrieval

    stranger = actor(email="kb-stranger@example.test", workspace_name="KbStranger")
    _published_article(stranger, title="Their secret pricing", body="Their internal rate card.")
    _published_article(owner, title="Our pricing", body="Our public rate card.")

    ours = kb_retrieval(workspace=owner.workspace, query="pricing")
    assert [row["title"] for row in ours] == ["Our pricing"]
    assert all("secret" not in row["excerpt"].lower() for row in ours)


def test_kb_3_every_answer_cites_a_published_article_with_its_version(owner, conversation, ai_stub):
    from apps.aiagent.services import generate_proposal

    article = _published_article(owner)
    session = _session(owner, conversation)
    proposal = generate_proposal(session_id=session.id)

    assert proposal.citations, "a grounded answer must carry citations"
    for citation in proposal.citations:
        assert citation["article_ref"] == article.public_id
        assert citation["version"] == article.published_version


def test_a_citation_to_an_unpublished_article_is_dropped(owner, conversation, ai_stub):
    """A provider-returned citation is untrusted input like any other."""
    from apps.aiagent.services import generate_proposal
    from apps.knowledge.services import create_article

    _published_article(owner)
    hidden = create_article(context=owner.context, title="Internal only", body="Never publish this.")
    ai_stub.next_raw = {
        "content": "Here is our pricing.",
        "confidence": 0.8,
        "abstained": False,
        "citations": [
            {"article_ref": hidden.public_id, "version": 1},
            {"article_ref": "KBA-FABRICATED0000000", "version": 9},
        ],
    }
    session = _session(owner, conversation)
    proposal = generate_proposal(session_id=session.id)

    cited = {c["article_ref"] for c in proposal.citations}
    assert hidden.public_id not in cited, "an unpublished article was cited"
    assert "KBA-FABRICATED0000000" not in cited, "a fabricated citation survived"


def test_an_archived_article_stops_grounding_immediately(owner):
    from apps.knowledge.selectors import kb_retrieval
    from apps.knowledge.services import archive_article

    article = _published_article(owner)
    assert kb_retrieval(workspace=owner.workspace, query="website")
    archive_article(context=owner.context, article=article)
    assert kb_retrieval(workspace=owner.workspace, query="website") == []


def test_an_empty_article_cannot_be_published(owner):
    from apps.knowledge.services import create_article, publish_article
    from common.errors import ValidationFailed

    article = create_article(context=owner.context, title="Empty", body="   ")
    with pytest.raises(ValidationFailed):
        publish_article(context=owner.context, article=article)


def test_editing_appends_a_version_and_never_rewrites_a_published_one(owner):
    from apps.knowledge.models import KnowledgeArticleVersion
    from apps.knowledge.services import update_article

    article = _published_article(owner)
    published_version = article.published_version
    update_article(context=owner.context, article=article, title="Website design pricing",
                   body="Updated: now 3500 SAR.")

    versions = KnowledgeArticleVersion.objects.filter(article=article).order_by("version_no")
    assert versions.count() == 2
    # The cited version's text is untouched, so an answer already given stays
    # explainable.
    assert "3000 SAR" in versions.get(version_no=published_version).body


# --------------------------------------------------------------------------
# T-AI-5 / T-AI-6 — the provider boundary.
# --------------------------------------------------------------------------


def test_ai_5_no_provider_token_appears_in_the_business_domain():
    banned = ("openai", "gpt-", "finish_reason", "prompt_tokens", "completion_tokens", "api.openai.com")
    offenders = []
    for module in ("aiagent", "knowledge", "messaging", "intelligence"):
        for path in (APPS_ROOT / module).rglob("*.py"):
            lowered = path.read_text().lower()
            offenders += [f"{module}/{path.name}:{token}" for token in banned if token in lowered]
    assert offenders == [], f"a provider token leaked into a business domain: {offenders}"


def test_ai_5_no_provider_field_exists_on_an_agent_table():
    from apps.aiagent.models import AgentProposal, AgentSession

    for model in (AgentSession, AgentProposal):
        columns = {f.name for f in model._meta.get_fields() if hasattr(f, "attname")}
        for forbidden in ("model", "model_name", "provider", "tokens", "finish_reason", "prompt",
                          "completion", "temperature"):
            assert forbidden not in columns, f"{model.__name__} carries a provider field"


def test_ai_6_a_second_stub_adapter_satisfies_every_agent_path_unchanged(owner, conversation):
    """`T-AI-6`. A different implementation behind the same port, no domain change."""
    from apps.aiagent.services import generate_proposal
    from common.provider_ports import (
        AICitation,
        AIRequest,
        AIResult,
        AIUsage,
        ProviderStatus,
        providers,
    )

    class SecondStubAdapter:
        """A completely independent implementation of AIProviderPort."""

        provider_name = "second-stub"

        def status(self):
            return ProviderStatus(provider="second-stub", status="configured", configuration_valid=True)

        def generate(self, request: AIRequest) -> AIResult:
            return AIResult(
                intent=request.intent,
                content="A different implementation answered.",
                citations=tuple(
                    AICitation(article_ref=c.article_ref, version=c.version) for c in request.grounding
                ),
                confidence=0.5,
                usage=AIUsage(input_units=1, output_units=1, total_units=2),
            )

    article = _published_article(owner)
    previous = providers.ai
    try:
        providers.bind(ai=SecondStubAdapter())
        session = _session(owner, conversation)
        proposal = generate_proposal(session_id=session.id)
    finally:
        providers.bind(ai=previous)

    assert proposal is not None
    assert proposal.payload["text"] == "A different implementation answered."
    assert proposal.citations[0]["article_ref"] == article.public_id


def test_a_missing_api_key_leaves_the_inbox_working_with_no_proposals(owner, conversation, auth_client):
    from adapters.openai import StubAIAdapter
    from apps.aiagent.models import AgentProposal
    from apps.aiagent.services import generate_proposal
    from common.provider_ports import providers

    previous = providers.ai
    try:
        providers.bind(ai=StubAIAdapter(configured=False))
        session = _session(owner, conversation)
        assert generate_proposal(session_id=session.id) is None
    finally:
        providers.bind(ai=previous)

    assert not AgentProposal.objects.filter(workspace=owner.workspace).exists()
    # The inbox is entirely unaffected.
    assert auth_client(owner).get("/api/v1/conversations").status_code == 200


def test_no_prompt_or_completion_text_reaches_a_log_or_an_audit_row(owner, conversation, ai_stub, caplog):
    import logging

    from apps.aiagent.services import generate_proposal
    from apps.auditlog.models import AuditLog

    _published_article(owner)
    session = _session(owner, conversation)
    with caplog.at_level(logging.DEBUG):
        proposal = generate_proposal(session_id=session.id)

    drafted = proposal.payload["text"]
    rendered = " ".join(record.getMessage() for record in caplog.records)
    assert drafted not in rendered

    audit = " ".join(str(row.metadata) for row in AuditLog.objects.filter(workspace=owner.workspace))
    assert drafted not in audit
    assert "Do you offer website design" not in audit


def test_pd_002_masking_sends_no_contact_identity_to_the_provider(owner, conversation, ai_stub):
    from apps.aiagent.services import generate_proposal

    _published_article(owner)
    generate_proposal(session_id=_session(owner, conversation).id)

    sent = str(ai_stub.requests[-1].context)
    assert conversation.peer_address not in sent, "the counterparty's number was sent"
    assert "+966500123456" not in sent
    # What IS sent is the text a reply must answer.
    assert "website design" in sent.lower()


# --------------------------------------------------------------------------
# Idempotency and tenancy.
# --------------------------------------------------------------------------


def test_a_redelivered_generation_converges_on_one_proposal(owner, conversation, ai_stub):
    """Identity `(session, intent, context_hash)`."""
    from apps.aiagent.models import AgentProposal
    from apps.aiagent.services import generate_proposal

    _published_article(owner)
    session = _session(owner, conversation)

    first = generate_proposal(session_id=session.id)
    calls = len(ai_stub.requests)
    second = generate_proposal(session_id=session.id)

    assert first.pk == second.pk
    assert AgentProposal.objects.filter(session=session).count() == 1
    assert len(ai_stub.requests) == calls, "a redelivery re-called the provider"


def test_a_proposal_cannot_be_resolved_twice(owner, conversation, ai_stub):
    from apps.aiagent.services import accept_proposal, generate_proposal, reject_proposal
    from common.errors import DomainConflict

    _published_article(owner)
    proposal = generate_proposal(session_id=_session(owner, conversation).id)
    accept_proposal(context=owner.context, proposal=proposal)

    for command in (accept_proposal, reject_proposal):
        with pytest.raises(DomainConflict) as raised:
            command(context=owner.context, proposal=proposal)
        assert raised.value.details["reason"] == "proposal_already_resolved"


def test_a_proposal_from_another_workspace_is_not_found(actor, owner, conversation, ai_stub,
                                                        auth_client):
    from apps.aiagent.services import generate_proposal

    _published_article(owner)
    proposal = generate_proposal(session_id=_session(owner, conversation).id)
    stranger = actor(email="agent-iso@example.test", workspace_name="AgentIso")

    assert auth_client(stranger).post(
        f"/api/v1/agent/proposals/{proposal.public_id}/accept", {}, format="json"
    ).status_code == 404


def test_an_article_from_another_workspace_is_not_found(actor, owner, auth_client):
    article = _published_article(owner)
    stranger = actor(email="kb-iso@example.test", workspace_name="KbIso")

    assert auth_client(stranger).get(
        f"/api/v1/knowledge/articles/{article.public_id}"
    ).status_code == 404
    assert auth_client(owner).get(
        f"/api/v1/knowledge/articles/{article.public_id}"
    ).status_code == 200


def test_knowledge_management_requires_the_manage_permission(actor, auth_client):
    sales = actor(email="kb-sales@example.test", role="sales", workspace_name="KbSales")
    denied = auth_client(sales).post(
        "/api/v1/knowledge/articles", {"title": "Nope", "body": "x"}, format="json"
    )
    assert denied.status_code == 403
    # A sales member may still READ the knowledge base.
    assert auth_client(sales).get("/api/v1/knowledge/articles").status_code == 200


def test_aiagent_layering_is_downward_only():
    """aiagent(L8) -> messaging(L6), knowledge(L4), crm(L5), customers(L6)."""
    imports = imported_modules(APPS_ROOT / "aiagent")
    app_edges = {name.split(".")[1] for name in imports if name.startswith("apps.")}
    allowed = {"messaging", "knowledge", "crm", "customers", "workspaces", "aiagent"}
    assert app_edges <= allowed, f"aiagent reached outside its allowed edges: {app_edges - allowed}"
