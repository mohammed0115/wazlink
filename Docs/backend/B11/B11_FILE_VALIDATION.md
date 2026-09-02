# B11 — File Validation

> Design only. Realizes the frozen requirement (`BACKEND_SECURITY_ARCHITECTURE.md`): *"Uploads require MIME sniffing, extension allowlists, size limits, checksum, malware scanning where available, quarantine status, and signed/proxied access."* Every clause of that sentence is answered below, including the last two words of "where available."

## 1. What is never trusted

| Client-supplied | Trust level | What it is used for |
|---|---|---|
| `filename` (frozen `UploadRequest` field) | **untrusted** | display only, after normalization (§5); never a storage key, never a content-type source, never an access decision |
| `content_type` (frozen `UploadRequest` field) | **untrusted** | stored as `declared_content_type`; used only to *fail fast* before bytes are transferred, and to detect a declared-vs-detected mismatch |
| file extension | **untrusted** | a cross-check against the detected type (§4); never authoritative on its own |
| declared size | **untrusted** | a provisional quota hint only (`B11_STORAGE_USAGE_MODEL.md` §4); the authoritative size is measured |
| any client-supplied checksum | **untrusted** | compared against the server-computed value; a mismatch is a rejection, never an override (`B11_CHECKSUM_INTEGRITY.md` §4) |

## 2. Validation gates, in order

| Gate | When | Failure |
|---|---|---|
| G1 — filename present, ≤ 255 UTF-8 bytes after normalization, non-empty after trimming | `CreateUpload` | `422 VALIDATION_ERROR` |
| G2 — `declared_content_type` parses as a media type and is on the allow-list | `CreateUpload` | `422 FILE_TYPE_NOT_ALLOWED` (frozen code, reused) |
| G3 — declared size, when supplied, ≤ `MAX_FILE_BYTES` | `CreateUpload` | `422 FILE_TOO_LARGE` |
| G4 — provisional quota headroom | `CreateUpload` | `403 QUOTA_EXHAUSTED` (frozen code, reused) |
| G5 — actual streamed bytes ≤ `MAX_FILE_BYTES`, enforced **mid-stream**, aborting the provider write | `UploadFileContent` | `422 FILE_TOO_LARGE` |
| G6 — actual bytes > 0 | `FinalizeUpload` | `422 VALIDATION_ERROR` · empty file |
| G7 — `detected_content_type` (from content, §3) is on the allow-list | `FinalizeUpload` | `422 FILE_TYPE_NOT_ALLOWED`, `lifecycle → failed` |
| G8 — detected type is compatible with declared type (§4) | `FinalizeUpload` | `422 FILE_TYPE_NOT_ALLOWED` · `mime_mismatch`, `lifecycle → failed` |
| G9 — server-computed SHA-256 matches any client-supplied claim; `stat_object` size matches the streamed count | `FinalizeUpload` | `422 FILE_INTEGRITY_MISMATCH`, `lifecycle → failed` |
| G10 — authoritative quota reservation under a row lock | `FinalizeUpload` | `403 QUOTA_EXHAUSTED`, `lifecycle → failed` |

G1–G4 exist to reject cheaply before bandwidth is spent. **None of them is a security control** — every security-relevant decision is G5–G10, all of which run against measured reality. An attacker who lies at G1–G4 gains nothing but a later rejection.

## 3. Three content-type fields, not one

> **`B11-D-A010`.** `file_assets` carries three distinct columns and never collapses them:
>
> | Column | Source | Authority | Written |
> |---|---|---|---|
> | `declared_content_type` | the client's `UploadRequest.content_type`, verbatim | **none** — retained as evidence of what was claimed | at `CreateUpload`, immutable |
> | `detected_content_type` | server-side content inspection of the received bytes | **the finding** | at `FinalizeUpload`, write-once; null before it |
> | `content_type` | the **canonical presentation value**, derived per §4 | what every DTO, download response, and downstream domain sees | **two-phase, never null** (below) |

### 3.1 The two phases of `content_type`

Frozen `BACKEND_OPENAPI_V1.yaml` makes `FileAsset.content_type` a **required, non-nullable string** on every `FileAsset` response — including the `201` from `createFileUpload`, which is emitted while the row is still `pending` and no bytes have arrived. There is therefore no instant at which a `FileAsset` may exist without a `content_type`. The column resolves this without weakening the trust model, because "validated" and "trusted" are different things:

| Phase | `content_type` holds | Provenance | What it is allowed to decide |
|---|---|---|---|
| `pending` (from insert) | the **validated provisional type** | the declared value **after gate G2 admitted it** against the closed Phase-1 allow-list (§6) | nothing. It is a *presentation placeholder* that has passed a closed-set membership test. No storage key, no access decision, no download header, and no downstream domain fact derives from it, because nothing in this state is downloadable or attachable (`B11-D-A008`) |
| `available` / `quarantined` (from finalize) | the **verified canonical type** | `detected_content_type`, accepted by gates G7–G8 (§4) | everything — the `Content-Type` header, the DTO, B5's `MessageMedia.mime_type` |

