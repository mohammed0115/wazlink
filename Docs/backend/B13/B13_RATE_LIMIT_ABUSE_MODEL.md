# B13 — Rate Limiting & Abuse Control Model

> Design only. Reconciles every frozen domain-specific budget (B3/B4/B5/B7/B8/B12) without overriding a single one. B13 adds **security-level** abuse controls that sit beside, never inside, the domain counters.

## 1. Four distinct counters — never merged

| Class | Question it answers | Authority | Owner |
|---|---|---|---|
| **Security rate limit** | "Is this caller behaving like an attacker (credential stuffing, scraping, mass invite)?" | Redis-accelerated, PostgreSQL-authoritative where quota-adjacent | This document |
| **Domain cost budget** | "How much of this workspace's plan-entitled usage remains?" | PostgreSQL, transactional (`usage_counters`, `discoveryRuns`, `aiAnalyses`) | The owning domain (B3/B4/B8) |
| **Provider rate limit** | "How much of the shared upstream provider's own quota is left?" | The provider itself; WazLink observes and backs off | `B12_RATE_LIMIT_BACKPRESSURE.md` |
| **Retry budget** | "How many more attempts may this specific failed operation take before dead-lettering?" | Frozen `BACKEND_RETRY_POLICY.md` classes, `B12_RETRY_BACKOFF_MODEL.md`'s six owners | The domain that owns the retryable operation |

A single request can be rejected by any of the four independently, and the rejection reason (`details.reason` or the safe error code) must let an operator tell which one tripped — never a generic "rate limited" that conflates abuse protection with plan enforcement (`FI-B0-20`: "Limits combine abuse protection, provider cost control, and entitlement quotas" as three named things, not one).

## 2. Security rate limits — production table

| Category | Limit | Key | Class |
|---|---:|---|---|
| Login | `10/min/IP` and `5/min/account` | IP + account | Frozen, `FI-B0-20` |
| Password reset / email verification request | per-IP and per-address, `202` regardless of match (anti-enumeration) | IP + address | Frozen, `FI-B1-03` §3.5 |
| Invitation accept (token guess) | per-IP | IP | Frozen, `FI-B1-09` T10 |
| Workspace switch | per-session, bounds existence-oracle probing | session | Frozen, `FI-B1-09` T21 |
| General API | `300/min/workspace` | workspace + user | Frozen, `FI-B0-20` |
| Export | `10/hour/workspace` | workspace + user | Frozen, `FI-B0-20` |
| Admin repair (dead-letter replay, reconciliation resolve) | `30/hour/operator` | operator | Frozen, `FI-B0-20` |
| Webhook ingress | provider-specific burst protection, before HMAC (`B12-AM-008`) | provider + endpoint | `FI-B12-02` §5 |
| Provider health/config test | bounded to prevent config-check abuse against a shared global credential | workspace (for workspace-scoped) / operator (for global-scoped) | B13-D-B015, Class B |

All numeric values above the frozen rows are **proposed Class B defaults**, calibrated in staging per `FI-B0-20`'s own instruction ("must be calibrated in staging"), never presented as guarantees.

## 3. Domain cost budgets — reused, not redecided

| Domain | Budget | Source |
|---|---:|---|
| Discovery submit | `10/hour/workspace` job creation; `MAX_JOB_ATTEMPTS=3`; `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR=10` | `FI-B3-01` |
| AI analysis | `60/hour/workspace` admissions; `MAX_BATCH_SIZE=20`; `MAX_RUN_ATTEMPTS=3` | `FI-B4-01` |
| Messaging send | `300/hour/workspace` plus quota (`B5-D-A028`) | `FI-B5-04` |
| Automation execution | `MAX_AUTOMATION_DEPTH=5`; 20 runs/5-min rolling window per correlation lineage | `FI-B7-03` |
| Payment initiation | `10/hour/workspace` and `3/min/user` | `FI-B0-20` |

B13 does not adjust any figure in this table. `B13_FROZEN_INPUT_INVENTORY.md` §4 is the traceability anchor for each.

## 4. Provider rate limits — observed, not owned

