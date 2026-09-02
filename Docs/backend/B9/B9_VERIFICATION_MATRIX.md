# B9 — Verification Matrix

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
>
> **Every number below was produced by a command that can be re-run.** The command is given beside the counter. Nothing is marked "verified" on the strength of having been written down.

## 1. Repository state

```
BRANCH             = main
FROZEN_B8_SHA      = 0c424c8a2e5df1bc1bdc9edc80f25f785b26560d
HEAD_SHA           = 0c424c8a2e5df1bc1bdc9edc80f25f785b26560d
ORIGIN_SHA         = 0c424c8a2e5df1bc1bdc9edc80f25f785b26560d
AHEAD_BEHIND       = 0 / 0
STAGED_FILES       = 0
WORKING_TREE_STATE = B9 pack + B9-FIX.1 + B9-FIX.2 corrections, uncommitted
```

Verified before authoring by `git branch --show-current`, `git rev-parse HEAD`, `git rev-parse origin/main`, `git rev-list --left-right --count origin/main...HEAD`, `git status --short`, `git diff --cached --name-status`.

## 2. Package

| Counter | Value | Command |
|---|---:|---|
| `B9_DOCUMENT_COUNT` | **36** | `ls Docs/backend/B9/*.md \| wc -l` |
| `B9_UNEXPECTED_FILES` | **0** | `find Docs/backend/B9 -type f ! -name '*.md' \| wc -l` |

## 3. Frontend evidence

| Counter | Value | Command |
|---|---:|---|
| `FRONTEND_BEHAVIOR_COUNT` | **53** | `grep -cE '^\| FB-B9-[0-9]+' B9_FRONTEND_BEHAVIOR_INVENTORY.md` |
| `FRONTEND_A` | **35** | `grep -E '^\| FB-B9-' … \| grep -c '\*\*A\*\* \|$'` |
| `FRONTEND_B` | **6** | same, class B |
| `FRONTEND_C` | **7** | same, class C |
| `FRONTEND_D` | **5** | same, class D |
| Sum check | 35+6+7+5 = **53** ✓ | reconciles against the row count |
| `FRONTEND_DUPLICATE_BEHAVIORS` | **0** | `grep -oE '^\| FB-B9-[0-9]+' … \| sort \| uniq -d \| wc -l` |
| `FRONTEND_UNSUPPORTED_BEHAVIORS` | **0** | field-by-field re-read of `Analytics.tsx:405-411`, `AnalyticsModal.tsx:126-152` and `analytics-engine.js:217` against op 6's DTO (`B9_FRONTEND_BEHAVIOR_INVENTORY.md` §3a). `B9-FIX.1` reported `0` while `owner` and `touchpointCount` had no B9 field; `B9-FIX.2` added `owner_ref`, `touchpoint_count`, `trace_status` |
| `FRONTEND_OMITTED_MATERIAL_BEHAVIORS` | **0** | `B9-FIX.1` added `FB-B9-051`…`FB-B9-053` (Revenue tab, trace modal, CSV export); `B9-FIX.2` re-opened all three at source and found no further omitted rows — only unserved fields within them |

## 4. Domain model