> **The raw client string is never promoted.** What is stored at insert is not `UploadRequest.content_type` as received; it is the allow-list member that value *matched*. A declared type that fails G2 produces `422 FILE_TYPE_NOT_ALLOWED` and **no row at all**, so an unvalidated string can never reach the column. `content_type` at `pending` is therefore drawn from a closed server-controlled vocabulary of at most seven values (§6), not from client input — which is precisely why it is safe to expose while remaining worthless as evidence.

The overwrite at finalize is unconditional and atomic: it happens in the same transaction as the lifecycle transition, whether or not the detected type equals the provisional one. A file that never reaches finalize never has its provisional value confirmed, and never becomes servable. `MIME_TRUST_GAPS = 0` is unaffected: no code path in this pack derives a content type from a client claim or an extension **for any decision**, and the only value that ever reaches a `Content-Type` header or a downstream domain is the detected one.

`declared_content_type` and `detected_content_type` remain internal and are exposed only on the operator surface (`B11_RBAC_TENANCY.md` §2), because showing an ordinary user "you said X, we found Y" leaks detection behavior to an attacker for no user benefit. Exposing the canonical `content_type` — which frozen B0 requires — leaks nothing, because at `pending` it tells the caller only what the caller itself just sent, and after finalize it is the server's own finding.

## 4. Reconciling declared against detected

This is the **finalize-time** resolution — the second phase of §3.1. "Canonical `content_type`" below means the value written over the provisional one, and it is written only on the accepting rows: a rejected file transitions to `failed`, is never servable, and its `content_type` column keeps the provisional value it was inserted with, which no longer decides anything because a `failed` file is neither downloadable nor attachable.

| Case | Canonical `content_type` | Outcome |
|---|---|---|
| Detected == declared | detected | accept |
| Detected differs, but both are in the same **equivalence group** (e.g. `text/csv` ↔ `text/plain`, `application/x-zip-compressed` ↔ `application/zip`) | **detected** | accept; record the substitution |
| Detected differs and is itself on the allow-list, but is a different group | **detected** | **reject** (G8). A `.pdf` that is really a `.html` is the classic stored-XSS vector; silently accepting the detected type would store active content the uploader disguised |
| Detected is not on the allow-list | detected | reject (G7) |
| Detection is inconclusive | `application/octet-stream` | reject (G7) — an unidentifiable binary is not something WazLink stores on a provider's say-so, matching B5's own posture that unrecognized inbound media is admitted as `content_type=unsupported` with **no fetch attempted** (`B5_INBOUND_PIPELINE.md` §5) |

**Extension is a third, weaker cross-check**, never a gate on its own (`B11-X-005`): if the filename's extension maps to a type outside the detected type's equivalence group, the file is still accepted but the mismatch is recorded and counted (`B11_OBSERVABILITY.md` §2). Blocking on extension alone is the "blacklisting extensions is inherently flawed" trap; ignoring it entirely discards a cheap signal.

`MIME_TRUST_GAPS = 0` rests on this section and on §3.1: no code path anywhere in this pack derives a **decision** — an access grant, a storage key, a `Content-Type` header, a downstream domain fact — from a client claim or from an extension. The provisional value a `pending` row carries is a closed-allow-list member used for presentation only, and it governs nothing while the file is unusable.

## 5. Filenames (`B11-D-A011`)

