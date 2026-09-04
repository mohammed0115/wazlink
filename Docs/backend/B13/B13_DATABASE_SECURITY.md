# B13 — Database Security & Integrity

> Design only. PostgreSQL is canonical (`FI-B0-16`, ADR-003). This document is the production security/integrity layer around that frozen authority.

## 1. Application vs. migration role

| Role | Privileges | Rationale |
|---|---|---|
| Application role | `SELECT`/`INSERT`/`UPDATE`/`DELETE` on application tables only; **no** `CREATE`/`ALTER`/`DROP` | least privilege — a SQL-injection-class bug or a compromised application credential cannot alter schema |
| Migration role | schema DDL, used only by the deployment pipeline, never by the running application process | separates "the app can write rows" from "the app can change what a row means" |
| Read-replica role (if introduced) | `SELECT` only, used by analytics/reporting reads that do not require read-your-writes consistency | deferred — no read replica is required for Phase 1 architecture; recorded as `B13-D-C005`, Class C |

Both roles are distinct database users with distinct credentials, each following `B13_SECRETS_MANAGEMENT.md`'s `*_REF` handling.

## 2. Connection encryption

TLS to PostgreSQL is required in every environment where the database is not co-located with the application process on a private, unrouted network segment (`B13_DEPLOYMENT_SECURITY.md` §3). Certificate verification is mandatory and non-disableable — mirroring the identical rule B12 already fixes for every provider connection (`FI-B12-01` §6: "TLS to every provider, verification mandatory and non-disableable").

## 3. Constraints as the primary integrity mechanism

Database constraints and `transaction.atomic` are preferred before distributed locks (`FI-B0-16`). This is not a style preference — it is what makes the following invariants *impossible to violate* rather than merely *checked*:

| Invariant | Mechanism | Source |
|---|---|---|
| At most one active Owner cannot be removed | row lock + re-evaluated guard under the lock | `FI-B1-08` |
| At most one active entitlement override per `(workspace, code)` | partial unique index `WHERE status='active'` | `FI-B8-02` (T20) |
| A reconciliation case opens once per real problem | `UNIQUE (fingerprint, mismatch_class) WHERE state='open'` | `FI-B12-07` |
| A payment's quote can be consumed exactly once | partial unique index on `upgrade_quotes.payment_id` | `FI-B0-22` |
| A financial row is never deleted | no delete path at the application layer; `ON DELETE RESTRICT` on inbound foreign keys | `FI-B9-03` |
| A `legal`-class file is never deleted | `retention_class` immutable in both directions; `DeleteAsset` refuses at the application layer regardless of role | `FI-B11-05` |

## 4. Tenant filters as a database-adjacent control

Every workspace-owned table carries a `workspace_id` column, and every application-layer manager scopes through it (Doctrine R-1, `FI-B1-07`). B13 does not add a database-enforced tenant filter beyond this — see §7 for why Row-Level Security is a considered and rejected Phase-1 option.

## 5. Transaction boundaries

An outbox row commits in the **same transaction** as the domain state it announces (`FI-B12-01`, `B12-D-A006`); a reservation (quota, entitlement, financial write) commits under the same row lock as its precondition check — never a check-then-write race across two transactions. This is restated here because it is a database-integrity property, not merely an application pattern: **the correctness of every idempotency, concurrency, and financial-authority claim in this pack depends on PostgreSQL transaction isolation, not on application-level mutexes.**

## 6. Lock discipline

`SELECT … FOR UPDATE`, `SKIP LOCKED` (for claim-based dispatch), leases with a per-claim `lease_token` fence, `expected_version` optimistic checks, and partial-unique indexes are the complete lock vocabulary — the frozen concurrency primitives of `B12_CONCURRENCY_MODEL.md` §1, with the `lease_token` fence itself scoped by `B12-D-A055` to `outbox_events` (`FI-B12-01` carries the secret-reference and redaction rules, not this vocabulary). A fixed global lock order is required wherever two rows are locked together (e.g., two-membership commands in `TransferOwnership`, `FI-B1-08`) to prevent deadlock. Redis locks, where used, are shaping only — never the authority for a correctness property (`FI-B0-16`, `FI-B12-01` §"Redis boundary"; full detail `B13_REDIS_CELERY_SECURITY.md` §1).

