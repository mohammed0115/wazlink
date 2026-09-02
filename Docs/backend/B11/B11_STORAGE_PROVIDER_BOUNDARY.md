# B11 — Storage Provider Boundary

> Design only. No adapter, SDK call, credential, bucket, or endpoint is created. Realizes the frozen `BACKEND_INTEGRATION_BOUNDARIES.md` row: *"Hostinger storage | `FileStorageProvider` | outbound | Files | blob only, signed/proxied access, checksum, MIME/size/quarantine."*

## 1. The port name is frozen — reuse it

Frozen B0 already names the port `FileStorageProvider`. B11 **reuses that name verbatim** and mints no alternative (the brief's §26 suggestion of a `StorageProvider` name is declined for exactly the reason `B10_CONTROLLED_AMENDMENTS.md` declined to rename `TaxProvider`: renaming a frozen port for cosmetic reasons is drift with no architectural gain).

## 2. Port operations

Conceptual operations only. Method names below are *domain-facing intent names*, not a frozen wire signature; the adapter maps them onto whatever the provider actually offers.

| Operation | Domain intent | Required in Phase 1 | Failure semantics |
|---|---|:--:|---|
| `put_object(key, stream, declared_length)` | write bytes once under a caller-supplied deterministic key | **yes** | success / transient failure / **unknown outcome** — never "created a different key" |
| `stat_object(key)` | return `{exists, size_bytes, provider_etag}` without transferring bytes | **yes** | success / not-found / transient failure |
| `open_object(key)` | return a byte stream for proxied download | **yes** | success / not-found / transient failure |
| `delete_object(key)` | remove the object; **idempotent** — deleting an absent object is success, not an error | **yes** | success / transient failure / unknown outcome |
| `list_objects(prefix, cursor)` | enumerate keys under a prefix, for reconciliation class `R-5` only | **yes** (operator/worker path only) | success / transient failure |
| `supports_presigned_upload()` | capability query | yes — returns **false** for the Phase-1 adapter | pure predicate, never throws |
| `supports_presigned_download()` | capability query | yes — returns **false** for the Phase-1 adapter | pure predicate, never throws |
| `presigned_upload(key, ttl, max_bytes, content_type)` | mint a short-lived direct-upload capability | **no** — unimplemented while the capability query is false | n/a in Phase 1 |
| `presigned_download(key, ttl)` | mint a short-lived direct-download capability | **no** — same | n/a in Phase 1 |

The two capability predicates are the entire mechanism by which flows B/C (`B11_UPLOAD_MODEL.md` §1) and provider-signed downloads (`B11_SECURITY_PRIVACY.md` §5) become available later. Nothing in the domain branches on *which provider* is configured; it branches only on *what the port reports it can do*. That is what makes the provider swappable (`B11-D-B004`).

## 3. What the domain must never see

No domain module, DTO, event payload, error message, log line, or metric label ever contains: a bucket name, a region, an endpoint host, an access key, a secret key, a session token, a provider request ID reused as identity, a provider URL, or a provider-specific status string. Provider errors are translated by the adapter into exactly four classes before crossing the boundary — `not_found`, `transient`, `permanent`, `unknown` — following the frozen "Adapters return typed success/error results and attach request ID, provider request ID, cost metadata, and retry classification" rule. A provider status the adapter does not recognize maps to `unknown`, never optimistically to success, mirroring `B10-D-A019`'s fail-closed doctrine.

`STORAGE_PROVIDER_AUTHORITY_LEAKS = 0` follows from this section plus `B11_DOMAIN_MODEL.md` §5: nothing the provider says changes a `lifecycle_state`, and nothing the provider stores is read as business meaning.

## 4. Unknown outcome (§24)

A `put_object` or `delete_object` that times out **may already have succeeded at the provider**. The design makes this safe without ever guessing:

1. **Deterministic keys.** `storage_key` is allocated once at `CreateUpload` and never re-derived (`B11_STORAGE_KEY_MODEL.md` §3). A retried `put_object` therefore targets the same object. It cannot create a second object, a duplicate, or an orphan.
2. **Idempotent delete.** `delete_object` on an absent key is success. A retried delete cannot fail merely because the first one worked.
3. **Reconcile before unsafe retry.** For any operation classified `unknown`, the next step is `stat_object`, not a blind repeat. `stat` is side-effect-free and answers the question the timeout left open. Only if `stat` itself fails does the operation enter `BACKEND_RETRY_POLICY.md`'s "Storage failure" row (retry yes, max 5, terminal "failed asset + retry action").
4. **No state change on unknown.** An `unknown` outcome leaves `storage_object_state` at `purge_pending` (for deletes) or unchanged (for writes) and opens a reconciliation case. It never advances to `present` or `purged` on hope.

> **Invariant P-1.** No retry in this pack can create a storage object the domain does not already have a row for, because every write targets a key that was allocated inside the transaction that created that row. `UNKNOWN_OUTCOME_RETRY_GAPS = 0` rests on this sentence.

## 5. Timeouts

Reused verbatim from frozen `BACKEND_TIMEOUT_POLICY.md`: *"Hostinger storage | 5s connect | 60s request | 10m job."* B11 proposes no different numbers and amends that table not at all. The 60s request budget is the deadline for a single provider call, not for a whole proxied upload; a proxied stream is bounded by `MAX_FILE_BYTES` and by the 10m job ceiling.

## 6. The Hostinger boundary, stated honestly

Frozen B0 names "Hostinger platform storage" in five documents. This pass established (`B11-X-001`, `B11_RESEARCH_REGISTER.md`) that **Hostinger publishes no managed object-storage product**; its S3-compatible offering is a self-hosted Docker application template deployed onto a customer VPS, described on Hostinger's own page as *"Deploy RustFS on your VPS in one click with a ready-to-use Docker template."* That page asserts broad S3 API compatibility but documents nothing about pre-signed URLs, checksum headers, or ETag semantics.

Three things follow, and B11 keeps them strictly separate:

| Layer | Status |
|---|---|
| **Domain requirement** | fully specified here and in `B11_FILE_LIFECYCLE.md` — five operations, four error classes, deterministic keys, idempotent delete. **Decided.** |
| **Provider capability** | `PROVIDER CAPABILITY VERIFICATION REQUIRED BEFORE IMPLEMENTATION`. Specifically: does the deployed target support pre-signed upload with enforced content-length; pre-signed download with a bounded TTL; server-side checksum headers; object-lock or immutability; lifecycle rules. **`B11-X-007`, UNRESOLVED.** |
| **Implementation adapter** | not designed, not authorized, and not required for any Phase-1 behavior in this pack |

Because Phase 1 uses only `put`/`stat`/`open`/`delete`/`list` — the operations any S3-compatible store or even a plain filesystem provides — **no unresolved provider capability blocks Phase-1 architecture.** That is the deliberate payoff of choosing flow A. `CLASS_A_UNRESOLVED = 0` is true precisely because every provider-dependent question sits in Class B (`B11-D-B004`), not in a Class A decision.
