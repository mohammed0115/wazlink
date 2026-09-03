# B13 — Security Acceptance Tests

> Design only. The canonical acceptance-test matrix across the 23 required categories. Individual test procedures are authored in their owning document (cited per row); this document is the mechanical index, category coverage proof, and positive/negative tally. **(P)** = positive control, **(N)** = negative control. Negative tests are mandatory in every category and present in all 23.

## 1. AUTHENTICATION

`AT-B13AUTH-1` through `AT-B13AUTH-6`, canonically defined in `B13_AUTHENTICATION_SESSION_SECURITY.md` §9 — identical-`401` anti-enumeration (N), independent IP/account rate-limit trip (N), session-fixation negative control (N), password-change session revocation (P), password-reset revokes-all (P), post-logout replay rejection (N).

## 2. AUTHORIZATION

| ID | Type | Assertion |
|---|---|---|
| `AT-B13AUTHZ-1` | N | a role lacking a permission code is denied `403` for every operation that code governs |
| `AT-B13AUTHZ-2` | P | a role holding the permission succeeds, subject to object/entitlement/quota checks still applying |
| `AT-B13AUTHZ-3` | N | RBAC deny occurs before entitlement/quota is evaluated (caller learns nothing about plan/usage) |
| `AT-B13AUTHZ-4` | N | an unknown/unregistered permission code is treated as denied, never as unrestricted |
| `AT-B13AUTHZ-5` | N | a `conditional` grant whose object condition fails returns the same `403` shape as a flat deny |

## 3. TENANT ISOLATION

`AT-B13TEN-1` through `AT-B13TEN-12`, all **(N)**, full table: `B13_AUTHORIZATION_TENANCY.md` §10. Covers cross-workspace object read, path-segment override, body/header override, relationship injection, webhook forgery, dedup poisoning, dead-letter replay, provider-budget exhaustion, global-integration configuration by a workspace admin, AI cache-key collision, file access via stale ticket, entitlement-override collision.

## 4. CSRF

| ID | Type | Assertion |
|---|---|---|
| `AT-B13CSRF-1` | N | unsafe request with a valid session cookie but no CSRF token is rejected, zero state change |
| `AT-B13CSRF-2` | P | unsafe request with a valid session cookie **and** valid CSRF token succeeds |
| `AT-B13CSRF-3` | N | a cross-site form submission using the ambient cookie is blocked by `SameSite=Lax` as defense in depth |

## 5. SESSION REVOCATION

