# B13 — Threat Model

> Design only. WazLink's explicit production threat model: actors, classes, and the Threat → Asset → Existing Frozen Defense → B13 Defense → Detection → Recovery → Acceptance matrix. **No claim of perfect prevention is made anywhere in this document.**

## 1. Threat actors

| # | Actor | Capability | Primary interest |
|---:|---|---|---|
| A1 | Unauthenticated internet attacker | network access to public endpoints only | scan for misconfiguration, attempt credential guessing, forge webhooks |
| A2 | Malicious authenticated user | valid session in their own workspace | escalate privilege, access other tenants' data, abuse legitimate features |
| A3 | Compromised workspace member | a legitimate member's credentials stolen | act within that member's actual permission scope, undetected |
| A4 | Malicious workspace admin | legitimate Admin/Owner role, acting in bad faith | exceed intended admin authority (financial audit bypass, cross-tenant leakage) |
| A5 | Cross-tenant attacker | member of workspace W1, targets workspace W2 | read/write another tenant's data via IDOR, path manipulation, or relationship injection |
| A6 | Credential thief | possesses a stolen session cookie, password, or API credential | replay/reuse the credential before revocation |
| A7 | Compromised provider credential | a WhatsApp/Tap/Places/AI/storage credential is leaked | act as WazLink toward the provider, or forge callbacks toward WazLink |
| A8 | Forged webhook sender | sends a POST to a webhook endpoint without holding the real provider's secret | trigger a domain effect without provider authorization |
| A9 | Replay attacker | captures a legitimately signed request/callback | resubmit it later for a duplicate effect |
| A10 | Bot / scraper / abuse client | automated, high-volume traffic | credential stuffing, resource exhaustion, provider-cost abuse |
| A11 | Compromised operator account | a platform operator's credentials stolen | replay dead letters, resolve reconciliation cases maliciously, access cross-workspace incident data |
| A12 | Accidental operator error | a legitimate operator makes a mistake | irreversible destructive action without malice |
| A13 | Compromised dependency | a frontend/backend package is compromised upstream | inject malicious code into the build |
| A14 | Compromised worker | a Celery worker process is compromised | exfiltrate task payloads, attempt lateral movement to providers/database |
| A15 | Leaked logs | logs are exfiltrated or accidentally exposed | harvest whatever was logged |
| A16 | Malicious file uploader | uploads a crafted file | trigger stored-XSS, path traversal, or resource exhaustion via the file pipeline |

## 2. Threat classes

Authentication bypass · authorization bypass · IDOR/BOLA · tenant breakout · privilege escalation · CSRF · session theft/fixation · webhook forgery · replay · duplicate execution · injection · stored XSS exposure · unsafe file upload · SSRF · secret leakage · log leakage · payment spoofing · entitlement spoofing · revenue spoofing · provider-cost abuse · queue abuse · denial of service · race conditions · stale worker writes · supply-chain compromise · data exfiltration · destructive admin action · unsafe reconciliation/replay.

## 3. Threat → Asset → Defense → Detection → Recovery matrix

