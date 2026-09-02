# B10 — Verification Matrix

> Mechanical self-verification. Counts below are computed against the actual authored files via direct grep, not estimated — including a re-check of this document itself, per brief §58's explicit instruction not to exempt the verifier from its own sweeps (a lesson this corpus's own B9 pack learned the hard way, `B9-FIX.2a`).
>
> **`B10-FIX.1` applied.** A fresh independent CTO verification of the original pass returned `B10 FRESH INDEPENDENT CTO VERIFICATION = FAIL` — 1 CRITICAL, 3 MAJOR, 4 MINOR. Every finding is remediated below; this document's counters are recomputed against the post-fix state, not carried forward. See §10 for the itemized repair record.
>
> **`B10-FIX.1a` applied.** A fresh independent countersign of `B10-FIX.1` returned `PASS` with exactly one `MINOR` finding (`B10-CS-1`): the new-error-code table in `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1 listed 12 rows while this document and four others claimed `ERROR_NEW_COUNT = 11`, and the `TAX_VALIDATION_FAILED` row's own text disclaimed itself in favor of the already-frozen `TAX_VALIDATION_REQUIRED`. Remediated by deleting the redundant row; see §11 for the itemized repair record.

## 1. Document pack

`B10_DOCUMENT_COUNT = 35` — unchanged under `B10-FIX.1` (a targeted repair, no document added or removed) — 34 documents from the required list in `BACKEND_DOCUMENTATION_INDEX.md`'s B10 package map, plus this document, mechanically counted via filesystem listing.

## 2. Decision-reference integrity

Every `B10-D-[A|B|C][0-9]+` ID appearing in any document (grepped across the full pack) resolves to exactly one defining row in `B10_DECISION_REGISTER.md`: `A001`–`A022` (22, sequential, no gaps — `B10-FIX.1` adds `A021`, `A022`), `B001`–`B008` (8, `B10-FIX.1` adds `B008`), `C001`–`C004` (4, unchanged). `UNDEFINED_DECISION_REFS = 0`.

Every `AT-B10[A-Za-z0-9-]*` ID appearing in any document resolves to a defined row in `B10_ACCEPTANCE_TESTS.md` §1, with one deliberate exception: `AT-B10-1`…`5`, cited in `B10_ACCEPTANCE_TESTS.md` §1's own introductory note, are **B9-authored** frozen tests living in `B9_B10_TAX_BOUNDARY.md` §8 — explicitly named as external and not duplicated, not a B10-internal reference requiring a B10 definition. `UNDEFINED_AT_REFS = 0` (re-verified against the 70-row post-`B10-FIX.1` table, including the new `CLASS`/`RND`/`BL`/`CORR` prefixes).

Every `B10-X-[0-9]+`/`B10-X-OWNER-EXEMPTION` ID resolves to a row in `B10_RESEARCH_REGISTER.md` (16 numbered facts + 1 named item, all 17 verified present — `B10-FIX.1` adds `014`, `015`, `016`).

Every `FB-B10-[0-9]+` ID resolves to a row in `B10_FRONTEND_BEHAVIOR_INVENTORY.md` §§3–6 (6 IDs: `001`–`006`, unchanged — `B10-FIX.1` is a backend/regulatory repair and touches no frontend-evidence claim). `CITED_FB_IDS`: `{001}` — a strict subset of `DEFINED_FB_IDS`. `BROKEN_FRONTEND_REFS = 0`. `DUPLICATE_FB_ID_DEFINITIONS = 0` (each ID defined in exactly one row).

Every `B10-AM-[0-9]+` ID resolves to a row in `B10_CONTROLLED_AMENDMENTS.md` (`001`–`008`, `B10-FIX.1` adds `008`); no other document cites an amendment ID directly (each instead cites the underlying `B10-D-*` decision, the correct layering per the corpus's own convention). `BROKEN_AMENDMENT_REFS = 0`. `SEMANTICALLY_WRONG_AMENDMENT_REFS = 0` — each amendment's `FROZEN_TEXT/SEMANTIC` cell was copied from a direct grep of the named frozen source file during authoring, not paraphrased from memory (`B10-AM-008`'s `B1_API_DTO_CONTRACTS.md` quotation was re-verified by direct grep during `B10-FIX.1` authoring).

## 3. Cross-document reference integrity

`BROKEN_CROSS_DOCUMENT_REFS = 0` — every `B10_<NAME>.md` citation resolves to one of the 35 files in this pack. One grep artifact was caught and verified during authoring: a naive `grep -oE 'B10_[A-Z_]+\.md'` incorrectly appears to match "`B10_TAX_BOUNDARY.md`" inside the substring of `B9_B10_TAX_BOUNDARY.md` (a real, correctly-cited **B9**-owned file, prefixed `B9_`, read directly at the start of this authoring pass) — every such occurrence was individually re-inspected and confirmed to be a citation of the real `B9_B10_TAX_BOUNDARY.md`, never a reference to a nonexistent `B10_TAX_BOUNDARY.md`. No document cites a filename outside the 35-file list.

## 4. Revenue/authority false-positive guard

Every occurrence of "revenue" across the pack appears either inside a negative statement (never/does not/zero/no such field) or a direct quotation of pre-existing frozen text (`B9_B10_TAX_BOUNDARY.md`) stating the same negative. `REVENUE_EVENT_PRODUCERS_IN_B10 = 0`.

## 5. Entitlement-applicability semantic contradiction scan (brief §37)

Grepped the full pack for every applicability-related term (`zatca_applicability`, `TaxProfile`, `unknown`, `not_applicable`, `applicable_not_enabled`, `enabled`, `suspended`) and read each hit in context:

| Gate | Value | Basis |
|---|---:|---|
| `UNKNOWN_APPLICABILITY_DEFAULTS_TO_EXEMPT` | 0 | `B10_TAX_APPLICABILITY_MODEL.md` §3 explicitly states `unknown` never behaves as `not_applicable`; `AT-B10APP-2` asserts it |
| `UNKNOWN_APPLICABILITY_DEFAULTS_TO_ENABLED` | 0 | same section, same test, opposite direction explicitly stated and tested |
| `ZATCA_REQUIRED_WHEN_NOT_APPLICABLE` | 0 | `B10_INVOICE_MODEL.md` §4's applicability table: `not_applicable` → zero `TaxInvoice` rows, zero credential requirement (`B10_OBSERVABILITY.md` §5, health checks never fail on dormant ZATCA) |
| `ZATCA_BYPASS_WHEN_APPLICABLE` | 0 | `B10_ZATCA_BOUNDARY.md` §5/§7: submission is gated on `enabled` specifically, never bypassed by `applicable_not_enabled`'s generate-only posture pretending to be complete |
| `OVERRIDE_PLAN_CHANGE_RULE_DEFINED`-equivalent (`OVERRIDE_PLAN_CHANGE_RULE_DEFINED` doesn't apply to B10 — no override concept exists here; the analogous gate is applicability-change non-retroactivity) | 1 (defined) | `B10_TAX_APPLICABILITY_MODEL.md` §5, `B10-D-A008`, `AT-B10APP-4` |
| `ZATCA_CLEARANCE_REPORTING_MAPPING_GAPS` (new, `B10-FIX.1`) | 0 | `B10_ZATCA_BOUNDARY.md` §3 corrected — routing keyed solely on `invoice_classification`, grepped for every remaining `document_kind`/`document_type` occurrence near "clearance"/"reporting" to confirm none survives as a routing input; `AT-B10CLASS-1`…`9` |
| `DOCUMENT_CLASSIFICATION_AMBIGUITIES` (new, `B10-FIX.1`) | 0 | `B10_CREDIT_NOTE_MODEL.md` §1 — all four `(document_kind × invoice_classification)` combinations for notes are explicitly representable and correctly routed; no combination is left undefined |
| `UNKNOWN_MODE_IMPLEMENTATION_GAPS` (new, `B10-FIX.1`) | 0 | `B10_STORAGE_MODEL.md` `pending_tax_document_classifications`, `B10_COMMAND_EVENT_CATALOG.md` `ResolvePendingTaxClassification`, `B10_IDEMPOTENCY_CONCURRENCY.md` §5 — durable table, states, idempotency, and resolution algorithm all specified |

No document anywhere in the pack states or implies that a missing/absent `TaxProfile` row should be read as either exemption or full applicability — `LegalEntity` bootstrap always creates the initial `unknown` row in the same transaction (`B10_TAX_APPLICABILITY_MODEL.md` §2), so this state is structurally unreachable, not merely undocumented.

## 6. Frozen regression gates

| Gate | Value | Basis |
|---|---:|---|
| `B0_DRIFT`–`B9_DRIFT` | 0 each | working tree shows only `Docs/backend/B10/` (untracked) and `BACKEND_DOCUMENTATION_INDEX.md` (modified, additive-only per §7 below) — verified via `git status --porcelain` during authoring; zero B0–B9 file touched |
| `FRONTEND_DRIFT` | 0 | zero frontend file modified; `B10_FRONTEND_BEHAVIOR_INVENTORY.md` §1 confirms the frozen reference SHA unchanged against current HEAD |
| `DIRECT_CRM_WRITE_LEAKS` / `DIRECT_DISCOVERY_WRITE_LEAKS` / `DIRECT_INTELLIGENCE_WRITE_LEAKS` / `DIRECT_MESSAGING_WRITE_LEAKS` / `DIRECT_PIPELINE_WRITE_LEAKS` / `DIRECT_AUTOMATION_WRITE_LEAKS` | 0 each | `B10_RBAC_TENANCY.md` §6 firewall proof — B10's app layer holds no repository reference to any of these tables |
| `B8_PAYMENT_AUTHORITY_LEAKS` | 0 | `B10_B8_BILLING_BOUNDARY.md` §2, §6 |
| `B9_REVENUE_AUTHORITY_LEAKS` | 0 | `B10_B9_FINANCE_BOUNDARY.md` §6 |
| `INVOICE_REVENUE_EQUIVALENCE_LEAKS` | 0 | `B10_B9_FINANCE_BOUNDARY.md` §2 table |
| `CREDIT_NOTE_REVENUE_REVERSAL_EQUIVALENCE_LEAKS` | 0 | `B10_CREDIT_NOTE_MODEL.md` §3 |
| `REFUND_CREDIT_NOTE_EQUIVALENCE_LEAKS` | 0 | `B10_CREDIT_NOTE_MODEL.md` §2 |
| `CROSS_WORKSPACE_TAX_LEAKS` | 0 | `B10_RBAC_TENANCY.md` §5, Doctrine R-1/R-2 |
| `DUPLICATE_INVOICE_PATHS` | 0 | `B10_IDEMPOTENCY_CONCURRENCY.md` §1–3 |
| `DUPLICATE_TAX_SUBMISSION_PATHS` | 0 | `B10_ZATCA_FAILURE_RETRY_MODEL.md` §3, §6 |
| `SECRET_EXPOSURE_PATHS` | 0 | `B10_ZATCA_SECURITY_CREDENTIALS.md` §7 |
| `HISTORICAL_TAX_MUTATION_PATHS` | 0 | `B10-D-A006`/`A008`, `AT-B10APP-4`, `AT-B10INV-3` — extended to `invoice_classification`'s own immutability under `B10-FIX.1`, `B10_STORAGE_MODEL.md` |
| `DURABLE_UNIQUENESS_GAPS` (new, `B10-FIX.1`) | 0 | `tax_submissions` now carries `UNIQUE(tax_invoice_id, attempt_number)` (§`B10_STORAGE_MODEL.md`), closing the pre-FIX.1 gap where attempt-number allocation rested on the idempotency-key layer alone |
| `LEGAL_SEQUENCE_AMBIGUITIES` (new, `B10-FIX.1`) | 0 | `legal_sequence_number` is now explicitly a WazLink product/legal field, not asserted to be ZATCA's ICV (`B10_INVOICE_MODEL.md` §3, `B10-D-A017` corrected, `B10-D-B008` new) |
| `OVER_CORRECTION_GAPS` (new, `B10-FIX.1`) | 0 | `net_corrected_total ≥ 0` invariant, row-lock enforced (`B10_CREDIT_NOTE_MODEL.md` §6, `B10-D-A021`) |
| `MISSING_CONTROLLED_AMENDMENTS` (new, `B10-FIX.1`) | 0 | `B10-AM-008` now registers the `B1_API_DTO_CONTRACTS.md` `CONFLICT`-vocabulary extension; independently re-swept for any further omission (none found) |
| `IMPLEMENTATION_LEAKAGE` | 0 | zero `.py`/migration file created (filesystem-verified) |
| `B11_FILES_CREATED` / `B12_FILES_CREATED` / `B13_FILES_CREATED` / `B14_FILES_CREATED` | 0 each | verified — none of `Docs/backend/B11`, `B12`, `B13`, `B14` exists |

## 7. Documentation index change scope

`BACKEND_DOCUMENTATION_INDEX.md` was modified **additively only**: the B10 section was inserted immediately before "## Required next-phase gate," with zero line removed or altered inside any B0–B9 section — verified by re-reading the diff during authoring and confirming it contains only insertion lines. `INDEX_CHANGE = additive B10-only`.

## 8. Mechanical counter recount (independent of any single document's own self-report; recomputed post-`B10-FIX.1`)

| Counter | Value | Recount method |
|---|---:|---|
| `FRONTEND_BEHAVIOR_COUNT` / `A`/`B`/`C`/`D` | 6 / 2 / 1 / 1 / 2 | row count per class table in `B10_FRONTEND_BEHAVIOR_INVENTORY.md` §§3–6 (unchanged — no frontend-evidence claim touched by this fix) |
| `OWNED_ENTITY_COUNT` | 7 | table row count, `B10_STORAGE_MODEL.md` (`B10-FIX.1` adds `pending_tax_document_classifications`) |
| `REFERENCED_ENTITY_COUNT` | 8 | table row count, `B10_SCOPE_AND_OWNERSHIP.md` §4 (unchanged) |
| `STATE_MACHINE_COUNT` / `STATE_COUNT` | 4 / 18 | `B10_INVOICE_STATE_MACHINE.md` (5+4+5, unchanged) **plus** the new `PendingTaxDocumentClassification` state machine (4 states: `pending`, `resolved_not_applicable`, `resolved_for_issuance`, `cancelled`) — `B10-FIX.1` adds a fourth machine, closing the gap where the backlog's states existed only in the storage `CHECK` constraint, not as a named machine |
| `COMMAND_COUNT` | 10 | table row count, `B10_COMMAND_EVENT_CATALOG.md` §1 (`B10-FIX.1` adds `ResolvePendingTaxClassification`) |
| `PRODUCED_EVENT_COUNT` | 10 | table row count, §2 (`B10-FIX.1` adds `TaxClassificationDeferred`, `TaxClassificationResolved`) |
| `CONSUMED_EVENT_COUNT` | 1 | table row count, §3 (unchanged) |
| `REUSED_PERMISSION_COUNT` / `ADDITIVE_PERMISSION_COUNT` | 1 / 3 | `B10_RBAC_TENANCY.md` §1 (unchanged — the two new endpoints reuse `tax.view`/`tax.manage`) |
| `PUBLIC_API_OPERATION_COUNT` / `ADDITIVE_API_OPERATION_COUNT` | 13 / 13 | table row count, `B10_API_DTO_CONTRACTS.md` §1 (`B10-FIX.1` adds the two backlog operations) |
| `FAILURE_SCENARIO_COUNT` | 23 | `BF1`–`BF23`, `B10_FAILURE_CATALOG.md` §3, no gap/duplicate (`B10-FIX.1` adds `BF21`–`BF23`) |
| `ACCEPTANCE_TEST_COUNT` | 70 | distinct `AT-*` row count, `B10_ACCEPTANCE_TESTS.md` §1 (`B10-FIX.1` adds 26: `CLASS`×9, `RND`×4, `BL`×6, `CORR`×7) |
| `ACCEPTANCE_CATEGORY_COUNT` | 36 | `COUNT(DISTINCT Category)` over the same table, listed explicitly in §2 (`B10-FIX.1` adds 4 categories) |
| `NEGATIVE_CONTROL_COUNT` | 35 | Positive/Negative column tally, §3 (`B10-FIX.1` adds 7) |
| `CLASS_A_DEFINED`/`B`/`C` | 22 / 8 / 4 | row counts, `B10_DECISION_REGISTER.md` (`B10-FIX.1` adds `A021`/`A022`, `B008`) |
| `CONTROLLED_AMENDMENT_COUNT` / `ADDITIVE` / `COMPATIBLE_CLARIFICATION` / `NON_ADDITIVE` | 8 / 7 / 1 / 0 | `B10_CONTROLLED_AMENDMENTS.md` (`B10-FIX.1` adds `#8`) |
| `RESEARCH_FACT_COUNT` / `VERIFIED` / `PARTIAL` / `UNRESOLVED` / `CONTRADICTED` | 16 / 2 / 10 / 3 / 1 | `B10_RESEARCH_REGISTER.md` §1 (`B10-FIX.1` adds `014`–`016`; `011` moves to `CONTRADICTED`) |
| `ERROR_NEW_COUNT` | 11 | `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1 (`B10-FIX.1` adds `TAX_CORRECTION_EXCEEDS_ORIGINAL`; `B10-FIX.1a` removes the redundant `TAX_VALIDATION_FAILED` row, `B10-CS-1` — table row count mechanically re-verified as exactly 11 during this pass) |

`STALE_COUNTERS = 0` — every value above was recomputed directly from its source table's row count during this `B10-FIX.1` authoring pass, none carried forward from the pre-fix draft; this document (the checker) was itself re-swept last, per the corpus's own `B9-FIX.2a` lesson about not exempting the verifier from its own sweeps.

## 9. Findings (post-`B10-FIX.1` self-check)

`CRITICAL_FINDINGS = 0`, `MAJOR_FINDINGS = 0`, `MINOR_FINDINGS = 0`, `INFO_FINDINGS = 0` from this self-check, against the corrected state. This self-check cannot itself substitute for the independent verification that found the issues §10 records — a fresh independent CTO countersign is still required before `B10_VERIFICATION` can mean more than "internally consistent by mechanical grep." **This caveat proved true in practice**: the fresh independent countersign this self-check called for did find one `MINOR` defect this mechanical sweep missed (`B10-CS-1`, §11) — the `ERROR_NEW_COUNT` row count itself, ironically the kind of thing this section claims to check.

## 10. `B10-FIX.1` repair record

A fresh independent CTO verification of the pre-`B10-FIX.1` pack returned `FAIL` with 1 CRITICAL, 3 MAJOR, and 4 MINOR findings. Each is remediated as follows:

| ID | Severity | Finding | Repair |
|---|---|---|---|
| `B10-AUDIT-C1` | CRITICAL | ZATCA clearance/reporting routing keyed on credit-vs-debit note type (`standard_invoice`/`debit_note`→clearance, `simplified_invoice`/`credit_note`→reporting) rather than the document's standard/simplified classification — contrary to independently-researched evidence, and unsupported by any cited research fact | Split `document_type` into independent `document_kind` (invoice/credit/debit) and `invoice_classification` (standard/simplified) columns; routing now keyed solely on `invoice_classification`; notes inherit classification immutably from their reference, never independently settable (`B10_ZATCA_BOUNDARY.md` §3, `B10_INVOICE_MODEL.md` §1a, `B10_DOMAIN_MODEL.md` §3, `B10-D-A004`/`A018` corrected, `AT-B10CLASS-1`…`9`) |
| `B10-AUDIT-M1` | MAJOR | `applicability_transition_conflict` extends B1's closed `CONFLICT` reason vocabulary without a registered controlled amendment | `B10-AM-008` registered against `B1_API_DTO_CONTRACTS.md` (`B10_CONTROLLED_AMENDMENTS.md`) |
| `B10-AUDIT-M2` | MAJOR | The `unknown`-mode pending-classification backlog existed only as prose ("a queryable list of pairs"), with no owning table, command, state model, or idempotency rule | New `PendingTaxDocumentClassification` aggregate (`pending_tax_document_classifications` table, four states, durable `(source_type, source_ref)` uniqueness), new `ResolvePendingTaxClassification` command, two new events, dedicated idempotency/concurrency section (`B10_STORAGE_MODEL.md`, `B10_TAX_APPLICABILITY_MODEL.md` §3, `B10_COMMAND_EVENT_CATALOG.md` §1, `B10_IDEMPOTENCY_CONCURRENCY.md` §5, `B10-D-A022`, `AT-B10BL-1`…`6`) |
| `B10-AUDIT-M3` | MAJOR | Tax rounding decided as per-line-rounded-then-summed, contradicting the official ZATCA XML Implementation Standard's document/category-level rounding rule | Corrected to a five-level algorithm: VAT rounded once per `(tax_category, tax_rate)` subtotal, document total is the sum of already-rounded category amounts (`B10_CURRENCY_MONEY_ROUNDING.md` §3, `B10_TAX_CALCULATION_MODEL.md` §6, `B10_INVOICE_MODEL.md` §2, `B10-X-011` re-adjudicated `CONTRADICTED`, `B10-X-016` added, `AT-B10RND-1`…`4`) |
| `B10-AUDIT-N1` | MINOR | `legal_sequence_number` implied to be ZATCA's Invoice Counter Value, which is actually scoped per EGS unit/device, not per legal entity | `legal_sequence_number` re-scoped as a WazLink product/legal field, explicitly not the ICV; EGS-unit/production-CSID aggregate recorded as deferred (`B10_INVOICE_MODEL.md` §3, `B10-D-A017` corrected, `B10-D-B008` new, `B10-X-009`/`015`) |
| `B10-AUDIT-N2` | MINOR | Retry-budget citation used the generic "Payment pending" `BACKEND_RETRY_POLICY.md` row instead of the directly on-point "ZATCA unavailable" row already frozen there | Citation corrected in both `B10_ZATCA_FAILURE_RETRY_MODEL.md` §5 and `B10_RECONCILIATION_MODEL.md` §6; the number `8` explicitly labeled WazLink internal policy, not a ZATCA mandate |
| `B10-AUDIT-N3` | MINOR | `tax_submissions` had no DB-level unique constraint on `(tax_invoice_id, attempt_number)`, resting attempt-allocation race-safety on the idempotency-key layer alone | `UNIQUE(tax_invoice_id, attempt_number)` added (`B10_STORAGE_MODEL.md`) |
| `B10-AUDIT-N4` | MINOR | No bound on cumulative credit/debit note amounts against their original; over-correction unexamined | `net_corrected_total ≥ 0` invariant, row-lock enforced, new `409 TAX_CORRECTION_EXCEEDS_ORIGINAL` code, netted credit/debit arithmetic (`B10_CREDIT_NOTE_MODEL.md` §6, `B10-D-A021`, `AT-B10CORR-1`…`7`) |

Every fix above is a targeted repair, not a redesign: zero B0–B9 file touched, zero frontend file touched, zero new document created, `MISSING_CONTROLLED_AMENDMENTS = 0`, `NON_ADDITIVE_AMENDMENTS = 0`.

## 11. `B10-FIX.1a` repair record

A fresh independent countersign of `B10-FIX.1` returned `PASS` with exactly one `MINOR` finding, `B10-CS-1`:

| ID | Severity | Finding | Repair |
|---|---|---|---|
| `B10-CS-1` | MINOR | `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1's new-error-code table listed 12 distinct code rows (`TAX_APPLICABILITY_UNKNOWN`, `TAX_CONFIGURATION_MISSING`, `ZATCA_CREDENTIAL_INVALID`, `ZATCA_CERTIFICATE_EXPIRED`, `TAX_VALIDATION_FAILED`, `ZATCA_SUBMISSION_REJECTED`, `ZATCA_PROVIDER_UNAVAILABLE`, `ZATCA_TIMEOUT`, `ZATCA_RATE_LIMITED`, `TAX_DUPLICATE_SUBMISSION`, `TAX_DOCUMENT_STATE_CONFLICT`, `TAX_CORRECTION_EXCEEDS_ORIGINAL`) while this document, `B10_FAILURE_CATALOG.md`, `B10_CONTROLLED_AMENDMENTS.md`, and `B10_IMPLEMENTATION_READINESS.md` all stated `ERROR_NEW_COUNT = 11`. Separately, the `TAX_VALIDATION_FAILED` row's own meaning text said the scenario it named was actually handled by reusing the already-frozen `TAX_VALIDATION_REQUIRED` (`BACKEND_ERROR_CATALOG.md`, 422, "missing official tax contract/field") "rather than minting a duplicate" — the row disclaimed itself | Verified `TAX_VALIDATION_REQUIRED`'s frozen semantics directly against `BACKEND_ERROR_CATALOG.md` (422, missing official tax contract/field) and confirmed them equivalent to `TAX_VALIDATION_FAILED`'s stated scenario (B10's own pre-submission structural/field-completeness validation) — no HTTP-status, retry-semantic, or operation-scope difference exists between the two. Deleted the `TAX_VALIDATION_FAILED` row entirely; the new-code table now contains exactly 11 rows, matching `ERROR_NEW_COUNT = 11` mechanically rather than by assertion. Updated the counting/summary text in `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1, `B10_FAILURE_CATALOG.md` §2, `B10_CONTROLLED_AMENDMENTS.md` item 4, `B10_IMPLEMENTATION_READINESS.md` §4, and this document's §8/§9. `BACKEND_ERROR_CATALOG.md` (frozen) was not modified — B10 continues to reference/reuse `TAX_VALIDATION_REQUIRED` verbatim, exactly as before. No controlled amendment was added or altered (removing an unminted, uncommitted duplicate from the authoring pack is not itself a frozen-contract change); `CONTROLLED_AMENDMENT_COUNT` remains `8` (`7` additive, `1` compatible clarification, `0` non-additive). No acceptance test referenced `TAX_VALIDATION_FAILED` (confirmed by full-pack grep before and after), so `B10_ACCEPTANCE_TESTS.md` required no change. No B0–B9 file touched, no frontend file touched, no architecture/regulatory/backend/frontend content touched — targeted error-catalog hygiene only |

`TAX_VALIDATION_FAILED_LIVE_REFS = 0` (full-pack grep post-repair). `ERROR_NEW_COUNT` is now `11` both as reported and as the actual row count of its own source table — `STALE_COUNTERS = 0`, `FALSE_VERIFICATION_CLAIMS = 0` for this counter.

## `B10_VERIFICATION = PASS` (self-check only, against the `B10-FIX.1a`-corrected state; independent countersign of `B10-FIX.1a` still required for the customary fresh-eyes confirmation)
