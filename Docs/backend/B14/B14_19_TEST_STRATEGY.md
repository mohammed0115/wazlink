# B14_19 — Test Strategy

> **`B14-FIX.4` — closes `N-09`.** §5.11 gains **`T-P360-13..17`**: the `activities`/timeline surface is a **multi-contributor read composition** owned by `analytics`, with `crm`, `messaging` and `pipeline` each registering a `TimelineEntryProvider` at its own slice (`B14_03` §5e). §8 gains invariant rows **87–88**. No existing test was relabelled, renumbered or weakened.
>
> **`B14-FIX.3` — closes `N-02` and `N-07`.** §5.5's ownership table and its own definition table disagreed on whether `T-CF-5`/`T-CF-6` execute at I5 or I14, and neither test actually exercised `GAP-011`'s value search/filter. **All six `T-CF` tests are `GAP-010` and execute at I5**, where they always belonged by content; **`T-CF-7`/`T-CF-8` are new and are the `GAP-011` search/filter tests** at I14. §2's index arithmetic is corrected (`T-ENV` 3 → 5; `T-SEQ` and `T-DEMO` were defined but unlisted). §5.11 defines `T-P360-1..12` (`N-01`) and §5.12 defines `T-DISP-1..4` (`N-04`).
>
> **`B14-FIX.1` rebuild — closes `V-09`, and carries `V-02` and `V-M09`.** The previous revision referenced **eight test families (`T-CF`, `T-CA02`, `T-KB`, `T-TKT`, `T-SLA`, `T-ASG`, `T-RPT`, `T-CAL`) that were bare identifiers with no stated assertion anywhere in the pack**, mapped P0 `GAP-013` to unrelated WhatsApp adapter tests, and let `B14_26` §4 report *"Invariants with no test: 0"* on the strength of a string appearing in a table cell.

## 1. The definition rule — what makes a test ID count

> **A test ID is DEFINED only if the pack states, for that ID: a precondition, an action, and an expected assertion.**
> An identifier appearing in a traceability cell, a slice contract or a risk mitigation is a **reference**, not a definition.
> **`B14_26` §4's orphan counters are computed over definitions, never over references.**

Every ID in this pack now resolves to a definition. §2 is the index; §5 holds the definitions that live in this document.

**A negative control (`NC`) additionally must be written so that it FAILS if the prohibited capability appears.** A control that would pass on an empty system is vacuous and does not count as covering its invariant (§4).

## 2. Definition index — where every family is defined

> **`B14-FIX.3` (`N-07`): recounted mechanically, per family and per document.** The previous index carried three arithmetic errors (`T-ENV` stated 3 where 5 are defined) and omitted three defined families (`T-SEQ`, `T-DEMO`, `T-META`). Every figure below is the count of **individually-defined rows** in the named location.

| Family | Defined in | Count |
|---|---|---:|
| `T-TRACKB-*` | §5.1 | 6 |
| `T-CA01-*` | §5.2 | 7 |
| `T-CA15-*` | §5.3 | 10 |
| `T-CUS-*` · `T-MASK-*` · `T-ID-*` · `T-IMP-*` | §5.4 | 8 · 1 (+ the grouped `T-MASK-1..4` row) · 3 · 6 |
| **`T-CF-*`** | **§5.5** | **8** — `1..6` `GAP-010` at I5; **`7..8` `GAP-011` at I14** (`N-02`) |
| `T-CA02-*` | §5.6 | 6 |
| `T-ASG-*` · `T-INBOX-*` | §5.7 | 5 · 5 |
| `T-KB-*` · `T-TKT-*` · `T-SLA-*` · `T-CAL-*` · `T-RPT-*` · `T-MERGE-*` | §5.8 | 3 · 5 · 4 · 2 · 3 · 4 |
| `T-AI-*` · `T-B4-*` · `T-REV-*` · `T-ASYNC-*` · `T-CAT-*` · `T-PID-*` · `T-FILE-1` · `T-AUTO-1` | §5.9 | 6 · 1 · 5 · 6 · 1 · 1 · 1 · 1 |
| `T-ISO-1..n` · `T-ENT-1..3` | §5.9, grouped rows | 2 grouped rows |
| **`T-ENT-4..7`** | **§5.9** | **4** — the entitlements direction (`N-04`) |
| `T-AUTH-3` | §5.9 | 1 |
| `T-HANDOFF-PATH-1` · `T-CSP-BUILD-1` | §5.10 | 1 · 1 |
| **`T-P360-*`** | **§5.11** | **17** — Party360 read composition (`N-01`), **including the multi-contributor timeline `13..17`** (`N-09`) |
| **`T-DISP-*`** | **§5.12** | **4** — infrastructure dispatch (`N-04`) |
| `T-META-*` | §6 | **4** *(previously unlisted — `N-07`)* |
| `T-ARCH-*` | `B14_03` §7 | **10** — `1`, `1a`, `1b`, `2`–`8`, **`9`**, **`10`** |
| `T-MIG-*` · `T-SCHEMA-1` | `B14_04` §6 | 6 · 1 |
| `T-RBAC-*` | `B14_08` §9 | **10** individually, plus the grouped `T-RBAC-C1..3` row |
| `T-ENV-*` · **`T-CORS-*`** | `B14_11` §5 | **5** *(the index read 3 — `N-07`)* · **8** |
| `T-ADMIN-*` | `B14_12` §5 | 7 |
| `T-SEC-*` | `B14_13` §8 | 7 |
| `T-WA-*` | `B14_15` §8 | 9 |
| `T-DISC-*` | `B14_16` §6 | 7 |
| `T-TAP-*` | `B14_17` §6 | 8 |
| `T-DEMO-*` | `B14_20` §7 | **4** *(previously unlisted — `N-07`)* |
| `T-SEQ-*` | `B14_28` §7 | **4** *(previously unlisted — `N-07`)* |
| `T-TOOL-*` | `B14_29` §9 | 7 |
| `T-CI-*` | `B14_30` §7 | 8 |
| `T-PROXY-*` | `B14_31` §9 | 9 |
| `T-CB-*` | `B14_32` §8 | 8 |
| `T-FIB12-*` | `B14_33` §7 | 7 |
| `T-SUP-*` | `B14_34` §9 | 7 |

**`267` individually-defined test IDs**, plus four grouped-range rows (`T-ISO-1..n`, `T-ENT-1..3`, `T-MASK-1..4`, `T-RBAC-C1..3`), each of which states one precondition, action and assertion for its whole range.

**`UNDEFINED_TEST_ID_COUNT = 0`** — asserted by `T-META-1` (§6), recomputed by `T-META-4`.

## 3. Layers

