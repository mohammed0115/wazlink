# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Reconciliation jobs

| Process | Compare | Frequency target | Repair authority |
|---|---|---|---|
| Payments | internal Payment vs Tap status | every 15 min | Billing service/admin command |
| Subscriptions | Subscription vs payment/invoice | hourly | Billing service |
| Provider delivery | MessageDelivery vs Meta status | 15 min | Messaging service |
| Discovery | DiscoveryJob vs provider execution | 15 min | Discovery service |
| Scraping | ScrapeJob vs provider execution/callback | 15 min | Scraping service |
| Webhooks | receipt state vs processing result | 5 min | Webhook operations |
| ZATCA | TaxInvoice vs submission status | hourly | Tax service |
| Usage | UsageLedger vs counters | hourly/daily | Entitlement service |

Repairs are explicit, permissioned, idempotent, and audited. Admin cannot edit financial truth directly with SQL. Every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time. Reconciliation must not guess or overwrite a newer authoritative provider state without a documented precedence rule.
