# B10 — Idempotency & Concurrency

> Design only. Realizes `B10-D-A013`/`A014` (§`B10_DECISION_REGISTER.md`). Adopts the frozen concurrency primitives (`B1_CONCURRENCY_IDEMPOTENCY.md` §1) verbatim: integer `version` + `If-Match`/`expected_version`, `SELECT ... FOR UPDATE`, partial unique indexes, `transaction.atomic` before any external call. Redis is never used for any decision below.

## 1. Business-document identity vs. transport-retry identity (brief §22)

| Identity | Scope | Purpose |
|---|---|---|
| **Business-document identity** | `(source_type, source_ref)` for `standard_invoice`/`simplified_invoice`; `reference_invoice_id` + a fresh `Idempotency-Key` per note for `credit_note`/`debit_note` | guarantees at most one `TaxInvoice` exists per underlying B8 `Invoice`, and each `CreateCreditNote`/`CreateDebitNote` call under a distinct key creates its own distinct note (deliberately **not** deduplicated against `reference_invoice_id` alone — an operator may legitimately issue more than one credit note against the same original for different reasons) |
| **Transport-retry identity** | `(tax_invoice_id, attempt scope)` on `tax_submissions` | guarantees a ZATCA network timeout, rate limit, or ambiguous response never creates a second business document — only a new attempt row against the same one |

Conflating these two would let a transport-layer retry accidentally mint a second statutory tax document, which brief §22 explicitly forbids.

## 2. Stable identities per command

| Command | Idempotency key scope | Additional stable identity |
|---|---|---|
| `IssueTaxInvoice` | not client-facing — `(consumer="tax", event_id)` on the consumed `InvoiceIssued` event (frozen at-least-once-consumer dedup pattern) | partial unique `(source_type, source_ref) WHERE document_kind = 'invoice'` (renamed from `document_type` under `B10-FIX.1`) on `tax_invoices`, **and** the global unique `(source_type, source_ref)` on `pending_tax_document_classifications` (new, `B10-FIX.1`) — database-level backstops independent of the header, one per possible outcome |
| `UpdateTaxProfile` / `SetTaxApplicability` | header, per operator+body-hash | `TaxProfile` versioning itself (a replay simply returns the same already-created version, never a duplicate) |
| `CancelTaxInvoice` | header | `TaxInvoice.version` (optimistic concurrency) |
| `CreateCreditNote` / `CreateDebitNote` | header | none for note identity — each call under a distinct key legitimately creates a distinct note (§1); **new under `B10-FIX.1`:** the original's row lock (`B10-D-A021`, §5a below) additionally bounds how many notes may *succeed*, independent of how many are attempted |
| `SubmitTaxDocumentForProcessing` | not client-facing — `(command_id, tax_invoice_id)` | `TaxInvoice` legal-transition check (no backward `zatca_status` move); routed per `invoice_classification` (§`B10_ZATCA_BOUNDARY.md` §3) |
| `RetryTaxSubmission` | admin-invoked: header; scheduled: `(command_id="RetryTaxSubmission", tax_invoice_id, attempt_number)` | same legal-transition check, **plus a durable `UNIQUE(tax_invoice_id, attempt_number)` constraint on `tax_submissions` (new, `B10-FIX.1`, closes `B10-AUDIT-N3`)** — attempt-number allocation is now a DB-level backstop, not solely the idempotency-key/header layer |
| `ResolvePendingTaxClassification` (new, `B10-FIX.1`) | `(command_id, pending_tax_document_classification_id)` | `PendingTaxDocumentClassification.version` (optimistic concurrency, §5b below) |

## 3. Concurrency races and outcomes

