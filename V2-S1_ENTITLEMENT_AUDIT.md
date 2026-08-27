# V2-S1 Entitlement Audit

## Scope

This audit records the current frontend-only plan, subscription, usage, billing, upgrade, checkout, and navigation truth before implementing Product Entitlements & Plan Limits. Source code wins over previous reports.

## Current Source of Truth

The local subscription truth is `mockModel.subscriptions[0]`, exposed through `getCurrentSubscription()` in `client/src/domain/data.js`. The active plan is resolved by `getPlan(subscription.planId)` from `mockModel.plans`. Billing already exposes these values through the typed `billingService` composition-root instance.

Usage is currently derived by `getBillingUsage()` from existing local domain records: lead count, discovery job count, active users, automation run count, and analyzed opportunities. For finite plan limits it computes `remaining` with a non-negative clamp and an `over` flag. Unlimited values are represented by `null` in the current billing data.

Plan changes and Checkout mutate only the local platform subscription and billing records. They do not create customer `RevenueEvent` or `AttributionTouchpoint` records. Checkout is already canonical at `#/settings/billing/checkout` and supports invoice, masked payment, review, success, and failure/retry states.

## Occurrence Classification

| Area | Current source | Current behavior | Problem | S1 target |
|---|---|---|---|---|
| Current plan | `domain/data.js` `getCurrentSubscription()` / `getPlan()` | Resolves one local subscription and its plan | Truth is billing-owned and not yet projected as entitlement vocabulary | Consume the same truth through `EntitlementService` |
| Plan catalog | `mockModel.plans` and Billing `plans()` | Billing renders plan names, prices, and feature strings | Limits are nested in legacy plan objects and not a canonical typed entitlement model | Add typed `PlanDefinition` catalog projection without changing prices |
| Subscription | `billingService.currentSubscription()` | Billing reads current plan/status/renewal | Features cannot make one canonical typed entitlement decision | Add `currentPlan()` through entitlement service |
| Usage | `billingService.usage()` / `getBillingUsage()` | Displays leads, discovery runs, seats, automation runs, and AI analyses | Status semantics are numeric/over-based rather than AVAILABLE/LIMITED/EXHAUSTED/LOCKED | Add typed usage and decision projection with safe remaining/percentage |
| Limits | Plan `limits` plus billing usage rows | Finite values are numbers; unlimited is `null` | No explicit finite/unlimited/not-included model | Add typed `LimitDefinition` |
| Upgrade | Billing plan preview and Checkout CTA | Routes to local plan preview/Checkout | Upgrade context is not typed and feature gates do not share one decision path | Add typed `UpgradeReason` and canonical Billing route |
| Checkout | `Billing.tsx`, `Checkout.tsx`, `billingService` | Local mock checkout, no provider | Must remain behaviorally unchanged | Regression-only preservation |
| Sidebar usage | `Sidebar.tsx` | Hardcoded `1,240` and `الباقة المهنية` | Violates canonical usage requirement and can disagree with Billing | Read plan and usage from `entitlementService` |
| Navigation | `Sidebar.tsx` `navItems` | All major navigation items are visible and active state is local | No intentional entitlement state presentation | Keep discoverability and show locked/upgrade context only where a real S1 capability is gated |
| Feature actions | Discovery, Automation, Integrations | Actions call typed domain services, with no plan checks | No action-level entitlement protection | Gate only selected real capabilities with `EntitlementService.evaluate()` |
| RTL | Global shell and Arabic UI | RTL presentation is established and readable | New usage/locked/upgrade UI must preserve RTL | Test all new entitlement states in Arabic |
| Marketing copy | Landing and feature descriptions | Descriptive, mock/local disclosures | Not entitlement enforcement | Leave unchanged unless canonical plan copy is duplicated |
| Technical debt | `data.ts` compatibility facade and presentational broad rows | Legacy implementation remains below FIX.2 boundary | Not a reason to reopen closed architecture | Keep legacy bridge internal and add only typed entitlement projection |

## S1 Design Direction

S1 will add one typed entitlement vocabulary and one composition-root `entitlementService`. It will project the existing Billing subscription, plan definitions, and usage records rather than creating a second current-plan store. Feature gates will be action-level and local UX controls only; authoritative quota enforcement remains a future Backend responsibility.
