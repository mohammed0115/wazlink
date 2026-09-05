"""imports commands — CSV import.

imports invokes OWNING-DOMAIN COMMANDS, never target tables. Row-level
outcomes: a failed row is recorded and surfaced; committed rows STAND. There is
no transaction-wide rollback requirement.
"""

from __future__ import annotations

import csv
import io

from django.db import transaction
from django.utils import timezone

from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, ValidationFailed

from ..models import TARGET_KINDS, ImportBatch, ImportRow


@transaction.atomic
def create_import_batch(*, context, target_kind: str, raw_csv: str) -> ImportBatch:
    if target_kind not in TARGET_KINDS:
        raise ValidationFailed("That import target is not supported.")
    if not (raw_csv or "").strip():
        raise ValidationFailed("The import file is empty.")

    batch = ImportBatch.objects.create(
        workspace=context.workspace,
        target_kind=target_kind,
        raw_csv=raw_csv,
        created_by=context.membership,
    )
    reader = csv.DictReader(io.StringIO(raw_csv))
    for index, row in enumerate(reader, start=1):
        ImportRow.objects.create(batch=batch, row_number=index, raw=dict(row))
    return batch


@transaction.atomic
def set_mapping(*, context, batch: ImportBatch, mapping: dict) -> ImportBatch:
    required = {"lead": ["name"], "customer": ["name"], "contact": ["name"]}[batch.target_kind]
    missing = [field for field in required if field not in (mapping or {}).values()]
    if missing:
        raise ValidationFailed(
            f"Required target fields are unmapped: {', '.join(missing)}.",
            {"missing": missing},
        )
    batch.mapping = mapping
    batch.status = "mapped"
    batch.save(update_fields=["mapping", "status", "updated_at"])
    return batch


def _mapped(row: ImportRow, mapping: dict) -> dict:
    return {target: (row.raw.get(source) or "").strip() for source, target in (mapping or {}).items()}


def dry_run(*, context, batch: ImportBatch) -> dict:
    """A dry run WRITES NOTHING. It reports what a commit would do."""
    would_create, would_fail = 0, []
    for row in batch.rows.order_by("row_number"):
        fields = _mapped(row, batch.mapping)
        if not fields.get("name"):
            would_fail.append({"row_number": row.row_number, "error": "name is required"})
        else:
            would_create += 1
    return {
        "batch_ref": batch.public_id,
        "rows_total": batch.rows.count(),
        "would_create": would_create,
        "would_fail": would_fail,
        "wrote_nothing": True,
    }


@transaction.atomic
def _begin_commit(*, batch: ImportBatch, expected_version: int | None) -> None:
    """The ONE guarded transition of CommitImportBatch: lock, validate, flip.

    This is the narrowest correct transaction boundary, and the boundary is
    narrow by contract rather than by preference. Wrapping the whole command in
    `transaction.atomic` would be WRONG here: the frozen per-row identity
    `(batch_id, row_number)` (`B14_04` §M13, `B14_09` `import_process_row`) and
    `T-IMP-2` require that a failed row leave an already-committed row standing,
    which a single enclosing transaction would roll back. It would also hold the
    aggregate lock across the entire row loop. So exactly the aggregate's own
    status/version transition is transactional; each row keeps its own
    transaction, unchanged, below.

    The lock is taken unconditionally, not only when `If-Match` is present: the
    `completed` guard is a concurrent-state decision and must read committed
    truth, not the snapshot this request opened with. `require_version` then
    applies ADR-010 against that same locked row -- re-taking a lock this
    transaction already holds costs one statement and keeps the version rule in
    the single place that owns it.
    """
    lock_aggregate(batch)
    # Frozen: `409` if already committed (`B14_06` §Imports). No other terminal
    # state is refused here -- a re-commit of an in-flight batch is already a
    # per-row no-op, because only `pending` rows are processed.
    if batch.status == "completed":
        raise DomainConflict("This batch is already committed.")
    require_version(batch, expected_version, required=False)

    batch.status = "committing"
    bump_version(batch)
    batch.save(update_fields=["status", "version", "updated_at"])


def commit_batch(*, context, batch: ImportBatch, expected_version: int | None = None) -> ImportBatch:
    """Commit. Each row is processed independently and idempotently on
    (batch_id, row_number). A failed row does NOT roll back a committed one.

    `version` moves exactly once, at the guarded transition, so a retried
    `If-Match` carrying the consumed version is `409 STALE_VERSION`
    (`B1_CONCURRENCY_IDEMPOTENCY` §3) rather than a second commit.
    """
    _begin_commit(batch=batch, expected_version=expected_version)

    for row in batch.rows.filter(outcome="pending").order_by("row_number"):
        _commit_row(context=context, batch=batch, row=row)

    # Terminal write of the same command: one statement, so it needs no
    # transaction of its own, and no second version bump.
    batch.status = "completed"
    batch.committed_at = timezone.now()
    batch.save(update_fields=["status", "committed_at", "updated_at"])
    return batch


def _commit_row(*, context, batch: ImportBatch, row: ImportRow) -> None:
    """One row, one transaction. Its failure is recorded, not propagated."""
    fields = _mapped(row, batch.mapping)
    try:
        with transaction.atomic():
            created_ref = _create_target(context=context, batch=batch, fields=fields)
        row.outcome = "created"
        row.created_ref = created_ref
        row.error_message = ""
    except ValidationFailed as exc:
        row.outcome = "failed"
        row.error_message = str(exc.message)[:400]
    except Exception as exc:  # noqa: BLE001
        # An indeterminate outcome is recorded as `unknown` and surfaced to a
        # human. It is NEVER re-executed automatically (B12-D-A020).
        row.outcome = "unknown"
        row.error_message = type(exc).__name__[:400]
    row.save(update_fields=["outcome", "created_ref", "error_message", "updated_at"])


def _create_target(*, context, batch: ImportBatch, fields: dict) -> str:
    name = fields.get("name", "")
    if not name:
        raise ValidationFailed("name is required")

    if batch.target_kind == "customer":
        from apps.customers.services import create_customer

        customer = create_customer(
            context=context,
            party_kind=fields.get("party_kind") or "organization",
            name=name,
            origin_kind="import",
            primary_contact=(
                {"name": name, "phone": fields.get("phone", ""), "email": fields.get("email", "")}
                if (fields.get("party_kind") or "organization") == "person"
                else None
            ),
        )
        return customer.public_id

    if batch.target_kind == "lead":
        from apps.crm.services import create_lead

        lead = create_lead(
            context=context,
            origin_type="import",
            primary_contact={
                "name": name,
                "phone": fields.get("phone", ""),
                "email": fields.get("email", ""),
            },
        )
        return lead.public_id

    from apps.crm.models import Contact

    contact = Contact.objects.create(
        workspace=context.workspace,
        full_name=name,
        phone=fields.get("phone", ""),
        email=fields.get("email", ""),
    )
    return contact.public_id


__all__ = ["create_import_batch", "set_mapping", "dry_run", "commit_batch"]
