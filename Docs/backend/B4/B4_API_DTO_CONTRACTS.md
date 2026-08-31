# B4 — API and DTO Contracts

> **B4 status:** Target design only. No endpoint is implemented.

## 1. Operations

`API_OPERATION_COUNT = 7`. None was added merely because it sounded useful — each traces to a frontend behavior in `B4_FRONTEND_TRACEABILITY.md` or a downstream-consumption need in `B4_B2_CRM_LEAD360_BOUNDARY.md`.

### 1.1 `POST /intelligence/analyze` — `requestBusinessIntelligence`

| | |
|---|---|
| Command | `RequestBusinessIntelligence` |
| Permission | `intelligence.run` |
| Idempotency | `Idempotency-Key` required |
| Request | `IntelligenceAnalyzeRequest` |
| Success | `202` → `IntelligenceAdmissionResult` |
| Errors | `400 VALIDATION_ERROR` · `401` · `403 PERMISSION_DENIED` / `ENTITLEMENT_LOCKED` · `404` (per-ID, embedded in the `202` body — see below) · `422 VALIDATION_ERROR` (`batch_size_exceeded`) · `429` (`intelligence_rate_limited`) · `500` |
| Frontend consumer | FB-15, FB-17 (single and batch "analyze" actions) |

A partially-admitted batch (`B4_COST_RATE_LIMIT_MODEL.md` §4) is **not** a `4xx` — it is a `202` whose body enumerates each Business's individual `outcome` (`admitted`/`reused`/`rate_limited`/`not_found`), so the caller sees exactly which IDs succeeded without guessing from a bulk failure code.

### 1.2 `POST /intelligence/reanalyze` — `reanalyzeBusinessIntelligence`

Identical contract to §1.1, command `ReanalyzeBusinessIntelligence`, **except** it never returns `outcome = reused` — every admitted ID always opens a fresh run (`B4_COST_RATE_LIMIT_MODEL.md` §7 bypass). Frontend consumer: FB-16 (retry-after-error).

### 1.3 `POST /intelligence/runs/{id}/cancel` — `cancelIntelligenceRun`

