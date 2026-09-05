# 10 — API / Command / Event Plan

> Resolves brief §31 and §32. **No provider endpoint is invented anywhere in this document.**

## 1. Surface classification

| Class | Meaning | Examples |
|---|---|---|
| `PUBLIC_API` | Authenticated workspace member via session | `/customers`, `/tickets`, `/quotes` |
| `INTERNAL_API` | Service-to-service inside WazLink; no route | `resolve_party` |
| `SYSTEM_ONLY` | Invoked by workers only; no human surface | SLA sweep, import row execution |
| `OPERATOR_ONLY` | Platform operator; B13 operator model | none new — this plan adds **no** operator surface |
| `PUBLIC_UNAUTH` | Internet-facing, unauthenticated | **form intake only** (`GAP-009`) — the single highest-risk surface |

## 2. API plan

| Endpoint | Method | Class | Command / Query | Permission | Failure modes |
|---|---|---|---|---|---|
| `/customers` | GET | PUBLIC | `list_customers` | `customer.view` | `403`, scoping-`404` |
| `/customers` | POST | PUBLIC | `CreateCustomer` (`party_kind` required, immutable) | `customer.create` | `422` validation, `409` idempotency replay, `ENTITLEMENT_LOCKED`, `QUOTA_EXCEEDED` |
| `/customers/{id}` | GET/PATCH | PUBLIC | `get_customer` / `UpdateCustomer` | `customer.view` / `.update` | `404` cross-workspace, `409` `If-Match` mismatch |
| `/customers/{id}/archive` | POST | PUBLIC | `ArchiveCustomer` | `customer.archive` | `409` already archived |
| `/customers/{id}/contacts` | POST/DELETE | PUBLIC | `LinkContactToCustomer` / `Unlink` | `customer.update` | `404`, `409` duplicate link |
| `/customers/{id}/merge` | POST | PUBLIC | `MergeParties` | **`customer.merge`** | `403`, `422` missing reason, `409` concurrent merge |
| `/leads` | POST | PUBLIC | `CreateLead` (**Business-less**) | `lead.create` | `422`, `409`, `QUOTA_EXCEEDED` |
| `/leads/{id}/convert-customer` | POST | PUBLIC | `ConvertLeadToCustomer` | `customer.create` | `409` already converted |
| `/contacts` | GET | PUBLIC | `list_contacts` | **`contact.view`** (new) | `403` |
| `/imports` | GET/POST | PUBLIC | `list_imports` / `CreateImportBatch` | `import.manage` | file gates (B11), `422` |
| `/imports/{id}/mapping` | PUT | PUBLIC | `SetImportMapping` | `import.manage` | `422` unmapped required field |
| `/imports/{id}/dry-run` | POST | PUBLIC | `RunImportDryRun` | `import.manage` | `422`; **writes nothing** |
| `/imports/{id}/commit` | POST | PUBLIC | `CommitImportBatch` | `import.manage` | `409` already committed |
| `/imports/{id}/errors.csv` | GET | PUBLIC | `get_import_errors` | `import.manage` | `404` |
| `/conversations/{id}/handling-mode` | POST | PUBLIC | `SetConversationHandlingMode` | `messaging.manage` | `409` version conflict |
| `/conversations/{id}/takeover` | POST | PUBLIC | `StartHumanTakeover` | `messaging.manage` | `409` already taken over |
| `/conversations/{id}/assign` | POST | PUBLIC | `AssignConversation` (**frozen B5, reused verbatim**) | `messaging.manage` | frozen |
| `/agent/proposals/{id}/accept` | POST | PUBLIC | `AcceptAgentProposal` | `ai.use` + the target command's own permission | `403`, `409` stale proposal |
| `/knowledge/articles` | GET/POST | PUBLIC | `list_articles` / `CreateArticle` | `knowledge.view` / `.manage` | `422` |
| `/tickets` | GET/POST | PUBLIC | `list_tickets` / `CreateTicket` | `ticket.view` / `.create` | `422` |
| `/tickets/{id}/resolve` | POST | PUBLIC | `ResolveTicket` | `ticket.resolve` | `409` invalid transition |
| `/quotes` | GET/POST | PUBLIC | `list_quotes` / `CreateQuote` | `quote.view` / `.create` | `422` |
| `/quotes/{id}/accept` | POST | PUBLIC | `AcceptQuote` | `quote.accept` | `409` expired/wrong state |
| `/products` | GET/POST | PUBLIC | `list_products` / `CreateProduct` | `product.manage` | `422` |
| `/forms/{token}/submit` | POST | **`PUBLIC_UNAUTH`** — **DEFERRED, not in the initial wave** (`PD-010` APPROVED: API-first) | `SubmitForm` | **none — token-bound** | rate limit, spam rejection, `404` unknown token |
| `resolve_party(...)` | — | `INTERNAL_API` | query only | none (system read) | returns `unresolved` / `ambiguous`, never guesses |

## 3. New events

Every row states producer, consumer, payload, scope, idempotency identity, audit and async posture, per brief §31.

