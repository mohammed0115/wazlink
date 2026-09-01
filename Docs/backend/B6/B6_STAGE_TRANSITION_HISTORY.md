# B6 — Stage Transition History

> **B6 status:** Target design only. `deal_stage_transitions` is a new, additive B6-owned table (`B6_DATA_MODEL.md` §4).

## 1. Why history cannot be derived from `Deal.stage_id` alone

`Deal.stage_id` is a single current-value column. It cannot answer "which stages did this Deal pass through, in what order, moved by whom, when" — exactly the class of question the task requires B6 to answer. `deal_stage_transitions` is the append-only, immutable record that makes every such question answerable without inference.

**The synthetic "created" row.** `CreateDeal` writes one `deal_stage_transitions` row with `from_stage_id = NULL`, `from_status = NULL`, `to_stage_id = <initial stage>`, `to_status = 'open'` — so a Deal's full path, including its origin, is always readable as a single ordered list from this one table, with no special-cased "first stage" lookup against the `Deal` row itself.

## 2. What every row answers

Per the task's explicit requirement, every successful transition row answers:

| Question | Column |
|---|---|
| Which deal? | `deal_id` (and `workspace_id` for tenant-scoped queries without a join) |
| From stage? | `from_stage_id` (null only for the synthetic creation row) |
| To stage? | `to_stage_id` (null for a transition into `won`/`lost`, where `to_status` carries the outcome instead) |
| Actor? | `actor_membership_id` (null reserved for `system:automation`, unused Phase 1) |
| Occurred when? | `occurred_at` — immutable business event instant, never `updated_at`, never a mutable scheduling field, mirroring `B2_TIMELINE_IDENTITY_MODEL.md` §2.4's discipline verbatim |
| Reason/source? | `reason_source` (`manual` \| `automation`) plus, for `CloseDealLost`, the `Deal.loss_reason_code` set atomically alongside |
| Command/idempotency identity? | `command_id` — the mutating command's idempotency key/identity, so a support investigation can correlate one transition row to one exact API call |
| Previous aggregate version? | `deal_version_before` |
| Resulting aggregate version? | `deal_version_after` (always `deal_version_before + 1` — never skips, never repeats, by construction of the single-transaction write) |

## 3. Write discipline

One `deal_stage_transitions` row is written **in the same database transaction** as the corresponding `Deal` row update and the corresponding outbox event insert (`B6_COMMAND_EVENT_CATALOG.md`) — never as a separate, eventually-consistent write. If the transaction rolls back, no history row, no Deal mutation, and no event exist; there is no partial state.

**Append-only, enforced structurally, not just by convention:** no command in `B6_COMMAND_EVENT_CATALOG.md` issues `UPDATE` or `DELETE` against this table. A correction to a wrongly-recorded transition (e.g., wrong `loss_reason_code` chosen) is made by reopening and re-closing the Deal (`ReopenDeal` then `CloseDealLost` again), which **appends** two new rows — it never edits the original.

## 4. Query surface

`GET /deals/{id}/transitions` — cursor-paginated, ordered `(occurred_at DESC, id DESC)` (the identical ordering-key shape `B2_TIMELINE_IDENTITY_MODEL.md` §3.1 uses for the CRM timeline, applied to Pipeline's own sub-resource). Gated by `deal.view` plus the same object-level `assigned/team scope` condition as reading the Deal itself — no separate permission.

## 5. Relationship to the CRM timeline

`deal_stage_transitions` is **not** what B2's timeline reads. B2 reads B6's **events** (`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened`, `DealAssigned`) via the `source_event_id` contract (`B6_CRM_TIMELINE_PROJECTION.md`). `deal_stage_transitions` is B6's own internal audit/history table, richer than what the generic cross-domain timeline entry shape needs (e.g., it carries `deal_version_before`/`after`, which the timeline does not). The two are populated from the same transaction but serve different consumers — one B6-internal (support/audit/reconstruction), one cross-domain (Lead 360 timeline).