Google Places is per-API-method-per-project (`B12-X-009`, `FI-B12-12`); a shared global credential means per-workspace **fairness** budgeting is a WazLink-side abuse control layered on top of the provider's own ceiling (`B12_RATE_LIMIT_BACKPRESSURE.md` §5), distinct from the domain cost budget in §3. Meta and Tap's own throughput/quality-rating limits are provider-side and observed via `provider_rate_limited_total{provider}`; WazLink never invents a number the provider has not documented.

## 5. Retry budgets — six counters, six owners

Restated from `FI-B12-11`/`B12_RETRY_BACKOFF_MODEL.md`: automatic transient retry (frozen 5/6-attempt classes) is architecturally distinct from an actor-triggered retry and never increments a domain's own attempt counter (`B3-D-A031`, `FI-B3-01`). The rule that binds them: `MIN(frozen_class_max, domain_budget_remaining)` — a generic worker retry can never silently exceed a domain's own frozen ceiling.

## 6. Loop-prevention as an abuse control

Automation's lineage + same-rule-suppression + depth bound + execution-budget combination (`FI-B7-03`) is itself an abuse control against a specific attack class (rule-authored infinite loops) that a flat rate limit cannot catch, because the requests are legitimate individually and only pathological in aggregate lineage. B13 treats this as the model for any future feature with the same shape (a user-authored rule that can trigger itself) — never relying on depth alone, per `B7-D-A026`'s own stated reasoning.

## 7. Fail behavior and observability

Every rate-limit rejection returns `429` with `Retry-After` and a safe error code (`FI-B0-18`). Security-triggered limits additionally write `security.rate_limited`; sustained triggering from one account or IP across the login/reset endpoints escalates to `security.credential_stuffing_suspected` (`FI-B1-09` T19). Observability: per-category trip-rate counters (never a workspace ID or user ID as a metric label — `FI-B12-05`'s cardinality discipline extends here).

## 8. Abuse controls for surfaces the brief specifically names

| Surface | Control |
|---|---|
| Login attempts | §2 |
| Invitation endpoints | §2 (accept-token guess); creation itself is bounded by `member.invite` RBAC, not a separate rate limit |
| Password/auth endpoints | §2 |
| Expensive searches (Discovery, CRM list) | domain cost budget (§3) plus general-API limit (§2) |
| AI execution | §3 |
| Messaging | §3 |
| Provider health/config test | §2 |
| File upload | `B13_FILE_SECURITY.md` §2 (size/quota ceilings) plus general-API limit |
| Webhook ingress | `B13_WEBHOOK_SECURITY.md` §3 |
| Operator replay | §2 (admin repair) |
| Reconciliation | operator-gated, no separate rate limit needed beyond `platform.operations.replay` RBAC |
| Billing-sensitive endpoints | §3 (payment initiation) |

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13RATE-1` | A security rate-limit trip and a domain-quota exhaustion on the same request produce distinguishable error reasons |
| `AT-B13RATE-2` | Exceeding `300/min/workspace` general API limit returns `429` without touching any domain-specific quota counter |
| `AT-B13RATE-3` | An automatic transient retry never increments `discoveryRuns`/`aiAnalyses`/any domain attempt counter |
| `AT-B13RATE-4` | A generic worker retry is capped at `MIN(frozen_class_max, domain_budget_remaining)`, verified against at least one domain whose remaining budget is below the frozen class max |
| `AT-B13RATE-5` | Automation loop prevention blocks a same-rule re-entrant chain at depth ≤5 regardless of execution-budget headroom |
| `AT-B13RATE-6` | A shared global provider credential's per-workspace fairness budget prevents one workspace from exhausting another's share |
| `AT-B13RATE-7` | Login rate-limit trips independently on IP and on account, from rotating source IPs |
| `AT-B13RATE-8` | Password-reset request rate limiting never reveals whether the submitted address exists |
| `AT-B13RATE-9` | Admin repair rate limit (`30/hour/operator`) is scoped per operator, not per workspace |
| `AT-B13RATE-10` | Sustained low-rate distributed login attempts across many accounts trigger `security.credential_stuffing_suspected` |
| `AT-B13RATE-11` | Webhook ingress rate gate runs before HMAC computation |
| `AT-B13RATE-12` | Every `429` response carries `Retry-After` |
