# B6 — B7 (Automation) Boundary

> **B6 status:** Target design only. B7 is not designed. This document states only what B6 guarantees it, mirroring `B5_B6_B7_BOUNDARIES.md` §2's identical pattern one phase forward, and corroborated directly by frontend evidence (`B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D36/D37/D38).

## 1. The governed command boundary

**`B6-D-A026` (Class A, resolved): a future automation-triggered Deal mutation must call the identical `CreateDeal`/`UpdateDeal`/`MoveDealStage`/`CloseDealWon`/`CloseDealLost`/`ReopenDeal`/`AssignDeal` command, through the identical admission sequence (`B6_ENTITLEMENT_RBAC_TENANCY.md` §7), as any human actor. There is no second "automation mutation" transport path, now or reserved for later.**

This is the direct architectural answer to the same class of question `B5_B6_B7_BOUNDARIES.md` §2 answers for messaging: automation cannot bypass RBAC, entitlement, the state-machine guards, idempotency, concurrency, or audit, because none of those checks live *outside* the one shared admission sequence — there is nowhere else to enter.

## 2. What B7 may do

| B7 may consume from B6 | Field |
|---|---|
| Deal lifecycle events, as triggers | `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost` (already directly evidenced as legal automation triggers in the frontend fixture, FB-D37 — `deal_created`, `deal_stage_changed`) |
| Deal state, as read conditions | `deal.stage`, `deal.status`, `deal.value` (frontend evidence FB-D37 — with the caveat, §4, that the mock's hand-maintained stage-slug vocabulary is not carried forward as-is) |
| Governed commands, to request a Deal mutation | Every command in `B6_COMMAND_EVENT_CATALOG.md` §2, subject to the identical admission sequence a human actor faces, including whatever approval-gate B7 itself designs upstream of the call (frontend evidence FB-D38: the one seeded automation rule touching Deal-stage requires mandatory approval before execution — no auto-execute path exists even in the mock) |

## 3. What B7 may never do

| B7 must never | Why |
|---|---|
| write `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`/`deal_loss_reasons` directly | bypasses every guard in `B6_ENTITLEMENT_RBAC_TENANCY.md` §7 |
| bypass a state-machine transition guard (§`B6_DEAL_STATE_MACHINE.md` §3) | e.g., a rule that "closes" a Deal by directly setting `status='won'` rather than calling `CloseDealWon` would skip the explicit-confirmation requirement and the probability-forcing side effect |
| bypass RBAC/authorization policy | a rule acting under a system principal must still resolve to a permission grant through the same catalog (`B6_ENTITLEMENT_RBAC_TENANCY.md` §2) — a reserved `system:automation` actor type is a *caller identity*, never a bypass of the permission check itself |
| bypass idempotency | `Idempotency-Key` is required on every B6 mutating command regardless of caller identity (`B6_CONCURRENCY_IDEMPOTENCY.md` §3) |
| create a `RevenueEvent` through any B6 command | structurally impossible — no B6 command has that write path, for any caller (`B6_REVENUE_FIREWALL.md` §2); a B7 rule reacting to `DealWon` that wants to trigger revenue recognition must call B9's own governed command directly, never through B6 as an intermediary |

## 4. Frontend corroboration and one deliberate non-carry-forward

`B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D36: both the Agent (S8) and Automation (S9) mock surfaces independently maintain forbidden-action lists blocking `change_deal_value`, `change_deal_probability`, `close_won_deal`, `close_lost_deal`, `create_revenue`, `create_attribution` in every mode — direct evidence the product intent already assumes exactly this boundary, from two independent surfaces that were never reconciled with each other in the mock (a duplication B6 does not repeat: the boundary is stated once, structurally, here and in `B6_REVENUE_FIREWALL.md`, not re-declared per consumer).

**Not carried forward:** FB-D37's automation-condition `deal.stage` vocabulary is a third, hand-maintained slug representation (distinct from `deal.status` and the mock's `stage.kind`) that only exists because the mock conflates stage identity with Won/Lost (`B6_PIPELINE_STAGE_MODEL.md` §1). Since B6 resolves Won/Lost to `Deal.status` alone, a future B7's stage-based condition evaluates against the real `STG-*` public ID or `pipeline_stages.name`, and its status-based condition evaluates against `Deal.status` directly — no synthetic slug layer is needed or designed here.

## 5. Reserved actor type

`deal_stage_transitions.actor_membership_id` accepts `NULL` with `reason_source='automation'` reserved for a future B7 caller (`B6_DATA_MODEL.md` §4) — mirroring B5's reserved `senderType='system'` pattern exactly: the schema slot exists before B7 does, so B7's eventual arrival is a new **caller** of existing commands, not a new code path requiring a B6 amendment.

## 6. Negative control

`AT-B7-1 (NC)`: an implementation exposing a second "automation deal-mutation" command/endpoint that skips any admission-sequence step — structurally absent from `B6_COMMAND_EVENT_CATALOG.md`; no such command exists to expose.
