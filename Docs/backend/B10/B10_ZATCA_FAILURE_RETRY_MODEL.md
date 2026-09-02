# B10 — ZATCA Failure & Retry Model

> Design only. Realizes `B10-D-A019` (§`B10_DECISION_REGISTER.md`). Separates safe transport retry from business re-issuance per brief §25. B12 (future) will own generic async execution infrastructure; this document defines tax-domain semantics only, mirroring `B8_B12_ASYNC_BOUNDARY.md`'s and `B9_B12_ASYNC_BOUNDARY.md`'s identical forward-dependency treatment.

## 1. Normalized failure codes (new, additive within the existing `BACKEND_ERROR_CATALOG.md` envelope)

| Code | HTTP | Meaning |
|---|---:|---|
| `TAX_APPLICABILITY_UNKNOWN` | 409 | `IssueTaxInvoice` attempted while the governing `TaxProfile.zatca_applicability = unknown` |
| `TAX_CONFIGURATION_MISSING` | 409 | required `TaxProfile` fields absent for the attempted operation (e.g., no `legal_name` recorded) |
| `ZATCA_CREDENTIAL_INVALID` | 409 | `credential_ref` does not resolve to a usable credential |
| `ZATCA_CERTIFICATE_EXPIRED` | 409 | CSID/certificate past its validity window |
| `ZATCA_SUBMISSION_REJECTED` | 409 | ZATCA returned a rejection outcome |
| `ZATCA_PROVIDER_UNAVAILABLE` | 502/503 | adapter call failure |
| `ZATCA_TIMEOUT` | 504 | adapter call exceeded budget |
| `ZATCA_RATE_LIMITED` | 429 | provider rate limit |
| `TAX_DUPLICATE_SUBMISSION` | 409 | a retry attempted outside the idempotent replay path (should be unreachable given `B10_IDEMPOTENCY_CONCURRENCY.md`; retained as a defense-in-depth code) |
| `TAX_DOCUMENT_STATE_CONFLICT` | 409 | an operation attempted against a document whose `status`/`zatca_status` makes it illegal (e.g., `CancelTaxInvoice` after `zatca_status=accepted`) |
| `TAX_CORRECTION_EXCEEDS_ORIGINAL` (new, `B10-FIX.1`) | 409 | `CreateCreditNote`/`CreateDebitNote` would drive the original's `net_corrected_total` negative (`B10-D-A021`, §`B10_CREDIT_NOTE_MODEL.md` §6) |

`ERROR_NEW_COUNT = 11` (`B10-FIX.1` adds `TAX_CORRECTION_EXCEEDS_ORIGINAL`; **`B10-FIX.1a` removes the previously-listed `TAX_VALIDATION_FAILED` row** — a fresh independent countersign found it described the identical semantic already covered by the reused frozen code below, `B10-CS-1` — so the table above now contains exactly 11 rows, mechanically matching the count), every one a new `code` string inside the existing envelope/status doctrine — zero new HTTP status shape, matching the corpus-wide B8/B9 discipline. `TAX_VALIDATION_REQUIRED` (already frozen, `BACKEND_ERROR_CATALOG.md`, 422, "missing official tax contract/field") is reused verbatim for B10's own pre-submission structural/field-completeness validation failures and is not counted among the 11. Separately, `applicability_transition_conflict` is a new `details.reason` value inside the existing `CONFLICT` code (not a new `code` itself) — registered as `B10-AM-008` (§`B10_CONTROLLED_AMENDMENTS.md`), closing `B10-AUDIT-M1`.

## 2. Fail-closed rule for ambiguous outcomes (`B10-D-A019`)

An unrecognized or ambiguous ZATCA response maps `zatca_status` to `pending` plus a mandatory `RECONCILIATION_MISMATCH`-class alert — never silently to `accepted`, never silently to `rejected`. This is the tax-domain restatement of `B8_PAYMENT_PROVIDER_PORT.md` §3's identical fail-closed row.

## 3. Safe transport retry vs. business re-issuance

**Transport retry** (`RetryTaxSubmission`): re-attempts the *same* `tax_invoice_id`'s submission, appending a new `tax_submissions` row, never creating a new `TaxInvoice`. Safe to retry any number of times (bounded by §4's dead-letter policy) because it is idempotent on `(tax_invoice_id, attempt scope)` (§`B10_IDEMPOTENCY_CONCURRENCY.md`).

**Business re-issuance never happens automatically.** A ZATCA timeout, rate limit, or transient unavailability **never** causes B10 to generate a second `TaxInvoice` for the same `source_ref`. If a submission is ultimately and permanently rejected, the only paths forward are: (a) an operator reviews the rejection and issues a `CreditNote`/`DebitNote` correcting the substantive error, or (b) an operator explicitly `CancelTaxInvoice`s it (only while `zatca_status ∈ {not_applicable, pending, rejected}`) — never a silent duplicate.

## 4. Reconciling uncertain external outcomes

Mirrors `B8_RECONCILIATION_MODEL.md`'s precedence rules exactly: a verified submission-outcome callback (where one exists) always wins over a stale guess; a direct status query is authoritative once made; reconciliation never overwrites a newer authoritative outcome with an older one; a genuine same-moment disagreement is never auto-resolved, always routed to `TAX_DOCUMENT_STATE_CONFLICT`/admin review. Full detail: `B10_RECONCILIATION_MODEL.md`.

## 5. Retry budget and dead-letter

After 8 unsuccessful `RetryTaxSubmission` attempts for the same `tax_invoice_id`, the record is dead-lettered with an operational alert — manual admin intervention required, never an unbounded retry loop. **Citation corrected under `B10-FIX.1` (closes `B10-AUDIT-N2`):** the pre-FIX.1 pack cited the generic `BACKEND_RETRY_POLICY.md` "Payment pending | scheduled poll | max 8" row, but a more directly on-point frozen row already exists in the same table: **"ZATCA unavailable | provider outage | yes | 8 | pending + reconciliation."** This row is cited now instead. The number `8` is **WazLink internal retry policy** — reused from this already-frozen B0 row, not invented here — and is explicitly **not** claimed as a ZATCA regulatory requirement; no official ZATCA source specifies a retry-attempt count, since retry-attempt budgeting is a caller-side operational concern, not a protocol requirement.

## 6. Never invents a duplicate tax document

No failure path in this document, however it resolves, ever results in two `TaxInvoice` rows for the same `(source_type, source_ref)` non-note pair, nor two accepted submissions for the same document — enforced structurally by `B10_IDEMPOTENCY_CONCURRENCY.md`'s durable uniqueness, not merely by this document's own discipline.

```
DUPLICATE_TAX_SUBMISSION_PATHS = 0
```
