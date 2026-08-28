# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Governance policies

PostgreSQL is canonical. Redis may hold queues, short-lived locks, rate-limit counters, and safe caches; it is never the source of domain truth. Caching authorization decisions is prohibited unless invalidation and TTL are formally proven. Analytics may use transactional queries in Phase 1 and later projections, but formulas and semantics remain owned by canonical domains.

Use explicit application services instead of heavy Django signals. Keep business rules out of views, serializers, signals, and Celery task bodies. Repository/ORM access remains behind service boundaries. Database constraints and `transaction.atomic` are preferred before distributed locks. Use `select_related`/`prefetch_related`, indexes, and pagination to prevent N+1 without premature denormalization.

Use snake_case, UTC timestamps, `NUMERIC(19,4)`, ISO currency, explicit FK deletion policy, and `created_at/updated_at/archived_at`. Phone normalization follows E.164 where appropriate while retaining raw input under restricted policy; email normalization must not silently alter local-part semantics. Phase 1 search uses PostgreSQL indexes/trigram; Elasticsearch is deferred.
