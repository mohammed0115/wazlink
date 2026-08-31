# B4 — B2 CRM / Lead 360 Boundary

> **B4 status:** Target design only. B4 does not modify B2 ownership. `B2_DRIFT = 0`.

## 1. What B2 consumes from B4

`Lead360.intelligence` (frozen, `{type: object, nullable: true}`) is populated by exactly one read, no caching, no denormalization into any `leads` column:

```
GET /businesses/{business_id}/intelligence/summary   (B4-owned, B4_API_DTO_CONTRACTS.md §2)
```

| Field | Source |
|---|---|
| `score`, `tier`, `confidence` | current `IntelligenceRun` (`B4_SCORING_MODEL.md`) |
| `top_signals[]`, `top_risks[]` | the highest-`strength` positive and gap signals respectively, capped at 3 each |
| `recommended_action` | the current run's highest-priority `Recommendation` (`B4_RECOMMENDATION_MODEL.md` §2) |
| `analysis_freshness` | `{stale, stale_reasons[], rerun_suggested}` (`B4_FRESHNESS_STALENESS.md` §1, §4) |
| `history_available` | boolean — whether more than one completed run exists, so a Lead 360 UI can offer a "view history" affordance without B2 needing to know the shape of that history |

**Not** exposed to B2 by this summary: raw evidence, provider metadata, prompt policy version, or `IntelligenceUsageRecord` — those are B4-internal/operator surfaces (`B4_OBSERVABILITY_RECONCILIATION.md` §3), not CRM-facing.

`GET /businesses/{business_id}/intelligence/history` (full run list, `B4_API_DTO_CONTRACTS.md` §2) is a **separate, B4-owned** endpoint — a Lead 360 UI may call it directly; B2's own API never proxies or re-shapes it.

## 2. B2 ownership is untouched

No B4 command writes `leads`, `contacts`, `tasks`, `appointments`, or any other B2 table. No B4 table is read by a B2 domain-code path via ORM join (mirroring B0's cross-context prohibition, `B2_CRM_LIST_QUERY_MODEL.md` §6's own discipline) — B2's `Lead360` composition reads B4 only through the HTTP-shaped summary endpoint above, exactly as it reads B3's Business through its own contract.

## 3. Conversion behavior — the exact rule

> **`B4-D-A025`: `ConvertBusinessToLead` (B2's frozen conversion command) triggers no B4 write, no B4 read beyond what any other Lead 360 view would already do, and no automatic analysis request.**

| Question | Answer |
|---|---|
| Does B2 point to the same B4 intelligence after conversion? | Yes — nothing changes about which `IntelligenceRun`s exist; `Lead360.intelligence` simply starts resolving through `lead.business_id` |
| Does B4 create a Lead-specific overlay? | No — `B4_INTELLIGENCE_SUBJECT_MODEL.md` §1 forbids a second truth |
| Does conversion request re-analysis? | **No, by default.** An unconverted Business may already have a perfectly current `IntelligenceRun`; forcing a re-analysis on every conversion would be pure wasted provider spend. If the Business has **never** been analyzed, conversion still does not auto-trigger one — `Lead360.intelligence` is simply `null` until an actor requests analysis (pre- or post-conversion; `B4-D-C015`, `B3-D-C015`, already recorded by B3 as "product, not B2's or B3's to impose," is B4's to decide and is answered here as "no precondition either way") |

## 4. Duplicate scoring truth — explicitly prevented

Because `B4_INTELLIGENCE_SUBJECT_MODEL.md` §1 makes Business the sole key, "does converting create a second score" is not a race to prevent — it is structurally impossible, since no code path exists that would create a Lead-keyed row in the first place (`AnalyzeLead`'s alias resolves to the same Business-keyed admission, `B4_INTELLIGENCE_SUBJECT_MODEL.md` §4).

## 5. Archived Lead, live Business

An archived Lead's `Lead360.intelligence` continues to resolve live via `lead.business_id` unless B2's own read rules restrict access to an archived Lead's detail view — that restriction, if any, is B2's to define and enforce; B4 imposes none of its own. `B4_FAILURE_SCENARIOS.md` scenario 28 traces this explicitly.
