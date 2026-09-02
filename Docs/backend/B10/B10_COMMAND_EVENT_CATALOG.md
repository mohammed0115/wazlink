# B10 — Command & Event Catalog

> Design only. `SubmitTaxInvoice`/`TaxSubmitted` were the frozen conceptual names `BACKEND_DOMAIN_OWNERSHIP.md` anticipated; B10 realizes that capability as `SubmitTaxDocumentForProcessing`/`TaxSubmissionAccepted`/`TaxSubmissionRejected` (more precise, since a single frozen name could not express the accept/reject distinction) — recorded here as a naming realization, identical in spirit to `B8-D-A002`'s `InitiatePlanUpgrade` treatment.

## 1. Commands

| Command | Aggregate | Actor | Permission | Idempotency | Preconditions | Result | Event(s) |
|---|---|---|---|---|---|---|---|
| `UpdateTaxProfile` | TaxProfile | operator | `tax.manage` | header, 7d | `legal_entity_id` exists | new `TaxProfile` version (non-applicability fields changed) | `TaxProfileUpdated` |
| `SetTaxApplicability` | TaxProfile | operator | `tax.applicability.manage` | header, 7d | `reason` non-empty | new `TaxProfile` version, `zatca_applicability` transitioned | `TaxApplicabilityChanged` |
| `ValidateZatcaConfiguration` | (none — stateless read) | operator | `zatca.manage` | n/a (read) | n/a | health projection, no state change | (observability only, no event) |
| `IssueTaxInvoice` | TaxInvoice (or `PendingTaxDocumentClassification`, `B10-FIX.1`) | system (consumes B8 `InvoiceIssued`) | n/a | `(source_type, source_ref)` unique on both `tax_invoices` and `pending_tax_document_classifications` | none — behavior branches on `TaxProfile.zatca_applicability` (§`B10_INVOICE_MODEL.md` §4) | **Corrected under `B10-FIX.1`:** if `unknown`, creates (idempotently) a `PendingTaxDocumentClassification{status=pending}` row instead of the pre-FIX.1 pack's undocumented "no row created yet"; otherwise `TaxInvoice{draft→issued}` per `B10_INVOICE_MODEL.md` §4's applicability table, with `invoice_classification` derived per §1a | `TaxInvoiceIssued` \| `TaxClassificationDeferred` (new) |
| `CancelTaxInvoice` | TaxInvoice | operator | `tax.manage` | header, 7d | `status=issued`; `zatca_status ∈ {not_applicable, pending, rejected}` | `status=cancelled` | `TaxInvoiceCancelled` |
| `CreateCreditNote` | TaxInvoice | operator | `tax.manage` | header, 7d | `reference_invoice_id` resolves in-workspace to a `document_kind=invoice` row; `reason` non-empty; `net_corrected_total ≥ 0` post-commit (`B10-D-A021`, new) | new `TaxInvoice{document_kind=credit_note}`, `invoice_classification` pinned from the reference | `CreditNoteIssued` |
| `CreateDebitNote` | TaxInvoice | operator | `tax.manage` | header, 7d | same shape as `CreateCreditNote`, including the `B10-D-A021` bound | new `TaxInvoice{document_kind=debit_note}`, `invoice_classification` pinned from the reference | `DebitNoteIssued` |
| `SubmitTaxDocumentForProcessing` | TaxInvoice (+TaxSubmission child) | system | n/a | `(tax_invoice_id, attempt scope)` | `TaxProfile.zatca_applicability = enabled`; `status=issued` | `tax_submissions` row appended; `zatca_status` updated; routed per `invoice_classification` (§`B10_ZATCA_BOUNDARY.md` §3) | `TaxSubmissionAccepted` \| `TaxSubmissionRejected` (async, later) |
| `RetryTaxSubmission` | TaxInvoice (+TaxSubmission child) | system (scheduled) / operator | `zatca.manage` (operator path) | `(tax_invoice_id, attempt scope)` | prior attempt eligible per `B10_ZATCA_FAILURE_RETRY_MODEL.md` §5 | `tax_submissions` row appended | `TaxSubmissionAccepted` \| `TaxSubmissionRejected` |
| `ResolvePendingTaxClassification` | PendingTaxDocumentClassification | system (scheduled, after `TaxApplicabilityChanged`) / operator | `tax.manage` (operator path) | `(command_id, pending_tax_document_classification_id)` | `status=pending`; a `TaxProfile` version is current (any value except a repeat of `unknown`) | For `not_applicable`: `status=resolved_not_applicable`. For `applicable_not_enabled`/`enabled`/`suspended`: invokes `IssueTaxInvoice` for the same `source_ref` (idempotent, never a second `TaxInvoice`), then `status=resolved_for_issuance` pointing at the result | `TaxClassificationResolved` (new) |

