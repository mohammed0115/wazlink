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
| PROVIDER_RATE_LIMITED | 429 | provider limit; retry policy applies |
| PROVIDER_UNAVAILABLE | 502/503 | provider unavailable |
| PAYMENT_FAILED | 402/422 | final payment failure |
| PAYMENT_PENDING | 202 | payment remains asynchronous |
| WEBHOOK_INVALID_SIGNATURE | 401 | callback authentication failed |
| WEBHOOK_DUPLICATE | 200 | harmless duplicate acknowledgement |
| TAX_VALIDATION_REQUIRED | 422 | missing official tax contract/field |
| FILE_TYPE_NOT_ALLOWED | 422 | upload policy violation |
| INTERNAL_ERROR | 500 | safe generic failure |

No error reveals stack traces, secrets, cross-workspace existence, provider credentials, or raw payment details.
