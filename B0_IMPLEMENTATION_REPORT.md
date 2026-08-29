# B0-FIX.2 EVIDENCE SYNC — IMPLEMENTATION REPORT

## Scope and status

Historical scope note: B0-FIX.1 repaired the documentation and API-contract layer only. Later B0-FIX.3 was committed and pushed as the published candidate; the current B0-FIX.4 step is a separate uncommitted documentation repair. No Django code, models, migrations, PostgreSQL schema, Redis/Celery implementation, provider integration, secrets, frontend changes, dependency changes, lockfile changes, or deployment were performed.

> **B0 IS NOT SELF-CLOSED.** This report records the repair state only. Independent CTO re-verification remains required.

## Repository reference

| Field | Value |
|---|---|
| Previous final B0 SHA | `1a5ce9ec73bbf46df55e01574aa4fa19ead94fc7` |
| Current branch | `main` |
| Commit created | Historical B0-FIX.3 commit exists; no commit is authorized for current B0-FIX.4 |
| Push/deploy | Historical B0-FIX.3 was pushed; current B0-FIX.4 has no push or deploy |
| Frontend changed | NO |
| Backend code created | NO |
| Dependencies changed | NO |
| Lockfile changed | NO |

## Files changed

| File | Reason |
|---|---|
| `BACKEND_OPENAPI_V1.yaml` | Converted the contract into a standalone YAML-compatible OpenAPI 3.0.3 document; expanded paths, schemas, responses, security, pagination, async semantics, and safety descriptions. |
| `BACKEND_API_CATALOG.md` | Added the read-only Dashboard overview endpoint and synchronized base-path, async, pagination, concurrency, CSRF, and revenue-boundary rules. |
| `BACKEND_DTO_CONTRACTS.md` | Added the complete transport DTO index required by the catalog and OpenAPI, including aliases and reusable contracts. |
| `BACKEND_ERROR_CATALOG.md` | Added explicit mapping to reusable OpenAPI error response components. |
| `B0_BACKEND_TRACEABILITY.md` | Replaced unsupported generic OpenAPI coverage wording with actual repair evidence and preserved the implementation prohibition. |
| `B0_IMPLEMENTATION_REPORT.md` | Replaced the stale original delivery report with this factual B0-FIX.1 report. |

No unrelated architecture document was changed.

## Contract results

| Check | Result |
|---|---|
| YAML parser | PyYAML `6.0.3` in isolated environment |
| OpenAPI structural validator | `openapi-spec-validator` `0.9.0` in isolated environment |
| JSON-compatible syntax parse | PASS — Python standard-library JSON parser parsed the repaired YAML-compatible payload |
| Top-level keys | PASS — `openapi`, `info`, `servers`, `paths`, `components`, `security`, `tags` |
| OpenAPI version | PASS — `3.0.3` |
| OpenAPI paths | `29` |
| OpenAPI operations | `30` |
| Catalog endpoints | `30` |
| Missing from OpenAPI | `0` |
| Extra in OpenAPI | `0` |
| Local schema refs | `218/218 PASS` |
| Dangling refs | `0` |
| Unique operation IDs | `30/30 PASS` |
| DTO names missing | `0` |
| DashboardOverview | PASS — defined and used by `/dashboard/overview` |
| Every path has responses | PASS by generated contract inspection |
| Duplicate method/path pairs | PASS |

Historical note: B0-FIX.1 originally lacked machine validators and therefore recorded YAML/OpenAPI validation as unavailable. B0-FIX.2 subsequently created an isolated environment outside the repository and performed real validation. The final machine state is `YAML_PARSE=PASS` with PyYAML `6.0.3` and `OPENAPI_VALIDATION=PASS` with `openapi-spec-validator 0.9.0`.

## API contract semantics

The base-path strategy is consistent: `servers.url` contains `/api/v1`, and path keys omit that prefix. The catalog and OpenAPI now contain the same 30 method/path pairs.

The contract defines reusable `Money`, `PageInfo`, `EntityRef`, `ErrorEnvelope`, `DashboardOverview`, resource DTOs, request DTOs, billing DTOs, file DTOs, and health DTOs. All listed catalog DTO names are represented by a concrete schema or documented alias.

Discovery submission, message sending, and payment creation are described as asynchronous where marked `202`; they do not claim synchronous completion. Discovery results, Deals, and invoices expose cursor pagination through `PageInfo`. Editable resource contracts expose `version`, and stale writes use `409`.

