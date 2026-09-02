# B9 — B10 Tax / ZATCA Boundary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **No B10 file is created by this document.** `B10_FILES_CREATED = 0`.

## 1. B9 is not a tax authority

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` registers Tax as its own domain: aggregate `TaxInvoice`, tables `tax_invoices, lines, submissions`, allowed writers "tax service", command `SubmitTaxInvoice`, event `TaxSubmitted`, integration ZATCA, forbidden coupling **"no payment truth."**

B9 owns none of it and defines none of it.

## 2. The four required non-identities

| Non-identity | Why it holds |
|---|---|
| **RevenueEvent ≠ Tax Invoice** | Different entities, different tables, different domains, different lifecycles. A `REV-*` is a recognition fact; a tax invoice is a legal document with statutory numbering and content requirements B9 defines nowhere |
| **RevenueRecognized ≠ InvoiceIssued** | Distinct frozen event names in distinct catalogs. `InvoiceIssued` is a **B8** event (platform billing); B9 neither produces nor consumes it |
| **RevenueRecognized ≠ ZATCA clearance** | B9 has no submission, no clearance state, no ZATCA integration, and no knowledge that ZATCA exists beyond this document |
| **PaymentSucceeded ≠ VAT recognition rule** | B9 never reads a payment as a recognition input at all (`B9_B8_BILLING_BOUNDARY.md` §2), and computes no VAT under any circumstance |

## 3. What B9 does not own

VAT calculation · VAT rates · tax registration numbers · tax invoice numbering · invoice XML · UBL · QR generation · cryptographic stamps · ZATCA clearance · ZATCA reporting · Phase-1/Phase-2 e-invoicing compliance · tax invoice lifecycle · credit/debit notes · tax periods · tax returns · place-of-supply rules · reverse charge · exemption handling.

**Not one of these appears as a column, field, enum value, command, event, endpoint, or selector anywhere in B9.**

Critically, **`net` is not a tax-exclusive amount** in any B9 sense. `gross` and `net` are caller assertions whose commercial meaning is the workspace's own (`B9_CURRENCY_MONEY_MODEL.md` §5). B9 does not know whether either includes VAT, and must not be read as asserting that it does. A future B10 that needs a tax-exclusive base must derive it under its own rules, not assume B9's `net` is one.

## 4. What B10 may later read

Read-only, on demand, through B9's own frozen and additive DTOs — never a subscription requiring B9 to know B10 exists (the same pattern B8 required of B9):

| Fact | Fields |
|---|---|
| `RevenueEvent` | `public_id, source_type, source_ref, gross, net, currency, recognized_at, status` |
| `RevenueReversal` | `public_id, revenue_event_ref, gross, net, currency, reason, reversed_at` |
| Per-currency period totals | `RevenueSummary` |

That is the complete surface. If B10 needs a fact not listed, it is a future controlled amendment against **this** document, never an assumption baked into B9 today.

## 5. What B10 must **not** infer

- That a `RevenueEvent` implies a tax obligation, a taxable supply, or an invoice requirement.
- That `recognized_at` is a tax point.
- That `net` is a tax base.
- That the absence of a `RevenueEvent` implies no tax obligation.
- That a reversal is a credit note.

Every one of those is a **B10 determination** under rules B9 does not model.

## 6. Direction of dependency

B9 → B10: **none.** B9 reads no tax entity, imports no tax module, and would function identically if B10 never existed.
B10 → B9: **read-only**, at B10's initiative, on B10's schedule.

```
B10_TAX_AUTHORITY_LEAKS = 0
B10_FILES_CREATED       = 0
```

## 7. Compliance claims

B9 makes **none**. `B9_RESEARCH_REGISTER.md` records the ZATCA and accounting-standard questions as **UNRESOLVED**, and `B9_FINANCIAL_MODEL.md` §7 states plainly that B9's output is product truth, not statutory accounting.

## 8. Negative controls

`AT-B10-1` **(NC)**: a B9 command, column, or endpoint computing VAT or any tax amount — fails.
`AT-B10-2` **(NC)**: recognizing revenue creating a tax invoice or a `TaxSubmitted` event — fails.
`AT-B10-3` **(NC)**: a tax invoice existing implying a `RevenueEvent` exists — fails; the two are independent.
`AT-B10-4` **(NC)**: any B9 document asserting ZATCA/IFRS/statutory compliance — fails.
`AT-B10-5` **(NC)**: a B9 write path to `tax_invoices`, `lines`, or `submissions` — fails.
