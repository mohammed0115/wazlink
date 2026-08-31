# B3 — API and DTO Contracts

> **B3 status:** Target design only. No route is implemented. Three operations exist in frozen `BACKEND_OPENAPI_V1.yaml`; five are additive and are registered in `B3_CONTROLLED_AMENDMENTS.md`. **B3 applies no amendment.**

## 1. The operation set — 8

Derived from the frozen frontend's needs, not copied from a template. Each row states the frontend behavior that requires it; an operation with no such driver was not created.

| # | Method | Route | operationId | Status | Frozen? | Driven by |
|---:|---|---|---|---|:--:|---|
| 1 | `POST` | `/api/v1/discovery/jobs` | `createDiscoveryJob` | **frozen** | ✔ | `Discovery.tsx:204` |
| 2 | `GET` | `/api/v1/discovery/jobs/{id}` | `getDiscoveryJob` | **frozen** | ✔ | `DiscoveryJob.tsx` detail + progress |
| 3 | `GET` | `/api/v1/discovery/jobs/{id}/results` | `listDiscoveryResults` | **frozen** | ✔ | `DiscoveryResults.tsx` |
| 4 | `GET` | `/api/v1/discovery/jobs` | `listDiscoveryJobs` | **additive** | | `DiscoveryJobs.tsx:17-43` |
| 5 | `POST` | `/api/v1/discovery/jobs/{id}/retry` | `retryDiscoveryJob` | **additive** | | `DiscoveryJobs.tsx:49-53`, `DiscoveryJob.tsx:68-72` |
| 6 | `POST` | `/api/v1/discovery/jobs/{id}/cancel` | `cancelDiscoveryJob` | **additive** | | `DiscoveryModal.tsx:75-86` |
| 7 | `GET` | `/api/v1/discovery/sources` | `listDiscoverySources` | **additive** | | `Discovery.tsx:298-307`, `DiscoveryJobs.tsx:90-97` |
| 8 | `GET` | `/api/v1/businesses/{id}` | `getBusiness` | **additive** | | `DiscoveryModal.tsx:90-131` |

`API_OPERATION_COUNT = 8`.

