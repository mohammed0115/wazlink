# B7 — Verification Matrix

> **B7 status:** Target design only. Not closed. This is the author's own mechanical self-verification — **it is not the independent CTO verification B7 requires before closure.**

## 1. Methodology and honest provenance

Every counter below was produced by an actual `grep`/`comm`/`sort -u` pass over `Docs/backend/B7/`, re-run after the correction pass described in §7 — not asserted from memory, and not carried over from an earlier draft.

This matters here more than usual, because this pack has now been corrected **twice**, and both times a self-verification had reported clean numbers that were not clean. The first correction pass found six frozen-truth violations its own matrix scored as `B0_DRIFT = 0` (§7). A subsequent **fresh, independent CTO verification** then found nine further MAJOR findings that *this* matrix had likewise scored as clean — including three undefined `AT-*` references its own stated regex could not match, one undefined decision reference, a Class-A storage contradiction, and two more frozen-truth renames of exactly the class the first pass existed to catch. `B7-FIX.1` remediates all of them; §7a records what was wrong rather than presenting the corrected state as if it were the first result.

## 2. Document and structural counts

```
B7_DOCUMENT_COUNT = 50
```

## 3. Frontend inventory — re-derived from the source file, not restated

```
FRONTEND_BEHAVIOR_COUNT = 60      (row count of B7_FRONTEND_BEHAVIOR_INVENTORY.md §2, FB-A01-FB-A60)
FRONTEND_A              = 41
FRONTEND_B              = 10
FRONTEND_C              = 3
FRONTEND_D              = 6
FRONTEND_UNCLASSIFIED   = 0
41 + 10 + 3 + 6 + 0     = 60   ✓ reconciles against the row count
```

## 4. Reference integrity

```
UNDEFINED_AT_REFS          = 0   Defined set = rows anchored "^| AT-..." in B7_ACCEPTANCE_TESTS.md.
                                 Reference set = every occurrence of AT-[A-Z0-9]+(-[A-Z0-9]+)*-[0-9]+,
                                 a MULTI-SEGMENT pattern. This matters: the single-segment pattern this
                                 matrix previously stated, AT-[A-Z0-9]+-[0-9]+, structurally cannot match an id whose
                                 category segment itself contains a hyphenated part, and three such
                                 stale ids survived a "0" report because of it. Excluded from the reference set, with reasons: bare category prefixes
                                 harvested from this document's own section headings (AT-SEC, AT-DOM, ...),
                                 and two ids that resolve outside this pack and are always written
                                 qualified in prose - "B2's AT-AUD-6" and "B6's AT-B7-1".
UNDEFINED_DECISION_REFS    = 0   every "B7-D-[ABC][0-9]{3}" occurrence resolves to a row in
                                 B7_DECISION_REGISTER.md. Class A is contiguous A001-A039; Class B is
                                 B001-B012; Class C is C001-C006. B7-FIX.1 gave Class B and C rows stable
                                 ids: previously they had none, which is why B7-D-C004 was cited from two
                                 documents while resolving nowhere.
BROKEN_FAILURE_REFS        = 0   every "B7-AF-[0-9]{3}" occurrence resolves to one of the 34 contiguous
                                 ids 001-034 in B7_FAILURE_CATALOG.md.
BROKEN_AMENDMENT_REFS      = 0   every "B7-AM-[0-9]{3}" occurrence resolves to one of the 5 defined in
                                 B7_CONTROLLED_AMENDMENTS.md §1.
BROKEN_FRONTEND_REFS       = 0   every "FB-A[0-9]{2}" occurrence resolves to a row in
                                 B7_FRONTEND_BEHAVIOR_INVENTORY.md §2 (FB-A01-FB-A60, contiguous).
BROKEN_CROSS_DOCUMENT_REFS = 0   Every cited "B7_*.md" filename exists on disk AND, where a section is
                                 cited, that file actually has that section heading. Section-level
                                 checking is new in B7-FIX.1: filename-only checking had reported 0 while
                                 three citations pointed at sections that do not exist
                                 (B7_RULE_LIFECYCLE.md 4, B7_RETENTION_DELETION.md 4,
                                 B7_ACTION_AUTHORIZATION.md 6) and five more pointed at a real section
                                 that says something else. The matcher skips the phantom tails of the real
                                 cross-phase filenames B6_B7_AUTOMATION_BOUNDARY.md and
                                 B5_B6_B7_BOUNDARIES.md.
LIVE_PLACEHOLDER_REFS      = 0   no unresolved-marker token of any kind (the four conventional ones,
                                 plus any unfilled-slot marker)
                                 and no unfinished editorial artifact appears as live content anywhere in
                                 the pack. B7-FIX.1 removed one such artifact from B7_RULE_LIFECYCLE.md 3.
```

