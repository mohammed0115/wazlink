# B5 — Command and Event Catalog

> **B5 status:** Target design only. Preserves the frozen B0 event envelope verbatim (§4). Reuses frozen commands/events where they already fit.

## 1. Frozen commands/events — resolution, stated plainly

| Frozen artifact | Frozen state | B5 target | Classification |
|---|---|---|---|
| `SendMessage` (command, `BACKEND_COMMAND_EVENT_CATALOG.md`) | generic, unspecified shape | retained, fully specified as §2's primary outbound command | `COMPATIBLE_REFINEMENT` |
| `ReceiveMessage` (command, `BACKEND_COMMAND_EVENT_CATALOG.md`) | generic, unspecified shape | retained, specified as the internal command the inbound pipeline issues after webhook verification (`B5_INBOUND_PIPELINE.md`) — **not** actor-facing API surface | `COMPATIBLE_REFINEMENT` |
| `MessageSent` (event) | generic | retained; fires on the transition to `sent` (`B5_MESSAGE_STATE_MACHINE.md` §2 transition 3) | `COMPATIBLE_REFINEMENT` |
| `MessageReceived` (event) | generic | retained; fires on inbound admission | `COMPATIBLE_REFINEMENT` |
| `MessageDelivered` (event, `BACKEND_DATA_MODEL.md`'s Messaging table-group row names `deliveries` alongside these events) | generic | retained; fires on the transition to `delivered` | `COMPATIBLE_REFINEMENT` |
| `MessageFailed` (event) | generic | retained; fires on the transition to terminal `failed` | `COMPATIBLE_REFINEMENT` |

No frozen command or event name is superseded or renamed — unlike B4's `AnalyzeLead`/`LeadIntelligenceCompleted` situation, B0's Messaging row was already written with no Lead-vs-Business ambiguity to resolve, so B5 has no non-additive amendment to make here. All four frozen names are honored literally.

## 2. Commands

| Command | Actor/system | Target | Idempotency | Precondition | Effect |
|---|---|---|---|---|---|
| `SendMessage` **(frozen, specified)** | actor | `[CONV-*]` | `Idempotency-Key` required | `B5_OUTBOUND_PIPELINE.md` §2 admission sequence | admits one `Message`, `queued` |
| `SendTemplateMessage` **(additive)** | actor | `[CONV-*]` | `Idempotency-Key` required | same admission sequence, template validated (`B5_TEMPLATE_MODEL.md` §3) | admits one `Message`, `content_type=template` |
| `CancelMessage` **(additive)** | actor | `MSG-*` | `Idempotency-Key` required | `queued` only; `If-Match` version | `B5_MESSAGE_STATE_MACHINE.md` §2 transition 10 |
| `ReceiveMessage` **(frozen, internal)** | system (webhook pipeline) | one normalized inbound event | webhook-layer dedup (`B5_WEBHOOK_SECURITY_MODEL.md` §5) | signature verified, workspace resolved | admits one inbound `Message` |
| `ApplyProviderMessageStatus` **(additive, internal)** | system (webhook pipeline) | `MSG-*` | `(message_id, status_value, provider_timestamp)` monotonicity | signature verified | appends `MessageDelivery`, conditionally advances `Message.status` (`B5_MESSAGE_STATE_MACHINE.md` §4) |
| `MarkConversationRead` **(additive)** | actor | `CONV-*` | naturally idempotent (bulk `received→read`, re-applying is a no-op) | Conversation exists | marks all `received` inbound messages `read` |
| `ArchiveConversation` **(additive)** | actor | `CONV-*` | `Idempotency-Key` required | `open`, zero unread (`B5_CONVERSATION_MODEL.md` §5) | `status=closed` |
| `ReopenConversation` **(additive)** | actor | `CONV-*` | `Idempotency-Key` required | `closed` | `status=open` |
| `AssignConversation` **(additive)** | actor | `CONV-*` | naturally idempotent (no-op if same owner, FB-19) | Conversation exists, target is a workspace member | `assigned_to` updated |
| `SyncProviderTemplates` **(additive)** | actor (admin) / scheduled | one `ChannelBinding` | naturally idempotent (re-sync overwrites with latest) | `messaging.provider.manage` | refreshes `TemplateDefinition` rows |
| `UpdateProviderConfiguration` **(additive)** | actor (admin) | `ChannelBinding` | `Idempotency-Key` required | `messaging.provider.manage` | updates binding fields, `status → configuration_required` |
| `CheckProviderConfiguration` **(additive)** | actor (admin) / scheduled | `ChannelBinding` | naturally idempotent (read-only probe + status write) | `messaging.provider.manage` for actor-triggered | `status → connected`/`error` |

`COMMAND_COUNT = 12` (2 frozen-derived/refined — `SendMessage`, `ReceiveMessage` — plus 10 additive; corrected by `B5-FIX.1` from a miscounted "4 frozen/8 additive"; 2 of the 12 — `ReceiveMessage`, `ApplyProviderMessageStatus` — are internal, not actor-facing API surface). `FROZEN_REUSED_COMMAND_COUNT = 2`. `ADDITIVE_COMMAND_COUNT = 10`.

## 3. Events

| Event | Payload | Delivery | Idempotency identity |
|---|---|---|---|
| `MessageSent` **(frozen, refined)** | `{message_public_id, conversation_public_id, lead_public_id, direction:'outbound', content_type, sent_at}` | transactional outbox | `(message_public_id)` unique |
| `MessageReceived` **(frozen, refined)** | `{message_public_id, conversation_public_id, lead_public_id, direction:'inbound', content_type, received_at}` | transactional outbox | `(message_public_id)` unique |
| `MessageDelivered` **(frozen, refined)** | `{message_public_id, delivered_at}` | transactional outbox | `(message_public_id, 'delivered')` unique |
| `MessageFailed` **(frozen, refined)** | `{message_public_id, conversation_public_id, failure_code, attempt_count, occurred_at}` | transactional outbox | `(message_public_id, 'failed')` unique |
| `ConversationCreated` **(additive)** | `{conversation_public_id, lead_public_id, channel, created_at}` | transactional outbox | `(conversation_public_id)` unique |
| `ConversationAssigned` **(additive)** | `{conversation_public_id, from_owner_ref (nullable), to_owner_ref, occurred_at}` | transactional outbox | event-envelope `event_id` |
| `ConversationClosed` / `ConversationReopened` **(additive)** | `{conversation_public_id, occurred_at}` | transactional outbox | event-envelope `event_id` |

`EVENT_COUNT = 8` (4 frozen-refined, 4 additive). `MessageRead` and `submitted`-state transitions are **not** published as domain events — they are internal lifecycle detail, observable through `GET`/polling and metrics (`B5_RECONCILIATION_OBSERVABILITY.md` §1), not the outbox, exactly mirroring `B4_COMMAND_EVENT_CATALOG.md` §3's identical "not every tick is an event" discipline. A retry attempt is likewise not separately published — only the terminal outcome of the attempt sequence is.

## 4. Consumed events

> **`CONSUMED_EVENT_COUNT = 0`. B5 subscribes to nothing.**

B5's every dependency (Lead/Contact resolution, Business/Intelligence context) is a synchronous, on-demand read of another domain's own contract (`B5_B2_CRM_LEAD360_HANDOFF.md`, `B5_B4_HANDOFF_CONTRACT.md`) — none is required for B5 to behave correctly, mirroring `B4_COMMAND_EVENT_CATALOG.md` §4's and `B3-D-A019`'s identical "zero consumed events, no circular dependency" precedent two phases running now. `BusinessIntelligenceCompleted` and any future B2/B6 event are informative to a human operator at most, never load-bearing to B5's own correctness.

## 5. Event envelope

Frozen, verbatim, unchanged: *"All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID."*

`EVENT_ENVELOPE_DRIFT_FROM_B0 = 0` — every B5 event above carries exactly this envelope; none adds a field to it.
