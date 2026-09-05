# 20 — Release Plan

> **Status: FINALIZED** against the approved decisions. `GAP-007` merge execution is out of the G2 critical path; `GAP-009`, `GAP-018`–`GAP-020`, `GAP-024` are deferred.

> Resolves brief §36. Releases are derived from the dependency graph in `03_MASTER_GAP_MATRIX.md` §3, not from the brief's suggested grouping. **No hour estimates are given — no evidence supports them.** Complexity is `LOW|MEDIUM|HIGH|VERY_HIGH`.

## G0 — Customer Core
**Outcome** A workspace can manage customers and contacts without ever touching Discovery.
**Gaps** `GAP-001`, `GAP-002`, `GAP-003`, `GAP-005`, `GAP-025`
**Amendments** `CA-01` (**`NON_ADDITIVE`** — the root), `CA-03`, `CA-05`, `CA-06`, `CA-07`, `CA-08`, `CA-09`, `CA-10`, `CA-14`
**Frontend** N1 Customers, N2 Customer 360, N3 Contacts, N4 Contact detail; X1 manual Lead, X3 Lead 360 contact management; IA restructure
**Backend** new `customers` app; B2 Lead-origin widening; Contact↔Customer linkage; standalone contact selectors
**Database** `customers`, `customer_contacts`; `contacts.customer_id`; `leads.business_id` nullable + widened `origin_type`; narrowed CRM-INV-10 index
**API** `/customers*`, `/contacts`, `POST /leads` · **Commands** 7 new · **Events** 4 new · **Permissions** 8 new
**Integrations** none · **Migration** additive, no backfill
**Security** new bulk PII egress surface (contacts list) — requires `B2-D-C008` masking decision
**Tests** `GT-B-1`, `GT-B-2`, `GT-B-6`; negative controls proving **no fake Business, no fake DiscoveryJob and no `lead_provenance` row** is created for a non-Discovery Lead; Track-A regression proving conversion is unchanged
**Demo** **Demo A — delivered at the end of G0** · **DoD** a workspace with zero `discovery_jobs` creates a customer (either `party_kind`), links a contact, adds a task and a deal — and Track A behaves identically to today
**Dependencies** none · **Complexity** **HIGH** (root amendment + new app + 4 screens)

## G1 — Existing-Customer CRM
**Outcome** Customers become workable records with the workspace's own fields, and the product knows which track a workspace is on.
**Gaps** `GAP-004`, `GAP-010`, `GAP-011`  *(`GAP-024` deferred)*
**Frontend** X2 convert-to-customer, X4 custom fields sections, X9/X10 settings + mode-aware dashboard, onboarding question
**Backend** `customfields` app; `ConvertLeadToCustomer`; `workspaces.operating_mode` preference
**Database** `field_definitions`, `custom_field_values`; `customers.origin_lead_id`; one nullable workspace preference
**API** `/customers/{id}` extensions, `/settings/custom-fields` · **Commands** 5 · **Events** 1 · **Permissions** 1
**Migration** additive · **Security** custom-field visibility is presentation, never authorization
**Tests** conversion preserves Lead and provenance; custom-field validation is server-side; mode change requires no migration
**Demo** Demo A extended · **DoD** a Lead converts to a Customer with lineage; a workspace defines and filters on its own field; operating mode changes navigation only
**Dependencies** G0 · **Complexity** **MEDIUM**

## G2 — Identity & Import
**Outcome** Bulk onboarding of an existing customer base, with duplicates visible and resolvable.
**Gaps** `GAP-006`, `GAP-008`  *(`GAP-007` merge **execution** moved out of this release under `PD-006`; G2 ships advisory duplicate **detection** only)*
**Frontend** N5–N9 import wizard; merge review in N2
**Backend** `identity` app; `imports` app
**Database** `party_identifiers`, `merge_records`, `import_batches`, `import_rows`
**API** `/imports*`, `/customers/{id}/merge` · **Commands** 6 · **Events** 3 · **Permissions** 2
**Integrations** none new — **B11 for the file, B12 for async**
**Migration** additive; optional non-blocking backfill of `party_identifiers` from existing contacts
**Security** **the highest-risk release**: bulk write path + merge rewriting references. Merge is human-only, reason-required, workspace-bounded; imports invoke domain commands, never tables
**Amendments** `CA-10` (already in G0); `CA-04` registered but **not** scheduled here
**Tests** dry run writes nothing; per-row idempotency; `UNKNOWN` rows never auto-retried; merge never touches an immutable B9 row; no cross-workspace resolution
**Demo** Demo B · **DoD** a 1,000-row CSV imports with a correct partial-failure report and a re-importable error CSV
**Dependencies** G0, G1 · **Complexity** **HIGH** (reduced from VERY_HIGH by removing merge execution)

> **Hard sequencing rule.** `GAP-006` ships **with or before** `GAP-003`/`GAP-008` intake paths, because `CA-01` narrows the Business-keyed duplicate index and identity resolution is its replacement (risk `R-18`).

