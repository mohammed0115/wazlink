# B5 — Webhook Security Model

> **B5 status:** Target design only. Load-bearing. Verification handshake and inbound POST verification are designed separately because they have different threat models and run at different times.

## 1. Layered ownership, restated precisely

Per `B5_DOMAIN_OWNERSHIP.md` §2 (`B5-D-A009`): the frozen generic `Webhooks` domain (`WebhookReceipt`/`WHR-*`/`ReceiveWebhook`/`WebhookProcessed`) owns receipt durability, hashing, deduplication, and fast acknowledgement, exactly as `BACKEND_INTEGRATION_BOUNDARIES.md` states (*"verify, receipt, hash, deduplicate, enqueue, fast acknowledge"*). B5 owns everything that requires WhatsApp-specific knowledge: signature verification using the workspace's own `ChannelBinding.app_secret_ref`, payload normalization, and workspace resolution. Neither layer trusts the other's absence — a request that fails B5's signature check never reaches B5's domain processing, regardless of what the generic layer already recorded.

## 2. `GET` verification handshake

Performed once per webhook subscription (at `ChannelBinding` configuration time, and whenever Meta re-verifies):

```
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

| Step | Rule |
|---|---|
| 1 | `hub.mode` must equal `subscribe`; anything else is rejected, `400` |
| 2 | `hub.verify_token` must equal the **currently configured** `ChannelBinding.webhook_verify_token_ref` for the binding this endpoint targets — constant-time comparison, never a substring or prefix match |
| 3 | On match, echo `hub.challenge` verbatim as the response body, `200` |
| 4 | On mismatch, `403`, no challenge echoed, no information about *why* it failed disclosed in the response |

Exact query-parameter names are `B5-X-005` (external validation) — the flow above is the abstract contract; field names are confirmed against current Meta documentation before implementation.

## 3. Inbound `POST` — signature verification

> **`B5-D-A010`: every inbound webhook POST is signature-verified before any business processing, synchronous or asynchronous. There is no "verify later" path.**

```
ON inbound POST for channel_binding B:
  1. Read the raw request body bytes (unparsed — signature covers exact bytes, not a re-serialized JSON object)
  2. Compute HMAC(B.app_secret_ref, raw_body) using the provider's documented algorithm (B5-X-006)
  3. Compare against the signature header, constant-time
  4. IF mismatch:
       - record the attempt at the generic Webhooks receipt layer (§1) for security audit,
         marked invalid — never marked processed
       - respond 401
       - STOP — no queue enqueue, no async processing, no domain code reached, ever
  5. IF match:
       - proceed to §4 (workspace resolution) and §5 (dedup)
```

The "record but never process" behavior in step 4 exists specifically so a flood of forged requests is observable (rate/volume alerting, `B5_RECONCILIATION_OBSERVABILITY.md` §5) without ever letting one reach domain logic — satisfying the brief's explicit requirement that *"failed signature payload is not processed asynchronously"*: verification happens before enqueue, not as a queued step that could race a processor.

**Raw-body requirement, stated because it is easy to get wrong:** any middleware that parses and re-serializes the JSON body before signature verification invalidates the signature (whitespace/key-order are not guaranteed to round-trip). B5's ingestion path verifies against the literal bytes Meta sent, before any JSON parsing occurs.

## 4. Workspace resolution — never from the payload

> **`B5-D-A011`: workspace resolution for an inbound webhook comes only from the verified `ChannelBinding`, never from any field inside the webhook body.**

```
resolve_workspace(webhook) =
    channel_binding = lookup ChannelBinding WHERE phone_number_id = webhook.metadata.phone_number_id
                      AND app_secret verified §3 against THIS channel_binding's own secret
    workspace_id = channel_binding.workspace_id
