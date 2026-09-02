# B11 — Checksum & Integrity

> Design only. Realizes the frozen `file_assets` "checksum index" constraint (`BACKEND_DATA_MODEL.md` line 25) and the frozen `FileStorageProvider` boundary note "blob only, signed/proxied access, **checksum**, MIME/size/quarantine."

## 1. Algorithm

> **`B11-D-A009`. SHA-256, lowercase hex, 64 characters, stored in `file_assets.checksum`.**

No frozen contract specifies an algorithm — `BACKEND_DATA_MODEL.md` says only "checksum index," `B5_MEDIA_B11_HANDOFF.md` §2 says only `checksum | text | populated once stored, from B11`. B11 therefore chooses, and chooses a modern cryptographic hash rather than MD5 or CRC. The choice is recorded in `B11-AM-007` as a compatible clarification of B5's untyped field so that B5's `MessageMedia.checksum` has a defined meaning rather than an implied one.

The column stores the bare hex digest. The algorithm is a schema-level constant, not a per-row field: a per-row algorithm column would invite a future row claiming `md5` and be trusted for it. Changing the algorithm later is a migration with an explicit re-hash plan, not a data value.

## 2. Who computes it, and when

| Flow | Computed by | When | Over what |
|---|---|---|---|
| Proxied upload (Phase 1, all client uploads) | the application | **in flight**, while streaming to the provider | the exact byte sequence the application forwarded |
| `ImportFileFromUrl` (B5 inbound media) | the application | in flight, while streaming from the source URL to the provider | the exact byte sequence fetched |
| Direct-to-storage (flow B/C, deferred) | the application, after the fact | at `FinalizeUpload`, by reading the object back | the stored object |

Under Phase 1's flow A the hash is computed over the bytes the application itself handled, which is the strongest available guarantee: it is not a claim about the object, it is a measurement of the transfer. This is the concrete reason `B11_UPLOAD_MODEL.md` §1 chose flow A.

## 3. When it becomes trusted

`checksum` is written exactly once, inside the `FinalizeUpload` transaction, at the same instant `lifecycle_state` becomes `available` or `quarantined`. Before that commit the value is a working figure with no authority; after it, the value is immutable for the life of the row.

> **Invariant I-1.** `checksum` is never updated. Not by a reconciliation repair, not by an operator, not by a re-verification. If a stored object's bytes no longer hash to the recorded value, the *object* is wrong, and the response is a reconciliation case (`R-4`) plus withdrawal of the file — never a rewrite of the recorded hash to match reality. Rewriting the hash would convert integrity detection into integrity laundering.

## 4. Mismatch handling

| Situation | Detection point | Result |
|---|---|---|
| Client supplied a `sha256` claim that disagrees with the server-computed value | `FinalizeUpload` | `422 FILE_INTEGRITY_MISMATCH`; `lifecycle → failed`; the object is scheduled for purge; **no quota is charged** |
| Streamed byte count disagrees with `stat_object().size_bytes` | `FinalizeUpload` | same |
| Streamed byte count disagrees with a declared size | `FinalizeUpload` | same, `details.field="size_bytes"` |
| A later verification finds the stored object hashes differently | reconciliation sweep | case `R-4` opened; the file is `QuarantineFile`'d pending operator decision — **not** silently re-hashed, and **not** silently deleted |
| The provider reports no object at all | `FinalizeUpload` or reconciliation | case `R-1`; `lifecycle → failed` if still `pending`, otherwise case `R-1` on an `available` file, which is quarantined |

A client `sha256` claim is **optional**. When absent, the server-computed value stands alone and nothing is compared — there is no weaker code path, because the server never trusted the claim anyway. When present, it is a redundancy check that can only cause rejection, never acceptance.

## 5. Provider ETag is not a checksum

> **`B11-D-A009` (second half). `file_assets.provider_etag` is stored as opaque provider metadata and is NEVER treated as a cryptographic checksum, NEVER compared against `checksum`, and NEVER used in an integrity decision.**

This is not a stylistic preference. Amazon's own S3 API reference — the specification every S3-compatible store, including the RustFS-class deployment Hostinger offers, claims conformance with — states verbatim (`B11-X-002`, fetched from `docs.aws.amazon.com` during this pass):

> *"The ETag may or may not be an MD5 digest of the object data. Whether or not it is depends on how the object was created and how it is encrypted … If an object is created by either the Multipart Upload or Part Copy operation, the ETag is not an MD5 digest, regardless of the method of encryption."*

So the ETag is (a) not guaranteed to be a hash of the content at all, (b) MD5 even when it is — an algorithm unsuitable for integrity against an adversary, and (c) definitionally not a content hash for any multipart upload, which is exactly how large files arrive. Treating it as a checksum would produce a check that silently passes on precisely the objects most worth checking.

`provider_etag` has exactly one legitimate use: as a cheap **change hint** during reconciliation. If a `stat_object` returns an ETag differing from the recorded one, that is evidence the object *may* have changed and justifies the expensive full re-hash. It never, on its own, proves the object is intact or corrupt.

`CHECKSUM_TRUST_GAPS = 0` rests on §3 (single write point, never updated), §4 (mismatch always fails closed), and this section (no provider value is ever promoted to integrity authority).

## 6. What the checksum index is for

Frozen B0 requires a checksum index on `file_assets`. B11 uses it for exactly three things:

1. **Reconciliation lookups** — resolving a discovered object back to its expected digest.
2. **Integrity re-verification sweeps** — batching re-hash work by digest.
3. **Operator investigation** — answering "did this exact byte sequence appear elsewhere in this workspace" during an abuse report.

It is **not** used for deduplication (`B11-D-A012`), and no code path in this pack looks up a file by checksum to decide whether to store one. The reasoning is in `B11_UPLOAD_MODEL.md` §5: checksum equality proves bytes match; it proves nothing about ownership, permission, retention, or deletion rights, and sharing an object across two workspaces on the strength of a hash collision-free match would make one tenant's delete affect another's file.