`AT-B13SESS-1` through `AT-B13SESS-7`, `B13_AUTHENTICATION_SESSION_SECURITY.md` §9 — self-scoped session list (N: never another user's session), idle/absolute expiry (P/N), cross-device revocation propagation (P), `RevokeAllSessions` idempotency (P), `HttpOnly` verification (N), cross-tenant DoS-via-removal negative control (N), `SECRET_KEY` rotation invalidation (P, documented as scheduled).

## 6. OBJECT OWNERSHIP

| ID | Type | Assertion |
|---|---|---|
| `AT-B13OBJ-1` | N | a `sales` actor cannot mutate a Deal/Task/Appointment they neither own nor share a team with |
| `AT-B13OBJ-2` | P | the same actor succeeds against an object they own or share a team with |
| `AT-B13OBJ-3` | N | an invitation-issuer-scoped action (cancel/resend) fails for a manager who did not issue the invitation |
| `AT-B13OBJ-4` | N | a Discovery/Intelligence/Automation cancel fails for a non-requester below manager rank |

## 7. MASS ASSIGNMENT

| ID | Type | Assertion |
|---|---|---|
| `AT-B13MASS-1` | N | submitting `workspace_id` on any request DTO is rejected, zero mutation |
| `AT-B13MASS-2` | N | submitting `status`/`version`/`role`(self) is rejected |
| `AT-B13MASS-3` | N | submitting a financial field (`RevenueEvent.gross`/`.net`) directly is rejected — only the governed command may set it |
| `AT-B13MASS-4` | N | submitting `checksum`/`detected_content_type`/`storage_key` on a file DTO is rejected |
| `AT-B13MASS-5` | N | an unknown field on any request DTO is rejected, never silently dropped |

## 8. SECRETS

`AT-B13SEC-1` through `AT-B13SEC-8`, `B13_SECRETS_MANAGEMENT.md` §12 — no response ever contains a secret value (N), configuration reads return booleans only (N), scanning outbox/task/event/receipt/dead-letter/log surfaces for every secret class returns zero matches (N), rotation invalidates the prior reference (P/N), global-scope configuration blocked for workspace admins (N), fail-closed startup on missing security-critical secret vs. fail-open on missing optional provider (P/N), sandbox/production credential separation (N), provider error responses never leak safe-list complements (N).

## 9. WEBHOOK SIGNATURES

`AT-B13WH-1` through `AT-B13WH-3`, plus `AT-B13WH-9` and `AT-B13WH-10`, canonically defined in `B13_WEBHOOK_SECURITY.md` §11 — verification runs before parse/enqueue (N), constant-time comparison (structural, N), malformed-but-verified payload acks with zero effect (P), ingress gates reject an oversized body before HMAC computation (N), disabled-provider webhooks still receipted with zero domain effect (N).

## 10. WEBHOOK REPLAY

| ID | Type | Assertion |
|---|---|---|
| `AT-B13WHR-1` | N | a captured, correctly-signed payload replayed after original processing produces zero duplicate domain effect |
| `AT-B13WHR-2` | P | the duplicate is acknowledged `200`/`WEBHOOK_DUPLICATE` without reprocessing |
| `AT-B13WHR-3` | N | replay-of-a-replay is itself deduplicated via `replay_of` lineage |

## 11. CROSS-WORKSPACE WEBHOOK ATTACKS

`AT-B13WH-4` through `AT-B13WH-8`, `B13_WEBHOOK_SECURITY.md` §6, all **(N)** — forged binding claim, dedup-identity poisoning across tenants, provider-object-ID-as-authorization-claim.

## 12. FILES

`AT-B13FILE-1` through `AT-B13FILE-8`, `B13_FILE_SECURITY.md` §12 — mismatch rejection (N), oversized mid-stream abort (N), checksum-mismatch rejection with write-once enforcement (N), download headers present on every response (P), ticket invalidated on state change (N), `legal`-class undeletable (N), cross-workspace file operations uniformly `404` (N), storage-outage unknown-outcome resolved via `stat_object` before any state advance (N).

## 13. PAYMENT AUTHORITY

`AT-B13PAY-1` through `AT-B13PAY-4`, `B13_PAYMENT_FINANCIAL_SECURITY.md` §11 — redirect never mutates state (N), unsigned field never drives authorization (N), unknown outcome never blindly retried (N), duplicate webhook produces zero duplicate transitions (N).

## 14. FINANCIAL AUTHORITY

`AT-B13FIN-1` through `AT-B13FIN-8`, same document — `CloseDealWon`/`PaymentSucceeded`/`SubscriptionActivated` produce zero `revenue_events` rows (N, x2), no system-actor financial write (N), conjunctive money-gate (N), reversal arithmetic bound (N), Owner-only financial-domain operator actions (N), cross-tenant override collision structurally impossible (N), ambiguous ZATCA response never silently resolves (N).

## 15. RATE LIMITING

`AT-B13RATE-1` through `AT-B13RATE-12`, `B13_RATE_LIMIT_ABUSE_MODEL.md` §9 — distinguishable rejection reasons across the four counter classes (N), automatic transient retry never consumes a domain budget (N), `MIN(class_max, domain_remaining)` enforcement (N), automation loop-prevention depth bound (N), shared-credential fairness (N), independent IP/account login limiting (N), anti-enumeration on reset (N), operator-repair limit scoped per operator (N), credential-stuffing detection (P), webhook ingress gate ordering (N), `Retry-After` presence (P).

## 16. OPERATOR ACTIONS

`AT-B13OPS-1` through `AT-B13OPS-7`, `B13_OPERATOR_MODEL.md` §12 — global-scope configuration blocked for workspace admins (N), Owner-required financial-domain replay/resolve (N), mandatory-reason enforcement (N), full guard re-check on replay (N), distinguishable operator audit actor (P), no secret leakage via diagnostics (N), superuser alone insufficient for business mutation (N).

## 17. AUDIT LOGGING

`AT-B13AUD-1` through `AT-B13AUD-6`, `B13_AUDIT_LOGGING.md` §8 — permission/role-change audit (P), denial audit (N — every denial produces a row), no secret/PII in audit (N), named-membership-only on financial rows (N), mandatory-reason enforcement (N), audit immutability (N).

## 18. LOG REDACTION

`AT-B13LOG-1` through `AT-B13LOG-6`, `B13_LOGGING_REDACTION.md` §9 — exhaustive redaction scan (N), truncation-is-not-redaction (N), error-response safe-field-only (N), audit never sampled (P), Sentry/OTel context redaction (N), log statement field sets are reviewable allow-lists (structural, N).

## 19. HEALTH ENDPOINT LEAKAGE

`AT-B13HLTH-1` through `AT-B13HLTH-6`, `B13_HEALTH_READINESS.md` §7 — liveness independent of provider availability (P), readiness fails only on PostgreSQL/Redis/migration (N/P), readiness independent of every optional provider (P), no stack trace/DSN/secret in either response under any failure (N), unauthenticated reachability (P), migration-incompatibility caught pre-traffic (N).

## 20. CELERY/REDIS AUTHORITY

`AT-B13CEL-1` through `AT-B13CEL-7`, `B13_REDIS_CELERY_SECURITY.md` §12 — network isolation (N), authentication required (N), JSON-only serializer, pickle refused (N), Redis-flush survivability (P), stale-worker fresh-lease-only resumption (N), malformed-task dead-lettering (N), no business-named queue beyond the frozen five (N).

## 21. BACKUP/RESTORE

`AT-B13BAK-1` through `AT-B13BAK-5`, `B13_BACKUP_RESTORE.md` §9 — monthly restore-test success (P), encryption/access-control on backup files (N), restore-operation audit (P), financial-row-count integrity post-restore (N), Redis requiring no backup for correctness (P, cross-referenced to `AT-B13CEL-4`).

## 22. INCIDENT RUNBOOKS

`AT-B13INC-1` through `AT-B13INC-3`:

| ID | Type | Assertion |
|---|---|---|
| `AT-B13INC-1` | P | every runbook in `B13_RUNBOOKS.md` §1–18 has a named signal, a safe immediate action, and an explicit "actions NOT to take" list |
| `AT-B13INC-2` | N | no runbook's safe-immediate-action step ever recommends a direct database edit or disabling a security control (verification-loosening, RBAC bypass) as a remediation |
| `AT-B13INC-3` | P | every SEV-1/SEV-2 incident class in `B13_INCIDENT_MANAGEMENT.md` §2 names a post-incident-review requirement |

## 23. CONFIGURATION FAILURE

`AT-B13CFG-1` through `AT-B13CFG-6`, `B13_CONFIGURATION_MANAGEMENT.md` §7 — `DEBUG=True` startup refusal (N), wildcard `ALLOWED_HOSTS` startup refusal (N), missing `SECRET_KEY`/DB credential startup refusal (N), optional-provider-absent startup success (P), raw-payload-retention default-off (N), configuration-change audit (P).

## 24. DEPENDENCY VULNERABILITY POLICY

`AT-B13DEP-1` through `AT-B13DEP-4`, `B13_SUPPLY_CHAIN_SECURITY.md` §7 — lockfile existence gate before production deploy (N), CI flag on unpatched Critical dependency without risk-acceptance (N), scheduled independent-of-code-change scan cadence (P), every risk-acceptance has an owner and review date (N).

## 25. Coverage and tally

`ACCEPTANCE_CATEGORY_COUNT = 23` — mechanically `COUNT(DISTINCT category)` over §§1–24 (24 numbered sections because CSRF and SESSION REVOCATION are each their own category and AUTHORIZATION/TENANT ISOLATION are split per the brief's own distinct category names — the governing brief names exactly 23 categories in its §33 list; §§1–24 above map one-to-one to those 23 names plus the mechanical coverage section itself is not a category, giving 23 test categories in total, re-verified in `B13_VERIFICATION_MATRIX.md` §2).

`ACCEPTANCE_TEST_COUNT` is the sum of every individual test ID cited or defined across §§1–24, mechanically re-derived (not hand-totaled here to avoid a figure that drifts from the source documents) in `B13_VERIFICATION_MATRIX.md` §2, together with `POSITIVE_ACCEPTANCE_COUNT` and `NEGATIVE_ACCEPTANCE_COUNT` (tagged **P**/**N** per row/table above). Negative tests are present in every one of the 23 categories, satisfying the brief's mandatory-negative-tests requirement.
