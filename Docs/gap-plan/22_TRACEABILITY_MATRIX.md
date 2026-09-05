# 22 — Traceability Matrix

> Resolves brief §38. **No orphan frontend architecture. No orphan backend feature.**

## 1. Screen → API → Command/Query → Domain → Table → Event → Permission → Test

| Screen | API | Command/Query | Domain | Table/Projection | Event | Permission | Acceptance |
|---|---|---|---|---|---|---|---|
| N1 Customers | `GET /customers` | `list_customers` | customers | `customers` | — | `customer.view` | `GT-B-1` |
| N1 → New | `POST /customers` | `CreateCustomer` (`party_kind`) | customers | `customers` | `CustomerCreated` | `customer.create` | `GT-B-1`, `GT-PK-1..3` |
| N2 Customer 360 | `GET /customers/{id}` | `party360(customer)` | customers + owners | read-model | — | `customer.view` + per-section | `GT-360-1` |
| N2 merge | `POST /customers/{id}/merge` | `MergeParties` | identity | `merge_records` | `PartiesMerged` | **`customer.merge`** | `GT-M-1..3` |
| N3 Contacts | `GET /contacts` | `list_contacts` | B2 | `contacts` | — | **`contact.view`** (Viewer masked server-side, `PD-002`) | `GT-C-1`, `GT-MASK-1` |
| N4 Contact detail | `GET /contacts/{id}` | `get_contact` | B2 | `contacts`, `lead_contacts`, `customer_contacts` | — | `contact.view` | `GT-C-2` |
| N5 Imports | `GET /imports` | `list_imports` | imports | `import_batches` | — | `import.manage` | `GT-I-1` |
| N6 Upload | `POST /imports` | `CreateImportBatch` | imports + B11 | `import_batches`, `file_assets` | `ImportBatchCreated` | `import.manage` + `file.upload` | `GT-I-2` |
| N7 Mapping | `PUT /imports/{id}/mapping` | `SetImportMapping` | imports | `import_batches` | — | `import.manage` | `GT-I-3` |
| N8 Dry run | `POST /imports/{id}/dry-run` | `RunImportDryRun` | imports | **none written** | — | `import.manage` | **`GT-I-4` (NC)** |
| N9 Results | `GET /imports/{id}`, `…/errors.csv` | `get_import_results` | imports | `import_rows` | `ImportBatchCompleted` | `import.manage` | `GT-I-5` |
| N10 Team Inbox | `GET /conversations` | `list_conversations` | B5 | `conversations` | — | `conversation.view` | `GT-X-1` |
| N10 assign | `POST /conversations/{id}/assign` | `AssignConversation` **(frozen)** | B5 | `conversations` | `ConversationAssigned` **(frozen)** | `messaging.manage` | `AT-CONV-7` (frozen) |
| N10 mode | `POST /conversations/{id}/handling-mode` | `SetConversationHandlingMode` | B5 ext | `conversations.handling_mode` | `ConversationHandlingModeChanged` | `messaging.manage` | `GT-X-2` |
| N10 takeover | `POST /conversations/{id}/takeover` | `StartHumanTakeover` | B5 ext | `conversations` | `HumanTakeoverStarted` | `messaging.manage` | **`GT-X-3` (NC)** |
| N10 AI proposal | `POST /agent/proposals/{id}/accept` | `AcceptAgentProposal` | aiagent → owning domain | `agent_proposals` | `AgentProposalAccepted` | `ai.use` + target's own | **`GT-AI-1..3` (NC)** |
| N10 send | `POST /messages` | `SendMessage` **(frozen)** | B5 | `messages` | `MessageSent` **(frozen)** | `message.send` | frozen B5 suite |
| N11 Tickets | `GET /tickets` | `list_tickets` | support | `tickets` | — | `ticket.view` | `GT-T-1` |
| N11 → New | `POST /tickets` | `CreateTicket` | support | `tickets` | `TicketCreated` | `ticket.create` | `GT-T-2` |
| N12 Ticket 360 | `GET /tickets/{id}` | `get_ticket` | support | `tickets`, `ticket_sla_clocks` | — | `ticket.view` | `GT-T-3` |
| N12 resolve | `POST /tickets/{id}/resolve` | `ResolveTicket` | support | `tickets` | `TicketResolved` | `ticket.resolve` | `GT-T-4` |
| N13 Knowledge | `GET/POST /knowledge/articles` | `list_articles`/`CreateArticle` | knowledge | `kb_articles` | `KnowledgeArticlePublished` | `knowledge.view`/`.manage` | `GT-K-1..2` |
| N14 Quotes | `GET/POST /quotes` | `list_quotes`/`CreateQuote` | quotes | `quotes`, `quote_lines` | `QuoteCreated` | `quote.view`/`.create` | `GT-Q-1` |
| N14 accept | `POST /quotes/{id}/accept` | `AcceptQuote` | quotes | `quotes` | `QuoteAccepted` | **`quote.accept`** | **`GQ-1..4` (NC)** |
| X1 New Lead | `POST /leads` | `CreateLead` | B2 ext | `leads` | `LeadCreated` | `lead.create` | **`GT-B-2` (NC)** |
| X2 Convert | `POST /leads/{id}/convert-customer` | `ConvertLeadToCustomer` | customers | `customers` | `LeadConvertedToCustomer` | `customer.create` | `GT-B-4` |
| X3 Lead contacts | `POST /leads/{id}/contacts` | `AddContact` **(frozen)** | B2 | `contacts`, `lead_contacts` | `ContactAdded` **(frozen)** | `lead.update` | frozen B2 suite |
| X4 Custom fields | `PATCH /{subject}/{id}` | subject's own update | customfields | `custom_field_values` | subject's own | subject's own + `customfield.manage` to define | `GT-CF-1..2` |
| X5 Deal quotes | `GET /deals/{id}` | `get_deal` + quote selector | B6 + quotes | `deals`, `quotes` | — | `deal.view` + `quote.view` | `GT-Q-2` |
| X6 Calendar | `GET /activities/calendar` | `list_calendar` | B2 read model | `tasks`, `appointments` | — | `task.view` + `appointment.view` | `GT-CAL-1` |
| X8 Analytics | `GET /analytics/{section}` | section selectors | analytics | read models | — | `analytics.view` + per-section | **`GT-R-1..3` (NC)** |
| X9 Settings | various | config commands | respective | respective | — | `customfield.manage`, `assignment.manage`, `form.manage`, `product.manage`, `settings.manage` | per-section |
| X11 Copilot/Agent | `POST /agent/sessions` | `StartAgentSession` | **aiagent** (OpenAI behind the AI Provider Port) | `agent_sessions` | — | `ai.use`; `agent.manage` to configure | `GT-AI-4`, `GT-AI-5` (no provider token in any business contract) |
| — *(DEFERRED, `PD-010`)* | `POST /forms/{token}/submit` | `SubmitForm` | imports | `form_submissions` | — | **none — token-bound** | `GT-F-1..3` |

