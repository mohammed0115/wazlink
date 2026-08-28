# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Transport

Base path: `/api/v1/`. JSON uses `snake_case`; IDs are prefixed public IDs; timestamps are UTC ISO-8601 with `Z`; money is a decimal string plus `currency`; booleans are JSON booleans; null is explicit. Every response includes `request_id` in the envelope or header. Unsafe cookie-authenticated requests require CSRF.

List endpoints use the standard optional query parameters `cursor`, `limit` (1–100), `filters`, and allow-listed `sort` where the catalog marks filtering or sorting as supported. Arbitrary ORM expressions are never accepted. Search uses normalized fields and PostgreSQL indexes/trigram where justified. Durable mutation commands use `Idempotency-Key`; editable DTOs return `version`, and updates require `If-Match` or an explicit version field and return `409` on stale data. The OpenAPI contract declares these request-side parameters explicitly per applicable operation.

HTTP policy: `200` read/update, `201` synchronous creation, `202` async submission, `204` deletion/no body, `400` malformed request, `401` unauthenticated, `402` payment-required/final payment failure where applicable, `403` denied/entitlement blocked, `404` scoped not found, `409` conflict/idempotency/version, `422` semantic validation where selected, `429` rate limit with `Retry-After`, `500` internal, `502` provider translation, `503` unavailable. Every unsafe durable mutation documents `Idempotency-Key`; versioned updates document `If-Match`.

Errors use `{ "error": { "code": "...", "message": "safe text", "details": {}, "request_id": "..." } }`. Internal traces, provider secrets, SQL, and stack details never cross the boundary.

Long operations use `POST → 202 Job resource → GET status/result`; provider callbacks are not exposed as trusted browser redirects. Analytics DTOs include workspace, period, timezone, currency, metric semantics, and snapshot/event classification. `Money.amount` is the decimal string `^-?\\d+(\\.\\d{1,4})?$` after JSON/YAML parsing; `Money.currency` is the sole currency field for a money value, and any transport-level currency mirror must equal it rather than override it.
