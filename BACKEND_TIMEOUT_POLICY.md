# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Timeout targets

These are initial targets for staging calibration. Every external call and worker has a finite deadline.

| Operation | Connect | Request | Job |
|---|---:|---:|---:|
| Google Places | 3s | 15s | 5m |
| Scraper submit/poll | 5s | 30s | 30m |
| Meta send | 3s | 15s | 2m |
| AI Gateway | 3s | 60s | 5m |
| Tap API | 3s | 20s | 5m |
| ZATCA | 5s | 30s | 10m |
| Hostinger storage | 5s | 60s | 10m |
| Webhook processing | n/a | fast ack <3s | 5m |

Timeouts produce typed retryable errors, never indefinite worker execution. Provider-specific official limits must be validated before implementation.