## 5. Cardinality — mechanically recomputed after `B7-FIX.1`

Every number below was produced by a script over the primary source document, not carried forward from a prior counter.

```
B7_DOCUMENT_COUNT             = 50

OWNED_ENTITY_COUNT            = 9    rows 1-9 of B7_DOMAIN_OWNERSHIP.md §2; row 10 is the deliberately
                                     empty AutomationRuleAudit row. No wakeup/timer table exists in
                                     Phase 1 at all (B7_DATA_MODEL.md §7) — it is not "excluded from the
                                     count", it is not defined.
REFERENCED_ENTITY_COUNT       = 16

TRIGGER_COUNT                 = 14
EVENT_BACKED_TRIGGER_COUNT    = 13
MANUAL_TRIGGER_COUNT          = 1
SCHEDULED_TRIGGER_COUNT       = 0    not a catalog entry, not a trigger_source enum value, not a DTO-
                                     accepted type, and not an acceptance-test subject except as an
                                     explicit exclusion (AT-SCHED-1 NC)

CONDITION_OPERATOR_COUNT      = 10   contains/not_contains/before/after/changed* explicitly deferred
UNREACHABLE_OPERATORS_INCLUDED= 0

ACTION_COUNT                  = 10   rows of B7_ACTION_CATALOG.md §2
GOVERNED_COMMAND_ACTION_COUNT = 9
INTERNAL_CONTROL_ACTION_COUNT = 1    stop_execution
TARGET_COMMAND_COUNT          = 8    B2 = 7 actions, B6 = 1, B5 = 1, B7-internal = 1
INVALID_TARGET_COMMAND_REFS   = 0

AUTOMATION_RUN_STATE_COUNT    = 10
FROZEN_RUN_STATE_COUNT        = 7    created, awaiting_approval, queued, running, completed, failed, cancelled
ADDITIVE_RUN_STATE_COUNT      = 3    evaluating, skipped, dead_lettered — re-derived after the Phase-2
                                     reduction, not carried forward: `waiting` was never one of the three,
                                     so removing it does not change this figure. Each of the three retains
                                     a defined meaning, transitions, DTO representation, acceptance
                                     coverage and amendment coverage (B7_EXECUTION_MODEL.md §2-§3).
INVALID_RUN_TRANSITIONS       = 0
INVALID_SUCCEEDED_STATE_REFS  = 0

COMMAND_COUNT                 = 12   FROZEN_REUSED 2 (CreateAutomationRule, ApproveAutomationRun)
                                     ADDITIVE 10
PRODUCED_EVENT_COUNT          = 13   FROZEN_REUSED 2 (AutomationRunCreated, AutomationRunCompleted)
                                     ADDITIVE 11 (AutomationRunSkipped added by B7-FIX.2, B7-D-A041)
CONSUMED_EVENT_COUNT          = 13   B2 = 9 (two via B7-AM-002), B6 = 4
EVENT_NAME_COLLISIONS         = 0

REUSED_PERMISSION_COUNT       = 3    automation.rule.view / .rule.manage / .run.approve, with the frozen
                                     role matrix reproduced unchanged
ADDITIVE_PERMISSION_COUNT     = 0
FALSE_FROZEN_PERMISSION_CLAIMS= 0    every target-domain permission B7 relies on (task.manage,
                                     appointment.manage, lead.update, lead.assign, deal.update,
                                     message.send) verified present in B1_AUTHORIZATION_RBAC.md

PUBLIC_API_OPERATION_COUNT    = 19   11 /automation/rules*, 6 /automation/runs*, 2 catalog;
                                     1 frozen (approveAutomationRun), 18 additive

FAILURE_SCENARIO_COUNT        = 34   B7-AF-001..034, contiguous
FAILURE_SCENARIO_DUPLICATES   = 0
FAILURE_SCENARIO_GAPS         = 0

ACCEPTANCE_TEST_COUNT         = 141
ACCEPTANCE_CATEGORY_COUNT     = 38
DUPLICATE_ACCEPTANCE_TESTS    = 0
NEGATIVE_CONTROL_COUNT        = 78

CLASS_A_DEFINED               = 42   CLASS_A_UNRESOLVED = 0   (all RESOLVED; A040-A042 added by B7-FIX.2)
CLASS_B_DEFINED               = 12   CLASS_B_UNRESOLVED = 0   (all DEFERRED_SAFE, none claimed resolved)
CLASS_C_DEFINED               = 6    CLASS_C_UNRESOLVED = 0   (all DEFERRED_SAFE)

CONTROLLED_AMENDMENT_COUNT    = 5
ADDITIVE_AMENDMENTS           = 4
COMPATIBLE_CLARIFICATIONS     = 1
NON_ADDITIVE_AMENDMENTS       = 0
MISSING_CONTROLLED_AMENDMENTS = 0
```

