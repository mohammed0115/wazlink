# B6 — Data Model

> **B6 status:** Target design only. Logical description only — no SQL, no migrations, no Django models are authorized, following B2/B3/B4/B5's identical discipline.

Inherited from B0 `BACKEND_DATA_MODEL.md`: UUIDv7 `id` internal, immutable prefixed `public_id`, UTC `created_at`/`updated_at`, optional `archived_at`, `workspace_id` on every tenant-owned row, `NUMERIC(19,4)` + ISO-4217 `currency` for money, JSONB restricted to provider metadata/raw snapshots/flexible metadata/audit before-after — never core relationships or state.

## 1. `pipelines`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | internal |
| `public_id` | text | `PIPE-<opaque>`, immutable, unique. Frozen registry section A. |
| `workspace_id` | UUID FK → `workspaces.id` RESTRICT | tenant column |
| `name` | text | 1–80 chars |
| `is_default` | boolean NOT NULL | exactly one `true` row per workspace (partial unique, §6) |
| `active` | boolean NOT NULL default `true` | inactive pipelines are hidden from creation pickers but remain readable |
| `archived_at` | timestamptz null | archive lifecycle, never hard-deleted |
| `version` | integer ≥ 1 | optimistic concurrency (ADR-046) |
| `created_at` / `updated_at` | timestamptz | UTC |

**Constraints/indexes:** unique `public_id`; partial unique `(workspace_id) WHERE is_default AND archived_at IS NULL`; index `(workspace_id, active)`.

## 2. `pipeline_stages`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | internal |
| `public_id` | text | `STG-<opaque>`, immutable, unique. Frozen registry section A. |
| `workspace_id` | UUID FK → `workspaces.id` RESTRICT | tenant column, denormalized for direct workspace-scoped queries |
| `pipeline_id` | UUID FK → `pipelines.id` RESTRICT | owning Pipeline; `pipeline.workspace_id == stage.workspace_id` enforced by command guard (mirrors B1 CRM-INV-16 pattern) |
| `name` | text | 1–60 chars |
| `position` | integer NOT NULL | display/progression order, unique within `(pipeline_id)` |
| `default_probability` | integer 0–100 | seeds `Deal.probability` on stage entry (`B6_FORECAST_PROBABILITY.md`) |
| `active` | boolean NOT NULL default `true` | inactive stages are hidden from new-assignment pickers |
| `archived_at` | timestamptz null | archive lifecycle; **forbidden while any open Deal references this stage** (`B6-DF-032`, `stage_referenced_by_active_deals`) |
| `version` | integer ≥ 1 | optimistic concurrency |
| `created_at` / `updated_at` | timestamptz | UTC |

**Constraints/indexes:** unique `public_id`; unique `(pipeline_id, position) WHERE archived_at IS NULL`; index `(workspace_id, pipeline_id, position)`.

**Explicitly absent:** `is_won`, `is_lost`, or any terminal-outcome flag. Won/Lost are never rows in this table (`B6-D-A012`, `B6_PIPELINE_STAGE_MODEL.md` §1). A stage row is always an **open, non-terminal** point in progression.

## 3. `deals`

See `B6_DEAL_AGGREGATE.md` §2 for the full field-by-field authority table. Column list:

`id, public_id (DEAL-*), workspace_id, lead_id, business_id, pipeline_id, stage_id, owner_membership_id, title, description, value, currency, probability, expected_close_date, status, loss_reason_code, loss_reason_note, created_at, updated_at, closed_at, won_at, lost_at, reopened_at, version`.

**Constraints/indexes:**
- Unique `public_id`.
- Composite check `stage.pipeline_id == pipeline_id` (command-guard-enforced, cross-table, same class of constraint as B1 CRM-INV-16 — PostgreSQL cannot declaratively express it across tables).
- Check `status IN ('open','won','lost')`; `probability BETWEEN 0 AND 100`; `value >= 0`; `version >= 1`.
- Check `status='won' ⇒ probability=100 AND won_at IS NOT NULL`; `status='lost' ⇒ probability=0 AND lost_at IS NOT NULL AND loss_reason_code IS NOT NULL`.
- Check `origin: lead_id IS NOT NULL` (Phase 1: no Deal without a Lead, `B6-D-A003`).
- Indexes: `(workspace_id, status)`, `(workspace_id, owner_membership_id)`, `(workspace_id, pipeline_id, stage_id)` — the B0 "deal/stage/status indexes" note, made concrete — plus `(workspace_id, lead_id)`, `(workspace_id, expected_close_date)`, `(workspace_id, updated_at DESC, public_id)`.
- Immutable after creation: `id`, `public_id`, `workspace_id`, `lead_id`, `business_id`, `pipeline_id`, `currency`, `created_at`.

