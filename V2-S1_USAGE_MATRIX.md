# V2-S1 Usage Matrix

| Metric | Source | Derivation | Plan limit | Consumer | Status behavior |
|---|---|---|---|---|---|
| Leads | `mockModel.leads` through `billingService.usage()` | Count of local lead records | `PlanDefinition.entitlements.limits.leads` | Billing usage grid; entitlement decisions for CRM/Pipeline | AVAILABLE at zero, LIMITED before the finite limit, EXHAUSTED at or above it |
| Discovery runs | `jobs` through `billingService.usage()` | Count of local discovery jobs | `PlanDefinition.entitlements.limits.discoveryRuns` | Sidebar usage card; Billing usage grid; Discovery action gate | AVAILABLE/LIMITED/EXHAUSTED; remaining is clamped to zero |
| Active seats | `mockModel.users` filtered to `status === active` | Count of active local users | `PlanDefinition.entitlements.limits.seats` | Billing usage grid | AVAILABLE/LIMITED/EXHAUSTED; no artificial usage is created |
| Automation runs | `mockModel.automationRuns` through `billingService.usage()` | Count of local automation run records | `PlanDefinition.entitlements.limits.automationRuns` | Billing usage grid; Automation action gate | AVAILABLE/LIMITED/EXHAUSTED; approval rules remain separate |
| AI analyses | `mockModel.opportunityAnalyses` filtered to `status !== not_analyzed` | Count of analyzed opportunity records | `PlanDefinition.entitlements.limits.aiAnalyses` | Billing usage grid | AVAILABLE/LIMITED/EXHAUSTED; unlimited is represented semantically, not as 0/0 |

## Display Rules

Finite limits display `used / limit` and a clamped non-negative remaining value. Unlimited limits display `∞` or `غير محدود`. A not-included capability displays `غير مشمول` and never appears as a misleading `0 / 0`. A finite metric is EXHAUSTED when `used >= limit`, including historical data that is already over a newly selected plan.

## Authority Boundary

These values are deterministic local mock projections used for product UX. They are not authoritative quota enforcement. A future Backend must recalculate and enforce quotas independently, including concurrent requests and race conditions.