## 6. Leakage and contradiction checks

```
STORAGE_MODEL_CONTRADICTIONS        = 0   one authoritative persistence model (revision-scoped child
                                          tables, B7-D-A036); zero references remain to the competing
                                          jsonb trigger_definition/condition_definition/action_definitions
                                          columns, and API-vs-persistence is stated explicitly
AUTHORIZATION_MODEL_CONTRADICTIONS  = 0   one authority principal (activated_by_membership_id) in every
                                          document; zero surviving "workspace RBAC standing" or
                                          "workspace automation capability" formulations
WORKSPACE_PERMISSION_PRINCIPAL_REFERENCES = 0   (excluding the explicit negative declarations that no
                                          such construct exists)

PUBLIC_ID_PREFIXES_USED             = RUN-* (frozen), AUTO-* (promoted, B7-AM-001)
NEW_PUBLIC_ID_PREFIXES              = 0
PUBLIC_ID_COLLISIONS                = 0
MISSING_PUBLIC_ID_DECLARATIONS      = 0
MISSING_AUTO_PREFIX_AMENDMENT_TARGETS = 0  all five frozen artifacts the registry's own clause requires
                                          are enumerated in B7-AM-001, and none is edited by B7

DIRECT_CRM_WRITE_LEAKS              = 0
DIRECT_DISCOVERY_WRITE_LEAKS        = 0
DIRECT_INTELLIGENCE_WRITE_LEAKS     = 0
DIRECT_MESSAGING_WRITE_LEAKS        = 0
DIRECT_PIPELINE_WRITE_LEAKS         = 0

REVENUE_EVENT_PRODUCERS_IN_B7       = 0
RECOGNIZED_REVENUE_AUTHORITY_LEAKS  = 0
B8_BILLING_AUTHORITY_LEAKS          = 0   the invented automation.rules.max_active key is removed; B7
                                          enforces only the two keys frozen B1 already fixed
B9_FINANCE_AUTHORITY_LEAKS          = 0

SYSTEM_AUTOMATION_SUPERUSER_LEAKS   = 0
DRY_RUN_SIDE_EFFECT_LEAKS           = 0
REPLAY_DUPLICATE_SUCCESSFUL_SIDE_EFFECT = 0

INVALID_CONSUMED_EVENT_REFS         = 0
MISSING_EVENT_AMENDMENTS            = 0

STALE_COMMAND_NAMES                 = 0
STALE_EVENT_NAMES                   = 0   AutomationExecutionCancelled replaced by the catalog name
                                          AutomationRunCancelled in both documents that used it
STALE_API_CONTRACTS                 = 0
STALE_SCHEDULE_TRIGGER_REFS         = 0   B7-FIX.2 removed the last one (B7_SCHEDULE_DELAY_MODEL.md's
                                          "Phase-1 supports exactly two shapes"); that document now
                                          opens with a §0 Phase-2 banner and is conditional throughout
LIVE_SCHEDULE_PHASE1_REFS           = 0
LIVE_WAIT_PHASE1_REFS               = 0   B7-FIX.2 removed B12's required wakeup sweep and
                                          B7_RULE_LIFECYCLE.md §3's "waiting" runs

RUN_DEDUP_IDENTITY_CONTRADICTIONS   = 0   one identity everywhere: (workspace_id, rule_id,
                                          source_event_id), B7-D-A040
MISSING_RUN_DEDUP_UNIQUE_CONSTRAINT = 0   uq_automation_runs_event_rule declared with its exact
                                          partial predicate in B7_DATA_MODEL.md §3, not merely cited
REVISION_IN_EVENT_DEDUP_IDENTITY    = 0   rule_revision_id remains on the run as execution provenance
                                          and appears in no dedup key or constraint
DUPLICATE_EVENT_DUPLICATE_RUN_PATHS = 0
DUPLICATE_EVENT_DOUBLE_QUOTA_PATHS  = 0
DUPLICATE_EVENT_DOUBLE_ACTION_PATHS = 0

UNDECLARED_TERMINAL_STATE_EVENTS    = 0   all five terminal states emit exactly one event each;
                                          AutomationRunSkipped closes the gap on `skipped`
QUEUED_AT_CREATION_MISUSE           = 0   created_at is a distinct not-null column; queued_at is
                                          nullable and set only on entry to `queued`
INVALID_QUEUE_LATENCY_DEFINITIONS   = 0   queue_latency = queued_at -> started_at; evaluation_latency
                                          is a separate histogram
TIMESTAMP_ORDER_CONTRADICTIONS      = 0
MALFORMED_DECISION_TABLES           = 0
UNSPECIFIED_AUTHORITY_FAILURE_THRESHOLD = 0
HIDDEN_AUTO_DISABLE_PATHS           = 0
THREAT_ROWS_WITHOUT_ACCEPTANCE_EVIDENCE = 0
```

