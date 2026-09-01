# B7 — Domain Ownership

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Mandate

B7 owns the **Automation** domain: converting `trigger matched → conditions satisfied → actions planned` into governed invocations of other domains' own commands, with a durable, auditable, idempotent, loop-safe execution record. B7 is an **orchestration** domain. It owns no CRM, Discovery, Intelligence, Messaging, Pipeline, Billing, Revenue, Tax, or File truth, and cannot become an alternative authority for any of them (§3 of the task brief; restated structurally in `B7_DIRECT_WRITE_FIREWALL.md` and `B7_REVENUE_FIREWALL.md`).

Frozen `BACKEND_DATA_MODEL.md`'s table-group sketch for Automation — `automation_rules, triggers, conditions, actions, runs, step_runs, approvals` (row 21) — predates B7 and is the frozen skeleton this document specifies, exactly as B6's Deal/Pipeline table group predated and bounded B6. B7 does not invent a table group; it resolves one already named.

## 2. Owned entities — resolved (Class A, `B7-D-A001`)

| Entity | Public ID | Workspace scope | Mutability | Versioning | Foreign references out |
|---|---|---|---|---|---|
| `AutomationRule` | `ARULE-*` (new prefix — §5) | Workspace-scoped | Editable via revision (§`B7_RULE_REVISION_MODEL.md`); status transitions via lifecycle commands | Integer `version`, `If-Match`, `409 CONFLICT` — the exact frozen pattern `BACKEND_ARCHITECTURE_DECISIONS.md` already names for AutomationRule alongside Lead/Deal/Task | `created_by` → Membership; `workspace_id` → Workspace |
| `AutomationRuleRevision` | none (internal; addressed by `rule_id` + `revision_number`) | Workspace-scoped (via parent rule) | Immutable once created | `revision_number` monotonic per rule | `rule_id` → `AutomationRule`; embeds a frozen snapshot of trigger/conditions/actions |
| `AutomationRun` | `RUN-*` (frozen, `BACKEND_PUBLIC_ID_REGISTRY.md` §A) | Workspace-scoped | Append-only status progression; terminal states immutable | none (a run is never edited, only transitioned) | `rule_id` (nullable — §`B7_EXECUTION_MODEL.md` for rule-less runs), `rule_revision_id`, `source_event_id` (nullable for manual), `workspace_id` |
| `AutomationActionExecution` (internal name: `step_runs`, per `BACKEND_DATA_MODEL.md` row 21) | none (internal; addressed by `run_id` + `action_index`) | Workspace-scoped (via parent run) | Append-only status progression | none | `run_id` → `AutomationRun`; `target_domain`, `target_command`, `target_ref` (opaque reference to the invoked command's result, e.g. `TSK-*`/`DEAL-*`/`MSG-*`) |
| `AutomationApproval` (internal name: `approvals`, per `BACKEND_DATA_MODEL.md` row 21) | none (internal; addressed by `action_execution_id`) | Workspace-scoped (via parent action execution) | Written once (decision is final) | none | `action_execution_id`, `decided_by` → Membership (nullable until decided) |
| `AutomationInboxRecord` | none (internal) | Workspace-scoped | Written once, read for dedup | none | `source_event_id` (unique per workspace) |
| `AutomationWakeup` | none (internal) | Workspace-scoped (via parent run) | Written once, consumed once | none | `run_id`, `action_index` (nullable for a scheduled *trigger* wakeup vs. an in-flight Wait *action* wakeup) |

`OWNED_ENTITY_COUNT = 7`.

Trigger, condition, and action **definitions** are not independently addressable resources: `BACKEND_PUBLIC_ID_REGISTRY.md` §B explicitly classifies `COND-` and `AUTOACT-` as "rule fragment[s] inside a rule definition; not an independently addressable resource," and `AUTOEXEC-` as internal ("`step_runs` is internal and is not exposed by the Core contract, whose automation identity is `RUN-*`"). B7 therefore stores trigger/condition/action definitions as structured content **nested inside** `AutomationRule`/`AutomationRuleRevision` (normalized child rows internally, per the frozen `triggers, conditions, actions` table names in `BACKEND_DATA_MODEL.md` row 21, but exposed only through the parent rule's own request/response DTO — never through a standalone `/automation/conditions/{id}`-shaped endpoint). This is the **hybrid** model the task brief asks B7 to choose explicitly (§7): normalized internally for query/validation, embedded/nested externally for API purposes, with zero new public-ID prefixes for fragments.

## 3. Referenced (not owned) entities

| Entity | Owning domain | How B7 references it | B7's authority over it |
|---|---|---|---|
| `Workspace` | B1 Foundation | `workspace_id` on every B7 row | None — read/derive only |
| `Membership` (user) | B1 Foundation | `created_by`, `decided_by`, actor context on commands B7 invokes | None |
| `Lead` | B2 CRM | Condition fields (`lead.*`), target of `ChangeLeadStatus`/`ChangeLeadPriority`/`AssignLeadOwner` | None — invokes B2's governed commands only |
| `Task` | B2 CRM | Trigger source (`TaskCreated`/`TaskCompleted`), target of `CreateTask` | None — invokes B2's governed commands only |
| `Appointment` | B2 CRM | Trigger source (`AppointmentCreated`/`AppointmentCompleted`/`AppointmentNoShowRecorded`), target of `ScheduleAppointment` | None — invokes B2's governed commands only |
| `Deal` | B6 Pipeline | Trigger source (`DealCreated`/`DealStageChanged`/`DealWon`/`DealLost`), condition fields (`deal.*`), target of `MoveDealStage` | None — invokes B6's governed commands only, per frozen `B6-D-A026` |
| `PipelineStage` | B6 Pipeline | Condition/action reference (`STG-*`) when a `MoveDealStage` action targets a stage | None |
| `Conversation` / `Message` | B5 Messaging | Target of `SendMessage`/`SendTemplateMessage` | None — invokes B5's governed commands only, per frozen `B5-D-A025` |
| `RevenueEvent` / `RevenueReversal` / `AttributionTouchpoint` | future B9 Finance | Never referenced, read, or written | **Zero** — structural firewall, `B7_REVENUE_FIREWALL.md` |
| `Plan` / `Entitlement` decision | future B8 Billing | Read-only capability check (`automation.rules`, per FB-D22) | None — consumes the frozen entitlement boundary only |
| Cross-domain `OutboxEvent` envelope | B0 Foundation (ADR-005) | Consumed via B7's own inbox/dedup record | None — B7 never writes another domain's outbox row |

`REFERENCED_ENTITY_COUNT = 10`.

## 4. What B7 explicitly does not own

No Lead/Contact/Task/Appointment table (B2). No DiscoveryJob/DiscoveryResult/Business table (B3). No IntelligenceRun/Signal/Recommendation table (B4). No Conversation/Message table (B5). No Deal/Pipeline/PipelineStage table (B6). No Subscription/Plan/Invoice/Payment table (future B8). No RevenueEvent/RevenueReversal/AttributionTouchpoint table (future B9). No TaxInvoice table (future B10). No FileAsset table. B7 holds only the seven entities in §2, all under the `automation_rules, triggers, conditions, actions, runs, step_runs, approvals` table group frozen `BACKEND_DATA_MODEL.md` row 21 already named, plus its own inbox/wakeup bookkeeping.

## 5. Public-ID amendment required — resolved (Class A, `B7-D-A002`)

`RUN-*` (AutomationRun) is already frozen (`BACKEND_PUBLIC_ID_REGISTRY.md` §A) and reused verbatim — zero amendment needed. `AutomationRule`, however, has **no** frozen canonical prefix: the registry's §B explicitly rejects `AUTO-` as non-canonical ("Rule CRUD is future/non-Core; canonical persisted execution identity is `RUN-*`" — a statement about *execution* identity, not rule identity, but one that pointedly declines to mint `AUTO-` as the rule's prefix). Because Phase-1 B7 *does* need externally addressable Rule CRUD (`GET/POST/PATCH /automation/rules/{id}`), this is a genuine gap, not a B7 invention to route around: B7 proposes the new prefix `ARULE-` for `AutomationRule`, checked against every existing registry row and collision-free (`ARULE-` collides with no Section A/B/C prefix). This is recorded as a **controlled, additive** amendment in `B7_CONTROLLED_AMENDMENTS.md` (extends the registry with one new row; changes no existing row's meaning).

`PUBLIC_ID_COLLISIONS = 0`.
