# B13 — Deployment Security Contract

> Design only. Conceptual production deployment requirements. **No deployment file, Dockerfile, Terraform, or Kubernetes manifest is created here.**

## 1. Component inventory and ingress exposure

| Service | Internet-facing? | Rationale |
|---|---|---|
| Reverse proxy / TLS terminator | **yes** | the only required public ingress point |
| Django application (API) | **no — reached only through the reverse proxy** | never bound to a public interface directly |
| Celery workers | **no** | pure internal consumers, no inbound network listener needed at all |
| Celery beat/scheduler | **no** | internal only |
| PostgreSQL | **no, never** | `FI-B0-16`; a publicly reachable database is a critical-severity finding in any review |
| Redis | **no, never** | `B13_REDIS_CELERY_SECURITY.md` §2 |
| File storage (Hostinger/S3-compatible) | provider-dependent — WazLink never proxies raw provider URLs to clients (`FI-B0-03`); every download is application-proxied in Phase 1 (`FI-B11-01`, B11's own Phase-1 choice) | application mediates every access |
| Observability ingestion (Sentry/OTel collector) | outbound only from WazLink's side | WazLink never accepts inbound connections from the observability vendor |

> **Only required ingress should be public. PostgreSQL and Redis MUST NOT be publicly exposed.**

## 2. Reverse proxy / TLS requirements

| Requirement | Detail |
|---|---|
| TLS termination | at the reverse proxy; the application process may run plain HTTP internally only on a private, unrouted network segment |
| `X-Forwarded-Proto` handling | the proxy **must** overwrite/strip any client-supplied value and always set it itself before forwarding — this is the precondition `B13_DJANGO_DRF_SECURITY_BASELINE.md` §3's `SECURE_PROXY_SSL_HEADER` trust depends on |
| `Host` header | proxy validates against the expected domain before forwarding, consistent with Django's own `ALLOWED_HOSTS` check as defense in depth, not a replacement for it |
| Minimum TLS version | TLS 1.2 minimum, TLS 1.3 preferred where the deployment target supports it |
| Certificate management | automated renewal (e.g., ACME/Let's Encrypt or the hosting provider's managed certificate service) — a manually-renewed certificate is an operational risk, not a security architecture, but is flagged here because an expired certificate is functionally an outage |

## 3. Trusted proxy assumption and header-spoofing protection

WazLink is behind exactly one reverse-proxy hop in the target deployment shape. The application trusts forwarded headers (`X-Forwarded-Proto`, `X-Forwarded-Host`) **only** because the network topology guarantees the application process is reachable exclusively from that proxy, never directly from the internet (§1). If a future deployment introduces a second proxy hop (e.g., a CDN in front of the load balancer), the header-stripping-and-resetting requirement in §2 must hold at **every** hop, and the application's trust boundary does not change — it still trusts only the immediate hop it is configured for. This is a **deployment decision recorded here as a dependency**, not designed further — the exact topology is `B14`.

## 4. Network segmentation

| Segment | Contains | Reachable from |
|---|---|---|
| Public/DMZ | reverse proxy only | the internet |
| Application | API + worker processes | the proxy segment (API only) and the database/cache segment (both, outbound) |
| Data | PostgreSQL, Redis | the application segment only |

No segment reaches "backward" — the data segment never initiates a connection to the application segment, and the application segment never accepts an inbound connection from the public segment except through the proxy.

## 5. Application server and process model

| Component | Requirement |
|---|---|
| Django process | runs under a production WSGI/ASGI server (not the development server), non-root OS user |
| Workers | non-root, least-privilege database role (`B13_DATABASE_SECURITY.md` §1), no direct internet egress beyond the specific provider hosts they must reach |
| Scheduler (Celery beat) | single active instance per environment (a duplicated beat schedule would double-fire reconciliation sweeps — not a security defect but an operational one, still worth fixing here since it affects the `maintenance` queue's isolation guarantee, `FI-B12-10`) |

## 6. Deployment strategy — rolling deploy

B12 fixes the correctness rule (`B12-D-A049`, `FI-B12-13`): a message produced by version N may be executed by version N±1; consumers ignore unknown fields; a consumer that cannot handle a `schema_version` fails and retains the event, never discards it. B13 owns the **mechanics** of the rolling deploy itself (which `B14` implements): old and new application-process versions may run simultaneously during a rollout window; both must be able to read/write the current database schema (which is why destructive migrations are always split into safe multi-step rollouts, `B13_DATABASE_SECURITY.md` §8); and workers of both versions may concurrently drain the same queues without corrupting shared state, because every task payload carries references re-read at execution time rather than trusting a version-specific snapshot (`FI-B12-05`).

## 7. Host and runtime hardening

Explicitly out of B12's scope and owned here at the principle level (exact tooling is `B14`):

| Control | Requirement |
|---|---|
| OS patching | security patches applied on a defined cadence, not ad hoc |
| Container base image (if containerized) | minimal base image, no unnecessary packages, scanned per `B13_SUPPLY_CHAIN_SECURITY.md` §5 |
| Least-privilege process user | no service runs as root |
| Outbound egress | worker/application egress restricted to the specific provider hosts and the database/cache segment — a compromised process should not be able to freely reach arbitrary internet hosts |

## 8. Environment separation

Full detail: `B13_ENVIRONMENT_STRATEGY.md`. This document notes only the deployment-security consequence: production secrets and production database credentials are never present in a staging or development deployment's configuration, and the reverse-proxy/TLS requirements in §2 apply identically to every environment that is reachable from outside a fully isolated local machine.

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13DEPLOY-1` | PostgreSQL and Redis are unreachable from the public internet in every environment beyond local development |
| `AT-B13DEPLOY-2` | A direct request to the application process bypassing the reverse proxy either fails or is not exposed to any external network path |
| `AT-B13DEPLOY-3` | `X-Forwarded-Proto` supplied by a client attempting to reach the application directly is not trusted |
| `AT-B13DEPLOY-4` | A rolling deploy with two concurrent application versions produces zero dropped or duplicated domain events |
| `AT-B13DEPLOY-5` | No process in the deployment runs as the root OS user |