Reusable error response components cover authentication, authorization, not-found, conflict/idempotency/version, validation, rate limiting, and service unavailability. Health liveness and readiness are separated, with readiness scoped to DB/Redis architecture and not every provider.

## Commercial and security regression

The Deal close description explicitly states that closing a Deal as won changes Deal state only and does not create a RevenueEvent. `POST /revenue-events` remains the explicit recognized-revenue command. Billing/Payment/Invoice descriptions remain platform Billing only and do not recognize CRM Revenue. Attribution remains reporting-oriented and cannot alter RevenueEvent amount.

Session authentication remains Django session authentication; unsafe cookie-authenticated requests require CSRF. Workspace scope, RBAC, object authorization, provider-neutral statuses, safe error envelopes, and no raw provider/payment payload exposure are preserved.

## Frontend and implementation freeze

The changed-file review is limited to the six documentation/contract files listed above. No path under `client/` was changed. No `package.json`, lockfile, dependency, verifier, backend source, migration, infrastructure, or deployment file was changed.

## B0-FIX.2 machine-validation evidence

An isolated disposable environment at `/tmp/wazlink-b0-openapi-validation` loaded the complete contract with PyYAML `6.0.3` and validated it structurally with `openapi-spec-validator 0.9.0`. YAML parsing and OpenAPI structural validation both passed. The environment was removed after validation. **The figures in this section are the historical B0-FIX.2 state and are superseded by the current B0-FIX.6 gate table below.** The FIX.2 contract evidence was: OpenAPI `3.0.3`, 29 paths, 30 operations, 30/30 catalog coverage, 218/218 local references at that time, zero dangling references, unique operation IDs, zero missing DTO names, and `DashboardOverview` present and referenced.

The next required step is an **Independent CTO — B0 Backend Architecture Re-Verification** in strict read-only mode. B0 is not self-closed. Do not start Django, models, migrations, PostgreSQL schema, Redis, Celery, Auth implementation, API implementation, providers, Tap, ZATCA, or deployment.

## B0-FIX.3 CTO-finding repair evidence

B0-FIX.3 remained documentation/contract-only. The following findings were addressed without backend implementation: the Money amount contract is now enforced consistently as a decimal string with up to four fractional digits; request-side OpenAPI parameters are explicit and reusable (`cursor`, `limit`, `filters`, `sort`, `Idempotency-Key`, `If-Match`, and path `id`); the canonical public-ID prefix registry is present and indexed; the ADR sequence is explicitly registered as `ADR-001` through `ADR-012` with no duplicates; and the subscription state machine now states that trialing is conditional on an approved trial policy rather than universal. Currency precedence is explicit: `Money.currency` is authoritative and any mirror must match it. The API catalog, DTO contracts, API standard, error catalog, reconciliation, state machine, frontend contract map, documentation index, and architecture decision registry were synchronized where directly required by these findings.

## B0-FIX.3 final regression results

| Check | Result |
|---|---|
| OpenAPI version | `3.0.3` |
| YAML parse | PASS — PyYAML `6.0.3` |
| OpenAPI structural validation | PASS — `openapi-spec-validator 0.9.0` |
| OpenAPI paths / operations | `29 / 30` |
| Unique operation IDs | `30/30 PASS` |
| Local references | `313/313 PASS` |
| Dangling references | `0` |
| Effective Money parsed pattern | `^-?\d+(\.\d{1,4})?$` |
| Money positive/negative regression | PASS — valid decimals match; malformed/over-precision values reject |
| Reusable request parameters | PASS — Cursor, Filters, Id, IdempotencyKey, IfMatch, Limit, Sort |
| Error coverage | `500: 30/30`; `429 + Retry-After: 3`; `402: 3`; `502: 9` |
| ADR uniqueness | PASS — 12 identifiers, no duplicates |
| Public-ID registry and index | PASS |
| DashboardOverview | PASS |
| ScrapeJob/DiscoveryJob reconciliation | PASS |
| Conditional subscription trial semantics | PASS |
| Currency precedence | PASS |
| Won Deal != Recognized Revenue | PASS |
| Billing != Customer CRM Revenue | PASS |

## B0-FIX.3 scope gates

