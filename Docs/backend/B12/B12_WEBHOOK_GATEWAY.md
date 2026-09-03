# B12 — Webhook Gateway

> Design only. Realizes the frozen `WebhookGateway` port (*"verify, receipt, hash, deduplicate, enqueue, fast acknowledge"*) and the frozen `Webhooks` domain row's forbidden coupling: **"no direct domain mutation."**

## 1. The pipeline

```
  HTTP POST /webhooks/{provider}
   │
   1. ROUTE          resolve provider from the path segment — never from the body
   2. GATE           Content-Type + body size ceiling, BEFORE reading the body fully
   3. READ RAW       capture the exact bytes; no JSON parsing yet
   4. VERIFY         provider-specific scheme (B12_WEBHOOK_SECURITY.md §2)
        │  FAIL ──▶  record receipt as failed/invalid · 401 · STOP. No parse.
        │             No enqueue. No domain code. Ever.
        ▼  PASS
   5. RESOLVE        workspace, from the verified binding only (§4 of security)
   6. RECEIPT        INSERT webhook_receipts (received → verified), committed
                     dedup_key = <binding id> : <provider event identity>   (B12-D-A056)
   7. DEDUP          UNIQUE (provider, dedup_key) + payload_hash
        │  DUPLICATE ──▶ mark receipt duplicate · 200 · STOP
        ▼  NEW
   8. ACK            200, fast — target <3s (frozen BACKEND_TIMEOUT_POLICY.md)
   9. ENQUEUE        queue `webhooks`; receipt → queued
  10. NORMALIZE      provider payload → normalized provider event
  11. APPLY          invoke the OWNING DOMAIN's guarded command
  12. SETTLE         receipt → processed | failed; emit WebhookProcessed
```

**Why the binding prefix can be computed at step 6.** `dedup_key` needs the binding, and the binding is known at step 5 — because it is the binding whose secret just verified the delivery at step 4. A delivery that fails verification never reaches step 5, so it has **no binding and therefore no `dedup_key`** (`NULL`, `B12_DATA_MODEL.md` §2): an unverified request is recorded as a security observation and is structurally incapable of claiming a dedup identity. That ordering is what makes `CROSS_WORKSPACE_DEDUP_POISONING_GAPS = 0` a property of the pipeline rather than of a check someone must remember to write.

> **Steps 4 and 11 are the two rules everything else serves.** Nothing is parsed, enqueued, or applied before verification (step 4); and nothing is applied by B12 itself (step 11) — B12 hands a normalized event to the domain's own command, which re-checks its own guards.

## 2. Verification precedes everything

> **`B12-D-A027`. There is no "verify later" path.** Frozen `B5-D-A010` already states this for messaging (*"every inbound webhook POST is signature-verified before any business processing, synchronous or asynchronous"*); B12 generalizes it to every provider route. A failed verification is recorded for security observability and **never** marked processed — the "record but never process" posture `B5_WEBHOOK_SECURITY_MODEL.md` §3 established, so a forgery flood is *visible* without ever being *executed*. Negative control `AT-B12WH-2`.

## 3. Fast acknowledgement, and why it is a safety property

The frozen timeout table gives webhook processing *"fast ack <3s"*. This is not politeness — it is retry-pressure management, and the two Phase-1 providers differ sharply:

- **Meta** retries *"immediately, then... with decreasing frequency over the next 36 hours"* if we do not return 2xx (`B12-X-003`). A slow endpoint converts one event into 36 hours of duplicate deliveries.
- **Tap** gives *"two more retry attempts"* and then marks the POST `ERROR` (`B12-X-006`). A slow endpoint **permanently loses** the callback.

So acknowledgement happens after the receipt is committed (step 6/8) and **before** domain application (step 11). The receipt is the durable promise; the processing is asynchronous. Losing a worker after acknowledgement loses nothing, because the receipt is `queued` and the sweep will find it (`B12_RECONCILIATION_MODEL.md` §3, class `P-4`).

## 4. Response semantics