| Counter | Value | Source |
|---|---:|---|
| `OWNED_ENTITY_COUNT` | **5** | `B9_DOMAIN_OWNERSHIP.md` §2 |
| `REFERENCED_ENTITY_COUNT` | **16** | §3 — entities B9 actually reads or appends to |
| `DECLARED_NON_DEPENDENCY_COUNT` | **2** | §3a — TaxInvoice, AutomationRun. Counted separately; never summed into the line above |
| `B9_TABLE_COUNT` | **5** | `B9_STORAGE_MODEL.md` §7 |
| `REVENUE_EVENT_STATE_COUNT` | **3** | recognized, partially_reversed, reversed |
| `RECONCILIATION_CASE_STATE_COUNT` | **4** | open, investigating, resolved, dismissed |
| `RECONCILIATION_CASE_TYPE_COUNT` | **17** | `B9_RECONCILIATION_MODEL.md` §3 |
| `LEDGER_SCOPE` | **immutable revenue-event register + compensating reversal register** | `B9-D-A003` |
| `REVENUE_EVENT_MODEL` | **immutable, append-only; only derived `status` mutates** | `B9-D-A010` |
| `REVERSAL_MODEL` | **append-only compensating rows; caller supplies `gross` only, `net` derived by running-total allocation** | `B9-D-A011`, `B9-D-A033` |
| `TERMINAL_ZERO_NET_REVERSAL_RULE` | **`net = 0` admissible only when `Pg + Rg = G` AND `Pn = N`** — the terminal gross-cleanup; every other zero-net reversal is `B9-AF-029` | `B9-D-A040`, `B9_REVERSAL_MODEL.md` §4.1a |
| `EXHAUSTION_IMPLICATION` | **`Σ gross = G ⟹ Σ net = N`; the converse does not hold** | `B9-D-A040` |
| `FULL_REVERSAL_RULE` | **`Σ gross = gross_amount` AND `Σ net = net_amount`** | `B9-D-A034` |
| `SOURCE_RERECOGNITION_RULE` | **released only when both folds are exhausted** | `B9-D-A034` |
| `ATTRIBUTION_MODEL` | **first-touch over two candidate sources, snapshotted at recognition, 100% to one winner** | `B9-D-A014`, `B9-D-A016`, `B9-D-A035` |
| `ATTRIBUTION_FALLBACK_MODEL` | **derived from B3 `discovery_results` (`filtered = false` only) when no touchpoint qualifies; NONE only when both candidate sets are empty** | `B9-D-A035`, `B9-D-A044` |
| `TRACK_A_ATTRIBUTION_CREATION_MODEL` | **read-derived at recognition; no writer, no system actor, no consumer** | `B9-D-A036` |
| `SOURCE_IDENTIFIER_MODEL` | **registered `EntityRef` + `origin_kind` + `source_code` contract string** | `B9-D-A037` |
| `RECOGNITION_POLICY` | **explicit human command only; no rule, no event, no schedule** | `B9-D-A004`, `B9-D-A008` |
| `RECOGNITION_AUTHORITY` | **membership holding `revenue.recognize` (owner/admin)** | `B9-D-A031` |
| `RECOGNITION_TIMESTAMP` | **`recognized_at`, caller-supplied, UTC** | `B9-D-A019` |
| `MANUAL_RECOGNITION` | **YES — and the only Phase-1 mode** | `B9-D-A008` |
| `CURRENCY_POLICY` | **no FX; per-currency grouping; never summed across currencies** | `B9-D-A017` |
| `MONEY_REPRESENTATION` | **`NUMERIC(18,4)` exact decimal; decimal string on the wire; never float** | `B9-D-A026` |
| `ATTRIBUTION_POLICY` | **first-touch (frozen ADR-008)** | `B9-D-A014` |
| `FIRST_TOUCH_RULE` | **earliest `occurred_at`/`discovered_at` ≤ `recognized_at`; ties by candidate kind, then within-kind keys, then `public_id`** | `B9_FIRST_TOUCH_MODEL.md` §4 |
| `RECOGNIZED_REVENUE_SELECTOR` | **register membership net of reversals; no `status` filter** | `B9-AM-010` |
| `MULTI_CURRENCY_ATTRIBUTION_API_RULE` | **`currency` *optional* on every single-scalar operation, defaulting to the workspace presentation currency**; the frozen parameterless `GET /attribution` stays valid | `B9-D-A039`, `B9-AM-012`, `B9-R-020` |
| `WORKSPACE_CURRENCY_RESOLUTION` | **request time**, from a *mutable* `workspaces.currency`. The default **selects** rows already in that currency; it never converts and never restates. No as-of resolution — frozen B1 stores no currency history | `B9-D-A043`, `B9_CURRENCY_MONEY_MODEL.md` §8a |
| `FILTERED_DISCOVERY_CANDIDATE_RULE` | **`filtered = true` `discovery_results` rows are NOT eligible first-touch candidates** — B3 retains them as audit evidence and excludes them from its own visible result set; B9 adopts that line. Can only ever yield *unattributed*, never a moved amount | `B9-D-A044`, `B9_FIRST_TOUCH_MODEL.md` §2.2a |
| `PER_EVENT_ATTRIBUTION_API` | **`GET /revenue-events/{public_id}/attribution`** — amounts, `owner_ref`, `touchpoint_count`, `trace_status`, snapshot, chain | `B9_API_DTO_CONTRACTS.md` op 6, §2a |
| `OWNER_FIELD_MODEL` | **display-only, resolved live from B6's `Deal.owner_ref`; never snapshotted** | `B9-D-A042` |
| `TOUCHPOINT_COUNT_SEMANTICS` | **allocations made** (`1` attributed / `0` unattributed in Phase 1), not candidates considered | `B9-D-A042` |
| `FINANCIAL_RBAC_RULE` | **every `Money` response requires `revenue.view`, conjunctively — stated per operation, including ops 1, 4 and 12-14, not inferred from the role matrix** | `B9-D-A038` |
| `REFUND_EVIDENCE_MODEL` | **read-only B8 `Refund` fact with its own amount; never auto-reverses** | `B9-AM-009` |
| `RECONCILIATION_RESOLUTION_IDEMPOTENCY` | **`resolution_idempotency_key` + `resolution_request_hash`, partial unique index** | `B9-D-A041`, `B9_STORAGE_MODEL.md` §5 |
| `UNATTRIBUTED_REVENUE_SUPPORTED` | **YES** | `B9-D-A013` |
| `TRACK_B_DISCOVERY_REQUIRED` | **NO** | `B9-D-A030` |

