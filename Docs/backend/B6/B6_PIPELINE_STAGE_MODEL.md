# B6 — PipelineStage Model

> **B6 status:** Target design only. Resolves the task's explicit fork; not left ambiguous.

## 1. Won/Lost are Deal-level terminal outcomes, not PipelineStage rows

**`B6-D-A012` (Class A, resolved).** Three models were evaluated:

- **(A) Won/Lost as ordinary configurable stages** in the `pipeline_stages` list (e.g., a "Closed Won" and "Closed Lost" column at the end of the board).
- **(B) Won/Lost as Deal-level terminal outcomes** (`Deal.status`), structurally separate from the configurable, reorderable, deletable `pipeline_stages` list.
- **(C)** some hybrid.

**B6 adopts (B).** Reasons:

1. **The frozen sketch already separates them.** `BACKEND_DTO_CONTRACTS.md`'s Deal DTO carries both `stage_ref` and `status` as distinct fields — if Won/Lost were stages, `status` would be redundant with `stage_ref`. `BACKEND_STATE_MACHINES.md`'s frozen sketch shows `DealOpen → DealWon` / `DealOpen → DealLost` as **status** transitions, not stage-list entries.
2. **Operational safety.** A configurable stage list supports reorder, rename, and archive (`ReorderPipelineStages`, `ArchivePipelineStage`). If Won/Lost were ordinary rows in that list, reordering or (attempting to) archive a sentinel "Closed Won" stage would need special-cased protection scattered across every stage-administration command. Model (B) makes the protection structural instead: Won/Lost simply cannot appear in `pipeline_stages` at all, so no stage-administration command can ever touch them.
3. **Multi-pipeline cleanliness.** Every pipeline automatically has the identical, universal Won/Lost outcomes without needing to seed two sentinel stage rows into every new pipeline's stage list.
4. **History integrity.** `Deal.stage_id` freezes at its last open value on close (`B6_DEAL_AGGREGATE.md` §2) — "which stage was this deal in when it closed" is preserved precisely *because* closing is a status transition, not a stage move onto a terminal stage that could later be reordered/renamed/archived out from under the historical record.

## 2. Consequences, enumerated per the task's own list

| Consequence area | Effect of model (B) |
|---|---|
| **Stage reordering** | `ReorderPipelineStages` only ever reorders open, non-terminal stages. It can never accidentally reorder Won/Lost relative to the open stages, because they are not in the list to reorder. |
| **Stage deletion** | `ArchivePipelineStage` is guarded only against **open** Deals referencing it (§`B6_DATA_MODEL.md` §6). A stage that only Won/Lost Deals historically passed through **can** be archived — those Deals' `stage_id` still resolves (the row is archived, not deleted), and their `status` is already terminal so the "referenced by active deals" guard does not apply to them. |
| **Reporting** | "Open Pipeline" and "Weighted Pipeline" sum only `status='open'` Deals grouped by their live `stage_id`; "Won"/"Lost" counts are `status`-grouped, entirely independent of the stage list's current shape. |
| **Automation (future B7)** | A rule keyed on "Deal entered stage X" is a `DealStageChanged` consumer; a rule keyed on "Deal was won/lost" is a `DealWon`/`DealLost` consumer — two structurally distinct event types, never conflated. |
| **History** | `deal_stage_transitions.to_stage_id` is `NULL` for a transition into `won`/`lost` (`to_status` carries the outcome instead) — the schema itself cannot represent "moved into a stage called Won," reinforcing the separation at the storage layer. |
| **Reopen** | `ReopenDeal` (`won`/`lost` → `open`) restores `status='open'` and reuses the Deal's last-held `stage_id` (still valid, since stages are never deleted, only archived) as the reopened Deal's current stage — no ambiguity about "which stage does a reopened deal land in." |
| **Multiple pipelines** | Every pipeline's stage list is exclusively open/non-terminal stages; Won/Lost apply uniformly across every pipeline in the workspace without per-pipeline duplication. |

## 3. Stage ordering

`pipeline_stages.position` is a dense integer, unique within `(pipeline_id, active/archived_at IS NULL)`. `ReorderPipelineStages` accepts the full ordered list of stage IDs for one pipeline and rewrites `position` for all of them atomically (single transaction, single `version` bump per stage row) — never a partial reorder that could leave two stages sharing a position.

## 4. Default probability

`pipeline_stages.default_probability` (0–100) seeds `Deal.probability` whenever a Deal enters that stage via `MoveDealStage`, unless the same command call supplies an explicit override (`B6_FORECAST_PROBABILITY.md` §1). Changing a stage's `default_probability` via `UpdatePipelineStage` does **not** retroactively change `Deal.probability` on Deals already sitting in that stage — probability is a Deal-owned snapshot value, re-seeded only on the *next* stage entry, never live-derived from the stage row (this avoids a Deal's forecast silently shifting underneath a sales rep because an admin edited stage configuration).

## 5. Archive vs. active

Same two-lever model as `pipelines` (`B6_PIPELINE_MODEL.md` §4): `active=false` is a fast, reversible hide; `archived_at` is the permanent retirement, blocked only by the open-Deal-reference guard.
