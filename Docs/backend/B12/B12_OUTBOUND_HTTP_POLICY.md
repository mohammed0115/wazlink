# B12 — Outbound HTTP Policy

> Design only. Reuses frozen `BACKEND_TIMEOUT_POLICY.md` and `BACKEND_RETRY_POLICY.md` verbatim; adds only the decision hierarchy the frozen tables do not state.

## 1. The decision hierarchy

> **`B12-D-A026`. Outbound HTTP behavior resolves in exactly this order, highest first. A lower level never overrides a higher one.**

```
1. Provider response instruction   (Retry-After header)          ← highest
2. Provider-specific frozen row    (BACKEND_TIMEOUT_POLICY.md)
3. Provider-specific override      (deployment configuration)
4. Platform default                (B12, §2)                     ← lowest
```

Level 2 above level 3 is deliberate: a deployment may tune *within* the frozen envelope but may not widen a frozen timeout, because those numbers are the basis of the queue-isolation argument (`B12_QUEUE_TOPOLOGY.md` §2) and of every job-level ceiling.

## 2. Timeouts — frozen, per provider

The frozen table is authoritative and reproduced in `B12_CELERY_EXECUTION_MODEL.md` §6. B12 proposes **no** different number for any listed provider. A provider not in the frozen table has no Phase-1 outbound path; adding one requires a controlled amendment.

**Platform default** for any adapter call not otherwise specified: connect 3s, request 15s — the most conservative pair the frozen table already contains, chosen so that an unspecified call is never *more* permissive than a specified one.

**Every call has a deadline.** Frozen `BACKEND_TIMEOUT_POLICY.md` closes with *"Timeouts produce typed retryable errors, never indefinite worker execution."* There is no infinite-timeout path in B12, and no adapter may disable a timeout.

## 3. Status classification

| Condition | Class | Retryable | Note |
|---|---|:--:|---|
| `2xx` | success | — | adapter still validates the body shape; an unparseable success body is `unknown`, not success |
| `400`, `422` | `permanent` | **no** | validation — frozen "Validation, no, 1" |
| `401`, `403` | `permanent` | **no** | credential/authorization — frozen "Authorization, no, 1". **Also marks the `IntegrationConnection` for a health re-check** (`B12_INTEGRATION_HEALTH_MODEL.md` §4) |
| `404` | `not_found` | no | may be semantically meaningful (a lookup miss) — the port decides |
| `409` | `permanent` by default | no | unless the port documents it as a retryable conflict |
| `429` | `transient` | **yes, 6** | honor `Retry-After` (§4) |
| `5xx` | `transient` | **yes, 5** | frozen network/unavailable row |
| connect timeout, DNS failure, TLS handshake failure | `transient` | **yes, 5** | the request demonstrably never left; a repeat is safe **even for non-idempotent operations** |
| **read timeout, connection reset after the request was sent** | **`unknown`** | **no repeat** | the request may have arrived. `B12_UNKNOWN_OUTCOME_MODEL.md` governs |
| unparseable / schema-invalid response body | `unknown` | no repeat | we cannot tell what happened |

> **The two timeout rows are different on purpose.** A *connect* failure proves nothing left the process; a *read* timeout proves nothing about the far side. Collapsing them into one "timeout ⇒ retry" rule is the single most likely way to produce a duplicate charge. Negative control `AT-B12HTTP-5`.

## 4. `Retry-After`

Honored whenever present, on `429` and on `503`. Interpreted as seconds or as an HTTP-date. It sets a **floor**, never a ceiling: the effective delay is `MIN(class_cap, MAX(retry_after, computed_backoff))` (`B12_RETRY_BACKOFF_MODEL.md` §3). A `Retry-After` longer than the class cap parks the work up to the cap and then re-evaluates rather than sleeping indefinitely.

## 5. Request hygiene

Every outbound request carries: a bounded body size; an explicit `Content-Type`; the correlation identifiers of `B12_OBSERVABILITY_HANDOFF.md` §2 where the provider accepts custom headers; and credentials resolved **at call time** from the secret reference, never cached in a task payload or a domain object.

Every outbound request is recorded by a `provider_request_attempts` row **committed before the call** (`B12-D-A021`).

**No outbound call is made to a URL supplied by a client.** The only URL-fetching path in the platform is B11's `ImportFileFromUrl`, which is system-actor-only, host-allow-listed, and SSRF-defended by its own frozen design (`B11_UPLOAD_MODEL.md` §6). B12 adds no second one and no generic "call this webhook" feature. Negative control `AT-B12SEC-6`.

## 6. TLS and transport

TLS verification is mandatory and non-disableable. There is no configuration flag, environment variable, or per-provider override in this pack that disables certificate verification, permits plaintext HTTP to a provider, or pins a self-signed certificate without an explicit controlled amendment.
