"""I3 — Discovery features. Frozen B3 + `B14_16`.

Every test here runs against the DETERMINISTIC STUB bound behind
`PlaceSearchPort`. That is `T-DISC-2` in force continuously rather than as one
assertion: the whole suite is the evidence that the domain does not know which
adapter it is talking to.
"""

from __future__ import annotations

import pathlib

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(actor):
    return actor(email="disc-owner@example.test", role="owner", workspace_name="DiscOwner")


@pytest.fixture
def stub():
    """The bound place-search adapter — the same object the domain will use."""
    from common.provider_ports import providers

    return providers.require("place_search")


def _job(owner, terms=("cafe",), locations=("Riyadh",), **kwargs):
    from apps.discovery.services import create_discovery_job

    return create_discovery_job(
        context=owner.context, terms=list(terms), locations=list(locations), **kwargs
    )


# --------------------------------------------------------------------------
# T-DISC-1 (NC) — the domain is VENDOR-FREE.
# --------------------------------------------------------------------------


def test_disc_1_nc_the_discovery_domain_names_no_vendor():
    """A vendor identifier anywhere under apps/discovery is a boundary leak."""
    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "discovery"
    banned = ("google", "places.googleapis", "x-goog", "serpapi", "scrapingbee", "apify")
    offenders = []
    for path in root.rglob("*.py"):
        lowered = path.read_text().lower()
        offenders += [f"{path.name}:{token}" for token in banned if token in lowered]
    assert offenders == [], f"vendor identifiers leaked into the domain: {offenders}"


def test_disc_1_nc_the_adapter_layer_imports_no_app():
    """adapters/ may import its PORT and nothing else from the codebase."""
    root = pathlib.Path(__file__).resolve().parent.parent / "adapters"
    offenders = [
        f"{path.relative_to(root)}"
        for path in root.rglob("*.py")
        if "from apps." in path.read_text() or "import apps." in path.read_text()
    ]
    assert offenders == [], f"adapters reached into a domain: {offenders}"


# --------------------------------------------------------------------------
# The job lifecycle.
# --------------------------------------------------------------------------


def test_a_job_is_admitted_pending_with_its_plan_and_calls_no_provider(owner, stub):
    from apps.discovery.models import JOB_PENDING

    job = _job(owner, terms=("cafe", "bakery"), locations=("Riyadh",))

    assert job.status == JOB_PENDING
    assert job.queries.count() == 2
    assert job.attempt_no == 1 and job.progress == 0
    # Admission is planning, not execution. No provider was touched.
    assert stub.calls == []


def test_running_a_job_persists_businesses_and_completes(owner, stub):
    from apps.discovery.models import COMPLETION_FULL, JOB_COMPLETED, Business
    from apps.discovery.services import run_discovery_job

    job = _job(owner)
    job = run_discovery_job(job_id=job.id)

    assert job.status == JOB_COMPLETED
    assert job.completion_kind == COMPLETION_FULL
    assert job.progress == 100
    assert Business.objects.filter(workspace=owner.workspace).count() == 3
    # B3 §4.1 — the counter identity holds.
    assert job.found_count - job.duplicate_count == job.deduplicated_count


def test_results_are_invisible_until_the_job_completes(owner, auth_client):
    """B3-INV-8. Persistence is not visibility."""
    from apps.discovery.services import run_discovery_job

    job = _job(owner)
    client = auth_client(owner)

    early = client.get(f"/api/v1/discovery/jobs/{job.public_id}/results")
    assert early.status_code == 409
    assert early.json()["error"]["details"]["reason"] == "results_not_available"

    run_discovery_job(job_id=job.id)
    ready = client.get(f"/api/v1/discovery/jobs/{job.public_id}/results")
    assert ready.status_code == 200
    assert len(ready.json()["items"]) == 3


def test_a_cancelled_job_refuses_a_second_cancel_and_keeps_completed_at_null(owner):
    from apps.discovery.models import JOB_CANCELLED
    from apps.discovery.services import cancel_discovery_job
    from common.errors import DomainConflict

    job = _job(owner)
    job = cancel_discovery_job(context=owner.context, job=job)
    assert job.status == JOB_CANCELLED and job.completed_at is None

    with pytest.raises(DomainConflict) as raised:
        cancel_discovery_job(context=owner.context, job=job)
    assert raised.value.details["reason"] == "job_already_terminal"