## 5. Contracts

| Counter | Value | Command / source |
|---|---:|---|
| `COMMAND_COUNT` | **5** | `B9_COMMAND_EVENT_CATALOG.md` §1 |
| `FROZEN_REUSED_COMMAND_COUNT` | **3** | RecordRevenueEvent, ReverseRevenueEvent, RecordTouchpoint |
| `ADDITIVE_COMMAND_COUNT` | **2** | |
| `PRODUCED_EVENT_COUNT` | **6** | §2 |
| `FROZEN_REUSED_EVENT_COUNT` | **3** | RevenueRecognized, RevenueReversed, TouchpointRecorded |
| `ADDITIVE_EVENT_COUNT` | **3** | |
| `CONSUMED_EVENT_COUNT` | **0** | §3, `B9-D-A002` |
| `EVENT_NAME_COLLISIONS` | **0** | checked against `BACKEND_COMMAND_EVENT_CATALOG.md` and every B1-B8 catalog |
| `INVALID_CONSUMED_EVENT_REFS` | **0** | trivially — there are none |
| `MISSING_EVENT_AMENDMENTS` | **0** | no consumer-list amendment is required (`B9-D-A002`) |
| `REUSED_PERMISSION_COUNT` | **1** | `analytics.view`, required conjunctively with `revenue.view` on monetary responses |
| `ADDITIVE_PERMISSION_COUNT` | **6** | `B9_RBAC_TENANCY.md` §2 |
| `PUBLIC_API_OPERATION_COUNT` | **14** | `grep -cE '^\| [0-9]+ \| (GET\|POST)' B9_API_DTO_CONTRACTS.md` |
| `ADDITIVE_API_OPERATION_COUNT` | **12** | 14 total less the 2 at frozen paths (`createRevenueEvent`, `getAttribution`) |
| `CANONICAL_SELECTOR_COUNT` | **15** | `B9_ANALYTICS_PROJECTIONS.md` §2 |

## 6. Authority-leak gates — mechanically scanned

Scan method: grep each token across `Docs/backend/B9/*.md`, then read **every** hit and classify it as a negative statement, a `≠` line, a gating rule, a test title, or a live derivation. Only live derivations count.

