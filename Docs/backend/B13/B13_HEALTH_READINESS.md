# B13 — Health & Readiness

> Design only. Preserves `FI-B0-12` (`/health/live` process-only, `/health/ready` PostgreSQL+Redis+migration compatibility, not blocked on optional providers) verbatim. B13 fixes the exact boundary between what affects liveness, readiness, degraded status, and provider-specific health.

## 1. The three tiers

| Tier | Endpoint | Checks | Failure meaning |
|---|---|---|---|
| **Liveness** | `GET /api/v1/health/live` | process responds at all | restart the process — it is deadlocked or unresponsive |
| **Readiness** | `GET /api/v1/health/ready` | PostgreSQL connectivity, Redis connectivity, migration compatibility (`FI-B0-12`) | remove from load-balancer rotation — it cannot correctly serve traffic yet, but does not need a restart |
| **Provider-specific health** | `GET /integrations` (authenticated, per-workspace/global) | per-provider `IntegrationConnection.status`/`credential_valid`/`last_verified_at` (`FI-B12-03`) | informational — never affects liveness or readiness |

## 2. Both frozen unauthenticated probes stay exactly that

`FI-B0-19`: exactly three unauthenticated operations exist — `login`, `health/live`, `health/ready`. B13 adds no fourth. The two health probes are "internal" in the catalog sense of being restricted by network/deployment policy (reachable only by the load balancer/orchestrator, not the public internet), not by session authentication (`FI-B0-19`).

## 3. What must never make liveness or readiness fail

> **Liveness MUST NOT fail merely because an external provider is unavailable.**

| Condition | Affects liveness? | Affects readiness? | Affects degraded status? |
|---|---|---|---|
| Process deadlocked/unresponsive | yes | yes (transitively) | — |
| PostgreSQL unreachable | no | **yes** | yes |
| Redis unreachable | no | **yes** | yes |
| Pending migration incompatible with running code | no | **yes** | yes |
| WhatsApp/Meta unavailable | no | no | yes — reported via integration health, not readiness |
| Tap unavailable | no | no | yes |
| Google Places unavailable | no | no | yes |
| Scraping provider unavailable | no | no | yes |
| AI Gateway unavailable | no | no | yes |
| Storage provider unavailable | no | no | yes — **exception**: if storage is architecturally mandatory for a given deployed role (e.g., a worker whose sole job is file processing), its unavailability may affect that role's own readiness, per `FI-B0-12`'s "unless the provider is mandatory for the deployed role" clause |

**Degraded status** is a third state, distinct from both health-check tiers: the application is live and ready (can serve API traffic, can read/write PostgreSQL) but one or more optional providers are unavailable, so provider-dependent features return `502 PROVIDER_UNAVAILABLE`/`503` for that feature only. Degraded status is communicated through `B13_OBSERVABILITY.md`'s integration-health metrics and dashboards, never through the readiness probe.

## 4. Health endpoint response — what must never leak

`FI-B0-06`, `FI-B0-12`: health endpoints must not leak credentials, internal topology, stack traces, database DSNs, or secret values. Production response shape:

```json
// GET /health/ready — 200
{"status": "ready"}

// GET /health/ready — 503
{"status": "not_ready", "reason": "database_unavailable"}
```

`reason` is drawn from a **closed enum** (`database_unavailable`, `redis_unavailable`, `migration_incompatible`) — never a raw exception message, connection string, or stack trace.

## 5. Migration-compatibility check

Readiness verifies the running code's expected migration state matches the database's actual applied-migrations state — this catches the classic "new code deployed before its migration ran" class of incident before it reaches user traffic, consistent with the rolling-deploy compatibility rule B12 already fixes for message schemas (`FI-B12-13`, `B12-D-A049`): a message produced by version N may be executed by version N±1, but the database schema itself must match what the running code expects before that code is marked ready.

## 6. Kubernetes/orchestrator semantics (informative, not a deployment-file commitment)

If the deployed orchestrator supports the liveness/readiness distinction natively (e.g., Kubernetes `livenessProbe`/`readinessProbe`), the two endpoints map directly: liveness failure triggers a container restart; readiness failure removes the pod from service endpoints without restarting it. This document does not author the orchestrator manifest — that is `B14`'s deployment implementation — but fixes the semantic contract the manifest must respect.

## 7. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13HLTH-1` | `/health/live` returns `200` while every external provider is simulated unreachable, provided the process itself and its event loop respond |
| `AT-B13HLTH-2` | `/health/ready` returns `503` when PostgreSQL is unreachable, and `200` once restored |
| `AT-B13HLTH-3` | `/health/ready` returns `200` while WhatsApp, Tap, Places, the scraper, and the AI Gateway are all simulated unreachable |
| `AT-B13HLTH-4` | Neither health endpoint response body contains a stack trace, connection string, or secret value under any failure condition |
| `AT-B13HLTH-5` | Both health endpoints are reachable without a session cookie |
| `AT-B13HLTH-6` | A pending, incompatible migration causes `/health/ready` to report `not_ready` before any request touches the mismatched schema |
