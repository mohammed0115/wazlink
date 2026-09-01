# B7 — Action Catalog

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Closed catalog, mapped to governed commands only — resolved (Class A, `B7-D-A016`)

Every action maps to exactly one governed domain command, invoked through that domain's unmodified admission sequence (`B6-D-A026`, `B5-D-A025`, B2's "Automation as actor" note). No action writes a table directly. Each candidate from the task brief's §15 list and the frontend's `automationActionCatalog` (FB-D05) is adjudicated individually below — none accepted blindly.

## 2. Included — Phase 1

| Action | Target domain | Target command | Required params | Safety tier | Idempotency derivation | Expected-version strategy |
|---|---|---|---|---|---|---|
| `create_task` | B2 | `CreateTask` | `lead_ref`, `title`, `due_at`\|`duration`, `priority` | `auto_safe` (evidenced) | `B7_IDEMPOTENCY_MODEL.md` §2 | none — `CreateTask` has no `expected_version` (insert-only command) |
| `create_followup_task` | B2 | `CreateTask` (same command, distinct action *definition* with a follow-up-shaped default payload) | same as above | `auto_safe` (evidenced) | same | none |
| `schedule_appointment` | B2 | `ScheduleAppointment` | `lead_ref`, `starts_at`, `ends_at`, `type`, `location_type` | `approval_required` (evidenced as `create_appointment`) | same | none |
| `change_lead_priority` | B2 | `ChangeLeadPriority` | `lead_ref`, `priority` | `approval_required` (evidenced as `update_lead_priority`) | same | `If-Match` on `Lead.version`, captured at approval time (§`B7_CONCURRENCY_MODEL.md` §5) |
| `change_lead_status` | B2 | `ChangeLeadStatus` | `lead_ref`, `status` | `approval_required` (evidenced as `update_lead_status`) | same | `If-Match` on `Lead.version` |
| `assign_lead_owner` | B2 | `AssignLeadOwner` | `lead_ref`, `owner_ref` | `approval_required` (evidenced as `assign_lead`) | same | `If-Match` on `Lead.version` |
| `escalate_to_manager` | B2 | `CreateTask` (specialized: fixed `priority='high'`, assignee resolved to a workspace manager-rank member, task type `escalation`) | `lead_ref`, `reason` | `approval_required` (evidenced as `escalate_to_human`) | same | none |
| `move_deal_stage` | B6 | `MoveDealStage` | `deal_ref`, `to_stage_ref` | `approval_required` (§3 — Class A decision, not evidenced directly but reserved by schema, `B6_DATA_MODEL.md` §4) | same | `If-Match` on `Deal.version`, captured at approval time |
| `send_message` | B5 | `SendMessage` / `SendTemplateMessage` | `conversation_ref`\|`lead_ref`, `template_ref`\|`body` | `approval_required` — **mandatory, never `auto_safe`, not configurable per-rule** (§3) | same | none (B5's own service-window/consent guard is the concurrency-relevant check, not a version field) |
| `wait` | B7-internal | none (control action) | `duration` | n/a — never gated by approval, has no side effect | n/a | n/a |
| `stop_execution` | B7-internal | none (control action) | none | n/a | n/a | n/a |

`ACTION_CATALOG_COUNT = 10` distinct action types (`create_task`/`create_followup_task` share one target command but are two catalog entries, matching evidenced UI distinctness).

## 3. The two Class-A inclusions requiring explicit justification

**`move_deal_stage`:** not in the frontend's evidenced `automationActionCatalog` (FB-D05) and not in `forbiddenAutomationActions` either — genuinely silent. Included because `B6_DATA_MODEL.md` §4 reserves `deal_stage_transitions.actor_membership_id = NULL` with `reason_source='automation'` **specifically** for this action (a schema-level reserved hook, stronger evidence than a UI omission), and `B6_B7_AUTOMATION_BOUNDARY.md` §2 explicitly lists `DealStageChanged` as a legal trigger *and* names "governed commands, to request a Deal mutation" as something B7 may do, citing the frontend's own seeded rule (FB-D38 in B6's inventory) requiring mandatory approval before any Deal-stage-touching execution. **All other B6 Deal commands are excluded** (§4) — this is not "automation may mutate deals," it is "automation may move a deal's stage, under mandatory approval, because B6 built exactly that hook and nothing wider."

**`send_message`:** `forbiddenAutomationActions` names `send_message`/`send_whatsapp` explicitly (FB-D06) — the strongest-looking exclusion signal in this entire document. It is included anyway because two independent frozen documents describe the *opposite* intent for the real backend: `B5_MESSAGE_MODEL.md` §2 reserves `senderType='system'` specifically for this, and `B5_MESSAGE_STATE_MACHINE.md` names "B7's future governed-automation sends" by name when justifying its own `cancelled` state design. `B5-D-A025` states plainly that a future automation-triggered send must exist and must go through the identical `SendMessage`/`SendTemplateMessage` admission sequence. The frontend's forbidden-list reflects the **mock's** conservative demo posture (explicitly self-described as a non-sending, non-scheduling simulation, FB-D23) — not a product decision that the real backend must forever exclude sending. B7 resolves the tension by **including** the action but making its safety tier **non-configurable `approval_required`**: nothing the frontend's forbidden list protected against (an automation autonomously sending a WhatsApp message with no human in the loop) becomes possible — a human must approve every single automation-initiated send, every time, with no `auto_safe` override available to a rule author.

## 4. Excluded — with rationale

| Excluded action | Rationale |
|---|---|
| `close_won_deal`, `close_lost_deal` | Explicitly forbidden by name (FB-D06); highest-blast-radius, most revenue-adjacent Deal transition — kept excluded even though `move_deal_stage` is included, precisely because Won/Lost is the boundary `B7_REVENUE_FIREWALL.md` cares about most |
| `change_deal_value`, `change_deal_probability` | Explicitly forbidden by name (FB-D06) |
| `create_deal`, `assign_deal`, `reopen_deal` | No frontend evidence, no schema-reserved hook (unlike `move_deal_stage`'s `deal_stage_transitions` slot) — deferred Class B; trivial future extension via the identical `MoveDealStage` pattern once product evidence justifies it |
| `create_revenue`, `create_attribution` | Explicitly forbidden by name (FB-D06); structurally impossible regardless — no B7-reachable command produces a `RevenueEvent`/`AttributionTouchpoint` (`B7_REVENUE_FIREWALL.md`) |
| `delete_lead` | Explicitly forbidden by name (FB-D06); B2's own frozen command catalog has no Lead hard-delete command for any actor to invoke in the first place |
| `request_intelligence_analysis` | Task brief §15 conditions this on "B4 exposes a governed command suitable for automation" — `B4_COMMAND_EVENT_CATALOG.md` names no actor-invocable command and zero automation references anywhere; condition not met |
| `notify_in_app_mock` | Self-labeled "— تجريبي" (experimental) in its own frontend catalog entry; Class C non-evidence (`B7_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D05 disposition) |

## 5. `wait` / `stop_execution`

Not commands against another domain — pure B7-internal control flow over the run's own action sequence. `wait` is elaborated in `B7_SCHEDULE_DELAY_MODEL.md` §2 (durable, never a held worker). `stop_execution` transitions the run to `succeeded` immediately, skipping remaining actions without marking them `failed` (a deliberate early-exit, distinct from a failure — `B7_PARTIAL_SUCCESS.md` §3).
