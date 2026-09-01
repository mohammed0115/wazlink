# B7 — Acceptance Tests

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Domain ownership — AT-DOM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DOM-1 | — | inspect `automation_rules`/`automation_rule_revisions`/`automation_runs`/`automation_action_executions`/`automation_approvals`/`automation_inbox_records`/`automation_wakeups` write access | only B7 application services write them | `B7_DOMAIN_OWNERSHIP.md` §2 |
| AT-DOM-2 **NC** | — | an implementation writing `leads`/`tasks`/`appointments` from a B7 command | rejected at design review — no B7 code path holds a repository handle | `B7_DIRECT_WRITE_FIREWALL.md` §2 |
| AT-DOM-3 **NC** | — | an implementation where any B7 event handler or action writes a `revenue_events`/`attribution_touchpoints` row | rejected — no B7 table has that write path | `B7_REVENUE_FIREWALL.md` §2 |
| AT-DOM-4 | — | inspect `AutomationRuleRevision`/`AutomationActionExecution`/`AutomationApproval` ownership | B7-owned, additive, no independent public-ID prefix | `B7_DOMAIN_OWNERSHIP.md` §2 |

## 2. Tenancy — AT-TEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TEN-1 | `ARULE-*` in workspace A | `GET /automation/rules/{id}` as workspace B member | `404 ENTITY_NOT_FOUND` | Doctrine R-1 |
| AT-TEN-2 | `RUN-*` in workspace A | `GET`/`approve`/`cancel`/`replay` as workspace B member | `404`, identical shape to a genuinely absent resource | Doctrine R-1 |
| AT-TEN-3 **NC** | a Lead in workspace B | a workspace-A rule's action references that `lead_ref` | `404 ENTITY_NOT_FOUND`, never a validation error — the task brief's "cross-workspace target reference is denied" negative control | Doctrine R-2, `B7-AF-003` |
| AT-TEN-4 | a domain event's envelope names workspace A | admission | matching rules are located only within workspace A, never any other workspace | `B7_EVENT_CONSUMPTION_MODEL.md` §2 |

## 3. RBAC — AT-RBAC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RBAC-1 | `viewer` role | `GET /automation/rules` | `200`, read-only | `B1_AUTHORIZATION_RBAC.md`, `automation.rule.view` row |
| AT-RBAC-2 | `sales` role | `POST /automation/rules` | `403` — `automation.rule.manage` is `sales: C`, no unconditional grant | same, `automation.rule.manage` row |
| AT-RBAC-3 | `sales` role, rule authored by this same member | `ApproveAutomationAction` on that rule's own pending action | `403` \| `self_approval_forbidden` | `B7_ACTION_AUTHORIZATION.md` §2, `B7-AF-031` |
| AT-RBAC-4 | `manager` role, rule authored by a different member | `ApproveAutomationAction` | `200` | `automation.run.approve` row, `manager: A` |
| AT-RBAC-5 **NC** | — | an implementation letting `automation.rule.manage` alone authorize action approval without `automation.run.approve` | fails — two independently checked permission codes | `B7_ACTION_AUTHORIZATION.md` §2 |

## 4. Entitlements — AT-ENT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-ENT-1 | workspace lacks `automation.rules` | `POST /automation/rules/{id}/activate` | `403` \| `entitlement_required` | `B7-AF-004` |
| AT-ENT-2 | workspace at `automation.rules.max_active` | `ActivateAutomationRule` on one more rule | `403` \| `usage_exhausted` | `B7-AF-005` |
| AT-ENT-3 | rule `active`, then workspace entitlement revoked | inspect the rule | still `active`, not retroactively disabled; only new admission is blocked | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4 |
| AT-ENT-4 | run `running`, entitlement revoked mid-flight | inspect the run | finishes uninterrupted | `B7_ACTION_AUTHORIZATION.md` §4 |

