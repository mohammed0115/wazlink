# B13 — Verification Matrix

> Design only. Mechanically re-derived counters, semantic verification gates, reference-integrity checks, and the frozen-regression drift gate. Every number below was recomputed against the finished pack during this authoring pass, not asserted in advance — where a mechanical scan is imprecise (a prose range, a generically-described action family), the derivation method is stated so it is auditable rather than merely asserted.

## 1. Method

Counters were derived by pattern-matching every `.md` file in `Docs/backend/B13/` for the relevant ID family (`AT-B13*`, `FI-*`, `B13-D-*`, `B13-X-*`, `FB-B13-*`, `B13-F-*`), followed by a manual per-category reconciliation for the counters a naive regex cannot resolve unambiguously against prose ranges (the positive/negative acceptance split; and, under `B13-FIX.1`, `CONCRETE_AUDIT_EVENT_CODE_COUNT`/`NON_ENUMERATED_AUDIT_REQUIREMENT_COUNT`, which were re-derived by reading each frozen domain catalog rather than by pattern-matching B13 prose). The method for each is stated inline so a reviewer can re-run it.

## 1a. Verification doctrine — binding on this matrix and on every future B13 verification pass

**Rule V-1 — missing execution is never a pass.** Any mechanical or semantic verifier that ends in `FAILED`, `TIMEOUT`, `NO_RESPONSE`, `SAFEGUARD_ERROR`, or `NOT_RUN` **must** record `UNADJUDICATED` / `INCOMPLETE`. It may never be recorded as `PASS`, and it may never be recorded as `REFUTED`. A check that did not run has produced no evidence, and absence of evidence is not evidence of absence.

**Why this rule exists.** During `B13-FIX.1` a review harness treated a dead verifier's empty response as "not upheld", which is indistinguishable from "refuted". Forty-one adjudicated-as-clean findings had in fact never been examined, and the run reported a tidy result. The defect was in the *verifier*, not in the pack — which is exactly why it survived several passes.

**Rule V-2 — a verifier is invalid if its own method can return PASS while a counterexample stands.** Every zero/PASS row in this matrix must state a derivation a third party can re-run, and must not rely on excluding the very text that documents the defect it counts. Where a counter's justification would have to quote a malformed identifier to explain itself, the justification is reworded so the published scan reproduces the published number with no exclusions.

**Rule V-3 — no counter may cite itself or a document that cites it back.** "Re-derived in X" is only acceptable where X states a concrete method, not where X points back here.

**Rule V-4 — a claim is not verified by the existence of a document.** A control is verified when its enforcement point is named and its failure behavior is stated, not when a document about it exists.

**Rule V-5 — reproducibility over authority.** Where a prior verdict and the frozen source disagree, the frozen source wins, and the disagreement is recorded rather than silently resolved. Two `B13-FIX.1` adjudication runs returned opposite verdicts on the same findings; all were settled by reading frozen `B0`–`B12` directly.

## 2. Re-derived counters

