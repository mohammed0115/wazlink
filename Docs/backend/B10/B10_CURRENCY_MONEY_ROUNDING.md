# B10 — Currency, Money & Rounding

> Design only. Reuses B8/B9 money representation verbatim; this document adds the tax-specific rounding-point decision brief §37 requires.

## 1. Representation (reused verbatim)

Every monetary column (`tax_invoice_lines.line_subtotal/tax_amount/line_total`, `tax_invoices.subtotal/tax_amount/total`) is `NUMERIC(19,4)` plus a paired ISO-4217 `currency CHAR(3)` column — never float, per ADR-011, identical to `B8_STORAGE_MODEL.md`'s "Money representation" section and `B9_CURRENCY_MONEY_MODEL.md`'s discipline.

## 2. Currency scope

Phase 1 prices every `TaxInvoice` in `SAR` only, matching `B8_PLAN_CATALOG.md` §7 and `BACKEND_ANALYTICS_SEMANTICS.md`'s "Phase 1 defaults to SAR." A `TaxInvoice.currency` always equals the `currency` of the B8 `Invoice` it references (`source_ref`) — B10 never performs currency conversion. Multi-currency tax calculation is Class C (`B10-D-C001`).

## 3. Rounding algorithm — corrected under `B10-FIX.1` (closes `B10-AUDIT-M3`)

**`B10-FIX.1` correction.** The prior revision of this section decided per-line rounding with document tax as a sum of already-rounded line amounts (`ROUND(line_subtotal * tax_rate, 2)` per line, summed), rated `PARTIAL` on `B10-X-011`. Independent re-research during this fix pass (`B10-X-011` re-adjudicated, `B10-X-016` added — §`B10_RESEARCH_REGISTER.md`) found multiple concordant, technically-precise descriptions of ZATCA's own Electronic Invoice XML Implementation Standard (citing exact EN16931 business terms `BT-110`/`BT-116`/`BT-117` and ZATCA-specific business-rule identifiers such as `BR-KSA-97`) stating the opposite: **VAT is rounded once per tax category, at the category-subtotal level — never as a sum of independently-rounded line amounts.** The official standard PDF itself was located and fetched but could not be rendered to readable text by any tool available in this pass (mirroring the exact limitation the original pack hit on the QR/UBL items); the correction below rests on multiply-corroborated, EN16931-business-term-precise secondary description rather than a directly-read primary page, and is recorded as such rather than overclaimed.

The corrected algorithm separates five distinct precision points that the pre-FIX.1 pack collapsed into one ("round everything per line"):

| Level | Computation | Rounding applied here? |
|---|---|---|
| **A. Line calculation** | `tax_invoice_lines.line_subtotal = quantity * unit_price`, stored at full `NUMERIC(19,4)` precision | No rounding beyond column storage precision |
| **B. VAT-category taxable-amount subtotal** | For each distinct `(tax_category, tax_rate)` pair present among an invoice's lines, sum the `line_subtotal` of every line sharing that pair, at full unrounded precision | No |
| **C. VAT-category tax amount** | `category_tax_amount = ROUND(category_taxable_amount × tax_rate, 2)` — the EN16931/ZATCA `BT-117`-equivalent figure | **Yes — exactly once per distinct `(tax_category, tax_rate)` pair.** This is the only point at which VAT rounding actually occurs |
| **D. Document-level tax amount** | `tax_invoices.tax_amount = SUM(category_tax_amount)` across every distinct category present — a sum of **already-rounded category amounts**, never of rounded *line* amounts (the pre-FIX.1 error) and never a second, independent rounding of a pre-summed total | No — already-rounded inputs, summed exactly |
| **E. Document totals / display** | `tax_invoices.total = tax_invoices.subtotal + tax_invoices.tax_amount`; SAR display precision is 2 decimal places, matching the category-level rounding point | No further rounding; display simply presents the already-2dp-rounded stored value |

**Rounding mode:** half-up ("round half away from zero" at the boundary), applied at the third decimal to produce a 2-decimal-place result — the mode multiply corroborated across the same technical sources, consistent with the general VAT/EN16931 convention. **Precision:** 2 decimal places for the computed, stored `category_tax_amount`/`tax_amount`/`total` figures, matching `SAR`'s minor-unit convention; `NUMERIC(19,4)` column storage is retained throughout for audit-trail precision, not because 4dp values are ever presented.

**`tax_invoice_lines.tax_amount`/`.line_total` are now explicitly informational, per-line allocations, not the source of the document total** (§`B10_INVOICE_MODEL.md` §2, updated): each line's own `tax_amount` is computed as the unrounded `line_subtotal × tax_rate` (or, where a per-line display figure is wanted, an allocated share of the rounded category amount) for display purposes only. **`tax_invoices.tax_amount` is never derived by summing these line-level figures** — it is independently computed via levels B–D above and written atomically in the same `IssueTaxInvoice` transaction that writes the lines. A cent-level difference between the sum of displayed per-line figures and the actual (correct) document VAT total is expected and normal for a multi-line, multi-category invoice — this is precisely the discrepancy the category-level rule exists to make authoritative rather than accidental.

**This remains gated, not silently frozen: `B10-D-B001` still gates the exact wire-level ZATCA submission mechanics** (which XML element carries which figure, exact `BR-KSA-*` validation rule text) **before the `enabled` path is implemented** — Phase 1's dormant (`not_applicable`) posture means no rounding computation runs at all today. What changes under this fix is that the *recorded default* algorithm (levels A–E above) now matches the best currently-available reading of the official standard, rather than contradicting it, closing `B10-AUDIT-M3`.

## 4. Arithmetic invariants

`tax_invoices.total = tax_invoices.subtotal + tax_invoices.tax_amount` always holds, checked by a DB `CHECK` constraint (`B10_STORAGE_MODEL.md`) — both are same-row columns. `tax_invoices.subtotal` is the sum of `tax_invoice_lines.line_subtotal` (row-level, DB-checkable). `tax_invoices.tax_amount` is **not** DB-checkable against `tax_invoice_lines` (§3's levels B–D require grouping sibling rows by a computed key); it is an application-layer invariant enforced by construction inside `IssueTaxInvoice`'s single transaction, verified by acceptance test rather than a schema constraint (`AT-B10RND-1`…`4`, §`B10_ACCEPTANCE_TESTS.md`).

## 5. No currency float, ever

Zero exceptions, matching `B8_STORAGE_MODEL.md`'s identical zero-exceptions stance.
