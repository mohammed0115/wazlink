# B6 — Forecast and Probability

> **B6 status:** Target design only. Implements frozen `BACKEND_ANALYTICS_SEMANTICS.md`'s "Weighted Pipeline" metric row precisely.

## 1. Probability semantics

`Deal.probability` (integer, 0–100) represents a sales-judgment estimate of close likelihood. Seeding rule:

- On `CreateDeal` and every `MoveDealStage`, `probability := stage.default_probability` **unless the same command call supplies an explicit override**, in which case the override is stored instead.
- `UpdateDeal` may set `probability` directly at any time while `status='open'` (manual override).
- On `CloseDealWon`: forced to `100` (frozen `BACKEND_STATE_MACHINES.md`: "Won probability is 100"). Not overridable, not optional.
- On `CloseDealLost`: forced to `0` (frozen: "Lost is 0"). Not overridable.
- On `ReopenDeal`: re-seeded from the retained `stage_id`'s **current** `default_probability` (the stage's default may have changed via `UpdatePipelineStage` since the Deal last held it — the reopened Deal picks up the live default, not a stale snapshot, since there is no principled reason to prefer an outdated number over the stage's own current calibration).

This matches frontend evidence FB-D05 exactly: an override survives a stage move; its absence causes re-seeding from the new stage's default on every move.

## 2. Weighted value

```
weighted_value(deal) = deal.value × deal.probability / 100
```

**`B6-D-A010`: this is a forecast/sales-projection metric only, computed at read time, never persisted.** No table B6 owns carries a `weighted_value` column. It is computed identically wherever it is needed: the Pipeline board's per-stage column totals, the Deals list sort/display, the Deal360 hero figure, the top-of-page MetricStrip, and the frozen `BACKEND_ANALYTICS_SEMANTICS.md` "Weighted Pipeline" metric (`B6_READ_MODELS_QUERY.md` §3). This mirrors frontend evidence FB-D06 (the mock computes it inline at four independent call sites rather than storing it) and is deliberately carried forward as the target contract, since a stored/cached weighted value would need invalidation on every `value`, `probability`, or stage-default change and buys nothing a read-time computation doesn't already provide correctly.

**Rounding.** `ROUND_HALF_UP` to the currency's minor-unit precision (matches `BACKEND_DATA_MODEL.md`'s `NUMERIC(19,4)` money convention — the multiplication is performed at full precision and rounded only at presentation/aggregation time, never rounded mid-calculation and re-used).

## 3. Weighted pipeline aggregation and currency

`Σ weighted_value(deal)` over a filtered set of open Deals is **never summed across different `deal.currency` values** (`B6_CURRENCY_MODEL.md` §3). A workspace-level "Weighted Pipeline" figure is computed per currency bucket; Phase 1's single-workspace-currency convention (§`B6_CURRENCY_MODEL.md` §1) makes this a non-issue in practice, but the read-model query is written to bucket by currency structurally rather than assume it away, so a future multi-currency workspace does not silently produce a nonsensical cross-currency sum.

## 4. Forecast is not financial truth

**`weighted_value` and `Deal.probability` are never read by any recognized-revenue selector, never appear on a `RevenueEvent`, and never feed `RecordRevenueEvent`'s input in any automatic path** (`B6_REVENUE_FIREWALL.md` §4, negative control `AT-REV-5`). A sales forecast is, definitionally, a probabilistic estimate of a future outcome; recognized revenue is, definitionally, an accounting fact about a past event. Conflating the two — even by accident, via a shared table or a shared metric name — is exactly what `BACKEND_ANALYTICS_SEMANTICS.md`'s contradiction-prevention clause exists to forbid, and B6 does not create the seam that would allow it.

## 5. What is deferred

- Per-stage probability calibration tooling (e.g., "suggest a default probability from historical win rate at this stage") is `B6-D-C004`, Class C — no frontend evidence, and it would need B4-adjacent statistical machinery out of scope here.
- A confidence interval or range around the point-estimate probability is not modeled; `probability` is a single integer, matching the frozen DTO sketch and the frontend fixture's single-number field exactly.
