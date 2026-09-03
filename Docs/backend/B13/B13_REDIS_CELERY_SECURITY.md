# B13 — Redis & Celery Security

> Design only. Preserves `B12_REDIS_BOUNDARY.md`, `B12_QUEUE_TOPOLOGY.md`, `B12_CELERY_EXECUTION_MODEL.md` verbatim (`FI-B12-10`, `FI-B0-16`). PostgreSQL is durable authority; Redis/Celery must never become business authority. B13 adds the network, authentication, and operational-hardening layer B12 explicitly left to B13 (`FI-B12-13`).

## 1. The one test, restated

> If this Redis instance is flushed right now, is the system still correct after recovery from PostgreSQL? (`FI-B0-16`, `B12_REDIS_BOUNDARY.md`)

A durable domain counter (entitlement quota, financial ledger, attempt budget) is a PostgreSQL row; an abuse-acceleration counter (rate-limit shaping) may live in Redis because losing it only degrades protection temporarily, never business correctness (`FI-B12-10`).

## 2. Network isolation

| Control | Requirement |
|---|---|
| Public exposure | Redis **MUST NOT** be publicly exposed — reachable only from the application/worker network segment (`B13_DEPLOYMENT_SECURITY.md` §4) |
| Port binding | bound to a private interface/segment only, never `0.0.0.0` on a publicly routable host |
| Firewall | inbound rules restrict Redis's port to the application and worker hosts only |

## 3. Authentication

| Control | Requirement |
|---|---|
| `requirepass` / ACL | Redis authentication is required in every environment beyond a fully isolated single-host development setup |
| Credential handling | `REDIS_URL`/`CELERY_BROKER_URL` are secret-class values (`FI-B12-04`), resolved via `*_REF`, never logged |
| ACL scoping (if the deployed Redis version supports it) | worker/broker access separated from cache/rate-limit access by ACL user, so a compromised worker credential cannot flush the entire instance — Class B, `B13-D-B017` |

## 4. TLS

TLS to Redis is required wherever the connection crosses a network boundary broader than a private, unrouted segment shared exclusively by the application and worker processes — the identical rule already fixed for every provider and for PostgreSQL (`FI-B12-01` §6, `B13_DATABASE_SECURITY.md` §2). Where Redis and the application share a fully private VPC segment with no possibility of interception, TLS is a deployment judgment call, not an architectural requirement.

## 5. Queue separation

Five queues, derived from workload-isolation properties, not domain names (`FI-B12-10`): `default`, `providers.slow`, `providers.fast`, `webhooks`, `maintenance`. B13 adds no queue and no business-domain queue — a deployment may not add a business-named queue (`OUTBOX_MAX_DISPATCH_ATTEMPTS`/`PLATFORM_QUEUE_NAMES` configuration explicitly bounds this, `FI-B12-04`).

## 6. Worker privilege

| Control | Requirement |
|---|---|
| Process privilege | worker processes run with the minimum OS/container privilege needed; never as root in a container image |
| Database role | workers use the same least-privilege application database role as the API process (`B13_DATABASE_SECURITY.md` §1) — no elevated worker-only database role exists |
| Secret access | a worker resolves a `*_REF` at call time exactly as the API process does; no worker-only secret cache |

## 7. Task serialization safety

> **No arbitrary pickle or untrusted task deserialization.**

Celery's task serializer is JSON, never `pickle` — pickle deserialization of an attacker-influenced payload is a remote-code-execution vector, and no legitimate WazLink task payload requires Python-object serialization. Celery's own security documentation states this plainly: *"the pickle serializer is convenient... but for the same reasons pickle is inherently insecure, and should be avoided whenever clients are untrusted or unauthenticated"* — JSON has been Celery's default since version 4.0, and `accept_content = ['json']` whitelists it explicitly (`B13-X-007`, VERIFIED). Task payloads carry **references, not snapshots** (`FI-B12-05`, `B12_CELERY_EXECUTION_MODEL.md`) — a task payload is a small, closed-schema JSON object (`workspace_id`, `correlation_id`, `event_id`, opaque public IDs), never a serialized domain object, credential, or arbitrary blob. This is both a correctness rule (re-reading current state at execution time, `FI-B12-01`) and a security rule (minimizing what a compromised or intercepted task payload could contain).

## 8. Poison task handling

A task that repeatedly fails is bounded by its domain's own retry class (`FI-B0-21`) and terminates in `dead_lettered` after the frozen maximum, never an infinite requeue loop. A malformed task payload (a shape the consumer cannot parse) is classified as `unknown_event_kind`/`malformed` and dead-lettered immediately rather than retried blindly (`FI-B12-11`'s error-taxonomy discipline extended to internal task payloads).

## 9. Worker crash and stale-worker handling

A worker killed mid-task (hard time limit, OOM, deploy) leaves its claimed row in a lease that expires; the reaping mechanism re-claims it under a **fresh `lease_token`**, never resuming the dead worker's in-flight state (`FI-B12-01`, `B12-D-A055`). A stale worker whose heartbeat has lapsed past the job ceiling is detected by reconciliation class `P-3` and classified `unknown` — never assumed failed, because the provider call it was making may have succeeded (`FI-B12-07`).

## 10. Retry storms and queue backlog

| Signal | Response |
|---|---|
| A single poison task class filling a queue | queue isolation (§5) already bounds blast radius to that workload class; `maintenance` is deliberately starvable so a reconciliation backlog never displaces user-visible work (`FI-B12-10`) |
| A provider outage causing retry storms on `providers.fast`/`providers.slow` | backoff with full jitter, capped at 15/60 minutes (`FI-B0-21`); never an unbounded immediate-retry loop |
| Queue depth exceeding operational baseline | `queue_delay_ms{queue}` metric, alerted per `B13_OBSERVABILITY.md` §4; response is `B13_RUNBOOKS.md` §"Queue backlog" |

## 11. Dead-letter operational response

Full model already frozen (`FI-B12-06`); B13 adds the operator runbook (`B13_RUNBOOKS.md` §"Dead-letter growth") and the alert binding (`platform_dead_letters_open_gauge{owning_domain}`, `FI-B12-05`).

## 12. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13CEL-1` | Redis is unreachable from outside the application/worker network segment |
| `AT-B13CEL-2` | A Redis connection without authentication is refused in every non-isolated-dev environment |
| `AT-B13CEL-3` | Celery's serializer is configured as JSON; a pickle-serialized payload is refused |
| `AT-B13CEL-4` | Flushing Redis in a test environment does not corrupt or lose any durable domain state after PostgreSQL-driven recovery |
| `AT-B13CEL-5` | A worker killed mid-task does not resume the dead worker's in-flight state on recovery — a fresh lease token is issued |
| `AT-B13CEL-6` | A malformed task payload is dead-lettered rather than retried indefinitely |
| `AT-B13CEL-7` | No business-domain-named queue exists beyond the five frozen queues |
