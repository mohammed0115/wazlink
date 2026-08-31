# B5 — Reconciliation and Observability

> **B5 status:** Target design only. Inherits frozen `BACKEND_OPERATIONS_OBSERVABILITY.md`. No dashboard, exporter, or alert rule is implemented.

## 1. Metrics

| Metric | Type | Labels |
|---|---|---|
| `messages_created_total` | counter | workspace, direction |
| `messages_inbound_total` | counter | workspace |
| `messages_outbound_total` | counter | workspace |
| `provider_send_attempts_total` | counter | workspace, outcome |
| `provider_send_failures_total` | counter | workspace, `failure_code` |
| `webhook_received_total` | counter | channel_binding, event_kind |
| `webhook_invalid_signature_total` | counter | channel_binding — a sustained non-zero rate is a forgery-attempt signal (`B5_SECURITY_PRIVACY_THREAT_MODEL.md` §2) |
| `webhook_duplicates_total` | counter | channel_binding |
| `webhook_malformed_total` | counter | channel_binding |
| `delivery_status_updates_total` | counter | workspace, `to_status` |
| `message_delivery_latency_seconds` | histogram | — time from `sent` to `delivered` |
| `message_read_latency_seconds` | histogram | — time from `delivered` to `read` |
| `messaging_queue_lag_seconds` | histogram | — time from admission (`queued`) to dispatch (`submitted`) |
| `provider_throttle_total` | counter | workspace, channel_binding |
| `reconciliation_repairs_total` | counter | workspace, `repair_kind` |
| `template_sync_failures_total` | counter | workspace |
| `consent_check_blocked_total` | counter | workspace — how often a send is blocked on consent, distinct from window/rate blocks |
| `unlinked_inbound_total` | counter | workspace — inbound messages with no resolvable Lead (`B5_INBOUND_PIPELINE.md` §3) |
| `status_regression_attempts_total` | counter | workspace — illegal-transition webhooks recorded but not applied (`B5_MESSAGE_STATE_MACHINE.md` §4) |

No message body, secret, or raw provider payload is ever a metric label — every label above is a closed enum or an identifier, matching `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §4's logging discipline extended to metrics.

## 2. Logging

One log line per **state transition** and per **provider/webhook call**, never per message body content. Every line carries `request_id`, `workspace_id`, `conversation_public_id`, `message_public_id` (where applicable), `channel_binding_id`, and `provider_request_id` where applicable. Never logged, at any level: message body, media bytes, any `ChannelBinding` secret field, raw webhook payload.

## 3. Reconciliation processes

| Condition | Response |
|---|---|
| Message stuck in `submitted` beyond a bounded window | reconciliation job queries provider status by `provider_message_id` if captured, or by recipient+timestamp correlation if not; resolves to `sent` (mapping found) or `failed`/`ambiguous_unconfirmed` (window exhausted, no mapping) — never left indefinitely `submitted` (`B5_OUTBOUND_PIPELINE.md` §4) |
| `provider_message_id` known but no terminal status ever arrives | same reconciliation job; a bounded staleness threshold triggers an operator-visible signal, not an automatic status guess |
| Webhook gaps (a status jump suggesting a missed intermediate webhook, e.g. `queued`-equivalent local state but the *first* webhook received is `read`) | applied per `B5_MESSAGE_STATE_MACHINE.md` §4's inferred-intermediate-transition rule (the `read`-implies-`delivered` case); genuinely unexplainable gaps are recorded, not silently patched |
| Out-of-order statuses | governed entirely by `B5_MESSAGE_STATE_MACHINE.md` §4 — no separate reconciliation mechanism duplicates that logic |
| Unknown provider events | recorded per `B5_WEBHOOK_SECURITY_MODEL.md` §7; a recurring unknown event type across many webhooks is an operator-visible signal that the adapter's normalization coverage may be incomplete |
| Template status drift (WazLink believes `APPROVED`, provider rejects at send) | `B5_TEMPLATE_MODEL.md` §7's `template_rejected_at_provider` triggers an immediate re-sync of that specific template, so the *next* attempt reflects reality without waiting for the next scheduled sync |
| `ChannelBinding` health | scheduled periodic health check (`B5_PROVIDER_CONFIGURATION_MODEL.md` §4), bounded frequency, workspace-scoped |
| Media retrieval gaps (`fetch_status=expired`/`failed`) | surfaced per-message; a bulk spike across many messages for one binding is an operator-visible signal distinct from an isolated failure |

Every reconciliation process above is **workspace-scoped** (never a cross-tenant sweep that could leak timing information), **bounded** (finite window/attempt count, never indefinite polling), **observable** (`reconciliation_repairs_total` and the specific signals above), and **idempotent** (re-running a reconciliation pass on an already-resolved case changes nothing, mirroring `B4_OBSERVABILITY_RECONCILIATION.md` §6's identical four properties).

## 4. Gap detection for status webhooks arriving before local state exists

Referenced from `B5_INBOUND_PIPELINE.md` §5: a status webhook whose `provider_message_id` does not yet map to any local `Message` (a race with the outbound pipeline's own commit) is retried by the generic Webhooks domain's own redelivery, and independently re-evaluated by this reconciliation surface if redelivery does not occur before a bounded window — never silently discarded.

## 5. Auditability — the required trace

> An operator must be able to answer **"why is this message in this state?"** end to end, without a hidden or untraceable step.

```
Message.status
  → MessageDelivery[] history, each with outcome and timestamp
    → provider_metadata (provider, channel_binding, request_id, latency)
  → the admission decision that created it (which gates passed, B5_OUTBOUND_PIPELINE.md §2)
  → conversation_public_id, workspace_id
```

Every link is a stored field, resolvable by a single read, operator-scoped for the provider-metadata layer (`B5_ENTITLEMENT_RBAC_TENANCY.md` §4).

## 6. What is deliberately not built here

No dedicated search-index technology beyond PostgreSQL FTS is designed for Phase 1 (`B5_CONVERSATION_MODEL.md` §8) — a heavier search stack is a scaling decision, not an architecture requirement this document commits to prematurely.