The current B0-FIX.4 step remains uncommitted and unpushed, with no deploy or B1 work. No backend/Django implementation, model, migration, database schema, Redis/Celery worker, provider integration, secret, frontend change, dependency change, package change, or lockfile change was performed. B0 remains pending independent CTO closure.

Validation artifacts were created outside the repository at `/tmp/run_b0fix3_final.py`, `/tmp/validate_openapi.py`, and `/tmp/b0fix3-final-validation.txt`; they are not implementation files and are not part of the repository change set.

## B0-FIX.4 final validation and current state

The second CTO closure blockers were repaired in the current uncommitted FIX.4 step. The local repository was already aligned to the published B0-FIX.3 candidate at start (`main`, HEAD and `origin/main` both `8b958412697f595124aaebb4651d4db9f511f51d`, divergence `0 0`); no fast-forward was needed.

| Gate | Result |
|---|---|
| OpenAPI machine validation | PASS — OpenAPI 3.0.3, PyYAML 6.0.3, openapi-spec-validator 0.9.0 |
| Operations / endpoint coverage | 30 operations; catalog 30/30; missing 0; extra 0 |
| Local references | 302 total; 302 resolved; dangling 0 |
| Pagination | Six PageInfo collection responses carry cursor/limit; mismatches 0 |
| Filtering/sorting | Explicit only on GET `/deals` and GET `/billing/invoices`; mismatches 0 |
| Reusable errors | All seven common named components are referenced; semantic 402/502 placement corrected |
| ADR registry | Blueprint and architecture decision IDs align 12/12; duplicate headings 0 |
| Public-ID registry | All canonical and audited frontend prefixes classified; undocumented persistent 0; unclassified frontend 0 |
| Contract map | No dangling DTO placeholders or nonexistent Core routes |
| Payment lifecycle | `cancelled` and `partially_refunded` represented; provider mapping remains pending validation |
| Money/currency | Effective regex, sibling currency mirrors, and authoritative precedence PASS |
| Business invariants | Won Deal != Recognized Revenue; Billing != Customer CRM Revenue; Attribution separation — PASS |
| Architecture regression | NONE |

The current FIX.4 tree has documentation/OpenAPI modifications only and remains intentionally uncommitted, unpushed, and undeployed. B0 is not closed; B1 and backend implementation remain unauthorized. No frontend, dependency, lockfile, migration, provider, secret, or deployment file changed.

## B0-FIX.5 surgical closure repair

B0-FIX.5 repaired exactly the three substantive blockers raised by the Final Independent CTO B0 Closure Audit of the published candidate `372f0c9b32f0081cf5a531b031e2175e75b47d0b`. It is documentation/OpenAPI-contract only. No architecture was redesigned, no domain, table, or aggregate was added, and no unrelated document was refactored.

### Repository alignment

The local checkout was behind the published candidate at start (`main`, HEAD `4902944bd1283cce8b1438c2942786091e48ed57`, `origin/main` `372f0c9b32f0081cf5a531b031e2175e75b47d0b`, divergence `0 2`, clean tree). A single `git pull --ff-only` fast-forwarded the branch; no merge commit was created. The FIX.5 baseline is `372f0c9b32f0081cf5a531b031e2175e75b47d0b` with `HEAD == origin/main`.

### Corrections to earlier evidence

These corrections amend the record without altering the historical FIX.3/FIX.4 sections above.

- The B0-FIX.3 row `Error coverage | 500: 30/30; 429 + Retry-After: 3; 402: 3; 502: 9` was accurate **for FIX.3**, where `Retry-After` was declared inline on three `429` responses. FIX.4 replaced those inline bodies with `$ref` to `components.responses.RateLimited` and did not carry the header onto the component, so the published FIX.4 tree contained **zero** `Retry-After` declarations. No FIX.4 gate re-asserted the header, and the regression went unrecorded. FIX.5 restores it canonically on the reusable component.
- The B0-FIX.4 gate `Public IDs | Persistent undocumented 0; unclassified frontend prefixes 0` overstated the FIX.4 state. Against the frozen frontend, FIX.4 left frontend prefixes unclassified and classified `PIPE-` in two mutually exclusive sections. FIX.5 corrects both.

### FIX.5 verified results

