# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Logical ERD

```mermaid
erDiagram
  WORKSPACE ||--o{ MEMBERSHIP : has
  USER ||--o{ MEMBERSHIP : joins
  WORKSPACE ||--o{ DISCOVERY_JOB : owns
  DISCOVERY_JOB ||--o{ DISCOVERY_RESULT : yields
  BUSINESS ||--o{ DISCOVERY_RESULT : identified
  BUSINESS ||--o{ LEAD : converts_to
  LEAD ||--o{ CONTACT : has
  LEAD ||--o{ CONVERSATION : owns
  CONVERSATION ||--o{ MESSAGE : contains
  LEAD ||--o{ TASK : has
  LEAD ||--o{ APPOINTMENT : has
  LEAD ||--o{ DEAL : opens
  PIPELINE ||--o{ PIPELINE_STAGE : defines
  PIPELINE_STAGE ||--o{ DEAL : positions
  DEAL ||--o{ REVENUE_EVENT : may_reference
  REVENUE_EVENT ||--o{ ATTRIBUTION_TOUCHPOINT : attributed_by
  BUSINESS ||--o{ ATTRIBUTION_TOUCHPOINT : sourced_by
  WORKSPACE ||--o{ UPGRADE_QUOTE : scopes
  PLAN ||--o{ UPGRADE_QUOTE : quotes
  UPGRADE_QUOTE ||--o| PAYMENT : authorizes
  SUBSCRIPTION ||--o{ INVOICE : bills
  INVOICE ||--o{ PAYMENT : paid_by
  INVOICE ||--o{ TAX_INVOICE : documented_by
  WEBHOOK_RECEIPT ||--o{ OUTBOX_EVENT : may_trigger
  WORKSPACE ||--o{ AUDIT_LOG : records
```

The diagram is conceptual; no migration or executable schema is authorized in B0. RevenueEvent, AttributionTouchpoint, Deal, Invoice, Payment, and TaxInvoice remain separate entities with explicit relationships and permissions. UPGRADE_QUOTE is workspace-scoped Platform Billing state that authorizes at most one Payment lineage; it has no relationship to REVENUE_EVENT and never participates in customer CRM revenue.
