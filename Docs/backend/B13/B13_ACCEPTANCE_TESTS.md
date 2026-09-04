# B13 — Security Acceptance Tests

> Design only. **This document is the canonical acceptance-test index for the B13 pack.** Every `AT-B13*` identifier that exists anywhere in `Docs/backend/B13/` appears in §1 below, assigned to a category, tagged positive/negative, and attributed to the document that owns its full procedure. Individual test procedures stay in their owning document; this file is the index, the category-coverage proof, and the P/N tally. **P** = positive control, **N** = negative control.
>
> **Rebuilt under `B13-FIX.1`.** The previous version indexed 145 of the pack's 202 tests: 57 tests across 14 areas — API transport, B13/B14 boundary, cookies, CORS, CSP, database security, concurrency, deployment, disaster recovery, environment strategy, input validation, input/output security, observability, and privacy — existed only in their owning documents and were unreachable from this index, so the artifact that claimed to be the mechanical index was not one. It also published a category count of 23 against 24 numbered headings. Both are corrected here by full re-derivation rather than adjustment.

## 1. Canonical register — every acceptance test in the pack

One subsection per identifier family. A category is an `AT-B13<FAMILY>` namespace; that is the unit this register counts, and it is mechanically reproducible by listing distinct families across the pack.

### 1. API TRANSPORT

