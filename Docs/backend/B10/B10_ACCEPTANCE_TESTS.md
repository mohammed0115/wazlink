# B10 — Acceptance Test Matrix

> Design only. Every Class A decision (`B10_DECISION_REGISTER.md`) has acceptance evidence below. `B9_B10_TAX_BOUNDARY.md` §8 already declares five B9-authored negative controls (`AT-B10-1`…`5`, testing the boundary from B9's own side) — these are **not** duplicated here; this document adds the symmetric checks from B10's own side, distinctly prefixed (`AT-B10B9-*`) so no ID collides.

## 1. Full test list

| Test ID | Category | Positive/Negative | Assertion |
|---|---|---|---|
| `AT-B10LE-1` | Legal Entity | positive | `LegalEntity` bootstrap creates exactly one row with an accompanying `TaxProfile{zatca_applicability=unknown}` in the same transaction |
| `AT-B10LE-2` | Legal Entity | positive | Compliance identity is platform-scoped: two workspaces under the same seeded `LegalEntity` share one `TaxProfile`; no per-workspace `TaxProfile` row is ever created |
| `AT-B10APP-1` | Applicability | positive | `zatca_applicability=not_applicable` + zero ZATCA credentials configured → B8 subscriptions/payments/entitlements continue to function normally; zero `TaxInvoice` rows are ever created |
| `AT-B10APP-2` | Applicability | negative | `zatca_applicability=unknown` → `IssueTaxInvoice` never silently behaves as `not_applicable` (no row silently skipped-and-forgotten) and never silently behaves as `enabled` (no row silently submitted) |
| `AT-B10APP-3` | Applicability | negative | `zatca_applicability=unknown` + a B8 `InvoiceIssued` event arrives → the fact lands on the admin-visible pending-classification backlog, queryable, not dropped |
| `AT-B10APP-4` | Applicability | positive | Mutate the current `TaxProfile` (new version, new applicability); re-read a `TaxInvoice` issued under the prior version — its snapshotted seller fields are byte-identical to before the mutation |
| `AT-B10APP-5` | Applicability | positive | A pending-classification backlog item, resolved after applicability is finally set, is issued under the profile version current **at resolution time**, not backdated to the original event's arrival time |
| `AT-B10ZAT-1` | ZATCA submission authority | negative | An attempt to invoke any `TaxProvider` port operation outside `SubmitTaxDocumentForProcessing`/`RetryTaxSubmission` — no such code path exists to invoke |
| `AT-B10ZAT-2` | ZATCA submission authority | negative | `SubmitTaxDocumentForProcessing` invoked while `zatca_applicability != enabled` — rejected, no submission attempted |
| `AT-B10ZAT-3` | ZATCA submission authority | positive | **Corrected under `B10-FIX.1` (closes `B10-AUDIT-C1`):** `zatca_applicability=enabled` + `status=issued` → `SubmitTaxDocumentForProcessing` routes solely by `invoice_classification` — `standard` → clearance, `simplified` → reporting — and never reads `document_kind` to make this decision. Full classification/routing matrix: `AT-B10CLASS-1`…`9` below |
| `AT-B10ZAT-4` | ZATCA phase mapping | positive | `applicable_not_enabled` → `TaxInvoice` rows are generated and stored with `zatca_status=not_applicable`(-meaning-not-yet-transmitted); zero network call is made |
| `AT-B10ZAT-5` | ZATCA fail-closed | negative | An unrecognized/ambiguous provider response → `zatca_status=pending` plus a mandatory alert; never silently `accepted`, never silently `rejected` |
| `AT-B10ZAT-6` | ZATCA credential gate | negative | `zatca_applicability=applicable_not_enabled`, an operator attempts `SetTaxApplicability(enabled)` before `ValidateZatcaConfiguration` has ever reported `configured=true` — rejected `422` |
| `AT-B10INV-1` | Invoice model | positive | All three `document_kind` values (`invoice`, `credit_note`, `debit_note`) crossed with both `invoice_classification` values (`standard`, `simplified`) are representable as `tax_invoices` rows with no new table required (renamed from `document_type` under `B10-FIX.1`) |
| `AT-B10INV-2` | Invoice ≠ commercial Invoice | positive | A B8 `Invoice` exists with `zatca_applicability=not_applicable` — assert zero corresponding `TaxInvoice` row; the B8 `Invoice` alone is returned to the customer |
| `AT-B10INV-3` | Immutability | negative | An attempt to modify any content field (seller/buyer snapshot, lines, totals) of a `status=issued` `TaxInvoice` — rejected; only a new `CreditNote`/`DebitNote` can adjust it |
| `AT-B10CN-1` | Credit note structure | positive | `CreateCreditNote` against a valid, in-workspace `document_kind=invoice` row succeeds, producing a new `TAX-*` row with `document_kind=credit_note`, `reference_invoice_id` set, and `invoice_classification` inherited from the reference (renamed/corrected under `B10-FIX.1`) |
| `AT-B10CN-2` | Credit note immutability | negative | An attempt to modify an issued `credit_note`'s fields — rejected, identical treatment to `AT-B10INV-3` |
| `AT-B10NUM-1` | Numbering | positive | `TAX-*` (`public_id`) is assigned to every `TaxInvoice` unconditionally; `legal_sequence_number` is assigned only under `applicable_not_enabled`/`enabled`/`suspended`, remaining `NULL` under `not_applicable`/`unknown` |
| `AT-B10NUM-2` | Numbering | positive | Two documents issued in sequence under an `applicable_*` profile receive strictly increasing `legal_sequence_number` values, scoped per `(legal_entity_id, environment)` |
| `AT-B10REF-1` | B8 refund boundary | negative | A B8 `Refund` reaches `refunded` status — assert zero automatically-created `TaxInvoice`/`CreditNote` row |
| `AT-B10REV-1` | B9 reversal boundary | negative | A `CreditNoteIssued` event is produced — assert zero write to `revenue_reversals` and zero B9 command invoked |
| `AT-B10DEAL-1` | Pipeline non-dependency | negative | A `Deal` transitions to `Won` (B6) — assert B10 consumes zero Pipeline/Deal event and creates zero `TaxInvoice` as a result; B10's consumed-event list (`B10_COMMAND_EVENT_CATALOG.md` §3) has no `Deal*` row |
| `AT-B10SEC-1` | Credential secrecy | negative | Inspect every B10 response schema and log statement for a secret-shaped field — assert none |
| `AT-B10SEC-2` | Credential secrecy | negative | Attempt to read `credential_ref`'s resolved value through any B10 API — assert never present |
| `AT-B10SEC-3` | Credential health disclosure | negative | `ValidateZatcaConfiguration` response — assert no field beyond `{configured, environment, last_verified_at}` |
| `AT-B10SEC-4` | Environment separation | negative | A `sandbox`-environment credential used against a `production`-flagged submission — assert rejected before any network call |
| `AT-B10IDEM-1` | Idempotency | positive | Two `IssueTaxInvoice` invocations for the same `source_ref` (redelivered event) — assert exactly one `TaxInvoice` row |
| `AT-B10IDEM-2` | Idempotency | positive | `RetryTaxSubmission` invoked twice for the same `tax_invoice_id`/attempt scope — assert one new `tax_submissions` row per genuinely distinct attempt, zero duplicate `TaxInvoice` |
| `AT-B10IDEM-3` | Idempotency | positive | `CreateCreditNote` replayed under the identical `Idempotency-Key` — assert the identical response is returned, not a second note |
| `AT-B10CONC-1` | Concurrency | negative | Two concurrent `IssueTaxInvoice` attempts for the same `source_ref` — assert exactly one commits, the other no-ops against the partial unique index |
| `AT-B10CONC-2` | Concurrency | negative | `CancelTaxInvoice` racing `SubmitTaxDocumentForProcessing` on the same row — assert deterministic winner via row lock + `version`, never a torn state |
| `AT-B10RBAC-1` | RBAC | negative | Manager/Sales/Member/Viewer each denied every B10 command (`403 PERMISSION_DENIED`) |
| `AT-B10RBAC-2` | RBAC — applicability privilege | negative | Admin (holding `tax.manage` but not `tax.applicability.manage`) attempts `SetTaxApplicability` — denied; only Owner may call it |
| `AT-B10TEN-1` | Tenancy | negative | A cross-workspace `TAX-*` reference — resolves `404 ENTITY_NOT_FOUND`, byte-identical to a genuinely nonexistent id |
| `AT-B10DT-1` | Dual-track | positive | Construct a `TaxInvoice` for a workspace with zero `DiscoveryJob`/Maps-`Business` rows — assert identical successful behavior to a Discovery-acquired workspace's equivalent |
| `AT-B10B8-1` | B8 write firewall | negative | A B10 command, column, or endpoint writing to any B8-owned table — fails |
| `AT-B10B8-2` | B8 event boundary | negative | A `PaymentSucceeded` event triggering `IssueTaxInvoice` directly — fails; no such consumer path exists |
| `AT-B10B8-3` | B8 refund event boundary | negative | A B8 refund event triggering automatic `CreateCreditNote` — fails; no such consumed event exists in B8's frozen catalog |
| `AT-B10B9-1` | B9 write firewall | negative | A B10 command, column, or endpoint computing or writing `gross`/`net`/`recognized_at` — fails |
| `AT-B10B9-2` | B9 reversal equivalence | negative | `CreditNoteIssued` creating a `revenue_reversals` row — fails (duplicate assertion of `AT-B10REV-1` from the boundary-document side, retained for direct traceability to `B10_B9_FINANCE_BOUNDARY.md` §6) |
| `AT-B10B9-3` | Non-equivalence, both directions | negative | A `RevenueEvent` existing implying a `TaxInvoice` exists, or a `TaxInvoice` existing implying a `RevenueEvent` exists — both fail, verified independently |
| `AT-B10B9-4` | No statutory compliance claim | negative | Any B10 document asserting IFRS/statutory-accounting compliance — fails; grep-verified across the full pack (`B10_VERIFICATION_MATRIX.md`) |
| `AT-B10B9-5` | B9 write firewall (table-level) | negative | A B10 write path to `revenue_events`, `revenue_reversals`, or `attribution_touchpoints` — fails, verified by the same structural-unreachability method `B8_RBAC_TENANCY.md` §5 established |
| `AT-B10CLASS-1` | ZATCA classification routing | positive | A `standard_invoice` routes to clearance |
| `AT-B10CLASS-2` | ZATCA classification routing | positive | A `simplified_invoice` routes to reporting |
| `AT-B10CLASS-3` | ZATCA classification routing | positive | A `credit_note` referencing a `standard`-classified original inherits `standard` and routes to clearance |
| `AT-B10CLASS-4` | ZATCA classification routing | positive | A `debit_note` referencing a `standard`-classified original inherits `standard` and routes to clearance |
| `AT-B10CLASS-5` | ZATCA classification routing | positive | A `credit_note` referencing a `simplified`-classified original inherits `simplified` and routes to reporting |
| `AT-B10CLASS-6` | ZATCA classification routing | positive | A `debit_note` referencing a `simplified`-classified original inherits `simplified` and routes to reporting |
| `AT-B10CLASS-7` | ZATCA classification routing | negative | `AT-B10CLASS-3`'s `credit_note`-on-`standard` case routes to **clearance**, not reporting — explicitly refutes the pre-`B10-FIX.1` "credit note ⇒ reporting" assumption |
| `AT-B10CLASS-8` | ZATCA classification routing | negative | `AT-B10CLASS-6`'s `debit_note`-on-`simplified` case routes to **reporting**, not clearance — explicitly refutes the pre-`B10-FIX.1` "debit note ⇒ clearance" assumption |
| `AT-B10CLASS-9` | ZATCA classification routing | negative | `TaxNoteCreate`'s schema exposes no `invoice_classification` (or `currency`) input field — a client has no code path through which to supply a value conflicting with the inherited classification (or currency) |
| `AT-B10RND-1` | Tax rounding | positive | Three lines in one category (`standard`, 15%), each `line_subtotal=0.10` — category-subtotal method yields `tax_invoices.tax_amount = 0.05` (`ROUND(0.30 × 0.15, 2)`), **not** `0.06` (the superseded sum-of-independently-rounded-lines result: `3 × ROUND(0.10 × 0.15, 2) = 3 × 0.02`) |
| `AT-B10RND-2` | Tax rounding | positive | A category taxable amount of `6.70` at 15% (`= 1.005`) rounds half-up to `1.01`, not `1.00` — asserts the specified rounding mode, not banker's/round-half-to-even |
| `AT-B10RND-3` | Tax rounding | positive | Two categories on one invoice — `standard` (taxable `100.00` → tax `15.00`) and `zero_rated` (taxable `50.00` → tax `0.00`) — `tax_invoices.tax_amount = 15.00`, the sum of the two already-rounded category amounts, never re-rounded at the document level |
| `AT-B10RND-4` | Tax rounding | positive | For any `TaxInvoice` produced by `AT-B10RND-1`/`3`, `tax_invoices.total = tax_invoices.subtotal + tax_invoices.tax_amount` holds exactly (DB `CHECK`) |
| `AT-B10BL-1` | Unknown-mode backlog | positive | The same `InvoiceIssued` event delivered twice while `zatca_applicability=unknown` produces exactly one `PendingTaxDocumentClassification` row |
| `AT-B10BL-2` | Unknown-mode backlog | positive | `unknown → not_applicable`: a pending item resolves exactly once, to `resolved_not_applicable`, with zero `TaxInvoice` created |
| `AT-B10BL-3` | Unknown-mode backlog | positive | `unknown → applicable_not_enabled`: a pending item resolves to `resolved_for_issuance`, a `TaxInvoice` is created and stored, and zero network/submission call is ever made |
| `AT-B10BL-4` | Unknown-mode backlog | positive | `unknown → enabled`: a pending item resolves to `resolved_for_issuance` and the resulting `TaxInvoice` proceeds through the normal `SubmitTaxDocumentForProcessing` workflow exactly once — zero duplicate `TaxInvoice` |
| `AT-B10BL-5` | Unknown-mode backlog | negative | Two concurrent `ResolvePendingTaxClassification` attempts on the same item (scheduled sweep + manual operator trigger) produce exactly one effect, never two |
| `AT-B10BL-6` | Unknown-mode backlog | positive | After resolution, a backlog row's original fields (`source_ref`, `received_at`, `workspace_id`) remain unchanged and a `TaxClassificationResolved` audit event exists — historical resolution evidence is never lost |
| `AT-B10CORR-1` | Cumulative correction consistency | positive | A single credit note of `60` against an original of `100` succeeds; `net_corrected_total = 40` |
| `AT-B10CORR-2` | Cumulative correction consistency | positive | Sequential credit notes of `60` then `40` against an original of `100` both succeed; `net_corrected_total = 0` |
| `AT-B10CORR-3` | Cumulative correction consistency | positive | A single credit note exactly equal to the original's total succeeds; `net_corrected_total = 0` |
| `AT-B10CORR-4` | Cumulative correction consistency | negative | A third credit note attempted after `net_corrected_total` already reached `0` — rejected `409 TAX_CORRECTION_EXCEEDS_ORIGINAL`, zero row created |
| `AT-B10CORR-5` | Cumulative correction consistency | negative | Two concurrent credit notes of `60` each against a fresh original of `100` — exactly one commits, the other rejected `409 TAX_CORRECTION_EXCEEDS_ORIGINAL`; never both |
| `AT-B10CORR-6` | Cumulative correction consistency | positive | A debit note of `+50` against an original of `100` widens `net_corrected_total` to `150`; a subsequent credit note of `120` then succeeds (would have been rejected against the original `100` alone) |
| `AT-B10CORR-7` | Cumulative correction consistency | negative | `TaxNoteCreate`'s schema exposes no `currency` input field — a note's currency is always inherited from its reference, never independently supplied or mismatched |

`ACCEPTANCE_TEST_COUNT` (distinct IDs in the table above): `LE(2) + APP(5) + ZAT(6) + INV(3) + CN(2) + NUM(2) + REF(1) + REV(1) + DEAL(1) + SEC(4) + IDEM(3) + CONC(2) + RBAC(2) + TEN(1) + DT(1) + B8(3) + B9(5) + CLASS(9) + RND(4) + BL(6) + CORR(7) = 70` (`B10-FIX.1` adds `CLASS`, `RND`, `BL`, `CORR` — 26 new tests).

## 2. Categories

`ACCEPTANCE_CATEGORY_COUNT` — `COUNT(DISTINCT Category)` over §1's `Category` column, the same authoritative method `B8_ACCEPTANCE_TESTS.md` established (never a separately hand-authored summary table, avoiding that pack's own original mistake): Legal Entity; Applicability; ZATCA submission authority; ZATCA phase mapping; ZATCA fail-closed; ZATCA credential gate; Invoice model; Invoice ≠ commercial Invoice; Immutability; Credit note structure; Credit note immutability; Numbering; B8 refund boundary; B9 reversal boundary; Pipeline non-dependency; Credential secrecy; Credential health disclosure; Environment separation; Idempotency; Concurrency; RBAC; RBAC — applicability privilege; Tenancy; Dual-track; B8 write firewall; B8 event boundary; B8 refund event boundary; B9 write firewall; B9 reversal equivalence; Non-equivalence, both directions; No statutory compliance claim; B9 write firewall (table-level); **ZATCA classification routing** (new); **Tax rounding** (new); **Unknown-mode backlog** (new); **Cumulative correction consistency** (new) = **36** distinct values (`B10-FIX.1` adds 4).

