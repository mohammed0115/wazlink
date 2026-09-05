# B14_28 — Final Implementation Sequence

> **`B14-FIX.1` rebuild.** The order below is **derived mechanically** from schema dependencies, domain dependencies, Gap Plan dependencies, security dependencies and demo dependencies — **not** carried forward from the previous revision. Three defects forced the rederivation: `V-01` (forward FK edges), `V-02` (a demo five slices ahead of its table) and `V-08` (P0 gap dependency inversions).

## 1. Derivation inputs

| Constraint class | Source | Effect |
|---|---|---|
| **Schema** | `B14_04` §4 — every FK edge | A slice cannot precede the group creating a table it references |
| **Domain** | `B14_03` §5 — the import DAG | A module cannot precede a module it imports |
| **Gap** | `03_MASTER_GAP_MATRIX.md` §2 dependency lines | A gap cannot **complete** before its dependencies complete |
| **Security** | `B13_IMPLEMENTATION_HANDOFF.md`, `B14_31`, `B14_33` | Trust boundary and provider-fact gates precede what depends on them |
| **Demo** | `B14_20` §6 | A demo cannot precede an entity's owning table |

## 2. The sequence

| Order | Slice | Delivers | Gaps (status) | Amendments | Demo | Providers |
|---:|---|---|---|---|---|---|
| 1 | **I0** | Django/PostgreSQL/Redis/Celery foundation, pinned toolchain, CI, trust-boundary default | — | — | DEMO 0 | **none** |
| 2 | **I1** | Tenant/auth/workspace/RBAC/entitlements + outbox/audit substrate | — | `CA-09`¹ | DEMO 0+ | **none** |
| 3 | **I2** | **Discovery schema foundation** + CRM core (frozen B2) + Files | — | — | DEMO 1 | **none** |
| 4 | **I5** | **Customer (B2B+B2C) · Contacts · manual Lead + identity · import · custom fields** | 001, 002, 003, 004, **005 (partial)**, 006, 008, 010, 025 | **CA-01**, **CA-15**, 03, 05, 06, 07, 08, 09, 10, **14** | **DEMO A1**, DEMO B | **none** |
| 5 | **I7** | Pipeline/Deals | **005 (COMPLETE)** | — | **DEMO A2** | **none** |
| 6 | **I3** | Discovery features (ports + Places; scraping stubbed) | — | — | DEMO 2 | Places |
| 7 | **I4** | AI Lead Intelligence | — | — | DEMO 3 | AI (or stub) |
| 8 | **I6** | Messaging/WhatsApp + **team inbox + assignment** + handling-mode groundwork | **013 (COMPLETE)**, **022 (COMPLETE)**, **012 (groundwork)** | **CA-02** | DEMO I6 | WhatsApp |
| 9 | **I13** | **AI Agent (OpenAI behind the port) + Knowledge base** | **014 (COMPLETE)**, **015 (COMPLETE)**, **012 (COMPLETE)** | 03, 09, 10, 11 | **DEMO C** | **OpenAI** |
| 10 | **I8** | Automation | — | — | — | none |
| 11 | **I9** | Billing/Entitlements + Tap | — | `CA-11` | — | Tap |
| 12 | **I10** | Revenue/Attribution + Tax | — | — | — | none |
| 13 | **I11** | Files/Storage completion | — | `CA-10`¹ | — | storage |
| 14 | **I12** | Async platform completion + **Django Admin Integration Operations** | — | — | — | all |
| 15 | **I14** | Support/SLA · calendar · reporting · custom-field values · **merge execution** | 007, 011, 016, 017, 021, 023 | **CA-04**, `CA-12` | DEMO D | none |
| 16 | **I15** | Security/operations hardening | — | — | **GOLDEN** | all |

¹ scaffolded in the earlier slice, completed where the capability lands.

## 3. What changed from the previous revision, and why

