# B6 — B4 (AI Intelligence) Boundary

> **B6 status:** Target design only. Mirrors `B5-D-A021`'s "recommendation existence ≠ authorization" pattern, applied to the commercial-mutation surface.

## 1. What B4 may inform

B4's `IntelligenceRun`/signal/recommendation surface for a Lead's Business (frozen, closed) may inform, at read time:

- **Deal-creation suggestion** — a recommendation that a Lead is ready to become a commercial opportunity (surfaced to a human via the CRM UI, exactly as `sales-ai.js`'s Copilot simulation already stages a create-deal draft, `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D35).
- **Priority** — informing which open Deals a rep should work first (a UI-layer sort/highlight hint, never a persisted Deal field B4 writes).
- **Probability recommendation** — a suggested starting `Deal.probability` at creation or a note alongside the stage's `default_probability`, never a silent override of the actor-set or stage-seeded value.
- **Next action** — a suggested next step (e.g., "propose a meeting"), presentational only.

## 2. What B4 categorically cannot do

**`B6-D-A025` (Class A, resolved): a B4 recommendation never authorizes or performs a Deal mutation.** No B6 command accepts a B4 run ID, signal ID, or recommendation ID as an authorization input. `CreateDeal`, `UpdateDeal`, `MoveDealStage`, `CloseDealWon`, `CloseDealLost`, `ReopenDeal`, `AssignDeal` each require an authenticated, authorized human actor (or, in the future, B7's identically-governed automation path, `B6_B7_AUTOMATION_BOUNDARY.md`) — never a bare AI-run reference.

This mirrors `B5-D-A021` exactly (*"Recommendation existence ≠ send authorization; AI-drafted text is untrusted until a human submits it through the ordinary path"*), applied to commercial state: AI-suggested probability, priority, or a staged deal-creation draft is untrusted until a human submits it through `CreateDeal`/`UpdateDeal` — the identical governed path every other actor uses.

**Direct frontend corroboration:** `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D34/FB-D35/FB-D36 — Copilot reads Deals as evidence only; its only deal-adjacent action stages an unsubmitted, prefilled create-deal modal a human must still complete; both the Agent's and Automation's forbidden-action lists explicitly block `change_deal_value`, `change_deal_probability`, `close_won_deal`, `close_lost_deal` in every mode, with no exception.

## 3. Negative control

`AT-B4-1 (NC)`: an implementation accepting a B4 run ID as a `CreateDeal`/`MoveDealStage`/`CloseDealWon`/`CloseDealLost` authorization parameter — structurally impossible, no such field exists on any B6 command DTO (`B6_API_DTO_CONTRACTS.md`).

## 4. No B4 write access

B4 has no write path to `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions`, or `deal_loss_reasons`, symmetric to B6 having no write path to `intelligence_runs`/signals (`B6_DOMAIN_OWNERSHIP.md` §6). The relationship is entirely read-only, in both directions, at the data layer.
