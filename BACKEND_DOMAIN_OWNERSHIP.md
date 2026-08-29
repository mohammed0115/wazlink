# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Domain ownership matrix

| Domain | Canonical owner/module | Aggregate root | Authoritative tables | Allowed writers | Primary readers | Commands | Events | Integrations | Forbidden coupling |
|---|---|---|---|---|---|---|---|---|---|
| Identity & Access | accounts | User/Session | users, sessions | account services | all API auth | Login, Logout, ResetPassword | UserVerified | email provider later | no CRM ownership |
| Workspace | workspaces | Workspace | workspaces, memberships, invitations | workspace services | all tenant queries | CreateWorkspace, InviteMember, SwitchWorkspace | MemberInvited | none | no plan enforcement |
| Entitlements | entitlements | Subscription | plans, capabilities, quotas, subscriptions, usage | entitlement services | API guards, Billing | EvaluateEntitlement, ReserveQuota | UsageReserved | Billing | no CRM revenue |
| Discovery | discovery | DiscoveryJob | discovery_jobs, queries, results | discovery services/workers | Discovery, Analytics | CreateDiscoveryJob, RetryDiscovery | DiscoveryJobCompleted, BusinessDiscovered | Places, scraper | no Lead auto-create |
| Business | discovery/business | Business | businesses, identities | normalization service | CRM, Intelligence | UpsertBusiness, MergeBusiness | BusinessMerged | Places/scraper | no provider schema leakage |
| CRM/Lead | crm | Lead | leads, contacts, tasks, appointments | CRM services | Lead360, Dashboard | ConvertBusinessToLead, UpdateLead | LeadCreated, LeadUpdated | none | no Revenue recognition |
| Intelligence | intelligence | LeadIntelligenceAnalysis | analyses, signals, usage refs | intelligence service | Lead360, Analytics | AnalyzeLead | IntelligenceCompleted | AI Gateway | no automatic send |
| Messaging | messaging | Conversation | conversations, participants, messages, deliveries | messaging service/webhook worker | Inbox, Lead360 | SendMessage, ReceiveMessage | MessageSent, MessageReceived | Meta | no Deal mutation |
| Pipeline | pipeline | Deal | pipelines, stages, deals | pipeline services | Pipeline, Lead360 | CreateDeal, MoveDealStage, CloseDeal | DealCreated, StageChanged, DealWon/Lost | none | no automatic RevenueEvent |
| Automation | automation | AutomationRun | rules, runs, approvals, step runs | automation service/worker | Lead360, Automation | CreateRule, ApproveRun | AutomationCompleted | messaging/CRM adapters | no unapproved sensitive action |
| Revenue | revenue | RevenueEvent | revenue_events, reversals | revenue service only | Analytics, finance ops | RecordRevenueEvent, ReverseRevenueEvent | RevenueRecognized, RevenueReversed | payment/invoice source | no DealWon implicit write |
| Attribution | attribution | AttributionTouchpoint | touchpoints | attribution service | Analytics | RecordTouchpoint | TouchpointRecorded | discovery/campaign | no amount mutation |
| Analytics | analytics | none/read model | query/projection tables | projection workers only | Dashboard, Analytics | RefreshProjection | ProjectionUpdated | canonical domains | no independent truth |
| Billing | billing | Subscription/Invoice/UpgradeQuote | subscriptions, upgrade_quotes, invoices, payments, refunds | billing/payment services | Billing, Admin | CreateUpgradeQuote, CancelUpgradeQuote, InitiateUpgrade, CreatePayment, ReconcilePayment | UpgradeQuoteIssued, UpgradeQuoteConsumed, PaymentSucceeded, SubscriptionActivated | Tap | no CRM Revenue; quote never recognizes revenue |
| Tax | tax | TaxInvoice | tax_invoices, lines, submissions | tax service | Billing/Admin | SubmitTaxInvoice | TaxSubmitted | ZATCA | no payment truth |
| Files | files | FileAsset | file_assets | file service | exports, attachments | CreateUpload, DeleteAsset | FileUploaded | Hostinger | no arbitrary paths |
| Webhooks | webhooks | WebhookReceipt | receipts | gateway only | operations | ReceiveWebhook, RetryWebhook | WebhookProcessed | all callbacks | no direct domain mutation |
| Jobs | jobs/common | WorkerExecution | worker executions | worker coordinator | operations | SubmitJob, RetryJob | JobSucceeded/Failed | Redis/Celery | no domain ownership |
| Audit | audit | AuditLog | audit_logs | audit writer | Admin/Compliance | RecordAudit | none | Sentry correlation | immutable/no secrets |

## Ownership principles

UpgradeQuote is owned by Billing because Billing authorizes payment initiation; it is not a new top-level domain and the Entitlements-owned `plans` catalog remains the sole source of plan definitions that a quote references. Every tenant-owned table includes `workspace_id`. Revenue and Billing have separate tables, permissions, DTOs, events, and analytics semantics. Cross-domain writes occur only through commands/application services and emit typed events; ORM imports across bounded contexts are not permitted in domain code.
