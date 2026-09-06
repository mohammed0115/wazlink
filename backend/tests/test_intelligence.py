"""I4 — AI Lead Intelligence. Frozen B4 + `B14_14`.

Every test runs against the deterministic stub bound behind `AIProviderPort`.
No test reaches a provider network, and no domain module knows the difference —
which is `T-AI-6`'s replaceability claim, exercised continuously.
"""

from __future__ import annotations

import ast
import pathlib

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(actor):
    return actor(email="intel-owner@example.test", role="owner", workspace_name="IntelOwner")


@pytest.fixture
def ai_stub():
    from common.provider_ports import providers

    return providers.require("ai")


def _business(owner, **overrides):
    from apps.discovery.models import Business

    fields = {
        "name": "Analysable Co",
        "city": "Riyadh",
        "category": "restaurant",
        "phone": "+966500000001",
        "website": "",
        "rating": 4.4,
        "review_count": 120,
        "provider_external_id": f"ext-{overrides.pop('seq', 1)}",
        "source_provider": "place_search",
    }
    fields.update(overrides)
    return Business.objects.create(workspace=owner.workspace, **fields)


def _analyse(owner, business):
    from apps.intelligence.services import request_analysis, run_intelligence_analysis

    run, _ = request_analysis(context=owner.context, business=business)
    return run_intelligence_analysis(run_id=run.id)


# --------------------------------------------------------------------------
# Scoring — explainable, deterministic, reproducible.
# --------------------------------------------------------------------------


def test_a_score_is_named_components_over_retained_evidence_not_one_opaque_number(owner, ai_stub):
    """B4-D-A009. Every point is traceable to a signal that produced it."""
    from apps.intelligence.models import SCORE_COMPONENTS

    run = _analyse(owner, _business(owner))

    assert run.status == "completed"
    assert set(run.components) == set(SCORE_COMPONENTS)
    assert run.overall_score == sum(run.components.values())
    assert 0 <= run.overall_score <= 100
    assert run.tier in ("high", "medium", "low")
    # The evidence is retained, so the number can be interrogated.
    assert run.signals.exists()
    for signal in run.signals.all():
        assert signal.evidence != {}, f"{signal.signal_code} scored with no evidence"


def test_an_identical_snapshot_reproduces_the_score_bit_for_bit(owner, ai_stub):
    """B4 §4. Same snapshot + same model version => same answer, always."""
    from apps.intelligence.services import _deterministic_signals as signals_for
    from apps.intelligence.services import build_snapshot, score_from

    snapshot = build_snapshot(_business(owner))
    first = score_from(signals_for(snapshot))
    second = score_from(signals_for(snapshot))
    assert first == second


def test_unknown_polarity_never_moves_the_score(owner, ai_stub):
    """FB-08. A missing rating is 'not observed', never 'observed as bad'."""
    from apps.intelligence.services import _deterministic_signals as signals_for
    from apps.intelligence.services import build_snapshot, score_from

    observed = _business(owner, seq=1)
    unobserved = _business(owner, seq=2, rating=None, review_count=None)

    unknown_signals = [
        s for s in signals_for(build_snapshot(unobserved)) if s["polarity"] == "unknown"
    ]
    assert unknown_signals, "the fixture must actually produce unknown signals"
    for signal in unknown_signals:
        assert signal["strength"] == 0
        assert signal["score_affecting"] is False

    # Absent evidence scores lower than positive evidence — but by scoring
    # NOTHING, not by scoring a penalty.
    assert score_from(signals_for(build_snapshot(unobserved)))[1]["activity"] == 0
    assert score_from(signals_for(build_snapshot(observed)))[1]["activity"] > 0


def test_thin_evidence_is_reported_as_insufficient_rather_than_a_confident_zero(owner, ai_stub):
    run = _analyse(
        owner,
        _business(owner, name="Sparse", city="", category="", phone="", website="",
                  rating=None, review_count=None),
    )
    assert run.status == "completed"
    assert run.insufficient_evidence is True
    assert run.confidence is not None and run.confidence < 1.0


# --------------------------------------------------------------------------
# The deterministic / AI boundary — B4-D-A008.
# --------------------------------------------------------------------------


def test_det_nc_no_provider_call_produces_a_score_affecting_signal(owner, ai_stub):
    """`AT-DET-NC`. The provider may add prose; it may never move a number."""
    run = _analyse(owner, _business(owner))

    ai_signals = run.signals.filter(source="ai_extracted")
    assert ai_signals.exists(), "the fixture must actually exercise the AI layer"
    for signal in ai_signals:
        assert signal.score_affecting is False
        assert signal.strength == 0