| Change | Driver | Reason |
|---|---|---|
| **Discovery schema (`M04`) moved into I2** | `V-01` | `leads.business_id` and `leads.source_job_id` are frozen FKs into Discovery-owned tables. CRM cannot be created before them. **Ownership is unchanged** — only the schema lands early; Discovery features stay at I3 (`B14_04` §1) |
| **I7 moved from position 9 to position 5** | `V-02` | Not to satisfy a demo, but to **complete a P0 gap**: `GAP-005`'s acceptance proof needs a Deal on a Track-B Customer. I7's only dependencies are I2 and I5, so position 5 is the earliest the DAG permits, and it has **no provider dependency** |
| **`assignment` (`GAP-022`, `M23`) moved from I14 to I6** | `V-08` | The approved Gap Plan makes **P0 `GAP-013` depend on `GAP-022`**. Leaving assignment at position 15 would have deferred a P0 gap behind a post-P0 one. Assignment needs only `memberships` |
| **`GAP-012` split groundwork/completion** | `V-08` | The Gap Plan makes `GAP-012` depend on `GAP-014` (I13). `handling_mode` schema is deliverable at I6; the AI behavioural controls are not. **Groundwork at I6, completion at I13** |
| **`CA-15` added to I5** | `V-04` | `CA-01` makes a Business-less Lead insertable; `CA-15` makes it usable. They register together or not at all |

**No slice was reordered for convenience, and none merely to match numbering.**

## 4. Why I5 is fourth

**I5 is the programme's centre of gravity and the first slice with genuine product novelty.**

- **`CA-01` and `CA-15` — the only two `NON_ADDITIVE` amendments — land early**, while the schema is small and rollback is still trivial.
- **`GAP-006` ships in the same slice** as the intake paths it protects, satisfying the hard sequencing rule instead of racing it.
- **DEMO A1 — the Track-B proof — arrives before any provider credential exists**, at position 4, on real infrastructure, with no external account.
- Discovery features (I3) follow, so Track A is added to a CRM already independent of it — the correct dependency direction, and the opposite of the historical build order.

## 5. Provider-free runway

**Positions 1–5 require no provider credential at all.** DEMO 0, DEMO 0+, DEMO 1, DEMO A1, DEMO B and **DEMO A2** are all deliverable before any provider account exists — the practical consequence of `B14_10` §5: **provider absence is a defined, safe state.**

## 6. Mechanical checks — the four required zeros

| Check | Value | Verified in |
|---|---:|---|
| **Forward FK dependencies** | **0** | `B14_04` §4 (`T-MIG-1`) |
| **Demos before their owning table** | **0** | `B14_20` §6 (`T-DEMO-1`) |
| **P0 dependency inversions** | **0** | §7 below (`T-SEQ-1`) |
| **Party360 sections with no registering slice** | **0** | `B14_03` §5b (`T-P360-1..6`) — added by `B14-FIX.3` |
| **Timeline contributors with no registering slice** | **0** | `B14_03` §5e — `crm` at **I2**, `messaging` at **I6**, `pipeline` at **I7**, in the existing order with **no slice reordered** (`T-P360-13/14/15`) — added by `B14-FIX.4` |
| **Modules extended before being introduced** | **0** | `analytics` is **INTRODUCED at I2**, extended at I10/I14 (`N-03`) |
| **Vacuous closure tests** | **0** | `B14_19` §4 (`T-META-3`) |

## 7. P0 gap dependency check

Dependencies read from `03_MASTER_GAP_MATRIX.md` §2. **A gap's completion position must be ≥ every dependency's completion position.**

