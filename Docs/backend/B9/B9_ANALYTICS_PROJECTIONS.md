# B9 — Analytics Selectors & Projections

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The rule that governs every selector

> **Every B9 selector reads `revenue_events`, `revenue_reversals` and `revenue_attributions`, and nothing else.**

No selector reads `deals`, `pipelines`, `payments`, `invoices`, `subscriptions`, `plans`, or any frontend fixture. No selector unions a B9 table with a non-B9 table. Frozen `BACKEND_ANALYTICS_SEMANTICS.md` already fixes the two rows B9 implements — Recognized Revenue *"RevenueEvent.recognized_at where status recognized"* and Attributed Revenue *"never exceeds RevenueEvent"* — and its contradiction-prevention clause: *"Deal value is never used as Recognized Revenue."*

### 1a. What the frozen phrase "where status recognized" means (`B9-AM-010`)

The frozen qualifier is read as a **register-membership** condition, not a literal `status = 'recognized'` row filter:

> A `RevenueEvent` participates in Recognized Revenue because it is a committed recognition in the register, and its contribution is **net of the reversals compensating it**. `status` is a lifecycle label on the row; it is not the filter.

The distinction is material and worth stating precisely, because the two readings give different numbers. For an event of 1,000 gross with 300 reversed, `status` reads `partially_reversed`:

| Reading | Contribution |
|---|---:|
| Literal `status = 'recognized'` filter | **0** — the whole event vanishes because part of it was corrected |
| Register membership, net of reversals (**B9**) | **700** |

The literal reading is untenable: a single partial reversal would erase the entire original recognition from the period, so a 300 correction against a 1,000 event would reduce reported revenue by 1,000. That is not what a reversal means anywhere else in this pack, and it is not what the frontend does — `analytics-engine.js` computes unattributed as a **residual of the recognized amount** rather than dropping the event (`FB-B9-021`, `FB-B9-022`).

An earlier draft claimed the `status` column was materialised *"so that the frozen phrase has a real column to mean"* while no selector filtered on it — asserting compliance with a reading B9 did not implement. `B9-AM-010` registers the clarification honestly instead. `status` is materialised for the reasons that are actually true: it gates source re-recognition and reversal eligibility (`B9_REVENUE_EVENT_MODEL.md` §5), and it is a frozen required DTO field.

**No B9 selector filters on `status`.** `AT-SEL-8` **(NC)**.

Every selector is parameterised by `(workspace_id, period_start, period_end)` over `recognized_at`, **grouped by currency**, and returns an `as_of` timestamp.

## 2. The canonical selectors

| Selector | Definition | Inputs |
|---|---|---|
| **Gross Recognized Revenue** | `Σ e.gross_amount` for events in period | `revenue_events` |
| **Reversed Revenue** | `Σ r.gross_amount` for reversals of events in period | `revenue_reversals` ⋈ `revenue_events` |
| **Net Recognized Revenue** | `Gross Recognized − Reversed` | both |
| **Net-contract Recognized** | `Σ e.net_amount − Σ r.net_amount` | both |
| **Attributed Revenue** | `Σ (e.gross − reversed(e))` over events **having** a `revenue_attributions` row | all three |
| **Attributed Revenue (net contract)** | `Σ (e.net − reversed_net(e))` over events **having** a `revenue_attributions` row | all three |
| **Unattributed Revenue** | `Net Recognized − Attributed` | all three |
| **Over-attributed Revenue** | `max(0, Attributed − Net Recognized)` — **must always be 0** | all three |
| **Revenue by Source** | Net attributed grouped by `(source_type, source_entity_type, source_public_id)`, with `origin_kind` and `source_code` as reported dimensions | all three |
| **Revenue by Period** | Net recognized grouped by day/month/quarter of `recognized_at` in workspace tz | events + reversals |
| **Revenue by Deal** | Net recognized where `source_entity_type='deal'`, grouped by `source_public_id` | events + reversals |
| **Revenue by Lead/Customer** | Net recognized grouped by the attribution snapshot's `lead_public_id` where present | all three |
| **Revenue by Currency** | every selector above, always | all three |
| **Reversal by Reason** | `Σ r.gross_amount` grouped by `reason` | reversals |
| **Unattributed Ratio** | `Unattributed ÷ Net Recognized`, null when the denominator is 0 | all three |

```
CANONICAL_SELECTOR_COUNT = 15
```

Because reversal `net` is derived proportionally (`B9_REVERSAL_MODEL.md` §4.1), the gross and net contracts stay in step by construction: **an event whose gross is fully reversed is fully reversed under the net contract too.** The converse is not asserted — rounding can leave the net contract exhausted while a gross residual remains, which the terminal gross-cleanup reversal closes (`B9-D-A040`). No selector is affected either way: both contracts are folds over the same two registers, and each reports exactly what its own register says at that moment.

## 3. The identity every selector must satisfy

```
Net Recognized Revenue  =  Attributed Revenue  +  Unattributed Revenue
```

Exact, per workspace, per currency, per period, and **separately at gross and at net** — the identity is asserted twice, once per contract, with a defined Attributed selector on each side (the net-contract row above was added by `B9-FIX.1`; the earlier draft asserted the identity "at net" while defining Attributed Revenue only in gross terms). It holds by construction: attributed and unattributed partition the same event set by the presence of an attribution row, and both subtract the same reversals. `AT-SEL-1`, `AT-SEL-9`.

