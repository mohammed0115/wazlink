# B10 — Failure Catalog

> Design only. Reuses the frozen `BACKEND_ERROR_CATALOG.md` envelope; adds only new `code` values (full list: `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1) plus the already-frozen `TAX_VALIDATION_REQUIRED`, unmodified.

## 1. Reused codes (frozen, unchanged)

`PERMISSION_DENIED` (403), `ENTITY_NOT_FOUND` (404), `VALIDATION_ERROR` (400/422), `CONFLICT` (409, `details.reason` vocabulary extended with `applicability_transition_conflict` — registered as controlled amendment `B10-AM-008` against `B1_API_DTO_CONTRACTS.md` under `B10-FIX.1`, closing `B10-AUDIT-M1`; the pre-FIX.1 pack used this reason value without registering the amendment), `IDEMPOTENCY_CONFLICT` (409), `STALE_VERSION` (409), `TAX_VALIDATION_REQUIRED` (422, already frozen — "missing official tax contract/field," reused verbatim for B10's own field-completeness failures), `INTERNAL_ERROR` (500).

## 2. New codes

Eleven new `code` values (`B10-FIX.1` adds `TAX_CORRECTION_EXCEEDS_ORIGINAL`; `B10-FIX.1a` removes the redundant `TAX_VALIDATION_FAILED` row an independent countersign found duplicated the reused `TAX_VALIDATION_REQUIRED` code below, `B10-CS-1`), full table with HTTP status and meaning: `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1.

## 3. Failure scenario table

| # | Scenario | User-visible result | Internal state | Retry/idempotency | Alert |
|---|---|---|---|---|---|
| BF1 | `IssueTaxInvoice` fires while `zatca_applicability=unknown` | no user-visible error (system-triggered) | `TaxInvoice` deferred to pending-classification backlog | n/a — resolved when applicability is set | backlog-depth gauge (§`B10_OBSERVABILITY.md`) |
| BF2 | Operator applicability change accidentally sets `enabled` without prior `applicable_not_enabled`→configuration-validated step | `422` at `SetTaxApplicability` if `ValidateZatcaConfiguration` has never reported `configured=true` for the target environment (enforced precondition, `B10_TAX_APPLICABILITY_MODEL.md` §2 table) | no transition applied | operator corrects and retries | none |
| BF3 | Operator applicability change accidentally sets `not_applicable` while genuinely obligated | not structurally preventable (business decision, not a system fact B10 can verify) — but gated behind Owner-only `tax.applicability.manage` with mandatory `reason`, fully audited | new `TaxProfile` version recorded with actor/reason | admin can immediately `SetTaxApplicability` again to correct | `tax_applicability.changed` audit row is the detection surface |
| BF4 | ZATCA credential/certificate expires mid-operation | `409 ZATCA_CREDENTIAL_INVALID` / `ZATCA_CERTIFICATE_EXPIRED` | `TaxProfile` may auto-transition `enabled→suspended` on repeated detected failure (§`B10_ZATCA_FAILURE_RETRY_MODEL.md`) | generation continues (store-only); submission queues for retry post-renewal | certificate-expiry-proximity alert before this ever happens |
| BF5 | Two concurrent `IssueTaxInvoice` attempts for the same B8 `Invoice` | no user-visible error (system-triggered) | partial unique index backstop; one row, one no-op | idempotent by construction | none |
| BF6 | Duplicate ZATCA submission attempt (retry after ambiguous timeout) | no user-visible error | `tax_submissions` gets one new attempt row, never a second `TaxInvoice` | `(tax_invoice_id, attempt scope)` idempotency | none |
| BF7 | Provider times out but the submission actually succeeded server-side | `zatca_status` stays `pending` until reconciliation's `retrieve_submission_status` resolves it | no premature `accepted` | reconciliation sweep, bounded window | provider-timeout alert |
| BF8 | Partial external failure (ZATCA accepts the document but the adapter's own follow-up read fails) | `zatca_status=pending` (fail-closed, `B10-D-A019`) | `tax_submissions` row records the ambiguous outcome | reconciliation resolves | `RECONCILIATION_MISMATCH`-class |
| BF9 | `CreateCreditNote` attempted with no `reference_invoice_id` resolvable in-workspace | `404 ENTITY_NOT_FOUND` (never a validation error that would confirm cross-workspace existence, Doctrine R-2) | no row created | operator corrects | none |
| BF10 | B8 `Refund` exists with no corresponding `CreditNote` | not a system error — operator-driven correlation is optional per case (`B10_CREDIT_NOTE_MODEL.md` §2); no automatic linkage exists to be "missing" | n/a | n/a | daily B8/B10 correlation reconciliation (§`B10_RECONCILIATION_MODEL.md` §1) surfaces the pattern for review, never auto-corrects |
| BF11 | `CreditNote` issued with no corresponding B9 `RevenueReversal` | not a B10 error — by design, `B10-D-A010` (B9 owns that decision entirely) | n/a | n/a | none from B10; a future B9-side reconciliation is B9's own concern |
| BF12 | B9 `RevenueReversal` exists with no corresponding `CreditNote` | not a B10 error — symmetric to BF11 | n/a | n/a | daily correlation reconciliation may surface it as an anomaly signal, never auto-creates a note |
| BF13 | Wrong tax rate applied due to a stale-read bug hypothesis | structurally prevented, not merely handled: rate is read fresh from the current `tax_profile_version_id` inside `IssueTaxInvoice`'s own transaction and snapshotted immediately (`B10-D-A007`) — no code path re-reads a rate after snapshot | n/a | n/a | n/a |
| BF14 | Historical configuration (`TaxProfile`) changes after documents were already issued under the old version | prior documents' snapshotted fields are unaffected (`B10-D-A008`); new documents use the new version | `AT-B10APP-4` asserts byte-identical historical snapshots | n/a | none |
| BF15 | Workspace's billing currency changes between two B8 invoices | each `TaxInvoice.currency` independently equals its own `source_ref`'s `Invoice.currency` at issuance time — no cross-document currency assumption exists to break | n/a | n/a | none |
| BF16 | Cross-workspace `TAX-*` reference attempted (IDOR) | `404 ENTITY_NOT_FOUND`, workspace-scoped resolution before any other processing (Doctrine R-1) | no disclosure of existence elsewhere | n/a | IDOR-attempt observability, matching B8's identical `T3`/`T14` treatment |
| BF17 | Underlying B8 workspace/customer deleted after a `TaxInvoice` was already issued | the already-issued document is retained (statutory evidence, never deleted) and anonymized on the buyer side per the workspace-deletion purge workflow (§`B10_SECURITY_PRIVACY.md` §3) | `workspace_id` retained for referential integrity; display fields anonymized | n/a | none |
| BF18 | The seeded `LegalEntity` itself needs to change (e.g., a corporate restructuring) | out of Phase-1 scope (`B10-D-C004`); no governed command exists for this in Phase 1 | n/a | n/a | n/a |
| BF19 | Two concurrent `IssueTaxInvoice`/`SubmitTaxDocumentForProcessing` calls racing on the same row | `SELECT ... FOR UPDATE` + `version` check | first wins, second gets `409 STALE_VERSION`/`TAX_DOCUMENT_STATE_CONFLICT` | client may retry with fresh `version` | none |
| BF20 | Replay attack — a previously-valid request replayed later (e.g., a captured `SetTaxApplicability` call resent) | `Idempotency-Key` scoped to (workspace/operator + endpoint + body hash); an identical replay returns the original result; a replay with a stale `expected_version`/`config_version` context is rejected on the version check, not silently reapplied | no duplicate transition | n/a | none beyond the normal idempotency-conflict path |
| BF21 (new, `B10-FIX.1`) | `CreateCreditNote`/`CreateDebitNote` would drive the original's `net_corrected_total` negative (§`B10_CREDIT_NOTE_MODEL.md` §6) | `409 TAX_CORRECTION_EXCEEDS_ORIGINAL` | no note row created | operator corrects the requested amount and retries | none |
| BF22 (new, `B10-FIX.1`) | `InvoiceIssued` redelivered while a `PendingTaxDocumentClassification` for the same `source_ref` already exists (`unknown` mode) | no user-visible error (system-triggered) | global unique `(source_type, source_ref)` backstop — no-op against the existing backlog row | idempotent by construction | none |
| BF23 (new, `B10-FIX.1`) | Two `ResolvePendingTaxClassification` attempts race on the same backlog row (scheduled sweep + manual operator trigger) | no user-visible error (system path) / `200` no-op (operator path) | row lock + `version` check — first commits, second re-reads already-resolved state and no-ops | idempotent by construction | none |

`FAILURE_SCENARIO_COUNT = 23` (`B10-FIX.1` adds `BF21`–`BF23`), `FAILURE_SCENARIO_DUPLICATES = 0`, `FAILURE_SCENARIO_GAPS = 0` (every new `code` value in `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1 — including `TAX_CORRECTION_EXCEEDS_ORIGINAL` — is covered by at least one BF row above or a dedicated acceptance test).

## 4. No failure path grants a false tax fact or loses tenant scope

Restated per `BACKEND_FAILURE_MATRIX.md`'s closing rule, extended: no scenario above ever results in an unearned `accepted` ZATCA outcome, an unearned `RevenueReversal`, a cross-tenant disclosure, or a silently-mutated historical document.
