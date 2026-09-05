# 16 — Import and Custom Fields Plan

> Resolves brief §14 and §15. **Reuses B11 storage and B12 async. Invents no arbitrary limits.**

## Part A — Customer/Lead Import (`GAP-008`)

### A.1 Pipeline

```
upload CSV (B11 file_asset)
  → parse headers
  → map columns → fields (incl. custom fields)
  → validate + normalize per row
  → duplicate detection per row (advisory)
  → DRY RUN: full validation, ZERO writes
  → human reviews counts, errors, duplicate candidates
  → COMMIT (async, B12 default queue)
  → per-row: invoke the OWNING DOMAIN'S COMMAND
  → results: succeeded / failed / unknown, error CSV export
```

### A.2 The non-negotiable rules

**Dry run writes nothing.** Not a row, not a partial batch, not a "reserved" identifier. This is the single most important property and it is tested as a negative control.

**Import invokes commands, never tables.** Each row calls `CreateCustomer`, `CreateLead` or `AddContact` — the same commands a human uses, with the same guards, quota checks and audit rows. A bulk writer that bypasses command guards would bypass every invariant B1/B2 enforce. This mirrors B12's `ReplayDeadLetter`, which *"re-invokes the owning domain's command"* rather than writing rows.

**Per-row idempotency.** Identity `(batch_id, row_number)`. Re-running a committed batch is a no-op per already-succeeded row.

**Partial failure is normal and terminal.** A batch completes with counts; failed rows are recorded with reasons and exported as a correctable CSV. The batch is **not** auto-retried.

**`UNKNOWN` rows are never auto-retried.** If a row's target command returns an unresolved outcome, the row is recorded `unknown` and surfaced for human resolution — never blindly re-executed. This is `B12-D-A020` applied at the row level, and it is why the results screen has three counts, not two.

**Rollback — `PD-007` APPROVED.** There is **no transaction-wide business rollback of a committed batch.** Created records are ordinary CRM records the moment they exist, and silently deleting them would destroy human work performed after the import. The supported correction is: archive the batch's created records via a batch-scoped list (each archival is an ordinary, audited command). `PD-007` asks Owner/CTO to confirm this posture.

### A.3 Deliberately unresolved

| Item | Status |
|---|---|
| Max rows per batch | **`PRODUCT DECISION REQUIRED`** (`PD-008`) — no arbitrary number invented |
| Error-file retention | **`PRODUCT DECISION REQUIRED`** (`PD-008`) — inherits the unresolved B11/B2 retention decisions |
| Import quota per plan | **`PRODUCT DECISION REQUIRED`** (`PD-004`) — `B2-D-C002` names *"a bulk quota decision"* as a precondition |
| Rollback policy | **RESOLVED** — `PD-007` APPROVED: batch-scoped archive/remediation, no transaction-wide rollback |

### A.4 Async and storage posture

**B12 reused as-is**: the existing `default` queue, transactional outbox for progress, standard retry/backoff for *idempotent* row operations only, dead-letter for poison rows. **No new queue, no new provider, no new webhook.** **B11 reused as-is**: the CSV and the error export are `file_assets` under the existing 10-gate validation; `file_attachments.subject_type += 'import_batch'`.

## Part B — Custom Fields (`GAP-010`, `GAP-011`)

### B.1 The governing risk

Brief §15: *"Avoid turning arbitrary JSON into uncontrolled business truth."* `BACKEND_DATA_GOVERNANCE.md` independently restricts JSONB to *"structured flexible metadata"* and forbids it for *"relationships, state, or ownership."*

### B.2 Approved shape — typed side table (`PD-005` APPROVED)

`field_definitions` — `workspace_id`, `subject_type` (`lead|contact|customer|deal|ticket`), `key` (immutable slug), `label`, `field_type`, `required`, `options[]` (for selects), `visible_to_roles[]`, `position`, `active`, `archived_at`, `version`. Unique `(workspace_id, subject_type, key)`.

`custom_field_values` — `workspace_id`, `definition_id`, `subject_type`, `subject_id`, and **one column per supported type** (`value_text`, `value_number NUMERIC(19,4)`, `value_date`, `value_boolean`, `value_option_id`). Unique `(subject_type, subject_id, definition_id)`. Indexes per value column, partial on `definition_id`.

`PD-005` is **APPROVED: typed side-table architecture** — arbitrary JSON must not become canonical business truth. **Why not JSONB on the subject table:** values stay type-checked at write, indexable for filtering, and reportable — and no frozen table gains a JSONB column, so `BACKEND_DATA_GOVERNANCE.md` is honored rather than argued with. **Cost:** more rows and a join. `PD-005` records the JSONB alternative honestly so Owner/CTO can choose.

### B.3 Rules

**Definitions are archived, never deleted** — a deleted definition would orphan historical values and make old records uninterpretable. **`key` is immutable** once created; the label may change freely. **Validation** is enforced server-side at command time, never only in the form. **Visibility** is per-role and is a **presentation filter, not an authorization boundary** — a role that can read the record can be served its values; sensitive data belongs in a proper field with a proper permission, not in a hidden custom field. **Search/filter** exposure goes through each subject's existing list selector, so no new query surface is created. **Custom fields never participate in identity resolution, uniqueness, or any financial computation.**

### B.4 Limits

Max definitions per subject per workspace: **`PRODUCT DECISION REQUIRED`** (`PD-008`). Unbounded definitions are an index-growth and UI-collapse risk; a number invented here would be arbitrary.