def test_a_cancelled_job_never_becomes_completed(owner, stub):
    """B3 §7. A human's cancellation outranks a worker finishing later."""
    from apps.discovery.models import JOB_CANCELLED, DiscoveryJob
    from apps.discovery.services import cancel_discovery_job, run_discovery_job

    job = _job(owner)
    cancel_discovery_job(context=owner.context, job=job)
    run_discovery_job(job_id=job.id)

    assert DiscoveryJob.objects.get(pk=job.pk).status == JOB_CANCELLED


def test_the_attempt_bound_is_architectural_and_cancellation_never_resets_it(owner):
    """B3-D-A031. Cancel/retry looping cannot buy a fourth attempt."""
    from apps.discovery.models import MAX_JOB_ATTEMPTS
    from apps.discovery.services import cancel_discovery_job, retry_discovery_job
    from common.errors import DomainConflict

    job = _job(owner)
    for _ in range(MAX_JOB_ATTEMPTS - 1):
        cancel_discovery_job(context=owner.context, job=job)
        job = retry_discovery_job(context=owner.context, job=job)
    assert job.attempt_no == MAX_JOB_ATTEMPTS

    cancel_discovery_job(context=owner.context, job=job)
    with pytest.raises(DomainConflict) as raised:
        retry_discovery_job(context=owner.context, job=job)
    assert raised.value.details["reason"] == "attempt_limit_reached"
    assert raised.value.details["max_job_attempts"] == MAX_JOB_ATTEMPTS


# --------------------------------------------------------------------------
# Idempotency and identity.
# --------------------------------------------------------------------------


def test_a_redelivered_worker_task_creates_no_second_business_or_result(owner, stub):
    """The exact duplicate-delivery harm. Running the worker twice is a no-op."""
    from apps.discovery.models import Business, DiscoveryResult
    from apps.discovery.services import run_discovery_job

    job = _job(owner)
    run_discovery_job(job_id=job.id)
    businesses, results = (
        Business.objects.filter(workspace=owner.workspace).count(),
        DiscoveryResult.objects.filter(job=job).count(),
    )
    calls_after_first = len(stub.calls)

    run_discovery_job(job_id=job.id)  # redelivery

    assert Business.objects.filter(workspace=owner.workspace).count() == businesses
    assert DiscoveryResult.objects.filter(job=job).count() == results
    # And it re-spent nothing: every execution was already terminal.
    assert len(stub.calls) == calls_after_first


def test_a_second_job_reobserving_the_same_world_upserts_rather_than_duplicating(owner, stub):
    """B3-INV-4. The Business is identity, not a per-job record."""
    from apps.discovery.models import Business, DiscoveryResult
    from apps.discovery.services import run_discovery_job

    first, second = _job(owner), _job(owner)
    run_discovery_job(job_id=first.id)
    run_discovery_job(job_id=second.id)

    # The same three real businesses — upserted, never duplicated...
    assert Business.objects.filter(workspace=owner.workspace).count() == 3
    # ...while BOTH jobs keep their own observation provenance.
    assert DiscoveryResult.objects.filter(job=first).count() == 3
    assert DiscoveryResult.objects.filter(job=second).count() == 3


def test_a_failed_job_retries_into_a_new_attempt_that_can_succeed(owner, stub, monkeypatch):
    """B3 §3.3 — a retry is a NEW ATTEMPT against the SAME plan.

    The plan, the public id and every previously-ingested row survive; only the
    counters and the failure reset.
    """
    from apps.discovery.models import JOB_COMPLETED, JOB_FAILED, Business, DiscoveryQuery
    from apps.discovery.services import retry_discovery_job, run_discovery_job
    from common.provider_ports import ProviderTemporaryFailure

    real_search = stub.search
    monkeypatch.setattr(
        stub, "search", lambda _r: (_ for _ in ()).throw(ProviderTemporaryFailure("down"))
    )
    job = _job(owner)
    job_ref, plan = job.public_id, list(DiscoveryQuery.objects.filter(job=job).values_list("term", flat=True))
    job = run_discovery_job(job_id=job.id)
    assert job.status == JOB_FAILED

    monkeypatch.setattr(stub, "search", real_search)
    job = retry_discovery_job(context=owner.context, job=job)
    assert job.attempt_no == 2 and job.failure_code == ""
    job = run_discovery_job(job_id=job.id)

    assert job.status == JOB_COMPLETED
    assert job.public_id == job_ref  # the SAME job, not a new one
    assert list(DiscoveryQuery.objects.filter(job=job).values_list("term", flat=True)) == plan
    assert Business.objects.filter(workspace=owner.workspace).count() == 3
    # Both attempts' executions are retained; nothing was rewritten.
    assert job.executions.count() == 2


