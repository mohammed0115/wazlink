# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Compatibility map

| Frontend service | Current local behavior | Future resource | Endpoint(s) | DTO | Mutation | Async | Entitlement/permission | Migration note |
|---|---|---|---|---|---|---|---|---|
| EntitlementService | evaluates plan/capability/usage | entitlements, usage | GET `/entitlements`, `/usage` | EntitlementDecision | none/read | no | server authoritative | replace adapter only |
| DiscoveryService | local jobs/results | discovery jobs/results | POST `/discovery/jobs`, GET `/discovery/jobs/{id}`, and GET `/discovery/jobs/{id}/results` are Core | `DiscoveryJob`, `DiscoveryResultList` | command/read | yes for submit | discovery quota | `DiscoveryJob` is Discovery-owned; worker execution is operational only; preserve IDs/provenance |
| CRMService | Lead/Business/tasks/appointments | businesses, leads, tasks, appointments | `/businesses/{id}/convert-to-lead`, `/leads/{id}`, `/leads/{id}/360` are Core; `/tasks` and other CRUD routes are future/non-Core | `Business`, `ConvertBusinessRequest`, `Lead`, `LeadUpdate`, `Lead360` | command/read | no | CRM RBAC | no massive rewrite |
| MessagingService | local Conversation/Message | conversations/messages | `/conversations/{id}/messages` is the Core canonical send route; `/messages` is not a Core route | `Conversation`, `SendMessage`, `Message` | send/receive | send async | channel + approval | provider hidden |
| PipelineService | Deals/stages | deals/pipelines | `/deals` and `/deals/{id}/stage|close` are Core; `/pipelines` is future/non-Core | `Deal`, `DealList`, `DealCreate`, `StageMove`, `CloseDeal` | command | no | pipeline RBAC | keep Won/Lost |
| AutomationService | local rules/runs | automation rules/runs | `/automation/runs/{id}/approve` is Core; rule CRUD and other `/automation/*` routes are future/non-Core | `AutomationRun`, `Approval` | approved command | yes | capability + approval | no silent send |
| AnalyticsService | selectors/read models | analytics | `/analytics/overview` | AnalyticsOverview | read | maybe cached | analytics view | formulas server-side |
| BillingService | local plan/subscription/mock checkout | billing resources | `/billing/upgrade-quotes`, `/billing/payments`, `/billing/invoices` are Core; other `/billing/*` routes are future/non-Core | `QuoteRequest`, `UpgradeQuote`, `PaymentCreate`, `Payment`, `InvoiceList` | payment/upgrade | yes | Billing permission | frontend remains boundary |
| Journey read model | composed S4 projection | Lead360 read model | `/leads/{id}/360` is the Core aggregate/read-model route | `Lead360` | read | no | CRM view | aggregate endpoint |
| Dashboard read model | composed S5 projection | DashboardOverview read model | `/dashboard/overview` is the Core aggregate/read-model route | `DashboardOverview` | read | no | dashboard view | formulas canonical; read-only derived aggregate |

The frontend can replace local service implementations behind existing typed boundaries. `#/` hash routes remain client concerns; backend public IDs map directly to immutable resource IDs. No frontend rewrite is required beyond replacing transport adapters and handling asynchronous status. Core Phase-1 routes are only those listed in `BACKEND_API_CATALOG.md`; `/messages`, `/pipelines`, and `/tasks` are not presented as existing Core OpenAPI routes. Aggregate/read models are `/leads/{id}/360` and `/dashboard/overview`; future/non-Core routes remain explicitly unfrozen.
