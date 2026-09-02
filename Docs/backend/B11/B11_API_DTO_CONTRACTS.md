# B11 — API & DTO Contracts

> Design only. All paths are under the frozen `/api/v1/` base. Two operations are frozen in `BACKEND_OPENAPI_V1.yaml` and reused; nine are additive under `B11-AM-002`.

## 1. Operations

| # | Method | Path | operationId | Permission | Request | Response | Status | Idem./async |
|---:|---|---|---|---|---|---|---|---|
| 1 | POST | `/files/uploads` | `createFileUpload` **(frozen)** | `file.upload` | `UploadRequest` | `FileAsset` | 201 | yes/no |
| 2 | PUT | `/files/{id}/content` | `uploadFileContent` | `file.upload` | `application/octet-stream` + headers | `FileAsset` | 200 | yes/no |
| 3 | POST | `/files/{id}/finalize` | `finalizeFileUpload` | `file.upload` | `FinalizeUploadRequest` | `FileAsset` | 200 | yes/no |
| 4 | GET | `/files/{id}` | `getFile` | `file.download` | — | `FileAsset` | 200 | n/a/no |
| 5 | GET | `/files/{id}/download` | `downloadFile` **(frozen)** | `file.download` | — | `FileDownload` | 200 | n/a/no |
| 6 | GET | `/files/{id}/content` | `getFileContent` | `file.download` | — | byte stream | 200 | n/a/no |
| 7 | DELETE | `/files/{id}` | `deleteFile` | `file.delete` | — | empty | 204 | yes/no |
| 8 | POST | `/files/{id}/attachments` | `attachFile` | `file.upload` + subject write | `AttachmentCreate` | `FileAttachment` | 201 | yes/no |
| 9 | DELETE | `/files/{id}/attachments/{attachment_id}` | `detachFile` | `file.upload` + subject write | — | empty | 204 | yes/no |
| 10 | POST | `/files/{id}/quarantine` | `quarantineFile` | `file.manage` | `FileModerationRequest` | `FileAsset` | 200 | yes/no |
| 11 | POST | `/files/{id}/release` | `releaseFile` | `file.manage` | `FileModerationRequest` | `FileAsset` | 200 | yes/no |

`PUBLIC_API_OPERATION_COUNT = 11`. `ADDITIVE_API_OPERATION_COUNT = 9` (rows 2, 3, 4, 6, 7, 8, 9, 10, 11).

**No list endpoint.** `GET /files` is deliberately absent (`B11-D-B005`): the frozen frontend has no file-management surface, and `BACKEND_API_STANDARD.md` restricts filtering and sorting to the two catalog-marked collections. Inventing a third would widen the query surface for a UI that does not exist.

**`ImportFileFromUrl` has no operation.** It is an internal application-service command only (`B11_UPLOAD_MODEL.md` §6). Negative control `AT-B11MSG-3`.

## 2. Reconciling the two frozen operations

Frozen `BACKEND_API_CATALOG.md` describes `POST /files/uploads` as "signed upload" and `GET /files/{id}/download` as "signed/proxied download" with DTO "redirect/stream," while frozen `BACKEND_OPENAPI_V1.yaml` gives the first a `FileAsset` response carrying no URL and the second a `FileDownload{download_url, expires_at}` JSON response. The two frozen artifacts are not fully consistent with each other, and B11 must resolve rather than inherit the ambiguity. `B11-AM-003` records the resolution as a **compatible clarification**:

- **"Signed upload"** is realized as an *application-signed upload authorization* — the short-lived, single-use `upload.ticket` returned alongside the frozen `FileAsset` body. It is not, and in Phase 1 never becomes, a provider pre-signed URL. The word "signed" stays accurate; what does the signing changes.
- **`/download` returns JSON** (`FileDownload`, exactly the frozen schema), and its `download_url` points at operation 6 on WazLink's own origin. The catalog's "stream" is operation 6; the OpenAPI's JSON is operation 5. Both frozen descriptions become true at once, and neither is contradicted.
- `FileDownload.download_url` is therefore **always an application URL, never a provider URL.** `B11-D-A003`.

