# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Data classification

| Class | Examples | Handling |
|---|---|---|
| Public business | name, category, public address, website | provenance, correction/deletion policy |
| Contact PII | phone, email, contact name | workspace access, masking, purpose limitation |
| Private communications | messages, media references | least privilege, retention decision, encrypted transport |
| AI content | prompt input snapshot, output, model metadata | minimize, redact, prompt version, retention limit |
| Provider payloads | raw Places/scraper/Meta callbacks | restricted JSONB, short retention, hash/reference |
| Financial | payment attempts, invoices, refunds | strict billing permission, immutable audit |
| Tax | VAT, TaxInvoice, ZATCA submissions | regulatory retention; official validation required |
| Operational | logs, traces, job errors | scrubbed, bounded retention |

Default retention must be a product/legal decision. Proposed starting points are 30 days for raw provider payloads, 30 days for temporary exports, 90 days for raw AI snapshots, and longer policy-defined retention for CRM records, financial records, tax documents, and audit logs. Deletion workflows must preserve legal/audit records where required and anonymize rather than erase relational history when necessary.

Scraping must respect provider contracts, robots/terms considerations, provenance, user deletion, and applicable law. No document claims legal compliance; Saudi data locality and exact retention are marked **PRODUCT / LEGAL DECISION REQUIRED**. Admin/export views mask phone/email and never include secrets or raw card data.
