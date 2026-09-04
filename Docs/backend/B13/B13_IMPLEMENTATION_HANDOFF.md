# B13 — Implementation Handoff

> **B13 is design-only and grants no implementation authorization.** This document states what an implementation agent would need and what must be approved first, mirroring `B12_IMPLEMENTATION_HANDOFF.md`'s structure one phase forward.

## 1. Pre-implementation gate

| # | Gate | Owner | Status |
|---:|---|---|---|
| 1 | Approve `B13_CONTROLLED_AMENDMENTS.md` (0 items — nothing to approve, but the zero-count itself should be countersigned so a future reviewer does not assume it was skipped) | CTO | open |
| 2 | Resolve every Class C item in `B13_DECISION_REGISTER.md` §3 that blocks a specific implementation step (MFA is non-blocking; data-locality/retention/notification-timing block only the specific features that depend on them, never the whole build) | Product/Legal/Operations | open |
| 3 | Select the secret-store product (`B13-D-C003`) | Platform | open |
| 4 | Select the reverse-proxy/orchestrator and confirm the header-forwarding guarantee `B13_DEPLOYMENT_SECURITY.md` §3 depends on | Platform | open |
| 5 | Establish the current frontend dependency vulnerability baseline — run the repository's own package-manager audit (`pnpm audit`-class, against the already-committed `pnpm-lock.yaml`) and triage the result per `B13_SUPPLY_CHAIN_SECURITY.md` §4. No lockfile needs generating; the gate is the unrun scan, not a missing lockfile | Platform/Frontend | open |
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
| Async security (Redis, Celery, outbox, worker execution) | PostgreSQL is durable authority and Redis never is; five frozen queues; JSON-only task serialization; task payloads carry references re-read at execution time; outbox-only lease fencing; heartbeat-stale `worker_executions` classified `unknown` and never auto-re-executed — `B13_REDIS_CELERY_SECURITY.md`, with the database half in `B13_DATABASE_SECURITY.md` §§5–6 |
| Financial authority | domain-command-only writers, conjunctive money-gate, named-membership-only financial rows — `B13_PAYMENT_FINANCIAL_SECURITY.md` |
| Operators | `platform.operations.view`/`.replay`, mandatory-reason gates, superuser is not a business-authorization path — `B13_OPERATOR_MODEL.md` |
| Logs | structured fields, exhaustive redaction list, allow-list-at-write enforcement — `B13_LOGGING_REDACTION.md` |
| Monitoring | bounded-cardinality signal set, alert→severity→owner→runbook bindings — `B13_OBSERVABILITY.md` |
| Health/readiness | three-tier model, never provider-dependent for liveness/readiness — `B13_HEALTH_READINESS.md` |
| Incidents | four-tier severity, per-class detection/containment/recovery — `B13_INCIDENT_MANAGEMENT.md` |
| Backups/restores | daily full + WAL, monthly restore test (proposed cadences) — `B13_BACKUP_RESTORE.md` |
| Disaster recovery | authority-before-derived-execution ordering — `B13_DISASTER_RECOVERY.md` |
| Dependency vulnerabilities | inventory + scanning + severity-triage policy applied to the committed `pnpm-lock.yaml` resolved tree; the current vulnerability baseline is explicitly unrun, not claimed remediated — `B13_SUPPLY_CHAIN_SECURITY.md` |
| Fail-closed configuration | security-critical config fails closed at startup; optional-provider config fails open at the app level, closed only for that feature — `B13_CONFIGURATION_MANAGEMENT.md` §4 |
| Environment-specific decisions | `B13_ENVIRONMENT_STRATEGY.md`, `B13_DECISION_REGISTER.md` §2 |

## 3. Readiness by concern

