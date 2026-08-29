# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Core sequences

```mermaid
sequenceDiagram
  participant U as User
  participant API as Django API
  participant S as Application Service
  participant DB as PostgreSQL
  participant Q as Celery/Redis
  participant P as Provider

  U->>API: POST /discovery/jobs + Idempotency-Key
  API->>S: auth → workspace → permission → entitlement → quota
  S->>DB: transaction: job + reservation + outbox
  API-->>U: 202 JobDTO
  Q->>P: normalized provider request
  P-->>Q: result/callback
  Q->>DB: results + event + usage commit
  U->>API: GET job/results
```

```mermaid
sequenceDiagram
  participant U as User
  participant API as Django API
  participant CRM as CRM Service
  participant DB as PostgreSQL
  U->>API: POST /businesses/{id}/convert-to-lead
  API->>CRM: workspace/permission/idempotency checks
  CRM->>DB: atomic unique conversion + Lead + Activity + Outbox
  CRM-->>API: LeadDTO
  API-->>U: 201 LeadDTO
```

```mermaid
sequenceDiagram
  participant M as Meta
  participant W as Webhook Gateway
  participant DB as PostgreSQL
  participant Q as Celery
  participant Msg as Messaging Service
  M->>W: signed webhook
  W->>DB: verified WebhookReceipt
  W-->>M: fast 2xx
  W->>Q: enqueue receipt
  Q->>Msg: deduplicated normalized event
  Msg->>DB: Conversation/Message/Delivery + Outbox
```

```mermaid
sequenceDiagram
  participant U as User
  participant API as Django API
  participant B as Billing
  participant T as Tap
  participant W as Webhook
  participant DB as PostgreSQL
  U->>API: request upgrade quote
  API->>B: validate workspace/permission/entitlement
  B->>DB: transaction: server-priced upgrade_quotes row (UPQ-*, amount, currency, expires_at) + outbox
  B-->>U: UpgradeQuote (public_id, amount, expires_at)
  U->>API: initiate payment + quote_ref + key
  API->>B: workspace-scoped load of UPQ-* quote
  B->>DB: lock quote, assert active/unexpired, derive plan/amount/currency, consume + create Payment in one transaction
  API->>T: tokenized hosted session using server-authoritative quote values
  T-->>U: redirect/status (not truth)
  T->>W: signed payment webhook
  W->>B: receipt + async processing
  B->>API: reconcile payment → subscription → entitlement → invoice
```

The quote is the commercial source of truth in that sequence: client-supplied amount and currency are validated mirrors and never reach the provider request. Revenue recognition is a separate sequence: an authorized actor/system submits `RecordRevenueEvent`; the Revenue service validates source, amount, currency, idempotency, and relations, then commits RevenueEvent and outbox. `DealWon` alone ends without that write.