| # | Race | Mechanism | Outcome |
|---|---|---|---|
| C1 | Two concurrent `IssueTaxInvoice` attempts for the same B8 `Invoice` (e.g., a redelivered `InvoiceIssued` event racing a manual backlog-resolution sweep) | partial unique `(source_type, source_ref)` | first commits; second's `INSERT` fails the constraint, mapped to a no-op (idempotent — the frozen at-least-once-consumer dedup already prevents this in practice; the index is the backstop) |
| C2 | Two concurrent `CreateCreditNote` calls against the same original, different `Idempotency-Key`s | no *identity* constraint blocks this — both are independently audited, distinct `TAX-*` ids (§1). **Corrected under `B10-FIX.1`:** whether both *succeed* now additionally depends on `B10-D-A021`'s row lock — if both fit within the original's remaining `net_corrected_total` after serializing through the lock, both commit; if not, the second is rejected `409 TAX_CORRECTION_EXCEEDS_ORIGINAL` (§`B10_CREDIT_NOTE_MODEL.md` §6) | deterministic in both directions: within-bound concurrent notes are intended behavior (not a bug), over-bound concurrent notes now conflict rather than silently over-correcting |
| C3 | `CancelTaxInvoice` racing `SubmitTaxDocumentForProcessing` for the same document | `SELECT ... FOR UPDATE` on the `tax_invoices` row | whichever commits first wins; the loser re-reads current `status`/`zatca_status` and is rejected `409 TAX_DOCUMENT_STATE_CONFLICT` if its precondition no longer holds |
| C4 | Two `RetryTaxSubmission` attempts (scheduled sweep + manual operator retry) for the same document | `(tax_invoice_id, attempt scope)` idempotency key | second sees the already-in-flight/already-resolved attempt and no-ops |
| C5 | `SetTaxApplicability` racing `IssueTaxInvoice`'s read of the current `TaxProfile` | `tax_profile_version_id` is read fresh, inside `IssueTaxInvoice`'s own transaction, at the instant of generation — read-committed isolation guarantees the generated document reflects either the fully-pre- or fully-post-transition committed profile, never a partial one (identical reasoning to `B8_CONCURRENCY_MODEL.md` C13) | deterministic, no torn read |
| C6 | Two workspaces' `TaxBuyerProfile` updates | independent rows, `workspace_id` unique | no contention by construction |

## 4. What is forbidden (inherited verbatim, `B1_CONCURRENCY_IDEMPOTENCY.md` §5)

No Redis lock for any tax/ZATCA decision. No advisory lock where a row lock suffices. No optimistic retry loop that silently re-applies a command the client did not re-authorize. No last-write-wins on any domain field.

## 5. Backlog idempotency and resolution concurrency (new, `B10-FIX.1`, closes `B10-AUDIT-M2`)

**5a. Creation.** `IssueTaxInvoice`, observing `zatca_applicability = unknown`, upserts a `PendingTaxDocumentClassification` keyed on the global unique `(source_type, source_ref)`. A redelivered `InvoiceIssued` event (at-least-once delivery, per the frozen consumer contract) that reaches this branch a second time is a no-op against the existing row — the same durable-uniqueness discipline `tax_invoices` itself already uses for the non-`unknown` branch, applied symmetrically here. `AT-B10BL-1` asserts this directly: the same `InvoiceIssued` event delivered twice while `unknown` produces exactly one backlog row.

**5b. Resolution race.** Two resolution attempts for the same row — the scheduled sweep and a manual operator-invoked resolve arriving concurrently, or two sweep workers double-processing after a crash — are serialized by `SELECT ... FOR UPDATE` on the `pending_tax_document_classifications` row plus its `version` column (identical primitive to every other governed transition in this pack). The loser re-reads `status`, finds it already resolved, and no-ops rather than re-resolving. `AT-B10BL-5` asserts this: two concurrent resolution attempts on one item produce exactly one effect (one `TaxInvoice` or one `resolved_not_applicable` outcome, never two).

**5c. Resolution never duplicates a `TaxInvoice`.** When `ResolvePendingTaxClassification` determines the outcome is issuance, it invokes the existing `IssueTaxInvoice` command for the same `source_ref` rather than constructing a `TaxInvoice` row itself — `IssueTaxInvoice`'s own `(source_type, source_ref)` partial-unique backstop is the only place a `TaxInvoice` is ever created, so the backlog resolution path cannot introduce a second creation path or a second dedup rule to keep in sync with the first.

**5d. No Redis.** Every mechanism above is a durable DB constraint or row lock — consistent with §4 above, extended to the backlog.

```
DUPLICATE_INVOICE_PATHS = 0
```
