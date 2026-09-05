# B14_00 — Executive Implementation Handoff

> **B14 is an implementation master pack. B14 is not implementation.** No Django code, no migration, no provider integration, no frontend change, no commit. Baseline `FROZEN_B13_SHA = 5c759cea72baaec9ee0096039475162efd4eeec0`, verified unchanged.

> **Revision `B14-FIX.4`.** A fourth independent countersign returned **Critical 0 · Major 1 · Minor 2 · Info 2**, confirmed `N-01`–`N-05` genuinely closed, and accepted every gate except one. The single Major was **the same defect class as `N-01`, one level deeper**: `FIX.3` moved the ten registry-served Party360 sections above their contributors but left **`activities`/`timeline`** — the one section that is *itself* a cross-domain merge — owned by `crm`.
>
> | Finding | Repair | Proof |
> |---|---|---|
> | **`N-09`** *(Major)* Frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3 defines the timeline as a read-time merge of `crm` + **`messaging`** + **`pipeline`**, while `B14_07` §2 assigned it to `crm`: **2 upward edges** (`crm`→`messaging`, `crm`→`pipeline`) and **2 cycles**. Every other edge class was already closed to it — frozen B2 forbids copying cross-domain entries into `crm_activities`, so no event workaround existed either | The timeline becomes a **multi-contributor read composition** on the **same boundary** `FIX.3` established: `TimelineEntryProvider` beside `SectionProvider` in `common/party360/contracts.py`, `TimelineContributorRegistry` beside `SectionRegistry`, merged by **`analytics`'s `TimelineComposer` (L10)**. `crm`, `messaging` and `pipeline` each supply **only their own entries** and register at **their own existing slice** — I2, I6, I7, **no slice reordered**. **No second architecture, no new module, no layer moved, no new table, migration, command, event or permission, and no cross-domain projection.** Frozen B2 is **not modified** | **48 class `A` edges, completely re-walked and enumerated (`B14_03` §5c)**: `SAME_LAYER = 0`, `UPWARD = 0`, `CYCLES = 0`. `T-P360-13..17`; **`T-P360-16` fails on an injected `crm → messaging` *or* `crm → pipeline` import**; `T-P360-17` proves the merge persists nothing |
>
> **No structural counter moved.** 35 B14 documents · 30 Gap Plan · **26 modules** · L1–L10 · 27 migration groups · 16 slices · 6 roles · 26 permission rows · 156 cells · 15 amendments · 16 Product Decisions. `MODULE_EDGE_COUNT` moved **47 → 48**: the complete re-walk removed the two prohibited timeline edges and added `messaging`(L6) → `assignment`(L4), a **legal downward** edge the `FIX.3` inventory had omitted while `B14_07` §2's `inbox` selector already required it. **No frozen B0–B13 document was modified.**
>
> **Revision `B14-FIX.3`.** A third independent countersign returned **Critical 0 · Major 1 · Minor 3 · Info 4** and confirmed `F-01`, `F-02`, `M-01`–`M-04` and `M-06` genuinely closed. The single Major was **the same defect class as `F-03`, applied one level wider**: `FIX.2` walked the actual edge set for `customfields` and stopped there, leaving the other Party360 sections composing **upward** out of `crm`/`customers`.
>
> | Finding | Repair | Proof |
> |---|---|---|
> | **`N-01`** *(Major)* Party360 composition implied `crm`/`customers` → `intelligence`, `messaging`, `pipeline`, `support`, `revenue`: **7 upward edges, 2 same-layer edges, 5 cycles** | Party360 becomes an explicit **read-composition boundary** owned by **`analytics` (L10)**, above every contributor, reached through `common/party360/` and wired in `config/`. **No layer moved, no module was added, no `T-ARCH-1` exception exists.** Every section now has a **registering slice** | **47 class `A` edges, AST-walked and enumerated (`B14_03` §5c)** under published rules `W-1…W-10`: `SAME_LAYER = 0`, `UPWARD = 0`, `CYCLES = 0`. `T-P360-1..12`; `T-P360-12` **fails** on an injected `crm → pipeline` import; `T-ARCH-10` **fails** a curated-list walker |
> | **`N-02`** *(Minor)* `T-CF-5`/`T-CF-6` mapped to two slices at once, and `GAP-011`'s search/filter had no test | The six existing tests keep their **actual** semantics and all execute at **I5** as `GAP-010`; **`T-CF-7`/`T-CF-8` are new** and test value search/filter | `ORPHAN_T_CF_COUNT = 0` · `CONTRADICTORY_T_CF_SLICE_MAPPING_COUNT = 0` · **`GAP_011_SEARCH_FILTER_TEST_COUNT = 2`** |
> | **`N-03`** *(Minor)* `analytics` extended at I14, introduced nowhere | `analytics` is **INTRODUCED at I2**, the slice that first ships a 360 read, and extended at I10/I14 | `T-ARCH-7`; no demo depends on it before I2 |
> | **`N-04`** *(Minor)* `entitlements`↔`billing` and `platform_async`→domain directions unstated | **`billing`(L4) → `entitlements`(L3)** downward, in one transaction, via `AssignWorkspacePlan`; `platform_async` dispatches **by registered name** through `common/dispatch.py` | `T-ENT-4..7`, `T-DISP-1..4`. **`B12-D-A020` untouched**; `FORWARD_FK_COUNT` still `0` |
> | **`N-05`–`N-08`** *(Info)* | Stale `FIX.1` layer labels corrected; the 20-filenames/21-occurrences figures reconciled; `T-ENV`/`T-SEQ`/`T-DEMO`/`T-META` index arithmetic fixed; the claim that frozen B13's §10 pointer is stale is **withdrawn as incorrect** — §7 holds the policy, §10 owns the assertions, and both citations are right | `B14_03` §5, `B14_26`, `B14_19` §2, `B14_11` §5 |
>
> **No structural counter moved.** 35 B14 documents · 30 Gap Plan · 26 modules · L1–L10 · 27 migration groups · 16 slices · 6 roles · 26 permission rows · 156 cells · 15 amendments · 16 Product Decisions. **No frozen B0–B13 document was modified.**
>
> **Revision `B14-FIX.2`.** A second independent countersign returned **Critical 0 · Major 3 · Minor 6 · Info 2** and confirmed **7 of 10** `V-` findings genuinely closed. This revision repairs the three Majors and all six Minors. Each Major was the *same* class of defect: a property **asserted** rather than **resolved**.
>
> | Finding | Repair | Proof |
> |---|---|---|
> | **`F-01`** **20 distinct** nonexistent frozen contract filenames, in **21** reference occurrences across 7 slices (`N-06`) | Every path re-derived from the **actual frozen directories** and content-verified — not guessed by name similarity | A resolver tests **filesystem existence** of all **149** references: `BROKEN_FROZEN_SOURCE_REFERENCE_COUNT = 0`, and it **fails non-zero on a mutated copy** (`T-HANDOFF-PATH-1`) |
> | **`F-02`** frozen B13 CORS invariant absent from B14 | The browser-origin contract is now stated: **production is `same_origin`**, GitHub Pages is recorded as a **prototype** topology that governs nothing, and 8 fail-closed startup rules make every unsafe combination unreachable | `AT-B13CORS-1/2` map to `T-CORS-2`/`T-CORS-4`; `T-CORS-1..8`. **Frozen `SameSite=Lax` is not changed** — the topology that would require changing it is refused at startup |
> | **`F-03`** `customfields → support` same-layer edge | Walking the **actual** edge set found **seven** violations, not one. `customfields` moves **down** to the facility tier beside `files`; the B1 tier splits L1/L2 | **82 edges walked**: `SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0`; `T-ARCH-1` still fails on an injected same-layer *or* upward edge |
>
> **`M-01` closed by Owner ratification**: `CA-15` is now approved as `PD-016`, independently of the pass that proposed it — its engineering semantics are unchanged. `M-02`–`M-06` closed. **One counter moved: Product Decisions 15 → 16.** No document was added or removed.
>
> **Revision `B14-FIX.1`.** Independent CTO verification returned **Critical 0 · Major 10 · Minor 9 · Info 1** and a **FAIL**. This revision repairs all ten Major and all nine Minor findings. Every change is recorded in the document it touches, and every counter below is **recounted, not carried forward**.