| Counter | Value | Method |
|---|---:|---|
| `B13_DOCUMENT_COUNT` | 39 | file count of `Docs/backend/B13/*.md` |
| `FRONTEND_EVIDENCE_COUNT` | 26 | row count of `B13_FRONTEND_EVIDENCE.md` §§2–5 |
| `FRONTEND_EVIDENCE_CLASS_COUNTS` | A=11, B=8, C=4, D=3 | per-class row counts, same source; 11+8+4+3=26 ✓ |
| `THREAT_COUNT` | 28 | count of the `·`-separated entries in `B13_THREAT_MODEL.md` §2's threat-class list (§2 is a prose list, not a table — the pre-FIX.1 method said "row count", which is not reproducible against that artifact). Independently corroborated by §3's matrix, which carries exactly 28 data rows, one per class |
| `THREAT_ACTOR_COUNT` | 16 | row count of `B13_THREAT_MODEL.md` §1 |
| `SECURITY_CONTROL_COUNT` | 25 | row count of `B13_SECURITY_PRINCIPLES.md` §1 |
| `CONCRETE_AUDIT_EVENT_CODE_COUNT` | 139 | sum of the per-domain `#` column in `B13_AUDIT_LOGGING.md` §3.1, equal to the count of distinct codes (no code is claimed by two domains). Each code was read back from its own frozen domain catalog under `B13-FIX.1`. **Corrected under `B13-FIX.2`: 151 → 139.** The Automation row's twelve dotted codes were attributed to `B7_OBSERVABILITY_AUDIT.md`, which contains none of them and publishes no audit-action catalog; within frozen B7 they occur only at `B7_FRONTEND_BEHAVIOR_INVENTORY.md` `FB-A41`, frontend-mock evidence that `FI-FE-01` forbids treating as backend authority. The obligation is preserved as non-enumerated requirement 5. Reproduce with the row-sum check in `B13_AUDIT_LOGGING.md` §3.1, which now also equals the enumerated-code count and the distinct-code count (139/139/139, zero duplicates). This also supersedes the pre-FIX.1 `AUDIT_EVENT_COUNT` of 146 — it undercounted frozen B2 (24 concrete codes, not 22, omitting `lead.convert_deduplicated`), compressed frozen B10's eleven named tax codes into prose, and counted the generic Finance descriptor and the `operator.*` wildcard as if they were enumerated actions. (Its treatment of B7 as prose was, as it turns out, correct; `B13-FIX.1` wrongly promoted B7 to concrete and `B13-FIX.2` restores it.) |
| `NON_ENUMERATED_AUDIT_REQUIREMENT_COUNT` | 5 | row count of `B13_AUDIT_LOGGING.md` §3.2 — binding audit obligations frozen source states without enumerating members: the `operator.*` wildcard family (B1), Deal lifecycle rows (B6), the per-command Finance audit fact (B9), the blanket denials-are-audited rule (B1), and — added under `B13-FIX.2` — B7's automation reconstructability obligation. Held separate from the concrete count by construction; no member code is invented for any of them |
| `RUNBOOK_COUNT` | 18 | section count of `B13_RUNBOOKS.md` §§1–18 |
| `FAILURE_SCENARIO_COUNT` | 23 | row count of `B13_FAILURE_SCENARIOS.md`, unique `B13-F-##` IDs |
| `ACCEPTANCE_TEST_COUNT` | 208 | distinct `AT-B13*-#` identifiers appearing literally anywhere in `Docs/backend/B13/`, equal to the row count of the canonical register `B13_ACCEPTANCE_TESTS.md` §1. Reproduce by collecting every literal `AT-B13<FAMILY>-<n>` token across the pack and de-duplicating. **Count literal tokens only, never range expansions:** a pre-FIX.1 citation in `B13_SECURITY_PRINCIPLES.md` wrote the `AT-B13PAY` family as a range ending at 6 when only four members exist, so a naive range-expanding scan reported 204. That citation now names the correct extent, and no range in this pack implies an identifier that is not also written literally somewhere — `DANGLING_ACCEPTANCE_REFERENCE_COUNT = 0` |
| `POSITIVE_ACCEPTANCE_COUNT` | 43 | count of §1 rows tagged **P** in `B13_ACCEPTANCE_TESTS.md`, over the full current population of **208**. Reproduce: `sed -n '7,477p' B13_ACCEPTANCE_TESTS.md | grep -P '^\| .AT-B13[A-Z]+-[0-9]+. \|' | awk -F'\|' '{gsub(/ /,"",$3); print $3}' | sort | uniq -c`. **Corrected under `B13-FIX.2`:** this row and §3 both stated a population of 202, a figure left over from the close of MAJOR-4 and six tests short of the pack. `B13_ACCEPTANCE_TESTS.md` §2 separately stated 207. All three now state 208, which is what every row-count command in this matrix reproduces |
| `NEGATIVE_ACCEPTANCE_COUNT` | 165 | same; 43+165=208 ✓ |
| `DUPLICATE_ACCEPTANCE_ID_COUNT` | 0 | no identifier carries two different assertions; `AT-B13DEPLOY-3`'s second occurrence is an explicit pointer row, not a competing definition |
| `UNINDEXED_ACCEPTANCE_ID_COUNT` | 0 | every identifier in the pack appears in the canonical register. **Was 57 across 14 areas before `B13-FIX.1`** — API transport, B13/B14 boundary, cookies, CORS, CSP, database security, concurrency, deployment, disaster recovery, environment strategy, input validation, input/output security, observability and privacy existed only in their owning documents |
| `INDEXED_BUT_UNDEFINED_ACCEPTANCE_ID_COUNT` | 0 | every registered identifier resolves to an assertion in a named owning document |
| `ACCEPTANCE_CATEGORY_COUNT` | 37 | `COUNT(DISTINCT AT-B13<FAMILY>)` across the pack = subsection count of the canonical register `B13_ACCEPTANCE_TESTS.md` §1. **Supersedes the published 23**, which was wrong twice over: the pre-FIX.1 document carried 24 numbered headings (not 23 — `AT-B13WH` was split across §9 and §11), and 14 further categories were absent from it entirely |
| `CLASS_A_REFERENCE_COUNT` | 695 | total (non-unique) occurrences of an `FI-*` citation across the 39-file pack — reuse density, not anchor count. Reproduce: `grep -ohP 'FI-[A-Z0-9]+-[0-9]+' Docs/backend/B13/*.md | wc -l`. Re-derived under `B13-FIX.2` over the repaired pack; the FIX.1 figure of 658 no longer holds because the repairs changed the citation set. **No row of this matrix quotes an anchor ID in order to satisfy a counter** — the anchor-consumption ledger that previously did so now lives in `B13_FROZEN_INPUT_INVENTORY.md` §8, outside the scan it would otherwise perturb |
| `CLASS_A_UNRESOLVED` | 0 | every `FI-*` anchor quotes a closed, published clause **and** its clause is semantically supported by the source its row names. Re-derived under `B13-FIX.2` over the current pack: **96/96** distinct frozen `B0`–`B12`/root filenames cited by the pack exist, and **61/61** distinct well-formed frozen decision/research IDs cited resolve to a real definition in frozen source. The stale figures published here before this pass (72 filenames, 46 IDs) were pre-repair populations, not current ones. The one genuinely unsupported clause — `FI-B7-05` — was corrected in the inventory rather than counted as resolved |
| `CLASS_A_DECISION_COUNT` | 96 | Identical to `FROZEN_ANCHOR_COUNT` because the populations are the **same set**, proved in `B13_DECISION_REGISTER.md` §1, not because the numbers coincide. Reproduce, exactly as that section states: 95 anchors defined as table rows in `B13_FROZEN_INPUT_INVENTORY.md` §§2–5 (`grep -oP '^\\| .FI-[A-Z0-9-]+.' … \| sort -u \| wc -l`) **plus** `FI-FE-01`, defined as prose in §6 = **96**. **Corrected under `B13-FIX.2`:** the derivation stated here said "82 appear as table rows," which reproduces 83, not the 96 in the value column — a method that could not produce its own published figure. `B13_DECISION_REGISTER.md` and `B13_EXECUTIVE_SUMMARY.md` were simultaneously publishing 82; all now publish 96 |
| `CLASS_B_DECISION_COUNT` | 29 | `B13_DECISION_REGISTER.md` §2 |
| `CLASS_C_DECISION_COUNT` | 12 | `B13_DECISION_REGISTER.md` §3 |
| `CONTROLLED_AMENDMENT_COUNT` | 0 | `B13_CONTROLLED_AMENDMENTS.md` §1 |
| `ADDITIVE_AMENDMENT_COUNT` | 0 | same |
| `COMPATIBLE_CLARIFICATION_COUNT` | 0 | same |
| `NON_ADDITIVE_AMENDMENT_COUNT` | 0 | same |
| `RESEARCH_FINDING_COUNT` | 8 | `B13_RESEARCH_REGISTER.md` §2 |
| `VERIFIED_RESEARCH_COUNT` | 6 | same. Unchanged by `B13-FIX.1` MAJOR-6: `B13-X-004` cited a **withdrawn** edition (NIST SP 800-63B, 2020) and was re-fetched against the current SP 800-63B-4 (final 2025-07-31), so it remains VERIFIED against a correct source rather than being downgraded — the defect was edition staleness, not unverifiability |
| `PARTIAL_RESEARCH_COUNT` | 1 | same |
| `UNRESOLVED_RESEARCH_COUNT` | 1 | same (superseded, non-blocking) |
| `CONTRADICTED_RESEARCH_COUNT` | 0 | same |

