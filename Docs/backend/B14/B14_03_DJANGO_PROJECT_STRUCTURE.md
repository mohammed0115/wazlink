# B14_03 — Django Project Structure

> **`B14-FIX.1` repair — closes `V-10`, `V-M01`, `V-M02`.** The previous revision listed **26** modules while claiming *"23 modules"*, omitted `accounts`, `identity_access` and `workspaces` from the layering entirely, and declared a layering that its own specified edges violated (`crm ↔ customers`, `automation → support`, `messaging → identity`, `aiagent → knowledge`). §4 now distinguishes **five kinds of relationship** instead of treating every one as an import edge, and §5's DAG is the graph `T-ARCH-1` actually tests.
>
> **`B14-FIX.3` repair — closes `N-01`, `N-03`, `N-04`, `N-05`.** `B14-FIX.2` walked the actual edge set for `customfields` but **not for the other Party360 sections**, so `party360` composition still implied `crm`/`customers` → `intelligence`, `messaging`, `pipeline`, `support`, `revenue`: **7 upward edges, 2 same-layer edges, 5 cycles**. §4 now classifies **five edge kinds `A`–`E`** and publishes the **walker rules** (§4a) so the classification cannot be reinterpreted; §5a states the **Party360 read-composition boundary**; §6 adds rules 12–14 for composition, infrastructure dispatch and the entitlements direction. **No layer moved, no module moved, no exception was added to `T-ARCH-1`.** The layer labels in §5's resolution table, stale since `FIX.1`, are corrected (`N-05`).
>
> **`B14-FIX.4` repair — closes `N-09`.** `B14-FIX.3` moved the ten registry-served Party360 sections above their contributors but left the **`activities`/`timeline`** surface owned by `crm`, even though frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3 defines that surface as a read-time merge of **three** source classes — `crm`, `messaging`, `pipeline`. Under `W-3` that merge is a class `A` import, so the actual set still contained **2 upward edges** (`crm`→`messaging`, `crm`→`pipeline`) and **2 cycles**. The timeline is now a **multi-contributor read composition** on the *same* boundary (§5e) — no second architecture, **no new module, no layer moved, no new durable table, no cross-domain projection and no event-copy**. `MODULE_COUNT` stays **26**.
>
> **`B14-FIX.2` repair — closes `F-03`.** The `B14-FIX.1` layering was validated against §5's *representative* edge list, not the **actual** implied edge set. Walking the actual set mechanically found **seven** violations, not one: `customfields` at L7 was reached **upward** by `crm`, `customers` and `pipeline` (`party360` renders a custom-fields section) and **same-layer** by `imports` and `support`; and the three B1 modules collapsed into one layer produced `identity_access → accounts` and `workspaces → accounts` as same-layer edges. `customfields` moves to the **facility tier beside `files`**, and the B1 tier splits across L1/L2. The layer stack is now **L1–L10**. `SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0` over **82 actual edges** — verified by the walker in §7, not by inspection.

## 1. Repository layout

```
backend/
  manage.py
  pyproject.toml  uv.lock          # B14_29 §3
  Dockerfile                       # B14_30 §3
  config/                          # project package — settings, urls, celery, wsgi
    settings/{base,local,test,staging,production}.py    # B14_29 §5
    celery.py                      # 5 frozen queues only
    urls.py                        # /api/v1/ + /admin/ + /webhooks/
  common/                          # NO business logic — primitives only
    public_ids.py                  # prefix registry validation
    errors.py                      # frozen B0 error envelope
    idempotency.py                 # frozen idempotency-key standard
    concurrency.py                 # If-Match / expected_version (ADR-010)
    pagination.py  masking.py  audit.py  outbox.py
    authz.py                       # the 16-step B1 pipeline, implemented once
    net.py                         # client_ip() — the ONLY forwarded-header parser (B14_31 §5)
    party360/                      # READ-COMPOSITION PRIMITIVES ONLY — §5a, §5e
      contracts.py                 #   SectionProvider protocol · SectionState · SubjectRef
                                   #   TimelineEntryProvider protocol · TimelineEntry
                                   #   TimelineEntryPage · TimelineCursor          (§5e)
      registry.py                  #   SectionRegistry · TimelineContributorRegistry
                                   #   both populated by config/, never by an app
    dispatch.py                    # CommandRegistry — infrastructure dispatch by NAME (§6 rule 13)
  apps/                            # 26 modules — see §3
  adapters/                        # provider translation ONLY — no business logic
    whatsapp/  openai/  places/  scraping/  tap/  storage/
  tests/
```

**`common/` holds primitives, never business rules.** A rule that decides a domain outcome lives in that domain's `services/`. This is the explicit guard against the "giant shared utils" failure. `common/party360/` and `common/dispatch.py` hold **interfaces and a registry — no section logic and no command logic**; the implementations live in the owning modules and the wiring lives in `config/`.

**`config/` is the composition root.** It imports every app in order to route URLs, register Celery tasks, populate `common/party360/registry.py` and populate `common/dispatch.py`. **`config/` is the only package permitted to import upward, and it is excluded from the layering walk** (§4a rule W-2) — a composition root that could not import its components would not be a composition root. **No app may import `config/`.**

## 2. Per-module contract

Every app under `apps/` uses the identical internal shape. Anything absent is absent **deliberately**, not by omission.

```
apps/<module>/
  models.py            # tables owned by this module ONLY
  services/            # commands — the only write path
  selectors/           # read models / queries — no writes
  api/                 # DRF views + serializers (DTO mapping)
  permissions.py       # permission codes this module enforces
  events.py            # events produced + consumed
  party360.py          # this module's Party360 SectionProvider (§5a) and/or its
                       # TimelineEntryProvider (§5e), where it has one
  tasks.py             # Celery tasks (queue named explicitly)
  admin.py             # Django Admin registration
  apps.py  tests/
```

**Repositories** are introduced **only** where a frozen contract requires an abstraction seam — in practice only `adapters/`. Elsewhere the Django ORM inside `services/`/`selectors/` *is* the repository; adding a second indirection would be ceremony without a frozen requirement.

## 3. Module ownership map — **26 modules**

> **`V-M01` corrected.** The table has always held 26 rows. The prior "23" was the count of §5's layering, which had silently dropped the three B1 modules. **The real number is 26 and is stated as 26.**

