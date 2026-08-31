# B4 — Command and Event Catalog

> **B4 status:** Target design only. Preserves the frozen B0 event envelope verbatim (§4).

## 1. Frozen commands/events — resolution, stated plainly

| Frozen artifact | Frozen state | B4 target | Classification |
|---|---|---|---|
| `AnalyzeLead` (command) | Lead-keyed, per `BACKEND_COMMAND_EVENT_CATALOG.md` | retained as a thin compatibility alias — accepts `LEAD-*`, resolves `lead.business_id`, delegates to `RequestBusinessIntelligence`'s identical admission path. Creates no Lead-scoped state | `COMPATIBLE_REFINEMENT` |
| `LeadIntelligenceCompleted` (event) | Lead-keyed, per `BACKEND_COMMAND_EVENT_CATALOG.md` | **not emitted.** B4's canonical completion event is `BusinessIntelligenceCompleted` (additive, §3). Emitting under the frozen Lead-presuming name would misstate the resolved subject-ownership model (`B4_INTELLIGENCE_SUBJECT_MODEL.md` §1) | `NON_ADDITIVE_CONTROLLED_CHANGE` — see `B4_CONTROLLED_AMENDMENTS.md` item 3 |
| `LeadIntelligenceAnalysis` (aggregate name, `BACKEND_DOMAIN_OWNERSHIP.md`) | Lead-keyed aggregate name | B4's aggregate is `IntelligenceRun`, `BUS-*`-owned | `NON_ADDITIVE_CONTROLLED_CHANGE` — item 2 |

This mirrors, in spirit, B3's own documented tolerance for a pre-existing B0 naming inconsistency (`RetryDiscoveryJob` vs `RetryDiscovery`) — the difference here is B4's resolution is **active**, not merely observational, because a literal Lead-keyed event is structurally impossible to emit correctly for a pre-Lead Business.

## 2. Commands

| Command | Actor/system | Target | Idempotency | Precondition | Effect |
|---|---|---|---|---|---|
| `RequestBusinessIntelligence` **(additive)** | actor | `[BUS-*]`, 1..20 | `Idempotency-Key` required | workspace scope; admission sequence (`B4_COST_RATE_LIMIT_MODEL.md` §4) | admits or reuses one run per named Business |
| `AnalyzeLead` **(frozen, redefined)** | actor | `LEAD-*` | `Idempotency-Key` required | Lead resolves to a Business in workspace scope | delegates to `RequestBusinessIntelligence(business_id)` |
| `ReanalyzeBusinessIntelligence` **(additive)** | actor | `[BUS-*]`, 1..20 | `Idempotency-Key` required | same admission sequence, **bypasses** the same-input reuse check (`B4_COST_RATE_LIMIT_MODEL.md` §7) — always opens a fresh run | forces a new opinion regardless of whether evidence changed; the frozen frontend's "إعادة محاولة التحليل" (retry-after-error) maps here |
| `CancelIntelligenceRun` **(additive)** | actor | `ANL-*` | `Idempotency-Key` required | run in `queued`/`running`; `version` match (`If-Match`) | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` transition 6 |
| `ExecuteIntelligenceRun` **(internal)** | worker/system | one queued run | — | claimed via lease | dispatches to the `AI Gateway` port; not API surface, mirrors B3's `ExecuteDiscoveryQuery` |

`COMMAND_COUNT = 5` (2 frozen-derived/redefined, 3 additive; 1 of the 5 is internal, not API surface).

## 3. Events

| Event | Payload | Delivery | Idempotency identity |
|---|---|---|---|
| `BusinessIntelligenceCompleted` **(additive)** | `{ run_public_id, business_public_id, lead_public_id (nullable), overall_priority_score (nullable), tier (nullable), confidence, completion_kind, outcome, scoring_model_version, completed_at }` | transactional outbox, frozen B0 pattern | `(run_public_id)` unique |
| `IntelligenceRunFailed` **(additive)** | `{ run_public_id, business_public_id, failure_code, attempt_count, occurred_at }` | transactional outbox | `(run_public_id)` unique |
| `IntelligenceRunCancelled` **(additive)** | `{ run_public_id, business_public_id, cancelled_by, occurred_at }` | transactional outbox | `(run_public_id)` unique |

`EVENT_COUNT = 3` (all additive). `queued`/`running` transitions are **not** published as domain events — they are internal lifecycle detail, observable through `GET /businesses/{id}/intelligence` polling and through metrics (`B4_OBSERVABILITY_RECONCILIATION.md` §1), not through the outbox. This avoids the event-noise the brief's §36 warns against: a consumer that cares about an intelligence run's outcome cares about its terminal state, not its intermediate ticks.

## 4. Consumed events

> **`CONSUMED_EVENT_COUNT = 0`.** B4 subscribes to nothing.

This directly reuses B3's own precedent (`B3-D-A019`: *"Does B3 consume any domain event? No — zero. An inbound domain dependency would create a cycle and require knowledge B3 must not own"*) for an identical reason one layer up the journey: `B4_B3_ACQUISITION_BOUNDARY.md` §5 shows every piece of B4's correctness (freshness, admissibility) is computable from a direct, synchronous read of B3's tables at request time. `BusinessDiscovered`, `BusinessRediscovered`, and `BusinessMerged` all exist and are all informative to a human operator, but none is required for B4 to behave correctly — so none is subscribed to. If automatic/eager triggering is adopted later (`B4-D-C001`), that specific future feature would need a real subscription; it is recorded as a forward dependency, not built now.

## 5. Event envelope

Frozen, verbatim, unchanged:

> *"All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID."*

`EVENT_ENVELOPE_DRIFT_FROM_B0 = 0` — every B4 event above carries exactly this envelope; none adds a field to it.