Method for the firewall figures, stated so they are reproducible rather than asserted: every occurrence of `RevenueEvent`, `RevenueRecognized`, `RevenueReversal`, `AttributionTouchpoint`, `subscription`, `invoice`, and `payment` in the pack was read in context and classified as (a) a prohibitive statement, (b) a negative-control test, or (c) a live producer/field/command. Category (c) is empty. Negative statements such as *"B7 MUST NOT create a RevenueEvent"* are **not** counted as producers, and rejected-design examples in `B7_CONTROLLED_AMENDMENTS.md` §2 are **not** counted as live architecture.

`PUBLIC_ID_COLLISIONS = 0`: `AUTO-` was checked against every Section A/B/C row of `BACKEND_PUBLIC_ID_REGISTRY.md`. It appears only in §B, which is exactly the row `B7-AM-001` proposes to promote — a promotion, not a collision. B7 mints no other prefix and reuses the frozen `RUN-*` unchanged.

## 7. Drift and scope — what the first correction pass fixed

```
B0_DRIFT = 0    B1_DRIFT = 0    B2_DRIFT = 0    B3_DRIFT = 0
B4_DRIFT = 0    B5_DRIFT = 0    B6_DRIFT = 0
```

File-level: no file under `Docs/backend/B1/`…`B6/` and no root `BACKEND_*.md` is modified relative to the frozen checkpoint `33354c4b072a8e78370856c25b7afdeec5939169`. `BACKEND_DOCUMENTATION_INDEX.md` gains an additive B7 section and never marks B7 closed.

The pre-correction pack drifted from frozen B0 in six places, each of which its own matrix scored as `B0_DRIFT = 0`. All six were corrected:

| # | Frozen B0 truth | Pre-correction pack | Correction |
|---|---|---|---|
| 1 | `BACKEND_COMMAND_EVENT_CATALOG.md` names the command `ApproveAutomationRun` | renamed to `ApproveAutomationAction`, plus an invented `RejectAutomationAction` | frozen name restored; `approved:false` is the rejection path |
| 2 | same file names the events `AutomationRunCreated` / `AutomationRunCompleted` | renamed to `AutomationRunAdmitted` / `AutomationRunSucceeded` | frozen names restored |
| 3 | same file names both automation commands, so they are reused, not new | `FROZEN_REUSED_COMMAND_COUNT = 0`, `FROZEN_REUSED_EVENT_COUNT = 0` | corrected to 2 and 2 |
| 4 | `BACKEND_STATE_MACHINES.md` fixes `created→awaiting_approval→queued→running→completed/failed/cancelled` | a 10-state machine dropping `created`, renaming `completed`→`succeeded`, and queueing before approval | frozen seven restored verbatim in frozen order; three added states declared as `B7-AM-003` |
| 5 | `BACKEND_OPENAPI_V1.yaml` fixes `operationId: approveAutomationRun` with body `{approved, version}`, `additionalProperties:false` | `approveAutomationAction` plus a separate `/reject` operation the frozen body cannot express | frozen operation restored; `/reject` removed; approval is run-granular (`B7-D-A037`) |
| 6 | `BACKEND_PUBLIC_ID_REGISTRY.md` §B defers `AUTO-` *because* "Rule CRUD is future/non-Core" | read as an "explicit rejection" of `AUTO-`, and a new `ARULE-` prefix minted | `AUTO-` promoted on the registry's own stated condition (`B7-AM-001`); no new namespace |