| # | Module | Layer | Domain owner | Owns tables | Key commands | Key selectors | Adapters |
|--:|---|:--:|---|---|---|---|---|
| 1 | `accounts` | L1 | B1 | `users`, `user_credentials`, `user_email_tokens` | Register, VerifyEmail, ChangePassword, ResetPassword | current user | — |
| 2 | `identity_access` | L2 | B1 | `sessions` | Login, Logout, RevokeSession | active sessions | — |
| 3 | `workspaces` | L2 | B1 | `workspaces`, `memberships`, `invitations`, `roles` | CreateWorkspace, Invite, AcceptInvitation, ChangeRole, TransferOwnership | members, workspace | — |
| 4 | `entitlements` | L3 | B8 | `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas`, `usage_counters`, `usage_ledger` | — (read-mostly) | `EvaluateEntitlement`, quota | — |
| 5 | `files` | L3 | B11 | `file_assets`, `file_attachments` | RequestUpload, AttachFile, DetachFile, DeleteFile | download ticket | `storage` |
| 6 | `platform_async` | L3 | B12 | `outbox_events`, `worker_executions`, `provider_request_attempts`, `webhook_receipts`, `integration_connections`, `integration_health_snapshots`, `platform_dead_letters`, `platform_reconciliation_cases` | ConfigureIntegration, **CheckProviderConfiguration**, EnableIntegration, DisableIntegration, ReplayDeadLetter, AbandonDeadLetter, ResolveReconciliationCase | dead letters, cases, health | all |
| 7 | `auditlog` | L3 | B13 | `audit_logs` | AppendAuditRow (internal) | audit search | — |
| 8 | `identity` | L4 | **new** (`GAP-006`) | `party_identifiers`, `merge_records` | **MergeParties** *(post-P0)* | `resolve_party` (**internal**) | — |
| 9 | `discovery` | L4 | B3 | `discovery_jobs`, `discovery_queries`, `discovery_results`, `businesses`, `business_identities` | UpsertBusiness, CreateDiscoveryJob, CancelJob, MergeBusiness | jobs, results, business | `places`, `scraping` |
| 10 | `billing` | L4 | B8 | `billing_customers`, `subscriptions`, `upgrade_quotes`, `invoices`, `invoice_lines`, `payments`, `payment_attempts`, `refunds` | StartCheckout, ApplyPaymentWebhook, ChangePlan | subscription, invoices | `tap` |
| 11 | `assignment` | L4 | **new** (`GAP-022`) | `assignment_rules`, `assignment_counters` | UpsertAssignmentRule | eligible assignee | — |
| 12 | `knowledge` | L4 | **new** (`GAP-015`) | `kb_articles`, `kb_article_versions`, `kb_sources` | CreateArticle, PublishArticle, ArchiveArticle | published retrieval | — |
| 13 | `crm` | L5 | B2 | `leads`, `lead_tags`, `lead_provenance`, `contacts`, `lead_contacts`, `tasks`, `appointments`, `notes`, `crm_activities` | ConvertBusinessToLead, **CreateLead (`CA-01`+`CA-15`)**, AddContact, CreateTask, ScheduleAppointment | lead list, contacts, calendar, **its own `crm_activities` timeline entries** (`TimelineEntryProvider`, §5e). **Lead 360 and the merged timeline are composed by `analytics`, not by `crm`** | — |
| 14 | `tax` | L5 | B10 | `legal_entities`, `tax_profiles`, `tax_buyer_profiles`, `tax_invoices`, `tax_invoice_lines`, `tax_submissions` | IssueTaxInvoice, SubmitToZatca | tax docs | zatca (deferred) |
| 15 | `customers` | L6 | **new** (`GAP-001`) | `customers`, **`customer_contacts`** | CreateCustomer, UpdateCustomer, ArchiveCustomer, LinkContactToCustomer, UnlinkContactFromCustomer, **ConvertLeadToCustomer** | customer list, Customer 360 | — |
| 16 | `intelligence` | L6 | B4 | `intelligence_runs`, `intelligence_signals`, `ai_usage_records` | RequestAnalysis, Reanalyze, CancelAnalysis | analysis, recommendations | via `AIProviderPort` |
| 17 | `messaging` | L6 | B5 | `conversations`, `participants`, `messages`, `message_deliveries`, `templates` | **SendMessage** (human), SendTemplateMessage, ApplyProviderMessageStatus, AssignConversation, **SetConversationHandlingMode**, **StartHumanTakeover** | inbox, conversation | `whatsapp` |
| 18 | `pipeline` | L7 | B6 | `pipelines`, `pipeline_stages`, `deals` | CreateDeal, MoveDealStage, CloseDeal | pipeline, deal | — |
| 19 | `revenue` | L7 | B9 | `revenue_events`, `revenue_reversals`, `attribution_touchpoints` | **RecordRevenueEvent**, ReverseRevenueEvent, RecordTouchpoint | revenue, attribution | — |
| 20 | `customfields` | L3 | **new** (`GAP-010/011`) | `field_definitions`, `custom_field_values` | DefineField, ArchiveField, SetFieldValues | definitions, values | — |
| 21 | `imports` | L8 | **new** (`GAP-008`) | `import_batches`, `import_rows` | CreateImportBatch, SetImportMapping, RunImportDryRun, CommitImportBatch | batch, errors | — |
| 22 | `aiagent` | L8 | **new** (`GAP-014`) | `agent_sessions`, `agent_proposals` | StartAgentSession, GenerateAgentProposal, **AcceptAgentProposal** (human), RejectAgentProposal | proposals | **`openai` via AI Provider Port** |
| 23 | `support` | L8 | **new** (`GAP-016/017`) | `tickets`, `ticket_activities`, `sla_policies`, `ticket_sla_clocks` | CreateTicket, AssignTicket, ResolveTicket, ReopenTicket | ticket list, Ticket 360 | — |
| 24 | `automation` | L9 | B7 | `automation_rules`, revisions, triggers, conditions, actions, `runs`, `step_runs`, `approvals`, `automation_inbox_records` | CreateRule, ActivateRevision, ApproveRun | rules, runs, approvals | — |
| 25 | `analytics` | L10 | B0 semantics | **no tables** — selectors only | — | **`Party360Composer` (§5a)** · **`TimelineComposer` (§5e)** · dashboard + report sections | — |
| 26 | `integrations` | L10 | operator surface | **no tables** — Django Admin over `platform_async` | — | provider operations view | — |

**26 modules. No app owns a table another app owns. `analytics` and `integrations` own no tables at all** — they are read/operator surfaces over other modules' truth, which is what keeps them from becoming a second authority.

### `analytics` — the read/query composition surface (`N-01`, `N-03`)

**`analytics` is the pack's read/query composition module, not only its reporting module.** It owns **no table**, mints **no identity**, and is imported by **no app** (§6 rule 5), which is precisely what makes it the only module that can compose across every subject domain without becoming a second authority. It therefore owns **two** read surfaces:

| Surface | Introduced | Content |
|---|---|---|
| **`Party360Composer`** | **I2** | the per-subject 360 composition (§5a) |
| **`TimelineComposer`** | **I2** | the multi-contributor `activities`/timeline merge (§5e) — `crm` entries from I2, `messaging` from I6, `pipeline` from I7 |
| Dashboard + the 11 report sections | I10 (dashboard), I14 (report sections) | aggregate reporting over `revenue_events` and domain counts |

**`analytics` is `INTRODUCED` at I2**, the slice that first ships a 360 read **and the first timeline read**, and `EXTENDED` at I10 and I14. This closes `N-03`: the previous revision extended `analytics` at I14 without any slice ever introducing it, while I2 already shipped Lead 360.

