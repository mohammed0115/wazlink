# B5 — Conversation Model

> **B5 status:** Target design only. A Conversation is a durable exchange identity, never a second Lead or Contact truth store.

## 1. What a Conversation is

> One durable, continuable exchange between the workspace and one counterparty, on one channel, scoped to one Lead.

`Conversation` is the aggregate root (`B5_DOMAIN_OWNERSHIP.md` §1). It owns its own lifecycle (`open`/`closed`), its assignment, and its derived read state (unread, needs-reply). It owns none of the Lead's own CRM state.

## 2. Ownership and identity fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK |
| `public_id` | `CONV-*` | immutable, frozen registry Section A, workspace-scoped uniqueness |
| `workspace_id` | UUID FK | required |
| `lead_id` | `LEAD-*` FK | **required, immutable after creation** (`B5-D-A002`) |
| `contact_id` | `CON-*` FK, nullable | the resolved B2 Contact, if any (FB-03: legitimately null) |
| `channel` | enum | `whatsapp` in Phase 1; the field exists for future channels, not multi-channel scope creep now |
| `counterparty_phone_e164` | text | the WhatsApp identity this Conversation talks to; normalized (`B5_CONTACT_PHONE_RESOLUTION.md` §1) |
| `channel_binding_id` | FK → `ChannelBinding` | which workspace WhatsApp number this Conversation belongs to |
| `status` | enum(2) | `open` \| `closed` (FB-01) |
| `assigned_to` | `MEM-*` FK, nullable | the single current conversation owner, independent of the Lead's own owner (FB-18) |
| `created_at`, `updated_at` | timestamptz | |

## 3. Conversation identity — resolving the frontend's own inconsistency

> **`B5-D-A002`: `Conversation.lead_id` is required and immutable. There is no Conversation without a Lead.**

The frozen frontend already keys every Conversation on `leadId` (FB-02) and every Lead360 read on `getLeadConversations(leadId)` (FB-25). B2's own frozen cross-domain contract independently requires this: *"a Messaging record through the Conversation linked to the Lead"* (`B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1, `B2_NOTE_ACTIVITY_TIMELINE.md` §3). Unlike B4 (where analysis had to work pre-Lead), Messaging is a **post-conversion** capability by product design — there is no frontend affordance to message a Business before it becomes a Lead, and B0's own domain-ownership row lists `Inbox, Lead360` as Messaging's readers, not Discovery.

> **`B5-D-A003`: exactly one *reusable* Conversation identity per `(workspace_id, channel, lead_id, counterparty_phone_e164)`. A new inbound or outbound turn against an existing identity continues that Conversation (or reopens it if closed); it never forks a second `CONV-*`.**

This resolves FB-26 (`CONV-3042`/`CONV-3045`, an observed frontend fixture inconsistency) explicitly rather than silently copying it forward. The deciding evidence, stated plainly:

1. `reopenConversation` exists as a first-class command (FB-11). A "reopen the same thread" operation is meaningless in a world where a new inbound message could instead just start a second thread — its existence is direct evidence the intended model is continuation, not forking.
2. Real WhatsApp has no server-side concept of "conversation" at all — Meta's Cloud API is a flat message stream keyed on a phone-number pair, with a rolling customer-service window (`B5_CUSTOMER_SERVICE_WINDOW.md`). "Conversation" grouping is entirely WazLink's own CRM construct; nothing about the transport forces — or benefits from — multiple concurrent threads for the same pair.
3. No UI affordance anywhere ("start a new conversation", "split thread") exists to deliberately create a second Conversation for an already-linked Lead+contact+channel.

**Enforcement:** a partial-unique constraint on `(workspace_id, channel, lead_id, counterparty_phone_e164)` restricted to non-terminal rows is insufficient by itself, because `closed` conversations must remain resolvable for reopen. The rule is therefore applied at the **admission** step, not the schema alone: before creating a new `Conversation`, the inbound/outbound admission path (`B5_INBOUND_PIPELINE.md` §3, `B5_OUTBOUND_PIPELINE.md` §2) looks up an existing row for the same key; if found, it is reused (reopened if `closed`), never duplicated. The schema constraint (`UNIQUE (workspace_id, channel, lead_id, counterparty_phone_e164)`, unconditional — one row total, not one row per open state) backs this as a hard invariant, not merely an admission-time convention.