## 3. DTOs

**`UploadRequest`** (frozen schema, `additionalProperties: false`, required `filename`, `content_type`) — extended additively with three optional properties under `B11-AM-001`:

| Field | Type | Required | Notes |
|---|---|:--:|---|
| `filename` | string | **yes** (frozen) | untrusted; normalized per `B11_FILE_VALIDATION.md` §5 |
| `content_type` | string | **yes** (frozen) | untrusted; stored as `declared_content_type` |
| `size_bytes` | integer ≥ 0 | no (new) | advisory; drives the provisional quota check and the in-flight reservation. Absent ⇒ `MAX_FILE_BYTES` is reserved |
| `sha256` | string, 64 lowercase hex | no (new) | a client claim; can only cause rejection, never acceptance |
| `retention_class` | enum `product`\|`legal` | no (new) | **system actors only**; a client-supplied value other than `product` is `403 PERMISSION_DENIED` |

**`FileAsset`** (frozen schema, `additionalProperties: false`, required `public_id`, `filename`, `content_type`) — extended additively:

| Field | Type | Required | Notes |
|---|---|:--:|---|
| `public_id` | string `FILE-*` | **yes** (frozen) | |
| `filename` | string | **yes** (frozen) | the normalized `original_filename` |
| `content_type` | string | **yes** (frozen) | the **canonical** value, **never null in any response, at any lifecycle state** — the validated provisional type while `pending`, the verified detected type after finalize (`B11_FILE_VALIDATION.md` §3.1) |
| `size_bytes` | integer ≥ 0 | no (frozen, optional) | **omitted from the response** while `pending`, never serialized as `null` — the frozen schema types it `integer`, so an absent measurement is an absent key |
| `status` | enum, 5 values | no (new) | the frozen lifecycle state |
| `checksum` | string \| null | no (new) | SHA-256 hex; explicitly nullable, and declared so in the additive schema — unlike `size_bytes`, which is frozen and non-nullable and is therefore omitted rather than nulled |
| `created_at`, `updated_at` | date-time | no (new) | the platform-standard entity fields |
| `version` | integer | no (new) | required by `BACKEND_DTO_CONTRACTS.md` for editable resources |
| `upload` | object \| null | no (new) | present only on the `201` from operation 1: `{ ticket, expires_at, max_bytes }`. **Never** a provider URL or credential |

Never present in any response at any permission level below `file.manage`: `storage_key`, `provider_etag`, `declared_content_type`, `detected_content_type`, `storage_object_state`, `failure_detail`. Never present at **any** level: a provider URL, bucket, host, or credential.

> **Every `FileAsset` response satisfies the frozen required set, in every lifecycle state.** `public_id`, `filename`, and `content_type` are present and non-null on the `201` from operation 1, on the `200` from operations 2, 3, 4, 10, and 11, and on every replay. This is a property of the schema, not of a code path: `file_assets.content_type` is `NOT NULL` from insert (`B11_STORAGE_MODEL.md` §1), so a `FileAsset` that could violate the frozen contract cannot be persisted in the first place. The frozen-optional `size_bytes` and the additive `checksum` are the only fields whose presence varies with state, and they vary in the two different ways their schemas allow — omission for the frozen non-nullable one, `null` for the additive nullable one. Acceptance: `AT-B11UP-7`, `AT-B11UP-8`.

**`FinalizeUploadRequest`**: `{ sha256?: string, size_bytes?: integer }` — both optional cross-checks. Contradicting committed state is `409 CONFLICT` · `file_upload_state_conflict`; there is no field by which a client can *set* either value.

**`FileDownload`** (frozen schema, unchanged): `{ download_url: uri, expires_at: date-time }`, both required. `download_url` is an application URL bearing a single-use ticket; `expires_at` is the ticket TTL.

**`AttachmentCreate`**: `{ subject_type: enum(2), subject_ref: string }`. **`FileAttachment`**: `{ attachment_id, file_ref, subject_type, subject_ref, state, created_at }`.

**`FileModerationRequest`**: `{ reason: string (required, non-empty), expected_version: integer (required) }`. A reason is mandatory on both quarantine and release, matching `B10-D-A016`'s reason-required posture for privileged state changes.

