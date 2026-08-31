# B2 — Implementation Readiness and Consistency Evidence

> **B2 status:** Design complete (**B2-FIX.4**), **uncommitted**, pending a fresh independent CTO countersign. **No implementation was performed.**
>
> Every gate and metric below was **re-derived at B2-FIX.4 by direct parse of the documents**, not inherited from any prior evidence. The post-FIX.3 adversarial audit falsified two claims that a previous pass had asserted as re-derived; both are corrected below and neither is restated on trust. Where a prior claim did not survive re-derivation it is withdrawn in place and the replacement is named.

**B1 published baseline:** `062975e3e6aa6ee314097a9a457f6383ebd56557` (verified `HEAD == origin/main`, worktree clean, before and after).
**B0 baseline:** `261ec27f84f337be0d9318141de260c8b9058a6b` (frozen, closed).
**Frozen frontend:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` (unmodified).

Every metric below is **recomputed from the documents by direct parse**. None is carried forward or assumed.

## 1. Readiness gates

| Gate | Result | Evidence |
|---|---|---|
| `CRM_DOMAIN_MODEL_READY` | **READY** | 5 aggregates, 18 invariants (15 required + 3 added from evidence), the canonical journey with per-hop ownership proved, and an explicit list of what CRM does not own |
| `DOMAIN_OWNERSHIP_READY` | **READY** | one durable owner for all 30 CRM facts; boundaries against 7 domains; a closed set of **9** consumed contracts, each with its own effect and forbidden effects named — the earlier "purely to maintain `last_activity_at`" summary is corrected in `B2_COMMAND_EVENT_CATALOG.md` §4 and `B2_DOMAIN_OWNERSHIP.md` §4 |
| `LEAD_MODEL_READY` | **READY** | full logical schema, constraints, indexes; an explicit *absent-fields* list with a reason per field; every field classified across 6 classes |
| `PROVENANCE_MODEL_READY` | **READY** (B2-FIX.1) | immutable `lead_provenance` snapshot with a narrow, justified scope; additional-jobs table **with a named deterministic writer** (`RecordLeadRediscoveryProvenance`, `B2-D-A024`) covering guard order, transaction boundary, idempotency, concurrency, replay, archive, merge, and cross-workspace injection; `BusinessMerged` behavior with a deterministic survivor rule |
| `DUPLICATE_PREVENTION_READY` | **READY** | partial unique index; all 7 duplicate questions answered explicitly; 13 conversion stress tests including lost-response retry |
| `CONTACT_MODEL_READY` | **READY** | M:N via B0's frozen `lead_contacts`; primary-link partial unique; 8 resolved questions; CRM-INV-18 forbidding PII identity keys |
| `TASK_MODEL_READY` | **READY** | 3 states, 5 commands, `overdue` proved derived, automation origin, `next_activity_at` index |
| `APPOINTMENT_MODEL_READY` | **READY** | separate aggregate with a stated justification, 4 states, 5 commands, non-blocking overlap, no calendar provider |
| `NOTE_MODEL_READY` | **READY** | aggregate with a reasoned rejection of the activity-row alternative; append-only + soft-remove; `NOTE-` proposed, never minted |
| `ACTIVITY_TIMELINE_READY` | **READY** (B2-FIX.2) | HYBRID authority under the locked `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE`; append-only `crm_activities` with a closed 21-type vocabulary (canonical in `B2_CRM_ACTIVITY_VOCABULARY.md`); **exactly three source classes** (`crm`, `messaging`, `pipeline`) with Task/Appointment/Note reaching the timeline only through their `ACT-*` activity; the ten-step retrieval algorithm of `B2_TIMELINE_IDENTITY_MODEL.md` §7.2 as the sole site of scope, authorization, eligibility, construction, dedup, ordering, cursor and paging; entry contract, per-source authorization, PII rule |
| `ACTIVITY_VOCABULARY_READY` | **READY** (B2-FIX.1) | 21 canonical types, one spelling each; every one of 22 commands maps to exactly one activity type or is listed **NO TIMELINE ACTIVITY ROW** with a reason; every event mapped; `COMMAND_ACTIVITY_DRIFT = 0`, `EVENT_ACTIVITY_DRIFT = 0`; `B2-D-A023` |
| `REDISCOVERY_PROVENANCE_READY` | **READY** (B2-FIX.1) | `RecordLeadRediscoveryProvenance` deterministic end to end; 4 ordered guards, single-transaction boundary, Read Committed sufficiency argued, unique-constraint idempotency, malformed-payload dead-letter policy; only the **producer's event name** is aligned in B3, and no CRM behavior depends on it |
| `TIMELINE_IDENTITY_READY` | **READY** (B2-FIX.2) | two structurally disjoint entry-identity shapes, disjointness proved from the registry's **case-sensitive registered uppercase prefixes** rather than an unsupported character-set grammar; no aggregate ID as identity — it is carried separately as `source_resource_ref`; no new prefix minted; `occurred_at` the immutable business instant; total order `(occurred_at DESC, entry_id DESC)` tie-free over two immutable components; cursor is an opaque encoding of that pair; one logical event → one entry, deduplicated at read time on `(source_domain, source_event_id)`; the **wire DTO now carries the identity model verbatim**; `B2-D-A025` |
| `LAST_NEXT_ACTIVITY_READY` | **READY** (**re-derived at B2-FIX.4**, not inherited) | Order safety is `GREATEST()` **alone**: no aggregate-version, delivery-position, or arrival-order comparison may discard an eligible qualifying event (AT-TL-SKEW-10). | `last_activity_at` monotonic over a closed qualifying set with out-of-order safety, **protected from future-dated poisoning** by the consumer evaluation of the bounded-skew rule (`B2-D-A026` §5.2/§5.4) **and now guaranteed to recover from a future-skew rejection** by `B2-D-A027` §5.5: three canonical processing states, an explicit acknowledgement contract, a bounded retry, an alerted dead-letter, and an idempotent identity-preserving replay. The prior READY rested on redelivery-driven recovery, which at-least-once delivery does not guarantee after an ack; that claim is withdrawn and replaced. Divergence between the timeline and the column is bounded to `RETRY_PENDING`/`DEAD_LETTERED` and stated rather than hidden; `next_activity_at` single-authority and transactionally maintained |
| `CONTACTED_MODEL_READY` | **READY** | proved to be a `status` value; three candidate fields explicitly `NOT_SUPPORTED`; non-qualifying events named |
| `OWNER_MODEL_READY` | **READY** | Membership-based (CRM-INV-16); full lifecycle table for suspended/removed/role-change/workspace states; no auto-reassignment, with the reason |
| `LEAD360_READY` | **READY** | frozen schema honored with one additive field; per-section authority; `revenue_refs` identities-only; degraded-section rule |
| `CRM_LIST_READY` | **READY** | 9 filters, 1 search, 6 sorts, every sort key made total; cursor invalidation rules; read model with stated refresh semantics |
| `STATE_MACHINES_READY` | **READY** | 5 machines; every (state, command) pair total; 22 of 22 commands mapped; §6's cross-aggregate effects now name the canonical 21-type vocabulary and the two commands that write no activity row |
| `CONCURRENCY_READY` | **READY** | 20 races each with mechanism, winner, loser, status, event count; no Redis in any decision |
| `IDEMPOTENCY_READY` | **READY** | every command classified REQUIRED/RECOMMENDED/NOT_REQUIRED; header-only transport; **no** body-level idempotency field |
| `API_CONTRACT_READY` | **READY** | 28 operations (3 frozen + 25 additive), each with method, route, permission, DTOs, error set, idempotency, concurrency, audit |
| `DTO_CONTRACT_READY` | **READY** | 13 request + 15 response DTOs; per-field type/required/nullable/server-generated/writable/immutable; explicit never-writable list; **0 undefined DTOs** |
| `ERROR_CONTRACT_READY` | **READY** | 16 reused codes all verified present in B0/B1; **0 new codes**; 8 new `CONFLICT` reasons; 9 proposals rejected as duplicates; 22 scenarios given deterministic outcomes |
| `AUTHORIZATION_READY` | **READY** | B1 pipeline reused verbatim; 9 CRM permissions, 8 already in B1; the one new code justified and registered as an amendment |
| `ENTITLEMENT_BOUNDARY_READY` | **READY** | three authorities separated; `crm.core`/`leads` contact point fully specified; quota consumed before durable mutation; what is *not* gated is stated |
| `PRIVACY_AUDIT_READY` | **READY** | full classification; 7 CP rules; the 5-location CRM PII inventory; 24 audit actions; 0 permission/audit namespace collisions |
| `FAILURE_SCENARIOS_READY` | **READY** | CF1–CF24, each with precondition, request, authorization path, status, mutation, event, audit, and disclosure |
| `ACCEPTANCE_TESTS_READY` | **READY** (B2-FIX.4.1) | **281** deterministic criteria across **41** categories, 0 duplicates; every one of the **27** Class A decisions covered, `B2-D-A027` by AT-TL-SKEW-6…10 for `last_activity_at` and by **AT-DUP-5J** for the rediscovery-provenance consumer; AT-TL-1 and AT-TL-ID-10 satisfiable by one fixture in one execution |
| `FRONTEND_TRACEABILITY_READY` | **READY** | 34 traced behaviors → owner → operation → DTO → permission → test; 6 compatibility guarantees; 4 semantic corrections named |
| `CONTROLLED_AMENDMENTS_READY` | **READY** (B2-FIX.2) | **11 items, unchanged** — B2-FIX.2 added none, and reverted the accidental B0 event-envelope drift rather than registering a 12th item (§7); frozen-behavior-vs-target stated per item; an explicit *not amended* list; blocking rules; the B1 bundle dependency recorded; the revised `TimelineEntry` target and the single B3 alignment obligation in §6 |

| `CROSS_DOMAIN_TIMELINE_READY` | **READY** (B2-FIX.2) | `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE` locked; CRM persists **no** cross-domain projection table, dedup store, or quarantine store; the source contract (`B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1) states exactly what a source domain must expose and what CRM must never synthesize; skew is a read-path eligibility filter that self-heals; a source that cannot expose a stable `source_event_id` is excluded wholesale |

