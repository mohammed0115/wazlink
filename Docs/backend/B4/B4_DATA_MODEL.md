# B4 — Data Model

> **B4 status:** Target design only. Conceptual relational model. No migrations, no DDL, no SQL implementation.

## 1. Access boundary

| Table set | B4 access |
|---|---|
| B3 (`businesses`, `business_identities`, `discovery_results`) | **read-only** |
| B2 (`leads`, and friends) | **no access** — B4 resolves `lead → business` only via the `EntityRef`/`business_id` B2 already exposes through its own contracts, never by joining B2's tables directly |
| B4's own tables (§2) | full read/write |

## 2. Tables

### `intelligence_runs`

The primary table. One row per `IntelligenceRun` (`B4_DOMAIN_OWNERSHIP.md` §2). **Supersedes and renames** frozen B0's `lead_intelligence_analyses` (`B4_CONTROLLED_AMENDMENTS.md` item 1).

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK |
| `public_id` | `ANL-*` | immutable, registry-promoted (§5) |
| `workspace_id` | UUID FK | required, tenant-owned |
| `business_id` | UUID FK → `businesses.id` | `ON DELETE RESTRICT` — mirrors B2's `leads.business_id` pattern exactly |
| `status` | enum(5) | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §1 |
| `completion_kind` | enum(2), nullable | `full`\|`partial` |
| `outcome` | enum, nullable | includes `insufficient_data` |
| `overall_priority_score` | integer, nullable | 0..100 |
| `tier` | enum(4), nullable | |
| `confidence` | numeric(3,2), nullable | 0..1 |
| `score_components` | JSONB | embedded `[ScoreComponent]` |
| `signals` | JSONB | embedded `[Signal]`, each carrying inline `Evidence` |
| `recommendations` | JSONB | embedded `[Recommendation]` |
| `presentation` | JSONB, nullable | embedded artifact group |
| `insufficient_reason_codes` | JSONB array, nullable | |
| `failure_code` | enum, nullable | |
| `input_snapshot` | JSONB | `B4_INPUT_SNAPSHOT_MODEL.md` §2, local layer |
| `input_snapshot_version` | integer | |
| `input_hash` | text | |
| `scoring_model_version` | text | |
| `signal_taxonomy_version` | text | |
| `is_current` | boolean | `B4_IDEMPOTENCY_CONCURRENCY.md` §4 |
| `attempt_no` | integer | automatic-attempt counter within this run (`MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST`) — **not** a re-analysis counter; re-analysis always creates a new row |
| `version` | integer | optimistic-concurrency token (ADR-010) |
| `created_at`, `started_at`, `completed_at` | timestamptz | |
| `requested_by_ref` | `MEM-*` | actor who admitted this run |
| `idempotency_key_ref` | text | |

**Constraints:** unique `(business_id) WHERE is_current` (partial unique — at most one current run per Business); index `(workspace_id, business_id, created_at DESC)`; index `(workspace_id, status)`; unique `(business_id, input_hash) WHERE status = 'completed' AND is_current` (supports the reuse lookup, `B4_COST_RATE_LIMIT_MODEL.md` §7, in one indexed query).

### `ai_usage_records`

Frozen B0 name, **kept unchanged** (`B4_CONTROLLED_AMENDMENTS.md` item 1 only touches `lead_intelligence_analyses`, not this table).

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal only, no public ID |
| `workspace_id` | UUID FK | required |
| `run_id` | UUID FK → `intelligence_runs.id` | `ON DELETE CASCADE` — usage telemetry has no meaning detached from its run |
| `provider` | text | |
| `model_identifier` | text | |
| `provider_model_version` | text, nullable | |
| `task_type` | enum(2) | `structured_extraction`\|`presentation_generation` |
| `outcome` | enum | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §3 |
| `input_tokens`, `output_tokens` | integer, nullable | |
| `cost_units` | numeric, nullable | **never defaulted to 0** |
| `latency_ms` | integer | |
| `prompt_policy_version`, `structured_output_schema_version` | text | |
| `provider_request_id` | text, nullable | operator-only surface |
| `attempt_sequence` | integer | which of the ≤3 automatic attempts this was |
| `created_at` | timestamptz | |

