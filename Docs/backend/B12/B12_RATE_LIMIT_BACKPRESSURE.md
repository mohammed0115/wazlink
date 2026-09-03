# B12 — Rate Limiting & Backpressure

> Design only. Reuses frozen `BACKEND_RATE_LIMIT_POLICY.md` and adds one additive row; the durable-vs-Redis split is `B12_REDIS_BOUNDARY.md` §4.

## 1. Six layers

| # | Layer | Key | Store | Nature |
|---:|---|---|---|---|
| 1 | Public API / user | IP + account, workspace + user | Redis | abuse |
| 2 | Workspace | workspace | Redis | abuse |
| 3 | **Domain budget** | the domain's own aggregate | **PostgreSQL** | **business** |
| 4 | Provider account | provider + credential | Redis (shaping) + provider's own limits | cost |
| 5 | Endpoint / action | route | Redis | abuse |
| 6 | **Webhook ingress** | provider route | Redis | abuse (`B12-AM-008`) |

> **Layer 3 is the only one that is business truth, and it is the only one in PostgreSQL.** That is not a coincidence — it is `B12-D-A015`'s test applied.

## 2. Frozen rows, reused

`BACKEND_RATE_LIMIT_POLICY.md`'s eight rows are adopted unchanged (Login/reset, General API, Discovery submit, AI analysis, Export, Webhooks, Payment initiation, Admin repair). B12 adds exactly one — *"Webhook ingress | per-provider-route burst ceiling | provider route + source"* (`B12-AM-008`) — because the frozen "Webhooks | provider-specific burst protection" row names the concern without a key, and an unauthenticated ingress path needs a ceiling *before* HMAC work (`B12_WEBHOOK_SECURITY.md` §5).

## 3. Domain budgets B12 must never bypass

| Budget | Value | Owner | Store |
|---|---|---|---|
| `MAX_JOB_ATTEMPTS` | 3 per Discovery Job | B3 (`B3-D-A031`) | `discovery_jobs.attempt_no` |
| `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR` | 10 | B3 (`B3-D-A032`) | durable admission record |
| `MAX_NEW_DISCOVERY_JOBS_PER_WORKSPACE_PER_HOUR` | 10 | B3 (`B3-D-A018`) | durable |
| combination × page ceiling | 50 × 5 = 250 calls per attempt | B3 (`B3-INV-11`) | durable |
| AI logical + provider call budgets | B4's own maxima | B4 | durable |
| B8 metered quotas | 5 frozen metrics | B8 | `usage_counters` |

> **`B12-D-A038`. A worker, retry, backpressure release, or operator replay may never cause one of these to be exceeded.** Concurrency is not an excuse: two workers racing must not admit two units where one remained, so admission is a transactional reservation under a row lock — the mechanism `B8_USAGE_QUOTA_MODEL.md` froze and `B11_STORAGE_USAGE_MODEL.md` §4 mirrored. `RATE_LIMIT_BUDGET_GAPS = 0`; negative controls `AT-B12RL-4`…`7`.

## 4. Backpressure

| Signal | Response |
|---|---|
| Provider `429` with `Retry-After` | defer the whole affected class until the header's instant; do not merely delay one task |
| Sustained provider failure | `degraded` (`B12_INTEGRATION_HEALTH_MODEL.md` §4); increased backoff; alert |
| Provider unreachable | attempts continue under the frozen 5-attempt bound, then dead-letter |
| Provider disabled | fail fast at admission — `409 CONFLICT` · `provider_disabled`. **No queue growth**, and no provider call |
| Worker backlog high | queue isolation already confines it (`B12_QUEUE_TOPOLOGY.md` §3); depth is a B13 alert signal |

**Fail fast at admission, rather than queueing.** Queueing work for a provider we know is off converts a visible error into an invisible backlog that will later stampede. The frozen posture matches: `B5_ADMIN_PROVIDER_RUNBOOK.md` has new sends *"fail fast at admission… (`provider_disabled`)"* while in-flight work completes.

## 5. Fairness

Per-workspace ceilings mean a single noisy workspace cannot consume a shared global provider quota. This matters most for the **global-scope** providers (Places, AI, storage) where one credential is shared: without per-workspace accounting, one tenant's burst is every tenant's outage. `CROSS_TENANT_INTEGRATION_GAPS = 0` depends partly on this; negative control `AT-B12TEN-5`.

## 6. Concurrency of the limiter itself

Redis-backed abuse counters are best-effort and may over-admit slightly under a race — acceptable by definition for layer 1/2/5/6. Durable budgets (layer 3) are **never** best-effort: they serialize on a row lock and are exact. The two mechanisms are never substituted for one another (`B12-D-A015`).