`Over-attributed` is retained precisely because it must be zero (`B9_ATTRIBUTION_MODEL.md` §10); a non-zero value is a corruption alarm surfaced as the `over_attribution` reconciliation case, and mirrors the frozen frontend's own danger-flagged panel (`FB-B9-026`, `FB-B9-027`).

## 4. Frontend compatibility

The frozen frontend's analytics engine already computes exactly this shape (`FB-B9-021`, `FB-B9-022`, `FB-B9-023`, `FB-B9-026`), so B9's projections are a drop-in replacement for the mock's selectors:

| Frontend need | B9 selector |
|---|---|
| `revenue_total` / "الإيراد المعترف به" | Net Recognized Revenue |
| `attributed_revenue` / "الإيراد المنسوب" | Attributed Revenue |
| "غير منسوب" | Unattributed Revenue |
| "فوق المنسوب" | Over-attributed Revenue (always 0) |
| `getAttributionTraces` per-source cards | Revenue by Source |
| `getDataQuality.revenueWithoutAttribution` | count of events with no attribution row |
| `getDataQuality.brokenAttribution` | count of `attribution_unresolved` cases |
| Revenue tab per-event rows (`FB-B9-051`) | `GET /revenue-events/{id}/attribution` (op 6) — all eight rendered columns, including `owner_ref` and `touchpoint_count` |
| Revenue tab "المالك" / export `ownerId` | op 6's `owner_ref`, resolved live from the chain's Deal; the display name comes from B1/B6 (`B9-D-A042`) |
| Revenue tab "نقاط اللمس" / export `touchpointCount` | op 6's `touchpoint_count` — allocations made, `1` attributed and `0` unattributed in Phase 1 |
| Revenue tab chain pill / export `traceStatus` | op 6's `trace_status` |
| Trace modal chain (`FB-B9-052`) | op 6's `chain` and `attribution` |
| CSV export rows (`FB-B9-053`) | op 6 over the period's events — all fourteen columns; an export reveals exactly the API's own fields (`B9_SECURITY_PRIVACY.md` §4) |

A single-currency SAR workspace receives one currency row and the existing rendering is unchanged (`B9_CURRENCY_MONEY_MODEL.md` §6).

**Two mock behaviors are deliberately not reproduced**: revenue derived from attribution (`FB-B9-006`) and events dropped for incomplete provenance (`FB-B9-005`). Both are rejected fixture defects (`B9_FRONTEND_BEHAVIOR_INVENTORY.md` §4).

## 5. Restatement visibility

Because a reversal corrects its event's original period (`B9-D-A020`), a closed period's net figure can change. Two selectors make that legible rather than silent:

- **Reversal by Reason**, filtered by `reversed_at`, answers "what corrections were booked this month?"
- Every response carries `as_of`, so any figure is reproducible as "the register's truth at this instant."

## 6. Projection and freshness

B9 selectors are **computed from the register**, not stored. There is no materialised revenue total anywhere in B9 (`AT-FM-1` **NC**) — a stored total would be a second source of truth, and reconciling it would become a new class of defect.

If Analytics later materialises these for performance, it does so under its own ownership with an explicit freshness contract, and the B9 register remains authoritative. Frozen `BACKEND_DOMAIN_OWNERSHIP.md` already assigns Analytics "projection tables … no independent truth."

| Property | Value |
|---|---|
| Consistency | strongly consistent when read from the register |
| Cacheability | cacheable per `(workspace, period, currency, as_of)`; must be invalidated by any recognition or reversal in that workspace |
| Eventual consistency | permitted **only** in a downstream projection, never in the API's own reads |
| Reconciliation visibility | open-case counts by severity are exposed alongside totals so a dashboard can show that figures are under review |

## 7. Dashboard boundary

B9 supplies **financial truth and projections**; Dashboard owns **presentation and composition**.

| B9 | Dashboard |
|---|---|
| Selector definitions and values | Card layout, ordering, colour, locale |
| Per-currency rows | Choosing a display currency |
| Period totals for a requested window | Offering period pickers |
| `as_of` and open-case counts | Rendering freshness/health indicators |
| — | Combining revenue with pipeline, funnel or messaging metrics |

Dashboard **never** recomputes revenue and never derives it from Deals or payments — a rule the frozen frontend already follows (`FB-B9-044`: the dashboard consumes the analytics selector rather than recomputing). B9 does not duplicate Dashboard ownership and defines no card, layout, or composition.

## 8. Negative controls

`AT-SEL-2` **(NC)**: any selector reading `deals`, `payments`, `plans`, or `invoices` — fails.
`AT-SEL-3` **(NC)**: a selector treating `Deal.status='won'` or a payment status as recognized revenue — fails.
`AT-SEL-4` **(NC)**: a selector returning one scalar across currencies — fails.
`AT-SEL-5` **(NC)**: a selector omitting reversals from a "recognized revenue" figure — fails; net is the reported figure.
`AT-SEL-6` **(NC)**: a stored/materialised total inside B9 serving as the authoritative answer — fails.
`AT-SEL-7`: `Net Recognized = Attributed + Unattributed` holds in every generated scenario.
`AT-SEL-8` **(NC)**: a selector filtering `WHERE status = 'recognized'` — fails; it would erase a partially reversed event's surviving revenue (§1a).
`AT-SEL-9`: the identity holds independently under the gross contract and the net contract.
