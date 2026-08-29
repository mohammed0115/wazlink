# B0 Backend Blueprint Traceability

## Purpose

This checklist maps the B0 protocol requirements to the architecture package. It is documentation-only evidence and does not authorize implementation.

| Requirement family | Normative document(s) | Status |
|---|---|---|
| Stack and architecture choice | `B0_BACKEND_BLUEPRINT.md`, `BACKEND_ARCHITECTURE_DECISIONS.md` | Covered |
| Domain ownership | `BACKEND_DOMAIN_OWNERSHIP.md` | Covered |
| Workspace, auth, RBAC, entitlements | `BACKEND_WORKSPACE_AUTH.md`, `BACKEND_AUTHORIZATION_MATRIX.md` | Covered |
| Quotas and usage | `BACKEND_DOMAIN_OWNERSHIP.md`, `BACKEND_DATA_MODEL.md`, `BACKEND_RATE_LIMIT_POLICY.md` | Covered |
| Business, Discovery, deduplication, conversion | `BACKEND_DOMAIN_OWNERSHIP.md`, `BACKEND_STATE_MACHINES.md`, `BACKEND_SEQUENCE_DIAGRAMS.md` | Covered |
| Lead 360 and activity | `BACKEND_DTO_CONTRACTS.md`, `BACKEND_COMMAND_EVENT_CATALOG.md` | Covered |
| Messaging/WhatsApp/Copilot/AI | `BACKEND_INTEGRATION_BOUNDARIES.md`, `BACKEND_DOMAIN_OWNERSHIP.md`, `BACKEND_TEST_STRATEGY.md` | Covered |
| Deals/Pipeline/concurrency | `BACKEND_STATE_MACHINES.md`, `BACKEND_DATA_MODEL.md`, `BACKEND_API_STANDARD.md` | Covered |
| Won versus Revenue | `BACKEND_BILLING_TAX_ARCHITECTURE.md`, `BACKEND_ANALYTICS_SEMANTICS.md`, `BACKEND_COMMAND_EVENT_CATALOG.md` | Explicitly preserved |
| Billing/Tap/Payment/ZATCA | `BACKEND_BILLING_TAX_ARCHITECTURE.md`, `BACKEND_FAILURE_MATRIX.md`, `BACKEND_RECONCILIATION.md` | Covered; official validation flagged |
| Files/storage | `BACKEND_INTEGRATION_BOUNDARIES.md`, `BACKEND_SECURITY_ARCHITECTURE.md` | Covered |
| Webhooks/async/retries/timeouts | `BACKEND_INTEGRATION_BOUNDARIES.md`, `BACKEND_RETRY_POLICY.md`, `BACKEND_TIMEOUT_POLICY.md`, `BACKEND_IDEMPOTENCY_STANDARD.md` | Covered |
| Transactions/events/outbox/inbox | `BACKEND_COMMAND_EVENT_CATALOG.md`, `BACKEND_DATA_GOVERNANCE.md`, `BACKEND_FAILURE_MATRIX.md` | Covered |
| API/versioning/DTO/errors/OpenAPI | `BACKEND_API_STANDARD.md`, `BACKEND_API_CATALOG.md`, `BACKEND_DTO_CONTRACTS.md`, `BACKEND_ERROR_CATALOG.md`, `BACKEND_OPENAPI_V1.yaml` | Machine validated at B0-FIX.6 (current): PyYAML 6.0.3 PASS; openapi-spec-validator 0.9.0 PASS; OpenAPI 3.0.3; 29 paths / 30 operations; 30/30 catalog endpoints; 306/306 local refs, 0 dangling; 30/30 unique operation IDs; 61 schemas; 0 missing endpoints; 0 missing DTO names |
| PostgreSQL/ERD/indexes/JSONB | `BACKEND_DATA_MODEL.md`, `BACKEND_ERD.md`, `BACKEND_DATA_GOVERNANCE.md` | Covered |
| Security/privacy/tenant isolation/secrets | `BACKEND_SECURITY_ARCHITECTURE.md`, `BACKEND_PRIVACY_AND_DATA_HANDLING.md`, `BACKEND_WORKSPACE_AUTH.md` | Covered |
| Observability/health/backups/DR | `BACKEND_OPERATIONS_OBSERVABILITY.md` | Covered; RPO/RTO proposed |
| Analytics formulas and semantics | `BACKEND_ANALYTICS_SEMANTICS.md` | Covered |
| Failure and reconciliation | `BACKEND_FAILURE_MATRIX.md`, `BACKEND_RECONCILIATION.md` | Covered |
| State and sequence diagrams | `BACKEND_STATE_MACHINES.md`, `BACKEND_SEQUENCE_DIAGRAMS.md` | Covered |
| Frontend compatibility | `FRONTEND_BACKEND_CONTRACT_MAP.md`, `BACKEND_ROLLOUT_MIGRATION.md` | Covered |
| Testing and performance targets | `BACKEND_TEST_STRATEGY.md` | Covered |
| Rollout and migration | `BACKEND_ROLLOUT_MIGRATION.md` | Covered |