| Concern | State | Evidence |
|---|---|---|
| `AUTHENTICATION_READY` | READY | frozen B1 mechanism + production cookie settings; CSRF corrected under the final repair to keep the frozen cookie/header pair readable by the SPA, and the password policy re-derived against current NIST SP 800-63B-4 |
| `SESSION_REVOCATION_READY` | READY | full trigger table; the self-scoped surface is now stated correctly — operator containment routes through the frozen `DisableUser`/targeted-revocation paths, never through the self-scoped `RevokeAllSessions`, and `SECRET_KEY` rotation has a real procedure (`B13_SECRETS_MANAGEMENT.md` §7a) |
| `AUTHORIZATION_READY` | READY | 16-step pipeline restated, negative-control table |
| `TENANT_ISOLATION_READY` | READY | Doctrine R-1/R-2/R-3, 12-row cross-tenant negative-control table |
| `SECRETS_READY` | READY (mechanism, now including rotation for all nine classes) / **CONDITIONAL** (product choice, gate 3) | `*_REF` contract fixed; §7a/§7b close the platform-substrate and observability rotation gaps; store product open |
| `WEBHOOK_SECURITY_READY` | READY | per-provider verification, with the gateway trust boundary now truthfully anchored (`FI-B12-17`); proven necessary and specified by primary-source research (inherited) |
| `FILE_SECURITY_READY` | READY | 10-gate validation, deterministic keys; billing-boundary and storage-provider clauses now cite their real frozen sources (`FI-B11-06`, `FI-B11-07`) |
| `PAYMENT_FINANCIAL_READY` | READY | firewall proofs inherited; the conjunctive money-gate is restored to its frozen B9 scope, so B8 billing surfaces remain `billing.view`-gated and are not swept into a global Money prohibition |
| `ASYNC_SECURITY_READY` | READY | **Added under `B13-FIX.2`**; the pack previously carried no readiness row and no build-list pointer for the async domain at all, while a frozen-contract contradiction was live inside it. Nine obligations, each traced: PostgreSQL durable authority and Redis non-authority (`B13_REDIS_CELERY_SECURITY.md` §1, `FI-B0-16`); network isolation and broker authentication (§§2–4); five frozen queues, no business-named queue (§5, `FI-B12-10`); JSON-only serialization, no pickle (§7, `B13-X-007`); task payloads carry references re-read at execution time, never cached decisions (§7, `FI-B12-05`); **outbox-specific** `lease_token` fencing, scoped to `outbox_events` only (§9, `B12-D-A055`); **`worker_executions` has no lease or fence** — a heartbeat-stale `running` row is classified `unknown` by reconciliation class `P-3`, operator-gated and never auto-repaired (§9, `FI-B12-07`); **no non-idempotent effect in `unknown` is ever retried**, with no override flag, permission, or configuration (§9, `B12-D-A020`); poison-task bounding and dead-letter/replay boundaries, with replay reason-gated and re-running every original guard (§§8, 11, `B13_OPERATOR_MODEL.md` §6a, `FI-B12-06`). Verified by `AT-B13CEL-1`…`7` and `B13-F-09`. **READY is claimed only because the `B13-FIX.2` regression proves the stale fresh-lease model is gone pack-wide** — it was not READY before that repair |
| `OPERATOR_MODEL_READY` | READY | permission separation, mandatory-reason gates |
| `LOGGING_READY` | READY | exhaustive redaction list, allow-list enforcement |
| `OBSERVABILITY_READY` | READY (signals) / **CONDITIONAL** (vendor/backend product choice) | signal set fixed; backend product open |
| `HEALTH_READY` | READY | three-tier model, never provider-dependent |
| `INCIDENT_READY` | READY | severity model, per-class procedure |
| `BACKUP_DR_READY` | READY (mechanism, now including backup **monitoring**) / proposed targets require Product/Operations approval | frozen B0's fourth backup requirement is realized in `B13_BACKUP_RESTORE.md` §5a with a paging alert and `AT-B13BAK-6`; RPO/RTO explicitly marked proposed |
| `SUPPLY_CHAIN_READY` | READY (policy + pinning) / **CONDITIONAL** (current vulnerability baseline unrun, gate 5) | pnpm declared and version-pinned, `pnpm-lock.yaml` committed since the initial commit, CI `--frozen-lockfile` enforced; policy complete in `B13_SUPPLY_CHAIN_SECURITY.md` §§2–4. Only the first audit run and its triage remain, and that is execution work, not a design gap |
| `DEPLOYMENT_SECURITY_READY` | READY (contract) / **CONDITIONAL** (proxy/orchestrator product choice, gate 4) | trust boundary fixed; product open |
| `CONFIGURATION_MANAGEMENT_READY` | READY | fail-open/fail-closed boundary explicit |
| `B14_HANDOFF_READY` | READY | `B13_B14_BOUNDARY.md` |