> **The name is historical and the scope is stated here so it cannot be misread.** Party360 is **not** an analytics metric, carries **no** aggregate, and is **not** subject to `BACKEND_ANALYTICS_SEMANTICS.md`'s metric contract. It shares `analytics` only because both are read-only compositions over other modules' truth at the same layer. Nothing in `analytics` may write, and `T-P360-7` asserts it persists nothing — including the timeline merge, which holds no dedup store, cache or projection (`T-P360-17`).

### `customer_contacts` ownership — settled (`V-M02`)

**`customer_contacts` is owned by `customers`** (row 15). This is now consistent in **all four** places that previously disagreed:

| Document | Statement |
|---|---|
| `B14_03` §3 | `customers` owns `customers`, `customer_contacts` |
| `B14_04` `M09` | Two-module group; **`customer_contacts` created under `customers`**, `contacts.customer_id` under `crm` |
| `B14_07` §1b | `LinkContactToCustomer` / `UnlinkContactFromCustomer` are **`customers`** commands writing `customer_contacts` |
| `B14_26` `GAP-002` | Module column reads **`crm` + `customers`**, tables split by owner |

## 4. Edge classification — five kinds, `A`–`E`

The original error was treating every relationship as an import edge, which made a real DAG look impossible. The opposite error is equally fatal: **classifying a genuine import as something softer in order to make the graph pass.** The classification below is therefore mechanical, and §4a publishes the walker rules that apply it, so no future agent can reinterpret a class to escape a violation.

| Class | Kind | Mechanism | Compile-time import between apps? | Constrains layering? | Enforced by |
|:--:|---|---|:--:|:--:|---|
| — | **Domain ownership** | which module's `models.py` declares the table | n/a | n/a | `T-SCHEMA-1` |
| **A** | **Compile / import dependency** | `apps.a` imports any symbol from `apps.b` — a command, a selector, a serializer, a model | **Yes** | **YES — must be strictly downward** | `T-ARCH-1` |
| **B** | **Runtime port dependency** | `apps.a` calls an interface declared in `common/`, whose implementation is bound at the composition root | **No** — the only import is `a → common` (L0) | **No** | `T-ARCH-8`, `T-P360-8/9`, `T-DISP-4` |
| **C** | **Event dependency** | `a` consumes `b`'s event through the transactional outbox and its own inbox, deduped on `(workspace_id, source_event_id)` | **No** | **No** — direction-free by construction | `T-ARCH-5` |
| **D** | **Infrastructure dispatch** | a task or command is invoked **by registered name** through `common/dispatch.py`, resolved at runtime | **No** — the caller imports `common/dispatch.py` only | **No** | `T-DISP-1..4` |
| **E** | **Read composition** | a **section provider** or a **timeline-entry provider** declared in `common/party360/`, implemented by the owning domain, invoked by the composer through the registry | **No** — every participant imports `common/party360/` only | **No** | `T-P360-8/9/12`, **`T-P360-16`** |
| — | **Schema FK dependency** | a column referencing another module's table, declared as a **Django string reference** (`"crm.Contact"`) | **No** | **No** — constrains **migration order only** (`B14_04` §4) | `T-ARCH-3` |

**A Django FK declared by string reference creates no Python import.** This is what dissolves the apparent `crm ↔ customers` cycle: `contacts.customer_id` is a schema FK, not class `A`.

**Classes `B`, `D` and `E` are not loopholes — they are the same discipline stated three ways.** Each is legitimate *only* because the interface it depends on lives in `common/` at **L0**, below every app, and the binding happens in `config/`, which is outside the walk. If an implementer resolves any of them by importing the other app directly, it becomes class `A` and `T-ARCH-1` fails. There is **no class that permits an app to import an app above it**.

### 4a. Walker rules — published, so the classification cannot drift

`T-ARCH-1` builds and walks the graph under exactly these rules. They are normative.

| # | Rule |
|---|---|
| **W-1** | The graph's **nodes are the 26 apps** in §3. `common/` and `config/` are **not nodes**. |
| **W-2** | **`config/` is excluded from the walk.** It is the composition root; it imports every app by design and is imported by none (`T-ARCH-9`). |
| **W-3** | An edge `a → b` exists **iff** any module under `apps/a/` contains a static import of any symbol under `apps/b/`. This is **class `A`** and it is the **only** edge kind in the graph. |
| **W-4** | The edge set is built by **walking every file under `apps/`** — AST import extraction, not a curated list, and not §5's representative sample. This is the rule `FIX.1` violated and `FIX.2` violated for the Party360 sections. |
| **W-5** | An import of `common.*` produces **no edge** (`common/` is L0 and imports nothing from `apps/` — `T-ARCH-8`). |
| **W-6** | A Django **string-reference FK**, an **outbox/inbox event**, a **name-dispatched command or task**, and a **registry-resolved section or timeline-entry provider** produce **no edge**, because none of them is a static import of another app. Each is independently asserted: `T-ARCH-3`, `T-ARCH-5`, `T-DISP-4`, `T-P360-8/9`, **`T-P360-16`**. |
| **W-7** | Every edge must satisfy `layer(a) > layer(b)`. `layer(a) == layer(b)` is a **same-layer violation**; `layer(a) < layer(b)` is an **upward violation**. Both fail the build. |
| **W-8** | The graph must be **acyclic**. W-7 makes this structurally guaranteed, and the cycle check is retained as an independent assertion, not as a substitute. |
| **W-9** | **No exception list exists.** A per-edge, per-module or per-test waiver is a rejection ground (`B14_24` §5). The counters are `SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0` — never "0 excluding …". |
| **W-10** | The walker must **fail non-zero and name the offending edge** on an injected same-layer edge and on an injected upward edge (`T-ARCH-1a`, `T-ARCH-1b`). A walker that passes on either mutation is itself the defect. |

## 5. The dependency DAG — layers and the edges that produce them

A module may hold a **class `A`** edge **only to a strictly lower layer**. **Same-layer edges are prohibited**, which is why the layers below are finer than the previous revision's five.

```
L10 analytics · integrations                          read / operator surfaces
L9  automation
L8  imports · aiagent · support
L7  pipeline · revenue
L6  customers · intelligence · messaging
L5  crm · tax
L4  identity · discovery · billing · assignment · knowledge
L3  entitlements · files · platform_async · auditlog · customfields
L2  identity_access · workspaces
L1  accounts
L0  common · config
```

**All 26 apps are placed.** `accounts` is **L1** and `identity_access`/`workspaces` are **L2** — below everything, because every tenant-scoped module resolves `workspace_id` and `membership` through them. The B1 tier is split across two layers because `identity_access` (sessions) and `workspaces` (memberships) both read `accounts` (users): collapsing all three into one layer produced two same-layer edges that `T-ARCH-1` is specified to fail on. Their omission was `V-10`'s core defect; the split closes the remainder (`F-03`).

