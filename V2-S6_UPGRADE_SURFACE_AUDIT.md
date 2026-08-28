# V2-S6 Upgrade Surface Audit

## Baseline

Starting baseline is V2-S5 verified commit `1ba3efa76bd37cdf9d92a6bc7579353375de72eb` on `main`, with a clean tree and no implementation started before this audit record.

## Surface Matrix

| Surface | Current trigger | Entitlement source | Current CTA | Problem | S6 action |
|---|---|---|---|---|---|
| Billing | User opens Billing from Settings or shell | `entitlementService.currentPlan()`, `planCatalog()`, `usage()` | Checkout / preview plan change | Canonical Billing already owns prices and usage but contextual reasons are not shared | Reuse Billing and add only typed contextual deep-link explanation if needed |
| Checkout | User intentionally opens Billing Checkout | `billingService.startCheckout()` and existing Billing plan context | Local mock Checkout | Must not become a real payment flow | Reuse unchanged; preserve local/mock disclosure |
| Sidebar locked state | Navigation item requires a capability | `projectShellNavigation(route, entitlementService)` and `evaluate()` | Locked item routes to `settings/billing` | Safe but generic explanation | Reuse; optionally link contextual reason through canonical Billing route |
| `EntitlementGate` | Feature action renders gated children | `entitlementService.evaluate(capability)` | `settings/billing` when blocked | Existing state labels are useful but reason/usage presentation is generic | Enhance the existing gate, not create a parallel gate |
| Dashboard | Adaptive plan/usage context and entitlement attention | `dashboardProjection` → `entitlementService` | Billing route | S5 already exposes usage and safe locked state | Preserve KPI and projection truth; add no random banner |
| Discovery | Submit action with `evaluate("discovery.basic")` | `EntitlementService` | Toast explains blocked/exhausted state | No structured contextual upgrade reason | Reuse decision and add typed presentation only if useful |
| Automation | PageHead and builder wrapped in `EntitlementGate` | `evaluate("automation.rules")`; manual execution separately guarded | Billing route through gate | Existing safety must remain manual/approval-controlled | Preserve gate and execution semantics |
| AI/Copilot | Existing capability/navigation state | `evaluate("inbox.copilot")` via shell/feature boundaries | Billing route when locked | No new AI/provider behavior allowed | No new AI action; only explain canonical capability if surfaced |
| CRM / seats | Existing plan usage in Billing and onboarding | `usage()` and onboarding service | Billing route | S6 must not add team-management logic | Use existing usage dimensions only |
| Plan badges / usage matrix | Billing and Sidebar display current plan/Discovery usage | EntitlementService | Manage Billing | Some existing display code uses broad row escape hatches outside S6 scope | S6 contracts must remain typed; do not duplicate pricing |

## Existing Canonical Rules

`EntitlementService` is authoritative for current plan, capabilities, limits, usage, remaining, status, and upgrade target. Billing owns plan catalog and prices. The expected canonical upgrade route is `settings/billing`, and Checkout is a local/mock four-step flow with no provider, card collection, subscription claim, RevenueEvent, or AttributionTouchpoint.

S6 implementation must derive contextual UX from decisions and usage, distinguish `LOCKED`, `LIMITED`, `EXHAUSTED`, `AVAILABLE`, and safe `UNKNOWN`, and must not introduce UpgradeStore, PricingStore, raw plan-name access gating, unsolicited banners, fake discounts, scarcity, or payment integration.