def test_an_unconfigured_provider_still_yields_a_real_explainable_score(owner, monkeypatch):
    """The deterministic half is the load-bearing half.

    A missing OPENAI_API_KEY must degrade the prose, never the intelligence.
    """
    from adapters.openai import StubAIAdapter
    from common.provider_ports import providers

    monkeypatch.setattr(providers, "ai", StubAIAdapter(configured=False))
    run = _analyse(owner, _business(owner))

    assert run.status == "completed"
    assert run.completion_kind == "partial"  # the AI component was skipped
    assert run.overall_score > 0
    assert run.signals.filter(source="deterministic").exists()
    assert run.recommendations == []


def test_a_provider_failure_completes_partial_and_never_loses_the_analysis(owner, ai_stub):
    from common.provider_ports import ProviderTemporaryFailure

    ai_stub.next_error = ProviderTemporaryFailure("upstream down", provider="ai")
    run = _analyse(owner, _business(owner))

    assert run.status == "completed" and run.completion_kind == "partial"
    assert run.overall_score > 0


def test_malformed_provider_output_never_becomes_domain_truth(owner, ai_stub):
    """LLM output is UNTRUSTED INPUT, validated against WazLink's own schema."""
    ai_stub.next_raw = {
        "content": "x" * 50_000,
        "confidence": 42.0,           # out of range
        "abstained": "not-a-bool",
        "citations": [{"article_ref": "not-a-kba", "version": "one"}],
        "injected_field": "should not survive",
    }
    run = _analyse(owner, _business(owner))

    assert run.status == "completed"
    rendered = str(run.recommendations)
    assert "injected_field" not in rendered
    for recommendation in run.recommendations:
        # An out-of-range confidence is DROPPED, never clamped into a number
        # nobody produced.
        assert recommendation["confidence"] is None
        assert len(recommendation["body"]) <= 1200


def test_invalid_json_from_the_provider_does_not_crash_the_run(owner, ai_stub):
    ai_stub.next_raw = "this is not json at all"
    run = _analyse(owner, _business(owner))
    assert run.status == "completed"


# --------------------------------------------------------------------------
# T-B4-1 (NC) — no recommendation admits a send.
# --------------------------------------------------------------------------


def test_b4_1_nc_no_recommendation_field_or_flag_admits_a_send(owner, ai_stub):
    """`B5-D-A021` / `PD-013`. B4 executes nothing; a recommendation is prose.

    There is no channel, no recipient, no template and no auto-apply field, so
    there is nothing an implementer could later wire to a provider.
    """
    run = _analyse(owner, _business(owner))
    assert run.recommendations, "the fixture must actually produce a recommendation"

    forbidden = (
        "send", "auto_send", "channel", "recipient", "to", "phone", "template",
        "whatsapp", "auto_apply", "execute", "dispatch",
    )
    for recommendation in run.recommendations:
        leaked = [key for key in recommendation if key.lower() in forbidden]
        assert leaked == [], f"a recommendation exposed an actionable field: {leaked}"
        assert recommendation["requires_human_action"] is True


def test_b4_nc_no_intelligence_code_path_writes_a_crm_messaging_or_deal_row():
    """B4-D-A012. `intelligence` writes its OWN three tables and nothing else."""
    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "intelligence"
    owned = {"IntelligenceRun", "IntelligenceSignal", "AIUsageRecord"}
    writes = {"create", "update", "get_or_create", "update_or_create", "bulk_create", "delete", "save"}
    offenders = []

    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            if node.func.attr not in writes:
                continue
            # Walk back to the leftmost name: `Lead.objects.create` -> `Lead`.
            target = node.func.value
            while isinstance(target, ast.Attribute):
                target = target.value
            if isinstance(target, ast.Name) and target.id[:1].isupper() and target.id not in owned:
                offenders.append(f"{path.name}:{target.id}.{node.func.attr}")

    assert offenders == [], f"intelligence wrote a table it does not own: {offenders}"


def test_b4_nc_the_intelligence_module_names_no_provider_token():
    """`T-AI-5`. No model name, gpt-* identifier or provider token in the domain."""
    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "intelligence"
    banned = ("openai", "gpt-", "anthropic", "finish_reason", "prompt_tokens", "completion_tokens")
    offenders = []
    for path in root.rglob("*.py"):
        lowered = path.read_text().lower()
        offenders += [f"{path.name}:{token}" for token in banned if token in lowered]
    assert offenders == [], f"a provider token leaked into the domain: {offenders}"


# --------------------------------------------------------------------------
# Idempotency, reuse and concurrency — §19.
# --------------------------------------------------------------------------


def test_reuse_by_business_and_input_fingerprint_pays_the_provider_once(owner, ai_stub):
    """B14_09 §3 identity, applied. An unchanged snapshot reuses the answer."""
    from apps.intelligence.models import IntelligenceRun
    from apps.intelligence.services import request_analysis

    business = _business(owner)
    _analyse(owner, business)
    calls = len(ai_stub.requests)

    again, created = request_analysis(context=owner.context, business=business)
    assert created is False
    assert again.status == "completed"
    assert IntelligenceRun.objects.filter(business=business).count() == 1
    assert len(ai_stub.requests) == calls, "an identical snapshot re-called the provider"


