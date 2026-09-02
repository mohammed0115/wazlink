# B8 — Usage & Quota Model

> Design only. Defines the `usage_counters`/`usage_ledger` schema (frozen table names, undetailed by B0) and the reservation mechanics every owning domain (B1 for `seats`, B7 for `automationRuns`, future domains for `leads`/`discoveryRuns`/`aiAnalyses`) must follow.

## 1. Who reserves what

B8 owns the **row** (schema, period/reset semantics, numeric limit per plan tier) for all 5 frozen metrics. B8 does **not** centrally gate every write — the domain that owns the metered action performs its own transactional reservation against B8's row, exactly as B7 already does for `automationRuns` (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4.1, confirmed by the research digest: *"the reservation is a transactional lock on the workspace's `usage_counters` row inside the same transaction as the state change... no Redis counter participates in the decision"*).

| Metric | Reserving domain | Reservation point |
|---|---|---|
| `leads` | CRM (B2) | inside `ConvertBusinessToLead`'s own transaction |
| `discoveryRuns` | Discovery (B3) | inside `CreateDiscoveryJob`'s own transaction |
| `seats` | Workspace (B1) | inside `AcceptInvitation`/`ReactivateMembership` (already frozen, `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §4) |
| `automationRuns` | Automation (B7) | inside `AdmitAutomationTrigger`/`RunAutomationNow` (already frozen) |
| `aiAnalyses` | Intelligence (B4) | inside `RequestBusinessIntelligence`'s own transaction (closes `B4-D-B009`, `B8-D-B006`) |

B8's own transactions never reserve against these metrics on another domain's behalf; B8 supplies the row and the numeric ceiling, nothing else.

## 2. Schema

**`usage_counters`** (frozen table name): `workspace_id` (FK, part of composite key), `metric_code` (FK to `quota_definitions`, part of composite key), `period_start` (UTC, part of composite key), `period_end` (UTC), `count` (integer, default 0), `updated_at`. Unique constraint `(workspace_id, metric_code, period_start)`. A row is created lazily on first use of a metric in a period (an absent row reads as `count = 0`, never as "unlimited" or an error).

**`usage_ledger`** (frozen table name): append-only audit trail of every reservation/release: `id`, `workspace_id`, `metric_code`, `delta` (+1 reservation, -1 release-on-rollback), `command_id` (correlates to the reserving domain's own idempotency record), `occurred_at`. Never updated, only inserted — matches `BACKEND_DATA_MODEL.md`'s "append-oriented" doctrine for financial-adjacent records. The hourly/daily reconciliation job named in frozen `BACKEND_RECONCILIATION.md` ("Usage | UsageLedger vs counters | hourly/daily | Entitlement service") sums `usage_ledger.delta` per `(workspace_id, metric_code, period)` and compares it to `usage_counters.count`, repairing drift under the same explicit/permissioned/idempotent/audited doctrine every other reconciliation job in that file uses.

## 3. Period and reset policy

`quota_definitions.reset_policy` is one of:

- **`calendar_period`** — resets at the workspace's committed `Subscription.current_period_start`/`current_period_end` boundary (i.e., the billing cycle). Used for `leads`, `discoveryRuns`, `automationRuns`, `aiAnalyses` in Phase 1 — the metric resets when the subscription renews, not on a fixed calendar month, so a mid-cycle upgrade does not truncate the workspace's remaining allowance early (the new, larger limit applies immediately per §`B8_UPGRADE_DOWNGRADE_MODEL.md` §3, but the *period boundaries* are unchanged by an upgrade).
- **`rolling_period`** — not used by any Phase-1 metric; reserved for a future per-metric definition that resets on a fixed N-day rolling window independent of the billing cycle (e.g., a burst-protection metric). No Phase-1 row uses it.

`seats` is the one metric with no period at all — it is a point-in-time capacity count (§`B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §4's active-membership count), not a period-bounded usage total; its `usage_counters` row's `period_start`/`period_end` span the entire life of the current subscription commitment and are only re-created when the subscription's `plan_version_id` changes.

`reset_at` (the field `B8-D-A005` adds to `EntitlementDecision`, and the exact-timestamp companion to `UsageDTO.period`) is always `Subscription.current_period_end` for `calendar_period` metrics, and `null` for `seats`.

## 4. Reservation mechanics (mirrors the frozen B1/B7 pattern exactly)

1. The owning domain's command locks the workspace's `usage_counters` row for the current metric/period with `SELECT ... FOR UPDATE` (creating it first if absent, inside the same transaction).
2. It checks `count < limit` (limit resolved from `B8_ENTITLEMENT_MODEL.md`'s step-4/5 result, read moments earlier in the same request) — if `count >= limit`, the command aborts with `403 QUOTA_EXHAUSTED` before any other side effect.
3. If admitted, `count` is incremented by 1 and a `usage_ledger` row is appended, in the same transaction as the domain's own state change (e.g., the `Lead` row, the `DiscoveryJob` row).
4. A transaction rollback (for any reason) undoes the counter increment and the ledger row together — quota is "consumed only on committed effect" (`B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §6, invariant 6), never pre-reserved outside the transaction and never released by a separate compensating step.

No Redis counter, cache, or lock ever participates in this decision (§`B8_CONCURRENCY_MODEL.md` §1) — PostgreSQL's row lock and the unique constraint are the sole authority, identical to the discipline B1 states for `seats` and B7 already applies for `automationRuns`.

## 5. Arithmetic invariant

`remaining = limit - usage` always holds when `limit` is non-null (matching the frontend's own self-check, `FB-B8-074`: `getS11IntegrityReport()` asserts exactly this identity). When `limit` is null, `remaining` is always null, never a sentinel like `-1` or `Infinity`.

## 6. What Phase 1 does not do

No overage billing, no burst credits, no pay-per-unit metering above a plan's limit (`B8-D-B007`, closing `B3-D-C007` — Class C, Phase-2). Exhausting a quota is a hard `403 QUOTA_EXHAUSTED`; the only Phase-1 remedies are waiting for the next period (`reset_at`), an admin-granted `EntitlementOverride` (§`B8_ENTITLEMENT_MODEL.md` §5 step 5), or an upgrade.
