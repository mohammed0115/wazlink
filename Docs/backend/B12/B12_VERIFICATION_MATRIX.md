# B12 — Verification Matrix

> Self-check only. **This is not an independent verification** and does not substitute for one. Every counter below was derived mechanically from the source table named in its row, not asserted from memory.
>
> **Revised by B12-FIX.1.** An independent CTO verification returned `FAIL` on 1 MAJOR (three state-machine ↔ command contradictions) and 4 MINOR findings. All are repaired; nine counters moved as a *consequence* of the repairs and are re-derived below rather than preserved. The counters that moved: `STATE_COUNT` 28→27, `PUBLIC_API_OPERATION_COUNT` 10→14, `ADDITIVE_API_OPERATION_COUNT` 10→14, `FAILURE_SCENARIO_COUNT` 47→50, `ACCEPTANCE_TEST_COUNT` 172→188 (→191 in FIX.1a), `POSITIVE_CONTROL_COUNT` 88→97 (→98), `NEGATIVE_CONTROL_COUNT` 84→91 (→93), `ACCEPTANCE_CATEGORY_COUNT` 41→42, `CLASS_A_REFERENCE_COUNT` 94→95, `CLASS_A_DECISIONS` 49→56.

## 1. Counter derivation

| Counter | Value | Derived from |
|---|---:|---|
| `B12_DOCUMENT_COUNT` | 45 | `ls Docs/backend/B12/*.md \| wc -l` |
| `FRONTEND_BEHAVIOR_COUNT` | 11 | rows in `B12_FRONTEND_BEHAVIOR_INVENTORY.md` §3–§6 |
| `FRONTEND_A_COUNT` | 4 | §3 |
| `FRONTEND_B_COUNT` | 2 | §4 |
| `FRONTEND_C_COUNT` | 3 | §5 |
| `FRONTEND_D_COUNT` | 2 | §6 |
| `OWNED_ENTITY_COUNT` | 8 | `B12_DATA_MODEL.md` §1–§8 |
| `REFERENCED_ENTITY_COUNT` | 4 | `B12_SCOPE_AND_OWNERSHIP.md` §5 table rows |
| `STATE_MACHINE_COUNT` | 6 | `B12_STATE_MACHINES.md` §0 |
| `STATE_COUNT` | **27** | §1 (5) + §2 (6) + §3 (5) + §4 (**4**) + §5 (4) + §6 (3). Moved from 28 in B12-FIX.1: `IntegrationConnection`'s unreachable `disabled` was removed (`B12-D-A052`). No state was added anywhere |
| `COMMAND_COUNT` | 15 | `B12_COMMAND_EVENT_CATALOG.md` §1 rows |
| `PRODUCED_EVENT_COUNT` | 10 | §2 rows |
| `CONSUMED_EVENT_COUNT` | 0 | §4 — declared zero with two rejected candidates recorded |
| `REUSED_PERMISSION_COUNT` | 1 | `B12_RBAC_TENANCY.md` §1 (`integration.manage`, frozen B1) |
| `ADDITIVE_PERMISSION_COUNT` | 2 | §1 (`platform.operations.view`, `platform.operations.replay`) |
| `PUBLIC_API_OPERATION_COUNT` | **14** | `B12_API_DTO_CONTRACTS.md` §1 rows. Moved from 10 in B12-FIX.1: four operator operations added so `AbandonDeadLetter` and `ResolvePlatformReconciliationCase` have real surfaces and the reconciliation reads `platform.operations.view` governs actually exist |
| `ADDITIVE_API_OPERATION_COUNT` | **14** | all fourteen; the frozen catalog has no integration or operations row |
| `WEBHOOK_ROUTE_COUNT` *(supporting)* | 3 | §2 — deliberately **not** in the API operation count, per the frozen rule |
| `ERROR_NEW_COUNT` | 1 | `B12_ERROR_TAXONOMY.md` §2 |
| `FAILURE_SCENARIO_COUNT` | **50** | `B12_FAILURE_CATALOG.md` rows (`B12-F-001` … `B12-F-050`); three added in B12-FIX.1 |
| `ACCEPTANCE_TEST_COUNT` | **191** | `B12_ACCEPTANCE_TESTS.md` §1 rows; §2 shows the per-prefix arithmetic. 16 added in B12-FIX.1, 3 more in B12-FIX.1a |
| `POSITIVE_CONTROL_COUNT` | **98** | count of `positive` in §1's Pos/Neg column |
| `NEGATIVE_CONTROL_COUNT` | **93** | count of `negative`; `93 + 98 = 191` |
| `ACCEPTANCE_CATEGORY_COUNT` | **42** | `COUNT(DISTINCT Category)` over §1's Category column; the new category is `State machines` |
| `CLASS_A_REFERENCE_COUNT` | **95** | `B12_CLASS_A_REFERENCE_REGISTRY.md` rows; row 61a added in B12-FIX.1 when row 61's quotation was re-attributed to the document that actually contains it |
| `CLASS_A_UNRESOLVED` | 0 | every row is reused verbatim, realized, honored as a deferral, or covered by a listed amendment |
| `CONTROLLED_AMENDMENT_COUNT` | 10 | `B12_CONTROLLED_AMENDMENTS.md` table rows |
| `ADDITIVE_AMENDMENT_COUNT` | 10 | all ten |
| `COMPATIBLE_CLARIFICATION_COUNT` | 0 | — §"Why zero compatible clarifications" |
| `NON_ADDITIVE_AMENDMENT_COUNT` | 0 | — |
| `RESEARCH_FACT_COUNT` | 15 | `B12_PROVIDER_RESEARCH_REGISTER.md` §1 rows |
| `RESEARCH_VERIFIED` | 9 | `B12-X-001` … `B12-X-009` |
| `RESEARCH_PARTIAL` | 1 | `B12-X-014` |
| `RESEARCH_UNRESOLVED` | 5 | `B12-X-010`, `011`, `012`, `013`, `015` |
| `RESEARCH_CONTRADICTED` | 0 | — |
| *(supporting)* `CLASS_A_DECISIONS` | **56** | `B12_DECISION_REGISTER.md` Class A rows; `B12-D-A050`…`A056` added in B12-FIX.1 |
| *(supporting)* `CLASS_B_DECISIONS` | 12 | Class B rows |
| *(supporting)* `CLASS_C_DECISIONS` | 4 | Class C rows |

