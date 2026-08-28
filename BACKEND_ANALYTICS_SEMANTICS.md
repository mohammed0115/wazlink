# WazLink Backend Analytics Semantics

> Analytics is read-only and derives from canonical domain tables. It never becomes a second source of business truth.

## Global dimensions

All metrics are scoped by `workspace_id`. Event metrics use the event timestamp and the workspace timezone converted from stored UTC. Snapshot metrics use the current state at query time and are labeled as snapshots; they are not retroactively filtered by event period unless explicitly defined. Currency is the requested workspace/report currency; Phase 1 defaults to SAR while every monetary row still stores ISO currency.

| Metric | Type | Numerator | Denominator | Source/formula |
|---|---|---|---|---|
| Businesses discovered | event/period | unique Businesses first observed in selected period | none | DiscoveryResult/Business first-discovered timestamp |
| Leads created | event/period | unique Leads created in period | none | Lead.created_at |
| Lead conversion | cohort/event | Businesses converted to Lead in period | eligible unique Businesses in same cohort | conversion command/event |
| Open Pipeline | current snapshot | sum value of Deals currently `open` matching filters | none | Deal.value |
| Weighted Pipeline | current snapshot | sum `value × probability/100` for open Deals | none | Deal + Pipeline stage |
| Won Deals | event/period | Deals transitioned to `won` in period | none | DealWon event/closed_at |
| Lost Deals | event/period | Deals transitioned to `lost` in period | none | DealLost event/closed_at |
| Recognized Revenue | event/period | sum gross/net per selected contract | none | RevenueEvent.recognized_at where status recognized |
| Attributed Revenue | event/read | sum RevenueEvent amount allocated by valid touchpoints | recognized revenue | Attribution model; never exceeds RevenueEvent |
| Reply rate | event | conversations with qualifying reply | conversations with inbound requiring reply | Message events; only if product contract enabled |
| Automation runs | event | completed/failed runs | submitted runs | AutomationRun timestamps/status |
| Discovery performance | event | completed/partial/failed jobs and result counts | submitted jobs | DiscoveryJob state/timestamps |

Every returned metric includes `metric_id`, `value`, `currency` where relevant, `period`, `timezone`, `scope`, `semantics` (`event`, `current_snapshot`, `period_snapshot`, `cohort`), numerator/denominator metadata, and `source_contract_version`.

## Attribution

Phase 1 uses deterministic first-touch attribution: the earliest valid touchpoint for a Business/Lead chain receives the RevenueEvent allocation. A valid touchpoint must be workspace-scoped, linked to a Business/Lead or approved source identity, and occur no later than recognition unless the product contract explicitly allows later touches. Unattributed and over-attributed amounts are reported; allocation is clamped so attributed revenue never exceeds the source RevenueEvent. Last-touch and multi-touch are deferred read models.

## Contradiction prevention

Dashboard, Analytics, and Pipeline consume the same service/query contracts. Deal value is never used as Recognized Revenue. Won Deal count is an event/cohort metric; open Pipeline is a current snapshot. Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent unless an explicit cross-domain reporting contract is approved.
