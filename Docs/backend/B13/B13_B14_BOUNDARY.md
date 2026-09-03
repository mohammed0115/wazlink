# B13 — B13/B14 Boundary

> Design only. Fixes exactly what B13 freezes for B14 to assemble into the implementation master pack, and what B13 explicitly does not decide. Mirrors the discipline `B12_B13_BOUNDARY.md` already used one phase back (`FI-B12-13`).

## 1. What B14 receives from B13

| Contract | Where |
|---|---|
| Security invariants | `B13_SECURITY_PRINCIPLES.md`, `B13_DJANGO_DRF_SECURITY_BASELINE.md` |
| Operational invariants | `B13_HEALTH_READINESS.md`, `B13_REDIS_CELERY_SECURITY.md`, `B13_DATABASE_SECURITY.md` |
| Deployment security assumptions | `B13_DEPLOYMENT_SECURITY.md` |
| Configuration classes | `B13_CONFIGURATION_MANAGEMENT.md`, `B13_ENVIRONMENT_STRATEGY.md` |
| Secrets contract | `B13_SECRETS_MANAGEMENT.md` |
| Audit contract | `B13_AUDIT_LOGGING.md` |
| Observability contract | `B13_OBSERVABILITY.md`, `B13_LOGGING_REDACTION.md` |
| Backup/restore strategy | `B13_BACKUP_RESTORE.md` |
| Incident model | `B13_INCIDENT_MANAGEMENT.md`, `B13_DISASTER_RECOVERY.md` |
| Runbooks | `B13_RUNBOOKS.md` |
| Acceptance controls | `B13_ACCEPTANCE_TESTS.md` |
| Implementation constraints | `B13_IMPLEMENTATION_HANDOFF.md` |
| Unresolved deployment/business/legal decisions | `B13_DECISION_REGISTER.md` §3 (Class C) |

## 2. What B13 deliberately does not decide

Restated from the brief's own instruction and consistent with every prior phase's "what this pack leaves to the next" discipline:

- **Exact numeric production values** for every Class B decision (`B13_DECISION_REGISTER.md` §2) — rate-limit figures beyond the frozen table, HSTS escalation timing, backup cadence, restore-test cadence, alert thresholds, log-sampling rates. B13 fixes the *mechanism and the shape of the value*; `B14`/operations tunes the number.
- **Secret-store product choice** (`B13-D-C003`) and its exact at-rest guarantee.
- **Reverse-proxy/orchestrator product and manifest syntax** — `B13_DEPLOYMENT_SECURITY.md` fixes the trust contract, not the Terraform/Kubernetes/Docker files.
- **Worker counts, prefetch multipliers, autoscaling thresholds** — already explicitly out of scope per `FI-B12-13`, and B13 does not pull them in either.
- **Dashboard layout** — `B13_OBSERVABILITY.md` §6 fixes only that every alert needs a panel, not the panel's design.
- **Legal/business retention and notification decisions** (`B13_DECISION_REGISTER.md` §3, in full).
- **MFA, custom roles, per-workspace restore granularity, published SLO** — every Class C item is a real open question, not a hidden implementation detail.

## 3. B13 does not start implementation planning beyond what is required to make these contracts executable

Every acceptance control in `B13_ACCEPTANCE_TESTS.md` is a testable assertion, not a test-suite implementation. Every runbook in `B13_RUNBOOKS.md` is a decision procedure, not a paged escalation-tool configuration. No Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, provider SDK call, Dockerfile, or infrastructure-as-code file is authored anywhere in this pack — matching the identical scope statement B12 closed with (`FI-B12-14`).

## 4. B14 owns assembly

B14's task is to take B0–B13 as a closed set of contracts and produce the implementation master pack — the concrete Django project structure, the exact settings module, the exact CI/CD pipeline, the exact infrastructure-as-code, and the exact tuned values for every Class B decision this pack left open. B13 grants B14 no shortcut to skip re-verifying the four load-bearing provider facts B12 already flagged (`FI-B12-12`'s re-verification gate) or to invent a security control this pack did not name.

## 5. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13BOUND-1` | Every B14 implementation decision traces to either a B13 contract (§1) or an explicit Class B/C decision this pack left open (§2) — no implementation choice is made without a named source |
| `AT-B13BOUND-2` | `B14_FILES_CREATED = 0` and `IMPLEMENTATION_LEAKAGE = 0` for this B13 pass, verified in `B13_VERIFICATION_MATRIX.md` §4 |
