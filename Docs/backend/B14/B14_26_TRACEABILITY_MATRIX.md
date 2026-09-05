# B14_26 — Traceability Matrix

> Every implementation item traces: **Frozen contract → Gap/Decision/Amendment → Module → Table → Migration → API → Command/Selector → Event → Permission → Async/Provider → Test → Demo → Slice.** No orphan implementation work.

> **`B14-FIX.1` rebuild — closes `V-09`.** The previous §4 reported *"Commands with no test: 0"* and *"Invariants with no test: 0 (43/43)"* while eight test families were **bare identifiers with no assertion anywhere**, and P0 `GAP-013` was traced to `T-WA-*` — WhatsApp adapter tests that examine signatures and dedup and say nothing about a team inbox. **Every counter in §5 is now computed over DEFINED assertions** (`B14_19` §1), never over identifier strings.

## 1. The counting rule

> **A test reference counts toward coverage only if the referenced ID is DEFINED** — the pack states its precondition, action and expected assertion (`B14_19` §1) — **and the test is not vacuous in the slice that claims it** (`B14_19` §4).
>
> An identifier appearing only in this matrix is an **orphan reference** and is counted as **zero coverage**.

Verified by `T-META-1` and `T-META-4`.

## 2. P0 gap traces (12)

| Gap | Frozen | Decision / Amendment | Module | Table | Migr. | API | Command | Event | Permission | Async/Provider | **Test (defined)** | Demo | **Completes at** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `GAP-001` | B0 data model, B2 | `PD-001`, `CA-03/07/09` | `customers` | `customers` | M08 | `/customers` | `CreateCustomer` | `CustomerCreated` | `customer.create` | — | `T-CUS-1..8` §5.4 | A1 | **I5** |
| `GAP-002` | `B2_CONTACT_MODEL.md` | `PD-002`, `CA-05/06` | `crm` (`contacts`) + `customers` (`customer_contacts`) | `contacts`, `customer_contacts` | M09 | `/contacts` | `AddContact`, `LinkContactToCustomer` | `ContactLinkedToCustomer` | `contact.view/manage` | — | `T-MASK-1..5` §5.4, `T-CUS-4/5` | A1 | **I5** |
| `GAP-003` | `B2_LEAD_AGGREGATE.md` §1 | **`CA-01`**, **`CA-15`**, `CA-14` | `crm` | `leads`, `lead_contacts` | **M07, M10, M14** | `POST /leads` | **`CreateLead`** | `LeadCreated` | `lead.create` | — | **`T-CA01-1..7` §5.2, `T-CA15-1..10` §5.3** | A1 | **I5** |
| `GAP-004` | B2 | `PD-001` | `customers` | `customers` | M08 | `/leads/{id}/convert-customer` | `ConvertLeadToCustomer` | `LeadConvertedToCustomer` | `customer.create` | — | `T-CUS-8` §5.4 | A1 | **I5** |
| `GAP-005` | B2, `B9_DUAL_TRACK_COMPATIBILITY.md` | **`CA-01`**, **`CA-15`** | `crm`, `customers`, **`pipeline`** | — | M07, M10, **M18** | — | — | — | — | — | **`T-TRACKB-1..5` (I5) + `T-TRACKB-6` (I7)** §5.1 | **A1 + A2** | **I7** |
| `GAP-006` | `B3_BUSINESS_IDENTITY_MODEL.md` §4 (precedent), CRM-INV-18 | — | `identity` | `party_identifiers` | M11 | internal | `resolve_party` (query) | — | none new | inline in B5 pipeline | `T-ID-1..3` §5.4 | A1, C | **I5** |
| `GAP-008` | `B2-D-C002`, B11, B12 | `PD-007`, `CA-10` | `imports` | `import_batches`, `import_rows` | M13 | `/imports*` | `CommitImportBatch` | `ImportBatchCompleted` | `import.manage` | `default` queue | `T-IMP-1..6` §5.4 | **B** | **I5** |
| `GAP-010` | `BACKEND_DATA_GOVERNANCE.md` | `PD-005`, `CA-07/09` | `customfields` | `field_definitions` | M12 | `/custom-fields` | `DefineCustomField` | — | `customfield.manage` | — | **`T-CF-1..6` §5.5** | B | **I5** |
| `GAP-012` | `B5_CONVERSATION_MODEL.md` | `PD-011`, **`CA-02`** | `messaging` | `conversations` | **M17** | `/handling-mode`, `/takeover` | `SetConversationHandlingMode` | `ConversationHandlingModeChanged` | `messaging.manage` | — | **`T-CA02-1..4` (I6, groundwork) + `T-CA02-5..6` (I13, completion)** §5.6 | **C** | **I13** |
| `GAP-013` | B5 command catalog | — | `messaging`, `assignment` | `conversations`, `assignment_rules` | M16, **M23** | `/conversations`, `/assignment/rules` | `AssignConversation` (**frozen**), `UpsertAssignmentRule` | `ConversationAssigned` (**frozen**) | `messaging.manage`, **`assignment.manage`** | — | **`T-INBOX-1..5` + `T-ASG-1..5` §5.7 — dedicated behavioural tests, no longer `T-WA-*`** | I6 | **I6** |
| `GAP-014` | `B4-D-C002`, `B5-D-A021` | `PD-003`, `PD-013`, `CA-09/11` | `aiagent` | `agent_sessions`, `agent_proposals` | M24 | `/agent/*` | `AcceptAgentProposal` | `AgentProposalAccepted` | `ai.use`, `agent.manage` | **OpenAI**, `providers.slow` | **`T-AI-1..6` §5.9** | **C** | **I13** |
| `GAP-025` | frozen frontend | `PD-012` | — (FE) | — | — | — | — | — | — | — | `T-DEMO-2` §7 | A1 | FE cutover |

