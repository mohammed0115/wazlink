# B6 — Currency Model

> **B6 status:** Target design only. Uses frozen platform money conventions (`NUMERIC(19,4)` + ISO-4217) unchanged; invents no FX subsystem.

## 1. Workspace default and Deal currency

`BACKEND_ANALYTICS_SEMANTICS.md` already states: *"Currency is the requested workspace/report currency; Phase 1 defaults to SAR."* B6 adopts this directly: every workspace has an implicit default currency (Phase 1: `SAR` for every workspace, matching frontend evidence FB-D04's hard-coded, uncontested `SAR` literal with zero currency-selector UI anywhere in the mock). `Deal.currency` defaults to the workspace's default currency at `CreateDeal` and is **immutable after creation** — matching the immutability convention already frozen for `UpgradeQuote.currency` (`BACKEND_IDEMPOTENCY_STANDARD.md`/`BACKEND_DATA_MODEL.md`'s money-row discipline) and preventing a Deal's historical value from silently changing meaning mid-lifecycle.

**`B6-D-A008` (Class A, resolved).** Multi-currency Deals are technically representable (the column exists and is not constrained to a single literal value at the schema level), but Phase 1 exposes no currency-selection UI and no cross-currency conversion — a Deal's currency is simply whatever the workspace default was at the moment it was created. If a future phase needs true multi-currency support (e.g., an agency selling in both SAR and USD), that is an explicit, separate product decision (`B6-D-C002`, Class C) requiring an FX-rate source this document deliberately does not invent.

## 2. Precision and minor units

`value NUMERIC(19,4)` plus ISO-4217 `currency`, matching `BACKEND_DATA_MODEL.md`'s universal money convention exactly — no domain-specific precision rule is introduced. Display rounding to the currency's conventional minor-unit count (2 decimal places for SAR) happens at the API/presentation layer only; the stored value retains full `NUMERIC(19,4)` precision.

## 3. Pipeline totals never silently cross currencies

"Open Pipeline" and "Weighted Pipeline" (`B6_READ_MODELS_QUERY.md` §3) are computed **per currency bucket**. If every Deal in a workspace shares the workspace default currency (the only configuration Phase 1's UI actually produces), this collapses to one bucket and is indistinguishable from a naive single-currency sum. The query is written to group by `currency` structurally, so a workspace that later accumulates Deals in more than one currency (however that came to be) never produces a silently-wrong summed total across incompatible currencies — it produces multiple correctly-labeled per-currency totals instead of one meaningless number.

## 4. No FX subsystem in B6

B6 does not convert between currencies, does not store exchange rates, and does not expose a "pipeline value in SAR-equivalent" figure for a multi-currency workspace. Cross-currency aggregation, if ever required, is explicitly deferred to a future domain (B9/Analytics) that would own an authoritative rate source — this document names the deferral rather than inventing a placeholder rate (`B6-D-C002`).

## 5. RevenueEvent currency is independent

`RevenueEvent.currency` (Revenue domain, future B9) is set by whatever recognition process creates it and is **never derived from or validated against `Deal.currency`** by any B6 code path — B6 has no write or read access to `revenue_events` at all (`B6_REVENUE_FIREWALL.md` §2). A Deal closed in one currency and a RevenueEvent later recorded in a different currency (e.g., an actual payment settled in a different currency than the quoted deal) is entirely B9's concern, not a B6 consistency check.
