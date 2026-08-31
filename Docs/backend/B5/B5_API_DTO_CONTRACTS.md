# B5 — API and DTO Contracts

> **B5 status:** Target design only. No endpoint is implemented. Every operation traces to a frontend behavior in `B5_FRONTEND_TRACEABILITY_MATRIX.md` or a downstream-consumption need in `B5_B2_CRM_LEAD360_HANDOFF.md`.

## 1. Operations

`API_OPERATION_COUNT = 16`.

### 1.1 `POST /conversations/{id}/messages` — `sendMessage`

| | |
|---|---|
| Command | `SendMessage` |
| Permission | `message.send` |
| Idempotency | `Idempotency-Key` required |
| Request | `SendMessageRequest` |
| Success | `202` → `MessageDetail` |
| Errors | `400`/`422 VALIDATION_ERROR` · `401` · `403 PERMISSION_DENIED`/`ENTITLEMENT_LOCKED` · `404` · `429` (`messaging_rate_limited`) · `500` |
| Frontend consumer | FB-09 (composer submit) |

### 1.2 `POST /conversations/{id}/messages/template` — `sendTemplateMessage`

Identical shape to §1.1, command `SendTemplateMessage`, request `SendTemplateMessageRequest`. Additional error: `422 VALIDATION_ERROR` (`template_variable_missing`/`template_not_approved`).

### 1.3 `POST /messages/{id}/cancel` — `cancelMessage`

| | |
|---|---|
| Command | `CancelMessage` |
| Permission | `message.send` + object scope (creator or `manager`+) |
| Idempotency | `Idempotency-Key` required |
| Concurrency | `If-Match` on `Message.version` |
| Success | `202` → `MessageDetail` |
| Errors | `401` · `403` · `404` · `409 CONFLICT` (`message_not_cancellable`) · `409 STALE_VERSION` |

### 1.4 `GET /conversations` — `listConversations`

`conversation.view`. Cursor-paginated, `200` → `ConversationListPage`. Filters/sort per `B5_CONVERSATION_MODEL.md` §8. Frontend consumer: FB-16/FB-17.

### 1.5 `GET /conversations/{id}` — `getConversation`

`conversation.view`. `200` → `ConversationDetail`. `404` uniform (foreign workspace or non-existent).

### 1.6 `GET /conversations/{id}/messages` — `listMessages`

`conversation.view`. Cursor-paginated (`conversation_id, created_at ASC, public_id ASC`), `200` → `MessageListPage`.

### 1.7 `GET /leads/{id}/conversations` — `listLeadConversations`

`conversation.view` + `lead.view` (B2). `200` → `[ConversationSummary]`. Frontend consumer: FB-24/FB-25 (Lead 360).

### 1.8 `POST /conversations/{id}/read` — `markConversationRead`

`conversation.view` (reading one's own inbox and marking it read is not a higher-privilege action than viewing it). `202` → `ConversationDetail`. Frontend consumer: FB-14.

### 1.9 `POST /conversations/{id}/archive` — `archiveConversation`

`messaging.manage`. `202` → `ConversationDetail`. Errors include `409 CONFLICT` (`unread_messages_present`, FB-10).

### 1.10 `POST /conversations/{id}/reopen` — `reopenConversation`

`messaging.manage`. `202` → `ConversationDetail`.

### 1.11 `POST /conversations/{id}/assign` — `assignConversation`

`messaging.manage` (manager+: any; sales: own-assigned only, `B5_ENTITLEMENT_RBAC_TENANCY.md` §2). Request `AssignConversationRequest`. `202` → `ConversationDetail`.

### 1.12 `GET /messaging/templates` — `listTemplates`

`conversation.view`. `200` → `[TemplateSummary]`.

### 1.13 `POST /messaging/templates/sync` — `syncProviderTemplates`

`messaging.provider.manage`. `202` → `{synced_count, sync_status}`.

### 1.14 `GET /messaging/provider/configuration` — `getProviderConfigurationStatus`

`messaging.provider.manage`. `200` → `ProviderConfigurationStatus`, nullable if never configured.

### 1.15 `PUT /messaging/provider/configuration` — `updateProviderConfiguration`

`messaging.provider.manage`. Request `UpdateProviderConfigurationRequest`. `202` → `ProviderConfigurationStatus` (never echoes secret fields, `B5_PROVIDER_CONFIGURATION_MODEL.md` §6).

### 1.16 `POST /messaging/provider/configuration/check` — `checkProviderConfiguration`

`messaging.provider.manage`. `202` → `ProviderConfigurationStatus`.

## 2. Request DTOs

`REQUEST_DTO_COUNT = 4`.

**`SendMessageRequest`**: `content_type` (required, non-template subset of §`B5_MESSAGE_CONTENT_MODEL.md`), `body` (required for `text`, nullable otherwise), `media_refs[]` (nullable), `reply_to_message_id` (nullable).

**`SendTemplateMessageRequest`**: `template_definition_id` (required), `variables` (map, required if the template has slots), `reply_to_message_id` (nullable).

**`AssignConversationRequest`**: `owner_ref` (`MEM-*`, required).

**`UpdateProviderConfigurationRequest`**: `waba_id`, `phone_number_id`, `display_phone_e164`, `access_token`, `app_secret`, `webhook_verify_token` — all optional per-call (only supplied fields are updated); secret fields write-only.

## 3. Response DTOs

`RESPONSE_DTO_COUNT = 9`.

**`ConversationSummary`** — `conversation_public_id`, `lead_ref`, `contact_ref` (nullable), `channel`, `status`, `assigned_to` (nullable), `last_message_at`, `unread_count`, `needs_reply`, `latest_message_preview` (bounded-length text). `additionalProperties: false`.

**`ConversationDetail`** — `ConversationSummary`'s fields plus `created_at`, `version`.

**`ConversationListPage`** — `items: [ConversationSummary]`, `page_info` (frozen `PageInfo`).

**`Message`** — `message_public_id`, `conversation_ref`, `direction`, `sender_type`, `sender_ref` (nullable), `content_type`, `body` (nullable), `template_snapshot` (nullable), `media[]` (nullable), `reply_to_message_id` (nullable), `assistance` (nullable), `status`, `created_at`, `status_updated_at`.

**`MessageDetail`** — `Message`'s fields plus `version`.

**`MessageListPage`** — `items: [Message]`, `page_info`.

**`MessageMedia`** — `media_id`, `content_type`, `mime_type`, `size_bytes` (nullable), `file_asset_ref` (nullable), `fetch_status`, `caption` (nullable).

**`TemplateSummary`** — `template_public_id` (`TPL-*`), `provider_template_name`, `language`, `category`, `status`, `variable_slots[]`, `last_synced_at`.

**`ProviderConfigurationStatus`** — `channel_binding_status` (`status`, `enabled`), `waba_id`, `display_phone_e164`, `error_code` (nullable), `error_reason` (nullable), `last_checked_at`, `configured_by_ref` (nullable), `configured_at` (nullable). **No secret field ever appears.**

## 4. What no B5 DTO ever contains

- a `ChannelBinding` secret value, under any field, at any nesting depth (`B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1)
- a raw provider webhook payload or raw provider response
- another workspace's data, under any field (`B5_ENTITLEMENT_RBAC_TENANCY.md` §7)
- a revenue, price, Deal-value, or win-probability field (`B5_B6_B7_BOUNDARIES.md` §1)
- `Message.body`/media content inside a CRM timeline response — that surface uses `B5_CRM_TIMELINE_PROJECTION.md`'s safe `summary` only
