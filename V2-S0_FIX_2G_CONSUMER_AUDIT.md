# V2-S0-FIX.2-G — Prechange Consumer Audit

**Baseline:** `27e097e9c33a6dd503a5c5f6af5fa84b6e4c1eb0`  
**Scope:** Frontend-only typed service consumer wiring. No backend/API changes.

## Finding

The repository already has service instances in `client/src/services/index.ts`, but most target Features still import domain operations from the compatibility facade through `@services`. Before FIX.2-G, only Analytics and Billing/Checkout were materially consuming service instances; the remaining service instances were present but unused by target Features.

| Feature | Current imported facade functions | Existing typed service instance | Missing contract methods | Target wiring |
|---|---|---|---|---|
| Dashboard | `listBusinesses`, `getDashboardOverview`, `getAutomationMetrics`, `getInboxConversations`, `getPipelineStageSummary`, `getUpcomingActivities`, `listDiscoveryJobs`, plus analytics methods | `analyticsService`; `businessService` and other instances exist but are unused | Dashboard overview, business/job reads, attention/activity/pipeline summary methods | Add/complete `dashboardService` and use it from Dashboard; preserve `analyticsService`. |
| Discovery / Jobs / Results | `listDiscoveryJobs`, `getDiscoveryJob`, `createDiscoveryJob`, `retryDiscoveryJob`, result selectors, filter snapshots | No `discoveryService`; `businessService` exists | Job list/detail, lifecycle commands, result reads, filter-safe DTOs | Add typed `discoveryService`; migrate Jobs/Results/Intelligence domain reads and writes. |
| CRM / Lead 360 | `listBusinesses`, `listLeads`, `getLead*`, `convertBusinessToLead`, `updateLead*`, activity/task selectors | `businessService`, `leadService` exist but are unused | Business list/get, Lead list/detail/activity/task/conversion/update operations | Expand BusinessService/LeadService and migrate CRM/Lead consumers. |
| Deals / Pipeline | `listDeals`, `getDeal*`, `moveDealStage`, `closeDealAsWon`, `closeDealAsLost`, `updateDeal`, pipeline selectors/metrics | `dealService` exists but is unused; no typed `pipelineService` | Deal reads/commands, pipeline stages/metrics/summary | Expand DealService and add typed `pipelineService`; migrate Deals/Pipeline/Deal360/modals. |
| Messaging / Inbox | `getConversation*`, `getInbox*`, `sendMessage`, `advanceMessageStatus`, `retryMessage`, assignments/status commands | `conversationService`, `messageService` exist but are unused | Conversation context/list/detail/update, status/retry/human send operations | Expand ConversationService/MessageService and migrate Inbox/Copilot-related messaging consumers. |
| Automation | `getAutomationRules`, `getAutomationRuns`, approval queue, execute/approve/reject/run operations | `automationService` exists but is incomplete and unused | Rules, runs, approval, audit, test, execute, idempotent command methods | Expand AutomationService and migrate Automation Feature. |
| Settings | `getWorkspace`, `getCurrentWorkspaceUser`, notifications/security/team operations | `settingsService` exists but is incomplete and unused | Workspace/account/team/notification/security reads and updates | Expand SettingsService and migrate Settings Feature. |
| Integrations | `getIntegration`, activities, `connectIntegration`, `disconnectIntegration`, `retryIntegration`, configuration update | `integrationService` exists but is incomplete and unused | Integration list/detail/activity/configuration/connect/disconnect/retry methods | Expand IntegrationService and migrate Integrations Feature. |
| Tasks / Appointments | `getTasksWorkspace`, `getAppointments`, task/appointment operations through facade | `taskService`, `appointmentService` exist but are incomplete and unused | Typed task list/complete and appointment list/read/create/update methods | Cross-check and wire only where currently consumed, preserving behavior. |
| Analytics | Analytics engine methods through `analyticsService` | `analyticsService` actively used | No primary gap identified | Regression only; avoid unnecessary refactor. |
| Billing / Checkout | Billing operations through `billingService` | `billingService` actively used | No primary gap identified | Regression only; avoid unnecessary refactor. |

## Baseline metrics

| Metric | Baseline |
|---|---:|
| Target Feature files importing `@services` | 40 imports/consumer occurrences in the prechange scan |
| Target Feature files using `businessService` | 0 |
| Target Feature files using `leadService` | 0 |
| Target Feature files using `dealService` | 0 |
| Target Feature files using `conversationService` | 0 |
| Target Feature files using `messageService` | 0 |
| Target Feature files using `automationService` | 0 |
| Target Feature files using `settingsService` | 0 |
| Target Feature files using `integrationService` | 0 |
| Target Feature files using `analyticsService` | Present in Dashboard/Analytics |
| Target Feature files using `billingService` | Present in Billing/Checkout |

## Prechange type-safety observations

The public facade contains `listBusinesses(): any[]`, inferred legacy aliases, compatibility selectors over `mockRecords`, and several operations whose public type is derived from the legacy bridge rather than declared as explicit Feature DTOs. Existing interfaces for most services are Promise-oriented but do not declare the actual Feature operations currently used by the facade consumers.

## Required FIX.2-G outcome

Target Features must consume typed service instances from the composition root. The mock implementation may translate legacy bridge records internally, but Feature-facing operations must be declared in the service interfaces with explicit DTOs and must not expose `any`, raw legacy collections, or mock lifecycle terminology. Analytics, Billing, Checkout, global-zero protections, and UI behavior are regression-only areas.
