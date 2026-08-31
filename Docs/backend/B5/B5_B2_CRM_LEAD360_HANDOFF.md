# B5 — B2 CRM / Lead 360 Handoff

> **B5 status:** Target design only. B5 does not modify B2 ownership. `B2_DRIFT = 0`.

## 1. What B2 consumes from B5

Lead 360's conversation list (FB-24/FB-25, read-only per `LeadConversationControls`) is populated by exactly one class of read, no caching, no denormalization into any `leads` column:

```
GET /leads/{lead_id}/conversations   (B5-owned, B5_API_DTO_CONTRACTS.md §1.6)
```

| Field | Source |
|---|---|
| `conversation_id`, `channel`, `status`, `last_message_at`, `unread_count`, `needs_reply` | current `Conversation` row + `B5_CONVERSATION_MODEL.md` §7's computed fields |
| latest message preview | most recent `Message.body`/content-type label on that Conversation |

**Not** exposed to B2 by this list: full message history, media, template internals, or provider metadata — those are B5-internal/operator surfaces or require the dedicated `GET /conversations/{id}/messages` call a Lead 360 UI may make directly (`B5_API_DTO_CONTRACTS.md` §1.2), exactly as `B4_B2_CRM_LEAD360_BOUNDARY.md` §1 draws the identical line for Intelligence history.

## 2. B2 ownership is untouched

No B5 command writes `leads`, `contacts`, `tasks`, `appointments`, or any other B2 table. No B5 table is read by a B2 domain-code path via ORM join — B2's `Lead360` composition reads B5 only through the HTTP-shaped summary/list endpoints above, exactly as it reads B4's Intelligence summary and B3's Business through their own contracts.

## 3. Conversion behavior

`ConvertBusinessToLead` (B2's frozen conversion command) has no B5 interaction at all in Phase 1 — there is no pre-conversion Messaging surface for B5 to touch (`B5-D-A002`), so unlike B4's explicit "conversion triggers no analysis" statement, B5's equivalent statement is simpler: **a Business becoming a Lead is the event that first makes Messaging *possible* for it**, not an event B5 reacts to. No B5 command fires as a side effect of conversion.

## 4. Lead archived, Conversation remains

An archived Lead's Conversations remain queryable via `GET /conversations/{id}` and `GET /leads/{id}/conversations` unless B2's own archived-Lead read rules restrict access to the Lead's detail view — that restriction, if any, is B2's to define and enforce; B5 imposes none of its own, mirroring `B4_B2_CRM_LEAD360_BOUNDARY.md` §5's identical posture.

## 5. Lead deleted (if ever possible)

B2's frozen model does not hard-delete Leads (mirrors B3's Business non-deletion posture). If a future phase introduces Lead deletion, `Conversation.lead_id`'s `ON DELETE RESTRICT` FK behavior (`B5_DATA_MODEL.md` §2) makes deleting a Lead with an existing Conversation a referential-integrity error, not a silent orphaning — this is deliberately conservative and is recorded as a forward consideration (`B5-D-C005`) rather than designed further, since B2 does not currently expose a delete path to design against.

## 6. No duplicated message truth in CRM

Because `Conversation`/`Message` are B5's sole truth (`B5_DOMAIN_OWNERSHIP.md`), "does Lead 360 create a second copy of message content" is not a race to prevent — it is structurally impossible, since no B2 code path writes a `messages`-shaped row. `B5_CRM_TIMELINE_PROJECTION.md` governs how B2's *timeline* (a different concern from Lead 360's conversation-list widget) represents B5 events without copying their content.
