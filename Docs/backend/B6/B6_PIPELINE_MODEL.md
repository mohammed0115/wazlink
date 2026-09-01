# B6 — Pipeline Model

> **B6 status:** Target design only.

## 1. Multiple pipelines per workspace

**`B6-D-A011`: Phase 1 architecturally supports multiple pipelines per workspace, but every workspace is provisioned with exactly one `is_default=true` Pipeline, auto-created alongside the workspace (or lazily on first Deal creation if the workspace predates B6's rollout).** The data model (`pipelines.is_default`, partial-unique per workspace) does not hard-code a single-pipeline assumption, so a later product decision to expose a "create pipeline" UI needs no schema change — but Phase 1 ships with no such UI, and `pipeline.manage` (§3) exists from day one even though its "create a second pipeline" capability may go unused until a later phase surfaces it in the frontend. This mirrors the corpus-wide discipline of building the governed command even when the UI affordance is deferred (e.g., B5 reserving `senderType='system'` before B7 exists).

## 2. Default pipeline

- Exactly one `pipelines.is_default = true` row per workspace at all times (enforced by partial unique index, `B6_DATA_MODEL.md` §6).
- `CreateDeal` without an explicit `pipeline_id` uses the workspace's default pipeline.
- The default pipeline **cannot be archived while it is the workspace's only active pipeline** — `ArchivePipeline` on it fails `409 CONFLICT` \| `cannot_delete_default_pipeline` unless another active pipeline is first promoted to default (`SetDefaultPipeline` is **not** a separate command in Phase 1; promoting a new default is a field on `UpdatePipeline`, `is_default: true`, which atomically demotes the prior default in the same transaction).

## 3. Configuration permission

Pipeline/Stage administration (`CreatePipeline`, `UpdatePipeline`, `ArchivePipeline`, `CreatePipelineStage`, `UpdatePipelineStage`, `ReorderPipelineStages`, `ArchivePipelineStage`) is gated by the new additive permission **`pipeline.manage`** (`B6_ENTITLEMENT_RBAC_TENANCY.md` §2) — a higher-trust, admin-tier action distinct from ordinary `deal.*` operations a sales rep performs daily, mirroring the precedent B5 set for `messaging.provider.manage` (credential/configuration actions sit above ordinary-use actions in every domain that has both).

## 4. Active/inactive vs. archived

| State | Meaning | Effect |
|---|---|---|
| `active=true, archived_at=NULL` | normal, selectable | appears in every picker/board |
| `active=false, archived_at=NULL` | temporarily hidden | not offered for *new* Deal creation or pipeline-switch, but existing Deals referencing it are unaffected and it remains fully readable |
| `archived_at IS NOT NULL` | permanently retired | same read-only behavior as `active=false`, plus it can never be reactivated (`archived_at` is the one-way archive lifecycle every B0-modeled entity uses) |

`active` and `archived_at` are deliberately two different lifecycle levers (mirroring `pipeline_stages` and every other B0-pattern table): `active=false` is a fast, reversible "hide it for now" toggle available under `pipeline.manage`; `archived_at` is the permanent, one-way retirement already guarded by the "cannot archive the sole default pipeline" rule in §2.

## 5. Versioning

`pipelines.version` — every `UpdatePipeline`/`ArchivePipeline` requires `If-Match`. A pipeline rename racing a `SetDefaultPipeline`-via-`UpdatePipeline` call is resolved by the same optimistic-concurrency machinery as every other B6 mutation (`B6_CONCURRENCY_IDEMPOTENCY.md`) — no special case.

## 6. What Pipeline does not do

- A Pipeline does not itself carry a `value`/`probability`/`status` — those are Deal-level. "Open Pipeline" and "Weighted Pipeline" (frozen `BACKEND_ANALYTICS_SEMANTICS.md` metric rows) are **aggregations over Deals filtered by pipeline**, computed at read time, never a maintained counter column on `pipelines` (mirrors `B5-D-A029`'s "unread count is computed, never cached" reasoning applied to pipeline totals).
- A Pipeline does not gate RBAC beyond `pipeline.manage` for its own administration; which Deals a caller may see/mutate is governed entirely by `deal.view`/`deal.*` plus the object-level `assigned/team scope` condition already frozen in `B1_AUTHORIZATION_RBAC.md` — a Pipeline is not itself a permission boundary.
