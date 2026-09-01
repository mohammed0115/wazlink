# B7 — Controlled Amendments

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 0. How this register was built

Every B7 document that cites a frozen B0-B6 source was checked, mechanically and then by reading, for whether it merely **reads** that source (no amendment), **extends** it (ADDITIVE), **restates it more precisely without changing its meaning** (COMPATIBLE_CLARIFICATION), or **changes, renames, removes, or reverses** something frozen (NON_ADDITIVE — a closure blocker).

The search was specifically run against the frozen artifacts that name Automation *before B7 existed*, because those are the ones a B7 pack is most likely to drift from without noticing:

| Frozen artifact | What it already fixes about Automation |
|---|---|
| `BACKEND_COMMAND_EVENT_CATALOG.md` | commands `CreateAutomationRule`, `ApproveAutomationRun`; events `AutomationRunCreated`, `AutomationRunCompleted` |
| `BACKEND_STATE_MACHINES.md` | `AutomationRun` is `created→awaiting_approval→queued→running→completed/failed/cancelled`; sensitive actions cannot skip approval |
| `BACKEND_DOMAIN_OWNERSHIP.md` | aggregate `AutomationRun`; tables `rules, runs, approvals, step runs`; forbidden coupling "no unapproved sensitive action" |
| `BACKEND_DATA_MODEL.md` row 21 | `automation_rules, triggers, conditions, actions, runs, step_runs, approvals`; "event/rule/action idempotency unique" |
| `BACKEND_API_CATALOG.md` + `BACKEND_OPENAPI_V1.yaml` | `POST /api/v1/automation/runs/{id}/approve`, `operationId: approveAutomationRun`, body `{approved, version}`, `additionalProperties: false` |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | `RUN-` = AutomationRun (§A, canonical); `AUTO-`/`AUTOACT-`/`AUTOEXEC-`/`COND-` deferred in §B; `AUTORUN-`/`AGA-` → `RUN-` in §C |
| `B1_AUTHORIZATION_RBAC.md` | `automation.rule.view`, `automation.rule.manage`, `automation.run.approve` with a full role matrix |
| `B2_COMMAND_EVENT_CATALOG.md` | "Automation as actor": the five invocable CRM commands, `actor_type='system:automation'`, `actor_label='automation_run:RUN-*'` |
| `B5_B6_B7_BOUNDARIES.md` §2 | `B5-D-A025` — no second automation send path |
| `B6_B7_AUTOMATION_BOUNDARY.md` | `B6-D-A026` — no second automation Deal-mutation path |

**Six of those ten are reused verbatim with no amendment at all**: the RBAC permissions and their matrix, the `system:automation` actor convention and the five CRM commands, the frozen approval endpoint/operationId/body, the frozen command and event names, `RUN-*`, and both downstream boundary decisions.

## 1. The bundle — 5 amendments across 4 frozen artifacts

```
CONTROLLED_AMENDMENT_COUNT = 5
ADDITIVE_AMENDMENTS        = 4
COMPATIBLE_CLARIFICATIONS  = 1
NON_ADDITIVE_AMENDMENTS    = 0
```

---

### `B7-AM-001` — promote `AUTO-` to a canonical public-ID prefix · **ADDITIVE**

