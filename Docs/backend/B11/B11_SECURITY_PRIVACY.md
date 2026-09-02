# B11 — Security & Privacy

> Design only. Extends the frozen `BACKEND_SECURITY_ARCHITECTURE.md` upload paragraph without weakening any clause of it.

## 1. Threat model

Fifteen threats, each with its control and the acceptance test that proves it.

| # | Threat | Control | Test |
|---:|---|---|---|
| 1 | **Path traversal** via filename or a client-supplied path | Structurally impossible: no client string reaches a storage key in any position or encoding; keys are built from two server UUIDs and a date (`B11_STORAGE_KEY_MODEL.md` §2). Path separators and `.`/`..` in a filename are rejected outright, not sanitized | `AT-B11SEC-1` |
| 2 | **Cross-tenant access** (IDOR on `FILE-*`) | Doctrine R-1 on every operation; `404` never distinguishable from a miss; the ticket is workspace-bound; the key prefix is containment only, never the control | `AT-B11TEN-1`…`6` |
| 3 | **Malicious filenames** — control characters, bidi overrides, overlong names | NFC normalization, control-character and bidi-override stripping, 255-byte cap, path-separator rejection (`B11_FILE_VALIDATION.md` §5) | `AT-B11SEC-2` |
| 4 | **MIME spoofing** — a `.pdf` that is really HTML | Server-side content detection is canonical; a declared-vs-detected group mismatch is a rejection, not a silent correction (`B11_FILE_VALIDATION.md` §4) | `AT-B11VAL-4` |
| 5 | **Oversized uploads** | Mid-stream byte counting aborts the provider write the instant `MAX_FILE_BYTES` is exceeded; the declared size is never trusted | `AT-B11VAL-2` |
| 6 | **Storage exhaustion** | Per-workspace safety ceiling enforced under a row lock, including in-flight reservations so parallel intents cannot bypass it (`B11_STORAGE_USAGE_MODEL.md` §4); plus upload rate limits (`B11-AM-006`) | `AT-B11QUO-1`…`6` |
| 7 | **Public URL leakage** | No public URL exists. Every object is private; no bucket, path, or provider host appears in any response, event, or log (§4) | `AT-B11SEC-3` |
| 8 | **Signed URL leakage** | The only URL emitted is an application URL with a single-use, 5-minute, workspace- and actor-bound ticket that is **not** a bearer credential — the session is re-authenticated and re-authorized independently (`B11_RBAC_TENANCY.md` §5) | `AT-B11DL-2`…`5` |
| 9 | **Credential leakage** | Storage credentials live only in the frozen secret-management layer, are held only by the adapter, and never appear in a DTO, event, log, metric, error message, or client bundle (§4) | `AT-B11SEC-4` |
| 10 | **Provider error leakage** | The adapter collapses every provider error into four domain classes before the boundary; no provider status string, message, or host reaches a client (`B11_STORAGE_PROVIDER_BOUNDARY.md` §3) | `AT-B11SEC-5` |
| 11 | **Metadata injection** — filename or content type used to inject into a header, log, or downstream parser | Control characters stripped before storage; `Content-Disposition` uses an ASCII-safe `filename` plus RFC 5987 `filename*`; the canonical content type comes from a closed allow-list, so an arbitrary string can never reach a `Content-Type` header | `AT-B11SEC-6` |
| 12 | **HTML/SVG active content** | `text/html`, `application/xhtml+xml`, `image/svg+xml`, and XML types are excluded from the allow-list as a class; every byte response carries `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` (§6) | `AT-B11SEC-7` |
| 13 | **Attachment authorization bypass** | `AttachFile` composes `file.upload` with the subject domain's own write permission and re-asserts three-way workspace equality (`B11_RBAC_TENANCY.md` §4) | `AT-B11ATT-3`…`5` |
| 14 | **Deleted-file access** | `archived` is terminal with no exit transition; the byte endpoint re-checks state per request; tickets are invalidated on delete; a purge failure changes nothing about access | `AT-B11DEL-4`, `AT-B11DEL-6` |
| 15 | **Orphan exposure** — a leaked provider object outliving its row | The sweeper reports `O-6`/`R-5` and never deletes; every object is private with no anonymous read path, so an orphaned object is unreachable without provider credentials | `AT-B11ORP-5` |

## 2. SSRF

`ImportFileFromUrl` is the only operation in B11 that fetches a URL. Its five constraints (`B11_UPLOAD_MODEL.md` §6) — system-actor-only, host allow-list, no off-allow-list redirect following, post-DNS private/loopback/link-local address rejection, and hard time and size bounds — realize the frozen rule "Provider URL fetches use strict allowlists and SSRF defenses." It has **no `/api/v1/` surface**, so no client can reach it at all.

## 3. Encryption

