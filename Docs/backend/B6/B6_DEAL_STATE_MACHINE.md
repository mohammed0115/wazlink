# B6 — Deal State Machine

> **B6 status:** Target design only. Elaborates frozen `BACKEND_STATE_MACHINES.md`'s coarse `DealOpen → DealWon` / `DealOpen → DealLost` sketch. Every transition beyond those two frozen edges is stated as an explicit, additive extension — see `B6_CONTROLLED_AMENDMENTS.md` item 1.

## 1. States

`Deal.status ∈ {open, won, lost}`. There is no separate `archived` Deal state (`B6_PIPELINE_MODEL.md` §4-adjacent reasoning: `status` already provides the list-hygiene an `archived` state would add, so none is introduced — `B6-D-A009`, evaluated and rejected, `B6_RETENTION_DELETION.md` §1).

`Deal.stage_id` moves independently **within** `status='open'` — stage progression is not itself a top-level state, it is a sub-dimension of the `open` state (mirrors how B5's `MessageDelivery` sub-states move independently under the coarser Message lifecycle).

## 2. Full transition table

| From | To | Command | Guard | Permission | Side effects | Event |
|---|---|---|---|---|---|---|
| `[*]` | `open` | `CreateDeal` | Lead exists, in-workspace, not archived (`422 lead_archived` otherwise); Pipeline/Stage in-workspace and `stage.pipeline_id == pipeline_id` | `deal.create` | seeds `stage_id`, `probability := stage.default_probability` unless overridden, `owner_membership_id := actor's choice or Lead.owner_membership_id default` | `DealCreated` |
| `open` | `open` (stage change) | `MoveDealStage` | target stage active, in-workspace, same pipeline as the Deal; **`If-Match`** | `deal.update` | `stage_id` updated; `probability` re-seeded from the new stage's `default_probability` unless the same call overrides it | `DealStageChanged` |
| `open` | `open` (field edit) | `UpdateDeal` | **`If-Match`**; cannot change `status`, `pipeline_id`, `currency`, `lead_id` via this command | `deal.update` | `title`/`description`/`value`/`probability`/`expected_close_date` updated | `DealUpdated` |
| `open` | `won` | `CloseDealWon` | **`If-Match`**; explicit confirmation payload required (frozen B0: "explicit confirmation; audit") | `deal.close` | `probability := 100` (frozen), `won_at := now()`, `closed_at := won_at`, `stage_id` frozen at its current value | `DealWon` |
| `open` | `lost` | `CloseDealLost` | **`If-Match`**; `loss_reason_code` required and must be an active (or historically-valid) code in `deal_loss_reasons` | `deal.close` | `probability := 0` (frozen), `lost_at := now()`, `closed_at := lost_at`, `stage_id` frozen | `DealLost` |
| `won` | `open` | `ReopenDeal` | **`If-Match`**; reason note required (audit) | `deal.reopen` | `won_at`/`closed_at` cleared on the **live** row (history retained in `deal_stage_transitions`); `probability` re-seeded from the retained `stage_id`'s current `default_probability`; `reopened_at := now()` | `DealReopened` |
| `lost` | `open` | `ReopenDeal` | **`If-Match`**; reason note required (audit) | `deal.reopen` | `lost_at`/`closed_at`/`loss_reason_code`/`loss_reason_note` cleared on the live row; `probability` re-seeded; `reopened_at := now()` | `DealReopened` |
| `open` | `open` (owner change) | `AssignDeal` | **`If-Match`**; target must be an active membership in-workspace | `deal.assign` | `owner_membership_id` updated | `DealAssigned` |
| `won`/`lost` | `won`/`lost` (owner change) | `AssignDeal` | same as above — reassignment is **not** blocked by closed status (a closed Deal can still change owner for reporting/handoff purposes) | `deal.assign` | `owner_membership_id` updated | `DealAssigned` |

## 3. Forbidden transitions, stated explicitly

| Attempted | Result |
|---|---|
| `won → lost` (direct) | **Forbidden.** Must go `won → open` (`ReopenDeal`) then `open → lost` (`CloseDealLost`) — two explicit, separately audited transitions, never a silent one-step flip. `409 CONFLICT` \| `invalid_stage_transition`. |
| `lost → won` (direct) | **Forbidden**, same reasoning and error. |
| `MoveDealStage` while `status ∈ {won, lost}` | **Forbidden.** `409 CONFLICT` \| `not_open`. A closed Deal's `stage_id` is frozen history, not a live field. |
| `CloseDealWon`/`CloseDealLost` while `status ∈ {won, lost}` | **Forbidden.** `409 CONFLICT` \| `already_won` / `already_lost`. |
| `ReopenDeal` while `status='open'` | **Forbidden.** `409 CONFLICT` \| `reopen_forbidden` (nothing to reopen). |
| `UpdateDeal` changing `value`/`probability`/`expected_close_date` while `status ∈ {won, lost}` | **Forbidden.** `409 CONFLICT` \| `not_open` — a closed Deal's commercial figures are frozen; correcting them requires `ReopenDeal` first, which is itself audited. |

## 4. Stage movement within `open`

**`B6-D-A015`: unrestricted movement to any active stage within the same pipeline is permitted** — forward, backward, or skipping intermediate stages — governed only by `deal.update` and the same-pipeline guard. No sequential-order enforcement is imposed. This matches the frozen coarse sketch (which imposes no stage-order constraint at all) and the typical pipeline-board UX of dragging a card to any column. Cross-pipeline stage moves are **`NOT_SUPPORTED`** (§`B6_DEAL_AGGREGATE.md` §2, `pipeline_id` immutable after creation).

## 5. Idempotency and version behavior

Every transition in §2 requires `Idempotency-Key` (except read-only `GET`s) and `If-Match`/`expected_version` (`B6_CONCURRENCY_IDEMPOTENCY.md`). A replayed `MoveDealStage` under the same key and body returns the stored terminal response and creates **no** second `deal_stage_transitions` row and **no** second `DealStageChanged` event — the negative control `NC — duplicate MoveDeal does not create duplicate transition/event` (`B6_ACCEPTANCE_TESTS.md`).

## 6. Audit history

Every successful transition in §2 writes exactly one `deal_stage_transitions` row in the same transaction as the `Deal` mutation and the outbox event (`B6_STAGE_TRANSITION_HISTORY.md`). No transition is derivable solely from the current `Deal` row's `status`/`stage_id` — the full path is only ever reconstructable from the transition history.
