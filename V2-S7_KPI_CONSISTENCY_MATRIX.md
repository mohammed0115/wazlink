# V2-S7 KPI Consistency Matrix

| Metric | Dashboard source | Analytics source | Other source | Formula | Time scope | Snapshot/event | Expected equality | Actual | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Businesses discovered | S5 Dashboard journey projection from Discovery/analytics scope | Analytics funnel/selectors where available | Discovery Job result count | completed Job/result business count | current local scope | snapshot | same scope should match | Dashboard/Discovery align; Landing preview uses illustrative count | PASS for app; Landing defect fixed in S7 |
| Leads created | `dashboardProjection.getJourneyStatus()` / analytics selector | `getAnalyticsOverview(ctx).leadsCreated` | CRM service lead collection | canonical Lead count in scope | current local scope | snapshot | equal | Dashboard and Analytics use canonical selectors | PASS |
| Open Pipeline | Dashboard `analyticsService` overview | `getAnalyticsOverview(ctx).openPipeline` | Pipeline open Deal aggregation | sum amount for open Deals | current local scope | snapshot | equal | Dashboard/Analytics/Pipeline use same Deal truth | PASS |
| Weighted Pipeline | Dashboard overview | `getAnalyticsOverview(ctx).weightedPipeline` | Pipeline weighted cards | sum amount × probability for open Deals | current local scope | snapshot | equal | Dashboard/Analytics align | PASS |
| Won Deals | Dashboard journey/overview selector | Analytics overview `wonDeals` | Pipeline closed Deal statuses | count Won Deals | current local scope | snapshot | equal | canonical Deal status | PASS |
| Recognized Revenue | Dashboard `journeyStatus.recognizedRevenue` / analytics overview | Analytics `revenue` from RevenueEvent | Revenue reconciliation | sum valid recognized RevenueEvents | analytics scope | event-derived | equal | no Deal/Billing substitute | PASS |
| Attributed Revenue | Dashboard/Analytics context where displayed | Analytics `attributedRevenue` | Attribution touchpoint chain | sum valid attributed RevenueEvents only | analytics scope | event-derived | equal | separate attribution truth | PASS |
| Conversion/funnel | Dashboard journey status | Analytics funnel selectors | CRM/Pipeline relations | canonical stage/entity transitions | current scope | derived | same semantics | app surfaces use canonical projections | PASS |
| Landing preview KPI counts | not a product account KPI | not an account selector | public illustration | no valid account formula | N/A | illustrative | must not claim account truth | hardcoded preview values/growth claims existed at baseline | S7-001 remediation required |
| Landing revenue journey wording | not applicable | RevenueEvent semantics | public marketing copy | must not imply Won → RevenueEvent | N/A | narrative | must preserve deferred contract | baseline implied automatic journey continuity | S7-002 remediation required |

## KPI Audit Conclusion

The authenticated Dashboard and Analytics metrics are canonical and consistent for identical scope. The only closure-relevant mismatch is public Landing presentation: its embedded product preview and value strip used unsupported numeric claims without a clear illustrative boundary, and its narrative implied a direct Deal-to-Revenue continuation that remains formally deferred. S7 remediation is limited to making those public claims explicitly illustrative and preserving the RevenueEvent boundary.
