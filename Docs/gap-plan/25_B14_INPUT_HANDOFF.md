# 25 — B14 Input Handoff

> **Status: FINALIZED — approved input, ready for B14.** B14 has not started and is not started by this document.

## 1. What B14 consumes

```
FROZEN B0-B13  (5c759cea72baaec9ee0096039475162efd4eeec0)
        +
APPROVED GAP PLAN  (this pack, Owner + CTO decisions recorded)
        =
B14 implementation master pack
```

## 2. Decision status

### Owner decisions — all six APPROVED

| ID | Decision |
|---|---|
| `PD-001` | **APPROVED** — one canonical `Customer` with `party_kind ∈ {organization, person}`; **no `Account`** |
| `PD-002` | **APPROVED** — Viewer receives masked contact phone/email; **server-side enforcement**, frontend masking is never the control |
| `PD-003` | **APPROVED** — Growth `inbox.copilot` promise honoured and reused; **OpenAI is the initial provider, behind an internal AI Provider Port**; OpenAI must not become the domain boundary |
| `PD-004` | **APPROVED** — independent per-module capability keys; **entitlement architecture only, pricing not frozen** |
| `PD-010` | **APPROVED** — **API-first**; `PUBLIC_UNAUTH` form intake deferred out of the initial wave |
| `PD-013` | **APPROVED** — **no autonomous customer-facing AI send in this programme**; a human always sends |

### CTO decisions — all six RESOLVED

`PD-005` typed side table · `PD-006` merge irreversible and **not** in the initial core (`GAP-007` → P1) · `PD-007` no transaction-wide import rollback · `PD-009` Price Books rejected · `PD-011` mode semantics approved under `CA-02` · `PD-012` `companies`/`calls` removed-or-deferred, **no fake backend domain created**.

### Deferred, blocking nothing

`PD-008` limits/retention · `PD-014` SLA 24/7 initially · `PD-015` AI-assisted metric.

**0 unresolved blocking decisions.**

## 3. `APPROVED_FOR_B14` — the P0 wave (12)

| GAP | Capability | Amendments |
|---|---|---|
| `GAP-001` | Customer (`organization` \| `person`) | `CA-03`, `CA-07`, `CA-09` |
| `GAP-002` | Contact UI / standalone address book | `CA-05`, `CA-06` |
| `GAP-003` | Business-less / manual Lead origin | **`CA-01`**, `CA-14` |
| `GAP-004` | Lead → Customer conversion | `CA-09` |
| `GAP-005` | CRM independence from Discovery (proof) | `CA-01` |
| `GAP-006` | Identity resolution (**detection only**) | — |
| `GAP-008` | CSV import | `CA-10` |
| `GAP-010` | Custom field definitions | `CA-07`, `CA-09` |
| `GAP-012` | Conversation AI/human mode + takeover | `CA-02` |
| `GAP-013` | Team inbox, routing, ownership | — |
| `GAP-014` | AI Agent domain (OpenAI behind the port) | `CA-09`, `CA-11` |
| `GAP-025` | Navigation IA | — |

## 4. `APPROVED_AFTER_P0` (8)

`GAP-007` (merge execution) · `GAP-011` (custom field values) · `GAP-015` (knowledge base) · `GAP-016` (tickets) · `GAP-017` (SLA) · `GAP-021` (calendar view) · `GAP-022` (assignment rules) · `GAP-023` (reporting expansion).

## 5. `DEFERRED` (6)

| GAP | Reason |
|---|---|
| `GAP-009` | Public form intake — `PD-010` APPROVED: API-first; returns only when its abuse surface is designed and approved |
| `GAP-018` / `GAP-019` / `GAP-020` | Products / Quotes / Quote→Deal — valuable but not differentiating for a WhatsApp-first CRM; `PD-009` rejects Price Books outright |
| `GAP-024` | Operating-mode onboarding — `CA-13` registered, not scheduled |
| `GAP-026` | Email channel (P2) — would be `NON_ADDITIVE` against B5; deferred so email complexity does not block WhatsApp-first value |

Also still deferred from frozen source, untouched: customer-facing invoicing (`B9-D-C004`), bulk CRM mutations (`B2-D-C016`), CRM export beyond `export.csv` (`B2-D-C017`), external calendar sync (`B2-D-C011`), CRM retention durations (`B2-D-C018`/`B1-D-015`).

## 6. `REJECTED`

Inventory · Warehouse · Vendors · Purchase Orders · Payroll · full accounting/ERP · Projects · native mobile app · telephony/SMS (`#/calls`) · live chat/chatflows · Deal Room · Sales Orders · **Price Books** (`PD-009`) · KB external-source crawling · `#/companies` as a distinct entity (`PD-001`, `PD-012`).

**No `GAP-*` ID is assigned to any**, so none can enter B14 by accident.

## 7. `CONFLICT_BLOCKED` (1)

`GAP-027` Customer Portal — requires authenticating a **non-member external person**. B1 models only users/memberships/workspaces; B13's session and authorization contract assumes every principal is a membership. **No frozen phase owns external identity.** Not solvable additively. **B1/B13 must not be reopened for this in the current programme.**

## 8. Amendment inventory B14 must register

**14 items across 7 phases** (`19_CONTROLLED_AMENDMENT_PLAN.md`), in frozen B13 vocabulary:

| Class | Count | Items |
|---|---:|---|
| **`NON_ADDITIVE`** | **1** | `CA-01` (B2 Lead origin — the only item changing a stated fact) |
| `ADDITIVE` | 12 | `CA-02`…`CA-13` |
| `COMPATIBLE_CLARIFICATION` | 1 | `CA-14` (`lead_provenance` is Discovery-only) |

`CA-04` and `CA-13` are registered but **not scheduled** in the approved waves.

## 9. What B14 must preserve

Workspace isolation · PostgreSQL authoritative / Redis non-authoritative · no auto-retry of `UNKNOWN` non-idempotent work (`B12-D-A020`) · B11 as single storage authority · B12 webhook/integration contracts unmodified · B13 security controls unweakened · **Won Deal ≠ Recognized Revenue** · **Accepted Quote ≠ Recognized Revenue** · **Subscription Billing ≠ Customer Revenue** · **Customer invoice ≠ SaaS invoice** · Discovery not required for CRM · **no autonomous customer-facing AI send** · **no second, AI-owned send command** · **OpenAI behind the provider port, owning no business semantics** · frontend grants no authorization · no cross-workspace identity merging · no duplicate commercial truth · **no fake Business, fake DiscoveryJob or fake `lead_provenance` for any non-Discovery Lead**.

## 10. What B14 must NOT assume

That any amendment is **registered** (approved ≠ registered) · that pricing is fixed (`PD-004` approves architecture only) · that a specific OpenAI model is domain truth (**model choice is configuration**) · that deferred gaps are cancelled · that `GAP-027` is designable · that proposed names (table names, `handling_mode` values, permission codes) are final · that release order cannot be re-cut on capacity.

## 11. Status

`B14_STARTED = NO` · `IMPLEMENTATION_STARTED = NO` · `AMENDMENTS_EXECUTED = 0` · `FROZEN_FILES_MODIFIED = 0` · `COMMITS = 0` · `OWNER_DECISIONS_APPROVED = 6/6` · `CTO_DECISIONS_RESOLVED = 6/6` · `BLOCKING_DECISIONS_OPEN = 0` · `GAP_PLAN_STATUS = APPROVED_INPUT`.
