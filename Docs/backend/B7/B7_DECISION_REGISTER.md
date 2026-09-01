# B7 — Decision Register

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Class A — resolved, required before closure

| ID | Decision | Resolved in |
|---|---|---|
| `B7-D-A001` | Seven owned entities; trigger/condition/action stored as hybrid normalized-internal/nested-external content, no independent public IDs for fragments | `B7_DOMAIN_OWNERSHIP.md` §2 |
| `B7-D-A002` | New public-ID prefix `ARULE-` for AutomationRule (controlled amendment) | `B7_DOMAIN_OWNERSHIP.md` §5 |
| `B7-D-A003` | AutomationRule field model: no distinct owner from creator; fixed (non-per-rule-configurable) concurrency and failure policy | `B7_AUTOMATION_RULE_AGGREGATE.md` §2 |
| `B7-D-A004` | Four rule states (`draft`/`active`/`disabled`/`archived`); no separate `paused` state | `B7_RULE_LIFECYCLE.md` §1 |
| `B7-D-A005` | The invoking run's `RUN-*` id is always present in the actor label supplied to every target command | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §1 |
| `B7-D-A006` | `system:automation` is not superuser — five structural guarantees | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §2 |
| `B7-D-A007` | Authorization model: workspace-capability-plus-rule-context, never creator-delegated authority | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3 |
| `B7-D-A008` | Closed trigger catalog; three-way evidentiary bar (frozen consumer declaration / dedicated boundary doc / frontend evidence) | `B7_TRIGGER_CATALOG.md` §1 |
| `B7-D-A009` | Event-admission transaction boundary (steps 2-6 atomic) | `B7_EVENT_CONSUMPTION_MODEL.md` §4 |
| `B7-D-A010` | Tolerance for duplicate/late/out-of-order/replayed events — no exactly-once/ordering reliance | `B7_EVENT_CONSUMPTION_MODEL.md` §5 |
| `B7-D-A011` | Exact 13-step trigger admission sequence | `B7_TRIGGER_ADMISSION.md` §1 |
| `B7-D-A012` | Closed condition DSL, no code execution of any kind | `B7_CONDITION_ENGINE.md` §1 |
| `B7-D-A013` | Field traversal safety — exact catalog membership only, no dotted-path/secret access | `B7_CONDITION_ENGINE.md` §6 |
| `B7-D-A014` | Both `event.*` and `current.*` condition namespaces, explicitly distinguished | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §1 |
| `B7-D-A015` | Stale-event behavior per namespace | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §3 |
| `B7-D-A016` | Closed action catalog, every action maps to one governed command | `B7_ACTION_CATALOG.md` §1 |
| `B7-D-A017` | Five separately-checked action-authorization layers | `B7_ACTION_AUTHORIZATION.md` §1 |
| `B7-D-A018` | Ten-state `AutomationRun` status machine | `B7_EXECUTION_MODEL.md` §2 |
| `B7-D-A019` | Rule-less runs (`rule_id` nullable) for the AGA-/RUN- unification | `B7_EXECUTION_MODEL.md` §4 |
| `B7-D-A020` | Dry-run/test mode never persists a run or invokes an action | `B7_EXECUTION_MODEL.md` §5 |
| `B7-D-A021` | Sequential-actions-only, no branching/parallelism in Phase 1 | `B7_ACTION_EXECUTION_MODEL.md` §4 |
| `B7-D-A022` | Eight-class failure taxonomy, retryability per class | `B7_FAILURE_RETRY_MODEL.md` §1 |
| `B7-D-A023` | Action idempotency key `{run_id}:{action_index}`, stable across retries | `B7_IDEMPOTENCY_MODEL.md` §2 |
| `B7-D-A024` | Same-key/different-payload conflict cannot occur by construction; treated as `CONCURRENCY`, alerted, never papered over | `B7_IDEMPOTENCY_MODEL.md` §3 |
| `B7-D-A025` | Expected-version strategy: capture-then-invoke; stale conflict fails, never blindly retried | `B7_CONCURRENCY_MODEL.md` §5 |
| `B7-D-A026` | Loop-prevention algorithm: lineage + same-rule suppression + depth bound + execution budget | `B7_LOOP_PREVENTION.md` §1 |
| `B7-D-A027` | Re-entrancy policy: suppress rule recurrence, never cross-rule causation | `B7_REENTRANCY_POLICY.md` §1 |
| `B7-D-A028` | Scheduled triggers: absolute + relative only, UTC storage, no cron engine | `B7_SCHEDULE_DELAY_MODEL.md` §1 |
| `B7-D-A029` | Wait/delay action never holds a worker; durable wakeup record | `B7_SCHEDULE_DELAY_MODEL.md` §2 |
| `B7-D-A030` | Cancellation semantics: which states, who, no interruption of in-flight commands, no rollback illusion | `B7_PAUSE_DISABLE_CANCEL.md` §3 |
| `B7-D-A031` | Replay creates a new run, resumes-by-default without re-invoking succeeded actions | `B7_DEAD_LETTER_REPLAY.md` §2 |
| `B7-D-A032` | Partial success is `failed` at run level, no `partially_succeeded` state | `B7_PARTIAL_SUCCESS.md` §1 |
| `B7-D-A033` | 11-command Phase-1 catalog, `CloneAutomationRule` excluded | `B7_COMMAND_EVENT_CATALOG.md` §1 |
| `B7-D-A034` | Entitlement gate shape (`automation.rules`, `automation.rules.max_active`), numeric values deferred to B8 | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4 |

