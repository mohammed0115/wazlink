# B11 — B12 Async / Platform Boundary

> **No B12 file is created by this document.** `B12_FILES_CREATED = 0`. B11 names semantics; B12 designs execution.

## 1. What B11 requires, semantically

Frozen B0 ADR-005 already selected the mechanism (transactional outbox + Celery dispatcher). B11 states logical requirements against that frozen choice and designs no infrastructure.

**Every requirement below is a Phase-1 requirement backed by a Phase-1 B11 behavior.** The property worth stating first:

> **B11's user-facing write paths are entirely synchronous.** `CreateUpload`, `UploadFileContent`, `FinalizeUpload`, `AttachFile`, `DetachFile`, and `DeleteAsset` validate, write, and commit inside one request-scoped transaction. **No file becomes usable because a worker ran, and no file becomes inaccessible because a worker failed to run.** If every B11 background job stopped forever, uploads, downloads, attachments, and deletions would all continue to work correctly and safely — the only consequences would be that expired intents keep holding quota reservations, deleted bytes are never physically removed, and mismatches go undetected. Every one of those is a cost or a latency, never a correctness or a security failure.

| Requirement | What B12 provides |
|---|---|
| **Event publication** | The frozen outbox dispatcher publishing B11's eight produced events. Identical to every other domain's; B11 adds no new transport |
| **Upload expiry sweep** | Periodic execution of `ExpireUpload` over `pending` rows past `upload_expires_at` (`B11_ORPHAN_CLEANUP_MODEL.md` §4, class `O-1`) |
| **Physical deletion worker** | Periodic execution of `PurgeFileObject` over purge-eligible rows (`B11_DELETION_RETENTION_MODEL.md` §3), including the bounded retry of `purge_failed` |
| **Orphan sweeper** | Periodic evaluation of orphan classes `O-1`…`O-6` and invocation of the ordinary guarded commands the model names |
| **Storage reconciliation scans** | Periodic execution of the eight mismatch-class detections (`B11_RECONCILIATION_MODEL.md` §3), realizing the `B11-AM-008` reconciliation row's "hourly" cadence |
| **Usage recomputation** | Periodic execution of class `R-7`'s recompute-and-repair |
| **Provider retry execution** | The standard exponential-backoff retry (`BACKEND_RETRY_POLICY.md`'s "Storage failure · yes · 5 · failed asset + retry action" row, reused verbatim) for the purge worker and the reconciliation scans |
| **Media import execution** | The worker context in which B5 invokes `ImportFileFromUrl` — owned by **B5's** pipeline, not B11's; listed here only so the ownership is unambiguous |
| **Future async malware scan** | If and when `B11-D-B002` is adopted, the scan's execution and its callback into `FinalizeUpload`. **Not a Phase-1 requirement** |

## 2. What belongs to B12, not B11

Worker pool sizing and autoscaling; each sweep's concrete cadence and batch size; Celery queue topology and routing keys; broker (Redis) configuration; heartbeat and visibility-timeout tuning beyond the frozen retry and timeout tables' numbers; dead-letter topic and alert delivery wiring; scheduler/beat entries; backpressure between the purge worker and the reconciliation scans.

B11 names the requirement; B12 designs the implementation. Nothing in this pack specifies a Celery task, a queue, a beat schedule, a Redis key, or a worker count.

## 3. What B11 does not do

No Celery configuration, no Redis configuration, no worker code, no queue definition, no scheduler entry, no beat schedule, and no B12 file. B11 declares semantics only.

**The one thing B11 does fix, because it is a correctness property rather than an execution detail:** every background action must be performed by invoking an ordinary, guarded, audited B11 command. There is no privileged worker path, no bulk `UPDATE`, and no flag that suppresses a guard for automated callers (`B11_ORPHAN_CLEANUP_MODEL.md` invariant O-1). B12 may schedule these however it likes; it may not bypass them.

## 4. Failure posture

| If this fails | Consequence | Correctness / security |
|---|---|---|
| Outbox dispatcher stops | B11 events are not delivered downstream | **unaffected** — rows are committed; events replay when it resumes |
| Expiry sweep stops | abandoned intents keep holding `in_flight_bytes` reservations | **unaffected** — quota fails *stricter*, never looser (`B11_STORAGE_USAGE_MODEL.md` §6) |
| Purge worker stops | deleted bytes remain at the provider | **unaffected** — `archived` is terminal with no exit transition, so access stays revoked (invariant L-1). Physical usage diverges from logical usage, which is exactly why they are two figures |
| Orphan sweeper stops | unattached and failed files accumulate | **unaffected** — nothing becomes accessible that was not already |
| Reconciliation scans stop | mismatches go undetected | **unaffected** — no case ever changed a `FileAsset` by itself; detection is not a control |
| Usage recomputation stops | the accumulator may drift | **bounded** — drift is only possible through a bug or an aborted transaction; `file_assets` remains authoritative and recomputable at any time |
| A sweep crashes mid-run | partial progress | **unaffected** — every action is a guarded, idempotent command whose guard is already false once it has happened |

This is the property worth stating plainly: **no asynchronous failure in B11 can grant access to a file, resurrect a deleted file, cross a tenant boundary, corrupt integrity data, or bypass a quota.**

## 5. Negative controls

`AT-B11B12-1` **(NC)**: a worker or scheduled job writing a `file_assets` lifecycle field by direct SQL rather than through a guarded command — fails.
`AT-B11B12-2` **(NC)**: a file becoming `available`, or a download succeeding, as a result of a background job — fails.
`AT-B11B12-3` **(NC)**: a B11 document specifying Celery, Redis, queue, or worker configuration — fails.
`AT-B11B12-4` **(NC)**: a purge worker failure causing any change to `lifecycle_state` — fails.
`AT-B11B12-5` **(NC)**: any file created under `Docs/backend/B12/`, `B13/`, or `B14/` by this phase — fails.
