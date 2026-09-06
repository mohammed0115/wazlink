"""`B3-INV-5` — provider-scoped Business identity.

Frozen sources, read directly:

*   `B3_DATA_MODEL.md` §7 — `business_identities` is unique on
    `(workspace_id, provider, provider_external_id)`. That IS `B3-INV-5`, and
    the section states the reason in terms: "without `provider` in the key, two
    providers minting the same opaque string would collapse two unrelated
    businesses into one."
*   `B3_DATA_MODEL.md` §6 — `provider_source` and `provider_external_id` on
    `businesses` are the **anchor** identity and are **immutable**.
*   `B3_BUSINESS_IDENTITY_MODEL.md` §4 — the ingestion algorithm: deterministic
    lookup on `business_identities`, hit refreshes, miss creates.
*   `B3_ACCEPTANCE_TEST_MATRIX.md` `AT-ID-6` / `AT-ID-11` — two providers
    reusing one external-id string yield **2** Businesses; keying without
    `provider` is the named negative control.

Every assertion below reads durable PostgreSQL state, never a status code.
"""

from __future__ import annotations

import threading

import pytest
from django.db import connections
from django.utils import timezone

from apps.discovery.models import Business, BusinessIdentity
from apps.discovery.services import upsert_business
from common.provider_ports import NormalizedBusinessResult

pytestmark = pytest.mark.django_db(transaction=True)


def result(external_id: str, provider: str, name: str, **extra) -> NormalizedBusinessResult:
    return NormalizedBusinessResult(
        provider_external_id=external_id,
        name=name,
        source_provider=provider,
        observed_at=timezone.now(),
        **extra,
    )


def run_threads(targets):
    errors: list[Exception] = []

    def wrap(fn):
        def inner():
            try:
                fn()
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)
            finally:
                connections.close_all()

        return inner

    threads = [threading.Thread(target=wrap(t)) for t in targets]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)
    return errors


# ---------------------------------------------------------------- A
def test_at_id_2_same_workspace_same_provider_same_id_is_one_business(actor):
    """`AT-ID-2`: re-observing one identity refreshes, never duplicates."""
    a = actor()
    first, created_first = upsert_business(
        workspace=a.workspace, result=result("ID-123", "places", "Alpha Dental", city="Riyadh")
    )
    second, created_second = upsert_business(
        workspace=a.workspace, result=result("ID-123", "places", "Alpha Dental Clinic", city="Riyadh")
    )

    assert created_first is True and created_second is False
    assert first.pk == second.pk
    assert Business.objects.filter(workspace=a.workspace).count() == 1
    # The identity map holds exactly one row for one identity tuple.
    assert BusinessIdentity.objects.filter(workspace=a.workspace).count() == 1
    # Non-anchor normalized fields still refresh (B3_NORMALIZATION §5).
    assert Business.objects.get(pk=first.pk).name == "Alpha Dental Clinic"


# ---------------------------------------------------------------- B
def test_at_id_6_two_providers_one_external_id_yield_two_businesses(actor):
    """`AT-ID-6` / `B3-INV-5`. This is the blocker's regression.

    `AT-ID-11` is the negative control: an implementation keyed on
    `(workspace, external_id)` without `provider` collapses these two.
    """
    a = actor()
    alpha, _ = upsert_business(
        workspace=a.workspace, result=result("SAME-123", "places", "Alpha Dental")
    )
    beta, _ = upsert_business(
        workspace=a.workspace, result=result("SAME-123", "scraping", "Beta Garage")
    )

    assert alpha.pk != beta.pk, "two providers' opaque ids collapsed into one Business"
    assert Business.objects.filter(workspace=a.workspace).count() == 2
    assert sorted(
        Business.objects.filter(workspace=a.workspace).values_list("name", flat=True)
    ) == ["Alpha Dental", "Beta Garage"]

    # Two identity rows, one per provider, both pointing at their own Business.
    identities = BusinessIdentity.objects.filter(
        workspace=a.workspace, provider_external_id="SAME-123"
    )
    assert identities.count() == 2
    assert sorted(identities.values_list("provider", flat=True)) == ["places", "scraping"]
    assert identities.filter(business=alpha).get().provider == "places"
    assert identities.filter(business=beta).get().provider == "scraping"


# ---------------------------------------------------------------- C
def test_at_id_tenancy_same_provider_and_id_across_workspaces_stay_separate(actor):
    """`B3-INV-1` / `B3_BUSINESS_IDENTITY_MODEL` §3.3."""
    one = actor(email="one@example.test", workspace_name="One")
    two = actor(email="two@example.test", workspace_name="Two")

    first, _ = upsert_business(workspace=one.workspace, result=result("ID-123", "places", "Shared"))
    second, _ = upsert_business(workspace=two.workspace, result=result("ID-123", "places", "Shared"))

    assert first.pk != second.pk
    assert Business.objects.filter(workspace=one.workspace).count() == 1
    assert Business.objects.filter(workspace=two.workspace).count() == 1
    assert BusinessIdentity.objects.filter(workspace=one.workspace).count() == 1
    assert BusinessIdentity.objects.filter(workspace=two.workspace).count() == 1


