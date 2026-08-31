# B5 — Data Model

> **B5 status:** Target design only. Conceptual relational model. No migrations, no DDL, no SQL implementation.

## 1. Access boundary

| Table set | B5 access |
|---|---|
| B2 (`leads`, `contacts`) | **read-only**, resolved by ID only, never joined via B5's own domain-code ORM |
| B3, B4 | **read-only**, via their own HTTP-shaped contracts (`B5_B4_HANDOFF_CONTRACT.md`) — B5 never touches their tables directly |
| generic `Webhooks` domain (`receipts`) | **read-only**, consumed as verified/deduplicated input (`B5_WEBHOOK_SECURITY_MODEL.md` §1) |
| B11 (`file_assets`) | **read + create**, via B11's own contract (`B5_MEDIA_B11_HANDOFF.md` §4) — B5 never has direct DDL/write credential to `file_assets` |
| B5's own tables (§2) | full read/write |

## 2. Tables

### `conversations`

The aggregate root. `B5_CONVERSATION_MODEL.md` §2 states the full field list. Constraints: unique `(workspace_id, channel, lead_id, counterparty_phone_e164)` (unconditional — `B5-D-A003`); index `(workspace_id, status, last_message_at DESC)`; index `(workspace_id, lead_id)`.

### `messages`

`B5_MESSAGE_MODEL.md` §2 states the full field list. Constraints: unique `(workspace_id, conversation_id, created_at, public_id)`; index `(conversation_id, created_at ASC)`; FK `reply_to_message_id` restricted to same `conversation_id`.

### `message_deliveries`

One append-only row per transport-status transition or attempt.

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK |
| `workspace_id` | UUID FK | required |
| `message_id` | UUID FK → `messages.id` | `ON DELETE CASCADE` — delivery history has no meaning detached from its message |
| `attempt_sequence` | integer | which of the ≤3 automatic attempts this was |
| `status` | enum | `B5_MESSAGE_STATE_MACHINE.md` value at this transition |
| `provider_message_id` | text, nullable | |
| `provider_context_id` | text, nullable | provider-side reply reference, if any |
| `failure_code` | enum, nullable | `B5_RATE_COST_RETRY_MODEL.md` §3 |
| `provider_metadata` | JSONB | provider, channel_binding, request_id, latency_ms — operator-scoped only |
| `provider_timestamp` | timestamptz, nullable | provider-asserted event instant |
| `recorded_at` | timestamptz | WazLink's own commit instant |

**Constraints:** unique `(message_id, attempt_sequence)` (idempotency layer 3, `B5_IDEMPOTENCY_CONCURRENCY.md` §1); index `(workspace_id, recorded_at)`.

### `conversation_participants`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK, no public ID |
| `workspace_id` | UUID FK | required |
| `conversation_id` | UUID FK | required |
| `participant_type` | enum(2) | `member` \| `contact` |
| `participant_ref` | `MEM-*` \| `CON-*` | |
| `role` | enum | `assignee_history` \| `visibility` — records standing visibility distinct from the single current `conversations.assigned_to` |
| `added_at` | timestamptz | |

**Constraints:** unique `(conversation_id, participant_type, participant_ref)`.

### `message_media`

Embedded/child of `messages`, per `B5_MEDIA_B11_HANDOFF.md` §2's field list. **Constraint:** unique `(message_id, media_id)`.

### `template_definitions`

Per `B5_TEMPLATE_MODEL.md` §2's field list. **Constraints:** unique `(workspace_id, channel_binding_id, provider_template_name, language)`; index `(workspace_id, status)`.

### `communication_consents`

Append-only, per `B5_CONSENT_COMMUNICATION_POLICY.md` §2's field list. **Constraint:** index `(workspace_id, channel, counterparty_phone_e164, recorded_at DESC)` — the current state is the top row of this index for a given key.

### `channel_bindings`

One row per workspace in Phase 1, per `B5_PROVIDER_CONFIGURATION_MODEL.md` §2's field list. **Constraint:** unique `(workspace_id, channel)` — enforces the Phase-1 one-binding-per-workspace-per-channel rule (`B5-D-A012`) at the schema level, not merely by convention.

### `messaging_usage_records`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only, no public ID |
| `workspace_id` | UUID FK | required |
| `message_delivery_id` | UUID FK → `message_deliveries.id` | `ON DELETE CASCADE` |
| `provider` | text | |
| `outcome` | enum | `B5_PROVIDER_ABSTRACTION.md` §3 |
| `latency_ms` | integer | |
| `cost_units` | numeric, nullable | **never defaulted to 0** |
| `created_at` | timestamptz | |

## 3. Why `MessageMedia`/`MessageTemplateSnapshot` are embedded, not separate top-level tables

Mirrors `B4_DATA_MODEL.md` §3's identical reasoning: neither is ever queried independently of its owning `Message` as a first-class operation ("all media across every conversation" is not a UI need), and both are written once, at Message-admission or media-fetch-completion time, never updated by an unrelated writer. Embedding avoids referential-integrity machinery this model does not exercise, at the cost of a slightly larger `messages` row — the same trade-off B3/B4 both made for their own per-observation/per-signal data.

## 4. Retention

| Data | Retention |
|---|---|
| `conversations`, `messages`, `message_media` metadata | workspace retention — **product/legal decision required**, mirroring `B4_DATA_MODEL.md` §4's identical posture (`B5-D-C008`) |
| `message_deliveries`, `messaging_usage_records` | operational retention, bounded — telemetry alongside evidence, not itself a user-facing claim beyond current status |
| raw webhook payloads | governed by the generic `Webhooks` domain's own retention policy, not restated here |
| `communication_consents` | **never deleted while the workspace exists** — an opt-out record is itself the evidence that must survive to prove suppression was honored; this is a hard floor, not a tunable, because deleting it would re-open exactly the "opt-out bypass" attack `B5-D-A017` closes |
| `ChannelBinding` secret references | rotated, never retained past rotation (`B5_PROVIDER_CONFIGURATION_MODEL.md` §7) |

## 5. Public ID / code registry

`CONV-*` and `MSG-*` are **already** registered, Section A, workspace-scoped — no amendment needed for either (`BACKEND_PUBLIC_ID_REGISTRY.md` confirmed by direct inspection).

`TPL-*` (`TemplateDefinition`) is a **genuinely new** prefix — no existing registry row covers a template-catalog concept. Proposed, collision-checked (no `TPL-` row exists anywhere in the frozen registry), and registered as a controlled amendment (`B5_CONTROLLED_AMENDMENTS.md` item 5) — never adopted silently.

No other B5 entity needs a top-level public-ID prefix: `MessageDelivery`, `ConversationParticipant`, `MessageMedia`, `MessageTemplateSnapshot`, `CommunicationConsent`, `ChannelBinding`, and `MessagingUsageRecord` are all either embedded/child rows reached only through their owning `Conversation`/`Message`, or internally-keyed/singleton rows with no independent-addressability requirement from any traced frontend behavior or API operation.

```
NEW_PUBLIC_ID_PREFIXES = 1   (TPL- — TemplateDefinition; CONV-/MSG- already exist)
NEW_PERMISSION_CODES = 2     (messaging.manage, messaging.provider.manage)
REUSED_PERMISSION_CODES = 2  (conversation.view, message.send — frozen B1/B0, unchanged; B5-FIX.1)
NEW_ERROR_CODES = 0
```
