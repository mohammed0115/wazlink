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
