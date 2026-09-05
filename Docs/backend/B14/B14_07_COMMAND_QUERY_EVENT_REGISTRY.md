# B14_07 — Command / Query / Event Registry

## 1. Commands

Every command: one transaction · guards before writes · audit row · outbox publish inside the same transaction. **No command duplicates a frozen command.**

### 1a. Frozen commands implemented as-is

`Register`, `VerifyEmail`, `Login`, `Logout`, `RevokeSession`, `ChangePassword`, `ResetPassword`, `CreateWorkspace`, `InviteMember`, `AcceptInvitation`, `ChangeMemberRole`, `SuspendMember`, `RemoveMember`, `TransferOwnership`, `SwitchWorkspace` (B1) · `ConvertBusinessToLead`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`, `AddTag`, `RemoveTag`, `ArchiveLead`, `AddContact`, `UpdateContact`, `RemoveContact`, `CreateTask`, `UpdateTask`, `CompleteTask`, `CancelTask`, `ScheduleAppointment`, `RescheduleAppointment`, `CancelAppointment`, `AddNote`, `RemoveNote` (B2) · `CreateDiscoveryJob`, `CancelDiscoveryJob`, `MergeBusiness`, `ExportResults` (B3) · `RequestAnalysis`, `Reanalyze`, `CancelAnalysis` (B4) · **`SendMessage`**, `SendTemplateMessage`, `CancelMessage`, `ApplyProviderMessageStatus`, `MarkConversationRead`, `ArchiveConversation`, `ReopenConversation`, **`AssignConversation`**, `SyncProviderTemplates`, `UpdateProviderConfiguration`, `CheckProviderConfiguration` (B5) · `CreateDeal`, `UpdateDeal`, `MoveDealStage`, `CloseDeal` (B6) · `CreateRule`, `ActivateRevision`, `PauseRule`, `ApproveRun`, `RejectRun` (B7) · `StartCheckout`, `ChangePlan`, `ApplyPaymentWebhook` (B8) · **`RecordRevenueEvent`**, `ReverseRevenueEvent`, `RecordTouchpoint` (B9) · `IssueTaxInvoice`, `SubmitToZatca` (B10) · `RequestUpload`, `AttachFile`, `DeleteFile` (B11) · `ConfigureIntegration`, `EnableIntegration`, `DisableIntegration`, `ReplayDeadLetter`, `AbandonDeadLetter`, `ResolvePlatformReconciliationCase` (B12).

**`RetryJob` and `RetryWebhook` remain SYSTEM-ONLY** (`B12-D-A053`) — no API, no operator path, no CLI.

### 1b. New commands

| Command | Module | Actor | Permission | Preconditions | Writes | Events | Idempotency | Failures |
|---|---|---|---|---|---|---|---|---|
| `CreateCustomer` | customers | human | `customer.create` | `party_kind` valid; owner in workspace; CUS-4 | `customers` | `CustomerCreated` | client key | `422`, `409`, `ENTITLEMENT_LOCKED`, `QUOTA_EXCEEDED` |
| `UpdateCustomer` | customers | human | `customer.update` | not archived; `If-Match` | `customers` | `CustomerUpdated` | version | `409`, `404` |
| `ArchiveCustomer` | customers | human | `customer.archive` | not archived | `customers` | `CustomerArchived` | version | `409` |
| `LinkContactToCustomer` | customers | human | `customer.update` | same workspace; **CUS-3 for `person`** | `customer_contacts` | `ContactLinkedToCustomer` | unique link | `409` duplicate link |
| `UnlinkContactFromCustomer` | customers | human | `customer.update` | link active; **refused if sole Contact of a `person`** | `customer_contacts` | — | soft unlink | `409` |
| `ConvertLeadToCustomer` | customers | human | `customer.create` | Lead exists, not archived, not converted | `customers` | `LeadConvertedToCustomer` | `origin_lead_id` unique | `409` already converted |
| **`CreateLead`** | crm | human | `lead.create` | **`CA-01`**: discovery ⇒ `business_id`+`converted_at`; non-discovery ⇒ neither, **no provenance row**; `whatsapp` rejected. **`CA-15`**: `business_id IS NULL` ⇒ **a primary Contact is required** — see §1c | `leads`, `lead_contacts`, possibly `contacts` | `LeadCreated`, `ContactAdded` | client key | `422` invalid origin, `422` missing primary Contact, `QUOTA_EXCEEDED` |
| `DefineCustomField` / `ArchiveCustomField` | customfields | admin | `customfield.manage` | unique `(workspace, subject, key)`; key immutable | `field_definitions` | — | key uniqueness | `409` |
| `SetCustomFieldValues` | customfields | human | subject's own update perm | type + required validation server-side | `custom_field_values` | subject's own | per subject+definition | `422` |
| `CreateImportBatch` | imports | human | `import.manage` | file passes B11 gates | `import_batches` | `ImportBatchCreated` | client key | file gates |
| `SetImportMapping` | imports | human | `import.manage` | batch `uploaded` | `import_batches` | — | version | `422` unmapped required |
| `RunImportDryRun` | imports | human | `import.manage` | mapping set | **nothing** | — | n/a | `422` |
| `CommitImportBatch` | imports | human | `import.manage` | dry run complete | `import_batches`, `import_rows` | `ImportBatchCompleted` | `(batch_id,row_number)` | `409` |
| `SetConversationHandlingMode` | messaging | human | `messaging.manage` | conversation open; `If-Match` | `conversations` | `ConversationHandlingModeChanged` | version | `409` |
| `StartHumanTakeover` / `EndHumanTakeover` | messaging | human | `messaging.manage` | row-locked CAS on `(id, mode, version)` | `conversations` | `HumanTakeoverStarted/Ended` | version | `409` loser sees winner |
| `StartAgentSession` | aiagent | human | `ai.use` | capability enabled | `agent_sessions` | — | client key | `ENTITLEMENT_LOCKED` |
| `GenerateAgentProposal` | aiagent | **system** | — | `handling_mode='ai_assisted'` **re-read at execution** | `agent_proposals` | `AgentProposalCreated` | `(session,intent,context_hash)` | no-op if mode changed |
| **`AcceptAgentProposal`** | aiagent | **human** | `ai.use` **+ the target command's own permission** | proposal fresh | `agent_proposals`; **then invokes the owning domain's command as the human** | `AgentProposalAccepted` | proposal id | `403`, `409` stale |
| `RejectAgentProposal` | aiagent | human | `ai.use` | — | `agent_proposals` | `AgentProposalRejected` | proposal id | — |
| `MergeParties` *(post-P0)* | identity | **human only** | `customer.merge` | same workspace; **reason mandatory** | `merge_records`; archives loser | `PartiesMerged` | `(surviving,merged)` | `422` no reason |
| `CreateArticle`/`PublishArticle`/`ArchiveArticle` | knowledge | human | `knowledge.manage` | version append-only | `kb_articles`, `kb_article_versions` | `KnowledgeArticlePublished` | version | — |
| `CreateTicket`/`AssignTicket`/`ChangeTicketStatus`/`ResolveTicket`/`ReopenTicket` | support | human/automation | `ticket.*` | lifecycle guards | `tickets`, `ticket_activities`, clocks | `TicketCreated/Assigned/Resolved/Reopened` | client key | `409` invalid transition |
| `UpsertAssignmentRule` | assignment | admin | `assignment.manage` | eligible members in workspace | `assignment_rules` | — | version | `422` |
| **`AssignWorkspacePlan`** | **entitlements** | **system** — invoked **only** by `billing` **inside** its own subscription transaction (`B14_03` §6b) | — (not an API surface; no permission code, no endpoint) | a `plan_versions` row exists; workspace in scope | `workspace_plan_assignments` | — | `(workspace_id, subscription_ref)` | `422` unknown plan version |

**`AssignWorkspacePlan` carries no commercial value** — a plan-version reference, a status and an opaque `SUB-*` string. **No amount, currency, payment, invoice or card fact crosses the boundary** (`T-ENT-6`). It exists so that `EvaluateEntitlement` reads only `entitlements`-owned rows and never reaches upward into `billing` (`N-04`).

**Commands deliberately NOT created:** `AgentSendMessage` (**`PD-013`** — one send path only, frozen `SendMessage`, human actor) · `AutoMergeParties` · `RecognizeRevenueFromQuote`/`FromDeal` · `DeleteCustomer`/`DeleteTicket` · `IssueCustomerInvoice` (`B9-D-C004`) · **any Party360 write command** — the composer is read-only and has no command at all · any new operator command · **`PromoteLeadPrimaryContact`** — auto-promotion is never performed (`CA-15`; frozen `B2_CONTACT_MODEL.md` §3 reasoning preserved).

### 1c. `CreateLead` for a Business-less Lead — transactional contract (`CA-15`)

**One transaction. Either a usable Lead exists, or nothing is written.** No intake path may commit a partial, unusable Lead row.

```
BEGIN
  1. resolve or create Contact
        · resolve through identity.resolve_party (workspace-keyed, GAP-006)
        · reuse an existing Contact when found — never insert a duplicate
        · otherwise create one; source = 'manual' | 'import' per origin
  2. create Lead
        · business_id NULL, converted_at NULL, origin_type immutable
        · last_activity_at seeded from created_at (CA-01 rule 5)
  3. link Contact as primary
        · lead_contacts row, is_primary = true
        · frozen partial unique (lead_id) WHERE is_primary AND unlinked_at IS NULL
          already guarantees at-most-one
  4. assert the CA-15 conditional invariant
        · business_id IS NULL ⇒ exactly one active primary link