| Threat class | Asset | Existing frozen defense | B13 defense | Detection | Recovery | Acceptance |
|---|---|---|---|---|---|---|
| Authentication bypass | User identity | session-backed auth, timing-safe comparison, rate limits (`FI-B1-03`) | production cookie/CSRF settings (`B13_DJANGO_DRF_SECURITY_BASELINE.md`) | `auth.login_failed` rate | rotate/revoke sessions | `AT-B13AUTH-1…6` |
| Authorization bypass | any permission-gated command | 16-step pipeline, deny-by-default (`FI-B1-05`/`06`) | none added — enforcement contract restated (`B13_AUTHORIZATION_TENANCY.md`) | `authz.permission_denied` | patch + regression test | `AT-B13AUTHZ-1…5` |
| IDOR/BOLA | every workspace-owned object | Doctrine R-1 (`FI-B1-07`) | negative-control table (`B13_AUTHORIZATION_TENANCY.md` §10) | `authz.object_not_in_scope` | patch scoping defect | `AT-B13TEN-1…12` |
| Tenant breakout | cross-domain relationship refs | Doctrine R-2/R-3 | same | `authz.relationship_out_of_scope`/`.workspace_path_mismatch` | same | `AT-B13TEN-4` |
| Privilege escalation | role/permission state | rank guards, no self-promotion (`FI-B1-08`) | operator-tier separation (`B13_OPERATOR_MODEL.md`) | `authz.role_change_denied` | revoke, audit review | `AT-B13AUTHZ-*` |
| CSRF | session-authenticated state change | CSRF token + `SameSite=Lax` (`FI-B0-01`) | production CSRF cookie config | `security.csrf_rejected` | n/a — request rejected | `AT-B13CSRF-1…3` |
| Session theft/fixation | session cookie | rotation on login, `HttpOnly`+`Secure`, per-session revocation (`FI-B1-03`) | idle/absolute expiry defaults, revocation runbook | anomalous session pattern | `RevokeAllSessions` | `AT-B13SESS-*` |
| Webhook forgery | inbound provider callback | per-provider HMAC verification (`FI-B12-02`) | ingress gates, monitoring (`B13_WEBHOOK_SECURITY.md`) | `webhook_verification_failed_total` | none needed — rejected at the boundary | `AT-B13WH-1…10` |
| Replay | any signed/idempotent request | idempotency, dedup (`FI-B0-22`, `FI-B12-02`) | replay-eligibility computation (`FI-B12-06`) | duplicate-key detection | none — deduplicated | `AT-B13WH-5` |
| Duplicate execution | provider-side effect (message, charge) | write-before-call, unknown-outcome procedure (`FI-B12-08`) | reconciliation runbooks | `provider_unknown_outcomes_total` | reconcile via read-only lookup | `AT-B13PAY-3` |
| Injection | request/query construction | ORM parameterization (`FI-B0-02`) | none added | anomalous query pattern (rare) | patch | `AT-B13IO-*` |
| Stored XSS exposure | file downloads, free text | no rich text, active-content types excluded, `Content-Disposition: attachment` (`FI-B11-01`) | download-header discipline (`B13_FILE_SECURITY.md` §7) | n/a — structural | n/a | `AT-B13FILE-4` |
| Unsafe file upload | `FileAsset` | 10-gate validation, deterministic keys (`FI-B11-03`/`04`) | operational monitoring | `files_verification_failed_total` | reject at gate | `AT-B13FILE-1…3` |
| SSRF | any URL-fetching feature | no client-supplied URL fetched, except allow-listed `ImportFileFromUrl` (`FI-B11-01`) | acceptance control | n/a | n/a | `AT-B13IO-5` |
| Secret leakage | every credential class | `*_REF` indirection, never in DB/logs/DTOs (`FI-B12-04`) | full lifecycle contract (`B13_SECRETS_MANAGEMENT.md`) | secret-scanning pass | rotate immediately | `AT-B13SEC-1…8` |
| Log leakage | logs, Sentry, OTel | exhaustive redaction list (`FI-B0-06`, `FI-B12-01`) | production log contract (`B13_LOGGING_REDACTION.md`) | scanning audit | rotate any exposed secret; scrub retained logs where legally permitted | `AT-B13LOG-1…6` |
| Payment spoofing | `Payment`/`Subscription` state | webhook-first truth, redirect never mutates state (`FI-B8-01`) | Tap-specific operational posture (`B13_PAYMENT_FINANCIAL_SECURITY.md` §2) | `RECONCILIATION_MISMATCH` | `ReconcilePayment` | `AT-B13PAY-1…4` |
| Entitlement spoofing | `EntitlementDecision` | server-side five-step resolution, RBAC(8)→Entitlement(11) ordering (`FI-B1-05`) | none added | anomalous entitlement grant pattern | revoke override, audit | `AT-B13FIN-7` |
| Revenue spoofing | `RevenueEvent` | four structural mechanisms (`FI-B9-01`) | conjunctive money-gate, named-membership rule (`FI-B9-02`) | `attribution_integrity_failure_total` | compensating reversal | `AT-B13FIN-1…3` |
| Provider-cost abuse | shared global provider credential | per-workspace fairness budgets (`FI-B12-09`) | `B13_RATE_LIMIT_ABUSE_MODEL.md` §4 | budget-exhaustion signal | none needed — bounded by construction | `AT-B13RATE-6` |
| Queue abuse | Celery queues | queue isolation by workload class (`FI-B12-10`) | `B13_REDIS_CELERY_SECURITY.md` §5/§10 | `queue_delay_ms` | scale/patch poison task | `AT-B13CEL-6` |
| Denial of service | ingress endpoints, webhook path | ingress gates before HMAC (`FI-B12-02` §5) | rate-limit table (`B13_RATE_LIMIT_ABUSE_MODEL.md`) | rate-limit trip rate | reverse-proxy/WAF response (deployment layer) | `AT-B13RATE-11` |
| Race conditions | any concurrently-mutated row | row locks, `version`/`If-Match`, partial unique indexes (`FI-B0-24` ADR-010) | none added | `409 CONFLICT`/`STALE_VERSION` rate | retry with fresh version | `AT-B13CONC-1…3` |
| Stale worker writes | `worker_executions` | lease + fencing token (`FI-B12-01`, `B12-D-A055`) | `B13_REDIS_CELERY_SECURITY.md` §9 | heartbeat lapse | fresh lease claim | `AT-B13CEL-5` |
| Supply-chain compromise | dependency tree | none frozen — first addressed here | inventory + scanning policy (`B13_SUPPLY_CHAIN_SECURITY.md`) | scan finding | patch/mitigate | `AT-B13DEP-1…4` |
| Data exfiltration | Contact PII, financial data, file contents | masking, minimization, per-request re-authorization (`FI-B0-17`, `FI-B11-02`) | none added | anomalous export/download volume | revoke access, audit review | `AT-B13FILE-7` |
| Destructive admin action | workspace/member/dead-letter/reconciliation records | mandatory reason on abandon/dismiss (`FI-B12-06`/`07`) | two-step confirmation (`B13_OPERATOR_MODEL.md` §11) | audit review | n/a — records are append-only/tombstoned, not truly destroyed | `AT-B13OPS-3` |
| Unsafe reconciliation/replay | any reconciliation-repaired record | repair is always the owning domain's own guarded command (`FI-B12-07`, `B12-D-A039`) | operator-tier gating (`B13_OPERATOR_MODEL.md` §3) | replay-count anomaly | domain command's own guards refuse an unsafe repeat | `AT-B13OPS-4` |

## 4. Threat count

`THREAT_COUNT = 28` (§2's class list). `THREAT_ACTOR_COUNT = 16` (§1). Both are re-derived mechanically in `B13_VERIFICATION_MATRIX.md` §2.

## 5. No claim of perfect prevention

Every row above names a *defense*, not a guarantee. Several classes are explicitly bounded rather than eliminated: a compromised operator account (A11) can still act within `platform.operations.replay`'s scope until detected and revoked — the control is detection and blast-radius limitation (per-record re-guarding, mandatory reason, audit trail), not prevention of the credential compromise itself. A malicious workspace admin (A4) is bounded by the frozen matrix's "cannot bypass financial audit or tenant isolation" limit, but can still misuse whatever authority Admin genuinely holds — that is a business trust boundary, not a technical one this architecture can close further without changing the role's actual authority. This honesty is deliberate: a threat model that claims zero residual risk is not credible and is not what this pack asserts.
