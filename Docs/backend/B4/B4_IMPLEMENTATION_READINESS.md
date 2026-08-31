# B4 — Implementation Readiness

> **B4 status:** `DESIGN IN PROGRESS`. **B4 is NOT closed.** Closure requires an independent CTO audit — this document states readiness and shows the evidence; it does not claim closure, exactly as `B3_IMPLEMENTATION_READINESS.md` never claimed it for B3.

## 1. Readiness gates

| Gate | Status | Evidence |
|---|---|---|
| `FRONTEND_TRUTH_ESTABLISHED` | **READY** | 30 AI-adjacent behaviors traced with file:line citations; S4 (in scope) and S8 (explicitly out of scope) separated on record |
| `SUBJECT_OWNERSHIP_READY` | **READY** | resolves both B2's and B3's explicitly-deferred `B2-D-B006`/`B3-D-C011` with direct frontend evidence |
| `DOMAIN_OWNERSHIP_READY` | **READY** | minimum 5-entity model; 2 derived-not-stored fields; explicit non-ownership table |
| `RUN_STATE_MACHINE_READY` | **READY** | 5 states, 7 transitions, partial success as a completion property (not a 6th state), "last good result never lost" proven |
| `INPUT_SNAPSHOT_READY` | **READY** | versioned snapshot, material-fingerprint-based reuse, provider-payload minimization table |
| `SIGNAL_TAXONOMY_READY` | **READY** | 6 categories, per-signal contract, 18-code starter registry, `unknown≠gap` enforced as a schema constraint |
| `EVIDENCE_READY` | **READY** | every claim evidence-backed by construction; raw-payload retention explicitly excluded |
| `SCORING_READY` | **READY** | 5 weighted components (frontend-authoritative), tier thresholds reused verbatim, deterministic/AI boundary a schema-level constraint |
| `CONFIDENCE_READY` | **READY** | independent multi-factor formula; high-score-low-confidence and the reverse both representable |
| `INSUFFICIENT_EVIDENCE_READY` | **READY** | explicit outcome, threshold-gated, zero recommendations |
| `RECOMMENDATION_READY` | **READY** | closed code set, execution explicitly forbidden, mirrors S8's own governance discipline one layer further back |
| `PRESENTATION_ARTIFACTS_READY` | **READY** | non-authoritative, evidence-cited, size-bounded, hallucination-guarded |
| `PROVIDER_BOUNDARY_READY` | **READY** | reuses frozen `AI Gateway` port name; zero vendor-specific domain concept |
| `STRUCTURED_OUTPUT_READY` | **READY** | strict schema, `additionalProperties:false`, no best-effort parse, no free-form mutation |
| `COST_RATE_LIMIT_READY` | **READY** | frozen 60/hour anchor adopted; batch cap (20) and automatic-attempt cap (3) both closed *before* requesting closure, learning the B3 lesson proactively rather than reactively |
| `IDEMPOTENCY_CONCURRENCY_READY` | **READY** | 4 idempotency layers; row-locked, version-compared current-pointer flip; stale-completion-wins attack traced and closed |
| `FRESHNESS_READY` | **READY** | computed, never stored; ranking/automation-trust exclusion vs. plain visibility explicitly distinguished |
| `B3_BOUNDARY_READY` | **READY** | read-only access; zero event subscription required for correctness (`CONSUMED_EVENT_COUNT=0`) |
| `B2_BOUNDARY_READY` | **READY** | live read-through only; conversion triggers nothing |
| `DOWNSTREAM_HANDOFF_READY` | **READY** | B5/B6/B7 contracts stated without designing any of the three; revenue negative invariant structural, not policy-only |
| `API_CONTRACT_READY` | **READY** | 7 operations, each with method, route, permission, DTOs, idempotency, errors |
| `DTO_CONTRACTS_READY` | **READY** | 2 request + 9 response DTOs; a leak-prohibition list |
| `COMMAND_EVENT_READY` | **READY** | 5 commands (2 frozen-derived, 3 additive), 3 events (all additive), 0 consumed |
| `RETRY_FAILURE_READY` | **READY** | full classification table; partial-success split by required-vs-optional component, not a blanket rule |
| `AUTHORIZATION_READY` | **READY** | 2 new permission codes, honestly proposed as an amendment, not silently adopted |
| `TENANCY_READY` | **READY** | every row scoped, 3 documented global-catalogue exceptions, composite cache-key rule stated explicitly |
| `SECURITY_PRIVACY_READY` | **READY** | input minimization table, prohibited-inference list enforced by closed schema, prompt-injection mitigation |
| `DATA_MODEL_READY` | **READY** | 2 core tables + 3 global catalogues, purpose/columns/constraints/retention stated; **no DDL** |
| `OBSERVABILITY_READY` | **READY** | 16 metrics, full auditability chain, explainability surface deliberately smaller than the audit trail, no chain-of-thought storage |
| `FAILURE_SCENARIOS_READY` | **READY** | DF1–DF35 with deterministic outcomes |
| `ACCEPTANCE_TESTS_READY` | **READY** | 26 categories, negative controls for every headline defect the brief names explicitly |
| `DECISION_REGISTER_READY` | **READY** | 32 Class A closed, 12 Class B, 15 Class C |
| `CONTROLLED_AMENDMENTS_READY` | **READY** | 5 operations / 5 decisions across 3 frozen packages; two non-additive items stated plainly; overlap-matrix checked against B2's and B3's own bundles, zero collisions found |
| `B4_CLOSED` | **NOT CLAIMED** | closure requires an independent CTO audit |