## B0-FIX.2 evidence-sync and machine-validation evidence

The B0-FIX.1 validator-unavailable statements are historical only. B0-FIX.2 created a disposable isolated environment outside the repository and performed real validation with PyYAML `6.0.3` and `openapi-spec-validator 0.9.0`. **The figures in this paragraph are the historical B0-FIX.2 state and are superseded by the current B0-FIX.6 gate table below.** The FIX.2 machine state was `YAML_PARSE=PASS` and `OPENAPI_VALIDATION=PASS`, over a contract with 29 paths, 30 operations, 218/218 resolved local references at that time, zero dangling references, 30/30 catalog coverage, zero extra endpoints, unique operation IDs, zero missing DTO names, and `DashboardOverview=PASS`.

## Explicit unresolved decisions

The following require written approval or external validation before implementation: official ZATCA legal field mapping and terminology, Tap provider contract/status mapping, Google Places field/cost limits, scraper provider contract and legal policy, AI provider/data retention terms, Saudi data locality, exact CRM import requirement, billing trial semantics, retention durations, and approved RPO/RTO.

## Implementation prohibition

No file in this package is executable backend implementation. Do not create Django apps, models, serializers, views, URLs, migrations, SQL, workers, queues, provider clients, secrets, deployment configuration, or frontend changes under B0.

## B0-FIX.3 CTO-finding repair and regression evidence

B0-FIX.3 repaired the documented contract findings without backend implementation. The repaired package now has an explicit decimal Money pattern, reusable request parameters, canonical public-ID registry and index entry, unique ADR registry (`ADR-001`–`ADR-012`), conditional subscription-trial semantics, and explicit Money currency precedence. Directly affected API, DTO, error, reconciliation, state-machine, frontend-contract-map, index, and architecture-decision documents were synchronized.

| Regression gate | Result |
|---|---|
| PyYAML 6.0.3 parse | PASS |
| openapi-spec-validator 0.9.0 | PASS |
| OpenAPI 3.0.3 | PASS |
| Paths / operations | 29 / 30 |
| Catalog coverage | 30/30; no missing or extra endpoints |
| Local refs | 313/313; dangling refs 0 |
| Unique operation IDs | 30/30 |
| Money parsed pattern | PASS; four-decimal maximum and malformed-value rejection |
| Request parameter registry | PASS; cursor/limit/filters/sort/idempotency/If-Match/id |
| Error coverage | PASS; all operations define 500; targeted 429/402/502 coverage present |
| DashboardOverview | PASS |
| Public-ID registry/index | PASS |
| ADR uniqueness | PASS; 12 identifiers, no duplicates |
| State-machine and reconciliation drift | PASS |
| Currency precedence | PASS |
| Won Deal != Recognized Revenue | PASS |
| Billing != Customer CRM Revenue | PASS |

B0 is **not self-closed**. Independent CTO closure remains required. No commit, push, deploy, B1, backend implementation, frontend modification, dependency/package/lockfile change, migration, provider integration, or secret work was performed in B0-FIX.3.

## B0-FIX.4 final validation evidence

The published B0-FIX.3 candidate was already the local `main` HEAD and `origin/main` at the start of FIX.4 (`8b958412697f595124aaebb4651d4db9f511f51d`), with a clean, non-divergent repository; no fast-forward was required. FIX.4 repaired the second CTO findings without commit, push, deploy, or implementation.