## 1. What this pack answers

**What gets built** — **26** Django modules across **L1–L10**, joined by **47** class `A` edges that are **all strictly downward**, over **27** migration groups, delivering 20 approved gaps (12 P0 + 8 post-P0) and consuming **15** controlled amendments. Party360 is composed **above** every contributing domain (`B14_03` §5a); nothing imports upward.
**Where it lives** — `backend/apps/<module>` with a fixed internal shape; providers isolated in `backend/adapters/`.
**In what order** — 16 slices, sequenced **by dependency, not by numbering** (`B14_28`).
**On what** — a **pinned** toolchain: Python 3.13 · Django 5.2 LTS · DRF 3.18 · Celery 5.6.3 · PostgreSQL 17 · Redis 8 · psycopg 3 (`B14_29`).
**What must never happen** — **86** mapped invariants, **73 of them negative-control rows**, each with a stated precondition, action and assertion.

## 2. Verified inputs

27 GAP IDs · **16 Product Decisions** (`PD-016` ratifies `CA-15`) · **15 amendments (2 `NON_ADDITIVE`, 12 `ADDITIVE`, 1 `COMPATIBLE_CLARIFICATION`)** · `APPROVE_NOW` 12 · `APPROVE_AFTER_P0` 8 · `DEFER` 6 · `CONFLICT_BLOCKED` 1. **All parsed from the documents, not taken from the brief.**

