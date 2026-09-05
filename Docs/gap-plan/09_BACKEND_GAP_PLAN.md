# 09 — Backend Gap Plan

> Resolves brief §29. **Logical design only. No Python, no migrations, no SQL is authorized by this document.**

## 1. New bounded modules

Nine new Django apps. Each has one aggregate root, its own tables, and no cross-app ORM imports — the boundary discipline B8 states as *"never raw SQL/ORM cross-app import"*.

### 1.1 `customers` — `GAP-001`, `GAP-004`
**Root** `Customer` (`CUS-*`) · **Tables** `customers`, `customer_contacts`
**Party model (`PD-001` APPROVED)** `party_kind ∈ {organization, person}`, NOT NULL, **immutable**. Command guards enforce CUS-3 (a `person` Customer has exactly one active, primary Contact) and CUS-4 (`business_id` only for `organization`). **The Customer row holds no PII** — phone/email/WhatsApp identity lives on the Contact for both kinds, which is what keeps frozen B5 and CRM-INV-18 untouched.
**Workspace ownership** `workspace_id NOT NULL` on both; every selector scoped by it
**Unique** `public_id`; `(customer_id, contact_id) WHERE unlinked_at IS NULL`; partial unique `(customer_id) WHERE is_primary AND unlinked_at IS NULL`
**Indexes** `(workspace_id, status)`, `(workspace_id, party_kind)`, `(workspace_id, owner_membership_id)`, `(workspace_id, name)`, `(workspace_id, updated_at DESC, public_id)`
**Lifecycle** `active ⇄ inactive → archived`; **no hard delete**
**Commands** `CreateCustomer`, `UpdateCustomer`, `ArchiveCustomer`, `LinkContactToCustomer`, `UnlinkContactFromCustomer`, `ConvertLeadToCustomer`, `AssignCustomerOwner`
**Events** `CustomerCreated`, `CustomerUpdated`, `CustomerArchived`, `ContactLinkedToCustomer`, `LeadConvertedToCustomer`
**Permissions** `customer.view|create|update|archive|assign|merge`
**Selectors** `list_customers`, `get_customer`, `party360(root=customer)`
**Validation** name 1–160 trimmed; owner membership workspace-equality; `business_id`/`origin_lead_id` resolve in-workspace or `404` (Doctrine R-2, never `400`)
**Idempotency** `CreateCustomer` accepts a client idempotency key (B0 standard); conversion is guarded by `origin_lead_id` uniqueness
**Audit** `customer.created|updated|archived|owner_changed|merged`
**Async** none. **Reconciliation** none. **Retention** inherits the unresolved CRM retention decision `B2-D-C018`.

### 1.2 `identity` — `GAP-006`, `GAP-007`
**Root** `PartyIdentifier` · **Tables** `party_identifiers`, `merge_records`
**Index** `(workspace_id, identifier_kind, identifier_normalized)` — **non-unique** (CRM-INV-18)
**Commands** `MergeParties` (human-only, reason-required) · **Queries** `resolve_party` (`INTERNAL_API`)
**Events** `PartiesMerged` · **Permissions** `customer.merge`
**Security** `workspace_id` is a mandatory component of every lookup; no API expresses a cross-workspace query
**Async** resolution executes inline in B5's existing inbound pipeline — **no new queue**

### 1.3 `imports` — `GAP-008`, `GAP-009`
**Root** `ImportBatch` · **Tables** `import_batches`, `import_rows`, (`forms`, `form_submissions` for `GAP-009`)
**Unique** `(batch_id, row_number)` — the per-row idempotency identity
**Lifecycle** `uploaded → mapped → dry_run_complete → committing → completed | failed | cancelled`
**Commands** `CreateImportBatch`, `SetImportMapping`, `RunImportDryRun`, `CommitImportBatch`, `CancelImportBatch`
**Events** `ImportBatchCreated`, `ImportBatchCompleted`
**Permissions** `import.manage`
**Async** **B12-conformant**: commit runs on the existing `default` queue; progress is published through the transactional outbox; a partially-failed batch is a **terminal, reportable state**, never an auto-retried one. Per-row failures are recorded, not raised. **No `UNKNOWN` non-idempotent operation is ever retried** (`B12-D-A020`) — a row whose target-command outcome is unknown is recorded `unknown` and surfaced for human resolution.
**Storage** the CSV is a B11 `file_asset`; `file_attachments.subject_type += 'import_batch'`
**Critical rule** import **invokes the owning domain's command** (`CreateCustomer`, `CreateLead`, `AddContact`); it never writes target tables directly

