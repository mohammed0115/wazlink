# B14_01 — Architecture Baseline

> **B14 is an implementation master pack. B14 is not implementation.** No Django code, no migration, no provider integration, no frontend change is authored here.

## 1. Verified inputs

| Input | Verified value | Method |
|---|---|---|
| `FROZEN_B13_SHA` | `5c759cea72baaec9ee0096039475162efd4eeec0` | `git rev-parse HEAD` |
| Commits since B13 | **0** | `git rev-list --count` |
| Tracked modifications | **0** | `git status --porcelain` |
| B0–B13 | unchanged | `git diff --stat` = empty |
| Frontend (`client/`) | unchanged | `git diff --stat` = empty |
| Backend implementation | **absent** — `server/index.ts` is a static file server; **0 Django files** | `find` |
| `Docs/gap-plan/` | **30 documents** | `ls` |
| GAP IDs | **27** | parsed from `03_MASTER_GAP_MATRIX.md` |
| Product Decisions | **16** | parsed from `27_PRODUCT_DECISION_REGISTER.md` — 15 + **`PD-016`**, the Owner's explicit `CA-15` ratification added by `B14-FIX.2` (`M-01`). An authority record, not a new capability |
| Controlled Amendments | **15** — **2** `NON_ADDITIVE`, 12 `ADDITIVE`, 1 `COMPATIBLE_CLARIFICATION` | parsed from `19_CONTROLLED_AMENDMENT_PLAN.md` |
| **Frozen workspace roles** | **6** — `owner`, `admin`, `manager`, `sales`, **`member`**, `viewer` | `B1_AUTHORIZATION_RBAC.md` §3 header + §4 (*"exactly six roles"*) |
| **Platform roles (separate namespace)** | **1** — Operator | `B13_OPERATOR_MODEL.md` — **not** a `memberships.role` value |
| **Django modules** | **26** across **L1–L10** | `B14_03` §3 — unchanged by `B14-FIX.3`; no module added, none moved |
| **Class `A` module edges** | **48** — `SAME_LAYER = 0`, `UPWARD = 0`, `CYCLES = 0` | `B14_03` §4a walker rules `W-1…W-10`, AST-walked, negative-controlled (`T-ARCH-1a/1b`, `T-P360-12`, **`T-P360-16`**). **Completely re-walked at `B14-FIX.4`**, not adjusted: `crm → messaging` and `crm → pipeline` removed with the timeline repair, `messaging → assignment` added as a legal downward edge the prior inventory had omitted (`B14_03` §5c) |

**Scope, parsed from the matrix — not trusted from the brief:**

- `APPROVE_NOW` (12): `GAP-001 002 003 004 005 006 008 010 012 013 014 025`
- `APPROVE_AFTER_P0` (8): `GAP-007 011 015 016 017 021 022 023`
- `DEFER` (6): `GAP-009 018 019 020 024 026`
- `CONFLICT_BLOCKED` (1): `GAP-027`

All four sets match the authorising brief exactly.

## 2. Source-of-truth precedence

