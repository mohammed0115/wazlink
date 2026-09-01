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

## 2. Where an automation action's authority actually comes from

There is **no workspace-level permission** in this corpus — `B1_AUTHORIZATION_RBAC.md` §3 attaches every grant to a *role*, and roles attach to *memberships*. B7 therefore does not invent one. An automation action's target-command RBAC check is evaluated against the **authority principal**: the membership that activated the rule revision (`automation_rule_revisions.activated_by_membership_id`), resolved live at invocation time per `B1-D-006`'s no-caching rule. Full model, including what happens when that membership is removed, suspended, or downgraded: `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.

The consequence worth stating here: **automation can never exercise a permission that no current member of the workspace holds.** The three `automation.*` permissions above govern who may author, activate, and approve; they never widen what an activated rule may then do.

## 3. Tenancy

Every B7 row carries `workspace_id`, resolved from a trusted source only: the authenticated caller's session (for rule-management commands) or the triggering event's own envelope `workspace_id` (for trigger admission, `B7_EVENT_CONSUMPTION_MODEL.md` §2) — never from request body content, matching Doctrine R-1 (`B6_API_DTO_CONTRACTS.md` §3) applied identically here. Every read (rule detail, run detail, revision) is workspace-scoped; a cross-workspace `RUN-*`/`AUTO-*` reference resolves `404`, indistinguishable from a genuinely absent resource (Doctrine R-1's non-disclosure shape).

## 4. Entitlement gates — resolved (Class A, `B7-D-A034`)

**Both gate keys are frozen; B7 invents neither.** `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §3 fixes the inherited vocabulary under an explicit *"do not reinvent"* instruction: the capability is **`automation.rules`** and the usage metric is **`automationRuns`** (directly corroborated by the frontend, FB-A44). The frozen status→HTTP mapping is likewise B1's: `LOCKED ⇒ 403 ENTITLEMENT_LOCKED`, `EXHAUSTED ⇒ 403 QUOTA_EXHAUSTED`. B8 owns the concrete plan-to-capability mapping and the numeric limits; B7 supplies **no** numbers and mints **no** additional capability or metric key.

| Gate | Frozen key | Behavior |
|---|---|---|
| Capability (binary) | `automation.rules` | `CreateAutomationRule`/`ActivateAutomationRule` reject `403` \| `ENTITLEMENT_LOCKED`, `details.capability="automation.rules"`, `details.reason="capability_locked"`, `target_plan_ref` present — the exact shape frozen `B1_FAILURE_SCENARIOS.md` F15 and `B1 AT-ENT-1` fix. Existing `active` rules are **not** retroactively disabled — a downgrade blocks new admission and new authoring, never silently deletes existing configuration |
| Usage quota | `automationRuns` | Every `AutomationRun` this workspace creates reserves one unit (§4.1). At the limit, `RunAutomationNow` rejects `403` \| `QUOTA_EXHAUSTED`, `details.metric="automationRuns"`, `details.reason="usage_exhausted"`, `details.period` present — the exact shape frozen `B1_FAILURE_SCENARIOS.md` F16 and `B1 AT-ENT-3` fix |
| Per-action capability (a future gated action tier) | — | The specific action fails `blocked` with `ENTITLEMENT_LOCKED` (§`B7_ACTION_EXECUTION_MODEL.md` §2) — other actions in the same run are unaffected until execution reaches that action |

**No `automation.rules.max_active` or any other active-rule ceiling exists in B7.** An earlier draft named one; it was not frozen vocabulary, and inventing a commercial quota key is B8's authority, not B7's. It is removed rather than deferred, and `B7_RATE_COST_MODEL.md` §2's technical safety limits are explicitly *not* a substitute for it.

### 4.1 Quota reservation semantics — frozen B1, reused unmodified

`B1_FAILURE_SCENARIOS.md` F16 fixes the mechanism: the reservation is a transactional lock on the workspace's `usage_counters` row inside the same transaction as the state change, rolled back with it; *"no Redis counter participates in the decision."* B7 reuses it as-is at exactly two points, the only two places an `automation_runs` row is created:

| Creation path | Where the unit is reserved | On exhaustion |
|---|---|---|
| Event-triggered admission (`AdmitAutomationTrigger`) | inside the admission transaction, immediately before the `automation_runs` insert (`B7_TRIGGER_ADMISSION.md` step 6b, `B7_EVENT_CONSUMPTION_MODEL.md` §4 step 4b) | no run is created for that rule; a `skipped` run is persisted with `error_classification='ENTITLEMENT'`, `error_code='QUOTA_EXHAUSTED'`, `failure_reason` naming `metric='automationRuns'`, so the audit trail shows *why* nothing fired. There is no HTTP caller to receive a status |
| `RunAutomationNow` (HTTP) | inside the command transaction, before the `automation_runs` insert | `403` \| `QUOTA_EXHAUSTED`, `details.metric="automationRuns"`; no run row, no side effect |

**One logical run can never consume two units.** The reservation shares a transaction with the `automation_runs` insert, which is guarded by *two* constraints — `uq_automation_runs_idempotency` and, on the event path, `uq_automation_runs_event_rule` over `(workspace_id, rule_id, source_event_id)` (`B7_DATA_MODEL.md` §3). A redelivered event is normally absorbed by the inbox unique constraint at admission step 4 and never reaches the reservation at all (`B7_EVENT_CONSUMPTION_MODEL.md` §3-4); if it ever does — a pruned inbox record, an operator outbox replay — the run-level constraint rejects the insert and the reservation rolls back with it, so the unit is never consumed twice (`B7_IDEMPOTENCY_MODEL.md` §4a, `AT-ENT-6`/`AT-DEDUP-5` **NC**). A retried `RunAutomationNow` replays through its own `Idempotency-Key`. A crash between reservation and commit rolls both back together.

**Dry-run consumes nothing.** `RunAutomationTest` persists no `automation_runs` row (`B7_EXECUTION_MODEL.md` §5), so it reserves no `automationRuns` unit — the metric counts runs, and a dry-run is not one. Frozen truth says nothing about metering dry-runs, and B7 declines to invent commercial behavior for it; whether B8 later meters test evaluations under a separate metric is recorded as `B7-D-C005` (deferred, B8-owned).

**Running execution behavior after entitlement downgrade** (task brief's explicit question): resolved identically to `B7_ACTION_AUTHORIZATION.md` §4 — a `running` run finishes uninterrupted; only the *next* trigger admission and the *next* not-yet-invoked action observe the downgrade.

## 5. Technical safety limits vs. commercial entitlement limits — kept separate

`B7_RATE_COST_MODEL.md` owns the technical ceiling (execution budget, loop-prevention bounds) that applies uniformly regardless of plan; this document owns only the commercial gate. A workspace on the highest plan is still subject to `MAX_AUTOMATION_DEPTH=5` and the loop-prevention execution budget — those are safety invariants, not sellable capacity.
