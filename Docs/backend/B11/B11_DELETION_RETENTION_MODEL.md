# B11 — Deletion & Retention Model

> Design only. Realizes the frozen `DeleteAsset` command name (`BACKEND_DOMAIN_OWNERSHIP.md` line 27) and the frozen `archived` terminal state (`BACKEND_STATE_MACHINES.md` line 55).

## 1. The three candidate models

| | Hard-delete metadata immediately | Soft-delete + async physical delete | Retention/tombstone |
|---|---|---|---|
| Access revoked instantly | yes | **yes** | yes |
| Provider failure can resurrect access | n/a — but the row is gone, so nothing can be reconciled either | **no** | no |
| "Was there ever a file here?" answerable | **no** | **yes** | yes |
| Attachment FKs survive | no — cascades or breaks | **yes** | yes |
| Audit/forensics after an abuse report | **impossible** | **possible** | possible |
| Storage cost | lowest | slightly higher (one small row, forever) | highest |

> **`B11-D-A015`. Soft-delete metadata, asynchronous physical purge, and the `file_assets` row itself is the permanent tombstone.** The three models are not really three: the middle one *is* the tombstone model once you accept that the surviving row is the tombstone. B11 therefore does not add a separate `file_tombstones` table — the archived row already carries every field a tombstone would need, plus the storage key the purge worker requires.

**No `file_assets` row is ever hard-deleted in Phase 1.** Not by `DeleteAsset`, not by the orphan sweeper, not by the purge worker, not by an operator. This makes the `ON DELETE RESTRICT` on `file_attachments.file_id` a redundancy rather than a load-bearing constraint, which is the right way round.

## 2. `DeleteAsset` — the command

| Property | Value |
|---|---|
| Permission | `file.delete` (new, `B11_RBAC_TENANCY.md` §2) |
| HTTP | `DELETE /api/v1/files/{id}` → `204` |
| Idempotency | natural — a second delete of an already-`archived` file returns `204`, not an error (`B11-D-A013`) |
| Concurrency | `SELECT … FOR UPDATE` on the `file_assets` row |
| Effect | `lifecycle_state → archived`; `archived_at`, `deleted_by_membership_id`, `deletion_reason` set; `logical_bytes` decremented **only if the file was in the counted set** (§2.1); `FileDeleted` emitted |
| Physical bytes | untouched. `storage_object_state` is unchanged by this command |

**Guards, in order:**

| Guard | Failure |
|---|---|
| resolves in the active workspace | `404 ENTITY_NOT_FOUND` |
| `retention_class == 'product'` | `403 PERMISSION_DENIED` — a `legal`-class file is undeletable by anyone (`B11_TAX_DOCUMENT_BOUNDARY.md` §3) |
| `file.delete`, including the conditional object-scope test for sales/member | `403 PERMISSION_DENIED` |
| no `active` `file_attachments` row | `409 CONFLICT` · `details.reason="file_attachment_present"` |
| **`lifecycle_state ∈ {available, quarantined, failed}`** | `409 CONFLICT` · `details.reason="file_upload_state_conflict"` |
| `lifecycle_state != 'archived'` | already archived → `204` (idempotent), not an error |

> **`DeleteAsset` cannot archive a `pending` file.** The three admissible source states are exactly the three edges `B11_FILE_LIFECYCLE.md` §2 defines (`available → archived`, `quarantined → archived`, `failed → archived`); `pending → archived` is not a legal transition and the guard above is what refuses it, rather than leaving the state machine and the command table to disagree. An in-flight upload is retired by `ExpireUpload` under its own TTL semantics (`B11_ORPHAN_CLEANUP_MODEL.md` §4, class `O-1`), which releases the `in_flight_bytes` reservation correctly — something `DeleteAsset` neither does nor should learn to do. Treating an unfinished upload as an ordinary deletion would also let a client retire another actor's in-progress intent through a command scoped to finished assets. Negative control `AT-B11DEL-7`.

### 2.1 The `logical_bytes` rule

The counted set is defined once, in `B11_STORAGE_USAGE_MODEL.md` §3, and is **not restated here**: a file contributes to `logical_bytes` exactly while `lifecycle_state ∈ {available, quarantined}` and `retention_class = 'product'`. `DeleteAsset` therefore decrements **once, on leaving that set, and never otherwise**:

| Source state | In the counted set? | `logical_bytes` on `→ archived` |
|---|:--:|---|
| `available` | yes | decrement by `size_bytes` |
| `quarantined` | yes | decrement by `size_bytes` |
| `failed` | **no** | **no change** — a `failed` upload was never charged (`B11_STORAGE_USAGE_MODEL.md` §3), so decrementing would remove bytes that were never added |

