# B4 — Intelligence Subject Model

> **B4 status:** Target design only. This document resolves the one open cross-domain question both B2 and B3 explicitly left for "the Intelligence domain design" to settle.

## 1. The question, and who left it open

Frozen `BACKEND_DATA_MODEL.md` names the Intelligence domain's tables as `lead_intelligence_analyses, intelligence_signals, ai_usage_records`, unique on **`lead/input_fingerprint`**. Frozen `BACKEND_DOMAIN_OWNERSHIP.md` names the aggregate `LeadIntelligenceAnalysis` and the command `AnalyzeLead`. Both presume the subject is a **Lead**.

The frozen frontend disagrees. `getBusinessIntelligence(businessId)` (`intelligence.js:66`) and every S4 screen key exclusively on **`businessId`**, and Lead 360 states outright, in its own UI copy, that it *"reads Business and Intelligence and the source directly instead of copying their context into Lead"* and is *"a live reference from S4, and does not copy Lead Score or Opportunity"* (`Lead360.tsx:106,172`).

Both B2 and B3 found this tension and both declined to resolve it, on record:

| Package | Record | What it says |
|---|---|---|
| B2 | `B2-D-B006` | *"not CRM's to decide... the decision belongs to the Intelligence domain design"* (`B2_DECISION_REGISTER.md`) |
| B3 | `B3-D-C011` | *"B3-D-C011 is the one to watch... B3 records the tension and leaves the decision where B2 already left it"* (`B3_B4_HANDOFF_CONTRACT.md` §4) |

Both packages independently confirm the frozen contract survives either answer: `Lead360.intelligence` is declared in `BACKEND_OPENAPI_V1.yaml` as an untyped `{ type: object, nullable: true }` — an intentional placeholder, not a schema committed to Lead-keying.

## 2. The decision

> **`B4-D-A001`: Intelligence attaches to Business. There is no Lead-keyed intelligence truth, ever.**

A `Lead` never owns, never caches, and never receives a copy of any score, signal, evidence, confidence, or recommendation. `Lead360.intelligence` (§5) is populated by a **live read-through** keyed on `lead.business_id` — the same field B2 already uses to resolve the Business row, following the exact pattern `Lead360.tsx:63,72` already implements in the frontend.

### 2.1 Why, beyond the frontend's own words

1. **A Business can exist, and be fully analyzable, before any Lead exists.** `DiscoveryResults.tsx:307-320` runs analysis on raw Discovery results, long before a conversion decision is made. If intelligence were keyed by Lead, every unconverted Business would be permanently unanalyzable — the frozen frontend's most common path.
2. **One real-world business must not produce two truths.** B3's entire identity model (`B3-INV-4`) exists to guarantee one Business per real-world company per workspace. Keying intelligence by Lead would let the same Business acquire a second, divergent intelligence history the moment it is converted — the exact "duplicated truth" this brief's §5 forbids.
3. **Rediscovery and re-analysis outlive conversion.** A Business can be rediscovered, re-analyzed, or merged (`B3_BUSINESS_IDENTITY_MODEL.md` §6) independently of whether it ever became a Lead, or after a Lead is archived. Business-keying is the only model where "when was this last analyzed" has one answer regardless of CRM state.
4. **`ai_usage_records` and `intelligence_signals` are already table-per-Business-shaped in the fixture** (`SIG-1042-*`, keyed on `businessId` — `data.js:152`), so re-keying to Business is a refinement of what the data already looks like, not an invention.

## 3. What this changes in frozen B0, stated plainly

This is **not** free of frozen-contract friction, and it is stated here rather than buried:

| Frozen artifact | Frozen state | B4 target | Classification |
|---|---|---|---|
| `BACKEND_DATA_MODEL.md` — Intelligence row | tables keyed `lead/input_fingerprint` | tables keyed `business_id/input_hash`; table names refined (`B4_DATA_MODEL.md` §2) | `NON_ADDITIVE_CONTROLLED_CHANGE` — see `B4_CONTROLLED_AMENDMENTS.md` item 1 |
| `BACKEND_DOMAIN_OWNERSHIP.md` — aggregate name | `LeadIntelligenceAnalysis` | B4's aggregate is `IntelligenceRun`, owned by `BUS-*` | `NON_ADDITIVE_CONTROLLED_CHANGE` — item 2 |
| `BACKEND_COMMAND_EVENT_CATALOG.md` — `AnalyzeLead` / `LeadIntelligenceCompleted` | Lead-named command/event | retained as a thin, optional Lead-context compatibility path (§4); **not** the primary contract | `COMPATIBLE_REFINEMENT` — item 3 |

