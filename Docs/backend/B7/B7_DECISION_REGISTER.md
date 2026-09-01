# B7 — Decision Register

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Class A — resolved, required before closure

| ID | Decision | Resolved in |
|---|---|---|
| `B7-D-A001` | Nine owned entities; trigger/condition/action are revision-scoped child tables, no independent public IDs for fragments | `B7_DOMAIN_OWNERSHIP.md` §2, `B7_DATA_MODEL.md` §8 |
| `B7-D-A002` | **Promote** the already-registered `AUTO-` prefix from registry §B to §A for AutomationRule; mint no new namespace (`B7-AM-001`) | `B7_CONTROLLED_AMENDMENTS.md` `B7-AM-001` |
| `B7-D-A003` | AutomationRule field model: no distinct owner from creator; fixed (non-per-rule-configurable) concurrency and failure policy | `B7_AUTOMATION_RULE_AGGREGATE.md` §2 |
| `B7-D-A004` | Four rule states (`draft`/`active`/`disabled`/`archived`); no separate `paused` state | `B7_RULE_LIFECYCLE.md` §1 |
| `B7-D-A005` | The invoking run's `RUN-*` id is always present in the actor label supplied to every target command | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §1 |
| `B7-D-A006` | `system:automation` is not superuser — five structural guarantees | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §2 |
| `B7-D-A007` | Authorization model: **delegated authority bound to the membership that activated the revision**, re-resolved live at every invocation; no workspace-level permission is invented, and authority never outlives its principal | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3 |
| `B7-D-A008` | Closed trigger catalog; three-way evidentiary bar (frozen consumer declaration / dedicated boundary doc / frontend evidence) | `B7_TRIGGER_CATALOG.md` §1 |
| `B7-D-A009` | Event-admission transaction boundary (steps 2-6 atomic) | `B7_EVENT_CONSUMPTION_MODEL.md` §4 |
| `B7-D-A010` | Tolerance for duplicate/late/out-of-order/replayed events — no exactly-once/ordering reliance | `B7_EVENT_CONSUMPTION_MODEL.md` §5 |
| `B7-D-A011` | Exact 13-step trigger admission sequence | `B7_TRIGGER_ADMISSION.md` §1 |
| `B7-D-A012` | Closed condition DSL, no code execution of any kind | `B7_CONDITION_ENGINE.md` §1 |
| `B7-D-A013` | Field traversal safety — exact catalog membership only, no dotted-path/secret access | `B7_CONDITION_ENGINE.md` §6 |
| `B7-D-A014` | Both `event.*` and `current.*` condition namespaces, explicitly distinguished | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §1 |
| `B7-D-A015` | Stale-event behavior per namespace | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §3 |
| `B7-D-A016` | Closed 10-row action catalog (9 governed + 1 internal control), every governed action mapping to one target command; seven of the frontend's nine forbidden types stay forbidden, and `send_message`/`send_whatsapp` — **one canonical action, not two** — is relaxed under a non-configurable `approval_required` tier. **CTO-approved product/architecture decision for Phase 1**, on B5's own explicit provisioning; not a frozen amendment, because no frozen B0-B6 text changes | `B7_ACTION_CATALOG.md` §2-§4, `B7_B5_MESSAGING_BOUNDARY.md` §4, `B7_FRONTEND_BEHAVIOR_INVENTORY.md` §5 |
| `B7-D-A017` | Five separately-checked action-authorization layers | `B7_ACTION_AUTHORIZATION.md` §1 |
| `B7-D-A018` | `AutomationRun` status machine = frozen `BACKEND_STATE_MACHINES.md`'s seven names and edges verbatim (`completed`, not `succeeded`; `created`, not implicit `queued`; approval before queueing) **plus three declared additive states** (`evaluating`, `skipped`, `dead_lettered`) | `B7_EXECUTION_MODEL.md` §2-§3, `B7-AM-003` |
| `B7-D-A019` | Rule-less runs (`rule_id` nullable) for the AGA-/RUN- unification | `B7_EXECUTION_MODEL.md` §4 |
| `B7-D-A020` | Dry-run/test mode never persists a run or invokes an action | `B7_EXECUTION_MODEL.md` §5 |
| `B7-D-A021` | Sequential-actions-only, no branching/parallelism in Phase 1 | `B7_ACTION_EXECUTION_MODEL.md` §4 |
| `B7-D-A022` | Eight-class failure taxonomy, retryability per class | `B7_FAILURE_RETRY_MODEL.md` §1 |
| `B7-D-A023` | Action idempotency key `{run_id}:{action_index}`, stable across retries | `B7_IDEMPOTENCY_MODEL.md` §2 |
| `B7-D-A024` | Same-key/different-payload conflict cannot occur by construction; treated as `CONCURRENCY`, alerted, never papered over | `B7_IDEMPOTENCY_MODEL.md` §3 |
| `B7-D-A025` | Expected-version strategy: capture-then-invoke; stale conflict fails, never blindly retried | `B7_CONCURRENCY_MODEL.md` §5 |
| `B7-D-A026` | Loop-prevention algorithm: lineage + same-rule suppression + depth bound + execution budget | `B7_LOOP_PREVENTION.md` §1 |
| `B7-D-A027` | Re-entrancy policy: suppress rule recurrence, never cross-rule causation | `B7_REENTRANCY_POLICY.md` §1 |
| `B7-D-A028` | Scheduled triggers are **excluded from Phase 1** (zero frontend evidence, FB-A57); the absolute/relative one-shot design is retained as Phase-2 forward work, never built from this pack | `B7_TRIGGER_CATALOG.md` §2, `B7_SCHEDULE_DELAY_MODEL.md` |
| `B7-D-A029` | The `wait` action is **excluded from Phase 1** for the same reason; its durable-wakeup design (never a held worker) is retained as Phase-2 forward work | `B7_ACTION_CATALOG.md` §2, `B7_SCHEDULE_DELAY_MODEL.md` §2 |
| `B7-D-A030` | Cancellation semantics: which states, who, no interruption of in-flight commands, no rollback illusion | `B7_PAUSE_DISABLE_CANCEL.md` §3 |
| `B7-D-A031` | Replay creates a new run, resumes-by-default without re-invoking succeeded actions | `B7_DEAD_LETTER_REPLAY.md` §2 |
| `B7-D-A032` | Partial success is `failed` at run level, no `partially_succeeded` state | `B7_PARTIAL_SUCCESS.md` §1 |
| `B7-D-A033` | 12-command Phase-1 catalog reusing the two frozen command names (`CreateAutomationRule`, `ApproveAutomationRun`) verbatim; `CloneAutomationRule` excluded | `B7_COMMAND_EVENT_CATALOG.md` §1 |
| `B7-D-A034` | Entitlement gates are the **two frozen keys only** — capability `automation.rules` and usage metric `automationRuns`, with B1's frozen `ENTITLEMENT_LOCKED`/`QUOTA_EXHAUSTED` mapping and F16's transactional reservation reused unmodified. B7 mints no capability or metric key and supplies no numeric limits | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4-§4.1 |
| `B7-D-A035` | Scheduling, delay, the `waiting` run state, and any wakeup/timer table are **Phase-2 and absent from the Phase-1 pack**: no Phase-1 catalog entry, enum value, owned table, failure row, metric, or acceptance test references them except as an explicit exclusion | `B7_EXECUTION_MODEL.md` §7, `B7_DATA_MODEL.md` §7 |
| `B7-D-A036` | Trigger/condition/action definitions are **revision-scoped child tables, not JSON blobs** — the single authoritative persistence model, keeping frozen `BACKEND_DATA_MODEL.md` row 21's named groups as tables and making immutability structural. The nested API DTO is a response shape, never a storage form | `B7_DATA_MODEL.md` §2a-§2c, `B7_AUTOMATION_RULE_AGGREGATE.md` §3 |
| `B7-D-A037` | Approval is **run-granular**, matching the frozen `ApproveAutomationRun` command and the frozen `POST /automation/runs/{id}/approve` body (`additionalProperties:false`, no action selector); `approved:false` is the rejection path and no `/reject` operation exists | `B7_COMMAND_EVENT_CATALOG.md` §4 |
| `B7-D-A038` | An `AUTHORIZATION` failure fails the action and its run and **mutates no rule lifecycle state**: Phase 1 declares no failure threshold, no system-initiated `active → disabled` transition, and no system lifecycle actor | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.3a, `B7_RULE_LIFECYCLE.md` §2 |
| `B7-D-A039` | Every run is inserted at the frozen initial state `created` and advanced through the state machine inside the admission transaction; approval-requiring runs reach `queued` only via `awaiting_approval` | `B7_EXECUTION_MODEL.md` §3, `B7_TRIGGER_ADMISSION.md` steps 10-11 |
| `B7-D-A040` | **Event-run dedup identity is `(workspace_id, rule_id, source_event_id)`** — `rule_revision_id` is immutable execution provenance and is **excluded**, so a revision activated between two deliveries of the same event cannot admit a second run for the same rule. Enforced by the declared partial-unique `uq_automation_runs_event_rule`, alongside — not replaced by — the `automation_inbox_records` delivery-layer constraint | `B7_IDEMPOTENCY_MODEL.md` §1.1-§1.4, §4a, `B7_DATA_MODEL.md` §3 |
| `B7-D-A041` | **`skipped` is an externally-visible terminal outcome, not a silent one**: it carries a closed `skip_reason` (`conditions_not_matched`\|`quota_exhausted`\|`loop_prevention_blocked`) and emits the additive `AutomationRunSkipped` event. `AutomationRunCompleted` is never used to report a run that did not act | `B7_COMMAND_EVENT_CATALOG.md` §2, `B7_EXECUTION_MODEL.md` §2 |
| `B7-D-A042` | **Run timestamp model:** `created_at` (insert, at `created`) / `evaluated_at` / `queued_at` (entry to `queued`) / `started_at` (entry to `running`) / `completed_at` (terminal). `queued_at` is never the creation timestamp, and queue latency is `started_at − queued_at`; evaluation latency is measured separately | `B7_DATA_MODEL.md` §3, `B7_EXECUTION_MODEL.md` §1, `B7_OBSERVABILITY_AUDIT.md` §2 |

