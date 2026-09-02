# B11 — Acceptance Test Matrix

> Design only. Tests are **contracts, not implementation**. Every Class A decision in `B11_DECISION_REGISTER.md` cites at least one ID below. B5's own five media assertions (`AT-MEDIA-*`) test the boundary from B5's side and are **not** duplicated here; B11's symmetric checks are distinctly prefixed so no ID collides.

## 1. Full test list

| Test ID | Category | Pos/Neg | Assertion |
|---|---|---|---|
| `AT-B11UP-1` | Upload | positive | `CreateUpload` returns a `FILE-*` plus a ticket; the row is `pending`/`unwritten` with a `storage_key` allocated and no bytes written |
| `AT-B11UP-2` | Upload | positive | **Same-tenant upload:** intent → bytes → finalize yields `available` with a server-computed `checksum`, measured `size_bytes`, and a canonical `content_type` |
| `AT-B11UP-3` | Upload | negative | A `pending` file is not downloadable — `404`, regardless of ticket validity |
| `AT-B11UP-4` | Upload | negative | **Attach before READY:** a `pending` file is not attachable — `409 CONFLICT` · `file_not_ready` |
| `AT-B11UP-5` | Upload | positive | A standalone `POST /files/{id}/finalize` after an interrupted upload response yields the same `available` file, charging quota once |
| `AT-B11UP-6` | Upload | negative | No `CreateUpload` response contains a provider URL, bucket, host, region, or credential in any field |
| `AT-B11UP-7` | Upload | positive | **Frozen `201` shape:** `CreateUpload` with an allow-listed declared type returns `201` carrying `public_id`, `filename`, and a non-null `content_type` equal to the allow-list member gate G2 admitted — the validated provisional type, while the row is still `pending` |
| `AT-B11UP-8` | Upload | negative | No `FileAsset` response, in any lifecycle state or on any replay, omits or nulls `public_id`, `filename`, or `content_type`; `size_bytes` is **absent** rather than `null` while unmeasured, and `checksum` is `null` rather than absent |
| `AT-B11VAL-1` | Validation | negative | Declared type off the allow-list → `422 FILE_TYPE_NOT_ALLOWED`, **no row created**, no provider call |
| `AT-B11VAL-2` | Validation | negative | **Size mismatch / too large:** bytes exceeding `MAX_FILE_BYTES` abort the provider write mid-stream → `422 FILE_TOO_LARGE`, `failed` |
| `AT-B11VAL-3` | Validation | negative | A zero-byte file → `422 VALIDATION_ERROR` |
| `AT-B11VAL-4` | Validation | negative | **MIME mismatch:** a file declared `application/pdf` whose content detects as HTML → `422 FILE_TYPE_NOT_ALLOWED` · `mime_mismatch`, `failed`, object purged |
| `AT-B11VAL-5` | Validation | negative | **Unsafe filename:** a filename containing `/`, `\`, `.` or `..` is rejected outright, not sanitized → `422 VALIDATION_ERROR` |
| `AT-B11VAL-6` | Validation | positive | An Arabic filename survives NFC normalization, storage, and the `Content-Disposition` round trip via RFC 5987 `filename*` |
| `AT-B11VAL-7` | Validation | negative | A filename carrying a bidi override (`U+202E`) has the control character stripped while its legitimate RTL text is preserved |
| `AT-B11VAL-8` | Validation | negative | `image/svg+xml` is rejected both as a declared type (G2) and as a detected type (G7) |
| `AT-B11VAL-9` | Validation | positive | **Provisional → verified:** a successful finalize overwrites `content_type` with `detected_content_type` exactly once, in the same transaction as the lifecycle transition, whether or not the detected type equals the provisional one; no later command, worker, operator action, or repair writes the column again |
| `AT-B11VAL-10` | Validation | negative | A declared type failing gate G2 produces `422 FILE_TYPE_NOT_ALLOWED` and **no row**, so no unvalidated client string can ever reach `content_type`; the provisional value is always drawn from the closed server-side allow-list, never copied verbatim from the request |
| `AT-B11INT-1` | Integrity | positive | `checksum` is a 64-character lowercase-hex SHA-256 computed by the server over the received stream, written once at finalize |
| `AT-B11INT-2` | Integrity | negative | **Checksum mismatch:** a client `sha256` claim disagreeing with the server-computed value → `422 FILE_INTEGRITY_MISMATCH`, `failed`, **no quota charged** |
| `AT-B11INT-3` | Integrity | negative | `stat_object().size_bytes` disagreeing with the streamed count → `422 FILE_INTEGRITY_MISMATCH` |
| `AT-B11INT-4` | Integrity | negative | `provider_etag` is never compared against `checksum` and never participates in any integrity decision |
| `AT-B11INT-5` | Integrity | negative | A re-verification mismatch quarantines the file and **never rewrites** the stored `checksum` |
| `AT-B11LC-1` | Lifecycle | positive | The schema accepts exactly the five frozen lifecycle values and rejects any sixth |
| `AT-B11LC-2` | Lifecycle | negative | No command, worker, reconciliation repair, or operator action transitions a file out of `archived` |
| `AT-B11LC-3` | Lifecycle | positive | `available → quarantined → available` round-trips under `file.manage` with a mandatory reason recorded at each step |
| `AT-B11LC-4` | Lifecycle | negative | An unlisted transition → `409 CONFLICT` · `file_upload_state_conflict` |
| `AT-B11LC-5` | Lifecycle | negative | **Operator quarantine is scoped to `available`:** `QuarantineFile` against a `pending` file → `409 CONFLICT` · `file_upload_state_conflict`; only `FinalizeUpload` may produce `pending → quarantined`, and the two producers are never conflated |
| `AT-B11IDEM-1` | Idempotency | positive | **Duplicate request retry:** the same `Idempotency-Key` and body replays one `FileAsset` — one row, one `storage_key`, one reservation |
| `AT-B11IDEM-2` | Idempotency | positive | **Double finalize:** two concurrent finalizations produce one transition and one replay; quota is charged exactly once |
| `AT-B11IDEM-3` | Idempotency | positive | **Finalize vs. expiration:** exactly one wins under the row lock; the loser receives `409 UPLOAD_EXPIRED` or a no-op, never both outcomes |
| `AT-B11IDEM-4` | Idempotency | positive | **Delete twice:** both calls return `204`; logical usage is decremented once |
| `AT-B11IDEM-5` | Idempotency | negative | The same `Idempotency-Key` with a different body → `409 IDEMPOTENCY_CONFLICT` |
| `AT-B11DUP-1` | Duplicate bytes | positive | **Same bytes intentionally uploaded twice:** two `FILE-*`, two storage objects, two quota charges, two independent lifecycles — no deduplication |
| `AT-B11DUP-2` | Duplicate bytes | negative | No code path looks a file up by `checksum` to decide whether to store one |
| `AT-B11RACE-1` | Concurrency | negative | **Attach vs. delete:** neither serialization order produces an attachment to a deleted file |
| `AT-B11RACE-2` | Concurrency | positive | **Download vs. delete:** an already-authorized in-flight stream completes; no new download begins; the ticket is invalidated |
| `AT-B11RACE-3` | Concurrency | positive | Purge worker vs. reconciliation scan produces exactly one open case per real problem |
| `AT-B11RACE-4` | Concurrency | negative | **Finalize vs. delete:** the two commands' source-state guards are disjoint, so no interleaving exists in which a `pending` file is archived, quota is charged twice, or quota is decremented without having been charged |
| `AT-B11RACE-5` | Concurrency | negative | **Detach vs. delete:** both orders serialize on the `file_assets` lock and `DeleteAsset` never observes a half-committed detach; no order deletes a file whose attachment is still `active` |
| `AT-B11ATT-1` | Attachment | positive | Attaching an `available` file to a registered subject creates one `active` link and emits `FileAttached` |
| `AT-B11ATT-2` | Attachment | positive | A duplicate attach of the same `(file, subject)` replays the existing attachment; the partial unique index holds |
| `AT-B11ATT-3` | Attachment | negative | A Viewer holding only `file.download` cannot attach |
| `AT-B11ATT-4` | Attachment | negative | An actor lacking the subject domain's own write permission cannot attach, even holding `file.upload` |
| `AT-B11ATT-5` | Attachment | negative | **Cross-tenant attachment denied:** a foreign file, or a foreign subject, → `404 ENTITY_NOT_FOUND` |
| `AT-B11ATT-6` | Attachment | negative | A `subject_type` outside the closed enum → `422 VALIDATION_ERROR`; there is no free-text subject type |
| `AT-B11TEN-1` | Tenancy | negative | **Cross-tenant metadata lookup denied:** `GET /files/{id}` for a foreign file → `404`, indistinguishable from a miss |
| `AT-B11TEN-2` | Tenancy | negative | **Cross-tenant download denied:** both `/download` and `/content` → `404` |
| `AT-B11TEN-3` | Tenancy | negative | **Cross-tenant finalize denied** → `404` |
| `AT-B11TEN-4` | Tenancy | negative | Cross-tenant delete → `404` |
| `AT-B11TEN-5` | Tenancy | negative | **Cross-tenant upload access denied:** a ticket minted in workspace A is unusable from workspace B |
| `AT-B11TEN-6` | Tenancy | negative | No authorization decision anywhere parses a storage key to determine tenancy |
| `AT-B11RBAC-1` | RBAC | negative | An actor holding `file.upload` but not `file.delete` cannot delete → `403` |
| `AT-B11RBAC-2` | RBAC | negative | A non-`file.manage` actor cannot quarantine, release, or resolve a reconciliation case |
| `AT-B11RBAC-3` | RBAC | negative | `storage_key`, `provider_etag`, `declared_content_type`, `detected_content_type`, `storage_object_state`, and `failure_detail` are absent from every response below `file.manage` |
| `AT-B11RBAC-4` | RBAC | negative | A client-supplied `retention_class` other than `product` → `403 PERMISSION_DENIED` |
| `AT-B11DL-1` | Download | positive | `/download` returns the frozen `FileDownload` shape whose `download_url` is an application URL on WazLink's own origin |
| `AT-B11DL-2` | Download | negative | A structurally valid ticket presented without a session → `401 AUTH_REQUIRED` |
| `AT-B11DL-3` | Download | negative | A still-unexpired ticket presented after the actor's role was downgraded → `403 PERMISSION_DENIED` |
| `AT-B11DL-4` | Download | negative | A ticket already redeemed once → `403`; tickets are single-use |
| `AT-B11DL-5` | Download | negative | **Download a deleted or quarantined file:** `404`, regardless of ticket validity |
| `AT-B11DL-6` | Download | positive | Every byte response carries `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and a `Content-Type` drawn from the closed allow-list |
| `AT-B11DEL-1` | Deletion | positive | `DeleteAsset` archives the file, decrements logical usage, emits `FileDeleted`, and leaves the provider object untouched |
| `AT-B11DEL-2` | Deletion | negative | **Delete while attached:** `409 CONFLICT` · `file_attachment_present` |
| `AT-B11DEL-3` | Deletion | positive | Detach-then-delete succeeds; a file attached to two subjects requires **both** detachments first |
| `AT-B11DEL-4` | Deletion | negative | **Download a deleted file:** `404 ENTITY_NOT_FOUND`, never a distinguishable "was deleted" |
| `AT-B11DEL-5` | Deletion | positive | Purge after `PURGE_GRACE` reaches `purged` and emits `FileObjectPurged` |
| `AT-B11DEL-6` | Deletion | negative | **Provider delete timeout:** `storage_object_state → purge_failed`, `lifecycle_state` stays `archived`, and access remains revoked — no resurrection under any retry outcome |
| `AT-B11DEL-7` | Deletion | negative | **`pending` is not deletable:** `DeleteAsset` against a `pending` file returns `409 CONFLICT` · `file_upload_state_conflict`, leaves the row and its `in_flight_bytes` reservation untouched, and never produces `pending → archived`; retiring an in-flight intent is `ExpireUpload`'s job alone |
| `AT-B11ORP-1` | Orphan | positive | An expired intent with no bytes reaches `failed(upload_expired)`, releases its reservation, and is confirmed `purged` by `stat` |
| `AT-B11ORP-2` | Orphan | positive | Bytes uploaded but never finalized are purged after `ORPHAN_GRACE`; the tombstone row is retained |
| `AT-B11ORP-3` | Orphan | negative | An `available`, unattached file inside the grace window is **not** swept — uploading before attaching stays legitimate |
| `AT-B11ORP-4` | Orphan | negative | An `available` file whose every attachment is `detached` (class `O-4`) is never auto-swept at any age |
| `AT-B11ORP-5` | Orphan | negative | A provider object with no metadata row (class `O-6`/`R-5`) is reported and **never auto-deleted** |
| `AT-B11ORP-6` | Orphan | positive | **Orphan reconciliation:** an `O-3` sweep invokes the ordinary guarded `DeleteAsset` under `system:files`, fully audited, with no privileged fast path |
| `AT-B11REC-1` | Reconciliation | positive | **Provider object missing** under a `pending` file → `failed`, reservation released |
| `AT-B11REC-2` | Reconciliation | negative | Provider object missing under an `available` file → **quarantined**, never silently archived and never silently served |
| `AT-B11REC-3` | Reconciliation | positive | **Metadata missing/incomplete:** an object with a long-stale `pending` row is expired to `failed` and **never auto-promoted** to `available` |
| `AT-B11REC-4` | Reconciliation | negative | A stored object hashing differently opens case `R-4`, quarantines the file, and leaves the recorded hash unchanged |
| `AT-B11REC-5` | Reconciliation | positive | Usage drift is recomputed from `file_assets` and repaired under a row lock, with a before/after audit entry |
| `AT-B11REC-6` | Reconciliation | negative | Opening, repairing, or dismissing a case never mutates a `FileAsset` except by invoking an ordinary guarded command |
| `AT-B11UNK-1` | Unknown outcome | negative | No code path allocates a second `storage_key` for an existing `FileAsset`, under any retry, failure, or repair |
| `AT-B11UNK-2` | Unknown outcome | positive | **Unknown provider outcome:** the next provider call after a timeout is a side-effect-free `stat_object`, never a repeated mutating call |
| `AT-B11UNK-3` | Unknown outcome | positive | A retried `put_object` targets the identical key; no duplicate object and no second row result |
| `AT-B11QUO-1` | Quota | negative | An intent beyond the ceiling → `403 QUOTA_EXHAUSTED` **before** any row is inserted and before any provider call |
| `AT-B11QUO-2` | Quota | negative | An understated declared size is still rejected at finalize against the measured byte count |
| `AT-B11QUO-3` | Quota | positive | **Quota boundary:** a file exactly filling the remaining headroom succeeds; one byte more fails |
| `AT-B11QUO-4` | Quota | positive | `failed` and `archived` files are excluded from logical usage; an `archived`-but-unpurged file is still included in physical usage |
| `AT-B11QUO-5` | Quota | positive | **Concurrent quota race:** N simultaneous intents cannot collectively exceed the ceiling, because each reserves against `logical_bytes + in_flight_bytes` under the same row lock |
| `AT-B11QUO-6` | Quota | positive | A rolled-back transaction leaves both `logical_bytes` and `in_flight_bytes` unchanged — usage is consumed only on committed effect |
| `AT-B11QUO-7` | Quota | positive | **Conditional decrement:** `available → archived` and `quarantined → archived` each decrement `logical_bytes` exactly once; `failed → archived` decrements nothing, because a `failed` file was never counted. `logical_bytes` cannot underflow through any legal command sequence |
| `AT-B11USE-1` | Usage | positive | Logical and physical usage are reported as two distinct series and legitimately differ while a purge is pending |
| `AT-B11USE-2` | Usage | positive | A `legal`-class artifact is excluded from workspace logical usage and included in physical usage |
| `AT-B11SEC-1` | Security | negative | **Path traversal:** no filename, in any encoding, reaches any position of a storage key |
| `AT-B11SEC-2` | Security | negative | Control characters, line separators, and bidi overrides are stripped before storage |
| `AT-B11SEC-3` | Security | negative | **Public URL leakage:** no response, event payload, metric, or log line contains a provider URL, bucket, region, or host |
| `AT-B11SEC-4` | Security | negative | **Credential leakage:** no storage credential appears in any DTO, event, log, metric, error, or client bundle |
| `AT-B11SEC-5` | Security | negative | **Provider error leakage:** raw provider status strings and messages never cross the adapter boundary |
| `AT-B11SEC-6` | Security | negative | **Metadata injection:** a filename or content type cannot inject into an HTTP header or a log line |
| `AT-B11SEC-7` | Security | negative | **HTML/SVG active content:** such types are rejected at ingest, and every byte response independently forces `attachment` + `nosniff` |
| `AT-B11KEY-1` | Storage key | positive | The key is a pure function of two server-generated UUIDs plus a UTC year/month; no client-supplied string appears |
| `AT-B11KEY-2` | Storage key | negative | No authorization or tenancy decision parses a storage key |
| `AT-B11KEY-3` | Storage key | negative | The key contains no file extension, no secret, no public ID, and no PII |
| `AT-B11PROV-1` | Provider boundary | negative | No domain module, DTO, event, or error names a bucket, region, endpoint, or provider SDK type |
| `AT-B11PROV-2` | Provider boundary | positive | An unrecognized provider status maps to `unknown` and opens a case — never optimistically to success |
| `AT-B11PROV-3` | Provider boundary | negative | The Phase-1 adapter reports `supports_presigned_upload()`/`supports_presigned_download()` as false and mints no provider-signed URL |
| `AT-B11PROV-4` | Provider boundary | positive | **Frozen response set intact:** **both** frozen operations — `createFileUpload` and `downloadFile` — still declare the frozen `502 ProviderUnavailable`, even though neither Phase-1 path (row insert; local ticket mint) can raise it; no frozen response is removed, narrowed, or re-pointed on either |
| `AT-B11MSG-1` | Messaging boundary | negative | No B11 command, worker, or repair writes `messages`, `conversations`, or `message_deliveries` |
| `AT-B11MSG-2` | Messaging boundary | negative | **Message media boundary:** no B11 logic reads `MessageMedia.fetch_status` or branches on a Message's delivery state |
| `AT-B11MSG-3` | Messaging boundary | negative | `ImportFileFromUrl` is unreachable from `/api/v1/` and rejects any non-system actor |
| `AT-B11MSG-4` | Messaging boundary | negative | `provider_media_id` is never `file_assets.public_id`, never a lookup key, and never in a storage key |
| `AT-B11MSG-5` | Messaging boundary | negative | `DeleteAsset` fails on a file whose only `active` attachment is `message_media` |
| `AT-B11TAX-1` | Tax boundary | negative | **B10 authority firewall:** no B11 command, worker, event handler, or repair writes any B10-owned table |
| `AT-B11TAX-2` | Tax boundary | negative | No B11 logic reads a `FileAsset` state to infer a tax document's issued/reported/cleared/accepted/rejected status |
| `AT-B11TAX-3` | Tax boundary | negative | `DeleteAsset`, the orphan sweeper, and the purge worker all refuse a `legal`-class file |
| `AT-B11TAX-4` | Tax boundary | negative | `retention_class` cannot be mutated after creation, in either direction |
| `AT-B11TAX-5` | Tax boundary | negative | No B11 document asserts a statutory retention period, ZATCA obligation, or compliance status |
| `AT-B11B8-1` | Billing boundary | negative | No B11 write path touches `plans`, `plan_versions`, `quota_definitions`, `plan_version_quotas`, `subscriptions`, `usage_counters`, or `usage_ledger` |
| `AT-B11B8-2` | Billing boundary | negative | No B11 table, column, or DTO expresses a per-plan or per-workspace commercial storage allowance |
| `AT-B11B8-3` | Billing boundary | negative | B11 returns no `EntitlementDecision`, nor any DTO shaped like one, for storage |
| `AT-B11B8-4` | Billing boundary | negative | The platform safety ceiling does not vary by plan, subscription, or workspace |
| `AT-B11B8-5` | Billing boundary | negative | No B11 document asserts a per-plan storage limit figure |
| `AT-B11B9-1` | Finance boundary | negative | No B11 write path touches `revenue_events`, `revenue_reversals`, or `attribution_touchpoints`, and no file state implies a revenue fact |
| `AT-B11CRM-1` | CRM boundary | negative | No CRM subject type is registered, no CRM DTO gains an attachment field, and no `FileAsset` state implies anything about a Lead, Deal, or Business |
| `AT-B11B12-1` | B12 boundary | negative | No worker writes a `file_assets` lifecycle field by direct SQL rather than through a guarded command |
| `AT-B11B12-2` | B12 boundary | negative | No file becomes `available`, and no download succeeds, as a result of a background job |
| `AT-B11B12-3` | B12 boundary | negative | No B11 document specifies Celery, Redis, queue, or worker configuration |
| `AT-B11B12-4` | B12 boundary | negative | A purge-worker failure causes no change to `lifecycle_state` |
| `AT-B11B12-5` | B12 boundary | negative | No file is created under `Docs/backend/B12/`, `B13/`, or `B14/` by this phase |