# ---------------------------------------------------------------- D
def test_the_anchor_identity_is_immutable(actor):
    """`B3_DATA_MODEL` §6 / `B3_NORMALIZATION_DATA_QUALITY` §3.

    The anchor is the pair that CREATED the Business. A later result from
    another provider must not rewrite it.
    """
    a = actor()
    anchor, _ = upsert_business(
        workspace=a.workspace, result=result("SAME-123", "places", "Alpha Dental")
    )
    assert anchor.source_provider == "places"
    assert anchor.provider_external_id == "SAME-123"

    upsert_business(workspace=a.workspace, result=result("SAME-123", "scraping", "Beta Garage"))
    # Re-observation by the SAME provider must not move it either.
    upsert_business(workspace=a.workspace, result=result("SAME-123", "places", "Alpha Dental Ltd"))

    anchor = Business.objects.get(pk=anchor.pk)
    assert anchor.source_provider == "places", "the anchor provider was rewritten"
    assert anchor.provider_external_id == "SAME-123", "the anchor external id was rewritten"
    # The anchor identity row records that it is the anchor.
    row = BusinessIdentity.objects.get(business=anchor, provider="places")
    assert row.link_basis == "anchor"


def test_first_observed_at_is_write_once(actor):
    """`B3_DATA_MODEL` §6 — `first_discovered_at` is write-once."""
    a = actor()
    business, _ = upsert_business(
        workspace=a.workspace, result=result("ID-W1", "places", "Alpha")
    )
    original = Business.objects.get(pk=business.pk).first_observed_at
    upsert_business(workspace=a.workspace, result=result("ID-W1", "places", "Alpha again"))
    refreshed = Business.objects.get(pk=business.pk)
    assert refreshed.first_observed_at == original
    assert refreshed.last_observed_at >= original


# ---------------------------------------------------------------- E
def test_concurrent_same_provider_observations_yield_one_business(actor):
    """`B3_IDEMPOTENCY_CONCURRENCY` race `R-07`: the unique index decides, and
    the loser re-resolves to the winner rather than raising."""
    a = actor()
    start = threading.Barrier(4, timeout=20)

    def worker():
        start.wait()
        upsert_business(workspace=a.workspace, result=result("RACE-1", "places", "Racy"))

    errors = run_threads([worker] * 4)
    assert errors == [], f"a concurrent upsert leaked an error: {errors}"
    assert Business.objects.filter(workspace=a.workspace).count() == 1
    assert BusinessIdentity.objects.filter(workspace=a.workspace).count() == 1


# ---------------------------------------------------------------- F
def test_concurrent_cross_provider_collision_does_not_collapse(actor):
    """Two providers racing on the same opaque string keep two Businesses."""
    a = actor()
    start = threading.Barrier(4, timeout=20)

    def worker(provider: str, name: str):
        def inner():
            start.wait()
            upsert_business(workspace=a.workspace, result=result("RACE-X", provider, name))

        return inner

    errors = run_threads(
        [
            worker("places", "Alpha Dental"),
            worker("places", "Alpha Dental"),
            worker("scraping", "Beta Garage"),
            worker("scraping", "Beta Garage"),
        ]
    )
    assert errors == [], f"a concurrent upsert leaked an error: {errors}"
    assert Business.objects.filter(workspace=a.workspace).count() == 2
    identities = BusinessIdentity.objects.filter(
        workspace=a.workspace, provider_external_id="RACE-X"
    )
    assert identities.count() == 2
    assert sorted(identities.values_list("provider", flat=True)) == ["places", "scraping"]


# ---------------------------------------------------------------- AT-ID-11
def test_at_id_11_nc_postgresql_enforces_the_provider_scoped_key(actor):
    """`AT-ID-11` **(NC)**, asserted against the live catalog rather than code.

    The durable key must carry `provider`. A key of
    `(workspace_id, provider_external_id)` alone is the defect this control
    exists to catch, so its absence is asserted too.
    """
    from django.db import connection

    a = actor()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'business_identities'
            """
        )
        identity_indexes = [row[0] for row in cursor.fetchall()]
        cursor.execute(
            """
            SELECT indexdef FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'businesses'
            """
        )
        business_indexes = [row[0] for row in cursor.fetchall()]

    provider_scoped = [
        d
        for d in identity_indexes
        if "UNIQUE" in d
        and "workspace_id" in d
        and "provider" in d
        and "provider_external_id" in d
    ]
    assert provider_scoped, (
        "B3-INV-5 is not enforced by PostgreSQL: no UNIQUE index on "
        f"business_identities(workspace_id, provider, provider_external_id). Found: {identity_indexes}"
    )

    # And the superseded, provider-blind key must be gone from `businesses`.
    offenders = [
        d
        for d in business_indexes
        if "UNIQUE" in d and "provider_external_id" in d and "source_provider" not in d
    ]
    assert offenders == [], f"a provider-blind unique key survives on businesses: {offenders}"

    # Behaviourally: PostgreSQL itself refuses a duplicate identity tuple.
    from django.db import IntegrityError, transaction

    business, _ = upsert_business(
        workspace=a.workspace, result=result("NC-1", "places", "Alpha")
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            BusinessIdentity.objects.create(
                workspace=a.workspace,
                business=business,
                provider="places",
                provider_external_id="NC-1",
                link_basis="operator",
            )
