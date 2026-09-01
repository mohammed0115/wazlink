# B7 — Failure Catalog

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

Stable IDs `B7-AF-001`…`B7-AF-034`, contiguous, no gaps, no duplicate semantics. All use the frozen error envelope (`BACKEND_ERROR_CATALOG.md`) — new `code` values only, no new envelope shape.

| ID | Scenario | HTTP | Code | Classification (`B7_FAILURE_RETRY_MODEL.md` §1) |
|---|---|---|---|---|
| `B7-AF-001` | missing/invalid session on any B7 endpoint | 401 | `UNAUTHENTICATED` | `AUTHORIZATION`, non-retryable |
| `B7-AF-002` | caller lacks `automation.rule.view`/`.manage`/`.run.approve` for the attempted operation | 403 | `PERMISSION_DENIED` | `AUTHORIZATION`, non-retryable |
| `B7-AF-003` | a referenced `AUTO-*`/`RUN-*`/`DEAL-*`/`LEAD-*` belongs to a different workspace | 404 | `ENTITY_NOT_FOUND` | `VALIDATION`, non-retryable (Doctrine R-1 non-disclosure shape) |
| `B7-AF-004` | workspace lacks the `automation.rules` capability | 403 | `ENTITLEMENT_LOCKED` \| `details.capability="automation.rules"`, `reason="capability_locked"` (frozen `BACKEND_ERROR_CATALOG.md`; shape per `B1_FAILURE_SCENARIOS.md` F15) | `ENTITLEMENT`, non-retryable |
| `B7-AF-005` | workspace's `automationRuns` usage is exhausted for the period when a run would be created | 403 | `QUOTA_EXHAUSTED` \| `details.metric="automationRuns"`, `reason="usage_exhausted"`, `period` (frozen `BACKEND_ERROR_CATALOG.md`; shape per `B1_FAILURE_SCENARIOS.md` F16) | `ENTITLEMENT`, non-retryable |
| `B7-AF-006` | `AUTO-*` does not resolve in this workspace | 404 | `ENTITY_NOT_FOUND` | `VALIDATION`, non-retryable |
| `B7-AF-007` | `If-Match` on `AutomationRule.version` is stale | 409 | `CONFLICT` | `CONCURRENCY`, retry-with-fresh-read only, never blind |
| `B7-AF-008` | an illegal lifecycle transition is requested (e.g. `archived→active`) | 409 | `INVALID_TRANSITION` | `VALIDATION`, non-retryable |
| `B7-AF-009` | `trigger.type` is outside the closed catalog | 422 | `VALIDATION_ERROR` \| `unsupported_trigger` | `VALIDATION`, non-retryable |
| `B7-AF-010` | a `condition.field`/`condition.operator` combination is outside the closed allow-list | 422 | `VALIDATION_ERROR` \| `unsupported_condition` | `VALIDATION`, non-retryable |
| `B7-AF-011` | `action.type` is outside the closed catalog | 422 | `VALIDATION_ERROR` \| `unsupported_action` | `VALIDATION`, non-retryable |
| `B7-AF-012` | a condition operand's type/allowed-value does not match its field's `data_type`/`allowedValues` | 422 | `VALIDATION_ERROR` \| `invalid_field_value` | `VALIDATION`, non-retryable |
| `B7-AF-013` | an action references a `PipelineStage`/template/target that does not resolve in-workspace at validation time | 422 | `VALIDATION_ERROR` \| `invalid_target_reference` | `VALIDATION`, non-retryable |
| `B7-AF-014` | an action's target aggregate no longer exists at invocation time (deleted/archived between admission and execution) | 404 | `ENTITY_NOT_FOUND` \| `target_disappeared` | `PERMANENT`, non-retryable |
| `B7-AF-015` | an action's target aggregate state is incompatible with the requested mutation at invocation time (e.g. Deal already `won`) | 409 | `CONFLICT` \| `target_state_changed` | `PERMANENT`, non-retryable |
| `B7-AF-016` | the target command returns `409 STALE_VERSION` | 409 | `STALE_VERSION` | `CONCURRENCY` — settles the action `failed`, never a blind retry (`B7_CONCURRENCY_MODEL.md` §5) |
| `B7-AF-017` | the target command returns `409 IDEMPOTENCY_CONFLICT` unexpectedly (same key, different payload) | 409 | `IDEMPOTENCY_CONFLICT` | `CONCURRENCY`, non-retryable, alerts (payload-derivation bug, `B7_IDEMPOTENCY_MODEL.md` §3) |
| `B7-AF-018` | a source domain event redelivers with an already-seen `event_id` | 200 (no-op ack) | n/a — not a client-facing failure | absorbed by dedup, `B7_EVENT_CONSUMPTION_MODEL.md` §3-4 |
| `B7-AF-019` | admission would exceed same-rule loop suppression | n/a (internal; run persisted `skipped`) | `error_classification=POLICY` \| `loop_blocked_same_rule` | `POLICY`, non-retryable |
| `B7-AF-020` | admission would exceed `MAX_AUTOMATION_DEPTH` | n/a (internal; run persisted `skipped`) | `POLICY` \| `depth_exceeded` | `POLICY`, non-retryable |
| `B7-AF-021` | admission would exceed the rolling execution budget for the lineage | n/a (internal; run persisted `skipped`) | `POLICY` \| `execution_budget_exceeded` | `POLICY`, non-retryable |
| `B7-AF-022` | at invocation time the bound revision's authority principal (`activated_by_membership_id`) is absent, removed, suspended, or no longer holds the target command's permission | n/a (internal; action `blocked`, run `failed`) | `AUTHORIZATION` \| `authority_principal_invalid` | `AUTHORIZATION`, non-retryable — no rule-lifecycle mutation (`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.3a) |
| `B7-AF-023` | a command targets a run already in a terminal state (`completed`/`failed`/`cancelled`/`skipped`/`dead_lettered`) with an operation only legal on a non-terminal run | 409 | `CONFLICT` \| `execution_already_terminal` | `VALIDATION`, non-retryable |
| `B7-AF-024` | `CancelAutomationExecution` targets an already-terminal run | 409 | `CONFLICT` \| `cancel_invalid` | `VALIDATION`, non-retryable |
| `B7-AF-025` | `ReplayAutomationExecution` targets a run whose status is not `dead_lettered` | 409 | `CONFLICT` \| `replay_invalid` | `VALIDATION`, non-retryable |
| `B7-AF-026` | the target domain's service is temporarily unavailable (timeout/5xx) | 503 | `DEPENDENCY_UNAVAILABLE` | `DEPENDENCY_UNAVAILABLE`, retryable per `BACKEND_RETRY_POLICY.md` |
| `B7-AF-027` | the target command permanently rejects on its own business validation (e.g. invalid phone at `SendMessage`) | 422 | `VALIDATION_ERROR` (target domain's own code, surfaced) | `PERMANENT`, non-retryable |
| `B7-AF-028` | an action's retry budget (5 attempts) is exhausted on a `TRANSIENT`/`DEPENDENCY_UNAVAILABLE` failure | n/a (internal transition) | `error_classification` unchanged, run → `dead_lettered` | terminal — `B7_FAILURE_RETRY_MODEL.md` §3 |
| `B7-AF-029` | a run reaches `dead_lettered` | n/a (terminal state) | — | `B7_DEAD_LETTER_REPLAY.md` §1 |
| `B7-AF-030` | the workspace is suspended (`B1_AUTHORIZATION_RBAC.md`-governed workspace state) | 403 | `WORKSPACE_SUSPENDED` | `ENTITLEMENT`, non-retryable — new admission blocked; in-flight runs finish per `B7_RULE_LIFECYCLE.md` §3 |
| `B7-AF-031` | `ApproveAutomationRun` attempted by the action's own rule author below manager rank | 403 | `PERMISSION_DENIED` \| `self_approval_forbidden` | `AUTHORIZATION`, non-retryable |
| `B7-AF-032` | a consumed event envelope is malformed (missing required field) | n/a (dropped, not retried) | logged, `envelope_invalid` | `VALIDATION`, non-retryable |
| `B7-AF-033` | a consumed event's `schema_version` is newer than B7's admission code understands | n/a (dropped, not retried) | logged, `schema_version_unknown` | `VALIDATION`, non-retryable |
| `B7-AF-034` | a Create/Update DTO attempts to set `workspace_id`/`version`/`status`/`created_by`/any system-actor or correlation field | 400 | `VALIDATION_ERROR` \| `additionalProperties` | `VALIDATION`, non-retryable (Doctrine R-4) |

## Mechanical verification

```
FAILURE_SCENARIO_COUNT = 34
FAILURE_SCENARIO_DUPLICATES = 0   (each ID names a distinct trigger condition; no two rows share both cause and code)
FAILURE_SCENARIO_GAPS = 0         (001-034 contiguous)
```