| | |
|---|---|
| Command | `CancelIntelligenceRun` |
| Permission | `intelligence.run` + object scope (creator or `manager`+, mirroring B3's cancel object-scope pattern, `B4_AUTHORIZATION_TENANCY.md` §2) |
| Idempotency | `Idempotency-Key` required |
| Concurrency | `If-Match` on the run `version` |
| Success | `202` → `IntelligenceRunDetail` |
| Errors | `401` · `403` · `404` · `409 CONFLICT` (`run_not_cancellable`) · `409 STALE_VERSION` · `500` |

### 1.4 `GET /businesses/{id}/intelligence` — `getBusinessIntelligence`

| | |
|---|---|
| Permission | `intelligence.view` |
| Success | `200` → `IntelligenceRunDetail`, **nullable body** (`null` if no completed run exists — matches `Lead360.intelligence`'s own nullable contract) |
| Errors | `401` · `403` · `404` (Business not found/foreign workspace — uniform, `B4_AUTHORIZATION_TENANCY.md` §3) |
| Frontend consumer | `Intelligence.tsx` full detail page |

### 1.5 `GET /businesses/{id}/intelligence/summary` — `getBusinessIntelligenceSummary`

Compact projection for cross-domain composition (`B4_B2_CRM_LEAD360_BOUNDARY.md` §1) — `200` → `IntelligenceSummary`, nullable. Same permission/error shape as §1.4. This is the exact shape `Lead360.intelligence` resolves to.

### 1.6 `GET /businesses/{id}/intelligence/history` — `listBusinessIntelligenceHistory`

Cursor-paginated (frozen B0 `PageInfo`), `200` → `IntelligenceRunHistoryList`. No `filters`/`sort` beyond chronological — history is small per Business (bounded by `MAX_RUN_ATTEMPTS`-scale volumes, not Discovery-scale result sets) and does not need the allow-list machinery `B3_PAGINATION_MODEL.md` built for 2000-row result sets.

### 1.7 `GET /intelligence/runs/{id}` — `getIntelligenceRun`

Drill-down from history, `200` → `IntelligenceRunDetail` (identical shape to §1.4, addressed by run rather than by current-Business). `401` · `403` · `404` (uniform).

## 2. Request DTOs

`REQUEST_DTO_COUNT = 2`.

**`IntelligenceAnalyzeRequest`** (shared by §1.1 and §1.2):

| Field | Type | Required | Nullable | Meaning |
|---|---|:--:|:--:|---|
| `business_ids` | `[string]` | yes | no | `BUS-*` refs, 1..20 (`B4-D-A019`) |

**`IntelligenceRunCancelRequest`**:

| Field | Type | Required | Nullable | Meaning |
|---|---|:--:|:--:|---|
| `reason` | `string` | no | — | free-text operator note, audited (`B4_AUTHORIZATION_TENANCY.md` §4), never provider-facing |

## 3. Response DTOs

`RESPONSE_DTO_COUNT = 9`.

**`IntelligenceAdmissionResult`**

| Field | Type | Meaning |
|---|---|---|
| `results` | `[{business_ref, outcome, run_ref (nullable), reason (nullable)}]` | `outcome ∈ {admitted, reused, rate_limited, not_found}` |

**`IntelligenceRunDetail`**

| Field | Type | Req | Nullable | Enum | Meaning | Authority |
|---|---|:--:|:--:|:--:|---|---|
| `run_public_id` | string (`ANL-*`) | ✔ | | | | authoritative |
| `business_ref` | `EntityRef` | ✔ | | | | authoritative |
| `status` | string | ✔ | | 5 states | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §1 | authoritative |
| `completion_kind` | string | | ✔ | `full`\|`partial` | only present when `status=completed` | authoritative |
| `outcome` | string | | ✔ | includes `insufficient_data` | `B4_SCORING_MODEL.md` §6 | authoritative |
| `overall_priority_score` | integer | | ✔ | 0..100 | `null` iff `insufficient_data` | authoritative |
| `tier` | string | | ✔ | `high`\|`good`\|`medium`\|`low` | derived from score | authoritative |
| `confidence` | number | | ✔ | 0..1 | `B4_SCORING_MODEL.md` §7 | authoritative |
| `score_components` | `[ScoreComponent]` | ✔ | | | | authoritative |
| `signals` | `[Signal]` | ✔ | | | | authoritative |
| `recommendations` | `[Recommendation]` | ✔ | | | | authoritative |
| `presentation` | object | | ✔ | | `business_summary`/`why_this_lead`/`suggested_outreach_angle`, each nullable independently | non-authoritative (`B4_RECOMMENDATION_MODEL.md` §5) |
| `insufficient_reason_codes` | `[string]` | | ✔ | closed set | only present when `outcome=insufficient_data` | authoritative |
| `failure_code` | string | | ✔ | closed set | only present when `status=failed` | authoritative |
| `stale` | boolean | ✔ | | | `B4_FRESHNESS_STALENESS.md` §1 | derived |
| `stale_reasons` | `[string]` | | ✔ | | | derived |
| `rerun_suggested` | boolean | ✔ | | | `B4_FRESHNESS_STALENESS.md` §4 | derived |
| `scoring_model_version` | string | ✔ | | | | authoritative |
| `signal_taxonomy_version` | string | ✔ | | | | authoritative |
| `input_snapshot_version` | integer | ✔ | | | | authoritative |
| `created_at`, `completed_at` | date-time | ✔/✎ | ✎ | | | authoritative |
| `version` | integer | ✔ | | | concurrency token | authoritative |

**`IntelligenceSummary`** — `score`, `tier`, `confidence`, `top_signals[≤3]`, `top_risks[≤3]`, `recommended_action` (nullable `Recommendation`), `stale`, `rerun_suggested`, `history_available` (boolean). `additionalProperties: false`, matching the frozen DTO discipline throughout this corpus.

**`IntelligenceRunHistoryList`** — `items: [IntelligenceRunHistoryItem]`, `page_info` (frozen `PageInfo`).

**`IntelligenceRunHistoryItem`** — `run_public_id`, `status`, `outcome`, `overall_priority_score` (nullable), `tier` (nullable), `scoring_model_version`, `completed_at` (nullable).

**`ScoreComponent`** — `component_code`, `score`, `max`, `contributing_signal_ids[]`.

**`Signal`** — `signal_id`, `signal_code`, `category`, `polarity`, `strength`, `source`, `value` (display string), `evidence_refs[]`.

**`Evidence`** — embedded within `Signal`/`Recommendation` responses by `evidence_id` lookup table on `IntelligenceRunDetail.evidence` (a keyed map, not a duplicated array) — `source_type`, `extracted_value`, `observed_at`, `freshness`, `confidence`.

**`Recommendation`** — `recommendation_code`, `priority`, `reason`, `evidence_refs[]`, `confidence`, `valid_until` (`input_snapshot_version` reference).

## 4. What no B4 DTO ever contains

- a raw provider prompt or raw provider response (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §8)
- a provider credential, API key, or internal request header
- another workspace's data, under any field, at any nesting depth (`B4_AUTHORIZATION_TENANCY.md` §3)
- a revenue, price, or probability-of-close field (`B4_DOWNSTREAM_HANDOFFS.md` §5)