## 5. Rule lifecycle — AT-LIFE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LIFE-1 | valid DTO | `CreateAutomationRule` | `201`, `status=draft` always, regardless of requested status | `B7_AUTOMATION_RULE_AGGREGATE.md` §4 |
| AT-LIFE-2 | `draft` rule | `ActivateAutomationRule` | `200`, `status=active`, full validation re-run | `B7_RULE_LIFECYCLE.md` §2 |
| AT-LIFE-3 | `active` rule | `ArchiveAutomationRule` directly | `409` \| `invalid_transition` — must `DisableAutomationRule` first | `B7_RULE_LIFECYCLE.md` §2 |
| AT-LIFE-4 | `archived` rule | `ActivateAutomationRule` | `409` \| `invalid_transition` — terminal | same |
| AT-LIFE-5 **NC** | `draft` rule | an implementation admitting a trigger event against it | fails — `draft` never evaluates triggers | `B7_RULE_LIFECYCLE.md` §3 |

## 6. Revision immutability — AT-RVN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RVN-1 | run exists against revision 1 | `UpdateAutomationRule` (revision 2) | the original run's `rule_revision_id` and its bound revision's content are unchanged | `B7_RULE_REVISION_MODEL.md` §4 |
| AT-RVN-2 **NC** | same as above | an implementation displaying the run's history from the *current* `active_revision_id` instead of the run's own stored `rule_revision_id` | fails — the task brief's "editing a rule cannot rewrite historical execution revision" negative control | `B7_RULE_REVISION_MODEL.md` §4 |
| AT-RVN-3 | `active` rule edited | `UpdateAutomationRule` | new revision activates atomically; no window where `active_revision_id` is null | `B7_RULE_REVISION_MODEL.md` §3 |

## 7. Trigger matching — AT-TRIG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TRIG-1 | active rule, trigger `lead_created` | `LeadCreated` event | run admitted, `matched_conditions` evaluated | `B7_TRIGGER_CATALOG.md` §2 |
| AT-TRIG-2 **NC** | — | an implementation accepting a trigger type outside the closed catalog | rejected at DTO validation | `B7-AF-009` |
| AT-TRIG-3 | active rule, trigger `deal_won` | `DealWon` event | run admitted | `B6_B7_AUTOMATION_BOUNDARY.md` §2 |

## 8. Event dedup — AT-DEDUP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DEDUP-1 **NC** | same `event_id` delivered twice | second delivery | zero duplicate `automation_runs`; the task brief's explicit "duplicate source event cannot duplicate logical execution" negative control | `B7_EVENT_CONSUMPTION_MODEL.md` §3-4 |
| AT-DEDUP-2 | crash between inbox-record commit and Celery enqueue | reconciliation sweep | the already-`queued` run is re-enqueued, never re-admitted a second time | `B7_EVENT_CONSUMPTION_MODEL.md` §4 |

## 9. Condition DSL — AT-COND

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-COND-1 | condition `lead.priority equals high` | matching Lead | `matched_conditions=true` | `B7_CONDITION_ENGINE.md` §2 |
| AT-COND-2 | field missing from payload, operator `is_unknown` | evaluate | matches `true` | `B7_CONDITION_ENGINE.md` §4 |
| AT-COND-3 **NC** | — | an implementation accepting a `field`/`operator` pair outside the allow-list | rejected at validation | `B7-AF-010` |
| AT-COND-4 **NC** | — | an implementation resolving a condition field via dotted-path traversal into a raw provider payload | fails design review — fields are matched by exact catalog membership only | `B7_CONDITION_ENGINE.md` §6 |

## 10. Condition snapshots — AT-SNAP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SNAP-1 | condition `event.to_stage_ref equals STG-X` | Deal moves to X then immediately to Y before evaluation | condition still matches X (evaluated against the event payload, not live state) | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §3 |
| AT-SNAP-2 | condition `current.deal.stage_ref equals STG-X`, same race | evaluate after the second move | does not match — reflects live state | same |

