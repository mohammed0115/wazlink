# B6 — API and DTO Contracts

> **B6 status:** Target design only. Elaborates the frozen `BACKEND_API_CATALOG.md`/`BACKEND_DTO_CONTRACTS.md` sketch (`GET/POST /api/v1/deals`, `POST /deals/{id}/stage`, `POST /deals/{id}/close`) into a complete surface. Uses frozen `/api/v1/` conventions.

## 1. Endpoints

| Method | Path | operationId | Permission | Request DTO | Response | Notes |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/deals` | `listDeals` | `deal.view` | — (query params) | `DealList` (200) | cursor-paginated, `filters`/`sort` allow-listed (§`B6_READ_MODELS_QUERY.md` §1) |
| `POST` | `/api/v1/deals` | `createDeal` | `deal.create` | `DealCreate` | `Deal` (201) | `Idempotency-Key` required |
| `GET` | `/api/v1/deals/{id}` | `getDeal` | `deal.view` | — | `Deal` (200) | `404` cross-workspace-indistinguishable |
| `PATCH` | `/api/v1/deals/{id}` | `updateDeal` | `deal.update` | `DealUpdate` | `Deal` (200/409) | `If-Match` required |
| `POST` | `/api/v1/deals/{id}/stage` | `moveDealStage` | `deal.update` | `StageMove` | `Deal` (200/409) | `If-Match`, `Idempotency-Key` required |
| `POST` | `/api/v1/deals/{id}/won` | `closeDealWon` | `deal.close` | `CloseDealWon` | `Deal` (200/409) | explicit `confirm:true` field required |
| `POST` | `/api/v1/deals/{id}/lost` | `closeDealLost` | `deal.close` | `CloseDealLost` | `Deal` (200/409) | `loss_reason_code` required |
| `POST` | `/api/v1/deals/{id}/reopen` | `reopenDeal` | `deal.reopen` | `ReopenDeal` | `Deal` (200/409) | `reason_note` required |
| `POST` | `/api/v1/deals/{id}/assign` | `assignDeal` | `deal.assign` | `AssignDeal` | `Deal` (200/409) | |
| `GET` | `/api/v1/deals/{id}/transitions` | `listDealTransitions` | `deal.view` | — | `DealTransitionList` (200) | cursor-paginated |
| `GET` | `/api/v1/pipelines` | `listPipelines` | `deal.view` | — | `PipelineList` (200) | bounded collection, no cursor needed (small N) |
| `POST` | `/api/v1/pipelines` | `createPipeline` | `pipeline.manage` | `PipelineCreate` | `Pipeline` (201) | |
| `GET` | `/api/v1/pipelines/{id}` | `getPipeline` | `deal.view` | — | `Pipeline` (200) | |
| `PATCH` | `/api/v1/pipelines/{id}` | `updatePipeline` | `pipeline.manage` | `PipelineUpdate` | `Pipeline` (200/409) | `If-Match` |
| `POST` | `/api/v1/pipelines/{id}/archive` | `archivePipeline` | `pipeline.manage` | — | `Pipeline` (200/409) | `cannot_delete_default_pipeline` guard |
| `GET` | `/api/v1/pipelines/{id}/stages` | `listPipelineStages` | `deal.view` | — | `PipelineStageList` (200) | ordered by `position` |
| `POST` | `/api/v1/pipelines/{id}/stages` | `createPipelineStage` | `pipeline.manage` | `PipelineStageCreate` | `PipelineStage` (201) | |
| `PATCH` | `/api/v1/pipelines/{id}/stages/{stageId}` | `updatePipelineStage` | `pipeline.manage` | `PipelineStageUpdate` | `PipelineStage` (200/409) | `If-Match` |
| `POST` | `/api/v1/pipelines/{id}/stages/reorder` | `reorderPipelineStages` | `pipeline.manage` | `StageReorder` | `PipelineStageList` (200/409) | full ordered ID list |
| `POST` | `/api/v1/pipelines/{id}/stages/{stageId}/archive` | `archivePipelineStage` | `pipeline.manage` | — | `PipelineStage` (200/409) | `stage_referenced_by_active_deals` guard |
| `GET` | `/api/v1/pipeline/loss-reasons` | `listLossReasons` | `deal.view` | — | `LossReasonList` (200) | |
| `POST` | `/api/v1/pipeline/loss-reasons` | `createLossReason` | `pipeline.manage` | `LossReasonCreate` | `LossReason` (201) | |
| `PATCH` | `/api/v1/pipeline/loss-reasons/{code}` | `updateLossReason` | `pipeline.manage` | `LossReasonUpdate` | `LossReason` (200/409) | `If-Match` |
| `POST` | `/api/v1/pipeline/loss-reasons/{code}/archive` | `archiveLossReason` | `pipeline.manage` | — | `LossReason` (200) | never hard-deleted |

`PUBLIC_API_OPERATION_COUNT = 24` — recomputed mechanically as the row count of the table above (10 `/deals*` operations, 10 `/pipelines*` operations, 4 `/pipeline/loss-reasons*` operations), the same self-counting discipline `B6_COMMAND_EVENT_CATALOG.md` §2.1 and `B6_FAILURE_CATALOG.md` apply to their own catalogs.

## 2. Request/response DTOs

| DTO | Fields |
|---|---|
| `Deal` | `public_id, lead_ref, business_ref, pipeline_ref, stage_ref, title, description, value, currency, probability, expected_close_date, status, owner_ref, loss_reason_code, loss_reason_note, created_at, updated_at, closed_at, won_at, lost_at, reopened_at, version` |
| `DealList` | `items: Deal[]`, `page_info: PageInfo` (frozen cursor shape) |
| `DealCreate` | `lead_ref (required), pipeline_ref (optional, defaults to workspace default), stage_ref (optional, defaults to pipeline's first stage), title (required), description, value (required), currency (optional, defaults to workspace default), probability (optional, defaults to stage default), expected_close_date, owner_ref (optional, defaults to lead owner)` — explicit allow-list; `status`, `public_id`, `version`, every timestamp rejected if present (`400 VALIDATION_ERROR`, Doctrine R-4) |
| `DealUpdate` | `title, description, value, probability, expected_close_date` — same allow-list discipline; `owner_ref` **not** accepted here (use `AssignDeal`); `stage_ref`/`status` **not** accepted here |
| `StageMove` | `to_stage_ref (required), probability_override (optional)` |
| `CloseDealWon` | `confirm: true (required literal)` |
| `CloseDealLost` | `confirm: true (required literal), loss_reason_code (required), loss_reason_note (optional)` |
| `ReopenDeal` | `reason_note (required)` |
| `AssignDeal` | `owner_ref (required)` |
| `DealTransitionList` | `items: DealTransition[]`, `page_info` |
| `DealTransition` | `from_stage_ref, to_stage_ref, from_status, to_status, actor_ref, reason_source, occurred_at` — internal `command_id`/`deal_version_before/after` are **not** exposed on this public DTO (audit-internal, `B6_OBSERVABILITY_AUDIT.md`) |
| `Pipeline` | `public_id, name, is_default, active, version, created_at, updated_at` |
| `PipelineCreate` | `name (required)` |
| `PipelineUpdate` | `name, active, is_default` |
| `PipelineStage` | `public_id, pipeline_ref, name, position, default_probability, active, version` |
| `PipelineStageCreate` | `name (required), default_probability (required), position (optional, appends at end)` |
| `PipelineStageUpdate` | `name, default_probability, active` |
| `StageReorder` | `stage_refs: string[] (required, full ordered list)` |
| `LossReason` | `code, label, active` |
| `LossReasonCreate` | `code (required), label (required)` |
| `LossReasonUpdate` | `label, active` |

**Lead360 aggregate extension** (frozen `BACKEND_DTO_CONTRACTS.md`, unchanged shape, B6 supplies the values): `deals: Deal[]` — every Deal for the Lead, every status, summarized (not the full field set — a lighter `DealSummary` projection: `public_id, title, stage_ref, status, value, currency, probability, owner_ref`).

## 3. Validation, guards, versioning — applied uniformly

Every mutating endpoint: workspace-scoped resolution (Doctrine R-1), relationship injection for `lead_ref`/`pipeline_ref`/`stage_ref` (Doctrine R-2, §`B6_ENTITLEMENT_RBAC_TENANCY.md` §1), mass-assignment allow-listing (Doctrine R-4), `If-Match`/`expected_version` on every non-`POST /deals` mutation, `Idempotency-Key` on every command (`B6_CONCURRENCY_IDEMPOTENCY.md` §3).

## 4. Pagination, filtering, sorting

`GET /deals` is cursor-paginated (`PageInfo`, frozen shape) with allow-listed `filters`/`sort` — mirroring `BACKEND_API_CATALOG.md` §"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`," already frozen to explicitly include this exact endpoint. Filter fields: `pipeline_ref, stage_ref, owner_ref, status, lead_ref, business_ref, expected_close_date_range, value_range, probability_min`. Sort options: `updated_desc (default), created_desc, expected_close_asc, value_desc, weighted_value_desc, probability_desc`. `GET /pipelines`, `GET /pipelines/{id}/stages`, `GET /pipeline/loss-reasons` expose pagination only (bounded collections, no generic filter/sort, matching `BACKEND_API_CATALOG.md`'s stated pattern for `GET /workspaces`/`/plans`/`/entitlements`). `GET /deals/{id}/transitions` exposes cursor pagination only, ordered `(occurred_at DESC, id DESC)`, no filter/sort.

## 5. Errors

Every response uses the frozen error envelope (`BACKEND_ERROR_CATALOG.md`) unchanged. New B6-specific codes are enumerated in `B6_FAILURE_CATALOG.md` — no new error *envelope shape*, no new HTTP-status doctrine, only new `code` values within the existing taxonomy (mirroring how B3/B4/B5 each added domain codes without touching the envelope).
