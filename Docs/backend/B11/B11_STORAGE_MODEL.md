# B11 — Storage Model

> Design only. **No migration is written.** Conceptual schema for four tables. `file_assets` is a frozen table name (`BACKEND_DATA_MODEL.md` line 25); the other three are additive under `B11-AM-012`.

## 0. Platform conventions inherited

Every table below uses, per frozen `BACKEND_DATA_MODEL.md` and `BACKEND_DATA_GOVERNANCE.md`: internal UUIDv7 `id`; UTC `created_at`/`updated_at`; `snake_case`; explicit FK deletion policy; and `workspace_id` on every tenant-owned record. JSONB appears once (`file_reconciliation_cases.evidence`) and only for the permitted purpose of "structured flexible metadata," never for relationships, state, or ownership.

## 1. `file_assets` (frozen table name)

Frozen constraint requirement: *"workspace/storage_key unique; checksum index."* Both are honored literally below.

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `public_id` | text | no | `FILE-*`, unique, immutable |
| `workspace_id` | uuid | **no** | FK → `workspaces`, RESTRICT |
| `lifecycle_state` | text | no | `pending`\|`available`\|`quarantined`\|`failed`\|`archived` — CHECK-constrained to the frozen five |
| `storage_provider` | text | no | logical provider name, never a host or bucket |
| `storage_key` | text | no | deterministic, immutable (`B11_STORAGE_KEY_MODEL.md`) |
| `storage_object_state` | text | no | `unwritten`\|`present`\|`purge_pending`\|`purged`\|`purge_failed` |
| `original_filename` | text | no | normalized display name, ≤255 UTF-8 bytes |
| `safe_display_filename` | text | no | ASCII-safe derivative for `Content-Disposition` |
| `declared_content_type` | text | no | the client's claim, retained verbatim after gate G2 — evidence only, never authority |
| `detected_content_type` | text | yes | server-detected from the received bytes; null until finalize, because no bytes exist before it |
| `content_type` | text | **no** | **canonical presentation value; the only one any DTO exposes. Never null.** At insert it is the *validated provisional* type (the declared value after gate G2 admitted it against the closed allow-list); at finalize it is overwritten, once, with the *verified* detected type (`B11_FILE_VALIDATION.md` §3.1) |
| `size_bytes` | bigint | yes | measured; null until finalize |
| `checksum` | text | yes | SHA-256 lowercase hex, 64 chars; **written once, never updated** |
| `provider_etag` | text | yes | opaque; **never an integrity authority** (`B11_CHECKSUM_INTEGRITY.md` §5) |
| `access_class` | text | no | `private` — the only Phase-1 value |
| `retention_class` | text | no | `product`\|`legal`; **immutable after creation** |
| `uploaded_by_membership_id` | uuid | yes | FK → `memberships`, RESTRICT; null for a system-actor import |
| `upload_expires_at` | timestamptz | yes | set at intent; cleared at finalize |
| `failure_reason` | text | yes | closed enum (`B11_OBSERVABILITY.md` §2) |
| `failure_detail` | text | yes | operator-only; never in a client response |
| `quarantined_by_membership_id` | uuid | yes | FK → `memberships` |
| `quarantine_reason` | text | yes | mandatory when `quarantined` |
| `deleted_by_membership_id` | uuid | yes | FK → `memberships` |
| `deletion_reason` | text | yes | |
| `archived_at` | timestamptz | yes | the platform-standard soft-delete field |
| `purge_attempts` | integer | no | default 0 |
| `purge_next_attempt_at` | timestamptz | yes | |
| `purged_at` | timestamptz | yes | |
| `version` | integer | no | optimistic concurrency, default 1 |
| `created_at`, `updated_at` | timestamptz | no | |

**Constraints and indexes**

| | |
|---|---|
| `UNIQUE (workspace_id, storage_key)` | **the frozen B0 constraint**, honored verbatim |
| `INDEX (checksum)` | **the frozen B0 index**, honored verbatim; used for reconciliation and investigation, never for deduplication |
| `UNIQUE (public_id)` | platform-wide public-ID rule |
| `CHECK (lifecycle_state IN (…5 frozen values…))` | no sixth state can be inserted |
| `CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$')` | algorithm shape enforced in the schema, not in code |
| `CHECK (lifecycle_state <> 'available' OR (checksum IS NOT NULL AND size_bytes IS NOT NULL AND detected_content_type IS NOT NULL))` | **an `available` file is structurally incapable of lacking verification data.** The check names `detected_content_type`, not `content_type`: `content_type` is `NOT NULL` from insert (it carries the validated provisional value while `pending`), so asserting it here would prove nothing. What must be true of an `available` file is that a *server detection* actually happened |
| `CHECK (retention_class IN ('product','legal'))` | |
| `INDEX (workspace_id, lifecycle_state)` | usage recomputation, orphan sweep |
| `INDEX (lifecycle_state, upload_expires_at) WHERE lifecycle_state = 'pending'` | the expiry sweep |
| `INDEX (storage_object_state, purge_next_attempt_at) WHERE storage_object_state IN ('purge_pending','purge_failed')` | the purge worker |
| `INDEX (workspace_id, archived_at) WHERE lifecycle_state = 'archived'` | the purge-grace sweep |

