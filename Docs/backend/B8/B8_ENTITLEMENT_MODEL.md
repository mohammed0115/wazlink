# B8 — Entitlement Model

> Design only. Adopts the frozen B1 entitlement vocabulary verbatim (`B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §3); B8's contribution is the plan-to-capability mapping, the numeric limits, and the deterministic resolution algorithm B0/B1 explicitly deferred to this phase (`B7-D-B009`).

## 1. Closed vocabulary (frozen, reused verbatim — zero additions)

| Element | Values | Source |
|---|---|---|
| Capabilities (6) | `discovery.basic`, `crm.core`, `export.csv`, `pipeline.core`, `inbox.copilot`, `automation.rules` | `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §3, `FB-B8-001` |
| Usage metrics (5) | `leads`, `discoveryRuns`, `seats`, `automationRuns`, `aiAnalyses` | same |
| Statuses (4) | `AVAILABLE`, `LIMITED`, `EXHAUSTED`, `LOCKED` | same |
| Upgrade reasons (3) | `capability_locked`, `usage_exhausted`, `higher_limit` | same |
| Plans (3) | `PLAN-STARTER`, `PLAN-GROWTH`, `PLAN-SCALE` | same |

B8 mints no sixth metric, seventh capability, or fifth status. A missing entitlement row never grants access — default-deny is structural (§`B8_PLAN_CATALOG.md` §3), not a runtime check that could be forgotten.

## 2. Capability → metric pairing (frozen, `CAPABILITY_USAGE`, `FB-B8-005`)

| Capability | Gating metric |
|---|---|
| `discovery.basic` | `discoveryRuns` |
| `crm.core` | `leads` |
| `automation.rules` | `automationRuns` |
| `inbox.copilot` | `aiAnalyses` |
| `export.csv` | *(boolean only — no metered pairing)* |
| `pipeline.core` | *(boolean only — no metered pairing)* |

`seats` has no owning capability — it is a Workspace/Membership-domain metric enforced by B1's own `seats` reservation (`B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §4), which B8 supplies the numeric limit for but does not itself reserve against (§`B8_USAGE_QUOTA_MODEL.md` §1).

## 3. `EntitlementDecision` — internal resolution result (closed shape)

```
{
  code: string,                       // capability code or metric code
  type: "capability" | "quota",
  status: AVAILABLE | LIMITED | EXHAUSTED | LOCKED,
  allowed: boolean,
  limit: integer | null,              // null = unlimited; present only for type=quota
  usage: integer | null,              // present only for type=quota
  remaining: integer | null,          // present only for type=quota; null if limit is null
  reset_at: timestamp | null,         // present only for type=quota
  source: "plan" | "trial" | "override" | "grace" | "deny_floor",
  reason: capability_locked | usage_exhausted | higher_limit | null,
  target_plan_ref: EntityRef | null,
  evaluated_at: timestamp
}
```

This is the full internal closed result the brief §10 asks for. It is never returned to a client as-is; it is projected onto the two already-frozen transport DTOs (§6).

## 4. Status derivation (deterministic, no ambiguity)

```
if source == "deny_floor":            status = LOCKED (capability) or EXHAUSTED (quota); allowed = false
elif type == "capability":
    allowed = (capability is granted by the resolved source)
    status  = AVAILABLE if allowed else LOCKED
    reason  = null if allowed else "capability_locked"
elif type == "quota":
    if limit is null:                 status = AVAILABLE; remaining = null
    elif usage >= limit:               status = EXHAUSTED; allowed = false; reason = "usage_exhausted"
    elif usage >= 0.9 * limit:         status = LIMITED (advisory only); allowed = true
    else:                              status = AVAILABLE; allowed = true
```

`target_plan_ref` is populated (frozen `evaluate()` behavior, `FB-B8-012`) only on `LOCKED`/`EXHAUSTED`, resolving to the cheapest active Plan whose current PlanVersion both grants the capability and (for quotas) sets a strictly higher or null limit; `reason = "higher_limit"` is used only in read-model upgrade-suggestion contexts (e.g. suggesting SCALE over GROWTH for a metric both plans grant but at different ceilings), never as a denial reason. `LIMITED` is advisory exactly as frozen B1 states — "never a denial" — and is a UI hint derived at read time, not a stored state.

## 5. Precedence order (closed, deterministic — brief §10's required ordering, `B8-D-A004`)

Evaluated top-to-bottom; the first applicable rule wins and short-circuits the rest:

1. **Workspace state.** If the workspace itself (B1-owned `Workspace.status`) is `suspended`, `archived`, or `deleting`, every capability is `LOCKED` and every quota is `EXHAUSTED`, `source = "deny_floor"`, regardless of subscription state. This is a Workspace-authority override, not a Billing decision — Billing never re-derives or contradicts it.
2. **Subscription lifecycle deny floor.** If `Subscription.status ∈ {suspended, expired}` (or `cancelled` past `current_period_end` — momentarily true only during the sweep, §`B8_SUBSCRIPTION_STATE_MACHINE.md` §3), every capability is `LOCKED` and every quota is `EXHAUSTED`, `source = "deny_floor"` (`B8-D-A006`).
3. **Grace.** If `Subscription.status == past_due`, resolution proceeds to step 4 using the subscription's committed `plan_version_id` exactly as if `active` — grace preserves full access (`B8-D-A007`); `source` is reported as `"grace"` so read models can surface an at-risk indicator without denying anything.
4. **Trial-or-plan base grant.** If `Subscription.status == trialing`, resolve against the trial's assigned `plan_version_id`, `source = "trial"`. Otherwise resolve against `Subscription.plan_version_id`, `source = "plan"`. This is the PlanVersion capability/quota lookup from `B8_PLAN_CATALOG.md` §3.
5. **Override broadening (`B8-D-A021`).** Query `entitlement_overrides` for the row where `workspace_id` matches, `code` matches, and `status = 'active'`. Storage guarantees **at most one** such row can exist per `(workspace_id, code)` at any time (`B8_STORAGE_MODEL.md` §`entitlement_overrides`, partial unique index) — this is a structural invariant, not a runtime check the algorithm must defend against by choice.
   - **Zero rows found** → the step-4 result stands unchanged; `source` remains `"plan"`/`"trial"`/`"grace"`.
   - **Exactly one row found, and `expires_at IS NULL OR expires_at > now()`** → apply its declared effect (§5a/§5b below) to the step-4 result; `source = "override"`.
   - **Exactly one row found, but `expires_at <= now()`** (the row is logically expired but a sweep has not yet closed it — the same lazy-evaluation posture already established for `UpgradeQuote.status`, `B8_PLAN_CATALOG.md`/`BACKEND_BILLING_TAX_ARCHITECTURE.md`) → treated identically to "zero rows found"; the step-4 result stands. The reconciliation sweep (§`B8_RECONCILIATION_MODEL.md`) MAY subsequently transition the row's `status` to `expired` for audit/read-model accuracy, but correctness of this algorithm never depends on that sweep having run.
   - **More than one active row found for the same `(workspace_id, code)`** — this state is unreachable through any governed command (the partial unique index makes it a database-level impossibility) and therefore represents data corruption, not a legitimate business state. Resolution MUST NOT sum, take the maximum, or apply "latest wins" — it fails closed: the code returns `LOCKED`/`EXHAUSTED` with `source = "deny_floor"`, and raises an observable `500 INTERNAL_ERROR` plus a `RECONCILIATION_MISMATCH`-class operational alert (`B8_OBSERVABILITY_AUDIT.md` §4), identical in spirit to §8's general fail-safe posture. It never falls through silently to an `AVAILABLE`/broadened result.

### 5a. Boolean capability override — absolute grant

`override_type = "grant_capability"` is legal only with `value = true` (`B8-D-A021`). Its effect is an absolute replacement: `allowed := true`, `status := AVAILABLE`, unconditionally — it does not matter what step 4 computed, because the only thing a capability override could ever do is unlock an otherwise-`LOCKED` capability (an override can never set `value = false` to re-lock a capability the plan already grants; such a request is rejected at creation time, §5c). A `grant_capability` override targeting a capability the plan already grants is legal but a no-op on the *outcome* (still `AVAILABLE`) — the row still exists for its own audit trail (e.g., "grandfathered access if the plan changes later").

### 5b. Metered quota override — absolute stored value, resolved as a broadening floor against the *current* base (`B8-D-A022`)

`override_type = "extend_quota"` carries `value: integer | null` (`null` = unlimited). The value **stored on the row is an absolute limit number, never an additive delta** — a stored `value = 200` means "200," not "+200," and this does not change below. What changes (`B8-FIX.2`, closing `AUD-MAJ-2`) is how that stored value combines with the base at *resolution* time.

An override is, by definition (§5, `B8-D-A014`: "grants only, never restricts below plan"), a grant-only, broadening-only capability relative to the workspace's **current** commercial base — never a mechanism that can freeze a customer below whatever they are currently, commercially entitled to. A metered override's effective limit is therefore computed, on every resolution, as:

```
if override.value IS NULL:                    effective_limit = unlimited        # unlimited always dominates
elif step4_limit is unlimited:                 effective_limit = unlimited        # unlimited base already dominates
else:                                           effective_limit = MAX(step4_limit, override.value)
```

where `step4_limit` is the limit step 4 just computed **fresh, in this same resolution, against the workspace's currently effective `PlanVersion`/trial** (never a value cached or captured at the override's grant time), and `override.value` is the override row's own stored absolute number. `remaining` is recomputed as `effective_limit − usage` (or `null` if `effective_limit` is unlimited).

