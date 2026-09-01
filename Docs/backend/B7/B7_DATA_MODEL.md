# B7 — Data Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

Elaborates frozen `BACKEND_DATA_MODEL.md` row 21 (`automation_rules, triggers, conditions, actions, runs, step_runs, approvals`) into a complete Phase-1 schema sketch. Column-level, not a migration.

## 1. `automation_rules`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal identity |
| `public_id` | `AUTO-*` | opaque, immutable (§`B7_DOMAIN_OWNERSHIP.md` §5) |
| `workspace_id` | FK → workspaces | not null |
| `name` | text | required |
| `description` | text | optional |
| `status` | enum(`draft`,`active`,`disabled`,`archived`) | `B7_RULE_LIFECYCLE.md` |
| `execution_policy` | enum(`auto_safe`,`approval_required`,`manual_only`) | reused verbatim from frozen frontend `automationApprovalPolicies` (FB-A14); per-rule, applies to every action in the rule unless an individual action's own catalog-declared safety tier is stricter (§`B7_ACTION_CATALOG.md` §3) |
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
| `name_snapshot` | text | rule name at revision-creation time (mirrors evidenced `ruleNameSnapshot`, FB-A19) |
| `condition_logic` | enum(`AND`,`OR`), nullable | null when the revision has zero conditions (= "no condition", matches unconditionally, FB-A07) |
| `superseded_at` | timestamptz, nullable | set when a later revision becomes active |
| `created_at` | timestamptz | |
| `created_by` | FK → memberships | who authored this revision |
| `activated_by_membership_id` | FK → memberships, nullable | **the revision's authority principal** — the membership that executed `ActivateAutomationRule`; every action this revision's runs invoke is authorized against *this* membership's current role (`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.1). Null while the revision has never been activated. |
| `status` | enum(`draft`,`active`,`superseded`) | at most one `active` revision per rule |