```

The `phone_number_id` used for lookup is itself only trustworthy because the signature in §3 was verified **against that same binding's own `app_secret_ref`** — an attacker cannot claim `phone_number_id = X` while signing with binding Y's secret and have it resolve to X's workspace, because step 3's HMAC would fail against binding X's secret if the payload was actually signed with Y's. There is exactly one binding whose secret can produce a valid signature for a given request; workspace resolution is a consequence of *which* secret verified, not a value read and trusted from the body.

No `workspace_id`, Lead ID, Conversation ID, or any authorization-relevant field is ever read from webhook body content and trusted directly — every one of those is re-derived from WazLink's own state using only the provider identifiers (`phone_number_id`, `wa_id` of the sender) as lookup keys, never as authorization claims.

## 5. Idempotency and deduplication

> **`B5-D-A013`: webhook processing is idempotent at two layers.**

| Layer | Key | Mechanism |
|---|---|---|
| Generic receipt (Webhooks domain) | `(provider, provider_event_id)` or a payload hash, per that domain's own contract | duplicate delivery of the identical webhook object is a no-op at receipt |
| B5 status application | `(message_id or provider_message_id, status_value, provider_timestamp)` monotonicity check | governs whether a *legal, non-duplicate* status update changes `Message.status` — `B5_MESSAGE_STATE_MACHINE.md` §4 |

Both layers exist because they solve different problems: the receipt layer prevents re-processing the exact same HTTP delivery (Meta's own retry-on-no-2xx behavior); the status-application layer prevents a *later-arriving but logically-stale* status from regressing durable truth, which is a distinct concern from exact-duplicate detection.

## 6. Malformed payload

A signature-valid but structurally malformed payload (unexpected shape, missing required fields for the declared `event_kind`) is acknowledged `200` (per Meta's own retry-avoidance convention — a `4xx`/`5xx` here would trigger pointless provider retries of an unparseable payload) but produces **no** domain state change; it is recorded at the generic receipt layer with a `malformed` marker and surfaced on `B5_RECONCILIATION_OBSERVABILITY.md`'s observability surface, mirroring `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.5's identical "poison payload" precedent one layer over.

## 7. Unsupported event type

A signature-valid, well-formed payload whose `event_kind` (post-normalization, `B5_PROVIDER_ABSTRACTION.md` §4) is not one B5 recognizes is acknowledged `200` and recorded, with zero domain effect — never an error, because an unrecognized-but-legitimate future Meta event type is not an attack or a fault, and rejecting it would risk Meta disabling the subscription for repeated non-2xx responses.

## 8. Acknowledgement timing

`200` (or `403`/`401` per §2–§3) is returned as fast as possible, **before** any slow domain processing — signature verification and workspace resolution are cheap and synchronous; Conversation/Message admission (`B5_INBOUND_PIPELINE.md`) happens on the fast-acknowledged path or is enqueued, per the generic `WebhookGateway`'s own "fast acknowledge" discipline. B5 never blocks the HTTP response on a slow downstream step (CRM timeline visibility, dashboard refresh) — those are eventually-consistent read projections, not part of webhook acknowledgement latency.

## 9. Audit and payload minimization

Every accepted or rejected webhook attempt is logged with `request_id`, `channel_binding_id` (once resolved), outcome (`accepted`/`invalid_signature`/`malformed`/`unsupported_event`), and provider event identifiers — **never** the raw body, the `app_secret_ref`, or any message content, mirroring `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §4's logging discipline exactly.

## 10. Replay

A structurally valid, correctly-signed webhook replayed by an attacker (captured from a prior legitimate delivery) passes §3–§4 (the signature is still valid — HMAC has no built-in freshness) but is caught by §5's idempotency layer: the identical `provider_event_id`/status tuple produces no new effect. Meta's Cloud API does not include a nonce or short-lived timestamp binding in the signature scheme as of this design's authoring (`B5-X-006` confirms or corrects this before implementation) — the mitigation here is therefore idempotency, not signature freshness, and this is stated as a deliberate, checked position rather than an oversight.
