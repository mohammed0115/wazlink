# WazLink Public-ID Prefix Registry

> **B0 status:** Documentation and contracts only. This registry is normative for API references and does not implement ID generation.

## Purpose

Every externally visible resource uses an immutable, opaque `public_id` with a registered prefix. Internal UUIDv7 primary keys are never exposed as the public contract. Prefixes are case-sensitive and are workspace-scoped unless a row explicitly states otherwise.

## Canonical registry

| Prefix | Entity | Owning domain | Example | Notes |
|---|---|---|---|---|
| `USR-` | User | Identity & Access | `USR-1001` | Account identity; not tenant authority |
| `SES-` | Session | Identity & Access | `SES-1001` | Server session reference |
| `BUS-` | Business | Business/Discovery | `BUS-1042` | Canonical business identity |
| `JOB-` | DiscoveryJob | Discovery | `JOB-1028` | Discovery run/job identity |
| `RES-` | DiscoveryResult | Discovery | `RES-2042` | Result tied to a DiscoveryJob and Business |
| `LEAD-` | Lead | CRM | `LEAD-1042` | Canonical customer/CRM identity |
| `CONV-` | Conversation | Messaging | `CONV-3042` | Conversation context |
| `MSG-` | Message | Messaging | `MSG-3043` | Child of Conversation |
| `TSK-` | Task | CRM | `TSK-2042` | Lead-owned task |
| `APT-` | Appointment | CRM | `APT-2042` | Lead-owned appointment |
| `DEAL-` | Deal | Pipeline | `DEAL-4042` | Lead-owned commercial opportunity |
| `PIPE-` | Pipeline | Pipeline | `PIPE-1001` | Workspace pipeline |
| `STG-` | Stage | Pipeline | `STG-1002` | Pipeline stage |
| `ACT-` | Activity | CRM/Activity | `ACT-5001` | Immutable timeline entry |
| `RUN-` | AutomationRun | Automation | `RUN-6001` | Automation execution |
| `REV-` | RevenueEvent | Revenue | `REV-7001` | Customer revenue recognition only |
| `ATT-` | AttributionTouchpoint | Attribution | `ATT-8001` | Attribution touchpoint; never amount truth |
| `SUB-` | Subscription | Billing | `SUB-9001` | Platform subscription only |
| `INV-` | Invoice | Billing | `INV-10001` | Platform Billing invoice |
| `PAY-` | Payment | Billing | `PAY-11001` | Provider-neutral payment record |
| `TAX-` | TaxInvoice | Tax | `TAX-12001` | ZATCA-facing tax document |
| `FILE-` | FileAsset | Files | `FILE-13001` | Controlled storage asset |
| `WHR-` | WebhookReceipt | Webhooks | `WHR-14001` | Inbound callback receipt |
| `AUD-` | AuditLog | Audit | `AUD-15001` | Immutable audit record |

## Invariants

`BUS-*`, `LEAD-*`, `CONV-*`, `DEAL-*`, `REV-*`, and `ATT-*` must never be matched by display name. Relations use typed public-ID references and workspace authorization. `DEAL-*` does not imply `REV-*`; a `REV-*` is created only by the explicit revenue-recognition command. `SUB-*`, `INV-*`, `PAY-*`, and `TAX-*` are Platform Billing/Tax identities and are not customer CRM revenue identities.

The registry is additive and migration-safe: existing frontend canonical IDs remain valid. Any future prefix addition requires an ADR update, API/DTO update, and traceability entry before implementation.