## 4. Why the CONDITIONAL items do not block Phase-1 architecture

Three of the four CONDITIONAL items gate a **product choice**, not a design decision: the secret-store, the observability backend, and the reverse-proxy/orchestrator are all interchangeable behind the contracts B13 fixes (the `*_REF` interface, the bounded-cardinality signal set, the header-forwarding trust rule respectively). The fourth, `SUPPLY_CHAIN_READY`, is a different and even weaker kind of conditional: an **unrun operational check**. Its design is complete and its version pinning is already enforced in the repository today; what is outstanding is executing the first dependency audit, which by definition cannot happen inside a documentation-only phase and whose result changes no B13 document — only the triage backlog. Whichever product `B14` selects, no B13 document changes — this is the identical shape `B12_IMPLEMENTATION_HANDOFF.md` used for its own one CONDITIONAL item (the scraping-provider verification scheme, `FI-B12-13`'s "the route and pipeline shape are fixed; only the verification scheme is open").

## 5. Implementation sequence (informative)

1. Fix `SECRET_KEY`, `ALLOWED_HOSTS`, `DEBUG=False`, and startup fail-closed validation first — every other control assumes a correctly configured process.
2. Session/authentication/authorization pipeline — the foundation every domain's own RBAC check depends on.
3. Logging/redaction discipline, wired in from the start rather than retrofitted (a redaction rule added after logging is already shipped is a much larger, riskier change).
4. Webhook verification per provider, following B12's own sequence (Meta first, Tap second, deliberately, to prove the per-provider design rather than a generic one).
5. File security gates.
6. Financial-authority permission wiring (conjunctive money-gate, named-membership enforcement).
7. Async execution substrate — queue topology, JSON serialization, outbox dispatch with its fencing token, and the unknown-outcome/reconciliation path — before any provider-effecting task is scheduled (`B13_REDIS_CELERY_SECURITY.md`).
8. Observability signal emission, bound to the alert table in `B13_OBSERVABILITY.md` §4.
9. Backup/restore pipeline, tested before the first production cutover, not after.
10. Runbooks rehearsed (at minimum the database-restore and webhook-outage runbooks) before go-live.

## 6. What an implementation agent must NOT do

Extending `FI-B12-14`'s list with B13-specific prohibitions: weaken any secure cookie flag for convenience; log or return a value from `B13_LOGGING_REDACTION.md` §2's list under any verbosity level; treat a Redis-only counter as authoritative for a security or financial decision; invent a lease, lease-owner, or fencing-token column on `worker_executions` — frozen `worker_executions` **has no lease or fencing column**, and that fence belongs to `outbox_events` alone (`B12-D-A055`); re-execute a heartbeat-stale `worker_executions` row, or retry any non-idempotent operation whose outcome is `unknown`, under any flag, permission, or configuration (`B12-D-A020`); skip the startup fail-closed check for a security-critical configuration value "temporarily" during a deploy; grant a workspace role authority over a global-scope integration; resolve an ambiguous financial/tax outcome by anything other than the domain's own guarded command; replay a dead letter without re-running every original guard; treat a restored-but-never-tested backup as reliable; disable webhook signature verification "to unblock" an incident.

## 7. Scope statement

Zero B0–B12 file is modified. Zero frontend file is created, modified, or deleted. Zero Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, secret value, Dockerfile, or infrastructure-as-code file is written. Zero `Docs/backend/B14` file exists — confirmed by directory listing during this pass (`B14_FILES_CREATED = 0`).