| Situation | Status | Rationale |
|---|---:|---|
| Verified, new, enqueued | `200` | normal |
| Verified, duplicate | `200` | frozen: *"Duplicate webhook / known receipt key / no-op / acknowledge 2xx"* |
| Verified, malformed body | `200` | a `4xx`/`5xx` triggers pointless provider retries of an unparseable payload — B5's frozen §6 posture, generalized |
| Verified, unrecognized event type | `200` | an unknown-but-legitimate future event is not an attack; rejecting it risks the provider disabling the subscription (frozen B5 §7) |
| **Signature invalid** | `401` | recorded, never processed |
| Unknown provider route | `404` | no receipt row — an unrouted request has no binding to attribute it to |
| Body exceeds the size ceiling | `413` | rejected before full read; recorded as a rate/abuse signal |
| Provider disabled | `200` | **accepted and receipted.** §6 |

## 5. `GET` verification handshake

Meta's subscription handshake is a **separate** operation with a different threat model (frozen `B5_WEBHOOK_SECURITY_MODEL.md` §2). Confirmed against Meta's own documentation this pass (`B12-X-002`): the request carries `hub.mode=subscribe`, `hub.challenge` (echoed verbatim), and `hub.verify_token` (compared constant-time against the configured token). Mismatch is `403` with no explanation disclosed. B12 routes it; B5 owns its semantics.

## 6. Disabled providers still receive callbacks

> **`B12-D-A028`. Disabling a provider stops WazLink's *outbound* work. It does not reject the provider's *inbound* callbacks.**

Frozen `B5_ADMIN_PROVIDER_RUNBOOK.md` already states this for messaging: *"Inbound continues to be accepted... disabling the provider pauses WazLink's own outbound capability, not Meta's inbound delivery to WazLink's still-registered webhook."* B12 generalizes it, because the alternative is worse in every case: a payment already authorized before the disable would have its result rejected at the door, and the money would be real while WazLink's record was not. Callbacks for already-issued external operations are always receipted (`B12_INTEGRATION_HEALTH_MODEL.md` §6). Negative control `AT-B12WH-9`.

## 7. Payload handling

The receipt stores a `payload_hash` (the frozen index) and a **normalized** projection of the fields the owning domain needs. Raw-body retention is **off by default**; frozen `BACKEND_INTEGRATION_BOUNDARIES.md` requires it be *"restricted and time-bounded"*, and B12 declines to invent a duration (`B12-D-B004`, `PRODUCT/LEGAL/OPERATIONS DECISION REQUIRED`).

**Never stored, at any retention setting:** the signature or `hashstring` header value, the credential that verified it, or an `Authorization` header. Storing a signature alongside the body it signs converts a debug convenience into an offline forgery oracle.

**A raw body, where retained, is customer data.** It may contain message text, phone numbers, and payment metadata, so it inherits the most restrictive class of `BACKEND_PRIVACY_AND_DATA_HANDLING.md` and never appears in a log line, metric, event payload, or dead-letter DTO.

## 8. Routes

Frozen `BACKEND_API_CATALOG.md` states: *"Provider webhooks are internal gateway routes and are not user-facing resource mutations"* and *"internal provider webhook routes remain outside this user-facing catalog."* B12 honors both: three routes exist, none appears in the user-facing catalog, and none is counted in `PUBLIC_API_OPERATION_COUNT`.

> **Fail-closed on an unknown scheme (`B12-D-A054`).** A route whose provider has no implemented verification adapter cannot pass step 4, so nothing on it is ever parsed, enqueued, or applied; and its integration cannot reach `connected`, so it cannot be `enabled` and admits no outbound work either (`B12_PROVIDER_CONFIGURATION_MODEL.md` §5). The scraping route (`B12-D-B005`) is in exactly that posture today. Negative control `AT-B12CFG-7`.

| Route | Provider | Verification | Owning domain |
|---|---|---|---|
| `POST /webhooks/whatsapp` (+ `GET` handshake) | Meta | `X-Hub-Signature-256`, HMAC-SHA256 over raw body | B5 |
| `POST /webhooks/tap` | Tap | `hashstring`, HMAC-SHA256 over a field concatenation | B8 |
| `POST /webhooks/scraping` | scraper | provider-defined; `B12-D-B005` (unresolved provider) | B3 |