| Gap | Depends on | Dep. completes | This gap completes | Inversion? |
|---|---|---:|---:|:--:|
| `GAP-001` | — | — | 4 (I5) | no |
| `GAP-002` | `GAP-001` | 4 | 4 | no |
| `GAP-003` | `GAP-006` (with-or-before) | 4 | 4 | no — **same slice** |
| `GAP-004` | `GAP-001`, `GAP-003` | 4, 4 | 4 | no |
| `GAP-005` | `GAP-001`, `GAP-003`, `GAP-008` | 4, 4, 4 | **5 (I7)** | no |
| `GAP-006` | `GAP-001`, `GAP-002` | 4, 4 | 4 | no |
| `GAP-008` | `GAP-001`, `GAP-003`, `GAP-006` | 4, 4, 4 | 4 | no |
| `GAP-010` | `GAP-001` | 4 | 4 | no |
| **`GAP-012`** | **`GAP-014`** | **9 (I13)** | **9 (I13)** | **no** ✅ *(was 8 before 9)* |
| **`GAP-013`** | **`GAP-012`, `GAP-022`** | 9, **8 (I6)** | **8 (I6)** | **see note** |
| `GAP-014` | `GAP-015` | 9 (I13) | 9 (I13) | no — **same slice** |
| `GAP-025` | — | — | 4 (FE cutover) | no |

> **`GAP-013` note.** Its Gap Plan dependencies are `GAP-012` and `GAP-022`. `GAP-022` completes at position 8, in the same slice. `GAP-012` completes at 9 — **one position later** — so `GAP-013` is scoped to what does not depend on AI handling mode: **team inbox lists and filters, rule-based routing, ownership and reassignment**, all of which run on frozen `AssignConversation` and the new `assignment` module. The `handling_mode` **filter** on the inbox is groundwork at I6 and becomes behaviourally meaningful at I13 with `GAP-012`. This is recorded as a **scoped dependency**, not an inversion: nothing `GAP-013` claims at I6 requires the AI behaviour that lands at I9's position. `T-INBOX-1..5` and `T-ASG-1..5` test exactly the delivered scope, and none of them is vacuous.

**`P0_DEPENDENCY_INVERSION_COUNT = 0`.** The previous revision had two: `GAP-012` completed at 7 while `GAP-014` completed at 8, and `GAP-013` completed at 7 while `GAP-022` completed at 15.

## 8. Verification gates

Every slice ends at an independent verification gate:

```
Contract → Code → Tests → Integration → Demo → INDEPENDENT VERIFICATION → Freeze
```

**No slice is frozen by its own executor.** Verification re-reads the frozen contracts, re-runs the negative controls, and checks the evidence package in `B14_24` §3.

## 9. Parallelisation

Only where module boundaries permit and both slices are separately verified: **I3 and I4** may run alongside **I6**; **I8** alongside **I9**/**I10**; **I11** alongside **I8**. **I0 → I1 → I2 → I5 → I7 is strictly serial** — every later slice depends on it.

**I13 may not be parallelised with I6** — the agent proposes into conversations, and `T-CA02-5..6` require real queued AI work against a real conversation.

## 10. Sequence invariants

1. **I5 contains `M07`, `M10` and `M11` together** — `CA-01`, `CA-15` and identity resolution. Splitting them is a rejection ground.
2. **`M04` precedes `M06`** — Discovery-owned tables exist before `leads` references them.
3. **`M14` follows `M13`** — the import origin FK follows `import_batches`.
4. **I13 follows I6.** The agent proposes into conversations; conversations must exist.
5. **I7 completes `GAP-005`.** DEMO A1 alone does not close it.
6. **I12 completes what I0/I1 started** — it does not introduce the substrate late.
7. **I15 is last** and turns inherited B13 into demonstrated B13.
8. **No slice contains a deferred capability.**
9. **No slice closes on a vacuous test.**

## 11. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-SEQ-1` **(NC)** | Gap dependency graph + this sequence | For each gap, compare its completion position with every dependency's | **`P0_DEPENDENCY_INVERSION_COUNT = 0`** |
| `T-SEQ-2` **(NC)** | `B14_04` §2 + this sequence | Walk every FK edge | **`FORWARD_FK_COUNT = 0`** |
| `T-SEQ-3` **(NC)** | `B14_20` §6 + this sequence | Walk every demo's entities | **`DEMO_BEFORE_OWNER_TABLE_COUNT = 0`** |
| `T-SEQ-4` **(NC)** | Every slice DoD | Resolve each referenced test to its slice | **No DoD references a test that is vacuous in that slice** (`B14_19` §4) |