Transport to and from the provider is TLS. Encryption at rest is whatever the provider offers by default; B11 adds no application-layer envelope encryption in Phase 1 and **does not claim any at-rest guarantee** it has not verified — the deployed target's at-rest behavior is part of the unresolved provider-capability item `B11-X-007`. Backups inherit the frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` requirement that "PostgreSQL backups must be encrypted"; blob-store backup policy is an operations decision B11 does not make. Application-layer encryption is `B11-D-B010`, deferred.

## 4. Logging and redaction

| Never logged | Why |
|---|---|
| file **contents**, in any form, at any level, including truncated | it is customer data |
| the **checksum** at INFO or below | for small or well-known files a hash is an oracle for content |
| **signed URLs or tickets**, complete or truncated | a truncated capability is still a partial secret and a full one in a proxy log is an access grant |
| **storage credentials**, keys, tokens | frozen requirement |
| the **storage key**, outside operator-authenticated views | frozen "Hostinger paths are never exposed directly" |
| **provider host, bucket, endpoint** | same |
| the raw **`original_filename`** at INFO or below | filenames routinely contain customer names, deal names, and phone numbers, and are therefore Contact PII |

| Always logged | Shape |
|---|---|
| `FILE-*` public ID | opaque, non-enumerable, already the API-visible identity |
| `workspace_id`, actor membership, `request_id`/`correlation_id` | the frozen structured-log field set |
| lifecycle transition, from → to, reason code | a closed enum, never free text |
| size class (bucketed), content-type family | bounded cardinality (§`B11_OBSERVABILITY.md` §3) |
| provider error class (one of four) and provider request ID | the frozen adapter contract's own fields |

Sentry and OpenTelemetry inherit the frozen scrubbing rules; a `FileAsset` exception context carries the public ID and nothing else from this list's first column.

## 5. Private by default

> **`B11-D-A022` (classification half).** `file_assets.access_class` exists with exactly one Phase-1 value: `private`. There is no `public` value, no anonymous read path, no unauthenticated endpoint, and no way for a workspace to make a file world-readable.

The column exists rather than being omitted so that a future public-asset class is an additive enum value rather than a schema change and an access-control rewrite — but Phase 1 ships one value, so `PUBLIC_PRIVATE_ACCESS_AMBIGUITIES = 0` is a statement about a design with no ambiguous case to resolve, not a claim that a public path was carefully secured.

Provider-signed download URLs are **not issued in Phase 1** (`supports_presigned_download()` returns false, `B11_STORAGE_PROVIDER_BOUNDARY.md` §2). When a verified adapter later reports true, three constraints bind and are stated now: short TTL (≤ the ticket TTL), minted only *after* full application authorization has already passed, and never persisted in any durable column, event payload, or log line. A signed URL is never durable identity and never a business record. `PERMANENT_SIGNED_URL_LEAKS = 0`.

## 6. Download response headers

Every byte response from `GET /files/{id}/content` carries:

| Header | Value | Source |
|---|---|---|
| `Content-Disposition` | `attachment; filename="<safe_display_filename>"; filename*=UTF-8''<pct-encoded original>` | OWASP: *"Use `Content-Disposition: attachment` to force download instead of inline rendering"* (`B11-X-006`) |
| `X-Content-Type-Options` | `nosniff` | MDN: it makes the browser "use the supplied `Content-Type` as-is instead of examining the content to infer the type," and "prevents XSS-attacks where user-uploaded content is executed as an HTML document" (`B11-X-003`) |
| `Content-Type` | the canonical `content_type` — always the **verified detected** value, because only an `available` file is servable and finalize is what makes it one; always from the closed allow-list | `B11_FILE_VALIDATION.md` §3.1 |
| `Cache-Control` | `private, no-store` | a private byte stream must not enter a shared cache |
| `Content-Length` | the verified `size_bytes` | |

**`Content-Disposition: attachment` is the primary control and `nosniff` is the secondary one**, in that order. `nosniff` alone would not stop an `image/svg+xml` response from executing script when navigated to directly, because that *is* its declared type — which is why SVG is excluded from the allow-list at ingest rather than relied upon to be safe at egress (`B11-X-004`, and `B11_FILE_VALIDATION.md` §6). Serving user content from a separate origin is a recognized further hardening and is recorded as deferred (`B11-D-B003`), not claimed.

## 7. Required security tests

Frozen `BACKEND_TEST_STRATEGY.md` already mandates "IDOR, cross-workspace reads/writes, privilege escalation, mass assignment, quota bypass, SQL injection, SSRF, **upload policy**, webhook signature/replay, and idempotency conflict." B11 adds no new test *category*; `B11_ACCEPTANCE_TESTS.md` supplies the file-specific instances of the categories that document already requires.
