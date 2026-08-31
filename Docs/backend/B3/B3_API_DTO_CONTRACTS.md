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
| Errors | `401` · `403 PERMISSION_DENIED` · `404` · `409 CONFLICT` (`details.reason = "job_not_retryable"`, `details.job_status`) · `409 STALE_VERSION` · `429` · `500` |

Retryable only from `failed` or `cancelled`. A retry of a `completed` job is `409 job_not_retryable` — matching the frozen frontend, which offers retry for exactly `["failed","cancelled"]`. **No quota is consumed** (`B3-INV-10`).

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
| `keywords` | `[string]` | **yes** | 1..10, each 1..120 chars after normalization |
| `locations` | `[string]` | **yes** | 1..10, each 1..120 chars after normalization |
| `provider_source` | `string` | **yes** | a known dispatchable source (frozen field) |
| `filters` | `DiscoveryFilters` | no | the closed set of §3.1.1 |
| `result_limit` | `integer` | no | ∈ {500, 1000, 2000}, default 2000 |

Cross-field: `|keywords| × |locations| ≤ 50` after duplicate collapse.

The frozen schema has `query: string` (required) plus `provider_source`. **`query` cannot express K keywords × L locations**, which is the frontend's central capability (`Discovery.tsx:264-294`, helper text at `:269`), so replacing it is unavoidable — registered as `B3-D-B001` with `query` retained as a deprecated single-combination alias so the change is additive in effect: a request carrying only `query` is interpreted as `keywords=[query]`, `locations` required.

#### 3.1.1 `DiscoveryFilters`

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
| `query` | string | ✔ req | retained; the derived display name (`data.js:465`) |
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
