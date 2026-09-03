# B12 — Configuration Inventory

> Design only. **No real secret, key, token, phone ID, or account identifier appears in this document or anywhere in this pack.** Every value below is a symbolic reference name.

## 1. Classification scheme

| Attribute | Values |
|---|---|
| Required | required · optional · required-if-provider-enabled |
| Secret | **secret** (never in DB, DTO, log, event, or task) · non-secret |
| Scope | global (platform) · workspace |
| Change | restart-required · dynamic (read at call time) |

> **`B12-D-A048`. Every credential is read at **call time** from its reference. Nothing caches a resolved secret in a task payload, a domain object, or a long-lived process variable.** This is what makes rotation take effect without a restart and without a cache-invalidation story (`B12_CONCURRENCY_MODEL.md` §2 race 9).

## 2. Platform / substrate

| Key | Required | Secret | Scope | Change | Notes |
|---|---|:--:|---|---|---|
| `CELERY_BROKER_URL` | required | **yes** (contains credentials) | global | restart | Redis, per ADR-004 |
| `CELERY_RESULT_BACKEND` | optional | yes | global | restart | **not** a dead-letter store (`B12-D-A040`) |
| `REDIS_URL` | required | yes | global | restart | cache, locks, abuse counters |
| `PLATFORM_QUEUE_NAMES` | optional | no | global | restart | the five of `B12_QUEUE_TOPOLOGY.md`; deployment may not add a business queue |
| `OUTBOX_MAX_DISPATCH_ATTEMPTS` | optional | no | global | dynamic | default 5 — the frozen figure; **may be lowered, never raised** |
| `OUTBOX_LEASE_TTL_SECONDS` | optional | no | global | dynamic | must exceed publish latency |
| `WEBHOOK_MAX_BODY_BYTES` | required | no | global | dynamic | enforced before HMAC |
| `WEBHOOK_INGRESS_RATE_LIMIT` | required | no | global | dynamic | `B12-AM-008` |
| `RAW_WEBHOOK_PAYLOAD_RETENTION` | optional | no | global | dynamic | **default: off** (`B12-D-B004`) |

## 3. Providers

Names below are **conceptual** and must be reconciled against each provider's current documentation at implementation time (`B12_IMPLEMENTATION_HANDOFF.md` §1) — B12 does not freeze a provider's field names on the strength of a design pass.

| Key | Required | Secret | Scope | Notes |
|---|---|:--:|---|---|
| `WHATSAPP_PROVIDER` | required-if-enabled | no | workspace | provider selector |
| `WHATSAPP_ACCESS_TOKEN_REF` | required-if-enabled | **yes** | workspace | reference only |
| `WHATSAPP_PHONE_NUMBER_ID` | required-if-enabled | no | workspace | **a lookup key, never an authorization claim** |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | required-if-enabled | no | workspace | |
| `WHATSAPP_APP_SECRET_REF` | required-if-enabled | **yes** | workspace | verifies `X-Hub-Signature-256` (`B12-X-001`) |
| `WHATSAPP_VERIFY_TOKEN_REF` | required-if-enabled | **yes** | workspace | `GET` handshake (`B12-X-002`) |
| `TAP_SECRET_KEY_REF` | required-if-enabled | **yes** | workspace | **also the `hashstring` HMAC key** (`B12-X-005`) — one credential, two uses, so rotation invalidates both |
| `TAP_PUBLIC_KEY` | required-if-enabled | no | workspace | |
| `PLACES_API_KEY_REF` | required-if-enabled | **yes** | **global** | shared credential; per-workspace budgets apply (`B12-D-A043`) |
| `AI_PROVIDER`, `AI_API_KEY_REF`, `AI_BASE_URL` | required-if-enabled | key: **yes** | **global** | behind `AIProvider`/`AIService`; no direct vendor calls from domains |
| `SCRAPING_PROVIDER`, `SCRAPING_API_KEY_REF`, `SCRAPING_BASE_URL`, `SCRAPING_WEBHOOK_SECRET_REF` | required-if-enabled | keys: **yes** | workspace | verification scheme is `B12-D-B005`-unresolved |
| `STORAGE_PROVIDER`, `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_REF`, `STORAGE_SECRET_KEY_REF` | required | keys: **yes** | **global** | B11 owns the semantics; capabilities `B11-X-007`-unresolved |
| `TAX_PROVIDER_*` | **not defined** | — | — | B10 dormant (`B12-D-B006`) |

**No key for**: `email`, `google_calendar`, `crm_import_export`, or an outbound customer webhook. Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` defers the first three and no frozen artifact requires the fourth (`FB-B12-010`, `B12-D-B010`, `B12-D-B011`).

## 4. Secret handling rules

1. Every `*_REF` names a reference resolved by the frozen secret-management layer. **The value never enters PostgreSQL** (`B12-D-A046`).
2. A secret never appears in an outbox row, task payload, event, receipt, dead letter, reconciliation evidence, audit entry, metric label, log line, error response, or API DTO (`B12_SECURITY_PRIVACY.md` §3).
3. A configuration read returns `configured: true|false` — never a value, mask, prefix, or length (`B12-D-A042`).
4. Rotation invalidates the prior reference rather than superseding it, and returns the connection to `configuration_required`.
5. A missing reference at call time fails **before** any provider request and creates **no** attempt row (`B12-F-043`).

## 5. Configuration is not business truth

None of these keys carries workspace-scoped commercial meaning. A ceiling here is a platform safety bound; entitlement remains B8's, budgets remain their domains'. Lowering `OUTBOX_MAX_DISPATCH_ATTEMPTS` changes how quickly a stuck announcement dead-letters — it does not change what any customer is entitled to (`B12-D-A038`).