**Constraints:** unique `(run_id, attempt_sequence, task_type)` (idempotency layer 3, `B4_IDEMPOTENCY_CONCURRENCY.md` §1); index `(workspace_id, created_at)`.

### Global catalogues (no `workspace_id` — `B4-D-A028` exception)

| Table | Purpose |
|---|---|
| `signal_definitions` | the versioned registry backing `B4_SIGNAL_TAXONOMY.md` §4 |
| `recommendation_definitions` | the versioned registry backing `B4_RECOMMENDATION_MODEL.md` §3 |
| `scoring_model_versions` | the versioned weight/threshold table backing `B4_SCORING_MODEL.md` §1–§2 |

No migrations are authorized by this design; these three are described only to the extent needed to justify §5's public-ID and tenancy decisions.

## 3. Why `Signal`/`Recommendation`/`Evidence` are embedded JSONB, not separate tables

An `IntelligenceRun` is immutable once terminal (`B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §2). Nothing ever updates one signal in place, joins across runs, or queries "all signals of code X across every Business" as a first-class operation in this design. A normalized table would buy referential-integrity machinery this model never exercises, at the cost of an extra join on every read of the single most frequently read shape (`GET /businesses/{id}/intelligence`). Embedding is the correct default here — the same reasoning `B3_DATA_MODEL.md` applies to `DiscoveryResult`'s per-observation fields.

## 4. Retention

| Data | Retention |
|---|---|
| `intelligence_runs` (including embedded signals/recommendations/presentation) | workspace retention — **product/legal decision required**, same posture as B3's Discovery retention (`B3_DATA_MODEL.md` §12, frozen ADR-012) — `B4-D-C004` |
| `ai_usage_records` | operational retention, bounded — telemetry, not evidence a user-facing claim depends on |
| raw provider prompt/response | **never retained**, at any duration — `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §8. There is no flag to enable it, unlike B3's bounded-snapshot-under-a-flag policy for raw provider payloads — B4's structured extraction always produces a normalized value worth keeping; there is no diagnostic case here as compelling as B3's page-ingestion debugging need, so the simpler "never" rule is chosen deliberately, not by oversight |
| global catalogue tables (`signal_definitions`, etc.) | permanent, versioned — deleting a historical version would break §`B4_SCORING_MODEL.md` §8's auditability guarantee for old runs |

## 5. Public ID / code registry

> Reuse frozen prefixes where already registered. `ANL-*` already exists in `BACKEND_PUBLIC_ID_REGISTRY.md` — Section B, not independently addressable ("`ANL-1042` lead analysis — `lead_intelligence_analyses` is reached through `Lead360.intelligence`, not by public-ID reference").

B4's design genuinely needs `ANL-*` to be independently addressable — `GET /intelligence/runs/{id}` (`B4_API_DTO_CONTRACTS.md` §1.7) and the history drill-down both require it. This is **not a new prefix** — it is a reclassification, proposed as a controlled amendment (`B4_CONTROLLED_AMENDMENTS.md` item 5), not adopted silently:

| | Frozen (Section B) | B4 target (Section A) |
|---|---|---|
| Reachability | only through `Lead360.intelligence`, embedded | directly addressable, `GET /intelligence/runs/{id}` |
| Owning domain | (unowned — fixture-only) | Intelligence (B4) |
| Uniqueness | n/a | workspace-scoped |

`SIG-*` and `OPP-*` remain in Section B, **unchanged** — `Signal` and `Recommendation` stay embedded, reached only through the owning run's response, never independently addressable (`B4_DOMAIN_OWNERSHIP.md` §2). No amendment is needed for either.

```
NEW_PUBLIC_ID_PREFIXES = 0   (ANL- already exists; this is a reclassification, not a new prefix)
NEW_PERMISSION_CODES = 2     (intelligence.view, intelligence.run — B4_AUTHORIZATION_TENANCY.md §1)
NEW_ERROR_CODES = 0
```