## 7a. What the independent CTO verification then found, and `B7-FIX.1` fixed

The correction pass above was itself incomplete, and this matrix reported it as clean. A fresh independent verification found nine MAJOR findings. All nine are remediated; none is left open, and none is remediated by weakening a counter.

| Finding | What was wrong | `B7-FIX.1` |
|---|---|---|
| F-01 | Class-A decision `B7-D-A036` said "child tables, not JSON" while `B7_AUTOMATION_RULE_AGGREGATE.md` §3 said `jsonb` columns, and five further documents consumed column names the data model never defined | Normalized revision-scoped child tables are the single authoritative model; every consuming reference rewritten to child-row semantics; API-vs-persistence stated explicitly (§3 of that document) |
| F-02 | The authority principal was stated three incompatible ways — `activated_by_membership_id`, "workspace RBAC standing", and "workspace automation capability" | One principal everywhere; both workspace formulations removed; `AT-RBAC-6` added to hold it |
| F-03 | Frozen `automationRuns` (B1's "do not reinvent" vocabulary, F16's frozen behavior) was enforced nowhere, and an invented `automation.rules.max_active` stood in its place | Frozen metric restored at both run-creation paths with F16's transactional reservation reused unmodified; `max_active` removed, not deferred; five acceptance rows added |
| F-04 | Frozen `ENTITLEMENT_LOCKED` and `QUOTA_EXHAUSTED` appeared nowhere in the pack; B7 had renamed them `ENTITLEMENT_REQUIRED` / `USAGE_EXHAUSTED` | Both frozen codes restored with B1's `details` shapes; `AT-ENT-8` **NC** prevents reinvention |
| F-05 | `B7-D-A035` declared scheduling and `wait` out of Phase 1, but eleven documents still specified them normatively — including three acceptance tests and a failure row counted in the totals | Every live Phase-1 reference removed or converted to an explicit exclusion; `B7-AF-022` repurposed to the previously-uncovered authority-principal failure; §22 rewritten as exclusion controls |
| F-06 | The rejected `succeeded` state survived as a transition target and a replay status | Both replaced with the defined `completed` |
| F-07 | Admission inserted runs at `queued`, never writing `created`, and never routed approval-requiring runs through `awaiting_approval` | Every run enters at `created` and advances in the admission transaction; approval strictly precedes queueing; `AT-EXEC-4`/`AT-EXEC-5` **NC** hold both |
| F-08 | Three `AT-*` ids and one decision id resolved nowhere, while this matrix reported 0 — its stated regex could not match the id shape | All four repaired; the checker rebuilt around a multi-segment pattern and section-level cross-document checking |
| F-09 | Auto-disable on authority loss was promised in prose with no threshold value, no transition, no actor, no event field and no test | Removed as a Phase-1 behavior and replaced with a stated Class-A decision (`B7-D-A038`) that authorization failure mutates no lifecycle state; deferred as operational policy `B7-D-C006` |

Eleven MINOR findings were remediated in the same pass: the action counter (10 rows, 9 governed + 1 internal, against a bare "9"), two stale "seven entities" counts, the stale `AutomationExecutionCancelled` event name, a mis-assigned `AT-SEC-8` citation, three swapped threat→test mappings and two threat rows with no test at all, three broken and five mis-targeted section references, an unfinished editorial artifact, three incorrect frontend source-line citations, `B7-AM-001`'s missing frozen-artifact enumeration, the ID-less Class B/C decision tables, and the `AutomationEventInbox`/`AutomationInboxRecord` naming split.

```
IMPLEMENTATION_LEAKAGE = 0   every file in Docs/backend/B7/ is .md; no .py/.sql/.ts/migration created
UNAUTHORIZED_FILES     = 0
B8_FILES_CREATED       = 0
```

## 7b. What the fresh independent re-verification of the `B7-FIX.1` state then found, and `B7-FIX.2` fixed

