# B14_20 — Demo Programme

> **Rule: after a slice ships, its domain may not be demonstrated from frontend fixtures.** A demo that renders `legacyDataBridge` data for a completed domain is a failed demo, not a passing one.

> **`B14-FIX.1` repair — closes `V-02`.** The previous DEMO A required a **Deal** at the end of I5, but `deals` (`M18`) lands at **I7 — five positions later**. Three documents asserted it independently, and I5's DoD gated on a test that could not pass. **DEMO A is now split into A1 (I5) and A2 (I7)**, each executable in its own slice, with `T-TRACKB` split to match (`B14_19` §5.1).

## 1. Demo ledger

| Demo | After | Position | Proves | Providers needed |
|---|---|---:|---|---|
| **DEMO 0** | I0 | 1 | Django + PostgreSQL + Redis + Celery; five queues consumed; `/health` + `/ready`; **starts with zero provider credentials** | **none** |
| **DEMO 0+** | I1 | 2 | Real session, workspace, membership, invitation, entitlement decision, audit rows | **none** |
| **DEMO 1** | I2 | 3 | Real CRM persistence — Business, Lead, Contact, Task, Appointment, timeline, from PostgreSQL | **none** |
| **DEMO A1** | **I5** | **4** | **CRM with ZERO Discovery dependency** — Customer, Contact, 360, Task | **none** |
| **DEMO B** | I5 | 4 | CSV → mapping → dry run → commit → partial failure → error CSV | **none** |
| **DEMO A2** | **I7** | **5** | **The Track-B proof completed** — a Deal on a Track-B Customer, still zero Discovery | **none** |
| **DEMO 2** | I3 | 6 | Real Discovery producing real Businesses | Places |
| **DEMO 3** | I4 | 7 | Business → AI Intelligence → Lead with provenance | AI (or stub) |
| **DEMO I6** | I6 | 8 | Real inbound + human-sent WhatsApp, delivery status, **rule-routed team inbox** | WhatsApp |
| **DEMO C** | **I13** | **9** | WhatsApp → identity → Customer/Lead → OpenAI assistance → human takeover → **human** Send | OpenAI |
| **DEMO I8/I9/I10** | I8/I9/I10 | 10–12 | Automation approval queue; Tap upgrade; revenue firewall | Tap |
| **DEMO I11/I12** | I11/I12 | 13–14 | File lifecycle; the operator runbook with no secret visible | all |
| **DEMO D** | I14 | 15 | Conversation → Ticket → SLA pause/resume → resolution; governed merge | none |
| **GOLDEN** | I15 | 16 | Discovery → Business → AI Intelligence → Lead → WhatsApp → Deal, end to end | all |

**Demos 1–5 (DEMO 0 through DEMO A2) require no provider credential at all** — the entire Track-B product proof is deliverable before any provider account exists.

## 2. DEMO A1 — the Track-B proof, part 1 *(end of I5)*

**Precondition.** A workspace created with **no Discovery activity** and **no provider credential configured**.

**Script.**
1. Create an **organization** Customer with two Contacts, one marked primary.
2. Create a **person** Customer with its single Contact.
3. Create a **manual Lead** with a primary Contact (`CA-01` + `CA-15`).
4. Open Customer 360 for both Customers, and Lead 360 for the Lead.
5. Add a Task.
6. Show the timeline.

**Five things shown on screen, deliberately:**

1. `discovery_jobs` count for the workspace = **0**
2. `businesses` count for the workspace = **0** — no fake Business exists
3. The manual Lead carries **no `business_id`**
4. **No `lead_provenance` row exists** for the manual Lead — none was fabricated
5. The Lead and both Customers render a **`display_name`** — organization/person Customers from their own `name`, the Lead from its **primary Contact** with `display_source = "contact"` and `display_subtitle = null`

**Fails if:** any screen requires a Business or a Discovery job · a `businesses` or `discovery_jobs` row is created · a provenance row is synthesized · a provider credential is required · **any Lead renders without a display identity** · **any Business attribute or PII appears as a column on `leads`**.

**Covered by** `T-TRACKB-1..5`, `T-CA01-1..7`, `T-CA15-1..10`, `T-CUS-1..8`.

## 3. DEMO A2 — the Track-B proof, part 2 *(end of I7)*

**Precondition.** **The same workspace DEMO A1 left behind** — still **0 `discovery_jobs`**, still **0 `businesses`**, still no provider credential.

**Script.**
1. Open the **existing** Track-B organization Customer from DEMO A1.
2. Create a Deal against it.
3. Move it through pipeline stages.
4. Close it **Won**.
5. Repeat against the **person** Customer.

**Three things shown on screen:**

1. `discovery_jobs` count is **still 0**
2. The Deal was created and won **from a Customer that never touched Discovery**
3. **The revenue figure did not change** — a Won Deal is not recognized revenue