`CLASS_A_DEFINED = 42`, `CLASS_A_UNRESOLVED = 0` — every decision above is **RESOLVED**, with a specific citation, in this pack; none is left open. `B7-D-A038` and `B7-D-A039` were added by `B7-FIX.1`; `B7-D-A040`, `B7-D-A041` and `B7-D-A042` were added by `B7-FIX.2`, each promoting a decision that a fresh independent verification found stated inconsistently or left implicit rather than resolved.

## 2. Class B — important, deferred with an explicit rationale

Status is stated explicitly, never as an ambiguous "resolved": every row below is **DEFERRED_SAFE** — Phase 1 ships without it, nothing in Phase 1 depends on it, and the reason is recorded rather than assumed.

| ID | Decision | Status | Deferred because | Where noted |
|---|---|---|---|---|
| `B7-D-B001` | Rule ownership distinct from creator (reassignment) | DEFERRED_SAFE | No frontend/architecture evidence; `automation.rule.manage` already gates who may edit any workspace rule | `B7_AUTOMATION_RULE_AGGREGATE.md` §2 |
| `B7-D-B002` | `CloneAutomationRule` command | DEFERRED_SAFE | No clone/duplicate affordance anywhere in `Automation.tsx` | `B7_COMMAND_EVENT_CATALOG.md` §1 |
| `B7-D-B003` | `create_deal`/`assign_deal`/`reopen_deal` actions | DEFERRED_SAFE | No frontend evidence and no schema-reserved hook, unlike `move_deal_stage` | `B7_ACTION_CATALOG.md` §4 |
| `B7-D-B004` | `DealReopened`/`DealAssigned`/`DealUpdated` triggers | DEFERRED_SAFE | `B6_B7_AUTOMATION_BOUNDARY.md` §2 named four of B6's seven events and declined these three | `B7_TRIGGER_CATALOG.md` §3 |
| `B7-D-B005` | Discovery- and Intelligence-sourced triggers | DEFERRED_SAFE | No frozen B3/B4 consumer declaration names Automation | `B7_B3_DISCOVERY_BOUNDARY.md` §1, `B7_B4_INTELLIGENCE_BOUNDARY.md` §1 |
| `B7-D-B006` | Messaging-sourced triggers (`MessageReceived`, `ConversationClosed`, a derived `conversation_needs_reply`) | DEFERRED_SAFE | `B5_DOMAIN_OWNERSHIP.md` lists `AutomationRun` DEFERRED and pre-declares no B5 event consumer for Automation; `needs_reply` is a read-time predicate, not an event | `B7_TRIGGER_CATALOG.md` §3, `B7_B5_MESSAGING_BOUNDARY.md` §1 |
| `B7-D-B007` | `RollbackAutomationRule` command | DEFERRED_SAFE | No product evidence it is distinct from authoring a new revision | `B7_RULE_REVISION_MODEL.md` §3 |
| `B7-D-B008` | Bounded re-evaluation-and-retry after a target `409 STALE_VERSION` | DEFERRED_SAFE | Conservative default chosen instead — the action fails and the run halts, never out-competing a human's concurrent decision | `B7_CONCURRENCY_MODEL.md` §5 |
| `B7-D-B009` | Numeric values behind the two frozen entitlement keys (the `automationRuns` per-period limit, any plan-tier shaping) | DEFERRED_SAFE | B8 owns commercial numbers; B7 enforces the frozen gate and supplies no figure | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4, `B7_RATE_COST_MODEL.md` §3 |
| `B7-D-B010` | Exact retention-period numbers | DEFERRED_SAFE | No frozen general audit-retention number exists in this corpus yet; B7 inherits rather than competes with `BACKEND_DATA_GOVERNANCE.md` | `B7_RETENTION_DELETION.md` §3 |
| `B7-D-B011` | `before`/`after` timestamp condition operators, and `contains`/`not_contains` | DEFERRED_SAFE | No Phase-1 field is timestamp-typed, and `contains` is a dead declaration no frontend field permits (FB-A06) | `B7_CONDITION_ENGINE.md` §2 |
| `B7-D-B012` | `automation_inbox_records` pruning window | DEFERRED_SAFE | Pure infrastructure bookkeeping; a short prune window is safe once redelivery is no longer realistic | `B7_RETENTION_DELETION.md` §1 |

