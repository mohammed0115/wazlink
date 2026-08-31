# B3 — Logical Data Model

> **B3 status:** Logical target design. **No SQL DDL, no migration, no Django model is authorized.** Every table below is a target for a later implementation phase. SQL fragments, where they appear, are illustrative notation for a constraint — never executable schema.

Platform conventions inherited from frozen `BACKEND_DATA_MODEL.md`: UUIDv7 `id`, immutable prefixed `public_id`, UTC `created_at`/`updated_at`, optional `archived_at`, `workspace_id` on tenant-owned records, `NUMERIC` for exact values, JSONB only for provider metadata and structured flexible metadata.

## 1. Table inventory

Frozen B0 already names the Discovery group: `discovery_jobs, discovery_queries, discovery_results, businesses, business_identities`. B3 uses those five names unchanged and adds four supporting tables plus one catalogue.

| # | Table | Frozen? | Aggregate | Public ID | Tenant | Rows |
|---:|---|:--:|---|---|:--:|---|
| 1 | `discovery_jobs` | **✔** | DiscoveryJob (root) | `JOB-*` | ✔ | one per submitted search |
| 2 | `discovery_queries` | **✔** | DiscoveryJob | — | ✔ | one per keyword×location |
| 3 | `discovery_query_executions` | add | DiscoveryJob | — | ✔ | one per query per attempt |
| 4 | `provider_page_ingestions` | add | DiscoveryJob | — | ✔ | one per provider page |
| 5 | `discovery_results` | **✔** | DiscoveryJob | `RES-*` | ✔ | one per (execution × Business) |
| 6 | `businesses` | **✔** | Business (root) | `BUS-*` | ✔ | one per real-world business |
| 7 | `business_identities` | **✔** | Business | — | ✔ | one per (provider × external id) |
| 8 | `business_match_candidates` | add | Business | — | ✔ | one per unresolved probable match |
| 9 | `business_merges` | add | Business | — | ✔ | append-only merge audit |
| 10 | `discovery_sources` | add | — (catalogue) | — | **✘** | bounded global catalogue |

Tables 3, 4, 8, 9, 10 are additive and registered as `B3-D-B002`. None is publicly addressable except through its parent, so **no new public-ID prefix is required** (`PUBLIC_ID_COLLISIONS = 0`).

## 2. `discovery_jobs`

Purpose: the aggregate root — one submitted search, its immutable request, and its lifecycle.

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | |
| `public_id` | text | `JOB-*`, immutable, unique per workspace |
| `workspace_id` | UUID FK | NOT NULL |
| `actor_membership_ref` | text | `MEM-*` (B1); the submitter |
| `name` | text | derived display name (`data.js:465`); immutable |
| `provider_source` | text | contract string, not an `EntityRef` |
| `request_keywords_display` | text[] | **immutable** — dispatched forms |
| `request_locations_display` | text[] | **immutable** |
| `request_keywords_norm` | text[] | **immutable** — dedup/identity forms |
| `request_locations_norm` | text[] | **immutable** |
| `request_filters` | JSONB | **immutable**; the closed filter set |
| `result_limit` | integer | **immutable**; ∈ {500,1000,2000} |
| `combination_count` | integer | **immutable**; `= |kw| × |loc|` |
| `request_fingerprint` | text | **immutable** |
| `status` | text | the five states |
| `attempt_no` | integer | starts at 1; incremented by retry |
| `progress` | smallint | 0..100 |
| `found_count`, `duplicate_count`, `deduplicated_count` | integer | the three counters |
| `completion_kind` | text NULL | `full`\|`partial`\|`empty`\|`truncated` |
| `failed_query_count` | integer | |
| `failure_code` | text NULL | closed set |
| `failure_message` | text NULL | safe, translated |
| `quota_reservation_ref` | text NULL | the reserved `discoveryRuns` unit |
| `quota_released_at` | timestamptz NULL | set on release |
| `created_at`, `started_at`, `completed_at`, `cancellation_requested_at` | timestamptz | `B3_JOB_STATE_MACHINE.md` §8 |
| `version` | integer | ADR-010 |