## 2. Mechanically recomputed evidence

Every number below is produced by a script over the corpus (§`B4_EXECUTIVE_SUMMARY.md` §5 reproduces the full counter block).

## 3. Frozen-contract safety

| Metric | Method |
|---|---|
| `B0_DRIFT = 0` | no frozen root artifact modified — every citation in this corpus is a read, `B4_CONTROLLED_AMENDMENTS.md` proposes changes without applying them |
| `B1_DRIFT = 0` | `B1_AUTHORIZATION_RBAC.md` unmodified — the two new permission codes are a proposed amendment, not an edit |
| `B2_DRIFT = 0` | no file under `Docs/backend/B2/` modified |
| `B3_DRIFT = 0` | no file under `Docs/backend/B3/` modified |
| `EVENT_ENVELOPE_DRIFT_FROM_B0 = 0` | B4's three additive events all declare the frozen envelope fields and no others |
| `IMPLEMENTATION_LEAKAGE = 0` | scanned for Django/DRF/Celery/migration/real-API-call patterns — zero hits across all 31 documents; no SQL fenced block |
| `UNAUTHORIZED_FILES = 0` | only `Docs/backend/B4/*.md` and the B4 section of `BACKEND_DOCUMENTATION_INDEX.md` are touched |

## 4. Self-adversarial review

