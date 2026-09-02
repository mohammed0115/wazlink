# B11 — Upload Model

> Design only. No storage SDK call, no Django view, no serializer is written here.

## 1. The three candidate flows, and the choice

| | A — application-proxied | B — direct-to-storage (pre-signed) | C — hybrid |
|---|---|---|---|
| Bytes traverse the application | yes | no | conditionally |
| Server can compute SHA-256 over the actual received stream | **yes, natively** | no — must trust a client claim or re-download the object | partially |
| Server can detect content type from content | **yes, natively** | no — must re-download | partially |
| Server can enforce a hard byte ceiling mid-stream | **yes** | only if the provider enforces a signed content-length, a capability that is **unverified** for this deployment (`B11-X-007`) | partially |
| Storage credential exposure | none | a scoped, short-lived capability leaves the server | as B |
| Application bandwidth cost | high | none | medium |
| Large-file behavior | bounded by `MAX_FILE_BYTES` | better | better |
| Provider capability required | `put`, `stat`, `get`, `delete` only | additionally: pre-signed `PUT` with enforced content-length and content-type | as B |

> **`B11-D-A007`. Phase 1 is A — application-proxied upload.** Not because proxying is elegant, but because every integrity property this pack promises (`B11-D-A009` server-computed checksum, `B11-D-A010` server-detected MIME, `B11-D-A020` race-safe byte accounting) is *derivable* under A and *asserted* under B. Under B they would rest on a provider capability that, per §`B11_RESEARCH_REGISTER.md` `B11-X-001`/`B11-X-007`, this pass could not verify: Hostinger publishes no managed object-storage product, and its S3-compatible offering is a self-hosted application template on a VPS whose pre-signed-URL, content-length-enforcement, and checksum-header behavior is documented nowhere this pass could read. Choosing B would mean inventing provider behavior, which §27 of the brief forbids.

**A is a Phase-1 decision, not an architectural ceiling.** The `StorageProvider` port (`B11_STORAGE_PROVIDER_BOUNDARY.md` §2) declares `supports_presigned_upload()` as an explicit, queryable capability. When it returns true against a verified adapter, flow C becomes available by *adding* one optional response field and one verification step — the domain model, both state machines, every command name, and every acceptance test in this pack are unchanged (`B11-D-B004`). That is why the intent/finalize split below exists even though flow A could have skipped it.

## 2. The flow

```
  1. CreateUpload            [command]   client → application
        • RBAC + tenancy + validation of the *declared* metadata (gates G1-G4)
        • provisional quota check (advisory)
        • allocate deterministic storage_key, set upload_expires_at
        • INSERT file_assets (lifecycle=pending, object=unwritten,
              content_type = the allow-list member G2 admitted — provisional)
        → 201 FileAsset{
              public_id:    "FILE-…",          # frozen, required
              filename:     "<normalized>",    # frozen, required
              content_type: "<provisional>",   # frozen, required — never null
              status:       "pending",
              checksum:     null,
              upload:       { ticket, expires_at, max_bytes }
          }                                    # size_bytes omitted, not null

  2. UploadFileContent       [command]   client → application → provider
        • single-use upload ticket verified, session re-authorized
        • stream to provider under the reserved key, computing sha256 + size
          + detected content type in flight; abort the moment size > max_bytes
        • provider PUT  ................................. [provider action]
        • UPDATE storage_object_state = present
        • invoke FinalizeUpload in the SAME transaction

  3. FinalizeUpload          [command]   (inline above, or standalone)
        • VerifyUpload  ................................. [provider action: stat]
        • gates G6-G10; write detected_content_type, checksum, size_bytes
        • OVERWRITE content_type := detected  (provisional → verified, once)
        • authoritative quota reservation under a row lock (actual bytes)
        • lifecycle: pending → available | quarantined | failed
        → 200 FileAsset (available) — same required fields, verified values

  4. ExpireUpload            [command]   system, scheduled
        • any pending row past upload_expires_at → failed(upload_expired)
```

**Commands vs. provider actions.** Steps 1, 2, 3 and 4 are *commands*: each is authorized, idempotent, audited, and writes durable PostgreSQL state. The provider `put` inside step 2 and the provider `stat` inside step 3 (`VerifyUpload`) are *provider actions*: they have no independent authority, produce no state on their own, and their failure is a command outcome, never a state of its own. `VerifyUpload` is deliberately **not** a command — it is the verification half of `FinalizeUpload` and has no meaning apart from it, so promoting it to a command would create a caller-invocable operation with no durable effect.

## 3. Why finalize exists at all under flow A

Under a proxied upload the server already knows the bytes arrived, so a separate finalize looks redundant. It is kept for four reasons, each of which is load-bearing:

1. **It is the structural expression of §10's rule.** "A temporary upload must not automatically become a valid business attachment" is enforced by a state, not by a convention: nothing is attachable or downloadable until a `FinalizeUpload` has committed `available`.
2. **It is the recovery point for an interrupted response.** If the client never sees the 200 from step 2 — the classic unknown-outcome case — the safe action is `POST /files/{id}/finalize`, which is idempotent and cannot double-charge quota. Re-`POST`ing a new intent would be the unsafe action, and this design gives the client a better one.
3. **It is the seam flow C needs.** Under B/C the provider writes the bytes and only finalize can verify them.
4. **It is where quota becomes authoritative.** The intent-time check uses a *declared* size, which is a client claim. Only finalize knows the real number.