This is still not additive/stacking, and does not contradict "absolute, not additive": the override contributes exactly one absolute number (or "unlimited"), compared once against exactly one other absolute number (the freshly-resolved current base), through a single deterministic `MAX` — never `base + override`, and never a running total across multiple overrides (the single-active-row invariant in §5 guarantees there is only ever one override value in this comparison). `MAX` is not addition; it is a floor. Concretely:

- Base 100, override granted at 200 → `MAX(100, 200) = 200`.
- Base later upgraded to 300 while the same override (still `value=200`) remains active → `MAX(300, 200) = 300`. The override becomes a no-op at resolution time — it is not deleted, revoked, or rewritten, it is simply dominated by a now-higher base — and the upgraded plan's own limit is what the workspace sees, never the stale 200.
- Base later downgraded to 50 while the same override remains active → `MAX(50, 200) = 200`. The override continues to broaden until it itself expires or is revoked (§`B8_STORAGE_MODEL.md` lifecycle) — a downgrade never silently erases a still-active grant.

See §5b-i for the full plan-change interaction this closes, `B8_UPGRADE_DOWNGRADE_MODEL.md` §8 for the cross-referenced narrative, and `B8-D-A022` in `B8_DECISION_REGISTER.md`.

### 5b-i. Plan-version change interaction (`B8-D-A022`, closes `AUD-MAJ-2`)

