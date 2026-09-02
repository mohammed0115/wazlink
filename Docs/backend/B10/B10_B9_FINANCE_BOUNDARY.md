# B10 — B9 Finance/Revenue Boundary

> Design only. Symmetric counterpart to `B9_B10_TAX_BOUNDARY.md` — that document is B9's declaration of the boundary from Finance's side; this is B10's declaration of the identical boundary from Tax's side. B9 is frozen; this document proposes no change to it.

## 1. B9's own declared surface, restated as B10's ceiling

`B9_B10_TAX_BOUNDARY.md` §4 already declares the complete, closed set of facts B10 may ever read from B9: `RevenueEvent{public_id, source_type, source_ref, gross, net, currency, recognized_at, status}`, `RevenueReversal{public_id, revenue_event_ref, gross, net, currency, reason, reversed_at}`, and per-currency period totals (`RevenueSummary`). B10 reads no B9 fact outside this set. If B10 ever needs one not listed, that is a future controlled amendment against **`B9_B10_TAX_BOUNDARY.md`**, not an assumption B10 bakes in today.

## 2. The four non-identities, held from both sides

| Non-identity | B9's own statement (`B9_B10_TAX_BOUNDARY.md` §2) | B10's mirrored commitment |
|---|---|---|
| RevenueEvent ≠ TaxInvoice | different entities, tables, domains, lifecycles | B10 never treats a `RevenueEvent` as evidence that a `TaxInvoice` is required or already exists |
| RevenueRecognized ≠ TaxInvoiceIssued | distinct events, distinct catalogs | B10's `TaxInvoiceIssued` is triggered solely by B8's `InvoiceIssued` (`B10_B8_BILLING_BOUNDARY.md` §3), never by any B9 event |
| RevenueRecognized ≠ ZATCA clearance | B9 has no ZATCA knowledge at all | B10's ZATCA submission outcome never feeds back into any B9 recognition decision |
| PaymentSucceeded ≠ VAT recognition rule | B9 never reads Payment as a recognition input | B10 independently never reads `PaymentSucceeded` either (`B10_B8_BILLING_BOUNDARY.md` §5) |

## 3. `net` is not a tax base (held exactly as B9 states it)

`B9_B10_TAX_BOUNDARY.md` §3 is explicit: *"`net` is not a tax-exclusive amount... B9 does not know whether either includes VAT... A future B10 that needs a tax-exclusive base must derive it under its own rules, not assume B9's `net` is one."* B10 honors this fully: `tax_invoices.subtotal`/`tax_amount` are computed entirely from B8's `Invoice.total` and B10's own rate table (`B10_TAX_CALCULATION_MODEL.md`) — never from B9's `RevenueEvent.net`, which B10 never even reads for this purpose.

## 4. What B10 uses B9 facts for

Read-only reconciliation/anomaly detection only (§`B10_RECONCILIATION_MODEL.md`) — e.g., a coarse admin-visible signal such as "recognized revenue exists for a period with zero corresponding tax invoices while `zatca_applicability = enabled`" is a `RECONCILIATION_MISMATCH`-class alert, never an automatic mutation of either domain's data. B10 never initiates a B9 command (B9 exposes none to B10) and never writes `revenue_events`/`revenue_reversals`/`attribution_touchpoints`.

## 5. Direction of dependency

B10 → B9: read-only, at B10's own initiative, on B10's own schedule — the identical shape B9 already requires of itself relative to B8. B9 → B10: none; B9 functions identically whether or not B10 exists, exactly as `B9_B10_TAX_BOUNDARY.md` §6 already states of itself.

## 6. Negative controls (mirroring `B9_B10_TAX_BOUNDARY.md` §8's five, from the other side)

`AT-B10B9-1 (NC)`: a B10 command, column, or endpoint computing or writing `gross`/`net`/`recognized_at` — fails. `AT-B10B9-2 (NC)`: `CreditNoteIssued` creating a `revenue_reversals` row — fails. `AT-B10B9-3 (NC)`: a `RevenueEvent` existing implying a `TaxInvoice` exists, or vice versa — fails; independently verified in both directions. `AT-B10B9-4 (NC)`: any B10 document asserting IFRS/statutory-accounting compliance — fails; B10 makes no such claim (§`B10_RESEARCH_REGISTER.md`). `AT-B10B9-5 (NC)`: a B10 write path to `revenue_events`, `revenue_reversals`, or `attribution_touchpoints` — fails; verified by the same structural-unreachability method `B8_RBAC_TENANCY.md` §5 established.

```
B9_REVENUE_AUTHORITY_LEAKS = 0
INVOICE_REVENUE_EQUIVALENCE_LEAKS = 0
CREDIT_NOTE_REVENUE_REVERSAL_EQUIVALENCE_LEAKS = 0
```
