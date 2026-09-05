# 00 — WazLink Gap Plan · Executive Summary

> **FINALIZED — approved input for B14.** All six Owner decisions APPROVED; all six CTO decisions RESOLVED. No code, no migration, no B14, no commit. Frozen B0–B13 and the frozen frontend are unmodified. Baseline: B13 = `5c759cea72baaec9ee0096039475162efd4eeec0`.

## 1. The finding that matters most

WazLink's frozen architecture is **substantially more Track-B-ready than it appears — and blocked by one constraint.**

`B2_LEAD_AGGREGATE.md` §1 fixes `leads.business_id` as NOT NULL and constrains `origin_type` to CHECK `IN ('discovery')`. **Nothing can enter CRM except through Discovery.** The stated non-negotiable principle — *"Discovery MUST NOT be a prerequisite for CRM participation"* — is not satisfiable today.

Meanwhile `B9_DUAL_TRACK_COMPATIBILITY.md` already declares `TRACK_B_DISCOVERY_REQUIRED = NO`, ships five Track-B-native `origin_kind` values, and carries negative controls (`AT-TRACK-1/2`) that **fail** if recognition ever requires a DiscoveryJob or a Business. Its `AT-TRACK-3` and `AT-TRACK-4` assume *"a manually-created Lead"* and *"an imported Lead"* — records B2 currently forbids.

**B9 was built forward-compatible for exactly this programme; B2 has not yet opened the door.** One controlled amendment (`CA-01`) opens it, and the frozen CHECK is already written as an *implication* rather than an equality — the shape was reserved. That single amendment unblocks the entire plan.

## 2. What was found

**11 false gaps.** Capabilities assumed missing that are already designed: **Contacts** (fully specified in `B2_CONTACT_MODEL.md`, UI is a `Placeholder`), Track-B revenue and attribution (complete in B9), conversation assignment (`AssignConversation` exists), many-to-many Lead↔Contact, contact-less Leads, generic file attachment, deal forecasting, business identity resolution. Treating any as new work would have produced duplicate truth.

**11 named deferrals, not unknowns.** `B2-D-C001` (manual Lead), `C002` (import), `C003` (merge), `C007` (`contact.*` permissions), `C011`, `C016`, `C017`, `C018`, `B4-D-C002` (Sales Copilot/Agent), `B5-D-C009`, `B9-D-C004`. The frozen corpus anticipated this programme and recorded its own conditions.

**Two live orphans.** `#/copilot` and `#/agent` are shipped frontend screens with **no owning backend domain** — and `inbox.copilot` is a **capability sold today in PLAN-GROWTH**. This is an existing commercial exposure the audit surfaced, not one the plan creates.

**27 gaps** total: P0 **12**, P1 **13**, P2 **2**, P3 **0** (P3 candidates were resolved as outright rejections, not parked). Waves: `APPROVE_NOW` **12** · `APPROVE_AFTER_P0` **8** · `DEFER` **6** · `CONFLICT_BLOCKED` **1**. `GAP-007` moved P0→P1 under `PD-006` — advisory duplicate *detection* is needed early; irreversible merge *execution* is not.

## 3. Impact on frozen architecture

Expressed in frozen B13 vocabulary (`ADDITIVE` · `COMPATIBLE_CLARIFICATION` · `NON_ADDITIVE`), because B13 requires **every** change to a frozen artifact to be registered regardless of class:

**14 amendment items across 7 phases** — **1 `NON_ADDITIVE`** (`CA-01`), **12 `ADDITIVE`**, **1 `COMPATIBLE_CLARIFICATION`**. **7 phases entirely unchanged: B3, B4, B6, B9, B10, B12, B13.**

**B9, B10, B12 and B13 need no change at all** — the revenue firewall, tax boundary, async semantics and security contract all hold without modification for all 27 gaps.

The one conflict is `GAP-027` **Customer Portal**: it requires authenticating a non-member external person, and no frozen phase models an external principal. `CONFLICT_BLOCKED`.

## 4. Shape of the solution

Nine new bounded Django apps (`customers`, `identity`, `imports`, `customfields`, `aiagent`, `knowledge`, `support`, `catalog`+`quotes`, `assignment`), plus extensions to B2, B5, B6, B7, B11 and analytics. **One commercial counterparty entity — `Customer`, with `party_kind ∈ {organization, person}` (`PD-001` APPROVED)**, covering B2B and B2C from a single model. **Account is deliberately rejected** as duplicate truth, on the same reasoning `B2-D-A004` used to reject `CMP-` Company. An individual Customer holds **no PII**: its phone/email/WhatsApp identity lives on its single linked Contact, which keeps frozen B5 and CRM-INV-18 untouched.