`COMMAND_COUNT = 10` (`B10-FIX.1` adds `ResolvePendingTaxClassification`).

## 2. Events (produced)

| Event | Payload (key fields) | Consumers |
|---|---|---|
| `TaxProfileUpdated` | legal_entity_ref, profile_version, changed_fields | Tax (audit) |
| `TaxApplicabilityChanged` | legal_entity_ref, from_state, to_state, reason, effective_from | Tax, Observability; triggers the `ResolvePendingTaxClassification` sweep (new, `B10-FIX.1`) |
| `TaxInvoiceIssued` | tax_invoice_ref, workspace_ref, document_kind, invoice_classification, source_ref, total, currency | Tax; future B9 (read-only, on demand, `B10_B9_FINANCE_BOUNDARY.md`) |
| `TaxInvoiceCancelled` | tax_invoice_ref, cancelled_by | Tax |
| `CreditNoteIssued` | tax_invoice_ref, reference_invoice_ref, invoice_classification, total, currency, reason | Tax |
| `DebitNoteIssued` | tax_invoice_ref, reference_invoice_ref, invoice_classification, total, currency, reason | Tax |
| `TaxSubmissionAccepted` | tax_invoice_ref, submission_ref, accepted_at | Tax, Observability |
| `TaxSubmissionRejected` | tax_invoice_ref, submission_ref, rejection_reason | Tax, Observability |
| `TaxClassificationDeferred` (new, `B10-FIX.1`) | pending_tax_document_classification_ref, workspace_ref, source_ref, received_at | Tax, Observability (backlog-depth gauge) |
| `TaxClassificationResolved` (new, `B10-FIX.1`) | pending_tax_document_classification_ref, outcome (`resolved_not_applicable`\|`resolved_for_issuance`), resolved_tax_invoice_ref (nullable), resolved_at | Tax, Observability |

`PRODUCED_EVENT_COUNT = 10` (`B10-FIX.1` adds `TaxClassificationDeferred`, `TaxClassificationResolved`). `RevenueRecognized`/`RevenueReversed` (frozen, B9-owned) never appear in this list — see `B10_B9_FINANCE_BOUNDARY.md`.

## 3. Consumed events (cross-domain)

| Event | Producer | B10 consumer action |
|---|---|---|
| `InvoiceIssued` | B8 Billing (frozen) | `IssueTaxInvoice` |

`CONSUMED_EVENT_COUNT = 1` (unchanged). This single consumed event is sufficient to initiate every Phase-1-reachable B10 workflow: applicability/profile management is operator-initiated (§1's `UpdateTaxProfile`/`SetTaxApplicability`), document generation (or backlog deferral, `B10-FIX.1`) is triggered by this one event, and everything downstream (submission, notes, cancellation, backlog resolution) is either system-scheduled (including `TaxApplicabilityChanged`-triggered, which is B10's own event, not a new external consumed contract) or operator-initiated against an already-generated or already-deferred record. No workflow requires a consumed event this table omits.

## 4. Naming reconciliation

`SubmitTaxInvoice`/`TaxSubmitted` (`BACKEND_DOMAIN_OWNERSHIP.md`'s frozen conceptual names) are realized by `SubmitTaxDocumentForProcessing` plus the accept/reject event pair above — not listed as a standalone unrealized row, to avoid implying a third, non-existent command.