def test_disc_3_nc_the_same_external_record_is_separate_truth_per_workspace(actor):
    """Identity is (workspace, provider_external_id). No cross-tenant collision."""
    from apps.discovery.models import Business
    from apps.discovery.services import run_discovery_job

    one = actor(email="t1@example.test", workspace_name="TenantOne")
    two = actor(email="t2@example.test", workspace_name="TenantTwo")
    for who in (one, two):
        run_discovery_job(job_id=_job(who).id)

    ids_one = set(
        Business.objects.filter(workspace=one.workspace).values_list("provider_external_id", flat=True)
    )
    ids_two = set(
        Business.objects.filter(workspace=two.workspace).values_list("provider_external_id", flat=True)
    )
    # Identical external ids...
    assert ids_one == ids_two and ids_one
    # ...and completely disjoint rows.
    assert Business.objects.filter(workspace=one.workspace).count() == 3
    assert Business.objects.filter(workspace=two.workspace).count() == 3
    assert not Business.objects.filter(workspace=one.workspace).filter(
        pk__in=Business.objects.filter(workspace=two.workspace).values("pk")
    )


def test_disc_7_nc_only_normalized_fields_become_business_truth():
    """A provider field WazLink does not map must not reach the domain."""
    from adapters.places import GooglePlacesAdapter

    page = GooglePlacesAdapter().normalize(
        {
            "places": [
                {
                    "id": "ext-1",
                    "displayName": {"text": "Test Cafe"},
                    "formattedAddress": "1 St, Riyadh, SA",
                    "location": {"latitude": 24.7, "longitude": 46.7},
                    "websiteUri": "https://example.test",
                    # Fields WazLink does not model — they must vanish here.
                    "priceLevel": "PRICE_LEVEL_MODERATE",
                    "businessStatus": "OPERATIONAL",
                    "internalNotes": "should never survive",
                }
            ]
        }
    )
    result = page.results[0]
    assert result.provider_external_id == "ext-1" and result.name == "Test Cafe"
    assert result.city == "Riyadh"
    mapped = vars(result)
    assert "priceLevel" not in mapped and "businessStatus" not in mapped
    assert "should never survive" not in str(mapped)


def test_a_provider_record_without_identity_or_name_is_skipped_not_half_written():
    from adapters.places import GooglePlacesAdapter

    page = GooglePlacesAdapter().normalize(
        {
            "places": [
                {"displayName": {"text": "No identity"}},
                {"id": "ext-2"},
                {"id": "ext-3", "displayName": {"text": "Good"}},
            ]
        }
    )
    assert [r.provider_external_id for r in page.results] == ["ext-3"]


# --------------------------------------------------------------------------
# T-DISC-4 (NC) — an unknown outcome opens P-1 and NEVER repeats.
# --------------------------------------------------------------------------


def test_disc_4_nc_an_unknown_provider_outcome_opens_a_case_and_never_repeats(owner, stub, monkeypatch):
    from apps.discovery.models import (
        FAILURE_UNKNOWN,
        JOB_FAILED,
        OUTCOME_UNKNOWN,
        DiscoveryQueryExecution,
    )
    from apps.discovery.services import run_discovery_job
    from apps.platform_async.models import PlatformReconciliationCase
    from common.provider_ports import ProviderUnknownOutcome

    def unknown(_request):
        raise ProviderUnknownOutcome("indeterminate", provider="place_search")

    monkeypatch.setattr(stub, "search", unknown)
    job = _job(owner)
    job = run_discovery_job(job_id=job.id)

    assert job.status == JOB_FAILED
    assert job.failure_code == FAILURE_UNKNOWN
    execution = DiscoveryQueryExecution.objects.get(job=job)
    assert execution.outcome == OUTCOME_UNKNOWN
    cases = PlatformReconciliationCase.objects.filter(case_class="P-1", subject_ref=job.public_id)
    assert cases.count() == 1

    # The load-bearing half: re-running does NOT re-execute the unknown work.
    run_discovery_job(job_id=job.id)
    assert DiscoveryQueryExecution.objects.filter(job=job).count() == 1
    assert PlatformReconciliationCase.objects.filter(subject_ref=job.public_id).count() == 1


def test_a_provider_failure_never_leaks_a_provider_string_to_the_client(
    owner, stub, monkeypatch, auth_client
):
    from apps.discovery.services import run_discovery_job
    from common.provider_ports import ProviderPermanentFailure

    def refuse(_request):
        raise ProviderPermanentFailure(
            "HTTP 403 from https://places.googleapis.com key=SECRET", provider="place_search"
        )

    monkeypatch.setattr(stub, "search", refuse)
    job = _job(owner)
    run_discovery_job(job_id=job.id)

    body = auth_client(owner).get(f"/api/v1/discovery/jobs/{job.public_id}").json()
    rendered = str(body)
    assert body["failure_code"] == "provider_refused"
    for leak in ("googleapis", "SECRET", "403", "http"):
        assert leak not in rendered, f"provider detail leaked: {leak}"