1. **Frozen B0–B13 invariants and ownership**
2. **Approved Gap Plan decisions and amendments**
3. **Frozen frontend contracts** (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`)
4. Implementation convenience — **never overrides 1–3**

Where an approved amendment changes a frozen contract, B14 records the **implementation mapping** to that amendment (`B14_05`). **B14 does not edit the frozen document.**

## 3. Architectural target

**Modular Django monolith.** Django + DRF + PostgreSQL + Redis + Celery.

| Component | Role | Hard rule |
|---|---|---|
| PostgreSQL | **the** durable authority for every business fact | `FI-B0-16`: *"If this Redis instance is flushed right now, is the system still correct after recovery from PostgreSQL?"* must answer **yes** |
| Redis | Celery broker · cache · short-lived coordination/locks | **never business truth**; a Redis-only counter may never decide a security or financial outcome |
| Celery | async execution on the **five frozen queues** | `default`, `providers.fast`, `providers.slow`, `webhooks`, `maintenance` — **no sixth queue** |

**Explicitly not introduced:** microservices · Kafka · BullMQ · a second database · a second queue architecture · an ORM-level cross-app import. None is required by any frozen contract.

## 4. Provider status vocabulary — corrected against frozen B12

The authorising brief proposed candidate statuses (`NOT_CONFIGURED`, `CONFIGURATION_ERROR`, `DISABLED`, `CONNECTED`, `DEGRADED`, `PROVIDER_UNAVAILABLE`) and instructed that final names be derived from frozen vocabulary. **They are, and three of the six candidates must be rejected**, because frozen B12 already models these facts and adopting the candidates verbatim would create the second provider truth §21 forbids.

Frozen truth (`B12_PROVIDER_CONFIGURATION_MODEL.md`, `B12_INTEGRATION_HEALTH_MODEL.md`):

| Frozen construct | Values |
|---|---|
| `integration_connections.status` (5 states) | `not_connected` → `configuration_required` → `connected`, with `error` reachable, and `connected → configuration_required` on material change |
| `integration_connections.enabled` | **orthogonal boolean** — operator intent, stored separately (`B12-D-A034`) |
| Six independent health facts | `configuration_valid` · `credential_valid` · `provider_reachable` · `webhook_configured` · `provider_enabled` · `degraded` |

Mapping of the candidates:

| Brief candidate | Resolution |
|---|---|
| `NOT_CONFIGURED` | → frozen `not_connected` / `configuration_required` |
| `CONFIGURATION_ERROR` | → frozen `error` + health fact `configuration_valid=false` |
| **`DISABLED`** | **REJECTED as a status** — it is `enabled = false`. Frozen `B12-D-A052`: *"`disabled` is not a status at all… Carrying it as both would give one fact two homes"* |
| `CONNECTED` | → frozen `connected` |
| **`DEGRADED`** | **REJECTED as a status** — it is the health fact `degraded`, a rolling window over `provider_request_attempts` |
| **`PROVIDER_UNAVAILABLE`** | **REJECTED as a status** — it is the health fact `provider_reachable = false` |

This is the single most consequential correction B14 makes to its own brief, and it is made in the brief's own stated direction.

## 5. Non-negotiable implementation invariants

Every one is inherited, not invented. Each maps to a **defined** test in `B14_19` §8 — a precondition, an action and an assertion — and no invariant is closed by a test that is vacuous in the slice claiming it (`B14_19` §4).

| # | Invariant | Source |
|---:|---|---|
| 1 | Workspace isolation on every tenant row and every query | B1, CRM-INV-1/2 |
| 2 | PostgreSQL authoritative; Redis never business truth | `FI-B0-16` |
| 3 | **CRM participation never requires Discovery** | `CA-01`, `GAP-005` |
| 4 | **No fake Business, DiscoveryJob, Places provenance or `lead_provenance`** | `CA-01`, `CA-14` |
| 4a | **A Business-less Lead takes its identity from its primary Contact; no Business attribute or PII is ever copied onto `leads`** | **`CA-15`**, CRM-INV-3 |
| 4b | **All six frozen workspace roles persist; no frozen permission cell changes; every additive permission defines all six** | `B1_AUTHORIZATION_RBAC.md` §§3–4, `B1-D-009` |
| 4c | **Forwarded headers are untrusted unless the topology guarantees them; the scheme is never inferred from a header** | `B13_DEPLOYMENT_SECURITY.md` §3 |
| 4d | **`CORS_ALLOWED_ORIGINS` is an explicit list, never a wildcard; `CORS_ALLOW_CREDENTIALS` is never paired with a wildcard origin; the production topology is `same_origin`, so frozen `SESSION_COOKIE_SAMESITE="Lax"` is correct and is not changed** | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §§6–7 |
| 5 | One commercial party: `Customer.party_kind ∈ {organization, person}`; **no Account** | `PD-001` |
| 6 | Contact holds the PII; Customer holds none | CUS-5, CRM-INV-18 |
| 7 | Viewer contact masking **server-side, before serialization** | `PD-002` |
| 8 | **AI may never autonomously send a customer-facing message**; no second AI-owned send command | `PD-013`, `B5-D-A021`, `B7_ACTION_CATALOG.md` §3 |
| 9 | OpenAI behind the AI Provider Port; model name is configuration, never domain truth | `PD-003` |
| 10 | **Won Deal ≠ Recognized Revenue** | B6, `AT-REV-5` |
| 11 | **Accepted Quote ≠ Recognized Revenue** | `15_PRODUCTS_QUOTES_PLAN.md` (deferred, rule still binding) |
| 12 | **Subscription Billing ≠ Customer Revenue** | CRM-INV-8 |
| 13 | `RecordRevenueEvent` is the **sole** writer of `revenue_events`, human-membership only | B9 |
| 14 | **No auto-retry of `UNKNOWN` non-idempotent work**, no override | `B12-D-A020` |
| 15 | `worker_executions` has **no lease/fence column**; heartbeat-stale ⇒ `unknown`, operator-gated | `B12` P-3, B13 MUST-NOT list |
| 16 | B11 is the single storage authority | B11 |
| 17 | Secrets never in logs, audit payloads, task arguments, traces, API responses or Django Admin | B13 |
| 18 | No cross-workspace identity resolution or merge | `GAP-006` |
| 19 | Frontend grants no authorization | B13 |
| **20** | **Party360 is a read-only composition owned above every contributing domain. It owns no table, no command, no permission, no cache and no event, and never copies commercial truth into a projection** | `B14_03` §5a, frozen `B2_LEAD360_READ_MODEL.md` §§1–2, `N-01` |
| **20a** | **The `activities`/timeline surface is a multi-contributor read composition on the same boundary. `crm`, `messaging` and `pipeline` each supply only their own entries; `analytics` merges at read time on `(occurred_at DESC, entry_id DESC)`, deduping in memory on `(source_domain, source_event_id)`. No cross-domain entry is ever written into `crm_activities`, and no dedup store, cache or projection exists** | **`B14_03` §5e**, frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3, `B2_TIMELINE_IDENTITY_MODEL.md`, CRM-INV-13, **`N-09`** |
| **21** | **No module imports a module at or above its own layer.** Read composition, event delivery and infrastructure dispatch are resolved through `common/` interfaces bound at the composition root, never by importing upward | `B14_03` §4/§4a, `T-ARCH-1`, `T-ARCH-10` |
| **22** | **`entitlements` never reads `billing`.** Billing translates the entitlement-relevant subscription state downward; an absent assignment is fail-closed to the lowest tier | `B14_03` §6b, frozen `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §1, `N-04` |

## 6. What B14 must never do

Write Django code · create migrations · modify the frontend · execute a controlled amendment against a frozen document · integrate a provider · deploy · commit · push · schedule a deferred or rejected capability.
