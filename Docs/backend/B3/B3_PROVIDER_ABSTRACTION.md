# B3 — Provider Abstraction, Google Boundary, Scraping Boundary, Raw Payload Policy

> **B3 status:** Target design only. **No adapter, no API client, no credential, no provider call is implemented or authorized.** Provider-specific facts that require official documentation are marked as external-validation items and are deliberately **not** invented here.

## 1. Port names are already frozen

Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` names the ports:

| Provider | Internal port | Direction | Canonical boundary |
|---|---|---|---|
| Google Places API (New) | **`PlacesProvider`** | outbound | Discovery/Business |
| Scraper engine | **`ScrapingProvider`** | outbound + callback | Scraping |

B3 therefore **does not** introduce a `DiscoveryPort`. It defines one **shared capability contract** that both frozen ports satisfy, so the execution engine is written once against a normalized surface and each adapter maps its vendor into it.

```
DiscoveryQueryExecution
        │
        ▼
 capability contract  ──►  PlacesProvider adapter   ──►  Google Places API (New)
   (normalized)       ──►  ScrapingProvider adapter ──►  scraping engine (+ callback)
        │
        ▼
 NormalizedProviderResult  ──►  normalization service  ──►  businesses / business_identities
```

## 2. The boundary rule

> **A provider's vocabulary stops at its adapter.** No provider field name, status string, error code, pagination token, HTTP status, quota header, or raw payload appears in a domain signature, an event payload, an API response, or a log line (`B3-INV-3`).

This is B0's "no provider schema leakage" made testable. The adapter's entire output is the normalized structure of §3; anything the adapter learned and did not put there is discarded or retained only as bounded evidence (§7).

## 3. The normalized capability contract

### 3.1 Capability declaration

Each adapter declares what it can do, so the engine degrades explicitly rather than silently:

| Capability | Type | Meaning when absent |
|---|---|---|
| `supports_pagination` | boolean | one page only; execution ends `SUCCEEDED` after page 1 |
| `max_page_size` | integer | engine plans page count from it |
| `supports_detail_enrichment` | boolean | detail fields stay null; no second call is made |
| `supports_open_now_filter` | boolean | the `activity=open` filter is recorded `filter_degraded` rather than dropped silently |
| `is_asynchronous` | boolean | selects the submit/poll/callback flow of §6 instead of request/response |
| `emits_cost_units` | boolean | cost telemetry is `null`, not zero — an unknown cost is never reported as free |
| `dispatchable` | boolean | a `mock`-status source is rejected at admission (`B3_DISCOVERY_REQUEST_MODEL.md` §8 step 6) |

### 3.2 Normalized search request

```
NormalizedSearchRequest {
  keyword_display     text        # the user's text, NFKC + trimmed only
  location_display    text        # same
  page_size           int
  continuation        opaque?     # adapter-owned, server-side only
  requested_fields    [FieldKey]  # field minimization — §5.2
  deadline            duration
  correlation         { request_id, job_ref, execution_id, attempt_no }
}
```

`requested_fields` is a **closed WazLink field vocabulary** (`B3_NORMALIZATION_DATA_QUALITY.md` §2), never a provider field mask. Each adapter maps it to its own mask, which is what makes field minimization enforceable in one place for every provider.

### 3.3 Normalized result

```
NormalizedProviderResult {
  provider              text          # e.g. "google_places" — a WazLink contract string
  provider_external_id  text          # required; the identity anchor
  name                  text          # required
  category              text?
  address               text?
  phone                 text?
  website               text?
  coordinates           {lat, lng}?
  rating                decimal?
  review_count          int?
  country_code          text?
  provider_observed_at  timestamptz?  # RECORDED ONLY — never stored as discovered_at
  raw_payload_hash      text          # always
}
```

`provider_external_id` and `name` are the only required fields. A result missing either is a **data-quality rejection**, counted and skipped, never a job failure (`B3_NORMALIZATION_DATA_QUALITY.md` §4).

> **`provider_observed_at` is evidence, not a clock.** It is kept for diagnostics and never becomes `discovered_at` (`B3-INV-13`). Admitting a provider clock into a durable timestamp is precisely the class of defect B2 §5.2.1 spent two fix rounds closing, and B3 refuses the input rather than defending against it downstream.

### 3.4 Normalized outcome

Every call returns exactly one:

| Outcome | Carries | Retry class |
|---|---|---|
| `Success` | results, `continuation?`, `provider_request_id`, `cost_units?` | — |
| `RateLimited` | `retry_after` | retryable (frozen B0: 6 attempts) |
| `Timeout` | elapsed | retryable (5) |
| `Unavailable` | — | retryable (5) |
| `InvalidRequest` | safe reason code | **non-retryable** |
| `AuthFailure` | — | **non-retryable**, operator alert |
| `NoMatch` | — | **non-retryable**, a valid empty answer |
| `ContinuationExpired` | — | retryable, restarting from page 1 |
| `MalformedResponse` | `raw_payload_hash` | **non-retryable** for that page |
| `QuotaExceeded` | — | **non-retryable**, operator alert |

These ten outcomes are the *complete* provider vocabulary the domain ever sees. Mapping any vendor error into one of them is the adapter's job and is where every provider-specific string dies.

## 4. Cost, correlation, and timeouts

Frozen B0 requires adapters to attach request ID, provider request ID, cost metadata, and retry classification. B3 adds only that each is recorded on `provider_page_ingestions` and correlated by `(request_id → job_ref → execution_id → provider_request_id)` (`B3_OBSERVABILITY.md` §4). Every call carries a finite deadline; a missing deadline is a configuration error, not a default of infinity.

## 5. Google Places boundary

Designed **conceptually**. Every fact below that depends on Google's current published contract is an external-validation item, not an assertion.

### 5.1 Mapping

| WazLink concept | Places concept | Notes |
|---|---|---|
| `keyword_display` + `location_display` | text search query | composition is adapter-owned |
| result page | one search response page | |
| `provider_external_id` | the Places resource identity for the location | **`B3-X-001`** — exact identifier field, format, and stability guarantee require official verification |
| `continuation` | the API's next-page token | server-side only (`B3-INV-12`) |
| `requested_fields` | the API's field mask | **`B3-X-002`** — exact field names and their billing tiers require verification |
| `cost_units` | billed SKU units | **`B3-X-003`** — SKU model and per-tier pricing require verification |
| `RateLimited` | the API's quota/rate signal | **`B3-X-004`** — exact status and header semantics require verification |

### 5.2 Field minimization

Only fields the WazLink normalized model actually stores are requested. This is simultaneously a **cost** control (field masks drive billing tiers), a **privacy** control (unrequested personal data is never received, so it cannot leak or need deletion), and a **terms** control (less retained data, fewer retention obligations). The concrete mask is `B3-X-002`; the *principle* is Class A and non-negotiable.

### 5.3 Provider identity stability

The design assumes only that a place identifier is **stable enough to be an identity anchor within a workspace**, and it is resilient if that assumption weakens: a rotated identifier produces a new `business_identities` row, and the cross-provider matcher (§5 of `B3_BUSINESS_IDENTITY_MODEL.md`) can link it to the existing Business on strong evidence. Nothing breaks; at worst a review candidate appears. Confirming the real stability guarantee is `B3-X-001`.

### 5.4 Legal and retention

**`B3-X-005`** — Places terms on caching, storage duration, permitted display, and attribution requirements must be verified against the current official terms **before implementation**. B3 makes no legal claim, and the raw-payload policy of §7 is deliberately more conservative than any plausible reading of them.

## 6. Scraping boundary

Designed as **replaceable**. No vendor is named, because no repository evidence names one — the frozen source catalog lists generic types (`public_business_sources`, `business_directory`, `web_directory`, `custom_source`, `file_import` — `data.js:85-90`, `data.js:145-149`) and frozen B0 says only "Scraper engine".

### 6.1 The asynchronous flow

`ScrapingProvider` is `is_asynchronous = true`, and frozen B0 already names its shape: "submit/poll/cancel/webhook/normalize".

```
submit ─► provider_job_id ─┬─► callback (preferred) ─► WebhookReceipt ─► ingest
                           └─► poll (fallback, bounded) ────────────────► ingest
