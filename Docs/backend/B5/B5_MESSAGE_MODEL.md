# B5 — Message Model

> **B5 status:** Target design only. A Message is authored/received content plus a stable identity; its provider transport lifecycle is a separate, append-only concern (`B5_MESSAGE_STATE_MACHINE.md`).

## 1. Business truth vs. transport state — the hard separation

> **`B5-D-A005`: `Message` holds authored content and direction — what was said and by whom. `MessageDelivery` holds provider transport facts — what the network did with it. Neither is derivable from the other, and neither is optional.**

This mirrors B4's deterministic/AI-boundary discipline one layer over: a `Message`'s content is fixed the moment it is authored (outbound) or received (inbound); everything that happens to it afterward — retries, provider status callbacks, corrections — is `MessageDelivery` history, appended, never rewriting the Message.

## 2. Message fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK |
| `public_id` | `MSG-*` | immutable, frozen registry Section A, workspace-scoped |
| `workspace_id` | UUID FK | required |
| `conversation_id` | `CONV-*` FK | required |
| `direction` | enum(2) | `inbound` \| `outbound` |
| `sender_type` | enum | `user` (workspace member) \| `contact` (resolved counterparty) \| `unknown_contact` (unresolved inbound, FB-06/§`B5_CONTACT_PHONE_RESOLUTION.md`) \| `system` (reserved for a future governed-automation sender, `B5_B6_B7_BOUNDARIES.md` §3) |
| `sender_ref` | `MEM-*` \| `CON-*` \| null | resolves per `sender_type`; null only for `unknown_contact` |
| `content_type` | enum(9) | `B5_MESSAGE_CONTENT_MODEL.md` §1 |
| `body` | text, nullable | present for `text` and as a caption/label for media/template types; never required if `content_type` supplies its own payload |
| `template_snapshot` | JSONB, nullable | present only when `content_type = template` — `MessageTemplateSnapshot` embedded (`B5_TEMPLATE_MODEL.md` §4) |
| `media` | JSONB array, nullable | embedded `[MessageMedia]` references (`B5_MEDIA_B11_HANDOFF.md` §2) |
| `reply_to_message_id` | `MSG-*` FK, nullable | quoted/referenced message, same Conversation only |
| `assistance` | JSONB, nullable | `{assisted_by: "copilot", suggestion_id}` — audit tag for AI-drafted-then-human-sent content (FB-31, `B5_B4_HANDOFF_CONTRACT.md` §3) |
| `client_request_id` | text, nullable | the actor's own idempotency correlation, distinct from the transport `Idempotency-Key` (`B5_IDEMPOTENCY_CONCURRENCY.md` §1) |
| `status` | enum | current status, direction-scoped (`B5_MESSAGE_STATE_MACHINE.md`) — a **projection** of the latest `MessageDelivery` row, kept in sync transactionally, never independently writable |
| `created_at` | timestamptz | authored/received instant — immutable |
| `status_updated_at` | timestamptz | last transition instant |
| `requested_by_ref` | `MEM-*`, nullable | the actor who requested an **outbound** send; null for inbound |

**Constraints:** unique `(workspace_id, conversation_id, created_at, public_id)` supports stable ordering (`B5-D-A030`); `reply_to_message_id` FK restricted to the same `conversation_id`.

## 3. Content immutability after admission

> **`B5-D-A004`: once a Message is admitted — `queued` for outbound, or persisted for inbound — its `body`, `content_type`, `template_snapshot`, `media`, and `reply_to_message_id` are immutable. Only `status`, `status_updated_at`, and the append-only `MessageDelivery` history change thereafter.**

Retry (`B5-D-A005`'s companion, `B5_RATE_COST_RETRY_MODEL.md` §4) re-submits the **same** Message row through the provider again (FB-08) — it does not create a new one and does not edit the failed content. This matches the frozen frontend's own explicit rule (`retryMockMessage`, `data.js:541`) exactly.

## 4. Reply/quote context

`reply_to_message_id` is a WazLink-internal reference for UI/thread display. It is distinct from Meta's own `context.id` (a provider-side reply reference carried on the outbound send and echoed on inbound webhooks) — the provider reference is normalized into `MessageDelivery.provider_context_id` (`B5_MESSAGE_STATE_MACHINE.md` §2), and the two are reconciled where both are present but neither is required to populate the other.

## 5. Failure representation

`failure_code` lives on `MessageDelivery`, not `Message` (§1). It is a closed-set enum (`B5_RATE_COST_RETRY_MODEL.md` §3), never the free-text `failureReason` string the frozen fixture uses (FB-21) — a human-facing explanation is derived from the code at the presentation layer, exactly as `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §3 keeps a `failed` run's `failure_code` closed-set and never a raw provider message.

## 6. Attachments

`media[]` embeds `MessageMedia` references (`B5_MEDIA_B11_HANDOFF.md` §2) — WazLink never treats the media *bytes* as part of `Message`'s own row; only metadata and a resolvable reference are embedded. This mirrors B4's `Evidence` embedding discipline (store the normalized reference, not the payload).

## 7. What a Message is not

| Not | Why |
|---|---|
| a CRM timeline row | B2 projects it via `source_event_id`; B5 never writes `crm_activities` (`B5_CRM_TIMELINE_PROJECTION.md`) |
| a billing/usage record | `MessagingUsageRecord` is a separate entity for technical telemetry only (`B5_RATE_COST_RETRY_MODEL.md` §7) |
| authoritative Contact/Lead data | `sender_ref`/`Conversation.contact_id` are references, never a second Contact store (`B5_CONTACT_PHONE_RESOLUTION.md`) |
| a Deal/Revenue signal | no field on `Message` is read by any B5 code path as implying a commercial outcome (`B5-D-A033`) |