**Constraints and indexes**

- unique `(workspace_id, public_id)`
- **partial unique `(workspace_id, request_fingerprint) WHERE status IN ('pending','processing')`** — duplicate-request suppression against live jobs only (`B3_QUOTA_COST_CONTROL.md` §6)
- check `status IN ('pending','processing','completed','failed','cancelled')`
- check `combination_count = cardinality(request_keywords_norm) * cardinality(request_locations_norm)` — the mock asserts this (`data.js:488`); B3 makes it a database constraint
- check `found_count - duplicate_count = deduplicated_count` — the mock asserts it for completed jobs (`data.js:489`); B3 asserts it always
- check `result_limit IN (500, 1000, 2000)`
- check `progress BETWEEN 0 AND 100`
- **`(workspace_id, status, created_at DESC)`** — the frozen `job/status/created` index
- `(workspace_id, created_at DESC, public_id DESC)` — list cursor
- `(workspace_id, deduplicated_count DESC, created_at DESC)` — the `results` sort
- `(status, updated_at)` — worker scan

Retention: follows workspace retention. A job is never deleted while its `discovery_results` exist.

## 3. `discovery_queries` and `discovery_query_executions`

**`discovery_queries`** — the immutable plan. `id`, `workspace_id`, `job_id` FK cascade, `sequence` (0-based), `keyword_display`, `location_display`, `keyword_norm`, `location_norm`.
Unique `(job_id, keyword_norm, location_norm)`; unique `(job_id, sequence)`; index `(job_id, sequence)`.

**`discovery_query_executions`** — one attempt at one query. `id`, `workspace_id`, `job_id`, `query_id` FK cascade, `attempt_no`, `outcome` (the seven of `B3_JOB_STATE_MACHINE.md` §6, NULL while running), `provider`, `provider_job_id` NULL, **`provider_continuation` NULL**, `pages_fetched`, `result_count`, `error_class` (the ten normalized outcomes), `retry_count`, `lease_expires_at`, `started_at`, `finished_at`.

Unique `(query_id, attempt_no)`; index `(job_id, outcome)`; index `(outcome, lease_expires_at) WHERE outcome IS NULL` for lease reclamation.

> `provider_continuation` and `provider_job_id` are **server-side execution state**. No API response, DTO, event payload, or log line may contain either (`B3-INV-12`, `B3-INV-3`).

## 4. `provider_page_ingestions`

Purpose: one provider page, its evidence, and its cost.

`id`, `workspace_id`, `job_id`, `query_execution_id` FK cascade, `page_index`, `provider`, `provider_request_id`, **`raw_payload_hash`** (always), **`raw_snapshot` JSONB NULL** (only when enabled; PII-excluded; purged at 30 days), `raw_snapshot_expires_at` NULL, `result_count_raw`, `result_count_ingested`, `result_count_rejected`, `outcome_class`, `cost_units NUMERIC NULL`, `latency_ms`, `ingested_at`.

**Unique `(query_execution_id, page_index)`** — the page-idempotency constraint (`B3_IDEMPOTENCY_CONCURRENCY.md` layer 6).
Index `(workspace_id, ingested_at)`; partial index `(raw_snapshot_expires_at) WHERE raw_snapshot IS NOT NULL` for the purge sweep.

`cost_units` is **nullable and never defaulted to zero** — an unknown cost must not read as free (`B3_QUOTA_COST_CONTROL.md` §7).

## 5. `discovery_results`

Purpose: the immutable provenance link. Columns are specified in `B3_ACQUISITION_PROVENANCE.md` §3.

