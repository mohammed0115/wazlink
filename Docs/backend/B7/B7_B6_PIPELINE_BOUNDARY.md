# B7 — B6 (Pipeline) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 consumes from B6

Four events, all explicitly named by `B6_B7_AUTOMATION_BOUNDARY.md` §2 as B7-legal triggers: `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`. Condition fields: `deal.status`, `deal.value`, `deal.stage_ref` (an opaque `STG-*` reference — the mock's hand-maintained stage-slug vocabulary is explicitly **not** carried forward, per that same document's §4). `DealReopened`/`DealAssigned`/`DealUpdated` are deferred (`B7_TRIGGER_CATALOG.md` §3) — B6's own dedicated boundary document had the opportunity to name them and chose not to.

## 2. What B7 invokes on B6

`MoveDealStage` only, mandatory `approval_required` — justified in detail in `B7_ACTION_CATALOG.md` §3 by the schema-level reserved hook `B6_DATA_MODEL.md` §4 built specifically for this (`deal_stage_transitions.actor_membership_id = NULL`, `reason_source='automation'`). `CreateDeal`/`UpdateDeal`/`CloseDealWon`/`CloseDealLost`/`ReopenDeal`/`AssignDeal` are all excluded from Phase 1 (`B7_ACTION_CATALOG.md` §4) — `B6-D-A026` establishes the *rule* every one of these commands would have to follow if B7 ever invokes them, it does not itself enable all seven in Phase 1.

## 3. What B7 never does

Never writes `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`/`deal_loss_reasons` directly. Never bypasses `B6_DEAL_STATE_MACHINE.md`'s transition guards, `expected_version`, or `Idempotency-Key` (`B6-D-A026`, restated verbatim). Never causes, and structurally cannot cause, a Won/Lost transition — `close_won_deal`/`close_lost_deal` are not on the closed action catalog at all (`B7_REVENUE_FIREWALL.md` §2).

## 4. Actor attribution

Every `MoveDealStage` invocation supplies `actor_membership_id=NULL`, `reason_source='automation'` — the exact reserved slot `B6_DATA_MODEL.md` §4 names, populated for the first time by this document (B6 reserved it before B7 existed to fill it).

## 5. Negative controls

Restates `B6_B7_AUTOMATION_BOUNDARY.md` §6's `AT-B7-1 (NC)` (that document's own test id, in B6's namespace — not redefined here) from B7's own side: `AT-B6PIPE-1` **(NC)**: an implementation exposing a second "automation Deal-mutation" command/endpoint that skips `B6_DEAL_STATE_MACHINE.md`'s guards — fails; structurally absent, no such command exists to expose. `AT-B6PIPE-2` **(NC)**: an implementation invoking `CloseDealWon`/`CloseDealLost` from any B7 action — fails; not on the closed action catalog (`B7_ACTION_CATALOG.md` §4).