## 2. Backend capabilities with no UI — each explicitly classified

| Capability | Classification | Justification |
|---|---|---|
| `resolve_party` | `INTERNAL_API` | System resolver; output surfaces in N10's context panel |
| `party_identifiers` upkeep | `SYSTEM_ONLY` | Side effect of contact/customer writes |
| SLA clock sweep | `SYSTEM_ONLY` | B12 `maintenance` queue; results surface in N11/N12 |
| Import row execution | `SYSTEM_ONLY` | B12 `default` queue; results surface in N9 |
| Quote expiry sweep | `SYSTEM_ONLY` | Surfaces as quote status in N14 |
| KB retrieval index | `SYSTEM_ONLY` | Serves the agent; content managed in N13 |
| Outbox dispatch for 24 new events | `SYSTEM_ONLY` | B12-owned; B13 operator surfaces already cover it |
| `SubmitForm` | `PUBLIC_UNAUTH` | Configured in X9; no member-facing screen of its own |

**No capability is left unclassified**, and none requires a human surface that this plan fails to provide.

## 3. Orphan check

| Check | Result |
|---|---|
| Screens with no backend | **0** — every screen in §1 has an API, command, domain, table and permission |
| Backend capabilities with no UI and no classification | **0** — §2 classifies all 8 |
| New entities with no owning domain | **0** — `04_PRODUCT_DOMAIN_EXPANSION.md` §5 assigns every one |
| New APIs with no authorization | **0 in the approved waves** — the only `PUBLIC_UNAUTH` surface (`POST /forms/{token}/submit`) is **deferred** under `PD-010` (API-first) |
| Consequential commands without a permission | **0** |
| Pre-existing orphans resolved | `#/copilot` and `#/agent` gain an owning backend domain in G3 (`GAP-014`, OpenAI behind the provider port); `#/contacts` gains one in G0; `#/companies` and `#/calls` **removed/deferred** under `PD-012` — **no fake backend domain is created to preserve an old UI label** |
| Duplicate entities / APIs / commands / events | **0** — checked in `48` verification, `00_EXECUTIVE_SUMMARY.md` §7 |
