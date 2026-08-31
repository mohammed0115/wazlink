# B5 — CRM Timeline Projection Contract

> **B5 status:** Target design only. Satisfies frozen `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1's cross-domain source contract exactly — B5 exposes a stable `source_event_id`; B2 does all of the merging, ordering, and deduplication. B5 specifies no timeline table, no projection job, and no CRM-side code.

## 1. The frozen obligation, restated precisely

`B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1 requires, of any eligible cross-domain source: a stable, replay-safe `source_event_id` identifying one logical business event, readable from the source domain's own record at query time, that is **not** the aggregate's public ID, **not** a version number, and **not** a row position. `B2_NOTE_ACTIVITY_TIMELINE.md` §3 additionally requires `source_domain="messaging"` reads to check `conversation.view` before inclusion, and forbids B5 from ever writing `crm_activities` directly.

> **`B5-D-A023`: B5 satisfies this by exposing `source_event_id = <B5 domain event's own immutable event ID>` on every eligible Message-related record, and by never writing `crm_activities`.**

## 2. Which B5 facts are timeline-eligible

Not every state change is worth a timeline row (mirrors `B4_COMMAND_EVENT_CATALOG.md` §3's "queued/running transitions are not published as domain events" discipline — a consumer cares about outcomes, not every intermediate tick):

| B5 fact | Timeline-eligible? | `source_event_type` |
|---|---|---|
| Inbound message received | **yes** | `message_inbound` (name pre-anticipated by `B2_NOTE_ACTIVITY_TIMELINE.md` §2.3's own example) |
| Outbound message accepted (reaches `sent`) | **yes** | `message_outbound` |
| Delivery confirmation (`delivered`) | **no** | — pure transport telemetry, not a business event worth a Lead-facing history row |
| Read receipt (`read`) | **no** | — same reasoning |
| Send failure (terminal `failed`) | **yes** | `message_failed` — a human needs to know a send did not go through |
| Conversation assigned | **yes** | `conversation_assigned` |
| Conversation closed/reopened | **yes** | `conversation_closed` / `conversation_reopened` |
| Message retry | **no** | the retry is not a new logical event — it is a continuation of the *original* `message_outbound` attempt's own story; a later `message_failed`/successful `sent` on the same Message is what matters, not the retry itself |

This directly answers the brief's §22 question — *"do not flood CRM timeline with every provider callback unless product semantics require it"* — with a deliberate, checked list rather than an implicit "everything" default.

## 3. `source_event_id` — how it stays stable and replay-safe

Every B5 domain event (`B5_COMMAND_EVENT_CATALOG.md` §3) already carries an immutable `event_id` per the frozen B0 event envelope. For timeline-eligible facts, `source_event_id = event_id` of the underlying `InboundMessageReceived` / `OutboundMessageAccepted` / `MessageFailed` / `ConversationAssigned` / `ConversationClosed` / `ConversationReopened` event. This value is:

- **stable across replay/redelivery** — the same underlying B5 event, re-read, yields the same `event_id`, satisfying B2's dedup requirement without any B5-side dedup bookkeeping of its own;
- **distinct per logical event** — a Conversation with three inbound messages and one failed send produces four distinct `source_event_id`s, never four projections of the same `CONV-*`;
- **never the aggregate's public ID** — `CONV-*`/`MSG-*` appear only in `source_resource_ref` (§4), exactly as B2's contract requires.

## 4. What the read model exposes, per B2's `TimelineEntry` field list

| B2 `TimelineEntry` field | B5's value |
|---|---|
| `source_domain` | `messaging` |
| `source_event_type` | per §2's table |
| `source_resource_ref` | the `MSG-*` (message events) or `CONV-*` (conversation events) the entry is about |
| `source_event_id` | per §3 |
| `occurred_at` | the **business event instant** — for `message_inbound`/`message_outbound`, the Message's own `created_at`; for `message_failed`, the instant the terminal `failed` transition committed; **never** a mutable field like `status_updated_at` for a non-terminal state, mirroring `B2_TIMELINE_IDENTITY_MODEL.md` §2.4's exact prohibition |
| `recorded_at` | the B5 event's own durable-write instant |
| `actor` | `EntityRef` to `MEM-*` for outbound/human-caused events; a system label for inbound (no human actor caused a customer's message to arrive) |
| `summary` | a safe, template-generated string (§5) — **never** `Message.body` |
| `change` | absent for these event types (no before/after value applies) |
| `target_ref` | `EntityRef` to the `CONV-*` or `MSG-*` |
| `route_hint` | `inbox/{conversation_public_id}` — matching `B2_NOTE_ACTIVITY_TIMELINE.md` §3.1's own example verbatim |

## 5. The PII rule — enforced at the source

`B2_NOTE_ACTIVITY_TIMELINE.md` §3.1 requires: *"a timeline entry never carries message body text... contact phone, or contact email."* B5's `summary` template for each `source_event_type` is fixed and safe by construction:

| `source_event_type` | `summary` template |
|---|---|
| `message_inbound` | `"رسالة واردة جديدة"` (a new inbound message arrived) — no body content |
| `message_outbound` | `"أُرسلت رسالة"` (a message was sent) |
| `message_failed` | `"تعذر إرسال رسالة"` (a message failed to send) |
| `conversation_assigned` | `"أُسندت المحادثة إلى {owner_display_name}"` — a display name, never a phone/email |
| `conversation_closed` / `conversation_reopened` | fixed template, no variable content |

No template interpolates `Message.body`, `counterparty_phone_e164`, or any Contact email/phone field. A reader who wants the actual message content follows `route_hint` into the Inbox, where `conversation.view` authorization applies independently (§6) — the timeline itself never becomes a PII-exfiltration path for a viewer who can read the Lead timeline but not the underlying conversation.

## 6. Authorization at the merge

Per `B2_NOTE_ACTIVITY_TIMELINE.md` §3.2: `source_domain="messaging"` entries require the caller to hold `conversation.view` (`B5_ENTITLEMENT_RBAC_TENANCY.md` §1). This is B2's check, executed at read time, using B5's frozen permission name — B5 does not need to expose any special "is this caller allowed" endpoint for it; the caller's own permission grant (checked identically to any B5-native read) is what B2 evaluates.

## 7. What B5 does not build

No `crm_activities` write, no timeline projection table, no CRM-facing dedup store. Every guarantee in this document is a **read-model exposure contract** on B5's own domain event records — the entire mechanism (merge, order, cursor, dedup, clock-skew eligibility) lives in `B2_TIMELINE_IDENTITY_MODEL.md` §7.2 and is not re-specified here.
