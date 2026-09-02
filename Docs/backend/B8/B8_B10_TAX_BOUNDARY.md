# B8 → B10 Tax/ZATCA Boundary

> B10 is not designed here. B8 does not become ZATCA.

## 1. Frozen separation (pre-existing, restated)

`BACKEND_BILLING_TAX_ARCHITECTURE.md`: *"Invoice and TaxInvoice are separate. Invoice represents the commercial billing document; TaxInvoice represents the Saudi tax document and submission lifecycle."* `BACKEND_DOMAIN_OWNERSHIP.md` names "Tax" as its own domain row (owner `tax`, aggregate `TaxInvoice`, tables `tax_invoices, lines, submissions`, command `SubmitTaxInvoice`, event `TaxSubmitted`, integration `ZATCA`, forbidden coupling "no payment truth") — distinct from the "Billing" row B8 realizes. ADR-012: *"exact ZATCA invoice/legal fields... remain decisions requiring product, legal, or provider validation rather than invented values."*

## 2. What B8 owns vs. what it explicitly does not

B8 owns `Invoice`/`InvoiceLine` (`INV-BILL-*`, the **commercial** billing document — what a subscription was charged, in what period, at what total) and emits `InvoiceIssued`. B8 does **not** own `TaxInvoice`, `tax_invoices`, `tax_invoice_lines`, `tax_submissions`, the `TAX-*` prefix, ZATCA QR/XML generation, tax-invoice clearance/reporting state, or `SubmitTaxInvoice`/`TaxSubmitted` — all of these are named in frozen B0 and reserved for a future B10, not designed by B8.

## 3. What B8 preserves for B10 to consume later

Every `Invoice` B8 issues carries the commercial totals (`subtotal`, `total`, `currency`, `period_start`, `period_end`, workspace legal-entity reference where the workspace has supplied one) a future TaxInvoice would need as its commercial-document reference — B8 does not duplicate ZATCA-specific fields (VAT number formatting, QR payload, tax UUID) onto `Invoice`; those remain exclusively TaxInvoice's, created by B10 later, referencing B8's `INV-BILL-*` via `TaxInvoice.invoice_ref` (already frozen in `BACKEND_DTO_CONTRACTS.md`'s `TaxInvoice` DTO shape).

## 4. Negative control

`AT-B10TAX-B8-1 (NC)`: an implementation where B8 computes a VAT amount, generates a ZATCA QR payload, or writes any row to `tax_invoices`/`tax_submissions` — fails; no such field, computation, or write path exists anywhere in `B8_CHECKOUT_PAYMENT_MODEL.md`'s storage table or `B8_API_DTO_CONTRACTS.md`'s DTO list. `B10_TAX_AUTHORITY_LEAKS = 0`.

## 5. No legal compliance claim

Consistent with every prior phase's own disclaimer (B3/B4/B5's external-validation registers), no document in this pack makes a legal-compliance claim about Saudi tax law, ZATCA/FATOORA requirements, or VAT treatment. `Invoice.total`'s illustrative "15% display tax" seen in frontend evidence (`FB-B8-042`) is presentation-layer estimation only, not a B8 architecture commitment to any specific tax rate or calculation method — that remains B10's, pending official ZATCA validation.
