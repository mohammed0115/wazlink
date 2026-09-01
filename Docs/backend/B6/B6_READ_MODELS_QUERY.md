# B6 — Read Models and Query Semantics

> **B6 status:** Target design only. Read models project canonical `deals`/`pipelines`/`pipeline_stages` state; none is an authoritative write model.

## 1. Deal list

`GET /api/v1/deals` — the primary operational list, backing `Deals.tsx`'s target contract (`B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D22/D24). Filters: `pipeline_ref, stage_ref, owner_ref, status (default: open), lead_ref, business_ref, expected_close_date range, value range, probability floor`. Each row resolves Lead/Business/Stage by reference at query time — Deal itself stores no denormalized display copy of them beyond the `business_id` snapshot (`B6_DEAL_AGGREGATE.md` §3).

## 2. Pipeline board

`GET /pipelines/{id}/stages` + per-stage Deal counts/totals — backing `Pipeline.tsx`'s kanban view (FB-D14/D15). One query, grouped by `stage_id`, `status='open'` only (closed Deals never appear in a board column, matching frontend evidence exactly): `{stage, deal_count, total_value, weighted_value}` per open stage. **Not N+1 conceptually** — a single grouped aggregate query over `deals` joined to `pipeline_stages` for the target pipeline, not one query per stage.

## 3. Pipeline/Dashboard metrics — implementing frozen `BACKEND_ANALYTICS_SEMANTICS.md`

| Metric (frozen row) | B6 query |
|---|---|
| Open Pipeline | `Σ value` over `deals WHERE status='open'`, filtered/grouped by the requested scope, bucketed per `currency` (`B6_CURRENCY_MODEL.md` §3) |
| Weighted Pipeline | `Σ (value × probability / 100)` over the same set (`B6_FORECAST_PROBABILITY.md` §2) |
| Won Deals | `COUNT` of Deals with `DealWon` event in the requested period (event/period metric, not a snapshot — matches the frozen row's own `Type` column) |
| Lost Deals | `COUNT` of Deals with `DealLost` event in the requested period |
| Average won-deal value (additive, not in the frozen table but directly evidenced, FB-D40) | `AVG(value)` over `deals WHERE status='won'`, labeled "average won deal," never "revenue" |
| Win rate (additive, evidenced FB-D41) | `won_count / (won_count + lost_count)` over the requested period |

Every one of these is computed at read time from `deals`; none is a maintained counter column (mirrors `B5-D-A029`'s "computed, never cached" precedent).

## 4. Lead 360 `deals[]`

`Deal.lead_id`-scoped query, all statuses, `DealSummary` projection (`B6_API_DTO_CONTRACTS.md` §2), gated by `deal.view`, feeding the frozen Lead360 DTO's already-named `deals` field (`B6_CRM_TIMELINE_PROJECTION.md` §5). Corroborated directly by `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D30/D31 (Lead 360's inline open-deal panel plus the hero's all-status count).

## 5. Conversation Deal context

Symmetric to §4 but scoped through a Conversation's own `lead_id` (B5's own relationship), read by B5's context-composition query calling into B6's `getLeadDeals`-equivalent read model, never a B6-owned join against `conversations` directly (`B6_B5_MESSAGING_BOUNDARY.md` §2). Corroborated by FB-D33.

## 6. Deal transition history

`GET /deals/{id}/transitions` — direct read of `deal_stage_transitions`, cursor-paginated `(occurred_at DESC, id DESC)` (`B6_STAGE_TRANSITION_HISTORY.md` §4).

## 7. Non-authoritative, always

Every read model in this document is a projection over `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`. None is written to directly by any query path; every write goes exclusively through the commands in `B6_COMMAND_EVENT_CATALOG.md` §2. Aggregation never mutates Leads, Deals, Revenue, Billing, or entitlements — restated from frozen `BACKEND_ARCHITECTURE_DECISIONS.md`'s own architecture note, unchanged, applied to every query in this document.
