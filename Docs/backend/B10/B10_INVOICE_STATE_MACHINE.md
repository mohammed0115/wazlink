# B10 — Invoice State Machine(s)

> Design only. Brief §13 explicitly forbids overloading one status field with independent business/tax/transport lifecycles. B10 defines **four** separate state machines, never conflated (`B10-FIX.1` adds the fourth, closing `B10-AUDIT-M2`'s gap where the backlog's states existed only as a storage `CHECK` constraint, never a named machine): `zatca_applicability` (§`B10_TAX_APPLICABILITY_MODEL.md`, not repeated here), the invoice **business** lifecycle (§1), the invoice **ZATCA transport** lifecycle (§2), and the **pending-classification backlog** lifecycle (§3, new).

## 1. Business lifecycle — `tax_invoices.status`

Four states: `draft`, `issued`, `cancelled`, `credited`.

| From | To | Trigger | Authority |
|---|---|---|---|
| *(none)* | `draft` | `IssueTaxInvoice` begins generation | system |
| `draft` | `issued` | generation completes (fields populated, `legal_sequence_number` assigned if applicable) — normally instantaneous within the same transaction, modeled as a distinct state only for failure-handling correctness (a crash mid-generation leaves a `draft` row, never a half-populated `issued` one) | system |
| `issued` | `cancelled` | `CancelTaxInvoice`, legal **only** in the narrow pre-acceptance window (`zatca_status ∈ {not_applicable, pending}`, never after `submitted`/`accepted`) | operator (`tax.manage`) |
| `issued` | `credited` | a `credit_note` referencing this document reaches its own `issued` status and its total fully offsets this document's `total` | system, derived |

No edge exists from `cancelled` or `credited` back to `issued` — both are terminal for the *original* document (a `credited` document that needs further correction gets an additional credit/debit note referencing it again, never a resurrection of its own status).

## 2. ZATCA transport lifecycle — `tax_invoices.zatca_status`

Five states: `not_applicable`, `pending`, `submitted`, `accepted`, `rejected`. This field is **derived** from the latest relevant `tax_submissions` row (§`B10_STORAGE_MODEL.md`) — a denormalized rollup for fast reads, never the sole source of truth (the `tax_submissions` append-only log is authoritative history).

| State | Meaning |
|---|---|
| `not_applicable` | Document generated under `applicable_not_enabled`/`suspended` (or the applicability itself never required transmission) — the Phase-1-Generation-equivalent terminal state; may later transition to `pending` if applicability moves to `enabled` and a backlog sweep picks it up |
| `pending` | Submission attempted but outcome not yet known, **or** an unrecognized/ambiguous provider response was received (`B10-D-A019` fail-closed rule) |
| `submitted` | Transmitted, awaiting ZATCA's clearance/reporting response |
| `accepted` | ZATCA confirmed receipt/clearance | 
| `rejected` | ZATCA rejected the submission — the underlying `TaxInvoice` is **not** auto-cancelled; a `rejected` document requires operator review (§`B10_ZATCA_FAILURE_RETRY_MODEL.md`) before either a corrected re-issuance path or an explicit `CancelTaxInvoice` |

## 3. Why these are independent, not one field

A document can be `status=issued` + `zatca_status=rejected` simultaneously and validly (the commercial/statutory document exists and was generated correctly; only its transmission failed and needs operator attention) — collapsing this into one field would force an implementer to invent which lifecycle "wins" when they diverge, exactly the ambiguity brief §13 forbids.

## 3. Pending-classification backlog lifecycle — `pending_tax_document_classifications.status` (new, `B10-FIX.1`, closes `B10-AUDIT-M2`)

Four states: `pending`, `resolved_not_applicable`, `resolved_for_issuance`, `cancelled`.

| From | To | Trigger | Authority |
|---|---|---|---|
| *(none)* | `pending` | `IssueTaxInvoice` observes `zatca_applicability = unknown` for a newly-consumed `InvoiceIssued` event | system |
| `pending` | `resolved_not_applicable` | `ResolvePendingTaxClassification`, when the now-current `TaxProfile.zatca_applicability = not_applicable` | system (scheduled sweep) / operator |
| `pending` | `resolved_for_issuance` | `ResolvePendingTaxClassification`, when the now-current `TaxProfile.zatca_applicability ∈ {applicable_not_enabled, enabled, suspended}` — invokes `IssueTaxInvoice` for the same `source_ref` | system (scheduled sweep) / operator |
| `pending` | `cancelled` | the underlying workspace's deletion/purge workflow reaches this item before resolution (mirrors `BF17`'s retain-and-anonymize discipline — the row is retained, not deleted) | system |

All four terminal-or-initial states are mutually exclusive and exhaustive; `resolved_not_applicable`, `resolved_for_issuance`, and `cancelled` are all terminal — no edge returns to `pending` or moves between terminal states. This is independent of, and never conflated with, `zatca_applicability` itself (a backlog item's own status says nothing about whether applicability might change again later — only whether *this specific item* has been processed) or the invoice business/transport lifecycles (a `resolved_for_issuance` item's resulting `TaxInvoice` then runs its own independent §1/§2 lifecycles from `draft` onward).

## 4. Concurrency note

Every transition here is protected by the same `version`/optimistic-concurrency + durable-uniqueness discipline as `B8_CONCURRENCY_MODEL.md` — full detail in `B10_IDEMPOTENCY_CONCURRENCY.md`, not repeated here (§5 covers the backlog specifically).

## Counters

`STATE_MACHINE_COUNT = 4` (`zatca_applicability`: 5 states; business lifecycle: 4 states; ZATCA transport: 5 states; pending-classification backlog: 4 states — `B10-FIX.1` adds the fourth machine). `STATE_COUNT = 18`.
