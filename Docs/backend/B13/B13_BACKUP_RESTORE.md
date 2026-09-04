# B13 — Backup & Restore

> Design only. Realizes what `FI-B0-13` proposed and what `FI-B12-13` explicitly handed to B13 ("Backup / DR / RPO / RTO for PostgreSQL and Redis"). Targets are marked **PROPOSED**, not frozen facts, per the brief's own instruction not to present unapproved business targets as fact.

## 1. What is backed up

| System | Backup subject | Redis is durable authority? |
|---|---|---|
| PostgreSQL | full database (every schema: identity, CRM, discovery, AI, messaging, pipeline, billing, finance, tax, files, platform) | — |
| File metadata | `file_assets` and related tables — part of the PostgreSQL backup, not separate | — |
| File blobs/storage | provider-side (Hostinger S3-compatible or equivalent) — backed up per the storage provider's own durability mechanism; WazLink additionally verifies via checksum reconciliation (`FI-B11-01`) rather than assuming provider durability | — |
| Configuration metadata | non-secret configuration values, versioned in deployment config (infrastructure-as-code), not a database backup concern | — |
| Critical integration configuration | `integration_connections` (references only, never secret values — `FI-B12-04`) is part of the PostgreSQL backup | — |
| Redis | **not a backup subject at all.** Redis holds no durable domain truth (`FI-B0-16`); a lost Redis instance is a latency/availability event, never a data-loss event (`B12_REDIS_BOUNDARY.md`, `FI-B12-10`) | **Redis is NOT durable backup authority** |

## 2. Backup frequency philosophy

| System | Frequency | Class |
|---|---|---|
| PostgreSQL full backup | daily | **PROPOSED**, `B13-D-B021` |
| PostgreSQL WAL/point-in-time recovery | continuous archiving | **PROPOSED**, `B13-D-B021` |
| Configuration (infrastructure-as-code) | versioned in source control, not a separate backup job | inherited from general engineering practice |

## 3. Retention classes

| Class | Examples | Retention | Basis |
|---|---|---|---|
| Standard operational backups | daily PostgreSQL snapshots | 30 days rolling | **PROPOSED**, matches `FI-B0-17`'s "30 days for temporary exports" precedent |
| Financial/audit/tax/webhook-adjacent data | already covered by the standard PostgreSQL backup, but the **retention of the underlying records themselves** (not the backup file) follows their own domain's stricter rule — financial rows are never deleted (`FI-B9-03`), so any backup taken at any point already contains every financial row that ever existed | matches domain retention, not a separate backup-specific policy | `FI-B0-13`: "Financial, tax, audit, and webhook records receive stronger retention" |
| Pre-incident snapshot | a backup taken immediately before a risky operation (major migration, bulk data correction) | retained until the operation is confirmed successful, minimum 7 days | `B13-D-B022` |

## 4. Encryption and access

Backups are encrypted at rest and access-controlled identically to the production database (`FI-B0-06`, `B13_DATABASE_SECURITY.md` §9) — a backup file is never a lower-security copy. Access to restore a backup requires the same operator authorization tier as a database-administration action (`B13_OPERATOR_MODEL.md` §2), and every restore is audited.

## 5. Restore testing

> A backup that has never been restored is not a backup — it is an unverified assumption.

| Test | Cadence | Class |
|---|---|---|
| Automated restore-to-staging verification | at minimum monthly (**PROPOSED**, `B13-D-B023`) | Class B |
| Integrity validation post-restore | checksum/row-count comparison against the source, plus a smoke test of the application against the restored database | required on every restore test, not optional |
| Full disaster-recovery drill (restore + application bring-up + smoke test) | at minimum quarterly (**PROPOSED**, `B13-D-B024`) | Class B |

## 5a. Backup monitoring — the frozen fourth requirement

Frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` requires PostgreSQL backups to be **encrypted, access-controlled, monitored, and restore-tested**. §4 covers encryption and access, §5 covers restore testing; **monitoring is realized here.** `B13-FIX.1` added this section after finding the "monitored" clause dropped from `FI-B0-13` and implemented nowhere — the pack was restore-testing backups monthly while having no way to notice that a nightly backup had silently stopped running.

An unmonitored backup is indistinguishable from no backup until the restore is needed, which is the worst possible moment to discover it.

| Signal | What it detects | Response |
|---|---|---|
| `backup_last_success_age_seconds` exceeds the scheduled interval plus a grace margin | the backup job stopped running, or is failing silently | **page** — a missed backup widens RPO with every hour it goes unnoticed |
| `backup_last_success_age_seconds` for WAL/PITR archiving exceeds its own interval | continuous archiving has stalled, so point-in-time recovery is degraded even though the last full backup looks healthy | **page** — full-backup health masks this failure |
| `backup_size_bytes` deviating sharply from trend | a truncated, partial, or empty backup that "succeeded" | investigate before the next retention rotation discards a good copy |
| `restore_test_last_success_age_seconds` exceeds the §5 cadence | restore testing has lapsed | ticket, not page — the gap is procedural, not an active outage |

**Bounded cardinality:** these are per-environment gauges with no workspace, user, or correlation dimension, consistent with `B13_OBSERVABILITY.md` §3.

**The monitoring must itself be verifiable.** A backup alert that has never fired is not evidence that backups work — the acceptance control below requires demonstrating the alert fires when the condition is induced, not merely that the alert is defined.

## 6. Tenant-aware restoration considerations

A full-database restore is the Phase-1 mechanism — there is no per-workspace backup/restore granularity designed, because a workspace's data is interleaved with shared platform tables (plans, global integrations) in the same PostgreSQL instance. A single-workspace "restore this tenant's data to yesterday" capability is **not** a Phase-1 requirement and is recorded as a future consideration (`B13-D-C008`, Class C) — restoring one workspace's data without affecting every other workspace's concurrent writes since the backup point is a materially harder problem than a full-instance restore and is not designed here.

## 7. RPO/RTO — proposed targets, not guarantees

| Metric | Proposed target | Basis |
|---|---|---|
| RPO (PostgreSQL) | 24 hours (bounded further by continuous WAL archiving, which can reduce actual data loss to minutes in most failure modes) | `FI-B0-13`, restated as still-proposed |
| RTO (PostgreSQL) | 4 hours for a first production tier | `FI-B0-13`, restated as still-proposed |
| RPO/RTO (Redis) | not applicable — Redis loss causes no data loss by design (§1); recovery time is "however long it takes to start a fresh instance," typically minutes | derived from `FI-B12-10` |
| RPO/RTO (file storage) | inherited from the storage provider's own SLA, not independently committed by WazLink (`FI-B11-01`, Hostinger capability unresolved, `B11-X-007`) | Class C, `B13-D-C009` |

**These are proposed targets requiring Product/Operations approval, not guarantees** (`FI-B0-13`).

## 8. Disaster scenarios cross-reference

Full recovery-ordering procedure for each disaster class (DB corruption, host loss, Redis loss, worker loss, storage outage) is `B13_DISASTER_RECOVERY.md`. This document covers only the backup/restore mechanism those procedures depend on.

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13BAK-1` | A monthly restore-to-staging test succeeds and passes integrity validation |
| `AT-B13BAK-2` | Backup files are encrypted at rest; an operator without database-admin-tier authorization cannot initiate a restore |
| `AT-B13BAK-3` | Every restore operation writes an audit row with operator, timestamp, and target environment |
| `AT-B13BAK-4` | A restored database's financial-row count matches the source at the backup timestamp exactly (financial rows are never deleted, so this is a strong integrity check) |
| `AT-B13BAK-6` | Backup monitoring is live and provably fires: with the backup job disabled in a non-production environment, `backup_last_success_age_seconds` crosses its threshold and pages; a stalled WAL/PITR archiver pages independently of full-backup health |
| `AT-B13BAK-5` | Flushing Redis does not require restoring from any backup — the system is correct on Redis's own restart alone, confirmed by `B13_REDIS_CELERY_SECURITY.md` `AT-B13CEL-4` |