| Layer | Scope | Gate |
|---|---|---|
| Unit | pure functions, normalization, masking, redaction | every slice |
| Domain | invariants, state machines, guards | every slice |
| **Model constraint** | DB-level: unique, partial unique, CHECK, FK, NOT NULL | every migration group |
| Service/command | transaction boundary, events, audit | every command |
| API | status, envelope, pagination, DTO shape | every endpoint |
| **Permission** | **every one of six workspace roles × every command** | every permission |
| **Workspace isolation** | cross-workspace ⇒ `404` | every tenant endpoint |
| Idempotency | replay is a no-op | every mutating endpoint |
| Concurrency | `If-Match`, row locks, races | every versioned resource |
| Async | queue routing, retry, dead letter, `unknown` policy | every task |
| Webhook | signature, dedup, ordering, fast-ack | every inbound provider |
| Provider adapter | **against a stub, never a live provider in CI** | every adapter |
| Reconciliation | each class opens a case; report-only classes never auto-repair | I12 |
| **Migration** | forward on a **populated** DB; constraints hold; **no data loss**; **`FORWARD_FK_COUNT = 0`** | every group |
| **Architecture** | import DAG, layer direction, FK-by-string | every slice |
| Integration | cross-module flows | per slice |
| E2E | the demo script, headless | per demo |
| **Security regression** | the negative-control suite | **permanent CI gate** |

## 4. Vacuity rule — a test may not close a slice it cannot exercise

> **A negative control asserting the absence of a capability may only close a slice in which that capability's module EXISTS.** Otherwise it passes trivially and proves nothing.

This closes `V-M09`. Concretely:

| Test | Passes vacuously at | Assigned to | Because |
|---|---|---|---|
| `T-WA-7` — no AI path reaches `SendMessage` | I6 | **I13** | `aiagent` does not exist at I6 |
| `T-CA02-5` — queued AI work re-reads mode at execution | I6 | **I13** | no AI work is queued at I6 |
| `T-CA02-6` — takeover stops proposals immediately | I6 | **I13** | no proposals exist at I6 |
| `T-CUS-7` — no `accounts`-shaped commercial table | I0–I4 | **I5** | `customers` does not exist earlier |

All four **re-run permanently** under the security-regression gate (§7) from their assigned slice onward. **I6's DoD references none of them.**

## 5. Definitions — precondition · action · expected assertion

### 5.1 `T-TRACKB-*` — CRM independence from Discovery *(split by `V-02`)*

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| `T-TRACKB-1` **(NC)** | **I5** | Fresh workspace, **0 rows in `discovery_jobs`**, **0 provider credentials configured** | Create an organization Customer, a Contact, link it primary, open Customer 360, create a Task | All succeed; `SELECT count(*) FROM discovery_jobs` **= 0**; `businesses` count unchanged **= 0** |
| `T-TRACKB-2` **(NC)** | I5 | As above | Create a **person** Customer with one Contact | Succeeds; `party_kind='person'`, `business_id IS NULL`; still 0 `discovery_jobs` |
| `T-TRACKB-3` **(NC)** | I5 | As above | Create a **manual Lead** with a primary Contact | Succeeds; `business_id IS NULL`, `converted_at IS NULL`; **no `businesses` row, no `discovery_jobs` row, no `lead_provenance` row** created |
| `T-TRACKB-4` **(NC)** | I5 | As above | Import a CSV of Leads and Customers | Rows commit; still 0 `discovery_jobs` and 0 `businesses` |
| `T-TRACKB-5` | I5 | As above | Render Lead list, Lead 360, Customer 360 | Every surface renders with a non-empty `display_name`; **no response contains a null-Business rendering error** |
| **`T-TRACKB-6`** | **I7** | The **DEMO A1 workspace**, still 0 `discovery_jobs` | Create a Deal on the Track-B Customer, move stages, close Won | Deal created and closed; still 0 `discovery_jobs`; **`revenue_events` count unchanged** |

**`T-TRACKB-6` is the only member requiring `deals`, and it is assigned to I7 where `deals` exists.** The previous single `T-TRACKB-1` demanded a Deal at I5 and was unattainable.

### 5.2 `T-CA01-*` — Lead origin

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CA01-1` | Workspace with a Discovery Lead | Attempt a second Lead for the same Business | Refused — CRM-INV-10 partial unique still covers rows **with** a `business_id` |
| `T-CA01-2` | Empty workspace | `CreateLead` with `origin_type='manual'`, no `business_ref` | **Succeeds**; `business_id IS NULL`, `converted_at IS NULL` |
| `T-CA01-3` **(NC)** | Empty workspace | Create a manual Lead; snapshot `businesses` and `discovery_jobs` | **Zero rows inserted into either table** |
| `T-CA01-4` **(NC)** | Empty workspace | Create a manual Lead | **No `lead_provenance` row exists for it** (`CA-14`) |
| `T-CA01-5` | — | `CreateLead` with `origin_type='discovery'` but no `business_ref` / no `converted_at` | **Refused** by the conditional CHECK — Discovery Leads still require both |
| `T-CA01-6` | **Populated DB** of existing Discovery Leads | Apply `M07` forward | **No row lost**; every pre-existing Lead satisfies every widened CHECK and the narrowed index |
| `T-CA01-7` **(NC)** | Any Lead | Attempt to change `origin_type` | **Refused** — origin is immutable after creation |

### 5.3 `T-CA15-*` — Business-less Lead identity *(new)*

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CA15-1` | Empty workspace | `CreateLead` origin `manual` **without** a Contact | **Refused** — a Business-less Lead requires a primary Contact; **no partial Lead row is committed** |
| `T-CA15-2` | Empty workspace | `CreateLead` origin `manual` **with** a Contact, in one transaction | Succeeds; exactly one `lead_contacts` row with `is_primary=true, unlinked_at IS NULL` |
| `T-CA15-3` **(NC)** | Schema after `M10` | Inspect `leads` columns | **No `name`, `company_name`, `phone`, `email`, `city`, `category` or `website` column exists** — no PII or Business attribute copied |
| `T-CA15-4` | Business-less Lead | Read Lead 360 and `LeadListItem` | `display_name` = primary Contact's `name`; `display_source` = `"contact"`; **`display_subtitle` IS NULL** |
| `T-CA15-5` | Business-backed Lead | Read Lead 360 and `LeadListItem` | `display_name` = `business.name`; `display_source` = `"business"`; `business` block **present** — **byte-identical to pre-`CA-15` behaviour** |
| `T-CA15-6` **(NC)** | Business-less Lead whose Contact has a phone and email | Search `GET /leads?q=<the phone>` and `?q=<the email>` | **No match** — Contact `phone`/`email` are never searchable (`B2-D-C014` upheld) |
| `T-CA15-7` **(NC)** | Business-less Lead | Filter `GET /leads?city=X` and `?category=Y` | **Never matches** — no Contact field is substituted for a Business attribute |
| `T-CA15-8` **(NC)** | Business-less Lead with exactly one primary Contact | `RemoveContact` on that link | **Refused `409`**; the Lead is never left without an identity. **No auto-promotion occurs** |
| `T-CA15-9` | Discovery Lead with a primary Contact | `RemoveContact` on that link | **Succeeds and leaves no primary** — frozen `B2_CONTACT_MODEL.md` §3 behaviour is unchanged for Business-backed Leads |
| `T-CA15-10` | Viewer session, Business-less Lead | Read Lead list, Lead 360, export, AI egress | Contact-derived `display_name` is **masked** on every surface |