**`GAP-013`'s repair, stated plainly.** It previously mapped to `T-WA-*`. `T-WA-1..8` test signature verification, `hub.challenge`, duplicate callbacks, status monotonicity, consent/window, unknown-send and safe logging — **none tests a team inbox, routing or ownership.** `GAP-013` now has ten dedicated tests covering list/filter, ownership transfer, cross-workspace isolation, permission enforcement, takeover interaction, round-robin fairness, the PostgreSQL-not-Redis counter, ineligible-member exclusion and rule permissions.

## 3. Post-P0 gap traces (7)

| Gap | Module | Migr. | Amendment | **Test (defined)** | Completes at |
|---|---|---|---|---|---|
| `GAP-007` merge | `identity` | M27 | **`CA-04`** | `T-MERGE-1..4` §5.9 | I14 |
| `GAP-011` field values | `customfields` | M12 | — | **`T-CF-7..8` §5.5** — the value **search/filter** tests (plus `T-CF-1`/`T-CF-3` **re-run** against stored values) | **I14** *(all six `GAP-010` tests `T-CF-1..6` ship at I5; value search/filter at I14 — `N-02`)* |
| `GAP-015` knowledge | `knowledge` | M25 | `CA-03/10` | `T-KB-1..3` §5.8 | I13 |
| `GAP-016` tickets | `support` | M26 | `CA-03/10/12` | `T-TKT-1..5` §5.8 | I14 |
| `GAP-017` SLA | `support` | M26 | `CA-12` | `T-SLA-1..4` §5.8 | I14 |
| `GAP-021` calendar | `crm` | — | — | `T-CAL-1..2` §5.8 | I14 |
| **`GAP-022` assignment** | `assignment` | **M23** | `CA-09` | `T-ASG-1..5` §5.7 | **I6** *(pulled forward — P0 `GAP-013` depends on it)* |
| `GAP-023` reporting | `analytics` | — | — | `T-RPT-1..3` §5.8 | I14 |

*(Eight rows: `GAP-022` is listed among the post-P0 set it belongs to, delivered early.)*

**`GAP-011`'s slice is now unambiguous.** The previous revision read *"I5/I14"*, which named no single owner. Definitions land at I5 with `GAP-010`; **`GAP-011` — values, search and filter — completes at I14.**

## 4. Amendment → migration → test