## 7. Row-Level Security — evaluated and classified

**Decision: Phase-1 rejected, recorded as a defense-in-depth future option, not adopted now (`B13-D-B016`, Class B).**

| Consideration | Assessment |
|---|---|
| Would RLS add a genuine second layer? | Yes — a bug in application-layer queryset scoping (Doctrine R-1) would still be caught at the database if every table carried an RLS policy keyed on a session-local `workspace_id` GUC |
| Cost | Requires every database connection to set a session variable per request/task, a policy per table (kept in lockstep with every future migration), and interacts non-trivially with connection pooling (PgBouncer transaction-mode pooling and session-local GUCs are a known operational hazard) |
| Does Phase 1's architecture already close the gap RLS would close? | Largely yes — Doctrine R-1 is a single, reviewed, tested manager entry point per table (`FI-B1-07`: "the manager entry point must be the *only* way domain services reach tenant-owned tables, so that forgetting the scope is a review-visible omission rather than an invisible default") |
| Verdict | **Not required for Phase 1.** Application-layer scoping plus the acceptance-test negative controls in `B13_AUTHORIZATION_TENANCY.md` §10 is the chosen defense. RLS is recorded as a future hardening step if the connection-pooling operational cost is later judged acceptable, or if a future compliance requirement demands database-enforced tenancy independent of application code |

## 8. Migrations and destructive-migration policy

| Policy | Rule |
|---|---|
| Destructive migration (drop column/table, non-additive type change) | requires a two-step rollout: add-then-backfill-then-remove-in-a-later-release, never a single migration that both adds and destroys in one deploy — mirrors the general software-engineering practice this codebase already follows for every controlled amendment (additive-first) |
| Migration review | every migration reviewed for lock duration on large tables (an `ALTER TABLE` that takes an exclusive lock on `revenue_events` during business hours is an incident, not a routine deploy) |
| Rollback | a migration that cannot be safely rolled back is flagged explicitly in its own changelog entry before merge |

## 9. Backups and PITR

Full backup/restore strategy: `B13_BACKUP_RESTORE.md`. This document notes only the database-security-specific requirement: backup files are encrypted at rest and access-controlled identically to the production database itself (`FI-B0-06`), and a backup is never a lower-security copy of the same data.

## 10. Concurrency acceptance controls

Distinct from the general database controls in §11: these verify the optimistic-concurrency mechanism itself (`version`/`If-Match`, `FI-B0-24` ADR-010), referenced from `B13_SECURITY_PRINCIPLES.md` control #12 and `B13_THREAT_MODEL.md`'s race-conditions row. **P/N tags corrected under `B13-FIX.2`** to match the canonical register: `AT-B13CONC-2` is **N** (a request missing a required precondition is refused) and `AT-B13CONC-3` is **P** (a designed property holds on a successful update). The two documents previously carried opposite tags for the same two identifiers.

| ID | Type | Assertion |
|---|---|---|
| `AT-B13CONC-1` | N | Two concurrent updates to the same versioned resource (Lead/Deal/Task/AutomationRule/Subscription) using the same stale `version` result in exactly one success and one `409 STALE_VERSION` |
| `AT-B13CONC-2` | N | An update submitted without `If-Match`/`version` on a resource that requires it is rejected before any row lock is taken |
| `AT-B13CONC-3` | P | A successful versioned update's audit row carries both the before and after `version`, differing by exactly one |

## 11. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13DB-1` | The application's database role cannot execute `CREATE`/`ALTER`/`DROP` |
| `AT-B13DB-2` | A connection to PostgreSQL without TLS is refused in every environment where the database is not co-located on a private segment |
| `AT-B13DB-3` | Two concurrent attempts to consume the same `UpgradeQuote` result in exactly one success and one `409 CONFLICT` |
| `AT-B13DB-4` | No code path issues `DELETE` against `revenue_events`, `revenue_reversals`, or a `legal`-class `file_assets` row |
| `AT-B13DB-5` | A crash between the outbox-row write and the announced domain-state write cannot occur, because they are the same transaction — verified by killing the process mid-transaction and confirming neither row exists post-recovery |