| Gate | Result |
|---|---|
| OpenAPI / YAML | `3.0.3`; PyYAML `6.0.3` PASS; openapi-spec-validator `0.9.0` PASS |
| Operations | 30; catalog coverage 30/30; missing 0; extra 0 |
| Local references | 302 total; 302 resolved; dangling 0 |
| Operation IDs | 30/30 unique; duplicates 0 |
| Pagination | PageInfo response operations all carry cursor/limit; mismatches 0 |
| Filtering/sorting | Only GET `/deals` and GET `/billing/invoices`; mismatches 0 |
| Reusable errors | Unauthorized 28, Forbidden 21, NotFound 11, Conflict 12, ValidationError 14, RateLimited 3, ServiceUnavailable 3 uses |
| Error semantics | 402 only Billing commands; 502 only provider-dependent operations; invoice read has neither |
| ADR registry | Blueprint/architecture IDs 12/12 aligned; heading duplicates 0 |
| Public IDs | Persistent undocumented 0; unclassified frontend prefixes 0; WORK-* explicit; collision policy PASS |
| Contract map | Dangling DTO names 0; nonexistent Core routes 0 |
| Money/currency | Regex, sibling currency mirrors, and authoritative precedence PASS |
| Payment states | cancelled and partially_refunded represented; provider mapping remains unresolved |
| Business invariants | Won Deal != Recognized Revenue; Billing != Customer CRM Revenue; Attribution separation — PASS |
| Architecture regression | NONE |

Current FIX.4 worktree status is intentionally uncommitted and unpushed. B0 self-closure, B1 authorization, and backend implementation authorization remain `NO`.

## B0-FIX.5 surgical closure repair evidence

FIX.5 repaired the three remaining blockers from the Final Independent CTO B0 Closure Audit of `372f0c9b32f0081cf5a531b031e2175e75b47d0b`, without backend implementation and without architecture change. The local checkout was two commits behind the published candidate at start (HEAD `4902944bd1283cce8b1438c2942786091e48ed57`, clean, divergence `0 2`); a single `git pull --ff-only` aligned it, producing `HEAD == origin/main == 372f0c9b32f0081cf5a531b031e2175e75b47d0b` with no merge commit.

Two earlier evidence statements are corrected here rather than edited in place. The FIX.3 claim `429 + Retry-After: 3` was true for FIX.3, where the header was declared inline; FIX.4's move to `$ref: RateLimited` dropped it and the published FIX.4 tree contained none. The FIX.4 claim `unclassified frontend prefixes 0` overstated the FIX.4 state. FIX.5 repairs both conditions.

| Regression gate | Result |
|---|---|
| PyYAML 6.0.3 parse | PASS |
| openapi-spec-validator 0.9.0 | PASS |
| OpenAPI 3.0.3 | PASS |
| Paths / operations | 29 / 30 |
| Catalog coverage | 30/30; missing 0; extra 0 |
| Local refs | 302 total; 302 resolved; dangling 0 |
| Unique operation IDs | 30/30; duplicates 0 |
| Retry-After on 429 | PASS — declared once on `components.responses.RateLimited` as `integer`/`minimum 1`; all 3 `429` responses resolve to it |
| PIPE classification | 1 canonical persistent row; contradictions 0 |
| Frozen frontend prefixes | 47 identifiers inventoried; unclassified 0; multi-classified 0; persistent undocumented 0 |
| Public-ID registry | A 28, B 24, C 3, plus documented non-identifier exclusions; generation rule and collision policy PASS; `WORK-*`, `USR-*`, `SES-*`, `JOB-*` frozen for B1 |
| Pagination / filtering / sorting | mismatches 0 / 0 / 0 |
| Request parameters / error components / error semantics | orphans 0; drift 0; over-application 0 |
| ADR uniqueness | PASS; 12 identifiers aligned across Blueprint and architecture decisions |
| Money / currency | PASS; regex doc drift 0; 5 sibling currency mirrors conforming |
| State machine / DTO naming / contract map | PASS; drift 0 |
| Won Deal != Recognized Revenue | PASS |
| Billing != Customer CRM Revenue | PASS |
| Attribution separation | PASS |
| Architecture regression | NONE |

The FIX.5 worktree is intentionally uncommitted and unpushed, and touches only `BACKEND_OPENAPI_V1.yaml`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `B0_IMPLEMENTATION_REPORT.md`, and `B0_BACKEND_TRACEABILITY.md`. B0 self-closure, B1 authorization, and backend implementation authorization remain `NO`; independent CTO re-verification is still required.

## B0-FIX.6 UpgradeQuote durability and public-ID completeness evidence