### 1.4 `customfields` — `GAP-010`, `GAP-011`
**Root** `FieldDefinition` · **Tables** `field_definitions`, `custom_field_values`
**Subjects** `lead | contact | customer | deal | ticket`
**Types** `text | number | date | boolean | single_select | multi_select`
**Values** typed columns keyed by `definition_id` — **not** an unstructured JSONB blob, so values stay validatable and indexable and `BACKEND_DATA_GOVERNANCE.md`'s prohibition on JSONB for *"relationships, state, or ownership"* is not strained
**Unique** `(workspace_id, subject_type, key)`; `(subject_type, subject_id, definition_id)`
**Lifecycle** definitions `active → archived` — **never hard-deleted**, so historical values stay interpretable
**Permissions** `customfield.manage` (admin), read via the subject's own view permission
**Search** indexed per type; filtering exposed through the subject's existing list selector

### 1.5 `aiagent` — `GAP-014`
**Root** `AgentSession` · **Tables** `agent_sessions`, `agent_proposals`
**Provider boundary (`PD-003` APPROVED)** This domain owns AI **business semantics**; an **AI Provider Port** exposes typed intents; an **OpenAI Adapter** owns provider translation. No model name, prompt, token count, `finish_reason` or provider error code may appear in this or any other business domain — model choice is **configuration, not domain truth**. See `29_AI_PROVIDER_ARCHITECTURE.md`.
**Authority ladder** `recommend` (render-only) → `propose` (typed, human-confirmable) → `execute` (**closed allow-list: knowledge retrieval and draft creation only**)
**Commands** `StartAgentSession`, `GenerateAgentProposal`, `AcceptAgentProposal` (**human**), `RejectAgentProposal`
**Events** `AgentProposalCreated`, `AgentProposalAccepted|Rejected`
**Permissions** reuse `ai.use`; `agent.manage` for configuration
**Async** B12 `providers.slow`, existing provider-attempt discipline, `unknown` outcomes never blindly retried
**Hard prohibitions** may not send a message, mutate Lead/Deal/Customer, write revenue, change permissions, merge identities, or bypass consent. Accepting a proposal invokes the **owning domain's ordinary command with the human as actor**.

### 1.6 `knowledge` — `GAP-015`
**Root** `KnowledgeArticle` (`KBA-*`) · **Tables** `kb_articles`, `kb_article_versions`, `kb_sources`
**Lifecycle** `draft → published → archived`; **only `published` is retrievable by the agent**
**Permissions** `knowledge.view|manage`
**Storage** source files are B11 `file_assets`; `file_attachments.subject_type += 'kb_article'` — **no second file truth**
**Retrieval** every AI answer carries article citations; an answer with no citation is rendered as ungrounded

### 1.7 `support` — `GAP-016`, `GAP-017`
**Root** `Ticket` (`TKT-*`) · **Tables** `tickets`, `ticket_activities`, `sla_policies`, `ticket_sla_clocks`
**Lifecycle** `new → open → pending → resolved → closed`, plus `reopened → open`
**Commands** `CreateTicket`, `AssignTicket`, `ChangeTicketStatus`, `ResolveTicket`, `ReopenTicket`, `LinkTicketToConversation`
**Events** `TicketCreated`, `TicketAssigned`, `TicketResolved`, `TicketReopened`, `TicketSlaBreached`
**Permissions** `ticket.view|create|update|assign|resolve`
**Async** SLA breach detection is a **scheduled sweep on B12's existing `maintenance` queue** — deliberately starvable, so a breach backlog never displaces user-visible work (`FI-B12-10`)
**Financial posture** a Ticket is never a financial object and touches no B8/B9/B10 table

### 1.8 `catalog` + `quotes` — `GAP-018`–`GAP-020`
**Roots** `Product` (`PRD-*`), `Quote` (`QUO-*`) · **Tables** `products`, `quotes`, `quote_lines`
**Quote lifecycle** `draft → sent → accepted | rejected | expired`
**Commands** `CreateProduct`, `UpdateProduct`, `ArchiveProduct`, `CreateQuote`, `AddQuoteLine`, `SendQuote`, `AcceptQuote`, `RejectQuote`
**Events** `QuoteCreated`, `QuoteSent`, `QuoteAccepted`, `QuoteRejected`
**Permissions** `product.manage`, `quote.view|create|update|send|accept`
**Money** `NUMERIC(19,4)` + ISO-4217, matching the frozen B0 money rule; single currency per quote (`B6-D-C002` keeps multi-currency deferred)
**Revenue firewall** `AcceptQuote` **may link to a Deal and must never write `revenue_events` or be an input to `RecordRevenueEvent`** — enforced by ownership, tested as a negative control
**Tax** a quote may display an estimate; it is **not** a tax document and never writes `tax_invoices`