COMMIT
```

| Rule | Statement |
|---|---|
| Applies to | `manual`, `import`, `api` origin — and `form` whenever `GAP-009` is undeferred. **This does not enable public form intake** (`PD-010` stands) |
| Contact reuse | Through `resolve_party`, the same reuse-before-insert discipline frozen B2 §3 already applies to Discovery contacts. **No duplicate Contact truth is created** |
| Identity safety | `GAP-006`'s boundary is unchanged — workspace-keyed, advisory, **no automatic merge, no cross-workspace resolution** |
| Discovery Leads | **Unchanged.** `ConvertBusinessToLead` keeps its frozen behaviour; the Contact reuse rule in `B2_CONTACT_MODEL.md` §3 applies as frozen |
| Failure | Any step failing rolls back the whole transaction. **`T-CA15-1` asserts no partial Lead row is committed** |

**`UnlinkContactFromLead` / `RemoveContact` under `CA-15`:**

| Lead kind | Behaviour |
|---|---|
| `business_id IS NOT NULL` | **Frozen behaviour unchanged** — unlinking the primary leaves no primary; **no auto-promotion** (`T-CA15-9`) |
| `business_id IS NULL` | Unlinking the **sole** primary is **refused `409`**; the human must promote a replacement in the same operation (`T-CA15-8`). **Auto-promotion is still never performed** |

## 2. Selectors / read models

| Selector | Module | Composition | Freshness |
|---|---|---|---|
| `dashboard` | analytics | KPIs across CRM/pipeline/revenue, permission-filtered | **read-time**, no cache |
| `lead_list`, `customer_list`, `contact_list`, `ticket_list`, `deal_list`, `conversation_list` | owning module | filtered, cursor-paginated | read-time |
| **`party360(root=lead\|customer)`** | **`analytics`** — `Party360Composer` (`B14_03` §5a) | **opaque sections supplied by owning domains through `common/party360/`** — profile (**incl. the `CA-15` `display` block**), contacts, intelligence, conversations, deals, quotes, tickets, activities, files, custom fields, revenue (read-only). **The composer owns no section, no table and no permission**; each provider enforces its own domain's authorization and masking | read-time; **each section independently permission-filtered** |

> **Owner corrected by `B14-FIX.3` (`N-01`).** This row previously read *module: `crm`/`customers`*, which made composition a read-selector call from a contributor into `intelligence`, `messaging`, `pipeline`, `revenue` and `support` — **7 upward edges, 2 same-layer edges, 5 cycles** once the actual edge set was walked. Composition moves to **`analytics` (L10)**, above every contributor; the **external response shape, path, DTO and permissions are unchanged** and frozen B2 is untouched. Section activation per slice is `B14_03` §5b.

**Section states — four (`V-M08`, extended by `B14-FIX.3`).** A consumer must distinguish them, because "not built yet" and "not permitted" are different facts and conflating them makes a slice look complete when it is not:

| State | Meaning | Rendered as |
|---|---|---|
| `present` | The owning slice has shipped and the actor may read it | the section |
| **`unavailable`** | **The owning slice has not shipped yet** — e.g. `deals` before I7, `tickets` before I14, `conversations` before I6, `intelligence` before I4 | **omitted, with the section key absent from the response** |
| `forbidden` | A provider is registered; the actor lacks the **owning domain's** permission | **absent, never a denied page** |
| **`degraded`** | The provider is registered and permitted but raised or timed out | **`null`/`[]`, never a `500`** — frozen `B2_LEAD360_READ_MODEL.md` §5 rule 5. No other section is affected and nothing is rolled back (`T-P360-11`) |

`unavailable` and `forbidden` are both **absent from the payload** so no permission fact leaks through a shape difference; they are distinguished **server-side** for `T-RPT-3` and the demo checks, never by an extra field in the tenant response.
| **`timeline`** | **`analytics`** — `TimelineComposer` (`B14_03` §5e) | **a read-time merge of three contributors' own entries, supplied through `common/party360/`**: `crm` (`crm_activities`), `messaging` and `pipeline`. Ordered `(occurred_at DESC, entry_id DESC)`; deduped in memory on `(source_domain, source_event_id)`; **no cross-domain dedup store, cache or projection exists**; each contributor enforces its own authorization (`conversation.view`, `deal.view`) and masking, and unauthorized entries are simply **absent** | read-time (CRM-INV-13) |

> **Owner corrected by `B14-FIX.4` (`N-09`).** This row previously read *module: `crm`*, which made the merge a read-selector call from `crm`(L5) into `messaging`(L6) and `pipeline`(L7) — **2 upward edges and 2 cycles** once the actual edge set was walked, and the one Party360 section that is itself cross-domain. Composition moves to **`analytics` (L10)** on the **same boundary as `party360`** — no second architecture, no new module, no new table. **`crm_activities` stays `crm`-owned and append-only; nothing is copied into it** (frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3, CRM-INV-13). Contributor activation per slice is `B14_03` §5e/§5b; tests are `T-P360-13..17`.
| `calendar` | crm | union of `tasks` + `appointments` | read-time |
| `inbox` | messaging | conversations + assignment + `handling_mode` | read-time |
| `import_preview`, `import_results` | imports | batch + rows | read-time; durable async progress |
| `resolve_party` | identity | **`INTERNAL_API`** — workspace-keyed candidate list | read-time |
| `kb_retrieval` | knowledge | **published only**, workspace-scoped, with citations | read-time |
| `entitlement` | entitlements | `EvaluateEntitlement` | read-time |
| `revenue`, `attribution` | revenue | frozen B9 selectors | read-time |
| report sections | analytics | 11 new sections | read-time |

**No selector copies commercial truth into a mutable projection.** `last_activity_at` and `next_activity_at` are the only maintained projections, and both are frozen B2 with monotonic `GREATEST()` semantics (CRM-INV-17).

## 3. Event registry

**Frozen events reused unchanged:** `ContactAdded`, `ContactUpdated`, `ContactRemoved`, `LeadConverted`, `ConversationCreated/Assigned/Closed/Reopened`, `MessageSent/Received/Delivered/Failed`, `DealWon/DealLost`, `RevenueRecognized`, `JobSucceeded`, every `Automation*` event, `IntegrationConfigured/Enabled/Disabled`, `PlatformDeadLettered/Replayed/Abandoned`.

**New events — 24 across 18 catalogue rows.** All carry references only, **never PII values**; envelope per frozen B0 (`event_id`, `workspace_ref`, `correlation_id`, `causation_id`, `occurred_at`); all published through the **transactional outbox**; consumers dedup on `(workspace_id, source_event_id)` via their own internal inbox.

| Event | Producer | Consumers | Payload | Idempotency |
|---|---|---|---|---|
| `CustomerCreated` | customers | analytics, automation, identity | `{customer_public_id, workspace_ref, party_kind, origin_kind, occurred_at}` | `event_id` |
| `CustomerUpdated` | customers | analytics | `{customer_public_id, changed_field_names[]}` — **names, never values** | `event_id` |
| `CustomerArchived` | customers | analytics | `{customer_public_id}` | `event_id` |
| `LeadCreated` | crm | analytics, identity | `{lead_public_id, origin_type}` | `event_id` |
| `LeadConvertedToCustomer` | customers | analytics, revenue (context) | `{lead_ref, customer_ref}` | `event_id` |
| `ContactLinkedToCustomer` | customers | — | `{customer_ref, contact_ref, is_primary}` | `event_id` |
| `PartiesMerged` | identity | customers, crm, messaging | `{surviving_ref, merged_ref, party_type, reason_recorded:true}` | `event_id` |
| `ImportBatchCreated` / `ImportBatchCompleted` | imports | analytics | `{batch_ref, counts}` | `event_id` |
| `ConversationHandlingModeChanged` | messaging | aiagent, analytics | `{conversation_ref, from_mode, to_mode, actor_ref}` | `event_id` |
| `HumanTakeoverStarted` / `HumanTakeoverEnded` | messaging | aiagent, analytics | `{conversation_ref, actor_ref}` | `event_id` |
| `AgentProposalCreated/Accepted/Rejected` | aiagent | analytics, audit | `{proposal_ref, conversation_ref, proposal_kind, actor_ref?}` | `event_id` |
| `TicketCreated/Assigned/Resolved/Reopened` | support | analytics, automation | `{ticket_ref, customer_ref?, actor_ref}` | `event_id` |
| `TicketSlaBreached` | support | automation, analytics | `{ticket_ref, policy_ref, breached_at}` | **`(ticket_id, policy_id, clock_id)`** so a repeated sweep cannot re-emit |
| `KnowledgeArticlePublished` | knowledge | aiagent | `{article_ref, version}` | `event_id` |
| `QuoteCreated/Sent/Accepted/Rejected` *(deferred)* | quotes | analytics | `{quote_ref, customer_ref, deal_ref?}` — **`QuoteAccepted` carries no revenue field** | `event_id` |

**Ordering:** no consumer may depend on delivery order. `last_activity_at` uses `GREATEST()`; every other consumer is order-independent or keyed. **No frozen event is redefined, renamed, or given a new payload field.**