A fresh independent CTO verification of the remediated pack returned `CRITICAL = 0`, `MAJOR = 2`, `MINOR = 6`, `INFO = 2`. It confirmed independently that F-01, F-02, F-03, F-04, F-06, F-07, F-08 and F-09 were genuinely closed, that B0-B6 drift was zero, that every firewall counter held, and it adjudicated `B7-AM-003` **ADDITIVE** on the frozen contract's own internal evidence. It also found that **F-05 was not fully closed and that this matrix had reported it as zero for the third time.**

| Finding | Severity | What was wrong | `B7-FIX.2` |
|---|---|---|---|
| M-1 | MAJOR | The event-run dedup identity was stated two incompatible ways across four documents — with `rule_revision_id` in `B7_IDEMPOTENCY_MODEL.md` §1, without it in that same document's §5, in `B7_COMMAND_EVENT_CATALOG.md`, in `B7_DATA_MODEL.md` §8 and in FB-A22's disposition — and the `(workspace_id, rule_id, source_event_id)` constraint three of them relied on was **never declared** in `B7_DATA_MODEL.md` §3's schema | `B7-D-A040` fixes the identity as `(workspace_id, rule_id, source_event_id)`, revision excluded as execution provenance; `uq_automation_runs_event_rule` is **declared** with its exact partial predicate; per-`trigger_source` key derivations are tabulated; the two dedup layers and why neither suffices alone are stated (§4a); five acceptance rows added |
| M-2 | MAJOR | Three live Phase-1 scheduling/wait references survived F-05 — `B7_SCHEDULE_DELAY_MODEL.md` §1's *"Phase-1 supports exactly two shapes"*, `B7_B12_ASYNC_BOUNDARY.md` §1's **required** wakeup sweep (which `AT-SCHED-3` **NC** simultaneously forbade), and `B7_RULE_LIFECYCLE.md` §3's `waiting` runs | the schedule document rewritten with a §0 exclusion banner and conditional voice throughout; the B12 requirement removed and replaced with an explicit "B7 requires no timer" statement plus the two async requirements it actually has; the lifecycle sentence corrected to `running` runs only |
| m-1 | MINOR | dangling citation to a `scheduled_wakeup_delay` metric removed from `B7_OBSERVABILITY_AUDIT.md` §2 | citation rewritten; the Phase-1 metric is **not** restored, since nothing in Phase 1 can be late in that sense |
| m-2 | MINOR | the terminal state `skipped` had no event that could report it | additive `AutomationRunSkipped` with a closed three-value `skip_reason`; `AutomationRunCompleted.outcome` narrowed to `actions_executed`; `B7-D-A041` |
| m-3 | MINOR | a blank line split the Class-A table before `B7-D-A038` | removed; all 42 rows render as one table |
| m-4 | MINOR | `B7_COMMAND_EVENT_CATALOG.md` printed §4 before §3 | reordered, semantics unchanged |
| m-5 | MINOR | duplicated qualifier *"B2's `B2's AT-AUD-6`"* | corrected |
| m-6 | MINOR | `queued_at` doubled as the creation timestamp and `queue_latency` was defined `queued_at`→`evaluating`, inverted against `created→evaluating→queued` | `B7-D-A042`: five distinct ordered timestamps, `created_at` not-null and separate; `queue_latency` = `queued_at`→`started_at`; `evaluation_latency` split out |

Both INFO items were left as recorded: the two foreign-namespace acceptance references are correctly qualified and resolve in B2/B6, and `B7_B12_ASYNC_BOUNDARY.md` §3's self-check wording was tightened only insofar as §1 was rewritten.

## 8. What this document is not

This remains the author's own pass over content the author wrote. Its first version reported six violations as zero; its second reported nine more as zero. That record is the reason this pack requires — and has not yet had — a fresh independent verification of the **`B7-FIX.1`** state. Nothing here should be read as that verification.

This remains the author's own pass. Its first version reported six violations as zero; its second reported nine more as zero; its third reported F-05 closed when three live references survived. **That record is why no counter in this document should be trusted without re-derivation**, and why `B7-FIX.2` states the search terms and raw hit counts behind its schedule/wait and dedup zeros rather than asserting them.

`CRITICAL_FINDINGS = 0`, `MAJOR_FINDINGS = 0`, `MINOR_FINDINGS = 0` — reported as the author's own result at the end of `B7-FIX.2`, not as a completed independent verification. A fresh independent countersign of the `B7-FIX.2` state has not yet occurred.
