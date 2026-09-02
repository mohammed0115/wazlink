# B11 — Failure Catalog

> Design only. `ERROR_NEW_COUNT = 3`. Reuse was attempted for every candidate before any code was added; §3 records the twelve candidates and what happened to each.

## 1. Reused frozen codes

| Code | HTTP | B11 usage |
|---|---:|---|
| `AUTH_REQUIRED` | 401 | any file operation without a session — including one carrying a perfectly valid download ticket |
| `PERMISSION_DENIED` | 403 | `file.upload`/`download`/`delete`/`manage` denied; the composed subject permission denied; a client attempting `retention_class='legal'`; `DeleteAsset` on a `legal`-class file |
| `QUOTA_EXHAUSTED` | 403 | per-file or per-workspace ceiling exceeded, at intent or at finalize |
| `ENTITY_NOT_FOUND` | 404 | a `FILE-*` absent, archived, or belonging to another workspace — indistinguishable by design; an unresolvable attachment subject |
| `VALIDATION_ERROR` | 400/422 | filename, empty file, unknown `subject_type`, unknown request field, missing `Content-Length` |
| `CONFLICT` | 409 | file not in an attachable/servable state; attachment present at delete; finalize contradicting committed state |
| `STALE_VERSION` | 409 | `expected_version` mismatch on `quarantineFile`/`releaseFile` |
| `IDEMPOTENCY_CONFLICT` | 409 | same `Idempotency-Key`, different body |
| `FILE_TYPE_NOT_ALLOWED` | 422 | **already frozen for exactly this purpose**; declared or detected type off the allow-list, or a declared-vs-detected group mismatch |
| `PROVIDER_UNAVAILABLE` | 502/503 | storage provider unreachable or erroring transiently |
| `INTERNAL_ERROR` | 500 | the frozen universal response |

Eleven reused codes. `FILE_TYPE_NOT_ALLOWED` is notable: frozen B0 minted it for the Files domain before the Files domain was designed, and it fits without adjustment.

## 2. New codes

`B11-AM-004` registers exactly three, all inside the existing envelope and the existing HTTP-status doctrine — **zero new status codes, zero new envelope fields**.

| Code | HTTP | Meaning | Why not reused |
|---|---:|---|---|
| `FILE_TOO_LARGE` | 422 | the file exceeds `MAX_FILE_BYTES`, detected at intent (declared) or mid-stream (measured) | `VALIDATION_ERROR` would work syntactically but erases the one distinction clients act on — a size failure is retryable with a smaller file, a validation failure is not. 422 matches its frozen sibling `FILE_TYPE_NOT_ALLOWED`; `BACKEND_API_STANDARD.md`'s closed status list has no `413`, and a `413` emitted by the web server below the application is infrastructure, not this contract |
| `FILE_INTEGRITY_MISMATCH` | 422 | server-computed SHA-256 or measured size disagrees with a client claim or with `stat_object` | folding it into `VALIDATION_ERROR` would bury a corruption or tamper signal that must be alerted on and counted separately (`B11_OBSERVABILITY.md` §2). It is the one client-visible failure that may indicate an attack rather than a mistake |
| `UPLOAD_EXPIRED` | 409 | finalizing or uploading against an intent past `upload_expires_at` | direct precedent: frozen B0 minted `QUOTE_EXPIRED` (409) for the structurally identical UpgradeQuote case rather than reusing `CONFLICT`. Consistency with that decision is worth more than one fewer code |

## 3. Candidates considered and NOT added