| Counter | Value | Evidence |
|---|---:|---|
| `WON_DEAL_REVENUE_LEAKS` | **0** | no B6 consumer, no B6 read in the amount path, no write path |
| `PIPELINE_REVENUE_LEAKS` | **0** | no selector reads `deals`; `AT-SEL-2` |
| `B8_PAYMENT_AUTHORITY_LEAKS` | **0** | no B8 consumer; platform sources rejected `B9-AF-007` |
| `FRONTEND_REVENUE_AUTHORITY_LEAKS` | **0** | the frozen frontend has no mutation path at all (`B9_FRONTEND_BEHAVIOR_INVENTORY.md` §5) |
| `ATTRIBUTION_RECOGNITION_COUPLING_LEAKS` | **0** | `revenue_attributions` has **no amount and no currency column** |
| `B10_TAX_AUTHORITY_LEAKS` | **0** | no tax table, field, command, event or selector anywhere in B9 |
| `CROSS_WORKSPACE_FINANCE_LEAKS` | **0** | `workspace_id` NOT NULL on all five tables; scope from session only |
| `DIRECT_B6_WRITE_LEAKS` | **0** | `B9_DOMAIN_OWNERSHIP.md` §5 |
| `DIRECT_B8_WRITE_LEAKS` | **0** | §5 |
| `DIRECT_B7_WRITE_LEAKS` | **0** | §5 |
| `REVENUE_EVENT_DELETE_PATHS` | **0** | no endpoint, no `deleted_at`, `ON DELETE RESTRICT` inbound |
| `UNCONTROLLED_REVENUE_MUTATION_PATHS` | **0** | only derived `status` mutates, under the reversal row lock |
| `MULTI_CURRENCY_SUMMATION_LEAKS` | **0** | `RevenueSummary` returns per-currency rows. Where a response carries a single-currency `Money`, `currency` is an **optional** request parameter (`B9-AM-012`, `B9-D-A039`): supplied ⇒ report only that currency; omitted ⇒ report the workspace's own presentation currency, resolved at request time (`B9_API_DTO_CONTRACTS.md` §3a). Never a sum across currencies and never an undeclared pick. `B9-AF-036` fires **only** when that workspace default cannot be resolved or fails the ISO-4217 shape — it is not a "currency was omitted" error |
| `MULTI_CURRENCY_API_AMBIGUITIES` | **0** | `B9_API_DTO_CONTRACTS.md` §3a — one rule, no data-dependent validity, no sum, no undeclared pick |
| `GET_ATTRIBUTION_FROZEN_CONTRACT_GAPS` | **0** | the frozen operation's `"parameters": []` request form still returns `200`; the added parameters are optional (`B9-AM-012`) and the added `422` is registered (`B9-AM-011`) |
| `REVERSAL_ARITHMETIC_GAPS` | **0** | `net` derived, never supplied (`B9-D-A033`); the rounding residual `B9-FIX.1` left unreversible is closed by the terminal gross-cleanup, and the reachability theorem shows no event can be stranded (`B9-D-A040`) |
| `TERMINAL_ROUNDING_CLEANUP_GAPS` | **0** | the three admitting conditions, the rejection branch, the lock placement, the replay and the race are each specified and tested (`AT-REVR-23`…`AT-REVR-32`, `AT-CONC-18`…`AT-CONC-20`, `AT-IDEM-11`, `AT-IDEM-12`) |
| `FULL_REVERSAL_STATUS_GAPS` | **0** | both folds required (`B9-D-A034`), and **both** directions of the mistake are now controlled — gross-only by `AT-IMM-6`, net-only by `AT-IMM-7` |
| `SOURCE_RERECOGNITION_GAPS` | **0** | released only when nothing remains — never while net stands, never while a gross residual is open (`AT-REVR-26`), and reliably released once the cleanup closes it (`AT-REVR-24`, `AT-REVR-32`) |
| `SOURCE_IDENTITY_VARIANTS` | **1** | the four-column canonical tuple; `grep -rn 'UNIQUE (workspace_id, source_type'` returns only that form |
| `REFUND_EVIDENCE_GAPS` | **0** | `B9-AM-009` |
| `ATTRIBUTION_CHAIN_DERIVATION_AMBIGUITIES` | **0** | `B9-D-A035`, fully specified in `B9_FIRST_TOUCH_MODEL.md` §2, §4 |
| `TRACK_A_ATTRIBUTION_CREATION_GAPS` | **0** | `B9-D-A036` |
| `UNDEFINED_PROVENANCE_RESOLVER_REFS` | **0** | the concept was removed, not renamed |
| `FROZEN_PUBLIC_ID_CONFLICTS` | **0** | `B9-D-A037` — `SRC-*` stays a §B contract string |
| `ANALYTICS_FROZEN_SEMANTIC_AMBIGUITIES` | **0** | `B9-AM-010` |
| `FINANCIAL_RBAC_CONTRADICTIONS` | **0** | `B9-D-A038`; the operation table and `B9_RBAC_TENANCY.md` §2a now agree on all 14 operations, including ops 1, 4 and 12-14 |
| `PROVIDER_STATUS_REVENUE_AUTHORITY_LEAKS` | **0** | B9 never reads a provider; it reads B8 DTOs, only to reject and to reconcile |
| `WORKSPACE_CURRENCY_MUTABILITY_AMBIGUITIES` | **0** | resolution instant named, mutability acknowledged, as-of rejected with the reason it is unbuildable (`B9-D-A043`); `AT-CUR-8`, `AT-CUR-9` **(NC)** |
| `FX_CONVERSION_LEAKS` | **0** | no rate, no rate source, no rate date, no conversion at any layer; `AT-CUR-10` **(NC)** |
| `FILTERED_DISCOVERY_ATTRIBUTION_AMBIGUITIES` | **0** | clause 5 of `B9_FIRST_TOUCH_MODEL.md` §2.2, decided in §2.2a (`B9-D-A044`); `AT-FT-17`, `AT-FT-18` **(NC)** |
| `UNMAPPED_OPERATION_FAILURE_CODES` | **0** | all 36 codes map to a named operation or the universal set; `034`→op 10, `028`→op 1 (`B9_API_DTO_CONTRACTS.md` §4); `AT-API-19` |
| `INVALID_ACCEPTANCE_STIMULI` | **0** | every stimulus re-checked for reachability against its own validation order. `AT-REVR-25` used a scale-5 amount that `B9-AF-008` rejects before `B9-AF-029` could fire; replaced with a reachable scale-4 case |
| `FAILURE_CODE_EXPECTATION_MISMATCHES` | **0** | same sweep; each test's expected code re-derived from the validation sequence that actually runs first |
| `OPERATION_NUMBERING_ERRORS` | **0** | `/attribution` is **op 8** everywhere; one isolated `(op 7)` in the rejected-candidates table corrected |
| `FROZEN_ARTIFACT_COUNT_MISMATCHES` | **0** | metric stated before the number; count and enumeration agree at **11** (`B9_CONTROLLED_AMENDMENTS.md` §1a); `AT-DOM-4` |
| `RESIDUAL_RISK_COUNT_MISMATCHES` | **0** | **8** (`R-1`…`R-8`), from `B9_FAILURE_MODE_ANALYSIS.md` §4 |
| `HANDOFF_QUESTION_COUNT_MISMATCHES` | **0** | **28**, from `B9_IMPLEMENTATION_READINESS.md` §1 |

