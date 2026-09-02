# B10 — Credit Note / Debit Note Model

> Design only. Realizes `B10-D-A004`, `A009`, `A010` (§`B10_DECISION_REGISTER.md`). Answers brief §20 directly: `Refund` (B8) ≠ `CreditNote` (B10) ≠ `RevenueReversal` (B9, future) — three independent facts, never auto-derived from one another.

## 1. Storage — a `TaxInvoice` variant, not a new aggregate

A credit note or debit note is a `tax_invoices` row with `document_kind = credit_note` / `debit_note` (renamed from `document_type` under `B10-FIX.1`, §`B10_INVOICE_MODEL.md` §1) and a **required** `reference_invoice_id` pointing at the original `document_kind = invoice` row (`B10-D-A004`). It carries its own `tax_invoice_lines` (the corrected/adjusted amounts, not a diff), its own `TAX-*` public_id, and follows the identical business (§`B10_INVOICE_STATE_MACHINE.md` §1) and transport (§2) lifecycles as any other document — a note is not a lesser or informal record.

| Constraint | Enforcement |
|---|---|
| `reference_invoice_id` required for `credit_note`/`debit_note`, forbidden otherwise | DB `CHECK` (local row values only — both columns are on the same row, so this is expressible as an ordinary Postgres `CHECK`, unlike B8's cross-table override case) |
| `reference_invoice_id` must resolve to a `tax_invoices` row with `document_kind = invoice` and the **same** `workspace_id` | application-layer validation at `CreateCreditNote`/`CreateDebitNote` time (cross-table, not DB-expressible) |
| a `reason` is required, non-empty | matches the real ZATCA note-content requirement corroborated across multiple sources (`B10-X-012`) and mirrors `B8`'s own `EntitlementOverrideCreate.reason` precedent |
| `invoice_classification` is pinned from `reference_invoice_id`'s row at creation, never independently set (`B10-FIX.1`, closes `B10-AUDIT-C1`) | application-layer assignment inside `CreateCreditNote`/`CreateDebitNote`'s own transaction; the DTO (`TaxNoteCreate`, §`B10_API_DTO_CONTRACTS.md` §2) carries no `invoice_classification` input field at all, so there is no code path through which a client could set or conflict with it — full derivation rule: §`B10_INVOICE_MODEL.md` §1a |

**A `credit_note` may reference either a `standard` or a `simplified` original, and so may a `debit_note` — the pack does not assume a note's economic direction implies its original's classification, and neither does its ZATCA route.** This is the specific structural gap `B10-AUDIT-C1` identified: the pre-FIX.1 pack's routing table silently assumed `credit_note` always pairs with `simplified` and `debit_note` always pairs with `standard`, which nothing in this table ever enforced. Under `B10-FIX.1`, all four combinations (`credit_note`×`standard`, `credit_note`×`simplified`, `debit_note`×`standard`, `debit_note`×`simplified`) are explicitly representable and each routes correctly via the corrected, classification-keyed rule (§`B10_ZATCA_BOUNDARY.md` §3).

## 2. `Refund` (B8) ≠ `CreditNote` (B10) (`B10-D-A009`)

B8's frozen `B8_COMMAND_EVENT_CATALOG.md` produces no refund-specific event — `refunds` is a child table of B8's own `Payment` aggregate with no outbox signal B10 could consume even if it wanted to. Therefore:

- `CreateCreditNote` is **always** an explicit, operator-initiated command (`tax.manage`), never system-triggered from a B8 refund.
- The operator workflow is: an operator sees a B8 refund (in the Billing surface, B8-owned) → manually opens `CreateCreditNote` in the Tax surface → supplies `reference_invoice_id` (the original `TAX-*`, if one exists) and a `reason` → the note is issued through the normal pipeline.
- If no `TaxInvoice` exists for the refunded `Invoice` (e.g., applicability was `not_applicable` at the time), **no credit note is created or required** — there is nothing to correct at the tax-document layer, because nothing was ever issued there.

An automated refund→credit-note suggestion workflow is recorded as Class C (`B10-D-C002`), not designed now.

## 3. `CreditNote` (B10) ≠ `RevenueReversal` (B9) (`B10-D-A010`)

`CreditNoteIssued` (§`B10_COMMAND_EVENT_CATALOG.md`) is a fact-only event. B10 never writes `revenue_reversals`, never invokes a B9 command (B9 exposes none to B10), and never asserts that issuing a credit note implies revenue was reversed. This is the exact symmetric counterpart to `B9_B10_TAX_BOUNDARY.md` §5's own "that a reversal is a credit note" non-inference — both boundary documents now independently forbid the same false equivalence from either direction. Full proof: `B10_B9_FINANCE_BOUNDARY.md`.

## 4. Debit notes

Structurally identical to credit notes (same table, same reference requirement, same reason requirement), representing an **increase** to a previously issued document's tax liability (e.g., an under-billed correction) rather than a decrease. Included for completeness per brief §11/§19; WazLink's own Phase-1 commercial model (flat subscription pricing) is not expected to generate debit notes in practice, but the schema does not special-case their absence.

## 5. Negative controls

`AT-B10REF-1`: a B8 `Refund` reaching `refunded` status — assert zero automatic `tax_invoices` row created. `AT-B10REV-1`: a `CreditNoteIssued` event — assert zero write to `revenue_reversals` and zero B9 command invoked.

## 6. Cumulative correction consistency (`B10-D-A021`, new under `B10-FIX.1`, closes `B10-AUDIT-N4`)

Multiple credit and debit notes against one original are explicitly permitted (§1's constraint table has no cardinality limit), each independently auditable and reason-required — but this pass adds the one bound brief §29/§30 requires: **the running net-corrected total of an original document must never go negative.** This is a WazLink **product financial-consistency rule**, stated and enforced independently of any ZATCA statutory requirement — no official source is cited or needed for it, because it is a sanity invariant on WazLink's own arithmetic, not a claim about Saudi tax law.

**Definition.** For an original `tax_invoices` row (`document_kind = invoice`), define `net_corrected_total = original.total + SUM(debit_note.total referencing it) − SUM(credit_note.total referencing it)`, evaluated over every non-`cancelled` note currently referencing the original. **Invariant: `net_corrected_total ≥ 0` must hold after every `CreateCreditNote`/`CreateDebitNote` commit.** A debit note widens the room available to future credit notes; a credit note narrows it. Credit and debit notes are therefore **effectively netted** for the purpose of this bound, even though each remains its own independent, immutable, reason-carrying document — netting applies only to the consistency check, never to the documents themselves (no note is ever merged, offset, or rewritten).

**Enforcement.** `CreateCreditNote`/`CreateDebitNote` locks the original `tax_invoices` row (`SELECT ... FOR UPDATE`, the same primitive `B10_IDEMPOTENCY_CONCURRENCY.md` §3's `C3` race already uses), recomputes `net_corrected_total` from every currently-committed note referencing it, and evaluates the invariant *before* inserting the new note — inside the same transaction, so two concurrent notes can never both commit past the bound (the loser re-reads the post-commit total and is rejected). Rejection is `409 TAX_CORRECTION_EXCEEDS_ORIGINAL` (new failure code, §`B10_FAILURE_CATALOG.md` §2) — a distinct, typed reason, not a generic `VALIDATION_ERROR`.

**Worked example (brief §30):** original total 100. Credit 60 → `net_corrected_total = 40`, allowed. Credit 40 → `net_corrected_total = 0`, allowed (exactly fully credited). A third credit of 1 → would drive the total to −1, **rejected** `409 TAX_CORRECTION_EXCEEDS_ORIGINAL`. Two concurrent `CreateCreditNote(60)` calls against the freshly-100 original: the row lock serializes them — the first commits (`net_corrected_total = 40`), the second re-reads that post-commit state and is rejected (`40 − 60 < 0`) — the two can never both succeed and produce a nonsensical 120-against-100 state.

**What is not asserted.** No Saudi legal rule about maximum correction amounts is invented or implied — this is `B10_DECISION_REGISTER.md`'s explicit product-vs-regulatory separation applied here: if a real ZATCA rule on cumulative correction bounds exists, it is a future `B10-D-B0##`-gated research item, not something this section claims to already satisfy. The rule above exists purely to keep WazLink's own ledger of documents internally sane.

## 7. Negative controls, over-correction (`B10-FIX.1`)

`AT-B10CORR-1`…`7` (§`B10_ACCEPTANCE_TESTS.md`) — single partial credit, multiple partial credits summing exactly, exact-full credit, over-credit rejection, concurrent-over-credit rejection, debit-then-credit widening-then-narrowing, and no client-suppliable `currency` field on `TaxNoteCreate`. `AT-B10CORR-4 (NC)`: a `CreateCreditNote` that would drive `net_corrected_total` negative — rejected `409 TAX_CORRECTION_EXCEEDS_ORIGINAL`, zero row created. `AT-B10CORR-5 (NC)`: two concurrent over-limit `CreateCreditNote` calls — exactly one commits, the loser rejected, never both. `AT-B10CORR-7 (NC)`: `TaxNoteCreate`'s schema has no `currency` input — a note's currency is always inherited from its reference, never independently supplied or mismatched.
