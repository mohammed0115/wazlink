# B7 — Executive Summary

> **B7 status:** Target design only. **B7 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing in this package is approved, and no implementation may act on it.

## What B7 is

B7 designs WazLink's **Automation** domain: `trigger matched → conditions satisfied → actions planned → governed command invoked → execution recorded`. It is an orchestration layer, not an alternative authority — it owns seven of its own entities (`AutomationRule`, `AutomationRuleRevision`, `AutomationRun`, `AutomationActionExecution`, `AutomationApproval`, `AutomationInboxRecord`, `AutomationWakeup`) and never writes a table any other domain owns.

## What B7 inherited, not invented

Unlike a phase starting from a blank sketch, B7 found substantial frozen infrastructure already waiting for it, precisely because B0-B6 were each authored anticipating automation would eventually arrive:

- `RUN-*` (AutomationRun) was already a registered public-ID prefix (`BACKEND_PUBLIC_ID_REGISTRY.md` §A).
- `AutomationRule` was already named as a versioned, optimistic-concurrency DTO in `BACKEND_ARCHITECTURE_DECISIONS.md`, alongside Lead/Deal/Task.
- `BACKEND_DATA_MODEL.md` row 21 already sketched the exact table group (`automation_rules, triggers, conditions, actions, runs, step_runs, approvals`).
- Three RBAC permissions (`automation.rule.view`, `automation.rule.manage`, `automation.run.approve`) were already frozen with a full role matrix in `B1_AUTHORIZATION_RBAC.md`.
- B2 had already named the exact five commands automation may invoke (`CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`) and the exact actor-identity convention (`actor_type='system:automation'`, `actor_label='automation_run:RUN-*'`).
- B5 had reserved `senderType='system'` and B6 had reserved a `NULL`-actor slot on `deal_stage_transitions` — both explicitly anticipating B7 as a future caller of `SendMessage` and `MoveDealStage` respectively.

B7's task was predominantly **specifying and hardening an already-anticipated skeleton**, not inventing one from nothing — closer to B6's relationship with its own frozen Pipeline sketch than to B3's from-scratch Discovery design.

## The frontend's own warning, taken seriously

The S9 Automation feature's own source comment states it is "a deterministic in-session simulation... not a Scheduler, Worker, or Queue." This single fact shaped the entire evidence-classification pass (`B7_FRONTEND_BEHAVIOR_INVENTORY.md`): the mock's *business* signals (closed condition/action catalogs, mandatory approval for sensitive actions, dry-run testing, immutable rule-revision snapshots on every run, an explicit idempotency-key formula, an explicit forbidden-action list) were treated as strong, often Class-A evidence; its *mechanism* (synchronous, same-tick, no durable queue) was explicitly discarded in favor of the genuinely asynchronous, event-driven, durably-queued design the task requires.

## The two hardest calls

1. **Should automation be allowed to move a Deal's stage or send a WhatsApp message?** The frontend's own `forbiddenAutomationActions` list says no to sending, and is silent on stage-moves. But B5 and B6 had each independently pre-built a reserved actor-identity hook for exactly these two actions before B7 existed — strong evidence the intended answer is "yes, under mandatory human approval, through the unmodified admission sequence," not "no." B7 resolves both **included**, both **hard-gated to `approval_required` with no rule-level override**, and documents the tension explicitly (`B7_ACTION_CATALOG.md` §3) rather than picking silently.
2. **How does automation avoid triggering itself forever?** Resolved with a three-layer algorithm — lineage-based same-rule suppression, a depth bound (`MAX_AUTOMATION_DEPTH=5`), and a rolling execution budget — deliberately more nuanced than the mock's own blunt "any automation-caused run is skipped" rule, because that blunt rule would have silently broken the legitimate case the task brief itself names (a task-creation rule feeding a task-completion rule).

## Self-verification, honestly reported

The authoring pass's own mechanical verification (`B7_VERIFICATION_MATRIX.md`) found and fixed real reference-integrity defects before reporting clean — several `AT-*` ids cited from prose inside individual design documents (the firewall, security, and boundary documents) had never been added as rows to the master acceptance-test file. This is disclosed, not hidden, because it is exactly the class of error an independent verifier should be checking for regardless.

## Final counters

```
B7_DOCUMENT_COUNT = 50
OWNED_ENTITY_COUNT = 7                REFERENCED_ENTITY_COUNT = 10
COMMAND_COUNT = 11                    PRODUCED_EVENT_COUNT = 12   CONSUMED_EVENT_COUNT = 13
PUBLIC_API_OPERATION_COUNT = 20
FAILURE_SCENARIO_COUNT = 34
ACCEPTANCE_TEST_COUNT = 106           ACCEPTANCE_CATEGORY_COUNT = 38   NEGATIVE_CONTROL_COUNT = 53
CLASS_A_DEFINED = 34                  CLASS_A_UNRESOLVED = 0
CONTROLLED_AMENDMENT_COUNT = 2        NON_ADDITIVE_AMENDMENTS = 0
DIRECT_WRITE_LEAKS (all domains) = 0
REVENUE_EVENT_PRODUCERS_IN_B7 = 0     RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0
B0-B6 DRIFT = 0                       IMPLEMENTATION_LEAKAGE = 0
```

## What happens next

This pack requires a **fresh, independent CTO verification** — not performed by this authoring pass — before any closure claim, any implementation authorization, or any B8 work may begin. Full detail in `B7_IMPLEMENTATION_READINESS.md`.
