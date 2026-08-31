# B5 — Provider Abstraction

> **B5 status:** Target design only. No provider adapter is implemented. Reuses frozen B0's already-named port.

## 1. The port

> **`B5-D-A008`: B5 reuses frozen `BACKEND_INTEGRATION_BOUNDARIES.md`'s already-named port, `MessagingProvider`, rather than inventing a new one.**

```
B5 Application Service (SendMessage / SendTemplateMessage handler)
        │
        ▼
MessagingPort  ── request contract / response contract (§2–§3), provider-neutral
        │
        ▼
MessagingProvider Adapter (not designed here — implementation detail; Meta today, swappable later)
        │
        ▼
Normalized Delivery Result  ── the only thing the domain ever sees
```

The domain model — `Conversation`, `Message`, `MessageDelivery` — never references a Meta-specific field name, status string, or payload shape. Everything provider-specific is confined to the adapter, which does not exist in this design phase. `B5_WHATSAPP_EXTERNAL_VALIDATION_REGISTER.md` isolates every Meta-specific fact; none is baked into this document or the domain model.

## 2. Outbound request contract

| Field | Meaning |
|---|---|
| `message_id` | the `Message` this call belongs to |
| `channel_binding_id` | which workspace WhatsApp number sends this |
| `recipient_phone_e164` | normalized recipient |
| `payload_kind` | `text` \| `template` \| `media` — the port distinguishes these because they have different schemas and different policy preconditions (`B5_CUSTOMER_SERVICE_WINDOW.md`) |
| `payload` | the normalized content for the chosen kind (§`B5_MESSAGE_CONTENT_MODEL.md`) |
| `reply_context` | optional provider-side reply reference |
| `timeout_ms` | bounded, Class B value |

## 3. Outbound response contract

| Field | Meaning |
|---|---|
| `outcome` | `accepted` \| `rejected` \| `timeout` \| `rate_limited` \| `provider_unavailable` |
| `provider_message_id` | present only on `accepted` — the stable identity used to correlate later status webhooks |
| `provider_metadata` | `provider`, `channel_binding_id`, `request_id`, `latency_ms` |
| `rejection_reason` | present only on `rejected` — mapped into a closed WazLink failure code (`B5_RATE_COST_RETRY_MODEL.md` §3), the raw provider error string retained only in `provider_metadata` for operator diagnostics |

## 4. Inbound/webhook normalization

The adapter is the **only** place that parses a raw Meta webhook payload. It emits one normalized shape per event, never the raw payload, to the domain:

| Field | Meaning |
|---|---|
| `event_kind` | `inbound_message` \| `status_update` \| `template_status_change` |
| `channel_binding_id` | resolved from the verified webhook binding (`B5_WEBHOOK_SECURITY_MODEL.md` §3), **never** from any field inside the payload |
| `provider_message_id` | the provider's own message identity |
| `provider_event_id` | the provider's own delivery/event identity, used for webhook-layer dedup (`B5-D-A013`) |
| `normalized_content` \| `normalized_status` \| `normalized_template_status` | one of these, per `event_kind`, already mapped into WazLink's own closed vocabulary (`B5_MESSAGE_STATE_MACHINE.md`, `B5_MESSAGE_CONTENT_MODEL.md`, `B5_TEMPLATE_MODEL.md`) |
| `provider_timestamp` | the provider-asserted event instant, used for out-of-order detection, never trusted as workspace-resolution input |

## 5. Provider swappability

No domain table, state-machine transition, or DTO field in `B5_DOMAIN_OWNERSHIP.md`, `B5_MESSAGE_MODEL.md`, `B5_MESSAGE_STATE_MACHINE.md`, or `B5_DATA_MODEL.md` contains a Meta-specific concept. A future provider change (a second WhatsApp BSP, or a different channel entirely reusing the same `channel` enum pattern) touches only the adapter and the `provider`/`channel_binding` metadata fields — no domain table, no state machine, no content-type mapping requires redesign.

## 6. What is never retained

- No raw webhook payload is stored as domain truth (it is retained only at the generic `Webhooks` domain's own receipt layer, per its own retention policy — `B5-D-A009`).
- No raw provider request/response body is stored on `Message` or `MessageDelivery`. `provider_metadata` carries normalized, bounded fields only.
- `B5_DATA_MODEL.md` §6 states the exact retention rule.