`CLASS_A_DEFINED = 34`, `CLASS_A_UNRESOLVED = 0` — every decision above is resolved, with a specific citation, in this pack; none is left open.

## 2. Class B — important, safely deferrable

| Decision | Deferred because | Where noted |
|---|---|---|
| Rule ownership distinct from creator (reassignment) | No frontend/architecture evidence | `B7_AUTOMATION_RULE_AGGREGATE.md` §2 |
| `CloneAutomationRule` command | No frontend evidence | `B7_COMMAND_EVENT_CATALOG.md` §1 |
| `create_deal`/`assign_deal`/`reopen_deal` actions | No frontend or schema-reserved-hook evidence | `B7_ACTION_CATALOG.md` §4 |
| `DealReopened`/`DealAssigned`/`DealUpdated` triggers | B6's own boundary doc declined to name them | `B7_TRIGGER_CATALOG.md` §3 |
| Discovery/AI-sourced triggers | No frozen consumer declaration from B3/B4 | `B7_B3_DISCOVERY_BOUNDARY.md` §1, `B7_B4_INTELLIGENCE_BOUNDARY.md` §1 |
| Messaging-sourced triggers (`MessageReceived` etc.) | B5 explicitly deferred, no consumer pre-declaration | `B7_TRIGGER_CATALOG.md` §3 |
| `RollbackAutomationRule` command | No product evidence it's distinct from re-editing | `B7_RULE_REVISION_MODEL.md` §3 |
| Bounded re-evaluation-and-retry policy after a version conflict | Conservative default (fail, don't retry) chosen instead | `B7_CONCURRENCY_MODEL.md` §5 |
| Numeric entitlement limits (`max_active`, any future execution quota) | B8 not yet designed | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4, `B7_RATE_COST_MODEL.md` §3 |
| Exact retention-period numbers | No frozen general audit-retention number exists yet | `B7_RETENTION_DELETION.md` §3 |
| `before`/`after` timestamp condition operators | No Phase-1 field currently needs them | `B7_CONDITION_ENGINE.md` §2 |
| `contains`/`not_contains` operators | Dead declaration in frontend fixture, no field uses them | `B7_CONDITION_ENGINE.md` §2 |
| `automation_inbox_records`/`automation_wakeups` pruning windows | Pure infrastructure bookkeeping, short-window prune safe | `B7_RETENTION_DELETION.md` §1 |

`CLASS_B_UNRESOLVED = 0` in the sense that every Class B item has an explicit, documented deferral with rationale — none is silently missing.

## 3. Class C — future product/operational decisions

| Decision | Notes |
|---|---|
| Recurring cron-style scheduled triggers | No product evidence yet; Phase-1 covers one-shot absolute/relative only |
| Compensation/rollback workflows | Explicitly out of scope per task brief §36; would require new governed compensating commands from target domains, not a B7-only decision |
| Execution-count-based commercial quotas | Awaits B8 commercial design |
| Automation-invoked messaging beyond the mandatory-approval Phase-1 shape (e.g. a future relaxed tier) | `B5_B6_B7_BOUNDARIES.md` §2 explicitly leaves this to a future phase |

`CLASS_C_UNRESOLVED = 0` — none of these blocks Phase-1 closure; each is recorded, not silently assumed.
