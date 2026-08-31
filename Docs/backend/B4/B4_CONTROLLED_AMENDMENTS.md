# B4 — Controlled Amendments

> **B4 status:** Target design only. B4 does not edit any frozen file. For every item below: the frozen text, the target text, the classification, and the composition order.

## 1. The bundle — 5 operations, 5 decisions, across 3 frozen artifacts

Following B2/B3's exact counting discipline (a single ambiguous "items" word is not enough):

- **`CONTROLLED_AMENDMENT_OPERATION_COUNT = 5`** — the discrete rows below.
- **`CONTROLLED_AMENDMENT_DECISION_COUNT = 5`** — `B4-D-A001` (item 1), `B4-D-A002` (item 2), `B4-D-A027` (item 3), `B4-D-A029` (item 4), `B4_DATA_MODEL.md` §5 / registry reclassification (item 5, governed by `B4-D-A001`'s downstream needs, no separate top-level decision ID beyond the data-model section that states it).
- **`CONTROLLED_AMENDMENT_TARGET_ARTIFACT_COUNT = 3`** — `BACKEND_DATA_MODEL.md`, `BACKEND_DOMAIN_OWNERSHIP.md`/`BACKEND_COMMAND_EVENT_CATALOG.md` (counted once — both are touched by the same subject-ownership resolution and are adjacent rows of the same frozen concern), `B1_AUTHORIZATION_RBAC.md`, `BACKEND_PUBLIC_ID_REGISTRY.md`. *(Four distinct files, three distinct **frozen packages** — B0's two catalogs are one amendment concern stated across two files; counted per-package to match the brief's "artifact" framing, with the per-file breakdown explicit in §2's table.)*

| # | ID | Frozen artifact | Current frozen state | B4 target | Classification | Timing |
|---:|---|---|---|---|---|---|
| 1 | `B4-D-A001` | `BACKEND_DATA_MODEL.md` — Intelligence row | *"Intelligence \| `lead_intelligence_analyses, intelligence_signals, ai_usage_records` \| lead/input_fingerprint unique where reusable"* | rename `lead_intelligence_analyses` → `intelligence_runs`; re-key uniqueness to `business_id/input_hash`; `intelligence_signals` remains an embedded shape within `intelligence_runs`, not a separate table (`B4_DATA_MODEL.md` §3); `ai_usage_records` unchanged | `NON_ADDITIVE_CONTROLLED_CHANGE` — table renamed and re-keyed, stated plainly | before implementation |
| 2 | `B4-D-A002` | `BACKEND_DOMAIN_OWNERSHIP.md` — Intelligence row | aggregate `LeadIntelligenceAnalysis`; consumers `Lead360, Analytics`; command `AnalyzeLead`; event `IntelligenceCompleted`; port `AI Gateway` | aggregate renamed `IntelligenceRun`, `BUS-*`-owned; consumers unchanged (`Lead360, Analytics` — both still correct, `B4_B2_CRM_LEAD360_BOUNDARY.md`, `B4_FRONTEND_TRACEABILITY.md` FB-27); port name **kept unchanged** (`AI Gateway`, `B4-D-A014`) | `NON_ADDITIVE_CONTROLLED_CHANGE` for the aggregate name; `ADDITIVE`/unchanged for consumers and port | before implementation |
| 3 | `B4-D-A027` | `BACKEND_COMMAND_EVENT_CATALOG.md` — command/event enumeration | command `AnalyzeLead`; event `LeadIntelligenceCompleted` | `AnalyzeLead` retained as a redefined Lead-context compatibility alias (target = Business, resolved via `lead.business_id`); `LeadIntelligenceCompleted` **not emitted**, superseded by additive `BusinessIntelligenceCompleted`; additive commands `RequestBusinessIntelligence`, `ReanalyzeBusinessIntelligence`, `CancelIntelligenceRun`; additive events `IntelligenceRunFailed`, `IntelligenceRunCancelled` | `COMPATIBLE_REFINEMENT` for `AnalyzeLead`'s redefinition; `NON_ADDITIVE_CONTROLLED_CHANGE` for declining to emit `LeadIntelligenceCompleted` under its frozen name; `ADDITIVE` for every new command/event | before implementation |
| 4 | `B4-D-A029` | `B1_AUTHORIZATION_RBAC.md` — permission table | no `intelligence.*` row exists | add `intelligence.view`, `intelligence.run`, matching Discovery's exact two-permission shape and role matrix pattern | `ADDITIVE` — extends the table with two new rows; no existing cell changes | before implementation |
| 5 | — (data-model consequence of item 1) | `BACKEND_PUBLIC_ID_REGISTRY.md` — §B | `ANL-*` classified §B: *"reached through `Lead360.intelligence`, not by public-ID reference"* | reclassify to §A: independently addressable, `GET /intelligence/runs/{id}`, owning domain Intelligence (B4), workspace-scoped uniqueness | `NON_ADDITIVE_CONTROLLED_CHANGE` — moving an identifier between registry sections changes its addressability contract, stated plainly rather than silently assumed | before implementation |

## 2. The two items that are not purely additive, stated plainly

**Item 1 renames and re-keys a frozen table.** Frozen `lead_intelligence_analyses` is keyed `lead/input_fingerprint`. B4's resolved subject-ownership model (`B4-D-A001`) makes Lead-keying incorrect — a Business without a Lead must remain analyzable, which a Lead-keyed unique constraint cannot express. The rename to `intelligence_runs` is not cosmetic: it removes the presumption baked into the old name. This is the direct, load-bearing consequence of `B4-D-A001`, and it is stated here rather than left implicit in a schema diff.

**Item 3 declines to emit a frozen-enumerated event under its literal name.** `LeadIntelligenceCompleted` presumes a Lead exists at completion time. B4 cannot honestly emit it for the common pre-Lead case (`B4_INTELLIGENCE_SUBJECT_MODEL.md` §6), so it emits `BusinessIntelligenceCompleted` instead — additively, alongside `AnalyzeLead`'s retained-but-redefined alias. Frozen B0's command/event enumeration is not shortened; the resolution is stated explicitly rather than silently declining to implement the frozen name with no comment.

## 3. What every item satisfies

1. **The decision is already made.** No item leaves an implementation agent a choice; §1 states the exact target shape.
2. **Each is classified honestly** — `ADDITIVE`, `COMPATIBLE_REFINEMENT`, or `NON_ADDITIVE_CONTROLLED_CHANGE`. No item is labeled additive if it renames, re-keys, or changes addressability.
3. **It is traceable.** Each maps to a Class A decision (`B4_DECISION_REGISTER.md` §1) and to the frozen frontend evidence that requires it.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied.

## 4. Amendment composition — dependency order

> **Canonical order, binding on this bundle exactly as it was on B2's and B3's: `B0 → B1 → B2 → B3 → B4`, each applied against the *effective* (post-prior-amendment) state of a shared artifact, never against stale pre-amendment text.**

### 4.1 Overlapping-artifact check

| Artifact | Does B2 touch it? | Does B3 touch it? | Does B4 touch it? | Overlap risk |
|---|---|---|---|---|
| `BACKEND_DATA_MODEL.md` | yes (CRM row, item 2 of `B2_CONTROLLED_AMENDMENTS.md`) | yes (Discovery row, `B3-D-B002`) | yes (Intelligence row, item 1 above) | **none** — three disjoint rows of the same table-inventory list, exactly the "different rows, no shared sentence" case `B3_CONTROLLED_AMENDMENTS.md` §6.1 already established for B2/B3's own overlap on this same file |
| `BACKEND_DOMAIN_OWNERSHIP.md` | untouched by B2/B3's bundles | untouched | yes (item 2) | none |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | untouched | yes (`B3-D-B005`, additive Discovery command/events) | yes (item 3) | **none** — B3 added Discovery-scoped entries; B4 adds Intelligence-scoped entries; neither rewrites a shared sentence, both are pure enumeration additions/redefinitions of disjoint items |
| `B1_AUTHORIZATION_RBAC.md` | untouched by B2/B3's *amendment* bundles (B2 reused existing codes) | untouched | yes (item 4) | none — first amendment to this file in the series |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | untouched | touched only by citation (`PUBLIC_ID_COLLISIONS=0` checks, no amendment) | yes (item 5) | none |

**No artifact both B4 and an earlier bundle amend with a textual edit to the same sentence.** Unlike B2/B3's `BACKEND_API_CATALOG.md` collision (which required an explicit composition-order fix), every B4 amendment here targets either an untouched file or a disjoint row of a shared inventory list. `B2_AMENDMENT_REVERSION_PATHS = 0`, `B3_AMENDMENT_REVERSION_PATHS = 0` for this bundle.

### 4.2 What this means for approval

B4's bundle may be approved independently of B2's and B3's, in any order or together — there is no artifact where B4's amendment must be applied *against the effective post-B2/B3 text* the way B3's `BACKEND_API_CATALOG.md` amendment had to be applied against B2's. This is stated as a checked conclusion (§4.1's table), not assumed the way an earlier, since-withdrawn B3 draft once assumed independence and was wrong.

## 5. Blocking rules until the bundle is applied

- **No B4 implementation may proceed** against any target in §1.
- **No frozen file may be edited** to match a target in §1.
- The bundle is approved **as a whole** — partial application would leave, for example, the renamed table without the permission codes needed to reach it.
