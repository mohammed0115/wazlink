# B8 — Plan Catalog

> Design only. No Django model or migration is created.

## 1. Entities

**Plan** (frozen `PLAN-*`, global bounded catalog, `plans` table, unchanged ownership) is the durable identity and marketing metadata anchor: `code` (`PLAN-STARTER`/`PLAN-GROWTH`/`PLAN-SCALE`, frozen frontend slugs per `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §3 and `FB-B8-001`), `name`, `active`/`retired` lifecycle flag, `current_version_id` (FK, nullable only during initial seed). A Plan is never priced directly — every commercial fact lives on its **PlanVersion**.

**PlanVersion** (new, `B8-D-A003`, additive) is the immutable price/limit snapshot for one plan at one effective period: `plan_id` FK, `version` integer (monotonic per plan, starting at 1), `price` (`MoneyDTO`-shaped: `NUMERIC(19,4)` + ISO-4217 `currency`), `billing_period` (`monthly`|`annual`), `effective_from`, `effective_to` (nullable — null means currently in force), `created_at`. PlanVersion is **not independently publicly addressable** — no new public-ID prefix is minted (brief §45's "internal child entities should not automatically receive public IDs"); it is referenced only via `(plan_ref, version)` or by internal FK, mirroring how B7's `automation_rule_revisions` stays embedded under its parent rule.

**PlanCapability** (frozen table name `plan_capabilities`, re-scoped to `plan_version_id` rather than `plan_id`): `plan_version_id` FK, `capability_code` (one of the 6 frozen codes), `allowed` boolean.

**QuotaDefinition** (frozen table `quota_definitions`, unchanged as the metric catalog): `metric_code` (one of the 5 frozen codes: `leads`, `discoveryRuns`, `seats`, `automationRuns`, `aiAnalyses`), `unit` (`count`), `reset_policy` (`rolling_period` | `calendar_period` — see `B8_USAGE_QUOTA_MODEL.md` §3), `description`.

**PlanVersionQuota** (new, additive, table `plan_version_quotas`): `plan_version_id` FK, `metric_code` FK to `quota_definitions`, `limit_value` integer nullable (`null` = unlimited, matching the frozen frontend's `LimitDefinition` kind `unlimited`; a present-but-zero row is distinct from an absent row — see §3).

## 2. Why PlanVersion, not a bare mutable `Plan.price`

Frozen `plans` (per `BACKEND_DATA_MODEL.md`'s Entitlements table group) carries no version concept. Without one, editing today's catalog price would retroactively reprice every existing subscription the next time its entitlements are re-evaluated — violating the brief's §7 requirement that "a subscription must not silently change historical commercial terms because someone edits today's plan catalog." `UpgradeQuote` already solves this for the **purchase-time** price (it snapshots `amount`/`currency` directly, per frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`), but nothing in frozen B0 solves it for the **ongoing entitlement grant** a ​subscription is committed to after activation. PlanVersion closes that gap: `Subscription.plan_version_id` (new column, additive) pins the committed capability/quota grant at activation time, independent of whatever the catalog says today.

## 3. Reading a plan version's grants

A `PlanVersion`'s effective capability/quota set is the union of its `PlanCapability` rows (`allowed = true`) and its `PlanVersionQuota` rows. A capability with no `PlanCapability` row for that version is **denied by default** (§`B8_ENTITLEMENT_MODEL.md` §1 — no missing row ever grants access). A metric with no `PlanVersionQuota` row for that version is **treated as `limit = 0`** (default-deny for quotas mirrors the same rule; an explicit `null` row is required to grant `unlimited`, so "forgot to seed a limit" fails closed, not open).

## 4. Plan lifecycle

`active` → `retired`. A `retired` Plan (all its PlanVersions) may not be named in a new `QuoteRequest.plan_ref` (`PLAN_RETIRED`, new `code` value, `422`, within the existing `VALIDATION_ERROR` envelope — no new HTTP status). A `retired` Plan's existing subscriptions are unaffected and continue on their already-committed `plan_version_id` until the workspace changes plan or cancels. Retirement is reversible only by creating a new PlanVersion under the same Plan (a Plan is never permanently sealed) — there is no `deleted` state; Plans are never hard-deleted (consistent with `BACKEND_DATA_MODEL.md`'s general append-orientation for financial-adjacent records).

## 5. Effective-period rule

At most one `PlanVersion` per Plan has `effective_to IS NULL` at any time (partial unique index `(plan_id) WHERE effective_to IS NULL`). Publishing a new version sets the prior current version's `effective_to` to the new version's `effective_from` in the same transaction — a plan-catalog write is a two-row transactional update, never a bare price mutation on the existing row. `QuoteRequest`/`CreateUpgradeQuote` always resolves the plan's **current** (`effective_to IS NULL`) version at quote-issue time; the resulting `UpgradeQuote.amount` is copied from that version's price and is thereafter independent of it (§2).

## 6. Phase-1 seed data (illustrative, not frozen pricing authority)

The frontend's `mockModel.plans` fixture (`FB-B8-003`) is prototype-only evidence (Class D), but its 3-tier shape and relative ordering are used as the Phase-1 catalog-seeding illustration, per `B8-D-B008`:

| Plan | Capabilities (v1) | leads | discoveryRuns | seats | automationRuns | aiAnalyses |
|---|---|---:|---:|---:|---:|---:|
| `PLAN-STARTER` | `discovery.basic`, `crm.core`, `export.csv` | 200 | 10 | 3 | 0 (capability `automation.rules` = `false`) | 20 |
| `PLAN-GROWTH` | `discovery.basic`, `crm.core`, `export.csv`, `pipeline.core`, `inbox.copilot`, `automation.rules` | 1,000 | 50 | 10 | 200 | 100 |
| `PLAN-SCALE` | identical capability set to GROWTH (`FB-B8-004` — SCALE differs by limit, not by capability) | 5,000 | 250 | 30 | 1,000 | 500 |

STARTER's `automationRuns` limit is irrelevant (capability `automation.rules = false` means `ENTITLEMENT_LOCKED` fires before any quota check, per the frozen ordering in `B1_AUTHORIZATION_RBAC.md` §1: "Quota is meaningless for a capability the plan does not include"). These exact figures are Product-Owner-adjustable catalog **data**, not an architecture constraint — changing them is a PlanVersion publish, never a code change, and never requires a new controlled amendment (`B8-D-B008`).

## 7. Currency and billing period

Phase 1 prices every `PlanVersion` in `SAR` only, matching `BACKEND_ANALYTICS_SEMANTICS.md`'s "Phase 1 defaults to SAR." Multi-currency plan pricing is out of scope (`B8-D-C001`, Class C). `billing_period` is `monthly` for every Phase-1 PlanVersion; `annual` is a reserved enum value with no seeded row (Class C, deferred, no architecture blocker — the schema already supports it).

## 8. Storage

| Table | Workspace scope | Mutability | Notes |
|---|---|---|---|
| `plans` | global (no `workspace_id`) | `code`/`name` mutable; `current_version_id` mutable by version-publish transaction only | frozen table, additive columns only |
| `plan_versions` | global | immutable once `effective_to` is set; price/limits fields immutable always | new table |
| `plan_capabilities` | global | immutable per version | re-scoped FK from `plan_id` to `plan_version_id` |
| `quota_definitions` | global | rarely mutated (adding a 6th metric requires a controlled amendment, §`B8_DECISION_REGISTER.md`) | frozen table |
| `plan_version_quotas` | global | immutable per version | new table |