The apparent contradiction the original wording created — "the stored value is an absolute replacement" read alongside "overrides may only broaden, never restrict below plan" — is resolved by separating two distinct ideas that were previously conflated under one word ("absolute"): the **stored row value** is absolute (a number, not a delta — true both before and after this fix), while the **resolved effective limit** is a `MAX` against the current base (new in this fix, previously the row value was applied unconditionally with no such comparison). Explicitly, for every event that can change which `PlanVersion`/trial a subscription currently resolves against:

- **Upgrade.** `SubscriptionActivated` updates `plan_version_id` (`B8-D-A011`); the very next resolution recomputes `step4_limit` from the new, higher-limit `PlanVersion` and applies `MAX(step4_limit, override.value)` — a stale, now-dominated override never claws the workspace back down to its old, lower frozen value.
- **Downgrade.** `ApplyScheduledDowngrade` updates `plan_version_id` at the period boundary (`B8-D-A008`); resolution recomputes `step4_limit` from the new, lower-limit `PlanVersion`, and the still-active override continues to broaden above it via `MAX` until the override itself expires or is revoked — a downgrade never implicitly revokes an unrelated, independently-lifecycled override row.
- **Trial conversion.** `trialing → active` changes which `plan_version_id` step 4 resolves against (§4); the same `MAX` rule applies unconditionally at resolution time — trial conversion needs no override-specific handling because resolution never caches step 4's result across the transition.
- **Plan-version migration (catalog-only, no subscription change).** Publishing a new `PlanVersion` for a `Plan` (e.g., a Product-Owner price/limit revision, `B8-D-B008`) does **not**, by itself, change any `Subscription.plan_version_id` — a subscription remains pinned to its already-committed version (`B8-D-A003`) until its own upgrade/downgrade event moves it. A catalog-only migration therefore has **no effect** on any override's effective limit until the subscription itself transitions.
- **Override expiration.** Once an override's `status` is (or would be, per the read-time rule in §5) treated as inapplicable, it drops out of the `MAX` entirely — `effective_limit` falls back to `step4_limit` alone, i.e., whatever the *current* base is at that moment, regardless of what the base was when the override was granted or when it expired.
- **Override revocation.** Identical to expiration — a revoked override no longer participates in `MAX`; the current base (post-downgrade, post-upgrade, whichever is committed at read time) applies on its own.