**Immutability rules** (enforced in the application service; the schema's CHECKs are the backstop): `public_id`, `storage_key`, `workspace_id`, `retention_class`, `access_class`, `declared_content_type` are immutable from insert. `checksum`, `size_bytes`, `detected_content_type` are write-once at finalize. `content_type` is written at insert (provisional) and rewritten **exactly once**, at finalize, from the verified detection — it is the one column in this table with a two-phase write, and no other command, worker, operator action, or reconciliation repair may write it. `original_filename` is immutable — renaming is not a Phase-1 feature and would break the display/`Content-Disposition` pair silently.

## 2. `file_attachments` (new)

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK; no public-ID prefix (child row, B5's `med_…` precedent) |
| `workspace_id` | uuid | no | FK → `workspaces`; **denormalized and CHECK-equal to the file's** |
| `file_id` | uuid | no | FK → `file_assets`, **ON DELETE RESTRICT** |
| `subject_type` | text | no | closed enum of 2: `message_media`, `tax_document_artifact` |
| `subject_id` | text | no | the subject's public ID; **deliberately not a database FK** (polymorphic — the `RevenueEvent.source_ref` / `tax_invoices.source_ref` house pattern) |
| `state` | text | no | `active`\|`detached` |
| `attached_by_membership_id` | uuid | yes | FK → `memberships` |
| `detached_at` | timestamptz | yes | |
| `created_at`, `updated_at` | timestamptz | no | |

`UNIQUE (file_id, subject_type, subject_id) WHERE state = 'active'` — makes a duplicate active link impossible and turns a repeated attach into an idempotent replay. `INDEX (subject_type, subject_id)` for "what files does this subject have." `INDEX (file_id) WHERE state = 'active'` for the deletion guard. `CHECK (subject_type IN ('message_media','tax_document_artifact'))`.

A `detached` row is **never deleted** — it is the durable proof that makes `B11_ORPHAN_CLEANUP_MODEL.md` §3's "never attached" test safe.

## 3. `workspace_storage_usage` (new)

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `workspace_id` | uuid | no | **PK**, FK → `workspaces` |
| `logical_bytes` | bigint | no | default 0; product usage (`B11_STORAGE_USAGE_MODEL.md` §3) |
| `in_flight_bytes` | bigint | no | default 0; reservations held by `pending` intents |
| `updated_at` | timestamptz | no | |

`CHECK (logical_bytes >= 0 AND in_flight_bytes >= 0)`. One row per workspace, created lazily; an absent row reads as zero, never as "unlimited," mirroring B8's own lazy-counter rule exactly.

**This table is a repairable accumulator, not a second truth.** `file_assets` is authoritative; reconciliation class `R-7` recomputes and overwrites. Because the underlying truth is a durable row set rather than an event stream, **no ledger table is needed** — the improvement over B8's `usage_ledger` pattern, and the reason B11 does not copy it.

## 4. `file_reconciliation_cases` (new)

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid (v7) | no | PK |
| `workspace_id` | uuid | yes | null for a platform-level `R-5` finding with no known owner |
| `file_id` | uuid | yes | FK → `file_assets`; null for `R-5` |
| `storage_key_hash` | text | yes | for `R-5`, whose finding has no row — a hash, never the key itself |
| `mismatch_class` | text | no | `R-1`…`R-8` |
| `state` | text | no | `open`\|`repaired`\|`dismissed` |
| `evidence` | jsonb | no | observed vs. expected, provider request ID; **never a URL, never a key, never bytes** |
| `detected_at` | timestamptz | no | |
| `attempted_repair` | text | yes | the command name invoked, if any |
| `resolved_by_membership_id` | uuid | yes | FK → `memberships` |
| `resolution_reason` | text | yes | **mandatory when `dismissed`** |
| `next_review_at` | timestamptz | yes | |
| `request_id` | text | no | |

`UNIQUE (file_id, mismatch_class) WHERE state = 'open'` and `UNIQUE (storage_key_hash, mismatch_class) WHERE state = 'open' AND file_id IS NULL` — one open case per real problem, however often the scan runs. `CHECK (state <> 'dismissed' OR resolution_reason IS NOT NULL)`. This satisfies the frozen requirement that "every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time," field by field.

## 5. What is not stored

No table, column, or JSONB key anywhere in B11 holds: file content; a provider URL; a bucket, region, or endpoint; a storage credential; a download ticket; a signed URL; a plan, price, currency, or entitlement value; a Message, Conversation, Lead, Deal, Invoice, Payment, RevenueEvent, or TaxInvoice field. `OWNED_ENTITY_COUNT = 4`.