Unique: `(rule_id, revision_number)`. Partial unique: `(rule_id) WHERE status='active'` — at most one active revision per rule. Immutable after insert — no `UPDATE` path exists in Phase 1 (enforced structurally: the application service has no revision-update method, mirroring `B6_DEAL_STATE_MACHINE.md`'s "no code path" pattern for its own immutability guarantees).

**Definition storage — resolved (Class A, `B7-D-A036`): child tables, not JSON.** Frozen `BACKEND_DATA_MODEL.md` row 21 names `triggers`, `conditions`, and `actions` as tables in the Automation group, and B7 keeps them as tables rather than collapsing them into `jsonb` columns. Three reasons decide it: the frozen row names them; a closed catalog with per-type required parameters is checkable by database constraint only when the discriminator is a column; and rule-authoring UIs need to query "which rules reference stage `STG-*`" without scanning JSON. The three tables hang off the **revision**, not the rule — which is what makes a revision immutable in the strong sense (`B7_RULE_REVISION_MODEL.md` §2): there is no mutable child a later edit could rewrite underneath a historical run.

Only the per-action `params` payload is `jsonb`, and it is validated against the action type's closed required-parameter shape at the DTO layer before persistence (`B7_API_DTO_CONTRACTS.md` §3) — it is never a free-form object.

## 2a. `automation_rule_triggers`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `revision_id` | FK → `automation_rule_revisions` | **exactly one row per revision** |
| `trigger_type` | text | closed catalog value, `B7_TRIGGER_CATALOG.md` §2 |
| `params` | jsonb, nullable | reserved; every Phase-1 trigger is parameterless |

Unique: `(revision_id)`. Check: `trigger_type` ∈ the closed Phase-1 catalog.

## 2b. `automation_rule_conditions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `revision_id` | FK → `automation_rule_revisions` | zero or more rows per revision |
| `position` | integer | ordinal, from 0 |
| `field` | text | closed catalog value, `B7_CONDITION_ENGINE.md` §2 |
| `operator` | text | closed catalog value, must be permitted for `field` |
| `value` | text, nullable | null iff `operator` ∈ {`is_known`,`is_unknown`} |

Unique: `(revision_id, position)`. Check: `(field, operator)` is a permitted pair; `value` conforms to the field's declared `data_type`.

## 2c. `automation_rule_actions`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `revision_id` | FK → `automation_rule_revisions` | **one or more** rows per revision |
| `position` | integer | ordinal, from 0 — the sequential execution order (`B7_ACTION_EXECUTION_MODEL.md` §4) |
| `action_type` | text | closed catalog value, `B7_ACTION_CATALOG.md` §2 |
| `params` | jsonb | validated against the action type's closed required-parameter shape |

Unique: `(revision_id, position)`. Check: `action_type` ∈ the closed Phase-1 catalog; `action_type` ∉ the forbidden list (FB-A13).

## 3. `automation_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | |
| `public_id` | `RUN-*` | frozen prefix |
| `workspace_id` | FK → workspaces | |
| `rule_id` | FK → `automation_rules`, **nullable** | null for a rule-less run (FB-A60: an approved AI/Copilot-recommended action) |
| `rule_revision_id` | FK → `automation_rule_revisions`, nullable | null iff `rule_id` is null; otherwise always set — the immutable snapshot this run executed against |
| `trigger_source` | enum(`event`,`manual`,`recommendation`) | closed Phase-1 set — `scheduled` is **not** a member, because no Phase-1 trigger can produce it (`B7_TRIGGER_CATALOG.md` §2, `B7_EXECUTION_MODEL.md` §7). A later phase adding a scheduled trigger adds the enum value with it |
| `source_event_id` | text, nullable | the originating domain event's envelope `event_id`; null for `manual`/`recommendation` |
| `trigger_entity_type` / `trigger_entity_ref` | text / text, nullable | opaque reference to the triggering aggregate (e.g. `LEAD-*`, `DEAL-*`) |
| `correlation_id` | UUIDv7 | shared across every run/action caused by one root cause — `B7_LOOP_PREVENTION.md` |
| `causation_id` | UUIDv7, nullable | the specific upstream action-execution id that caused this run, if any |
| `root_run_id` | FK → `automation_runs`, nullable (self) | null on a root run; otherwise the first run in the lineage |
| `depth` | integer | 0 for a root run; `parent.depth + 1` otherwise — `B7_LOOP_PREVENTION.md` |
| `idempotency_key` | text | derivation in `B7_IDEMPOTENCY_MODEL.md` §1 |
| `status` | enum(`created`,`evaluating`,`skipped`,`awaiting_approval`,`queued`,`running`,`completed`,`failed`,`cancelled`,`dead_lettered`) — frozen seven + three declared additive (`B7-AM-003`); `waiting` is Phase-2 only (`B7_EXECUTION_MODEL.md` §7) | `B7_EXECUTION_MODEL.md` |
| `matched_conditions` | boolean, nullable | null until evaluated |
| `condition_snapshot` | jsonb, nullable | the evaluated field values, for audit replay |
| `triggered_by` | FK → memberships, nullable | set only for `trigger_source='manual'` |
| `created_at` | timestamptz, **not null** | the run row's insert time, at `status='created'` — the run's creation timestamp. It is **not** `queued_at`: a run that never reaches `queued` (`skipped`, or cancelled while `created`/`evaluating`) still has a `created_at` |
| `evaluated_at` | timestamptz, nullable | when condition evaluation completed and the run left `evaluating` |
| `queued_at` | timestamptz, nullable | when the run entered `queued`. Null for a run that never queued — a `skipped` run, or one still `awaiting_approval`. An approval-requiring run's `queued_at` is set at the approval decision, not at admission |
| `started_at` | timestamptz, nullable | when a worker claimed the run and it entered `running` |
| `completed_at` | timestamptz, nullable | terminal timestamp, whichever terminal state was reached (`B7_EXECUTION_MODEL.md` §1) |
| `replayed_from_run_id` | FK → `automation_runs`, nullable (self) | set only on a run created by `ReplayAutomationExecution` (`B7_DEAD_LETTER_REPLAY.md` §2); null on every ordinary run |
| `skip_reason` | enum(`conditions_not_matched`,`quota_exhausted`,`loop_prevention_blocked`), nullable | non-null **iff** `status='skipped'`; the closed Phase-1 set, matching the three admission paths that persist a `skipped` run (`B7_TRIGGER_ADMISSION.md` step 11) |
| `error_classification` | enum, nullable | `B7_FAILURE_RETRY_MODEL.md` §1 |
| `failure_reason` | text, nullable | |

**Constraints.**

| Name | Definition | Purpose |
|---|---|---|
| `uq_automation_runs_idempotency` | UNIQUE `(workspace_id, idempotency_key)` | general replay guard across all three `trigger_source` paths; derivations in `B7_IDEMPOTENCY_MODEL.md` §1.2 |
| `uq_automation_runs_event_rule` | UNIQUE `(workspace_id, rule_id, source_event_id)` **WHERE** `trigger_source = 'event'` **AND** `rule_id IS NOT NULL` **AND** `source_event_id IS NOT NULL` **AND** `replayed_from_run_id IS NULL` | **the event/rule identity invariant** — one source event executes one rule at most once per workspace (`B7_IDEMPOTENCY_MODEL.md` §1.1, `B7-D-A040`). This is the constraint frozen `BACKEND_DATA_MODEL.md` row 21's *"event/rule/action idempotency unique"* names on the event/rule half |
| `ck_automation_runs_skip_reason` | CHECK `(status = 'skipped') = (skip_reason IS NOT NULL)` | a `skipped` run always names why, and no other status carries a skip reason |

The partial predicate is load-bearing in three directions, and each exclusion is deliberate rather than incidental:

- **`trigger_source = 'event'`** — a `manual` run carries `source_event_id IS NULL` and therefore could not collide anyway, but the predicate states the scope explicitly so no implementation widens the constraint to a path it was never meant to govern. Manual and recommendation runs are deduplicated by their own `idempotency_key` derivations (`B7_IDEMPOTENCY_MODEL.md` §1.2), which are already defined and are not re-invented here.
- **`replayed_from_run_id IS NULL`** — a replay is a deliberate operator re-execution of a dead-lettered run, not a second admission of the source event, and must not be blocked by the source run's own row (`B7_IDEMPOTENCY_MODEL.md` §4).
- **`rule_id IS NOT NULL`** — a recommendation-sourced rule-less run has no rule to key on (`B7_EXECUTION_MODEL.md` §4).

**`rule_revision_id` is deliberately absent from this constraint.** It is immutable execution provenance — which definition this run ran against — never part of event/run identity. Including it would let a revision activated between two deliveries of the same event admit a second run for the same rule, which is exactly the duplicate the constraint exists to prevent (`B7_IDEMPOTENCY_MODEL.md` §1.1, `AT-IDEM-4` **NC**).

Index: `(workspace_id, rule_id, created_at)`, `(workspace_id, status)`.

## 4. `automation_run_steps` (`step_runs`)

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `run_id` | FK → `automation_runs` | |
| `action_index` | integer | equals the `automation_rule_actions.position` (§2c) of the action this step executes, within the run's bound revision |
| `action_type` | text | closed catalog value, `B7_ACTION_CATALOG.md` |
| `target_domain` | text | `B2`\|`B5`\|`B6`\|`B7` (internal control actions) |
| `target_command` | text | e.g. `MoveDealStage` |
| `action_idempotency_key` | text | derivation in `B7_IDEMPOTENCY_MODEL.md` §2 |
| `status` | enum(`proposed`,`awaiting_approval`,`approved`,`rejected`,`running`,`completed`,`failed`,`blocked`,`skipped`,`cancelled`) | `B7_ACTION_EXECUTION_MODEL.md` |
| `attempt` | integer | current attempt count, `B7_FAILURE_RETRY_MODEL.md` |
| `expected_version` | text, nullable | captured target-aggregate version, `B7_CONCURRENCY_MODEL.md` |
| `target_ref` | text, nullable | the invoked command's resulting public ID (e.g. `TSK-*`) |
| `error_classification` / `error_code` | enum / text, nullable | |
| `started_at` / `completed_at` | timestamptz, nullable | |

Unique: `(run_id, action_index)`, `(workspace_id, action_idempotency_key)` (workspace_id denormalized from `run_id` for the unique index).

## 5. `automation_run_approvals`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only |
| `run_id` | FK → `automation_runs`, unique | **run-granular** — at most one approval decision per run, matching the frozen `ApproveAutomationRun` command and the frozen `POST /automation/runs/{id}/approve` body, which carries no action selector (`B7_COMMAND_EVENT_CATALOG.md` §4) |
| `requested_at` | timestamptz | |
| `requested_reason` | text | mirrors evidenced `requestReason` (FB-A42) |
| `decided_by` | FK → memberships, nullable | null until decided |
| `decision` | enum(`approved`,`rejected`), nullable | set from the frozen request body's `approved` boolean |
| `decided_at` | timestamptz, nullable | |

Unique: `(run_id)`. A second decision against an already-decided run is rejected `409` (`B7-AF-023`); the row is immutable once `decided_at` is set.

## 6. `automation_inbox_records`

| Column | Type | Notes |
|---|---|---|
| `workspace_id` | FK → workspaces | |
| `source_event_id` | text | the consumed domain event's envelope `event_id` |
| `received_at` | timestamptz | |
| `admitted_run_ids` | uuid[] | zero or more runs this event admitted (zero if no rule matched) |

Unique: `(workspace_id, source_event_id)`. This is B7's own inbox-side dedup boundary, distinct from `BACKEND_PUBLIC_ID_REGISTRY.md`'s `WHR-*` `WebhookReceipt` (that table dedups *external provider* callbacks; this one dedups *internal cross-domain* events per frozen ADR-005's outbox/dispatcher split).

## 7. No Phase-1 wakeup/timer table

Phase 1 defines **no** `automation_wakeups` table, no `waiting` run state, and no wakeup sweep. No Phase-1 trigger is time-based and no Phase-1 action delays (`B7_TRIGGER_CATALOG.md` §2, `B7_ACTION_CATALOG.md` §2, FB-A57), so nothing could write such a table. `B7_SCHEDULE_DELAY_MODEL.md` holds the forward design for a later phase, including the table it would need; an implementation agent must not create it from this pack (`B7-D-A035`, `AT-SCHED-3` **NC**).

## 8. Cross-references and count

```
DATA_MODEL_ENTITY_COUNT = 9   (Phase-1 owned tables)
```

matching `OWNED_ENTITY_COUNT` in `B7_DOMAIN_OWNERSHIP.md` §2 exactly:
`automation_rules`, `automation_rule_revisions`, `automation_rule_triggers`, `automation_rule_conditions`, `automation_rule_actions`, `automation_runs`, `automation_run_steps`, `automation_run_approvals`, `automation_inbox_records`.

No other table is owned by B7 in Phase 1. In particular `automation_wakeups` is **not** a Phase-1 table at all (§7) — it is not merely excluded from the count, it is not defined here.

**Mapping onto frozen `BACKEND_DATA_MODEL.md` row 21** (`automation_rules, triggers, conditions, actions, runs, step_runs, approvals` — seven named groups):

| Frozen name | B7 table | Relationship |
|---|---|---|
| `automation_rules` | `automation_rules` | same |
| `triggers` | `automation_rule_triggers` | same, scoped to a revision |
| `conditions` | `automation_rule_conditions` | same, scoped to a revision |
| `actions` | `automation_rule_actions` | same, scoped to a revision |
| `runs` | `automation_runs` | same |
| `step_runs` | `automation_run_steps` | same |
| `approvals` | `automation_run_approvals` | same |
| — | `automation_rule_revisions` | **added** (`B7-AM-005`, ADDITIVE) — the table that makes the four definition tables immutable |
| — | `automation_inbox_records` | **added** (`B7-AM-005`, ADDITIVE) — consumer-side event dedup, materialising frozen B2 doctrine "consumption is idempotent by `event_id`" |

The frozen row's own uniqueness requirement — *"event/rule/action idempotency unique"* — is satisfied by two constraints **declared in this document**, not merely cited: `uq_automation_runs_event_rule` on `automation_runs` (§3 — the *event/rule* half, `(workspace_id, rule_id, source_event_id)` partial-unique) and `(workspace_id, action_idempotency_key)` on `automation_run_steps` (§4 — the *action* half). Their semantics are elaborated in `B7_IDEMPOTENCY_MODEL.md` §1.3 and §2 respectively.

No table in this document writes a column owned by another domain. The `created_by_automation_run_id`-shaped backreference on B2's Task/Appointment rows (FB-A34) is declared and migrated by **B2**, not by B7 — B7 only ever supplies the `RUN-*` value that column stores.