**`CA-15` is new in this revision** and raises the amendment count from 14 to 15. It was classified `NON_ADDITIVE` because that is what the contract change is — not to preserve a count.

## 3. The ten repairs

| Finding | Repair |
|---|---|
| **`V-01`** forward FK edges | Migration DAG rebuilt from actual FK dependencies. **Discovery-owned tables (`M04`) land at I2 as a schema prerequisite while Discovery *features* stay at I3** — ownership never moves. **`FORWARD_FK_COUNT = 0`**, verified edge by edge (`B14_04` §4) |
| **`V-02`** DEMO A needed a Deal five slices early | Split into **DEMO A1 (I5)** — Customer, Contact, 360, Task — and **DEMO A2 (I7)** — a Deal on that same Track-B Customer. `T-TRACKB` split to match. `GAP-005` is `PARTIAL` at I5, **`COMPLETE` at I7** |
| **`V-03`** frozen `member` role dropped | **Six workspace roles restored.** All **26** additive permissions carry a cell for all six — **156 cells**. Platform Operator documented separately as a B13 platform role (`B14_08`) |
| **`V-04`** Business-less Lead had no identity | **`CA-15`**: identity comes from the **primary Contact**, by reference. **No PII or Business attribute is copied onto `leads`.** `business` becomes optional in Lead 360; `display_name`/`display_subtitle`/`display_source` derived at read time |
| **`V-05`** 10 of 16 slice contracts incomplete | **All 16 slices carry all 24 fields.** Empty fields read `N/A — <reason>`. **I13 now names its frozen contracts and dependencies** |
| **`V-06`** B13→B14 obligations undischarged | Four new documents: **`B14_30`** CI/CD + deployment · **`B14_31`** trust boundary · **`B14_32`** Class B values · **`B14_33`** `FI-B12-12` gate · **`B14_34`** supply chain |
| **`V-07`** I0 had no toolchain | **`B14_29`** pins every version against primary sources fetched 2026-09-05. **`I0_UNDETERMINED_CHOICE_COUNT = 0`** |
| **`V-08`** P0 gap dependency inversions | `GAP-022` pulled to I6 to unblock P0 `GAP-013`. **`GAP-012` split: groundwork I6, completion I13.** **`P0_DEPENDENCY_INVERSION_COUNT = 0`** |
| **`V-09`** eight test families undefined | **Every `T-*` ID now states precondition, action and assertion.** `GAP-013` has ten dedicated behavioural tests instead of unrelated WhatsApp adapter tests. `B14_26` counters computed over **definitions** |
| **`V-10`** module DAG omitted 3 modules and self-violated | **26 modules, all placed**, across **L1–L10** (11 tiers with `common`/`config` at L0). **Five relationship kinds distinguished** — a string FK is not an import edge, which dissolves the apparent `crm ↔ customers` cycle |

## 4. How the V1 `.env` decision and frozen B13 reconcile

