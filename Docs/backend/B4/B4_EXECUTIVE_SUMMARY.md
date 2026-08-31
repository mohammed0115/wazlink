# B4 — AI Lead Intelligence: Executive Summary

> **B4 status:** `DESIGN IN PROGRESS — NOT CLOSED`. This document orients a reader entering the corpus for the first time; every claim here is expanded and cited in its own document.

## 1. What B4 is

B4 converts normalized Business/Discovery evidence (B3's output) into structured sales intelligence — a five-component score, an independent confidence measure, evidence-backed signals, and a structured recommendation — favoring deterministic rules and versioned scoring logic over opaque AI judgement. It is not a generic AI service: it has one subject (`Business`), one execution unit (`IntelligenceRun`), and a closed set of output shapes (`B4_DOMAIN_OWNERSHIP.md`).

It sits between B3 (Discovery & Acquisition, closed) and B2 (CRM/Lead 360, closed), and prepares — without designing — the contracts B5 (Messaging), B6 (Pipeline/Deals), and B7 (Automation) will eventually read.

## 2. The central decision

Both B2 and B3 found the same open question and explicitly left it for "the Intelligence domain design" — this phase — to answer: **does intelligence key by Business or by Lead?** The frozen frontend answers unambiguously in its own UI copy: Lead 360 *"reads Business and Intelligence directly... and does not copy Lead Score or Opportunity"* — a *"live reference,"* never a copy. B4 adopts Business-keying as `B4-D-A001`, and every other document in this corpus is built on that resolution (`B4_INTELLIGENCE_SUBJECT_MODEL.md`).

This required one honest, non-additive amendment: frozen B0's `lead_intelligence_analyses` table and `AnalyzeLead`/`LeadIntelligenceCompleted` command/event are Lead-presuming by name. B4 does not edit frozen text — it proposes a controlled amendment (`B4_CONTROLLED_AMENDMENTS.md`), renames its own table `intelligence_runs`, keeps `AnalyzeLead` alive as a thin Lead-context alias, and emits the additive `BusinessIntelligenceCompleted` instead of the frozen Lead-keyed event name.

## 3. Deterministic vs. AI — the hard boundary

Every fact deterministically derivable from B3's normalized fields (website presence, phone presence, review-count thresholds) is computed locally — the provider is never called to restate it (`B4-D-A008`). The provider is called only for genuine judgement (is this website *weak*) or presentation prose (an outreach-angle suggestion), and every provider response is validated against a strict, closed JSON schema before a single domain field is written — no free-form output ever mutates truth (`B4-D-A015`).

## 4. Scoring, confidence, and "we don't know yet"

The frozen frontend's own five-dimension scoring contract (`activity`/25, `digital_opportunity`/30, `reachability`/20, `service_fit`/15, `data_quality`/10 = 100, tier thresholds 80/65/40) is adopted verbatim as authoritative (`B4_SCORING_MODEL.md`). Confidence is computed independently — a high score with low confidence, and the reverse, are both representable. When evidence is genuinely too thin, the run completes as `insufficient_data`: no forced score, no tier, no recommendation (`B4-D-A011`) — reusing an invariant the frozen frontend already enforces today.

## 5. The cost lesson, applied before it had to be

B3 needed a second independent countersign round to close a retry-cost gap the first design missed. B4 applies that lesson from the start (`B4_COST_RATE_LIMIT_MODEL.md`):

- **`MAX_INTELLIGENCE_RUN_ADMISSIONS_PER_WORKSPACE_PER_HOUR = 60`** — adopts frozen B0's own "AI analysis — 60/hour/workspace" verbatim, one shared counter for both first-analysis and re-analysis (there is no free-retry asymmetry to exploit here, unlike B3's original gap).
- **`MAX_BATCH_SIZE_PER_ANALYZE_REQUEST = 20`** — closes the frozen frontend's own unbounded "analyze all visible results" action, the exact class of defect B3's independent audit found after the fact, caught here during authoring instead.
- **`MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3`** — automatic transient-retry bound, kept structurally distinct from the workspace admission counter.
- A cancel-from-`queued` release / cancel-from-`running` retain asymmetry, reusing B3's proven pattern, found and closed during this design's own self-adversarial review (`B4_IMPLEMENTATION_READINESS.md` §4.1).

No automatic/eager analysis trigger exists in Phase 1 (`B4-D-C001`) — every admission is actor-initiated, which by itself eliminates the "automatic-trigger storm" attack class entirely.

## 6. Concurrency and freshness