FIX.6 repaired the two Major blockers and four Minor findings from the Independent CTO countersign audit of `4131bce7e455a8d76972835409ec04b70d5b9f71`, without backend implementation.

> **Historical section.** The FIX.6 gate table below is the record of what FIX.6 measured at `0e107d5410006e67d97c47d486301113bdc687f0`. Its `Frozen frontend prefixes`, `Public-ID registry`, and `State machine / DTO naming / required-field drift` rows are **superseded by the B0-FIX.7 gate table below**: the prefix inventory is 56 (not 55) with `AID-` classified in section B, the registry is A 28 / B 35 / C 3, and `RevenueEvent`/`AttributionTouchpoint` carried a `source_ref` required-field drift that FIX.6 did not detect. All other FIX.6 rows remain current.

Two further evidence corrections are recorded here rather than edited in place. The FIX.5 claim `47 identifiers inventoried` understated the frozen-frontend inventory: an independent recomputation finds **55** identifier prefixes. The FIX.5 statement that `QRT-` was "promoted from fixture to canonical UpgradeQuote" was factually wrong — `QRT-*` is `quickReplyTemplates` in the frozen tree — and that wording no longer exists as repository truth. FIX.6 also finds that literal-only scanning (used by FIX.5 and by the countersign audit alike) cannot see namespaces produced only at runtime; recovering generator call sites adds `AUTOLOG-` and `AUTONOT-`, which no prior pass reported.

| Regression gate | Result |
|---|---|
| PyYAML 6.0.3 parse | PASS |
| openapi-spec-validator 0.9.0 | PASS |
| OpenAPI 3.0.3 | PASS |
| Paths / operations | 29 / 30 |
| Catalog coverage | 30/30; missing 0; extra 0 |
| Local refs | 306 total; 306 resolved; dangling 0 |
| Unique operation IDs | 30/30; duplicates 0 |
| Retry-After on 429 | PASS — declared once on `components.responses.RateLimited` as `integer`/`minimum 1`; all 4 `429` responses resolve to it |
| Payment-initiation rate limit | PASS — `POST /billing/payments` now declares `429` via the reusable component, matching `BACKEND_RATE_LIMIT_POLICY.md` |
| UpgradeQuote durability | PASS — `upgrade_quotes` table, Billing ownership, ERD entity, `active/expired/consumed/cancelled` lifecycle, server-authoritative plan/amount/currency, expiry, single-lineage consumption, transactional concurrency protection, retry safety, cross-workspace protection, frozen error contract |
| Public-ID prefixes | `UPQ-` canonical persistent (A); `QRT-` Quick Reply Template fixture (B); namespace collision 0 |
| Frozen frontend prefixes | 55 identifiers inventoried; unclassified 0; multi-classified 0; persistent undocumented 0 |
| Public-ID registry | A 28, B 34, C 3, plus a documented non-identifier exclusion table; generation rule and collision policy PASS; `WORK-*`, `USR-*`, `SES-*`, `JOB-*` frozen for B1 |
| PIPE classification | 1 canonical persistent row; contradictions 0 |
| Pagination / filtering / sorting | mismatches 0 / 0 / 0 |
| Request parameters / error components / error semantics | orphans 0; drift 0; over-application 0 |
| ADR uniqueness | PASS; 12 identifiers aligned across Blueprint and architecture decisions |
| Money / currency | PASS; regex doc drift 0; currency fields without ISO-4217 pattern 0 |
| State machine / DTO naming / required-field drift | PASS; drift 0 / 0 / 0 |
| Won Deal != Recognized Revenue | PASS |
| Billing != Customer CRM Revenue | PASS — UpgradeQuote is platform commercial authorization and never recognizes revenue |
| Attribution separation | PASS |
| Architecture regression | NONE |

The FIX.6 worktree is intentionally uncommitted and unpushed. B0 self-closure, B1 authorization, and backend implementation authorization remain `NO`; independent CTO countersign is still required.

## B0-FIX.7 registry completeness and contract cleanup evidence

FIX.7 repaired the one Major and two Minor findings from the final Independent CTO countersign of `0e107d5410006e67d97c47d486301113bdc687f0`, without backend implementation. It changed five documentation/contract files and no others.

