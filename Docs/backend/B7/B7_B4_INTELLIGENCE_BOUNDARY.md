# B7 — B4 (AI Intelligence) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 consumes from B4

**Nothing in Phase 1.** `B4_COMMAND_EVENT_CATALOG.md` contains zero mentions of Automation as consumer or actor, and `BusinessIntelligenceCompleted` is not in the frontend's evidenced trigger catalog. Deferred Class B.

## 2. What B7 invokes on B4

Nothing. `request_intelligence_analysis` was evaluated and excluded (`B7_ACTION_CATALOG.md` §4) — the task brief's own conditional ("only if B4 exposes a governed command suitable for automation") is not met; B4's catalog names no actor-invocable command for this purpose.

## 3. AI recommendation never authorizes action — resolved (Class A, restated from `B7-D-A019`)

**A B4/Copilot recommendation does not become permission to act.** The one point of contact between B4 and B7 is the AGA-/RUN- unification (`BACKEND_PUBLIC_ID_REGISTRY.md` §C, FB-A60): when a human explicitly accepts an AI-recommended action, *that human's acceptance* — not the recommendation itself — is what creates a rule-less `AutomationRun` (`B7_EXECUTION_MODEL.md` §4), which then passes through the identical approval/authorization gates as any other run (`B7_ACTION_AUTHORIZATION.md`). B4 retains zero write access to B7's tables and zero ability to directly enqueue an execution; it can only produce a recommendation for a human (or, in principle, an explicitly-authored rule reacting to some future frozen B4 event) to act on.

B7 never modifies `IntelligenceRun` history, never writes to any B4 table, and never reads a B4 recommendation as if it were itself a governed decision.

## 4. Negative control

`AT-B4INT-1` **(NC)**: an implementation where accepting a B4 recommendation directly invokes a target-domain command (e.g. `SendMessage`) without creating and authorizing an `AutomationRun` first — fails; every action, including a recommendation-sourced one, must pass through `B7_ACTION_AUTHORIZATION.md`'s five layers, with no B4-sourced shortcut.