Steps 2 and 3 commit in one transaction under flow A, so the ordinary client experience is a single round trip after the intent. The standalone finalize endpoint exists for recovery and for flow C.

## 4. Idempotency of each step

| Step | Idempotency identity | Retry with the same input | Retry with a different input |
|---|---|---|---|
| `CreateUpload` | `Idempotency-Key` per frozen `BACKEND_IDEMPOTENCY_STANDARD.md` (workspace + principal + endpoint + body hash), 24h retention | replays the stored `FileAsset`; no second row, no second `storage_key` | `409 IDEMPOTENCY_CONFLICT` |
| `UploadFileContent` | the reserved `storage_key` is deterministic and already allocated, so the provider `put` is an overwrite of the same object, not a new one | same object rewritten; sha256 recomputed; no second `FileAsset`, no second quota charge | if the bytes differ, the recomputed sha256 differs and finalize records the *last* verified value — see §5 |
| `FinalizeUpload` | natural: guarded on `lifecycle_state = 'pending'` | a call against an already-`available` file replays its current representation as `200`, **not** an error (`B11-D-A013`) | a finalize carrying a `sha256`/`size_bytes` claim that disagrees with the stored, server-computed values is `409 CONFLICT` · `details.reason="file_upload_state_conflict"` |
| `ExpireUpload` | guarded on `lifecycle_state = 'pending'` AND `upload_expires_at < now()` | no-op | n/a (system command, no client body) |

**`UPLOAD_ALREADY_FINALIZED` was considered as an error code and rejected** (`B11_FAILURE_CATALOG.md` §3). A repeated finalize of the same file with the same intent is the single most common real-world retry; answering it with an error would push every client into treating a successful outcome as a failure. It replays instead. Only a finalize that *contradicts* committed state is a conflict, and `CONFLICT` already covers that.

## 5. The "same bytes uploaded intentionally twice" case

Two distinct situations must not be conflated (§11):

| Situation | Detection | Result |
|---|---|---|
| **Same request retried** | same `Idempotency-Key` + same body hash on `CreateUpload` | one `FileAsset`, replayed |
| **Same bytes, deliberately uploaded again** | a *new* `CreateUpload` with a new key; the resulting sha256 happens to match an existing row | **two `FileAsset` rows, two `FILE-*`, two storage objects, two quota charges.** No deduplication (`B11-D-A012`) |
| **Same intent, bytes re-sent after a network failure** | same `FILE-*`, same reserved `storage_key`, still `pending` | one `FileAsset`, object overwritten, one quota charge |

`B11-D-A012` is deliberate: checksum equality means the bytes match, not that the business asset is the same. Two workspaces uploading the same public PDF own two independent assets with independent lifecycles, permissions, retention, and deletion rights; silently sharing one object would mean one workspace's delete affects another's file — a cross-tenant defect dressed up as an optimization. The `checksum` index frozen B0 requires on `file_assets` therefore serves integrity verification and reconciliation, never automatic deduplication.

## 6. Import-from-URL (system actor only)

B5's frozen handoff (`B5_MEDIA_B11_HANDOFF.md` §4) requires B11 to "accept an upload-from-URL request with a bounded timeout" so an inbound WhatsApp media fetch can complete before Meta's temporary URL expires. `ImportFileFromUrl` satisfies this and is subject to five non-negotiable constraints (`B11-D-A026`):

1. **Never exposed on the public API.** It is an internal application-service command invoked by a B5 worker under the `system:messaging` actor convention. There is no `/api/v1/` operation for it, in this pack or any future one, without a new controlled amendment.
2. **Host allow-list.** The URL's host must match a configured allow-list, honoring frozen `BACKEND_SECURITY_ARCHITECTURE.md`'s "Provider URL fetches use strict allowlists and SSRF defenses."
3. **No redirect following** to a host outside the allow-list; private, loopback, and link-local address ranges are refused after DNS resolution, not merely after string inspection.
4. **Bounded** by the frozen `BACKEND_TIMEOUT_POLICY.md` "Hostinger storage" row's job deadline and by `MAX_FILE_BYTES`, enforced mid-stream exactly as in step 2.
5. **Produces an ordinary `FileAsset`** through the same `CreateUpload`/`FinalizeUpload` path, with the same validation, checksum, and quota rules. There is no privileged shortcut that bypasses verification because the bytes came from a provider.

Failure is a plain command failure. B5 sets its own `MessageMedia.fetch_status` to `expired`/`failed` from the result, exactly as its frozen handoff already specifies — B11 neither writes that field nor is consulted about what it means.

## 7. Rate limiting

Frozen `BACKEND_RATE_LIMIT_POLICY.md` has no upload row. `B11-AM-006` adds two, mirroring the shape of the existing "Export" and "Admin repair" rows: *"File upload | 60/hour/workspace and 10/min/user | workspace + user"* and *"File download | 300/hour/workspace | workspace + user"*. These are abuse controls; per that document's own closing sentence they are Redis-accelerated and are never the source of truth for the quota decision, which stays transactional in PostgreSQL (`B11_STORAGE_USAGE_MODEL.md` §4).