| Gate | Result |
|---|---|
| YAML parse | PASS — PyYAML `6.0.3`, isolated environment outside the repository |
| OpenAPI structural validation | PASS — `openapi-spec-validator 0.9.0` |
| OpenAPI version | `3.0.3` |
| Paths / operations | `29 / 30` |
| Catalog coverage | 30/30; missing 0; extra 0 |
| Local references | 302 total; 302 resolved; dangling 0 |
| Operation IDs | 30/30 unique; missing 0; duplicates 0 |
| `RateLimited.headers.Retry-After` | PASS — `type: integer`, `minimum: 1`, "Seconds until retry is permitted." |
| `RateLimited` component references | 3 (`/auth/login`, `/discovery/jobs`, `/conversations/{id}/messages`) |
| `RETRY_AFTER_429` | PASS — all three `429` responses resolve structurally to the header |
| `PIPE-` classification | 1 row, canonical persistent (section A); contradictions 0 |
| Frozen frontend prefix inventory | 47 identifier prefixes reconstructed from `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` |
| `UNCLASSIFIED_FRONTEND_PREFIXES` | 0 |
| `MULTI_CLASSIFIED_FRONTEND_PREFIXES` | 0 |
| `PERSISTENT_PREFIXES_UNDOCUMENTED` | 0 |
| Registry sections | A 28, B 24, C 3, plus a documented non-identifier exclusion list |
| Pagination / filter / sort mismatches | 0 / 0 / 0 |
| Orphan request parameters | 0 |
| Reusable error component drift | 0 |
| Error semantic over-application | 0 |
| ADR identifier collisions | 0 — Blueprint and architecture decisions align 12/12 |
| Money regex and doc drift | PASS; drift 0 |
| Currency precedence | PASS — 5 sibling schemas, 0 non-conforming |
| State machine / DTO naming / contract map | PASS; drift 0 |
| Business invariants | Won Deal != Recognized Revenue; Billing != Customer CRM Revenue; Attribution separation — PASS |
| Architecture regression | NONE |

### Prefix inventory corrections

The audit's ten-item list required correction against the frozen tree. `LOG-` is **not** a frontend prefix: the literal is `AGA-LOG-8001`, so a numeric-suffix pattern split a compound prefix. Three real prefixes the list omitted — `AUTOACT-`, `AUTORUN-`, and `AUTOEXEC-` — were also classified. Separately, `CON-` (Contact) and `PLAN-` (Plan) were promoted to canonical because the frozen OpenAPI already references them through `Lead360.contacts[]` and `QuoteRequest.plan_ref`/`EntitlementDecision.target_plan_ref`, and `contacts` and `plans` already exist in the data model, so no new domain or table was introduced. **WITHDRAWN BY B0-FIX.6:** FIX.5 additionally promoted `QRT-` to canonical UpgradeQuote on the reasoning that "`UpgradeQuote` is already a frozen schema". That reasoning was wrong — a wire schema is not a persistence concept, and in the frozen frontend `QRT-*` is `quickReplyTemplates`, an unrelated messaging fixture. FIX.6 withdraws that promotion: the canonical UpgradeQuote prefix is `UPQ-`, backed by a real `upgrade_quotes` persistence concept, and `QRT-` is classified in section B. This sentence is retained only as chronology and is not current repository truth. Eight section-B rows that named prefixes absent from the frozen frontend were removed as unverifiable.

`PM-` was deliberately **not** promoted: B0 Phase 1 stores no raw card data and prefers the Tap-hosted/tokenized flow, so PaymentMethod is not modelled as independent persistent domain truth and frontend fixture identity does not freeze a Backend PaymentMethod public ID. `NOTE-`, `OPP-`, `AGA-LOG-`, `SVC-`, `AIR-`, `ATTN-`, and `AGT-` were likewise classified against existing B0 concepts rather than by creating new ones.

### FIX.5 scope

The FIX.5 tree modifies `BACKEND_OPENAPI_V1.yaml`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `B0_IMPLEMENTATION_REPORT.md`, and `B0_BACKEND_TRACEABILITY.md` only, and remains intentionally uncommitted, unpushed, and undeployed. No backend, Django, model, serializer, view, URL, migration, PostgreSQL, Redis/Celery, provider, auth, frontend, dependency, lockfile, secret, or deployment change was made, and B1 was not started. B0 is not closed; B0 closure, B1 authorization, and backend implementation authorization remain `NO` pending independent CTO re-verification and Product Owner approval.

## B0-FIX.6 UpgradeQuote durability and public-ID completeness repair

