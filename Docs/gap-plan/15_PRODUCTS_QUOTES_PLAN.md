# 15 — Products / Services / Quotes Plan

> **Status: **DEFERRED.** `PD-009` APPROVED: Price Books rejected from this programme; Products/Quotes deferred out of the initial waves. Retained because the revenue-firewall analysis remains binding whenever it is scheduled.**

> Resolves brief §16. **Minimum sales enablement. No ERP. The revenue firewall is the governing constraint.**

## 1. Scope decisions

| Candidate | Verdict | Reason |
|---|---|---|
| Product / Service catalog | **Adopt (minimal)** | A quote needs line items; typing them free-form loses reporting and consistency |
| Price | **Adopt** | `unit_price` + ISO-4217 currency on the product; overridable per quote line |
| **Price Book** | **Reject now** (`PD-009`) | Verified in Vtiger (E-03) but no WazLink segment-pricing evidence; adds a pricing-resolution layer with no demonstrated buyer |
| Quote + QuoteLine | **Adopt** | The core sales document |
| Discount | **Adopt (line + total)** | Present in every real quote; omitting forces free-text workarounds |
| Sales Order | **Reject** | Brief §7 non-goal; prompt-supplied only (E-17), no verified source |
| Inventory / stock | **Reject** | Explicit non-goal |
| Quote → customer-facing invoice | **Reject / stays deferred** | `B9-D-C004` (`DEFERRED_SAFE`); `B10`'s `tax_invoices` are WazLink→workspace, not workspace→customer |

## 2. Model

`products` — `public_id` `PRD-*`, `workspace_id`, `name`, `sku` (nullable), `kind` (`product|service`), `unit_price NUMERIC(19,4)`, `currency` ISO-4217, `tax_rate_hint` (nullable, **display only**), `active`, `archived_at`, `version`.

`quotes` — `public_id` `QUO-*`, `workspace_id`, `customer_id` (**required** — a quote is always to someone), `deal_id` (nullable), `status`, `currency`, `subtotal`, `discount_total`, `tax_estimate`, `total`, `valid_until`, `sent_at`, `accepted_at`, `rejected_at`, `version`.

`quote_lines` — `quote_id`, `product_id` (nullable — ad-hoc lines allowed), `description`, `quantity`, `unit_price`, `discount`, `line_total`, `position`.

**Money** uses the frozen B0 rule: `NUMERIC(19,4)` plus ISO-4217 code. **One currency per quote** — multi-currency stays deferred with `B6-D-C002` (no FX source exists in any frozen phase).

**Lifecycle** `draft → sent → accepted | rejected | expired`. Expiry is derived from `valid_until` by a sweep on B12's `maintenance` queue; **an expired quote is never auto-renewed**.

## 3. The revenue firewall — the load-bearing section

| Assertion | Enforcement |
|---|---|
| **Accepted Quote ≠ Recognized Revenue** | `AcceptQuote` emits `QuoteAccepted` and may set `deal_id`. It **writes no `revenue_events` row and is not an input to `RecordRevenueEvent`.** No quotes-app code path reaches B9 |
| **Won Deal ≠ Recognized Revenue** | Unchanged frozen B6 behavior; `weighted_value` already proves the pattern (`AT-REV-5` **NC**) |
| **Quote total ≠ revenue in any report** | Analytics selectors (`GAP-023`) draw revenue exclusively from `revenue_events`; quote totals appear only in quote-scoped metrics, never in a revenue metric |
| **Quote ≠ tax document** | `tax_estimate` is display-only and explicitly named an estimate. Quotes never write `tax_invoices`, never call ZATCA, and never produce a `TaxInvoice` |
| **Customer invoice ≠ SaaS subscription invoice** | B8's `invoices` remain WazLink→workspace platform billing. This plan creates **no** workspace→customer invoice at all |

**Negative controls** (`GQ-1`…`GQ-4`, in `21_DEMO_PLAN.md` Demo E): accepting a quote that writes a `RevenueEvent` — **fails**; a revenue selector returning a quote total — **fails**; a quote producing a `tax_invoices` row — **fails**; a quote total appearing in the Analytics revenue KPI — **fails**.

## 4. Relationship to Deal

The FK lives on `quotes.deal_id`, **not** on `deals`. B6's frozen `deals` table is untouched, so a quote is an optional satellite of a Deal rather than a change to the Deal aggregate. One Deal may carry several quotes (revisions); a quote need not have a Deal (early-stage pricing).

**Accepting a quote does not move the Deal stage.** Stage movement stays a human act through B6's own `MoveDealStage` with its own guards — coupling them would let a document acceptance silently advance a sales pipeline, and `close_won_deal` is precisely the transition B7 keeps excluded from automation.