### 5.4 `T-CUS-*` · `T-MASK-*` · `T-ID-*` · `T-IMP-*`

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CUS-1` | Empty workspace | Create an **organization** Customer, link two Contacts (one primary) | Succeeds; appears in list and 360 |
| `T-CUS-2` | Empty workspace | Create a **person** Customer with one Contact | Succeeds; `business_id IS NULL` enforced by CHECK |
| `T-CUS-3` **(NC)** | Existing Customer | Attempt to change `party_kind` | **Refused** — immutable (CUS-1) |
| `T-CUS-4` **(NC)** | `person` Customer with a primary Contact | Link a second Contact as primary | **Refused** — CUS-3 guard |
| `T-CUS-5` **(NC)** | `person` Customer with its sole Contact | Unlink it | **Refused** |
| `T-CUS-6` **(NC)** | Schema | Inspect `customers` columns | **No `phone`, `email`, `revenue`, `lifetime_value`, `plan`, `score`, `stage` or `tax_number` column** |
| `T-CUS-7` **(NC)** | Full schema at I5 | Enumerate tables | **No `accounts`-shaped second commercial party table exists** |
| `T-CUS-8` | Qualified Lead | `ConvertLeadToCustomer` | Customer created with `origin_lead_id`; **the Lead is retained, not deleted**; a second attempt returns `409` |
| `T-MASK-1..4` **(NC)** | Viewer session | Read contacts list, Lead 360, Customer 360, conversation context, export | **No full phone or email in any response body**; last-4 / domain-only forms only |
| `T-MASK-5` **(NC)** | Viewer session, AI proposal requested | Inspect the payload sent to the AI provider | **Masked before egress**, not after |
| `T-ID-1` **(NC)** | Two workspaces, same phone in both | Call `resolve_party` with workspace A | **Only A's party returned**; the resolver **cannot be invoked without a `workspace_id`** |
| `T-ID-2` | Workspace with a Contact | Resolve its normalized phone | Returns that Contact with a `confidence` value |
| `T-ID-3` **(NC)** | Ambiguous identifier | Resolve | Returns `ambiguous`; **creates and merges nothing** |
| `T-IMP-1` **(NC)** | Mapped batch | Run dry run; snapshot **every** table's row count before and after | **All counts identical** — dry run writes nothing |
| `T-IMP-2` | Committed batch | Re-commit | **No-op per succeeded row** — `(batch_id, row_number)` identity holds |
| `T-IMP-3` **(NC)** | Row violating a command guard | Commit | Row fails with a typed error; **no table write bypasses the owning command** |
| `T-IMP-4` **(NC)** | Row whose outcome is `unknown` | Run the sweep | **Never re-executed**; surfaced for a human |
| `T-IMP-5` | Batch with mixed outcomes | Fetch `errors.csv` | Contains exactly the failed rows with error codes |
| `T-IMP-6` **(NC)** | Import targeting Leads without Contacts | Commit | **Refused per `CA-15`** — no partial Business-less Lead is created |

### 5.5 `T-CF-*` — Custom fields

> **`B14-FIX.3` — `N-02` closed.** `B14-FIX.2` left this section contradicting itself: its ownership table put `T-CF-5`/`T-CF-6` at **I14** while its own definition table's Slice column put them at **I5**, and the two tests it labelled `GAP-011` were in fact a **permission** test and an **isolation** test — neither exercised value **search or filter**, so `GAP-011`'s only real behaviour had no test at all. **No test was relabelled to make a range agree.** The six existing tests keep their actual semantics and are assigned to the one slice their content belongs to (**I5**, `GAP-010`), and **two new tests** are written for `GAP-011`.
>
> | Test | What it actually asserts | Owning gap | Executes at | Re-runs at |
> |---|---|---|---|---|
> | `T-CF-1` | definition creation + key uniqueness | `GAP-010` | **I5** | I14 |
> | `T-CF-2` | typed columns, no JSONB | `GAP-010` | **I5** | — |
> | `T-CF-3` | server-side type/required validation | `GAP-010` | **I5** | I14 |
> | `T-CF-4` | key immutability | `GAP-010` | **I5** | — |
> | `T-CF-5` | **permission** — `customfield.manage` is Owner/Admin only | `GAP-010` | **I5** | — |
> | `T-CF-6` | **workspace isolation** on value reads | `GAP-010` | **I5** | — |
> | **`T-CF-7`** | **value search returns matching values** | **`GAP-011`** | **I14** | — |
> | **`T-CF-8`** | **value search leaks nothing** (NC) | **`GAP-011`** | **I14** | — |
>
> `T-CF-1` and `T-CF-3` **re-run** at I14 against stored values, which is why `B14_26` lists them under both gaps — a re-run, not a second definition.
>
> `DEFINED_T_CF_COUNT = 8` · `ORPHAN_T_CF_COUNT = 0` · `CONTRADICTORY_T_CF_SLICE_MAPPING_COUNT = 0` · `GAP_011_SEARCH_FILTER_TEST_COUNT = 2`.

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| `T-CF-1` | I5 | Admin session | `DefineCustomField` for each of the 6 types on each of the 5 subjects | Definitions created; unique `(workspace, subject_type, key)` enforced; a duplicate key returns `409` |
| `T-CF-2` **(NC)** | I5 | Schema after `M12` | Inspect `custom_field_values` | **One typed column per type** (`value_text`, `value_number NUMERIC(19,4)`, `value_date`, `value_boolean`, `value_option_id`); **no JSONB value column** (`PD-005`) |
| `T-CF-3` | I5 | A `required` number field | `SetFieldValues` with a non-numeric value, then omit the required field | Both **rejected `422`** server-side; validation is never client-only |
| `T-CF-4` **(NC)** | I5 | Existing definition | Attempt to change `key` | **Refused** — key is immutable |
| `T-CF-5` | I5 | Non-admin (`manager`, `sales`, `member`, `viewer`) | `DefineCustomField` | **`403` for all four** — `customfield.manage` is Owner/Admin only |
| `T-CF-6` **(NC)** | I5 | Two workspaces with the same field `key` | Read values in workspace A | **Only A's values**; cross-workspace `404` |
| **`T-CF-7`** | **I14** | Workspace with a `text` field `industry` and a `number` field `headcount`, values set on several Customers and Leads | Search/filter the subject list by `industry = "logistics"`, then by `headcount >= 50`, then by both together | **Only subjects whose stored values match are returned**; the filter is applied **server-side in the selector**, results are cursor-paginated, and the typed column is used — **never a JSONB scan and never a client-side filter** |
| **`T-CF-8`** **(NC)** | **I14** | Workspace A and workspace B both holding a `text` field `industry` with value `"logistics"`; workspace A additionally holds a **non-matching** value `"retail"`, and a `viewer` session | Run the same search in workspace A | **Workspace B's matching subject never appears**; the **non-matching** `"retail"` subject never appears; a `viewer` sees the result set with **contact PII masked**; a definition the actor may not read contributes **no** row and **no** existence signal |

### 5.6 `T-CA02-*` — Conversation handling mode *(previously undefined; split by `V-08`)*

**Structural half — I6**

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CA02-1` | `M17` applied to a populated DB | Inspect `conversations` | `handling_mode` NOT NULL DEFAULT `'human'`; **every pre-existing row reads `'human'`**; frozen `status enum(2)` **unchanged** |
| `T-CA02-2` | Open conversation | `SetConversationHandlingMode` through all three values with `If-Match` | Succeeds; a stale `If-Match` returns `409`; an invalid value returns `422` |
| `T-CA02-3` | Open conversation | Two concurrent `StartHumanTakeover` calls | **Exactly one winner**; the loser sees `409` — row-locked CAS on `(id, mode, version)` |
| `T-CA02-4` | `sales` and `viewer` sessions | `SetConversationHandlingMode` | Per `messaging.manage` cells; `viewer` **`403`** |