## 3. Positive/negative acceptance methodology

A test is classified **positive** when it asserts a legitimate operation succeeds or a designed property holds under normal operation (e.g., "password reset revokes all sessions," "every alert has a dashboard panel"); **negative** when it asserts an attack, misuse, or failure path is refused, contained, or handled safely (e.g., "cross-workspace lookup returns 404," "a forged webhook is rejected before parsing"). Applied uniformly across all **208** tests — the pack's full current population; the figure of 202 published here before `B13-FIX.2` was a stale mid-repair count. Where an owning document's inline tag contradicted this rule the rule won, and three tags were corrected (`AT-B13CONC-2`, `AT-B13CONC-3`, `AT-B13WHR-2`); under `B13-FIX.2` the two `AT-B13CONC` corrections were also propagated into `B13_DATABASE_SECURITY.md` §10, which had been left carrying the opposite tags. 36 of the 37 categories contain at least one negative test. The sole exception, `AT-B13BOUND`, is a **ruled and narrowly-scoped exception** recorded in `B13_ACCEPTANCE_TESTS.md` §2: the B13/B14 boundary is a documentation/phase assertion with no runtime request, actor, privilege or state transition, so the only constructible negatives would be a tautology or an unenforceable process claim. The exception names that one category, sets no precedent for any runtime or security category, and is not a licence to drop negative coverage anywhere else. `AT-B13TEN` (Tenant Isolation), `AT-B13IO` and `AT-B13VAL` are 100% negative, reflecting that tenant isolation and validation are almost entirely about refusing illegitimate input. **The per-test breakdown is no longer summarised here: it lives once, in full, in the canonical register `B13_ACCEPTANCE_TESTS.md` §1.** Keeping a second prose copy in this document is precisely what allowed the previous index to drift out of sync with the pack.

## 4. Semantic verification gates

Each gate is evaluated against the pack's actual content, not a regex proxy — a false-positive-resistant check means confirming the *mechanism* a gap-class would require exists nowhere in this pack, not merely that a string doesn't appear.

