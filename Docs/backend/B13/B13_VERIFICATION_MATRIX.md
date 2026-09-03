# B13 — Verification Matrix

> Design only. Mechanically re-derived counters, semantic verification gates, reference-integrity checks, and the frozen-regression drift gate. Every number below was recomputed against the finished pack during this authoring pass, not asserted in advance — where a mechanical scan is imprecise (a prose range, a generically-described action family), the derivation method is stated so it is auditable rather than merely asserted.

## 1. Method

Counters were derived by pattern-matching every `.md` file in `Docs/backend/B13/` for the relevant ID family (`AT-B13*`, `FI-*`, `B13-D-*`, `B13-X-*`, `FB-B13-*`, `B13-F-*`), followed by a manual per-category reconciliation for the two counters (`AUDIT_EVENT_COUNT`, positive/negative acceptance split) that a naive regex cannot resolve unambiguously against prose ranges. The method for each is stated inline so a reviewer can re-run it.

## 2. Re-derived counters

| Counter | Value | Method |
|---|---:|---|
| `B13_DOCUMENT_COUNT` | 39 | file count of `Docs/backend/B13/*.md` |
| `FRONTEND_EVIDENCE_COUNT` | 26 | row count of `B13_FRONTEND_EVIDENCE.md` §§2–5 |
| `FRONTEND_EVIDENCE_CLASS_COUNTS` | A=11, B=8, C=4, D=3 | per-class row counts, same source; 11+8+4+3=26 ✓ |
| `THREAT_COUNT` | 28 | row count of `B13_THREAT_MODEL.md` §2 |
| `THREAT_ACTOR_COUNT` | 16 | row count of `B13_THREAT_MODEL.md` §1 |
| `SECURITY_CONTROL_COUNT` | 25 | row count of `B13_SECURITY_PRINCIPLES.md` §1 |
| `AUDIT_EVENT_COUNT` | 146 | manual per-row count of individually-named or explicitly-quantified actions in `B13_AUDIT_LOGGING.md` §3 (18 rows; one row — Finance — is a generic descriptor rather than an enumerated list and is counted as 1 to avoid inventing dotted codes B9 does not itself name) |
| `RUNBOOK_COUNT` | 18 | section count of `B13_RUNBOOKS.md` §§1–18 |
| `FAILURE_SCENARIO_COUNT` | 23 | row count of `B13_FAILURE_SCENARIOS.md`, unique `B13-F-##` IDs |
| `ACCEPTANCE_TEST_COUNT` | 202 | unique `AT-B13*-#` identifiers across every document |
| `POSITIVE_ACCEPTANCE_COUNT` | 41 | manual per-category classification (§3 below) |
| `NEGATIVE_ACCEPTANCE_COUNT` | 161 | same; 41+161=202 ✓ |
| `ACCEPTANCE_CATEGORY_COUNT` | 23 | `COUNT(DISTINCT category)` over `B13_ACCEPTANCE_TESTS.md` §§1–24, matching the governing brief's own 23 named categories exactly |
| `CLASS_A_REFERENCE_COUNT` | 604 | total (non-unique) occurrences of an `FI-*` citation across the pack — reuse density, not anchor count |
| `CLASS_A_UNRESOLVED` | 0 | every `FI-*` anchor in `B13_FROZEN_INPUT_INVENTORY.md` quotes a closed, published clause |
| `CLASS_A_DECISION_COUNT` | 82 | `FROZEN_ANCHOR_COUNT`, `B13_FROZEN_INPUT_INVENTORY.md` §7 |
| `CLASS_B_DECISION_COUNT` | 29 | `B13_DECISION_REGISTER.md` §2 |
| `CLASS_C_DECISION_COUNT` | 12 | `B13_DECISION_REGISTER.md` §3 |
| `CONTROLLED_AMENDMENT_COUNT` | 0 | `B13_CONTROLLED_AMENDMENTS.md` §1 |
| `ADDITIVE_AMENDMENT_COUNT` | 0 | same |
| `COMPATIBLE_CLARIFICATION_COUNT` | 0 | same |
| `NON_ADDITIVE_AMENDMENT_COUNT` | 0 | same |
| `RESEARCH_FINDING_COUNT` | 8 | `B13_RESEARCH_REGISTER.md` §2 |
| `VERIFIED_RESEARCH_COUNT` | 6 | same |
| `PARTIAL_RESEARCH_COUNT` | 1 | same |
| `UNRESOLVED_RESEARCH_COUNT` | 1 | same (superseded, non-blocking) |
| `CONTRADICTED_RESEARCH_COUNT` | 0 | same |

## 3. Positive/negative acceptance methodology