def test_one_failing_combination_does_not_discard_the_others_work(owner, stub, monkeypatch):
    """B3 §6 — 19 of 20 succeeding must COMPLETE partial, not fail."""
    from apps.discovery.models import COMPLETION_PARTIAL, JOB_COMPLETED, Business
    from apps.discovery.services import run_discovery_job
    from common.provider_ports import PlaceSearchRequest, ProviderPermanentFailure

    real_search = stub.search

    def flaky(request: PlaceSearchRequest):
        if request.term == "bakery":
            raise ProviderPermanentFailure("refused", provider="place_search")
        return real_search(request)

    monkeypatch.setattr(stub, "search", flaky)
    job = _job(owner, terms=("cafe", "bakery"), locations=("Riyadh",))
    job = run_discovery_job(job_id=job.id)

    assert job.status == JOB_COMPLETED
    assert job.completion_kind == COMPLETION_PARTIAL
    assert job.failed_query_count == 1
    # The successful combination's paid-for data STANDS.
    assert Business.objects.filter(workspace=owner.workspace).count() == 3


# --------------------------------------------------------------------------
# T-DISC-5 / T-DISC-6 — provider absence and the scraping enable refusal.
# --------------------------------------------------------------------------


def test_disc_5_a_missing_key_degrades_discovery_and_nothing_else(owner, monkeypatch):
    """The platform keeps working; only this feature is unavailable."""
    from adapters.places import GooglePlacesAdapter
    from apps.discovery.models import FAILURE_NOT_CONFIGURED, JOB_FAILED
    from apps.discovery.services import run_discovery_job
    from common.provider_ports import NOT_CONFIGURED, providers

    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    unconfigured = GooglePlacesAdapter()
    assert unconfigured.status().status == NOT_CONFIGURED
    assert unconfigured.status().configuration_valid is False

    monkeypatch.setattr(providers, "place_search", unconfigured)
    job = run_discovery_job(job_id=_job(owner).id)
    assert job.status == JOB_FAILED
    assert job.failure_code == FAILURE_NOT_CONFIGURED

    # CRM is untouched by a Discovery provider being absent.
    from apps.crm.services import create_lead

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Unaffected", "phone": "+966500000999"},
    )
    assert lead.public_id.startswith("LEAD-")


def test_disc_6_nc_the_scraping_connection_can_never_be_enabled(owner, auth_client):
    """B12-D-A054 — no verification scheme exists, so `enabled` is unreachable."""
    from common.provider_ports import providers

    scraping = providers.require("scraping")
    assert scraping.verification_scheme_available() is False
    assert scraping.status().configuration_valid is False

    body = auth_client(owner).get("/api/v1/discovery/sources").json()
    row = next(item for item in body["items"] if item["port"] == "scraping")
    assert row["can_enable"] is False
    # And the operator surface shows REFERENCE NAMES, never values.
    assert row["credential_refs"] and all("KEY" in r or "SECRET" in r or "PROVIDER" in r or "URL" in r
                                          for r in row["credential_refs"])


def test_no_provider_secret_appears_on_the_operator_surface(owner, auth_client, monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "super-secret-key-value")
    body = auth_client(owner).get("/api/v1/discovery/sources").content.decode()
    assert "super-secret-key-value" not in body


# --------------------------------------------------------------------------
# Tenancy and RBAC.
# --------------------------------------------------------------------------


def test_a_job_from_another_workspace_is_not_found_never_forbidden(actor, auth_client):
    one = actor(email="iso1@example.test", workspace_name="IsoOne")
    two = actor(email="iso2@example.test", workspace_name="IsoTwo")
    job = _job(one)

    for path in ("", "/results", "/cancel"):
        response = getattr(auth_client(two), "post" if path == "/cancel" else "get")(
            f"/api/v1/discovery/jobs/{job.public_id}{path}"
        )
        # 404, never 403: a 403 would confirm the object exists (Doctrine R-2).
        assert response.status_code == 404, path
        assert response.json()["error"]["code"] == "ENTITY_NOT_FOUND"


