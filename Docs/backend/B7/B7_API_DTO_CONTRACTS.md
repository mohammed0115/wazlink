# B7 — API and DTO Contracts

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Endpoints

| Method | Path | operationId | Permission | Notes |
|---|---|---|---|---|
| `GET` | `/api/v1/automation/rules` | `listAutomationRules` | `automation.rule.view` | cursor-paginated |
| `POST` | `/api/v1/automation/rules` | `createAutomationRule` | `automation.rule.manage` | `Idempotency-Key` required; always creates `status=draft` |
| `GET` | `/api/v1/automation/rules/{id}` | `getAutomationRule` | `automation.rule.view` | `404` cross-workspace-indistinguishable |
| `PATCH` | `/api/v1/automation/rules/{id}` | `updateAutomationRule` | `automation.rule.manage` | `If-Match` required; always creates a new revision |
| `POST` | `/api/v1/automation/rules/{id}/activate` | `activateAutomationRule` | `automation.rule.manage` | `If-Match`; full re-validation |
| `POST` | `/api/v1/automation/rules/{id}/disable` | `disableAutomationRule` | `automation.rule.manage` | `If-Match` |
| `POST` | `/api/v1/automation/rules/{id}/archive` | `archiveAutomationRule` | `automation.rule.manage` | `If-Match`; irreversible |
| `GET` | `/api/v1/automation/rules/{id}/revisions` | `listAutomationRuleRevisions` | `automation.rule.view` | cursor-paginated |
| `GET` | `/api/v1/automation/rules/{id}/revisions/{revisionNumber}` | `getAutomationRuleRevision` | `automation.rule.view` | immutable snapshot read |
| `POST` | `/api/v1/automation/rules/{id}/test` | `testAutomationRule` | `automation.rule.view` | dry-run; no mutation, no `Idempotency-Key` needed |
| `POST` | `/api/v1/automation/rules/{id}/run` | `runAutomationNow` | `automation.rule.manage` | `Idempotency-Key` required; only for manual-eligible rules |
| `GET` | `/api/v1/automation/runs` | `listAutomationRuns` | `automation.rule.view` | cursor-paginated, filterable by `rule_id`/`status` |
| `GET` | `/api/v1/automation/runs/{id}` | `getAutomationRun` | `automation.rule.view` | |
| `GET` | `/api/v1/automation/runs/{id}/actions` | `listAutomationRunActions` | `automation.rule.view` | ordered by `action_index` |
| `POST` | `/api/v1/automation/runs/{id}/approve` | `approveAutomationRun` | `automation.run.approve` | **frozen operation** — path, `operationId`, and request body `AutomationApprovalRequest {approved: boolean, version: integer}` (`additionalProperties: false`) are fixed by `BACKEND_OPENAPI_V1.yaml` and `BACKEND_API_CATALOG.md`. `approved:false` **is** the rejection path; no separate `/reject` operation exists (`B7_COMMAND_EVENT_CATALOG.md` §4). Run-granular: one decision covers every action of the run awaiting approval. |
| `POST` | `/api/v1/automation/runs/{id}/cancel` | `cancelAutomationExecution` | `automation.rule.manage` | non-terminal states only |
| `POST` | `/api/v1/automation/runs/{id}/replay` | `replayAutomationExecution` | `automation.rule.manage` | `Idempotency-Key` required; source must be `dead_lettered` |
| `GET` | `/api/v1/automation/triggers` | `listAutomationTriggerCatalog` | `automation.rule.view` | static closed catalog (`B7_TRIGGER_CATALOG.md` §2), for rule-authoring UI |
| `GET` | `/api/v1/automation/actions` | `listAutomationActionCatalog` | `automation.rule.view` | static closed catalog (`B7_ACTION_CATALOG.md` §2) |

`PUBLIC_API_OPERATION_COUNT = 19` — recomputed mechanically as the row count above: 11 `/automation/rules*` operations, 6 `/automation/runs*` operations, 2 catalog operations. Exactly **one** of the nineteen is frozen (`approveAutomationRun`); the other eighteen are additive. The same self-counting discipline `B6_API_DTO_CONTRACTS.md` §1 applies.