## 4. Transport rules

Every `POST`/`PUT`/`DELETE` above requires `Idempotency-Key` per frozen `BACKEND_IDEMPOTENCY_STANDARD.md`. `quarantineFile`/`releaseFile` additionally require `expected_version` and return `409 STALE_VERSION` on mismatch — the explicit-version-field option `BACKEND_API_STANDARD.md` permits, matching B8's and B10's choice. Every request DTO is `additionalProperties: false`; an unknown field is `400 VALIDATION_ERROR`, never silently ignored (Doctrine R-4). `workspace_id`, `public_id`, `status`, `version`, `checksum`, `storage_key`, and every timestamp are never client-writable.

Operation 2 carries its bytes as `application/octet-stream` with `Content-Length` required; a chunked request without a length is rejected, because the mid-stream ceiling check needs a declared bound to fail fast against — and is still enforced against the actual count regardless of what the header claimed.

## 5. Status codes

Every operation declares `401` `Unauthorized`, `403` `Forbidden`, `404` `NotFound` (where an id is in the path), `422` `ValidationError` (where a body exists), and the universal `500` `InternalError`, using the frozen reusable response components.

**`502` `ProviderUnavailable`**, honoring `BACKEND_API_STANDARD.md`'s rule that `502` "applies only to provider-dependent operations":

Three classes, and the distinction that matters is **declared** versus **actively raised** — a response can be part of the public contract without the current Phase-1 command path having any way to produce it.

| Class | Operations | `502` declared | Actively raised in Phase 1 |
|---|---|:--:|---|
| **A — frozen declaration, retained verbatim** | **1 `createFileUpload`**, **5 `downloadFile`** | **yes — both frozen `502` declarations are kept exactly as `BACKEND_OPENAPI_V1.yaml` has them** | **no.** `CreateUpload` inserts a row and allocates a key; `downloadFile` mints an application ticket from local state. Neither calls the storage provider at that step (`B11_IDEMPOTENCY_CONCURRENCY.md` §5), so nothing in the current path can produce a provider failure |
| **B — additive, provider-dependent** | 2 `uploadFileContent`, 3 `finalizeFileUpload`, 6 `getFileContent`, 7 `deleteFile` | **yes**, added by B11 | **yes** — each makes a storage-provider call (`put`, `stat`, `open`, and a delete that may consult provider state) |
| **C — additive, purely local** | 4 `getFile`, 8 `attachFile`, 9 `detachFile`, 10 `quarantineFile`, 11 `releaseFile` | **no** — B11 adds none, and none is frozen | n/a — reading metadata, linking rows, and writing a lifecycle field touch no provider |

> **Both frozen operations keep their frozen `502`.** `BACKEND_OPENAPI_V1.yaml` declares `502 ProviderUnavailable` on `createFileUpload` **and** on `downloadFile`, and **B11 removes neither.** An unreachable declared response is a compatibility surface, not a defect: it costs nothing, it keeps both frozen operations byte-identical, and it is exactly what a direct-to-storage adapter (`B11-D-B004`) would need the moment either operation gains a provider interaction — `downloadFile` in particular becomes provider-dependent the instant `supports_presigned_download()` returns true and the ticket is exchanged for a provider-signed URL. Removing either would have required a controlled amendment against a frozen artifact in exchange for nothing. `B11-AM-002`'s claim that both frozen operations are unchanged therefore holds for their **complete declared response sets**, not merely their success schemas — `FROZEN_RESPONSE_REMOVALS = 0`. Negative control `AT-B11PROV-4`.

The distinction restated, because it is the one an implementer gets wrong: class B may **actively raise** `502` in Phase 1; class A **declares** it for contract compatibility while the current local-only path has no provider interaction that could produce one; class C neither declares nor raises it. "Not reachable today" is never a licence to delete a frozen response.

## 6. What is never returned

Storage credentials; a permanent private storage URL; any provider URL; a bucket, region, or endpoint host; a provider secret; a raw provider error message or status string; a storage key outside a `file.manage` context; the download ticket of any file other than the one requested.