**Fails if:** creating a Deal requires a Business or a Discovery job · closing a Deal writes a `revenue_events` row · the workspace acquires a `businesses` or `discovery_jobs` row.

**Covered by** `T-TRACKB-6`, `T-REV-1`, `T-ARCH-1`.

> **Together, A1 and A2 are `GAP-005`.** `GAP-005` is `PARTIAL` at I5 and **`COMPLETE` at I7** (`B14_18`, `B14_26`, `B14_28`). Neither half is claimed as the whole.

## 4. DEMO C — the governed-AI proof *(end of I13)*

**Part 1 — the helpful half.** Inbound WhatsApp from a phone belonging to an **existing customer's contact** → identity resolves → the inbox shows Customer 360 context → conversation is `ai_assisted` → the AI Agent domain calls **AI Provider Port → OpenAI Adapter → OpenAI** and produces a draft **grounded in a published KB article with the citation visible** → **a human** reviews, edits and sends through the frozen `SendMessage` path → delivery status arrives by webhook.

**Part 2 — the safety half.** A human takes over → **mode flips and AI proposals stop immediately** → then an inbound from an **unknown** number → the conversation opens **unlinked** with `unresolved` → **no Lead and no Customer is created** → only after a human accepts a proposal does a Contact exist.

**Fails if:** any message is sent without a human · any Lead/Customer is auto-created · an answer has no citation · an OpenAI-specific string appears in a business screen · a queued proposal executes after takeover.

**Covered by** `T-AI-1..6`, `T-CA02-5..6`, `T-WA-7`, `T-KB-1..3` — **all of which are exercised here for the first time, because `aiagent` exists only from I13** (`B14_19` §4).

## 5. GOLDEN DEMO *(end of I15)*

Discovery job → Businesses → AI Intelligence → convert to Lead → WhatsApp conversation → Deal — on real infrastructure, with real providers, **no fixtures anywhere**.

Followed by a **security walkthrough**: a Viewer sees masked contact details **including a Contact-derived `display_name`** · a provider error is sanitized · Django Admin shows **no secret, masked or otherwise** · a heartbeat-stale worker execution shows as `unknown` and is **not** re-executed · **a forged `X-Forwarded-For` is proven to influence neither the rate-limit key nor the audit actor IP**.

## 6. Demo dependency check — mechanical

**Required assertion: no demo requires an entity whose owning table lands in a later slice.**

| Demo | Entities used | Owning group | Group's slice | Position | Demo position | OK? |
|---|---|---|---|---:|---:|:--:|
| DEMO 0 | none | — | — | — | 1 | ✅ |
| DEMO 0+ | workspace, membership, session | M01 | I1 | 2 | 2 | ✅ |
| DEMO 1 | business, lead, contact, task, appointment | M04, M06 | I2 | 3 | 3 | ✅ |
| **DEMO A1** | customer, contact, lead, task | M06, M08, M09, M10 | I2, I5 | 3, 4 | **4** | ✅ |
| DEMO B | import_batch, import_row, file_asset | M05, M13 | I2, I5 | 3, 4 | 4 | ✅ |
| **DEMO A2** | **deal** + A1's customer | **M18**, M08 | **I7**, I5 | **5**, 4 | **5** | ✅ |
| DEMO 2 | discovery_job, business | M04 | I2 | 3 | 6 | ✅ |
| DEMO 3 | intelligence_run | M15 | I4 | 7 | 7 | ✅ |
| DEMO I6 | conversation, message, assignment_rule | M16, M17, M23 | I6 | 8 | 8 | ✅ |
| DEMO C | agent_session, agent_proposal, kb_article | M24, M25 | I13 | 9 | 9 | ✅ |
| DEMO D | ticket, sla_clock, merge_record | M26, M27 | I14 | 15 | 15 | ✅ |
| GOLDEN | all | all | — | ≤16 | 16 | ✅ |

**`DEMO_BEFORE_OWNER_TABLE_COUNT = 0`.** The previous DEMO A was the sole violation (demo at position 4, `deals` at position 9). Asserted by `T-DEMO-1`.

## 7. Gap Plan ↔ B14 crosswalk — **`B14-FIX.2`, closing `M-04`**

Two vocabularies were in play and never reconciled: the Gap Plan sequences **release trains `G0`–`G7`** over a product that already has B0–B13 capability; B14 sequences **16 implementation slices** building that capability **from zero**. Neither is wrong; they answer different questions, and the crosswalk is stated here rather than left to the reader.

**No release train is invented, renamed or resequenced.** The trains below are read from `20_RELEASE_PLAN.md`; the demos from `21_DEMO_PLAN.md`.

