# B11 — Idempotency & Concurrency

> Design only. Built on frozen `BACKEND_IDEMPOTENCY_STANDARD.md` without extending it.

## 1. Idempotency identities

> **`B11-D-A013`.** Every B11 command has exactly one idempotency identity, and it is either the platform `Idempotency-Key` or a durable database constraint — never a Redis key, never an in-memory guard.

| Command | Identity | Retry with same input | Retry with different input |
|---|---|---|---|
| `CreateUpload` | `Idempotency-Key` (workspace + principal + endpoint + body hash), 24h retention per the frozen standard | replays the stored `FileAsset`; **no second row, no second `storage_key`, no second quota reservation** | `409 IDEMPOTENCY_CONFLICT` |
| `UploadFileContent` | the already-allocated, immutable `storage_key` | overwrites the same object; sha256 recomputed | last write wins at the object; finalize verifies whatever is actually there |
| `FinalizeUpload` | natural, guarded on `lifecycle_state = 'pending'` | on an already-`available` file: replays `200` with the current representation | a body whose `sha256`/`size_bytes` contradicts committed state: `409 CONFLICT` · `file_upload_state_conflict` |
| `AttachFile` | partial unique `(file_id, subject_type, subject_id) WHERE state='active'` | returns the existing attachment, `200` | n/a — the tuple *is* the input |
| `DetachFile` | natural, guarded on `state='active'` | `204` on an already-`detached` link | n/a |
| `DeleteAsset` | natural, guarded on `lifecycle_state ∈ {available, quarantined, failed}`; an already-`archived` file is the idempotent case | `204` on an already-`archived` file; `409 file_upload_state_conflict` on a `pending` one, which is not deletable at all | n/a |
| `ExpireUpload` | guarded on `pending` AND past TTL | no-op | n/a (system) |
| `PurgeFileObject` | guarded on `storage_object_state ∈ {present, purge_pending, purge_failed}`; provider `delete_object` is itself idempotent | no-op or a harmless repeat delete | n/a (system) |
| `QuarantineFile` / `ReleaseQuarantinedFile` | `If-Match` / `expected_version` on `file_assets.version` | `200` replay | `409 STALE_VERSION` |
| `ImportFileFromUrl` | `Idempotency-Key` supplied by B5's worker, derived from its own message/media identity | replays the stored `FileAsset` | `409 IDEMPOTENCY_CONFLICT` |
| `ReconcileFile` | partial unique `(file_id, mismatch_class) WHERE state='open'` | joins the existing open case | n/a |

**There are no provider callbacks in B11.** No storage webhook is consumed, registered, or designed. This is stated explicitly because §11 asks about callback idempotency: the answer is that the surface does not exist, and creating one would require a controlled amendment against `BACKEND_INTEGRATION_BOUNDARIES.md`, whose Hostinger row is `outbound` only.

## 2. Concurrency primitives (`B11-D-A019`)

Per frozen `BACKEND_DATA_GOVERNANCE.md` ("Database constraints and `transaction.atomic` are preferred before distributed locks") and `B8_CONCURRENCY_MODEL.md`'s precedent, B11 uses **PostgreSQL row locks and unique constraints exclusively**. No Redis lock participates in any decision in this pack.

| Mechanism | Where |
|---|---|
| `SELECT … FOR UPDATE` on `file_assets` | every lifecycle transition |
| `SELECT … FOR UPDATE` on `workspace_storage_usage` | every quota check and every byte-accounting mutation |
| `version` column + `expected_version` body field | `QuarantineFile`, `ReleaseQuarantinedFile` — the two operator commands where a stale view is plausible; `409 STALE_VERSION`, matching B8's and B10's explicit-version-field choice over `If-Match` |
| partial unique indexes | attachment uniqueness, reconciliation-case uniqueness |
| lock ordering | `workspace_storage_usage` **before** `file_assets` **before** `file_attachments`, always, in every command that takes more than one. A fixed global order makes deadlock between two B11 commands structurally impossible. `DetachFile` takes the `file_assets` lock even though it writes no file field, so that `DeleteAsset`'s attachment guard can never observe a half-committed detach (§3) |

## 3. The eight races (§25)