**What this changes about the two-row fixture, stated plainly:** `CONV-3042` and `CONV-3045` as observed cannot both exist under this rule if their `(lead_id, contact_id, channel)` truly coincide. This is a `COMPATIBLE_REFINEMENT` of an unenforced fixture pattern, not an amendment to any frozen backend contract — no B0–B4 document asserts multiplicity is required, and B2's own contract (`B2_TIMELINE_IDENTITY_MODEL.md`) is satisfied equally by one Conversation or many.

## 4. Reopen semantics

| Trigger | Effect |
|---|---|
| A new **inbound** message arrives for a `closed` Conversation's `(workspace, channel, lead, counterparty_phone)` | the Conversation transitions `closed → open` as part of the same admission that creates the Message (`B5_INBOUND_PIPELINE.md` §5); `reopenConversation`-equivalent activity is logged |
| An actor explicitly reopens a `closed` Conversation with no new message | `status → open`, no Message created, activity logged (FB-11's frozen behavior, unchanged) |
| An actor attempts to send **outbound** on a `closed` Conversation without reopening first | rejected — `409 CONFLICT`, `conversation_not_open` (FB-09, mirrors the frozen composer-disabled rule server-side) |

Reopen never mints a new `CONV-*`. History (all prior messages) remains attached to the same identity.

## 5. Close semantics

`B5-D-A029`'s companion rule, stated here for completeness: closing is rejected while `unread_count(conversation) > 0` (FB-10), returning a distinguishable `409 CONFLICT`, `reason=unread_messages_present` — never a generic failure. This is unchanged from the frozen frontend rule; B5 only gives it a server-side enforcement point.

## 6. Assignment

`assigned_to` is a Conversation-level property, independent of `Lead.owner_id` (FB-18). Reassigning to the current owner is a no-op — no state change, no activity entry (FB-19), preventing accidental activity-log noise from a redundant UI action.

## 7. Unread and needs-reply — computed, not cached

Both are **read-time computations**, never a maintained integer column subject to drift:

```
unread_count(conversation) = COUNT(messages WHERE conversation_id = :id
                                     AND direction = 'inbound' AND status != 'read')

needs_reply(conversation)  = conversation.status = 'open'
                              AND latest_message(conversation).direction = 'inbound'
```

This differs from the frozen frontend's own implementation (`syncConversationDerived` maintains a cached `unreadCount` field, re-synced after each mutation, `data.js:534`) — a legitimate simplification acceptable in a single-process mock, but a drift risk in a real system with concurrent writers and webhook-driven updates. `B5_ACCEPTANCE_TESTS.md` AT-CONV-8 is the negative control for a stored, driftable counter. The API response still returns `unread_count` and `needs_reply` as ordinary fields (`B5_API_DTO_CONTRACTS.md` §3) — only their *implementation* differs from the fixture, not their shape.

## 8. Search and filtering

Matches FB-16/FB-17 exactly as the target contract:

| Facet | Field(s) searched/filtered |
|---|---|
| Free text | `contact.name`, `contact.phone` (normalized), `lead.public_id`, `conversation.public_id`, resolved `business.name` |
| Status | `all` \| `unread` (`unread_count > 0`) \| `needs_reply` \| `open` \| `closed` |
| Owner | `assigned_to` |
| Channel | `channel` |
| Sort | `latest` (default, `last_message_at DESC`) \| `unread` (`unread_count DESC, last_message_at DESC`) \| `oldest_waiting` (`needs_reply` rows first, `last_message_at ASC`) |

Full search-index design (`B5_MESSAGE_CONTENT_MODEL` interaction, PostgreSQL FTS vs. a future dedicated index) is `B5_RECONCILIATION_OBSERVABILITY.md` §6 / a Class B tuning concern — the *facets* above are Class A; the *indexing mechanism* is not.

## 9. Labels/tags

Not present anywhere in the frozen frontend's Conversation shape or filters. **Not adopted** (`B5-D-C001`, `B5_DECISION_REGISTER.md` §4) — inventing a tagging model with no frontend evidence and no stated product need would be exactly the "gratuitous drift" B3/B4 both refused. If a future phase needs it, it is purely additive.
