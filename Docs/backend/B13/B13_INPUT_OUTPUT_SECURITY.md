# B13 — Input / Output Security

> Design only. Extends `FI-B0-02` (allow-listed serializers, ORM parameterization, output escaping) and Doctrine R-4 (`FI-B1-07`) into a field-class-by-field-class production contract.

## 1. Serializer allow-lists

Every request DTO is an explicit allow-list; `additionalProperties: false` rejects unknown fields with `400 VALIDATION_ERROR`, never silent drop (Doctrine R-4). This is the single mechanism behind every row in §2.

## 2. Server-owned fields — never client-writable, by class

| Field class | Examples | Domain |
|---|---|---|
| Identity/tenancy | `workspace_id`, `id`, `public_id` | every domain |
| Lifecycle/status | `status`, `lifecycle_state`, `zatca_status` | every domain |
| Concurrency | `version` | Lead, Deal, Task, AutomationRule, Subscription (`FI-B0-24` ADR-010) |
| Ownership/actor | `owner_membership_id` (settable only through `AssignLeadOwner`/`deal.assign`, never a plain field edit), `role` on self | CRM, Pipeline, Identity |
| Entitlement | `entitlement_overrides.status`, `.value` (writable only through `GrantEntitlementOverride`) | Billing |
| Financial | `RevenueEvent.gross`/`.net`, `Payment.amount` (server-derived from the stored `UpgradeQuote`, never a client mirror it disagrees with — `FI-B0-19`) | Finance, Billing |
| Provider identifiers | `provider_message_id`, `provider_payment_ref`, `provider_request_reference` | Messaging, Billing, B12 |
| File integrity | `checksum`, `detected_content_type`, `storage_key` | Files (`FI-B11-03`, `FI-B11-04`) |
| Timestamps | every `created_at`/`updated_at`/`archived_at`/`occurred_at` | every domain |

A client-supplied value in any of these positions is rejected at the serializer boundary, never coerced or ignored silently.

## 3. Injection prevention

| Vector | Control |
|---|---|
| SQL injection | ORM parameterization exclusively; no raw SQL string interpolation in application code (`FI-B0-02`) |
| Stored/reflected XSS | Output escaping at the API boundary is not the primary control (WazLink returns JSON, not HTML) — the primary control is **never returning unsanitized user content as `Content-Type: text/html`**, and file downloads carrying `Content-Disposition: attachment` (`FI-B11-01` §6) rather than rendering inline |
| Path traversal | Structurally impossible for file storage keys — no client string ever reaches a key (`FI-B11-04`); filename display values are separately normalized (NFC, control-char/bidi stripped, `FI-B11-03` §3.3) but never used as a path component |
| Unsafe redirects | No API operation returns a client-controlled redirect target; provider callbacks never trusted as identity (`FI-B12-02` rule 2) |
| Header injection | Filenames and free-text fields are stripped of control characters before appearing in any header (`Content-Disposition`, `FI-B11-03`) |
| Formula injection (CSV/exports) | Values beginning with `=`, `+`, `-`, `@`, TAB, or CR are neutralized with a leading safeguard before any export column (`FI-B3-02`, established for Discovery/CRM exports and applied uniformly to every future export surface) |
| SSRF | No B13-governed feature accepts a client-supplied URL for server-side fetching. The one exception, B11's `ImportFileFromUrl`, is system-actor-only, host-allow-listed, denies private/loopback/link-local/cloud-metadata ranges post-DNS-resolution and per redirect hop, bounds redirects, and has no `/api/v1/` surface (`FI-B11-01` §"SSRF") |

## 4. Free text and rich text

CRM free text (note body, task/appointment title and description) never leaves its own column — no event payload, outbox row, Celery argument, log line, audit `details`, or timeline summary carries the value; events carry `changed_field_names[]`, never values (`FI-B2-01` Rules CP-1/CP-2). WazLink has no rich-text/HTML-authoring surface in Phase 1 — every free-text field is plain text, which removes an entire class of stored-XSS risk by construction rather than by a sanitizer that could be bypassed.

## 5. Provider payloads

Every inbound provider payload (webhook body, Places response, scraper result, AI completion) is treated as untrusted input: validated against a closed schema before touching domain truth (AI, `FI-B4-02`: no free-form provider output ever mutates a `Signal`/`Score`/`Recommendation` without passing a strict JSON-schema validation), size-capped, and never trusted for identity (`FI-B12-02` rule 2). Hostile content from a scraped/discovered business (control characters, lone surrogates, invalid UTF-8) is stripped or rejected at the field level — never coerced silently (`FI-B3-02`).

## 6. CSV/import boundaries

No import surface exists in Phase 1 (`B2-D-C017`, `FI-B2-01` Rule CP-4: no CRM export exists either). If introduced later, it inherits this document's formula-injection neutralization and Doctrine R-4's allow-list discipline unchanged — recorded as a forward requirement, not designed here (`B13-D-C004`, Class C).

## 7. Accidental secret echo

No serializer ever includes a field from `B13_SECRETS_MANAGEMENT.md` §1's secret classes in a response, by construction: a configuration DTO's schema has no value/mask/prefix field at all (`FI-B12-04`, `B12-D-A042`) — this is a schema-shape guarantee, not a redaction step that could be forgotten on one endpoint.

## 8. Request validation — the general control

Distinct from mass-assignment (§2, which governs *which* fields may be set) and from tenancy (which governs *whose* row is affected), request validation governs *whether a syntactically-addressed request is well-formed at all*: size ceilings, type/shape conformance, and closed-enum membership on every field, checked before any business logic runs. This is `B13_SECURITY_PRINCIPLES.md` control #11.

| ID | Type | Assertion |
|---|---|---|
| `AT-B13VAL-1` | N | A request body exceeding the configured size ceiling is rejected before deserialization completes |
| `AT-B13VAL-2` | N | A field submitted with the wrong JSON type (e.g., a string where an integer is required) is rejected with `400`/`422 VALIDATION_ERROR`, never coerced |
| `AT-B13VAL-3` | N | A value outside a closed enum (e.g., an invalid `lifecycle_state`, an unrecognized `mismatch_class`) is rejected, never silently mapped to a default |
| `AT-B13VAL-4` | N | A malformed provider payload (webhook or AI completion) failing closed-schema validation never reaches domain-mutating code |

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13IO-1` | Submitting any server-owned field from §2's table returns `400 VALIDATION_ERROR` naming the field, with zero mutation |
| `AT-B13IO-2` | An unknown field on any request DTO is rejected, never silently dropped |
| `AT-B13IO-3` | A CSV/export value beginning with `=`/`+`/`-`/`@` is neutralized in the output |
| `AT-B13IO-4` | A note/task/appointment free-text field never appears in an event payload, outbox row, or audit `details` |
| `AT-B13IO-5` | `ImportFileFromUrl` rejects a URL resolving to a private, loopback, link-local, or cloud-metadata address, including via redirect |
| `AT-B13IO-6` | No API response schema contains a field capable of carrying a secret value, verified by schema inspection rather than runtime probing alone |