```

| Concern | Design |
|---|---|
| provider job identity | stored on `discovery_query_executions.provider_job_id`; never exposed in any API response |
| callback | enters the B0 **WebhookGateway** first, as `WebhookReceipt` (`WHR-*`), and is verified, deduplicated, and enqueued before any domain code runs |
| callback authenticity | signature verification per `B3_SECURITY_PRIVACY_LEGAL.md` §5; failure → `401 WEBHOOK_INVALID_SIGNATURE`, no processing |
| duplicate callback | provider + event identity + payload hash (frozen B0 idempotency standard) → `200 WEBHOOK_DUPLICATE`, no second ingestion |
| polling | used only when no callback arrives within the deadline; bounded attempts with B0 backoff; never an unbounded loop |
| timeout | an execution with neither callback nor successful poll by its deadline ends `FAILED_RETRYABLE_EXHAUSTED` |
| partial results | a callback carrying some results and an error marker ingests what it carries and records the error; results already ingested are kept |
| malformed results | per-record rejection (`B3_NORMALIZATION_DATA_QUALITY.md` §4); a wholly unparseable payload is `MalformedResponse`, non-retryable for that page |
| cancel | if the adapter declares cancel support, cancellation propagates; otherwise the execution is abandoned locally and a late callback is discarded as a stale reference (§6.2) |
| provider swap | a second adapter satisfies the same contract; existing `business_identities` rows keep their original `provider` value, so history stays interpretable and a swap never rewrites identity |

### 6.2 Late and stale callbacks

A callback arriving after its execution is terminal is **acknowledged `200` and not applied**. Applying it could add results to a `completed` job — changing a result set a user has already paged through, and breaking cursor stability. The receipt is retained so the event is auditable, and the drop is counted (`B3_OBSERVABILITY.md` §2) so a systematic latency problem is visible rather than silent.

### 6.3 SSRF and hostile content

A scraping provider that accepts a URL is an SSRF vector, and provider-returned content is untrusted input. Both are addressed in `B3_SECURITY_PRIVACY_LEGAL.md` §3 and §6; the boundary rule here is that **no B3 request field is ever a caller-supplied URL** — the request model has keywords and locations only, so there is no path from a client to a fetched URL at all. This is a structural defence, not a filter.

### 6.4 Legal

**`B3-X-006`** — the scraping provider's contract, permitted sources, robots/terms posture, and data-redistribution rights must be established before implementation. Frozen B0 already states scraping "must respect provider contracts, robots/terms considerations, provenance, user deletion, and applicable law" and makes no compliance claim. **B3 makes none either.**

## 7. Raw provider payload policy

**Decision (`B3-D-A014`): selectively stored, minimized, hashed always, snapshotted only under an explicit flag, and time-bounded.**

| Artifact | Stored? | Retention | Exposed? |
|---|---|---|---|
| `raw_payload_hash` (per page) | **always** | with the ingestion row | never |
| `provider_request_id` | **always** | with the ingestion row | never in a tenant response; operator diagnostics only |
| response status / outcome class / latency / cost units | **always** | with the ingestion row | aggregated telemetry only |
| **bounded raw snapshot** | **only when `DISCOVERY_RAW_SNAPSHOT_ENABLED`** | **30 days**, then purged | **never**, by any API, to any role |
| normalized fields | always — this is the domain record | Business retention | yes, as `Business` |

Constraints on the snapshot when it is enabled:

- **PII is excluded from the snapshot.** Phone and email are already normalized into `businesses`; duplicating them into a second store with a different retention clock creates a second deletion obligation for no diagnostic gain.
- Size-capped per page; oversized payloads store the hash and a truncation marker.
- Stored in restricted JSONB per frozen B0's classification of provider payloads.
- Never logged, never in an event payload, never in an error response.
- Purged by a scheduled sweep; purging is independent of the Business's own lifetime.

**Why not "never store".** Reconciliation, provider dispute resolution, and normalization-bug diagnosis all need to answer "what exactly did the provider send?" A hash alone answers *whether* a payload changed but not *how* it was misread. **Why not indefinite.** Frozen B0 privacy classifies provider payloads as "restricted JSONB, short retention, hash/reference" and proposes 30 days; indefinite retention would multiply the deletion surface, the legal surface, and the storage cost for a diagnostic value that decays within days. Thirty days follows B0's proposal and remains a product/legal confirmation item (**`B3-X-007`**).

## 8. External-validation register

| ID | Item | Blocks |
|---|---|---|
| `B3-X-001` | Google Places place-identifier field, format, and stability guarantee | adapter implementation |
| `B3-X-002` | Places field-mask names and billing tiers | field minimization + cost model |
| `B3-X-003` | Places SKU/pricing model for cost telemetry | cost dashboards |
| `B3-X-004` | Places rate-limit/quota signalling semantics | retry classification tuning |
| `B3-X-005` | Places terms: caching, storage duration, display, attribution | raw payload + retention policy |
| `B3-X-006` | Scraping provider contract, permitted sources, robots/terms, redistribution rights | scraping adapter |
| `B3-X-007` | Confirmation of the 30-day raw-payload retention as product/legal policy | retention sweep |
| `B3-X-008` | Saudi data-locality and personal-data obligations for acquired business contact data | storage/region decisions |

**None of these blocks B3 design closure.** Each is a provider or legal fact that B3 must not invent, and every one is isolated behind an adapter or a configuration value so that learning the answer changes no domain contract in this package.
