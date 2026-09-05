# B14_05 — Controlled Amendment Implementation Map

> All **15** approved amendment items consumed as implementation input. **B14 does not execute them against frozen documents** — it records the implementation mapping. Registration against the frozen corpus is a separate governance act.

**Classes (frozen B13 vocabulary): 2 `NON_ADDITIVE` · 12 `ADDITIVE` · 1 `COMPATIBLE_CLARIFICATION`.** `CA-01` and **`CA-15`** are the `NON_ADDITIVE` items — confirmed against the actual contract change, not assumed.

> **`B14-FIX.1` — `CA-15` added to close `V-04`.** Independent verification found that `CA-01` relaxes the five constraints stopping a Business-less Lead from being **inserted**, but leaves it **unusable**: frozen `B2_LEAD_AGGREGATE.md` §1's normative "Explicitly absent" list forbids `name`/`company_name`/`city`/`category`/`phone`/`email`/`website` on `leads` (CRM-INV-3), while `B2_LEAD360_READ_MODEL.md` §1 declares `required: [lead, business]`. A Business-less Lead therefore had **no identity source at all**, and the two most natural fixes each violate a frozen contract — adding a name column breaks CRM-INV-3, minting a Business is the fabrication `B2-D-C001` forbids. `CA-15` resolves it by reference to the **primary Contact**, copying nothing. **The `NON_ADDITIVE` classification is derived from the contract change, not chosen to preserve the previous count of 14.**

| CA | Class | Phase | Frozen contract | Implementation consequence | Migration | API | Test | Rollback / compatibility |
|---|---|---|---|---|---|---|---|---|
| **`CA-01`** | **`NON_ADDITIVE`** | B2 | `B2_LEAD_AGGREGATE.md` §1,§4; CRM-INV-10 | `CreateLead` accepts non-discovery origins; origin-conditional guards in `crm/services`; `last_activity_at` seeded from `created_at` for non-discovery | **M07** — 5 changes (`origin_type` CHECK, `business_id`, `converted_at`, index scope, seeding rule); **M14** — `origin_import_batch_id` FK, split out so it follows `import_batches` (`V-M03`) | `POST /api/v1/leads` (new) | `T-CA01-1..7` incl. **no fake Business / Job / provenance** | **No backfill.** All existing rows satisfy the widened constraints. Reversible until the first non-discovery Lead |
| **`CA-15`** | **`NON_ADDITIVE`** | B2 | `B2_LEAD360_READ_MODEL.md` §1 (`required: [lead, business]`); `B2_CRM_LIST_QUERY_MODEL.md` §§2,4,5,7; `B2_CONTACT_MODEL.md` §3 | Business-less Lead takes its display/reachability identity from its **primary Contact**; `business` becomes optional in Lead 360; `LeadListItem` Business fields nullable; derived `display_name`/`display_subtitle`/`display_source`; **nothing copied onto `leads`** | **M10** — **no schema change**; reuses frozen `lead_contacts.is_primary` + its partial unique index. Adds the *at-least-one* half as a **command guard + nightly integrity assertion** | `POST /leads` requires a Contact for Business-less origins; `GET /leads`, Lead 360 gain `display_*` | `T-CA15-1..10` incl. **no PII column on `leads`**, **`display_subtitle` null**, **Contact phone/email never searchable**, **sole primary cannot be stranded** | **No backfill.** Business-backed Leads byte-identical. Reversible until the first Business-less Lead — **the same window as `CA-01`, to which it is bound** |
| `CA-02` | `ADDITIVE` | B5 | `B5_CONVERSATION_MODEL.md` §1 | `handling_mode` column + 3 commands; queued AI work re-reads mode at execution (`FI-B12-05`) | **M17** — column, default `'human'` | `POST /conversations/{id}/handling-mode`, `/takeover` | `T-CA02-1..4` (I6, structural) + `T-CA02-5..6` (**I13, AI behaviour — non-vacuous only once `aiagent` exists**) | Default reproduces current behaviour; reversible until first non-`human` value |
| `CA-03` | `ADDITIVE` | B0 | `BACKEND_PUBLIC_ID_REGISTRY.md` §A | Register `CUS-`, `TKT-`, `QUO-`, `PRD-`, `KBA-`; formally reject `CMP-` | none (registry doc) | public IDs validated in `common/public_ids.py` | `T-PID-1` prefix collision = 0 | None |
| `CA-04` | `ADDITIVE` | B2 + cross | `B2_CONTACT_MODEL.md` §4 | `merge_records` lineage; losing party archived, never deleted | **M27** *(post-P0)* | `POST /customers/{id}/merge` | `T-MERGE-1..4` incl. **no B9 row rewritten**, **no cross-workspace merge**, **no automatic merge** | **Irreversible once executed** (`PD-006`) — the reason it is out of the P0 wave |
| `CA-05` | `ADDITIVE` | B2 | `B2_CONTACT_MODEL.md` §2 | `contacts.customer_id`; `source` enum widened; `customer_contacts` | **M09** | `POST /customers/{id}/contacts` | `T-CUS-4..6` incl. CUS-3 person guard | Nullable/additive; CRM-INV-18 untouched |
| `CA-06` | `ADDITIVE` | B1/B2 | `B1_AUTHORIZATION_RBAC.md`; `B2_CONTACT_MODEL.md` §6 | Mint `contact.view`, `contact.manage` — the trigger `B2-D-C007` names | none (permission rows) | `GET /contacts` | `T-RBAC-C1..3` incl. **Viewer masked** | Lead-context contact commands unchanged |
| `CA-07` | `ADDITIVE` | B0 | `BACKEND_DATA_MODEL.md` | New table groups at existing granularity | all new-table groups | — | `T-SCHEMA-1` every table in exactly one group | None (documentation) |
| `CA-08` | `ADDITIVE` | B0 | `BACKEND_AUTHORIZATION_MATRIX.md`, `BACKEND_COMMAND_EVENT_CATALOG.md` | Additive command/event rows | none | all new endpoints | `T-CAT-1` **no frozen command/event redefined** | None |
| `CA-09` | `ADDITIVE` | B1 | `B1_AUTHORIZATION_RBAC.md` | Mint, **in the approved waves, only the 19 non-deferred codes** (`customer.*`, `contact.*`, `import.manage`, `customfield.manage`, `ticket.*`, `knowledge.*`, `assignment.manage`, `agent.manage`). **The 7 deferred codes (`quote.*`, `product.manage`, `form.manage`) are registered in `B14_08` §4 but NOT minted** — minting a permission for an unbuilt capability is scaffolding a deferred capability (`V-M05`). **Every additive code carries a cell for all six workspace roles** | none | all | `T-RBAC-1..10`; **six roles present, no new role, no new rank, no changed cell, 156 cells defined**; `T-RBAC-7` **(NC)** deferred codes absent | None |
| `CA-10` | `ADDITIVE` | B11 | `B11_DOMAIN_ATTACHMENT_MODEL.md` | `file_attachments.subject_type` += `customer`, `ticket`, `kb_article`, `import_batch` | enum extension, **incremental — added by the group that first uses each value** (`B14_04` §2) | — | `T-FILE-1` **B11 single storage authority** | None |
| `CA-11` | `ADDITIVE` | B8 | `B8_PLAN_CATALOG.md`, `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` | Independent per-module capability keys; **`inbox.copilot` reused, not replaced** | seed data | entitlement evaluation | `T-ENT-1..3` | **Pricing not frozen** by this amendment |
| `CA-12` | `ADDITIVE` | B7 | `B7_TRIGGER_CATALOG.md`, `B7_ACTION_CATALOG.md` | Triggers `customer_created`, `ticket_created`, `sla_breached`; action `create_ticket` (`auto_safe`) | none | — | `T-AUTO-1` **`send_message` stays `approval_required`**; excluded actions stay excluded | None |
| `CA-13` | `ADDITIVE` | B1 | `workspaces` | `operating_mode` preference | deferred | deferred | — | **DEFERRED with `GAP-024`** — registered, not scheduled |
| `CA-14` | **`COMPATIBLE_CLARIFICATION`** | B2 | `B2_LEAD_PROVENANCE_DUPLICATION.md` §3; CRM-INV-9 | Records that `lead_provenance` is Discovery-conversion-only; **non-Discovery Leads have no row** | **none** | none | `T-CA01-4` **(NC)** no provenance row for a manual Lead | **No frozen column, constraint or invariant changes** |