| `LAST_ACTIVITY_RECOVERY_READY` | **READY** (**re-derived at B2-FIX.4**) | **`processing_reference_time` is sampled afresh at the start of every processing attempt** (`B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1), so the automatic-retry path is reachable by construction rather than by assumption — the FIX.3 text left this to an `ingested_at` reading under which no retry could ever succeed. | `B2-D-A027` / `B2_TIMELINE_IDENTITY_MODEL.md` §5.5: a future-skew rejection is a `RETRYABLE_CLOCK_SKEW` processing failure that is never acknowledged as successful; exactly three processing states (`ELIGIBLE`, `RETRY_PENDING`, `DEAD_LETTERED`) with one deterministic disposition each; the retry bound binds to frozen B0 `BACKEND_RETRY_POLICY.md` with no new numbers frozen and no amendment required; dead-letter semantics are stated as a capability contract (original `event_id`, `reason = CLOCK_SKEW`, workspace and source/aggregate references preserved, `occurred_at` unclamped, alerted); replay re-enters the same eligibility rule, preserves identity, synthesizes no business event, writes no timeline entry, and is idempotent. **No CRM quarantine aggregate is introduced**; the mechanism is a recorded forward dependency on **B12 — Async & Integration Platform** |

**All 33 gates READY.** `LAST_ACTIVITY_RECOVERY_READY`, `LAST_NEXT_ACTIVITY_READY` and `ACCEPTANCE_TESTS_READY` were re-derived at B2-FIX.4 rather than inherited, after a post-FIX.3 adversarial audit falsified two previously-asserted metrics.

## 2. Consistency-validation metrics (recomputed)

| Check | Metric | Result |
|---|---|---|
| Documents in package | **26** (23 + 3 new: CRM_ACTIVITY_VOCABULARY, REDISCOVERY_PROVENANCE_PROCESS, TIMELINE_IDENTITY_MODEL) | — |
| Non-`.md` files in the package | **0** | **PASS** |
| `FRONTEND_CRM_BEHAVIORS_FOUND` | **78** | — |
| `BASELINE_GAPS_FOUND` | **28** (22 proved, 6 rejected) | — |
| `CRM_AGGREGATE_COUNT` | **5** | — |
| `LEAD_STATE_COUNT` / `TASK_STATE_COUNT` / `APPOINTMENT_STATE_COUNT` | **5 / 3 / 4** | — |
| Lead states identical in all documents that enumerate them | 4 documents, one list | **PASS** |
| Lead states match frozen `leadStatusLabels` | verbatim | **PASS** |
| Appointment states/types/locations match frozen label maps | verbatim | **PASS** |
| `CRM_ACTIVITY_TYPE_COUNT` | **21** (canonical vocabulary from `B2_CRM_ACTIVITY_VOCABULARY.md`) | — |
| `ACTIVITY_VOCABULARY_DRIFT` | **0** | **PASS** |
| `COMMAND_ACTIVITY_DRIFT` | **0** (22 of 22 commands mapped) | **PASS** |
| `EVENT_ACTIVITY_DRIFT` | **0** (29 activity-bearing contracts enumerated: 22 CRM-emitted events mapped + 7 cross-domain, of which only `BusinessMerged` writes an activity) | **PASS** |
| `PROVENANCE_WRITER_DEFINED` | **PASS** (`RecordLeadRediscoveryProvenance`: 4 ordered guards, transaction boundary, idempotency, concurrency, replay, archive, merge, cross-workspace, poison policy) | **PASS** |
| `TIMELINE_ENTRY_IDENTITY` | **PASS** (two structurally disjoint shapes, disjointness proved from case-sensitive registered uppercase prefixes vs the lowercase `source_domain` token; no aggregate public ID is ever an `entry_id`; no new namespace minted) | **PASS** |
| `TIMELINE_TOTAL_ORDER` | **PASS** (`(occurred_at DESC, entry_id DESC)` is total and deterministic) | **PASS** |
| `TIMELINE_CURSOR_STABILITY` | **PASS** (opaque encoding of order tuple, stable across insertions) | **PASS** |
| `TIMELINE_DEDUPLICATION` | **PASS** (one logical event → one entry; CRM-owned events appear once as `ACT-*` and are never re-projected from `tasks`/`appointments`/`notes`; cross-domain candidates collapse on `(source_domain, source_event_id)` at step 6 of the read algorithm and are never copied into `crm_activities`. **No CRM cross-domain dedup store exists**) | **PASS** |
| `CROSS_DOMAIN_READ_TIME_MERGE` | **PASS** (no CRM cross-domain projection, dedup, or quarantine store; every cross-domain guarantee produced by steps 4–6 of `B2_TIMELINE_IDENTITY_MODEL.md` §7.2 on every request; verified by AT-TL-10, AT-TL-MERGE-1…3) | **PASS** |
| `TIMELINE_DTO_IDENTITY_DRIFT` | **0** (the `TimelineEntry` field list in `B2_API_DTO_CONTRACTS.md` §3 carries `entry_id`, `source_domain`, `source_event_id`, `source_resource_ref`, `source_event_type`; the phrase "the source record's public ID" survives only as an explicit negation; the `kind` and `source_type` aliases are gone corpus-wide) | **PASS** |
| `TIMELINE_SOURCE_MODEL_DRIFT` | **0** (`tasks`, `appointments`, `notes` appear in no merge-source list; three `source_domain` values, three source classes, every one reachable) | **PASS** |
| `TIMELINE_ACCEPTANCE_CONTRADICTIONS` | **0** (AT-TL-1 asserts only reachable source classes and shares a fixture with AT-TL-ID-10; AT-TL-ID-5, AT-TL-SKEW-1 and AT-TL-SKEW-4 assert against the read algorithm and name no persisted CRM store; AT-TL-ID-7 asserts the case-sensitive prefix rule, not a `":"` grammar) | **PASS** |
| `EVENT_ENVELOPE_DRIFT_FROM_B0` | **0** (**corrected at B2-FIX.4 — this metric was previously false.** §0 of `B2_COMMAND_EVENT_CATALOG.md` quoted B0's envelope correctly, but §3 rule 7 still asserted "aggregate version is on every event" and claimed a B2 contract depended on it, contradicting both §0 and `B2_CONTROLLED_AMENDMENTS.md` §7's reverted-drift statement. FIX.2's revert was incomplete; rule 7 is now replaced by the `GREATEST()`-only order model. Re-verified by parse: no B2 normative contract requires `aggregate version`, and no causation identifier appears; `crm_activities` carries `correlation_id`/`request_id`, both B0-defined) | **PASS** |
| `CLOCK_SKEW_RETRY_CLASSIFICATION` | **PASS** (B2 decides normatively that `CLOCK_SKEW` is a **retryable transient** condition, §5.5.3 — frozen B0 names no clock-skew row, and B2 does not claim it does; B2 owns the classification, B0 supplies generic transient-retry mechanics, B12 supplies the scheduler. No implementer chooses between "Validation/no retry" and "transient/retry") | **PASS** |
| `CLOCK_SKEW_POLICY_DEFINED` | **PASS** (**wording corrected at B2-FIX.4.1**) (`B2-D-A026`: one source-independent tolerance, one comparison, **two evaluation points** — a self-healing read-path eligibility filter re-evaluated on every request for the timeline, and a **per-processing-attempt** eligibility evaluation at each persisting consumer, each against a `processing_reference_time` sampled afresh at the start of that attempt (§5.2.1). The earlier phrase "an ingestion check" was stale FIX.3 residue and is withdrawn: nothing is decided once at ingestion. `occurred_at` never clamped or rewritten; no CRM quarantine store) | **PASS** |
| `LAST_ACTIVITY_RECOVERY_MODEL` | **PASS** (`B2-D-A027` / §5.5: recovery is caused by the consumer contract, not assumed from source redelivery; two terminating recovery paths, both re-entering the same §5.2 rule with the original identity **against a freshly sampled `processing_reference_time`**) | **PASS** |
| `PROCESSING_REFERENCE_TIME_MODEL` | **PASS** (§5.2.1 defines one canonical clock sampled at the start of each attempt, and enumerates six things it is **not** — `occurred_at`, any source timestamp, the first-receipt stamp, an immutable `ingested_at`/`recorded_at`, the previous attempt's value, any client clock; §5.2.3 separates ingestion metadata from the eligibility clock. **At B2-FIX.4.1 this model is bound corpus-wide**: `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.5 delegates to it rather than naming a second clock, so exactly one clock model exists in B2) | **PASS** |
| `STALE_REFERENCE_TIME_PATHS` | **0** (**re-derived at B2-FIX.4.1 across every persisting consumer, not only the `last_activity_at` one.** The previous `0` was false: `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.5 still compared `discovered_at` against "the ingestion instant" — a first-receipt stamp §5.2.1 forbids — which FIX.4 did not sweep. §2.5 now delegates to the canonical §5.2.1 clock and defines none of its own. Both consumers — `last_activity_at` and `RecordLeadRediscoveryProvenance` — sample a fresh `processing_reference_time` per attempt; no statement anywhere evaluates eligibility once, at ingestion, or against a cached clock. AT-TL-SKEW-7 and AT-DUP-5J each carry an explicit negative control that fails an implementation reusing attempt 1's clock) | **PASS** |
| `AUTOMATIC_RETRY_RECOVERY_PATH` | **PASS** (§5.2.2 worked example and §5.5.5 Path A: because only the clock advances and the event is immutable, the comparison is strictly easier on every later attempt, so Path A is reachable with no source mutation, no new `event_id`, and no operator action) | **PASS** |
| `AGGREGATE_VERSION_DISCARD_PATHS` | **0** (`B2_COMMAND_EVENT_CATALOG.md` §3 rule 7 now forbids discarding on aggregate version, delivery position, or arrival order; restated in `B2_LEAD_AGGREGATE.md` §4 and `B2_DOMAIN_OWNERSHIP.md` §4; AT-TL-SKEW-9 and AT-TL-SKEW-10 assert it) | **PASS** |
| `OUT_OF_ORDER_GREATEST_MODEL` | **PASS** (`GREATEST()` is order-independent by construction; it is named as the sole mechanism, with the version-comparison alternative explicitly prohibited rather than merely unused) | **PASS** |
| `CLOCK_SKEW_CONSUMER_DISPOSITION` | **PASS** (exactly three states, §5.5.1; one disposition each, §5.5.2; a future-skew rejection is a processing failure, never a processed event) | **PASS** |
| `BOUNDED_RETRY_CONTRACT` | **PASS** (§5.5.3: finite attempts and/or finite retry age, increasing backoff, stable event identity across attempts, at most one effect on `last_activity_at`, a terminal state on exhaustion; bound inherited from frozen B0 `BACKEND_RETRY_POLICY.md`, no production number re-frozen by B2) | **PASS** |
| `DEAD_LETTER_REPLAY_CONTRACT` | **PASS** (§5.5.4/§5.5.5: original `event_id`, `reason = CLOCK_SKEW`, workspace and source/aggregate context preserved, `occurred_at` unclamped, alerted and operator-visible; replay re-evaluates the same rule, keeps the same logical identity, synthesizes no business event, creates no timeline entry, and is idempotent) | **PASS** |
| `PERMANENT_UNDERCOUNT_PATHS` | **0** (**re-derived at B2-FIX.4.1 over both persisting consumers.** Every delivery ends applied, retryable-with-a-further-attempt-guaranteed, or dead-lettered-with-a-replay-path; verified by AT-TL-SKEW-6…9 for `last_activity_at` and by AT-DUP-5J for `lead_provenance_additional_jobs`) | **PASS** |
| `PERMANENT_PROVENANCE_UNDERCOUNT_PATHS` | **0** (**new at B2-FIX.4.1.** The path "future rediscovery event → skew-rejected → retried forever against the first ingestion instant → never eligible → provenance row permanently absent" is closed: §2.5 now samples a fresh clock per attempt, so the comparison is strictly easier on every later attempt and recovery is reachable by construction. AT-DUP-5J is the regression guard) | **PASS** |
| `REDISCOVERY_PROVENANCE_CLOCK_MODEL` | **PASS** (**new at B2-FIX.4.1.** `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.5 states `discovered_at ≤ processing_reference_time_N + CLOCK_SKEW_TOLERANCE` and **delegates** the clock to `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 — it defines no alternative clock and re-forbids the same six substitutes plus `discovered_at` itself) | **PASS** |
| `REDISCOVERY_PROVENANCE_RECOVERY_MODEL` | **PASS** (**new at B2-FIX.4.1.** Ineligible → `RETRYABLE_CLOCK_SKEW`, no row written, not acknowledged; bounded retry per §5.5.3; `DEAD_LETTERED` with `reason = CLOCK_SKEW` and preserved identity on exhaustion; replay re-enters the same rule with its own fresh sample and never overrides it; idempotency unchanged — the unique `(lead_id, discovery_job_public_id)` constraint of §2.3 absorbs duplicates) | **PASS** |
| `ACK_SEMANTICS_AMBIGUITY` | **0** (§5.5.2 fixes one contract per outcome; ack-and-drop, silent ignore, and clamping-to-force-eligibility are named and prohibited, so no implementation agent chooses) | **PASS** |
| `UNBOUNDED_RETRY_PATHS` | **0** (§5.5.3 requires a finite bound and increasing backoff; an infinite NACK loop and a fixed-interval hot loop are both prohibited; AT-TL-SKEW-7 and AT-TL-SKEW-9 assert it) | **PASS** |
| `CRM_QUARANTINE_STORE_REINTRODUCED` | **0** (the three processing states are async-platform state; no CRM table, aggregate, column, DTO, or API response exposes them — AT-TL-SKEW-9) | **PASS** |
| `CONSUMED_EVENT_COUNT` | **9** (6 activity-date only · `BusinessMerged` · `LeadIntelligenceCompleted` no-op · `BusinessRediscoveredSignal`) | **PASS** |
| `INBOUND_PROCESS_COUNT` | **1** (`RecordLeadRediscoveryProvenance`; emits nothing, so `COMMAND_COUNT` and `EVENT_COUNT` are unchanged) | **PASS** |
| `CRM_PERMISSION_COUNT` | **9** | — |
| `UNMAPPED_PERMISSIONS` (declared, never used on an operation) | **0** | **PASS** |
| `UNKNOWN_PERMISSIONS` (used, never declared) | **0** | **PASS** |
| Permissions that are new to B1 | **1** (`lead.archive`), registered as `B2-D-B004` | — |
| Permission ↔ audit-action namespace collisions | **0** | **PASS** |
| `API_OPERATION_COUNT` / frozen / additive | **28 / 3 / 25** | **PASS** |
| Duplicate (method, path) pairs | **0** | **PASS** |
| `REQUEST_DTO_COUNT` (10 B2 + 3 reused) | **13** | — |
| `RESPONSE_DTO_COUNT` (13 B2 + 2 frozen) | **15** | — |
| `UNDEFINED_REQUEST_DTOS` | **0** | **PASS** |
| `UNDEFINED_RESPONSE_DTOS` | **0** | **PASS** |
| `API_DTO_DRIFT` | **0** | **PASS** |
| `COMMAND_COUNT` / unique / duplicates | **22 / 22 / 0** | **PASS** |
| `EVENT_COUNT` / unique / duplicates | **22 / 22 / 0** | **PASS** |
| Events emitted by a command but not defined | **0** | **PASS** |
| Events defined but never emitted | **0** | **PASS** |
| Commands absent from every state machine | **0** | **PASS** |
| `UNMAPPED_STATE_COMMANDS` | **0** | **PASS** |
| `STATE_EVENT_DRIFT` | **0** | **PASS** |
| `ERROR_REUSED_COUNT` | **16** | — |
| Reused codes absent from `BACKEND_ERROR_CATALOG.md` **and** B1's new set | **0** | **PASS** |
| `ERROR_NEW_COUNT` | **0** | **PASS** |
| `ERROR_COLLISIONS` | **0** | **PASS** |
| `ERROR_SEMANTIC_DUPLICATES` | **0** | **PASS** |
| New `409 CONFLICT` reasons | **8**, registered as `B2-D-B011` | — |
| Rejected-as-duplicate proposals | **9** | — |
| `FAILURE_SCENARIO_COUNT` | **24** (CF1–CF24, contiguous) | **PASS** |
| `CLASS_A_COUNT` / `CLASS_B_COUNT` / `CLASS_C_COUNT` | **27 / 11 / 19** (B2-FIX.3 adds `B2-D-A027`; `B2-D-C019` was **retargeted, not added** — its stale "quarantine store" wording now names the B12-owned dead-letter surface, so `CLASS_C_COUNT` is unchanged) | **PASS** |
| `ACCEPTANCE_TEST_COUNT` / unique / categories | **281 / 281 / 41** (279 before B2-FIX.4; `AT-TL-SKEW-6…9` **rewritten in place** and `AT-TL-SKEW-10` added at FIX.4 as the recovered-event-not-discarded regression; **B2-FIX.4.1 adds `AT-DUP-5J`** as the rediscovery-provenance skew-recovery regression, inside the existing `DUP` category, so +1 and no new category. The previous count is **not** artificially preserved. Re-enumerated by parsing every `| AT-*` row, not carried forward) | **PASS** |
| `DUPLICATE_ACCEPTANCE_TESTS` | **0** | **PASS** |
| `AT-` IDs referenced elsewhere but undefined | **0** | **PASS** |
| `B2-D-*` IDs referenced but undefined | **0** | **PASS** |
| Broken cross-document references | **0** | **PASS** |
| Class A decisions closed | **27** | — |
| `CLASS_A_UNRESOLVED` | **0** | **PASS** |
| `CLASS_B_UNRESOLVED` / `CLASS_C_UNRESOLVED` | **11 / 19** | — |

### 2.1 Validation methodology

Metrics were **not** verified by searching for expected strings. For each closure metric, definitions and references were enumerated independently from their source documents and the two sets compared:

- **DTOs** — response DTOs enumerated from `###` headings plus the list-envelope table in `B2_API_DTO_CONTRACTS.md` §3; request DTOs from the §4 table; references extracted from the Request and Response columns of the §2 operation tables; the difference taken. Frozen B0/B1 DTOs were allow-listed separately so a frozen name could not mask a missing B2 definition.
- **Permissions** — declared set parsed from the `CRM_PERMISSION_COUNT` sentence; used set parsed from the P column of every operation table **and** the per-operation permission table; the symmetric difference taken in both directions. B1-owned non-CRM codes (`crm.core`, `crm.export`, `lead.create`, `conversation.view`, `deal.view`) were separated rather than ignored.
- **Permission/audit collisions** — the 9 permissions were intersected with the 24 audit actions parsed from `B2_PRIVACY_AUDIT_MODEL.md` §3. A naive permission-shaped regex over the whole package initially reported 16 "unknown permissions"; every one turned out to be a past-participle **audit action** or ordinary prose (`business.name`, `task.when`). That is the B1 namespace rule doing its job, and the check was tightened to positional parsing rather than pattern matching.
- **Commands and events** — parsed from the first column of the two catalog tables; the emitted set parsed from the command table's Emits column; both differences taken; every command was then checked for a labelled appearance in `B2_STATE_MACHINES.md`.
- **Errors** — reused codes parsed from the §1 table rows, then checked for presence in the actual frozen `BACKEND_ERROR_CATALOG.md` and B1's §4.2 table. Every uppercase error-shaped token anywhere in the package was extracted and reconciled against the reused set; all residuals were the nine explicitly-rejected proposals, two B1 rejected codes cited by name, and two frozen-frontend constants.
- **Acceptance IDs** — parsed from the first table column, counted, deduplicated, grouped by category; IDs referenced in other documents were checked against the defined set.
- **Frozen-contract claims** — `BACKEND_OPENAPI_V1.yaml` was parsed as JSON and the `Lead`, `Lead360`, `LeadUpdate`, `ConvertBusinessRequest`, `Business`, `PageInfo` schemas, the three CRM paths, the `IdempotencyKey` parameter, and the absence of a `/leads` collection were all read directly rather than quoted from a prior document.

Two counting artifacts were found and corrected during validation: an initial regex missed `VALIDATION_ERROR` (its HTTP cell reads `400/422`, not three digits), understating the reused-error count as 15; and `Lead360` has no `###` heading because it is frozen, understating the response-DTO count as 14. Both were recounted positionally and are reported here as 16 and 15.

## 3. B0 and B1 invariant preservation

| Invariant | Preserved | Where |
|---|---|---|
| Modular Django monolith / DRF / `/api/v1/` | ✔ | every route under `/api/v1/` |
| PostgreSQL authoritative; Redis never canonical | ✔ | all 20 races; the `leads` quota is a locked `usage_counters` row |
| UUIDv7 + prefixed public IDs (ADR-006) | ✔ | `LEAD-`/`CON-`/`TSK-`/`APT-`/`ACT-` registered; `NOTE-` proposed, never minted |
| Workspace = tenant boundary | ✔ | CRM-INV-1; every CRM table carries `workspace_id` |
| Deny by default; scope before object lookup | ✔ | B1 pipeline reused; Doctrines R-1…R-4 applied to every CRM relationship |
| Integer `version`, `409` on stale write (ADR-010) | ✔ | every mutable CRM resource; C4–C11 |
| Idempotency doctrine (single system, header transport) | ✔ | no request DTO carries an idempotency field |
| Outbox/inbox (ADR-005); no provider call in a transaction | ✔ | catalog §3.4, §3.6 |
| Immutable audit, no secrets | ✔ | `crm_activities` and `audit_logs` both append-only; CP-1…CP-3 |
| Six roles; matrix cells unchanged | ✔ | one **added** row; zero modified cells |
| Business→Lead explicit and idempotent; viewing never creates a Lead | ✔ | `B2-D-A001`, `B2-D-A003` |
| `DealWon` never emits `RevenueRecognized` | ✔ | CRM-INV-7; AT-REVB-1…5 |
| Billing excluded from customer RevenueEvent | ✔ | CRM-INV-8; AT-REVB-4 |
| Deny responses disclose no cross-workspace existence | ✔ | error contract §5; AT-XWS-1…5 |
| B1 identity/tenant authority not redefined | ✔ | no B2 document defines a session, membership, role, or workspace rule |

**`B0_B1_CONTRADICTIONS = 0`**, with **11 explicitly declared controlled amendments** that B2 does not disguise as existing truth (`B2_CONTROLLED_AMENDMENTS.md`). **B2 edits no frozen file.**

## 4. Implementation-leakage gate

| Gate | Result | Evidence |
|---|---|---|
| `DJANGO_IMPLEMENTATION` | **0** | scan for `from django`, `import django`, `models.Model`, `serializers.` across all 26 documents — zero hits |
| `DATABASE_MIGRATIONS` | **0** | scan for `migrations.CreateModel/AddField`, `makemigrations`, `CREATE TABLE`, `ALTER TABLE` — zero hits. **B2-FIX.1 removed a `CREATE TABLE crm_activities` sketch and a Python cursor-encoding function** that an earlier draft of `B2_TIMELINE_IDENTITY_MODEL.md` carried; both violated `B2_CRM_DOMAIN_BLUEPRINT.md` §7, and the prior claim of zero hits was false while they stood |
| `DRF_IMPLEMENTATION` | **0** | scan for `rest_framework`, `APIView)`, `ViewSet)` — zero hits |
| `AUTH_IMPLEMENTATION` | **0** | no backend, middleware, or hasher; B1's pipeline is referenced, never implemented |
| `REDIS_IMPLEMENTATION` | **0** | scan for `redis.Redis`, `StrictRedis`, `from redis` — zero hits |
| `CELERY_IMPLEMENTATION` | **0** | scan for `@shared_task`, `@app.task`, `from celery` — zero hits |
| `PROVIDER_IMPLEMENTATION` | **0** | no provider client, SDK, endpoint, or credential |
| `WHATSAPP_IMPLEMENTATION` | **0** | scan for `graph.facebook.com`, WhatsApp API, `WABA_TOKEN` — zero hits |
| `SCRAPER_IMPLEMENTATION` | **0** | scan for `playwright`, `selenium`, `BeautifulSoup`, `scrapy` — zero hits |
| `GOOGLE_PLACES_IMPLEMENTATION` | **0** | scan for `places.googleapis`, `maps.googleapis`, API keys — zero hits |
| `AI_PROVIDER_IMPLEMENTATION` | **0** | scan for `openai`, `anthropic`, API keys — zero hits |
| `TAP_IMPLEMENTATION` | **0** | scan for `api.tap.company`, `TAP_SECRET` — zero hits |
| `ZATCA_IMPLEMENTATION` | **0** | one match, in the blueprint's own **prohibition** sentence |
| `DEPENDENCY_CHANGES` / `LOCKFILE_CHANGES` | **0** | `package.json`, `pnpm-lock.yaml` untouched |
| `DEPLOYMENT_CHANGES` | **0** | `.github/` untouched |
| `SECRET_FILES` | **0** | no secret, key, or credential file |
| `FRONTEND_CHANGES` | **0** | `client/` untouched |
| `UNAUTHORIZED_FILES` | **0** | working tree contains only `Docs/backend/B2/*.md` and the index edit |
| Non-`.md` files in the package | **0** | directory listing |
| Frozen B0/B1 files modified | **0** | `BACKEND_OPENAPI_V1.yaml`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `BACKEND_DATA_MODEL.md`, `BACKEND_ERROR_CATALOG.md`, `BACKEND_AUTHORIZATION_MATRIX.md`, and all 18 B1 documents unmodified |

**Fenced blocks — recounted at B2-FIX.3, and the previous claim corrected.** A direct parse finds **20** fenced blocks across 7 documents, not the 9 once reported: 13 untagged, 4 `mermaid`, 2 `json`, 1 `sql`. B2-FIX.4 added exactly **one** — the `processing_reference_time_N` eligibility formula in §5.2.1, conceptual notation in no language; B2-FIX.3 added none. The prior sentence "none is valid or executable Python or SQL" was **false** and is withdrawn: `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.2 carries a parameterized `INSERT … ON CONFLICT … DO NOTHING` block, present since B2-FIX.1.

That block is **DML, not DDL**, so it trips no gate above: `DATABASE_MIGRATIONS` scans for `CREATE TABLE`/`ALTER TABLE`/`migrations.*` and still returns zero, `B2_CRM_DOMAIN_BLUEPRINT.md` §7 prohibits SQL **DDL**, and the block creates no schema, runs in no build, and is illustrating the idempotency mechanism rather than shipping it. It is therefore recorded as observation 12 below rather than repaired here: rewriting another document's design notation is outside the B2-FIX.3 repair surface, and the honest action is to state it for the countersigning auditor instead of restating a count that does not survive a parse. **`IMPLEMENTATION_LEAKAGE` remains 0 against every gate in the table above**, including for every line B2-FIX.3 wrote.

## 5. Known non-blocking observations

| # | Severity | Observation |
|---|---|---|
| 1 | INFO | `NOTE-` is **proposed/reserved**, not registered. B0's registry scopes prefix registration to "before implementation", so this does not block design closure. No implementation may mint it until `B2-D-B001` is applied. |
| 2 | INFO | `lead.archive` is a **new** permission and the only change B2 requires to B1's authorization catalog. No existing B1 cell changes. |
| 3 | INFO | The `GET /leads` list read model is eventually consistent for `business_city`, `business_name`, `intelligence_score`, and `intelligence_tier`. `GET /leads/{id}` and `/360` read live, so a user opening a Lead always sees current truth. |
| 4 | INFO | `B2-D-B006` (Intelligence keyed by Business vs by Lead) is a genuine B0/frontend disagreement that B2 records but does not resolve — it belongs to the Intelligence domain design. `Lead360.intelligence` is a frozen opaque object, so the CRM contract holds under either keying. |
| 5 | INFO | CRM retention durations remain **PRODUCT / LEGAL DECISION REQUIRED**, inherited unresolved from B0 and B1. Every CRM table already carries the timestamp column a policy would need. |
| 6 | INFO | B2's amendment bundle **depends on B1's** `B1-D-002` (registering `MEM-`), because every CRM owner/assignee/organizer reference is a `MEM-*`. Recorded in `B2_CONTROLLED_AMENDMENTS.md` §5 so the two bundles are not approved out of order. |
| 7 | INFO | **A bounded divergence between the timeline and `last_activity_at` is deliberate and documented** (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.7). While a delivery is `RETRY_PENDING` or `DEAD_LETTERED` awaiting replay, a record can be visible in the timeline while `last_activity_at` has not yet counted it. Under-counting a monotonic column is recoverable; poisoning it is not. The divergence is bounded because the delivery is never acknowledged as processed until applied — a **permanent** divergence caused by a lost delivery is prohibited, not tolerated. `max(timeline.occurred_at) == last_activity_at` is explicitly **not** an invariant and is asserted nowhere; `AT-TL-SKEW-6…9` verify the recovery paths, and terminal `DEAD_LETTERED` state must be operationally visible. |
| 8 | INFO | **`causation_id` was removed** from the `crm_activities` contract rather than registered as an amendment, because frozen B0 defines no causation field to populate it from (`B2_CONTROLLED_AMENDMENTS.md` §7). If a later frozen contract defines causation, adding the column is purely additive and no B2 correctness depends on it. |
| 9 | INFO | In `B2_ACCEPTANCE_TEST_MATRIX.md` the rows `AT-TL-ID-8`…`AT-TL-ID-11` sit physically under the *Timeline total order (TL-ORDER)* heading. This is cosmetic and pre-dates B2-FIX.2: every test carries its category in its own ID, so enumeration, counting, and category derivation are unaffected. |
| 10 | INFO | **B2 records a forward dependency on B12 — Async & Integration Platform** for the clock-skew recovery mechanism: the queue/broker, the retry scheduler, dead-letter persistence and retention, and operator replay tooling (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.6, `B2-D-C019`). B2 specifies only the capability contract those must satisfy. This is a dependency, **not** a Class A gap: every CRM-side behavior is deterministic today under the five retry properties of §5.5.3 and the six dead-letter properties of §5.5.4, whichever mechanism B12 selects. No B12 design is performed here. |
| 11 | INFO | The retry **mechanics** are inherited from frozen B0 `BACKEND_RETRY_POLICY.md` (stable idempotency key, `base * 2^(attempt-1)` with full jitter, capped, default five attempts, then `dead_lettered` plus an operational alert), but the **classification is B2's own and is stated as such**: B0 names no clock-skew row, so §5.5.3 decides normatively that `CLOCK_SKEW` is a retryable transient condition and explains why (it stops failing once the clock advances, unlike a validation failure that fails identically forever). **B2 adds no row to B0's table, changes no number, and registers no amendment** — classifying a condition is not modifying the policy. |
| 13 | INFO | **Path B depends on a capability no frozen artifact yet provides.** B0 requires dead-letter *records* and alerts, which the terminal state rests on, but defines no operator **replay** tooling; §5.5.6 says so explicitly rather than implying B0 covers it. This does not block B2 — the required semantics are fully specified, and Path A recovers with no replay at all — but B12 must deliver replay for the §5.5.5 guarantee to hold end to end in production. |
| 12 | INFO | **Surfaced by B2-FIX.3's re-parse, pre-existing and out of its repair surface:** the package contains **19** fenced blocks, not the 9 previously claimed, and one of them — the `INSERT … ON CONFLICT` in `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.2, present since B2-FIX.1 — is executable SQL, contradicting the prior "none is valid or executable Python or SQL". It is **DML, not DDL**, so it violates no blueprint prohibition and trips no leakage gate, and no CRM behavior depends on its notation. Flagged for the countersigning auditor to accept as notation or schedule for conversion to prose; B2-FIX.3 did not edit it, because it is unrelated to the `last_activity_at` recovery defect. |

None invalidates a B2 contract. `CRITICAL_FINDINGS = 0`, `MAJOR_FINDINGS = 0`, `MINOR_FINDINGS = 0`, `INFO_FINDINGS = 13`.

## 6. Handover statement

A future CRM implementation agent can build this without making a product or security decision. The aggregate set, the Lead schema and every field's classification, the origin and provenance model, the duplicate rule and its concurrency behavior, the contact relationship, the Task and Appointment lifecycles, the Note posture, the timeline authority, `last_activity_at` and `next_activity_at`, the contacted semantics, the list query contract with stable pagination, the Lead 360 projection, the authorization and entitlement boundaries, 20 race outcomes, the idempotency classification, 28 operations, 28 DTOs, a zero-new-code error contract, 24 failure scenarios, and 280 acceptance criteria are all specified. B2-FIX.1 closes the canonical activity vocabulary, the rediscovery provenance writer, the timeline identity/order/cursor contract, and the clock-skew policy (`B2-D-A023`…`B2-D-A026`).

**B2-FIX.2 closes the cross-domain timeline contract.** It locks `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE` and makes every dependent contract consistent with it: a ten-step retrieval algorithm that is the sole site of every filter, a source-side semantic contract for `source_event_id` that names what CRM must never synthesize, read-time deduplication with no CRM store, clock-skew as a self-healing read-path eligibility filter, a `TimelineEntry` wire DTO that carries the identity model verbatim, three reachable source classes with no second projection of Task/Appointment/Note, and B2's event-envelope language realigned to frozen B0. An implementation agent no longer has to invent an identity, a dedup store, a quarantine table, or an envelope field. Where a genuine product choice remains it is recorded in `B2_DECISION_REGISTER.md` with a stated Phase-1 default or an explicit `NOT_SUPPORTED`.

**B2-FIX.3 closes the `last_activity_at` recovery contract.** A post-B2-FIX.2 audit found one remaining MAJOR defect: recovery after a future-clock-skew rejection was *asserted* ("the source redelivers the event", "an operator replays it") without anything making either necessarily happen. At-least-once delivery does not redeliver a message the consumer has already acknowledged, so a rejected-then-acked event could leave `last_activity_at` — an `AUTHORITATIVE_PERSISTED` column driving list sort, activity recency, and stale-lead surfaces — permanently stale. `B2-D-A027` and `B2_TIMELINE_IDENTITY_MODEL.md` §5.5 replace the assertion with a cause: a future-skew rejection is a `RETRYABLE_CLOCK_SKEW` processing failure that is **never acknowledged as successfully completed**, resolving to exactly one of `ELIGIBLE`, `RETRY_PENDING`, or `DEAD_LETTERED`, with a bounded retry that binds to frozen B0's retry standard and an alerted, identity-preserving, idempotent replay path out of the terminal state. B2-FIX.3 **added no document**, **added no frozen-artifact amendment** (the bundle remains 11 items), reopened none of the locked read-time-merge architecture, and introduced **no CRM quarantine aggregate**. The concrete queue, scheduler, dead-letter store, and replay tooling are a recorded forward dependency on **B12 — Async & Integration Platform** and are not designed here.

**B2-FIX.4 closes the two MAJOR defects a post-FIX.3 adversarial audit found, both in persisted `last_activity_at` correctness.** **(1) The eligibility clock.** FIX.3 left the consumer's reference time described as "`ingested_at`, CRM's server clock at receipt" under a lead-in saying the filter ran "once, at ingestion". Read that way, skew never shrinks, every attempt fails identically, and the automatic-retry recovery path was unreachable dead code. §5.2.1 now defines a single canonical `processing_reference_time` sampled afresh at the start of **every** processing attempt, enumerates the six things it must not be, separates it from immutable ingestion metadata, and works the arithmetic through (§5.2.2). **(2) The stranded envelope rule.** `B2_CONTROLLED_AMENDMENTS.md` §7 recorded that FIX.2 had reverted B2's widening of B0's event envelope, but `B2_COMMAND_EVENT_CATALOG.md` §3 rule 7 still read "Aggregate version is on every event… detect and discard an out-of-order delivery", contradicting §0 of its own document and claiming a dependency the amendments doc denied. Worse, on the recovery path a version-discarding consumer would drop exactly the recovered event — which carries the newest `occurred_at` precisely because it was future-dated — reinstating the under-count FIX.3 closed. Rule 7 is replaced by the `GREATEST()`-only order model, which forbids discarding on version, delivery position, or arrival order. `AT-TL-SKEW-10` is the regression guard. B2-FIX.4 **added no document and no frozen-artifact amendment** (the bundle remains 11 items), reopened no locked architecture, and modified no frozen B0/B1 file.

**B2-FIX.4.1 closes the one MAJOR defect the independent post-FIX.4 countersign found: a second consumer FIX.4's clock repair never reached.** FIX.4 corrected the eligibility clock in the timeline model, the decision register, the command/event catalog, the Lead aggregate, domain ownership, the test matrix and this document — but `B2_REDISCOVERY_PROVENANCE_PROCESS.md` was not in that surface, and its §2.5 still compared `discovered_at` against **"the ingestion instant."** That is a first-receipt stamp, one of the six substitutes `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 forbids, so B2 carried two different reference times for one admission rule. Under the wrong branch the skew never shrinks, every attempt fails identically, the budget exhausts, and the `lead_provenance_additional_jobs` row is permanently lost — the same defect class FIX.4 existed to close, in a different consumer. §2.5 now **delegates** to §5.2.1 rather than restating or replacing it: it states `discovered_at ≤ processing_reference_time_N + CLOCK_SKEW_TOLERANCE`, re-forbids the same substitutes plus `discovered_at` itself, and spells out the `RETRYABLE_CLOCK_SKEW` → bounded-retry → `DEAD_LETTERED` → replay disposition already fixed by `B2-D-A027`. **Exactly one clock model now exists in B2.** `AT-DUP-5J` is the regression guard and carries a negative control that fails an implementation comparing against the ingestion instant. The stale `CLOCK_SKEW_POLICY_DEFINED` phrase "an ingestion check" is withdrawn. B2-FIX.4.1 **added no document, no decision, and no frozen-artifact amendment** (the bundle remains 11 items), reopened none of the FIX.4 architecture — the `processing_reference_time` model, automatic-retry reachability, `GREATEST()`-only order safety, the event envelope, the bounded-retry and dead-letter/replay contracts and the B12 boundary are all unchanged — introduced no CRM quarantine store, changed no provenance guard, transaction, idempotency, event or timeline behavior, and modified no frozen B0/B1 file.

**One gate stands before implementation:** the controlled amendment bundle (`B2-D-B001` … `B2-D-B011`) must be approved and applied, **after or together with B1's outstanding bundle**. Until then no implementation may mint `NOTE-*`, enforce `lead.archive`, ship any of the 25 additive operations, rely on `Lead360.notes` or `X-Lead-Conversion-Outcome`, or emit a `409 CONFLICT` carrying a CRM reason.

**B3 (Discovery domain design) readiness:** re-derived at B2-FIX.3 rather than inherited — `CRITICAL_FINDINGS = 0`, `MAJOR_FINDINGS = 0`, `CLASS_A_UNRESOLVED = 0`, and `LAST_ACTIVITY_RECOVERY_MODEL = PASS`. B2 fixes the CRM side of every Discovery boundary B3 will need — Business→Lead conversion is explicit and idempotent, provenance is snapshotted and immutable, `BusinessMerged` has defined CRM behavior, and B0's "no Lead auto-create" rule is restated and enforced by ownership. B3 remains gated on B2 being countersigned and checkpointed.

**B2 is not self-closing. Independent CTO audit is required. No commit, push, deploy, implementation, dependency, lockfile, migration, provider, or frontend change was performed.**
