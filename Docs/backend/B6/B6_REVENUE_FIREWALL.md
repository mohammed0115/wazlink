# B6 — Revenue Firewall

> **B6 status:** Target design only. **Mandatory document.** This is the single most important proof in the B6 pack: B6 cannot create or mutate `RevenueEvent`, `RevenueAttribution`, payment, invoice, or billing truth, under any transition, at any point.

## 1. The frozen anchor this document proves compliance with

B6 does not invent this boundary — it inherits it, already committed, from three independent frozen sources that predate B6:

| Source | Quote |
|---|---|
| `BACKEND_DOMAIN_OWNERSHIP.md` | Pipeline row forbidden coupling: **"no automatic RevenueEvent."** Revenue row forbidden coupling: **"no DealWon implicit write."** Revenue's allowed writers: **"revenue service only."** |
| `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007 | **"`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent."** |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | **"`DealWon` MUST NOT emit `RevenueRecognized` by default. `RevenueRecognized` requires the separate `RecordRevenueEvent` command or an explicitly approved payment/invoice rule with a documented source."** |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | **"`DEAL-*` does not imply `REV-*`; a `REV-*` exists only after the explicit revenue-recognition command."** |
| `BACKEND_ANALYTICS_SEMANTICS.md` | Contradiction-prevention clause: **"Deal value is never used as Recognized Revenue. Won Deal count is an event/cohort metric; open Pipeline is a current snapshot."** |
| `BACKEND_ERD.md` | `DEAL ||--o{ REVENUE_EVENT : may_reference` — a Deal *may* be referenced *by* a RevenueEvent (as the RevenueEvent's polymorphic `source_ref`), never the reverse; and even that reference is optional (`may_reference`), never automatic. |

B6's obligation is to design a Deal aggregate, command set, and event set that cannot violate any of the above — and to prove it with negative-control tests, not merely assert it.

## 2. Structural unreachability, not policy-only

**Table access.** No B6 command has write access to `revenue_events`, `revenue_reversals` (frozen B0 Revenue table group), `attribution_touchpoints`, `upgrade_quotes`, `invoices`, `payments`, or any Billing/Tax table. `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions`, `deal_loss_reasons` are the entirety of B6's write surface (`B6_DOMAIN_OWNERSHIP.md` §2). This is not a permission check that could be misconfigured — B6's application-service layer has no import, no foreign-key write path, and no ORM manager reference to any Revenue/Billing table, mirroring B0's "ORM imports across bounded contexts are not permitted in domain code" rule.

**Event production.** B6's complete, closed event list (`B6_COMMAND_EVENT_CATALOG.md`) is `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened`, `DealAssigned`. **`RevenueRecognized` and `RevenueReversed` do not appear in it and are not producible by any B6 command.** Only the Revenue domain's own `RecordRevenueEvent`/`ReverseRevenueEvent` commands (frozen B0) can emit them.

**`DealWon` is a distinct event, semantically inert to revenue.** Its payload (`B6_COMMAND_EVENT_CATALOG.md` §3) carries `deal_public_id`, `lead_public_id`, `value`, `currency`, `won_at` — a sales-outcome record. It carries **no** `recognized_amount`, no `revenue_status`, and is not itself consumed by any B6-owned process that would create one.

## 3. `Deal.value` is unreachable as financial truth

`Deal.value` is documented (`B6_DEAL_AGGREGATE.md` §1) as expected/proposed commercial value. It is:

- **never** copied into `RevenueEvent.gross`/`net` by any B6 process (B6 has no write path to that table at all, §2);
- **never** exposed by a DTO field named or documented as revenue (`B6_API_DTO_CONTRACTS.md`'s `Deal`/`DealList` responses label it `value`, not `revenue` or `recognized_revenue`);
- **never** aggregated by B6's own read models under a "revenue" metric name — "Open Pipeline" and "Weighted Pipeline" (`B6_READ_MODELS_QUERY.md`) are explicitly labeled forecast/sales-projection metrics, matching the frozen `BACKEND_ANALYTICS_SEMANTICS.md` rows they implement, never relabeled as revenue.

## 4. Negative controls (see `B6_ACCEPTANCE_TESTS.md` for the full IDs)

| # | Claim | How B6 proves it |
|---|---|---|
| 1 | Won Deal does not create RevenueEvent | Structural: no write path (§2). `AT-REV-1 (NC)`: `CloseDealWon` executed; assert zero rows written to `revenue_events` and zero `RevenueRecognized` events on the outbox. |
| 2 | Changing `Deal.value` does not change Recognized Revenue | Structural: `UpdateDeal` touches only `deals.value`; `RevenueEvent.gross`/`net` are immutable once recognized (Revenue domain's own rule) and are never read from `deals` at all. `AT-REV-2 (NC)`. |
| 3 | Deleting/reopening a Deal does not reverse an existing RevenueEvent | `ReopenDeal` has no write path to `revenue_events`/`revenue_reversals` (§2); B6 has no `DeleteDeal` command at all (Deals are never hard-deleted, only closed/reopened — §`B6_DATA_MODEL.md` §3, no `deleted_at` column exists on `deals`). `AT-REV-3 (NC)`, mirrors `B6_WON_LOST_LOSS_REASONS.md` §4's reopen table. |
| 4 | Pipeline totals do not become financial revenue | "Open Pipeline"/"Weighted Pipeline" are computed, uncached, workspace-scoped snapshots over `deals`, structurally distinct query paths from "Recognized Revenue"/"Attributed Revenue" (which query `revenue_events`/`attribution_touchpoints` exclusively) — frozen `BACKEND_ANALYTICS_SEMANTICS.md`'s own table already keeps these as separate metric rows with separate `source/formula` columns; B6 introduces no query that unions them. `AT-REV-4 (NC)`. |
| 5 | Forecast does not become recognized revenue | `weighted_value = Deal.value × probability/100` (`B6_FORECAST_PROBABILITY.md`) is computed at read time only, in the Analytics/read-model layer, never persisted to any table B6 or Revenue owns, and never flows into `RecordRevenueEvent`'s input in any automatic path — `RecordRevenueEvent` is a Revenue-domain command whose caller and inputs are entirely outside B6's authority. `AT-REV-5 (NC)`. |

## 5. The one legitimate, non-automatic link

Frozen `BACKEND_ERD.md`: `DEAL ||--o{ REVENUE_EVENT : may_reference`. A future B9 (Finance/Revenue) financial-recognition workflow **may** create a `RevenueEvent` whose polymorphic `source_type`/`source_ref` (frozen `BACKEND_DTO_CONTRACTS.md`: *"`source_type` + `source_ref` is the canonical polymorphic source contract"*) happens to point at a `DEAL-*`. This is:

- **initiated exclusively by B9's own governed `RecordRevenueEvent` command**, called by a B9-authorized actor or an explicitly approved recognition rule — never by any B6 command, never as a side effect of `CloseDealWon`;
- **read-only from B6's perspective** — B6 never observes, blocks, or reacts to a `RevenueEvent` being created against one of its Deals; the relationship is legible only by querying `RevenueEvent.source_ref`, a query B6 does not perform and is not required to support;
- **not designed in detail here.** Per the task's explicit boundary (§0/§41: "do NOT design B9 financial recognition in detail"), B6 states only that the door is structurally available for B9 to walk through later, on B9's own terms, and that B6 itself never walks through it.

## 6. Closure statement

`REVENUE_EVENT_PRODUCERS_IN_B6 = 0`. `RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0`. Every claim above is either a structural fact (no write path exists) or a negative-control test (`B6_ACCEPTANCE_TESTS.md` §"Revenue firewall"). WON DEAL ≠ RECOGNIZED REVENUE holds by construction, not by convention.
