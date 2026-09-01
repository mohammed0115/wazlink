# B7 — Implementation Readiness

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification. **This document does not authorize implementation.**

## 1. What must happen before any implementation agent may write B7 code

1. **Fresh** independent CTO verification of this entire pack in its `B7-FIX.1` state. The pack has been independently verified once already; that verification returned nine MAJOR findings, all now remediated, and its result does not carry forward to the remediated pack.
2. CTO approval of all **five** controlled-amendment items (`B7_CONTROLLED_AMENDMENTS.md` — 4 additive, 1 compatible clarification, 0 non-additive). The `AUTO-` promotion, the two B2 consumer-list extensions, the three added `AutomationRun` states, the `AutomationRunCompleted` naming reconciliation, and the two added tables must land in their own frozen files before an implementation agent may treat them as frozen truth.
3. Explicit authorization of the Backend Architecture-to-Coding transition (matching every earlier phase's closure gate) — this pack, on its own, contains no implementation and grants none.

## 2. What is genuinely ready to specify a migration from

`B7_DATA_MODEL.md`'s nine Phase-1 tables, `B7_COMMAND_EVENT_CATALOG.md`'s twelve commands and thirteen events, `B7_API_DTO_CONTRACTS.md`'s nineteen operations, and `B7_FAILURE_CATALOG.md`'s thirty-four failure codes are all specified at column/field/status-enum granularity — no implementation-critical schema decision is left open (task brief §7's explicit demand). Trigger/condition/action storage is resolved explicitly and **without a competing statement anywhere in the pack** as revision-scoped child tables, not JSON (`B7-D-A036`); the nested API DTO is a response shape, not a storage form.

`B7-FIX.2` closed the four remaining places an implementer would otherwise have had to decide for themselves:

| Previously open | Now resolved by |
|---|---|
| Which unique constraint dedups an event-triggered run — four documents disagreed on whether `rule_revision_id` belonged in it, and the constraint three of them cited was never declared | `B7-D-A040`: `uq_automation_runs_event_rule`, `(workspace_id, rule_id, source_event_id)` partial-unique, **declared** in `B7_DATA_MODEL.md` §3 with its exact predicate, revision excluded |
| Whether B12 must build a wakeup sweep — `B7_B12_ASYNC_BOUNDARY.md` §1 required one while `AT-SCHED-3` **NC** forbade it | requirement removed; `B7_B12_ASYNC_BOUNDARY.md` §1 now states B7 needs no timer at all, and `B7_SCHEDULE_DELAY_MODEL.md` is unambiguously Phase-2-only from its own §0 |
| What event reports a `skipped` run | `B7-D-A041`: `AutomationRunSkipped`, with the closed three-value `skip_reason` |
| What `queued_at` means and what queue latency measures | `B7-D-A042`: five distinct ordered timestamps; queue latency is `queued_at`→`started_at` |

An implementer needs no Class-A judgement call to build the schema, the constraints, or the async surface.

**Explicitly out of Phase-1 scope, and not to be built from this pack:** scheduled triggers, the `wait` action, the `waiting` run state, and any wakeup/timer table or sweep (`B7-D-A035`). `B7_SCHEDULE_DELAY_MODEL.md` holds their forward design only, under a §0 banner that lists all six absences and states that everything below it is conditional future guidance.

`B7-FIX.1` claimed this was already true of the whole pack; a fresh independent verification found three live Phase-1 references it had missed — `B7_SCHEDULE_DELAY_MODEL.md` §1's *"Phase-1 supports exactly two shapes"*, `B7_B12_ASYNC_BOUNDARY.md` §1's required wakeup sweep, and `B7_RULE_LIFECYCLE.md` §3's `waiting` runs. **All three are fixed in `B7-FIX.2`**, and the claim is now restated with its evidence rather than asserted: across all 50 documents, every remaining occurrence of `schedul*`/`wait*`/`wakeup*` is one of — a `##0`-banner or conditional-voice statement inside the Phase-2 document, an explicit Phase-1 exclusion, a negative control (`AT-SCHED-1`…`AT-SCHED-3`), the unrelated word `awaiting_approval`, or a `B7-FIX` history line. No catalog entry, enum value, owned table, failure row, metric, B12 requirement, or non-exclusion acceptance test references any of them.

## 3. Explicit non-authorization

No Django model, migration, Celery task, Redis key, API route, or provider integration is written or implied as already-built anywhere in this pack. `IMPLEMENTATION_LEAKAGE = 0` — mechanically checked: no `.py`/`.sql`/`.ts` source file was created or modified by this authoring pass; every file under `Docs/backend/B7/` is a `.md` design document.

## 4. Dependencies on other not-yet-closed work

None. B0-B6 are frozen and closed (`BACKEND_DOCUMENTATION_INDEX.md`); B7 depends on nothing currently open. B8/B9/B12 do not exist yet and B7 depends on none of them for its own Phase-1 closure — every reference to them in this pack is a boundary statement about what B7 does *not* do, never a dependency on their completion (`B7_B8_BILLING_BOUNDARY.md`, `B7_B9_FINANCE_BOUNDARY.md`, `B7_B12_ASYNC_BOUNDARY.md`).

## 5. Readiness checklist

| Gate | Status |
|---|---|
| Frontend evidence gathered and classified | done — `B7_FRONTEND_BEHAVIOR_INVENTORY.md`, 60 behaviors (41 A / 10 B / 3 C / 6 D), mechanically reconciled and independently re-verified against `client/src` |
| Every Class A question resolved | done — 42/42, `B7_DECISION_REGISTER.md` §1 |
| Direct-write firewall proven structurally | done — `B7_DIRECT_WRITE_FIREWALL.md` |
| Revenue firewall proven structurally | done — `B7_REVENUE_FIREWALL.md` |
| Every cross-domain boundary stated | done — 8 boundary documents (B2/B3/B4/B5/B6/B8/B9/B12) |
| Controlled amendments identified and classified | done — 5 (4 additive, 1 compatible clarification, **0 non-additive**), `B7_CONTROLLED_AMENDMENTS.md` |
| Acceptance matrix covers every required negative control | done — 78 negative controls among 141 tests across 38 categories, `B7_ACCEPTANCE_TESTS.md` |
| Reference integrity (AT-*/decision/failure/amendment/frontend/cross-document incl. section level) | self-pass clean under a rebuilt, false-positive-resistant checker; **pending independent mechanical verification** (`B7_VERIFICATION_MATRIX.md` §4) |
| Frozen-truth conformance (B0 commands, events, state machine, approval operation, public IDs, entitlement vocabulary, error codes) | self-pass clean after repairing 6 drifts in the first correction pass and 9 MAJOR findings an independent CTO verification then found; **pending fresh independent verification of the `B7-FIX.1` state** (`B7_VERIFICATION_MATRIX.md` §7, §7a) |