def test_a_changed_business_earns_a_new_analysis(owner, ai_stub):
    from apps.intelligence.models import IntelligenceRun

    business = _business(owner)
    first = _analyse(owner, business)

    business.website = "https://now-has-a-site.test"
    business.version += 1
    business.save(update_fields=["website", "version"])
    second = _analyse(owner, business)

    assert second.pk != first.pk
    assert IntelligenceRun.objects.filter(business=business).count() == 2
    # The new opinion is current; the old one is retained as history.
    assert second.is_current is True
    first.refresh_from_db()
    assert first.is_current is False


def test_a_redelivered_worker_task_does_not_rescore_or_recall_the_provider(owner, ai_stub):
    from apps.intelligence.models import IntelligenceSignal
    from apps.intelligence.services import run_intelligence_analysis

    run = _analyse(owner, _business(owner))
    signals, calls, version = (
        IntelligenceSignal.objects.filter(run=run).count(),
        len(ai_stub.requests),
        run.version,
    )

    run_intelligence_analysis(run_id=run.id)  # redelivery

    run.refresh_from_db()
    assert IntelligenceSignal.objects.filter(run=run).count() == signals
    assert len(ai_stub.requests) == calls
    assert run.version == version


def test_a_failed_reanalysis_never_regresses_the_standing_answer(owner, ai_stub, monkeypatch):
    """B4 §4 — the product promise: no saved intelligence is ever lost."""
    from apps.intelligence.models import RUN_RUNNING, IntelligenceRun
    from apps.intelligence.services import _fail, reanalyze

    business = _business(owner)
    good = _analyse(owner, business)
    assert good.is_current is True

    business.website = "https://changed.test"
    business.version += 1
    business.save(update_fields=["website", "version"])
    later, _ = reanalyze(context=owner.context, business=business)
    IntelligenceRun.objects.filter(pk=later.pk).update(status=RUN_RUNNING)
    _fail(IntelligenceRun.objects.get(pk=later.pk), "provider_unavailable")

    good.refresh_from_db()
    assert good.is_current is True, "a failed re-analysis regressed the standing answer"
    assert IntelligenceRun.objects.get(pk=later.pk).is_current is False


def test_a_cancelled_run_never_becomes_current(owner, ai_stub):
    from apps.intelligence.services import cancel_analysis, request_analysis, run_intelligence_analysis

    run, _ = request_analysis(context=owner.context, business=_business(owner))
    cancel_analysis(context=owner.context, run=run)
    run_intelligence_analysis(run_id=run.id)

    run.refresh_from_db()
    assert run.status == "cancelled" and run.is_current is False


# --------------------------------------------------------------------------
# Privacy, telemetry and tenancy.
# --------------------------------------------------------------------------


def test_pd_002_masking_is_applied_before_egress_not_after(owner, ai_stub):
    """Minimum-necessary context. Contact PII never reaches the provider."""
    business = _business(owner, phone="+966555123456", website="https://secret-site.test",
                         name="Sensitive Trading Co")
    _analyse(owner, business)

    sent = str(ai_stub.requests[-1].context)
    assert "+966555123456" not in sent, "a phone number was sent to the provider"
    assert "secret-site.test" not in sent, "a website URL was sent to the provider"
    # What IS sent is the analysable fact: whether a channel exists.
    assert ai_stub.requests[-1].context["has_phone"] is True
    assert ai_stub.requests[-1].context["has_website"] is True


def test_usage_telemetry_is_aggregate_only_and_carries_no_content(owner, ai_stub):
    from apps.intelligence.models import AIUsageRecord

    _analyse(owner, _business(owner))
    record = AIUsageRecord.objects.filter(workspace=owner.workspace).first()

    assert record is not None and record.total_units > 0
    # It names the PORT, not a vendor — so swapping the adapter changes nothing.
    assert record.port_name == "ai"
    columns = {f.name for f in AIUsageRecord._meta.get_fields() if hasattr(f, "attname")}
    for forbidden in ("prompt", "completion", "model", "model_name", "finish_reason", "content"):
        assert forbidden not in columns
    # And no premature billing: Wave 3 owns price and currency.
    for forbidden in ("price", "cost", "currency", "amount"):
        assert forbidden not in columns


