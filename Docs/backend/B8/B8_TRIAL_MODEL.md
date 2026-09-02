# B8 — Trial Model

> Design only. Mechanism is fully specified; activation is gated behind an explicit, currently-withheld product decision (`B8-D-B001`), per frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`: "`trialing` is permitted only if the Product Owner confirms trial semantics."

## 1. Why this is a mechanism-designed, policy-inactive document

The frozen frontend contains no trial behavior beyond a translated status label (`FB-B8-059`) — no countdown, no seed data, no code path ever sets a subscription to `trial`. B1/B6/B7 add nothing further; `BACKEND_STATE_MACHINES.md`'s `SubscriptionTrialing` state is explicitly "conditional... only when an approved trial policy applies." Per the brief's §13 instruction ("If trial policy is not frozen enough for Phase 1, classify unresolved product policy explicitly"), B8 designs the full mechanism below so an approval later requires only a data/config change, not a re-architecture, while shipping Phase 1 with the trial entry path **disabled** (§7).

## 2. Eligibility (mechanism)

One trial per workspace lifetime — enforced by a `trial_used_at` timestamp column on `subscriptions` (nullable; set once, never cleared). A workspace whose `trial_used_at` is non-null is never offered a trial again, including after `expired`/re-purchase. Eligibility is workspace-scoped, not user-scoped (matching every other Subscription fact) — a user who is a member of multiple workspaces does not "use up" a personal trial allowance; each workspace evaluates independently.

## 3. Duration and start authority

Duration is a Billing-owned configuration value (illustrative default: 14 days), stored as data, not code (mirrors `B8_PLAN_CATALOG.md` §6's numeric-limit treatment) — changing it is a config update. Start authority: only a user-triggered command (`StartTrial`, new, gated inactive) beginning a trial explicitly offered during onboarding or from the Billing settings screen — never automatic, never silently started by any other domain's event, and never extendable by a client-supplied date (the frontend must never compute or send `trial_end`; the server always derives it as `now() + trial_duration` at start time).

## 4. End authority

The trial ends at `trial_end`, evaluated server-side by the same reconciliation sweep that handles the `active→cancelled→expired` boundary (§`B8_SUBSCRIPTION_STATE_MACHINE.md` §2) — never client-evaluated, never trusted from a query parameter or redirect.

## 5. Entitlements and usage during trial

A trialing subscription resolves entitlements against a specifically assigned trial `plan_version_id` (§`B8_ENTITLEMENT_MODEL.md` §5 step 4, `source = "trial"`) — Phase-1 policy, once activated, would assign the `PLAN-GROWTH` current version (illustrative — a Product decision, not an architecture one). Usage counters accrue normally against that plan's limits during the trial and are **not** reset or forgiven at conversion — a trial is a plan assignment with a time bound, not a separate usage universe, keeping `B8_USAGE_QUOTA_MODEL.md`'s single-counter-per-workspace-per-period model unchanged.

## 6. Conversion and expiry

**Conversion** (`trialing → active`): triggered by a successful payment (`PaymentSucceeded` against a `CreateUpgradeQuote`→`CreatePayment` sequence initiated any time during the trial), transitioning the subscription to `active` on whatever `plan_version_id` the converting purchase names — not necessarily the trial's own plan. **Expiry** (`trialing → expired`) with no conversion: the reconciliation sweep transitions directly to `expired` (not `cancelled` — a trial was never "cancelled," it simply was not converted), landing on the same deny-floor entitlement posture as any other `expired` subscription (§`B8_ENTITLEMENT_MODEL.md` §5 step 2). No grace/`past_due` period applies to an unconverted trial — `past_due` exists only for a *failed renewal charge*, and an expiring trial never attempted one.

## 7. Abuse prevention

Beyond the one-trial-per-workspace floor (§2), Phase 1 (when activated) adds no further anti-abuse mechanism (no device fingerprinting, no card-based dedup, no email-domain heuristic) — these are explicitly recorded as Class C, Phase-2 (`B8-D-C007`), since none is evidenced anywhere in the frozen corpus and inventing fraud heuristics is outside this phase's charter.

## 8. Audit

Every trial start/convert/expire is an outbox-emitted event (`SubscriptionActivated` for conversion; a new `SubscriptionExpired` for lapse) plus an `AUD-*` audit row, identical treatment to every other subscription transition — no trial-specific audit exemption.

## 9. Phase-1 activation state

`StartTrial` is defined in this document and in `B8_COMMAND_EVENT_CATALOG.md` but is **feature-flagged off** in Phase 1: no API operation invokes it (§`B8_API_DTO_CONTRACTS.md` does not list a trial-start endpoint), and `BootstrapWorkspaceSubscription` never assigns `trialing` (§`B8_SUBSCRIPTION_AGGREGATE.md` §3). Activating trials later requires only: (a) Product Owner approval of duration/eligibility/target-plan policy, (b) exposing the already-designed `StartTrial` command through a new endpoint, and (c) flipping the bootstrap default — no schema change, no state-machine change, no new controlled amendment against frozen B0.