**14 new screens · 11 extended · 6 explicitly `NO_UI_REQUIRED`.** Navigation stays at 21 entries while adding seven capabilities, by demoting configuration into Settings and removing two orphan entries.

**25 new permissions · ~35 commands · 24 events. Zero frozen commands or events are redefined.**

## 5. The firewalls, held

| Invariant | How |
|---|---|
| Won Deal ≠ Recognized Revenue | B6 unchanged |
| **Accepted Quote ≠ Recognized Revenue** | `AcceptQuote` writes no `revenue_events` and is not an input to `RecordRevenueEvent`; four negative controls; **demonstrated on stage in Demo E by showing the revenue figure not move** |
| Subscription Billing ≠ Customer Revenue | CRM-INV-8 untouched |
| Customer invoice ≠ SaaS invoice | Customer invoicing not built (`B9-D-C004` stays deferred) |
| AI never mutates silently | The agent holds **no permissions**; accepted proposals run as the human under the owning domain's guard; `B5-D-A021` and `B7_ACTION_CATALOG.md` §3 preserved verbatim |
| **AI never sends** | `PD-013` **APPROVED — no autonomous customer-facing AI send in this programme.** A human always sends, through the frozen `SendMessage` path. **No second, AI-owned send command exists** |
| **OpenAI is an adapter, not domain truth** | `PD-003` **APPROVED — OpenAI is the initial provider behind an internal AI Provider Port.** The `aiagent` domain owns business semantics; no model name, prompt, token count or provider error code may appear in any business domain. Model choice is **configuration** (`29_AI_PROVIDER_ARCHITECTURE.md`) |
| No cross-workspace identity merging | `workspace_id` is part of every resolution key — cross-workspace lookup is not expressible in the API |
| No auto-retry of `UNKNOWN` non-idempotent work | `B12-D-A020` applied at import-row level; results report three counts, not two |

## 6. Releases

**G0** Customer Core (HIGH) → **G1** Existing-Customer CRM (MEDIUM) → **G2** Identity & Import (HIGH, reduced by removing merge execution) → **G3** WhatsApp AI/Human (VERY_HIGH) → **G4** Support (HIGH) → **G6** Productivity (HIGH) → **G7** Reporting (MEDIUM). **G5 Sales Enablement is deferred.** **Demo A lands at the end of G0** and is the earliest proof that CRM works with zero Discovery; **Demo C lands at the end of G3** and proves WhatsApp → Identity → Customer/Lead → OpenAI-backed AI → human takeover and human Send. **No hour estimates are given — no evidence supports them.**

## 7. Internal consistency

| Check | Result |
|---|---|
| Every confirmed gap in the master matrix | 27/27 |
| Every gap has a priority and a `GAP_ID` | 27/27 |
| Frontend screens with no backend | **0** |
| Backend capabilities with no UI and no classification | **0** |
| New entities with no owning domain | **0** |
| New APIs with no authorization | **1 by design** (`PUBLIC_UNAUTH` form intake, `PD-010`) |
| Consequential commands without a permission | **0** |
| Duplicate entities / APIs / commands / events | **0** |
| Conflicting ownership | **0** |
| Revenue-firewall violations | **0** |
| Cross-workspace risks unresolved | **0** |
| Releases containing only defined `GAP_IDs` | 8/8 |
| Demos mapping to defined capabilities | 6/6 |
| Amendments naming their affected frozen contract | 8/8 |

## 8. Decision status

**Nothing.** All six Owner decisions are APPROVED and all six CTO decisions RESOLVED; three remaining decisions are deferred and block nothing. **0 unresolved blocking decisions.**

**14 amendment items require CTO registration before B14 consumes them.** `CA-01` is the root and the only `NON_ADDITIVE` item; it was corrected during the Decision Gate to cover all five blocking frozen constraints — `origin_type`, `business_id`, **`converted_at`**, the CRM-INV-10 index, and **`last_activity_at` seeding** — and to withdraw the impossible requirement that non-Discovery Leads write a `lead_provenance` row.

**One conflict remains blocked, by decision:** `GAP-027` Customer Portal.

## 9. Status

`B14_STARTED = NO` · `IMPLEMENTATION_STARTED = NO` · `FROZEN_FILES_MODIFIED = 0` · `AMENDMENTS_EXECUTED = 0` · `COMMITS = 0` · `OWNER_DECISIONS_APPROVED = 6/6` · `CTO_DECISIONS_RESOLVED = 6/6` · `BLOCKING_DECISIONS_OPEN = 0` · `EXTERNAL_COMPETITOR_VERIFICATION = RUN` (16 verified rows, 2 prompt-supplied, 2 not-verified and labelled) · `GAP_PLAN_STATUS = APPROVED_INPUT_READY_FOR_B14`.