def test_a_business_from_another_workspace_is_not_readable(actor, auth_client):
    from apps.discovery.models import Business
    from apps.discovery.services import run_discovery_job

    one = actor(email="biz1@example.test", workspace_name="BizOne")
    two = actor(email="biz2@example.test", workspace_name="BizTwo")
    run_discovery_job(job_id=_job(one).id)
    business = Business.objects.filter(workspace=one.workspace).first()

    assert auth_client(two).get(f"/api/v1/businesses/{business.public_id}").status_code == 404
    assert auth_client(one).get(f"/api/v1/businesses/{business.public_id}").status_code == 200


def test_a_viewer_cannot_run_discovery_but_may_read_it(actor, auth_client):
    viewer = actor(email="viewer@example.test", role="viewer", workspace_name="ViewerWs")
    client = auth_client(viewer)

    denied = client.post("/api/v1/discovery/jobs", {"terms": ["cafe"]}, format="json")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "PERMISSION_DENIED"
    assert client.get("/api/v1/discovery/jobs").status_code == 200


def test_the_hourly_admission_limit_refuses_before_any_provider_work(owner, stub):
    from apps.discovery.services import MAX_JOBS_PER_WORKSPACE_PER_HOUR
    from common.errors import DomainConflict

    for _ in range(MAX_JOBS_PER_WORKSPACE_PER_HOUR):
        _job(owner)
    with pytest.raises(DomainConflict) as raised:
        _job(owner)
    assert raised.value.details["reason"] == "job_rate_limited"
    assert stub.calls == []


# --------------------------------------------------------------------------
# The API journey — JOB -> BUSINESS -> LEAD.
# --------------------------------------------------------------------------


def test_the_discovery_api_journey_produces_a_convertible_business(owner, auth_client):
    from apps.discovery.models import DiscoveryJob
    from apps.discovery.services import run_discovery_job

    client = auth_client(owner)
    created = client.post(
        "/api/v1/discovery/jobs",
        {"terms": ["cafe"], "locations": ["Riyadh"], "result_limit": 10},
        format="json",
    )
    assert created.status_code == 202  # async; the DURABLE row is returned
    job_ref = created.json()["job_ref"]

    run_discovery_job(job_id=DiscoveryJob.objects.get(public_id=job_ref).id)

    results = client.get(f"/api/v1/discovery/jobs/{job_ref}/results").json()
    business_ref = results["items"][0]["business"]["business_ref"]

    converted = client.post(f"/api/v1/businesses/{business_ref}/convert", {}, format="json")
    assert converted.status_code == 201
    assert converted.json()["lead_ref"].startswith("LEAD-")


def test_creating_a_job_enqueues_the_worker_by_registered_name(owner, auth_client):
    """The command schedules work by NAME with a DURABLE reference only."""
    from common.dispatch import task_registry

    task_registry.enqueued.clear()
    auth_client(owner).post("/api/v1/discovery/jobs", {"terms": ["cafe"]}, format="json")

    names = [name for name, _ in task_registry.enqueued]
    assert names == ["discovery.run_discovery_job"]
    payload = task_registry.enqueued[0][1]
    assert set(payload) == {"job_id"}  # a reference, never embedded state


def test_a_stale_claim_opens_a_case_and_is_never_auto_repeated(owner, stub, monkeypatch):
    """Reconciliation P-3. The sweep REPORTS; it never re-runs the work.

    A `running` execution may already have reached the provider, so releasing it
    would risk exactly the duplicate spend the claim exists to prevent.
    """
    from datetime import timedelta

    from django.utils import timezone

    from apps.discovery.models import OUTCOME_RUNNING, DiscoveryQueryExecution
    from apps.discovery.services import (
        STALE_EXECUTION_MINUTES,
        run_discovery_job,
        sweep_stale_executions,
    )
    from apps.platform_async.models import PlatformReconciliationCase

    job = _job(owner)
    # A worker that claimed and then died.
    monkeypatch.setattr(stub, "search", lambda _r: (_ for _ in ()).throw(KeyboardInterrupt()))
    with pytest.raises(KeyboardInterrupt):
        run_discovery_job(job_id=job.id)

    execution = DiscoveryQueryExecution.objects.get(job=job)
    assert execution.outcome == OUTCOME_RUNNING, "the claim must be durable, not just a lock"
    DiscoveryQueryExecution.objects.filter(pk=execution.pk).update(
        started_at=timezone.now() - timedelta(minutes=STALE_EXECUTION_MINUTES + 5)
    )

    assert sweep_stale_executions() == 1
    assert PlatformReconciliationCase.objects.filter(case_class="P-3", status="open").count() == 1
    # The sweep repaired NOTHING — the claim stands until a human decides.
    assert DiscoveryQueryExecution.objects.get(pk=execution.pk).outcome == OUTCOME_RUNNING
