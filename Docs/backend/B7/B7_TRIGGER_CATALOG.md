# B7 — Trigger Catalog

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Closed catalog — resolved (Class A, `B7-D-A008`)

No arbitrary trigger strings. Every trigger type below is either (a) a frozen cross-domain event whose producing domain's own catalog names "Automation" as a declared consumer, (b) a frozen cross-domain event a dedicated boundary document (`B6_B7_AUTOMATION_BOUNDARY.md`) explicitly names as B7-legal, or (c) a B7-internal trigger source with no cross-domain event backing it. A candidate with none of the three is excluded from Phase 1, not silently assumed.

## 2. Phase-1 trigger catalog

| Trigger | Owning domain | Source event | Authority | Workspace derivation | Aggregate identity | Dedup identity |
|---|---|---|---|---|---|---|
| `lead_created` | B2 | `LeadCreated` | `B2_COMMAND_EVENT_CATALOG.md` line 52 — consumer list names Automation | event envelope `workspace_id` | `lead_ref` | `event_id` |
| `lead_status_changed` | B2 | `LeadStatusChanged` | line 53 — Automation named | same | `lead_ref` | `event_id` |
| `lead_priority_changed` | B2 | `LeadPriorityChanged` | line 54 — Automation named | same | `lead_ref` | `event_id` |
| `lead_owner_changed` | B2 | `LeadOwnerChanged` | line 55 — Automation named (not evidenced in the frontend catalog, FB-D02, but frozen B2 outranks a frontend omission) | same | `lead_ref` | `event_id` |
| `task_created` | B2 | `TaskCreated` | line 61 — Automation named (frontend evidences only `task_completed`; frozen B2 additionally names `TaskCreated`) | same | `task_ref` | `event_id` |
| `task_completed` | B2 | `TaskCompleted` | line 64 — Automation named; also FB-D02 | same | `task_ref` | `event_id` |
| `appointment_created` | B2 | `AppointmentCreated` | line 66 — Automation named | same | `appointment_ref` | `event_id` |
| `appointment_completed` | B2 | `AppointmentCompleted` | line 69 — consumer list is Analytics-only in the frozen text; **added by controlled amendment `B7-AMEND-01`** on direct frontend evidence (FB-D02) | same | `appointment_ref` | `event_id` |
| `appointment_no_show` | B2 | `AppointmentNoShowRecorded` | line 70 — Analytics-only in frozen text; **added by `B7-AMEND-01`**, same justification | same | `appointment_ref` | `event_id` |
| `deal_created` | B6 | `DealCreated` | `B6_B7_AUTOMATION_BOUNDARY.md` §2 — explicitly named | same | `deal_ref` | `event_id` |
| `deal_stage_changed` | B6 | `DealStageChanged` | §2 — explicitly named | same | `deal_ref` | `event_id` |
| `deal_won` | B6 | `DealWon` | §2 — explicitly named | same | `deal_ref` | `(deal_ref,'won')` (matches `DealWon`'s own frozen producer-side uniqueness) |
| `deal_lost` | B6 | `DealLost` | §2 — explicitly named | same | `deal_ref` | `(deal_ref,'lost')` |
| `scheduled` | B7-internal | none (time, not a domain event) | task brief §29 | the rule's own `workspace_id` | the rule itself, or the entity a prior run bound at schedule-set time | `(run_id_or_rule_id, resume_at)` — `B7_SCHEDULE_DELAY_MODEL.md` |
| `manual` | B7-internal | none | FB-D13 | the caller's workspace | the entity the caller supplies, or none | n/a — not idempotency-deduplicated the same way; `RunAutomationNow`'s own `Idempotency-Key` covers duplicate submission |

`TRIGGER_CATALOG_COUNT = 15` (13 event-backed + `scheduled` + `manual`).

## 3. Excluded candidates (evidence-checked, not silently assumed)

| Candidate | Why excluded from Phase 1 |
|---|---|
| `ConversationNeedsReply` / `ConversationClosed` / `MessageReceived` / `MessageDelivered` / `MessageFailed` | `B5_DOMAIN_OWNERSHIP.md` explicitly lists `AutomationRun` as **DEFERRED** and pre-declares no event consumer for Automation anywhere in `B5`'s catalog (contrast with B2's explicit per-event consumer naming) — evidenced in the frontend catalog (FB-D02) but not backed by any frozen B5 consumer declaration. `needs_reply` itself is a read-time computed flag (`B5_DOMAIN_OWNERSHIP.md` line 57), not an event, and cannot be a trigger type regardless |
| `DiscoveryJobCompleted` | No B3 event-consumer declaration names Automation; no frontend evidence |
| `BusinessIntelligenceCompleted` | `B4_COMMAND_EVENT_CATALOG.md` contains zero mentions of Automation as consumer or actor; no frontend evidence |
| `deal_reopened` / `deal_assigned` / `deal_updated` | B6 emits these (`DealReopened`, `DealAssigned`, `DealUpdated`), but `B6_B7_AUTOMATION_BOUNDARY.md` §2's explicit B7-legal-trigger table deliberately lists only four of B6's seven events; no frontend evidence supplements the other three. Deferred Class B, trivial future extension |
| `agent_action_executed` | Not a real event in any frozen catalog. `BACKEND_PUBLIC_ID_REGISTRY.md` §C resolves `AGA-*` as an alias for `AutomationRun` itself (FB-D24) — an "agent action executed" is not an external trigger, it is a re-entrant causation case, handled structurally in `B7_LOOP_PREVENTION.md`/`B7_REENTRANCY_POLICY.md`, not as a catalog trigger type |

## 4. Condition/action context available per trigger

Every event-backed trigger exposes exactly the fields its producing domain's frozen event schema names (§`B7_CONDITION_SNAPSHOT_SEMANTICS.md` §1 for the `event.*` namespace) plus, where a condition names `current.*`, a synchronous read of the live aggregate scoped to the same `entity_ref` and `workspace_id` — never a field outside the producing domain's own frozen event/DTO shape (this is what keeps the condition engine from traversing into secrets or provider payloads, §`B7_CONDITION_ENGINE.md` §6).

`CONSUMED_EVENT_COUNT = 13` (the 13 event-backed rows above; `scheduled` and `manual` consume no cross-domain event).