| Constraint | Purpose |
|---|---|
| unique `(workspace_id, public_id)` | `RES-*` identity |
| **unique `(query_execution_id, business_id)`** | provenance idempotency (layer 8) |
| check `workspace_id` equals the job's and the Business's | asserted nightly; `AT-TEN-4` |
| `(workspace_id, job_id, discovered_at DESC, public_id DESC)` | the results cursor |
| `(workspace_id, business_id, discovered_at ASC, public_id ASC)` | the deciding-job rule and `Business.provenance` |
| `(workspace_id, discovered_at)` | analytics |
| partial `(workspace_id, job_id) WHERE filtered = false` | the visible result set |

**Immutable except** `business_id`, which only `MergeBusiness` re-points. There is no other `UPDATE` path and no `DELETE` path.

## 6. `businesses`

Purpose: the canonical normalized record. Fields are specified in `B3_NORMALIZATION_DATA_QUALITY.md` §2.

| Constraint / index | Purpose |
|---|---|
| unique `(workspace_id, public_id)` | `BUS-*` identity |
| `merged_into_business_id` FK → `businesses.id` NULL | tombstone pointer; `L` is never deleted |
| check `merged_into_business_id IS NULL OR archived_at IS NOT NULL` | a merged-away row is always archived |
| `(workspace_id, phone_e164) WHERE phone_e164 IS NOT NULL` | strong-signal matching + the ">5 businesses" guard |
| `(workspace_id, website_domain) WHERE website_domain IS NOT NULL` | same |
| `(workspace_id, name_norm)` trigram | candidate generation **only** — never a merge basis (`B3-INV-6`) |
| `(workspace_id, first_discovered_at DESC)` | analytics |
| `version` integer | ADR-010, internal ordering |

`first_discovered_at` is **write-once**. `provider_source` and `provider_external_id` hold the **anchor** identity and are immutable (`B3_NORMALIZATION_DATA_QUALITY.md` §3).

**Field history.** Superseded provider-asserted values are retained in a `field_history` JSONB column — bounded, per-field, most-recent-N — so provider disagreement stays answerable (`B3_NORMALIZATION_DATA_QUALITY.md` §5.1) without a second table. JSONB is permitted here under the frozen rule allowing it for "provider metadata … structured flexible metadata"; no relationship, state, or ownership is stored in it.

## 7. `business_identities`

Purpose: the many-to-one map from provider identity to Business — the table that makes cross-provider identity possible.

`id`, `workspace_id`, `business_id` FK, `provider`, `provider_external_id`, `link_basis` (`anchor`\|`strong_match`\|`merge`\|`operator`), `link_evidence` JSONB, `linked_at`, `first_seen_at`, `last_seen_at`.

> **Unique `(workspace_id, provider, provider_external_id)`** — `B3-INV-5`.

This makes the frozen constraint *precise*. Frozen `BACKEND_DATA_MODEL.md` reads `workspace/provider_external_id unique`; without `provider` in the key, two providers minting the same opaque string would collapse two unrelated businesses into one. The intent is unchanged — one identity maps to one Business — and the key is corrected to express it (`B3-D-B002`, the same technique B2-D-B002 used for the CRM conversion constraint).

Index `(workspace_id, business_id)`; index `(workspace_id, provider)`.

## 8. `business_match_candidates`

Purpose: a proposed but unapplied cross-provider match. Its existence is what makes "we refuse to auto-merge on weak evidence" visible rather than silent.

`id`, `workspace_id`, `incoming_business_id`, `candidate_business_id`, `classification` (`probable`\|`ambiguous`), `signals` JSONB (which matched, which contradicted, normalized forms), `score_basis`, `status` (`open`\|`merged`\|`rejected`\|`superseded`), `resolved_by_ref` NULL, `resolved_at` NULL, `created_at`.

Unique `(workspace_id, incoming_business_id, candidate_business_id)`; index `(workspace_id, status, created_at DESC)`.

**No row here ever applies itself.** Resolution is an explicit `MergeBusiness` or an explicit rejection (`B3-INV-6`).

## 9. `business_merges`

Purpose: append-only merge audit.

