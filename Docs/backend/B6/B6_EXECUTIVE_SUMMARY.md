# B6 — Pipeline & Deals Target Design — Executive Summary

> **B6 status:** Target design only. Uncommitted. Awaits independent CTO audit. Nothing in `Docs/backend/B6/` is approved, and no implementation may act on it.

## 1. Scope

B6 designs the authoritative Pipeline & Deals backend domain: the commercial progression `Lead → Deal → Pipeline → Stage progression → Won / Lost`. It is **additive**: it modifies no frozen B0, B1, B2, B3, B4, or B5 file directly. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, B2 at `24643397254caac4117320df756d8bc164882635`, B3 at `9a99019576943dffd5d52e6d747fefd7f7d538ec`, B4 at `0bd6f2095ac14f1c62ff9dc98f497bba4acf3a5a`, and B5 at `c18cf7947ee320ea4b7b766e3cf7bdda4d6c44c0`.

Unlike B3/B4/B5, B6 does not begin from an empty frozen skeleton. Frozen B0 already names the Pipeline domain (`BACKEND_DOMAIN_OWNERSHIP.md`), its table group (`BACKEND_DATA_MODEL.md`), four commands and four events (`BACKEND_COMMAND_EVENT_CATALOG.md`), a coarse state machine (`BACKEND_STATE_MACHINES.md`), a Deal DTO sketch and API surface (`BACKEND_DTO_CONTRACTS.md`, `BACKEND_API_CATALOG.md`), three public-ID prefixes (`BACKEND_PUBLIC_ID_REGISTRY.md`), Deal-related RBAC permissions and their full role matrix (`B1_AUTHORIZATION_RBAC.md`), the revenue-separation ADR (`BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007), and Pipeline-aware analytics semantics (`BACKEND_ANALYTICS_SEMANTICS.md`). B2's own timeline model already names `pipeline` as an eligible cross-domain timeline source with `deal.view` as its read gate. **B6's job is therefore predominantly `COMPATIBLE_REFINEMENT` — specifying, hardening, and completing an already-frozen skeleton — not invention from a blank page**, and every place B6 elaborates that skeleton is checked against the frozen source first, exactly as `B5-FIX.1` establishes must happen before any permission, name, or table is proposed as "new."

## 2. The single load-bearing invariant

> **WON DEAL ≠ RECOGNIZED REVENUE.**

A Deal transitioning to `won` never creates `RevenueEvent`, never recognizes revenue, never creates attribution truth, never creates payment/invoice/billing truth, and `Deal.value` (the frozen DTO's own field name for the commercial deal amount) is never read by any recognized-revenue selector as authoritative financial truth. This is not a B6 invention: frozen `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007 already states *"`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent."* frozen `BACKEND_COMMAND_EVENT_CATALOG.md` already states *"`DealWon` MUST NOT emit `RevenueRecognized` by default."* and frozen `BACKEND_PUBLIC_ID_REGISTRY.md` already states *"`DEAL-*` does not imply `REV-*`; a `REV-*` exists only after the explicit revenue-recognition command."* B6's job is to prove, structurally and with negative-control tests, that its own design cannot violate a boundary the platform already committed to before B6 existed. See `B6_REVENUE_FIREWALL.md`.

## 3. Key decisions, stated plainly

- **Deal is Lead-keyed**, 0..N Deals per Lead, mirroring B5's Conversation-is-Lead-keyed precedent and the frozen ERD's `LEAD ||--o{ DEAL : opens`. A Deal cannot exist without a Lead in Phase 1.
- **`business_ref` on the frozen Deal DTO is a derived snapshot of `Lead.business_id`**, not an independent relationship — this reconciles the frozen DTO sketch (which lists `business_ref`) with frozen B1's Doctrine R-2 relationship-injection table (which lists only `Deal → Lead, Pipeline, Stage`) without contradicting either.
- **Deal does not reference Contact directly.** No `DealContactLink` table. Contacts are reached transitively through `Deal.lead_id → Lead → lead_contacts`, avoiding a second CRM relationship truth.
- **Won/Lost are Deal-level terminal outcomes (`Deal.status`), not configurable PipelineStage rows.** `Deal.stage_id` only ever addresses an open, non-terminal stage. This resolves the task's explicit fork cleanly and matches the frozen DTO's separate `status` and `stage_ref` fields.
- **The frozen Deal DTO field is `value`, not `amount`.** B6 uses `value` throughout to avoid inventing a second, competing field name for the identical frozen concept — see `B6_DEAL_AGGREGATE.md` §2.
- **Reopen is supported** (`ReopenDeal`, `won→open` / `lost→open`), added as an **additive** extension to the frozen coarse state machine (new edges only; the frozen `open→won`/`open→lost` edges are untouched) — see `B6_CONTROLLED_AMENDMENTS.md` item 1.
- **RBAC reuses `deal.view`, `deal.create`, `deal.update`, `deal.close` verbatim** from frozen `B1_AUTHORIZATION_RBAC.md`, unchanged. Three permissions are genuinely new: `deal.assign`, `deal.reopen`, `pipeline.manage`.
- **B6 mints zero new public-ID prefixes.** `DEAL-`, `PIPE-`, `STG-` already exist in frozen section A of the registry.
- **B6 has no external provider cost.** No retry-attempt/rate-limit amendment is proposed; the frozen general-API ceiling already covers abuse protection.

## 4. Document pack

36 documents under `Docs/backend/B6/` (this file plus 35 others), covering frontend evidence, domain ownership, data model, the Deal aggregate, Lead/Business/Contact relationships, the Pipeline and PipelineStage models, the Deal state machine, stage transition history, Won/Lost/loss-reason semantics, the revenue firewall, forecast/probability, currency, ownership/assignment, RBAC/entitlements/tenancy, concurrency/idempotency, the command/event catalog, CRM timeline integration, the B4/B5/B7 boundaries, the B2 handoff contract, API/DTO contracts, read models, the failure catalog, acceptance tests, the security threat model, observability/audit, retention/deletion, the rate/cost model, the decision register, controlled amendments, implementation readiness, and a verification matrix.

## 5. Status discipline

B6 is authored by a Principal Backend Architect, not verified by one. This document, and every document in this pack, is a **proposal** pending independent CTO countersign. `BACKEND_DOCUMENTATION_INDEX.md` is updated to register B6 as `DESIGN IN PROGRESS / NOT CLOSED`, mirroring the exact same disclaimer already carried, unmodified, by the (independently closed) B3 and B4 sections of that same index.