## 4. `deal_stage_transitions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | internal; **no independent public ID** — reached only via `GET /deals/{id}/transitions` |
| `workspace_id` | UUID | tenant column |
| `deal_id` | UUID FK → `deals.id` RESTRICT | owning Deal |
| `from_stage_id` | UUID null FK → `pipeline_stages.id` RESTRICT | null only for the synthetic "created" row (§`B6_STAGE_TRANSITION_HISTORY.md` §1) |
| `to_stage_id` | UUID null FK → `pipeline_stages.id` RESTRICT | null for a transition into `won`/`lost` (the terminal outcome is `to_status`, not a stage) |
| `from_status` | text | `open`/`won`/`lost` |
| `to_status` | text | `open`/`won`/`lost` |
| `actor_membership_id` | UUID null FK → `memberships.id` RESTRICT | null for `system:automation` (reserved, unused Phase 1) |
| `reason_source` | text | `manual` \| `automation` (reserved) |
| `command_id` | UUID | the mutating command's idempotency identity — audit correlation |
| `deal_version_before` | integer | `Deal.version` immediately before this transition |
| `deal_version_after` | integer | `Deal.version` immediately after — always `deal_version_before + 1` |
| `occurred_at` | timestamptz NOT NULL | immutable business event instant, never a mutable field (mirrors `B2_TIMELINE_IDENTITY_MODEL.md` §2.4 discipline exactly) |
| `created_at` | timestamptz | row insert instant, append-only |

**Append-only.** No `UPDATE`, no `DELETE`. One row per successful transition, written inside the same transaction as the `Deal` row mutation it records (`B6_STAGE_TRANSITION_HISTORY.md`). Index `(workspace_id, deal_id, occurred_at DESC, id DESC)` — the identical ordering-index shape B2 uses for `crm_activities`.

## 5. `deal_loss_reasons`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | internal |
| `workspace_id` | UUID | tenant column; system-default rows use a sentinel shared row visible to every workspace (§`B6_WON_LOST_LOSS_REASONS.md` §3), workspace-authored rows are workspace-scoped |
| `code` | text | stable slug, e.g. `budget`, `timing`, `competitor`, `no_response`; **never reused after archive** |
| `label` | text | display label |
| `active` | boolean NOT NULL default `true` | inactive reasons cannot be selected on a *new* `CloseDealLost`, but remain valid on historical Deals |
| `archived_at` | timestamptz null | a reason referenced by any historical `deals.loss_reason_code` **cannot be hard-deleted**, ever — only archived |
| `created_at` / `updated_at` | timestamptz | UTC |

**Constraints/indexes:** unique `(workspace_id, code)`; index `(workspace_id, active)`. No public-ID prefix — addressed by `code` within workspace scope, mirroring how B1 addresses `role` by a fixed code rather than a UUID public ID.

## 6. Cross-table invariants

| Invariant | Enforcement |
|---|---|
| `deal.workspace_id == lead.workspace_id` | command-guard, Doctrine R-2 relationship injection (`B1_AUTHORIZATION_RBAC.md` §4, already frozen for `Deal → Lead`) |
| `deal.workspace_id == pipeline.workspace_id == stage.workspace_id` | command-guard, Doctrine R-2, `stage.pipeline_id == pipeline.id` (already frozen verbatim) |
| `deal.business_id == lead.business_id` (at creation, then frozen) | command-guard at `CreateDeal` time only — `business_id` is a snapshot, not a live FK re-check (`B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §2) |
| exactly one `pipelines.is_default = true` per workspace | partial unique index, §1 |
| a `pipeline_stages` row cannot be archived while any `deals.status='open'` references it | command guard on `ArchivePipelineStage`, failure `stage_referenced_by_active_deals` |
| the default `pipelines` row cannot be archived while it is the workspace's only active pipeline | command guard on `ArchivePipeline`, failure `cannot_delete_default_pipeline` |