## 2. Counts

`ACCEPTANCE_TEST_COUNT` — distinct IDs in §1: `UP(8) + VAL(10) + INT(5) + LC(5) + IDEM(5) + DUP(2) + RACE(5) + ATT(6) + TEN(6) + RBAC(4) + DL(6) + DEL(7) + ORP(6) + REC(6) + UNK(3) + QUO(7) + USE(2) + SEC(7) + KEY(3) + PROV(4) + MSG(5) + TAX(5) + B8(5) + B9(1) + CRM(1) + B12(5) = **129**`.

`ACCEPTANCE_CATEGORY_COUNT` — `COUNT(DISTINCT Category)` over §1's Category column, the authoritative method B8 established: Upload; Validation; Integrity; Lifecycle; Idempotency; Duplicate bytes; Concurrency; Attachment; Tenancy; RBAC; Download; Deletion; Orphan; Reconciliation; Unknown outcome; Quota; Usage; Security; Storage key; Provider boundary; Messaging boundary; Tax boundary; Billing boundary; Finance boundary; CRM boundary; B12 boundary = **26**.

`NEGATIVE_CONTROL_COUNT` — counted directly from the Pos/Neg column: `UP(4) + VAL(8) + INT(4) + LC(3) + IDEM(1) + DUP(1) + RACE(3) + ATT(4) + TEN(6) + RBAC(4) + DL(4) + DEL(4) + ORP(3) + REC(3) + UNK(1) + QUO(2) + USE(0) + SEC(7) + KEY(2) + PROV(2) + MSG(5) + TAX(5) + B8(5) + B9(1) + CRM(1) + B12(5) = **88**`.