Owning document: `B13_DJANGO_DRF_SECURITY_BASELINE.md §10` — 4 tests (0 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13API-1` | N | Every non-exempt operation returns `401` without a session cookie |
| `AT-B13API-2` | N | The browsable API renderer is unavailable in a production-configured instance |
| `AT-B13API-3` | N | An oversized request body is rejected with `413` before deserialization |
| `AT-B13API-4` | N | An unsupported `Content-Type` on a write operation is rejected with `415` |

### 2. AUDIT LOGGING

Owning document: `B13_AUDIT_LOGGING.md §8` — 6 tests (1 P / 5 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13AUD-1` | P | Every permission grant/role change/ownership transfer writes an audit row with before/after role |
| `AT-B13AUD-2` | N | Every `403`/scoping-`404` writes a `denied` audit row |
| `AT-B13AUD-3` | N | No audit row, at any domain, ever contains a value from the never-log list |
| `AT-B13AUD-4` | N | Every financial audit row names a real membership, never a system actor |
| `AT-B13AUD-5` | N | An abandon/dismiss/override/reversal action without a `reason` field is rejected before the audit row is written |
| `AT-B13AUD-6` | N | Audit rows are immutable — no application code path issues an `UPDATE` or `DELETE` against `audit_logs` |

### 3. AUTHENTICATION

Owning document: `B13_AUTHENTICATION_SESSION_SECURITY.md §9` — 8 tests (3 P / 5 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13AUTH-1` | N | Login with wrong password, unknown email, and disabled account all return byte-identical `401` bodies within a bounded timing window |
| `AT-B13AUTH-2` | N | Exceeding 10/min/IP or 5/min/account returns `429` with `Retry-After`; the account limit trips even from rotating IPs |
| `AT-B13AUTH-3` | N | A pre-login session cookie is destroyed on successful login (session-fixation negative control) |
| `AT-B13AUTH-4` | P | Password change revokes every other session but not the acting session, and rotates the acting session's key |
| `AT-B13AUTH-5` | P | Password reset confirmation revokes all sessions including the one that requested the reset |
| `AT-B13AUTH-6` | N | A logged-out session cookie replayed after logout returns `401 SESSION_REVOKED`, never `401 AUTH_REQUIRED` |
| `AT-B13AUTH-7` | N | A password below the single-factor minimum length, or present on the known-compromised blocklist, is rejected at register/change/reset with zero account mutation |
| `AT-B13AUTH-8` | P | A lowercase-and-spaces passphrase at the minimum length, and a 64-character password, are both accepted — no composition rule is imposed |

### 4. AUTHORIZATION

Owning document: **this register, §1.4** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§2`, a section number that does not exist in this file.) — 5 tests (1 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13AUTHZ-1` | N | A role lacking a permission code is denied `403` for every operation that code governs |
| `AT-B13AUTHZ-2` | P | A role holding the permission succeeds, subject to object/entitlement/quota checks still applying |
| `AT-B13AUTHZ-3` | N | RBAC deny occurs before entitlement/quota is evaluated (caller learns nothing about plan/usage) |
| `AT-B13AUTHZ-4` | N | An unknown/unregistered permission code is treated as denied, never as unrestricted |
| `AT-B13AUTHZ-5` | N | A `conditional` grant whose object condition fails returns the same `403` shape as a flat deny |

### 5. B13/B14 BOUNDARY

Owning document: `B13_B14_BOUNDARY.md §5` — 2 tests (2 P / 0 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13BOUND-1` | P | Every B14 implementation decision traces to either a B13 contract (§1) or an explicit Class B/C decision this pack left open (§2) |
| `AT-B13BOUND-2` | P | `B14_FILES_CREATED = 0` and `IMPLEMENTATION_LEAKAGE = 0` for this B13 pass, verified in B13_VERIFICATION_MATRIX.md §6 |

### 6. BACKUP/RESTORE

Owning document: `B13_BACKUP_RESTORE.md §8` — 6 tests (2 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13BAK-1` | P | A monthly restore-to-staging test succeeds and passes integrity validation |
| `AT-B13BAK-2` | N | Backup files are encrypted at rest; an operator without database-admin-tier authorization cannot initiate a restore |
| `AT-B13BAK-3` | P | Every restore operation writes an audit row with operator, timestamp, and target environment |
| `AT-B13BAK-4` | N | A restored database's financial-row count matches the source at the backup timestamp exactly |
| `AT-B13BAK-5` | N | Flushing Redis does not require restoring from any backup — the system is correct on Redis's own restart alone |
| `AT-B13BAK-6` | N | Backup monitoring provably fires: with the backup job disabled in a non-production environment the staleness gauge crosses threshold and pages; a stalled WAL archiver pages independently |

### 7. CELERY/REDIS AUTHORITY

Owning document: `B13_REDIS_CELERY_SECURITY.md §10` — 7 tests (0 P / 7 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CEL-1` | N | Redis is unreachable from outside the application/worker network segment |
| `AT-B13CEL-2` | N | A Redis connection without authentication is refused in every non-isolated-dev environment |
| `AT-B13CEL-3` | N | Celery's serializer is configured as JSON; a pickle-serialized payload is refused |
| `AT-B13CEL-4` | N | Flushing Redis in a test environment does not corrupt or lose any durable domain state after PostgreSQL-driven recovery |
| `AT-B13CEL-5` | N | A worker killed mid-task never resumes its own in-flight work, and the two frozen mechanisms are exercised separately: an `outbox_events` claim is reaped and re-claimed under a fresh `lease_token`, the dead claimant's late completion write matching zero rows (`B12-D-A055`); a `worker_executions` row left `running` past its heartbeat ceiling is classified `unknown` by reconciliation class `P-3` — never assumed failed, never automatically re-executed — and schema inspection confirms `worker_executions` carries no lease, lease-owner, or fencing-token column from which a claim could be re-issued |
| `AT-B13CEL-6` | N | A malformed task payload is dead-lettered rather than retried indefinitely |
| `AT-B13CEL-7` | N | No business-domain-named queue exists beyond the five frozen queues |

### 8. CONCURRENCY

Owning document: `B13_DATABASE_SECURITY.md §10` — 3 tests (1 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CONC-1` | N | Two concurrent updates to the same versioned resource using the same stale `version` result in exactly one success and one `409 STALE_VERSION` |
| `AT-B13CONC-2` | N | An update submitted without `If-Match`/`version` on a resource that requires it is rejected before any row lock is taken |
| `AT-B13CONC-3` | P | A successful versioned update's audit row carries both the before and after `version`, differing by exactly one |

### 9. CONFIGURATION FAILURE

Owning document: `B13_CONFIGURATION_MANAGEMENT.md §7` — 6 tests (3 P / 3 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CFG-1` | N | Application refuses to start with `DEBUG=True` in a production environment |
| `AT-B13CFG-2` | N | Application refuses to start with a wildcard `ALLOWED_HOSTS` in production |
| `AT-B13CFG-3` | N | Application refuses to start without a valid `SECRET_KEY` or database credential |
| `AT-B13CFG-4` | P | Application starts successfully with every optional provider credential absent; each absent provider reports `configuration_required` rather than crashing |
| `AT-B13CFG-5` | P | `RAW_WEBHOOK_PAYLOAD_RETENTION` unset resolves to "off," never "on by omission" |
| `AT-B13CFG-6` | P | Every configuration change of a security-relevant value writes an audit row |

### 10. CONTENT SECURITY POLICY

Owning document: `B13_BROWSER_SECURITY.md §6` — 3 tests (1 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CSP-1` | P | Every response carries the CSP header from §2 |
| `AT-B13CSP-2` | N | An injected `<script src="https://attacker.example/x.js">` is blocked by `script-src 'self'` in a browser-driven test |
| `AT-B13CSP-3` | N | The SPA is not renderable inside an `<iframe>` from a foreign origin |

### 11. COOKIES

Owning document: `B13_BROWSER_SECURITY.md §6` — 3 tests (0 P / 3 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13COOKIE-1` | N | Session and CSRF cookies are never sent on a cross-site top-level navigation from an untrusted origin (`SameSite=Lax`) |
| `AT-B13COOKIE-2` | N | The session cookie is not readable from injected JavaScript (`HttpOnly`); the CSRF cookie is deliberately readable, as frozen B1's cookie/header pair requires |
| `AT-B13COOKIE-3` | N | Neither cookie is transmitted over plain HTTP (`Secure` verification) |

### 12. CORS

Owning document: `B13_DJANGO_DRF_SECURITY_BASELINE.md §10` — 2 tests (0 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CORS-1` | N | A CORS preflight from an origin not in the explicit allow-list is rejected |
| `AT-B13CORS-2` | N | `Access-Control-Allow-Credentials: true` is never paired with `Access-Control-Allow-Origin: *` in any response |

### 13. CSRF

Owning document: **this register, §1.13** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§4`, a section number that does not exist in this file.) — 3 tests (1 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13CSRF-1` | N | unsafe request with a valid session cookie but no CSRF token is rejected, zero state change |
| `AT-B13CSRF-2` | P | unsafe request with a valid session cookie and valid CSRF token succeeds |
| `AT-B13CSRF-3` | N | a cross-site form submission using the ambient cookie is blocked by SameSite=Lax as defense in depth |

### 14. DATABASE SECURITY

Owning document: `B13_DATABASE_SECURITY.md §10` — 5 tests (0 P / 5 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13DB-1` | N | The application's database role cannot execute CREATE/ALTER/DROP |
| `AT-B13DB-2` | N | A connection to PostgreSQL without TLS is refused in every environment where the DB is not on a private segment |
| `AT-B13DB-3` | N | Two concurrent attempts to consume the same UpgradeQuote result in exactly one success and one 409 CONFLICT |
| `AT-B13DB-4` | N | No code path issues DELETE against revenue_events, revenue_reversals, or a legal-class file_assets row |
| `AT-B13DB-5` | N | Crash between outbox write and domain-state write cannot occur (same transaction); kill mid-transaction leaves neither row post-recovery |

### 15. DEPENDENCY VULNERABILITY POLICY

Owning document: `B13_SUPPLY_CHAIN_SECURITY.md §7` — 4 tests (3 P / 1 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13DEP-1` | P | Every dependency manifest has exactly one committed lockfile and CI installs with a frozen-lockfile flag; satisfied today for the frontend |
| `AT-B13DEP-2` | N | CI fails (or explicitly flags) a PR introducing a Critical-severity known-vulnerable dependency without a documented risk-acceptance |
| `AT-B13DEP-3` | P | A scheduled scan independent of code changes runs at least weekly against the resolved dependency tree |
| `AT-B13DEP-4` | P | Every documented risk-acceptance for a deferred vulnerability has an owner and a review date |

### 16. DEPLOYMENT SECURITY

Owning document: `B13_DEPLOYMENT_SECURITY.md §9` — 5 tests (1 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13DEPLOY-1` | N | PostgreSQL and Redis are unreachable from the public internet in every environment beyond local development |
| `AT-B13DEPLOY-2` | N | A direct request to the application process bypassing the reverse proxy either fails or is not exposed to any external network path |
| `AT-B13DEPLOY-3` | N | X-Forwarded-Proto supplied by a client attempting to reach the application directly is not trusted |
| `AT-B13DEPLOY-4` | P | A rolling deploy with two concurrent application versions produces zero dropped or duplicated domain events |
| `AT-B13DEPLOY-5` | N | No process in the deployment runs as the root OS user |

### 17. DISASTER RECOVERY

Owning document: `B13_DISASTER_RECOVERY.md §6` — 5 tests (0 P / 5 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13DR-1` | N | A disaster-recovery drill resumes Celery/worker activity only after PostgreSQL is verified healthy, never concurrently |
| `AT-B13DR-2` | N | A Redis loss during active traffic produces zero durable data loss, verified against AT-B13CEL-4 |
| `AT-B13DR-3` | N | A rollback after a bad deployment does not discard an in-flight event produced by the newer schema version |
| `AT-B13DR-4` | N | A storage-outage-induced unknown file operation resolves via stat_object before any state transition, once the provider returns |
| `AT-B13DR-5` | N | A Tap webhook-ingress outage beyond Tap's retry window has every affected charge resolved via retrieve_charge, not assumed resolved by provider retry |

### 18. ENVIRONMENT STRATEGY

Owning document: `B13_ENVIRONMENT_STRATEGY.md §7` — 5 tests (1 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13ENV-1` | N | No production secret value is present in any development or CI-test configuration, verified by a secret-scanning pass across both |
| `AT-B13ENV-2` | P | Staging's Tap/ZATCA credentials are confirmed sandbox-tier, not production-tier |
| `AT-B13ENV-3` | N | A production-scoped tax submission using a sandbox credential (or vice versa) is rejected before any network call |
| `AT-B13ENV-4` | N | Development/CI databases contain no unanonymized production PII |
| `AT-B13ENV-5` | N | Sentry/OTel events from a development run never appear in the production project |

### 19. FILES

Owning document: `B13_FILE_SECURITY.md §11` — 8 tests (1 P / 7 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13FILE-1` | N | An upload whose declared and detected content types are on the allow-list but in different equivalence groups is rejected at finalize |
| `AT-B13FILE-2` | N | A file whose streamed bytes exceed `MAX_FILE_BYTES` mid-stream aborts the provider write immediately |
| `AT-B13FILE-3` | N | A checksum mismatch at finalize rejects the file and never updates `checksum` after initial write |
| `AT-B13FILE-4` | P | Every download response carries `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` |
| `AT-B13FILE-5` | N | A previously issued download ticket fails once the file transitions to `quarantined` or `archived`, regardless of ticket TTL remaining |
| `AT-B13FILE-6` | N | A `legal`-class file rejects `DeleteAsset` with `403 PERMISSION_DENIED` regardless of caller role |
| `AT-B13FILE-7` | N | Cross-workspace file lookup, download, finalize, attach, and delete all return `404`, never `403` |
| `AT-B13FILE-8` | N | A storage-provider delete timeout does not advance `storage_object_state` to `purged` without a confirming `stat_object` |

### 20. FINANCIAL AUTHORITY

Owning document: `B13_PAYMENT_FINANCIAL_SECURITY.md §11` — 8 tests (0 P / 8 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13FIN-1` | N | `CloseDealWon` produces zero rows in `revenue_events` |
| `AT-B13FIN-2` | N | `PaymentSucceeded`/`SubscriptionActivated` produce zero rows in `revenue_events` |
| `AT-B13FIN-3` | N | No B9 write path is reachable without a named human membership; a `system:automation` actor is refused on every financial command |
| `AT-B13FIN-4` | N | A **B9** response containing a `Money` field is unreachable without `revenue.view`; a B8 billing surface remains reachable under `billing.view` alone |
| `AT-B13FIN-5` | N | A reversal never creates negative `net`/`gross` on the original event beyond the documented terminal gross-cleanup case |
| `AT-B13FIN-6` | N | A dead letter or reconciliation case with `owning_domain=billing`/`finance` refuses an Admin-level replay/resolve, requiring Owner |
| `AT-B13FIN-7` | N | An entitlement-override read/write is scoped by `workspace_id`; a cross-tenant override collision is structurally impossible |
| `AT-B13FIN-8` | N | An ambiguous ZATCA response never resolves to `accepted` or `rejected` without a mandatory reconciliation case |

### 21. HEALTH ENDPOINT LEAKAGE

Owning document: `B13_HEALTH_READINESS.md §7` — 6 tests (3 P / 3 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13HLTH-1` | P | `/health/live` returns `200` while every external provider is simulated unreachable, provided the process and its event loop respond |
| `AT-B13HLTH-2` | N | `/health/ready` returns `503` when PostgreSQL is unreachable, and `200` once restored |
| `AT-B13HLTH-3` | P | `/health/ready` returns `200` while WhatsApp, Tap, Places, the scraper, and the AI Gateway are all simulated unreachable |
| `AT-B13HLTH-4` | N | Neither health endpoint response body contains a stack trace, connection string, or secret value under any failure condition |
| `AT-B13HLTH-5` | P | Both health endpoints are reachable without a session cookie |
| `AT-B13HLTH-6` | N | A pending, incompatible migration causes `/health/ready` to report `not_ready` before any request touches the mismatched schema |

### 22. INCIDENT RUNBOOKS

Owning document: **this register, §1.22** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§22`, a section number that does not exist in this file.) — 3 tests (2 P / 1 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13INC-1` | P | Every runbook in `B13_RUNBOOKS.md` §1-18 carries all eight required operational fields — signal/detection, initial triage, safe immediate action, actions NOT to take, recovery, verification after recovery, escalation, evidence to preserve — each stated in the runbook itself, no field satisfied by deferring to another runbook |
| `AT-B13INC-2` | N | No runbook's safe-immediate-action step ever recommends a direct database edit or disabling a security control as a remediation |
| `AT-B13INC-3` | P | Every SEV-1/SEV-2 incident class in `B13_INCIDENT_MANAGEMENT.md` §2 names a post-incident-review requirement |

### 23. INPUT VALIDATION

Owning document: `B13_INPUT_OUTPUT_SECURITY.md §8` — 4 tests (0 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13VAL-1` | N | A request body exceeding the configured size ceiling is rejected before deserialization completes |
| `AT-B13VAL-2` | N | A field with the wrong JSON type is rejected with 400/422 VALIDATION_ERROR, never coerced |
| `AT-B13VAL-3` | N | A value outside a closed enum is rejected, never silently mapped to a default |
| `AT-B13VAL-4` | N | A malformed provider payload failing closed-schema validation never reaches domain-mutating code |

### 24. INPUT/OUTPUT SECURITY

Owning document: `B13_INPUT_OUTPUT_SECURITY.md §8` — 6 tests (0 P / 6 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13IO-1` | N | Submitting any server-owned field from §2's table returns `400 VALIDATION_ERROR` naming the field, with zero mutation |
| `AT-B13IO-2` | N | An unknown field on any request DTO is rejected, never silently dropped |
| `AT-B13IO-3` | N | A CSV/export value beginning with `=`/`+`/`-`/`@` is neutralized in the output |
| `AT-B13IO-4` | N | A note/task/appointment free-text field never appears in an event payload, outbox row, or audit `details` |
| `AT-B13IO-5` | N | `ImportFileFromUrl` rejects a URL resolving to a private, loopback, link-local, or cloud-metadata address, including via redirect |
| `AT-B13IO-6` | N | No API response schema contains a field capable of carrying a secret value, verified by schema inspection rather than runtime probing alone |

### 25. LOG REDACTION

Owning document: `B13_LOGGING_REDACTION.md §8` — 6 tests (2 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13LOG-1` | N | Scanning every log sink for every item in §2's list returns zero matches under a fuzzed end-to-end test exercising all major flows |
| `AT-B13LOG-2` | N | A masked token fragment (e.g. last 4 characters of a secret) never appears in any log line |
| `AT-B13LOG-3` | N | An error response never contains a field outside `FI-B12-11` §5's safe list |
| `AT-B13LOG-4` | P | Audit rows are never subject to sampling — 100% of security-sensitive events are captured |
| `AT-B13LOG-5` | N | Sentry/OTel context for a captured exception contains no item from §2 |
| `AT-B13LOG-6` | P | A log statement's field set is enumerable and reviewable as an allow-list, not discoverable only by runtime inspection |

### 26. MASS ASSIGNMENT

Owning document: **this register, §1.26** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§7`, a section number that does not exist in this file.) — 5 tests (0 P / 5 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13MASS-1` | N | submitting `workspace_id` on any request DTO is rejected, zero mutation |
| `AT-B13MASS-2` | N | submitting `status`/`version`/`role`(self) is rejected |
| `AT-B13MASS-3` | N | submitting a financial field (`RevenueEvent.gross`/`.net`) directly is rejected — only the governed command may set it |
| `AT-B13MASS-4` | N | submitting `checksum`/`detected_content_type`/`storage_key` on a file DTO is rejected |
| `AT-B13MASS-5` | N | an unknown field on any request DTO is rejected, never silently dropped |

### 27. OBJECT OWNERSHIP

Owning document: **this register, §1.27** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§6`, a section number that does not exist in this file.) — 4 tests (1 P / 3 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13OBJ-1` | N | a `sales` actor cannot mutate a Deal/Task/Appointment they neither own nor share a team with |
| `AT-B13OBJ-2` | P | the same actor succeeds against an object they own or share a team with |
| `AT-B13OBJ-3` | N | an invitation-issuer-scoped action (cancel/resend) fails for a manager who did not issue the invitation |
| `AT-B13OBJ-4` | N | a Discovery/Intelligence/Automation cancel fails for a non-requester below manager rank |

### 28. OBSERVABILITY

Owning document: `B13_OBSERVABILITY.md §7` — 5 tests (3 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13OBS-1` | N | No metric label in the deployed metrics backend contains a workspace ID, user ID, correlation ID, or raw provider error string |
| `AT-B13OBS-2` | P | Every alert in §4 has a corresponding dashboard panel before it is enabled |
| `AT-B13OBS-3` | P | `attribution_integrity_failure_total > 0` triggers a SEV-1 page within the tuned threshold |
| `AT-B13OBS-4` | N | Sentry/OTel context for any captured span/exception contains no item from `B13_LOGGING_REDACTION.md` §2 |
| `AT-B13OBS-5` | P | A financial fact is never asserted from a metric alone — every runbook alert response confirms against the durable domain record first |

### 29. OPERATOR ACTIONS

Owning document: `B13_OPERATOR_MODEL.md §12` — 10 tests (2 P / 8 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13OPS-1` | N | A workspace Admin cannot configure a global-scope provider |
| `AT-B13OPS-2` | N | An Admin-level replay/resolve on a `billing`/`finance` owning-domain record is refused, requiring Owner |
| `AT-B13OPS-3` | N | Abandon/dismiss/replay without a non-empty `reason` field is rejected before any state change, provider contact, or eligibility evaluation with a side effect |
| `AT-B13OPS-4` | N | A replay re-checks state, idempotency, budget, entitlement, tenancy, and provider enablement — verified against a record where at least one now fails |
| `AT-B13OPS-5` | P | Every operator action writes an audit row with a distinguishable operator/system actor |
| `AT-B13OPS-6` | N | `ValidateProviderConfiguration` never returns a secret value under any response path, including error responses |
| `AT-B13OPS-7` | N | Django superuser access alone (without a governed command) cannot mutate tenant business state through any documented path |
| `AT-B13OPS-8` | N | A replay attempted without `platform.operations.replay`, and an Admin-level replay of a `billing`/`finance` owning-domain record, is refused `403` before the request body is validated |
| `AT-B13OPS-9` | P | An authorized replay with a valid non-empty reason writes exactly one `platform.replayed` audit row carrying actor membership, target record, timestamp, action, verbatim reason, correlation ids and `replay_of` lineage |
| `AT-B13OPS-10` | N | A replay whose `reason` contains any must-redact class is rejected with zero state change, and the submitted value appears in no response, log line, or audit row |

### 30. PAYMENT AUTHORITY

Owning document: `B13_PAYMENT_FINANCIAL_SECURITY.md §11` — 4 tests (0 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13PAY-1` | N | A redirect from Tap's hosted checkout never mutates Payment.status; only ProcessPaymentWebhook/ReconcilePayment do |
| `AT-B13PAY-2` | N | A field outside Tap's signed concatenation is never read for an authorization or routing decision |
| `AT-B13PAY-3` | N | A connection loss during charge creation records unknown, never known_failure or known_success, and is never blindly retried |
| `AT-B13PAY-4` | N | Duplicate Tap webhook delivery produces zero duplicate Payment state transitions |

### 31. PRIVACY / DATA MINIMIZATION

Owning document: `B13_PRIVACY_DATA_MINIMIZATION.md §7` — 5 tests (3 P / 2 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13PRIV-1` | N | No AI provider wire payload is retained beyond the validation step, under any configuration |
| `AT-B13PRIV-2` | P | A deleted Lead's referencing RevenueEvent remains at its original amount, unchanged |
| `AT-B13PRIV-3` | N | Admin/export views mask phone and email; no view ever shows a raw card number or secret |
| `AT-B13PRIV-4` | P | RAW_WEBHOOK_PAYLOAD_RETENTION defaults to off in a fresh environment configuration |
| `AT-B13PRIV-5` | P | Every retention-bearing table has a non-null creation/occurrence timestamp column, confirmed by schema inspection |

### 32. RATE LIMITING

Owning document: `B13_RATE_LIMIT_ABUSE_MODEL.md §9` — 12 tests (2 P / 10 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13RATE-1` | N | A security rate-limit trip and a domain-quota exhaustion on the same request produce distinguishable error reasons |
| `AT-B13RATE-2` | N | Exceeding 300/min/workspace general API limit returns 429 without touching any domain-specific quota counter |
| `AT-B13RATE-3` | N | An automatic transient retry never increments discoveryRuns/aiAnalyses/any domain attempt counter |
| `AT-B13RATE-4` | N | A generic worker retry is capped at MIN(frozen_class_max, domain_budget_remaining), verified against a domain below the class max |
| `AT-B13RATE-5` | N | Automation loop prevention blocks a same-rule re-entrant chain at depth <=5 regardless of execution-budget headroom |
| `AT-B13RATE-6` | N | A shared global provider credential's per-workspace fairness budget prevents one workspace from exhausting another's share |
| `AT-B13RATE-7` | N | Login rate-limit trips independently on IP and on account, from rotating source IPs |
| `AT-B13RATE-8` | N | Password-reset request rate limiting never reveals whether the submitted address exists |
| `AT-B13RATE-9` | N | Admin repair rate limit (30/hour/operator) is scoped per operator, not per workspace |
| `AT-B13RATE-10` | P | Sustained low-rate distributed login attempts across many accounts trigger security.credential_stuffing_suspected |
| `AT-B13RATE-11` | N | Webhook ingress rate gate runs before HMAC computation |
| `AT-B13RATE-12` | P | Every 429 response carries Retry-After |

### 33. SECRETS

Owning document: `B13_SECRETS_MANAGEMENT.md §10` — 8 tests (0 P / 8 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13SEC-1` | N | No API response, at any endpoint, ever contains a value from §1 |
| `AT-B13SEC-2` | N | A configuration read returns only configured: true\|false, never a masked fragment |
| `AT-B13SEC-3` | N | Scanning outbox rows, task payloads, events, receipts, dead letters, and logs for every secret class in §1 returns zero matches |
| `AT-B13SEC-4` | N | Rotating a credential invalidates the prior reference; a request using the old reference fails rather than succeeding against the old value |
| `AT-B13SEC-5` | N | A workspace admin attempting to configure a global-scope provider receives 403 PERMISSION_DENIED |
| `AT-B13SEC-6` | N | Missing SECRET_KEY or database credentials at startup halts the process; missing an optional provider credential does not |
| `AT-B13SEC-7` | N | A sandbox ZATCA credential rejected against a production-scoped submission before any network call |
| `AT-B13SEC-8` | N | Error responses from every provider adapter never include a credential, host, or raw response body |

### 34. SESSION REVOCATION

Owning document: `B13_AUTHENTICATION_SESSION_SECURITY.md §9` — 7 tests (3 P / 4 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13SESS-1` | N | GET /auth/sessions never returns another user's session, raw IP, or raw user agent |
| `AT-B13SESS-2` | N | Idle expiry is not extended by activity past the absolute expiry bound |
| `AT-B13SESS-3` | P | Revoking a session from a second device invalidates the first device's cookie on its next request |
| `AT-B13SESS-4` | P | RevokeAllSessions is idempotent and returns 204 on a caller with zero remaining sessions |
| `AT-B13SESS-5` | N | A cookie is never readable from injected JavaScript (HttpOnly verification) in a browser-driven test |
| `AT-B13SESS-6` | N | A user in workspaces W1+W2, removed from W1 while active on W1, continues the same session on W2 without re-login |
| `AT-B13SESS-7` | P | SECRET_KEY rotation invalidates all existing session cookies and follows `B13_SECRETS_MANAGEMENT.md` §7a — scheduled, pre-announced, owned, never a silent deploy side effect |

### 35. TENANT ISOLATION

Owning document: `B13_AUTHORIZATION_TENANCY.md §10` — 12 tests (0 P / 12 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13TEN-1` | N | Read another workspace's object by public ID — Doctrine R-1 → 404 |
| `AT-B13TEN-2` | N | Path-segment workspace override (/workspaces/{W2}/... while active on W1) → 404 WORKSPACE_NOT_FOUND even for a genuine W2 member |
| `AT-B13TEN-3` | N | Body/header workspace_id=W2 on any request is never read by the pipeline |
| `AT-B13TEN-4` | N | Cross-workspace relationship injection (Deal referencing a W2 Lead) → 404 for the reference, never 400 |
| `AT-B13TEN-5` | N | Forge a webhook to reach another tenant — signature must verify against that binding's own secret |
| `AT-B13TEN-6` | N | Poison another workspace's webhook dedup identity — dedup_key prefixed by the verifying binding |
| `AT-B13TEN-7` | N | Replay another workspace's dead letter — Doctrine R-1 plus post-resolution workspace re-assertion |
| `AT-B13TEN-8` | N | Exhaust another tenant's share of a shared global provider credential — per-workspace budgets on shared credentials |
| `AT-B13TEN-9` | N | Configure a global-scope integration (Places, AI Gateway, storage) as a workspace admin — global integrations are not workspace-administrable |
| `AT-B13TEN-10` | N | Cross-workspace AI provider-cache collision (business_id alone as key) — prevented by (workspace_id, business_id, input_hash) composite key |
| `AT-B13TEN-11` | N | Read another workspace's file by a previously issued signed URL/ticket — per-request re-authorization; ticket alone insufficient |
| `AT-B13TEN-12` | N | Cross-tenant entitlement-override collision — partial unique index scoped by workspace_id |

### 36. WEBHOOK REPLAY

Owning document: **this register, §1.36** — the family has no separate owning document; the assertions below are canonical. (Corrected under `B13-FIX.2`: the pointer previously read `§10`, a section number that does not exist in this file.) — 3 tests (0 P / 3 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13WHR-1` | N | a captured, correctly-signed payload replayed after original processing produces zero duplicate domain effect |
| `AT-B13WHR-2` | N | the duplicate is acknowledged `200`/`WEBHOOK_DUPLICATE` without reprocessing |
| `AT-B13WHR-3` | N | replay-of-a-replay is itself deduplicated via `replay_of` lineage |

### 37. WEBHOOK SIGNATURES

Owning document: `B13_WEBHOOK_SECURITY.md §§6, 9` — 10 tests (1 P / 9 N)

| ID | P/N | Assertion |
|---|:--:|---|
| `AT-B13WH-1` | N | Signature verification runs before any parse/enqueue/domain code |
| `AT-B13WH-2` | P | Signature comparison is constant-time |
| `AT-B13WH-3` | N | A malformed-but-verified payload acknowledges 200 with zero domain effect |
| `AT-B13WH-4` | N | Forge a webhook claiming another tenant's binding — claiming binding X while signing with binding Y's secret fails verification against X |
| `AT-B13WH-5` | N | Replay a captured payload later — dedup on (provider, dedup_key), binding-scoped |
| `AT-B13WH-6` | N | Poison another tenant's dedup identity — dedup_key prefixed by the verifying binding |
| `AT-B13WH-7` | N | Flood the ingress endpoint pre-verification — size/content-type/rate gates before HMAC |
| `AT-B13WH-8` | N | Use a provider object ID to claim authorization — provider IDs are lookup keys only |
| `AT-B13WH-9` | N | Ingress gates (size, content-type, rate) reject before HMAC computation on an oversized body |
| `AT-B13WH-10` | N | A webhook received while the target provider connection is disabled is still receipted (never silently dropped) but produces zero domain effect |

## 2. Coverage and tally

All figures below are `B13-FIX.1` re-derivations over the current pack. None is carried forward from the previous version.

| Counter | Value | Derivation |
|---|---:|---|
| `TOTAL_ACCEPTANCE_TEST_COUNT` | 208 | distinct `AT-B13*` identifiers appearing literally anywhere in `Docs/backend/B13/`, equal to the row count of §1 |
| `POSITIVE_ACCEPTANCE_TEST_COUNT` | 43 | §1 rows tagged **P** |
| `NEGATIVE_ACCEPTANCE_TEST_COUNT` | 165 | §1 rows tagged **N**; 43+165=208 ✓ |
| `ACCEPTANCE_CATEGORY_COUNT` | 37 | distinct identifier families = subsection count of §1 |
| `DUPLICATE_ACCEPTANCE_ID_COUNT` | 0 | no identifier is defined with two different assertions. `AT-B13DEPLOY-3` appears in two documents, but `B13_DJANGO_DRF_SECURITY_BASELINE.md` §10 is an explicit pointer row naming `B13_DEPLOYMENT_SECURITY.md` §9 as canonical, not a competing definition |
| `UNINDEXED_ACCEPTANCE_ID_COUNT` | 0 | every identifier in the pack appears in §1 |
| `INDEXED_BUT_UNDEFINED_ACCEPTANCE_ID_COUNT` | 0 | every identifier in §1 resolves to an assertion in a named owning document |

**Negative-control coverage — 36 of 37 categories, with one ruled exception.**

Every category contains at least one negative test except `AT-B13BOUND`. That category is granted an **explicit, narrow exception**, ruled during the `B13-FIX.1` final integrity pass:

- **Scope.** The exception names exactly one category, `AT-B13BOUND` (2 tests), and no other.
- **Why.** `B13_B14_BOUNDARY.md` asserts a *documentation and phase-boundary* property — that every B14 implementation decision traces to a B13 contract or to an explicitly declared open decision, and that this authoring pass created no B14 file and leaked no implementation. It contains no runtime surface: no request, no actor, no privilege, and no state transition. A scan of that document for refusal or enforcement language (`must not`, `never`, `reject`, `refuse`, `forbid`, `violate`) returns nothing, because there is nothing there to refuse.
- **Why a synthetic negative would be worse than the gap.** The only negatives constructible here restate `AT-B13BOUND-2` as a tautology ("assert no B14 file exists") or assert a review-process outcome that no system enforces and no test can falsify. Either would put a green check against a control that does not exist, which is the exact failure mode — a passing verifier over an unenforced claim — that this fix pass was convened to remove.
- **What it does not license.** This exception applies **only** to a category with no runtime attack, misuse, or failure surface. It creates no precedent for any runtime or security category: authentication, authorization, tenancy, secrets, webhooks, files, payments, finance, operator actions, replay, rate limiting, logging, privacy, database, Celery/Redis, health, backup, disaster recovery, deployment and configuration all carry negative controls and must continue to. A future category may claim this exception only by demonstrating the same absence of a runtime surface.

**Positive/negative rule.** Positive = a legitimate operation succeeds or a designed property holds under normal operation. Negative = an attack, misuse, or failure path is refused, contained, or handled safely. Applied uniformly under `B13-FIX.1`; where an owning document's inline tag disagreed with the rule, the rule won and the tag is corrected in §1 (three tags: `AT-B13CONC-2`, `AT-B13CONC-3`, `AT-B13WHR-2`).

**Four shapes the bare rule does not resolve, fixed here so a recount reproduces this split.** These were decided consistently across all **208** tests — the pack's full current population; the 207 published here before `B13-FIX.2` was a stale mid-repair count, one addition short — and are binding on future recounts:

| Shape | Ruling | Example |
|---|---|---|
| Ordering-of-defense ("X runs before Y") | **N** — it asserts an attack cannot slip between the two steps | `AT-B13WH-1`, `AT-B13RATE-11` |
| Capability absence ("no path can do X", "role cannot X") | **N** — a misuse path is closed | `AT-B13DB-1`, `AT-B13AUD-6`, `AT-B13DEPLOY-5` |
| Recovery integrity ("state survives a crash/restore intact") | **N** — the rule places "failure path handled safely" on the negative side | `AT-B13BAK-4`, `AT-B13DR-2`, `AT-B13CEL-4` |
| Detection signal ("condition X raises alert Y", nothing refused) | **P** — a designed property holds; nothing is blocked | `AT-B13RATE-10`, `AT-B13OBS-2`, `AT-B13OBS-3` |

**Prior-count note.** At the close of MAJOR-4 the pack held 202 tests split 41/161 — matching the figure the pre-FIX.1 pack published, but independently re-derived rather than inherited. MAJOR-5 then added three operator-replay controls (`AT-B13OPS-8`, `-9`, `-10`) and MAJOR-6 two password-policy controls (`AT-B13AUTH-7`, `-8`), giving 207/43/164; the final consolidated repair then added `AT-B13BAK-6` (backup monitoring), giving the 208/43/165 above. The pre-FIX.1 total of 202 was correct; what was wrong was the claim that this document indexed them, and the category count.