| Gap Plan train | Outcome | Gaps | B14 slices that deliver it | Completed by position |
|---|---|---|---|---:|
| **G0** Customer Core | Customers and contacts without touching Discovery | `001, 002, 003, 005, 025` | **I2** (CRM core) + **I5** (Customer/Contact/manual Lead) + **I7** (the Deal half of `GAP-005`) | **5** |
| **G1** Existing-Customer CRM | Workable records with the workspace's own fields | `004, 010, 011` | **I5** (`004`, `010`) + **I14** (`011` values/search) | **15** |
| **G2** Identity & Import | Bulk onboarding, duplicates visible | `006, 008` | **I5** — both, in the same slice as `CA-01` (hard sequencing rule) | **4** |
| **G3** WhatsApp AI & Human Ops | Team WhatsApp with governed AI and instant takeover | `012, 013, 014, 015` | **I6** (`013`, `012` groundwork) + **I13** (`014`, `015`, `012` completion) | **9** |
| **G4** Support | Conversations become SLA-governed tickets | `016, 017` | **I14** | **15** |
| G5 Sales Enablement | — | `018–020` | **none — DEFERRED**, in no slice | — |
| G6 Productivity & Channels | — | partly deferred | **I14** for the approved parts; `009`/`026` deferred | 15 |
| G7 Reporting Expansion | — | `023` | **I14** | 15 |

### Demo vocabulary — reconciled

| Gap Plan demo | Gap Plan milestone | B14 equivalent | B14 milestone |
|---|---|---|---|
| **Demo A** — manual customer to first deal | end of **G0** | **DEMO A1 + DEMO A2 together** | end of **I5** + end of **I7** (positions 4 and 5) |
| **Demo B** — CSV to Customer 360 | after **G2** | **DEMO B** | end of **I5** (position 4) |
| **Demo C** — WhatsApp → OpenAI assistance → human takeover | end of **G3** | **DEMO C** | end of **I13** (position 9) |
| **Demo D** — conversation to resolved ticket | after **G4** | **DEMO D** | end of **I14** (position 15) |
| Demo E — customer to accepted quote | **DEFERRED with G5** | **not scheduled** | — |
| Demo F — protected intake to assigned lead | after G6 | **not scheduled** (`GAP-009` deferred, `PD-010`) | — |
| — | — | **GOLDEN DEMO** | end of **I15** (position 16) |

> ### Why Gap Plan Demo A becomes B14 DEMO A1 + DEMO A2
> `21_DEMO_PLAN.md` places Demo A — *"create a customer … add a task … **create a deal**"* — at the **end of G0**, and `20_RELEASE_PLAN.md`'s G0 DoD repeats *"adds a task **and a deal**"*. Yet G0's own **Database** and **Backend** lists create no `deals` table and no pipeline app.
>
> **That is not a Gap Plan error.** The Gap Plan is a *gap* plan: it schedules only the **new** work, and assumes frozen B6 Pipeline is already built, because in the Gap Plan's world the product already exists. **B14 builds from zero**, so `deals` does not exist until `M18` at **I7**.
>
> **The split is the correct reconciliation, not a reduction in scope.** `DEMO A1` (end of I5) proves the part that is genuinely available then — organization **and** person Customer, Contacts, a primary Contact, Customer 360, a manual Lead with a Contact-derived identity, and a Task, with **zero `discovery_jobs` and zero `businesses`**. `DEMO A2` (end of I7) adds the Deal **on the same Track-B Customer, in the same workspace**, still with zero Discovery. Run in sequence they execute the Gap Plan's Demo A script end to end, and `GAP-005` is `PARTIAL` at I5 and **`COMPLETE` at I7** in every document that mentions it.
>
> `DEMO_VOCABULARY_CONTRADICTION_COUNT = 0` · `GAP_PLAN_TO_B14_SLICE_CROSSWALK = PASS`.

**The Golden Demo is not moved earlier.** Discovery → Business → AI Intelligence → Lead → WhatsApp → Deal requires I3 (position 6), I4 (7), I6 (8) and I13 (9); the earliest dependency-valid milestone is **I15**, and it stays there (`I-02`).

## 7. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-DEMO-1` **(NC)** | The demo ledger and `B14_04` §2 | For each demo, resolve every entity to its owning group and slice position | **`DEMO_BEFORE_OWNER_TABLE_COUNT = 0`** — no demo precedes an entity's owning table |
| `T-DEMO-2` **(NC)** | A completed domain | Run its demo with the frontend fixture module made unreachable | **The demo still passes** — no screen silently falls back to fixture data |
| `T-DEMO-3` | DEMO A1 then DEMO A2 | Run A2 against the workspace A1 left behind | A2 succeeds; `discovery_jobs` and `businesses` are **still 0** |
| `T-DEMO-4` **(NC)** | §7's crosswalk, `20_RELEASE_PLAN.md`, `21_DEMO_PLAN.md` | Resolve every Gap Plan demo and train to a B14 slice milestone | Every one resolves; **`DEMO_VOCABULARY_CONTRADICTION_COUNT = 0`**; no deferred train (`G5`) maps to any slice |
