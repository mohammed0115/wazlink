# B10 — Implementation Readiness

> `IMPLEMENTATION_HANDOFF = PASS` (recomputed after `B10-FIX.1`). No coding is authorized by this pack — this document evaluates whether a later implementation agent could act on it without inventing a Class-A decision. A fresh independent CTO verification of the pre-`B10-FIX.1` state found this line falsely `PASS` (1 CRITICAL, 3 MAJOR) — see `B10_VERIFICATION_MATRIX.md` §10 for the itemized repair record this pass closes. A subsequent fresh independent countersign of `B10-FIX.1` found one further `MINOR` documentation-hygiene defect (`B10-CS-1`, an error-code table/counter mismatch) — remediated under `B10-FIX.1a`, see `B10_VERIFICATION_MATRIX.md` §11.

## 1. Handoff checklist

| Area | Answer | Evidence |
|---|---|---|
| Entity ownership | closed | `B10_SCOPE_AND_OWNERSHIP.md`, `B10_STORAGE_MODEL.md` |
| Legal entity / tax profile scope | closed — platform-scoped, not workspace-scoped | `B10_LEGAL_ENTITY_TAX_PROFILE.md`, `B10-D-A001` |
| Applicability states and default | closed — five states, `unknown` default | `B10_TAX_APPLICABILITY_MODEL.md`, `B10-D-A002` |
| Unknown-applicability fail-safe behavior | closed — commerce unaffected, issuance deferred to backlog | `B10_TAX_APPLICABILITY_MODEL.md` §3, `B10-D-A003` |
| Invoice vs. TaxInvoice | closed — separate, TaxInvoice only under `applicable_*` | `B10_B8_BILLING_BOUNDARY.md`, `B10-D-A005` |
| Invoice/note document model | closed — one table, four document types | `B10_INVOICE_MODEL.md`, `B10-D-A004` |
| Invoice immutability | closed | `B10_INVOICE_STATE_MACHINE.md` §1, `B10-D-A006` |
| Tax snapshot timing | closed — at issuance, from pinned `tax_profile_version_id` | `B10_LEGAL_ENTITY_TAX_PROFILE.md` §3, `B10-D-A007` |
| Retroactive rewrite on applicability change | closed — never | `B10_TAX_APPLICABILITY_MODEL.md` §5, `B10-D-A008` |
| Refund → credit note relationship | closed — always manual, never automatic | `B10_CREDIT_NOTE_MODEL.md` §2, `B10-D-A009` |
| Credit note → revenue reversal relationship | closed — always B9's own decision, never automatic | `B10_CREDIT_NOTE_MODEL.md` §3, `B10-D-A010` |
| Credit/debit note classification (`B10-FIX.1`) | closed — inherited immutably from the referenced original, never independently chosen, never client-suppliable | `B10_INVOICE_MODEL.md` §1a, `B10-D-A004` (corrected) |
| ZATCA clearance/reporting routing (`B10-FIX.1`) | closed — keyed solely on `invoice_classification`, never on `document_kind`/note direction | `B10_ZATCA_BOUNDARY.md` §3, `B10-D-A018` (corrected) |
| Cumulative correction bound (`B10-FIX.1`) | closed — `net_corrected_total ≥ 0`, row-lock enforced, product rule not a regulatory claim | `B10_CREDIT_NOTE_MODEL.md` §6, `B10-D-A021` (new) |
| Unknown-mode backlog durable model (`B10-FIX.1`) | closed — dedicated aggregate, four states, durable uniqueness, dedicated resolution command | `B10_STORAGE_MODEL.md`, `B10-D-A022` (new) |
| ZATCA submission authority | closed — one system command, one gate | `B10_ZATCA_BOUNDARY.md` §5, `B10-D-A011` |
| Credential ownership | closed — opaque pointer, secret store only | `B10_ZATCA_SECURITY_CREDENTIALS.md`, `B10-D-A012` |
| Idempotency | closed — business identity vs. transport identity separated | `B10_IDEMPOTENCY_CONCURRENCY.md` §1–2, `B10-D-A013` |
| Concurrency | closed — durable uniqueness, no Redis | `B10_IDEMPOTENCY_CONCURRENCY.md` §3, `B10-D-A014` |
| Future applicability activation | closed — new profile version, prospective only | `B10_TAX_APPLICABILITY_MODEL.md` §5–6, `B10-D-A015` |
| Applicability governance | closed — Owner-only permission, structurally separated | `B10_RBAC_TENANCY.md`, `B10-D-A016` |
| Invoice numbering | closed — opaque `TAX-*` + separate WazLink legal sequence number, **explicitly not** ZATCA's ICV (`B10-FIX.1` correction) | `B10_INVOICE_MODEL.md` §3, `B10-D-A017` (corrected) |
| ZATCA phase mapping | closed | `B10_ZATCA_APPLICABILITY.md`, `B10-D-A018` |
| Ambiguous outcome fail-closed rule | closed | `B10_ZATCA_FAILURE_RETRY_MODEL.md` §2, `B10-D-A019` |
| Dual-track compatibility | closed — no dependency to sever | `B10_DUAL_TRACK_COMPATIBILITY.md`, `B10-D-A020` |
| RBAC | closed, 1 reused + 3 new permissions | `B10_RBAC_TENANCY.md` |
| Tenancy | closed | `B10_RBAC_TENANCY.md` §5 |
| API/DTOs | closed | `B10_API_DTO_CONTRACTS.md` |
| Failures | closed | `B10_FAILURE_CATALOG.md` |
| Commands/Events | closed | `B10_COMMAND_EVENT_CATALOG.md` |
| B8 firewall | closed | `B10_B8_BILLING_BOUNDARY.md` |
| B9 firewall | closed | `B10_B9_FINANCE_BOUNDARY.md` |
| ZATCA adapter boundary | closed | `B10_ZATCA_BOUNDARY.md` |
| Tax rounding | closed for Phase 1 (dormant); rule **corrected under `B10-FIX.1`** to the category-subtotal method matching the official ZATCA standard, still gated for exact wire-level mechanics on the `enabled` path | `B10_CURRENCY_MONEY_ROUNDING.md` §3, `B10-D-B001` |
| Observability | closed | `B10_OBSERVABILITY.md` |
| Reconciliation | closed | `B10_RECONCILIATION_MODEL.md` |