**AI-behavioural half — I13** *(cannot be exercised before `aiagent` exists — §4)*

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CA02-5` **(NC)** | `ai_assisted` conversation with a **queued** `generate_agent_proposal` task | Flip mode to `human` **before** the task executes; then execute it | The task **re-reads mode at execution** and produces **no proposal** (`FI-B12-05`) |
| `T-CA02-6` **(NC)** | `ai_assisted` conversation with proposals flowing | `StartHumanTakeover` | **Proposals stop immediately**; no proposal is created after the takeover timestamp |

### 5.7 `T-ASG-*` and `T-INBOX-*` — Assignment and team inbox *(`GAP-022`, and `GAP-013`'s own tests — `V-09`)*

> **`GAP-013` no longer maps to `T-WA-*`.** WhatsApp adapter tests cover signatures, dedup and status monotonicity — **none of them tests a team inbox, routing or ownership.** These are `GAP-013`'s dedicated behavioural tests.

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| `T-ASG-1` | I6 | Rule with 3 eligible members, `round_robin` | Route 9 conversations | Distribution is **3/3/3** — the counter advances deterministically |
| `T-ASG-2` **(NC)** | I6 | Schema after `M23` | Inspect `assignment_counters` and its update path | Counter is a **PostgreSQL row updated under `SELECT … FOR UPDATE`**; **no Redis key participates** (CRM-INV-11, `FI-B0-16`) |
| `T-ASG-3` | I6 | Rule with an ineligible/suspended member | Route | Ineligible member **never** receives work; fallback applies |
| `T-ASG-4` | I6 | Two workspaces with rules | Route in workspace A | **Only A's memberships** are candidates; cross-workspace assignment is not expressible |
| `T-ASG-5` | I6 | Each of six roles | `UpsertAssignmentRule` | Matches `assignment.manage` cells — Owner/Admin/Manager allow; **Sales, member, Viewer `403`** |
| `T-INBOX-1` | I6 | Conversations assigned across members | `GET /conversations` as each role | List is workspace-scoped and permission-filtered; `assigned`/`unassigned`/`handling_mode` filters return correct sets |
| `T-INBOX-2` | I6 | Assigned conversation | `AssignConversation` to another member (frozen command) | Ownership transfers; `ConversationAssigned` emitted; **assignee history preserved** |
| `T-INBOX-3` **(NC)** | I6 | Conversation in workspace B | Fetch and reassign it from workspace A | **`404` on both** — never `400`, never `403` leakage |
| `T-INBOX-4` | I6 | `viewer` session | Attempt assign, reassign, send | **`403` on every mutation**; read succeeds masked |
| `T-INBOX-5` | I6 | Conversation owned by member X | `StartHumanTakeover` by member Y | Ownership and takeover interact per `messaging.manage`; exactly one holder results |

### 5.8 `T-TKT-*` · `T-SLA-*` · `T-KB-*` · `T-CAL-*` · `T-RPT-*` *(previously undefined)*

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| `T-TKT-1` | I14 | Customer exists | `CreateTicket` manually, from a Conversation, and via `CA-12`'s `create_ticket` action | All three create a `TKT-*` ticket linked to the right subject |
| `T-TKT-2` | I14 | Open ticket | Drive the lifecycle assign → resolve → reopen | Valid transitions succeed; an invalid one returns `409`; each writes a `ticket_activities` row |
| `T-TKT-3` **(NC)** | I14 | Resolved ticket | Inspect every financial table | **No `revenue_events`, `invoices` or `payments` row was written** — a Ticket is never a financial object |
| `T-TKT-4` | I14 | Six roles | Each ticket command | Matches `ticket.*` cells; `sales`/`member` own-assigned only |
| `T-TKT-5` **(NC)** | I14 | Ticket in workspace B | Access from workspace A | **`404`** |
| `T-SLA-1` | I14 | Policy with a 4h response target | Create a ticket, advance the clock | Clock accrues; breach fires at the threshold |
| `T-SLA-2` | I14 | Ticket with a pausing status | Pause, wait, resume | **Paused interval excluded** from elapsed time |
| `T-SLA-3` **(NC)** | I14 | Breaching ticket | Run `sla_breach_sweep` **three times** | `TicketSlaBreached` emitted **exactly once** — identity `(ticket, policy, clock)` |
| `T-SLA-4` **(NC)** | I14 | Breached SLA | Observe | The sweep **reports only**; it never reassigns, escalates or mutates the ticket |
| `T-KB-1` | I13 | Draft article | Publish, then archive | Versions are **append-only**; no version row is ever updated |
| `T-KB-2` **(NC)** | I13 | One published and one draft article | Request an AI answer | The answer cites **only the published** article, by `KBA-*` + version; **a draft is never retrievable** |
| `T-KB-3` **(NC)** | I13 | Article in workspace B | `kb_retrieval` in workspace A | **Not returned** |
| `T-CAL-1` | I14 | Tasks and appointments across a date range | `GET /activities/calendar` | Returns the **union**, workspace-scoped, permission-filtered, correctly ordered |
| `T-CAL-2` **(NC)** | I14 | Calendar read | Inspect writes | **Read-only** — the calendar is a read model and creates no entity |
| `T-RPT-1` **(NC)** | I14 | Won Deals, accepted Quotes, pipeline value present | Render all 11 report sections | **Every revenue figure comes from `revenue_events`**; none derives from Deals, Quotes, pipeline value or counts |
| `T-RPT-2` | I14 | Track-B Customer with revenue | Render attribution | Reports as **unattributed**, not as an error |
| `T-RPT-3` **(NC)** | I14 | Six roles | Render each section | Permission-filtered; a section the actor cannot read renders **absent**, never a denied page; `viewer` sees no unmasked PII |

### 5.9 Remaining families

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-MERGE-1` **(NC)** | Merged Customers with revenue history | Execute merge | **No immutable B9 row or attribution snapshot rewritten** |
| `T-MERGE-2` | Two duplicates | Merge with a reason | Loser **archived, never deleted**; `merge_records` lineage row written; references resolve through lineage |
| `T-MERGE-3` **(NC)** | Duplicate candidates detected | Wait / run any sweep | **No automatic merge ever occurs** |
| `T-MERGE-4` **(NC)** | Parties in two workspaces | Attempt merge | **Refused**; and merge without a reason returns `422` |
| `T-AI-1` **(NC)** | Full I13 codebase | Trace every call path from `aiagent` | **No path reaches `SendMessage`** |
| `T-AI-2` **(NC)** | Command registry | Enumerate commands | **No AI-owned send command exists** (`AgentSendMessage` absent) |
| `T-AI-3` **(NC)** | Human without the target command's permission | `AcceptAgentProposal` | **`403`** — the proposal runs as the human and is refused |
| `T-AI-4` **(NC)** | Proposal referencing another workspace | Generate | Not expressible — context is workspace-keyed |
| `T-AI-5` **(NC)** | Business-domain packages | Grep for model names, `gpt-*`, `finish_reason`, token counts, provider error codes | **Zero matches** |
| `T-AI-6` | A second stub adapter behind `AIProviderPort` | Run the full `aiagent` suite | **Passes unchanged** — no domain module, migration, API contract or test assertion altered |
| `T-B4-1` **(NC)** | A B4 recommendation | Inspect its schema and every consumer | **No field, flag or side channel admits a send** (`B5-D-A021`) |
| `T-REV-1` **(NC)** | Deal ready to close | `CloseDeal` Won | **No `revenue_events` row written** |
| `T-REV-2` **(NC)** | *(activates with the deferred quotes slice)* Accepted Quote | Accept | **No `revenue_events` row**; `QuoteAccepted` carries no revenue field |
| `T-REV-3` **(NC)** | Tap payment captured | Apply the webhook | **No `RevenueEvent` created** |
| `T-REV-4` **(NC)** | Every module except `revenue` | Attempt a write to `revenue_events` | **Refused / not expressible**; only `RecordRevenueEvent` writes it |
| `T-REV-5` | Track-B Customer, no Discovery | `RecordRevenueEvent` | Recognized; reported **unattributed**, not an error |
| `T-ASYNC-1` **(NC)** | Send, charge and import-row outcomes forced to `unknown` | Run every sweep and retry path | **None is re-executed**; each opens `P-1` or is surfaced to a human |
| `T-ASYNC-2` **(NC)** | Schema | Inspect `worker_executions`; make a `running` row heartbeat-stale | **No lease, lease-owner or fence column**; the row classifies `unknown`, is operator-gated and is **never auto-re-executed** |
| `T-ASYNC-3` | Outbox relay with a stale `lease_token` | Attempt the completion write | **Matches zero rows** — fencing holds; the event and its state change committed atomically |
| `T-ASYNC-4` **(NC)** | Queue configuration | Enumerate declared queues | **Exactly the five frozen queues**; no sixth, no business-named queue |
| `T-ASYNC-5` **(NC)** | Reconciliation classes | Run the sweep against seeded `P-1`, `P-3`, `P-5`, `P-6`, `P-7` cases | Each **opens a case and repairs nothing** |
| `T-ASYNC-6` | Poison task | Exhaust retries | Dead-lettered; replay requires a **reason** and re-runs every original guard |
| `T-ISO-1..n` **(NC)** | Two workspaces, one row per tenant entity | Access every tenant endpoint cross-workspace | **`404 ENTITY_NOT_FOUND` every time** — never `400`, never `403`, never an existence leak |
| `T-AUTH-3` **(NC)** | Authenticated session | Assert `role`/`workspace_id`/`permissions` in body, query and headers | **All ignored**; authority derives from session + membership only |
| `T-CAT-1` **(NC)** | Command and event catalogs | Diff against frozen B0–B13 | **No frozen command or event redefined, renamed or given a new payload field** |
| `T-ENT-1..3` | Plans with per-module capability keys | Evaluate entitlement for each module; check `inbox.copilot` | Independent keys resolve; **`inbox.copilot` is reused, not replaced**; ordering `ENTITLEMENT_LOCKED` → quota → permission holds |
| **`T-ENT-4`** | I9. A workspace on `PLAN-STARTER`; `ChangePlan` to `PLAN-GROWTH` | Commit the change, then evaluate entitlement in the **same** transaction and again after commit | `workspace_plan_assignments` is updated **inside billing's transaction**; evaluation reflects the new plan immediately; **rolling the transaction back leaves the old assignment** — no dual write, no eventual gap (`B14_03` §6b) |
| **`T-ENT-5`** **(NC)** | A workspace with **no** `workspace_plan_assignments` row (every workspace before I9) | Evaluate every capability and quota | Resolves to the frozen default **`PLAN-STARTER`** — **fail-closed to the lowest tier, never to unlimited and never to an error** |
| **`T-ENT-6`** **(NC)** | The `entitlements` schema and the `AssignWorkspacePlan` payload | Inspect every column and every field | **No amount, currency, payment, invoice, refund or card fact anywhere.** `subscription_ref` is an opaque `SUB-*` string and is **not** an FK — an FK would point from `M03` (position 2) to `M20` (position 11) |
| **`T-ENT-7`** **(NC)** | `apps/entitlements/` | Grep for any import of `apps.billing` | **Zero matches.** The direction is `billing`(L4) → `entitlements`(L3) only (`N-04`) |
| `T-PID-1` **(NC)** | Public-ID registry | Enumerate all prefixes | `CUS-`, `TKT-`, `QUO-`, `PRD-`, `KBA-` registered; **`CMP-` formally rejected**; **prefix collisions = 0** |
| `T-FILE-1` **(NC)** | Full schema | Enumerate tables holding file bytes or storage keys | **Only B11's** — no second file table anywhere |
| `T-AUTO-1` **(NC)** | Automation action catalog | Inspect `send_message` and the excluded list | `send_message` is **`approval_required`, non-configurable**; `close_won_deal`, `change_deal_value`, `create_revenue`, `delete_lead` remain **excluded** |

