# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Transport

Base path: `/api/v1/`. JSON uses `snake_case`; IDs are prefixed public IDs; timestamps are UTC ISO-8601 with `Z`; money is a decimal string plus `currency`; booleans are JSON booleans; null is explicit. Every response includes `request_id` in the envelope or header. Unsafe cookie-authenticated requests require CSRF.

List endpoints use cursor pagination with `limit` capped at 100. Bounded catalogs may use offset pagination. Filters and sorting are allow-listed per resource; arbitrary ORM expressions are never accepted. Search uses normalized fields and PostgreSQL indexes/trigram where justified. Editable DTOs return `version`; updates require `If-Match` or an explicit version field and return `409` on stale data.

HTTP policy: `200` read/update, `201` synchronous creation, `202` async submission, `204` deletion/no body, `400` malformed request, `401` unauthenticated, `403` denied/entitlement blocked, `404` scoped not found, `409` conflict/idempotency/version, `422` semantic validation where selected, `429` rate limit, `500` internal, `502` provider translation, `503` unavailable.

Errors use `{ "error": { "code": "...", "message": "safe text", "details": {}, "request_id": "..." } }`. Internal traces, provider secrets, SQL, and stack details never cross the boundary.

Long operations use `POST → 202 Job resource → GET status/result`; provider callbacks are not exposed as trusted browser redirects. Analytics DTOs include workspace, period, timezone, currency, metric semantics, and snapshot/event classification.
