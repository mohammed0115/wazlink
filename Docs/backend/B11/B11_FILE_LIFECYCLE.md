# B11 — File Lifecycle

> Design only. `STATE_MACHINE_COUNT = 4`, `STATE_COUNT = 15`. Machine 1 is frozen by B0 and reused verbatim; machines 2–4 are B11-owned and additive.

## 1. Why four machines and not one

The brief (§8) asks for the *minimum correct* model and lists seven candidate states. Collapsing every concern into one enum was tested and fails: it cannot represent "the user can no longer see this file, but its bytes are still at the provider because the delete call timed out" — the exact state §20 requires must never silently grant access. So the concerns are separated (`B11-D-A006`):

| # | Machine | Question it answers | States |
|---:|---|---|---:|
| 1 | **FileAsset lifecycle** (frozen B0) | May the application serve this file? | 5 |
| 2 | **Storage object disposition** (B11) | Do bytes exist at the provider? | 5 |
| 3 | **FileAttachment lifecycle** (B11) | Is this link to a subject live? | 2 |
| 4 | **ReconciliationCase** (B11) | Has a detected mismatch been dealt with? | 3 |

Rejected candidate states, with reasons, are in §6 — the brief explicitly warns against blindly adopting the listed names.

## 2. Machine 1 — FileAsset lifecycle (frozen)

Frozen `BACKEND_STATE_MACHINES.md` line 55 states verbatim: *"FileAsset is `pending→available/quarantined/failed→archived`."* B11 adopts these five state names **unchanged** and adds no sixth.

| State | Meaning | Downloadable | Attachable | Counts toward product usage |
|---|---|:--:|:--:|:--:|
| `pending` | Row and storage key exist; bytes are absent, incomplete, or not yet verified | no | no | no (counted as `in_flight`, §`B11_STORAGE_USAGE_MODEL.md` §3) |
| `available` | Bytes written, verified against a server-computed SHA-256, size and detected content type accepted | **yes** | **yes** | **yes** |
| `quarantined` | Bytes exist and are intact, but the file is withheld from download pending or following a safety determination | no | no (already-active attachments are **not** severed) | yes |
| `failed` | The upload did not produce a usable asset: verification failed, the object is missing, the intent expired, or validation rejected the content | no | no | no |
| `archived` | Logically deleted. Access is revoked at this instant, irrevocably | no | no | no |

**Legal transitions (8).** Anything not listed is rejected with `409 CONFLICT` · `details.reason="file_upload_state_conflict"`.

| From | To | Trigger | Notes |
|---|---|---|---|
| `pending` | `available` | `FinalizeUpload`, all checks passed | the only path to usability |
| `pending` | `quarantined` | `FinalizeUpload`, integrity passed but a safety determination withheld the file | Phase 1 has no automated producer; this is the designated scanner integration point (`B11-D-A024`) |
| `pending` | `failed` | `FinalizeUpload` verification failure, or `ExpireUpload` | terminal for usability |
| `available` | `quarantined` | `QuarantineFile` (operator, `file.manage`) | additive edge, registered as `B11-AM-010` |
| `quarantined` | `available` | `ReleaseQuarantinedFile` (operator, `file.manage`) | additive edge, same amendment |
| `available` | `archived` | `DeleteAsset` | |
| `quarantined` | `archived` | `DeleteAsset` | a held file must still be deletable |
| `failed` | `archived` | `DeleteAsset` **only** (user, or the orphan sweeper invoking that same guarded command) | no `logical_bytes` change — a `failed` file was never counted (`B11_DELETION_RETENTION_MODEL.md` §2.1) |

**Terminal state: `archived`, and only `archived`.** There is no un-delete (`B11-D-A015`). `failed` is terminal for *usability* but not for the row, which may still be archived for cleanup.

**The two quarantine edges have different producers and must not be conflated.** `pending → quarantined` belongs to `FinalizeUpload` alone — it is the outcome of verification and content-safety judgement, and is the designated scanner integration point (`B11-D-A024`, no automated producer in Phase 1). `available → quarantined` belongs to the operator command `QuarantineFile`, whose precondition is therefore `lifecycle_state = 'available'` and nothing wider (`B11_COMMAND_EVENT_CATALOG.md` §1). An operator cannot withhold a `pending` file, because a file finalize has not yet judged is not being withheld from anyone — it was never servable. Reconciliation classes `R-1`, `R-4`, and `R-8` quarantine only `available` files, so they route through the same single edge. Negative control `AT-B11LC-5`.

**`pending` has exactly three exits, and `archived` is not one of them.** An intent that never finalizes is retired by `ExpireUpload` to `failed(upload_expired)` — not archived — because expiry must also release the `in_flight_bytes` reservation, which `DeleteAsset` does not do. `DeleteAsset` is guarded to the three source states listed above (`B11_DELETION_RETENTION_MODEL.md` §2); orphan classes `O-1` and `O-2` accordingly invoke `ExpireUpload` and `PurgeFileObject`, **neither of which writes `lifecycle_state → archived`** (`B11_ORPHAN_CLEANUP_MODEL.md` §4). Only class `O-3` reaches `archived`, and it does so by invoking the ordinary `DeleteAsset` against an `available` file.

