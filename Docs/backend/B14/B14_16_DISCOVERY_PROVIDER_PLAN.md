# B14_16 — Discovery Provider Plan (Places + Scraping)

> Discovery's domain is built **provider-free**. Two ports, two adapters, zero vendor coupling in `apps/discovery`.

## 1. Ports

```
apps/discovery  →  PlaceSearchPort        →  adapters/places     (Google Places)
                →  ScrapingProviderPort   →  adapters/scraping   (vendor UNSELECTED)
```

The domain speaks only in **normalized results**. No adapter type, provider field name or vendor identifier appears in a `discovery` module signature, model or event.

## 2. Normalized result contract

`NormalizedBusinessResult` — `provider_external_id` (opaque, the identity key) · `name` · `category` · `address_text` · `city` · `latitude`/`longitude` · `phone` (nullable) · `website` (nullable) · `rating`/`review_count` (nullable) · `source_provider` · `observed_at`.

**Only fields WazLink actually uses are mapped.** Raw provider payloads are **not** persisted as business truth; where a snapshot is retained it is a bounded JSONB *raw snapshot* under the frozen governance allowance, never a relationship, state or ownership carrier.

Business identity remains frozen: `businesses` + `business_identities`, unique on `(workspace_id, provider_external_id)`.

## 3. Google Places adapter

**Boundary:** credential validation (key presence + a cheap authenticated probe) · quota and rate handling with backoff on `429` · pagination where the API provides it · normalized mapping to `NormalizedBusinessResult` · **provider attribution requirements honoured wherever results are displayed** · error normalization to B12 classes · observability (attempt rows, latency, quota signals).

**Implementation-time verification required.** The current Places API surface, field masks, pricing/quota model and attribution obligations **must be read from official Google documentation during slice I3**. B14 does not guess an endpoint, a field mask or a response shape.

Configuration: `GOOGLE_PLACES_API_KEY`. Missing ⇒ Places discovery unavailable, connection `not_connected`; **CRM, Customer and every non-Discovery flow are unaffected.**

## 4. Scraping adapter — vendor deliberately unselected

Frozen B12 leaves the scraping webhook verification scheme **open** (`B12-D-B005`) and forbids enabling the scraping connection before a scheme exists (`B12-D-A054`).

**B14 selects no scraping vendor and invents no contract.** This is recorded as an **implementation-time provider decision that does not alter the Discovery domain** — the port and the normalized contract are fixed; only the adapter behind them is open.

Prepared boundary (to be completed when a vendor is chosen): API key · base URL · timeouts · rate limits · pagination · job submission and status · provider error normalization · retry for idempotent operations only · **webhook or polling depending on what the provider actually supports — not assumed** · reconciliation for jobs with no terminal outcome · normalized result mapping.

Configuration: `SCRAPING_PROVIDER`, `SCRAPING_API_KEY`, `SCRAPING_BASE_URL`, `SCRAPING_WEBHOOK_SECRET`.
`POST /webhooks/scraping` exists in the frozen contract with **provider-defined verification (`B12-D-B005`)**; until the scheme is decided the endpoint receipts and rejects, and **the connection must never be marked `enabled`**.

## 5. Async and failure

Both adapters run on `providers.slow` (30-minute ceiling). A job whose provider outcome is `unknown` opens a `P-1` case — **never a blind repeat**. Frozen `MAX_JOB_ATTEMPTS` and `MAX_ACTOR_RETRIES_PER_JOB` are architectural bounds, **not outage tuning knobs**, and must not be raised operationally.

## 6. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-DISC-1` **(NC)** | `apps/discovery` package | Grep every signature, model, event and selector for vendor identifiers (`google`, `places`, the scraping vendor name, provider field names) | **Zero matches** — the domain is vendor-free |
| `T-DISC-2` | A stub adapter registered behind `PlaceSearchPort` and `ScrapingProviderPort` | Run the full discovery suite | **Passes unchanged** — no domain module, migration or assertion altered |
| `T-DISC-3` **(NC)** | Two workspaces observing the same provider result | Upsert in each | `(workspace_id, provider_external_id)` unique **per workspace**; no cross-workspace collision or leak |
| `T-DISC-4` **(NC)** | A job whose provider outcome is forced to `unknown` | Run every retry and sweep path | **Opens a `P-1` case and never blindly repeats** the job |
| `T-DISC-5` | `GOOGLE_PLACES_API_KEY` absent | Start the platform; exercise CRM, Customer and Contact flows | Connection `not_connected`; **Places discovery unavailable; every non-Discovery flow unaffected** |
| `T-DISC-6` **(NC)** | Scraping credentials present, **no verification scheme decided** (`B12-D-B005`) | `EnableIntegration` on the scraping connection | **Refused** (`B12-D-A054`); the connection may reach `configuration_required` but **never `enabled`** |
| `T-DISC-7` **(NC)** | Provider returns a payload with fields WazLink does not use | Normalize | **Only `NormalizedBusinessResult` fields are mapped**; no raw payload becomes business truth |
