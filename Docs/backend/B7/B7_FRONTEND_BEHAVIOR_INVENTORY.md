# B7 — Frontend Behavior Inventory

> **B7 status:** Target design only. Traced against the frozen frontend at the same commit B0's reference pins (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`-era tree, current at HEAD `33354c4b072a8e78370856c25b7afdeec5939169`). Scope: `client/src/features/automation/*.tsx`, `client/src/domain/automation.js`, `client/src/domain/data.js` §S9 (lines 776–1005), plus every cross-domain touch point (Dashboard, Analytics, Lead 360, entitlements, shell navigation).

Three prior closed phases already speak directly to this scope and are cited rather than re-derived: `B2_COMMAND_EVENT_CATALOG.md` §1 names the exact CRM commands Automation may invoke and the `system:automation` actor type; `B5_B6_B7_BOUNDARIES.md` §2 pre-registers `B5-D-A025` (no second automation send path); `B6_B7_AUTOMATION_BOUNDARY.md` §1 pre-registers `B6-D-A026` (no second automation Deal-mutation path) and §4 already classifies the mock's `deal.stage` slug vocabulary as **not carried forward**. This inventory corroborates all three independently from the Automation side.

## 1. Scope map

| Surface | Files | B7 relevance |
|---|---|---|
| S9 — Automation (the mock's own name) | `features/automation/{Automation,AutomationModal}.tsx`, `domain/automation.js`, `data.js:776–1005` | **This is B7's scope.** Self-discloses its boundary in code: *"S9 automation is an event evaluation simulation only. It has no scheduler, worker, webhook, API, or background execution."* (`data.js:776`) |
| S9 — Tasks/Appointments surfaces | `features/automation/{Tasks,Appointments,AppointmentModal}.tsx` | Filed under `features/automation/` but they render **B2 CRM entities**. Out of B7 ownership; in scope only for the `origin=automation` provenance stamp. |
| S8 — Agent/Copilot, automation-adjacent | `domain/sales-ai.js`, `features/ai/*` | `agent_action_executed` appears in the trigger catalog; frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §C resolves `AGA-*` **to `RUN-*` (AutomationRun) itself**, so it is not an independent domain. |
| S10 — Dashboard/Analytics | `features/dashboard/Dashboard.tsx`, `features/analytics/Analytics.tsx`, `domain/analytics-engine.js` | Automation counters. The analytics path is structurally broken (§3). |
| Entitlements | `services/entitlementService.ts`, `services/contracts/entitlements.ts`, `shared/shell/shellNavigation.ts` | `automation.rules` capability and `automationRuns` usage metric already exist. |
| CRM | `features/crm/{Lead360,LeadControlPanels}.tsx` | Read-only automation-run panel on Lead 360. |

## 2. FB-A rows

Class legend, identical to `B6_FRONTEND_BEHAVIOR_INVENTORY.md` §2: **A** = authoritative frontend behavior the backend must preserve · **B** = behavior requiring backend formalization or correction · **C** = mock/local-only, not authoritative · **D** = defect/dead/contradictory, must not become backend truth.

### Group A — Rule shape and catalogs

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-A01 | A rule is `name` + exactly one `triggerType` + at most one `conditionGroupId` + one-or-more `actionIds` + one `approvalPolicy` + `status` + monotonic integer `version` + `createdBy`/`createdAt`/`updatedAt` | `data.js:837–845` | A |
| FB-A02 | Rule status vocabulary is exactly `draft` \| `enabled` \| `disabled` — there is no `paused` and no `archived` | `data.js:777` | A |
| FB-A03 | Only `enabled` rules evaluate; `draft` and `disabled` rules provably produce zero runs | `data.js:948`; integrity checks F, G (`data.js:987–988`) | A |
| FB-A04 | The trigger catalogue is **closed** — 12 entries, each carrying an `entityType`; no free-text trigger is accepted anywhere | `data.js:784–791` | A |
| FB-A05 | The condition **field** catalogue is closed — 9 fields, each carrying `entityType`, `dataType`, a per-field allowed `operators` list, and (for enum/boolean) an `allowedValues` list | `data.js:793–803` | A |
| FB-A06 | Seven operators are declared and implemented, but **no field in the catalogue permits `contains`** — it is unreachable by construction | `data.js:792,804,918`; cross-checked against every `operators` array in `data.js:794–802` | **D** |
| FB-A07 | A condition group is `{logic: AND\|OR, conditions[≥1]}`; a **null** group means "no condition" and matches unconditionally | `data.js:876,921` | A |
| FB-A08 | Condition validation rejects: unknown field, operator not permitted for that field, enum value outside `allowedValues`, boolean value not `true`/`false`, non-finite number | `data.js:868–875` | A |
| FB-A09 | `is_known`/`is_unknown` are the sole null semantics; every other operator evaluates to `false` when the field is unknown (`undefined`, `null`, or `""`) | `data.js:915–917` | A |
| FB-A10 | Conditions evaluate against **current authoritative domain state** read live through `buildAutomationContext`, never against a payload snapshot carried on the event | `data.js:900–913` | A |
| FB-A11 | `equals`/`not_equals` compare via `String()` coercion; `greater_than`/`less_than` via `Number()` — one comparison discipline for all types | `data.js:918–922` | B — a typed backend must compare enum-to-enum, number-to-number, and boolean-to-boolean under the field's declared `dataType`, not by coercion |
| FB-A12 | The action catalogue is **closed** — 8 entries, each carrying a `safety` class of `auto_safe` or `approval_required` | `data.js:805–814` | A |
| FB-A13 | `forbiddenAutomationActions` blocks 9 action types **unconditionally, in every mode and under every policy**: `send_message`, `send_whatsapp`, `change_deal_value`, `change_deal_probability`, `close_won_deal`, `close_lost_deal`, `create_revenue`, `create_attribution`, `delete_lead` | `data.js:815,923` | A |
| FB-A14 | Approval policy vocabulary is exactly `auto_safe` \| `approval_required` \| `manual_only` | `data.js:816` | A |
| FB-A15 | `canAutomationExecute` gate: a forbidden type is always denied; under `auto_safe` only `auto_safe` actions may run; under `approval_required` any catalogued action may run; under `manual_only` an action runs only when `triggerMode === "manual"` | `data.js:923` | A |
| FB-A16 | **Effective** approval requirement is the disjunction `policy === "approval_required" OR action.safety === "approval_required"` — an action's own safety class can force approval even under an `auto_safe` rule | `data.js:924` | A |
| FB-A17 | Rule creation is rejected outright unless name, trigger, ≥1 resolvable action, a valid policy, a valid condition group, **and** per-action executability all hold | `data.js:935` | A |
| FB-A18 | `version` increments **only** on a material change to `triggerType`, `conditionGroupId`, `actionIds`, or `approvalPolicy` — renaming or enabling/disabling does not bump it | `data.js:940` | A |

### Group B — Run admission and evaluation

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-A19 | Every run persists an immutable snapshot at admission: `automationRuleVersion`, `ruleNameSnapshot`, `triggerSnapshot`, `actionSnapshot[]` | `data.js:952`; integrity check N (`data.js:995`) | A |
| FB-A20 | Run status vocabulary is `evaluating` \| `matched` \| `skipped` \| `awaiting_approval` \| `executed` \| `failed` \| `cancelled` | `data.js:778` | B — frozen `BACKEND_STATE_MACHINES.md` already fixes `AutomationRun` as `created→awaiting_approval→queued→running→completed/failed/cancelled`; B7 maps onto the frozen vocabulary rather than introducing a second one (`B7_EXECUTION_MODEL.md` §3) |
| FB-A21 | Per-action execution status vocabulary is `proposed` \| `awaiting_approval` \| `approved` \| `rejected` \| `executed` \| `failed` \| `blocked` | `data.js:779` | B — same reason; `step_runs` is internal per frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §B and carries a reduced status set (`B7_ACTION_EXECUTION_MODEL.md` §3) |
| FB-A22 | Run admission is idempotent on `rule:version:eventId:firstActionId`; a repeat returns the **existing** run rather than creating a second | `data.js:929,951` | B — B7 keys on `(workspace, rule, source_event)` **excluding** the revision, so a rule edited between two deliveries of the same event still cannot produce two runs. The mock's `rule.version` component is dropped rather than translated to `rule_revision_id`, and the exclusion is enforced by a declared partial-unique constraint, not only by a derived key (`B7_IDEMPOTENCY_MODEL.md` §1.1-§1.4, `B7_DATA_MODEL.md` §3 `uq_automation_runs_event_rule`) |
| FB-A23 | Loop guard: any event whose `origin === "automation"` produces a **skipped** run and never executes — blanket same-origin suppression | `data.js:949`; integrity check P (`data.js:997`) | B — a blanket rule also suppresses the legitimate `Rule A → Task → Rule B` chain; B7 replaces it with lineage + same-rule-same-target suppression + a depth bound (`B7_LOOP_PREVENTION.md`) |
| FB-A24 | A trigger-type mismatch produces **no run row at all** — only matching rules are admitted | `data.js:950` | A |
| FB-A25 | A `manual_only` rule reached by an automatic trigger is admitted, recorded, and blocked with an explicit reason rather than silently dropped | `data.js:952` | A |
| FB-A26 | A run whose conditions do **not** match is still persisted, with a status of `skipped` and a human-readable `failureReason` | `data.js:952–953` | A |
| FB-A27 | `matchedConditionDetails[]` persists the per-condition `actual`, `known`, and `pass` outcome on the run | `data.js:952` | A |
| FB-A28 | Actions are planned in `rule.actionIds` order; every action of a matched run is materialised as a pending execution row before any of them runs | `data.js:954` | A |
| FB-A29 | Run status is **derived** from its action rows: any `failed` → `failed`; else any `awaiting_approval`/`approved` → `awaiting_approval`; else all terminal → `executed` | `data.js:930` | B — this derivation labels an all-`rejected` run `executed`, which misreports a run where nothing happened; B7 maps a rejected run to `cancelled` (`B7_PARTIAL_SUCCESS.md` §4) |
| FB-A30 | The approval queue is exactly the set of executions in `awaiting_approval`, ordered by their run's creation time | `data.js:889` | A |
| FB-A31 | Approve transitions to `approved` and immediately executes; reject transitions to `rejected` and performs **zero** mutation | `data.js:975–976` | A |
| FB-A32 | An execution that is `awaiting_approval` or `rejected` provably never carries a `resultEntityId` | integrity checks H, I (`data.js:989–990`) | A |

### Group C — Action execution and provenance

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-A33 | Every domain action is performed by calling the CRM contract function — `addLeadTask`, `createAppointment`, `updateLeadPriority`, `updateLeadStatus`, `assignLeadOwner` — never by writing a CRM structure directly | `data.js:963–971` | A |
| FB-A34 | Every automation-created Task/Appointment is stamped `createdByAutomationRunId` and `origin: "automation"`, and the CRM activity log records the same metadata | `data.js:962,966–969` | A |
| FB-A35 | The Tasks surface exposes an `origin` filter (`automation` vs `manual`) and renders the originating run ID on the row | `Tasks.tsx:13,43–45,79–80`; `data.js:892` | A |
| FB-A36 | Every action except `notify_in_app_mock`/`escalate_to_human` fails fast if the run's context resolves no Lead | `data.js:963` | A |
| FB-A37 | `notify_in_app_mock` and `escalate_to_human` write only a local notification fixture; frozen B0 models **no notification table in Phase 1** | `data.js:971`; `BACKEND_PUBLIC_ID_REGISTRY.md` §B (`AUTONOT-`) | **C** |
| FB-A38 | Dry-run (`testAutomationRule`) reports trigger match, per-condition outcome, and per-action `wouldExecute`/`requiresApproval`, creating **no run and no mutation** | `data.js:942`; `Automation.tsx` test buttons | A |
| FB-A39 | Manual run (`runAutomationNow`) requires a resolvable actor and synthesises an event with `triggerMode: "manual"`, `origin: "manual"`, and a caller-supplied or defaulted entity reference | `data.js:957` | A — the *mechanism*; the hardcoded default entity map (`LEAD-1042`, `DEAL-4042`, …) is fixture scaffolding, **C** |
| FB-A40 | The "run now" affordance is rendered only when `triggerType === "manual"` **or** `approvalPolicy === "manual_only"` | `Automation.tsx` detail pane | A |
| FB-A41 | A dedicated automation audit trail records 12 event types: `rule_created`, `rule_updated`, `rule_status_changed`, `run_matched`, `run_skipped`, `loop_guard_blocked`, `action_proposed`, `approval_requested`, `action_approved`, `action_rejected`, `action_executed`, `action_failed` | `data.js:928,938,940,941,949,953,954,974–976` | A |
| FB-A42 | The audit surface renders the full chain: event → conditions (with the matched-condition sentence) → transition → per-action approval decision, executor, result entity, failure reason | `automation.js` `renderAuditLog`; `Automation.tsx` audit section | A |
| FB-A43 | A self-asserting integrity report enforces 22 invariants (A–V), including **Q** "zero outbound messages from automation", **R** "zero deal mutations from automation", **S** "revenue/attribution preserved", **P** "loop guard", **N** "rule version recorded on every run" | `data.js:979–1002` | A |

### Group D — Cross-domain surfaces

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-A44 | Automation is entitlement-gated on capability `automation.rules` with usage metric `automationRuns`; a locked or exhausted decision blocks rule creation and manual run at the UI boundary | `entitlementService.ts:22,28,32–33`; `shellNavigation.ts:45`; `Automation.tsx` `canUseAutomation` | A |
| FB-A45 | `PLAN-STARTER` carries an `automationRuns: 25` limit but is **not** granted the `automation.rules` capability, so the limit is structurally unreachable | `data.js:319` vs `entitlementService.ts:31` | **D** |
| FB-A46 | The Dashboard automation card reports `enabled`, `runsToday`, `awaitingApproval`, `failed` | `Dashboard.tsx:160,698–712`; `data.js:890` | A |
| FB-A47 | The Analytics automation panel is structurally dead: it reads `mockModel.automationRules` (the model is `mockModel.automations`), `action.runId` (the field is `automationRunId`), `run.ruleId` (the field is `automationRuleId`), `run.conditionResult.matched` (the field is `matchedConditions`), and `item.resultEntityType` (never written) — every automation analytic it renders is therefore always zero | `analytics-engine.js:130,144,188,201` vs `data.js:837,846,850,952` | **D** |
| FB-A48 | The Lead 360 automation panel counts runs whose trigger entity resolves to the Lead directly, via its conversation, or via its deal | `LeadControlPanels.tsx:104–113` | A |
| FB-A49 | The `lead.status` condition field advertises `customer` as an allowed value; frozen `B2_LEAD_AGGREGATE.md` §2 defines the enum as `new`\|`contacted`\|`qualified`\|`unqualified`\|`nurturing` — `customer` is not a Lead status | `data.js:795` vs `B2_LEAD_AGGREGATE.md:18` | **D** |
| FB-A50 | The `task.status` condition field advertises only `pending`\|`completed`; frozen `B2_TASK_APPOINTMENT_MODEL.md` §2 defines `pending`\|`completed`\|`cancelled` | `data.js:801` vs `B2_TASK_APPOINTMENT_MODEL.md:18` | B — B7 takes the field's allowed values from the owning domain's frozen enum, never from the mock's copy |
| FB-A51 | The `deal.stage` condition field is matched through a hand-maintained slug map (`STG-1001`→`"new"` … `STG-1007`→`"won"`) that conflates stage identity with Won/Lost | `automationConditionFieldCatalog` field entry, `data.js:798`; slug map `getAutomationStageKey`, `data.js:856`, consumed at `buildAutomationContext`, `data.js:903` | **D** — already ruled *not carried forward* by frozen `B6_B7_AUTOMATION_BOUNDARY.md` §4 |
| FB-A52 | `conversation_needs_reply` is offered as a trigger, but `needs_reply` is a **computed read-time predicate** in frozen B5, not an event | `automationTriggerCatalog` entry, `data.js:788`, vs `B5_CONVERSATION_MODEL.md` §7 and `B5_DOMAIN_OWNERSHIP.md:57` | B — a read-time predicate cannot be a trigger type as authored. B7 therefore **defers** it with every other B5-sourced trigger (`B7-D-B006`): no frozen B5 consumer declaration names Automation, so Phase 1 admits none (`B7_TRIGGER_CATALOG.md` §3, `B7_B5_MESSAGING_BOUNDARY.md` §1) |
| FB-A53 | `agent_action_executed` is offered as a trigger; frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §C resolves the agent action `AGA-*` **to `RUN-*`, the AutomationRun itself** — the trigger would fire automation on automation's own output | `automationTriggerCatalog` entry, `data.js:789`, vs `BACKEND_PUBLIC_ID_REGISTRY.md` §C row `AGA-` | **D** |
| FB-A54 | The React create-rule modal always submits `status: "enabled"` with exactly one condition and one action, silently bypassing the `draft` option the legacy form still offers | `AutomationModal.tsx:52–61` vs `automation.js` `renderRuleForm` | B — B7 supports both (`draft` is the created state, activation is a separate command) and the divergence is resolved in favour of the explicit two-step lifecycle |
| FB-A55 | The engine has no scheduler, worker, queue, webhook, or background execution; evaluation happens only inside an explicit user action | `data.js:776`; integrity check V (`data.js:1002`) | **C** — a mock constraint, not a product requirement; B7 supplies the async boundary B0 ADR-004/005 already selected |
| FB-A56 | Rules, runs, and executions carry no workspace field — the mock is single-tenant | `data.js:837–851` | B — every B7 automation row is workspace-scoped per frozen `B0_BACKEND_BLUEPRINT.md` non-negotiable rule 1 |
| FB-A57 | There is no delay/wait action, no time-based or scheduled trigger, and no cron affordance anywhere in the automation surface | absence across `data.js:784–814`, `Automation.tsx`, `AutomationModal.tsx` | A (as an absence — recorded because B7 declines to invent one; see `B7_SCHEDULE_DELAY_MODEL.md`) |

### Group E — Product framing and one frozen-B0 unification

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-A58 | The automation surface presents a fixed six-step decision rail — الحدث (Event) → الشروط (Conditions) → القاعدة (Rule) → الإجراء (Action) → **الموافقة (Approval)** → التدقيق (Audit) — as the product's own articulation of the pipeline | `automation.js` `renderDecisionRail`; `Automation.tsx` `railSteps` | A — independently corroborates that **approval is a first-class pipeline stage**, not an optional add-on, matching frozen `BACKEND_DOMAIN_OWNERSHIP.md`'s "no unapproved sensitive action" |
| FB-A59 | A live rule-sentence preview ("عندما X، إذا كان Y، Z.") renders while authoring, composed purely from the three closed catalogs | `automation.js` `getAutomationRulePreview`; `AutomationModal.tsx` | C — pure client-side composition; the only backend obligation it implies is that the catalogs be fetchable, which `GET /automation/triggers` and `GET /automation/actions` satisfy |
| FB-A60 | The S8 Copilot's "governed agent action" `AGA-*` is resolved by frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §C **to `RUN-*` — the AutomationRun itself** — reached through `POST /automation/runs/{id}/approve` | `BACKEND_PUBLIC_ID_REGISTRY.md` §C row `AGA-`; `features/ai/*`, `domain/sales-ai.js` | A — a frozen-B0 fact rather than a frontend-only one, recorded here because it determines that "propose an action, get human approval, execute" is **one** backend primitive shared by S8 and S9, and that an `AutomationRun` need not always have an `AutomationRule` behind it (`B7_EXECUTION_MODEL.md` §4) |

## 3. Behaviors with no frontend evidence, stated explicitly

The following B7 concerns have **no** frontend evidence in either direction. They are recorded here so that no reader mistakes a B7 design decision for a frontend reading. Each is resolved on frozen-architecture grounds in the cited document, and each is listed in `B7_DECISION_REGISTER.md` as B7-authored.

| Concern | Evidence | Resolved in |
|---|---|---|
| Rule archival / retention of run history | none — the mock never deletes or archives a rule | `B7_RULE_LIFECYCLE.md` §3, `B7_RETENTION_DELETION.md` |
| Immutable rule **revision** rows (the mock snapshots into the run and mutates the rule in place) | partial — `version` + run snapshot exist (FB-A18/FB-A19), revision rows do not | `B7_RULE_REVISION_MODEL.md` |
| Retry, backoff, dead-letter, replay | none — the mock is synchronous and single-attempt | `B7_FAILURE_RETRY_MODEL.md`, `B7_DEAD_LETTER_REPLAY.md` |
| Run cancellation by a user | `cancelled` exists in the status vocabulary (FB-A20) but **no code path ever sets it** | `B7_PAUSE_DISABLE_CANCEL.md` §4 |
| Cross-workspace isolation | none — single-tenant mock (FB-A56) | `B7_ENTITLEMENT_RBAC_TENANCY.md` §3 |
| Which membership's authority an automation action executes under | none — the mock passes `CRM_ACTOR_ID`, a module constant | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` |
| Concurrent execution of one rule, and `expected_version` handling | none — single-threaded mock | `B7_CONCURRENCY_MODEL.md` §2, §5 |
| Scheduled / delayed automation | none, and deliberately so (FB-A57) | `B7_SCHEDULE_DELAY_MODEL.md` — **deferred out of Phase 1** |

## 4. Counts

Mechanically recounted from the tables' own trailing `Class` column, taking each row's **leading** class letter — the same single-leading-letter discipline `B6_FRONTEND_BEHAVIOR_INVENTORY.md` §5 applies to its split rows. Exactly one row here carries a split note: **FB-A39** leads with **A** (the manual-run mechanism is authoritative) and carries a secondary **C** (its hardcoded default-entity map is fixture scaffolding). It is counted once, under **A**.

```
FRONTEND_BEHAVIOR_COUNT = 60   (FB-A01-FB-A60, contiguous, no gaps)
FRONTEND_A              = 41
FRONTEND_B              = 10
FRONTEND_C              = 3
FRONTEND_D              = 6
FRONTEND_UNCLASSIFIED   = 0

41 + 10 + 3 + 6 + 0 = 60, matching the row count exactly.
```

Per-class membership, listed in full so the split is mechanically re-verifiable without re-parsing prose:

- **A (41):** FB-A58, FB-A60, FB-A01, A02, A03, A04, A05, A07, A08, A09, A10, A12, A13, A14, A15, A16, A17, A18, A19, A24, A25, A26, A27, A28, A30, A31, A32, A33, A34, A35, A36, A38, **A39**, A40, A41, A42, A43, A44, A46, A48, A57
- **B (10):** FB-A11, A20, A21, A22, A23, A29, A50, A52, A54, A56
- **C (3):** FB-A37, A55, A59
- **D (6):** FB-A06, A45, A47, A49, A51, A53

`B7_VERIFICATION_MATRIX.md` §3 re-derives all five numbers mechanically from this file rather than restating them.

## 5. How the forbidden list is carried forward

The mock's `forbiddenAutomationActions` (FB-A13) blocks nine action types unconditionally, and `B6_B7_AUTOMATION_BOUNDARY.md` §4 records that two independent mock surfaces (S8 Agent and S9 Automation) maintain the same list. It is strong evidence and B7 does not wave it away.

**Seven of the nine remain forbidden in Phase 1**, structurally: `change_deal_value`, `change_deal_probability`, `close_won_deal`, `close_lost_deal`, `create_revenue`, `create_attribution`, `delete_lead`. `B7_ACTION_CATALOG.md` §4 carries each exclusion with its own rationale, and the last three are additionally impossible by construction — no B7-reachable command produces a `RevenueEvent` or `AttributionTouchpoint` (`B7_REVENUE_FIREWALL.md`), and B2's frozen catalog contains no Lead hard-delete command for any actor.

**Two of the nine — `send_message` and `send_whatsapp`, which name one action, not two — are deliberately relaxed**, under a non-configurable `approval_required` tier. This is a real divergence from an A-classified frontend behavior, declared as such and **approved by the CTO as a Phase-1 product/architecture decision** (`B7-D-A016`), not smuggled in and not disguised as a frozen amendment. Three frozen B5 statements, all verified against the frozen text rather than paraphrased, drive it:

- `B5_MESSAGE_MODEL.md` §2 defines `sender_type = … | system` as *"reserved for a future governed-automation sender"*;
- `B5_MESSAGE_STATE_MACHINE.md` justifies its `cancelled` state partly because *"B7's future governed-automation sends will need one"*;
- `B5_B6_B7_BOUNDARIES.md` §2 states B5 is compatible with the forbidden list *"remaining exactly as strict as it is today, **or** with a future B7 phase deliberately, explicitly relaxing it through the same governed command — never through a bypass."*

B5 therefore does not merely tolerate automation sends; it provisions for them by name. What the frontend's list actually protects against — an automation autonomously sending a WhatsApp message with no human in the loop — remains structurally impossible, because the action's safety tier is fixed at `approval_required` and a rule author cannot set it to `auto_safe` (`B7_ACTION_CATALOG.md` §3), and because the send itself still passes through B5's unmodified admission sequence including consent, service window, and template rules (`B7_B5_MESSAGING_BOUNDARY.md`).

**`move_deal_stage` relaxes nothing** — it does not appear on the forbidden list at all. It is included because `B6_DATA_MODEL.md` §4 reserves `deal_stage_transitions.reason_source='automation'` specifically for a B7 caller, which is forward-provisioning by the immediately-preceding frozen phase rather than a gap in the evidence.
