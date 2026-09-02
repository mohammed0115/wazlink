# B10 — Reconciliation Model

> Design only. Extends `BACKEND_RECONCILIATION.md`'s already-frozen row ("ZATCA | TaxInvoice vs submission status | hourly | Tax service") with the full mechanics that row anticipated but did not detail.

## 1. Eligible records

**ZATCA submission reconciliation (hourly, frozen cadence):** every `TaxInvoice` with `zatca_status ∈ {pending, submitted}` for longer than a bounded window (illustrative: 60 minutes — configuration data, not architecture). **Applicability backlog reconciliation (same sweep):** every backlog item (`TaxInvoice` deferred under `zatca_applicability=unknown`) is surfaced, never silently aged out. **B8/B9 correlation reconciliation (daily, informational only):** a coarse comparison between B8 `InvoiceIssued` volume and B10 `TaxInvoice` issuance volume, and between B9 `RevenueEvent` existence and `TaxInvoice` existence, per `B10_B9_FINANCE_BOUNDARY.md` §4 — anomaly-detection only, never a trigger for automatic mutation.

## 2. Invocation

Celery-scheduled (ADR-004), never triggered by a user request, and additionally invokable as an explicit, permissioned admin command (`RetryTaxSubmission` extended to accept a specific `tax_invoice_ref` for targeted repair), per `BACKEND_OPERATIONS_OBSERVABILITY.md`'s "Repairs... are explicit commands, idempotent, permissioned, and always append an AuditLog."

## 3. Provider query boundary

Reconciliation calls `TaxProvider.retrieve_submission_status(submission_ref)` (§`B10_ZATCA_BOUNDARY.md` §2) — never queries ZATCA for a record it cannot correlate to an existing `tax_submissions` row.

## 4. Precedence rules (mirrors `B8-D-A019` exactly)

1. A verified submission-outcome signal (where the provider offers one) always wins over a reconciliation guess that hasn't run yet.
2. A direct status query is authoritative once made, applied through the same legal-transition check `B10_INVOICE_STATE_MACHINE.md` §2 uses (no backward `zatca_status` move).
3. Reconciliation never overwrites a newer authoritative outcome with an older one.
4. A genuine same-moment disagreement is never auto-resolved — recorded as `TAX_DOCUMENT_STATE_CONFLICT`, surfaced to admin repair, never an automatic mutation.

## 5. Audit

Every reconciliation pass appends one summary `AUD-*` row per record examined that changed state, and a `tax_submission.reconciled`-shaped observability event for every record examined at all, distinguishing "we looked" from "we changed something" — identical discipline to `B8_RECONCILIATION_MODEL.md` §7.

## 6. Retry/dead-letter boundary

A reconciliation pass that itself fails follows `BACKEND_RETRY_POLICY.md`'s existing **"ZATCA unavailable | provider outage | yes | 8 | pending + reconciliation"** row (max 8 attempts, reused rather than a new number invented — citation corrected under `B10-FIX.1` from the previously-cited generic "Payment pending" row to this directly on-point ZATCA-specific frozen row, closing `B10-AUDIT-N2`) — dead-lettered with an operational alert after exhaustion, never retried unboundedly. The number `8` is WazLink internal retry policy, not a ZATCA regulatory mandate.