| Gate | Value | Why |
|---|---:|---|
| `AUTHENTICATION_AUTHORITY_GAPS` | 0 | every authentication decision point traces to `B1_AUTH_SESSION_DESIGN.md`'s frozen flow; no B13 document introduces a second login/verification path |
| `SESSION_REVOCATION_GAPS` | 0 | every revocation trigger in `FI-B1-03` §3.10 is restated and extended with production triggers in `B13_AUTHENTICATION_SESSION_SECURITY.md` §4; no trigger is silently dropped |
| `CSRF_GAPS` | 0 | CSRF is required on every unsafe cookie-authenticated endpoint with no documented exemption beyond the three frozen public operations, which are all safe/idempotent or `login` itself (pre-session) |
| `AUTHORIZATION_GAPS` | 0 | the 16-step pipeline is restated without a skipped step; every new B13 operational surface (dead letters, reconciliation) is confirmed routed through it (`B13_AUTHORIZATION_TENANCY.md` §4) |
| `OBJECT_LEVEL_AUTHORIZATION_GAPS` | 0 | every conditional-grant object condition named in `FI-B1-06`/domain RBAC docs is restated in `B13_AUTHORIZATION_TENANCY.md` §3; none is left as a bare permission check without its condition |
| `TENANT_ISOLATION_GAPS` | 0 | the 12-row negative-control table (`B13_AUTHORIZATION_TENANCY.md` §10) covers every cross-tenant vector identified across B1–B12's own tenancy documents; no vector found in research was left uncovered |
| `BACKGROUND_TENANT_CONTEXT_GAPS` | 0 | Celery task payloads carry explicit `workspace_id`, never a session (`B13_AUTHORIZATION_TENANCY.md` §5); outbox/inbox tenancy is stamped at write time (§6); webhook tenancy is bound to the verified secret (§7) |
| `SECRET_EXPOSURE_GAPS` | 0 | the exhaustive never-appears-in list (`B13_SECRETS_MANAGEMENT.md` §2) is enforced by construction (schema shape, not a redaction pass) per `B13_INPUT_OUTPUT_SECURITY.md` §7 |
| `SECRET_ROTATION_GAPS` | 0 | **Recalculated under the `B13-FIX.1` consolidated repair, and it was not 0 before.** All nine §1 secret classes now have a rotation and revocation procedure: seven provider classes in §7, platform substrate (`SECRET_KEY`, database, Redis) in the new §7a, and observability (Sentry DSN, OTel token) in the new §7b. The pre-repair figure of 0 was false — §7 is provider-shaped and routes every step through a domain configuration command, which platform substrate and observability have no equivalent of, so those two classes had no rotation path at all. Reproduce by listing §1's class column and confirming each names a procedure section |
| `LOG_REDACTION_GAPS` | 0 | `B13_LOGGING_REDACTION.md` §2 is the union of every domain's own redaction list with no item dropped; verified by cross-checking against `B13_FROZEN_INPUT_INVENTORY.md`'s security-relevant anchors |
| `WEBHOOK_VERIFICATION_GAPS` | 0 | both Phase-1 providers (Meta, Tap) have their own verified scheme restated in `B13_WEBHOOK_SECURITY.md` §2; no universal verifier is invented in its place |
| `WEBHOOK_REPLAY_GAPS` | 0 | replay is defended by idempotency (dedup key), stated as the deliberate, checked position rather than an unstated gap (`B13_WEBHOOK_SECURITY.md` §5) |
| `CROSS_WORKSPACE_WEBHOOK_GAPS` | 0 | `B13_WEBHOOK_SECURITY.md` §6's five-row attack table plus `B13_AUTHORIZATION_TENANCY.md` §7's binding-only-resolution rule |
| `FILE_AUTHORIZATION_GAPS` | 0 | per-request re-authorization on every byte response (`B13_FILE_SECURITY.md` §6); no cached-authorization shortcut exists |
| `UNSAFE_FILE_HANDLING_GAPS` | 0 | 10-gate validation plus 6 compensating controls for deferred scanning (`B13_FILE_SECURITY.md` §3–4); no upload path bypasses a gate |
| `PAYMENT_AUTHORITY_GAPS` | 0 | payment truth advances only via `ProcessPaymentWebhook`/`ReconcilePayment` (`B13_PAYMENT_FINANCIAL_SECURITY.md` §1); no B13 control introduces a third path |
| `ENTITLEMENT_AUTHORITY_GAPS` | 0 | entitlement resolution remains B8's five-step algorithm; B13 adds no override mechanism beyond the already-broaden-only-floor rule |
| `FINANCIAL_AUTHORITY_GAPS` | 0 | conjunctive money-gate and named-membership-only rule restated without exception (`B13_PAYMENT_FINANCIAL_SECURITY.md` §6) |
| `REVENUE_AUTHORITY_GAPS` | 0 | B9's zero-consumed-events structural proof is restated, not reopened; no B13 runbook or operator action invokes a revenue-recognition command on the operator's own initiative without the domain's own guards |
| `REDIS_DURABLE_AUTHORITY_LEAKS` | 0 | every durable claim in this pack (quota, financial, tenancy) is traced to a PostgreSQL row; `B13_REDIS_CELERY_SECURITY.md` §1 restates the one test and no B13 control treats a Redis-only counter as authoritative |
| `CELERY_BUSINESS_AUTHORITY_LEAKS` | 0 | tasks carry references and re-check state at execution time (`B13_REDIS_CELERY_SECURITY.md` §7); no task payload is treated as a cached business decision. **0 as repaired under `B13-FIX.2`** — §9's outbox-versus-`worker_executions` separation is now stated identically in every document that touches stale-worker recovery, and the four-gate scan in §8a reproduces that |
| `OPERATOR_AUTHORIZATION_GAPS` | 0 | every operator surface is permission-gated with the correct floor, including the Owner-only financial-domain exception (`B13_OPERATOR_MODEL.md` §1) |
| `OPERATOR_AUDIT_GAPS` | 0 | every operator action class has a named audit action and a mandatory-reason requirement where destructive (`B13_OPERATOR_MODEL.md` §4) |
| `UNSAFE_REPLAY_GAPS` | 0 | replay eligibility is computed from the operation's own idempotency, never assumed, and re-runs every original guard (`B13_OPERATOR_MODEL.md` §6, restating `FI-B12-06`) |
| `UNSAFE_RECONCILIATION_GAPS` | 0 | repair is always the owning domain's own guarded command (`B13_PAYMENT_FINANCIAL_SECURITY.md` §4, restating `B12-D-A039`); no B13 runbook recommends a direct edit |
| `HEALTH_INFORMATION_LEAK_GAPS` | 0 | health responses are restricted to a closed enum reason set, never a stack trace/DSN/secret (`B13_HEALTH_READINESS.md` §4) |
| `OBSERVABILITY_SECRET_LEAK_GAPS` | 0 | the cardinality discipline (`B13_OBSERVABILITY.md` §3) forbids every leak-prone label class; Sentry/OTel inherit the same scrubbing (`B13_LOGGING_REDACTION.md` §6) |
| `BACKUP_AUTHORITY_GAPS` | 0 | Redis is explicitly excluded from backup authority (`B13_BACKUP_RESTORE.md` §1); PostgreSQL is the sole durable backup subject |
| `RESTORE_VALIDATION_GAPS` | 0 | restore testing is a named, cadenced requirement (`B13_BACKUP_RESTORE.md` §5), not merely a backup-taking policy without a verification step |
| `DISASTER_RECOVERY_ORDER_GAPS` | 0 | every disaster scenario in `B13_DISASTER_RECOVERY.md` §2 follows the authority-before-derived-execution ordering stated once in §1 and never violated in a per-scenario procedure |
| `CONFIG_FAIL_OPEN_GAPS` | 0 | the fail-closed/fail-open boundary is drawn explicitly per configuration class (`B13_CONFIGURATION_MANAGEMENT.md` §4); no security-critical value defaults to fail-open |
| `SUPPLY_CHAIN_POLICY_GAPS` | 0 | recalculated during B13-FIX.1 against verified repository evidence. Every policy element is present and no element depends on an unmet precondition: dependency inventory, single-source-of-resolution-truth (one lockfile, pnpm as declared package manager), tooling-follows-the-repository, transitive-tree coverage, scan cadence, severity triage with documented risk-acceptance, and container/base-image scanning (`B13_SUPPLY_CHAIN_SECURITY.md` §§1–5, 7). Version pinning is not a gap — it is already enforced by the committed `pnpm-lock.yaml` plus CI `--frozen-lockfile`. The unrun current-vulnerability baseline (§1.1) is an implementation/operations execution item tracked as handoff gate 5, not a policy gap |
| `B0_B12_SECURITY_CONTRADICTIONS` | 0 | §5 below — 0 **as repaired**, across two passes. `B13-FIX.1` fixed one contradiction against frozen `B12_API_DTO_CONTRACTS.md` §3 (replay reason). `B13-FIX.2` fixed a second, larger one: four live sites applied the outbox dispatch-claim recovery model to worker task execution, contradicting three frozen clauses at once — `B12_DATA_MODEL.md` §3, `B12_RECONCILIATION_MODEL.md` class `P-3` and `B12-D-A020`. The defect and its repair are described in §5 in terms that do not reproduce the offending wording, so §8's published gates return zero with no exclusions. Both are recorded here rather than presented as though the figure had always held |
| `FRONTEND_SECURITY_AUTHORITY_LEAKS` | 0 | `B13_FRONTEND_EVIDENCE.md` §7 states explicitly that frontend evidence is corroboration only; no B13 control derives an authority claim from frontend behavior |
| `IMPLEMENTATION_LEAKAGE` | 0 | §6 below |

