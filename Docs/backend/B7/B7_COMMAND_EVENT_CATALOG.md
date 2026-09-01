# B7 — Command / Event Catalog

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Commands — resolved (Class A, `B7-D-A033`)

**Two of these commands are frozen, not new.** `BACKEND_COMMAND_EVENT_CATALOG.md` already names `CreateAutomationRule` and `ApproveAutomationRun` in its explicit command list, and `BACKEND_DOMAIN_OWNERSHIP.md`'s Automation row names the same two as "CreateRule, ApproveRun". B7 **reuses both names verbatim** and specifies them; it does not rename them, and it does not present them as B7 inventions. In particular the frozen approval command is `ApproveAutomationRun` — addressed at the **run**, not at an action — and B7 keeps that granularity because the frozen transport requires it (§4).

Every candidate from the task brief's §40 list was adjudicated; `CloneAutomationRule` is excluded (no clone/duplicate affordance anywhere in `Automation.tsx`; deferred Class B).

| Command | Aggregate | Actor | Permission | Preconditions | Version | Idempotency | Events | Origin |
|---|---|---|---|---|---|---|---|---|
| `CreateAutomationRule` | AutomationRule | member | `automation.rule.manage` | DTO validation (`B7_AUTOMATION_RULE_AGGREGATE.md` §4) | n/a (insert) | key required | `AutomationRuleCreated` | **FROZEN, specified** |
| `ApproveAutomationRun` | AutomationRun | member | `automation.run.approve` | run `status='awaiting_approval'`; not self-approval below manager rank (`B7_ACTION_AUTHORIZATION.md` §2) | `version` in body (frozen DTO) | natural — the run's own state transition is the guard | `AutomationRunApprovalDecided` | **FROZEN, specified** |
| `UpdateAutomationRule` | AutomationRule | member | `automation.rule.manage` | new definition validates | `If-Match` | key required | `AutomationRuleUpdated` | additive |
| `ActivateAutomationRule` | AutomationRule | member | `automation.rule.manage` | full validation re-run | `If-Match` | key optional | `AutomationRuleActivated` | additive |
| `DisableAutomationRule` | AutomationRule | member | `automation.rule.manage` | none | `If-Match` | key optional | `AutomationRuleDisabled` | additive |
| `ArchiveAutomationRule` | AutomationRule | member | `automation.rule.manage` | `status` ∈ {`draft`,`disabled`} | `If-Match` | key optional | `AutomationRuleArchived` | additive |
| `RunAutomationTest` | AutomationRule (read-only) | member | `automation.rule.view` | rule exists | n/a | none — pure read/compute, no mutation | none | additive |
| `RunAutomationNow` | AutomationRun | member | `automation.rule.manage` | `trigger.type ∈ {manual}` or the rule's own `execution_policy` permits | n/a | key required | `AutomationRunCreated` | additive |
| `CancelAutomationExecution` | AutomationRun | member (or the run's own `triggered_by`) | `automation.rule.manage` | `status` non-terminal | n/a | key optional | `AutomationRunCancelled` | additive |
| `ReplayAutomationExecution` | AutomationRun | member | `automation.rule.manage` | source run `status='dead_lettered'` | n/a | key required (governs replay-of-replay dedup) | `AutomationRunCreated` (new run) | additive |
| `AdmitAutomationTrigger` | AutomationRun | **system** (event consumer) | n/a — not an API surface | `B7_TRIGGER_ADMISSION.md` §2 sequence | n/a | `uq_automation_runs_event_rule` — `(workspace_id, rule_id, source_event_id)` partial-unique, **no revision component** (`B7_DATA_MODEL.md` §3, `B7_IDEMPOTENCY_MODEL.md` §1.1) | `AutomationRunCreated`, or `AutomationRunSkipped` when the run is admitted straight to `skipped` | additive, internal |
| `ExecuteAutomationRunStep` | AutomationRunStep | **system** (worker) | n/a — not an API surface | run `status='queued'`/`running`, claimed via lease | target aggregate's own `expected_version` | `(run_id, step_index)` + stable action key | none directly | additive, internal |

```
COMMAND_COUNT                 = 12
FROZEN_REUSED_COMMAND_COUNT   = 2    (CreateAutomationRule, ApproveAutomationRun)
ADDITIVE_COMMAND_COUNT        = 10
```

The two `system`-actor commands mirror B3's `ExecuteDiscoveryQuery`/`IngestProviderPage` and B4's `ExecuteIntelligenceRun` exactly: internal application commands with no API surface, listed here because they mutate B7 aggregates and therefore need a stated permission posture, idempotency identity, and precondition — not because they are callable.

## 2. Events — B7-produced

**Two of these events are frozen, not new.** `BACKEND_COMMAND_EVENT_CATALOG.md` already names `AutomationRunCreated` and `AutomationRunCompleted`. B7 reuses both verbatim. `BACKEND_DOMAIN_OWNERSHIP.md`'s Automation row abbreviates the latter as "AutomationCompleted"; the fully-qualified catalog name is authoritative and B7 uses it — recorded as a COMPATIBLE_CLARIFICATION in `B7_CONTROLLED_AMENDMENTS.md` (`B7-AM-004`) rather than treated as a second event.

| Event | Payload | Transport | Dedup | Origin |
|---|---|---|---|---|
| `AutomationRunCreated` | `run_ref, rule_ref (nullable), trigger_source, source_event_id (nullable), correlation_id, depth, created_at` | transactional outbox | `(run_ref)` unique | **FROZEN, specified** |
| `AutomationRunCompleted` | `run_ref, outcome (`actions_executed`), completed_at` | transactional outbox | `(run_ref,'completed')` unique | **FROZEN, specified** |
| `AutomationRunSkipped` | `run_ref, rule_ref (nullable), rule_revision_number (nullable), trigger_source, source_event_id (nullable), skip_reason (`conditions_not_matched`\|`quota_exhausted`\|`loop_prevention_blocked`), occurred_at` | transactional outbox | `(run_ref,'skipped')` unique | additive |
| `AutomationRuleCreated` | `rule_ref, name, trigger_type, execution_policy, created_at` | outbox | `(rule_ref)` unique | additive |
| `AutomationRuleActivated` | `rule_ref, revision_number, activated_at` | outbox | event-envelope `event_id` | additive |
| `AutomationRuleUpdated` | `rule_ref, revision_number, superseded_revision_number, updated_at` | outbox | event-envelope `event_id` | additive |
| `AutomationRuleDisabled` | `rule_ref, disabled_at` | outbox | event-envelope `event_id` | additive |
| `AutomationRuleArchived` | `rule_ref, archived_at` | outbox | event-envelope `event_id` | additive |
| `AutomationRunFailed` | `run_ref, error_classification, failed_at` | outbox | `(run_ref,'failed')` unique | additive |
| `AutomationRunDeadLettered` | `run_ref, error_classification, dead_lettered_at` | outbox | `(run_ref,'dead_lettered')` unique | additive |
| `AutomationRunCancelled` | `run_ref, cancelled_at, cancelled_by, reason (`user`\|`approval_rejected`\|`rule_disabled`)` | outbox | `(run_ref,'cancelled')` unique | additive |
| `AutomationRunAwaitingApproval` | `run_ref, rule_ref, requested_at` | outbox | `(run_ref,'awaiting_approval')` unique | additive |
| `AutomationRunApprovalDecided` | `run_ref, approved (boolean), decided_by, decided_at` | outbox | `(run_ref)` unique — one decision per run | additive |

```
PRODUCED_EVENT_COUNT        = 13
FROZEN_REUSED_EVENT_COUNT   = 2    (AutomationRunCreated, AutomationRunCompleted)
ADDITIVE_EVENT_COUNT        = 11
```

No name collides with any frozen catalog — checked against `BACKEND_COMMAND_EVENT_CATALOG.md` and every B1-B6 catalog's own event list; all produced event names are uniquely `AutomationRule*`/`AutomationRun*`-prefixed.

**A rejected run emits `AutomationRunApprovalDecided` and then `AutomationRunCancelled` with `reason='approval_rejected'`** — it does **not** emit `AutomationRunCompleted`. The mock's own status derivation labels an all-rejected run `executed` (FB-A29); B7 deliberately does not carry that forward, because "completed" must never describe a run in which a human declined and nothing happened.

**Every terminal run state has exactly one event that reports it** — `completed` → `AutomationRunCompleted`, `failed` → `AutomationRunFailed`, `cancelled` → `AutomationRunCancelled`, `dead_lettered` → `AutomationRunDeadLettered`, and `skipped` → `AutomationRunSkipped` (`B7-D-A041`). `AutomationRunSkipped` is added by `B7-FIX.2` because `skipped` previously had none: `AutomationRunCompleted` is dedup-keyed `(run_ref,'completed')` and cannot describe a run whose status is `skipped`, and it could not have covered the quota-exhausted or loop-blocked skips at all. Its `outcome` enum is correspondingly narrowed to the single value `actions_executed`; the former `conditions_not_matched` value moves to `AutomationRunSkipped.skip_reason`, where it sits beside the two skip reasons it never accounted for. **`completed` therefore never describes a run that did not act** — the same principle already applied to the rejected-run case above, now applied consistently.

`AutomationRunSkipped` is an audit/observability output of the Automation domain and nothing more. Its three `skip_reason` values are exactly the three admission paths that persist a `skipped` run (`B7_TRIGGER_ADMISSION.md` step 11, `B7_DATA_MODEL.md` §3's `skip_reason` column); no fourth reason exists or is invented. Like every other B7-produced event it creates no revenue truth, mutates no other domain, and is **not** a member of the closed Phase-1 trigger catalog, so it cannot re-enter B7 as a trigger (`B7_TRIGGER_CATALOG.md` §2). It requires no controlled amendment: it is a new B7-owned name in B7's own namespace and changes no frozen B0-B6 text (`B7_CONTROLLED_AMENDMENTS.md` §4).

**No B8/B9/B10/B12 consumer is declared for any of these events** — matching the posture every earlier domain had before its downstream phases existed (B2's `TaskCompleted` was produced before B7 existed to consume it). Future phases may register as consumers without amending this catalog.

## 3. Consumed events

`CONSUMED_EVENT_COUNT = 13` — the full list is `B7_TRIGGER_CATALOG.md` §2's thirteen event-backed trigger rows. Not repeated here to avoid two documents drifting out of sync; that document is the single source of truth for consumed-event identity.

## 4. Why approval is run-granular, not action-granular

Frozen `BACKEND_OPENAPI_V1.yaml` defines exactly one approval operation — `POST /automation/runs/{id}/approve`, `operationId: approveAutomationRun` — whose request body is `AutomationApprovalRequest { approved: boolean, version: integer }` with **`additionalProperties: false`**. That schema has no action selector and cannot carry one. Frozen `BACKEND_API_CATALOG.md` lists the same single row ("approve sensitive run"), and the frozen command is `ApproveAutomationRun`.

B7 therefore approves **the run**, and a single decision covers every action of that run awaiting it. `approved: false` is the rejection path — B7 declares **no separate `/reject` endpoint and no `RejectAutomationRun` command**, because the frozen boolean already expresses it.

The frozen frontend's approval queue is per-action (FB-A30/FB-A31). Phase-1 rules created through the live React surface carry exactly one action (FB-A54), so the two granularities coincide in practice; where a multi-action rule has several sensitive actions, one decision governs all of them. Per-action approval is deferred (Class C, `B7-D-C004`) and would require amending the frozen OpenAPI schema — which B7 declines to do on no evidence.
