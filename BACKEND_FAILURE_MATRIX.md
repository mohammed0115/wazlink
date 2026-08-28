# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Failure handling matrix

| Scenario | User-visible result | Internal state | Retry/idempotency | Alert/reconciliation |
|---|---|---|---|---|
| PostgreSQL unavailable | safe 503 | request failed | client retry with key | readiness alert |
| Redis unavailable | degraded 503 for async/rate paths | no canonical loss | do not use Redis as DB | ops alert |
| Google rate limit | job remains retryable | provider_rate_limited | Retry-After/backoff | provider cost alert |
| Scraper partial failure | partial results | job partial + failed targets | target-level keys | review failed targets |
| OpenAI timeout | analysis pending/failed | AI job timeout | retry fingerprint | Sentry + usage audit |
| Duplicate Meta webhook | no duplicate message | receipt duplicate | acknowledge no-op | metrics only |
| Meta outbound timeout | message pending/failed | delivery retryable | provider message key | reconciliation |
| Tap callback missing | payment pending | reconciliation required | poll/retry receipt | billing alert |
| Tap duplicate callback | no duplicate payment/invoice | receipt duplicate | unique provider key | audit |
| ZATCA unavailable | tax submission pending | tax pending | retry queue | tax alert |
| Storage upload failure | upload failed | asset quarantined/failed | retry key | operations |
| Worker dies | job resumes or fails safely | heartbeat timeout | retry execution key | dead-letter alert |
| AI/Discovery partial | partial UI with status | partial result | resume/cancel | dashboard warning |

No failure path may silently convert a Deal into Revenue, grant entitlement, lose tenant scope, or expose provider internals.