The Major finding was that the frozen-frontend prefix inventory was incomplete: `AID-` — generated only at runtime by `nextId("AID", mockModel.aiDecisionRecords)` at `client/src/domain/sales-ai.js:71` — was classified nowhere. The root cause was methodological, not clerical: FIX.6's stated recovery rule enumerated a **hardcoded** generator-name list (`nextNumericId`/`s11Id`/`s11Audit`) and therefore could not see `nextId` (`client/src/domain/sales-ai.js:23`). FIX.7 replaces that list with a five-pass normative discovery procedure whose first pass finds prefix generators **by shape** — any helper interpolating or concatenating its own parameter immediately followed by `-` — so a future frontend helper cannot silently introduce an unclassified namespace. Re-running the procedure discovers exactly three generator definitions plus one prefix-forwarding wrapper, and yields 56 identifier prefixes.

Evidence establishes `AID-` as section B: `mockModel.aiDecisionRecords` is initialised empty (`client/src/domain/data.js:269`), no `AID-` literal exists in the frozen tree, the namespace never crosses `client/src/services/`, its suffix is a session-local display counter rather than an opaque server token, and its only inbound references (`recommendationId`, `suggestionId`) are in-memory frontend correlation. No persistence, table, aggregate, or public-ID reservation is created.

**Superseded figures.** The FIX.6 rows `Frozen frontend prefixes = 55`, `Public-ID registry A 28, B 34, C 3`, and `required-field drift 0` are superseded by this table. The FIX.2, FIX.3, and FIX.5 sections remain historically accurate records of what those passes measured.

| Regression gate | Result |
|---|---|
| PyYAML parse | PASS |
| OpenAPI 3.0.3 | PASS |
| Paths / operations | 29 / 30 |
| Catalog coverage | 30/30; missing 0; extra 0 |
| Local refs | 306 total; 306 resolved; dangling 0; external 0 |
| Unique operation IDs | 30/30; duplicates 0 |
| Prefix recovery rule | PASS — shape-based five-pass procedure replaces the hardcoded generator list; 3 generator definitions + 1 wrapper discovered structurally |
| Frozen frontend prefixes | **56** identifiers inventoried; unclassified **0**; multi-classified 0; persistent undocumented 0 |
| Public-ID registry | **A 28, B 35, C 3** (66 rows), plus a documented non-identifier exclusion table; 66 rows − 10 backend-only section-A prefixes = 56, reconciling exactly with the recomputed frontend inventory |
| `AID-` classification | PASS — section B, runtime Copilot decision record; non-persistent; no collision with `AGA-`/`RUN-` |
| Required-field drift | **0** — `source_ref` added to `required[]` for `RevenueEvent` and `AttributionTouchpoint`, matching `BACKEND_DTO_CONTRACTS.md`, `RevenueEventCreate`, and ADR-007 |
| DTO naming drift | 0 |
| Public-endpoint security | PASS — `security: []` on exactly 3 operations (`login`, `getLiveness`, `getReadiness`); 27 operations remain `sessionAuth`; global requirement retained |
| Retry-After on 429 | PASS — all 4 `429` responses resolve to `components.responses.RateLimited` (`integer`/`minimum 1`) |
| Payment-initiation rate limit | PASS — `POST /billing/payments` retains `429` |
| Pagination / filtering / sorting | mismatches 0 / 0 / 0; `filters`/`sort` confined to `GET /deals` and `GET /billing/invoices` |
| Idempotency-Key / If-Match | PASS — 13 idempotent mutation operations; `If-Match` on `PATCH /leads/{id}`; stale-write doctrine remains `409` |
| Money / currency | PASS — `^-?\d+(\.\d{1,4})?$`; 9/9 currency fields `^[A-Z]{3}$` |
| UpgradeQuote durability | PASS — unchanged by FIX.7 |
| QRT / UPQ | PASS — `QRT-` section B, `UPQ-` section A, namespace collision 0 |
| Payment authority | PASS — quote-derived, server-authoritative; mirrors non-authoritative |
| Won Deal != Recognized Revenue | PASS |
| Billing != Customer CRM Revenue | PASS |
| Attribution separation | PASS |
| Tenancy / RBAC / IDOR | PASS — unchanged; public-endpoint overrides expose no tenant data |
| ADR uniqueness | PASS; 12 identifiers |
| Architecture regression | NONE |

The FIX.7 worktree is intentionally uncommitted and unpushed. B0 self-closure, B1 authorization, and backend implementation authorization remain `NO`; independent CTO countersign is still required.