## G3 — WhatsApp AI & Human Operations
**Outcome** A team works WhatsApp together with governed AI assistance and instant human takeover.
**Gaps** `GAP-012`, `GAP-013`, `GAP-014`, `GAP-015`
**Frontend** N10 Team Inbox (rebuild), N13 Knowledge Base, X11 wire Copilot/Agent to a real backend
**Backend** `aiagent` app; `knowledge` app; B5 `handling_mode` extension
**Database** `conversations.handling_mode`; `agent_sessions`, `agent_proposals`, `kb_articles`, `kb_article_versions`, `kb_sources`
**API** handling-mode, takeover, proposals, knowledge · **Commands** 9 · **Events** 7 · **Permissions** 4
**Integrations** **OpenAI** as the initial provider (`PD-003`), reached through the AI Provider Port and an OpenAI Adapter, executed on **existing B12 `providers.slow`** with `provider_request_attempts` and `B12-D-A020` unchanged — no new queue, no new webhook, no second retry mechanism. **No provider semantics enter any business domain** (`29_AI_PROVIDER_ARCHITECTURE.md`)
**Security** the AI authority ladder; agent holds no permissions; consent and service window unchanged
**Amendments** `CA-02`
**Tests** **no AI path sends a message in any mode, and no AI-owned send command exists** (`PD-013`); no model name, prompt or provider error code appears in any business-domain contract; queued AI work re-reads mode at execution; takeover race resolves to one winner; draft-only KB retrieval; every answer cites a published article
**Demo** Demo C · **DoD** an inbound WhatsApp from an existing customer resolves to that customer, the AI drafts a grounded reply, and a human takes over with AI pausing immediately
**Dependencies** G0, G2 (identity) · **Complexity** **VERY_HIGH**
**Note** This release closes the `inbox.copilot` orphan — a capability currently **sold in PLAN-GROWTH with no backend**.

## G4 — Support
**Outcome** Conversations become tracked, SLA-governed tickets.
**Gaps** `GAP-016`, `GAP-017`
**Frontend** N11 Tickets, N12 Ticket 360; X8 support analytics
**Backend** `support` app; B7 `create_ticket` action + 2 triggers
**Database** `tickets`, `ticket_activities`, `sla_policies`, `ticket_sla_clocks`
**API** `/tickets*` · **Commands** 6 · **Events** 5 · **Permissions** 5
**Integrations** SLA sweep on B12 `maintenance` queue
**Migration** additive · **Security** tickets touch no financial table
**Tests** SLA pause/resume; breach emitted exactly once per clock; breach never auto-acts
**Demo** Demo D · **DoD** a WhatsApp conversation becomes a ticket, its SLA clock runs and pauses correctly, and resolution closes it
**Dependencies** G0, G3 · **Complexity** **HIGH**

## G5 — Sales Enablement *(DEFERRED)*
**Outcome** Priced, sendable quotes — with the revenue firewall provably intact.
**Gaps** `GAP-018`, `GAP-019`, `GAP-020`
**Frontend** N14 Quotes; X5 Deal 360 quotes section; catalog in settings
**Backend** `catalog` + `quotes` apps
**Database** `products`, `quotes`, `quote_lines`
**API** `/products*`, `/quotes*` · **Commands** 8 · **Events** 4 · **Permissions** 5
**Migration** additive; **B6 `deals` gains no column**
**Finance** the firewall is this release's defining constraint
**Tests** `GQ-1`…`GQ-4` negative controls: accepted quote writes no `RevenueEvent`, produces no `tax_invoices` row, and never appears in a revenue selector
**Demo** Demo E · **DoD** a quote is built, sent and accepted, links to a Deal, and **no revenue figure changes anywhere**
**Dependencies** G0, G1 · **Complexity** **MEDIUM**

## G6 — Productivity & Channels *(partially deferred)*
**Outcome** Work arrives at the right person automatically; the calendar is visible; the web captures leads.
**Gaps** `GAP-021`, `GAP-022`  *(`GAP-009` public form intake **deferred** under `PD-010`; only authenticated/protected API intake remains in scope, and it ships with G2's import pipeline)*
**Frontend** X6 calendar view; assignment rules and forms in settings
**Backend** `assignment` app; form intake in `imports`
**Database** `assignment_rules`, `assignment_counters`, `forms`, `form_submissions`
**API** `/forms/{token}/submit` (**`PUBLIC_UNAUTH`**) + settings APIs · **Commands** 6 · **Events** 2 · **Permissions** 2
**Security** **the public unauthenticated surface is the highest single risk in the plan** — token-bound workspace binding, B13 rate limiting, abuse controls, consent capture, no PII echo in responses
**Tests** round-robin distributes fairly under concurrency using a PostgreSQL counter (never Redis); form submission cannot address another workspace; spam is rejected before a CRM write
**Demo** form → Lead → assigned owner → task
**Dependencies** G0, G2, G4 · **Complexity** **HIGH**

## G7 — Reporting Expansion
**Outcome** Track B and C become measurable without touching revenue truth.
**Gaps** `GAP-023`
**Frontend** X8 new Analytics sections
**Backend** read-model selectors only · **Database** none · **Events/Permissions** none new
**Tests** no revenue metric derives from a Deal, Quote, pipeline value or customer count; `unattributed` renders as a first-class category
**DoD** eleven new sections, each permission-filtered, with revenue still sourced solely from `revenue_events`
**Dependencies** G0–G6 · **Complexity** **MEDIUM**

## Deferred
`GAP-007` merge execution · `GAP-009` public forms (`PD-010`) · `GAP-018`/`GAP-019`/`GAP-020` Products & Quotes (`PD-009` rejects Price Books; the rest deferred) · `GAP-024` operating-mode onboarding · `GAP-026` Email (P2) · `GAP-027` Customer Portal (P2, `CONFLICT_BLOCKED`).

## Sequencing rationale
G0 is first because `CA-01` unblocks everything. G2 precedes G3 because inbound WhatsApp resolution needs the identity index, and `GAP-006` must not lag `CA-01`'s index narrowing. G4 follows G3 because tickets are created from conversations. **G5 (sales documents) is deferred rather than parallelised** — support beats sales documents for a WhatsApp-first CRM, and G5 competed with G3/G4 for the same capacity. G7 is last because it reports on everything before it. **No release dependency was invented to preserve the earlier ordering.**