| Field | Value |
|---|---|
| **Frozen source** | `BACKEND_PUBLIC_ID_REGISTRY.md` §B, row `AUTO-` |
| **Frozen rule** | The §B row reads: `AUTO-` \| evidence `AUTO-1002` automation rule \| classification *"Rule CRUD is future/non-Core; canonical persisted execution identity is `RUN-*`"* — i.e. `AUTO-` is a frontend-fixture prefix deliberately **not** promoted to §A, for the stated reason that rule CRUD was out of scope |
| **B7 rule** | Move `AUTO-` to §A as: prefix `AUTO-` \| resource AutomationRule \| owning domain Automation \| persistence concept AutomationRule \| uniqueness Workspace-scoped \| example `AUTO-01J...` |
| **Classification** | **ADDITIVE** — promotes an already-registered prefix on exactly the condition the registry itself names as the reason for deferral. Reassigns nothing, renames nothing, and mints **no new namespace**. |
| **Rationale** | The registry's stated ground for non-promotion is *"Rule CRUD is future/non-Core"*. B7 **is** that future: it introduces `GET/POST /automation/rules` and `PATCH /automation/rules/{id}`, which need an addressable identifier. Promoting `AUTO-` reuses the frontend's own live vocabulary (`AUTO-1001`…`AUTO-1007`) and satisfies the brief's "propose the minimum set" instruction. Minting a *new* prefix instead would add a namespace while leaving `AUTO-` stranded, and would require reading the registry as an "explicit rejection" of `AUTO-` — which it never states. |
| **Affected B7 contracts** | `B7_DOMAIN_OWNERSHIP.md` §2, `B7_DATA_MODEL.md` §1, `B7_API_DTO_CONTRACTS.md` §1-2 |
| **Frozen artifacts this amendment must touch when applied** | The registry's own closing clause — *"Any new canonical prefix requires an ADR update, API/DTO update, index update, and traceability entry before implementation"* — governs a §B→§A promotion as it governs a new prefix, so applying `B7-AM-001` requires **all five**: (1) `BACKEND_PUBLIC_ID_REGISTRY.md` — move the `AUTO-` row from §B to §A and adjust §B's narrative enumeration (the "56 identifier prefixes … classified exactly once" total is unchanged; only its section membership moves); (2) `BACKEND_ARCHITECTURE_DECISIONS.md` — the ADR entry recording the promotion and its condition; (3) `BACKEND_API_CATALOG.md` + `BACKEND_OPENAPI_V1.yaml` — the `AUTO-*`-addressed rule operations (`B7_API_DTO_CONTRACTS.md` §1); (4) `B0_BACKEND_TRACEABILITY.md` — the traceability entry; (5) `BACKEND_DOCUMENTATION_INDEX.md` — the index entry. **None of these five is edited by B7.** They are enumerated here so the approval decision is made with the full blast radius visible, and so the later application step has a checklist rather than a rediscovery exercise. |
| **Implementation impact** | One registry row moves section; four further frozen documents gain an entry. `RUN-*` is untouched and remains the canonical execution identity. |
| **Migration/compatibility** | None — no persisted data exists. |
| **Acceptance evidence** | `AT-DOM-6`, `AT-DOM-7` **(NC)** in `B7_ACCEPTANCE_TESTS.md` |

---

### `B7-AM-002` — name Automation as a consumer of two B2 appointment events · **ADDITIVE**

| Field | Value |
|---|---|
| **Frozen source** | `B2_COMMAND_EVENT_CATALOG.md` §2, rows `AppointmentCompleted` and `AppointmentNoShowRecorded` |
| **Frozen rule** | Both rows' Consumers cell reads `Analytics` only — while the sibling rows `TaskCompleted`, `AppointmentCreated`, `LeadCreated`, `LeadStatusChanged`, `LeadPriorityChanged`, and `LeadOwnerChanged` already read `…, Automation` |
| **B7 rule** | Extend both Consumers cells to `Analytics, Automation` |
| **Classification** | **ADDITIVE** — extends two consumer-list cells by one named consumer each. The events' schema, producer, payload, PII posture, outbox requirement, and every existing consumer's behavior are untouched. |
| **Rationale** | The frozen frontend's trigger catalog contains `appointment_completed` and `appointment_no_show` as first-class triggers (FB-A04), and B2 already emits exactly the two matching events. The consumer-list omission is an oversight of ordering — B2 was written before B7 existed — not a deliberate exclusion, which the six sibling rows that *do* name Automation demonstrate. |
| **Affected contracts** | `B7_TRIGGER_CATALOG.md` §2, `B7_B2_CRM_BOUNDARY.md` |
| **Implementation impact** | Documentation only. Adding a consumer requires no producer change under the frozen outbox model. |
| **Migration/compatibility** | None. |
| **Acceptance evidence** | `AT-TRIG-5`, `AT-TRIG-6` |

---

### `B7-AM-003` — add three `AutomationRun` states · **ADDITIVE**