| Candidate (brief §34) | Resolution |
|---|---|
| `FILE_NOT_FOUND` | **reuse `ENTITY_NOT_FOUND`.** A file-specific 404 would leak that the path is a file route to an unauthorized caller; the frozen code is deliberately uniform |
| `FILE_NOT_READY` | **reuse `CONFLICT`** with `details.reason="file_not_ready"`. A not-ready file is precisely "state conflict," the frozen code's own definition |
| `UPLOAD_ALREADY_FINALIZED` | **no error at all.** A repeated finalize of the same file replays `200` (`B11_UPLOAD_MODEL.md` §4). Making the commonest retry an error would push clients to treat success as failure. Only a *contradicting* finalize is `CONFLICT` |
| `FILE_ALREADY_DELETED` | **no error at all.** A second delete returns `204`. Access to a deleted file is `404 ENTITY_NOT_FOUND`, matching B0's archive semantics and leaking nothing |
| `FILE_ATTACHMENT_CONFLICT` | **reuse `CONFLICT`** with `details.reason="file_attachment_present"` |
| `FILE_QUOTA_EXCEEDED` | **reuse `QUOTA_EXHAUSTED`.** The frozen meaning ("quota unavailable") is exact; a near-duplicate would fragment client handling and imply B11 owns a quota concept B8 owns |
| `STORAGE_PROVIDER_UNAVAILABLE` | **reuse `PROVIDER_UNAVAILABLE`.** Naming the provider in a code would leak the integration to a client |
| `STORAGE_OUTCOME_UNKNOWN` | **no code.** The architecture removes the need: deterministic immutable keys plus idempotent provider operations plus reconcile-before-retry mean the client's safe action after any timeout is the same idempotent `finalize` it would have called anyway. A code telling a client "we don't know" would invite exactly the blind retry §24 forbids. The unknown outcome is handled server-side as a reconciliation case (`R-1`/`R-3`), and the client sees `502 PROVIDER_UNAVAILABLE` |

Eight of twelve candidates were absorbed. That ratio is the point of §34's instruction to search the frozen catalog first.

## 4. New `CONFLICT` reason values

Frozen `B1_API_DTO_CONTRACTS.md` line 308 declares a **closed** vocabulary: *"`409 CONFLICT` always carries a `details.reason` from this closed set: `invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`. A `409 CONFLICT` without a `reason` is invalid."* B11 uses three values not in that set, so `B11-AM-009` registers them additively — the same class of amendment B2 established (`B2-D-B011`) and B10 was required to file (`B10-AM-008`):

`file_not_ready` · `file_attachment_present` · `file_upload_state_conflict`

No existing reason value is altered, no new code is introduced, and no existing operation's behavior changes.

## 5. Failure scenarios