### 1.9 `assignment` — `GAP-022`
**Root** `AssignmentRule` · **Tables** `assignment_rules`, `assignment_counters`
**Strategies** `round_robin`, `load_balanced` · **Subjects** `lead | conversation | ticket`
**Race handling** the rotation counter is a **PostgreSQL row updated under `SELECT … FOR UPDATE`**, never a Redis counter — CRM-INV-11 and `FI-B0-16`
**Fallback** an explicit fallback membership; when no eligible member exists the subject stays **unassigned** and is reported, never assigned arbitrarily
**Permissions** `assignment.manage`

## 2. Extensions to frozen domains

| Phase | Gap(s) | Extension | Class |
|---|---|---|---|
| B2 | `GAP-003`, `GAP-005` | `leads.origin_type` widened; `business_id`, **`converted_at`** nullable; `last_activity_at` seeding rule; CRM-INV-10 index scoped; `LeadCreated` event | **`NON_ADDITIVE`** (`CA-01`) |
| B2 | `GAP-003`, `GAP-005` | `lead_provenance` applies to Discovery conversion only — non-Discovery Leads have **no** provenance row | `COMPATIBLE_CLARIFICATION` (`CA-14`) |
| B2 | `GAP-001`, `GAP-002` | `contacts.customer_id`; `contacts.source` widened; `customer_contacts` | `ADDITIVE` (`CA-05`) |
| B1/B2 | `GAP-002` | `contact.*` permission family | `ADDITIVE` (`CA-06`) — the trigger `B2-D-C007` names |
| B5 | `GAP-012`, `GAP-013` | `conversations.handling_mode` (**new column, orthogonal to the frozen `status` enum(2)**) | `ADDITIVE` (`CA-02`) |
| B5 | `GAP-013` | Conversation↔Customer link via resolved Contact | `ADDITIVE_EXTENSION` |
| B6 | `GAP-020` *(deferred)* | Deal↔Quote link (FK held by `quotes`, **not** by `deals`) — **no frozen B6 artifact changes, so no amendment item exists** | `NONE` |
| B7 | `GAP-016`, `GAP-017` | new triggers (`customer_created`, `ticket_created`, `sla_breached`) and action `create_ticket` (`auto_safe`) | `ADDITIVE` (`CA-12`) |
| B11 | `GAP-001`, `GAP-008`, `GAP-015`, `GAP-016` | `file_attachments.subject_type` += `customer`, `ticket`, `kb_article`, `import_batch` | `ADDITIVE` (`CA-10`) — the extension path `B11_DOMAIN_ATTACHMENT_MODEL.md` §1 designed for |
| B8 | `GAP-014` + all modules | independent per-module capability keys; `inbox.copilot` **reused** | `ADDITIVE` (`CA-11`, `PD-003`/`PD-004` APPROVED) |
| B0 | `GAP-001`, `GAP-015`, `GAP-016`, `GAP-018`, `GAP-019` | `BACKEND_PUBLIC_ID_REGISTRY.md` += `CUS-`, `TKT-`, `QUO-`, `PRD-`, `KBA-` | `ADDITIVE` (`CA-03`) |
| B0 | all new-entity gaps | `BACKEND_DATA_MODEL.md` new table groups | `ADDITIVE` (`CA-07`) |

**Frontend-only gaps with no backend module by design:** `GAP-025` (navigation IA) and `GAP-021` (calendar view — a read model over existing `tasks`/`appointments`, reusing `task.view`/`appointment.view`). `GAP-005` has no module of its own: it is the **acceptance proof** that Track B works with zero Discovery, verified by `GT-B-1`…`GT-B-6`.

## 3. Domains explicitly untouched

**B1** (identity/RBAC mechanism — new permissions are additive rows, no cell changes), **B3** (Discovery), **B4** (Intelligence), **B9** (Revenue — already dual-track ready), **B10** (Tax), **B12** (async mechanics — reused, not modified), **B13** (security contract — inherited, not weakened).

## 4. Error codes and idempotency

All new commands use the frozen B0 error envelope and existing codes (`ENTITY_NOT_FOUND`, `PERMISSION_DENIED`, `VALIDATION_FAILED`, `CONFLICT`, `ENTITLEMENT_LOCKED`, `QUOTA_EXCEEDED`). **Two new codes are proposed**: `DUPLICATE_CANDIDATE_BLOCKED` (only if `PD-006` makes merge blocking) and `IMPORT_ROW_FAILED` (row-level, non-fatal). Every mutating command supports the frozen idempotency-key standard; every versioned entity uses `If-Match` optimistic concurrency per ADR-010.
