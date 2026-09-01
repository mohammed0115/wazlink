# B6 — Domain Ownership

> **B6 status:** Target design only. Reuses frozen B0's Pipeline domain row (`BACKEND_DOMAIN_OWNERSHIP.md`) verbatim as its starting authority.

## 1. Frozen anchor, quoted

`BACKEND_DOMAIN_OWNERSHIP.md`: *"Pipeline | pipeline | Deal | pipelines, stages, deals | pipeline services | Pipeline, Lead360 | CreateDeal, MoveDealStage, CloseDeal | DealCreated, StageChanged, DealWon/Lost | none | no automatic RevenueEvent"* and *"Revenue | revenue | RevenueEvent | revenue_events, reversals | revenue service only | Analytics, finance ops | RecordRevenueEvent, ReverseRevenueEvent | RevenueRecognized, RevenueReversed | payment/invoice source | no DealWon implicit write"*.

B6 does not redefine either row. It specifies the Pipeline row precisely and proves the "no automatic RevenueEvent" / "no DealWon implicit write" forbidden couplings hold structurally (`B6_REVENUE_FIREWALL.md`).

## 2. OWNED

| Concept | Table(s) | Notes |
|---|---|---|
| `Deal` (aggregate root) | `deals` | Frozen aggregate name and table, per B0. |
| `Pipeline` | `pipelines` | Workspace-scoped configuration entity. |
| `PipelineStage` | `pipeline_stages` | Frozen B0 data-model table name (`pipeline_stages`, not the ownership matrix's shorthand `stages`). |
| `DealStageTransition` | `deal_stage_transitions` | **New, additive.** Immutable history row per successful transition (`B6_STAGE_TRANSITION_HISTORY.md`). Not addressed by its own public ID — reached only through its parent `Deal`, mirroring B5's non-independently-addressed `MessageDelivery` pattern. |
| Loss reason catalog | `deal_loss_reasons` | **New, additive.** Workspace-scoped catalog of `(code, label, active)`, keyed by stable `code`, not a UUID public-ID resource — mirrors how B1 treats `role` as a fixed/catalog value, not an independently addressable aggregate. |

`DealOutcome` (from the task's candidate list) is **not** a separate table — it is `Deal.status`/`Deal.loss_reason_code`, evaluated and rejected as a separate concept in `B6_WON_LOST_LOSS_REASONS.md` §1 to avoid a second, driftable outcome record. `DealActivity`/a commercial-timeline projection is **not** a separate B6-owned table — B6 exposes `source_event_id` on its own events and B2 projects them at read time (`B6_CRM_TIMELINE_PROJECTION.md`), exactly as B5 does for messaging; a duplicate B6-owned activity table would violate the single-source-of-truth rule `B2_NOTE_ACTIVITY_TIMELINE.md` §3 states for every other domain.

## 3. REFERENCED (read, never authoritative)

| Domain | What B6 reads | Why |
|---|---|---|
| B1 Tenant/Identity | `workspaces`, `memberships` | Workspace scope on every table; `owner_membership_id` resolution and RESTRICT semantics (`B6_OWNERSHIP_ASSIGNMENT.md`). |
| B2 CRM | `leads` | `Deal.lead_id` — the sole required cross-domain relationship (`B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md`). |

## 4. CONSUMED (cross-domain reads that are not FK relationships)

| Domain | What | Why |
|---|---|---|
| B4 Intelligence | `IntelligenceRun`/recommendation surface for a Lead's Business | Informs Deal-creation suggestion, priority, probability recommendation (`B6_B4_INTELLIGENCE_BOUNDARY.md`). Never a write path. |
| B5 Messaging | `GET /leads/{id}/conversations` (B5's own read contract) | Displays conversation existence/summary beside Deal context (`B6_B5_MESSAGING_BOUNDARY.md`). Never a write path. |

## 5. PROJECTED (B6 truth read elsewhere, at read time, never copied)

| Consumer | What it projects | Mechanism |
|---|---|---|
| B2 CRM timeline (Lead 360) | `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened`, `DealAssigned` | Read-time merge keyed on `source_event_id`, exactly as `B2_TIMELINE_IDENTITY_MODEL.md` already specifies for the `pipeline` source domain (`B6_CRM_TIMELINE_PROJECTION.md`). |
| Dashboard / Analytics | Open Pipeline, Weighted Pipeline, Won/Lost Deal counts | Frozen `BACKEND_ANALYTICS_SEMANTICS.md` metric rows, read-only projections over `deals`/`pipeline_stages` (`B6_READ_MODELS_QUERY.md`). |
| Lead 360 aggregate DTO | `deals[]` list | Frozen `BACKEND_DTO_CONTRACTS.md` already lists `deals` on the Lead360 DTO; B6 supplies the read contract, B2 assembles the aggregate. |

## 6. FORBIDDEN

| B6 must never | Why |
|---|---|
| Create, update, or reverse `RevenueEvent`, `AttributionTouchpoint`, payment, invoice, or billing-subscription truth | Frozen B0 Revenue row: "no DealWon implicit write"; frozen ADR-007; owned exclusively by the Revenue domain (future B9). See `B6_REVENUE_FIREWALL.md`. |
| Write `leads`, `contacts`, `lead_contacts`, `tasks`, `appointments`, or mutate `Lead.status` | B2's exclusive authority (`BACKEND_DOMAIN_OWNERSHIP.md` CRM row: "CRM services" is the sole allowed writer). |
| Write `conversations`, `messages`, `message_deliveries`, or trigger a provider send outside B5's governed `SendMessage`/`SendTemplateMessage` | B5's exclusive authority; B0's frozen Messaging row: "no Deal mutation" is the mirror-image forbidden coupling B6 must respect symmetrically. |
| Write `intelligence_runs`/signals, or accept an AI run ID as a Deal-mutation authorization input | B4's exclusive authority; mirrors `B5-D-A021`'s "recommendation existence ≠ authorization" pattern. |
| Write `crm_activities` directly | B2's exclusive authority; B6 exposes `source_event_id` only. |
| Grant a second, automation-only Deal-mutation transport path | Future B7 must call the identical governed commands (`B6_B7_AUTOMATION_BOUNDARY.md`). |

## 7. Ownership principle restated for Pipeline

Every `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions`, and `deal_loss_reasons` row carries `workspace_id` (B0's universal tenant-column rule). Cross-domain writes occur only through commands/application services and emit typed events; no ORM import crosses a bounded context, per B0's ownership principles, unchanged.
