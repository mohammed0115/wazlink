# B11 — Command & Event Catalog

> Design only. `COMMAND_COUNT = 12`, `PRODUCED_EVENT_COUNT = 8`, `CONSUMED_EVENT_COUNT = 0`. Frozen names are reused verbatim; every addition is registered under `B11-AM-011`.

## 1. Commands

| Command | Aggregate | Actor | Permission | Idempotency | Precondition | Effect | Events |
|---|---|---|---|---|---|---|---|
| `CreateUpload` **(frozen name)** | FileAsset | user / system | `file.upload` | header key, 24h | validation gates G1–G4 (`B11_FILE_VALIDATION.md` §2) | `file_assets` row inserted `pending`/`unwritten`; `storage_key` allocated; `upload_expires_at` set; `in_flight_bytes` reserved | — |
| `UploadFileContent` | FileAsset | user | `file.upload` | reserved `storage_key` | `lifecycle=pending`; ticket valid; G5 | bytes streamed to the provider while hashing and detecting; `storage_object_state → present`; invokes `FinalizeUpload` inline | — |
| `FinalizeUpload` | FileAsset | user / system | `file.upload` | natural on `pending` | G6–G10 | `lifecycle → available \| quarantined \| failed`; `checksum`, `size_bytes`, `detected_content_type`, `content_type` written once; usage swapped | `FileUploaded` \| `FileQuarantined` \| `FileVerificationFailed` |
| `ImportFileFromUrl` | FileAsset | **system only** (`system:messaging`) | n/a — no API surface | header key from B5's worker | host allow-listed; SSRF gates; bounded time and size | composes `CreateUpload` + stream + `FinalizeUpload` | as `FinalizeUpload` |
| `AttachFile` | FileAttachment | user / system | `file.upload` **+** the subject domain's write permission | partial unique `(file_id, subject_type, subject_id) WHERE active` | file `available`; subject resolves in-scope; three-way workspace equality; `subject_type` in the closed enum | `file_attachments` row `active` | `FileAttached` |
| `DetachFile` | FileAttachment | user / system | same composition | natural on `state='active'` | link exists and is `active` | `state → detached`; row retained | `FileDetached` |
| `DeleteAsset` **(frozen name)** | FileAsset | user / system | `file.delete` | natural; an already-`archived` file replays `204` | `lifecycle_state ∈ {available, quarantined, failed}` — **`pending` is refused**; `retention_class='product'`; no `active` attachment | `lifecycle → archived`; `archived_at`/`deleted_by`/`deletion_reason` set; `logical_bytes` decremented **only when leaving the counted set** (`B11_DELETION_RETENTION_MODEL.md` §2.1) | `FileDeleted` |
| `ExpireUpload` | FileAsset | system | n/a | natural on `pending` AND past TTL | — | `lifecycle → failed(upload_expired)`; `in_flight_bytes` released | `FileVerificationFailed` |
| `PurgeFileObject` | FileAsset (storage half) | system | n/a | provider delete is idempotent | `archived` past `PURGE_GRACE`, **or** `failed` never-attached past `ORPHAN_GRACE`; `retention_class='product'` | `storage_object_state → purge_pending → purged \| purge_failed`. **Writes no lifecycle field** | `FileObjectPurged` (on `purged` only) |
| `QuarantineFile` | FileAsset | operator | `file.manage` | `expected_version` | **`lifecycle_state = 'available'`** — the only operator-quarantine edge the state machine defines (`B11_FILE_LIFECYCLE.md` §2); a `pending` file is refused, because an unverified upload is not something an operator withholds, it is something finalize has not yet judged | `lifecycle → quarantined`; mandatory reason | `FileQuarantined` |
| `ReleaseQuarantinedFile` | FileAsset | operator | `file.manage` | `expected_version` | `lifecycle = quarantined` | `lifecycle → available`; mandatory reason | `FileUploaded` is **not** re-emitted; no event (§3) |
| `ReconcileFile` | FileReconciliationCase | system / operator | `file.manage` (operator path) | partial unique `(file_id, mismatch_class) WHERE open` | a mismatch was detected | case opened, or an existing open case joined; a repair, where the class permits one, is performed by invoking the ordinary guarded command | `FileReconciliationCaseOpened` |

`COMMAND_COUNT = 12`, counted as the rows above.

**Frozen-name compliance.** `BACKEND_DOMAIN_OWNERSHIP.md` names two commands for the Files row: `CreateUpload` and `DeleteAsset`. Both appear above **unchanged**. The other ten are additive, registered as `B11-AM-011`, following the precedent by which B10 added nine commands to the frozen `SubmitTaxInvoice` and B7 added its own beyond `CreateRule`/`ApproveRun`.

## 2. Produced events