### 5.10 `T-HANDOFF-PATH-1` and `T-CSP-BUILD-1` — **`B14-FIX.2`**

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| **`T-HANDOFF-PATH-1`** **(NC)** | The *Frozen source contracts* line of every slice `I0`–`I15`, plus a throwaway copy in which **one** path is mutated to a filename that does not exist | Run the resolver, which tests **filesystem existence** of each named frozen document — **not** a grep for the string | Against the real pack: **`BROKEN_FROZEN_SOURCE_REFERENCE_COUNT = 0`** and exit `0`. Against the mutated copy: the resolver **exits non-zero and names the exact bad path**. A resolver that passes on the mutated copy is itself the defect (`F-01`) |
| **`T-CSP-BUILD-1`** | A **real production frontend build** (I15) | Inspect the emitted bundle for inline `style` attributes/elements that CSP would block | If inline styles are **not** required, `'unsafe-inline'` is **removed** from `style-src`. If they **are** still required, it is retained **only** under frozen `B13_BROWSER_SECURITY.md` §2's stated allowance, with the fact recorded as build evidence. **`CSP_INLINE_STYLE_BUILD_CHECK` may never be marked verified without that evidence** (`ID-14`, `M-06`) |

### 5.11 `T-P360-*` — Party360 read composition — **`B14-FIX.3`, closing `N-01`; `13..17` added by `B14-FIX.4`, closing `N-09`**

