# B13 — Implementation Handoff

> **B13 is design-only and grants no implementation authorization.** This document states what an implementation agent would need and what must be approved first, mirroring `B12_IMPLEMENTATION_HANDOFF.md`'s structure one phase forward.

## 1. Pre-implementation gate

| # | Gate | Owner | Status |
|---:|---|---|---|
| 1 | Approve `B13_CONTROLLED_AMENDMENTS.md` (0 items — nothing to approve, but the zero-count itself should be countersigned so a future reviewer does not assume it was skipped) | CTO | open |
| 2 | Resolve every Class C item in `B13_DECISION_REGISTER.md` §3 that blocks a specific implementation step (MFA is non-blocking; data-locality/retention/notification-timing block only the specific features that depend on them, never the whole build) | Product/Legal/Operations | open |
| 3 | Select the secret-store product (`B13-D-C003`) | Platform | open |
| 4 | Select the reverse-proxy/orchestrator and confirm the header-forwarding guarantee `B13_DEPLOYMENT_SECURITY.md` §3 depends on | Platform | open |
| 5 | Generate and commit the frontend lockfile, closing the `B13_SUPPLY_CHAIN_SECURITY.md` §1 gap | Platform/Frontend | open |
| 6 | Confirm the four B12 load-bearing provider facts are still current (`FI-B12-12`'s re-verification gate) — B13 does not re-verify them itself, it inherits the gate | Backend/Platform | open |
| 7 | Independent CTO countersign of this pack | CTO | not granted |

## 2. What to build — the concrete answer list

| Question | Answer |
|---|---|
| Authentication | Django session backend, `B1_AUTH_SESSION_DESIGN.md` flow, production cookie/CSRF settings in `B13_DJANGO_DRF_SECURITY_BASELINE.md` §6 |
| Session revocation | `sessions` registry row, idle/absolute dual expiry, per-session and global revocation surfaces — `B13_AUTHENTICATION_SESSION_SECURITY.md` |
| Tenant isolation | Doctrine R-1/R-2/R-3 queryset scoping, enforced at every domain manager's entry point — `B13_AUTHORIZATION_TENANCY.md` |
| Authorization | the 16-step pipeline, permission catalog, role matrix — inherited verbatim from B1, restated for production in `B13_AUTHORIZATION_TENANCY.md` |
| CSRF/CORS/cookies | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §§3, 6, 7 |
| Secrets | `*_REF` indirection, secret-management layer (product TBD), rotation/revocation procedure — `B13_SECRETS_MANAGEMENT.md` |
| Webhooks | per-provider verification (Meta raw-body HMAC, Tap field-concatenation HMAC), tenant binding from verified secret — `B13_WEBHOOK_SECURITY.md` |
| Files | 10-gate validation, deterministic keys, per-request re-authorization — `B13_FILE_SECURITY.md` |
| Financial authority | domain-command-only writers, conjunctive money-gate, named-membership-only financial rows — `B13_PAYMENT_FINANCIAL_SECURITY.md` |
| Operators | `platform.operations.view`/`.replay`, mandatory-reason gates, superuser is not a business-authorization path — `B13_OPERATOR_MODEL.md` |
| Logs | structured fields, exhaustive redaction list, allow-list-at-write enforcement — `B13_LOGGING_REDACTION.md` |
| Monitoring | bounded-cardinality signal set, alert→severity→owner→runbook bindings — `B13_OBSERVABILITY.md` |
| Health/readiness | three-tier model, never provider-dependent for liveness/readiness — `B13_HEALTH_READINESS.md` |
| Incidents | four-tier severity, per-class detection/containment/recovery — `B13_INCIDENT_MANAGEMENT.md` |
| Backups/restores | daily full + WAL, monthly restore test (proposed cadences) — `B13_BACKUP_RESTORE.md` |
| Disaster recovery | authority-before-derived-execution ordering — `B13_DISASTER_RECOVERY.md` |
| Dependency vulnerabilities | inventory + scanning + severity-triage policy, current lockfile gap flagged — `B13_SUPPLY_CHAIN_SECURITY.md` |
| Fail-closed configuration | security-critical config fails closed at startup; optional-provider config fails open at the app level, closed only for that feature — `B13_CONFIGURATION_MANAGEMENT.md` §4 |
| Environment-specific decisions | `B13_ENVIRONMENT_STRATEGY.md`, `B13_DECISION_REGISTER.md` §2 |

## 3. Readiness by concern

| Concern | State | Evidence |
|---|---|---|
| `AUTHENTICATION_READY` | READY | frozen B1 mechanism + production cookie/CSRF settings |
| `SESSION_REVOCATION_READY` | READY | full trigger table, self-scoped surface |
| `AUTHORIZATION_READY` | READY | 16-step pipeline restated, negative-control table |
| `TENANT_ISOLATION_READY` | READY | Doctrine R-1/R-2/R-3, 12-row cross-tenant negative-control table |
| `SECRETS_READY` | READY (mechanism) / **CONDITIONAL** (product choice, gate 3) | `*_REF` contract fixed; store product open |
| `WEBHOOK_SECURITY_READY` | READY | per-provider verification proven necessary and specified by primary-source research (inherited) |
| `FILE_SECURITY_READY` | READY | 10-gate validation, deterministic keys |
| `PAYMENT_FINANCIAL_READY` | READY | firewall proofs inherited, conjunctive money-gate |
| `OPERATOR_MODEL_READY` | READY | permission separation, mandatory-reason gates |
| `LOGGING_READY` | READY | exhaustive redaction list, allow-list enforcement |
| `OBSERVABILITY_READY` | READY (signals) / **CONDITIONAL** (vendor/backend product choice) | signal set fixed; backend product open |
| `HEALTH_READY` | READY | three-tier model, never provider-dependent |
| `INCIDENT_READY` | READY | severity model, per-class procedure |
| `BACKUP_DR_READY` | READY (mechanism) / proposed targets require Product/Operations approval | RPO/RTO explicitly marked proposed |
| `SUPPLY_CHAIN_READY` | **CONDITIONAL** | lockfile gap must close before scanning can run (gate 5) |
| `DEPLOYMENT_SECURITY_READY` | READY (contract) / **CONDITIONAL** (proxy/orchestrator product choice, gate 4) | trust boundary fixed; product open |
| `CONFIGURATION_MANAGEMENT_READY` | READY | fail-open/fail-closed boundary explicit |
| `B14_HANDOFF_READY` | READY | `B13_B14_BOUNDARY.md` |

## 4. Why the CONDITIONAL items do not block Phase-1 architecture

Each CONDITIONAL item gates a **product choice**, not a design decision: the secret-store, the observability backend, and the reverse-proxy/orchestrator are all interchangeable behind the contracts B13 fixes (the `*_REF` interface, the bounded-cardinality signal set, the header-forwarding trust rule respectively). Whichever product `B14` selects, no B13 document changes — this is the identical shape `B12_IMPLEMENTATION_HANDOFF.md` used for its own one CONDITIONAL item (the scraping-provider verification scheme, `FI-B12-13`'s "the route and pipeline shape are fixed; only the verification scheme is open").

## 5. Implementation sequence (informative)

1. Fix `SECRET_KEY`, `ALLOWED_HOSTS`, `DEBUG=False`, and startup fail-closed validation first — every other control assumes a correctly configured process.
2. Session/authentication/authorization pipeline — the foundation every domain's own RBAC check depends on.
3. Logging/redaction discipline, wired in from the start rather than retrofitted (a redaction rule added after logging is already shipped is a much larger, riskier change).
4. Webhook verification per provider, following B12's own sequence (Meta first, Tap second, deliberately, to prove the per-provider design rather than a generic one).
5. File security gates.
6. Financial-authority permission wiring (conjunctive money-gate, named-membership enforcement).
7. Observability signal emission, bound to the alert table in `B13_OBSERVABILITY.md` §4.
8. Backup/restore pipeline, tested before the first production cutover, not after.
9. Runbooks rehearsed (at minimum the database-restore and webhook-outage runbooks) before go-live.

## 6. What an implementation agent must NOT do

Extending `FI-B12-14`'s list with B13-specific prohibitions: weaken any secure cookie flag for convenience; log or return a value from `B13_LOGGING_REDACTION.md` §2's list under any verbosity level; treat a Redis-only counter as authoritative for a security or financial decision; skip the startup fail-closed check for a security-critical configuration value "temporarily" during a deploy; grant a workspace role authority over a global-scope integration; resolve an ambiguous financial/tax outcome by anything other than the domain's own guarded command; replay a dead letter without re-running every original guard; treat a restored-but-never-tested backup as reliable; disable webhook signature verification "to unblock" an incident.

## 7. Scope statement

Zero B0–B12 file is modified. Zero frontend file is created, modified, or deleted. Zero Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, secret value, Dockerfile, or infrastructure-as-code file is written. Zero `Docs/backend/B14` file exists — confirmed by directory listing during this pass (`B14_FILES_CREATED = 0`).
