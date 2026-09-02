# B11 — Billing & Quota Boundary (B8)

> Design only. B8 is frozen. B11 creates no plan, no capability, no quota metric, and no second entitlement truth.

## 1. B8 owns entitlement truth — without exception

Frozen `B8_ENTITLEMENT_MODEL.md` and `B8_USAGE_QUOTA_MODEL.md` establish that B8 owns the *row* (schema, period semantics, numeric limit per plan tier) for every metered metric, while **the domain that owns the metered action performs its own transactional reservation** against B8's row. B11 adopts that division unchanged; it is the same shape B1 uses for `seats`, B7 for `automationRuns`, and B4 for `aiAnalyses`.

> **`B11-D-A020`.** If a storage limit is ever product-entitlement-controlled, B8 is its sole authority: the metric code, the unit, the reset policy, and every per-plan-version limit value live in `quota_definitions` and `plan_version_quotas`. B11 would *consume* the resolved effective limit through B8's existing `EvaluateEntitlement` result and reserve against `usage_counters` under a row lock, exactly as every other reserving domain does. B11 would define no limit, publish no plan, and store no per-workspace allowance.

## 2. Phase 1 has no storage entitlement metric, and B11 does not create one

Frozen `B8_PLAN_CATALOG.md` names exactly five metric codes — `leads`, `discoveryRuns`, `seats`, `automationRuns`, `aiAnalyses` — and states in its own §8 that *"adding a 6th metric requires a controlled amendment."* No storage metric exists. The frozen frontend corroborates independently: `getBillingUsage()` (`client/src/domain/data.js:1038`) computes usage for exactly those five keys and no other, and the Billing usage panel renders whatever that returns (`FB-B11-011`).

**B11 does not file that amendment.** Introducing a sixth metric would mean inventing per-plan storage allowances (STARTER = ?, GROWTH = ?, SCALE = ?) with zero product input and zero frontend evidence — precisely the "relational fixture shape alone does not justify a persistent resource" error, one layer up. Whether storage becomes a commercially differentiated entitlement is a **product decision B8 owns**, recorded here as `B11-D-B001` and left open rather than pre-empted.

`QUOTA_AUTHORITY_LEAKS = 0` follows: there is no B11 table, column, constant, or DTO that expresses a per-plan or per-workspace commercial storage allowance.

## 3. What B11 does enforce: a platform safety ceiling

A domain that stores unbounded bytes with no limit at all is not neutral — it is a denial-of-service surface (§28's "storage exhaustion"). B11 therefore enforces two ceilings, both of which are deliberately **not** entitlements:

| Ceiling | Value | Why it is not an entitlement |
|---|---|---|
| `MAX_FILE_BYTES` | 25 MiB (proposed, `PRODUCT DECISION REQUIRED`) | uniform for every workspace on every plan; deployment configuration, not catalog data |
| `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` | 5 GiB (proposed, `PRODUCT DECISION REQUIRED`) | uniform for every workspace on every plan; never surfaced as an `EntitlementDecision`; never varies by `Subscription` or `PlanVersion`; changing it is a config change, never a plan publish |

The distinguishing test, applied deliberately: **an entitlement is something a customer can change by buying something.** Neither ceiling is. They are abuse controls of the same class as `BACKEND_RATE_LIMIT_POLICY.md`'s "General API | 300/min/workspace" row, which is likewise uniform and likewise not a plan attribute.

Both breaches return the **frozen** `403 QUOTA_EXHAUSTED` (`BACKEND_ERROR_CATALOG.md`) — B11 mints no `FILE_QUOTA_EXCEEDED` code, because the frozen code's meaning ("quota unavailable") already covers it exactly and a near-duplicate would fragment client handling for no benefit (`B11_FAILURE_CATALOG.md` §3).

## 4. When a storage entitlement is eventually introduced

The migration path is designed now so that adopting it is additive, and is recorded rather than built:

1. B8 files its own controlled amendment adding `storageBytes` to `quota_definitions` with `unit='byte'` (B8's frozen `unit` today is `count`; extending the unit vocabulary is B8's amendment to make, not B11's) and a `calendar_period`-or-point-in-time reset policy — storage is a point-in-time capacity figure like `seats`, not a per-period consumption like `leads`, which is a B8 modelling decision.
2. B8 seeds `plan_version_quotas` rows. Per B8's own default-deny rule, a metric with no row is treated as `limit = 0` — so B8 must seed every plan version before enabling the metric, or storage stops working for everyone. That ordering constraint is noted here because B11 is the domain that would break.
3. B11 changes exactly one thing: the enforcement point in `B11_STORAGE_USAGE_MODEL.md` §4 resolves its ceiling from `EvaluateEntitlement('storageBytes')` instead of from configuration, and reserves against `usage_counters` in the same transaction. The state machines, commands, events, DTOs, tables, and every acceptance test are unchanged.
4. The platform safety ceiling **remains** in force as a floor-level abuse control, evaluated as `min(entitlement, safety_ceiling)` — an entitlement never widens past what the platform can safely serve.

## 5. B11 measures usage; it does not price it

B11 maintains `workspace_storage_usage` as a **locked, repairable accumulator** whose authority is derived from `file_assets` and provable against it (`B11_STORAGE_USAGE_MODEL.md` §2). It is a measurement, not a commercial figure: it carries no money, no currency, no plan reference, no period boundary tied to a billing cycle, and no `EntitlementDecision` shape. B8 may read it if B8 ever wants to price storage; B11 will never tell B8 what it costs.

## 6. Negative controls

`AT-B11B8-1` **(NC)**: a B11 command, worker, or migration writing `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas`, `subscriptions`, `usage_counters`, or `usage_ledger` — fails.
`AT-B11B8-2` **(NC)**: a B11 table, column, or DTO expressing a per-plan or per-workspace commercial storage allowance — fails.
`AT-B11B8-3` **(NC)**: B11 returning an `EntitlementDecision`, or any DTO shaped like one, for storage — fails.
`AT-B11B8-4` **(NC)**: the safety ceiling varying by plan, subscription, or workspace — fails.
`AT-B11B8-5` **(NC)**: a B11 document asserting a per-plan storage limit figure — fails.