**Invariant L-1.** No transition out of `archived` exists in any command, worker, reconciliation repair, or operator action defined anywhere in this pack. This is the structural guarantee behind `B11-D-A016`.

## 3. Machine 2 — Storage object disposition (B11-owned, orthogonal)

| State | Meaning |
|---|---|
| `unwritten` | No object has been written under `storage_key` (initial) |
| `present` | An object exists under `storage_key` |
| `purge_pending` | Physical deletion has been requested and not yet confirmed |
| `purged` | The provider confirmed the object is gone (terminal) |
| `purge_failed` | A purge attempt failed or returned an unknown outcome; retried under `BACKEND_RETRY_POLICY.md`'s "Storage failure" row (yes, max 5, "failed asset + retry action") |

| From | To | Trigger |
|---|---|---|
| `unwritten` | `present` | `UploadFileContent` / `ImportFileFromUrl` completed a provider write |
| `unwritten` | `purged` | `ExpireUpload`/`PurgeFileObject` confirmed via `stat` that nothing was ever written |
| `present` | `purge_pending` | `PurgeFileObject` accepted |
| `purge_pending` | `purged` | provider delete confirmed, or a follow-up `stat` proved absence |
| `purge_pending` | `purge_failed` | provider error, timeout, or unknown outcome |
| `purge_failed` | `purge_pending` | retry admitted (attempt budget not exhausted) |
| `purge_failed` | `purged` | a later `stat` proves the object is absent after all (§`B11_RECONCILIATION_MODEL.md` §3, class `R-3`) |
| `present` | `unwritten` | **does not exist** — bytes never un-write themselves |

**Invariant L-2 (the orthogonality proof).** The transition tables in §2 and §3 share no trigger and no guard. No row of §3 reads `lifecycle_state`; no row of §2 reads `storage_object_state`. Therefore no provider outcome — success, failure, timeout, or permanently unknown — can move a `FileAsset` between lifecycle states. A file that reached `archived` stays inaccessible whether its bytes are `purged`, stuck in `purge_failed` forever, or never existed. Negative control `AT-B11DEL-6`.

The one deliberate *read* across the boundary is a guard, never a write: `PurgeFileObject` refuses to run unless `lifecycle_state = 'archived'` **or** (`lifecycle_state = 'failed'` and the file was never attached). Purging bytes out from under a servable file is structurally impossible.

## 4. Machine 3 — FileAttachment lifecycle

| State | Meaning |
|---|---|
| `active` | The link is live; the file counts as referenced for orphan and deletion purposes |
| `detached` | The link was explicitly released by the subject-owning domain (terminal) |

`active → detached` via `DetachFile` only. A `detached` row is **retained, never deleted**, so that "this file was once attached" remains provable — which is precisely what makes `B11_ORPHAN_CLEANUP_MODEL.md`'s "never attached" test safe rather than a race.

## 5. Machine 4 — ReconciliationCase

| State | Meaning |
|---|---|
| `open` | A mismatch was detected and not yet resolved |
| `repaired` | An explicit, permissioned, idempotent, audited repair closed it (terminal) |
| `dismissed` | An operator judged it benign, with a mandatory reason (terminal) |

Mirrors the "explicit, permissioned, idempotent, and audited" repair doctrine frozen `BACKEND_RECONCILIATION.md` already requires of every other reconciliation process. A case never mutates a `FileAsset` by itself; it records what should happen and which command did it.

## 6. Candidate states considered and rejected

| Candidate | Verdict | Reason |
|---|---|---|
| `PENDING_UPLOAD` | rejected as a name | frozen B0 already names this state `pending`; renaming a frozen state would be a non-additive change for zero gain |
| `UPLOADED` (distinct from `READY`) | **rejected as a lifecycle state** | "bytes arrived" is not a business fact — unverified bytes are indistinguishable from an attack. It is represented instead as `storage_object_state='present'` while `lifecycle_state` is still `pending`, which is exactly the distinction §8 asks for, without a sixth lifecycle state |
| `READY` | rejected as a name | frozen B0 already names it `available` |
| `DELETING` | **rejected** | it conflates "access revoked" with "bytes being removed." Access revocation is instantaneous (`archived`); byte removal is `storage_object_state='purge_pending'`. A single `DELETING` state would have to answer "is it downloadable?" and there is no safe answer |
| `DELETED` | rejected as a name | frozen B0 names the terminal state `archived`, and `BACKEND_DATA_GOVERNANCE.md` already standardizes `archived_at` across every table |
| `EXPIRED` | **rejected** | an expired intent produced no usable asset — that is what `failed` means. A separate state would duplicate `failed`'s entire downstream handling. The *reason* is preserved in `failure_reason='upload_expired'`, which is where reason belongs |

## 7. Count derivation

`STATE_COUNT` = 5 (machine 1) + 5 (machine 2) + 2 (machine 3) + 3 (machine 4) = **15**, counted from the state tables above. `STATE_MACHINE_COUNT = 4`.