| CA | Class | Migration | **Test (defined)** | Slice |
|---|---|---|---|---|
| **`CA-01`** | **`NON_ADDITIVE`** | **M07 + M14** | `T-CA01-1..7` §5.2 | I5 |
| `CA-02` | `ADDITIVE` | M17 | **`T-CA02-1..6` §5.6** | I6 + **I13** |
| `CA-03` | `ADDITIVE` | registry | `T-PID-1` §5.9 | I5 |
| `CA-04` | `ADDITIVE` | M27 | `T-MERGE-1..4` §5.9 | I14 |
| `CA-05` | `ADDITIVE` | M09 | `T-CUS-4..6` §5.4 | I5 |
| `CA-06` | `ADDITIVE` | perms | `T-RBAC-C1..3` (`B14_08` §9) | I5 |
| `CA-07` | `ADDITIVE` | all new | `T-SCHEMA-1` (`B14_04` §6) | every |
| `CA-08` | `ADDITIVE` | none | `T-CAT-1` §5.9 | every |
| `CA-09` | `ADDITIVE` | perms | `T-RBAC-1..10` (`B14_08` §9) | I1, I5, I13 |
| `CA-10` | `ADDITIVE` | enum, incremental | `T-FILE-1` §5.9 | I5, I13, I14 |
| `CA-11` | `ADDITIVE` | seed | `T-ENT-1..3` §5.9 | I9 |
| `CA-12` | `ADDITIVE` | none | `T-AUTO-1` §5.9, `T-TKT-1` §5.8 | I14 |
| `CA-13` | `ADDITIVE` | **deferred** | — *(deferred with `GAP-024`; no test, and none is claimed)* | — |
| **`CA-14`** | **`COMPATIBLE_CLARIFICATION`** | **none** | `T-CA01-4` §5.2 | I5 |
| **`CA-15`** | **`NON_ADDITIVE`** | **M10** | **`T-CA15-1..10` §5.3** | **I5** |

**15 amendments.** `CA-15` was added by `B14-FIX.1` to close `V-04`.

## 5. Orphan checks — recomputed over definitions