**No override row is ever mutated, rewritten, or invalidated by a plan-version change.** The row's own `value`/`status`/`expires_at` are exactly as the admin granted or revoked them (§`B8_STORAGE_MODEL.md` lifecycle: `value_int` is immutable after creation). Only the *resolution-time computation* — which always re-reads the current base fresh — changes what that stored value means in combination with a now-different base. This is why no override ever needs a plan-change-triggered write: correctness lives entirely in the read-time `MAX`, not in keeping the stored row "in sync" with the catalog.

**Concurrency.** Resolution is read-only and computed inside its own transaction from whatever `plan_version_id`/override state is currently committed (§7: no caching). A plan-version transition (upgrade/downgrade commit) and a concurrent entitlement resolution are therefore never in a read-modify-write race with each other — standard read-committed isolation guarantees a resolution sees either the fully-pre- or fully-post-transition committed state, never a partial one, and because `step4_limit` is always read fresh (never a value carried over from a prior resolution), the `MAX` result can never reflect a base older than whatever was last committed. See `B8_CONCURRENCY_MODEL.md` C13.

### 5c. Creation-time validation (closes the "never lower" invariant at the write boundary, not only at read time)

`GrantEntitlementOverride` rejects, with `422 ENTITLEMENT_OVERRIDE_INVALID`, any request where: `code` is not one of the 6 capability codes or 5 metric codes (§1); `override_type = "grant_capability"` and `value != true`; or `override_type = "extend_quota"` and `value` is a finite integer that does not strictly exceed the plan's own current-limit (computed from step 4, ignoring any prior override) — a request that would not actually raise anything is refused rather than silently accepted as a no-op grant, keeping every stored override row meaningful. This grant-time check is a courtesy (it refuses to create a row that would be an immediate no-op *at the moment of granting*) and is intentionally independent of §5b's read-time `MAX` — a grant that is meaningful today (`value` exceeds today's base) may legitimately become a no-op tomorrow if the base is later upgraded past it (§5b-i), and that is correct, not a validation failure to prevent.

No step is ever skipped or reordered at runtime; this table is the entire algorithm.

## 6. Transport projection (frozen DTOs, unchanged shape + additive fields)

`GET /api/v1/entitlements` returns `EntitlementList` of frozen `EntitlementDecision` (`{capability, status, allowed, usage?, remaining?, target_plan_ref?, evaluated_at}`) for every `type=capability` result, restricted to the 6 capability codes. `GET /api/v1/usage` returns `UsageDTO` (`{capability, used, limit?, remaining?, period}`) for every `type=quota` result, restricted to the 5 metric codes — note the frozen field is literally named `capability` on `UsageDTO` even though it carries a metric code; B8 does not rename it (no frozen field is ever renamed).

**`B8-D-A005` (additive amendment).** `EntitlementDecision` gains three nullable, optional fields: `reset_at`, `source`, `reason` — none required, `additionalProperties` unaffected for any existing consumer since the fields are additive and nullable. This closes the gap between the frozen transport shape and the fuller internal result in §3, without breaking `FB-B8-012`–`017`'s existing consumption of the unmodified fields. See `B8_CONTROLLED_AMENDMENTS.md` item 3.

## 7. No server-side caching

Every resolution is computed at request time from PostgreSQL reads (`Subscription`, `PlanVersion`, `EntitlementOverride`, `usage_counters`) inside the request's own transaction — no Redis-cached decision, per `BACKEND_DATA_GOVERNANCE.md`'s "caching authorization decisions is prohibited unless invalidation and TTL are formally proven," which B8 does not attempt to prove for Phase 1. `B8-D-C006` (Class C) records server-side entitlement-decision caching as a future performance optimization only, gated behind a formal invalidation proof.

## 8. Fail-safe posture

If any read in the resolution chain fails (database error, missing PlanVersion row that should exist), the result is `LOCKED`/`EXHAUSTED` with `source = "deny_floor"` and a `500 INTERNAL_ERROR` is raised to the caller rather than a silent `AVAILABLE` — commercial access control fails closed, never open, matching brief §47's "commercial access control should fail safely" and closing the same class of risk `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §6 states for RBAC ("no single error code may mean two of the three").