### The four previously-broken relationships, resolved

> **Layer labels corrected by `B14-FIX.3` (`N-05`).** This table carried the `FIX.1` five-layer numbering after `FIX.2` re-layered the pack to **L1–L10**. Every *direction* below was and remains correct; only the labels were stale. The authoritative layer of each module is §3's table and the stack above — never this table.

| Relationship | Class | Resolution |
|---|---|---|
| **`crm` ↔ `customers`** | — | **Not a cycle.** **`customers` (L6) → `crm` (L5)** is the *only* import edge: `LinkContactToCustomer` reads Contact through `crm`'s public selector for the CUS-3 guard. **`crm` imports `customers` nowhere** — `contacts.customer_id` is a string FK, and it is written by a `customers` command, never by `crm`. One-way, downward |
| **`messaging` → `identity`** | `A` | **`messaging` (L6) → `identity` (L4). Downward.** `resolve_party` is a public internal selector |
| **`aiagent` → `knowledge`** | `A` | **`aiagent` (L8) → `knowledge` (L4). Downward.** `kb_retrieval` returns published articles with citations |
| **`automation` → `support`** | `A` | **`automation` (L9) → `support` (L8). Downward.** `CA-12`'s `create_ticket` action invokes `support`'s public `CreateTicket` command. The reverse (`TicketCreated` → automation) is class `C`, direction-free |

### Class `A` edges — a readable sample, **not** the walked set

> **`W-4` governs.** The walker builds the edge set by AST-walking every file under `apps/`. The list below exists so a reader can sanity-check the layering; **it is never the input to `T-ARCH-1`.** Treating it as the input is precisely what produced `F-03` and `N-01`.

`identity_access`(L2) → `accounts`(L1) · `workspaces`(L2) → `accounts`(L1) · `crm`(L5) → `discovery`(L4), `identity`(L4), `files`(L3), **`customfields`(L3)** · `customers`(L6) → `crm`(L5), `discovery`(L4), `identity`(L4), `files`(L3), **`customfields`(L3)** · `intelligence`(L6) → `discovery`(L4), `crm`(L5) · `messaging`(L6) → `crm`(L5), `identity`(L4), `files`(L3), **`assignment`(L4)** · `pipeline`(L7) → `crm`(L5), `customers`(L6), **`customfields`(L3)** · `revenue`(L7) → `crm`(L5), `customers`(L6) · `imports`(L8) → `customers`(L6), `crm`(L5) commands, `files`(L3), **`customfields`(L3)** · `support`(L8) → `customers`(L6), `messaging`(L6), `assignment`(L4), `files`(L3), **`customfields`(L3)** · `aiagent`(L8) → `messaging`(L6), `knowledge`(L4), `crm`(L5), `customers`(L6) · `automation`(L9) → `crm`(L5), `messaging`(L6), `pipeline`(L7), `support`(L8) · `tax`(L5) → `billing`(L4) · `knowledge`(L4) → `files`(L3) · `billing`(L4) → `entitlements`(L3) · `integrations`(L10) → `platform_async`(L3) · **`analytics`(L10) → `crm`(L5), `customers`(L6), `pipeline`(L7), `revenue`(L7), `support`(L8)** for the dashboard and the 11 report sections — all downward, and **imported by no app** (rule 5). **Neither `analytics`'s `Party360Composer` nor its `TimelineComposer` adds a class `A` edge at all**: both reach every contributor through the `common/party360/` registry (class `E`, §5a/§5e). In particular there is **no `analytics → messaging` edge** — the `conversations` section and the `messaging` timeline entries both arrive through the registry.

Every one of the above satisfies `layer(a) > layer(b)`. Independently walked in §7.

**`customfields` is a subject-keyed facility, not a subject orchestrator — and it sits at L3 beside `files` for exactly the same reason.** `file_attachments` and `custom_field_values` are the pack's two generic side-tables: both key rows by `(subject_type, subject_id)`, both declare **no FK to any subject table**, and both are written by the **subject owner calling downward**. The previous revision placed `customfields` at L7 alongside `support`, which produced *five* violations once the actual edge set was walked rather than the representative one — three **upward** (`crm`, `customers`, `pipeline` → `customfields`, because `party360` renders a custom-fields section) and two **same-layer** (`imports`, `support` → `customfields`). Moving it *up* would have deepened the upward edges; moving it **down to the facility tier** removes all five, and removes the `customfields → support` edge entirely because `customfields` calls no subject owner at all. `SetCustomFieldValues` is authorised by the **subject owner**, which resolves its own update permission and then delegates downward — the identical discipline `AttachFile` already uses for B11.

### 5a. Party360 — the read-composition boundary (`B14-FIX.3`, closes `N-01`)

**The defect.** `B14_07` §2 declares `party360(root=lead|customer)` as a selector of **`crm`/`customers`** composing sections owned by `intelligence`(L6), `messaging`(L6), `pipeline`(L7), `revenue`(L7) and `support`(L8). Under `W-3` a selector call is a class `A` import, so the actual implied set contained **7 upward edges** (`crm`→`intelligence`/`messaging`/`pipeline`/`revenue`, `customers`→`pipeline`/`support`/`revenue`), **2 same-layer edges** (`customers`→`intelligence`/`messaging`) and **5 cycles**, because `messaging`, `intelligence`, `pipeline`, `revenue` and `support` all legitimately depend **down** on `crm`/`customers`. **No re-layering can fix that** — the cycles are inherent to placing composition inside a contributor.

**The decision. Party360 is not a CRM aggregate, not a Customer aggregate, and not a new commercial truth. It is a read-only composition, and it moves to a module above every contributor.**

```
                config/  (composition root — registers providers, routes URLs; outside the walk)
                   │
   L10  analytics ─┴─ Party360Composer          composes; owns no table; writes nothing
                   │
                   ▼  reads through common/party360/registry.py   (class E — no app import)
        ┌──────────┼──────────┬──────────┬──────────┬──────────┬──────────┐
      crm(L5)  customers(L6) intelligence messaging  pipeline   revenue   support
                              (L6)        (L6)       (L7)       (L7)      (L8)
        each implements common/party360/contracts.py::SectionProvider in its own party360.py
        each imports common/ (L0) ONLY — never the composer, never another contributor
```

