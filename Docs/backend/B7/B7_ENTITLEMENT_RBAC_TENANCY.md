# B7 — Entitlement, RBAC, Tenancy

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. RBAC — frozen, reused verbatim (not repeated as new)

`B1_AUTHORIZATION_RBAC.md` already froze all three automation permissions and their full role matrix (owner/admin/manager/sales/member/viewer). B7 **reuses them verbatim** — this is explicitly the discipline the task brief's §41 warns must not be skipped ("Do NOT repeat the B5 mistake of claiming frozen permissions are new").

| Permission | owner | admin | manager | sales | member | viewer | Condition | Classification |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|---|
| `automation.rule.view` | A | A | A | A | A | C | — | `FROZEN_REUSED` |
| `automation.rule.manage` | A | A | A | C | · | · | sensitive actions need approval | `FROZEN_REUSED` |
| `automation.run.approve` | A | A | A | C | · | · | never self-approve where policy forbids | `FROZEN_REUSED` |

`FROZEN_REUSED = 3`, `ADDITIVE = 0`. No new permission is introduced — every B7 command in `B7_COMMAND_EVENT_CATALOG.md` §1 maps onto one of these three existing rows, and every action B7 invokes is additionally gated by the **target domain's own** existing permission (`task.manage`, `appointment.manage`, `lead.update`, `lead.assign`, `deal.update`, `message.send` — all already frozen, none reused as if new).

## 2. Workspace automation capability

`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3 layer C: a workspace-level flag, `automation.enabled`, sourced from the frozen entitlement boundary (§4), gates whether `system:automation` may invoke *any* target command in this workspace at all — checked in addition to, never instead of, the target command's own RBAC row above.

## 3. Tenancy

Every B7 row carries `workspace_id`, resolved from a trusted source only: the authenticated caller's session (for rule-management commands) or the triggering event's own envelope `workspace_id` (for trigger admission, `B7_EVENT_CONSUMPTION_MODEL.md` §2) — never from request body content, matching Doctrine R-1 (`B6_API_DTO_CONTRACTS.md` §3) applied identically here. Every read (rule detail, run detail, revision) is workspace-scoped; a cross-workspace `RUN-*`/`ARULE-*` reference resolves `404`, indistinguishable from a genuinely absent resource (Doctrine R-1's non-disclosure shape).

## 4. Entitlement gates — resolved (Class A, `B7-D-A034`)

`automation.rules` (directly evidenced, FB-D22) is the Phase-1 capability key, evaluated by the frozen entitlement-decision boundary (`entitlementService.evaluate(...)`-shaped call, matching the pattern every other domain's own frozen entitlement checks already use). B8 owns the concrete plan-to-capability mapping and numeric limits — B7 does not invent them (task brief §19's explicit instruction). Phase-1 defers exact numbers, defines only the gate shape:

| Gate | Behavior when absent |
|---|---|
| `automation.rules` (binary) | `CreateAutomationRule`/`ActivateAutomationRule` reject `403`\|`entitlement_required`; existing `active` rules are **not** retroactively disabled (§`B7_ACTION_AUTHORIZATION.md` §4) — a downgrade blocks new admission and new authoring, never silently deletes existing configuration |
| `automation.rules.max_active` (usage quota — exact number deferred to B8) | `ActivateAutomationRule` rejects `403`\|`usage_exhausted` (matches evidenced toast copy, FB-D22) when the workspace's active-rule count would exceed the plan's limit |
| Per-action capability (e.g. a future gated `send_message` action tier) | The specific action fails `blocked`\|`entitlement_required` (§`B7_ACTION_EXECUTION_MODEL.md` §2) — other actions in the same run are unaffected until execution reaches that action |

**Running execution behavior after entitlement downgrade** (task brief's explicit question): resolved identically to `B7_ACTION_AUTHORIZATION.md` §4 — a `running`/`waiting` run finishes uninterrupted; only the *next* trigger admission and the *next* not-yet-invoked action observe the downgrade.

## 5. Technical safety limits vs. commercial entitlement limits — kept separate

`B7_RATE_COST_MODEL.md` owns the technical ceiling (execution budget, loop-prevention bounds) that applies uniformly regardless of plan; this document owns only the commercial gate. A workspace on the highest plan is still subject to `MAX_AUTOMATION_DEPTH=5` and the loop-prevention execution budget — those are safety invariants, not sellable capacity.