A second `DeleteAsset` on an already-`archived` file returns `204` and changes nothing, so the decrement happens at most once per file for the life of the row. This is what keeps `CHECK (logical_bytes >= 0)` a backstop rather than a live failure mode: no correct execution can drive the accumulator negative, and reconciliation class `R-7` remains a **repair** path for genuine drift, not a routine correction of expected under-flow.

## 3. Physical purge — the separate command

`PurgeFileObject` is a system command with its own guards, its own state machine (`B11_FILE_LIFECYCLE.md` §3), and no ability to touch `lifecycle_state`.

| Step | Behavior |
|---|---|
| Eligibility | `lifecycle_state = 'archived'` **and** `archived_at < now() - PURGE_GRACE`; or `lifecycle_state = 'failed'` **and** no `file_attachments` row has ever existed **and** `created_at < now() - ORPHAN_GRACE` |
| Retention gate | `retention_class = 'product'`. A `legal`-class file is never eligible, at any age |
| Attempt | `storage_object_state → purge_pending`, then `delete_object(storage_key)` |
| Success | `→ purged`; `FileObjectPurged` emitted |
| Not-found | `→ purged`. Deleting an absent object is success, per the port contract |
| Transient failure / unknown | `→ purge_failed`; retried under frozen `BACKEND_RETRY_POLICY.md`'s "Storage failure · yes · 5 · failed asset + retry action" row; after the budget is exhausted, a reconciliation case `R-3` is opened and an operational alert raised |

> **`B11-D-A016`. A purge failure never resurrects application access.** There is no transition out of `archived` (invariant L-1), and `PurgeFileObject` writes no lifecycle field at all. A file whose bytes are stuck in `purge_failed` for a year is exactly as inaccessible as one purged in a second. The user-visible consequence of a purge failure is **nothing**; the operational consequence is an alert and a case. Negative control `AT-B11DEL-6`.

## 4. Retry and unknown outcome

Purge retries are safe by construction and require no additional machinery: the key is deterministic and immutable (`B11-D-A018`), and `delete_object` is idempotent (`B11_STORAGE_PROVIDER_BOUNDARY.md` §2). An `unknown` outcome is resolved by a side-effect-free `stat_object` before any repeat, never by a blind retry — §24's rule, realized.

## 5. Delete while attached

`DeleteAsset` on a file with any `active` attachment is `409 CONFLICT` · `details.reason="file_attachment_present"`. The correct sequence is detach-then-delete, and the detach is performed by the **subject-owning domain**, never by B11 reaching into it.

For subjects that are immutable — a sent Message today, an issued tax document later — there is no detach path at all, so the file is simply not user-deletable (`B11_MESSAGING_MEDIA_BOUNDARY.md` §6). This is stated as a property of B11's guard, not as a claim about the other domain's retention policy.

The many-to-many cardinality matters here: a file attached to two subjects requires **both** to detach before it becomes deletable. One subject releasing it must not destroy the other's content.

## 6. Retention timers

All values are **`PRODUCT DECISION REQUIRED`** starting points, not architecture. Each is stated with its reasoning so a reviewer can disagree with the number without disturbing the model.

| Timer | Proposed | Reasoning |
|---|---:|---|
| `UPLOAD_INTENT_TTL` | 1 hour | must exceed a slow large upload on a poor connection; must not be so long that abandoned intents hold quota for a working day |
| `DOWNLOAD_TICKET_TTL` | 5 minutes, single-use | long enough for a click-to-download round trip; short enough that a URL in a browser history or a proxy log is already dead |
| `ORPHAN_GRACE` | 7 days | a file uploaded to a composer and not sent must survive a weekend, because the user legitimately intends to come back (`B11_ORPHAN_CLEANUP_MODEL.md` §2) |
| `PURGE_GRACE` | 30 days after `archived` | aligned deliberately with the one retention figure frozen B0 already proposes — `BACKEND_PRIVACY_AND_DATA_HANDLING.md`'s "30 days for temporary exports" — rather than invented independently |

**No legal retention period appears anywhere in this pack.** `PURGE_GRACE` is a product recovery window for `product`-class files and has no bearing on `legal`-class ones, which are never purged (§`B11_TAX_DOCUMENT_BOUNDARY.md` §3).

## 7. Data classification

`file_assets` bytes fall under the frozen `BACKEND_PRIVACY_AND_DATA_HANDLING.md` class **"Private communications — messages, media references — least privilege, retention decision, encrypted transport"** for message media, and under **"Contact PII"** or **"Public business"** for whatever an attachment happens to contain. Because B11 never inspects content semantically, it applies the **most restrictive** handling uniformly: private by default, least privilege, no content in logs, no content in exports, no content in metrics.

The frozen document's own instruction that "default retention must be a product/legal decision" is honored literally — every number in §6 is marked as a proposal awaiting that decision.