`DUPLICATE_ACCEPTANCE_TESTS = 0` — every `AT-B11*` ID above is unique.

## 3. Brief §38 coverage

Every one of the twenty-six mandatory scenarios maps to at least one test:

| Required scenario | Test(s) |
|---|---|
| same-tenant upload | `AT-B11UP-2` |
| cross-tenant upload access denied | `AT-B11TEN-5` |
| cross-tenant download denied | `AT-B11TEN-2` |
| cross-tenant attachment denied | `AT-B11ATT-5`, `AT-B11TEN-4` |
| expired upload cannot finalize | `AT-B11IDEM-3`, `AT-B11ORP-1` |
| double finalize | `AT-B11IDEM-2` |
| checksum mismatch | `AT-B11INT-2`, `AT-B11REC-4` |
| size mismatch | `AT-B11INT-3`, `AT-B11VAL-2` |
| MIME mismatch | `AT-B11VAL-4` |
| unsafe filename | `AT-B11VAL-5`, `AT-B11VAL-7`, `AT-B11SEC-2` |
| duplicate request retry | `AT-B11IDEM-1` |
| same bytes intentional second upload | `AT-B11DUP-1` |
| attach before READY | `AT-B11UP-4` |
| delete while attached | `AT-B11DEL-2` |
| delete twice | `AT-B11IDEM-4` |
| download deleted file | `AT-B11DEL-4`, `AT-B11DL-5` |
| provider delete timeout | `AT-B11DEL-6` |
| unknown provider outcome | `AT-B11UNK-2`, `AT-B11UNK-3`, `AT-B11PROV-2` |
| quota boundary | `AT-B11QUO-3` |
| concurrent quota race | `AT-B11QUO-5` |
| finalize/delete race | `AT-B11RACE-4` (finalize vs. delete), `AT-B11RACE-5` (detach vs. delete), `AT-B11RACE-1` (attach vs. delete), `AT-B11RACE-2` (download vs. delete) |
| orphan reconciliation | `AT-B11ORP-6` |
| provider object missing | `AT-B11REC-1`, `AT-B11REC-2` |
| metadata missing/incomplete | `AT-B11REC-3`, `AT-B11ORP-5` |
| message media boundary | `AT-B11MSG-1`…`5` |
| B10 tax artifact authority firewall | `AT-B11TAX-1`…`5` |

```
ACCEPTANCE_TEST_COUNT = 129
ACCEPTANCE_CATEGORY_COUNT = 26
NEGATIVE_CONTROL_COUNT = 88
DUPLICATE_ACCEPTANCE_TESTS = 0
```

`88 negative + 41 positive = 129` ✓. **B11-FIX.1a** added one further test — `AT-B11LC-5`, scoping operator quarantine to `available` — and widened `AT-B11PROV-4` to assert the frozen `502` on **both** frozen operations. The nine tests added by **B11-FIX.1** are `AT-B11UP-7`/`8` (frozen `201` field set), `AT-B11VAL-9`/`10` (provisional→verified `content_type`), `AT-B11DEL-7` (`pending` not deletable), `AT-B11QUO-7` (conditional `logical_bytes` decrement), `AT-B11RACE-4`/`5` (finalize-vs-delete, detach-vs-delete), and `AT-B11PROV-4` (frozen `502` retained). No category was added; every one lands in a category §1 already had.
