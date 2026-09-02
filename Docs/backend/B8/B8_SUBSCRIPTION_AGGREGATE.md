# B8 — Subscription Aggregate

> Design only. No Django model or migration is created.

## 1. Cardinality and invariant

**Exactly one non-terminal Subscription row exists per workspace at any time.** "Non-terminal" excludes rows in a hypothetical historical-archive sense — Phase 1 does not multi-row subscription history; a workspace's subscription is a single mutable row (`SUB-*`, workspace-scoped, unique on `workspace_id` where the row is the current one — enforced by `subscriptions.workspace_id` being a plain unique column, since Phase 1 never needs two simultaneous subscriptions per workspace). Historical *periods* and *changes* remain reconstructible from the immutable `PlanVersion` a subscription references over time plus the append-only outbox/audit trail (`AUD-*`), not from multiple `subscriptions` rows — this satisfies the brief's §11 "one current commercial subscription state per workspace, with immutable historical subscription periods/changes where appropriate" without introducing a second, harder-to-reason-about row-versioning scheme on top of the already-frozen `version` optimistic-concurrency column.

## 2. Can a workspace exist without a paid subscription?

No. Every workspace has exactly one Subscription row from the moment it is created — never a null/absent relationship. This resolves the brief's §11 open question directly: `WorkspaceCreated` (frozen B1 event) is consumed by Billing's `BootstrapWorkspaceSubscription` (new, system-actor command, `B8-D-A006`'s companion), which creates a `Subscription` row bound to a default entry-tier `PlanVersion` inside the same idempotent consumption transaction. `B1_COMMAND_EVENT_CATALOG.md` already names this exact obligation: *"consumer must not create two subscriptions for one `workspace_ref`"* — enforced by the unique `workspace_id` column plus the frozen at-least-once-consumer idempotency doctrine (dedup on `(consumer, event_id)`).

## 3. What entitlement state applies immediately after workspace creation?

The bootstrapped Subscription starts in state `active`, committed to `PLAN-STARTER`'s current `PlanVersion` (§`B8_PLAN_CATALOG.md` §6) — **not** `trialing`, because `trialing` requires an approved trial policy that Phase 1 does not activate (`B8-D-B001`). A brand-new workspace therefore has full STARTER-tier entitlements from second one, with no card-collection step blocking product use — matching the frozen frontend's onboarding flow, which never gates account creation behind checkout (`FB-B8-020`/`FB-B8-021` — onboarding recommends a plan, it does not require payment first).

## 4. Trial relationship

Because bootstrap always lands on `active`/STARTER rather than `trialing`, "what happens when trial expires" (brief §11) does not arise in Phase 1's default path — there is no default trial to expire. If Product Owner policy later activates trials (`B8-D-B001`), a trial is an explicit, separately-initiated state entered from `active` (or offered at bootstrap time as an alternative to STARTER) — full mechanics are in `B8_TRIAL_MODEL.md`, gated behind that same decision.

## 5. Fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `public_id` | `SUB-*` | frozen prefix, workspace-scoped uniqueness |
| `workspace_id` | FK, unique, NOT NULL | tenancy anchor |
| `status` | enum | §`B8_SUBSCRIPTION_STATE_MACHINE.md` |
| `plan_version_id` | FK, NOT NULL | committed entitlement grant (new column, `B8-D-A003`) |
| `pending_plan_version_id` | FK, nullable | set only while a downgrade is scheduled (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §4); never set for an upgrade, which is immediate |
| `billing_customer_id` | FK, nullable | resolved on first payment; null before any purchase |
| `current_period_start` | UTC timestamp, NOT NULL | |
| `current_period_end` | UTC timestamp, NOT NULL | drives renewal and grace-period timing |
| `trial_end` | UTC timestamp, nullable | non-null only while `status = trialing` |
| `cancel_at_period_end` | boolean, default false | §`B8_CANCELLATION` in `B8_UPGRADE_DOWNGRADE_MODEL.md` §6 |
| `cancelled_at` | UTC timestamp, nullable | set when `cancel_at_period_end` is first requested, not when the period actually ends |
| `version` | integer | optimistic concurrency, ADR-010 pattern |
| `created_at` / `updated_at` | UTC timestamps | |

## 6. Invariants

1. `workspace_id` is unique — enforced at the database level, not just application logic (closes the "two subscriptions for one workspace" race from `B1_COMMAND_EVENT_CATALOG.md`'s own warning).
2. `plan_version_id` always resolves to a `PlanVersion` row that existed at the moment it was committed; a subscription is never left pointing at a row that "doesn't exist yet" (assignment only happens transactionally alongside a real `PlanVersion` read).
3. `pending_plan_version_id` is non-null only when `cancel_at_period_end = false` and a downgrade is scheduled; a subscription is never simultaneously scheduled for cancellation and a downgrade — cancellation supersedes a pending downgrade (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §6, race rule).
4. `status` transitions only through the state machine in `B8_SUBSCRIPTION_STATE_MACHINE.md` — no ad hoc value is ever written directly.
5. Every transition is a Billing-owned command execution (§`B8_DOMAIN_OWNERSHIP.md` `B8-D-A001`) that both updates this row and appends an outbox event in the same transaction (ADR-005).

## 7. Read access

Every other domain (including `entitlements`) reads Subscription only through `BillingService.get_current_subscription(workspace_id)` — never a direct table join — matching the ownership split in `B8_DOMAIN_OWNERSHIP.md` §2. The response is a plain, versioned read (no caching, no Redis) consistent with `BACKEND_DATA_GOVERNANCE.md`'s "caching authorization decisions is prohibited unless invalidation and TTL are formally proven," which B8 has not attempted to prove for Phase 1 (§`B8_ENTITLEMENT_MODEL.md` §7).