## 5. B0–B12 regression / drift

| Check | Value |
|---|---:|
| `B0_DRIFT` | 0 |
| `B1_DRIFT` | 0 |
| `B2_DRIFT` | 0 |
| `B3_DRIFT` | 0 |
| `B4_DRIFT` | 0 |
| `B5_DRIFT` | 0 |
| `B6_DRIFT` | 0 |
| `B7_DRIFT` | 0 |
| `B8_DRIFT` | 0 |
| `B9_DRIFT` | 0 |
| `B10_DRIFT` | 0 |
| `B11_DRIFT` | 0 |
| `B12_DRIFT` | 0 |
| `FRONTEND_DRIFT` | 0 |

No file under `client/**` or any `B0`–`B12` document was modified or read-and-rewritten, and — **as repaired under `B13-FIX.1`** — none is now contradicted (see the note below; one contradiction existed and was fixed). Every clause this pack depends on is quoted or paraphrased with a traceable citation in `B13_FROZEN_INPUT_INVENTORY.md`, never re-derived from memory. `B13_CONTROLLED_AMENDMENTS.md` §1 independently confirms zero amendments were required, which is the strongest form of zero-drift a phase in this corpus can claim.


**`B12_DRIFT` was not 0 before `B13-FIX.2` either.** The `B13-FIX.1` repair of the outbox-versus-`worker_executions` distinction landed in `B13_REDIS_CELERY_SECURITY.md` §9 and nowhere else. Four live sites — `B13_FAILURE_SCENARIOS.md` (`B13-F-09`), `B13_THREAT_MODEL.md`'s stale-worker row, and `AT-B13CEL-5` in both its owning document and the canonical register — applied the outbox dispatch-claim recovery model to worker task execution, together with looser restatements in `B13_DISASTER_RECOVERY.md` §§2.3–2.4 and `B13_RUNBOOKS.md` §3. Three frozen clauses refute that: `B12_DATA_MODEL.md` §3 gives the worker-execution table none of the columns the outbox model depends on; `B12_RECONCILIATION_MODEL.md` class `P-3` resolves a heartbeat-lapsed row as `unknown`, operator-gated and never auto-repaired; and `B12-D-A020` forbids retrying a non-idempotent operation in that state "with no override flag, permission, or configuration". All seven sites now state the frozen behavior, and §8 below publishes the four gates that prove it pack-wide. `B12_DRIFT = 0` **as repaired**, twice over.