`CLASS_B_DEFINED = 12`, `CLASS_B_UNRESOLVED = 0` — every Class B item carries an explicit, documented DEFERRED_SAFE disposition; none is silently missing, and none is claimed as resolved.

## 3. Class C — future product/operational decisions

| ID | Decision | Status | Notes |
|---|---|---|---|
| `B7-D-C001` | Any scheduled or time-based automation, recurring or one-shot | DEFERRED_SAFE | No product evidence of any kind (FB-A57). Phase 1 ships none and defines none; `B7_SCHEDULE_DELAY_MODEL.md` holds the forward design for whenever evidence appears |
| `B7-D-C002` | Compensation/rollback workflows | DEFERRED_SAFE | Explicitly out of scope per task brief §36; would require new governed compensating commands from target domains, not a B7-only decision |
| `B7-D-C003` | Automation-invoked messaging beyond the mandatory-approval Phase-1 shape (a future relaxed tier) | DEFERRED_SAFE | `B5_B6_B7_BOUNDARIES.md` §2 explicitly leaves this to a future phase; Phase 1's tier is fixed `approval_required` and not rule-configurable |
| `B7-D-C004` | Per-**action** approval granularity | DEFERRED_SAFE | Would require amending the frozen `AutomationApprovalRequest` body, which carries no action selector and is `additionalProperties:false`; no evidence justifies that, and Phase-1 rules authored through the live React surface carry one action (FB-A54), so the two granularities coincide in practice |
| `B7-D-C005` | Whether dry-run (`RunAutomationTest`) evaluations are metered under any commercial metric | DEFERRED_SAFE | Frozen truth is silent, and B7 declines to invent commercial behavior. Phase 1 reserves nothing for a dry run because it creates no `AutomationRun`; a decision to meter test evaluations is B8's, under a metric B8 names |
| `B7-D-C006` | Automatically disabling a rule after repeated authorization failures | DEFERRED_SAFE | An operational policy, not a Phase-1 safety requirement — escalation is already prevented by live per-invocation authorization (`B7-D-A038`). If ever adopted it needs a first-class Class-A lifecycle transition with its own actor, threshold, event field, and tests; Phase 1 promises none of it |

`CLASS_C_DEFINED = 6`, `CLASS_C_UNRESOLVED = 0` — none blocks Phase-1 closure; each is recorded with a stable ID, not silently assumed.