> Composition is owned by **`analytics` (L10)** through `common/party360/` (`B14_03` §5a, §5e). Every test below is written so that it **fails** if an implementer resolves a section — **or a timeline entry** — by importing a contributor directly. `1..12` cover the eleven registry-served sections; **`13..17` cover the `activities`/timeline surface, the one section that is itself a cross-domain merge.**

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| **`T-P360-1`** | I2 | Only `crm`, `discovery`, `files`, `analytics` installed; **no** `intelligence`, `messaging`, `pipeline`, `support`, `revenue` provider registered | `GET /leads/{id}` | **`200`** with `lead`, `contacts`, `tasks`, `appointments`, `notes`, `activities`, `business`, `files` **present**; every unregistered section **key absent**; **no `500`, no null-section rendering error**, and the frozen `Lead360` shape is satisfied |
| **`T-P360-2`** | I4 | The I2 baseline, then the `intelligence` provider registered | `GET /leads/{id}` before and after | Before: `intelligence` **key absent** (`unavailable`). After: **present**. **No other section changes state**, and no migration was required to flip it |
| **`T-P360-3`** | I6 | As above for `conversations` (`messaging`) | Same, before and after I6 | `conversations` flips `unavailable → present` at I6 and **at no earlier slice** |
| **`T-P360-4`** | I7 | As above for `deals` (`pipeline`) | Same, before and after I7 | `deals` flips at I7; the payload is **`EntityRef[]` only** — **no `value`, `stage` or `probability`** (frozen `B2_LEAD360_READ_MODEL.md` §2) |
| **`T-P360-5`** | I14 | As above for `tickets` (`support`) | Same, before and after I14 | `tickets` flips at I14 and **at no earlier slice** |
| **`T-P360-6`** | I10 | As above for `revenue_refs` (`revenue`) | Same, before and after I10 | `revenue_refs` flips at I10 and carries **identities only — never an amount** (CRM-INV-7) |
| **`T-P360-7`** **(NC)** | I2 | A fully populated Party360 response served | Diff every table, cache key and outbox row before and after the request; enumerate `analytics`'s models | **Nothing written anywhere.** `analytics` declares **zero models**, holds **no cache** and emits **no event**. A composer that persists or caches any section is the defect |
| **`T-P360-8`** **(NC)** | I2 | `apps/crm/` | AST-grep for imports of `apps.intelligence`, `apps.messaging`, `apps.pipeline`, `apps.support`, `apps.revenue`, `apps.customers`, `apps.analytics` | **Zero matches.** `crm` reaches nothing above it, and reaches the composition boundary through `common/party360/` only |
| **`T-P360-9`** **(NC)** | I5 | `apps/customers/` | Same grep for `apps.intelligence`, `apps.messaging`, `apps.pipeline`, `apps.support`, `apps.revenue`, `apps.analytics` | **Zero matches** |
| **`T-P360-10`** | I5 | Two sessions on one workspace: one holding `lead.view` **and** `revenue.view`, one holding `lead.view` only | Both `GET /leads/{id}` | The first sees `revenue_refs`; the second's response has the **key absent**, not empty and not a denied page. **The two responses differ in no other way**, so the absence of a section cannot be distinguished from a section that has not shipped. A `viewer` additionally sees masked contact PII in every section (`PD-002`) |
| **`T-P360-11`** **(NC)** | I7 | The `pipeline` provider stubbed to raise, and to exceed its time budget | `GET /leads/{id}` | **`200`.** `deals` is `degraded` — `[]` on the wire, never a `500` (frozen `B2_LEAD360_READ_MODEL.md` §5 rule 5). **Every other section is served normally**, and **no domain row is written, locked or rolled back** — the composer performs no write |
| **`T-P360-12`** **(NC)** | every slice | Run the §4a walker over the full tree **including** every registered section provider, then inject a direct `crm → pipeline` selector import in place of the registry call | Real tree: **`SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0`.** Mutated tree: the walker **fails non-zero and names `crm → pipeline`**. A walker that passes on the mutation is itself the defect (`N-01`) |
| **`T-P360-13`** | **I2** | `crm`, `discovery`, `files`, `analytics` installed and the **`crm` timeline contributor registered**; `messaging` and `pipeline` **not installed and no contributor registered for either** | `GET /leads/{id}/timeline` across several pages, and `GET /leads/{id}` for `activities[]` | **`200`.** The timeline serves **CRM `crm_activities` entries only**, ordered `(occurred_at DESC, entry_id DESC)` with the frozen opaque cursor; `activities[]` is its **first page**. **No `500`, no empty-contributor rendering error, and the response does not disclose that other sources exist.** The build contains **no import of `apps.messaging` or `apps.pipeline` from `apps/crm/`** and the timeline requires neither module to function (`B14_03` §5e) |
| **`T-P360-14`** | **I6** | The I2 baseline, then the **`messaging` timeline contributor registered** at its owning slice. A conversation with messages on the subject Lead; two sessions — one holding `lead.view` **and** `conversation.view`, one holding `lead.view` only | `GET /leads/{id}/timeline` before and after I6, for both sessions | Before: **CRM entries only**. After: the first session sees CRM **+ Messaging** entries **interleaved in the single deterministic order** `(occurred_at DESC, entry_id DESC)` — not appended in blocks, and with a stable cursor across pages. The second session's timeline is **identical minus the message entries**, with **no placeholder, no count and no gap marker**, so the absence cannot be distinguished from a source that has not shipped (frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3.2). **`apps/crm/` imports no `apps.messaging` symbol**, and `crm_activities` gains **no row** from any message |
| **`T-P360-15`** | **I7** | As above, then the **`pipeline` timeline contributor registered** at its owning slice. A Deal on the subject with stage changes; sessions with and without `deal.view` | `GET /leads/{id}/timeline` before and after I7 | Before: **no Pipeline entries**. After: CRM **+ authorized Messaging + authorized Pipeline** entries merge into **one deterministic order** across all three sources. `deal.view` is enforced by the **`pipeline`** contributor, and a session lacking it sees the timeline **without deal entries and without any signal that they exist**. **`apps/crm/` imports no `apps.pipeline` symbol**, and `crm_activities` gains **no row** from any deal |
| **`T-P360-16`** **(NC)** | **every slice** | The verified tree with all three timeline contributors registered | Run the §4a walker; then inject a **direct `crm → messaging`** selector import, and separately a **direct `crm → pipeline`** selector import, in place of the registry call | Real tree: **`SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0`** over the **48** edges of `B14_03` §5c. **Each** mutated tree: the walker **fails non-zero and names the offending edge**. A walker that passes on either mutation is itself the defect — this is the control that would have caught `N-09` |
| **`T-P360-17`** **(NC)** | **I7** | Two contributors returning **the same logical event twice** (a redelivery and a replay at the source), each carrying the **same `(source_domain, source_event_id)`** | Read the merged timeline repeatedly, then diff every table, cache key and outbox row before and after | The entry appears **exactly once** per read, with the **same `entry_id`** every time. **Nothing is written anywhere**: no cross-domain dedup table, no cache, no projection and no copy into `crm_activities` — dedup is applied **in memory during the merge** (frozen CRM-INV-13, `B14_03` §5e). A persisted dedup store is the defect |

