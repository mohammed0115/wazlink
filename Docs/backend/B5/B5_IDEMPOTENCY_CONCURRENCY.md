# B5 — Idempotency and Concurrency

> **B5 status:** Target design only. B5 does not claim exactly-once network delivery to Meta. It claims at-least-once transport, idempotent processing, and exactly-once durable business effect where achievable.

## 1. Idempotency layers

| # | Boundary | Key | Mechanism | Outcome on duplicate |
|---|---|---|---|---|
| 1 | Actor HTTP request (`SendMessage`/`SendTemplateMessage`/`CancelMessage`/`MarkConversationRead`/`AssignConversation`) | `Idempotency-Key` | frozen B0 standard (workspace + principal + endpoint + body hash) | stored response replayed, no second admission |
| 2 | Conversation identity | `(workspace_id, channel, lead_id, counterparty_phone_e164)` | `B5_CONVERSATION_MODEL.md` §3 | existing Conversation reused/reopened, never duplicated |
| 3 | Provider call → delivery result write | `(message_id, attempt_sequence)` unique | one `MessageDelivery` row per attempt; unique constraint absorbs a duplicated callback/retry write | second write is a no-op |
| 4 | Webhook receipt | `(provider, provider_event_id)` | generic `Webhooks` domain's own dedup (`B5_WEBHOOK_SECURITY_MODEL.md` §5) | duplicate delivery is a no-op at receipt |
| 5 | Status application | `(message_id, status_value, provider_timestamp)` monotonicity | `B5_MESSAGE_STATE_MACHINE.md` §4 | a duplicate or regressive status changes nothing on `Message` |

## 2. `SendMessage`/`SendTemplateMessage` — same request ID

> **`B5-D-A022`: `Idempotency-Key` is required on `SendMessage`, `SendTemplateMessage`, and `CancelMessage`. A replayed request under the identical key returns the stored response and consumes no second admission slot.**

A request replayed under the identical `Idempotency-Key` always returns the identical stored `202` response, regardless of what has happened to the Message since (even if it has since reached `delivered`, `read`, or `failed`) — idempotency replay is a transport guarantee, not a "give me current status" query. An actor wanting current status calls `GET /conversations/{id}/messages` or `GET /messages/{id}` (`B5_API_DTO_CONTRACTS.md` §2).

## 3. Concurrent requests for the same recipient

Two actors send outbound to the same Conversation at the same moment, or two inbound webhooks arrive concurrently for the same counterparty:

| Case | Outcome |
|---|---|
| Two agents send outbound simultaneously, same Conversation | both admitted as **distinct** Messages — this is not a race to prevent. Two human agents each sending a message is two legitimate sends, not a duplicate of one intent. `client_request_id` distinguishes them; neither is coalesced |
| Same `Idempotency-Key`, concurrent replay (double-click) | layer 1 — one admitted, one replayed |
| Two inbound webhooks for the same Conversation, concurrent, different messages | both admitted as distinct Messages, ordered by `created_at` (provider timestamp) at display time — not a race, two real inbound turns |
| Two inbound webhooks that are the **same** provider event (redelivery) | layer 4 — one Message |
| Conversation creation race — two concurrent first-contacts (one inbound webhook, one outbound send-then-create) resolve to the same `(workspace, channel, lead, phone)` key simultaneously | layer 2's uniqueness constraint admits exactly one Conversation row; the second writer's insert fails uniqueness and re-reads/reuses the just-created row instead — never two Conversations, never a crash surfaced to the caller |
| Contact-linking race (an inbound message resolves `unknown_contact` at the same moment B2 links that phone to a Contact) | the Message already admitted keeps `sender_type=unknown_contact` (immutable per `B5-D-A004`) — it is **not** retroactively relinked. The **next** inbound message from that phone resolves as `contact` normally. History is not rewritten |
| Archive (close) races an incoming message | `B5_CONVERSATION_MODEL.md` §4 — an inbound message arriving for a `closed` Conversation reopens it as part of the same admission transaction; there is no window where the message is silently dropped because the Conversation happened to be closing at that instant, because the reopen and the Message insert are the same transaction |
| Mark-read races a new inbound message | `MarkConversationRead` marks messages `received` **at the time its own read query executes** inside its transaction; a message that becomes visible after that instant is unaffected and remains unread — never a lost-update on the newer message, because mark-read only ever moves `received → read`, an idempotent one-directional operation with no window to corrupt a concurrently-inserted row it never selected |
| Assignment race (two operators reassign concurrently) | last-write-wins on `assigned_to`, both writes logged as distinct activity entries (`B5_CRM_TIMELINE_PROJECTION.md`) — assignment is a simple current-value field, not a state machine requiring conflict detection; a lost intermediate assignment is a UX question (refresh and see the latest), not a correctness defect, because no financial or irreversible effect depends on which assignment wins |

## 4. Ambiguous provider timeout — never resubmitted blindly

Full detail is `B5_OUTBOUND_PIPELINE.md` §4. The idempotency argument, stated here precisely: an automatic retry after a timeout (within budget) reuses the **same** `Message` and, where the adapter supports one, a stable client-side dedup token passed to Meta — so even if the original request *did* land, a well-behaved provider treats the retry as the same logical send. Where the provider's own dedup behavior is unconfirmed (`B5-X-015`), WazLink's own conservative posture — never resubmit past the automatic-retry budget without reconciliation — is what prevents a double-send regardless of what Meta itself would have done.

## 5. Worker retry and re-read

Per frozen B0's `BACKEND_RETRY_POLICY.md` closing instruction ("retrying a domain command must re-read state and re-check idempotency; it must not replay an irreversible side effect blindly"): a worker resuming a `submitted` Message after a lease expiry **re-reads** `MessageDelivery` history first — if a `provider_message_id` was already captured by a prior attempt (crash occurred after the provider responded but before commit), the worker does not re-call the provider; it persists the already-known result and proceeds to `sent`. Only the absence of any captured provider response triggers a genuine retry attempt.