B0-FIX.6 repaired the two Major blockers and the four Minor findings raised by the Independent CTO countersign audit of the published candidate `4131bce7e455a8d76972835409ec04b70d5b9f71`. It is documentation/OpenAPI-contract only. No backend, Django, migration, provider, dependency, lockfile, secret, deployment, or frontend file changed, and B1 was not started.

### MAJOR-1 — UpgradeQuote is now a durable, server-authoritative Billing resource

The countersign audit was correct on both grounds. `QRT-` was registered as a canonical persistent public ID for UpgradeQuote while no quote table, aggregate, ERD entity, lifecycle, or persisting sequence step existed; and in the frozen frontend `QRT-*` already denotes `quickReplyTemplates` (`client/src/domain/data.js:228-233`, read by `listQuickReplyTemplates()` at `client/src/services/index.ts:212`), an unrelated messaging/UI concept.

FIX.6 does **not** resolve this by demoting the prefix and leaving the lifecycle undefined. The frozen contract already requires durable cross-request identity — `UpgradeQuote.public_id` and `expires_at` are required, and a separate later request resolves `PaymentCreate.quote_ref` — so UpgradeQuote is made genuinely durable:

- **New canonical prefix `UPQ-`** replaces `QRT-` in registry section A. `QRT-` moves to section B as the Quick Reply Template fixture. The two namespaces are disjoint and the registry states so explicitly.
- **`upgrade_quotes`** added to the Billing table group in `BACKEND_DATA_MODEL.md` with unique `public_id`, `workspace_id NOT NULL`, FK `plan_id`, `amount NUMERIC(19,4)` plus ISO-4217 `currency`, constrained `status`, `expires_at` UTC, nullable `consumed_at`/`payment_id`, a partial unique index on `payment_id`, and a `(workspace_id, status, expires_at)` index.
- **`UPGRADE_QUOTE`** added to `BACKEND_ERD.md`, scoped by `WORKSPACE`, quoted from `PLAN`, authorizing at most one `PAYMENT`, with no relationship to `REVENUE_EVENT`.
- **Billing ownership** in `BACKEND_DOMAIN_OWNERSHIP.md`: aggregate root `Subscription/Invoice/UpgradeQuote`, authoritative table `upgrade_quotes`, commands `CreateUpgradeQuote`/`CancelUpgradeQuote`, events `UpgradeQuoteIssued`/`UpgradeQuoteConsumed`. No new top-level domain was created.
- **Lifecycle** frozen in `BACKEND_STATE_MACHINES.md`: `active → expired | consumed | cancelled`, with `active` the only state that may initiate a payment and the other three terminal.
- **Server-authoritative pricing** frozen in `BACKEND_BILLING_TAX_ARCHITECTURE.md`, `BACKEND_API_STANDARD.md`, and the OpenAPI descriptions: the server computes and stores plan, amount, and currency; `PaymentCreate.amount`/`currency` are retained as non-authoritative validation mirrors that must equal the stored quote; the provider request is always built from stored quote values. `QuoteRequest.currency` is a requested presentation currency the server may reject but never prices from.
- **Consumption and concurrency**: one quote authorizes at most one payment-initiation lineage. The quote row is locked, re-checked for `active` and unexpired, and transitioned with the Payment created in the same PostgreSQL transaction; the partial unique index makes a second independent lineage impossible. Retries under the same `Idempotency-Key` and body replay the original result and are not a second consumption. No Redis lock is used as canonical protection.
- **Error contract** frozen in `BACKEND_ERROR_CATALOG.md` using existing doctrine: `404 ENTITY_NOT_FOUND` for absent or cross-workspace quotes without disclosing existence elsewhere; `409 QUOTE_EXPIRED`/`QUOTE_ALREADY_CONSUMED`/`QUOTE_NOT_ACTIVE`; `422 QUOTE_MISMATCH`; `409 CONFLICT` for concurrent consumption; `409 IDEMPOTENCY_CONFLICT` unchanged.

Payment initiation now also declares `404` in OpenAPI so the workspace-scoped quote lookup has a contract-level outcome.

### MAJOR-2 — public-ID inventory recomputed and completed

The inventory was rebuilt from `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` without trusting the prior 47 figure or the auditor's 53 figure. The reconstruction rule is mechanical and compound-aware — a token's namespace is its leading run of all-uppercase alphabetic segments, and a token is an identifier only if a later segment is numeric — and it additionally recovers namespaces from runtime generator call sites (`nextNumericId`/`s11Id`/`s11Audit`), not only from literals.

