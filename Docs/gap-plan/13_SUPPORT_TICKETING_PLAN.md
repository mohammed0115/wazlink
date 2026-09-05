# 13 — Support / Ticketing Plan

> **Status: `PD-014` APPROVED-as-deferred: SLA uses 24/7 elapsed-time semantics initially. Scheduled **after P0** (G4).**

> Resolves brief §20. **Minimum viable support. Explicitly not an ITSM platform.**

## 1. Scope

**In:** Ticket, ticket number, customer/contact link, status, priority, assignee, category, SLA policy, SLA clocks, resolution, activity timeline, creation from manual/WhatsApp/API/automation.

**Out (deliberately):** change management, problem management, CMDB, asset management, incident-to-problem linkage, multi-tier escalation trees, customer-facing portal (`GAP-027`, P2), CSAT surveys, ticket merging, parent/child tickets, time tracking, billing from tickets.

Vtiger's exact SLA mechanics were **not** verified (`E-19`, `NOT_VERIFIED`); the model below is derived from first principles and from WazLink's own frozen patterns, not copied.

## 2. `tickets`

`id` · `public_id` `TKT-*` (**registry amendment `CA-03`**) · `workspace_id` · `customer_id` (nullable — a ticket may precede customer identification) · `contact_id` (nullable) · `conversation_id` (nullable, the source) · `subject` · `description` · `status` · `priority` (`urgent|high|normal|low`) · `category` · `assigned_membership_id` (nullable) · `sla_policy_id` (nullable) · `first_response_at`, `resolved_at`, `closed_at` · `resolution_note` · `source_kind` (`manual|conversation|api|automation`) · `archived_at`, `version`, timestamps, `created_by_membership_id`.

**Lifecycle** `new → open → pending → resolved → closed`, with `resolved → reopened → open`. `pending` means *waiting on the customer* and is the state that pauses the resolution clock.

**Indexes** `(workspace_id, status, priority)`, `(workspace_id, assigned_membership_id)`, `(workspace_id, customer_id)`, `(workspace_id, sla_due_at) WHERE status NOT IN ('resolved','closed')`.

## 3. SLA

`sla_policies` — `name`, `priority`, `first_response_minutes`, `resolution_minutes`, `business_hours_only` (boolean), `active`.
`ticket_sla_clocks` — `ticket_id`, `clock_kind` (`first_response|resolution`), `started_at`, `paused_at`, `accumulated_paused_seconds`, `due_at`, `breached_at`, `satisfied_at`.

**Pause rule.** The resolution clock pauses in `pending` (waiting on the customer) and resumes on `open`. The first-response clock never pauses — it measures *our* latency and pausing it would let the metric lie.

**Breach detection** is a **scheduled sweep on B12's existing `maintenance` queue**, which is deliberately starvable so a breach backlog never displaces user-visible work (`FI-B12-10`). Breach emits `TicketSlaBreached` with idempotency identity `(ticket_id, policy_id, clock_id)` so a repeated sweep cannot re-emit. **Breach is a report, not an action** — it never auto-escalates, auto-reassigns, or auto-messages a customer.

**Business hours** are `PRODUCT DECISION REQUIRED` (`PD-014`) — no calendar, timezone or holiday policy is invented here. Until decided, `business_hours_only = false` and clocks run continuously, which is the only assumption that cannot silently under-report a breach.

## 4. Creation paths

| Path | Mechanism | Guard |
|---|---|---|
| Manual | `CreateTicket` from Tickets or Customer 360 | `ticket.create` |
| From conversation | `CreateTicket` with `conversation_id`, from the Team Inbox | `ticket.create` + `conversation.view` |
| API | same command | `ticket.create` |
| Automation | **new B7 action `create_ticket`, tier `auto_safe`** | It creates internal work and contacts nobody — the same reasoning that makes frozen `create_task` `auto_safe` |
| **AI agent** | **proposal only** | Human accepts; command runs as the human |

## 5. Boundaries

**Financial** — a Ticket is never a financial object. It writes no B8/B9/B10 table, has no amount, and never appears in a revenue selector. **Messaging** — support never writes `conversations` or `messages`; it links to them, exactly as `B6_B5_MESSAGING_BOUNDARY.md` establishes for Deals. **Files** — attachments are B11 `file_assets` with `subject_type='ticket'`. **Email** — deferred with `GAP-026`; tickets ship WhatsApp + manual first, which is the WhatsApp-first differentiation the brief protects.