### 5.12 `T-DISP-*` — Infrastructure command dispatch — **`B14-FIX.3`, closing `N-04`**

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| **`T-DISP-1`** | I12 | A dead-lettered `CreateTicket` with its frozen reference payload; `config/` has registered the name | `ReplayDeadLetter` with a mandatory reason | The owning domain's command runs and **re-evaluates every original guard** — permission, entitlement, quota, idempotency, state. No row is resurrected |
| **`T-DISP-2`** **(NC)** | I12 | A dead letter carrying a command name that is **not** registered | `ReplayDeadLetter` | **Refused.** The dead letter stays dead-lettered, a reconciliation case is opened, and **no arbitrary callable is reachable** — there is no "dispatch anything" path |
| **`T-DISP-3`** **(NC)** | I12 | A dead-lettered **non-idempotent** operation whose provider outcome is `unknown` | Attempt replay by every route: operator UI, API, CLI, shell | **Refused on every route.** No flag, permission or configuration enables it (**`B12-D-A020`**), and `RetryJob`/`RetryWebhook` remain system-only (`B12-D-A053`) |
| **`T-DISP-4`** **(NC)** | I12 | `apps/platform_async/` | AST-grep for any `apps.<other>` import | **Zero matches.** `platform_async` imports `common/dispatch.py` only; **infrastructure dispatch is class `D` and adds no edge** (`B14_03` §4a `W-6`) |

