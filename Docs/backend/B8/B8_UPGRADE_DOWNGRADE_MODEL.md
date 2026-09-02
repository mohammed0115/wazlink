# B8 — Upgrade, Downgrade & Cancellation Model

> Design only. Upgrade fully reuses the already-frozen `CreateUpgradeQuote`→`CreatePayment`→`ProcessPaymentWebhook`→`SubscriptionActivated` pipeline; downgrade and cancellation are new B8 architecture built on the same aggregate.

## 0. No proration (`B8-D-C002`)

An upgrade charges the full target plan's current-period price immediately — Phase 1 does not prorate for the remaining days of the prior period, and does not credit the unused portion of the old plan. This keeps `UpgradeQuote` pricing a pure catalog lookup (§`B8_CHECKOUT_PAYMENT_MODEL.md` §2) with no date-arithmetic pricing rule to get wrong. Proration is deferred (Class C, Phase-2).

## 1. Upgrade — activation timing

Entitlement activation is **immediate** upon `SubscriptionActivated`: the subscription's `plan_version_id` is updated to the new plan's current version in the same transaction that processes the confirming webhook, and every subsequent `GET /entitlements`/`GET /usage` call reflects it instantly (`B8-D-A011`). There is no "next billing cycle" delay for an upgrade — a workspace that pays for more capacity gets it the moment payment is confirmed, not before (§8).

## 2. Upgrade — payment authorization and provider-success requirement