| Check | Method | Result |
|---|---|---|
| Gaps in the approved waves with no slice | enumerate | **0** (20/20 mapped) |
| Amendments with no implementation mapping | enumerate | **0** (15/15) |
| **Amendments with no *defined* test** | resolve each ID against `B14_19` §2 | **0** — `CA-13` is deferred and claims none |
| Modules owning no gap or frozen phase | enumerate | **0** (26/26) |
| Tables with no owning module | `T-SCHEMA-1` | **0** |
| **Tables owned by two modules** | `T-SCHEMA-1` | **0** — `customer_contacts` settled to `customers` (`V-M02`) |
| APIs with no permission | `T-RBAC-10` | **0** — the only `PUBLIC_UNAUTH` surface (`GAP-009`) is **deferred and not built** |
| **Commands with no *defined* test** | resolve each | **0** |
| **Invariants with no *defined* test** | resolve each | **0** (76/76, `B14_19` §8) |
| **Referenced test IDs that are undefined** | `T-META-1` | **`UNDEFINED_TEST_ID_COUNT = 0`** *(was 8 families)*. Index arithmetic corrected: `T-ENV` **5**, `T-SEQ` **4**, `T-DEMO` **4**, `T-META` **4** (`N-07`) |
| **Frozen source contract paths that do not resolve** | `T-HANDOFF-PATH-1` — **filesystem existence**, not grep | **`BROKEN_FROZEN_SOURCE_REFERENCE_COUNT = 0`** over **149** references. *`F-01` was **20 distinct nonexistent filenames** appearing in **21 reference occurrences** across **7 slices** — the two figures count different things and both are correct (`N-06`)* |
| **Same-layer module edges** | `T-ARCH-1` over the **AST-walked** class `A` set (`B14_03` §4a) | **`SAME_LAYER_EDGE_COUNT = 0`** over **48** class `A` edges *(was 4 at `F-03`, then 2 at `N-01`)* |
| **Upward module edges** | `T-ARCH-1` | **`UPWARD_EDGE_COUNT = 0`** *(was 3 at `F-03`, 7 at `N-01`, then 2 at `N-09` — the timeline merge)* |
| **Module DAG cycles** | `T-ARCH-1` `W-8` | **`MODULE_DAG_CYCLE_COUNT = 0`** *(was 5 at `N-01`, then 2 at `N-09`)* |
| **Cross-domain read surfaces composed by a contributor** | `T-P360-13..17`, `T-ARCH-1` | **0** — the `activities`/timeline merge is owned by `analytics` (L10) through `common/party360/` *(was 1 — `N-09`: 2 upward edges, 2 cycles)* |
| **Timeline contributors with no registering slice** | `B14_03` §5b/§5e, `T-P360-13/14/15` | **0** — `crm` at I2, `messaging` at I6, `pipeline` at I7 *(was 3 — `N-09`)* |
| **Edges hidden by walking a curated list instead of the AST** | `T-ARCH-10` | **0** — `W-4` makes the AST walk normative; this is the control that would have caught both `F-03` and `N-01` |
| **Frozen B13 CORS invariants with no implementation test** | resolve `AT-B13CORS-1/2` | **0** — mapped to `T-CORS-2` and `T-CORS-4` *(was 2 unmapped — `F-02`)* |
| **`T-CF` citations contradicting the definitions** | resolve each citation | **`ORPHAN_T_CF_COUNT = 0`**, `CONTRADICTORY_T_CF_SLICE_MAPPING_COUNT = 0`. All six `T-CF-1..6` are `GAP-010` and execute at **I5**; `GAP-011` gains its own tests (`N-02`) |
| **`GAP-011` value search/filter with no test** | resolve `GAP-011`'s behaviour to a definition | **`GAP_011_SEARCH_FILTER_TEST_COUNT = 2`** — `T-CF-7`, `T-CF-8` §5.5 *(was 0 — `N-02`)* |
| **Party360 sections composed by a contributor** | `T-P360-8/9/12`, `T-ARCH-1` over the AST-walked set | **0** — composition is owned by `analytics` (L10) through `common/party360/` *(was 7 upward + 2 same-layer + 5 cycles — `N-01`)* |
| **Party360 sections with no registering slice** | `B14_03` §5b, `T-P360-1..6` | **0** *(was 5 — `N-01`)* |
| **Modules extended but never introduced** | `T-ARCH-7` | **0** — `analytics` **INTRODUCED at I2** *(was 1 — `N-03`)* |
| **Unspecified cross-layer invocation directions** | `T-ENT-7`, `T-DISP-4` | **0** — `billing`→`entitlements` downward; `platform_async` dispatches by registered name *(was 2 — `N-04`)* |
| **Gap Plan demos/trains with no B14 milestone** | `T-DEMO-4` | **`DEMO_VOCABULARY_CONTRADICTION_COUNT = 0`** *(`M-04`)* |
| **Vacuous tests claimed by a slice DoD** | `T-META-3`, `T-SEQ-4` | **0** *(was 4)* |
| **Additive permissions with fewer than six role cells** | `T-RBAC-3` | **0** (156/156 cells) |
| Slices with an incomplete contract | 24-field audit of `B14_18` | **0** (16/16) |
| **Forward FK dependencies** | `T-MIG-1` | **0** |
| **Demos before their owning table** | `T-DEMO-1` | **0** |
| **P0 dependency inversions** | `T-SEQ-1` | **0** |
| **Deferred capabilities appearing in a slice** | enumerate | **0** |
| Frozen commands/events redefined | `T-CAT-1` | **0** |
| **Frozen permission cells changed** | `T-RBAC-2` | **0** |
| **Frozen workspace roles missing** | `T-RBAC-1` | **0** (6/6) |

## 6. Counters, mechanically reproduced

