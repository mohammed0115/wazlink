# B11 — Orphan & Cleanup Model

> Design only. Answers §22. The governing rule is stated first because everything else is a consequence of it.

## 1. Governing rule

> **`B11-D-A017`. An unattached `available` file is NOT garbage.** Uploading before attaching is the normal, intended sequence for every Phase-1 flow: `B5_MEDIA_B11_HANDOFF.md` §3's outbound path has the actor upload through the composer and only then send, and `AttachFile` is called when the Message row is created — which may be seconds or hours later, or never, if the user changes their mind mid-draft.

Any sweeper that treated "unattached" as "deletable" would destroy a user's staged attachment while they were still typing. The eligibility test below therefore requires *four* independent conditions, and "currently unattached" is only one of them.

## 2. Orphan classes

| Class | Definition | State signature | Auto-cleanable |
|---|---|---|:--:|
| `O-1` | expired upload intent, no bytes ever written | `lifecycle=pending` (past TTL) or `failed(upload_expired)`, `object=unwritten` | **yes** — nothing was ever a business asset |
| `O-2` | bytes uploaded, finalization never succeeded | `lifecycle=failed`, `object=present` | **yes**, after `ORPHAN_GRACE` — a `failed` file is unreachable by definition |
| `O-3` | `available` file with no attachment, **never** attached | `lifecycle=available`, zero `file_attachments` rows of any state | **only** under §3's full test |
| `O-4` | `available` file whose every attachment is `detached` | `lifecycle=available`, ≥1 row, all `detached` | **no** — see §3 |
| `O-5` | logically deleted, provider bytes still present | `lifecycle=archived`, `object ∈ {present, purge_pending, purge_failed}` | **yes** — this is the ordinary purge path, not an anomaly |
| `O-6` | provider object with no known `file_assets` row | discovered only by a `list_objects` sweep | **no** — reported as reconciliation case `R-5`, never auto-deleted |

Classes `O-1`, `O-2`, and `O-5` are routine lifecycle work. Only `O-3`, `O-4`, and `O-6` are judgement calls, and two of the three are resolved by refusing to judge.

## 3. Eligibility test for `O-3`

All four must hold:

1. `lifecycle_state = 'available'`;
2. `retention_class = 'product'`;
3. **no `file_attachments` row has ever existed** for this file — not "no active row." The `detached` rows retained by `B11_FILE_LIFECYCLE.md` §4 are what make this a durable historical fact rather than a snapshot that a concurrent detach could flip;
4. `created_at < now() - ORPHAN_GRACE` (7 days proposed).

**`O-4` is deliberately excluded.** A file that was once attached and has since been released is *evidence of a deliberate human act*, and its detachment may itself be the thing under review. Sweeping it would destroy the record of what was attached and then removed. `O-4` files are reported to operations and removed only by an explicit `DeleteAsset`. This is the single most important line in this document: the sweeper's blind spot is chosen, not accidental.

**`O-6` is never auto-deleted.** A provider object with no row is exactly as likely to be a *lost row* as a *leaked object* — and if it is a lost row, deleting the object destroys the only remaining copy of a customer's file. The sweeper reports it, records size and key, and stops. `ORPHAN_DELETION_SAFETY_GAPS = 0` rests on this paragraph and on §4. Negative controls `AT-B11ORP-4`, `AT-B11ORP-5`.

## 4. What the sweep does, and does not do

| Class | Sweeper action |
|---|---|
| `O-1` | `ExpireUpload` → `failed(upload_expired)`; release `in_flight_bytes`; `PurgeFileObject` confirms via `stat` that nothing exists → `purged` |
| `O-2` | `PurgeFileObject` after `ORPHAN_GRACE`; the `file_assets` row is retained as a tombstone |
| `O-3` (passing §3) | **`DeleteAsset` under a system actor** — the ordinary logical-deletion command, fully audited, emitting `FileDeleted`, followed by the ordinary `PURGE_GRACE` timer. The sweeper has **no privileged deletion path** and cannot skip a guard |
| `O-4` | report only |
| `O-5` | `PurgeFileObject` after `PURGE_GRACE` |
| `O-6` | open reconciliation case `R-5`; report only |

> **Invariant O-1.** The sweeper invokes only commands that already exist and are already guarded. There is no `sweeper_delete` fast path, no direct SQL `UPDATE`, and no flag that suppresses a guard for automated callers. An `O-3` file that fails any `DeleteAsset` guard — because it was attached one second ago, or because its retention class is `legal` — is simply not deleted, with no special case.

Every sweeper deletion appends an `AuditLog` entry with actor `system:files`, the class that matched, and the age that qualified it, so "why did this disappear" is always answerable — the frozen "Repairs are explicit, permissioned, idempotent, and audited" doctrine applied to cleanup.

## 5. Grace periods

Grace periods are **conceptual safety margins, not tuned constants.** Their required properties, in order of importance:

1. `ORPHAN_GRACE` must exceed the longest plausible gap between a user uploading and attaching. A weekend is the obvious floor; 7 days is a deliberate over-provision, because the cost of waiting is storage and the cost of being wrong is a destroyed file.
2. `PURGE_GRACE` must exceed the window in which an accidental deletion is typically noticed and reported.
3. `UPLOAD_INTENT_TTL` must exceed a slow large upload and must not exceed a working day.

All three are `PRODUCT DECISION REQUIRED` (`B11-D-B007`). Nothing in the model breaks at any value; only the trade-off between storage cost and recovery window moves.

## 6. Idempotency and concurrency

The sweep is idempotent by construction: every action is a guarded command whose guard is already false once the action has happened. Running it twice concurrently is safe — the second run's `SELECT … FOR UPDATE` on each row observes the first run's committed state and skips.

The sweep is **detection plus command invocation**, never a bulk `UPDATE`. It processes rows in bounded batches with a stable order so that a crash mid-run resumes rather than restarts, and so that a single pathological workspace cannot starve the rest. Execution mechanics — batch size, cadence, worker pool — belong to B12 (`B11_B12_ASYNC_BOUNDARY.md` §2), not here.