| Event | Producer | Consumers | Payload (references only, **no PII**) | Idempotency identity | Async |
|---|---|---|---|---|---|
| `CustomerCreated` | customers | analytics, automation(B7), identity | `{customer_public_id, workspace_ref, party_kind, origin_kind, occurred_at}` | event envelope `event_id` | outbox |
| `CustomerUpdated` | customers | analytics | `{customer_public_id, changed_field_names[]}` — **names, never values**, matching frozen `ContactUpdated` discipline | `event_id` | outbox |
| `CustomerArchived` | customers | analytics | `{customer_public_id}` | `event_id` | outbox |
| `LeadConvertedToCustomer` | customers | analytics, B9 (attribution context) | `{lead_ref, customer_ref, occurred_at}` | `event_id` | outbox |
| `ContactLinkedToCustomer` | customers | — | `{customer_ref, contact_ref, is_primary}` | `event_id` | outbox |
| `PartiesMerged` | identity | customers, B2, B5 | `{surviving_ref, merged_ref, party_type, reason_recorded: true}` | `event_id` | outbox |
| `ImportBatchCreated` | imports | — | `{batch_ref, row_count}` | `event_id` | outbox |
| `ImportBatchCompleted` | imports | analytics | `{batch_ref, succeeded, failed, unknown}` | `event_id` | outbox |
| `ConversationHandlingModeChanged` | B5 ext | aiagent, analytics | `{conversation_ref, from_mode, to_mode, actor_ref}` | `event_id` | outbox |
| `HumanTakeoverStarted` / `…Ended` | B5 ext | aiagent, analytics | `{conversation_ref, actor_ref, occurred_at}` | `event_id` | outbox |
| `AgentProposalCreated` | aiagent | — | `{proposal_ref, conversation_ref, proposal_kind}` | `event_id` | outbox |
| `AgentProposalAccepted` / `…Rejected` | aiagent | analytics, audit | `{proposal_ref, actor_ref, resulting_command}` | `event_id` | outbox |
| `TicketCreated` | support | analytics, automation | `{ticket_ref, customer_ref, source_kind}` | `event_id` | outbox |
| `TicketAssigned` / `TicketResolved` / `TicketReopened` | support | analytics | `{ticket_ref, actor_ref}` | `event_id` | outbox |
| `TicketSlaBreached` | support | automation, analytics | `{ticket_ref, policy_ref, breached_at}` | `(ticket_id, policy_id, clock_id)` — **so a repeated sweep cannot re-emit** | outbox, `maintenance` queue |
| `QuoteCreated` / `QuoteSent` / `QuoteRejected` | quotes | analytics | `{quote_ref, customer_ref, deal_ref?}` | `event_id` | outbox |
| `QuoteAccepted` | quotes | analytics, B6 (link only) | `{quote_ref, deal_ref?, accepted_at}` — **carries no revenue field** | `event_id` | outbox |
| `KnowledgeArticlePublished` | knowledge | aiagent (retrieval index) | `{article_ref, version}` | `event_id` | outbox |

**24 new events across 18 catalog rows. Zero frozen events are redefined, renamed, or given new payload fields.**

## 4. Frozen events and commands reused unchanged

`ConvertBusinessToLead`, `AddContact`/`UpdateContact`/`RemoveContact`, `CreateTask`, `ScheduleAppointment`, `AssignLeadOwner`, `ChangeLeadStatus`/`Priority`, `CreateDeal`, `MoveDealStage`, `SendMessage`/`SendTemplateMessage`, `AssignConversation`, `ArchiveConversation`/`ReopenConversation`, `RecordRevenueEvent`, `ReverseRevenueEvent`, `RecordTouchpoint`, `EvaluateEntitlement`, every B11 file command, every B12 outbox/inbox mechanism.

`ContactAdded`, `ContactUpdated`, `ContactRemoved`, `ConversationAssigned`, `ConversationCreated`/`Closed`/`Reopened`, `LeadConverted`, `DealWon`/`DealLost`, `MessageSent`/`Received`/`Delivered`/`Failed`, `RevenueRecognized`, every `Automation*` event.

## 5. Commands the plan deliberately does not create

| Not created | Why |
|---|---|
| `RecognizeRevenueFromQuote` / `…FromDeal` | Revenue firewall — `RecordRevenueEvent` remains the only writer |
| `AutoMergeParties` | Merge is human-only by design |
| `AgentSendMessage` | Would breach `B5-D-A021` and `B7_ACTION_CATALOG.md` §3. **`PD-013` APPROVED: no autonomous customer-facing AI send in this programme.** There is exactly one send path — frozen `SendMessage`, invoked by a human — and **no second, AI-owned send command exists** |
| `DeleteCustomer` / `DeleteTicket` | Archive-only lifecycle across the corpus |
| `IssueCustomerInvoice` | Stays deferred as `B9-D-C004` |
| Any operator-facing command | This plan adds no operator surface; B13's operator model is untouched |