## 11. Action → command mapping — AT-ACT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-ACT-1 | action `create_task`, `auto_safe` | condition matched | `CreateTask` invoked directly, no approval gate | `B7_ACTION_CATALOG.md` §2 |
| AT-ACT-2 | action `send_message` | condition matched | action enters `awaiting_approval` regardless of the rule's `execution_policy` | `B7_ACTION_CATALOG.md` §3 |
| AT-ACT-3 **NC** | — | an implementation invoking `close_won_deal`/`change_deal_value` from any action | rejected — not on the closed catalog | `B7_ACTION_CATALOG.md` §4 |

## 12. Direct-write firewall — AT-DWF

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DWF-1 **NC** | — | `UPDATE leads SET ...` from any B7 path | rejected — the task brief's "automation cannot direct-write Lead" negative control | `B7_DIRECT_WRITE_FIREWALL.md` §3 |
| AT-DWF-2 **NC** | — | `INSERT INTO messages ...` bypassing `SendMessage` | rejected — "automation cannot direct-write Message" | same |
| AT-DWF-3 **NC** | — | `UPDATE deals SET stage_id = ...` bypassing `MoveDealStage` | rejected — "automation cannot direct-write Deal" | same |
| AT-DWF-4 **NC** | — | an implementation creating a `RevenueEvent` from any B7 action, trigger, or internal control action | rejected | `B7_DIRECT_WRITE_FIREWALL.md` §2 |
| AT-DWF-5 **NC** | — | an implementation marking a `Payment` row `succeeded` from a B7 action | rejected — no B8 write dependency exists | same |
| AT-DWF-6 **NC** | — | an implementation directly setting a workspace's entitlement row to grant itself `automation.rules` | rejected — B7 only ever reads an entitlement decision | same |

## 13. Revenue firewall — AT-RFW

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RFW-1 **NC** | trigger `deal_won` | rule executes | zero `RevenueEvent` rows — the task brief's "DealWon-triggered automation cannot create RevenueEvent" negative control | `B7_REVENUE_FIREWALL.md` §3 |
| AT-RFW-2 **NC** | — | an implementation defining an action calling an undeclared `RecordRevenueEvent` | rejected at design review | same |
| AT-RFW-3 **NC** | rule disabled/archived after reacting to `deal_won` | inspect financial truth | zero effect on any `RevenueEvent` | same |
| AT-RFW-4 **NC** | a `deal_won`-triggered `move_deal_stage` action is retried after a transient B6 failure | retry | no duplicate `RevenueEvent` — `move_deal_stage` never touches revenue truth in the first place | same |
| AT-RFW-5 **NC** | old `automation_runs`/`automation_action_executions` rows purged under retention policy | inspect financial truth | zero effect — B7's own audit history is never the system of record for revenue | `B7_RETENTION_DELETION.md` §2 |

## 14. Execution lifecycle — AT-EXEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EXEC-1 | run `queued` | worker picks up | `evaluating` → `running`/`awaiting_approval`/`skipped` | `B7_EXECUTION_MODEL.md` §3 |
| AT-EXEC-2 **NC** | run `succeeded` | an implementation transitioning it back to `running` | fails — no legal transition | `B7_EXECUTION_MODEL.md` §3 |
| AT-EXEC-3 | rule-less run (`trigger_source=recommendation`) | inspect `rule_id`/`rule_revision_id` | both null; action embedded directly on the run | `B7_EXECUTION_MODEL.md` §4 |
| AT-EXEC-4 | `RunAutomationTest` | dry-run | no `automation_runs` row persisted, no action invoked | `B7_EXECUTION_MODEL.md` §5 |

## 15. Action execution — AT-AEXEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-AEXEC-1 | action 1 fails | inspect action 2/3 | `skipped`, `skip_reason=upstream_failure` | `B7_ACTION_EXECUTION_MODEL.md` §4 |
| AT-AEXEC-2 | `stop_execution` reached | inspect remaining actions | `skipped`, `skip_reason=stop_execution`; run `succeeded` | `B7_ACTION_CATALOG.md` §5 |
| AT-AEXEC-3 **NC** | — | an implementation executing two actions of the same run in parallel | fails — sequential only | `B7_ACTION_EXECUTION_MODEL.md` §4 |