| Property | Statement |
|---|---|
| **Owner** | **`analytics`** (module 25, **L10**) — the smallest existing module that sits above every contributor, owns no table, and is imported by no app. **`MODULE_COUNT` stays 26**; no new business domain was invented |
| **Why not `crm`/`customers`** | they are contributors; composition inside a contributor is what created the 5 cycles |
| **Why not a new module** | `analytics` already carries the exact charter — "a read surface over other modules' truth" — and adding a 27th module would have bought nothing the L10 placement does not already give |
| **Interfaces** | `common/party360/contracts.py` (L0): `SectionProvider`, `SectionState`, `SubjectRef`. `common/party360/registry.py` (L0): `SectionRegistry` |
| **Wiring** | `config/` registers each domain's provider at app-ready time. **A domain never registers another domain's provider, and never imports the registry's other entries** |
| **Endpoints** | `GET /leads/{id}` and `GET /customers/{id}` are **served by the composer** and routed from `config/urls.py`. Path, DTO, permission and status codes are **unchanged** (`B14_06` §2). Every other `/leads/*` and `/customers/*` endpoint stays with `crm`/`customers` |
| **Frozen contract** | the **external response shape is unchanged** — frozen `B2_LEAD360_READ_MODEL.md` §1 is satisfied byte-for-byte. **Frozen B2 is not modified.** What moved is *which module composes the response*, which frozen B2 does not fix |
| **No new truth** | the composer owns **no table, no migration, no event, no command, no cache and no projection**. It holds a response in memory for the duration of one request and nothing else (`T-P360-7`) |
| **No schema coupling** | composition creates **no FK and no migration**. `FORWARD_FK_COUNT` and `MIGRATION_GROUP_COUNT` are untouched |

**Section provider contract.** One shape for every section, so no domain invents its own.

```
SectionProvider.fetch(
    workspace_ref,          # active-workspace scope, server-derived (never client-supplied)
    subject_ref,            # SubjectRef(kind='lead'|'customer', public_id=...)
    actor_context,          # session, membership, role — the B1 pipeline's own context object
    section_key,            # 'contacts' | 'intelligence' | 'conversations' | 'deals' | ...
    query_context           # first-page limits, ordering; never a cursor (B2 §3)
) -> SectionResult(state, payload, meta)
```

**Section states — the existing `V-M08` vocabulary, plus the frozen degraded case.** No new vocabulary is minted.

| State | When | On the wire |
|---|---|---|
| `present` | the owning slice has shipped **and** the actor may read it | the section |
| `unavailable` | **no provider is registered for this section** — the owning slice has not shipped | **key absent** |
| `forbidden` | a provider is registered; the actor lacks the owning domain's permission | **key absent** |
| `degraded` | the provider is registered and permitted but raised or timed out | **`null`/`[]`**, never a `500` — frozen `B2_LEAD360_READ_MODEL.md` §5 rule 5 |

`unavailable` and `forbidden` are both **absent from the payload**, so no permission fact leaks through a shape difference; they are distinguished **server-side only** (`B14_07` §2).

**Authorization — the composer invents nothing.** It resolves the **root** permission (`lead.view` / `customer.view`) and then calls each provider **inside the same request transaction**; **each provider enforces its own domain's permission and its own masking** before returning. The composer cannot widen a decision, cannot cache one (frozen `B1-D-006`), and has **no permission code of its own** — `PERMISSION_ROW_COUNT` is unchanged at 26. A caller holding `lead.view` but not `revenue.view` receives the Lead 360 with the `revenue_refs` key **absent** (`T-P360-10`). Viewer masking stays server-side in each provider's selector (`PD-002`).

**Failure isolation.** A provider that raises is caught by the composer, its section is `degraded`, and **no other provider's work is rolled back and no domain state is mutated** — the composer performs no write, so there is nothing to roll back (`T-P360-11`).

### 5b. Section activation — every section has an owning slice (`N-01`)

The previous revision had no slice that turned a section on. Each slice below now carries an explicit deliverable: **"Register Party360 `<section>` provider"**. Positions are read from `B14_28` §1's applied order, unchanged.

| Section | Provider module | Registered by slice | Position | Before that slice |
|---|---|---|---:|---|
| `lead`, `contacts`, `tasks`, `appointments`, `notes` | `crm` | **I2** | 3 | n/a — the root itself |
| **`activities`** *(first page of the merged timeline)* | **multi-contributor — §5e** | **I2** (`crm`) · **I6** (`messaging`) · **I7** (`pipeline`) | 3 · 8 · 5 | CRM entries only until I6 |
| `business` | `discovery` | **I2** | 3 | `unavailable` |
| `files` | `files` | **I2** | 3 | `unavailable` |
| `profile` (customer root), `custom fields` | `customers`, `customfields` | **I5** | 4 | `unavailable` |
| `deals` | `pipeline` | **I7** | 5 | `unavailable` |
| `intelligence` | `intelligence` | **I4** | 7 | `unavailable` |
| `conversations` | `messaging` | **I6** | 8 | `unavailable` |
| `revenue_refs` | `revenue` | **I10** | 12 | `unavailable` |
| `tickets` | `support` | **I14** | 15 | `unavailable` |
| `quotes` | — | **never** — `GAP-018/019/020` deferred | — | `unavailable`, permanently |

**A section may not appear before its owning domain's slice.** `T-P360-2..6` assert the `unavailable → present` transition happens at exactly the slice above and not one earlier; `T-P360-1` asserts the CRM/Customer root renders correctly while every optional section is still `unavailable`.

**`activities` is the one section that is itself cross-domain**, so it activates **per contributor** rather than once: it is `present` from I2 carrying `crm` entries only, and *gains* authorized `messaging` entries at I6 and authorized `pipeline` entries at I7. It never becomes `unavailable` again and never waits for a contributor. `T-P360-13/14/15` assert exactly these three states (§5e).

### 5c. The complete class `A` edge inventory — **47 edges, enumerated**

> **Enumerated, not summarised.** Both `F-03` and `N-01` were possible because the pack published a *representative* list and a *count*, never the set. The set is below. `T-ARCH-1` still derives its own set by AST walk (`W-4`) and **must reproduce exactly this one**; a mismatch in either direction is a defect.

| From | Layer | To | Layer | Why |
|---|:--:|---|:--:|---|
| `identity_access` | 2 | `accounts` | 1 | a session reads its user |
| `workspaces` | 2 | `accounts` | 1 | a membership reads its user |
| `crm` | 5 | `discovery`, `identity`, `files`, `customfields` | 4,4,3,3 | Business projection · `resolve_party` · attachments · field values |
| `customers` | 6 | `crm`, `discovery`, `identity`, `files`, `customfields` | 5,4,4,3,3 | CUS-3 Contact guard · Business link · `resolve_party` · attachments · field values |
| `intelligence` | 6 | `discovery`, `crm` | 4,5 | subject resolution |
| `messaging` | 6 | `crm`, `identity`, `files`, **`assignment`** | 5,4,3,**4** | Contact phone resolution · `resolve_party` · media · **`AssignConversation` reads the eligible-assignee selector for the `inbox` (`B14_07` §2)** |
| `pipeline` | 7 | `crm`, `customers`, `customfields` | 5,6,3 | `deals.lead_id`/`.customer_id` subject reads · field values |
| `revenue` | 7 | `crm`, `customers` | 5,6 | subject references. **Never `pipeline`** — same layer, the structural firewall |
| `imports` | 8 | `customers`, `crm`, `files`, `customfields` | 6,5,3,3 | invokes owning-domain commands · source file · field values |
| `support` | 8 | `customers`, `messaging`, `assignment`, `files`, `customfields` | 6,6,4,3,3 | ticket subject · linked conversation · routing · attachments · field values |
| `aiagent` | 8 | `messaging`, `knowledge`, `crm`, `customers` | 6,4,5,6 | conversation context · `kb_retrieval` · proposal targets |
| `automation` | 9 | `crm`, `messaging`, `pipeline`, `support` | 5,6,7,8 | the four governed action families |
| `tax` | 5 | `billing` | 4 | invoice source |
| `knowledge` | 4 | `files` | 3 | article sources |
| `billing` | 4 | `entitlements` | 3 | plan catalogue **and `AssignWorkspacePlan`** (§6b) |
| `integrations` | 10 | `platform_async` | 3 | the operator surface's only subject |
| `analytics` | 10 | `crm`, `customers`, `pipeline`, `revenue`, `support` | 5,6,7,7,8 | the dashboard and the 11 report sections. **Not** the Party360 composer, which uses the registry |

