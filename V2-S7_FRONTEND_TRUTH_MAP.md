# V2-S7 Frontend Truth Map

| Concern | Canonical owner | Read models | Mutators | Consumers | Forbidden duplicate |
|---|---|---|---|---|---|
| Session/workspace | Session/workspace services and AppProviders | session/workspace context | onboarding/workspace service methods | AppShell, onboarding, Dashboard, settings | second session/workspace store |
| Routing | `useHashRoute.ts` and `App.tsx` | parsed path/query | `go()` / `routeHref()` | AppShell and all features | second router |
| Entitlements | `EntitlementService` | `evaluate`, `currentPlan`, `usageFor`, `planCatalog` | entitlement-owned local prototype state only | Sidebar, gates, Discovery, Automation, Billing, S6 projection | raw plan checks or second engine |
| Plan catalog/pricing | Billing/Entitlement service catalog | current plan, plan definitions, prices | local Billing prototype actions | Billing, Checkout, Upgrade projection | duplicated price table |
| Discovery | Discovery service/domain adapter | jobs, results, sources, filters | create/process/retry local jobs | Discovery, Results, Intelligence, Dashboard | second discovery store |
| CRM Leads | CRM service | Lead, Business relation, Lead 360 | convert/update/add task/appointment | CRM, Lead 360, Journey, Dashboard | duplicate CRM store |
| Tasks | CRM service | Lead tasks and activity | add/update/complete task | Lead 360, Tasks, Dashboard | task shadow store |
| Appointments | CRM service | Lead appointments | add/update appointment | Lead 360, Appointments | appointment shadow store |
| Messaging | Messaging service | Conversation, Message | send/retry/mark-read local actions | Inbox, Lead 360, Dashboard | provider transport or second inbox store |
| Deals/Pipeline | Pipeline service | Deal, Pipeline, Stage | create/update/close Deal | Deal 360, Pipeline, Lead 360, Dashboard | second pipeline truth |
| Automation | Automation feature service | rules, runs, approvals | manual/approved local actions | Automation, Dashboard, Lead context | worker/scheduler/second automation engine |
| Analytics | Analytics service/selectors | overview, funnel, revenue, attribution | no Deal/Billing mutation | Analytics, Dashboard, Landing preview | duplicate formulas/store |
| RevenueEvent | Analytics/domain revenue records | recognized revenue selector | explicit future domain contract only | Analytics and reconciliation | Deal amount or Billing as revenue |
| Attribution | canonical touchpoints/selectors | attributed revenue and chain | explicit source touchpoint only | Analytics | synthetic attribution from Won/Billing |
| Journey projection | `journeyProjection.ts` | read-only entities/activity/actions | none | Lead 360, Discovery context, Dashboard | Journey store |
| Dashboard projection | `dashboardProjection.ts` | KPI/context/attention/journey/plan projection | none | Dashboard | Dashboard store |
| Upgrade projection | `upgradeProjection.ts` | entitlement state/pressure/target action | none | EntitlementGate, Billing | Upgrade/Cross-sell store |
| Billing | Billing feature/service | subscription, invoices, usage, catalog | local mock Billing actions | Billing, Checkout | customer Revenue coupling |
| Checkout | `Checkout.tsx` and Billing service boundary | checkout session/form state | local mock checkout only | Billing | real payment provider |

The bridge/legacy adapter may remain internal to service composition. Feature consumers must use typed services or typed projections, not direct legacy collections.