No frozen file is edited. `B4_CONTROLLED_AMENDMENTS.md` states, for each row, the frozen text, the target text, and the composition order, exactly as B2 and B3's amendment registers do.

## 4. `AnalyzeLead` is not deleted — it is demoted

Frozen B0 already enumerates the command `AnalyzeLead` and the event `LeadIntelligenceCompleted`. B4 does not remove them from the catalog text (B3 already established that catalog enumerations are "not a closed set" — additions and reinterpretations are how this corpus evolves them). Instead:

- **`RequestBusinessIntelligence`** (additive) is the primary, general-purpose command. It accepts `BUS-*` and requires no Lead to exist.
- **`AnalyzeLead`** (frozen, reinterpreted) is retained as a **Lead-context convenience alias**: it accepts `LEAD-*`, resolves `lead.business_id` server-side, and delegates to the identical admission path as `RequestBusinessIntelligence`. It creates no Lead-scoped state and produces no second truth — it is sugar, not a parallel model.
- **`BusinessIntelligenceCompleted`** (additive) is the canonical completion event, carrying `business_public_id` and an optional `lead_public_id` (populated only when a converted Lead exists at completion time, purely informational).
- **`LeadIntelligenceCompleted`** (frozen) is **not emitted** by B4. Emitting an event under that name would imply Lead-keyed aggregate semantics the resolved model does not have. This is recorded, not silently dropped — see `B4_CONTROLLED_AMENDMENTS.md` item 3 and `B4_COMMAND_EVENT_CATALOG.md` §1.

Full detail — request/response shapes, idempotency, errors — is `B4_COMMAND_EVENT_CATALOG.md`, not repeated here.

## 5. `Lead360.intelligence` — the read-through contract

`Lead360.intelligence` (frozen, `{type: object, nullable: true}`) is populated as follows, and this is the entire rule:

```
Lead360.intelligence =
    null                                  if no completed IntelligenceRun exists for lead.business_id
    IntelligenceSummary(business_id)      otherwise, read live at request time
```

`IntelligenceSummary` is a B4-owned response shape (`B4_API_DTO_CONTRACTS.md` §4) — never a column on `leads`, never a value copied at conversion time, never refreshed by a CRM-side job. Reading it twice five seconds apart can return different data if a new run completed in between; that is correct, not a bug — it is the same "live reference" the frontend's own copy promises.

## 6. Pre-Lead vs. post-conversion — one rule, no branch

Because intelligence never distinguishes Lead-existence as part of its own state, there is exactly one behavior to specify, not two:

| Stage | What's true |
|---|---|
| Business exists, no Lead yet | `GET /businesses/{id}/intelligence` is fully functional; analysis may be requested and re-requested |
| Business converts to Lead | No intelligence row is read, copied, written, or archived. Nothing about `IntelligenceRun` changes. `Lead360.intelligence` starts resolving through `lead.business_id` — the same rows, the same history |
| Lead archived, Business remains | Intelligence remains queryable via `GET /businesses/{id}/intelligence`; the archived Lead's `Lead360.intelligence` continues to resolve live unless B2's own archive-read rules say otherwise (B2's concern, not B4's) |
| Business merged into another (`BusinessMerged`) | Governed by `B4_B3_ACQUISITION_BOUNDARY.md` §4 — the surviving Business's intelligence is authoritative; the losing Business's history is retained as a resolvable tombstone, mirroring B3's own merge contract |

Rediscovery, staleness, and conversion-triggered analysis are specified in their own documents (`B4_FRESHNESS_STALENESS.md`, `B4_B2_CRM_LEAD360_BOUNDARY.md`) — this document fixes only the ownership axis, once, for every other document to build on.