Every row is "closed" in the sense that an implementer has one, and only one, deterministic answer to follow.

## 2. What remains explicitly gated (not a readiness gap)

`B10-D-B001` (exact ZATCA XML/UBL/QR/cryptographic-stamp spec — `REQUIRES OFFICIAL ZATCA VALIDATION`, matching ADR-012's own identical marker), `B10-D-B002` (retroactive legal-correction migration workflow), `B10-D-B003` (exact CSID onboarding call shape), `B10-D-B004` (retention durations), `B10-D-B005` (multi-entity operational UI), `B10-D-B006` (workspace-facing tax-invoice download), `B10-D-B007` (whether `tax.applicability.manage` ever widens to Admin), `B10-D-B008` (new, `B10-FIX.1` — the EGS-unit/production-CSID device aggregate that would host the real ZATCA ICV). None of these blocks a Phase-1 implementer: each has a safe, fully-specified default (dormant/`not_applicable`-capable architecture; conservative non-deletion; Owner-only governance; a WazLink-internal sequence field that never claims to be the ICV) that ships correctly without the gated question being answered first.

## 3. Pre-implementation gate

Before coding: (a) CTO approval of the 8 `B10_CONTROLLED_AMENDMENTS.md` items against frozen B0/B1 (`B10-FIX.1` adds `#8`); (b) resolution or formal acceptance of the 8 Class B items in `B10_DECISION_REGISTER.md` (`B10-FIX.1` adds `B008`), at minimum confirming the Phase-1-safe defaults are acceptable to ship as-is; (c) an authorized administrator's explicit, governed `SetTaxApplicability` action recording the current entity's actual applicability determination (this pack pre-sets nothing); (d) a live ZATCA sandbox validation pass against `B10_RESEARCH_REGISTER.md`'s `UNRESOLVED` rows, and re-confirmation of the `B10-FIX.1`-strengthened-but-still-`PARTIAL` rows (`002`, `009`/`015`, `011`/`016`, `014`), **only if and when** the target deployment ever moves toward `enabled`; (e) a fresh independent CTO countersign of this `B10-FIX.1` pack.

## 4. Consistency self-check performed during authoring (`B10-FIX.1` re-run)

- Frozen prefix `TAX-` reused verbatim; zero new prefixes minted.
- Frozen permission `tax.view` reused verbatim; three new permissions added with explicit justification (`B10_RBAC_TENANCY.md` §1).
- Frozen error code `TAX_VALIDATION_REQUIRED` reused verbatim; **eleven** new codes added inside the existing envelope/status doctrine (`B10-FIX.1` adds `TAX_CORRECTION_EXCEEDS_ORIGINAL`; `B10-FIX.1a` removes the redundant `TAX_VALIDATION_FAILED` row an independent countersign found duplicated `TAX_VALIDATION_REQUIRED`'s own semantic, `B10-CS-1` — the new-code table is now genuinely eleven rows, not twelve).
- Frozen `TaxProvider` port name reused verbatim (`BACKEND_INTEGRATION_BOUNDARIES.md`).
- Frozen `BACKEND_RECONCILIATION.md` ZATCA row realized exactly as written, no amendment needed.
- Frozen `B1_API_DTO_CONTRACTS.md` `CONFLICT` reason vocabulary extension **now registered** as `B10-AM-008` (`B10-FIX.1` closes the gap an independent audit found: this was used but not registered in the original pass).
- Zero B8/B9 file modified; zero B11/B12/B13/B14 file created (`ls Docs/backend/B11 Docs/backend/B12 Docs/backend/B13 Docs/backend/B14` confirmed absent).
- Zero `.py`/migration file exists anywhere under this pack's output.
- ZATCA routing, tax rounding, `legal_sequence_number`, the `unknown`-mode backlog, and cumulative-correction rules independently re-derived from official-and-corroborating research rather than carried forward from the pre-`B10-FIX.1` draft (§`B10_RESEARCH_REGISTER.md`).

## `IMPLEMENTATION_HANDOFF = PASS`
