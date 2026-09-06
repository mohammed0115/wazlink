"""T-IMP-* — CSV import foundation."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db

CSV_OK = "name,phone\nAcme Ltd,+966500000010\nBeta LLC,+966500000011\n"
CSV_MIXED = "name,phone\nGood Co,+966500000012\n,+966500000013\nAlso Good,+966500000014\n"


def _batch(a, csv_text=CSV_OK, target="customer"):
    from apps.imports.services import create_import_batch, set_mapping

    batch = create_import_batch(context=a.context, target_kind=target, raw_csv=csv_text)
    return set_mapping(context=a.context, batch=batch, mapping={"name": "name", "phone": "phone"})


def test_imp_1_dry_run_writes_nothing(actor):
    from apps.customers.models import Customer
    from apps.imports.services import dry_run

    a = actor()
    batch = _batch(a)
    before = Customer.objects.filter(workspace=a.workspace).count()

    preview = dry_run(context=a.context, batch=batch)

    assert preview["would_create"] == 2
    assert preview["wrote_nothing"] is True
    assert Customer.objects.filter(workspace=a.workspace).count() == before


def test_imp_2_mapping_requires_the_required_target_fields(actor):
    from apps.imports.services import create_import_batch, set_mapping
    from common.errors import ValidationFailed

    a = actor()
    batch = create_import_batch(context=a.context, target_kind="customer", raw_csv=CSV_OK)
    with pytest.raises(ValidationFailed):
        set_mapping(context=a.context, batch=batch, mapping={"phone": "phone"})


def test_imp_3_commit_creates_rows_through_the_owning_domain_command(actor):
    from apps.customers.models import Customer
    from apps.imports.services import commit_batch

    a = actor()
    batch = commit_batch(context=a.context, batch=_batch(a))
    assert batch.status == "completed"
    assert Customer.objects.filter(workspace=a.workspace).count() == 2
    # Public IDs prove the owning-domain command ran, not a raw table insert.
    assert all(ref.startswith("CUS-") for ref in batch.rows.values_list("created_ref", flat=True))


def test_imp_4_partial_failure_does_not_roll_back_committed_rows(actor):
    """Row-level outcomes: NO transaction-wide rollback requirement."""
    from apps.customers.models import Customer
    from apps.imports.services import commit_batch

    a = actor()
    batch = commit_batch(context=a.context, batch=_batch(a, CSV_MIXED))

    outcomes = dict(batch.rows.values_list("row_number", "outcome"))
    assert outcomes[1] == "created"
    assert outcomes[2] == "failed"  # blank name
    assert outcomes[3] == "created"  # survives the failure above it
    assert Customer.objects.filter(workspace=a.workspace).count() == 2


def test_imp_5_row_identity_is_batch_and_row_number(actor):
    from django.db.utils import IntegrityError

    from apps.imports.models import ImportRow

    a = actor()
    batch = _batch(a)
    with pytest.raises(IntegrityError):
        ImportRow.objects.create(batch=batch, row_number=1, raw={})


def test_imp_6_committing_twice_is_refused(actor):
    from apps.imports.services import commit_batch
    from common.errors import DomainConflict

    a = actor()
    batch = commit_batch(context=a.context, batch=_batch(a))
    with pytest.raises(DomainConflict):
        commit_batch(context=a.context, batch=batch)


@pytest.mark.nc
def test_imp_7_unknown_rows_are_never_auto_retried(actor):
    """An indeterminate outcome is recorded and surfaced to a human, never
    re-executed automatically (B12-D-A020)."""
    from apps.imports.models import ImportRow
    from apps.imports.services import commit_batch

    a = actor()
    batch = _batch(a)
    # Mark a row unknown, as a worker-timeout would.
    row = batch.rows.get(row_number=1)
    row.outcome = "unknown"
    row.save(update_fields=["outcome"])

    commit_batch(context=a.context, batch=batch)

    # commit only picks up `pending` rows: the unknown row is left alone.
    assert ImportRow.objects.get(pk=row.pk).outcome == "unknown"


def test_imp_8_errors_csv_lists_failed_rows(actor, auth_client):
    from apps.imports.services import commit_batch

    a = actor()
    batch = commit_batch(context=a.context, batch=_batch(a, CSV_MIXED))
    response = auth_client(a).get(f"/api/v1/imports/{batch.public_id}/errors.csv")
    assert response.status_code == 200
    body = response.content.decode()
    assert "row_number,outcome,error" in body
    assert "2,failed" in body


# --- T-IMP-9..12 — the frozen `If-Match` contract on POST /imports/{id}/commit ---
# `B14_06_API_IMPLEMENTATION_MAP` §Imports freezes this endpoint as
# `If-Match` -> `ImportBatch` `202`, `409` if already committed. These run on
# real PostgreSQL and mock nothing.
#
# All four take `transaction=True`, and that is load-bearing rather than
# incidental. `ATOMIC_REQUESTS` is not set, so a real request runs OUTSIDE any
# transaction — which is precisely why `require_version`'s row lock raised
# `RuntimeError: lock_aggregate() requires an open transaction` and the endpoint
# returned `500`. The default `django_db` fixture wraps each test in a
# transaction, so under it `in_atomic_block` is already true and the regression
# CANNOT reproduce: these same tests pass against the broken service. Only the
# transactional fixture reproduces the production posture, so only it can pin
# this blocker shut. It also makes `T-IMP-12`'s durability claim real — under a
# wrapping transaction, "the committed rows stand" is unfalsifiable, because
# every row would be rolled back at teardown either way.
transactional = pytest.mark.django_db(transaction=True)


@transactional
def test_imp_9_commit_with_a_valid_if_match_succeeds(actor, auth_client):
    """The frozen success path: `If-Match: <version>` -> `202`, never a 500."""
    from apps.customers.models import Customer
    from apps.imports.models import ImportBatch

    a = actor()
    batch = _batch(a)
    before = Customer.objects.filter(workspace=a.workspace).count()

    response = auth_client(a).post(
        f"/api/v1/imports/{batch.public_id}/commit",
        {},
        format="json",
        HTTP_IF_MATCH=str(batch.version),
    )

    assert response.status_code == 202, response.content
    body = response.json()
    assert body["status"] == "completed"
    # The aggregate moved exactly once under ADR-010.
    assert body["version"] == batch.version + 1
    assert ImportBatch.objects.get(pk=batch.pk).version == batch.version + 1
    # The durable import actually happened, through the owning domain command.
    assert Customer.objects.filter(workspace=a.workspace).count() == before + 2
    assert body["outcomes"] == {"created": 2}


@transactional
def test_imp_10_commit_with_a_stale_if_match_is_refused_and_writes_nothing(actor, auth_client):
    """A stale version is `409 STALE_VERSION` and commits NO row."""
    from apps.customers.models import Customer
    from apps.imports.models import ImportBatch

    a = actor()
    batch = _batch(a)
    before = Customer.objects.filter(workspace=a.workspace).count()

    response = auth_client(a).post(
        f"/api/v1/imports/{batch.public_id}/commit",
        {},
        format="json",
        HTTP_IF_MATCH=str(batch.version + 5),
    )

    assert response.status_code == 409, response.content
    assert response.json()["error"]["code"] == "STALE_VERSION"

    # No row was committed and the aggregate did not move.
    assert Customer.objects.filter(workspace=a.workspace).count() == before
    stored = ImportBatch.objects.get(pk=batch.pk)
    assert stored.version == batch.version
    assert stored.status == "mapped"
    assert set(stored.rows.values_list("outcome", flat=True)) == {"pending"}


@transactional
def test_imp_11_a_consumed_if_match_version_cannot_commit_twice(actor, auth_client):
    """`If-Match` is at-most-once: replaying the consumed version is refused."""
    from apps.customers.models import Customer

    a = actor()
    batch = _batch(a)
    client = auth_client(a)

    first = client.post(
        f"/api/v1/imports/{batch.public_id}/commit", {}, format="json",
        HTTP_IF_MATCH=str(batch.version),
    )
    assert first.status_code == 202
    after_first = Customer.objects.filter(workspace=a.workspace).count()

    replay = client.post(
        f"/api/v1/imports/{batch.public_id}/commit", {}, format="json",
        HTTP_IF_MATCH=str(batch.version),
    )
    assert replay.status_code == 409, replay.content
    assert Customer.objects.filter(workspace=a.workspace).count() == after_first


@transactional
def test_imp_12_partial_failure_still_stands_when_committed_via_if_match(actor, auth_client):
    """The narrow transaction must not have become whole-operation atomicity.

    `B14_04` §M13 and `T-IMP-2` freeze the per-row identity: a failed row leaves
    an already-committed row standing. A single enclosing transaction would roll
    the committed rows back, so this is the guard against "fixing" the 500 by
    wrapping the command.
    """
    from apps.customers.models import Customer

    a = actor()
    batch = _batch(a, CSV_MIXED)  # row 2 has no name and must fail
    before = Customer.objects.filter(workspace=a.workspace).count()

    response = auth_client(a).post(
        f"/api/v1/imports/{batch.public_id}/commit", {}, format="json",
        HTTP_IF_MATCH=str(batch.version),
    )

    assert response.status_code == 202, response.content
    assert response.json()["outcomes"] == {"created": 2, "failed": 1}
    # The two good rows COMMITTED even though a sibling row failed.
    assert Customer.objects.filter(workspace=a.workspace).count() == before + 2
    outcomes = dict(batch.rows.values_list("row_number", "outcome"))
    assert outcomes == {1: "created", 2: "failed", 3: "created"}