| Counter | Value |
|---|---:|
| B14 documents | **35** |
| GAP IDs | 27 |
| Product Decisions | **16** — 15 + **`PD-016`** (the Owner's explicit `CA-15` ratification, added by `B14-FIX.2` to close `M-01`; an authority record, **not** a new capability) |
| **Controlled Amendments** | **15** (2 `NON_ADDITIVE` · 12 `ADDITIVE` · 1 `COMPATIBLE_CLARIFICATION`) |
| Workspace roles | **6** |
| Platform roles (B13, separate namespace) | 1 |
| Django modules | **26** — unchanged. Re-layered across **L1–L10** at `FIX.2` (`F-03`); at `FIX.3` **no module moved and none was added** — `analytics` (L10) took ownership of the Party360 composition it was already shaped for (`N-01`), and is now **introduced at I2** rather than only extended at I14 (`N-03`); at **`FIX.4`** it additionally took ownership of the **`activities`/timeline** merge on the same boundary (`N-09`) — again **no module added, none moved** |
| Migration groups | **27** — unchanged; `M03` gains `workspace_plan_assignments` **within** the existing group (`N-04`) |
| Implementation slices | 16 |
| Mapped invariants | **76** (77 matrix rows) |
| Negative controls | **64** matrix rows |
| New additive permissions | **26** (19 implemented · 7 deferred) |
| Permission cells defined | **156** |

**None of these is carried forward from the previous revision.** Each is recounted from the repaired documents; four changed legitimately at `FIX.1` (documents 29→35, amendments 14→15, modules 23→26, migration groups 25→27).

**`B14-FIX.4` changed no structural counter either.** No document was added or removed (still **35** B14 + **30** Gap Plan), and **modules stay 26, layers 10, migration groups 27, slices 16, roles 6, permission rows 26, cells 156, amendments 15, Product Decisions 16**. The timeline repair created **no module, no table, no migration, no command, no event and no permission** — only a second provider protocol on the read-composition boundary `FIX.3` already established. `MODULE_EDGE_COUNT` moved 47 → 48 for the reason stated below, and test/invariant arithmetic followed.

**`B14-FIX.3` changed no structural counter.** No document was added or removed (still **35** B14 + **30** Gap Plan), and **modules stay 26, layers 10, migration groups 27, slices 16, roles 6, permission rows 26, cells 156, amendments 15, Product Decisions 16**. What moved is test arithmetic and edge accounting, both of which are consequences of the repair rather than scope:

| Counter | Was | Now | Cause |
|---|---:|---:|---|
| `MODULE_EDGE_COUNT` (class `A`, AST-walked) | 82 *(claimed, over a curated list, never enumerated)*; then **47** at `FIX.3` | **48** | `FIX.3` derived 47 under the published `W-1…W-6` rules from the **enumerated** inventory in `B14_03` §5c — not a loss of edges: the 82 counted cross-cutting concerns (workspace scoping, audit, outbox, entitlement, masking) as domain edges, when `B14_03` §2 already routes every one through `common/` — class `B`, not class `A`. **`FIX.4` re-walked the graph completely rather than deleting two rows**: it removed the implied `crm → messaging` and `crm → pipeline` (never enumerated, but real while `B14_07` §2 assigned the merged `timeline` to `crm`) and **added the legal downward edge `messaging`(L6) → `assignment`(L4)** that the `FIX.3` inventory had omitted while the `inbox` selector already required it. **The timeline repair itself adds no class `A` edge** — all three contributors reach the composer through the registry (class `E`) |
| `SAME_LAYER_EDGE_COUNT` / `UPWARD_EDGE_COUNT` / `MODULE_DAG_CYCLE_COUNT` | 0 / 0 / 0 *(over the curated list)*; **2 / 7 / 5** *(over the actual set at `N-01`)*; **0 / 2 / 2** *(over the actual set at `N-09`)* | **0 / 0 / 0** *(over the AST-walked set)* | `N-01` — Party360 composition moved to `analytics`; **`N-09` — timeline composition moved to `analytics`** |
| `DEFINED_T_CF_COUNT` | 6 | **8** | `N-02` — `T-CF-7`, `T-CF-8` |
| `GAP_011_SEARCH_FILTER_TEST_COUNT` | 0 | **2** | `N-02` |
| Individually-defined test IDs | 243 | **272** | `+17` `T-P360` (`12` at `FIX.3`, **`+5` at `FIX.4`**), `+4` `T-DISP`, `+4` `T-ENT-4..7`, `+2` `T-CF-7/8`, `+2` `T-ARCH-9/10` |
| Invariant matrix rows | 77 | **89** | rows 77–86 (`FIX.3`), **87–88 (`FIX.4`)** |
| Entitlement tables | 7 | **8** | `N-04` — `workspace_plan_assignments`, inside existing `M03` |

**`B14-FIX.2` changed exactly one counter: Product Decisions 15 → 16.** The cause is `PD-016`, the Owner's explicit ratification of `CA-15` required to close `M-01`. **No document was added or removed** (still 35 B14 + 30 Gap Plan), and **no other counter moved** — amendments stay 15, modules 26, migration groups 27, slices 16, roles 6, permission rows 26, cells 156.