**48 edges. Every one satisfies `layer(from) > layer(to)`. `SAME_LAYER_EDGE_COUNT = 0` · `UPWARD_EDGE_COUNT = 0` · `MODULE_DAG_CYCLE_COUNT = 0`.**

> **Why 48 and not 47 (`B14-FIX.4`).** The re-walk required by the timeline repair was a **complete** re-derivation, not a two-row deletion. It removed the two prohibited edges `crm → messaging` and `crm → pipeline` — which were never in this inventory but *were* in the implied set, because `B14_07` §2 assigned the merged `timeline` to `crm` — and it surfaced **one legal downward edge the `FIX.3` inventory had omitted**: `messaging`(L6) → `assignment`(L4), implied by the `inbox` selector that `B14_07` §2 already specified. It is added above rather than left out, because §5c is normative: `T-ARCH-1` derives its own set by AST walk and **must reproduce this one exactly**, so a missing legal edge would fail the build just as a prohibited one would. **The repair itself adds no class `A` edge** — all three timeline contributors reach the composer through the registry (class `E`).

### 5d. What is deliberately **not** an edge — and why the count fell from 82 to 47

The pre-`FIX.3` figure of **82** counted cross-cutting concerns as domain edges. It should not have: `B14_03` §1/§2 already route every one of them through `common/`, which is **L0 and imports nothing from `apps/`** (`T-ARCH-8`). Counting them twice inflated the total and, worse, obscured the nine edges that were genuinely prohibited. The mechanisms below are **class `B`, `C`, `D` or `E`** and contribute **zero** edges — each independently asserted, never assumed:

| Mechanism | Class | Resolved through | Asserted by |
|---|:--:|---|---|
| Workspace / membership resolution, RBAC, entitlement, quota — the 16-step pipeline | `B` | `common/authz.py` and its `EntitlementPort`, bound in `config/` | `T-ARCH-8`, `T-ENT-7` |
| Audit rows | `B` | `common/audit.py` | `T-ARCH-8` |
| Outbox publish | `B` | `common/outbox.py` | `T-ARCH-8`, `T-ASYNC-3` |
| Viewer masking, public IDs, pagination, idempotency, concurrency | `B` | `common/` | `T-ARCH-8` |
| Every consumer relationship in `B14_07` §3 | `C` | transactional outbox + the consumer's own inbox, deduped on `(workspace_id, source_event_id)` | `T-ARCH-5` |
| `ReplayDeadLetter` → the owning domain's command; Celery task routing | `D` | `common/dispatch.py`, registered in `config/` | `T-DISP-1..4` |
| All 11 Party360 sections | `E` | `common/party360/`, registered in `config/` | `T-P360-8/9/12` |
| **The three timeline contributors** (`crm`, `messaging`, `pipeline`) | **`E`** | **`common/party360/` `TimelineContributorRegistry`, registered in `config/`** (§5e) | **`T-P360-13..17`** |
| Every cross-app FK | — | Django **string reference** — no Python import | `T-ARCH-3`, `T-ARCH-4` |

**This is the opposite of a loophole.** Each row names a single concrete file in `common/` and a test that fails if a domain bypasses it. An implementer who satisfies one of these by importing the other app directly creates a class `A` edge, and `T-ARCH-1` fails.

### The revenue firewall, expressed structurally

**`revenue` and `pipeline` are both L7, and same-layer edges are prohibited — so `revenue` structurally *cannot* import `pipeline`.** There is no FK from `revenue_events` or `attribution_touchpoints` to `deals`, and no import edge in either direction. "Won Deal ≠ Recognized Revenue" is therefore not only a rule in a document and a negative-control test (`T-REV-1`, `T-REV-4`) — it is a property the dependency graph enforces, and `T-ARCH-1` fails if anyone adds the edge.

### 5e. Timeline / `activities` — the multi-contributor read composition (`B14-FIX.4`, closes `N-09`)

**The defect.** `B14_07` §2 declared the `timeline` selector a **`crm`** selector composing "`crm_activities` merged at read time with owning-domain projections", and `B14_06` routed `GET /leads/{id}/activities` from `crm`. Frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3 names those owning domains: **Messaging** and **Pipeline**. Under `W-3` that merge is a class `A` import, so the actual implied set still held `crm`(L5) → `messaging`(L6) and `crm`(L5) → `pipeline`(L7) — **2 upward edges**, and **2 cycles**, because `messaging` → `crm` and `pipeline` → `crm` are both legitimate downward edges already in §5c.

**Every other class was already closed to it.** Class `B` — no timeline port existed. Class `C` — frozen B2 forbids it outright (*"never copied into `crm_activities`"*, *"CRM maintains no cross-domain deduplication store"*, *"constructed at read time, never stored"*). Class `D` is write-side dispatch. Class `E` bound one provider per section and served no standalone route. Only class `A` remained, and class `A` is prohibited. **No re-layering fixes that** — it is the `N-01` defect one level deeper.

**The decision. The timeline is not CRM truth, not Messaging truth and not Pipeline truth. It is a read-only multi-contributor composition on the boundary §5a already established.**

```
                config/  (composition root — registers contributors, routes URLs; outside the walk)
                   │
   L10  analytics ─┴─ TimelineComposer          merges; owns no table; writes nothing
                   │
                   ▼  reads through common/party360/registry.py   (class E — no app import)
        ┌──────────┼──────────────────────┐
      crm(L5)   messaging(L6)        pipeline(L7)
        each implements common/party360/contracts.py::TimelineEntryProvider
        in its own party360.py, importing common/ (L0) ONLY —
        never the composer, never another contributor, never the registry's other entries
```

