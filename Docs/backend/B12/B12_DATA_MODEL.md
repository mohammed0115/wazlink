# B12 — Data Model

> Design only. **No migration is written.** Conceptual schema for eight tables. Three are frozen names (`outbox_events`, `webhook_receipts`, `worker_executions` — `BACKEND_DATA_MODEL.md` lines 26–27); five are additive under `B12-AM-002`.

## 0. Platform conventions inherited

Per frozen `BACKEND_DATA_MODEL.md` and `BACKEND_DATA_GOVERNANCE.md`: internal UUIDv7 `id`; UTC `created_at`/`updated_at`; `snake_case`; explicit FK deletion policy; `workspace_id` on every tenant-owned record. JSONB appears only for the permitted "structured flexible metadata" purpose (evidence and normalized payload projections), never for relationships, state, or ownership. Frozen line 10 additionally states that *"webhook receipt records are append-oriented and are not casually deleted"* — honored in §2.

## 1. `outbox_events` (frozen table name)

Frozen constraint note: *"dispatch/status/time."*

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `event_id` | uuid (v7) | no | **the envelope identity consumers dedup on**; unique |
| `workspace_id` | uuid | no | FK → `workspaces` |
| `event_type` | text | no | e.g. `PaymentSucceeded` |
| `schema_version` | integer | no | `B12_ASYNC_EXECUTION_MODEL.md`; default 1 |
| `source_type` | text | no | opaque owning-aggregate kind |
| `source_ref` | text | no | opaque public ID — **deliberately not an FK** (polymorphic house pattern) |
| `payload` | jsonb | no | **references + immutable facts only** (`B12_SECURITY_PRIVACY.md` §3) |
| `occurred_at` | timestamptz | no | domain time |
| `correlation_id`, `causation_id` | text | no / yes | propagated unchanged |
| `status` | text | no | `pending`\|`dispatching`\|`dispatched`\|`failed`\|`dead_lettered` |
| `dispatch_attempts` | integer | no | default 0 |
| `next_attempt_at` | timestamptz | yes | backoff |
| `lease_owner`, `lease_expires_at` | text / timestamptz | yes | crash detection |
| `lease_token` | uuid (v7) | yes | **the fencing token**, regenerated on **every** claim. A completion write must match it (`B12-D-A055`, `B12_OUTBOX_MODEL.md` §3a) |
| `dispatched_at` | timestamptz | yes | |
| `last_error_class` | text | yes | closed enum |

`UNIQUE (event_id)` · `INDEX (status, next_attempt_at) WHERE status IN ('pending','failed')` (the claim query) · `INDEX (status, lease_expires_at) WHERE status='dispatching'` (lease reaping; note that `lease_expires_at` drives the **reaper**, while `lease_token` fences the **claimant** — two different jobs, which is why both columns exist) · `INDEX (workspace_id, occurred_at)` · `CHECK (status IN (…5…))`. The frozen "dispatch/status/time" requirement is satisfied by these three indexes literally.

## 2. `webhook_receipts` (frozen table name)

Frozen constraint note: *"provider/dedup key unique; payload hash index."* Both honored verbatim.

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `public_id` | text | no | `WHR-*` (**frozen registry prefix**) |
| `provider` | text | no | closed enum |
| `dedup_key` | text | **yes** | `integration_connection_id : <provider event identity>` — **binding-scoped** (`B12-D-A056`, `B12_WEBHOOK_DEDUP_ORDERING.md` §2). **NULL** where verification failed, because an unverified delivery has no binding and must never claim a dedup identity |
| `provider_event_id` | text | yes | **null where the provider supplies none** (Tap) |
| `payload_hash` | text | no | the frozen index |
| `workspace_id` | uuid | yes | **null until resolved**; null is a `P-7` case, never a guess |
| `integration_connection_id` | uuid | yes | the binding whose secret verified |
| `verification_state` | text | no | `verified`\|`invalid_signature`\|`unverifiable` |
| `status` | text | no | `received`\|`verified`\|`queued`\|`processed`\|`failed`\|`duplicate` (**frozen six**) |
| `normalized_payload` | jsonb | yes | the projection the domain consumes |
| `raw_payload` | text | yes | **off by default** (`B12-D-B004`); never contains the signature |
| `attempt_count` | integer | no | processing attempts |
| `error_class` | text | yes | closed enum |
| `received_at`, `provider_occurred_at`, `processed_at` | timestamptz | no/yes/yes | three distinct clocks |
| `request_id` | text | no | |

`UNIQUE (provider, dedup_key)` — **the frozen "provider/dedup key unique"**, honored verbatim; it applies only to rows with a non-NULL `dedup_key`, i.e. only to verified deliveries, which is exactly the set that may claim an identity · `INDEX (payload_hash)` — **the frozen index** · `INDEX (status, received_at) WHERE status IN ('received','verified','queued')` · `INDEX (workspace_id, received_at)` · `CHECK (status IN (…6 frozen…))`.

**Never stored here:** the signature/`hashstring` header, the verifying secret, an `Authorization` header.