An explicit `is_current` pointer, flipped only inside the completing transaction and only if no run with a strictly newer input snapshot already holds it, means a stale completion can never silently overwrite newer truth (`B4-D-A022`). Staleness itself is computed at read time — never stored, never swept — and is shown with a marker on every read while being excluded from priority-ranking and (future) automation-trust surfaces specifically (`B4_FRESHNESS_STALENESS.md`).

## 7. Boundaries held

- **B3**: read-only. B4 needs zero event subscription to be correct — freshness and admissibility are computed from a direct read of B3's own tables (`B4_B3_ACQUISITION_BOUNDARY.md` §5), the strongest form of "no circular dependency" this corpus has stated yet.
- **B2**: `Lead360.intelligence` is a live read-through keyed on `lead.business_id`, never a copy, never conversion-triggered (`B4_B2_CRM_LEAD360_BOUNDARY.md`).
- **B5/B6/B7**: B4 recommends; it never sends, never creates a Deal, never triggers automation. A future automation consumer may key only on versioned structured codes, never on free-form prose (`B4_DOWNSTREAM_HANDOFFS.md`).
- **Revenue**: no B4 field, event, or write path ever implies recognized or attributed revenue — structural, not policy (`B4-D-A026`).
- **S8 Sales Copilot/Agent**: traced, found real, and explicitly excluded — it needs B2+B5+B6+B7 simultaneously and cannot belong to a phase that sits before three of them exist (`B4_FRONTEND_TRACEABILITY.md` §2, `B4-D-C002`).

## 8. Mechanical counters

```
B4_DOCUMENT_COUNT = 30

FRONTEND_AI_BEHAVIOR_COUNT = 30
FRONTEND_TRACE_A = 22
FRONTEND_TRACE_B = 4
FRONTEND_TRACE_C = 4
FRONTEND_TRACE_D = 0

DOMAIN_AGGREGATE_COUNT = 1        (IntelligenceRun)
DOMAIN_ENTITY_COUNT = 4           (Signal, Evidence, Recommendation, IntelligenceUsageRecord)
RUN_STATE_COUNT = 5

SIGNAL_CATEGORY_COUNT = 6
SIGNAL_CODE_COUNT = 18
RECOMMENDATION_CODE_COUNT = 6

API_OPERATION_COUNT = 7
REQUEST_DTO_COUNT = 2
RESPONSE_DTO_COUNT = 9

COMMAND_COUNT = 5                 (2 frozen-derived/redefined, 3 additive)
EVENT_COUNT = 3                   (all additive)
CONSUMED_EVENT_COUNT = 0

FAILURE_SCENARIO_COUNT = 35
ACCEPTANCE_TEST_COUNT = 208
ACCEPTANCE_CATEGORY_COUNT = 26
DUPLICATE_ACCEPTANCE_TESTS = 0

CLASS_A_DEFINED = 32
CLASS_A_UNRESOLVED = 0
CLASS_B_UNRESOLVED = 12
CLASS_C_UNRESOLVED = 15

CONTROLLED_AMENDMENT_DECISION_COUNT = 5
CONTROLLED_AMENDMENT_OPERATION_COUNT = 5
CONTROLLED_AMENDMENT_TARGET_ARTIFACT_COUNT = 3

NEW_PUBLIC_ID_PREFIXES = 0        (ANL- reclassified §B→§A, not invented)
NEW_PERMISSION_CODES = 2          (intelligence.view, intelligence.run)
NEW_ERROR_CODES = 0

UNDEFINED_AT_REFS = 0
UNDEFINED_B4_DECISION_REFS = 0
BROKEN_CROSS_DOCUMENT_REFS = 0

B0_DRIFT = 0
B1_DRIFT = 0
B2_DRIFT = 0
B3_DRIFT = 0
EVENT_ENVELOPE_DRIFT_FROM_B0 = 0

IMPLEMENTATION_LEAKAGE = 0
UNAUTHORIZED_FILES = 0
```

## 9. Findings by severity

```
CRITICAL_FINDINGS = 0
MAJOR_FINDINGS = 0
MINOR_FINDINGS = 0
INFO_FINDINGS = 5   (B4_IMPLEMENTATION_READINESS.md §5)
```

## 10. What this phase does not claim

This is a self-authored design pass. `B4_IMPLEMENTATION_READINESS.md` §4 records three defects this pass found and fixed in itself (an unbounded batch action, a cancellation-slot asymmetry gap, a re-analysis coalescing gap) — the same discipline B2 and B3 each applied before their own first independent countersign, neither of which self-closed. B4 does not self-close either.

**`B4_STATUS = DESIGN IN PROGRESS — NOT CLOSED`. `B5_READINESS = BLOCKED pending independent B4 closure.`**