| Event | Payload (safe fields only) | Emitted when |
|---|---|---|
| `FileUploaded` **(frozen name)** | `file_ref` (`FILE-*`), `workspace_ref`, `content_type`, `size_bytes`, `checksum`, `uploaded_by_ref`, `occurred_at` | a file becomes `available` for the first time |
| `FileVerificationFailed` | `file_ref`, `workspace_ref`, `failure_reason` (closed enum), `occurred_at` | a file enters `failed` |
| `FileQuarantined` | `file_ref`, `workspace_ref`, `reason_code`, `occurred_at` | a file enters `quarantined` |
| `FileAttached` | `file_ref`, `workspace_ref`, `subject_type`, `subject_ref`, `occurred_at` | an attachment becomes `active` |
| `FileDetached` | `file_ref`, `workspace_ref`, `subject_type`, `subject_ref`, `occurred_at` | an attachment becomes `detached` |
| `FileDeleted` | `file_ref`, `workspace_ref`, `deleted_by_ref`, `deletion_reason`, `occurred_at` | a file enters `archived` |
| `FileObjectPurged` | `file_ref`, `workspace_ref`, `size_bytes`, `occurred_at` | provider bytes are confirmed gone — the erasure-evidence fact |
| `FileReconciliationCaseOpened` | `case_ref`, `workspace_ref`, `mismatch_class`, `file_ref` (nullable), `occurred_at` | a reconciliation case is opened |

`PRODUCED_EVENT_COUNT = 8`.

**No payload ever carries** a storage key, a provider URL, a bucket, a filename, a download ticket, or content. `checksum` appears only on `FileUploaded`, whose consumer set is domains that need it (B5 writes it to `MessageMedia.checksum`); it is a durable event, not a log line, and is subject to the same access controls as the outbox itself.

## 3. Events considered and rejected

The brief lists nine candidates. Four are declined, with reasons, per its instruction not to adopt mechanically:

| Candidate | Verdict | Reason |
|---|---|---|
| `UploadIntentCreated` | **rejected** | a `pending` row is not yet a fact about the world — it is an in-progress request. Emitting it would put an event on the bus for every abandoned draft, with no consumer able to do anything but wait for the real outcome |
| `FileReady` | **rejected** | a duplicate of `FileUploaded`. Frozen B0 already names one event for "a file became usable"; minting a second name for the same fact is drift |
| `FileDeletionRequested` | **rejected** | logical deletion is *instantaneous* — the request and its effect commit together. `FileDeleted` already occurs at the moment of the request. A separate "requested" event could only ever be emitted in the same transaction as `FileDeleted`, which makes it noise |
| a "released from quarantine" event | **rejected** | consumers care that a file is usable, which `FileUploaded` already told them; a release restores a state they were already notified of. Re-emitting `FileUploaded` would falsely signal a new upload, so the release emits nothing and is recorded as an audit action instead (`B11_OBSERVABILITY.md` §4) |

`FileUploaded` (frozen) plus `FileVerificationFailed` were both kept because the failure case is the one B5's worker and operations genuinely branch on, and a success-only event would force everyone to poll.

## 4. Consumed events

**`CONSUMED_EVENT_COUNT = 0`.**

B11 is entirely command-driven. B5 calls `ImportFileFromUrl`/`AttachFile` directly from its own workers rather than through an event, because B5's flows are synchronous with respect to the file result — its `MessageMedia.fetch_status` transition depends on the outcome, so an event would only reintroduce a wait. No other domain has a Phase-1 file interaction.

Two candidate consumptions were considered and are genuinely unnecessary today:

- **"A subject was deleted, so detach its files."** No Phase-1 subject is deletable: B5 Messages are immutable, and B10 artifacts do not exist. Reconciliation class `R-6` catches a dangling subject should one ever appear, and reports rather than acts.
- **"A workspace was archived, so purge its files."** Frozen B1 owns workspace archival and defines no cascade; inventing one here would be B11 asserting a retention decision over another domain's aggregate.

Declaring zero rather than manufacturing a consumer matches the posture every earlier domain held before its downstream phases existed (`B9_COMMAND_EVENT_CATALOG.md`'s own note). A future phase may register as a consumer of B11's eight produced events without amending this catalog.

## 5. Audit actions

Per frozen `B1_AUTHORIZATION_RBAC.md` §2's namespace rule (permissions are `<resource>.<imperative>`, audit actions are `<resource>.<past participle>`, and no string is valid in both):

`file.uploaded`, `file.upload_failed`, `file.quarantined`, `file.released`, `file.attached`, `file.detached`, `file.deleted`, `file.purged`, `file.purge_failed`, `file.downloaded`, `file.download_denied`, `file.reconciliation_opened`, `file.reconciliation_resolved`.

`file.downloaded` and `file.download_denied` are audit entries and **not** events — a download is an access record, not a domain fact, and putting one on the event bus for every byte fetch would flood it. Both carry actor, `FILE-*`, workspace, and `request_id`, and never a ticket or a URL.
