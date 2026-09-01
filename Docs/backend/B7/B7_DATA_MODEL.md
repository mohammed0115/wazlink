# B7 — Data Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

Elaborates frozen `BACKEND_DATA_MODEL.md` row 21 (`automation_rules, triggers, conditions, actions, runs, step_runs, approvals`) into a complete Phase-1 schema sketch. Column-level, not a migration.

## 1. `automation_rules`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal identity |
| `public_id` | `ARULE-*` | opaque, immutable (§`B7_DOMAIN_OWNERSHIP.md` §5) |
| `workspace_id` | FK → workspaces | not null |
| `name` | text | required |
| `description` | text | optional |
| `status` | enum(`draft`,`active`,`disabled`,`archived`) | `B7_RULE_LIFECYCLE.md` |
| `execution_policy` | enum(`auto_safe`,`approval_required`,`manual_only`) | reused verbatim from frozen frontend `automationApprovalPolicies` (FB-D07); per-rule, applies to every action in the rule unless an individual action's own catalog-declared safety tier is stricter (§`B7_ACTION_CATALOG.md` §3) |
| `active_revision_id` | FK → `automation_rule_revisions`, nullable | null while `status=draft` |
| `version` | integer | optimistic concurrency, frozen pattern (`BACKEND_ARCHITECTURE_DECISIONS.md`) |
| `created_by` | FK → memberships | |
| `created_at` / `updated_at` | timestamptz | |
| `enabled_at` / `disabled_at` / `archived_at` | timestamptz, nullable | set by the corresponding lifecycle command only |

Unique: `(workspace_id, public_id)`. Index: `(workspace_id, status)`.

## 2. `automation_rule_revisions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal identity, referenced by `AutomationRun.rule_revision_id` — never a public ID |
| `rule_id` | FK → `automation_rules` | |
| `revision_number` | integer | monotonic per `rule_id`, starts at 1 |
| `name_snapshot` | text | rule name at revision-creation time (mirrors evidenced `ruleNameSnapshot`, FB-D16) |
| `trigger_definition` | jsonb | closed shape, `B7_TRIGGER_CATALOG.md` §3 |
| `condition_definition` | jsonb | closed shape, `B7_CONDITION_ENGINE.md` §2 |
| `action_definitions` | jsonb (ordered array) | closed shape, `B7_ACTION_CATALOG.md` §4 |
| `superseded_at` | timestamptz, nullable | set when a later revision becomes active |
| `created_at` | timestamptz | |
| `created_by` | FK → memberships | |

