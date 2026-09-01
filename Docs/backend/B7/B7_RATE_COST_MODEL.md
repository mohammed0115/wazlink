# B7 — Rate / Cost Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. B7 never bypasses target-domain admission

An automation-invoked `SendMessage` is subject to B5's own rate/cost/quota admission identically to a human-invoked one (`B5_B6_B7_BOUNDARIES.md` §2's explicit "no larger or exempted pool," restated in `B7_B5_MESSAGING_BOUNDARY.md` §3). B7 introduces no parallel rate-limit bookkeeping for a target domain's own resource — it relies entirely on the target command's existing admission.

## 2. B7-level technical safety limits — separate from commercial entitlement

| Limit | Value | Scope | Purpose |
|---|---|---|---|
| `MAX_AUTOMATION_DEPTH` | 5 | per lineage (`correlation_id`) | loop prevention, `B7_LOOP_PREVENTION.md` §1 |
| Execution budget | 20 runs per rolling 5 minutes | per lineage (`correlation_id`) | loop prevention, catches wide fan-out |
| Action retry cap | 5 attempts | per action execution | reused verbatim, `BACKEND_RETRY_POLICY.md` |
| Approval self-decision | forbidden below manager rank | per action | `B7_ACTION_AUTHORIZATION.md` §2 |

These are **technical safety invariants**, uniform across every plan tier — never sold, never configurable by a workspace, and never loosened by entitlement (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §5).

## 3. Commercial entitlement limits — deferred to B8

| Control | Phase-1 shape | Numeric value |
|---|---|---|
| `automation.rules` (binary gate) | present/absent | B8-owned |
| `automation.rules.max_active` (active-rule quota) | integer ceiling, checked at `ActivateAutomationRule` | B8-owned, deferred |
| Execution quota (if a plan later caps monthly run count) | not implemented in Phase 1 — no frontend/architecture evidence requires it yet; `runsToday` (FB-D20) is informative-only, not enforced | deferred Class B/C |

B7 defines the shape of every commercial gate it needs (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4) without inventing final numbers B8 has not frozen — matching the task brief's explicit §48 instruction to keep technical and commercial limits separate and to defer numbers safely rather than invent them.

## 4. B7-level abuse controls beyond the technical safety limits

`RunAutomationTest` and `RunAutomationNow` both require `Idempotency-Key` (or, for test, are naturally idempotent since they mutate nothing) — a scripted flood of manual-run requests is bounded by the same workspace-level automation capability check as any other admission (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §2), and by ordinary API-layer rate limiting (`BACKEND_RATE_LIMIT_POLICY.md`, reused unmodified — B7 introduces no bespoke API rate-limit tier).