## 6. Meta-tests — the pack checks its own checks

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-META-1` **(NC)** | The B14 pack | Extract every `T-*` identifier; resolve each against §2 | **`UNDEFINED_TEST_ID_COUNT = 0`** — every ID has a precondition, an action and an assertion |
| `T-META-2` **(NC)** | Test suite | Select `-m nc` | **Non-empty**; an empty negative-control selection **fails the build** (`T-TOOL-3`) |
| `T-META-3` **(NC)** | Each `NC` test | Run it against a system where the prohibited capability is **stubbed present** | **Every one fails** — proving it is not vacuous (§4) |
| `T-META-4` | `B14_26` orphan counters | Recompute from **definitions**, not identifier strings | Counters match the published values |

**`T-META-3` is the control against `IR-04`.** A negative control that cannot be made to fail is not a control.

## 7. Rules

Provider tests run **against stubs**; **no CI job holds a live credential**. Migration tests run **forward on a populated database**, asserting no row loss and that every pre-existing Discovery Lead still satisfies every constraint. The security regression suite is a **permanent gate — it runs on every slice, not only I15**. Coverage is judged by **invariant coverage, not line percentage**: an unmapped invariant blocks the slice.

**A test that cannot fail does not count as coverage** (§4, `T-META-3`).

## 8. Invariant → test matrix

| # | Invariant | Test | Kind | Slice |
|---:|---|---|---|---|
| 1 | **CRM works with zero Discovery** | `T-TRACKB-1..5` | **NC** | I5 |
| 1b | …including a Deal | `T-TRACKB-6` | positive | **I7** |
| 2 | Manual Lead needs no Business | `T-CA01-2` | **NC** | I5 |
| 3 | **No fake Business or DiscoveryJob** | `T-CA01-3` | **NC** | I5 |
| 4 | **No fake provenance** | `T-CA01-4` | **NC** | I5 |
| 5 | Discovery Lead still requires Business + `converted_at` | `T-CA01-5` | positive | I5 |
| 6 | Existing Discovery Leads remain valid | `T-CA01-6` | migration | I5 |
| 7 | Lead origin immutable | `T-CA01-7` | **NC** | I5 |
| 8 | Duplicate protection replaced, not removed | `T-CA01-1` + `T-ID-1` | positive | I5 |
| 9 | **Business-less Lead has a usable identity** | `T-CA15-1,2,4` | positive | I5 |
| 10 | **No PII or Business attribute copied onto Lead** | `T-CA15-3` | **NC** | I5 |
| 11 | Business-backed Lead unchanged | `T-CA15-5`, `T-CA15-9` | positive | I5 |
| 12 | Contact PII never searchable | `T-CA15-6` | **NC** | I5 |
| 13 | Business filters never match a Business-less Lead | `T-CA15-7` | **NC** | I5 |
| 14 | Sole primary Contact cannot be stranded | `T-CA15-8` | **NC** | I5 |
| 15 | **B2B + B2C Customer** | `T-CUS-1/2` | positive | I5 |
| 16 | `party_kind` immutable | `T-CUS-3` | **NC** | I5 |
| 17 | Person ⇒ exactly one primary Contact | `T-CUS-4/5` | **NC** | I5 |
| 18 | Customer holds no PII | `T-CUS-6` | **NC** | I5 |
| 19 | **No Account entity** | `T-CUS-7` | **NC** | I5 |
| 20 | **Viewer masking server-side** | `T-MASK-1..5`, `T-CA15-10` | **NC** | I5 |
| 21 | Client cannot assert role/workspace | `T-AUTH-3`, `T-RBAC-5` | **NC** | I1 |
| 22 | **All six workspace roles preserved** | `T-RBAC-1..3` | **NC** | I1 |
| 23 | Platform Operator is not a workspace role | `T-RBAC-4` | **NC** | I12 |
| 24 | **Cross-workspace isolation** | `T-ISO-1..n` | **NC** | I1 |
| 25 | **AI cannot send autonomously** | `T-AI-1/2`, `T-WA-7` | **NC** | **I13** |
| 26 | AI holds no permissions | `T-AI-3` | **NC** | I13 |
| 27 | Takeover stops queued AI work | `T-CA02-5/6` | **NC** | **I13** |
| 28 | **No provider token in a business contract** | `T-AI-5` | **NC** | I13 |
| 29 | **OpenAI replaceable** | `T-AI-6` | positive | I13 |
| 30 | B4 recommendation cannot send | `T-B4-1` | **NC** | I4 |
| 31 | **Won Deal ≠ Revenue** | `T-REV-1` | **NC** | I7 |
| 32 | **Accepted Quote ≠ Revenue** | `T-REV-2` | **NC** | deferred |
| 33 | **Billing ≠ Customer Revenue** | `T-REV-3` | **NC** | I9 |
| 34 | `RecordRevenueEvent` sole writer | `T-REV-4` | **NC** | I10 |
| 35 | **`revenue` cannot import `pipeline`** | `T-ARCH-1` | **NC** | I10 |
| 36 | Track-B revenue recognizes as unattributed | `T-REV-5` | positive | I10 |
| 37 | **`UNKNOWN` non-idempotent work never retried** | `T-ASYNC-1` | **NC** | I12 |
| 38 | **No lease/fence on `worker_executions`** | `T-ASYNC-2` | **NC** | I12 |
| 39 | Outbox atomicity + fencing | `T-ASYNC-3` | positive | I1 |
| 40 | Five queues, no sixth | `T-ASYNC-4` | **NC** | I0 |
| 41 | Report-only reconciliation never auto-repairs | `T-ASYNC-5` | **NC** | I12 |
| 42 | **Dry run writes nothing** | `T-IMP-1` | **NC** | I5 |
| 43 | Import row idempotency | `T-IMP-2` | positive | I5 |
| 44 | **Import calls commands, not tables** | `T-IMP-3` | **NC** | I5 |
| 45 | **No cross-workspace identity resolution** | `T-ID-1` | **NC** | I5 |
| 46 | Custom-field values are typed, not JSONB | `T-CF-2` | **NC** | I5 |
| 47 | **No automatic merge** | `T-MERGE-3` | **NC** | I14 |
| 48 | Merge never rewrites an immutable B9 row | `T-MERGE-1` | **NC** | I14 |
| 49 | Assignment counter is PostgreSQL, never Redis | `T-ASG-2` | **NC** | I6 |
| 50 | **Team inbox routing and ownership** | `T-INBOX-1..5`, `T-ASG-1..5` | positive+NC | I6 |
| 51 | SLA breach emitted exactly once, reports only | `T-SLA-3/4` | **NC** | I14 |
| 52 | Ticket is never a financial object | `T-TKT-3` | **NC** | I14 |
| 53 | AI answers cite published articles only | `T-KB-2` | **NC** | I13 |
| 54 | Reports derive no revenue from Deals/Quotes | `T-RPT-1` | **NC** | I14 |
| 55 | **Missing credentials expose no secret** | `T-SEC-6`, `T-ENV-2` | **NC** | I0 |
| 56 | **No secret in Django Admin** | `T-SEC-4` | **NC** | I12 |
| 57 | Provider errors sanitized | `T-SEC-6` | **NC** | I12 |
| 58 | Platform starts with zero provider credentials | `T-ENV-3` | positive | I0 |
| 59 | `EnableIntegration` requires `status=connected` | `T-ADMIN-2` | **NC** | I12 |
| 60 | `send_message` automation stays `approval_required` | `T-AUTO-1` | **NC** | I8 |
| 61 | B11 single storage authority | `T-FILE-1` | **NC** | I11 |
| 62 | No frozen command/event redefined | `T-CAT-1` | **NC** | every |
| 63 | **Import DAG acyclic and layer-respecting** | `T-ARCH-1` | **NC** | every |
| 64 | No cross-app model import | `T-ARCH-3/4` | **NC** | every |
| 65 | **No CRM code writes a Discovery table** | `T-ARCH-2`, `T-MIG-5` | **NC** | I2 |
| 66 | **`FORWARD_FK_COUNT = 0`** | `T-MIG-1` | **NC** | every |
| 67 | Migration forward on populated DB, no row loss | `T-MIG-3` | migration | every |
| 68 | **Forwarded headers untrusted by default** | `T-PROXY-1,2,5,6` | **NC** | I0 |
| 69 | One forwarded-header parser | `T-PROXY-8` | **NC** | I0 |
| 70 | Toolchain pinned and reproducible | `T-TOOL-1..6` | positive | I0 |
| 71 | Negative controls cannot be silently deleted | `T-META-2`, `T-CI-5` | **NC** | I0 |
| 72 | **Negative controls are not vacuous** | `T-META-3` | **NC** | every |
| 73 | **Every test ID is defined** | `T-META-1` | **NC** | every |
| 74 | `FI-B12-12` discharged per provider | `T-FIB12-1..7` | **NC** | I6, I9 |
| 75 | Supply-chain gate cannot be bypassed | `T-SUP-1..7` | **NC** | I0 |
| 76 | Class B values in force, never-sampled classes intact | `T-CB-1..28` | **NC** | I15 |
| **77** | **Party360 composition adds no upward or same-layer edge and no cycle** | `T-P360-8`, `T-P360-9`, `T-P360-12`, `T-ARCH-1` | **NC** | **I2** |
| **78** | **Party360 persists no duplicated commercial truth** | `T-P360-7` | **NC** | **I2** |
| **79** | **A Party360 section never precedes its owning slice** | `T-P360-1..6` | positive | I2→I14 |
| **80** | **A Party360 section never widens authorization** | `T-P360-10` | **NC** | **I5** |
| **81** | **A failing section degrades and mutates nothing** | `T-P360-11` | **NC** | **I7** |
| **82** | **`entitlements` never reads `billing`; absent assignment is fail-closed** | `T-ENT-4..7` | **NC** | I1, **I9** |
| **83** | **Cross-layer command invocation is by registered name, never by import** | `T-DISP-1..4` | **NC** | **I12** |
| **84** | **`config/` is imported by no app** | `T-ARCH-9` | **NC** | I0 |
| **85** | **The walker walks the AST, not a curated list** | `T-ARCH-10` | **NC** | every |
| **86** | **`GAP-011` value search is executable and leaks nothing** | `T-CF-7`, `T-CF-8` | **NC** | **I14** |
| **87** | **The timeline is composed above its contributors and adds no upward edge or cycle; each contributor activates at its own slice** | `T-P360-13`, `T-P360-14`, `T-P360-15`, `T-P360-16` | **NC** | **I2 → I7** |
| **88** | **The merged timeline persists nothing — no cross-domain dedup store, cache or projection, and no copy into `crm_activities`** | `T-P360-17` | **NC** | **I7** |

**88 numbered invariants across 89 matrix rows** (invariant 1 is split into `1` and `1b` by the `V-02` demo split); **75 rows are negative controls.** Rows 77–86 were added by `B14-FIX.3` to close `N-01`, `N-02`, `N-03` and `N-04`; **rows 87–88 by `B14-FIX.4` to close `N-09`.**

A negative control that starts passing for the wrong reason is a defect — each asserts the *absence* of a capability, so each must be written to fail if the capability appears, and **`T-META-3` proves it by stubbing the prohibited capability present and requiring the control to fail.**