| Rule | Detail |
|---|---|
| **Unicode normalization** | NFC. Two filenames that differ only by normalization form are the same string; not normalizing lets one visually shadow another in a list. |
| **Control characters** | `U+0000`–`U+001F`, `U+007F`, and Unicode line/paragraph separators are stripped. A newline in a filename is a log-injection and header-injection primitive. |
| **Bidirectional overrides** | `U+202A`–`U+202E`, `U+2066`–`U+2069` are stripped. WazLink's UI is Arabic-first and RTL throughout, so bidi control characters are both plausible in legitimate input and the exact mechanism of the `report.<RLO>gpj.exe` display attack — stripping them, rather than banning RTL text, is what keeps genuine Arabic filenames working. |
| **Path separators** | `/`, `\`, and the segments `.` and `..` are rejected outright, not stripped. A filename containing a path separator is a request that has no legitimate reading. |
| **Length** | ≤ 255 UTF-8 **bytes** (not code points) after normalization, matching the practical filesystem ceiling every export destination shares. |
| **Emptiness** | a filename that is empty after normalization and trimming is rejected. There is no server-generated fallback name — silently inventing one hides a broken client. |
| **`original_filename`** | the normalized result, stored verbatim, shown to users, and **never used for anything else**. |
| **`safe_display_filename`** | an ASCII-transliterated, extension-corrected derivative used only in a `Content-Disposition` header. The header additionally carries RFC 5987 `filename*` with the UTF-8 original, so Arabic filenames survive the round trip while a non-conforming client still gets something safe. |

## 6. Content types allowed in Phase 1

The allow-list is **configuration seeded from evidence, not architecture.** The frozen frontend's only file evidence is `image/png` and `application/pdf` (`FB-B11-003`); B5's frozen `content_type` enum has four families — `image`, `document`, `audio`, `video` (`B5_MESSAGE_CONTENT_MODEL.md` §1). The seed is therefore deliberately narrow and per-family:

| Family | Seeded types | Notes |
|---|---|---|
| `image` | `image/png`, `image/jpeg`, `image/webp` | **`image/svg+xml` is excluded.** SVG is an XML document that can carry `<script>`; served same-origin it is a stored-XSS primitive (`B11-X-004`). Excluding it is cheaper and more certain than sanitizing it |
| `document` | `application/pdf` | |
| `audio` | `audio/ogg`, `audio/mpeg` | present because B5's enum has the family; no frontend evidence exists for it |
| `video` | `video/mp4` | same |

Never allowed, at any tier: `text/html`, `application/xhtml+xml`, `image/svg+xml`, `text/xml`, `application/xml`, and every executable/script type. These are excluded as a class, not enumerated as a blocklist — the allow-list is closed, so an unlisted type is denied by default with no maintenance burden (`B11-X-005`).

**The exact provider-side limits WhatsApp itself imposes on media type and size remain unresolved under B5's own register (`B5-X-009`) and are not re-litigated here.** B11 enforces WazLink's limits; if Meta's are narrower, the send fails at B5's provider call, which `B5-DF-016` already covers.

## 7. Size ceilings

| Constant | Proposed Phase-1 value | Status |
|---|---:|---|
| `MAX_FILE_BYTES` | 25 MiB | **PRODUCT DECISION REQUIRED / calibration.** Chosen as a defensible starting point, not derived: the true floor is whatever WhatsApp accepts, which is `B5-X-009`-unresolved, so this value is deliberately configuration |
| `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` | 5 GiB | **PRODUCT DECISION REQUIRED.** A platform abuse ceiling, not a plan entitlement (`B11_BILLING_QUOTA_BOUNDARY.md` §3) |

Both are read from deployment configuration at request time. Neither is a plan attribute, neither varies by workspace, and neither is exposed as an entitlement decision — that distinction is what keeps `QUOTA_AUTHORITY_LEAKS = 0`.

An oversize upload is `422 FILE_TOO_LARGE`, matching the frozen status choice for its sibling `FILE_TYPE_NOT_ALLOWED` and staying inside `BACKEND_API_STANDARD.md`'s closed HTTP-status doctrine, which lists no `413`. A `413` produced by the web server or WSGI layer before the request reaches the application is an infrastructure response below this contract, not an alternative API semantic; the application-level answer is always `422`.

## 8. Malware scanning — deferred, and honestly

> **`B11-D-A024`. Phase 1 performs no malware or antivirus scanning.** This pack does not claim otherwise anywhere.

This is contract-compliant, not a gap papered over: frozen `BACKEND_SECURITY_ARCHITECTURE.md` says "malware scanning **where available**," and no scanning capability exists in the target deployment. B5's frozen handoff (`B5_MEDIA_B11_HANDOFF.md` §4) states that B5 "inherits B11's" content-safety policy — which remains true, and is why `B11-AM-007` registers a compatible clarification of exactly what that inherited policy is today, rather than letting B5's sentence be read as a promise B11 never made.

**Compensating Phase-1 controls**, each independently verifiable:

1. A closed content-type allow-list with active-content types (HTML/XHTML/XML/SVG) excluded as a class (§6).
2. Server-side content detection with a declared-vs-detected mismatch rejection (§4) — the disguised-file vector.
3. Downloads are never rendered in a browsing context: `Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff` on every byte response (`B11_SECURITY_PRIVACY.md` §6), the pairing OWASP names for untrusted files.
4. Bytes are never executed, expanded, parsed, transcoded, thumbnailed, or previewed server-side. B11 hashes and stores; it does not interpret.
5. Every download is re-authorized against the current session and workspace, so a malicious file's blast radius is bounded to actors already inside the workspace that uploaded it.
6. The `quarantine` state exists **and has a working Phase-1 producer** — an operator hold via `QuarantineFile`, reachable the moment a file is reported — so the containment mechanism is exercised rather than dormant.

**Future integration point.** A scanner is introduced as a `FinalizeUpload` step that returns `clean` / `infected` / `inconclusive`, mapping to `available` / `quarantined` / `quarantined`. Nothing else changes: the state exists, the transition `pending → quarantined` is already legal (`B11_FILE_LIFECYCLE.md` §2), the operator release path already exists, and no DTO, event, or table changes. This is `B11-D-B002`.
