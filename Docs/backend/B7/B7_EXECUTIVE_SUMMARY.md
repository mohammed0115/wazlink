# B7 — Executive Summary

> **B7 status:** Target design only. **B7 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing in this package is approved, and no implementation may act on it.

## What B7 is

B7 designs WazLink's **Automation** domain: `trigger matched → conditions satisfied → actions planned → governed command invoked → execution recorded`. It is an orchestration layer, not an alternative authority — it owns nine of its own Phase-1 entities (`AutomationRule`, `AutomationRuleRevision`, and the revision-scoped `AutomationRuleTrigger`/`AutomationRuleCondition`/`AutomationRuleAction` — normalized child tables, never JSON blobs — plus `AutomationRun`, `AutomationRunStep`, `AutomationRunApproval`, `AutomationInboxRecord`) and never writes a table any other domain owns.

## What B7 inherited, not invented

Unlike a phase starting from a blank sketch, B7 found substantial frozen infrastructure already waiting for it, precisely because B0-B6 were each authored anticipating automation would eventually arrive:

- `RUN-*` (AutomationRun) was already a registered public-ID prefix (`BACKEND_PUBLIC_ID_REGISTRY.md` §A), and `AUTO-` sat in §B deferred only *because* "Rule CRUD is future/non-Core" — the exact condition B7 satisfies.
- **Two commands and two events were already frozen by name**: `CreateAutomationRule` and `ApproveAutomationRun`; `AutomationRunCreated` and `AutomationRunCompleted` (`BACKEND_COMMAND_EVENT_CATALOG.md`). B7 reuses all four verbatim.
- **The run state machine was already frozen**: `created→awaiting_approval→queued→running→completed/failed/cancelled`, with "sensitive actions cannot skip approval" (`BACKEND_STATE_MACHINES.md`). B7 keeps all seven names, every edge, and the approval-before-queue order.
- **The approval endpoint was already frozen**: `POST /automation/runs/{id}/approve`, `operationId: approveAutomationRun`, body `{approved, version}` with `additionalProperties:false` — which is *why* B7's approval is run-granular rather than per-action.
- `AutomationRule` was already named as a versioned, optimistic-concurrency DTO in `BACKEND_ARCHITECTURE_DECISIONS.md`, alongside Lead/Deal/Task.
- `BACKEND_DATA_MODEL.md` row 21 already sketched the exact table group (`automation_rules, triggers, conditions, actions, runs, step_runs, approvals`).
- Three RBAC permissions (`automation.rule.view`, `automation.rule.manage`, `automation.run.approve`) were already frozen with a full role matrix in `B1_AUTHORIZATION_RBAC.md`.
- B2 had already named the exact five commands automation may invoke (`CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`) and the exact actor-identity convention (`actor_type='system:automation'`, `actor_label='automation_run:RUN-*'`).
- B5 had reserved `senderType='system'` and B6 had reserved a `NULL`-actor slot on `deal_stage_transitions` — both explicitly anticipating B7 as a future caller of `SendMessage` and `MoveDealStage` respectively.

B7's task was predominantly **specifying and hardening an already-anticipated skeleton**, not inventing one from nothing — closer to B6's relationship with its own frozen Pipeline sketch than to B3's from-scratch Discovery design.

## The frontend's own warning, taken seriously

The S9 Automation feature's own source comment states it is "a deterministic in-session simulation... not a Scheduler, Worker, or Queue." This single fact shaped the entire evidence-classification pass (`B7_FRONTEND_BEHAVIOR_INVENTORY.md`): the mock's *business* signals (closed condition/action catalogs, mandatory approval for sensitive actions, dry-run testing, immutable rule-revision snapshots on every run, an explicit idempotency-key formula, an explicit forbidden-action list) were treated as strong, often Class-A evidence; its *mechanism* (synchronous, same-tick, no durable queue) was explicitly discarded in favor of the genuinely asynchronous, event-driven, durably-queued design the task requires.

## The two hardest calls

1. **Should automation be allowed to move a Deal's stage or send a WhatsApp message?** The frontend's `forbiddenAutomationActions` list says no to sending, and is silent on stage-moves. But B5 and B6 each pre-built a reserved hook for exactly these two before B7 existed, and B5 goes further — `sender_type='system'` is documented as *"reserved for a future governed-automation sender"*, `B5_MESSAGE_STATE_MACHINE.md` justifies its `cancelled` state because *"B7's future governed-automation sends will need one"*, and `B5_B6_B7_BOUNDARIES.md` §2 states B5 is compatible with the forbidden list either staying strict **or** being *"deliberately, explicitly"* relaxed through the same governed command. B7 resolves both **included**, both **hard-gated to `approval_required` with no rule-level override**. Seven of the list's nine entries stay forbidden; the two that are relaxed are declared as a decision (`B7-D-A016`), never buried (`B7_FRONTEND_BEHAVIOR_INVENTORY.md` §5).
3. **Under whose authority does a rule act?** Not the workspace's — no permission in this corpus belongs to a workspace — and not the author's. Authority is delegated from the membership that *activated* the revision (`automation_rule_revisions.activated_by_membership_id`), re-resolved live at every invocation, so automation can never do what that member could not do themselves at that moment, and stops the moment their membership does. `system:automation` is the caller identity for audit only and carries no grant.