## Scheduling

**Consumed in the P0 wave (11):** `CA-01`, **`CA-15`**, `CA-02`, `CA-03`, `CA-05`, `CA-06`, `CA-07`, `CA-08`, `CA-09`, `CA-10`, `CA-14`.
**Post-P0 (3):** `CA-04` (with `GAP-007`), `CA-11` (packaging), `CA-12` (with `GAP-016/017`).
**Deferred (1):** `CA-13`.

**`CA-01` and `CA-15` are registered together or not at all** (`B14_02` §3 Rule 2). `CA-01` alone produces Lead rows that cannot satisfy the frozen Lead 360 contract.

**Slice placement:** `CA-01`, `CA-15`, `CA-03`, `CA-05`, `CA-06`, `CA-07`, `CA-08`, `CA-09`, `CA-10`, `CA-14` → **I5** · `CA-02` → **I6 (groundwork) + I13 (completion)** · `CA-11` → I9 · `CA-04`, `CA-12` → I14 · `CA-13` → **not scheduled**.

## Governance rule for implementation agents

An agent implementing a slice that consumes an amendment must:

1. Read the frozen contract **first**, verbatim.
2. Read the `CA-*` entry in `Docs/gap-plan/19_CONTROLLED_AMENDMENT_PLAN.md`.
3. Implement **only** what the amendment states.
4. **Never edit the frozen document.**
5. Record the amendment ID in the migration's docstring and in the slice's evidence.
6. Prove the amendment's negative controls pass before the slice is verified.