## 16. Retry — AT-RETRY

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RETRY-1 | action fails `DEPENDENCY_UNAVAILABLE` | retry | exponential backoff with full jitter, cap 15 min, max 5 attempts | `B7_FAILURE_RETRY_MODEL.md` §2 |
| AT-RETRY-2 **NC** | action fails `PERMANENT` | an implementation retrying it | fails — settles immediately, no backoff entered | `B7_FAILURE_RETRY_MODEL.md` §4 |
| AT-RETRY-3 **NC** | action already `succeeded` once, worker crash triggers a spurious re-invocation | retry executes | the task brief's "retry cannot duplicate successful action" negative control — target command's idempotency guard returns the stored response, no duplicate mutation | `B7_IDEMPOTENCY_MODEL.md` §5, `AT-IDEM-B7-2` |

## 17. Idempotency — AT-IDEM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IDEM-1 | same `(rule_id, rule_revision_id, source_event_id)` | redelivered event | resolves to the existing run, no duplicate | `B7_IDEMPOTENCY_MODEL.md` §1 |
| AT-IDEM-2 | action retried | same action idempotency key on every attempt | `B7_IDEMPOTENCY_MODEL.md` §2 |
| AT-IDEM-3 **NC** | — | an implementation generating a random idempotency key per retry attempt | fails — the task brief's explicit prohibition | same |

## 18. Concurrency — AT-CONC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONC-1 | same rule, same target Lead, two runs admitted near-simultaneously | both reach action phase | advisory lock serializes their action phases | `B7_CONCURRENCY_MODEL.md` §2 |
| AT-CONC-2 | rule edited while a run is `running` against it | inspect the run | unaffected, uses captured revision | `B7_CONCURRENCY_MODEL.md` §3 |
| AT-CONC-3 | two scheduled wakeups for the same `(run_id, action_index)` | both sweep workers race | `SKIP LOCKED` ensures exactly one fires | `B7_CONCURRENCY_MODEL.md` §4 |

## 19. Expected-version — AT-VER

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-VER-1 | automation intends `MoveDealStage` to X; human already moved to Y | action invoked with stale `expected_version` | `409`, action `failed`, run halts — never silently overwrites the human's choice | `B7_CONCURRENCY_MODEL.md` §5 |
| AT-VER-2 **NC** | same as above | an implementation re-reading and blindly retrying the same mutation | fails — the task brief's "automation cannot bypass B6 expected_version" negative control | same |

## 20. Loop prevention — AT-LOOP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LOOP-1 **NC** | Rule A's own action produces the exact event that is Rule A's own trigger | admission | second admission for Rule A within the lineage is blocked — "same rule cannot recursively trigger itself without bound" | `B7_LOOP_PREVENTION.md` §1-2 |
| AT-LOOP-2 **NC** | Rule A → Rule B → Rule A → Rule B cycle | admission at depth 2 | blocked by same-rule suppression — "two-rule cycle is bounded" | same |
| AT-LOOP-3 | Rule A → Rule B, distinct rules, no cycle | admission | both admit normally, `depth` increments, no suppression | `B7_REENTRANCY_POLICY.md` §2 |

## 21. Re-entrancy — AT-REENT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REENT-1 | Rule A creates a Task; human completes it; Rule B triggers on `task_completed` | Rule B admission | admits normally — legitimate downstream causation, human-caused event has no automation lineage | `B7_REENTRANCY_POLICY.md` §2 |

## 22. Schedule / delay — AT-SCHED

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SCHED-1 | `wait` action, duration 1h | action reached | run → `waiting`, no worker held; `automation_wakeups` row persisted | `B7_SCHEDULE_DELAY_MODEL.md` §2 |
| AT-SCHED-2 | rule disabled while a run is `waiting` | wakeup fires | run resumes and completes normally | same |
| AT-SCHED-3 | duplicate wakeup delivery | sweep | no-op past first `fired` transition | `B7_SCHEDULE_DELAY_MODEL.md` §3 |