Nineteen attacks were run against this design (brief §63's list), each recorded with its outcome.

| # | Attack | Outcome |
|---:|---|---|
| 1 | opaque explainability | **closed.** Full chain from score to provider metadata, `B4_OBSERVABILITY_RECONCILIATION.md` §4; AT-OBS-6 |
| 2 | scoring/confidence conflation | **closed.** Independent formula, `B4_SCORING_MODEL.md` §7; AT-CONF-2/3 |
| 3 | forced score from insufficient evidence | **closed.** Explicit threshold and outcome, AT-INSUFF-6 |
| 4 | Business/Lead ownership ambiguity | **closed.** `B4-D-A001`, resolved with direct frontend citation |
| 5 | stale results silently trusted | **closed.** Computed, marked, excluded from ranking/automation; AT-FRESH-4/8 |
| 6 | run concurrency / stale-completion-wins | **closed.** Row-locked, version-compared pointer flip; AT-IDEM-4/5/7 |
| 7 | unbounded AI cost | **closed.** Frozen 60/hour anchor + 20-item batch cap + 3-attempt automatic bound, all Class A; AT-COST-1…12 |
| 8 | unbounded retry cost | **closed.** Automatic (per-call) vs. actor-admission counters kept distinct, mirroring B3 |
| 9 | automatic-trigger storm | **closed by absence.** No automatic trigger exists in Phase 1 (`B4-D-C001`) |
| 10 | malformed AI output reaching domain truth | **closed.** Strict schema validation, no repair attempt; AT-PROV-2/9/10 |
| 11 | provider hallucination | **closed.** Evidence-reference validation rejects fabricated citations; DF10/DF11 |
| 12 | evidence provenance gaps | **closed.** Full `Evidence` model, traceable to a B3 field or a specific provider call |
| 13 | cross-workspace isolation | **closed.** Composite `(workspace_id, business_id, input_hash)` key stated as a hard rule everywhere reuse/caching appears; AT-TEN-2/5 |
| 14 | provider lock-in | **closed.** Zero vendor-specific domain concept; `AI Gateway` port reused from frozen B0 |
| 15 | B3 dependency direction | **closed, and strengthened.** Not just no write — zero event-subscription dependency for correctness |
| 16 | B2 truth ownership leakage | **closed.** Live read-through only, no denormalization, no conversion-triggered copy |
| 17 | B5/B6/B7 overreach | **closed.** Recommend-only; explicit per-domain negative statements (`B4_DOWNSTREAM_HANDOFFS.md`) |
| 18 | revenue invariant | **closed.** Structural (no write path exists), not merely policy prose |
| 19 | amendment ordering | **closed.** Overlap matrix checked against B2's and B3's actual bundles; zero collisions found (unlike B3's own initial API-catalog collision, which B4's bundle does not repeat) |

### 4.1 Issues found by the review and repaired in this pass

| Found | Repair |
|---|---|
| the frozen frontend's batch "analyze all visible" action has no size cap — the exact class of defect an independent audit found in B3's retry model, but here for admission rather than retry | added `B4-D-A019`, `MAX_BATCH_SIZE_PER_ANALYZE_REQUEST = 20`, closed proactively rather than left for a later fix cycle |
| a cancelled-from-`queued` run's admission slot had no stated release rule, risking an unstated inconsistency with B3's proven cancel asymmetry | added the explicit release/retain rule (`B4_COST_RATE_LIMIT_MODEL.md` §7.1), reasoned to be non-exploitable and consistent with B3's precedent |
| `ReanalyzeBusinessIntelligence` against an already in-flight run had no stated coalescing rule, risking two concurrent runs racing for the same Business and wasting an admission slot | added explicit coalescing onto the in-flight run (`B4_IDEMPOTENCY_CONCURRENCY.md` §3) |

## 5. Known non-blocking observations

| # | Severity | Observation |
|---:|---|---|
| 1 | INFO | Frozen `BACKEND_DOMAIN_OWNERSHIP.md` names the completion event `IntelligenceCompleted` while frozen `BACKEND_COMMAND_EVENT_CATALOG.md` names it `LeadIntelligenceCompleted` — a pre-existing B0 internal naming inconsistency, observed and not amended, exactly as B3 handled `RetryDiscoveryJob`/`RetryDiscovery`. B4 uses neither literally (§`B4_COMMAND_EVENT_CATALOG.md` §1) |
| 2 | INFO | `B4-D-C002` (S8 Copilot/Agent integration) is a real, evidenced future capability, not a hypothetical — the frozen frontend already implements it against a mock `getBusinessIntelligence()` call. A future phase should read `B4_FRONTEND_TRACEABILITY.md` §2 before designing it |
| 3 | INFO | Nine `B4-X-*` external-validation items must be resolved before **implementation**, not before design closure |
| 4 | INFO | `B4-D-C006` (cross-workspace caching) is recorded as explicitly *considered and rejected*, not merely unconsidered — included in the register so a future reader does not mistake its absence from Class A for an oversight |
| 5 | INFO | `B4_IMPLEMENTATION_READINESS.md`'s own authoring party is the same party that produced the design being reviewed in §4. **This is not independent verification.** Every gate above reading `READY` states evidence; it does not substitute for the fresh independent CTO countersignature B4 requires before it may be considered closed — the identical caveat B2 and B3 each carried into their own first closure attempts |

## 6. What an implementation agent still cannot do

Until the amendment bundle (`B4_CONTROLLED_AMENDMENTS.md`) is approved and applied, no agent may create the `intelligence_runs` table, serve any `/intelligence/*` or `/businesses/{id}/intelligence*` route, add the `intelligence.view`/`intelligence.run` permission codes, or promote `ANL-*` to registry §A.

Independently of the bundle, **B4 grants no implementation authorization at all.** It is design documentation.

## 7. B5 readiness

`B4_AI_INTELLIGENCE_DESIGN_READINESS` in `B3_B4_HANDOFF_CONTRACT.md` is now answered: B4 inherits exactly what B3 promised (§1 of this document traces every guarantee to its use) and needs nothing B3 did not already provide. `B5_READINESS = BLOCKED pending independent B4 closure` — the same posture B4 itself was in relative to B3 one phase ago.