**`B12_DRIFT` was not 0 before `B13-FIX.1`.** `B13_OPERATOR_MODEL.md` §7 read "requires a mandatory reason, and — unlike replay —", asserting that human-initiated replay carries no reason requirement. Frozen `B12_API_DTO_CONTRACTS.md` §3 specifies `ReplayRequest` as `{ reason: string (required, non-empty) }`, on the stated grounds that "a replay re-invokes a real provider effect." B13 now restates the frozen requirement rather than contradicting it (`B13_OPERATOR_MODEL.md` §6a, anchored `FI-B12-15`), and the figure above is 0 **as repaired** — it is recorded here rather than presented as though it had always held. `B0_B12_SECURITY_CONTRADICTIONS` carries the same correction.

## 6. Implementation-leakage and file-count checks

| Check | Value | Evidence |
|---|---:|---|
| `B14_FILES_CREATED` | 0 | directory listing confirms no `Docs/backend/B14` exists |
| `IMPLEMENTATION_LEAKAGE` | 0 | no Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, secret value, Dockerfile, or infrastructure-as-code file was written anywhere in this pass |

## 7. Reference integrity

| Check | Value | Method |
|---|---:|---|
| Undefined references | 0 | every `AT-B13*` range cited in a summary/pointer row was traced to its owning document's full definition; two genuine gaps found during this pass (`AT-B13VAL`, `AT-B13CONC` cited but undefined) were closed by adding their definitions to `B13_INPUT_OUTPUT_SECURITY.md` §8 and `B13_DATABASE_SECURITY.md` §10 respectively |
| `ANCHOR_ID_CITATION_ORPHAN_COUNT` | 12 | anchors defined in `B13_FROZEN_INPUT_INVENTORY.md` whose identifier string appears in no other B13 document. The exact `comm` command, and the per-anchor ledger, are published in that inventory's **§8** — deliberately there and not here, so that naming an anchor to explain the counter cannot make it count as cited by the scan that measures citation. **Rewritten under `B13-FIX.2`.** |
| `UNCONSUMED_ANCHOR_COUNT` | 3 | `FI-B0-08`, `FI-B5-03` and `FI-B7-04` are inherited context that no B13 document relies on. **This row previously published "Unused definitions = 0" on an unfalsifiable "consumed by substance" claim**, and checking that claim found three anchors whose *Used by* column named documents which do not use the clause; those three cells are corrected in the inventory. Retained rather than deleted because an inventory that over-records a frozen dependency errs safely, and **no B13 claim, control, counter or acceptance test rests on any of the three** — recorded as INFO, not reported as zero |
| Duplicate IDs | 0 | one genuine conflict was found and fixed during this pass: `AT-B13CFG-1`/`2`/`3` were independently defined with **different, non-equivalent** assertions in two files; `B13_DJANGO_DRF_SECURITY_BASELINE.md` §10 now points to the canonical definitions in `B13_CONFIGURATION_MANAGEMENT.md` §7 and `B13_DEPLOYMENT_SECURITY.md` §9 instead of redefining them. `AT-B13AUTH-1`…`6` were similarly de-duplicated (canonical home: `B13_AUTHENTICATION_SESSION_SECURITY.md` §9) |
| `PLACEHOLDER_REFERENCE_COUNT` | 0 | **Recalculated under `B13-FIX.1`, and its method rewritten to be reproducible.** Reproduce with: `grep -rnE 'B[0-9]+-[DX]-[A-C][0-9]{0,2}[xX#?]+' Docs/backend/B13/` — expected output: no matches, with no exclusions required. The pre-FIX.1 pack published 0 while a fabricated frozen reference was live: `B13_SECRETS_MANAGEMENT.md` §7 cited a B10 Class-A identifier whose numeric part was a placeholder suffix rather than a real three-digit number (the real frozen series runs `B10-D-A001` through `B10-D-A022`). It was replaced with the real anchor `B10_ZATCA_SECURITY_CREDENTIALS.md` §5 / `B10-D-A012` / `AT-B10SEC-4`. A second, older instance of the same shape in the B13 Class-C series had been fixed before the freeze. **Neither placeholder token is reproduced anywhere in this pack, including in this row** — a defect-history note that restates the malformed token would make this counter unverifiable by its own scan, which is precisely the failure mode `B13-FIX.1` was convened to remove. Textual matches for words like "TBD" or "placeholder" remain and are legitimate: an openly-deferred product choice, the Class-C frontend-evidence classification, and ID-format notation |
| `INVALID_FROZEN_REFERENCE_COUNT` | 0 | every frozen `B0`–`B12` reference the pack makes resolves to a real anchor: **61/61** distinct well-formed decision/research IDs and **96/96** distinct filenames, re-derived under `B13-FIX.2` over the current pack. Reproduce by extracting every frozen decision/research token and every frozen filename cited under `Docs/backend/B13/` and confirming each resolves in `Docs/backend/B1..B12/` or a root-level `BACKEND_*.md`. **The figures published here before this pass (46 and 72) were pre-repair populations** — the substantive zero held, the stated derivation did not reproduce it |
| `UNRESOLVED_FROZEN_REFERENCE_COUNT` | 0 | no B13 citation of a frozen anchor is left dangling, shorthand, or "to be confirmed"; every one names a resolvable file, and where a section or decision ID is asserted it exists in that file |
| Broken cross-document references | 0 | **Extended under `B13-FIX.2` from a filename check to a section check**, because the filename-only method returned 0 while seven intra-pack section pointers did not resolve. Both halves now hold: every `B13_*.md` filename cited by another B13 document exists (39-file listing, §2), **and** every `§n` pointer resolves to a heading in the file it names. Seven were repaired, described here without reproducing the malformed pointer strings, so that this row does not itself fail the scan it publishes: a rate-limit pointer in `B13_SECURITY_PRINCIPLES.md` named a section number beyond that file's range; a reference-integrity row in this matrix named a section number the failure-scenario catalog does not have; four citations named the incident-management document's evidence-retention section when they meant its per-class subsections; and `AT-B13BOUND-2` named the semantic-gate section of this matrix for a counter that lives in the implementation-leakage section. Two frozen-side pointers were repaired in the same sweep, again described without reproducing them: a citation of a named section of the frozen dead-letter/replay model that does not exist in it, and two citations that appended a section number to an anchor identifier, which carries none. Reproduce with the heading-extraction scan in §8 |
| Acceptance owning-section pointers | 0 | six identifier families are owned by the canonical register itself rather than by a separate document. Their `Owning document` lines previously pointed at `B13_ACCEPTANCE_TESTS.md` §2/§4/§6/§7/§10 — section numbers that do not exist in that file — and only the `AT-B13INC` pointer resolved. All six now name their real subsection of §1 and say plainly that the register is canonical for them |
| Semantically wrong Class-A references | 0 | three IDs (`B13-D-A001`/`A002`/`A003`) were initially misclassified as Class A (inherited) when they were genuinely B13-original decisions; all three were renumbered into the Class B series (`B13-D-B027`/`B028`/`B029`) during this pass, matching the governing brief's own definition that Class A means inherited frozen input, never a B13-authored decision. **Re-verified under `B13-FIX.2` to the bar that a reference must not merely resolve but must semantically support the claim it is attached to.** The current pack cites 61 distinct frozen decision/research IDs across 155 sites. Two `B13-FIX.1` adjudications are **overturned** here, and the overturn is recorded rather than quietly absorbed. **(1)** `B13-FIX.1` reported that "the four `B12-D-A055` challenges each mis-read which column or clause the ID was attached to" and withdrew all four. At least two were correct: `B13-F-09` and the threat model's stale-worker row attached the outbox fencing mechanism to the worker-execution table, for which frozen `B12_DATA_MODEL.md` §3 defines no such column. Both are repaired. **(2)** `FI-B7-05`'s clause was not supported by the document its row named; it is repaired in the inventory and its twelve codes moved to §3.2. This is Rule V-5 operating as intended — the frozen source won over the prior verdict — and it is why a withdrawal count is no longer published as evidence of correctness. Net semantically-unsupported citations, as repaired: 0 |