| Race | Resolution |
|---|---|
| **Two concurrent finalizations** of one file | Both lock the row. The first commits `pending → available`. The second re-reads inside its lock, sees `available`, and takes the idempotent replay path — returning `200` with the same representation. **Quota is charged once**, because the increment happens in the same transaction as the transition that only one of them performs. `UPLOAD_FINALIZATION_RACE_GAPS = 0`. `AT-B11IDEM-2` |
| **Finalize vs. expiration** | Both lock the row; both guard on `lifecycle_state = 'pending'`. Exactly one wins. If `ExpireUpload` wins, the finalize sees `failed` and returns `409 UPLOAD_EXPIRED`. If finalize wins, the expiry sees `available` and no-ops. There is no window in which a file is both expired and available, because both transitions require the same lock. `AT-B11IDEM-3` |
| **Finalize vs. delete** | Both commands take `SELECT … FOR UPDATE` on the same `file_assets` row, so they serialize; and their guards are **disjoint by construction**, which is what makes the race vacuous rather than merely ordered. `FinalizeUpload` requires `lifecycle_state = 'pending'`; `DeleteAsset` requires `lifecycle_state ∈ {available, quarantined, failed}` (`B11_DELETION_RETENTION_MODEL.md` §2). No state satisfies both. **Delete-then-finalize is impossible** — a `pending` file cannot be deleted, so the delete returns `409 file_upload_state_conflict` and the finalize proceeds untouched. **Finalize-then-delete** is the ordinary sequence: the finalize commits `available` and charges quota; the delete then acquires the lock, sees `available`, and archives, decrementing exactly the bytes the finalize added. There is no interleaving in which quota is charged twice, decremented twice, or decremented without having been charged. `UPLOAD_FINALIZATION_RACE_GAPS = 0` (second half). `AT-B11RACE-4` |
| **Detach vs. delete** | `DetachFile` takes `SELECT … FOR UPDATE` on **both** the `file_attachments` row and its parent `file_assets` row, in the fixed lock order of §2 — the parent lock is taken even though detach writes no file field, precisely so that `DeleteAsset`'s "no `active` attachment" guard cannot be evaluated against a half-committed detach. The two orders are then: **detach-then-delete** → the delete acquires the lock after the detach commits, counts zero `active` rows, and archives (the intended sequence, `B11_DELETION_RETENTION_MODEL.md` §5); **delete-then-detach** → the delete archives first, and the subsequent detach still succeeds, because releasing a link to an archived file is meaningful and harmless — the `detached` row is retained as the durable historical fact `B11_ORPHAN_CLEANUP_MODEL.md` §3 depends on. **Neither order can delete a file whose attachment is still `active`**, because the guard is re-evaluated inside the lock rather than read before it. `DELETE_ATTACHMENT_RACE_GAPS = 0` (second half). `AT-B11RACE-5` |
| **Attach vs. delete** | `AttachFile` locks the file and re-checks `available`; `DeleteAsset` locks the file and re-checks "no active attachment." Serialized by the lock, so one of two orders occurs: attach-then-delete → the delete sees the attachment and returns `409 file_attachment_present`; delete-then-attach → the attach sees `archived` and returns `409 file_not_ready`. **Neither order produces an attachment to a deleted file.** `DELETE_ATTACHMENT_RACE_GAPS = 0`. `AT-B11RACE-1` |
| **Download vs. delete** | The byte endpoint re-evaluates `lifecycle_state = 'available'` inside the request, after authorization. A delete committing mid-stream does not truncate an in-flight response — the bytes already being sent complete — but **no new download may begin**, and the ticket is invalidated. Accepting one already-authorized in-flight read is the correct trade: aborting it mid-stream would corrupt the client's file for no security gain, since the actor was authorized at the moment the stream opened. `AT-B11RACE-2` |
| **Two concurrent deletes** | Both lock; the first archives; the second observes `archived` and returns `204`. Quota is decremented once. `AT-B11IDEM-4` |
| **Provider callback vs. reconciliation** | Not applicable — B11 consumes no provider callback (§1). The analogous race, **purge worker vs. reconciliation scan**, is resolved by the same row lock: the scan opens a case only after failing to acquire evidence of an in-flight repair, and the `(file_id, mismatch_class) WHERE open` unique index makes a duplicate case impossible. `AT-B11RACE-3` |

## 4. The quota race, separately

Covered in full in `B11_STORAGE_USAGE_MODEL.md` §4. The essential point restated: N concurrent `CreateUpload` calls serialize on `SELECT … FOR UPDATE` of the single `workspace_storage_usage` row, and each reserves against `logical_bytes + in_flight_bytes` — so the ceiling holds under arbitrary concurrency without any distributed lock. `QUOTA_RACE_GAPS = 0`. `AT-B11QUO-5`.

## 5. Transaction boundaries

| Boundary | Contents |
|---|---|
| `CreateUpload` | usage row lock + reservation, `file_assets` insert, `IdempotencyRecord` insert — one transaction. The storage key is allocated here and never outside |
| `UploadFileContent` + `FinalizeUpload` (flow A) | the provider `put` happens **outside** the transaction (a network call must never be held inside one); the transaction opens afterwards and contains the `stat` verification result, the usage swap, the lifecycle transition, and the outbox event |
| `DeleteAsset` | file lock, transition, usage decrement, outbox event — one transaction; **no provider call** |
| `PurgeFileObject` | provider `delete_object` outside; the `storage_object_state` write inside a short transaction afterwards |

Because the provider call sits outside the transaction, a crash between the call and the commit is exactly the unknown-outcome case — which is why the deterministic key and the `stat`-before-retry rule exist (`B11_STORAGE_PROVIDER_BOUNDARY.md` §4). This is a designed consequence, not an oversight.

## 6. Events are transactional

Every event in `B11_COMMAND_EVENT_CATALOG.md` is written to the frozen `outbox_events` table inside the command's own transaction, per B0 ADR-005's transactional-outbox choice. An event is therefore never emitted for a state change that rolled back, and never lost for one that committed.