## 23. Pause / disable / archive — AT-PDA

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PDA-1 **NC** | rule `disabled` | a matching event arrives | no new run admitted for this rule — the task brief's "paused/disabled rule cannot admit forbidden new executions" negative control | `B7_PAUSE_DISABLE_CANCEL.md` §2 |
| AT-PDA-2 | rule `disabled`, a run was `queued` at the moment of disabling | inspect that run | `cancelled` | same |
| AT-PDA-3 | rule `disabled`, a run was `running` at the moment of disabling | inspect that run | finishes uninterrupted | same |

## 24. Cancel — AT-CANCEL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CANCEL-1 **NC** | action 1 already invoked `MoveDealStage` successfully | `CancelAutomationExecution` | the Deal's stage is **not** reversed — the task brief's "cancelling automation cannot undo an already-committed Deal mutation" negative control | `B7_PAUSE_DISABLE_CANCEL.md` §3 |
| AT-CANCEL-2 | run `awaiting_approval` | `CancelAutomationExecution` | `cancelled`, no invocation ever occurs | same |

## 25. Dead letter — AT-DL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DL-1 | action exhausts 5 retryable attempts | inspect run | `dead_lettered`, full attempt/error history preserved | `B7_DEAD_LETTER_REPLAY.md` §1 |

## 26. Replay — AT-REPLAY

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REPLAY-1 **NC** | dead-lettered run, actions 1-2 `succeeded`, action 3 exhausted | `ReplayAutomationExecution` (resume mode) | new `RUN-*`; actions 1-2 carried forward with no re-invocation; only action 3 actually invoked — the task brief's "replay cannot duplicate already-successful side effects" negative control | `B7_DEAD_LETTER_REPLAY.md` §2-3 |
| AT-REPLAY-2 | source run `succeeded` (not dead-lettered) | `ReplayAutomationExecution` | `409` \| `replay_invalid` | `B7-AF-025` |

## 27. Partial success — AT-PARTIAL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PARTIAL-1 | action 1 succeeds, action 2 fails | inspect run | `status=failed`, not a distinct "partial" status; action-level detail fully preserved | `B7_PARTIAL_SUCCESS.md` §1-2 |
| AT-PARTIAL-2 **NC** | same as above | an implementation reversing action 1's already-committed Task | fails — no compensation exists | `B7_PARTIAL_SUCCESS.md` §4 |

## 28. B2 boundary — AT-B2CRM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B2CRM-1 **NC** | — | an implementation invoking `AddContact`/`ArchiveLead` from a B7 action | rejected — not automation-invocable per B2's own frozen list | `B7_B2_CRM_BOUNDARY.md` §5 |
| AT-B2CRM-2 **NC** | `LeadCreated` event | an implementation deriving `workspace_id` for the resulting run from the event payload's Lead content rather than the trusted envelope | fails | `B7_ENTITLEMENT_RBAC_TENANCY.md` §3 |

## 29. B3 boundary — AT-B3DISC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B3DISC-1 **NC** | — | an implementation adding `discovery_job_completed` as a trigger without a frozen consumer-declaration amendment | fails design review | `B7_B3_DISCOVERY_BOUNDARY.md` §4 |

## 30. B4 boundary — AT-B4INT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B4INT-1 **NC** | a B4 recommendation exists | accepting it directly invokes `SendMessage` with no `AutomationRun`/approval gate | fails — the task brief's "B4 recommendation cannot authorize message send" negative control | `B7_B4_INTELLIGENCE_BOUNDARY.md` §4 |

## 31. B5 boundary — AT-B5MSG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B5MSG-1 **NC** | recipient has not consented / outside service window | `send_message` action invoked | `SendMessage`'s own consent/service-window guard rejects it — the task brief's "automation cannot bypass B5 consent/template/service-window rules" negative control | `B7_B5_MESSAGING_BOUNDARY.md` §2 |
| AT-B5MSG-2 **NC** | — | an implementation setting `execution_policy=auto_safe` to skip approval for `send_message` | fails — safety tier is fixed, not rule-configurable | `B7_ACTION_CATALOG.md` §3 |

