# 27 — Product Decision Register

> **Status: FINALIZED.** The six genuine Owner decisions are **APPROVED**. The six CTO-decidable items are **RESOLVED**. Three remain safely deferred and block nothing.

## 0. Blocking taxonomy — corrected

Earlier revisions said *"6 blocking decisions"* while the register's own column marked eight items as blocking *something*. Those were different kinds of blocking. The vocabulary is now explicit:

| Class | Meaning |
|---|---|
| `OWNER_BLOCKING` | Cannot proceed without an Owner business decision |
| `RELEASE_BLOCKING` | Blocks a specific release's implementation |
| `PACKAGING_BLOCKING` | Blocks commercial packaging only, never implementation |
| `NON_BLOCKING` | Can be defaulted or deferred with no consequence to sequencing |

**The genuine Owner decision count is 7** — `PD-001`, `PD-002`, `PD-003`, `PD-004`, `PD-010`, `PD-013` and **`PD-016`** — and **all seven are now APPROVED.**

> **`PD-016` added by `B14-FIX.2`** to close independent-countersign finding `M-01`. It is the Owner's explicit ratification of `CA-15`, which until now was authorised only by the pass that proposed it. It records an **authority**, not a new design — the amendment's engineering semantics are unchanged.

## 1. Owner decisions — APPROVED

| ID | Question | Decision | Class | Consequence |
|---|---|---|---|---|
| `PD-001` | One `Customer` entity, or `Account` + `Customer`? | **APPROVED — one canonical `Customer` commercial party with `party_kind ∈ {organization, person}`.** Account is **not** introduced as a second canonical commercial truth | `OWNER_BLOCKING` → **resolved** | Single commercial truth covering B2B **and** B2C. Full model in `05_CUSTOMER_ACCOUNT_CONTACT_MODEL.md` |
| `PD-002` | Viewer sees full or masked contact phone/email? | **APPROVED — Viewer receives masked values.** Authorized operational roles receive full values per RBAC. **Masking and authorization are enforced server-side; frontend masking is never the security control** | `OWNER_BLOCKING` → **resolved** | Closes the new bulk-PII egress path opened by the contacts list (`GAP-002`) |
| `PD-003` | AI assistant capability key and provider | **APPROVED — the Growth-plan `inbox.copilot` promise is honoured and reused. Initial AI provider is OpenAI, behind an internal AI Provider Port. OpenAI must not become the domain boundary** | `OWNER_BLOCKING` → **resolved** | No advertised promise is withdrawn; provider portability preserved. Architecture in `29_AI_PROVIDER_ARCHITECTURE.md` |
| `PD-004` | Module entitlement packaging | **APPROVED — independent capability keys per major module**, not one bundled "advanced CRM" key. **This approves entitlement architecture only; final commercial pricing is NOT frozen** | `PACKAGING_BLOCKING` → **resolved** | Future tiering and upsell remain open |
| `PD-010` | Public unauthenticated form intake | **APPROVED — API-first.** Authenticated/protected intake first; **`PUBLIC_UNAUTH` form intake is deferred** until its abuse/security surface is deliberately designed and approved | `OWNER_BLOCKING` → **resolved** | `GAP-009` leaves the initial wave; the plan's highest-risk surface is not built yet |
| **`PD-016`** | Is `CA-15` (Business-less Lead display identity, `NON_ADDITIVE` against frozen B2) ratified by the Owner? | **APPROVED — `CA-15` is ratified as a `NON_ADDITIVE` controlled amendment.** A Business-less Lead takes its display/reachability identity from its **primary Contact**, by reference. **No PII or Business attribute is copied onto `leads`; no Business, `DiscoveryJob` or `lead_provenance` row is fabricated.** Lead remains the CRM process aggregate; Contact owns PII; Business owns organization attributes where one exists. The Lead 360 Business projection is **optional** for non-Discovery Leads, and Lead List derives identity from Business when present and from the primary Contact when absent. **Existing Discovery Lead semantics are unchanged.** | `OWNER_BLOCKING` → **resolved** | Closes `M-01`: the approval chain is no longer self-referential. Full text in `19_CONTROLLED_AMENDMENT_PLAN.md` `CA-15`. **Engineering semantics unchanged** |
| `PD-013` | May AI autonomously send customer-facing WhatsApp? | **APPROVED — NO autonomous customer-facing AI send in this programme.** AI may draft, suggest, summarize, qualify, retrieve knowledge, recommend and propose. **A human always sends.** Future autonomous send requires a separate controlled architecture, product and safety decision | `OWNER_BLOCKING` → **resolved** | `B5-D-A021` and `B7_ACTION_CATALOG.md` §3 preserved verbatim; no frozen safety decision is reopened |

## 2. CTO decisions — RESOLVED

| ID | Question | Decision | Class |
|---|---|---|---|
| `PD-005` | Custom-field storage shape | **RESOLVED — typed side-table architecture.** Arbitrary JSON must not become canonical business truth; `BACKEND_DATA_GOVERNANCE.md` is honoured rather than argued with | `RELEASE_BLOCKING` (G1) → resolved |
| `PD-006` | Merge reversibility / blocking detection | **RESOLVED — merge is irreversible when eventually executed, and is NOT required for the initial core.** Identity resolution provides advisory duplicate detection and merge *candidates* first. **`GAP-007` moves P0 → P1** | `RELEASE_BLOCKING` → resolved |
| `PD-007` | Import rollback | **RESOLVED — no transaction-wide business rollback after a successful import.** Batch-scoped archive/remediation instead | `RELEASE_BLOCKING` (G2) → resolved |
| `PD-009` | Price Books | **RESOLVED — REJECT from the current programme.** Verified in Vtiger (E-03) but with no WazLink segment-pricing evidence (E-20) | `NON_BLOCKING` |
| `PD-011` | AI/human operating-mode semantics | **RESOLVED — approved as proposed** (`ai_assisted | human | ai_paused`), subject to B5 controlled-architecture consistency under `CA-02` | `NON_BLOCKING` |
| `PD-012` | `#/companies`, `#/calls` navigation | **RESOLVED — remove/defer both.** They correspond to no approved WazLink domain. **No fake backend domain is created merely to preserve an old UI label** | `NON_BLOCKING` |

## 3. Safe to defer — block nothing

| ID | Question | Disposition |
|---|---|---|
| `PD-008` | Import batch size, error-file retention, max custom fields | **DEFERRED.** Conservative defaults ship; the durations inherit the frozen unresolved retention mechanism (`B2-D-C018`, `B1-D-015`, B11 retention). No number is invented here |
| `PD-014` | SLA business hours / timezone / holidays | **DEFERRED.** SLA uses simple **24/7 elapsed-time** semantics initially — the only assumption that cannot silently under-report a breach. A business-hours policy may be approved later |
| `PD-015` | AI-assisted resolution metric | **DEFERRED.** Publish proposal-acceptance metrics only. Reporting "AI resolved N" would be false in an architecture where a human sends every message |

**None of the three blocks B14.**

## 4. Final status

| Class | Count | Status |
|---|---:|---|
| `OWNER_BLOCKING` | 5 | **all APPROVED** |
| `PACKAGING_BLOCKING` | 1 | **APPROVED** (`PD-004`; pricing itself remains open by design) |
| `RELEASE_BLOCKING` | 3 | **all RESOLVED** (`PD-005`, `PD-006`, `PD-007`) |
| `NON_BLOCKING` | 3 | resolved (`PD-009`, `PD-011`, `PD-012`) |
| `DEFERRED` | 3 | `PD-008`, `PD-014`, `PD-015` |
| **Total** | **15** | **0 unresolved blocking decisions** |