| Field | Value |
|---|---|
| **Frozen source** | `BACKEND_STATE_MACHINES.md` |
| **Frozen rule** | *"AutomationRun is `created→awaiting_approval→queued→running→completed/failed/cancelled`; sensitive actions cannot skip approval."* |
| **B7 rule** | Keep all seven frozen state names and every frozen edge, in the frozen order (approval **before** queueing). Add three states — `evaluating` (between `created` and the approval/queue decision), `skipped` (terminal: trigger matched, conditions did not), `dead_lettered` (terminal: retry budget exhausted) — and the edges listed in `B7_EXECUTION_MODEL.md` §3. |
| **Classification** | **ADDITIVE**, with one point stated openly rather than glossed. No frozen state is renamed, removed, reordered, or made unreachable; no frozen edge is reversed; the frozen ordering and the frozen "sensitive actions cannot skip approval" constraint are both preserved exactly. **Five of the frozen chain's six literal adjacencies survive verbatim. The sixth, `created → awaiting_approval`, becomes the two-hop path `created → evaluating → awaiting_approval`.** The frozen artifact is a prose lifecycle sketch that fixes state names, their order, and the approval constraint — it asserts no edge-level exhaustiveness (contrast `B7_EXECUTION_MODEL.md` §3, which does) — so refining one adjacency into a path while preserving every name, the order, and the constraint is ADDITIVE on the reading this corpus has already used: `B6-D-A014` added two edges to this same frozen document and was accepted as ADDITIVE. **The alternative reading, recorded so the approver can take it:** if `BACKEND_STATE_MACHINES.md`'s chain is read as an edge-level adjacency contract rather than an ordering contract, then this one refinement is the single point in the whole B7 pack that would not be additive, and approving `B7-AM-003` is what settles it. Nothing else in this amendment turns on that reading. |
| **Rationale** | Each added state names a condition a durable asynchronous implementation genuinely has and the frozen synchronous sketch had no word for. `skipped` is directly evidenced (FB-A26 — the mock persists exactly this outcome, with a reason, and the "why didn't my rule fire?" question depends on it). `dead_lettered` is already the frozen terminal disposition in `BACKEND_RETRY_POLICY.md`; this amendment only makes it reachable on this aggregate. |
| **Affected contracts** | `B7_EXECUTION_MODEL.md` §2-3, `B7_DATA_MODEL.md` §3, `B7_FAILURE_RETRY_MODEL.md`, `B7_DEAD_LETTER_REPLAY.md` |
| **Implementation impact** | Three additional enum values and their guarded transitions. |
| **Migration/compatibility** | None. |
| **Acceptance evidence** | `AT-EXEC-1`, `AT-EXEC-2`, `AT-EXEC-3` **(NC)** |
| **Explicitly *not* changed** | The frozen terminal remains **`completed`**, never `succeeded`. The frozen initial remains **`created`**, never an implicit `queued`. A fourth candidate state, `waiting`, is **not** added — it has no Phase-1 reachability (`B7_EXECUTION_MODEL.md` §7). |

---

### `B7-AM-004` — reconcile the abbreviated event name in the ownership matrix · **COMPATIBLE_CLARIFICATION**

| Field | Value |
|---|---|
| **Frozen source** | `BACKEND_DOMAIN_OWNERSHIP.md`, Automation row, Events cell |
| **Frozen rule** | The cell reads `AutomationCompleted`, while `BACKEND_COMMAND_EVENT_CATALOG.md` — the document whose stated purpose is the command/event vocabulary — names the same event `AutomationRunCompleted` |
| **B7 rule** | Treat `AutomationRunCompleted` as the single authoritative name; read the ownership matrix's `AutomationCompleted` as its abbreviation, not as a second event |
| **Classification** | **COMPATIBLE_CLARIFICATION** — resolves an existing internal inconsistency between two frozen documents in favour of the one that owns the vocabulary. No new event is created and none is removed; the ownership matrix abbreviates several other cells the same way (`CreateRule`/`ApproveRun` for `CreateAutomationRule`/`ApproveAutomationRun`, `StageChanged` for `DealStageChanged`). |
| **Rationale** | Leaving it unstated would let an implementation emit two differently-named events for one occurrence, or let a verifier record a false B7 event-name drift. |
| **Affected contracts** | `B7_COMMAND_EVENT_CATALOG.md` §2 |
| **Implementation impact** | None. |
| **Migration/compatibility** | None. |
| **Acceptance evidence** | `AT-DEDUP-4` |

---

### `B7-AM-005` — add two tables to the frozen Automation table group · **ADDITIVE**