`id`, `workspace_id`, `losing_business_id`, `surviving_business_id`, `actor_ref` NULL (null for system merges), `reason` (`strong_match`\|`operator`\|`correction`), `evidence` JSONB, `identities_moved`, `results_moved`, `results_deduplicated`, `merged_at`.

Index `(workspace_id, merged_at DESC)`; index `(workspace_id, losing_business_id)` — resolves a tombstone to its survivor.

**No `UPDATE`, no `DELETE`.** A correction appends a new row with `reason = 'correction'` (`B3_BUSINESS_IDENTITY_MODEL.md` §6.3).

## 10. `discovery_sources`

Purpose: the bounded global catalogue behind the source dropdown (`data.js:145-149`).

`id` (contract string, e.g. `SRC-1004`), `name`, `type`, `status` (`active`\|`mock`), `dispatchable`, `capabilities` JSONB, `port` (`PlacesProvider`\|`ScrapingProvider`), `created_at`.

**No `workspace_id`** — the documented exception of `B3_AUTHORIZATION_TENANCY.md` §2. **No credential, endpoint, key, or secret column exists**; provider credentials live in the platform secret store (`B3_SECURITY_PRIVACY_LEGAL.md` §4).

## 11. Relationships

```
workspaces ─┬─< discovery_jobs ──< discovery_queries ──< discovery_query_executions
            │        │                                          │
            │        │                                          └──< provider_page_ingestions
            │        └────────────────< discovery_results >──┐
            │                                                 │
            └─< businesses ──< business_identities            │
                    │  ▲                                      │
                    │  └── merged_into_business_id (self)      │
                    ├──< business_match_candidates             │
                    └──< business_merges                       │
                    └───────────────────────────────────────────┘

discovery_sources  (global catalogue; referenced by contract string, no FK)
```

`discovery_results` is the many-to-many join between the bounded Job aggregate and the open-ended Business aggregate — the structural reason multi-job provenance is representable at all.

**FK behaviour.** `discovery_queries`, `discovery_query_executions`, `provider_page_ingestions` cascade from their job — deleting a job removes its execution machinery. `discovery_results` uses **restrictive** behaviour against both `discovery_jobs` and `businesses`: provenance is append-only evidence and must not disappear because a parent was removed. `businesses` is never hard-deleted; merge archives it as a tombstone.

## 12. Retention

| Data | Retention |
|---|---|
| `discovery_jobs`, `discovery_queries`, `discovery_results` | workspace retention — **product/legal decision required** (frozen ADR-012) |
| `businesses`, `business_identities` | workspace retention; contact fields nullable on a deletion request while provenance survives (`B3_ACQUISITION_PROVENANCE.md` §7) |
| `business_merges` | retained as long as either Business is retained — audit |
| `provider_page_ingestions` **metadata** | operational retention, bounded |
| `provider_page_ingestions.raw_snapshot` | **30 days**, then purged (`B3-X-007`) |
| `discovery_query_executions` | operational retention, bounded; older attempts prunable without touching provenance |

Every table already carries the timestamp a retention policy would need, so setting the durations later requires no schema change.

## 13. What this model deliberately does not contain

| Absent column | Why |
|---|---|
| `businesses.lead_id` / `converted` / `converted_at` | `B3-INV-2` — CRM state is B2's; a reverse pointer would duplicate it |
| `businesses.score` / `tier` / `confidence` / `signals` | `B3-INV-16` — B4's |
| `businesses.discovery_job_id` | replaced by `discovery_results` (`B3_ACQUISITION_PROVENANCE.md` §2) |
| `discovery_sources.api_key` / `endpoint` / `secret` | credentials never live in a domain table |
| any table storing a provider page token as durable public state | `B3-INV-12` |
| a CRM quarantine or timeline table | `B3-INV-14`; B2 introduced none and B3 introduces none |
| a B3-owned retry, dead-letter, or queue table | `B3_RETRY_FAILURE_MODEL.md` §6 — B12's |