## 3. Negative controls

Counted directly from the Positive/Negative column: `APP-2, APP-3` (2); `ZAT-1, ZAT-2, ZAT-5, ZAT-6` (4); `INV-3` (1); `CN-2` (1); `REF-1` (1); `REV-1` (1); `DEAL-1` (1); `SEC-1..4` (4); `CONC-1, CONC-2` (2); `RBAC-1, RBAC-2` (2); `TEN-1` (1); `B8-1..3` (3); `B9-1..5` (5); `CLASS-7..9` (3); `BL-5` (1); `CORR-4, CORR-5, CORR-7` (3). Sum: `2+4+1+1+1+1+1+4+2+2+1+3+5+3+1+3 = 35`.

`DUPLICATE_ACCEPTANCE_TESTS = 0` — every `AT-*` ID above is unique.

## 4. Class-A-to-evidence traceability

Every `B10-D-A0##` decision in `B10_DECISION_REGISTER.md` cites at least one test ID above in its own "acceptance evidence" field — cross-checked in `B10_VERIFICATION_MATRIX.md` §2.

```
ACCEPTANCE_TEST_COUNT = 70
ACCEPTANCE_CATEGORY_COUNT = 36
NEGATIVE_CONTROL_COUNT = 35
DUPLICATE_ACCEPTANCE_TESTS = 0
```