## 8. `B13-FIX.2` targeted regression

Four independently confirmed publication blockers were repaired in this pass. Each is re-tested below by a command a third party can re-run, and each test is reported as `ORIGINAL_BLOCKER_PRESENT = 0` only where the command actually executed. Nothing here re-opens the historical audit; the scope is the four blockers and the reproducibility defects the independent review attached to them.

### 8a. MAJOR-A — RC-2 propagation, four gates

| # | Gate | Command | Result |
|---:|---|---|---|
| 1 | No line naming the worker-execution table asserts a lease, a fence or an automatic re-execution without the frozen negation on the same line | scan every `B13_*.md` line containing the worker-execution table name for the four claim-shaped terms, requiring an explicit frozen negation alongside | 0 |
| 2 | No fresh claim of any kind is attributed to the worker-execution table | the same scan restricted to the two fresh-claim phrasings, excluding lines that name the outbox table or negate the phrase outright | 0 |
| 3 | The outbox fencing-token column name never appears without the outbox table named on the same line | grep the pack for that column name and confirm every hit also names the outbox table | 0 |
| 4 | Every document discussing a heartbeat-lapsed worker execution reaches the unresolved-outcome classification | for each file containing both the heartbeat term and the worker-execution table name, confirm the file also states the unresolved-outcome classification | 0 |