Arithmetic self-checks: `4+2+3+2 = 11` ✓ · `5+6+5+4+4+3 = 27` ✓ · `98+93 = 191` ✓ · `10+0+0 = 10` ✓ · `9+1+5+0 = 15` ✓ · `1 reused + 2 added = 3` ✓ · `14 additive API ops + 3 uncounted webhook routes = 17 HTTP surfaces` ✓ · `56 Class A + 12 Class B + 4 Class C = 72 decisions` ✓.

## 2. Semantic verification

| Check | Result | Where it is proved |
|---|:--:|---|
| `REDIS_DURABLE_AUTHORITY_LEAKS` | 0 | `B12_REDIS_BOUNDARY.md` §3's enumerated forbidden list + §5's recovery table and worked example |
| `CELERY_BUSINESS_AUTHORITY_LEAKS` | 0 | `B12_STATE_MACHINES.md` §3 invariant W-2 — no `worker_executions` transition reads or writes a domain aggregate; `B12-D-A003` |
| `OUTBOX_DURABILITY_GAPS` | 0 | `B12_OUTBOX_MODEL.md` §1 (same-transaction rule), §4 (**five** crash windows each with a durable answer, including window 5's lease-fencing race) |
| `INBOX_DEDUP_GAPS` | 0 | `B12_INBOX_MODEL.md` §2 (external, frozen constraint) + §3 (the obligation on every internal consumer, satisfied today by `automation_inbox_records`) |
| `IDEMPOTENCY_SCOPE_GAPS` | 0 | `B12_IDEMPOTENCY_MODEL.md` §1 — every layer of the six-layer model appears in exactly one of nine classes with a named non-Redis store; classes 6 and 8 were **narrowed** in B12-FIX.1 and now agree word-for-word with `B12_DATA_MODEL.md` |
| `UNKNOWN_OUTCOME_SAFETY_GAPS` | 0 | `B12_UNKNOWN_OUTCOME_MODEL.md` §1 (three outcomes), §3 (procedure), §4 (write-before-call) |
| `BLIND_NON_IDEMPOTENT_RETRY_GAPS` | 0 | `B12-D-A020` — no flag, permission, or configuration permits it; `B12_RETRY_BACKOFF_MODEL.md` §5's fourth terminal state exists so no timeout is forced into a lie |
| `WEBHOOK_VERIFICATION_GAPS` | 0 | `B12-D-A027` (verify before anything) + `B12-D-A030` (per-provider schemes, both primary-sourced) |
| `WEBHOOK_TENANT_BINDING_GAPS` | 0 | `B12-D-A031` — workspace is a consequence of which secret verified; zero/multiple matches quarantined, never guessed |
| `WEBHOOK_DUPLICATE_GAPS` | 0 | `B12_WEBHOOK_DEDUP_ORDERING.md` §2's three-tier hierarchy + the frozen `(provider, dedup_key)` unique constraint, with the key **binding-scoped** per `B12-D-A056` so no tenant can consume another's identity |
| `WEBHOOK_ORDERING_GAPS` | 0 | `B12-D-A033` — ordering resolved by the owning domain's monotonicity rule; B12 forces no regression |
| `RATE_LIMIT_BUDGET_GAPS` | 0 | `B12_REDIS_BOUNDARY.md` §4 + `B12_RATE_LIMIT_BACKPRESSURE.md` §3's enumerated durable budgets |
| `RETRY_BUDGET_OVERRIDE_GAPS` | 0 | `B12_RETRY_BACKOFF_MODEL.md` §1 (six owners) and §4 (`MIN(class_max, domain_remaining)`) |
| `DEAD_LETTER_SAFETY_GAPS` | 0 | `B12_DEAD_LETTER_REPLAY_MODEL.md` §2 (durable record, no payload) + §6 (no automatic replay) |
| `REPLAY_SAFETY_GAPS` | 0 | §4's computed eligibility — a non-idempotent op with an `unknown` outcome is never replayable; §5's six re-checks |
| `RECONCILIATION_AUTHORITY_LEAKS` | 0 | `B12-D-A039` — a repair invokes the domain's own command and a refusal correctly leaves the case open |
| `SECRET_EXPOSURE_GAPS` | 0 | `B12-D-A042` (no value, mask, prefix, or length) + `B12_SECURITY_PRIVACY.md` §3's exhaustive redaction list |
| `PROVIDER_CAPABILITY_ASSUMPTION_GAPS` | 0 | `B12-D-A024` tri-valued capabilities + `B12-D-A012`; exactly 2 `supported` cells platform-wide, both primary-sourced |
| `CROSS_TENANT_INTEGRATION_GAPS` | 0 | `B12_RBAC_TENANCY.md` §4's eight-attack table; per-workspace budgets on shared global credentials |
| `B3_AUTHORITY_LEAKS` | 0 | `B12_DOMAIN_FIREWALLS.md` §1 |
| `B4_AUTHORITY_LEAKS` | 0 | §2 |
| `B5_AUTHORITY_LEAKS` | 0 | §3 |
| `B7_AUTHORITY_LEAKS` | 0 | §4 — including that no wakeup sweep is built |
| `B8_AUTHORITY_LEAKS` | 0 | §5 |
| `B9_AUTHORITY_LEAKS` | 0 | §6 — no async write path into B9 exists at all |
| `B10_AUTHORITY_LEAKS` | 0 | §7 |
| `B11_AUTHORITY_LEAKS` | 0 | §8 |
| `B6_AUTHORITY_LEAKS` (with `B1`, `B2`) | 0 | §9 — B1, B2 and B6 have **no** asynchronous provider interaction in Phase 1 and no B12 command names one of their tables for write; `AT-B12FW-11`. Labelled explicitly in B12-FIX.1a, having previously been covered by the firewall section and its control without a named counter row |
| `OUTBOX_DUPLICATE_DISPATCH_GAPS` | 0 | `B12_OUTBOX_MODEL.md` §5 — the dispatcher makes duplicates *rare* (lease + `SKIP LOCKED` + the §3a fence); the **consumer's** durable uniqueness constraint makes them *harmless*, and only the second is a guarantee. Crash windows 2, 3 and 5 each land there. Labelled explicitly in B12-FIX.1a |

### 2a. Gates closed by B12-FIX.1

| Check | Result | Where it is proved |
|---|:--:|---|
| `STATE_MACHINE_CONTRADICTIONS` | 0 | `B12_STATE_MACHINES.md` §7a's command ↔ transition cross-check, asserted by `AT-B12SM-1` |
| `COMMAND_STATE_PRECONDITION_GAPS` | 0 | same — every command's precondition state and effect transition exist in the machine it names |
| `UNREACHABLE_STATES` | 0 | `B12_STATE_MACHINES.md` §4b — the one unreachable state was removed rather than given a command to justify it |
| `UNTRIGGERED_TRANSITIONS` | 0 | §4 and §7a name a triggering command on every transition |
| `RETRYWEBHOOK_TERMINAL_STATE_CONTRADICTIONS` | 0 | invariant W-3 + `B12_DEAD_LETTER_REPLAY_MODEL.md` §4a — replay is a new execution, not a rewind |
| `CONFIGUREINTEGRATION_TRANSITION_GAPS` | 0 | machine 4 transition 4 (`B12-D-A051`), with the material/non-material split and the admission rule |
| `OUTBOX_CLAIM_RACE_GAPS` | 0 | `B12_OUTBOX_MODEL.md` §3a's fence and crash window 5 (`B12-D-A055`) |
| `RECONCILIATION_IDEMPOTENCY_CONTRADICTIONS` | 0 | one canonical key, `(fingerprint, mismatch_class) WHERE state='open'`, stated identically in three documents |
| `WEBHOOK_DUPLICATE_GAPS` | 0 | binding-scoped `dedup_key` (`B12-D-A056`) |
| `CROSS_WORKSPACE_DEDUP_POISONING_GAPS` | 0 | `B12_WEBHOOK_DEDUP_ORDERING.md` §2a traces the sequence and names the step it closes (`t6`, not `t5`) |
| `COMMAND_EVENT_CONTRACT_GAPS` | 0 | `B12_COMMAND_EVENT_CATALOG.md` §1a surface-classifies all 15 commands. **B12-FIX.1a** corrected the two rows that claimed an unreachable operator path: `RetryJob` and `RetryWebhook` are **system-only** (`B12-D-A053`), and `ReplayDeadLetter` invokes neither (`B12_DEAD_LETTER_REPLAY_MODEL.md` §4b) |
| `UNOWNED_COMMANDS` / `UNOWNED_OPERATOR_SURFACES` | 0 | same, plus API operations 10 and 12-14. No permission cell governs a path that cannot execute |
| `STALE_COUNTERS` | 0 | **B12-FIX.1a** corrected `B12_STATE_MACHINES.md`'s header, which still read `STATE_COUNT = 28` against its own §7 derivation of 27 |
| `AMENDMENT_CLASSIFICATION_GAPS` | 0 | `B12_CONTROLLED_AMENDMENTS.md` "B12-FIX.1 re-classification" — each affected amendment decided from scratch |
| `SEMANTICALLY_WRONG_CLASS_A_REFS` | 0 | registry rows 45, 61, 61a re-attributed to the documents that actually contain the quoted text |
| `B4_RETRY_BUDGET_GAPS` | 0 | `B12_RETRY_BACKOFF_MODEL.md` §4 worked example 2 cites `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` and the 2 × 3 = 6 envelope, **without creating a second budget authority** |

## 3. Reference integrity

Checked mechanically across all 45 documents by extracting every `AT-B12*`, `B12-D-*`, `B12-F-*`, `B12-AM-*`, `FB-B12-*`, and `B12-X-*` token and diffing the referenced set against the defined set in each owning table — **and, for every `FB-B12-*` and `B12-AM-*` citation, by re-reading the row it names to confirm it says what the citing sentence claims.** Existence-only checking is what let two wrong frontend citations survive B11's first pass; the semantic sweep is part of the procedure here, not an afterthought.

| Check | Result |
|---|:--:|
| `UNDEFINED_AT_REFS` | 0 — 191 used, 191 defined |
| `UNDEFINED_DECISION_REFS` | 0 — 72 used, 72 defined |
| `BROKEN_FAILURE_REFS` | 0 — 50/50 |
| `BROKEN_AMENDMENT_REFS` | 0 — 10/10 |
| `SEMANTICALLY_WRONG_AMENDMENT_REFS` | 0 — each `B12-AM-*` citation re-read against its row |
| `BROKEN_FRONTEND_REFS` | 0 — 11/11 |
| `SEMANTICALLY_WRONG_FRONTEND_REFS` | 0 — each `FB-B12-*` citation outside the inventory re-read against the row it names |
| `BROKEN_RESEARCH_REFS` | 0 — 15/15 |
| `BROKEN_CROSS_DOCUMENT_REFS` | 0 — every `B12_*.md` filename cited by any document exists in the directory. **Reference coverage, stated exactly.** Counting only *substantive* citations — a document naming another because it depends on it, and excluding this section's own bookkeeping mentions — 43 of the 45 documents are cited by at least one other B12 document. The two that are not are `B12_EXECUTIVE_SUMMARY.md` and `B12_VERIFICATION_MATRIX.md`, which are reached through the global `BACKEND_DOCUMENTATION_INDEX.md` (it lists all 45). That is correct for what they are: a top-level summary and a self-check are entry points, not dependencies. So `UNCITED_WITHIN_B12_DOCUMENT_COUNT = 2`, and **no cross-reference has been inserted anywhere to make that number smaller** — the only place those two filenames appear outside the global index is this row, which is why the count is defined to exclude it |
| `DUPLICATE_ID_DEFINITIONS` | 0 — no ID is defined twice in any owning table |
| `LIVE_PLACEHOLDER_REFS` | 0 — a scan for the placeholder tokens `TODO`, `TBD`, `FIXME`, and `XXX` returns exactly **one** hit across all 45 documents: this row, which names them. No document contains a live placeholder |
| `STALE_COUNTERS` | 0 — every counter in §1 was re-derived from its source table during this pass |
| `FALSE_VERIFICATION_CLAIMS` | 0 — §6 lists what this pack deliberately does not claim |

**One naming note, recorded rather than silently resolved:** `B12_DOMAIN_FIREWALLS.md` §6 cites B9's own negative control, whose B9-assigned ID happens to be `AT-B12-2`. It is B9's identifier for B9's test, not a B12 test ID, and the citation names its owning document so the two namespaces cannot be confused.

## 4. Drift gate

| Check | Result | Evidence |
|---|:--:|---|
| `B0_DRIFT` … `B11_DRIFT` | 0 each | `git status --porcelain` reports exactly **two** entries: ` M BACKEND_DOCUMENTATION_INDEX.md` and `?? Docs/backend/B12/`. One tracked file is modified, deliberately: the documentation index, additively. Zero file under `Docs/backend/B1`…`B11` and zero other root `BACKEND_*.md`/`B0_*.md` is touched |
| `FRONTEND_DRIFT` | 0 | no file under `client/` is created, modified, or deleted; `client/` is byte-identical to the frozen frontend reference `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` |
| `IMPLEMENTATION_LEAKAGE` | 0 | no Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, or provider SDK call. A mechanical scan for Django/ORM/DRF/Celery/SDK tokens returns zero matches. `FENCED_BLOCK_COUNT_DERIVED = 15` (30 fence markers ÷ 2, counted mechanically); all are conceptual: layer diagrams, a pipeline sketch, a claim-sequence illustration in the "conceptually required shape (not code)" style `B1_AUTHORIZATION_RBAC.md` §4 established, a resolution pseudo-sequence, and a backoff formula |
| `B13_FILES_CREATED` | 0 | `ls Docs/backend` shows `B1 B10 B11 B12 B2 B3 B4 B5 B6 B7 B8 B9` — no `B13` or `B14` directory exists |
| `B14_FILES_CREATED` | 0 | same |

## 5. Dirty scope

Exactly two paths change, both additive:

| Path | Change |
|---|---|
| `Docs/backend/B12/**` | 45 new documents |
| `BACKEND_DOCUMENTATION_INDEX.md` | one new `## B12` section appended before the "Required next-phase gate" heading. **No B0–B11 section is rewritten, reordered, or edited.** |

No commit, no push, no stage, no reset, no rebase, no merge, no clean, and no checkout of a frozen file was performed at any point.

## 6. What this pack deliberately does NOT claim

Recorded so that `FALSE_VERIFICATION_CLAIMS = 0` is checkable rather than asserted. B12 does **not** claim: exactly-once delivery; that any Phase-1 provider supports a client-supplied idempotency key; that any provider's signature scheme carries replay freshness; that Meta documents a raw-byte signature basis; that any provider publishes stable IP ranges; that Tap retries a callback more than three times; that WhatsApp status callbacks arrive in order; that any provider offers webhook replay on demand; that credentials are encrypted at rest by the deployed target; that any compliance, PCI, or data-locality property holds; that a Celery result backend is a dead-letter store; that Redis holds any durable truth; that this self-check is an independent verification.