`Deal.value`, `Plan.price` and `Payment.amount` appear **4 times in total** across the pack: once in an implementer prohibition, once in a policy negation ("derives neither from"), once in a `≠` line, and once in an acceptance-mapping title. **Zero live derivations.**

## 7. Reference integrity — all recomputed

| Counter | Value | Command |
|---|---:|---|
| `UNDEFINED_AT_REFS` | **0** | 295 defined; every reference resolves; `comm -23` empty |
| `UNDEFINED_DECISION_REFS` | **0** | 62 defined (44 A + 12 B + 6 C); `comm -23` empty |
| `BROKEN_FAILURE_REFS` | **0** | 36 defined; `comm -23` empty |
| `BROKEN_AMENDMENT_REFS` | **0** | 13 defined; `comm -23` empty |
| `SEMANTICALLY_WRONG_AMENDMENT_REFS` | **0** | every citation re-read against the amendment it names. `B9-FIX.1` corrected two: `ATT-*` cited `B9-AM-003` (a reconciliation-table row; `ATT-` is frozen and needs no amendment) and the reconciliation process row cited `B9-AM-005` (the `FRC-` prefix) |
| `BROKEN_FRONTEND_REFS` | **0** | 53 defined; `comm -23` empty |
| `BROKEN_CROSS_DOCUMENT_REFS` | **0** | all 36 B9 filenames resolve; all **38** distinct foreign doc/schema refs resolve to real files; **459** cross-document `§` refs resolve to real numbered headings (recomputed by `B9-FIX.2a` with a heading-index parser, not by eye) |
| `DUPLICATE_ID_DEFINITIONS` | **0** | `sort \| uniq -d` empty for AT, decisions, failures, amendments, FB, research |
| `LIVE_PLACEHOLDER_REFS` | **0** | the unresolved-marker scan returns only this row, which names the tokens it searches for |
| `STALE_COUNTERS` | **0** | recomputed by `B9-FIX.2a` from the files, **after** its own edits. Independent countersign found three the `B9-FIX.2` sweep missed — `FROZEN_ARTIFACTS_AFFECTED` (10 above an 11-file list), *"seven"* residual risks against eight, and *"27"* handoff questions against 28. All three are corrected, and the cause is addressed in §7a: the sweep had excluded **this file** and the executive summary from its own scope |
| `STALE_INDEX_COUNTERS` | **0** | `BACKEND_DOCUMENTATION_INDEX.md`'s B9 section is regenerated **last**, from the figures in this matrix after they were recomputed — not from the previous pass's. `B9-FIX.2` propagated its own wrong artifact count into the index; `B9-FIX.2a` corrected both, in that order |
| `FALSE_COMPATIBILITY_CLAIMS` | **0** | every "reused", "unchanged" and "no previously-successful request fails" claim re-tested against the frozen `getAttribution` definition (`"parameters": []`). `B9-FIX.2a` closed the last one: **this file's own** `MULTI_CURRENCY_SUMMATION_LEAKS` row still asserted the withdrawn `B9-FIX.1` rule that `currency` is *required* — the exact change `B9-FIX.2` withdrew, and the one `AT-API-14` **(NC)** forbids (§7a) |
| `FALSE_VERIFICATION_CLAIMS` | **0** | every "verified" in this pack names a command or a frozen quote. `B9-FIX.2` corrected five claims that did not: `B9-AM-007`'s "unchanged request schemas", `B9-AM-011`'s "no previously-successful request becomes a failure", `B9_REVENUE_RECOGNITION_POLICY.md` §7's "used in exactly this form everywhere", `B9_SECURITY_PRIVACY.md` §4's export claim, and the index's "no external research" |

