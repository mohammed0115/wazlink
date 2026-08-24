# V2-S0-FIX.2-F PRECHANGE AUDIT

**Project:** WazLink  
**Starting commit:** `cd61b87b1eacc62811539064de6f6f6d1cc01e2c`  
**Scope:** Frontend-only public service contract closure. No backend/API/auth/payment integration.

## Independent CTO blocker

The independent CTO re-verification accepted Checkout operationally but rejected the service replacement boundary. The public `@services` surface re-exported legacy-backed collections and implementation-shaped functions, while `BillingService` declared only `plans()`. Features therefore depended on legacy/mock semantics rather than stable implementation-neutral contracts.

## Current public export inventory

`client/src/services/data.ts` explicitly re-exports a broad surface from `./mock/legacyDataBridge`. The inventory contains the following classes:

| Class | Current examples | Finding |
|---|---|---|
| A. Service contract | `analyticsService`, `billingService`, `integrationService` from the composition root | Partial and incomplete; most Feature operations are not represented by these interfaces. |
| B. DTO/read model | `BusinessSummary`, `LeadListItem`, `DealListItem`, `DashboardSnapshot` | Exists for selected services but is not the universal Feature path. |
| C. Pure domain selector | `getLead`, `getDeal`, `getPipelineMetrics`, `getAnalyticsOverview` | Re-exported broadly; signatures and ownership are implementation-shaped in places. |
| D. Local UI helper | Label catalogs, formatting functions, reference constants | Safe only when truly presentation-only; many are mixed into the broad facade. |
| E. Legacy-backed raw collection | `businesses`, `conversations`, `jobs`, `activities`, `metrics`, `dashboardData`, `navItems`, `scraperCrmPackages` | Blocking leak; Features consume several directly. |
| F. Legacy-backed mutation | `updateLeadStatus`, `updateDeal`, `createDeal`, `convertBusinessToLead`, `updateWorkspaceSettings` | Public operations are not consistently expressed through typed service interfaces. |
| G. Mock-specific API | `sendMockMessage`, `advanceMockMessageStatus`, `retryMockMessage`, `connectIntegrationMock`, `changeSubscriptionPlanMock`, `openMockCheckout`, `completeMockCheckout`, `failMockCheckout`, `*MockCheckout` | Blocking implementation leakage. |
| H. Unsafe/other | Broad constants, raw inferred return values, generic compatibility selectors | Requires narrowing or explicit typed read models. |

The raw public collection exports explicitly identified by the CTO are `businesses`, `jobs`, and `dashboardData`; equivalent raw collections include `conversations`, `activities`, and `metrics`.

## Current Feature consumer inventory

The following imports were observed through `@services`. They are grouped by service area to show the prechange contract problem.

| Feature area | Representative imported exports | Current consumption | HTTP replacement unchanged? |
|---|---|---|---|
| Dashboard | `businesses`, `dashboardData`, `jobs`, `getUpcomingActivities`, `getPipelineStageSummary`, `analyticsService` | Direct collection iteration plus mixed selectors | No |
| Discovery / Jobs / Results | `businesses`, `jobs`, `discoverySourceOptions`, `getDiscoveryJob`, `getJobStatusLabel`, `createDiscoveryJob`, `retryDiscoveryJob` | Raw collections, labels, and mock/domain functions | No |
| CRM / Lead 360 | `businesses`, `listLeads`, `getLead`, `getLeadActivities`, `updateLeadStatus`, `convertBusinessToLead` | Raw businesses plus broad legacy-backed reads/writes | No |
| Deals / Pipeline | `getDeal*`, `getPipeline*`, `listDeals`, `moveDealStage`, `closeDealAsWon`, `closeDealAsLost` | Broad legacy-backed selectors and mutations | Partial at best |
| Messaging / Inbox / Copilot | `getConversation*`, `getInbox*`, `sendMockMessage`, `advanceMockMessageStatus`, `retryMockMessage` | Mock-specific messaging functions and raw selectors | No |
| Automation | `getAutomationRules`, `getAutomationRuns`, `runAutomationNow`, `approveAutomationAction`, raw catalogs | Domain operations and raw catalogs through facade | Partial at best |
| Analytics | `dashboardData`, `analyticsService`, analytics engine functions | Mixed dashboard object and typed service | Partial at best |
| Settings | workspace/settings functions, raw user lists | Direct legacy-backed settings operations | Partial at best |
| Integrations | `connectIntegrationMock`, `disconnectIntegrationMock`, `retryIntegrationMock`, `listIntegrations` | Mock-specific operations | No |
| Billing | subscription/usage/plan functions, `listPlans`, `listInvoices`, `listPaymentMethods` | Broad facade functions and raw lists | No |
| Checkout | `openMockCheckout`, `getMockCheckoutPreview`, `updateMockCheckoutInvoice`, `continueMockCheckoutPayment`, `failMockCheckout`, `completeMockCheckout`, `finishMockCheckoutJourney`, `closeMockCheckout` | Direct mock-specific Checkout lifecycle calls | No |

## Current contract and composition findings

`client/src/services/contracts/services.ts` declares typed interfaces for selected list/get/update operations, but `BillingService` only declares `plans(): Promise<unknown[]>`. It does not represent current subscription, usage, invoice data, Checkout start/read/progression/failure/cancellation, or plan preview. Features do not consistently import and call the declared service objects; they import individual functions from the broad facade.

`client/src/services/index.ts` is the composition root and may continue to depend on `legacyDataBridge` internally. The required change is to stop exposing that implementation shape to Features and to make mock service objects satisfy the same public contracts a future HTTP adapter would implement.

## Required FIX.2-F closure

The migration must remove raw collection exports, normalize read models, expand typed service contracts by actual Feature need, move Checkout operations behind an implementation-neutral BillingService contract, remove `*MockCheckout` names from Feature imports, preserve local Checkout UI state, and add objective closure gates without claiming that static checks alone prove semantic substitutability.
