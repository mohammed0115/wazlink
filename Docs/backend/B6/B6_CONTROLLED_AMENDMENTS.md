# B6 — Controlled Amendments

> **B6 status:** Target design only. B6 does not edit any frozen file. For every item below: the frozen text, the target text, the classification, and the composition order.

## 1. The bundle — 2 operations, 2 decisions, across 2 frozen artifacts

Following B2/B3/B4/B5's exact counting discipline:

- **`CONTROLLED_AMENDMENT_OPERATION_COUNT = 2`** — the discrete rows below.
- **`CONTROLLED_AMENDMENT_DECISION_COUNT = 2`** — `B6-D-A014` (item 1, reopen), and item 2 itself (the `last_activity_at` qualifying-event addition — a direct consequence of item 1's `DealReopened` event existing at all, no separate top-level decision ID, mirroring how B5's own bundle records consequence-only items).
- **`CONTROLLED_AMENDMENT_TARGET_ARTIFACT_COUNT = 2`** — `BACKEND_STATE_MACHINES.md`, `B2_LEAD_AGGREGATE.md`.

This is the **smallest** amendment bundle of any phase in this corpus so far (B2: unspecified but multi-item; B3: 7 operations/4 decisions/4 artifacts; B4: 5/5/3; B5: 6/5/5) — a direct consequence of frozen B0 having already specified the Pipeline domain's commands, events, tables, RBAC, and DTO shape essentially completely before B6 existed to elaborate it (`B6_EXECUTIVE_SUMMARY.md` §1). There is no `B1_AUTHORIZATION_RBAC.md` amendment at all: `deal.view`/`deal.create`/`deal.update`/`deal.close` are reused verbatim with zero textual edit, and the three new permissions (`deal.assign`, `deal.reopen`, `pipeline.manage`) are additive rows B1's permission catalog can absorb without B6 needing to touch B1's file — the frozen permission catalog's own shape already accommodates a new domain adding rows, so this is not counted as an "amendment" any more than B4 adding `intelligence.view`/`intelligence.run` was treated as one.

| # | ID | Frozen artifact | Current frozen state | B6 target | Classification | Timing |
|---:|---|---|---|---|---|---|
| 1 | `B6-D-A014` | `BACKEND_STATE_MACHINES.md` — Deal transition sketch | *"`[*] --> DealOpen`, `DealOpen --> DealWon`, `DealOpen --> DealLost`"* plus prose: *"Deal transitions permit `open→won` or `open→lost` only with permission and confirmation; Won probability is 100 and Lost is 0."* | add two edges: `DealWon --> DealOpen`, `DealLost --> DealOpen` (via `ReopenDeal`, `deal.reopen`, mandatory reason note); the existing edges and the Won=100/Lost=0 prose are untouched | `ADDITIVE` — extends the diagram with two new edges and one new transition command; no existing edge is removed, renamed, or given different semantics. The frozen prose's "only" qualifies *how a Deal reaches `won`/`lost`* (permission + confirmation), not *whether any further edge may ever exist* — reopening does not change how a Deal becomes won or lost, it adds what happens after | before implementation |
| 2 | — (consequence of item 1) | `B2_LEAD_AGGREGATE.md` §4 — `last_activity_at` qualifying-events table, "Pipeline" row | *"`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost` \| nothing"* | add `DealReopened` to the qualifying column: *"`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened` \| nothing"* | `ADDITIVE` — extends one cell of one row with one new qualifying event name; the frozen "not qualifying" column, every other domain's row, and the entire recovery/skew machinery (`B2_TIMELINE_IDENTITY_MODEL.md` §5) are untouched. `DealAssigned`/`DealUpdated` are deliberately **not** added — evaluated and excluded, `B6_CRM_TIMELINE_PROJECTION.md` §3, not silently omitted | before implementation |

## 2. The items that are not purely additive, stated plainly

**None are `NON_ADDITIVE_CONTROLLED_CHANGE`.** Both items extend an existing list/diagram with a new entry; neither renames, re-keys, removes, or narrows an existing frozen sentence or edge. `UNDECLARED_NON_ADDITIVE_AMENDMENTS = 0`.

## 3. What every item satisfies

1. **The decision is already made.** No item leaves an implementation agent a choice; `B6_DEAL_STATE_MACHINE.md` §2 and `B6_CRM_TIMELINE_PROJECTION.md` §3 state the exact target shape.
2. **Each is classified honestly** — `ADDITIVE` only. No item is labeled additive if it would rename, re-key, or narrow an existing frozen sentence — neither does.
3. **It is traceable.** Item 1 maps to Class A decision `B6-D-A014` and to the task brief's own explicit requirement to design reopen semantics (§`B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D20, honestly recorded as *not* evidenced by the frontend, added anyway on the brief's authority). Item 2 maps to item 1's own consequence.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied.

## 4. Amendment composition — dependency order

> **Canonical order, binding on this bundle exactly as it was on B2's, B3's, B4's, and B5's: `B0 → B1 → B2 → B3 → B4 → B5 → B6`, each applied against the *effective* (post-prior-amendment) state of a shared artifact, never against stale pre-amendment text.**

### 4.1 Overlapping-artifact check

| Artifact | Touched by an earlier bundle? | Does B6 touch it? | Overlap risk |
|---|---|---|---|
| `BACKEND_STATE_MACHINES.md` | untouched by B1–B5's *amendment* bundles (each phase's Deal/Discovery/Message sub-states were elaborated in the phase's own documents, not by amending this shared sketch file) | yes (item 1, Deal sub-diagram only) | **none** — first amendment to this file in the series; item 1 touches only the `DealOpen`/`DealWon`/`DealLost` lines, not Discovery's or Messaging's sketch lines |
| `B2_LEAD_AGGREGATE.md` | untouched by B3/B4/B5's amendment bundles (none of them proposed a `last_activity_at` qualifying-event addition) | yes (item 2, one cell of the Pipeline row only) | **none** — B2 is closed and this is its first post-closure amendment; it touches only the Pipeline row's qualifying-event list, not any other domain's row, not the skew/recovery machinery, not the entry-identity rules |

**No artifact both B6 and an earlier bundle amend with a textual edit to the same sentence.** `B6_AMENDMENT_REVERSION_PATHS = 0` for this bundle.

### 4.2 What this means for approval

B6's bundle may be approved independently of B1's, B2's, B3's, B4's, and B5's, in any order or together — there is no artifact where B6's amendment must be applied *against the effective post-B1–B5 text* the way B3's `BACKEND_API_CATALOG.md` amendment once had to be applied against B2's. This is stated as a checked conclusion (§4.1's table), not assumed.

## 5. Blocking rules until the bundle is applied

- **No B6 implementation may proceed** against `ReopenDeal`/`DealReopened`'s targets in §1 until item 1 is approved — though every *other* B6 command (`CreateDeal` through `AssignDeal`, and every Pipeline/Stage administration command) requires no amendment at all and could in principle be implemented independently of this bundle's approval, since none of them touches frozen text.
- **No frozen file may be edited** to match a target in §1.
- The bundle is approved **as a whole**: partial application (item 1 without item 2) would leave `DealReopened` a real, emittable event that nonetheless silently fails to advance `Lead.last_activity_at`, an inconsistency worth avoiding by approving both items together.
