# B6 — Command and Event Catalog

> **B6 status:** Target design only. Preserves the frozen B0 event envelope verbatim (§4). Retains frozen commands/events under their exact frozen names — no rename, unlike B4's `AnalyzeLead`/`LeadIntelligenceCompleted` situation.

## 1. Frozen commands/events — resolution, stated plainly

| Frozen artifact | Frozen state | B6 target | Classification |
|---|---|---|---|
| `CreateDeal` (command, `BACKEND_COMMAND_EVENT_CATALOG.md`) | generic, unspecified shape | retained, fully specified as §2's primary creation command | `COMPATIBLE_REFINEMENT` |
| `MoveDealStage` (command) | generic | retained, specified as the stage-progression command | `COMPATIBLE_REFINEMENT` |
| `CloseDealWon` (command) | generic | retained, specified | `COMPATIBLE_REFINEMENT` |
| `CloseDealLost` (command) | generic | retained, specified | `COMPATIBLE_REFINEMENT` |
| `DealCreated` (event) | generic | retained; fires on `CreateDeal` | `COMPATIBLE_REFINEMENT` |
| `DealStageChanged` (event) | generic | retained; fires on `MoveDealStage` | `COMPATIBLE_REFINEMENT` |
| `DealWon` (event) | generic | retained; fires on `CloseDealWon` | `COMPATIBLE_REFINEMENT` |
| `DealLost` (event) | generic | retained; fires on `CloseDealLost` | `COMPATIBLE_REFINEMENT` |

No frozen command or event name is superseded or renamed. Frozen B0's Pipeline row was already written compatibly with everything B6 needs — the four frozen commands and four frozen events already match B6's target shape exactly, so B6 has no non-additive amendment to make on this axis at all, matching B5's identical "most purely additive phase so far" finding, extended one phase further.

**Naming note carried from `B6_DEAL_AGGREGATE.md` §1:** the frozen DTO field is `value`, not `amount` — every DTO/payload below uses `value`.

## 2. Commands

| Command | Actor/system | Target | Idempotency | Precondition | Effect |
|---|---|---|---|---|---|
| `CreateDeal` **(frozen, specified)** | actor | `[LEAD-*]` | `Idempotency-Key` required | Lead exists, in-workspace, not archived; Pipeline/Stage in-workspace, `stage.pipeline_id == pipeline_id` | admits one `Deal`, `status=open` |
| `UpdateDeal` **(additive)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | `status=open` | updates `title`/`description`/`value`/`probability`/`expected_close_date` |
| `MoveDealStage` **(frozen, specified)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | `status=open`; target stage active, in-workspace, same pipeline | `stage_id` updated, `probability` re-seeded unless overridden |
| `CloseDealWon` **(frozen, specified)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | `status=open`; explicit confirmation payload | `status=won`, `probability=100`, `won_at`/`closed_at` set, `stage_id` frozen |
| `CloseDealLost` **(frozen, specified)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | `status=open`; explicit confirmation; `loss_reason_code` required, valid catalog entry | `status=lost`, `probability=0`, `lost_at`/`closed_at` set, `stage_id` frozen |
| `ReopenDeal` **(additive)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | `status ∈ {won, lost}`; reason note required | `status=open`, `won_at`/`lost_at`/`closed_at`/`loss_reason_*` cleared, `probability` re-seeded, `reopened_at` set |
| `AssignDeal` **(additive)** | actor | `DEAL-*` | `Idempotency-Key` required; `If-Match` | target membership active, in-workspace | `owner_membership_id` updated |
| `CreatePipeline` **(additive)** | actor (admin) | new `Pipeline` | `Idempotency-Key` required | `pipeline.manage` | new `Pipeline`, `active=true` |
| `UpdatePipeline` **(additive)** | actor (admin) | `PIPE-*` | `Idempotency-Key` required; `If-Match` | `pipeline.manage` | `name`/`active`/`is_default` updated (atomic default-promotion demotes prior default) |
| `ArchivePipeline` **(additive)** | actor (admin) | `PIPE-*` | `Idempotency-Key` required; `If-Match` | `pipeline.manage`; not the sole default pipeline | `archived_at` set |
| `CreatePipelineStage` **(additive)** | actor (admin) | new `PipelineStage` | `Idempotency-Key` required | `pipeline.manage`; pipeline in-workspace | new `PipelineStage` appended at next `position` |
| `UpdatePipelineStage` **(additive)** | actor (admin) | `STG-*` | `Idempotency-Key` required; `If-Match` | `pipeline.manage` | `name`/`default_probability`/`active` updated |
| `ReorderPipelineStages` **(additive)** | actor (admin) | `PIPE-*` + its stages | `Idempotency-Key` required; per-stage `If-Match` | `pipeline.manage`; full ordered stage-ID list for the pipeline | `position` rewritten for every stage atomically |
| `ArchivePipelineStage` **(additive)** | actor (admin) | `STG-*` | `Idempotency-Key` required; `If-Match` | `pipeline.manage`; no `status=open` Deal references it | `archived_at` set |
| `CreateLossReason` / `UpdateLossReason` / `ArchiveLossReason` **(additive)** | actor (admin) | `deal_loss_reasons` row | `Idempotency-Key` required; `If-Match` on update/archive | `pipeline.manage`; archive forbidden only in the sense that referenced codes remain valid (§`B6_WON_LOST_LOSS_REASONS.md` §3.2 — archiving is always technically permitted, it merely stops future selectability) | catalog row created/updated/archived |