B13 requires every credential to be a **`*_REF`** resolved *at call time*. The V1 decision says credentials come from `.env`. **Both hold, because in V1 the process environment *is* the secret-management layer:** the domain holds a **reference name**, and a resolver reads it from the environment at call time. No credential value ever enters a domain object, a database row, a Celery payload or a long-lived variable — and replacing `.env` with a vault later changes **the resolver alone**.

## 5. Architecture at a glance

Modular Django monolith · PostgreSQL authoritative · Redis never business truth · **five frozen Celery queues, no sixth** · ports and adapters for all five providers · **provider absence is a safe, defined state**.

**Positions 1–5 need no provider credential at all** — DEMO 0, DEMO 0+, DEMO 1, **DEMO A1**, DEMO B and **DEMO A2** are all deliverable before any provider account exists.

## 6. The two decisive slices

**I5 (fourth) — the Track-B heart.** Customer (B2B **and** B2C), Contacts UI, manual Leads, identity resolution, import, custom fields. Consumes **both `NON_ADDITIVE` amendments together** — `CA-01` (five blocking constraints migrated as one) and **`CA-15`** (a Business-less Lead's identity). `GAP-006` ships **in this same slice** — the hard sequencing rule, not a hope. Ends at **DEMO A1**: CRM working with **zero Discovery**, no fake Business, no fake provenance, and every Lead carrying a real display identity.

**I13 — the governed agent.** Closes the `inbox.copilot` ownership orphan. OpenAI is the initial provider **behind the AI Provider Port**. Ends at **DEMO C**: WhatsApp → identity → customer context → grounded, cited AI draft → **human** takeover → **human** Send. It is also where **`GAP-012` completes**, because its AI controls are the first tests that are not vacuous.

## 7. Safety posture — unchanged, and re-verified

**AI cannot send.** One send path exists — frozen `SendMessage`, human actor. No AI-owned send command exists anywhere in the pack (`PD-013`, `B5-D-A021`). The proof now runs at **I13**, where `aiagent` exists and the test can actually fail.
**Revenue firewall.** `RecordRevenueEvent` is the sole writer of `revenue_events`, human-membership only. **And `revenue` and `pipeline` share a layer (L7), so the import edge itself fails `T-ARCH-1`** — the firewall is now a graph property, not only a rule.
**Secrets.** Never in a response, log, audit row, task payload, trace, fixture — **or Django Admin, masked or otherwise. A masked secret is still a secret.**
**Isolation.** Every tenant query is workspace-keyed; cross-workspace resolves to `404`, never `400`.
**Trust boundary.** Forwarded headers are **ignored by default**; the classic misconfiguration is a **startup failure**, not a silent downgrade.
**Browser origin.** Production is **same-origin**, so no credentialed cross-site request exists. A wildcard origin, a credentialed wildcard, or a cross-site topology in staging/production is a **startup failure** — frozen `SameSite=Lax` is never quietly relaxed.

## 8. Document inventory (35)

`B14_00` executive · `01` baseline · `02` dependency graph · `03` project structure · `04` migration order · `05` amendment map · `06` API map · `07` command/query/event registry · `08` RBAC · `09` async · `10` integration · `11` environment · `12` Django Admin ops · `13` secret security · `14` OpenAI · `15` WhatsApp · `16` discovery providers · `17` Tap · `18` slices I0–I15 · `19` test strategy · `20` demos · `21` frontend cutover · `22` observability · `23` environments · `24` agent handoff · `25` DoD · `26` traceability · `27` risks/open decisions · `28` final sequence · **`29` toolchain baseline** · **`30` CI/CD + deployment** · **`31` trust boundary** · **`32` Class B values** · **`33` `FI-B12-12` gate** · **`34` supply chain**.

## 9. Readiness

**Implementation may begin at I0 without reopening product architecture.** Every version, tool, pipeline stage and settings decision I0 needs is pinned. Two decisions remain open — hosting vendor (`ID-12`) and reverse-proxy product (`ID-13`) — and **neither blocks I0**: both are pre-staging gates, and `ID-13`'s behaviour is fully specified in both its open and closed state, with the dangerous misconfiguration made unreachable.

**Zero deferred or conflict-blocked capabilities appear in any slice**, and no deferred permission code is minted.

**The four sequence zeros hold:** forward FK dependencies **0** · demos before their owning table **0** · P0 dependency inversions **0** · vacuous closure tests **0**.