A naive `B9_[A-Z_]+\.md` scan also matches the tail of the real filenames `B7_B9_FINANCE_BOUNDARY.md` and `B8_B9_FINANCE_BOUNDARY.md`, both of which exist. Those substring hits are not references and are excluded; every genuine B9 filename reference resolves.

### 7a. This document is not exempt from its own sweeps (`B9-FIX.2a`)

`B9-FIX.2` ran its semantic sweeps *using* this matrix as the checker and did not run them *against* it. One withdrawn rule and one wrong counter survived here as a result, and the fresh independent countersign found both — inside the file asserting `STALE_COUNTERS = 0` and `FALSE_COMPATIBILITY_CLAIMS = 0`.

That is a method defect, not a typo, so the method is changed rather than the two lines quietly patched:

> **The verifier document is verified last, and by the same sweeps as every other document.** Every counter, rule restatement and compatibility claim in this file is re-derived from the source document that owns it, after all other edits are complete.

What the `B9-FIX.2a` self-audit re-derived here, and against what:

| Claim in this matrix | Re-derived from | Result |
|---|---|---|
| the multi-currency rule | `B9_API_DTO_CONTRACTS.md` §3a, `B9-AM-012`, `B9-AF-036`, `AT-API-14` | **was wrong** — asserted the withdrawn required-parameter rule; corrected |
| `FROZEN_ARTIFACTS_AFFECTED` | `B9_CONTROLLED_AMENDMENTS.md` §1a enumeration | **was wrong** — 10 against an 11-file list; metric defined, corrected to 11 |
| `ACCEPTANCE_TEST_COUNT`, categories, NCs | `B9_ACCEPTANCE_TESTS.md` rows | recomputed: 295 / 29 / 205 |
| `CLASS_A/B/C_DEFINED` | `B9_DECISION_REGISTER.md` rows | recomputed: 44 / 12 / 6 |
| `FAILURE_SCENARIO_COUNT` | `B9_FAILURE_CATALOG.md` rows | 36, contiguous — unchanged |
| `CONTROLLED_AMENDMENT_COUNT` and its split | `B9_CONTROLLED_AMENDMENTS.md` `###` headings | 13 = 10 + 3 + 0 — unchanged |
| `RESEARCH_FACT_COUNT` and its split | `B9_RESEARCH_REGISTER.md` rows | 20 = 19 + 1 — unchanged |
| `FRONTEND_BEHAVIOR_COUNT` and A/B/C/D | `B9_FRONTEND_BEHAVIOR_INVENTORY.md` class column | 53 = 35/6/7/5 — unchanged |
| every reference-integrity counter | the id sets themselves | all 0 — unchanged |
| every drift and leakage counter | `git status`, `git diff --name-only` | all 0 — unchanged |