**The frozen frontend contains 55 identifier prefixes.** Both earlier figures were low. Beyond the seven the countersign audit identified, generator-site recovery found **two further namespaces that no previous pass had reported**, because neither ever appears as a literal in the frozen tree:

- `AUTOLOG-` — `nextNumericId("AUTOLOG", mockModel.automationActivities)` at `client/src/domain/data.js:928`, the automation audit trail appended by `recordAutomationAudit`.
- `AUTONOT-` — `nextNumericId("AUTONOT", mockModel.automationNotifications)` at `client/src/domain/data.js:971`, in-app automation notifications.

All nine newly classified prefixes are section B against existing B0 concepts; none adds a domain, table, or aggregate. `CHK-` is ephemeral checkout UI state whose durable identities are `UPQ-`/`PAY-`/`INV-BILL-`/`SUB-`; `REC-BUSINESS-`/`REC-DEAL-`/`REC-JOB-` are dashboard read-model projections of the same class as `ATTN-`; `EVT-LEGACY-`/`EVT-MANUAL-`/`MANUAL-` are synthetic, non-opaque composed automation trigger identifiers whose canonical execution identity is `RUN-*`; `AUTOLOG-` is an activity/audit entry whose canonical identity is `ACT-*`/`AUD-*`; `AUTONOT-` is notification data on an existing identity.

### FIX.6 verified results (current)

| Gate | Result |
|---|---|
| YAML parse | PASS — PyYAML `6.0.3`, isolated environment outside the repository |
| OpenAPI structural validation | PASS — `openapi-spec-validator 0.9.0` |
| OpenAPI version | `3.0.3` |
| Paths / operations | `29 / 30` |
| Catalog coverage | 30/30; missing 0; extra 0 |
| Local references | 306 total; 306 resolved; dangling 0 |
| Operation IDs | 30/30 unique; missing 0; duplicates 0 |
| Components | 61 schemas; 10 responses; 7 parameters; orphan request parameters 0 |
| `RateLimited` references / `429` responses | 4 / 4; every `429` resolves to the reusable component |
| `Retry-After` declarations in file | 1 — canonically on `components.responses.RateLimited` (`integer`, `minimum 1`) |
| Error coverage | `500: 30/30`; `402: 2`; `502: 8`; `404: 12`; `422: 2`; `503: 3` |
| Reconstructed frontend prefixes | **55** identifier prefixes from `30bc15e9...` |
| `UNCLASSIFIED_FRONTEND_PREFIXES` | 0 |
| `MULTI_CLASSIFIED_FRONTEND_PREFIXES` | 0 |
| `PERSISTENT_PREFIXES_UNDOCUMENTED` | 0 |
| Registry sections | A 28, B 34, C 3 (65 rows), plus a documented non-identifier exclusion table |
| `QRT-` / `UPQ-` | `QRT-`=B (Quick Reply Template); `UPQ-`=A (UpgradeQuote); namespace collision 0 |
| UpgradeQuote contract | persistent, table, owner, ERD, workspace-scoped, server-authoritative plan/amount/currency, expiry, consumption, concurrency, retry-safety, cross-workspace protection, error contract — all PASS |
| `PIPE-` classification | 1 row, canonical persistent (section A); contradictions 0 |
| Pagination / filter / sort mismatches | 0 / 0 / 0 |
| Reusable error component drift / semantic over-application | 0 / 0 |
| ADR identifier collisions | 0 — 12 identifiers aligned across Blueprint and architecture decisions |
| Money / currency | PASS; regex doc drift 0; currency fields without ISO-4217 pattern 0 |
| State machine / DTO naming / required-field drift | 0 / 0 / 0 |
| Business invariants | Won Deal != Recognized Revenue; Billing != Customer CRM Revenue; Attribution separation — PASS |
| Architecture regression | NONE |

### FIX.6 scope

The FIX.6 tree modifies documentation and the OpenAPI contract only, and remains intentionally uncommitted, unpushed, and undeployed. No backend, Django, model, serializer, view, URL, migration, PostgreSQL, Redis/Celery, provider, auth, frontend, dependency, lockfile, secret, or deployment change was made, and B1 was not started. B0 is not closed; B0 closure, B1 authorization, and backend implementation authorization remain `NO` pending independent CTO countersign and Product Owner approval.