| Property | Statement |
|---|---|
| **Owner** | **`analytics`** (module 25, **L10**) — the same module, the same boundary and the same registry as §5a. **No new module, no 27th app, `MODULE_COUNT` stays 26**, no layer moved |
| **Not a second architecture** | `TimelineEntryProvider` lives beside `SectionProvider` in `common/party360/contracts.py`; `TimelineContributorRegistry` lives beside `SectionRegistry` in `common/party360/registry.py`. Both are populated in `config/` at app-ready time |
| **Source truth** | each contributor keeps its own. `crm_activities` stays `crm`-owned and append-only; `messages` stay `messaging`-owned; `deals` stay `pipeline`-owned. **Nothing is copied anywhere** |
| **No new durable truth** | the composer owns **no table, no migration, no event, no command, no cache and no projection**, and **no cross-domain dedup store exists** — dedup is applied in memory during the merge (`T-P360-17`). `MIGRATION_GROUP_COUNT`, `FORWARD_FK_COUNT` and `MODULE_COUNT` are untouched |
| **Frozen contract** | frozen `B2_NOTE_ACTIVITY_TIMELINE.md`, `B2_TIMELINE_IDENTITY_MODEL.md` and `B2_LEAD360_READ_MODEL.md` are **satisfied, not modified**. What moved is *which module merges*, which frozen B2 does not fix. **Where frozen B2 states a more specific rule, frozen B2 wins** |

**Contributor contract.** One shape for every contributor, so no domain invents its own.

```
TimelineEntryProvider.fetch(
    workspace_ref,          # active-workspace scope, server-derived (never client-supplied)
    subject_ref,            # SubjectRef(kind='lead'|'customer', public_id=...)
    actor_context,          # session, membership, role — the B1 pipeline's own context object
    query_context           # TimelineCursor + page limit, per frozen B2 §3.1
) -> TimelineEntryPage(entries[], has_more, next_cursor)
```

Each `TimelineEntry` carries exactly the frozen fields the deterministic merge needs — `entry_id`, `source_domain` (`crm` | `messaging` | `pipeline`), `source_event_id` (**required** for cross-domain entries, **null** for CRM-owned entries where `entry_id` is already the identity), `occurred_at`, `recorded_at`, `actor`, `summary`, `change`, `target_ref`, `source_resource_ref`, `source_event_type`, `route_hint` — as specified in frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3.1. **No field is invented and no new namespace is minted**: the timeline never mints a `TLE-*` identity.

**Merge semantics — read time, deterministic, nothing persisted.**

| Concern | Rule |
|---|---|
| **Ordering** | `(occurred_at DESC, entry_id DESC)` — a **total order with no ties**, exactly as frozen B2 §3.1 requires |
| **Deduplication** | on `(source_domain, source_event_id)` where the frozen source contract defines one; applied **in memory during the merge**, never by a persisted store, cache or projection (`T-P360-17`) |
| **Cursor** | the opaque `(occurred_at, entry_id)` encoding frozen B2 already mandates. Offset pagination is forbidden. The composer merges each contributor's page and re-issues a single cursor over the merged order |
| **Immutability** | the composer **never mutates a source entry** and never writes. A contributor that raises or times out yields `degraded` for its own entries — `[]`, never a `500` — and the remaining contributors are served (frozen `B2_LEAD360_READ_MODEL.md` §5 rule 5) |
| **Eligibility** | the frozen timestamp-tolerance filter stays a **read-path filter re-evaluated on every request**, applied by the owning contributor, never a persisted quarantine |

**Authorization — the composer invents nothing and widens nothing.** It resolves the **root** permission (`lead.view` / `customer.view`) and calls each contributor **inside the same request transaction**; each enforces its own domain's permission and masking before returning: `crm` its existing activity visibility, `messaging` `conversation.view`, `pipeline` `deal.view`, both with existing masking (`PD-002`). Unauthorized entries are **simply absent** — no placeholder, no count, no shape difference, because a placeholder would itself disclose that a conversation or a deal exists (frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3.2). The composer holds **no permission code of its own**; `PERMISSION_ROW_COUNT` is unchanged at 26.

**Endpoints.** `GET /api/v1/leads/{id}/timeline` — the frozen `B2-D-B009` operation — is **served by the composer** and routed from `config/urls.py`. `Lead360.activities[]` is the **first page** of the same merge, served by the same composer as part of the §5a response. Path, DTO, permission and status codes are unchanged, and **frozen B2 is not modified**.

**This adds no class `A` edge.** Every contributor imports `common/party360/` (L0) only; the composer reaches every contributor through the registry. `T-P360-16` injects a direct `crm → messaging` or `crm → pipeline` import in place of the registry call and requires the walker to **fail non-zero and name the edge**, so this defect cannot recur.

## 6. Dependency rules

1. **No circular imports between apps.** `T-ARCH-1` asserts the **class `A`** graph, built under the §4a walker rules, is **acyclic and layer-respecting**.
2. **No cross-app model class import.** A module reads another domain through its published selector and writes through its command. FKs use **string references only** (`T-ARCH-3`, `T-ARCH-4`).
3. **`common/` imports nothing from `apps/`.**
4. **`adapters/` imports nothing from `apps/`** except the port interface it implements.
5. **No app imports `analytics` or `integrations`.** Now load-bearing: `analytics` hosts the `Party360Composer` at L10, so an app importing it would invert the composition boundary (`T-ARCH-1`, `T-P360-8/9`).
6. **`revenue` is imported by no one for writes.** `RecordRevenueEvent` is invoked only by an authorized human request path. `revenue` **reads** subject references; nothing calls it to write.
7. **`imports` invokes owning-domain commands**, never target tables.
8. **`aiagent` writes only its own two tables.** Accepting a proposal calls the owning domain's command **as the human**.
9. **`customfields` calls no subject owner.** It owns definitions and values keyed by `(subject_type, subject_id)` with **no FK to any subject table**, and never resolves a subject's permission itself. The **subject owner** checks its own update permission and delegates downward into `SetCustomFieldValues` — the same direction `AttachFile` already uses. `support` does **not** import `customfields` in order to exist.
10. **No CRM module writes a Discovery-owned table** — `businesses`, `business_identities` and `discovery_jobs` are written only by `discovery` (`T-ARCH-2`).
11. **Exactly one forwarded-header parser** exists, in `common/net.py` (`B14_31` §5, `T-PROXY-8`).
12. **A contributing domain never composes.** It implements `common/party360/contracts.py::SectionProvider` **and/or `TimelineEntryProvider`** in its own `party360.py`, importing `common/` only. It **never** imports the composer, **never** imports another contributor to build a section **or a timeline entry**, and **never** enumerates the registry. The composer **never** imports a contributor. Registration happens **only** in `config/` (§5a, §5e, `T-P360-8/9/12`, `T-P360-16`).
    **This binds the timeline explicitly:** `crm` supplies its own `crm_activities` entries and nothing else; `messaging` and `pipeline` supply theirs; **`analytics` merges**. `crm` importing `messaging` or `pipeline` to build a timeline is the prohibited edge `T-P360-16` injects, and frozen B2 independently forbids the alternative of copying either into `crm_activities`.