def test_b4_d_a028_nc_no_result_is_reused_across_workspaces(actor, ai_stub):
    """Two tenants analysing the same real business share nothing."""
    from apps.intelligence.models import IntelligenceRun

    one = actor(email="ai-t1@example.test", workspace_name="AiTenantOne")
    two = actor(email="ai-t2@example.test", workspace_name="AiTenantTwo")

    run_one = _analyse(one, _business(one))
    calls_after_first = len(ai_stub.requests)
    run_two = _analyse(two, _business(two))

    assert run_one.pk != run_two.pk
    assert run_one.workspace_id != run_two.workspace_id
    # The second workspace got its OWN provider call — no cross-tenant cache.
    assert len(ai_stub.requests) > calls_after_first
    assert IntelligenceRun.objects.filter(workspace=one.workspace).count() == 1
    assert IntelligenceRun.objects.filter(workspace=two.workspace).count() == 1


def test_an_analysis_from_another_workspace_is_not_found(actor, auth_client, ai_stub):
    one = actor(email="ai-iso1@example.test", workspace_name="AiIsoOne")
    two = actor(email="ai-iso2@example.test", workspace_name="AiIsoTwo")
    run = _analyse(one, _business(one))

    assert auth_client(two).get(f"/api/v1/intelligence/analyses/{run.public_id}").status_code == 404
    assert auth_client(one).get(f"/api/v1/intelligence/analyses/{run.public_id}").status_code == 200


def test_a_viewer_cannot_use_ai(actor, auth_client):
    viewer = actor(email="ai-viewer@example.test", role="viewer", workspace_name="AiViewer")
    denied = auth_client(viewer).post("/api/v1/intelligence/analyses", {"business_ref": "x"},
                                      format="json")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"


def test_the_hourly_analysis_bound_refuses_before_any_provider_call(owner, ai_stub):
    from apps.intelligence.services import MAX_ANALYSES_PER_WORKSPACE_PER_HOUR, request_analysis
    from common.errors import DomainConflict

    for index in range(MAX_ANALYSES_PER_WORKSPACE_PER_HOUR):
        request_analysis(context=owner.context, business=_business(owner, seq=index))
    calls = len(ai_stub.requests)

    with pytest.raises(DomainConflict) as raised:
        request_analysis(context=owner.context, business=_business(owner, seq=999))
    assert raised.value.details["reason"] == "analysis_rate_limited"
    assert len(ai_stub.requests) == calls


# --------------------------------------------------------------------------
# The API and the Party360 section.
# --------------------------------------------------------------------------


def test_the_analysis_api_returns_the_score_with_its_evidence(owner, auth_client, ai_stub):
    from apps.intelligence.models import IntelligenceRun

    business = _business(owner)
    client = auth_client(owner)
    created = client.post(
        "/api/v1/intelligence/analyses", {"business_ref": business.public_id}, format="json"
    )
    assert created.status_code == 202

    from apps.intelligence.services import run_intelligence_analysis

    run_intelligence_analysis(run_id=IntelligenceRun.objects.get(public_id=created.json()["analysis_ref"]).id)

    body = client.get(f"/api/v1/intelligence/analyses/{created.json()['analysis_ref']}").json()
    assert body["status"] == "completed"
    assert body["signals"] and body["components"]
    assert body["overall_score"] == sum(body["components"].values())
    # A second request for the unchanged snapshot REUSES: 200, not 202.
    assert client.post(
        "/api/v1/intelligence/analyses", {"business_ref": business.public_id}, format="json"
    ).status_code == 200


def test_p360_2_the_intelligence_section_is_present_only_once_a_run_is_current(owner, auth_client, ai_stub):
    """`T-P360-2` — the section activates at I4, and only with a real answer."""
    from apps.crm.services import convert_business_to_lead

    business = _business(owner)
    lead = convert_business_to_lead(context=owner.context, business=business)
    client = auth_client(owner)

    # A registered provider with nothing to say is ABSENT, not an empty shell.
    before = client.get(f"/api/v1/leads/{lead.public_id}").json()
    assert "intelligence" not in before

    _analyse(owner, business)
    after = client.get(f"/api/v1/leads/{lead.public_id}").json()
    assert "intelligence" in after
    assert after["intelligence"]["overall_score"] >= 0
    assert after["intelligence"]["signals"]


def test_the_intelligence_section_is_absent_for_a_business_less_lead(owner, auth_client, ai_stub):
    """B4-D-A001. No Business means no intelligence — and none is fabricated."""
    from apps.crm.services import create_lead

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "No Business", "phone": "+966500000123"},
    )
    body = auth_client(owner).get(f"/api/v1/leads/{lead.public_id}").json()
    assert "intelligence" not in body


def test_requesting_an_analysis_enqueues_the_worker_by_registered_name(owner, auth_client):
    from common.dispatch import task_registry

    business = _business(owner)
    task_registry.enqueued.clear()
    auth_client(owner).post(
        "/api/v1/intelligence/analyses", {"business_ref": business.public_id}, format="json"
    )

    assert [name for name, _ in task_registry.enqueued] == ["intelligence.run_intelligence_analysis"]
    assert set(task_registry.enqueued[0][1]) == {"run_id"}