| ID | Scenario | User-visible | Internal state | Retry/idempotency | Alert/reconciliation |
|---|---|---|---|---|---|
| `B11-F-001` | declared type off the allow-list | `422 FILE_TYPE_NOT_ALLOWED` | no row created | not retryable as-is | metric only |
| `B11-F-002` | detected type off the allow-list | `422 FILE_TYPE_NOT_ALLOWED` | `failed`; object purged | not retryable | metric only |
| `B11-F-003` | declared/detected group mismatch | `422 FILE_TYPE_NOT_ALLOWED` · `mime_mismatch` | `failed`; object purged | not retryable | **security metric** — a disguise attempt |
| `B11-F-004` | declared size over ceiling | `422 FILE_TOO_LARGE` | no row created | no | metric only |
| `B11-F-005` | measured size over ceiling mid-stream | `422 FILE_TOO_LARGE` | `failed`; partial object purged | no | **security metric** — the declared size was a lie |
| `B11-F-006` | empty file | `422 VALIDATION_ERROR` | `failed` | no | metric only |
| `B11-F-007` | unsafe filename (separator, control char) | `422 VALIDATION_ERROR` | no row created | no | **security metric** |
| `B11-F-008` | client `sha256` disagrees with server-computed | `422 FILE_INTEGRITY_MISMATCH` | `failed`; object purged; **no quota charged** | no | **alert** |
| `B11-F-009` | `stat_object` size disagrees with streamed count | `422 FILE_INTEGRITY_MISMATCH` | `failed` | no | **alert** |
| `B11-F-010` | intent expired before finalize | `409 UPLOAD_EXPIRED` | `failed(upload_expired)`; reservation released | new intent required | metric only |
| `B11-F-011` | finalize replayed on an `available` file | `200`, current representation | unchanged | idempotent | none |
| `B11-F-012` | finalize contradicting committed state | `409 CONFLICT` · `file_upload_state_conflict` | unchanged | no | metric only |
| `B11-F-013` | attach a `pending`/`quarantined`/`failed`/`archived` file | `409 CONFLICT` · `file_not_ready` | unchanged | after the file is `available` | metric only |
| `B11-F-014` | attach a cross-workspace file or subject | `404 ENTITY_NOT_FOUND` | unchanged | no | **cross-workspace authorization alert** (frozen alert list) |
| `B11-F-015` | attach an unregistered `subject_type` | `422 VALIDATION_ERROR` | unchanged | no | metric only |
| `B11-F-016` | duplicate attach of the same `(file, subject)` | `200`, existing attachment | unchanged | idempotent | none |
| `B11-F-017` | delete a file with an `active` attachment | `409 CONFLICT` · `file_attachment_present` | unchanged | after detach | metric only |
| `B11-F-018` | delete a `legal`-class file | `403 PERMISSION_DENIED` | unchanged | never | metric only |
| `B11-F-019` | delete twice | `204` both times | `archived` after the first | idempotent | none |
| `B11-F-020` | download an `archived` file | `404 ENTITY_NOT_FOUND` | unchanged | never | metric only |
| `B11-F-021` | download a `quarantined` file | `404 ENTITY_NOT_FOUND` | unchanged | after release | metric only |
| `B11-F-022` | download with an expired or already-used ticket | `403 PERMISSION_DENIED` | unchanged | request a new ticket | metric only |
| `B11-F-023` | provider unavailable during upload | `502 PROVIDER_UNAVAILABLE` | `pending`, key preserved | **safe** — retry the same key, then `finalize` | frozen "Storage failure" retry row; storage-failure alert |
| `B11-F-024` | provider timeout with unknown outcome (write) | `502 PROVIDER_UNAVAILABLE` | `pending`; case `R-1` opened | `stat` first, never a blind repeat | **alert** |
| `B11-F-025` | provider delete timeout / failure | **nothing** — access was already revoked | `archived` + `purge_failed`; case `R-3` | bounded retry, max 5 | **alert** after the budget |
| `B11-F-026` | provider object missing under an `available` file | none until download, then `404` | `QuarantineFile`d; case `R-1` | operator decision | **alert** |
| `B11-F-027` | stored object hashes differently on re-verification | none until download, then `404` | `QuarantineFile`d; case `R-4`; **hash never rewritten** | operator decision | **alert** |
| `B11-F-028` | provider object with no metadata row | none | case `R-5`; **never auto-deleted** | operator decision | **alert** |
| `B11-F-029` | quota ceiling reached at intent | `403 QUOTA_EXHAUSTED` | no row created | after deletion or a raised ceiling | metric only |
| `B11-F-030` | quota ceiling reached at finalize | `403 QUOTA_EXHAUSTED` | `failed`; object purged; reservation released | as above | metric only |
| `B11-F-031` | concurrent finalize race | one `200` transition, one `200` replay | `available`; **quota charged once** | idempotent | none |
| `B11-F-032` | concurrent attach vs. delete | one succeeds, the other `409` | consistent either way | retry after resolution | none |
| `B11-F-033` | `ImportFileFromUrl` source URL expired or host not allow-listed | n/a (system) | `failed`; B5 sets its own `fetch_status` | B5's own policy decides | metric only |
| `B11-F-034` | dangling attachment subject | none | case `R-6`; **never auto-detached** | operator decision | **alert** |
| `B11-F-035` | usage accumulator drifts from `file_assets` | none | case `R-7`; recomputed and repaired | idempotent | quota-ledger-divergence alert (frozen alert list) |

`FAILURE_SCENARIO_COUNT = 35`, counted as the rows above.

Frozen `BACKEND_FAILURE_MATRIX.md`'s single Files row — *"Storage upload failure \| upload failed \| asset quarantined/failed \| retry key \| operations"* — is realized by `B11-F-023` through `B11-F-028` and is not contradicted: the internal state is `failed` (verification) or `quarantined` (a file that was serving and no longer verifies), the retry carries the stable storage key, and the destination is operations.