**Operations deliberately not created**, because no frontend behavior and no domain need requires them: a job progress endpoint (progress is a field on operation 2 — a second round trip for one integer is waste); a business list (Businesses are reached through a job's results or a CRM Lead); per-query-execution routes (executions are nested in operation 2); any provider-diagnostic route (§6); any create/update/delete on a Business (`B3_NORMALIZATION_DATA_QUALITY.md` §2); any merge route (merge is an internal/operator command, not a tenant API).

## 2. Operation contracts

### 2.1 `POST /discovery/jobs` — `createDiscoveryJob`

| | |
|---|---|
| Auth | session (ADR-009) + CSRF |
| Permission | `discovery.run` |
| Entitlement | `discovery.basic` + `discoveryRuns` |
| Idempotency | **`Idempotency-Key` required** |
| Request | `DiscoveryJobCreate` |
| Success | **`202`** → `DiscoveryJob` (frozen status; "returns a Job resource and never claims results are complete") |
| Errors | `400` `VALIDATION_ERROR` · `401` `AUTH_REQUIRED` · `403` `PERMISSION_DENIED` / `ENTITLEMENT_LOCKED` / `QUOTA_EXHAUSTED` · `409` `CONFLICT` (duplicate fingerprint) / `IDEMPOTENCY_CONFLICT` · `422` `VALIDATION_ERROR` (source not dispatchable) · `429` + `Retry-After` · `500` · `502` |
| Concurrency | none — creation |

The frozen operation already declares exactly `400/401/403/409/429/500/502`. `422` is the one addition, for the semantic source-dispatchability rejection (`B3-D-B001`).

### 2.2 `GET /discovery/jobs/{id}` — `getDiscoveryJob`

Permission `discovery.view`. `200` → `DiscoveryJob`; `401`; `404` (absent **or** foreign); `500`; `502`. No pagination, no idempotency, no version header — reads do not mutate.

### 2.3 `GET /discovery/jobs/{id}/results` — `listDiscoveryResults`

Permission `discovery.view`. Cursor-paginated (`cursor`, `limit`).

| Job state | Response |
|---|---|
| `completed` | `200` → `DiscoveryResultList` |
| `pending` / `processing` / `failed` / `cancelled` | `409 CONFLICT`, `details.reason = "results_not_available"`, `details.job_status` |
| absent or foreign | `404 ENTITY_NOT_FOUND` |

The `404` check precedes the `409` check (`B3_AUTHORIZATION_TENANCY.md` §4). `409` is additive to the frozen response set (`B3-D-B001`) and is what makes `B3-INV-8` enforceable server-side rather than trusted to the client.

No `filters` or `sort` (`B3_PAGINATION_MODEL.md` §3).

### 2.4 `GET /discovery/jobs` — `listDiscoveryJobs`

Permission `discovery.view`. Cursor-paginated. Accepts the allow-listed `filters` and `sort` of `B3_PAGINATION_MODEL.md` §5. `200` → `DiscoveryJobList`; `400` on an unknown filter key, value, or sort key; `401`; `500`.

### 2.5 `POST /discovery/jobs/{id}/retry` — `retryDiscoveryJob`

| | |
|---|---|
| Permission | `discovery.run` |
| Idempotency | `Idempotency-Key` required |
| Concurrency | **`If-Match` on the job `version`** (ADR-010) |
| Request | `DiscoveryJobRetryRequest` |
| Success | **`202`** → `DiscoveryJob` (the job is back in `pending`) |
| Errors | `401` · `403 PERMISSION_DENIED` · `404` · `409 CONFLICT` (`details.reason = "job_not_retryable"`, `details.job_status`) · `409 CONFLICT` (`details.reason = "attempt_limit_reached"`, `details.attempt_no`, `details.max_job_attempts`) · `409 STALE_VERSION` · `429` (`details.reason = "actor_retry_rate_limited"`, `Retry-After`) · `500` |

Retryable only from `failed` or `cancelled`. A retry of a `completed` job is `409 job_not_retryable` — matching the frozen frontend, which offers retry for exactly `["failed","cancelled"]`. **No quota is consumed** (`B3-INV-10`).

**Bounded to `MAX_JOB_ATTEMPTS = 3`** (`B3-D-A031`). A retry of a job already at `attempt_no = 3` is `409 attempt_limit_reached`, rejected before any execution is claimed, any provider is called, or any quota/provider-cost side effect occurs — the same architectural bound that closes `create → execute → cancel → retry` as an unbounded-cost loop (`B3_JOB_STATE_MACHINE.md` §3.2, `B3_QUOTA_COST_CONTROL.md` §5.1).

**Bounded to `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`** (`B3-D-A032`, B3-FIX.2). Independent of the `attempt_limit_reached` check above and evaluated immediately after it: once a workspace has 10 successfully admitted `RetryDiscoveryJob` operations within the current rolling hour, the 11th is `429` with `details.reason = "actor_retry_rate_limited"`, reusing frozen B0's generic `RateLimited` response — no new error code — rejected before `attempt_no` increments and before any provider-facing side effect (`B3_JOB_STATE_MACHINE.md` §3.2.1). A request replayed under the same `Idempotency-Key` as an already-admitted retry consumes no second slot.

### 2.6 `POST /discovery/jobs/{id}/cancel` — `cancelDiscoveryJob`

| | |
|---|---|
| Permission | `discovery.run` + object scope (`B3_AUTHORIZATION_TENANCY.md` §3.1) |
| Idempotency | `Idempotency-Key` required |
| Concurrency | `If-Match` on the job `version` |
| Request | `DiscoveryJobCancelRequest` |
| Success | `200` → `DiscoveryJob` (now `cancelled`) |
| Errors | `401` · `403` · `404` · `409 CONFLICT` (`details.reason = "job_already_terminal"`) · `409 STALE_VERSION` · `500` |

`200`, not `202`: the state transition is synchronous and committed before the response. Execution drain is asynchronous, but the *cancellation* is a fact by the time the client is answered.

### 2.7 `GET /discovery/sources` — `listDiscoverySources`

Permission `discovery.view`. A bounded global catalogue — **no pagination**, per ADR-011. `200` → `DiscoverySourceList`; `401`; `500`.

### 2.8 `GET /businesses/{id}` — `getBusiness`

Permission `discovery.view`. `200` → `Business` (the frozen schema, unchanged); `401`; `404`. A merged-away `BUS-*` returns `200` with `provenance.merged_into_ref` set, so historical references stay resolvable (`B3_BUSINESS_IDENTITY_MODEL.md` §6.2).

## 3. Request DTOs — 3

### 3.1 `DiscoveryJobCreate` *(amends the frozen schema)*

| Field | Type | Req | Constraint |
|---|---|:--:|---|
| `keywords` | `[string]` | **yes**, unless `query` is supplied alone (§3.1.2) | 1..10, each 1..120 chars after normalization |
| `locations` | `[string]` | **yes**, unless `query` is supplied alone (§3.1.2) | 1..10, each 1..120 chars after normalization |
| `query` | `string` | no — **deprecated compatibility alias** | frozen field, retained; single-combination only; see §3.1.2 for exact resolution rules |
| `provider_source` | `string` | **no** | a known dispatchable source (frozen field, frozen requiredness — **not** in frozen `required: [query]`, and B3 does not add it); if omitted, resolved per §3.1.3 |
| `filters` | `DiscoveryFilters` | no | the closed set of §3.1.4 |
| `result_limit` | `integer` | no | ∈ {500, 1000, 2000}, default 2000 |

Cross-field: `|keywords| × |locations| ≤ 50` after duplicate collapse, over the *canonical* K/L set resolved per §3.1.2.

**This is a non-additive, compatibility-breaking-at-schema-requiredness change, stated plainly rather than labeled additive.** Frozen `BACKEND_OPENAPI_V1.yaml` declares `DiscoveryJobCreate` as `{ query: string, provider_source: string }` with `required: [query]`. B3's target `required` set is `[keywords, locations]` — `query` moves from required to an optional deprecated alias. This changes what a conformant request must contain; it is made **additive in effect**, not additive in schema, by the deterministic compatibility rule of §3.1.2: `query` is retained (not removed), a `query`-only request continues to be accepted, and `DiscoveryJob.query` in the response continues to be populated (§4.1) so the frozen response `required: [public_id, status, query]` remains satisfiable. **`query` cannot express K keywords × L locations** — the frontend's central capability (`Discovery.tsx:264-294`, helper text at `:269`) — so replacing it as the primary input is unavoidable; this is registered as `B3-D-B001` and stated here, not buried in a schema diff.

#### 3.1.2 The `query` compatibility rule — deterministic for every combination

A scalar `query` cannot reconstruct an arbitrary K×L plan, so B3 does not attempt to derive multiple keywords or locations from it. The rule is total over every input shape a client can send:

| Input | Resolution | Result |
|---|---|---|
| `keywords[]` + `locations[]`, no `query` | **canonical.** `query` is ignored because it is absent | the K×L plan the arrays describe |
| `query` only, no `keywords`/`locations` | **legacy single-combination.** `keywords = [query]`, `locations` is **required** — omitting it is `400 VALIDATION_ERROR`, `details.field = "locations"` | exactly one combination: `(query, locations[0])` if `locations` has one entry, or the K×L product if the caller also sends multiple `locations` alongside a scalar `query` acting as the sole keyword |
| `query` + `keywords[]` + `locations[]` (all three) | **conflicting sources of truth — rejected**, not silently resolved by precedence | `400 VALIDATION_ERROR`, `details.reason = "query_and_arrays_conflict"`, `details.field = "query"` — the client must send either the legacy scalar or the canonical arrays, never both |
| `query` + `keywords[]` only (no `locations`) | **rejected**, same conflict rule — `query` cannot silently supply the missing `locations` axis, and mixing a legacy scalar with one canonical array invents a cross-format meaning this design refuses to guess | `400 VALIDATION_ERROR`, `details.reason = "query_and_arrays_conflict"` |
| `query` + `locations[]` only (no `keywords`) | same conflict rule | `400 VALIDATION_ERROR`, `details.reason = "query_and_arrays_conflict"` |
| `query` empty/blank, no arrays | fails normalization step 5 like any blank keyword | `400 VALIDATION_ERROR`, `details.field = "keywords[0]"` |
| `keywords: []` or `locations: []`, no `query` | fails the existing 1..10 bound | `400 VALIDATION_ERROR`, `details.field = "keywords"` or `"locations"` |

**Why "both present" is rejected rather than prioritized.** A precedence rule (e.g. "arrays win") would let a client send a stale `query` that silently disagrees with `keywords`/`locations` and never find out — exactly the two-competing-sources-of-truth failure mode §13 of this repair exists to close. Rejecting the ambiguous case keeps `DiscoveryJobCreate` with exactly one deterministic source of K×L truth per request, and it does not weaken the K×L contract the frozen frontend already relies on: the frontend never sends `query` at all (`Discovery.tsx` builds `keywords[]`/`locations[]` directly), so this rule is reached only by a legacy or hand-built caller.

#### 3.1.3 `provider_source` omission — resolved without inventing a second default

`provider_source` is optional (§3.1), matching frozen `BACKEND_OPENAPI_V1.yaml`'s `required: [query]`, which never listed it. B3 defines no automatic multi-source selection policy — no B3 document names one, and inventing a "pick the cheapest/best provider" algorithm here would be exactly the kind of guessed behavior this package refuses to add. The admission-time rule is therefore the one already implied by "a known dispatchable source" (§8 step 6) plus the closed `discovery_sources` catalogue:

| Condition | Resolution |
|---|---|
| `provider_source` supplied | resolved and validated as today — `422 source_not_dispatchable` if unknown or `status="mock"` |
| `provider_source` omitted, exactly **one** dispatchable (`status="active"`) source exists in the catalogue | that source is used — the omission is unambiguous, not a guess |
| `provider_source` omitted, **more than one** dispatchable source exists | `400 VALIDATION_ERROR`, `details.field = "provider_source"` — B3 does not choose on the caller's behalf |
| `provider_source` omitted, **zero** dispatchable sources exist | `422 VALIDATION_ERROR`, `details.reason = "source_not_dispatchable"`, matching the existing unknown-source outcome |

This keeps the field schema-optional exactly as frozen, requires no new default-selection business logic, and fails closed (a validation error, never a silent guess) the one time omission would actually be ambiguous.

#### 3.1.4 `DiscoveryFilters`

`min_rating` ∈ {`any`,`4`,`4.5`} · `min_reviews` ∈ {`any`,`50`,`100`,`500`} · `website` ∈ {`any`,`yes`,`no`} · `activity` ∈ {`any`,`active`,`open`} · `has_phone`, `has_email`, `has_whatsapp`, `has_instagram` : boolean. All optional; every value allow-listed; unknown key or value → `400`.

### 3.2 `DiscoveryJobRetryRequest`

| Field | Type | Req |
|---|---|:--:|
| `version` | `integer` | yes, unless `If-Match` carries it |

### 3.3 `DiscoveryJobCancelRequest`

| Field | Type | Req |
|---|---|:--:|
| `version` | `integer` | yes, unless `If-Match` carries it |
| `reason` | `string` | no, ≤ 200 chars, stored for audit |

`REQUEST_DTO_COUNT = 3`.

## 4. Response DTOs — 9

### 4.1 `DiscoveryJob` *(amends the frozen schema — additive)*

| Field | Type | Frozen? | Notes |
|---|---|:--:|---|
| `public_id` | `JOB-*` | ✔ req | |
| `status` | enum(5) | ✔ req | `B3_JOB_STATE_MACHINE.md` §2 |
| `query` | string | ✔ req | retained **for frozen-contract compatibility only** — see the note below; **not** an execution input |
| `provider_source` | string | ✔ | |
| `counts` | object | ✔ | `{found, duplicate, deduplicated}` — the frozen field, given a shape |
| `started_at` | date-time? | ✔ | |
| `completed_at` | date-time? | ✔ | null for a cancelled job |
| `error_code` | string? | ✔ | the closed `failure_code` set |
| `keywords` | `[string]` | **add** | display forms |
| `locations` | `[string]` | **add** | display forms |
| `filters` | `DiscoveryFilters` | **add** | echoed as admitted |
| `result_limit` | integer | **add** | |
| `combination_count` | integer | **add** | `= |keywords| × |locations|` |
| `progress` | integer 0..100 | **add** | |
| `completion_kind` | enum? | **add** | `full`\|`partial`\|`empty`\|`truncated` |
| `failed_query_count` | integer | **add** | |
| `query_executions` | `[DiscoveryQueryStatus]` | **add** | per-combination outcomes |
| `created_at` | date-time | **add** | |
| `version` | integer | **add** | ADR-010 |
| `name` | string | **add** | derived display name |

Every addition is **additive**: no frozen property is removed or retyped, and the frozen `required` set (`public_id`, `status`, `query`) is unchanged.

**Three fields that could be confused, disambiguated.** `DiscoveryJob.query`'s B3 semantics are **not** the frozen contract's semantics: frozen B0 predates `keywords`/`locations` and treated `query` as the search input; B3 makes `keywords`/`locations` the sole authoritative execution input (§3.1), so a property named `query` remaining on the response schema needs an explicit role or it silently becomes a second, competing source of truth.

| Field | Role | Authoritative execution input? |
|---|---|:--:|
| `keywords`, `locations` | the normalized display-form arrays actually dispatched to the provider and expanded into the query plan (`B3_DISCOVERY_REQUEST_MODEL.md` §2, §5) | **yes** — the only one |
| `name` | the current, forward-looking derived display string (`data.js:465`'s formula, generalized to K×L: `"<keyword[0]> — <location[0]>[ + N combinations]"`) | no — display only |
| `query` | a **frozen-contract compatibility projection**, populated with the same derived string as `name` so the frozen `required: [public_id, status, query]` stays satisfiable for a client that has not adopted `keywords`/`locations`/`name` | no — legacy display only, never read by B3 to decide what to search |

No implementation may branch on `DiscoveryJob.query` to decide what a job searches for; `keywords` and `locations` are the only inputs the query-expansion and execution-plan logic of `B3_DISCOVERY_REQUEST_MODEL.md` §5–§6 ever reads.

### 4.2 `DiscoveryQueryStatus`

`keyword`, `location`, `sequence`, `outcome` (the seven of `B3_JOB_STATE_MACHINE.md` §6), `result_count`, `pages_fetched`, `attempt_count`. **No provider error string** (`B3-INV-3`).

### 4.3 `DiscoveryJobListItem`

`public_id`, `name`, `provider_source`, `keyword_count`, `location_count`, `status`, `counts.deduplicated`, `created_at`, `progress`. Exactly the frozen list columns (`DiscoveryJobs.tsx:105-114`) — the list DTO is smaller than the detail DTO on purpose, since a job log must not carry 50 execution rows per line.

### 4.4 `DiscoveryJobList`
`{ items: [DiscoveryJobListItem], page_info: PageInfo }` — frozen `PageInfo`.

### 4.5 `DiscoveryResult` *(amends the frozen schema — additive)*

Frozen: `public_id` (req), `job_ref` (req), `business_ref`, `name` (req), `source`.
Added: `discovered_at`, `keyword`, `location`, `category`, `city`, `phone`, `website`, `email`, `instagram`, `rating`, `review_count`, `whatsapp_available`, `data_quality_level`.

Driven by the frozen results table (`DiscoveryResults.tsx:340-372`) and the export columns (`data.js:37-41`). `name` remains the historical `result_name_at_discovery`; live values come from `business_ref`.

### 4.6 `DiscoveryResultList`
Frozen, unchanged: `{ items, page_info }`.

### 4.7 `Business`
**Frozen, unchanged.** Multi-identity and job provenance are carried inside the already-unconstrained `provenance` object (`B3_NORMALIZATION_DATA_QUALITY.md` §3), so no amendment is required.

### 4.8 `DiscoverySource`
`id` (the contract string), `name`, `type`, `status` ∈ {`active`,`mock`}, `dispatchable`, `capabilities` (the booleans of `B3_PROVIDER_ABSTRACTION.md` §3.1). **No endpoint, credential, quota, or vendor detail.**

### 4.9 `DiscoverySourceList`
`{ items: [DiscoverySource] }` — no `page_info`; a bounded catalogue.

`RESPONSE_DTO_COUNT = 9`.

## 5. What no B3 DTO may contain

| Never exposed | Why |
|---|---|
| raw provider payload, or any fragment | `B3-INV-3`; frozen privacy classification |
| provider endpoint, header, HTTP status, or error string | `B3-INV-3` |
| provider credential or webhook secret | frozen B0 security |
| **provider continuation / page token** | `B3-INV-12` |
| provider job ID | provider vocabulary |
| internal UUID primary key | ADR-006 — public IDs only |
| internal queue, task, or worker ID | queue mechanics are not a contract |
| another workspace's existence | `B3_AUTHORIZATION_TENANCY.md` §4 |
| AI score, confidence, tier, or signal | `B3-INV-16` — B4 owns these |
| Lead reference or CRM state | `B3-INV-2` |

## 6. No provider-diagnostics endpoint

The brief asks whether one should exist. **It should not.** Everything a tenant legitimately needs — which combination failed, how many pages were fetched, how many results arrived — is already in `DiscoveryQueryStatus` in safe, normalized form. Everything else is provider vocabulary that `B3-INV-3` forbids crossing the boundary.

Operator diagnostics (provider request IDs, raw snapshots) live in the observability plane behind an operator permission, not in the tenant API (`B3_OBSERVABILITY.md` §5).

## 7. Transport conformance

All eight operations follow the frozen `BACKEND_API_STANDARD.md`: `/api/v1/`, `snake_case`, prefixed public IDs, UTC ISO-8601 with `Z`, explicit nulls, `request_id` on every response, session auth with no `security: []`, CSRF on unsafe requests, `Idempotency-Key` on every durable mutation, `If-Match` on both versioned updates, cursor pagination on both high-volume collections, the frozen error envelope, and `202` for asynchronous submission — the frozen "POST → 202 Job resource → GET status/result" pattern, which Discovery follows exactly.
