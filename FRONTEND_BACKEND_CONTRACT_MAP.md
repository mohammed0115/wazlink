# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Compatibility map

| Frontend service | Current local behavior | Future resource | Endpoint(s) | DTO | Mutation | Async | Entitlement/permission | Migration note |
|---|---|---|---|---|---|---|---|---|
| EntitlementService | evaluates plan/capability/usage | entitlements, usage | GET `/entitlements`, `/usage` | EntitlementDecision | none/read | no | server authoritative | replace adapter only |
| DiscoveryService | local jobs/results | discovery jobs/results | POST/GET `/discovery/jobs` | DiscoveryJob/DiscoveryResult DTO | command | yes | discovery quota | `DiscoveryJob` is Discovery-owned; worker execution is operational only; preserve IDs/provenance |
| CRMService | Lead/Business/tasks/appointments | businesses, leads, tasks, appointments | `/businesses`, `/leads`, `/tasks` | stable DTOs | command | no | CRM RBAC | no massive rewrite |
| MessagingService | local Conversation/Message | conversations/messages | `/conversations`, `/messages` | Message DTO | send/receive | send async | channel + approval | provider hidden |
| PipelineService | Deals/stages | deals/pipelines | `/deals`, `/pipelines` | Deal DTO | command | no | pipeline RBAC | keep Won/Lost |
| AutomationService | local rules/runs | automation rules/runs | `/automation/*` | Run/Approval DTO | approved command | yes | capability + approval | no silent send |
| AnalyticsService | selectors/read models | analytics | `/analytics/overview` | AnalyticsOverview | read | maybe cached | analytics view | formulas server-side |
| BillingService | local plan/subscription/mock checkout | billing resources | `/billing/*` | Billing DTO | payment/upgrade | yes | Billing permission | frontend remains boundary |
| Journey read model | composed S4 projection | `/leads/{id}/360` | Lead360DTO | read | no | CRM view | aggregate endpoint |
| Dashboard read model | composed S5 projection | `/dashboard/overview` | DashboardOverview | read | no | dashboard view | formulas canonical; read-only derived aggregate |

The frontend can replace local service implementations behind existing typed boundaries. `#/` hash routes remain client concerns; backend public IDs map directly to immutable resource IDs. No frontend rewrite is required beyond replacing transport adapters and handling asynchronous status.