A test is classified **positive** when it asserts a legitimate operation succeeds or a designed property holds under normal operation (e.g., "password reset revokes all sessions," "every alert has a dashboard panel"); **negative** when it asserts an attack, misuse, or failure path is refused, contained, or handled safely (e.g., "cross-workspace lookup returns 404," "a forged webhook is rejected before parsing"). Every one of the 23 mandatory categories contains at least one negative test — the minimum in any category is `AT-B13INC` (Incident Runbooks) at 1 negative of 3 total, and the maximum concentration is `AT-B13TEN` (Tenant Isolation) and `AT-B13IO`/`AT-B13VAL`-adjacent categories at 100% negative, reflecting that tenant isolation and validation are almost entirely about refusing illegitimate input. The full per-category breakdown was computed once during this pass and is not repeated line-by-line here to avoid a second copy of `B13_ACCEPTANCE_TESTS.md` that could drift from it; the totals (41/161/202) are the authoritative output.

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
| `SECRET_ROTATION_GAPS` | 0 | every secret class in `B13_SECRETS_MANAGEMENT.md` §1 has a rotation procedure in §7, including the "invalidates rather than supersedes" rule |
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
| `CELERY_BUSINESS_AUTHORITY_LEAKS` | 0 | tasks carry references and re-check state at execution time (`B13_REDIS_CELERY_SECURITY.md` §7); no task payload is treated as a cached business decision |
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
| `SUPPLY_CHAIN_POLICY_GAPS` | 0 | the current lockfile gap is disclosed, not hidden, and a forward policy is defined regardless (`B13_SUPPLY_CHAIN_SECURITY.md` §§1–4) |
| `B0_B12_SECURITY_CONTRADICTIONS` | 0 | §5 below |
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

No file under `client/**` or any `B0`–`B12` document was modified, read-and-rewritten, or contradicted; every clause this pack depends on is quoted or paraphrased with a traceable citation in `B13_FROZEN_INPUT_INVENTORY.md`, never re-derived from memory. `B13_CONTROLLED_AMENDMENTS.md` §1 independently confirms zero amendments were required, which is the strongest form of zero-drift a phase in this corpus can claim.

## 6. Implementation-leakage and file-count checks

| Check | Value | Evidence |
|---|---:|---|
| `B14_FILES_CREATED` | 0 | directory listing confirms no `Docs/backend/B14` exists |
| `IMPLEMENTATION_LEAKAGE` | 0 | no Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, secret value, Dockerfile, or infrastructure-as-code file was written anywhere in this pass |

## 7. Reference integrity

| Check | Value | Method |
|---|---:|---|
| Undefined references | 0 | every `AT-B13*` range cited in a summary/pointer row was traced to its owning document's full definition; two genuine gaps found during this pass (`AT-B13VAL`, `AT-B13CONC` cited but undefined) were closed by adding their definitions to `B13_INPUT_OUTPUT_SECURITY.md` §8 and `B13_DATABASE_SECURITY.md` §10 respectively |
| Unused definitions | 0 | every `FI-*` anchor (82) is cited by at least one downstream document (confirmed by set comparison: FI-IDs cited = FI-IDs defined, both 82) |
| Duplicate IDs | 0 | one genuine conflict was found and fixed during this pass: `AT-B13CFG-1`/`2`/`3` were independently defined with **different, non-equivalent** assertions in two files; `B13_DJANGO_DRF_SECURITY_BASELINE.md` §10 now points to the canonical definitions in `B13_CONFIGURATION_MANAGEMENT.md` §7 and `B13_DEPLOYMENT_SECURITY.md` §9 instead of redefining them. `AT-B13AUTH-1`…`6` were similarly de-duplicated (canonical home: `B13_AUTHENTICATION_SESSION_SECURITY.md` §9) |
| Placeholder references | 0 | one instance of ambiguous shorthand (`B13-D-C0xx`) was found and rewritten to the explicit range `B13-D-C001`…`B13-D-C012` |
| Broken cross-document references | 0 | every `B13_*.md` filename cited by another B13 document exists in the finished pack (confirmed against the 39-file listing in §2) |
| Semantically wrong Class-A references | 0 | three IDs (`B13-D-A001`/`A002`/`A003`) were initially misclassified as Class A (inherited) when they were genuinely B13-original decisions; all three were renumbered into the Class B series (`B13-D-B027`/`B028`/`B029`) during this pass, matching the governing brief's own definition that Class A means inherited frozen input, never a B13-authored decision |

## 8. What this self-verification does not claim

This matrix confirms internal consistency and coverage against the governing brief's own required counters and gates. It does not constitute the independent CTO countersign every prior phase in this corpus required before closing — `B13_EXECUTIVE_SUMMARY.md` states this distinction explicitly, and this pack remains unpublished pending that review.
