# B4 — B3 Acquisition Boundary

> **B4 status:** Target design only. B4 consumes B3's output; it does not redesign Discovery, and it creates no circular dependency (`B3_B4_HANDOFF_CONTRACT.md` §6: B3's design is complete even if B4 is never built).

## 1. What B4 reads from B3

| Source | What | How |
|---|---|---|
| `businesses` | identity, normalized fields, `version`, `provenance`, `last_observed_at` | **read-only**, via B4's own repository layer — never a write |
| `discovery_results` | per-observation rating, review count, additional normalized fields, `data_quality` | **read-only**, most recent observation for the Business |
| `BusinessDiscovered` (frozen B0 event) | the acquisition signal — `{business_public_id, job_public_id, provider, discovered_at}` | informative only; §5 covers whether B4 subscribes at all |
| `BusinessRediscovered` (B3-owned event) | a later-job re-observation signal | informative only, not load-bearing (`B4_FRESHNESS_STALENESS.md` §6) |
| `BusinessMerged` (frozen B0 event, B3-emitted) | identity consolidation | consumed — §4 |

## 2. What gates whether a Business is analyzable

Mirroring B3's own frozen visibility rule for Discovery results (`B3-INV-8`, results visible only while `job.status = completed`), B4 requires:

> A Business is admissible for `RequestBusinessIntelligence` only if it is resolvable within workspace scope. **No Discovery-Job-completion precondition is imposed beyond that** — a Business row existing is sufficient, because a Business only ever exists once B3 has already normalized and persisted it (B3's own admission guarantees this).

This is deliberately looser than "the sourcing Job must currently be `completed`" — a Business can be legitimately re-analyzed long after its sourcing Job's own lifecycle is irrelevant (the Job could later be irrelevant to a re-analysis triggered by a merge or a manual data correction). B4 depends on the **Business row**, not on Job state, which is exactly the boundary B3 designed for (`B3_B4_HANDOFF_CONTRACT.md` §3.1: *"BUS-* is stable and permanently resolvable"*).

## 3. No B4 write path into B3

> **`B4-D-A030`: B4 never writes `businesses`, `business_identities`, or `discovery_results`.** No B4 command, worker, or reconciliation process has a write credential to any B3 table.

This is the exact ask `B3_B4_HANDOFF_CONTRACT.md` §5 makes of B4, honored structurally: B4's data-access layer (`B4_DATA_MODEL.md` §1) is defined with read-only access to B3's schema and full read/write access to its own.

## 4. Business merge

When `BusinessMerged` consolidates a losing Business into a surviving one (B3's own merge contract, `B3_BUSINESS_IDENTITY_MODEL.md` §6):

| Rule | Behavior |
|---|---|
| Surviving Business's intelligence | authoritative going forward — untouched by the merge itself |
| Losing Business's intelligence history | **retained**, not deleted — B4 never deletes an `IntelligenceRun`. It becomes reachable only via the losing Business's still-resolvable tombstone `BUS-*` (mirroring B3's own tombstone guarantee, `B3_BUSINESS_IDENTITY_MODEL.md` §6.2) |
| Does a merge trigger a new run on the surviving Business? | **No**, not automatically (`B4-D-C001` — no automatic triggering in Phase 1). An actor may explicitly request one if the merge changed available evidence meaningfully |
| Can two Businesses' intelligence be blended into one on merge? | **Never.** Blending two runs' signals would fabricate evidence neither run's input snapshot actually observed — a fresh run against the (now merged) surviving Business's current fields is the only correct path to updated intelligence |

## 5. Does B4 need to subscribe to any B3 event at all?

**No**, in this phase. `B4_FRESHNESS_STALENESS.md` §6 shows staleness is fully computable from a direct read of `businesses.version`/fingerprint at request time — B4 needs no event subscription to be correct. `BusinessDiscovered` and `BusinessMerged` are documented here as *available* signals (useful for observability dashboards, e.g. "N Businesses discovered today, M have no intelligence yet" — `B4_OBSERVABILITY_RECONCILIATION.md` §1) but **B4's correctness does not depend on delivery of either.** This is the strongest form of "no circular dependency": not just no B4→B3 write, but no B4 correctness requirement on B3's async delivery either.

## 6. What B4 does not redesign

B4 takes B3's identity model, normalization pipeline, provenance model, and provider abstraction as given and unamended. Nothing in this corpus proposes a change to `B3_BUSINESS_IDENTITY_MODEL.md`, `B3_NORMALIZATION_DATA_QUALITY.md`, `B3_ACQUISITION_PROVENANCE.md`, or `B3_PROVIDER_ABSTRACTION.md` — `B3_DRIFT = 0` is a design commitment, not merely a mechanical check (`B4_IMPLEMENTATION_READINESS.md` §3).