## 2. Request/response DTOs

| DTO | Fields |
|---|---|
| `AutomationRule` | `public_id, name, description, status, execution_policy, active_revision_number, version, created_by, created_at, updated_at, enabled_at, disabled_at, archived_at` |
| `AutomationRuleCreate` | `name (required), description, trigger (required, closed shape), conditions (array, closed shape), actions (required, non-empty ordered array, closed shape), execution_policy (required)` — explicit allow-list; `status`, `public_id`, `version`, every timestamp rejected if present (`400 VALIDATION_ERROR`, Doctrine R-4) |
| `AutomationRuleUpdate` | `name, description, trigger, conditions, actions, execution_policy` — same allow-list discipline; `status` **not** accepted here (use the lifecycle endpoints) |
| `AutomationRuleRevision` | `revision_number, name_snapshot, trigger, conditions, actions, created_at, created_by, superseded_at` |
| `AutomationRun` | `public_id, rule_ref (nullable), rule_revision_number (nullable), trigger_source, source_event_id (nullable), status, matched_conditions, skip_reason (nullable — non-null iff status='skipped'), created_at, evaluated_at (nullable), queued_at (nullable), started_at (nullable), completed_at (nullable), error_classification, correlation_id, replayed_from_run_id (nullable)` — internal `causation_id`/`root_run_id`/`depth` are **not** exposed on the public DTO (audit-internal, `B7_OBSERVABILITY_AUDIT.md`) |
| `AutomationRunStep` | `action_index, action_type, status, attempt, target_ref (nullable), error_code (nullable), started_at, completed_at` — internal `action_idempotency_key`/`expected_version` are **not** exposed |
| `AutomationTestRequest` | `fixture_context (closed shape matching the rule's trigger entity_type)` |
| `AutomationTestResult` | `matched, condition_detail, would_invoke_actions[]` — never a real `target_ref`, since nothing was invoked |
| `TriggerCatalogEntry` | `id, label, entity_type, event_fields[]` |
| `ActionCatalogEntry` | `id, label, target_domain, target_command, required_params[], safety_tier` |

## 3. Closed-catalog DTO enforcement (resolves task brief §43)

`trigger.type`, every `condition.field`/`condition.operator`, and every `action.type` are validated against the closed catalogs in `B7_TRIGGER_CATALOG.md`/`B7_CONDITION_ENGINE.md`/`B7_ACTION_CATALOG.md` at the DTO layer, before any domain logic runs. The DTO schema has no field capable of carrying a command name, table name, SQL fragment, URL, script body, or provider credential — `action.params` is itself a closed, per-`action.type` shape (`B7_ACTION_CATALOG.md` §2's "Required params" column), never a free-form object. No `workspace_id`, `system actor` label, `execution status`, `correlation_id`, or financial-authority field is ever client-writable on any Create/Update DTO (mass-assignment allow-listing, Doctrine R-4, identical discipline to every prior phase).

## 4. Pagination, filtering, sorting

`GET /automation/rules` and `GET /automation/runs` are cursor-paginated (`PageInfo`, frozen shape). `GET /automation/runs` additionally supports `filters: rule_id, status` and `sort: created_at_desc (default)` — sorting on `created_at` rather than the nullable `queued_at`, so a `skipped` or `awaiting_approval` run is never sorted last for want of a queue timestamp — mirroring `BACKEND_API_CATALOG.md`'s established pattern of naming exactly which `GET` endpoints support filter/sort rather than defaulting every list endpoint to it. `GET /automation/rules/{id}/revisions` and `GET /automation/runs/{id}/actions` are pagination-only, ordered `(revision_number ASC)`/`(action_index ASC)` respectively, no filter/sort.

## 5. Errors

Frozen error envelope unchanged (`BACKEND_ERROR_CATALOG.md`). New B7-specific codes are enumerated in `B7_FAILURE_CATALOG.md` — no new envelope shape, no new HTTP-status doctrine.