2. **How does automation avoid triggering itself forever?** Resolved with a three-layer algorithm — lineage-based same-rule suppression, a depth bound (`MAX_AUTOMATION_DEPTH=5`), and a rolling execution budget — deliberately more nuanced than the mock's own blunt "any automation-caused run is skipped" rule, because that blunt rule would have silently broken the legitimate case the task brief itself names (a task-creation rule feeding a task-completion rule).

## Self-verification, honestly reported

This pack has been corrected twice, and both times a self-verification reported clean numbers that were not clean.

**The first pass** found six places where the pack had drifted from frozen B0 while its own matrix reported `B0_DRIFT = 0`: two frozen command names renamed, two frozen event names renamed, the frozen run state machine replaced (including `completed`→`succeeded` and a dropped `created`), the frozen approval operation renamed and split into `/approve` + `/reject`, and a new `ARULE-` prefix minted on a misreading of the registry's deferral of `AUTO-`. It also removed a `scheduled` trigger and a `wait` action carrying zero frontend evidence (FB-A57).

**A fresh independent CTO verification then found nine further MAJOR findings that pass had left**, and that its matrix had again scored as clean. `B7-FIX.1` remediates all nine: a Class-A contradiction between two storage models for rule definitions; the authorization principal stated three incompatible ways; the frozen `automationRuns` quota enforced nowhere, with an invented `automation.rules.max_active` standing in its place; the frozen `ENTITLEMENT_LOCKED`/`QUOTA_EXHAUSTED` error codes renamed; a scope reduction declared but applied to only some of the pack, leaving eleven documents still specifying `wait`/`scheduled` normatively; the rejected `succeeded` state surviving as a transition target; admission inserting runs at `queued` and bypassing `awaiting_approval`; four unresolvable references its own regex could not detect; and an auto-disable behavior promised in prose with no threshold, transition, actor, event field or test. Eleven MINOR findings were fixed alongside them.

The full before/after tables are in `B7_VERIFICATION_MATRIX.md` §7 and §7a rather than quietly overwritten, because a verification document that reports the corrected state as if it were the first result teaches a reader to trust a process that had twice failed.

## Final counters

```
B7_DOCUMENT_COUNT = 50
FRONTEND_BEHAVIOR_COUNT = 60          A=41  B=10  C=3  D=6  UNCLASSIFIED=0
OWNED_ENTITY_COUNT = 9                REFERENCED_ENTITY_COUNT = 16
COMMAND_COUNT = 12                    frozen-reused 2   additive 10
PRODUCED_EVENT_COUNT = 13             frozen-reused 2   additive 11
CONSUMED_EVENT_COUNT = 13             TRIGGER_COUNT = 14 (13 event-backed + manual, 0 scheduled)
ACTION_COUNT = 10                     9 governed + 1 internal control; TARGET_COMMAND_COUNT = 8
AUTOMATION_RUN_STATE_COUNT = 10       frozen 7   additive 3 (evaluating, skipped, dead_lettered)
CONDITION_OPERATOR_COUNT = 10         unreachable operators included = 0
PUBLIC_API_OPERATION_COUNT = 19       1 frozen, 18 additive
FAILURE_SCENARIO_COUNT = 34           duplicates 0   gaps 0
ACCEPTANCE_TEST_COUNT = 141           ACCEPTANCE_CATEGORY_COUNT = 38   NEGATIVE_CONTROL_COUNT = 78
CLASS_A 42/0 resolved                 CLASS_B 12/0 deferred-safe   CLASS_C 6/0 deferred-safe
CONTROLLED_AMENDMENT_COUNT = 5        ADDITIVE 4   COMPATIBLE_CLARIFICATIONS 1   NON_ADDITIVE 0
PERMISSIONS: frozen-reused 3, additive 0
ENTITLEMENT KEYS: frozen automation.rules + automationRuns; B7-minted keys = 0
DIRECT_WRITE_LEAKS (all domains) = 0
REVENUE_EVENT_PRODUCERS_IN_B7 = 0     RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0
B8_BILLING_AUTHORITY_LEAKS = 0        B9_FINANCE_AUTHORITY_LEAKS = 0
B0-B6 DRIFT = 0 (file-level)          IMPLEMENTATION_LEAKAGE = 0
UNDEFINED_AT_REFS / DECISION_REFS / BROKEN_FAILURE / AMENDMENT / CROSS-DOC / PLACEHOLDER = 0
```

## What happens next

This pack requires a **fresh, independent CTO verification** — not performed by this authoring pass — before any closure claim, any implementation authorization, or any B8 work may begin. Full detail in `B7_IMPLEMENTATION_READINESS.md`.