| Field | Value |
|---|---|
| **Frozen source** | `BACKEND_DATA_MODEL.md` row 21 |
| **Frozen rule** | Row 21 reads: Automation \| `automation_rules, triggers, conditions, actions, runs, step_runs, approvals` \| *"event/rule/action idempotency unique"* |
| **B7 rule** | Keep all seven frozen groups as tables (`B7_DATA_MODEL.md` §8's mapping table shows the one-to-one correspondence). Add `automation_rule_revisions` and `automation_inbox_records`. |
| **Classification** | **ADDITIVE** — every frozen group survives as a table with its frozen role intact; two tables are added. Nothing is collapsed into JSON, renamed away, or dropped. |
| **Rationale** | `automation_rule_revisions` is what makes `triggers`/`conditions`/`actions` immutable: hanging them off a revision rather than off the rule is what guarantees a later edit cannot rewrite the definition a historical run executed against — the brief's §9 requirement, and the invariant `AT-RVN-5` **(NC)** proves. `automation_inbox_records` materialises frozen B2 doctrine — *"Consumption is idempotent by `event_id`"* (`B2_COMMAND_EVENT_CATALOG.md` §4) — which every event consumer in this corpus already owes but which no shared table yet provides; it is distinct from `WebhookReceipt`/`WHR-*`, which dedups **external provider** callbacks, not internal domain events. |
| **Affected contracts** | `B7_DATA_MODEL.md` §2/§2a-c/§6/§8, `B7_RULE_REVISION_MODEL.md`, `B7_EVENT_CONSUMPTION_MODEL.md` |
| **Implementation impact** | Two additional tables inside the already-reserved `apps/automation/` module. No other domain's schema changes. |
| **Migration/compatibility** | None. |
| **Acceptance evidence** | `AT-RVN-4`, `AT-RVN-5` **(NC)**, `AT-DEDUP-3` **(NC)** |

---

### Not an amendment: the additive `AutomationRunSkipped` event

`B7-FIX.2` adds one B7-produced event, `AutomationRunSkipped` (`B7-D-A041`), so that every terminal `AutomationRun` state has exactly one event reporting it. **This is not a controlled amendment.** It mints a new name inside B7's own `AutomationRun*` namespace, changes no frozen B0-B6 text, collides with no frozen catalog entry, and adds no consumer obligation to any other domain — the same posture under which the other ten additive B7 events already sit. `B7-AM-003`'s run-state set is untouched: `skipped` was already one of its three declared additive states, and this only gives that existing state an event. `B7-AM-004` is likewise untouched — it reconciles `AutomationCompleted`/`AutomationRunCompleted` and says nothing about `skipped`. The bundle remains exactly five items.

### Not an amendment: the entitlement/error-code restoration

`B7-FIX.1` restored two things B7 had drifted from rather than amended: the frozen `automationRuns` usage metric (`B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §3, `B1_FAILURE_SCENARIOS.md` F16) and the frozen `ENTITLEMENT_LOCKED`/`QUOTA_EXHAUSTED` error codes (`BACKEND_ERROR_CATALOG.md`). B7 now enforces and emits exactly what B0/B1 already froze, and the invented `automation.rules.max_active` key is removed rather than amended into existence. **Correcting B7's own drift back onto frozen truth is not a controlled amendment**, and this note exists only so a reader does not go looking for one. No amendment ID is allocated to it; the bundle remains exactly five items, `B7-AM-001` through `B7-AM-005`.

## 2. The items that are not purely additive, stated plainly

**None.** `NON_ADDITIVE_AMENDMENTS = 0`.

Four candidates were examined and **rejected as designs** precisely because each would have been NON_ADDITIVE. They are recorded here so it is visible that the question was asked rather than avoided:

| Rejected candidate | Why it would have been NON_ADDITIVE | What B7 does instead |
|---|---|---|
| Rename the frozen run terminal `completed` → `succeeded` | renames a frozen state | keeps `completed` |
| Replace the frozen state chain with a 10-state machine dropping `created` and reordering approval after queueing | removes a frozen state and reverses a frozen edge | keeps all seven names, five of six literal adjacencies, and the frozen approval-before-queue order, refining one adjacency into a path (`B7-AM-003`) |
| Rename `ApproveAutomationRun` → an action-granular command, and split the frozen endpoint into `/approve` + `/reject` | renames a frozen command and adds an operation the frozen `additionalProperties:false` body cannot express | keeps `ApproveAutomationRun`, run-granular, with `approved:false` as the rejection path (`B7_COMMAND_EVENT_CATALOG.md` §4) |
| Mint a new `ARULE-` public-ID prefix on the reading that the registry "rejects" `AUTO-` | mischaracterises a frozen row: the registry defers `AUTO-` for a stated reason, it does not reject it | promotes `AUTO-` (`B7-AM-001`) |

## 3. What every item satisfies

1. **Minimal.** Each adds the least that its stated need requires — one registry row, two consumer-list cells, three enum values, one naming reconciliation, two tables.
2. **Non-destructive.** None deletes, renames, reorders, or reinterprets an existing frozen row, cell, state, edge, command, event, permission, or endpoint.
3. **Traceable.** Each maps to a decision ID in `B7_DECISION_REGISTER.md` and to at least one acceptance test.

## 4. What was deliberately *not* amended, despite temptation

- **B6's Deal-command list** is not amended to enumerate B7 as a caller, even though Phase-1 B7 does invoke `MoveDealStage` — `B6-D-A026` already states the general rule ("a future automation-triggered Deal mutation must call the identical command... through the identical admission sequence") in a form that requires no per-command amendment, and `B6_DATA_MODEL.md` §4 already reserves the `reason_source='automation'` slot for exactly this caller. B7 invoking one of B6's commands is B6 working as designed, not B6 needing to change.
- **B5's `SendMessage`/`SendTemplateMessage`** are not amended, for the identical reason: `B5-D-A025`, the reserved `sender_type='system'` ("reserved for a future governed-automation sender"), and `B5_MESSAGE_STATE_MACHINE.md`'s `cancelled`-state justification ("B7's future governed-automation sends will need one") all name this caller in advance. Phase-1 B7 invokes `SendMessage`/`SendTemplateMessage` under a non-configurable `approval_required` tier; no B5 text changes.
- **The frontend's `forbiddenAutomationActions` list** is not a frozen *architecture* artifact and so cannot be amended here. Its deliberate relaxation for the single canonical governed send action is a **product/architecture decision, approved by the CTO for Phase 1** and recorded as `B7-D-A016`, explained in `B7_FRONTEND_BEHAVIOR_INVENTORY.md` §5 and `B7_B5_MESSAGING_BOUNDARY.md` §4 — never left implicit, and explicitly **not** classified as a frozen B0-B6 amendment, because no frozen B0-B6 text changes: `B5-D-A025` already requires the identical governed command and admission sequence, and `B5_B6_B7_BOUNDARIES.md` §2 already names deliberate, explicit relaxation through that same command as a posture B5 is compatible with.
- **The delegated-authority model** (`B7-D-A007`) amends nothing: `B1_AUTHORIZATION_RBAC.md`'s per-membership role matrix is read, unmodified, at invocation. B7 adds a column to its *own* revision table to record which membership activated it; no frozen permission, role, or matrix cell changes.
- **`B2_COMMAND_EVENT_CATALOG.md`'s "Automation as actor" note** already names the five B2 commands B7 invokes with the exact actor identity — nothing to amend; only the two *consumer-list cells* of `B7-AM-002` needed extension, and only where specific frontend evidence exists (not, for instance, `ContactAdded` or `LeadArchived`, which have neither frontend nor architectural pressure behind them).
- **`B1_AUTHORIZATION_RBAC.md`** is not amended at all: all three automation permissions and their full role matrix are reused verbatim, and every target-domain permission B7 relies on (`task.manage`, `appointment.manage`, `lead.update`, `lead.assign`) is likewise already frozen. `ADDITIVE_PERMISSION_COUNT = 0`.
- **`BACKEND_ERROR_CATALOG.md`** is not amended: B7 introduces new `code` values inside the existing envelope, which is what the frozen catalog already contemplates, and no new HTTP-status doctrine.

## 5. Blocking status

None of the five blocks B7's own design work — each is written as *proposed* text in the relevant B7 document and requires CTO approval before an implementation agent may treat the frozen file as actually amended. No B7 command, event, acceptance test, or invariant depends on an amendment having already landed.

Because `NON_ADDITIVE_AMENDMENTS = 0`, this bundle raises **no closure blocker**. It still requires explicit CTO approval before implementation, exactly as B6's two-item bundle did.
