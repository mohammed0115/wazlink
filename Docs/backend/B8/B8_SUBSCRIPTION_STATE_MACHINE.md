# B8 — Subscription State Machine

> Design only. Adopts the frozen `BACKEND_STATE_MACHINES.md` Subscription machine verbatim; adds only transition authority, effective timestamps, and terminal semantics, which B0 left unspecified.

## 1. Frozen states (unchanged, reused verbatim)

`trialing` (conditional — gated by `B8-D-B001`, inactive in Phase 1) → `active` → `past_due` → `suspended` → `active`; `active` → `cancelled` → `expired`. Six storage-layer values total: `trialing`, `active`, `past_due`, `suspended`, `cancelled`, `expired`. No seventh state (`grace`, `payment_required`, etc., all offered as brief-§12 examples) is added — `past_due` **is** the grace state (§3), and a payment-required condition is represented by `past_due` plus a non-null `payments` row in `failed`/`pending`, not by a distinct Subscription state.

## 2. Transition table

| From | To | Trigger | Authority | Effective timestamp |
|---|---|---|---|---|
| *(none)* | `active` | `BootstrapWorkspaceSubscription` | system (consumes `WorkspaceCreated`) | `WorkspaceCreated.occurred_at` |
| *(none)* | `trialing` | future trial-offer command | system/user (gated, inactive) | trial start |
| `trialing` | `active` | trial converts (payment captured) or Product-Owner-approved auto-convert | provider-triggered (webhook) or user-triggered | `PaymentSucceeded.occurred_at` |
| `trialing` | `expired` | trial window elapses with no conversion | system (reconciliation sweep) | `trial_end` |
| `active` | `active` | `SubscriptionActivated` on a **new** `plan_version_id` (upgrade) | provider-triggered (webhook, following `CreatePayment`) | `PaymentSucceeded.occurred_at` |
| `active` | `past_due` | a renewal charge fails or is not attempted by `current_period_end` | provider-triggered (webhook) or system (reconciliation) | payment-failure event time, or `current_period_end` if no attempt was ever made |
| `past_due` | `active` | outstanding renewal charge succeeds within the grace window | provider-triggered (webhook) | `PaymentSucceeded.occurred_at` |
| `past_due` | `suspended` | grace window elapses with no successful charge | system (reconciliation sweep, bounded window — §4) | grace-window-expiry instant |
| `suspended` | `active` | operator or workspace owner clears the payment issue (manual retry succeeds) | provider-triggered (webhook) after a user-initiated retry | `PaymentSucceeded.occurred_at` |
| `active` | `cancelled` | `cancel_at_period_end` reaches `current_period_end` | system (period-boundary sweep) | `current_period_end` |
| `active` (with `cancel_at_period_end=true`, before boundary) | `active` | `ReactivateSubscription` (undo) | user-triggered | command time |
| `cancelled` | `expired` | terminal housekeeping — no further access was ever granted past `current_period_end` | system | same instant as the `active→cancelled` transition (§3) |

No edge exists from `expired` back to any other state — `expired` is terminal (frozen). Reactivating an `expired` subscription is a **new purchase** (`CreateUpgradeQuote`→`CreatePayment`→`SubscriptionActivated`, landing back on `active`), not a state-machine transition on the same row's history; the same `SUB-*` row is reused (its `workspace_id` uniqueness invariant, §`B8_SUBSCRIPTION_AGGREGATE.md` §6, means a workspace never gets a second `SUB-*`), but its `status` moves `expired → active` only through the full re-purchase command sequence, never a bare `ReactivateSubscription` call (`ReactivateSubscription` is legal only against `active` rows that still have `cancel_at_period_end=true`, §6 below).

## 3. `active → cancelled → expired` are effectively simultaneous

Because Phase 1 grants no access beyond `current_period_end` for a cancelled subscription (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §6), the period-boundary sweep transitions `active → cancelled → expired` as one atomic system action rather than two separately-scheduled events — `cancelled` is retained as a distinct, real, momentarily-observable state (so an event listener or read model can distinguish "this workspace chose to leave" from "this workspace's trial lapsed") but never persists for longer than the sweep's own transaction. This is a closed design choice, not an ambiguity: brief §16 asked whether "cancel immediately" and "cancel at period end" both need designing; Phase 1 supports only the latter (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §6, `B8-D-A009`).

## 4. Grace window (`past_due`)

The grace window is a Billing-owned numeric parameter (illustrative Phase-1 default: 7 days from the first failed/missed renewal charge), stored as Entitlements-catalog-adjacent configuration data, not hardcoded — changing it is a data update, not an architecture change, mirroring `B8_PLAN_CATALOG.md` §6's treatment of plan-tier numbers. During `past_due`, entitlement resolution continues granting full access (§`B8_ENTITLEMENT_MODEL.md` §5, precedence step 4) — this is deliberate: an ambiguous or slow provider retry must not immediately cut off a paying customer, matching the frozen "Payment failure transitions to a payment failure/past-due state and cannot silently activate or extend a subscription" (`BACKEND_STATE_MACHINES.md`) read together with the reconciliation sweep's job of resolving ambiguity within a bounded window rather than instantly.

## 5. `suspended` semantics

`suspended` is the hard-deny floor (§`B8_ENTITLEMENT_MODEL.md` §5, same treatment as `expired`/`cancelled`-post-period): every capability resolves `LOCKED`, every quota resolves `EXHAUSTED`, mirroring the frozen Workspace-level `suspended` state's own doctrine in `BACKEND_WORKSPACE_AUTH.md` ("Suspension blocks writes and provider side effects while preserving authorized administrative access") — a suspended *subscription* blocks ordinary commercial capability, while a suspended *workspace* (a distinct, B1-owned state on a different aggregate) blocks broader account access; the two are independent axes and are not conflated.

## 6. Command/actor authority summary

| Command | Legal source states | Actor |
|---|---|---|
| `BootstrapWorkspaceSubscription` | *(none)* | system, consuming `WorkspaceCreated` |
| `CreatePayment` (upgrade path, indirectly transitions via webhook) | `active`, `past_due`, `trialing` | user (`subscription.change` permission) initiates; provider webhook completes |
| `CancelSubscription` (sets `cancel_at_period_end=true`) | `active`, `trialing`, `past_due` | user (`subscription.change`) or admin |
| `ReactivateSubscription` (clears `cancel_at_period_end`) | `active` with `cancel_at_period_end=true` | user (`subscription.change`) or admin |
| `ScheduleDowngrade` / `ApplyScheduledDowngrade` | schedule: `active`; apply: system at period boundary | user schedules; system applies |
| reconciliation-driven transitions (`active→past_due`, `past_due→suspended`, `past_due→active`) | per row above | system (`ReconcilePayment`, scheduled) |
| period-boundary sweep (`active→cancelled→expired`) | `active` with `cancel_at_period_end=true` | system (scheduled) |

No transition is ever performed by an automation rule (`B8_B7_AUTOMATION_BOUNDARY.md`) or inferred from a frontend redirect/query parameter (`BACKEND_BILLING_TAX_ARCHITECTURE.md` "Payment truth," restated in `B8_CHECKOUT_PAYMENT_MODEL.md` §8).