13. **Cross-layer invocation of a command or task is by registered name, never by import.** `platform_async` resolves `common/dispatch.py::CommandRegistry` and dispatches `("CreateTicket", reference_payload)`; it does **not** import `apps.support.services`. Registration happens in `config/`. This is class `D` and adds no edge (§6a, `T-DISP-1..4`).
14. **`entitlements` never reads `billing`.** The direction is **`billing`(L4) → `entitlements`(L3), downward** (§6b, `T-ENT-4..7`).

### 6a. Infrastructure dispatch — `platform_async` → owning domain (`N-04`)

`B14_09` §5 requires `ReplayDeadLetter` to "re-invoke the owning domain's command". Read as a direct call that is `platform_async`(L3) → `billing`(L4) / `messaging`(L6) / `support`(L8) — **upward**. It is not one.

| Concern | Resolution |
|---|---|
| Mechanism | `common/dispatch.py::CommandRegistry` maps a **frozen command name** to a callable. `config/` registers `{"CreateTicket": support.services.create_ticket, …}` at app-ready time |
| What `platform_async` holds | the command **name**, the **reference payload** frozen B12 already mandates (`FI-B12-05` — references, re-read at execution), and the dispatch interface. **Nothing else** |
| What `platform_async` imports | `common/dispatch.py` (L0). **Never** `apps.<domain>.services` (`T-DISP-4`) |
| Unknown name | **refused**, dead letter stays dead-lettered, case opened. There is no "dispatch anything" path (`T-DISP-2`) |
| Guards | replay **re-runs every original guard** in the owning domain — permission, entitlement, quota, idempotency, state — exactly as `B14_09` §5 already requires |
| **`B12-D-A020` preserved** | an operation whose outcome is `unknown` is **never** dispatched by replay. No override flag, permission or configuration exists (`T-DISP-3`) |
| Celery | identical: tasks are routed by registered name, never by importing another app's `tasks.py` |

**Class `D` adds no edge**, and this is asserted rather than asserted-by-assumption: `T-DISP-4` greps `apps/platform_async/` for any `apps.<other>` import and requires **zero matches**.

### 6b. `entitlements` ↔ `billing` — direction fixed downward (`N-04`)

Frozen `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §1 names the entitlement subject "Subscription/Plan", while `subscriptions` is owned by **`billing` (L4)** and `EvaluateEntitlement` is a **`entitlements` (L3)** selector. Reading the subscription from entitlements would be an **upward** edge. It is prohibited.

| Concern | Resolution |
|---|---|
| **Direction** | **`billing`(L4) → `entitlements`(L3)** — downward, class `A`, already present for the plan catalogue |
| **Source of the fact** | `billing` owns the commercial truth (`subscriptions`, `payments`, `invoices`). It **translates** the entitlement-relevant slice of it — `(workspace, plan_version_ref, subscription_status, current_period_end)` — and hands it down |
| **Mechanism** | `AssignWorkspacePlan` — an **`entitlements` command**, invoked by `billing` **inside the same transaction** as the subscription state change (`StartCheckout` completion, `ChangePlan`, `ApplyPaymentWebhook`). One transaction, no dual write, no eventual gap |
| **Storage** | `entitlements.workspace_plan_assignments` — **entitlement truth, not commercial truth.** It carries a plan-version reference and a status. It carries **no amount, no currency, no payment, no invoice, no card fact**, and `T-ENT-6` asserts that (`B9-D-A021` and the revenue firewall are untouched) |
| **Reference, not FK** | `subscription_ref` is stored as an **opaque `SUB-*` public ID string, never an FK** — an FK would point from `M03` (position 2) to `M20` (position 11) and break `FORWARD_FK_COUNT = 0` |
| **Absent assignment** | resolves to the frozen default `PLAN-STARTER` — **fail-closed to the lowest tier**, never to unlimited. This is why no seeding call from `workspaces`(L2) upward is needed (`T-ENT-5`) |
| **Stale / failure** | the assignment cannot go stale relative to the subscription, because it is written in the same transaction. Divergence is nonetheless swept: `platform_async` reconciliation class `P-6` opens a case and **never auto-repairs** it |
| **Frozen B8 preserved** | B8 keeps `subscriptions`, its state machine and its aggregate unchanged. Nothing is duplicated: `plan_version_id` is a reference into `entitlements`-owned `plan_versions`, which `subscriptions.plan_version_id` already points at |
| **Frozen B1 preserved** | the three authorities stay separate and the pipeline order `ENTITLEMENT_LOCKED → quota → permission` is unchanged. `EvaluateEntitlement` now reads only `entitlements`-owned rows |

## 7. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-ARCH-1` **(NC)** | Full app tree, **including every registered section provider and every registered timeline contributor** | Build the **class `A`** graph under the §4a rules — AST import extraction over **every file under `apps/`**, never a representative sample (`W-3`, `W-4`) | **Acyclic**, and every edge points to a **strictly lower** layer. `SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0`, over the **48** enumerated edges of §5c. A same-layer or upward edge **fails**. **The walk covers the timeline composition case** (`T-P360-16`), so `N-09` cannot recur |
| `T-ARCH-1a` **(NC)** | The verified graph | Inject a **same-layer** edge (`revenue → pipeline`) | The walker **fails non-zero** and names the edge. A walker that still passes is itself a defect (`F-03`) |
| `T-ARCH-1b` **(NC)** | The verified graph | Inject an **upward** edge (`files → crm`) | The walker **fails non-zero** and names the edge |
| `T-ARCH-2` **(NC)** | Full app tree | Search for writes to `businesses`, `business_identities`, `discovery_jobs` | **Only `discovery` writes them** |
| `T-ARCH-3` | All models | Inspect every cross-app FK | Declared as a **string reference**; no cross-app model class import |
| `T-ARCH-4` **(NC)** | All modules | Grep for `from apps.<other>.models import` | **Zero matches** |
| `T-ARCH-5` | Event consumers | Inspect | Consumption is via outbox/inbox with `(workspace_id, source_event_id)` dedup — **no import of the producer** |
| `T-ARCH-6` **(NC)** | `crm` module | Grep for any import of `apps.customers` | **Zero matches** — the edge is one-way |
| `T-ARCH-7` | Module inventory | Count | **26 apps** across **L1–L10**, each in exactly one layer; **no app unplaced**; `analytics` **introduced at I2**, not merely extended (`N-03`) |
| `T-ARCH-8` **(NC)** | `common/` and `adapters/` | Inspect imports | `common/` imports nothing from `apps/`; `adapters/` imports only its port interface. **`common/party360/` and `common/dispatch.py` contain interfaces and a registry only — no domain logic** |
| **`T-ARCH-9`** **(NC)** | All modules under `apps/` | Grep for `from config` / `import config` | **Zero matches.** `config/` is the composition root: it imports every app and is imported by none, which is why `W-2` excludes it from the walk |
| **`T-ARCH-10`** **(NC)** | The walker itself | Run it against the real tree, then against a tree with a curated edge list substituted for the AST walk | The AST walk is what runs (`W-4`); a curated-list walker **fails the meta-check**. This is the control that would have caught `F-03` and `N-01` |