Per frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`, "Subscription activation requires a captured payment or an explicitly accepted provider state." `SubscriptionActivated` is emitted only from `ProcessPaymentWebhook` (verified webhook) or `ReconcilePayment` (explicit provider-query confirmation) — never from `CreatePayment`'s own `202` response, and never from a redirect handler (§`B8_CHECKOUT_PAYMENT_MODEL.md` §8).

## 3. Upgrade — concurrency, idempotency, duplicate checkout, user retry

- **Duplicate checkout / user retry with the same intent:** the client resends `POST /billing/upgrade-quotes` and/or `POST /billing/payments` under the same `Idempotency-Key` — the frozen idempotency record replays the original response; no second quote or payment is created (`BACKEND_IDEMPOTENCY_STANDARD.md`).
- **Two concurrent upgrade attempts to different plans:** the second `CreateUpgradeQuote` succeeds (quotes are cheap and non-committing), but `CreatePayment` acquires a `SELECT ... FOR UPDATE` lock on the `subscriptions` row for the duration of quote-consumption; **only one payment may be `pending`/`authorized` (in-flight) per subscription at a time** (`B8-D-A012`, new rule) — a second `CreatePayment` call while one is already in flight for the same subscription returns `409 CONFLICT` (reason `payment_in_progress`), not a silently-queued second attempt. This closes the "two simultaneous upgrades" race (brief §25) deterministically.
- **Webhook race:** if the webhook for the eventually-losing concurrent attempt arrives after a different payment has already activated the subscription, `ProcessPaymentWebhook` re-checks the subscription's current `plan_version_id`/`version` before applying — a stale success is recorded on the `Payment` row (still `captured`, for financial correctness/refund eligibility) but does **not** downgrade a subscription that has since moved to a newer, later-committed plan version. This is a last-committed-wins rule at the Subscription level, never a last-webhook-wins rule.
- **Failed upgrade:** `PaymentFailed` leaves the subscription entirely unchanged (still on its prior `plan_version_id`) — no partial-upgrade state ever exists.

## 4. Downgrade — timing (`B8-D-A008`: always next-period, never immediate)

`ScheduleDowngrade` (new command, `subscription.change` permission) sets `subscriptions.pending_plan_version_id` to the target plan's current version and does **not** change `plan_version_id` immediately. `ApplyScheduledDowngrade` (new, system-actor command) runs inside the same period-boundary sweep as renewal (§`B8_SUBSCRIPTION_STATE_MACHINE.md` §2): if `pending_plan_version_id` is set when `current_period_end` is reached, it becomes the new `plan_version_id` and is cleared, and `SubscriptionDowngradeApplied` (new event) is emitted. A workspace may cancel a pending downgrade any time before the boundary (`ScheduleDowngrade` again with `plan_ref` unset, or a dedicated `CancelScheduledDowngrade` — modeled as `ScheduleDowngrade(null)`, no separate command needed).

**Why always next-period, never immediate:** an immediate downgrade would instantly drop `remaining` on every metric (possibly below zero) and could immediately lock capabilities mid-session, contradicting the brief's §15 instruction to "avoid destructive downgrade behavior." Deferring to the period boundary — the same instant a renewal charge would occur anyway — means the workspace has already paid for full access through the current period and never loses anything it paid for.

## 5. Downgrade — usage-exceeds-future-quota, data, and running operations

- **Existing data is never deleted.** Leads, deals, messages, automation rules created while over a future plan's limit remain fully intact and viewable after the downgrade applies (`B8-D-A008`). Only **new creation** against an already-exhausted metric is blocked going forward, identical to the ordinary `QUOTA_EXHAUSTED` path any workspace organically hits by usage growth — downgrade introduces no new blocking mechanism, it just changes which limit organic usage is compared against.
- **Running operations are not interrupted.** A `DiscoveryJob` or `AutomationRun` already admitted before the downgrade applied completes normally; only the *next* admission attempt is subject to the new limit.
- **Downgrade preview** (`GET /billing/subscription/downgrade-preview?plan_ref=...`, new, read-only): returns `{target_plan_ref, effective_at: current_period_end, downgrade_warning: string|null, differences: [{metric, current_limit, target_limit, current_usage, over: boolean}]}`. This response shape directly closes the two dead frontend bindings found in evidence (`FB-B8-025`/`FB-B8-026`): `downgrade_warning` is non-null whenever any `differences[].over` is true, giving the frontend's already-built-but-unwired warning block real data for the first time. A capability the target plan does not grant at all (e.g. downgrading GROWTH→STARTER drops `automation.rules`) is surfaced as a `differences` row with `target_limit: 0`/capability semantics, `over: true` if any usage exists under that capability's paired metric.
- **New admissions under a soon-to-be-lost capability are not pre-emptively blocked** before the downgrade applies — the capability remains fully `AVAILABLE` until the period boundary, consistent with §4's "already paid for it" reasoning.

## 6. Cancellation (`B8-D-A009`: cancel-at-period-end only, Phase 1)

**Who may cancel:** a member holding `subscription.change` (Owner always; Admin conditional on the frozen role matrix, §`B8_RBAC_TENANCY.md` §2). **`CancelSubscription`** sets `cancel_at_period_end = true` and `cancelled_at = now()`; it does **not** transition `status` immediately — the subscription remains `active` (or `past_due`/`trialing`) with full access until `current_period_end`, which is the effective cancellation instant (§`B8_SUBSCRIPTION_STATE_MACHINE.md` §3). **Reactivation:** `ReactivateSubscription`, legal only while `status=active` (or `trialing`/`past_due`) and `cancel_at_period_end=true`, clears both fields — a full undo, no new purchase required, matching the frozen frontend's own "cancel/reactivate" toggle pair (`FB-B8-023`). **Provider interaction:** cancellation makes no Tap API call — it only stops the *next* renewal charge from being attempted by Billing's own renewal-scheduling logic (§`B8_CHECKOUT_PAYMENT_MODEL.md` §7); there is nothing to "cancel" at Tap until a renewal charge would otherwise be attempted. **Webhook race:** if a renewal charge was already in flight (webhook pending) at the moment of cancellation, the charge is allowed to resolve normally (captured or failed) — cancellation only suppresses *future* renewal attempts, never reaches into an in-flight one. **Idempotency:** `CancelSubscription`/`ReactivateSubscription` are idempotent by `Idempotency-Key`; calling `CancelSubscription` twice with the same key returns the same result, not an error. **Audit:** every call appends `AUD-*` plus the new events `SubscriptionCancelled`/`SubscriptionReactivated`.

**Immediate hard-cancel with pro-rata refund is explicitly out of Phase-1 scope** (`B8-D-C003`, Class C) — it requires refund/proration rules this phase does not design; cancel-at-period-end is the sole Phase-1 mode.

## 7. Race: upgrade + cancellation, upgrade + downgrade

- **`cancel_at_period_end=true` + a new upgrade attempt:** `CreatePayment` is still legal (a workspace may change its mind and pay before the boundary); on success, `SubscriptionActivated` clears `cancel_at_period_end` as a side effect (an explicit paid upgrade supersedes a pending cancellation) — recorded as `B8-D-A013` companion rule, consistent with "reactivation" semantics being implied by paying again.
- **Pending downgrade + cancellation:** `CancelSubscription` clears any `pending_plan_version_id` in the same transaction (§`B8_SUBSCRIPTION_AGGREGATE.md` §6 invariant 3) — cancellation always supersedes a scheduled downgrade; there is nothing to downgrade into if the subscription is ending.
- **Pending downgrade + a new upgrade:** `CreatePayment`'s success clears `pending_plan_version_id` — an explicit upgrade always supersedes a previously scheduled downgrade.

## 8. Interaction with an active `EntitlementOverride` (`B8-D-A022`, closes `AUD-MAJ-2`)

Every plan-version-changing event in this document (upgrade §1–3, downgrade §4–5, trial conversion §`B8_TRIAL_MODEL.md`, and a catalog-only `PlanVersion` publish that does not itself move any subscription) leaves any `entitlement_overrides` row for that workspace **completely untouched** — no command in this document ever reads, writes, revokes, or re-validates `entitlement_overrides`. The two aggregates are independent (§`B8_CONCURRENCY_MODEL.md` C8, C13).

Correctness of "an override may broaden but never restrict below the current plan" is entirely a property of `B8_ENTITLEMENT_MODEL.md` §5b/§5b-i's read-time `MAX(current_base_limit, override.value)` rule, not of anything this document does at write time:

- An **upgrade** raises `step4_limit`; the next resolution's `MAX` picks up the new, higher base automatically — a metered override frozen at a lower value simply stops being the dominant term, without any write to the override row.
- A **downgrade** lowers `step4_limit` at the period boundary (§4); a still-active override continues to broaden above the new, lower base via the same `MAX`, until the override's own independent lifecycle (expiry or explicit revoke) ends it.
- **Trial conversion** (`trialing→active`) changes which `plan_version_id` step 4 resolves against; no override-specific handling is needed for the same reason.
- A **catalog-only `PlanVersion` publish** (no subscription transition) changes nothing for any already-committed subscription (`B8-D-A003`) and therefore changes nothing for any override's effective limit either, until that subscription's own upgrade/downgrade event fires.

This is a deliberate design property, not an omission: an override never needs to be "kept in sync" with plan changes because its stored value is never combined with a stale, cached base — every resolution re-reads both numbers fresh. See `AT-B8OVR-11`…`18` (§`B8_ACCEPTANCE_TESTS.md`) for the full adversarial coverage of this interaction, including the concurrent-transition case (`AT-B8OVR-18`).
