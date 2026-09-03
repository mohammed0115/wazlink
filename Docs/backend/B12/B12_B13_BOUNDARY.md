# B12 — B13 Boundary

> **No B13 file is created by this document.** `B13_FILES_CREATED = 0`. B12 names required signals and contracts; B13 designs the operational and security system.

## 1. What B12 requires of B13

| Requirement | What B13 provides |
|---|---|
| Log aggregation | a destination and retention for the structured fields of `B12_OBSERVABILITY_HANDOFF.md` §3 |
| Metrics backend | storage and query for the bounded-cardinality set of §4 |
| Tracing | span propagation for `correlation_id`/`causation_id` |
| Alert routing | delivery for the frozen alert classes B12 binds signals to |
| Worker provisioning | concurrency, prefetch, pool type, autoscaling for the five queues |
| Beat schedule | concrete cadences for the sweeps B12 names |
| Retention policy | windows for outbox rows, health snapshots, executions, and raw payloads |
| Secret management | the store behind every `*_REF` |
| Secret rotation **operations** | the runbook; B12 defines only the state effect |
| Backup / DR / RPO / RTO | for PostgreSQL and Redis |
| Deployment strategy | rolling-deploy mechanics; B12 defines only the compatibility **rule** (§3) |
| Host and runtime hardening | out of scope for B12 entirely |

## 2. What B12 deliberately does not decide

Worker counts · prefetch multipliers · autoscaling thresholds · beat cadences beyond the frozen figures · alert thresholds and destinations · SLI/SLO definitions · incident management · on-call · dashboard layout · log retention periods · backup schedules · DR topology · secret-store product choice · host hardening · runtime security.

Each is **tuning or operations**, and B12's correctness properties hold at any value. Deciding them here would freeze operational choices behind an architecture review.

## 3. The one deployment rule B12 does fix

> **`B12-D-A049`. A message produced by version N may be executed by version N±1. Consumers ignore unknown fields; a consumer that cannot handle an event's `schema_version` **fails the execution and retains the event**, never discards it.**

This is a **correctness** property, not a deployment detail, which is why it lives here and not in B13: assuming deploy and queue drain are atomic is how a rolling deploy silently drops work. The compatibility contract:

| Change | Allowed within a major `schema_version`? |
|---|---|
| Add an optional field | **yes** |
| Add a new `event_type` | yes — unknown types are ignored by consumers that do not handle them |
| Remove or rename a field | **no** — requires a major bump |
| Change a field's type or meaning | **no** |
| Tighten a constraint on an existing field | **no** |

`AT-B12VER-1`…`3`.

## 4. Failure posture — what B13's absence costs

If every B13-owned system were unavailable, B12's correctness would be unaffected: dispatch, dedup, budgets, verification, and reconciliation are all PostgreSQL properties. What would be lost is **visibility** — nobody would know an unknown outcome was accumulating. That is the honest statement of the dependency: B13 is how WazLink *notices*, not how it stays correct.
