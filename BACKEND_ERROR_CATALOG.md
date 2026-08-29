# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Error envelope

```json
{"error":{"code":"QUOTA_EXHAUSTED","message":"The current workspace quota is exhausted.","details":{},"request_id":"req_01..."}}
```

| Code | HTTP | Meaning |
|---|---:|---|
| AUTH_REQUIRED | 401 | session missing/invalid |
| SESSION_REVOKED | 401 | session no longer valid |
| PERMISSION_DENIED | 403 | role/object policy denied |
| ENTITLEMENT_LOCKED | 403 | capability not in plan |
| QUOTA_EXHAUSTED | 403 | quota unavailable |
| WORKSPACE_NOT_FOUND | 404 | no scoped workspace |
| ENTITY_NOT_FOUND | 404 | scoped resource absent |
| VALIDATION_ERROR | 400/422 | malformed or semantically invalid input |
| CONFLICT | 409 | state/version conflict |
| IDEMPOTENCY_CONFLICT | 409 | same key with different body |
| STALE_VERSION | 409 | editable resource version changed |
| PROVIDER_RATE_LIMITED | 429 | provider limit; retry policy applies; response includes `Retry-After` seconds |
| PROVIDER_UNAVAILABLE | 502/503 | provider unavailable; OpenAPI uses 502 for translated upstream/provider failure and 503 for unavailable service |
| PAYMENT_FAILED | 402/422 | final payment failure; 402 is applicable to payment-required Billing operations and 422 to semantic payment validation |
| PAYMENT_PENDING | 202 | payment remains asynchronous |
| WEBHOOK_INVALID_SIGNATURE | 401 | callback authentication failed |
| WEBHOOK_DUPLICATE | 200 | harmless duplicate acknowledgement |
| TAX_VALIDATION_REQUIRED | 422 | missing official tax contract/field |
| FILE_TYPE_NOT_ALLOWED | 422 | upload policy violation |
| INTERNAL_ERROR | 500 | safe generic failure; every OpenAPI operation declares the reusable 500 response |

No error reveals stack traces, secrets, cross-workspace existence, provider credentials, or raw payment details.

## B0-FIX.4 transport mapping

OpenAPI uses the canonical reusable response components `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `ValidationError`, `RateLimited`, and `ServiceUnavailable` wherever those outcomes are applicable, with `InternalError`, `ProviderUnavailable`, and `PaymentRequired` for their dedicated cases. Endpoint responses are applied by semantic applicability rather than copied generically. A `429` response carries `Retry-After`; a `500` response is universal; `502` applies only to provider-dependent operations; and `402` applies only to Billing/payment-required commands. `GET /billing/invoices` is a local read and does not return `402` or `502`.