`COMMAND_COUNT = 12` counting only the Deal-lifecycle commands (`CreateDeal` through `AssignDeal`, matching the task's own primary command list) — **4 frozen-refined** (`CreateDeal`, `MoveDealStage`, `CloseDealWon`, `CloseDealLost`) **+ 8 additive** (`UpdateDeal`, `ReopenDeal`, `AssignDeal`, plus the 7 Pipeline-administration commands are counted separately in §2.1 below, matching the task's own "Pipeline administration commands if Phase 1 supports configuration" as a distinct enumerated group rather than folded into the primary Deal count). See §2.1 for the full combined total.

### 2.1 Full combined count, stated unambiguously

| Group | Count | Names |
|---|---|---|
| Frozen-refined Deal commands | 4 | `CreateDeal`, `MoveDealStage`, `CloseDealWon`, `CloseDealLost` |
| Additive Deal commands | 3 | `UpdateDeal`, `ReopenDeal`, `AssignDeal` |
| Additive Pipeline/Stage administration commands | 7 | `CreatePipeline`, `UpdatePipeline`, `ArchivePipeline`, `CreatePipelineStage`, `UpdatePipelineStage`, `ReorderPipelineStages`, `ArchivePipelineStage` |
| Additive Loss-reason catalog commands | 3 | `CreateLossReason`, `UpdateLossReason`, `ArchiveLossReason` |
| **Total** | **17** | 4 frozen-refined + 13 additive |

`FROZEN_REUSED_COMMAND_COUNT = 4`. `ADDITIVE_COMMAND_COUNT = 13`. `COMMAND_COUNT = 17`. (The task's own §22 candidate list under-enumerates the catalog administration commands relative to what §9/§10's design questions require once Won/Lost-as-status and a real loss-reason catalog are resolved — the full, accurate count is reported here rather than force-fit to a smaller candidate number, per the task's own instruction not to "artificially downgrade" or, symmetrically, artificially undercount, architecture-critical surface.)

## 3. Events

| Event | Payload | Delivery | Idempotency identity |
|---|---|---|---|
| `DealCreated` **(frozen, refined)** | `{deal_public_id, lead_public_id, business_public_id, pipeline_public_id, stage_public_id, owner_ref, value, currency, probability, created_at}` | transactional outbox | `(deal_public_id)` unique |
| `DealStageChanged` **(frozen, refined)** | `{deal_public_id, from_stage_public_id, to_stage_public_id, probability, occurred_at}` | transactional outbox | event-envelope `event_id` |
| `DealWon` **(frozen, refined)** | `{deal_public_id, lead_public_id, value, currency, won_at}` | transactional outbox | `(deal_public_id, 'won')` unique |
| `DealLost` **(frozen, refined)** | `{deal_public_id, lead_public_id, value, currency, loss_reason_code, lost_at}` | transactional outbox | `(deal_public_id, 'lost')` unique |
| `DealReopened` **(additive)** | `{deal_public_id, from_status, reason_note, reopened_at}` | transactional outbox | event-envelope `event_id` |
| `DealAssigned` **(additive)** | `{deal_public_id, from_owner_ref (nullable — never null in practice, §`B6_OWNERSHIP_ASSIGNMENT.md` §5, but the field is nullable for schema symmetry with B5's `ConversationAssigned`), to_owner_ref, occurred_at}` | transactional outbox | event-envelope `event_id` |
| `DealUpdated` **(additive)** | `{deal_public_id, changed_fields[], occurred_at}` | transactional outbox | event-envelope `event_id` |

`EVENT_COUNT = 7` (4 frozen-refined, 3 additive). **`DealWon` MUST NOT emit `RevenueRecognized`** — restated verbatim from frozen `BACKEND_COMMAND_EVENT_CATALOG.md` — see `B6_REVENUE_FIREWALL.md` for the full structural proof. No Pipeline/Stage-administration command emits a cross-domain event in Phase 1 (their effects are visible only via `GET` reads, matching B5's identical "not every mutation needs an event" discipline for its own configuration-tier commands).

## 4. Consumed events

**`CONSUMED_EVENT_COUNT = 0`. B6 subscribes to nothing.** Every B6 dependency (Lead resolution, membership resolution) is a synchronous, on-demand read of another domain's own contract (`B6_B2_HANDOFF_CONTRACT.md`), mirroring `B4_COMMAND_EVENT_CATALOG.md` §4's and `B5_COMMAND_EVENT_CATALOG.md` §4's identical "zero consumed events, no circular dependency" precedent, now three phases running. `LeadIntelligenceCompleted`/`BusinessIntelligenceCompleted` and any B5 messaging event are informative to a human operator via read-time UI composition at most, never load-bearing to B6's own correctness.

## 5. Event envelope

Frozen, verbatim, unchanged: *"All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID."* `EVENT_ENVELOPE_DRIFT_FROM_B0 = 0` — every B6 event above carries exactly this envelope; none adds a field to it.

## 6. `source_event_id` — the B2 timeline contract

Every event in §3 exposes a stable `source_event_id` (the event envelope's own `event_id`) satisfying `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1's requirements exactly: stable across replay, distinguishes multiple events from the same `DEAL-*` aggregate, never the aggregate's public ID, never `version`, never a mutable position. See `B6_CRM_TIMELINE_PROJECTION.md` for the full read-time-merge contract.
