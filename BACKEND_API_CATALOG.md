# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Core endpoint catalog

| Method | Path | Purpose | Auth/permission | DTO | Status | Idempotent/async |
|---|---|---|---|---|---|---|
| POST | `/api/v1/auth/login` | create session | public/rate-limited | LoginRequest/Session | 200/401 | no/no |
| POST | `/api/v1/auth/logout` | revoke session | authenticated | empty | 204 | yes/no |
| GET | `/api/v1/workspaces` | list memberships | auth | WorkspaceList | 200 | n/a/no |
| POST | `/api/v1/workspaces/{id}/invitations` | invite member | workspace admin | InviteRequest | 201/403 | yes/no |
| GET | `/api/v1/plans` | plan catalog | authenticated | PlanList | 200 | n/a/no |
| GET | `/api/v1/entitlements` | current decisions | auth | EntitlementList | 200 | n/a/no |
| GET | `/api/v1/usage` | usage counters | billing/view permission | UsageDTO | 200 | n/a/no |
| POST | `/api/v1/discovery/jobs` | submit discovery | discovery capability | CreateDiscoveryJob | 202/403 | yes/yes |
| GET | `/api/v1/discovery/jobs/{id}` | job status | workspace | DiscoveryJobDTO | 200/404 | n/a/no |
| GET | `/api/v1/discovery/jobs/{id}/results` | paginated results | workspace | ResultList | 200 | n/a/no |
| POST | `/api/v1/businesses/{id}/convert-to-lead` | explicit conversion | CRM create | ConvertBusinessRequest | 201/409 | yes/no |
| GET | `/api/v1/leads/{id}/360` | aggregate Lead 360 | CRM view | Lead360DTO | 200/404 | n/a/no |
| PATCH | `/api/v1/leads/{id}` | update Lead | CRM update + version | LeadUpdate | 200/409 | client-key/no |
| POST | `/api/v1/conversations/{id}/messages` | send message | messaging permission | SendMessage | 202/403 | yes/yes |
| GET | `/api/v1/deals` | filter/list Deals | pipeline view | DealList | 200 | n/a/no |
| POST | `/api/v1/deals` | create Deal | pipeline create | DealCreate | 201 | yes/no |
| POST | `/api/v1/deals/{id}/stage` | move stage | pipeline update | StageMove | 200/409 | yes/no |
| POST | `/api/v1/deals/{id}/close` | explicit Won/Lost | close permission | CloseDeal | 200/409 | yes/no |
| POST | `/api/v1/automation/runs/{id}/approve` | approve sensitive run | automation approver | Approval | 200/409 | yes/no |
| GET | `/api/v1/analytics/overview` | derived metrics | analytics view | AnalyticsOverview | 200 | n/a/no |
| GET | `/api/v1/dashboard/overview` | read-only dashboard aggregate | analytics/dashboard view | DashboardOverview | 200 | n/a/no |
| POST | `/api/v1/revenue-events` | explicit recognition | revenue permission | RevenueEventCreate | 201/409 | yes/no |
| GET | `/api/v1/attribution` | touchpoint report | analytics view | AttributionReport | 200 | n/a/no |
| POST | `/api/v1/billing/upgrade-quotes` | quote/validate plan | billing admin | QuoteRequest | 201 | yes/no |
| POST | `/api/v1/billing/payments` | create Tap payment | billing admin | PaymentCreate | 202 | yes/yes |
| GET | `/api/v1/billing/invoices` | invoices | billing view | InvoiceList | 200 | n/a/no |
| POST | `/api/v1/files/uploads` | signed upload | file permission | UploadRequest | 201 | yes/no |
| GET | `/api/v1/files/{id}/download` | signed/proxied download | object permission | redirect/stream | 200/403 | n/a/no |
| GET | `/api/v1/health/live` | process liveness | public/internal | Health | 200 | n/a/no |
| GET | `/api/v1/health/ready` | DB/Redis readiness | internal | Health | 200/503 | n/a/no |

All endpoints use workspace/object authorization, stable DTOs, allow-listed filters, request correlation, and safe errors. Provider webhooks are internal gateway routes and are not user-facing resource mutations.

## B0-FIX.3 synchronization rules

The catalog uses the same base-path convention as OpenAPI: `servers.url` carries `/api/v1`, so OpenAPI path keys omit that prefix. Every catalog row is represented by an OpenAPI operation with a unique `operationId`; internal provider webhook routes remain outside this user-facing catalog.

Discovery submission, message send, and payment creation are asynchronous where marked `202`. Discovery results, Deals, and invoices are cursor-paginated with `PageInfo`. List endpoints expose the standard `cursor`, `limit` (1–100), allow-listed `filters`, and allow-listed `sort` where applicable. Durable mutation commands use `Idempotency-Key`; unsafe session-authenticated mutations require CSRF; editable resources require `version`/`If-Match`, and stale writes use `409`. Closing a Deal as won changes Deal state only; it does not create RevenueEvent. Money uses decimal `amount` plus authoritative ISO-4217 `currency`; any mirrored currency must match it.