`ORIGINAL_BLOCKER_PRESENT = 0`. The canonical statement is `B13_REDIS_CELERY_SECURITY.md` §9; `B13-F-09`, `AT-B13CEL-5`, the threat-model row, `B13_DISASTER_RECOVERY.md` §§2.3–2.4 and `B13_RUNBOOKS.md` §3 now restate it without weakening it.

### 8b. MAJOR-B — audit-code provenance

`grep -rn` for each of the twelve tokens across `Docs/backend/B13/` returns hits only in `B13_AUDIT_LOGGING.md`'s own correction note and in `B13_FROZEN_INPUT_INVENTORY.md`'s `FI-B7-05` scope note — both of which describe the removal rather than assert the codes. No live normative claim carries them. Row-sum, enumerated-code count and distinct-code count all equal **139**, with zero duplicates. `ORIGINAL_BLOCKER_PRESENT = 0`.

### 8c. MAJOR-C — Class-A counter

`grep -rn 'CLASS_A_DECISION_COUNT' Docs/backend/B13/` returns one definition (`B13_DECISION_REGISTER.md` §1, with its derivation) and consistent restatements; no document publishes 82 for this counter or for `FROZEN_ANCHOR_COUNT`. The register's published two-command derivation reproduces 95 + 1 = 96. `ORIGINAL_BLOCKER_PRESENT = 0`.

### 8d. MAJOR-D — async handoff readiness

`B13_IMPLEMENTATION_HANDOFF.md` §2 carries an "Async security" build-list row naming `B13_REDIS_CELERY_SECURITY.md`, and §3 carries `ASYNC_SECURITY_READY` with nine traced obligations. §6's MUST-NOT list gains the two frozen async prohibitions. `ORIGINAL_BLOCKER_PRESENT = 0`.

### 8e. Verifier-integrity compliance, rules V-1 … V-5

| Rule | Status after this pass |
|---|---|
| **V-1** — missing execution is never a pass | Upheld. One check in this pass did not execute: the eight `B13-X-*` external sources were **not re-fetched**, because this pass had no network access. It is recorded as `EXTERNAL_SOURCE_RECHECK = NOT_RUN / INCOMPLETE` in the closing section, never as PASS, and it is non-blocking because no `B13-X-*` claim changed |
| **V-2** — a verifier is invalid if its method can pass while a counterexample stands | **Was violated; now upheld.** Three published derivations could not reproduce their own published values (`CLASS_A_DECISION_COUNT` reproduced 83 against a published 96; the acceptance population said 202 against 208; the frozen-reference derivation said 72/46 against 96/61). All three are corrected. A fourth violation was introduced *and caught inside this pass*: explanatory prose in `B13_DECISION_REGISTER.md` §1 used a placeholder-shaped identifier form, which made the published `PLACEHOLDER_REFERENCE_COUNT` scan return a match; the prose was reworded and the scan again returns zero with no exclusions |
| **V-3** — no counter may cite itself or a document that cites it back | Upheld and strengthened. The anchor-consumption ledger moved out of this matrix into `B13_FROZEN_INPUT_INVENTORY.md` §8, and the orphan scan explicitly excludes this matrix, so no matrix row can satisfy a citation counter by quoting an identifier. `B13_DECISION_REGISTER.md` §5 now states its own three derivations instead of pointing here |
| **V-4** — a claim is not verified by the existence of a document | Upheld. `ASYNC_SECURITY_READY` names an enforcement point and a failure behavior for each of its nine obligations rather than pointing at a document |
| **V-5** — reproducibility over authority | Upheld, and exercised against this pack's own prior verdicts. Two `B13-FIX.1` adjudications were overturned by reading frozen source (`B12-D-A055` withdrawals; `FI-B7-05` support), and both overturns are recorded in §7 rather than silently absorbed |

### 8f. What this pass did **not** re-run

Per V-1, recorded as `NOT_RUN / INCOMPLETE`, not as PASS: the historical 102-finding audit, the M1–M7 series, and the 82 previously-refuted findings were deliberately out of scope and were not re-executed. No verdict about them is claimed or refreshed here.

## 9. What this self-verification does not claim

This matrix confirms internal consistency and coverage against the governing brief's own required counters and gates. It does not constitute the independent CTO countersign every prior phase in this corpus required before closing — `B13_EXECUTIVE_SUMMARY.md` states this distinction explicitly, and this pack remains unpublished pending that review.

**Checks this pass could not execute, recorded per Rule V-1.** `EXTERNAL_SOURCE_RECHECK = NOT_RUN / INCOMPLETE` — the eight `B13-X-*` external sources (Django, NIST SP 800-63B-4, Sentry, OWASP, Celery) were **not** re-fetched in the `B13-FIX.2` pass, which had no network access. No `B13-X-*` claim, status, or count changed in this pass, so nothing downstream depends on a re-fetch having happened; the re-verification gate in `B13_RESEARCH_REGISTER.md` §5 and pre-implementation gate 6 remain the place that obligation is discharged. It is recorded as INCOMPLETE and never as PASS.
