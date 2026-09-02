# B10 — Tax Calculation Model

> Design only. Answers brief §8's explicit question list. Reuses B8/B9 money discipline (`NUMERIC(19,4)`, explicit ISO-4217 currency, never float) verbatim; see `B10_CURRENCY_MONEY_ROUNDING.md` for the rounding-point decision specifically.

## 1. Who owns tax configuration?

`TaxProfile` (B10-owned, §`B10_LEGAL_ENTITY_TAX_PROFILE.md`) owns *whether* tax applies and *what rate table is current*. Neither B8 nor B9 stores a tax rate anywhere.

## 2. Who determines the tax rate applied to a line?

`quota_definitions`-style pattern reused: a small, rarely-mutated `tax_rate_categories` reference list (not a client-facing table) maps `tax_category ∈ {standard, zero_rated, exempt, out_of_scope}` to a rate:

| Category | Current rate | Meaning | Source |
|---|---|---:|---|
| `standard` | 15% | ordinary taxable supply | Saudi standard VAT rate, effective 1 July 2020, unchanged as of this authoring (`B10-X-010`) |
| `zero_rated` | 0% | taxable but rated at zero (e.g., qualifying exports) | rate is 0, still a taxable supply — distinct from `exempt` |
| `exempt` | n/a | supply excluded from VAT by law (no rate applies, not "0%") | never conflated with `zero_rated` — the legal treatment differs even though both currently net to zero payable tax |
| `out_of_scope` | n/a | transaction outside VAT's scope entirely (e.g., certain cross-border cases) | never conflated with `exempt` — a different question ("does VAT law reach this transaction at all") |

WazLink's own Phase-1 commercial reality (subscription sales to KSA-workspace customers) is expected to be `standard` in the overwhelming majority of cases; the four-category model exists so the schema is not wrong the first time a different case appears, per brief §8's explicit instruction not to conflate these.

## 3. When is tax snapshotted?

At `IssueTaxInvoice` time, once, from the `TaxProfile` version current at that instant (`B10-D-A007`). Every `tax_invoice_lines` row stores its own resolved `tax_category`/`tax_rate`/`tax_amount` at issuance — never a live re-lookup.

## 4. Can historical tax be recalculated?

No (`B10-D-A006`). An issued line's `tax_rate`/`tax_amount` is immutable. A rate correction is a `CreditNote` referencing the original, carrying its own corrected line(s) — never an `UPDATE`.

## 5. Can tax rates change?

Yes — KSA's own standard rate itself changed once already (5%→15%, July 2020), so the schema treats the rate table as effective-dated data, not a hardcoded constant, exactly mirroring `B8_PLAN_CATALOG.md`'s "numbers are data, not architecture" discipline. A rate change affects only invoices issued after its effective date; already-issued lines keep their snapshotted rate (§4).

## 6. Can one invoice contain multiple tax rates/categories?

Yes. `tax_invoice_lines` carries `tax_category`/`tax_rate` per line. **Corrected under `B10-FIX.1`:** `tax_invoices.tax_amount` is *not* the sum of per-line `tax_invoice_lines.tax_amount` values — it is computed by grouping lines into distinct `(tax_category, tax_rate)` subtotals, rounding VAT once per group, and summing the already-rounded group amounts. See `B10_CURRENCY_MONEY_ROUNDING.md` §3 for the corrected five-level algorithm and the official-standard basis for this correction.

## 7. Zero-rated, exempt, out-of-scope — never conflated

Each is its own `tax_category` enum value (§2). A line's `tax_category` and its `tax_rate` are stored independently — an `exempt`/`out_of_scope` line has no numeric rate at all (`tax_rate = NULL`, `tax_amount = 0` by construction, not by a `0`-valued rate that would misrepresent it as `zero_rated`).

## 8. WazLink's own Phase-1 tax posture (illustrative, not an implementation authorization)

While `zatca_applicability = not_applicable` (the current target deployment, §`B10_TAX_APPLICABILITY_MODEL.md`), **no `TaxInvoice` is ever generated at all** — this calculation model exists so that the moment applicability changes, the rate/category machinery is already correct, not so that it runs today. This is a deliberate consequence of `B10-D-A005`: the calculation engine is fully specified but dormant, never partially wired in a way that could compute a tax figure nobody asked for.
