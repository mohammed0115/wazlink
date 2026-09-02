# B11 — Domain Model

> Design only. This document is the map; `B11_STORAGE_MODEL.md` (field-level DDL), `B11_FILE_LIFECYCLE.md` (states), `B11_UPLOAD_MODEL.md` (flow), and `B11_DOMAIN_ATTACHMENT_MODEL.md` (linkage) are the territory.

## 1. What a File is in WazLink

> **`B11-D-A001`.** A **`FileAsset`** is a workspace-scoped PostgreSQL row that names exactly one immutable blob-storage object, records everything WazLink knows *about* that object, and is the sole durable identity of it. The bytes are not the file; the row is the file. A `FileAsset` with no bytes is a legitimate, expected state (`pending`). Bytes with no `FileAsset` are an anomaly, not a file (`B11_RECONCILIATION_MODEL.md` §3, class `R-5`).

Three consequences follow, and every later document depends on them:

1. **PostgreSQL is authoritative; blob storage is a byte store.** If the two disagree, the row wins on *meaning* and the object wins on *what bytes exist* — never both on the same question. Resolving the disagreement is `B11_RECONCILIATION_MODEL.md`, not an ad-hoc read-time fallback.
2. **A provider URL is never identity.** `B11-D-A003`: no column, DTO field, event payload, or log line ever carries a provider URL as the way to refer to a file. The identity is `FILE-*` (public) and the internal UUIDv7 (private). A URL is a transient capability, minted, used, and discarded.
3. **Content is immutable.** A `FileAsset`'s bytes are written once. There is no replace-in-place (`B11-D-C003`, deferred). Re-uploading produces a *different* `FileAsset` with a different `FILE-*`, even when the bytes are byte-identical (`B11-D-A012`).

## 2. Aggregate map

```
Workspace (B1, referenced)
  └── FileAsset  (aggregate root, file_assets, FILE-*)
        ├── lifecycle_state         pending | available | quarantined | failed | archived   (frozen B0 machine)
        ├── storage_object_state    unwritten | present | purge_pending | purged | purge_failed   (B11, orthogonal)
        ├── storage_key             deterministic, allocated once, immutable, never user-derived
        ├── integrity               sha256, size_bytes, provider_etag (untrusted)
        ├── content typing          declared_content_type | detected_content_type | content_type (never null)
        ├── naming                  original_filename (display) | safe_display_filename (transport)
        ├── classification          access_class, retention_class
        └── FileAttachment[]        (file_attachments — B11's own reference count)
              └── (subject_type, subject_id)  → a registered, non-B11 domain object

WorkspaceStorageUsage (workspace_storage_usage)   — locked accumulator, repairable from file_assets
FileReconciliationCase (file_reconciliation_cases) — detection record, never a repair authority
```

## 3. Why `FileAsset` is one aggregate and not two

An "UploadIntent" aggregate separate from `FileAsset` was considered and rejected (`B11-D-A008`). Splitting them would create two identities for one thing, force a second public-ID prefix, and require a hand-off transaction that could half-fail — reintroducing precisely the orphan class the split was meant to prevent. Instead the intent **is** the `FileAsset` in `pending`: one row, one identity, one `FILE-*` from the first instant, with `upload_expires_at` bounding how long it may stay unusable. This is the same reasoning `B10-D-A004` used to keep credit notes inside `tax_invoices` rather than minting a parallel table.

The cost of this choice is that a `FILE-*` exists before any bytes do. That is accepted and made safe by `B11-D-A008`'s rule that **`pending` is never attachable and never downloadable** — the identity exists, the asset does not.

## 4. Why the two state machines are orthogonal

`lifecycle_state` answers *"may the application serve this to a user?"* `storage_object_state` answers *"do bytes exist at the provider?"* Collapsing them would make a provider outage look like a business state change, and — the failure the brief names in §20 — would let a failed physical delete silently resurrect application access. They are independent by construction: **no `storage_object_state` value can ever move `lifecycle_state`, and `archived` is terminal regardless of whether purging succeeds, fails, or never runs.** Full transition tables and the proof are in `B11_FILE_LIFECYCLE.md` §2–§4.

## 5. Where each fact lives

| Fact | Home | Never |
|---|---|---|
| File identity, tenancy, lifecycle, integrity, typing, naming, classification | `file_assets` (PostgreSQL) | blob storage metadata, Redis, a provider URL |
| Raw bytes | blob storage object at `storage_key` | PostgreSQL, Redis |
| Which domain object a file belongs to | `file_attachments` (B11's reference count) **and** the subject domain's own field where one is frozen (e.g. `MessageMedia.file_asset_ref`) | inferred from a storage key path, a filename, or a checksum |
| Whether that domain object is valid / sent / cleared / paid | the subject's own domain, always | anything in B11 |
| Effective storage entitlement | B8 (`quota_definitions` + plan version), when one exists | `file_assets`, `workspace_storage_usage`, a B11 constant treated as commercial truth |
| Short-lived access capability | an application-issued, single-use download ticket | a durable column, an event payload, a log line, a business record |

Redis holds nothing in this table. Per frozen `BACKEND_DATA_GOVERNANCE.md` ("Redis … is never the source of domain truth") and `BACKEND_ARCHITECTURE_DECISIONS.md` line 18, B11 uses Redis only as the Celery broker for the workers `B11_B12_ASYNC_BOUNDARY.md` requests, and for the abuse-control rate-limit counters `BACKEND_RATE_LIMIT_POLICY.md` already governs. No quota decision, no lifecycle transition, no idempotency guarantee, and no access grant in this pack depends on Redis.

## 6. Cardinalities

| Relationship | Cardinality | Enforced by |
|---|---|---|
| Workspace → FileAsset | 1 : N | `file_assets.workspace_id` NOT NULL FK |
| FileAsset → storage object | 1 : 0..1 | `(workspace_id, storage_key)` unique (frozen B0 constraint), `storage_object_state` |
| FileAsset → FileAttachment | 1 : N | `file_attachments.file_id` FK, `ON DELETE RESTRICT` |
| FileAttachment → subject | N : 1 | `(subject_type, subject_id)` polymorphic pair — the house pattern already used by `RevenueEvent.source_ref` and `tax_invoices.source_ref` |
| Workspace → WorkspaceStorageUsage | 1 : 0..1 | `workspace_id` primary key, row created lazily |

A subject may hold many files; a file may be attached to many subjects. The many-to-many is intentional — an outbound WhatsApp media file that is later also cited by a CRM note (Phase 2) must not be duplicated, and must not be deletable by whichever subject releases it first (`B11_DELETION_RETENTION_MODEL.md` §5).
