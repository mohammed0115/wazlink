# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Retry standard

Retries apply only to transient failures and must carry a stable operation/idempotency key. Exponential backoff is `base * 2^(attempt-1)` with full jitter, capped at 15 minutes for ordinary providers and 60 minutes for reconciliation. Default maximum attempts are five, after which the job becomes `dead_lettered` and an operational alert is raised.

| Class | Examples | Retry | Max | Terminal action |
|---|---|---:|---:|---|
| Network timeout/provider unavailable | HTTP timeout, DNS, 5xx | yes | 5 | dead letter + alert |
| Rate limited | 429/provider quota | yes | 6 | honor Retry-After, alert if exhausted |
| Validation | malformed request, unsupported field | no | 1 | failed with safe user error |
| Authorization/entitlement | 401/403/quota | no | 1 | blocked; no provider retry |
| Payment pending | async provider state | scheduled poll | 8 | pending/reconciliation |
| Payment final failure | declined/invalid | no | 1 | failed; user action required |
| Duplicate webhook | known receipt key | no-op | n/a | acknowledge 2xx |
| ZATCA unavailable | provider outage | yes | 8 | pending + reconciliation |
| Storage failure | upload unavailable | yes | 5 | failed asset + retry action |

Workers must use timeouts, heartbeats, and dead-letter records. Retrying a domain command must re-read state and re-check idempotency; it must not replay an irreversible side effect blindly.
