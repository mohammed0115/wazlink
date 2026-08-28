# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Rate-limit targets

These are initial architecture targets, not guarantees, and must be calibrated in staging.

| Category | Suggested limit | Key |
|---|---:|---|
| Login/reset | 10/min/IP and 5/min/account | IP + account |
| General API | 300/min/workspace | workspace + user |
| Discovery submit | 10/hour/workspace plus entitlement | workspace |
| AI analysis | 60/hour/workspace plus quota | workspace |
| Export | 10/hour/workspace | workspace + user |
| Webhooks | provider-specific burst protection | provider + endpoint |
| Payment initiation | 10/hour/workspace and 3/min/user | workspace + user |
| Admin repair | 30/hour/operator | operator |

Limits combine abuse protection, provider cost control, and entitlement quotas. Responses use `429` with `Retry-After` and safe error code. Quota enforcement remains transactional and authoritative in PostgreSQL; Redis counters are acceleration/abuse controls, not the source of truth.