## 32. B6 boundary — AT-B6PIPE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B6PIPE-1 **NC** | — | an implementation invoking `CloseDealWon`/`CloseDealLost` from any B7 action | rejected — not on the closed catalog | `B7_B6_PIPELINE_BOUNDARY.md` §5 |
| AT-B6PIPE-2 **NC** | — | an implementation exposing a second "automation Deal-mutation" command/endpoint that skips `B6_DEAL_STATE_MACHINE.md`'s guards | fails — structurally absent, no such command exists to expose | `B7_B6_PIPELINE_BOUNDARY.md` §5 |

## 33. B8 negative boundary — AT-B8BILL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B8BILL-1 **NC** | — | an implementation computing/displaying a plan price inside any B7 DTO | fails — no such field exists | `B7_B8_BILLING_BOUNDARY.md` §4 |

## 34. B9 negative boundary — AT-B9FIN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B9FIN-1 **NC** | — | an implementation storing an "estimated revenue impact" on any B7 row | fails — no such column exists | `B7_B9_FINANCE_BOUNDARY.md` §4 |

## 35. B12 boundary — AT-B12ASYNC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B12ASYNC-1 **NC** | — | an implementation specifying a Celery queue name/Redis key/worker concurrency number in any B7 design document | fails — infrastructure topology belongs to B12 | `B7_B12_ASYNC_BOUNDARY.md` §3 |

## 36. Security — AT-SEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SEC-1 **NC** | — | an implementation deriving `workspace_id` for admission from event payload content rather than the trusted envelope | fails | `B7_EVENT_CONSUMPTION_MODEL.md` §2 |
| AT-SEC-2 **NC** | — | an implementation where `system:automation` bypasses any of RBAC, entitlement, domain validation, concurrency, or idempotency for any invoked command | fails — the task brief's "system:automation is not superuser" negative control | `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §2 |
| AT-SEC-3 **NC** | — | an implementation accepting a raw command name, table name, or SQL fragment in any B7 DTO field | fails | `B7_API_DTO_CONTRACTS.md` §3 |
| AT-SEC-4 **NC** | — | an implementation evaluating a condition via `eval()` or an embedded script engine | fails | `B7_CONDITION_ENGINE.md` §1 |
| AT-SEC-5 **NC** | a malformed event envelope arrives (missing required field) | admission | dropped without processing, other rules' admission for other events unaffected | `B7_TRIGGER_ADMISSION.md` §1, §3 |
| AT-SEC-6 **NC** | events delivered out of order, a condition uses `event.*` | evaluate | evaluates strictly against the delivered payload — the known, documented tradeoff, not a silent vulnerability | `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §3 |

## 37. Observability — AT-OBS

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OBS-1 | any run reaches a terminal state | inspect metrics | `executions_succeeded`/`executions_failed`/`executions_dead_lettered` incremented with `workspace_id`/`rule_id` dimensions only, no raw `RUN-*` label | `B7_OBSERVABILITY_AUDIT.md` §2 |
| AT-OBS-2 **NC** | — | an implementation logging a raw provider credential or message body from an action's payload | fails | `B7_OBSERVABILITY_AUDIT.md` §1 |

## 38. Retention — AT-RET

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RET-1 | rule archived | inspect its historical runs/revisions | fully retained, not deleted | `B7_RETENTION_DELETION.md` §1 |
| AT-RET-2 **NC** | automation run/action history purged under retention policy | inspect any Task/Deal/Message that action created | unaffected — B7's own history is never the system of record for another domain's truth | `B7_RETENTION_DELETION.md` §2 |

## 39. Counts

```
ACCEPTANCE_TEST_COUNT = 106
ACCEPTANCE_CATEGORY_COUNT = 38
DUPLICATE_ACCEPTANCE_TESTS = 0
NEGATIVE_CONTROL_COUNT = 53
```

Recomputed mechanically as the row count per `##` category section (excluding this "39. Counts" section itself) and the `**NC**` marker count within those rows — same discipline `B6_ACCEPTANCE_TESTS.md` §27 documents. Every one of the task brief §60's seventeen explicitly required negative controls is present above, each cross-referenced to its exact source requirement in this document's own text.