```
VERIFICATION_MATRIX_SELF_AUDIT_GAPS = 0
```

## 8. Frozen drift

| Counter | Value | Command |
|---|---:|---|
| `B0_DRIFT` … `B8_DRIFT` | **0** each | `git diff --name-only 0c424c8a -- Docs/backend/B{1..8}/` and `git diff --name-only 0c424c8a -- 'BACKEND_*.md' 'B0_*.md'` |
| Frontend drift | **0** | `git diff --name-only 0c424c8a -- client/` |
| `IMPLEMENTATION_LEAKAGE` | **0** | no Django/DRF/SQL DDL/Celery/Redis/provider code; 0 non-`.md` files |
| `B10_FILES_CREATED` | **0** | `ls -d Docs/backend/B10` → absent |
| `B11_FILES_CREATED` | **0** | absent |
| `B12_FILES_CREATED` | **0** | absent |

Only `Docs/backend/B9/` and `BACKEND_DOCUMENTATION_INDEX.md` are created or modified.

## 9. Governance

| Counter | Value |
|---|---:|
| `CLASS_A_DEFINED` / `CLASS_A_UNRESOLVED` | **44** / **0** |
| `CLASS_B_DEFINED` / `CLASS_B_UNRESOLVED` | **12** / **0** |
| `CLASS_C_DEFINED` / `CLASS_C_UNRESOLVED` | **6** / **0** |
| `CONTROLLED_AMENDMENT_COUNT` | **13** |
| `ADDITIVE_AMENDMENTS` | **10** |
| `COMPATIBLE_CLARIFICATIONS` | **3** |
| `NON_ADDITIVE_AMENDMENTS` | **0** |
| `MISSING_CONTROLLED_AMENDMENTS` | **0** |
| `RESIDUAL_RISK_COUNT` | **8** (`R-1`…`R-8`) |
| `HANDOFF_QUESTION_COUNT` | **28** |
| `FROZEN_ARTIFACTS_AFFECTED` | **11** | contract-bearing artifacts only; the metric, the enumeration and the three excluded downstream-synchronization files are in `B9_CONTROLLED_AMENDMENTS.md` §1a |
| `FAILURE_SCENARIO_COUNT` | **36** (`B9-AF-001`…`036`, contiguous) |
| `FAILURE_SCENARIO_DUPLICATES` / `GAPS` / `OUT_OF_SCOPE` | **0** / **0** / **0** |
| `ACCEPTANCE_TEST_COUNT` | **295** |
| `ACCEPTANCE_CATEGORY_COUNT` | **29** |
| `NEGATIVE_CONTROL_COUNT` | **205** |
| `DUPLICATE_ACCEPTANCE_TESTS` | **0** |
| `RESEARCH_FACT_COUNT` | **20** (19 VERIFIED — 14 repository, 5 external primary sources — 0 PARTIAL, 1 UNRESOLVED, 0 CONTRADICTED) |
| `CLASS_A_EXTERNAL_DEPENDENCY_GAPS` | **0** |

## 10. What this matrix does **not** claim

- It does not claim the design is correct — only that its counters are reproducible and its cross-references resolve.
- It does not claim accounting or regulatory compliance; `B9_RESEARCH_REGISTER.md` marks those UNRESOLVED.
- It records that external research **was** performed in the `B9-FIX.1` pass against official primary sources, and that it changed no design decision (`B9_RESEARCH_REGISTER.md` §1, §3).
- It does not substitute for independent verification, which B9 still awaits.
