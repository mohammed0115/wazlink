# B7 — Domain Ownership

> **B7 status:** Target design only. B7 is an **orchestration** domain. It owns the rules that decide *when* to act and the durable record of *what it attempted*. It owns no business truth that any other domain owns.

## 1. The one-sentence boundary

**Automation observes events, evaluates rules it owns, and asks other domains to act through their own governed commands. It never writes another domain's tables, and it never becomes a second authority for anything.**

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` already fixes B7's row before B7 existed:

| Domain | Module | Aggregate root | Authoritative tables | Allowed writers | Commands | Events | Forbidden coupling |
|---|---|---|---|---|---|---|---|
| Automation | `automation` | **AutomationRun** | rules, runs, approvals, step runs | automation service/worker | CreateRule, ApproveRun | AutomationCompleted | **no unapproved sensitive action** |

Three things in that frozen row are load-bearing and B7 changes none of them:

1. **The aggregate root is `AutomationRun`, not `AutomationRule`.** Frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §A independently confirms it: `RUN-` is a Section-A canonical prefix meaning AutomationRun, workspace-scoped, while `AUTO-` sits in Section B, explicitly *not* promoted, with the recorded reason *"Rule CRUD is future/non-Core; canonical persisted execution identity is `RUN-*`"*. B7 is that future, and `B7_CONTROLLED_AMENDMENTS.md` `B7-AM-001` promotes `AUTO-` on exactly the condition the registry itself names.
2. **The forbidden coupling is "no unapproved sensitive action"** — approval is not a feature B7 invents, it is the frozen constraint B7 must satisfy. See `B7_ACTION_AUTHORIZATION.md` §4.
3. **The allowed writers are the automation service and its worker** — nothing else writes B7 tables, and B7 writes nothing else.

## 2. Entities B7 owns

Every row is workspace-scoped (`workspace_id NOT NULL`) per frozen `B0_BACKEND_BLUEPRINT.md` non-negotiable rule 1. "Public ID" follows frozen `BACKEND_PUBLIC_ID_REGISTRY.md`: a table without one is not addressable in the public API and is reached only through its parent.

| # | Entity | Table | Identity | Public ID | Mutability | Versioned | Retention |
|---|---|---|---|---|---|---|---|
| 1 | **AutomationRule** | `automation_rules` | `(workspace_id, public_id)` | `AUTO-*` (`B7-AM-001`) | mutable: `name`, `description`, `status`, `active_revision_id`, `version` | yes (ADR-010 `version`) | archive, never delete (`B7_RETENTION_DELETION.md` §1) |
| 2 | **AutomationRuleRevision** | `automation_rule_revisions` | `(rule_id, revision_no)` | none — addressed as `AUTO-*/revisions/{n}` | **immutable after creation** except `status` and `superseded_at` | revision number *is* the version | retained as long as any run references it |
| 3 | **AutomationRuleTrigger** | `automation_rule_triggers` | `(revision_id)` — exactly one per revision | none | **immutable** — child of an immutable revision | n/a | with its revision |
| 4 | **AutomationRuleCondition** | `automation_rule_conditions` | `(revision_id, position)` | none | **immutable** | n/a | with its revision |
| 5 | **AutomationRuleAction** | `automation_rule_actions` | `(revision_id, position)` | none | **immutable** | n/a | with its revision |
| 6 | **AutomationRun** | `automation_runs` | `(workspace_id, public_id)` | **`RUN-*`** (frozen, §A) | append-mostly: `status`, timestamps, terminal fields; never re-pointed to another rule or revision | yes (`version`, for the frozen approval `If-Match`-equivalent) | audit-retention window (`B7_RETENTION_DELETION.md` §1) |
| 7 | **AutomationRunStep** | `automation_run_steps` | `(run_id, step_index)` | none — frozen registry §B: *"`step_runs` is internal and is not exposed by the Core contract"* | append-mostly: `status`, attempt counters, result ref | no | with its run |
| 8 | **AutomationRunApproval** | `automation_run_approvals` | `(run_id)` — at most one decision per run | none | **immutable after the decision is recorded** | no | with its run |
| 9 | **AutomationInboxRecord** | `automation_inbox_records` | `(workspace_id, source_event_id)` UNIQUE | none — internal | append-only; `processed_at` set once | no | short prune window (`B7_RETENTION_DELETION.md` §1, `B7-D-B012`) |
| 10 | **AutomationRuleAudit** | *(none — see below)* | — | — | — | — | — |

**Row 10 is deliberately empty.** The mock keeps its own `automationActivities` store (FB-A41). B7 does **not** create a private audit table: frozen `BACKEND_DOMAIN_OWNERSHIP.md` gives Audit its own domain with `audit_logs` as the single authoritative table and "immutable/no secrets" as its forbidden coupling. B7 writes audit rows *there*, through the Audit domain's writer, exactly as B2/B5/B6 do. See `B7_OBSERVABILITY_AUDIT.md` §2.

```
OWNED_ENTITY_COUNT = 9
```

## 3. Entities B7 references but does not own

Every reference below is by **`EntityRef` / public ID**, resolved live under workspace scope at the moment it is needed — never embedded, never cached, never copied into a B7 column as a duplicate of the other domain's truth. This is frozen doctrine, not a B7 preference: `B2_COMMAND_EVENT_CATALOG.md` §3 rule 2 states *"Refs, not embeddings. A consumer that needs an attribute re-reads it live under that workspace's scope, so it can never act on a stale copy of authorization-relevant state."*

| # | Entity | Owner | B7's reference | B7's write access |
|---|---|---|---|---|
| 1 | Workspace | B1 | `workspace_id` on every row | none |
| 2 | Membership | B1 | rule `created_by`, revision `activated_by`, approval `decided_by`, run authority principal | none |
| 3 | Lead | B2 | run trigger subject; action target | **none — via `ChangeLeadStatus`/`ChangeLeadPriority`/`AssignLeadOwner` only** |
| 4 | Contact | B2 | reachable from a Lead for context | none |
| 5 | Task | B2 | action result ref (`TSK-*`) | **none — via `CreateTask` only** |
| 6 | Appointment | B2 | action result ref (`APT-*`) | **none — via `ScheduleAppointment` only** |
| 7 | Business | B3 | reachable from a Lead for context | none |
| 8 | DiscoveryJob | B3 | not referenced in Phase 1 | none |
| 9 | IntelligenceRun | B4 | not referenced in Phase 1 | none |
| 10 | Conversation | B5 | run trigger subject; condition subject | **none** |
| 11 | Message | B5 | trigger source for the derived `conversation_needs_reply` | **none** |
| 12 | Deal | B6 | run trigger subject; condition subject | **none** |
| 13 | Pipeline / PipelineStage | B6 | `STG-*` as a `deal.stage` condition operand | none |
| 14 | Subscription / capability / quota | Entitlements | `automation.rules`, `automationRuns` | none |
| 15 | AuditLog | Audit | B7 writes audit rows through the Audit writer | append-only, through that domain's writer |
| 16 | OutboxEvent | common | B7 emits its own events through the frozen outbox | its own rows only |

```
REFERENCED_ENTITY_COUNT = 16
```

## 4. What B7 is explicitly *not*

| B7 is not | Because |
|---|---|
| a second CRM authority | Lead/Task/Appointment state is B2's; B7 holds no copy and reads live (`B7_B2_CRM_BOUNDARY.md`) |
| a second messaging path | frozen `B5-D-A025` — one `SendMessage` admission sequence, no automation variant (`B7_B5_MESSAGING_BOUNDARY.md`) |
| a second Deal-mutation path | frozen `B6-D-A026` — identical commands, identical admission (`B7_B6_PIPELINE_BOUNDARY.md`) |
| an AI decision-maker | B4 recommends; B7 never treats a recommendation as authority (`B7_B4_INTELLIGENCE_BOUNDARY.md`) |
| a revenue, billing, payment, invoice, or tax authority | structurally impossible — B7 has no write path and declares no such command (`B7_REVENUE_FIREWALL.md`, `B7_B8_BILLING_BOUNDARY.md`, `B7_B9_FINANCE_BOUNDARY.md`) |
| a workflow engine with branching, loops, or parallelism | Phase 1 is a strictly sequential action list; nothing in the frozen frontend asks for more (`B7_ACTION_EXECUTION_MODEL.md` §5) |
| a scheduler | no frontend evidence exists (FB-A57) and B7 declines to invent one (`B7_SCHEDULE_DELAY_MODEL.md`) |
| its own queue/transport design | B0 ADR-004/005 already chose Celery + Redis + outbox; topology is B12's (`B7_B12_ASYNC_BOUNDARY.md`) |

## 5. Module placement

Frozen `B0_BACKEND_BLUEPRINT.md`'s package structure already reserves `apps/automation/ # rules, runs, approvals, actions`. B7 fills exactly that module and adds no new top-level app. The event-inbox table lives inside it (it is automation's consumer-side dedup ledger, not a shared facility) — see `B7_EVENT_CONSUMPTION_MODEL.md` §5 for why this is a materialisation of frozen B2 doctrine rather than a new one.

## 6. Negative controls

| ID | Control |
|---|---|
| `AT-DOM-2` **NC** | no B7 application service, worker, or event handler holds a repository or write path to `leads`, `contacts`, `tasks`, `appointments`, `crm_activities`, `conversations`, `messages`, `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions` |
| `AT-DOM-3` **NC** | no B7 table, command, or handler references `revenue_events`, `revenue_reversals`, `attribution_touchpoints`, `subscriptions`, `invoices`, `payments`, or `tax_invoices` |
| `AT-DOM-5` **NC** | B7 declares no private audit table; an implementation adding one is rejected |
