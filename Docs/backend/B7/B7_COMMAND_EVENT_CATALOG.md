# B7 — Command / Event Catalog

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Commands — resolved (Class A, `B7-D-A033`)

Every candidate from the task brief's §40 list adjudicated; `CloneAutomationRule` excluded (no frontend/architecture evidence, deferred Class B — no clone/duplicate affordance anywhere in `Automation.tsx`).

| Command | Aggregate | Actor | Permission | Preconditions | Version | Idempotency | Events |
|---|---|---|---|---|---|---|---|
| `CreateAutomationRule` | AutomationRule | member | `automation.rule.manage` | DTO validation (`B7_AUTOMATION_RULE_AGGREGATE.md` §4) | n/a (insert) | key required | `AutomationRuleCreated` |
| `UpdateAutomationRule` | AutomationRule | member | `automation.rule.manage` | new definition validates | `If-Match` | key required | `AutomationRuleUpdated` |
| `ActivateAutomationRule` | AutomationRule | member | `automation.rule.manage` | full validation re-run | `If-Match` | key optional | `AutomationRuleActivated` |
| `DisableAutomationRule` | AutomationRule | member | `automation.rule.manage` | none | `If-Match` | key optional | `AutomationRuleDisabled` |
| `ArchiveAutomationRule` | AutomationRule | member | `automation.rule.manage` | `status` ∈ {`draft`,`disabled`} | `If-Match` | key optional | `AutomationRuleArchived` |
| `RunAutomationTest` | AutomationRule (read-only) | member | `automation.rule.view` | rule exists | n/a | none — pure read/compute, no mutation | none |
| `RunAutomationNow` | AutomationRun | member | `automation.rule.manage` | `trigger.type∈{manual}` or rule's own `execution_policy` permits (`B7_AUTOMATION_RULE_AGGREGATE.md`) | n/a | key required | `AutomationRunAdmitted` |
| `ApproveAutomationAction` | AutomationActionExecution | member | `automation.run.approve` | action `status='awaiting_approval'`; not self-approval below manager rank (`B7_ACTION_AUTHORIZATION.md` §2) | n/a (idempotent by action id) | key optional (natural idempotency via action state) | `AutomationActionApproved` |
| `RejectAutomationAction` | AutomationActionExecution | member | `automation.run.approve` | action `status='awaiting_approval'` | n/a | key optional | `AutomationActionRejected` |
| `CancelAutomationExecution` | AutomationRun | member (or the run's own `triggered_by`) | `automation.rule.manage` | `status` non-terminal | n/a | key optional | `AutomationExecutionCancelled` |
| `ReplayAutomationExecution` | AutomationRun | member | `automation.rule.manage` | source run `status='dead_lettered'` | n/a | key required (governs replay-of-replay dedup) | `AutomationRunAdmitted` (new run) |

`COMMAND_COUNT = 11`. `FROZEN_REUSED_COMMAND_COUNT = 0` — B7 is a new domain; `BACKEND_DATA_MODEL.md` row 21 froze a table-group sketch, not any command signature. `ADDITIVE_COMMAND_COUNT = 11`.

## 2. Events — B7-produced

| Event | Payload | Transport | Dedup |
|---|---|---|---|
| `AutomationRuleCreated` | `rule_ref, name, trigger_type, execution_policy, created_at` | transactional outbox | `(rule_ref)` unique |
| `AutomationRuleActivated` | `rule_ref, revision_number, activated_at` | outbox | event-envelope `event_id` |
| `AutomationRuleUpdated` | `rule_ref, revision_number, superseded_revision_number, updated_at` | outbox | event-envelope `event_id` |
| `AutomationRuleDisabled` | `rule_ref, disabled_at` | outbox | event-envelope `event_id` |
| `AutomationRuleArchived` | `rule_ref, archived_at` | outbox | event-envelope `event_id` |
| `AutomationRunAdmitted` | `run_ref, rule_ref (nullable), trigger_source, source_event_id (nullable), correlation_id, depth, admitted_at` | outbox | `(run_ref)` unique |
| `AutomationRunSucceeded` | `run_ref, completed_at` | outbox | `(run_ref,'succeeded')` unique |
| `AutomationRunFailed` | `run_ref, error_classification, failed_at` | outbox | `(run_ref,'failed')` unique |
| `AutomationRunDeadLettered` | `run_ref, error_classification, dead_lettered_at` | outbox | `(run_ref,'dead_lettered')` unique |
| `AutomationRunCancelled` | `run_ref, cancelled_at, cancelled_by` | outbox | `(run_ref,'cancelled')` unique |
| `AutomationActionApproved` | `run_ref, action_index, approved_by, approved_at` | outbox | event-envelope `event_id` |
| `AutomationActionRejected` | `run_ref, action_index, rejected_by, rejected_at` | outbox | event-envelope `event_id` |

`PRODUCED_EVENT_COUNT = 12`. `FROZEN_REUSED_EVENT_COUNT = 0`, `ADDITIVE_EVENT_COUNT = 12`. No name collides with any frozen catalog — checked against `BACKEND_COMMAND_EVENT_CATALOG.md` and every B1-B6 catalog's own event lists; all twelve are uniquely `Automation*`/`AutomationRule*`/`AutomationRun*`/`AutomationAction*`-prefixed.

**No B8/B9/B10/B12 consumer is declared for any of these events** — matching the posture every earlier domain had *before* its downstream phases existed (B2's `TaskCompleted` was produced before B7 existed to consume it). Future B8/B9/B12 phases may register as consumers without amending this catalog.

## 3. Consumed events

`CONSUMED_EVENT_COUNT = 13` — the full list is `B7_TRIGGER_CATALOG.md` §2's thirteen event-backed trigger rows. Not repeated here to avoid two documents drifting out of sync; that document is the single source of truth for consumed-event identity.
