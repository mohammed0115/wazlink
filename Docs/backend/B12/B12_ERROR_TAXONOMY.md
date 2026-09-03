# B12 — Error Taxonomy

> Design only. `ERROR_NEW_COUNT = 1`. Reuse was attempted for every candidate before any code was added; §3 records the eleven candidates and what happened to each.

## 1. Reused frozen codes

| Code | HTTP | B12 usage |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | any operations API call without a session |
| `PERMISSION_DENIED` | 403 | `integration.manage` / `platform.operations.*` denied; a workspace admin attempting a global-scope configuration |
| `ENTITY_NOT_FOUND` | 404 | an `INT-*`, dead letter, or health record absent or belonging to another workspace — indistinguishable by design |
| `VALIDATION_ERROR` | 400/422 | malformed configuration, unknown request field, missing required credential field, **provider payload rejected as malformed** |
| `CONFLICT` | 409 | provider disabled; provider not configured; dead letter not replayable (§4 reasons) |
| `STALE_VERSION` | 409 | `expected_version` mismatch on configure/enable/disable |
| `IDEMPOTENCY_CONFLICT` | 409 | same `Idempotency-Key`, different body |
| `QUOTA_EXHAUSTED` | 403 | a replay refused because the workspace's metered quota is exhausted |
| `PROVIDER_RATE_LIMITED` | 429 | provider 429; response carries `Retry-After` (frozen requirement) |
| `PROVIDER_UNAVAILABLE` | 502/503 | provider unreachable, timing out, or 5xx — **and the client-visible face of an unresolved `unknown`** |
| `WEBHOOK_INVALID_SIGNATURE` | 401 | verification failed |
| `WEBHOOK_DUPLICATE` | 200 | known receipt key (frozen: *"harmless duplicate acknowledgement"*) |
| `INTERNAL_ERROR` | 500 | the frozen universal response |
| `RATE_LIMITED` | 429 | ingress and configuration-check limits |

Fourteen reused codes. `WEBHOOK_INVALID_SIGNATURE` and `WEBHOOK_DUPLICATE` are notable: frozen B0 minted both for the Webhooks domain before that domain was designed, and both fit without adjustment.

## 2. New code

`B12-AM-004` registers exactly **one**, inside the existing envelope and the existing HTTP-status doctrine — zero new statuses, zero new envelope fields.

| Code | HTTP | Meaning | Why not reused |
|---|---:|---|---|
| `PROVIDER_CONFIGURATION_INVALID` | 422 | the provider rejected our credentials or configuration: expired token, wrong phone/WABA binding, insufficient scope, revoked key | `VALIDATION_ERROR` would work syntactically but erases the distinction operators act on. A validation error means *the operator typed something wrong*; this means *the provider says no*, which is the difference between "fix the form" and "get a new token from Meta." It is also the one failure that must flip `credential_valid` and drive `status → error` (`B12_INTEGRATION_HEALTH_MODEL.md` §4), and a generic validation error cannot carry that meaning. `PROVIDER_UNAVAILABLE` is wrong in the opposite direction: the provider is perfectly available and is deliberately refusing us |

## 3. Candidates considered and NOT added

| Candidate (brief §40) | Resolution |
|---|---|
| `provider_unavailable` | **reuse `PROVIDER_UNAVAILABLE`** (frozen) |
| `provider_rate_limited` | **reuse `PROVIDER_RATE_LIMITED`** (frozen) |
| `provider_timeout` | **reuse `PROVIDER_UNAVAILABLE`.** A timeout is an availability failure from the client's side; a distinct code would tell the client nothing it could act on differently |
| `provider_authentication_failed` | **folded into `PROVIDER_CONFIGURATION_INVALID`.** From an operator's standpoint "the token is expired" and "the token lacks scope" have the same remedy: reconfigure |
| `provider_payload_invalid` | **reuse `VALIDATION_ERROR`** |
| `webhook_signature_invalid` | **reuse `WEBHOOK_INVALID_SIGNATURE`** (frozen) |
| `duplicate_delivery` | **reuse `WEBHOOK_DUPLICATE`** (frozen) |
| `unknown_provider_outcome` | **no code.** An unknown outcome is a durable *state* (`provider_request_attempts.outcome`), not a client-facing error. Minting a code would invite a client to "handle" it by retrying — exactly the blind retry `B12-D-A020` forbids. The client sees `502 PROVIDER_UNAVAILABLE`; the truth lives server-side in a reconciliation case |
| `async_execution_failed` | **no code.** The client never observes a worker; it observes its own domain resource's state. Exposing execution failure would leak the substrate into every domain's API |
| `provider_disabled` | **reuse `CONFLICT`** with `details.reason="provider_disabled"` — the value B5 already uses in prose (`B5_ADMIN_PROVIDER_RUNBOOK.md`) |
| `dead_letter_not_replayable` | **reuse `CONFLICT`** with `details.reason="dead_letter_not_replayable"` |

Ten of eleven candidates were absorbed. That ratio is the point of the brief's instruction to search the frozen catalog first.

## 4. New `CONFLICT` reason values

Frozen `B1_API_DTO_CONTRACTS.md` line 308 declares a **closed** vocabulary: *"`409 CONFLICT` always carries a `details.reason` from this closed set: `invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`. A `409 CONFLICT` without a `reason` is invalid."* B12 uses three values not in that set, so `B12-AM-005` registers them additively — the same class of amendment `B2-D-B011` established, `B10-AM-008` was audited into filing, and `B11-AM-009` filed in the pass that used it:

`provider_disabled` · `provider_not_configured` · `dead_letter_not_replayable`

No existing reason is altered, no new code is introduced, and no existing operation's behavior changes.

## 5. Safe provider metadata

An error crossing the boundary may carry, and only carry:

| Field | Example |
|---|---|
| `category` | the four-class value (`transient` / `permanent` / `not_found` / `unknown`) |
| `provider_code` | a short opaque provider token |
| `http_status` | integer |
| `retryable` | boolean |
| `retry_after` | seconds |
| `provider_request_reference` | opaque, for support correlation |

**Never**: an access token, `Authorization` header, secret, `hashstring`, raw provider response body, provider host or endpoint, stack trace, SQL, or internal exception text. `SECRET_EXPOSURE_GAPS = 0` rests partly here; negative control `AT-B12SEC-4`.

## 6. Mapping chain

```
internal exception / HTTP result
   → adapter classifies into 4 classes        (B12_PROVIDER_PORT_ARCHITECTURE.md §3)
   → platform failure_class recorded durably  (provider_request_attempts, worker_executions)
   → domain-visible error where the domain has a client-facing surface
   → safe API error envelope                  (frozen ErrorEnvelope, unchanged)
```

Each arrow **narrows** what is exposed. Nothing is added on the way out, and the last two arrows are the domain's decision, not B12's — a Discovery failure surfaces as B3's error, not as a platform error, because the client asked B3 a question.