## 3. `worker_executions` (frozen table name)

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `workspace_id` | uuid | yes | null for platform-scope work |
| `queue`, `task_kind` | text | no | one of the five queues |
| `source_type`, `source_ref` | text | no | opaque |
| `outbox_event_id` | uuid | yes | FK → `outbox_events` where event-driven |
| `attempt_no` | integer | no | **transport attempts — never a business budget** |
| `status` | text | no | `claimed`\|`running`\|`succeeded`\|`failed`\|`dead_lettered` |
| `started_at`, `heartbeat_at`, `finished_at` | timestamptz | no/yes/yes | heartbeat drives `P-3` |
| `outcome`, `failure_class` | text | yes | closed enums |
| `result_meta` | jsonb | yes | **metadata only** — never a duplicate of domain state |
| `correlation_id`, `request_id` | text | no | |

`INDEX (status, heartbeat_at) WHERE status='running'` (stuck detection) · `INDEX (source_type, source_ref)` · `INDEX (workspace_id, started_at)`.

## 4. `provider_request_attempts` (new)

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `workspace_id` | uuid | yes | null for platform-scope calls |
| `worker_execution_id` | uuid | yes | FK |
| `integration_connection_id` | uuid | no | FK |
| `provider`, `operation` | text | no | |
| `source_type`, `source_ref`, `effect_type` | text | no | the idempotency triple (`B12_IDEMPOTENCY_MODEL.md` class 5) |
| `provider_idempotency_key` | text | yes | **null in Phase 1 — no provider confirmed to support one** |
| `requested_at` | timestamptz | no | **written BEFORE the call** (`B12-D-A021`) |
| `responded_at` | timestamptz | yes | null ⇒ crash or timeout |
| `outcome` | text | yes | `known_success`\|`known_failure`\|`unknown` — **null until responded** |
| `http_status`, `provider_code`, `provider_request_reference` | int / text / text | yes | safe metadata only |
| `error_class`, `retry_after_seconds` | text / integer | yes | |
| `latency_ms` | integer | yes | |

`INDEX (source_type, source_ref, effect_type)` · `INDEX (outcome, requested_at) WHERE outcome = 'unknown' OR outcome IS NULL` — **the `P-1` sweep, and the single most operationally important index in this pack** · `INDEX (integration_connection_id, requested_at)` (health windows).

**Never stored:** request or response bodies, credentials, headers.

## 5. `integration_connections` (new)

Fields per `B12_PROVIDER_CONFIGURATION_MODEL.md` §2. `UNIQUE (workspace_id, provider)` and, for global providers, `UNIQUE (provider) WHERE workspace_id IS NULL` · `UNIQUE (public_id)` · `CHECK (status IN ('not_connected','configuration_required','connected','error'))` — **four**, since `disabled` was removed as unreachable in B12-FIX.1 (`B12-D-A052`) · `CHECK (workspace_id IS NOT NULL OR scope = 'global')`. `enabled` is an ordinary boolean column and is **not** part of `status`. `credential_refs` is `jsonb` holding **reference names only** — a `CHECK` that no value resembles a secret is not expressible in SQL, so this is enforced by the DTO contract and by `AT-B12SEC-1`.

## 6. `integration_health_snapshots` (new)

Append-only; fields per `B12_INTEGRATION_HEALTH_MODEL.md` §3. `INDEX (integration_connection_id, observed_at DESC)`. Bounded retention (B13).

## 7. `platform_dead_letters` (new)

Fields per `B12_DEAD_LETTER_REPLAY_MODEL.md` §2. `INDEX (workspace_id, state, created_at)` · `INDEX (owning_domain, state)` · `CHECK (state <> 'abandoned' OR resolution_reason IS NOT NULL)` · `CHECK (state IN (…4…))`.

## 8. `platform_reconciliation_cases` (new)

Fields per `B12_RECONCILIATION_MODEL.md` §4, plus a `public_id` (operator-internal, **no registered prefix** — the `platform_dead_letters` and frozen `payment_attempts` precedent) so the operator API can address a case by a non-UUID identifier.

`UNIQUE (fingerprint, mismatch_class) WHERE state = 'open'` · `INDEX (workspace_id, state)` · `INDEX (mismatch_class, detected_at)` · `CHECK (state <> 'dismissed' OR resolution_reason IS NOT NULL)`.

> **Both columns of the uniqueness identity are `NOT NULL`.** `workspace_id` is deliberately **absent** from it and is nullable (a `P-5` or `P-7` case may have no resolvable workspace); it is scope and authorization metadata, never a dedup component. Were it part of the key, two global cases with NULL workspaces would not collide under SQL `NULL` semantics and the sweep would open a fresh case every 15 minutes forever. `fingerprint` is computed to *include* the workspace where one exists, so workspace scoping is preserved inside the identity without depending on a nullable column (`B12_RECONCILIATION_MODEL.md` §4, `B12_IDEMPOTENCY_MODEL.md` class 8).

## 9. What is not stored anywhere in B12

A credential value or fragment; a provider URL, bucket, host, or endpoint; an `Authorization` header; a webhook signature; a full domain aggregate; customer message content; a payment card detail; an entitlement decision; a revenue figure; a Celery task ID used as an identity. `OWNED_ENTITY_COUNT = 8`.
