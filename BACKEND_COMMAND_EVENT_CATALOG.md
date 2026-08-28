# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Commands

`CreateDiscoveryJob`, `RetryDiscoveryJob`, `ConvertBusinessToLead`, `AnalyzeLead`, `SendMessage`, `ReceiveMessage`, `CreateTask`, `CompleteTask`, `CreateDeal`, `MoveDealStage`, `CloseDealWon`, `CloseDealLost`, `CreateAutomationRule`, `ApproveAutomationRun`, `RecordRevenueEvent`, `ReverseRevenueEvent`, `InitiatePlanUpgrade`, `CreatePayment`, `ProcessPaymentWebhook`, `ReconcilePayment`, `SubmitTaxInvoice`, and `UploadFile` are explicit commands with workspace, actor, request ID, idempotency key, and authorization context.

## Events

`DiscoveryJobQueued`, `DiscoveryJobCompleted`, `DiscoveryJobFailed`, `BusinessDiscovered`, `BusinessMerged`, `LeadCreated`, `LeadUpdated`, `LeadIntelligenceCompleted`, `MessageReceived`, `MessageSent`, `MessageDelivered`, `MessageFailed`, `TaskCreated`, `TaskCompleted`, `AppointmentCreated`, `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `AutomationRunCreated`, `AutomationRunCompleted`, `RevenueRecognized`, `RevenueReversed`, `PaymentSucceeded`, `PaymentFailed`, `SubscriptionActivated`, `InvoiceIssued`, `TaxSubmitted`, `WebhookProcessed`, and `FileUploaded`.

`DealWon` MUST NOT emit `RevenueRecognized` by default. `RevenueRecognized` requires the separate `RecordRevenueEvent` command or an explicitly approved payment/invoice rule with a documented source. All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID. Events are delivered through transactional outbox and are not an alternative canonical write store.
