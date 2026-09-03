# B12 — Provider Port Architecture

> Design only. No adapter, SDK, credential, or endpoint is created. Realizes frozen `BACKEND_INTEGRATION_BOUNDARIES.md`'s eleven-row port table and its "Provider lifecycle" paragraph.

## 1. Frozen port names are reused verbatim

`BACKEND_INTEGRATION_BOUNDARIES.md` already names every Phase-1 port. B12 mints **no** alternative and renames **none**:

| Provider | Frozen port | Direction | Frozen boundary note |
|---|---|---|---|
| Google Places API (New) | `PlacesProvider` | outbound | normalize, paginate, map provider ID, cache safely, cost-track |
| Scraper engine | `ScrapingProvider` | outbound + callback | submit/poll/cancel/webhook/normalize |
| Meta WhatsApp Cloud API | `MessagingProvider` | outbound + webhook | WABA/phone ID, signed callbacks, provider message ID, ordering |
| OpenAI / AI Gateway | `AIProvider` behind `AIService` | outbound | prompt version, model, usage, cost, latency, timeout; **no direct vendor calls from domains** |
| Tap Payments | `PaymentProvider` | outbound + webhook | hosted/tokenized session, signature, **webhook-first truth**, reconciliation |
| ZATCA / FATOORA | `TaxProvider` | outbound + status | exact legal mapping requires official validation |
| Hostinger storage | `FileStorageProvider` | outbound | blob only, signed/proxied access, checksum |
| Redis / Celery | `JobQueue` | internal | broker, short lock, rate-limit counter; **not canonical data** |
| Webhook gateway | `WebhookGateway` | inbound | verify, receipt, hash, deduplicate, enqueue, fast acknowledge |
| Sentry | `ErrorReporter` | outbound | scrub PII |
| OpenTelemetry | `Tracer` | outbound | no sensitive payloads |

## 2. Shared infrastructure, domain-specific ports — the anti-abstraction rule

> **`B12-D-A022`. There is no universal `Provider` interface. WhatsApp, Places, OpenAI, Tap, and storage share *infrastructure*, not a *signature*.**

The brief (§17) warns against an abstraction so generic that five unlike providers become "fake lookalikes." B12 splits the concern in two:

| Shared by **all** adapters (B12-owned infrastructure) | Owned by **each** port (domain-shaped) |
|---|---|
| outbound HTTP policy and timeouts | operation names and arguments |
| error classification into four classes (§3) | result DTO shape |
| `provider_request_attempts` recording | provider-specific normalization |
| correlation propagation | capability semantics |
| rate-limit and backpressure hooks | which operations exist at all |
| redaction of credentials and payloads | which operations are idempotent |
| health-check invocation | what a "safe check" means for this provider |

`FileStorageProvider.put_object(key, stream)` and `PaymentProvider.create_charge(quote)` have nothing in common at the domain layer and are not forced to. They share the pipe, not the shape.

## 3. The four-class error taxonomy — the one thing every adapter must share

> **`B12-D-A023`. Every adapter translates every provider outcome into exactly one of four classes before crossing the boundary. A status the adapter does not recognize maps to `unknown`, never optimistically to success.**

| Class | Meaning | Retryable | Frozen retry row |
|---|---|:--:|---|
| `not_found` | the provider says the object does not exist | no | Validation |
| `transient` | timeout, 5xx, connection error, 429 | **yes** | Network / Rate limited |
| `permanent` | deterministic rejection: validation, auth, unsupported | **no** | Validation / Authorization |
| `unknown` | outcome undetermined (`B12_UNKNOWN_OUTCOME_MODEL.md`) | **not by repeat** | none — reconciliation |

This is the same four-class contract B11 already froze one domain down (`B11_STORAGE_PROVIDER_BOUNDARY.md` §3: *"Provider errors are translated by the adapter into exactly four classes before crossing the boundary — `not_found`, `transient`, `permanent`, `unknown`"*) and `B10-D-A019`'s fail-closed doctrine. B12 generalizes it to every port rather than inventing a new taxonomy.

## 4. What must never cross the boundary

No domain module, DTO, event payload, error message, log line, metric label, task payload, or dead-letter record may contain: an access token, secret key, app secret, verify token, or `hashstring`; an `Authorization` header; a bucket, region, endpoint host, or base URL; a raw provider response body; a provider status string reused as a WazLink status; a full webhook signature.

**Permitted to cross** (safe provider metadata, `B12_ERROR_TAXONOMY.md` §4): normalized class, `provider_code` (an opaque short token), `http_status`, `retryable` boolean, `retry_after` seconds, and an opaque `provider_request_reference` for support correlation. `STORAGE_PROVIDER_AUTHORITY_LEAKS`-equivalent for all providers is closed by this section; `SECRET_EXPOSURE_GAPS = 0` rests on it plus `B12_SECURITY_PRIVACY.md` §3.

## 5. Adapter obligations — the frozen lifecycle, itemized

Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` states: *"Each adapter has connect/configuration validation, request normalization, finite timeout, retry classification, response normalization, provider-error mapping, cost/usage recording, and audit correlation."* B12 binds each clause to an artifact:

| Frozen clause | B12 artifact |
|---|---|
| connect/configuration validation | `B12_PROVIDER_CONFIGURATION_MODEL.md` §4 (safe configuration check) |
| request normalization | the port's own DTO |
| finite timeout | `B12_OUTBOUND_HTTP_POLICY.md` §2 (frozen timeout table) |
| retry classification | §3 above + `B12_RETRY_BACKOFF_MODEL.md` §2 |
| response normalization | the port's own result DTO |
| provider-error mapping | `B12_ERROR_TAXONOMY.md` §3 |
| cost/usage recording | `provider_request_attempts` + the **domain's** own cost model (B3/B4 own cost semantics) |
| audit correlation | `B12_OBSERVABILITY_HANDOFF.md` §2 |

## 6. Capability queries, not assumptions

Every optional behavior is a **queryable capability** with an explicit `unknown` value, never a hard-coded assumption (`B12_PROVIDER_CAPABILITY_MODEL.md`). The precedent is B11's `supports_presigned_upload()` predicate, which returns `false` for the Phase-1 adapter and makes a later swap additive. B12 applies the same shape to idempotency, status lookup, webhook replay, and request correlation.
