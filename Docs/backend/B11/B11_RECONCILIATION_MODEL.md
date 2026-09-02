# B11 — Reconciliation Model

> Design only. Adds one row to frozen `BACKEND_RECONCILIATION.md` (`B11-AM-008`) and realizes it. B11 defines reconciliation *semantics*; B12 owns the generalized async execution that runs them.

## 1. Doctrine, inherited verbatim

Frozen `BACKEND_RECONCILIATION.md` governs every process below without modification: *"Repairs are explicit, permissioned, idempotent, and audited. Admin cannot edit financial truth directly with SQL. Every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time. Reconciliation must not guess or overwrite a newer authoritative provider state without a documented precedence rule."*

Two B11-specific consequences:

- **Detection and repair are separate.** A scan opens a `file_reconciliation_case`; it never mutates a `FileAsset`. Repair is always an ordinary, guarded, audited command — the same discipline `B11_ORPHAN_CLEANUP_MODEL.md` §4 applies to sweeping.
- **The documented precedence rule** the frozen text demands: **PostgreSQL wins on meaning; the provider wins on byte existence.** `lifecycle_state`, permissions, retention, and attachment are never revised because of what a `stat_object` returned; `storage_object_state`, `size_bytes` observed, and `provider_etag` are never asserted against what the provider reports.

## 2. New reconciliation row

`B11-AM-008` adds to the frozen table: *"Files/Storage | `file_assets` vs provider objects | hourly | File service with operations coordinator"* — the same shape as the existing "Scraping/provider execution" row, which likewise pairs a service with an operations coordinator for the classes needing human judgement.

## 3. Mismatch classes

| Class | Detection | Precedence | Repair | Auto? |
|---|---|---|---|:--:|
| `R-1` | metadata says bytes exist (`object=present`) but `stat_object` reports absent | provider wins on existence | if `lifecycle=pending`: `→ failed`, release `in_flight_bytes`. If `lifecycle=available`: **`QuarantineFile`** — a servable file whose bytes vanished must stop being offered, but must not be silently archived, because the row is the only remaining evidence | `pending`: yes · `available`: **no**, operator decides |
| `R-2` | object exists but the row is incomplete (`lifecycle=pending` long past its TTL, `object=present`) | postgres wins on meaning | `ExpireUpload` → `failed`, then ordinary `O-2` purge. **Never auto-promoted to `available`** — promoting an unverified object is exactly the trust gap `B11_CHECKSUM_INTEGRITY.md` §3 forbids | yes |
| `R-3` | delete requested but the object remains (`object ∈ {purge_pending, purge_failed}` past its retry budget) | provider wins on existence | re-attempt `PurgeFileObject`; on exhaustion, alert. **`lifecycle` stays `archived` throughout** | yes (bounded) |
| `R-4` | checksum mismatch — a re-hash of the stored object differs from the recorded `checksum` | postgres wins on meaning; the object is wrong | **`QuarantineFile`** + operator case. The recorded hash is **never** rewritten (invariant I-1) | **no** |
| `R-5` | provider object with no `file_assets` row (`list_objects` sweep) | neither — insufficient information | **report only.** Record key, size, and last-modified. Never delete: a lost row and a leaked object are indistinguishable from the provider side, and one of the two readings means deleting a customer's only copy | **no** |
| `R-6` | `active` attachment whose subject no longer resolves through its owning domain | postgres wins on meaning, but not B11's postgres | **report only.** Never auto-detach — a transient read failure in another domain would otherwise silently make a file purge-eligible | **no** |
| `R-7` | `workspace_storage_usage` disagrees with a recomputation over `file_assets` | `file_assets` wins, always | recompute and overwrite the accumulator under a row lock; append an audit entry with before/after | yes |
| `R-8` | size mismatch — `stat_object().size_bytes` differs from the recorded `size_bytes` | postgres wins on meaning | treated as `R-4`: the object is not what was verified. `QuarantineFile` + operator case | **no** |

Five of eight classes are report-only or operator-gated. That ratio is intentional: automatic repair is safe exactly where the correct action is unambiguous *and* the wrong action is recoverable. It is neither for `R-4`, `R-5`, `R-6`, and `R-8`, so those stop at detection.

## 4. Case record

`file_reconciliation_cases`: `id`, `workspace_id`, `file_id` (nullable — `R-5` has no row), `mismatch_class`, `state` (`open`/`repaired`/`dismissed`), `evidence` (JSONB: observed vs. expected, provider request ID, never a URL and never bytes), `detected_at`, `attempted_repair` (the command name, nullable), `resolved_by_membership_id` (nullable), `resolution_reason` (mandatory for `dismissed`), `next_review_at`, `request_id`. This satisfies the frozen requirement's full list — status, evidence, attempted repair record, operator, request ID, next review time — field by field.

Idempotent detection: a partial unique index on `(file_id, mismatch_class) WHERE state = 'open'` means a scan that runs every hour opens one case per real problem, not one per hour. For `R-5`, whose `file_id` is null, the key is `(storage_key_hash, mismatch_class) WHERE state = 'open'`.

## 5. Unknown outcomes are reconciled, never guessed

Every `unknown` provider result opens a case immediately and leaves state unchanged (`B11_STORAGE_PROVIDER_BOUNDARY.md` §4). The case's first scheduled action is a `stat_object` — side-effect-free, and the only operation that can answer the question the timeout left open. The design never retries a mutating call to resolve an unknown; it observes first.

## 6. What belongs to B12

Cadence, worker pool, queue routing, batch sizing, backoff tuning beyond the frozen retry table, dead-letter wiring, and alert delivery. B11 names the eight classes, their precedence rules, their repair commands, and their auto/manual split. `B11_B12_ASYNC_BOUNDARY.md` states this handoff and creates no B12 file.