Unique: `(rule_id, revision_number)`. Immutable after insert — no `UPDATE` path exists in Phase 1 (enforced structurally: the application service has no revision-update method, mirroring `B6_DEAL_STATE_MACHINE.md`'s "no code path" pattern for its own immutability guarantees).

## 3. `automation_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | |
| `public_id` | `RUN-*` | frozen prefix |
| `workspace_id` | FK → workspaces | |
| `rule_id` | FK → `automation_rules`, **nullable** | null for a rule-less run (FB-D24: an approved AI/Copilot-recommended action) |
| `rule_revision_id` | FK → `automation_rule_revisions`, nullable | null iff `rule_id` is null; otherwise always set — the immutable snapshot this run executed against |
| `trigger_source` | enum(`event`,`manual`,`scheduled`,`recommendation`) | |
| `source_event_id` | text, nullable | the originating domain event's envelope `event_id`; null for `manual`/`recommendation` |
| `trigger_entity_type` / `trigger_entity_ref` | text / text, nullable | opaque reference to the triggering aggregate (e.g. `LEAD-*`, `DEAL-*`) |
| `correlation_id` | UUIDv7 | shared across every run/action caused by one root cause — `B7_LOOP_PREVENTION.md` |
| `causation_id` | UUIDv7, nullable | the specific upstream action-execution id that caused this run, if any |
| `root_run_id` | FK → `automation_runs`, nullable (self) | null on a root run; otherwise the first run in the lineage |
| `depth` | integer | 0 for a root run; `parent.depth + 1` otherwise — `B7_LOOP_PREVENTION.md` |
| `idempotency_key` | text | derivation in `B7_IDEMPOTENCY_MODEL.md` §1 |
| `status` | enum(`queued`,`evaluating`,`skipped`,`awaiting_approval`,`running`,`waiting`,`succeeded`,`failed`,`cancelled`,`dead_lettered`) | `B7_EXECUTION_MODEL.md` |
| `matched_conditions` | boolean, nullable | null until evaluated |
| `condition_snapshot` | jsonb, nullable | the evaluated field values, for audit replay |
| `triggered_by` | FK → memberships, nullable | set only for `trigger_source='manual'` |
| `queued_at` / `evaluated_at` / `started_at` / `completed_at` | timestamptz, nullable | |
| `error_classification` | enum, nullable | `B7_FAILURE_RETRY_MODEL.md` §1 |
| `failure_reason` | text, nullable | |

Unique: `(workspace_id, idempotency_key)`. Index: `(workspace_id, rule_id, queued_at)`, `(workspace_id, status)`.

## 4. `automation_action_executions` (`step_runs`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `run_id` | FK → `automation_runs` | |
| `action_index` | integer | ordinal position within the revision's `action_definitions` |
| `action_type` | text | closed catalog value, `B7_ACTION_CATALOG.md` |
| `target_domain` | text | `B2`\|`B5`\|`B6`\|`B7` (internal control actions) |
| `target_command` | text | e.g. `MoveDealStage` |
| `action_idempotency_key` | text | derivation in `B7_IDEMPOTENCY_MODEL.md` §2 |
| `status` | enum(`proposed`,`awaiting_approval`,`approved`,`rejected`,`running`,`succeeded`,`failed`,`blocked`,`skipped`,`cancelled`) | `B7_ACTION_EXECUTION_MODEL.md` |
| `attempt` | integer | current attempt count, `B7_FAILURE_RETRY_MODEL.md` |
| `expected_version` | text, nullable | captured target-aggregate version, `B7_CONCURRENCY_MODEL.md` |
| `target_ref` | text, nullable | the invoked command's resulting public ID (e.g. `TSK-*`) |
| `error_classification` / `error_code` | enum / text, nullable | |
| `started_at` / `completed_at` | timestamptz, nullable | |

Unique: `(run_id, action_index)`, `(workspace_id, action_idempotency_key)` (workspace_id denormalized from `run_id` for the unique index).

## 5. `automation_approvals`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `action_execution_id` | FK → `automation_action_executions`, unique | one approval row per action execution requiring one |
| `requested_at` | timestamptz | |
| `requested_reason` | text | mirrors evidenced `requestReason` (FB-D15) |
| `decided_by` | FK → memberships, nullable | null until decided |
| `decision` | enum(`approved`,`rejected`), nullable | |
| `decided_at` | timestamptz, nullable | |

Unique: `(action_execution_id)`.

## 6. `automation_inbox_records`

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | FK → workspaces | |
| `source_event_id` | text | the consumed domain event's envelope `event_id` |
| `received_at` | timestamptz | |
| `admitted_run_ids` | uuid[] | zero or more runs this event admitted (zero if no rule matched) |

Unique: `(workspace_id, source_event_id)`. This is B7's own inbox-side dedup boundary, distinct from `BACKEND_PUBLIC_ID_REGISTRY.md`'s `WHR-*` `WebhookReceipt` (that table dedups *external provider* callbacks; this one dedups *internal cross-domain* events per frozen ADR-005's outbox/dispatcher split).

## 7. `automation_wakeups`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `run_id` | FK → `automation_runs` | |
| `action_index` | integer, nullable | set for an in-flight Wait action; null for a scheduled-trigger wakeup |
| `resume_at` | timestamptz (UTC) | `B7_SCHEDULE_DELAY_MODEL.md` |
| `status` | enum(`pending`,`fired`,`cancelled`) | |
| `dedup_key` | text | `(run_id, action_index)` composite, unique |

Unique: `(run_id, action_index)`.

## 8. Cross-references

`DATA_MODEL_ENTITY_COUNT = 7`, matching `OWNED_ENTITY_COUNT` in `B7_DOMAIN_OWNERSHIP.md` §2 exactly. No table in this document writes a column owned by another domain's table (B2/B5/B6's own `created_by_automation_run_id`-shaped backreference columns, evidenced at FB-D21, are declared and migrated by those domains, not by B7 — B7 only ever supplies the `RUN-*` value they store).
