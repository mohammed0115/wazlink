# B11 — Verification Matrix

> Self-check only. **This is not an independent verification** and does not substitute for one. Every counter below was derived mechanically from the source table named in its row, not asserted from memory.

## 1. Counter derivation

| Counter | Value | Derived from |
|---|---:|---|
| `B11_DOCUMENT_COUNT` | 35 | `ls Docs/backend/B11/*.md \| wc -l` |
| `FRONTEND_BEHAVIOR_COUNT` | 11 | rows in `B11_FRONTEND_BEHAVIOR_INVENTORY.md` §3–§6 |
| `FRONTEND_A_COUNT` | 3 | §3 |
| `FRONTEND_B_COUNT` | 1 | §4 |
| `FRONTEND_C_COUNT` | 4 | §5 |
| `FRONTEND_D_COUNT` | 3 | §6 |
| `OWNED_ENTITY_COUNT` | 4 | `B11_STORAGE_MODEL.md` §1–§4 (`file_assets`, `file_attachments`, `workspace_storage_usage`, `file_reconciliation_cases`) |
| `REFERENCED_ENTITY_COUNT` | 6 | `B11_SCOPE_AND_OWNERSHIP.md` §4 table rows |
| `STATE_MACHINE_COUNT` | 4 | `B11_FILE_LIFECYCLE.md` §1 |
| `STATE_COUNT` | 15 | §2 (5) + §3 (5) + §4 (2) + §5 (3) |
| `COMMAND_COUNT` | 12 | `B11_COMMAND_EVENT_CATALOG.md` §1 rows |
| `PRODUCED_EVENT_COUNT` | 8 | §2 rows |
| `CONSUMED_EVENT_COUNT` | 0 | §4 — declared zero with two rejected candidates recorded |
| `REUSED_PERMISSION_COUNT` | 2 | `B11_RBAC_TENANCY.md` §1 (`file.upload`, `file.download`) |
| `ADDITIVE_PERMISSION_COUNT` | 2 | §1 (`file.delete`, `file.manage`) |
| `PUBLIC_API_OPERATION_COUNT` | 11 | `B11_API_DTO_CONTRACTS.md` §1 rows |
| `ADDITIVE_API_OPERATION_COUNT` | 9 | §1 rows 2, 3, 4, 6, 7, 8, 9, 10, 11 |
| `ERROR_NEW_COUNT` | 3 | `B11_FAILURE_CATALOG.md` §2 rows |
| `FAILURE_SCENARIO_COUNT` | 35 | §5 rows (`B11-F-001` … `B11-F-035`) |
| `ACCEPTANCE_TEST_COUNT` | 129 | `B11_ACCEPTANCE_TESTS.md` §1 rows; §2 shows the per-category arithmetic. Nine tests added by **B11-FIX.1**, one more (`AT-B11LC-5`) by **B11-FIX.1a** |
| `ACCEPTANCE_CATEGORY_COUNT` | 26 | `COUNT(DISTINCT Category)` over §1's Category column |
| `NEGATIVE_CONTROL_COUNT` | 88 | count of `negative` in §1's Pos/Neg column; `88 + 41 positive = 129` |
| `CLASS_A_REFERENCE_COUNT` | 40 | `B11_CROSS_DOMAIN_CONTRACT_MATRIX.md` §1 (21) + §2 (19) |
| `CLASS_A_UNRESOLVED` | 0 | every row in that matrix is reused verbatim, realized, honored as a deferral, or covered by a listed amendment |
| `CONTROLLED_AMENDMENT_COUNT` | 12 | `B11_CONTROLLED_AMENDMENTS.md` table rows |
| `ADDITIVE_AMENDMENT_COUNT` | 10 | `#1, 2, 4, 5, 6, 8, 9, 10, 11, 12` |
| `COMPATIBLE_CLARIFICATION_COUNT` | 2 | `#3, #7` |
| `NON_ADDITIVE_AMENDMENT_COUNT` | 0 | — |
| `RESEARCH_FACT_COUNT` | 9 | `B11_RESEARCH_REGISTER.md` §1 rows |
| `RESEARCH_VERIFIED` | 2 | `B11-X-002`, `B11-X-003` |
| `RESEARCH_PARTIAL` | 4 | `B11-X-001`, `004`, `005`, `006` |
| `RESEARCH_UNRESOLVED` | 3 | `B11-X-007`, `008`, `009` |
| `RESEARCH_CONTRADICTED` | 0 | — |
| *(supporting)* `CLASS_A_DECISIONS` | 26 | `B11_DECISION_REGISTER.md` Class A rows |
| *(supporting)* `CLASS_B_DECISIONS` | 10 | Class B rows |
| *(supporting)* `CLASS_C_DECISIONS` | 4 | Class C rows |

Arithmetic self-checks: `3+1+4+3 = 11` ✓ · `5+5+2+3 = 15` ✓ · `2+9 = 11` ✓ · `88+41 = 129` ✓ · `10+2+0 = 12` ✓ · `2+4+3+0 = 9` ✓ · `21+19 = 40` ✓ · `2 reused + 2 added = 4` ✓.

## 2. Semantic verification

| Check | Result | Where it is proved |
|---|:--:|---|
| `FILE_BUSINESS_AUTHORITY_LEAKS` | 0 | `B11_DOMAIN_ATTACHMENT_MODEL.md` §5 invariant A-1, with a six-row table of facts a `FileAsset` never determines and the converse |
| `STORAGE_PROVIDER_AUTHORITY_LEAKS` | 0 | `B11_STORAGE_PROVIDER_BOUNDARY.md` §3 — four error classes, no provider value promoted to authority; `B11_DOMAIN_MODEL.md` §5 |
| `CROSS_TENANT_FILE_ACCESS_GAPS` | 0 | `B11_RBAC_TENANCY.md` §3 — all six attack surfaces mapped to Doctrine R-1/R-2; `AT-B11TEN-1`…`6` |
| `CROSS_TENANT_ATTACHMENT_GAPS` | 0 | `B11_DOMAIN_ATTACHMENT_MODEL.md` §4 — three-way workspace equality plus a denormalized CHECK-equal column; `AT-B11ATT-5` |
| `PUBLIC_PRIVATE_ACCESS_AMBIGUITIES` | 0 | `B11_SECURITY_PRIVACY.md` §5 — `access_class` has exactly one Phase-1 value; no anonymous path exists to be ambiguous about |
| `PERMANENT_SIGNED_URL_LEAKS` | 0 | §5 + `B11_RBAC_TENANCY.md` §5 — single-use, 5-minute, workspace- and actor-bound ticket; never durable; never a bearer credential; no provider-signed URL minted at all in Phase 1 |
| `FILE_ID_PROVIDER_ID_CONFLATIONS` | 0 | `B11_PUBLIC_ID_REGISTRY.md` §3 — five candidate values enumerated and excluded from identity; `AT-B11MSG-4` |
| `CHECKSUM_TRUST_GAPS` | 0 | `B11_CHECKSUM_INTEGRITY.md` §3 (single write point, invariant I-1), §4 (every mismatch fails closed), §5 (ETag disqualified on AWS's own words) |
| `MIME_TRUST_GAPS` | 0 | `B11_FILE_VALIDATION.md` §3–§4 — three columns, server detection canonical, group mismatch rejected, extension never a gate. §3.1 additionally separates *validated* from *trusted*: the provisional `content_type` a `pending` row carries is a closed-allow-list member that decides nothing, and only the detected type ever reaches a header, a DTO consumed downstream, or another domain; `AT-B11VAL-9`, `AT-B11VAL-10` |
| `UPLOAD_FINALIZATION_RACE_GAPS` | 0 | `B11_IDEMPOTENCY_CONCURRENCY.md` §3 — finalize vs. finalize, finalize vs. expiration, and **finalize vs. delete** (guards disjoint by construction: finalize requires `pending`, delete refuses it); quota charged once under the row lock; `AT-B11IDEM-2`, `AT-B11IDEM-3`, `AT-B11RACE-4` |
| `DELETE_ATTACHMENT_RACE_GAPS` | 0 | §3 — attach vs. delete, **detach vs. delete**, download vs. delete, and delete vs. delete; both serialization orders enumerated for each, none produces an attachment to a deleted file or a delete past an `active` attachment; `AT-B11RACE-1`, `AT-B11RACE-2`, `AT-B11RACE-5` |
| `QUOTA_AUTHORITY_LEAKS` | 0 | `B11_BILLING_QUOTA_BOUNDARY.md` §1–§3 — no B11 table, column, constant, or DTO expresses a per-plan allowance; no sixth metric filed; `AT-B11B8-1`…`5` |
| `QUOTA_RACE_GAPS` | 0 | `B11_STORAGE_USAGE_MODEL.md` §4 — `in_flight_bytes` closes the parallel-intent bypass under a single row lock; `AT-B11QUO-5` |
| `ORPHAN_DELETION_SAFETY_GAPS` | 0 | `B11_ORPHAN_CLEANUP_MODEL.md` §3–§4 — four-condition eligibility; `O-4`, `O-6`, and dangling subjects never auto-cleaned; invariant O-1 gives the sweeper no privileged path |
| `UNKNOWN_OUTCOME_RETRY_GAPS` | 0 | `B11_STORAGE_PROVIDER_BOUNDARY.md` §4 invariant P-1 — deterministic immutable keys, idempotent delete, `stat` before any repeat of a mutating call |
| `MESSAGE_AUTHORITY_LEAKS` | 0 | `B11_MESSAGING_MEDIA_BOUNDARY.md` §3 — no B11 field describes a Message; `AT-B11MSG-1`, `AT-B11MSG-2` |
| `B8_AUTHORITY_LEAKS` | 0 | `B11_BILLING_QUOTA_BOUNDARY.md` §6 |
| `B9_AUTHORITY_LEAKS` | 0 | `B11_SCOPE_AND_OWNERSHIP.md` §3; `AT-B11B9-1` |
| `B10_AUTHORITY_LEAKS` | 0 | `B11_TAX_DOCUMENT_BOUNDARY.md` §1, §6 |

## 3. Reference integrity

Checked mechanically across all 35 documents by extracting every `AT-B11*`, `B11-D-*`, `B11-F-*`, `B11-AM-*`, `FB-B11-*`, and `B11-X-*` token and diffing the referenced set against the defined set in each owning table — **and, for every `FB-B11-*` and `B11-AM-*` citation, by re-reading the row it names to confirm it says what the citing sentence claims.** Existence-only checking is what let two wrong frontend citations survive the first pass; the semantic sweep is now part of the procedure, not an afterthought.

| Check | Result |
|---|:--:|
| `UNDEFINED_AT_REFS` | 0 |
| `UNDEFINED_DECISION_REFS` | 0 |
| `BROKEN_FAILURE_REFS` | 0 |
| `BROKEN_AMENDMENT_REFS` | 0 |
| `BROKEN_FRONTEND_REFS` | 0 |
| `SEMANTICALLY_WRONG_FRONTEND_REFS` | 0 — **each of the eleven `FB-B11-*` citations outside the inventory was re-read against the row it names**, not merely checked for existence. Two were wrong before **B11-FIX.1** and are corrected: the Billing disabled-download placeholder is `FB-B11-006` (not `007`, the static build asset), and the client-side CSV export is `FB-B11-009` (not `006`) |
| `BROKEN_RESEARCH_REFS` | 0 |
| `BROKEN_CROSS_DOCUMENT_REFS` | 0 — every `B11_*.md` filename cited by any document exists in the directory. **Reference coverage, stated exactly.** Counting only *substantive* citations — a document naming another because it depends on it, and excluding this section's own bookkeeping mentions — 33 of the 35 documents are cited by at least one other B11 document. The two that are not are `B11_EXECUTIVE_SUMMARY.md` and `B11_VERIFICATION_MATRIX.md`, which are reached through the global `BACKEND_DOCUMENTATION_INDEX.md` (it lists all 35). That is correct for what they are: a top-level summary and a self-check are entry points, not dependencies. So `UNCITED_WITHIN_B11_DOCUMENT_COUNT = 2`, and **no cross-reference has been inserted anywhere to make that number smaller** — the only places those two filenames appear outside the index are this row and §7, which is why the count is defined to exclude them |
| `DUPLICATE_ID_DEFINITIONS` | 0 — no ID is defined twice in any owning table |
| `LIVE_PLACEHOLDER_REFS` | 0 — a scan for the placeholder tokens `TODO`, `TBD`, `FIXME`, and `XXX` returns exactly one hit across all 35 documents: this row, which names them. No document contains a live placeholder |
| `STALE_COUNTERS` | 0 — every counter in §1 was re-derived from its source table during the **B11-FIX.1** pass, and the arithmetic self-checks reproduce |
| `FALSE_VERIFICATION_CLAIMS` | 0 — §5 lists what this pack deliberately does not claim, and §7 lists the three mechanical claims that were false before **B11-FIX.1** and are now corrected |

## 4. Drift gate

| Check | Result | Evidence |
|---|:--:|---|
| `B0_DRIFT` … `B10_DRIFT` | 0 each | `git status --porcelain` reports exactly **two** entries: ` M BACKEND_DOCUMENTATION_INDEX.md` and `?? Docs/backend/B11/` — so `DIRTY_STATUS_ENTRY_COUNT = 2`. **One tracked file is modified, deliberately:** the documentation index, additively (one appended `## B11` section, `62` insertions, `0` deletions). Zero file under `Docs/backend/B1`…`B10` and zero *other* root `BACKEND_*.md`/`B0_*.md` is touched. The index is in the declared dirty scope, not an exception to it (§6) |
| `FRONTEND_DRIFT` | 0 | no file under `client/` is created, modified, or deleted; `client/` is byte-identical to the frozen frontend reference `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` |
| `IMPLEMENTATION_LEAKAGE` | 0 | no Django app, model, migration, serializer, view, URL, Celery task, or storage SDK call. `FENCED_BLOCK_COUNT_DERIVED = 6` (12 fence markers ÷ 2, counted mechanically): a conceptual aggregate map, an ASCII upload-flow diagram, a storage-key shape, a queryset-shape illustration copied from `B1_AUTHORIZATION_RBAC.md` §4's own "Conceptually required shape (not code)" precedent, an accumulator column list, and a counter summary block. None is executable code. A mechanical scan for Django/ORM/SQL/DRF/Celery/SDK tokens returns zero matches |
| `B12_FILES_CREATED` | 0 | `ls Docs/backend` shows `B1 B10 B11 B2 B3 B4 B5 B6 B7 B8 B9` — no `B12`, `B13`, or `B14` directory exists |
| `B13_FILES_CREATED` | 0 | same |
| `B14_FILES_CREATED` | 0 | same |

## 5. What this pack deliberately does NOT claim

Recorded so that `FALSE_VERIFICATION_CLAIMS = 0` is checkable rather than asserted. B11 does **not** claim: that Hostinger offers a managed object-storage service; that the deployed target supports pre-signed URLs, object lock, lifecycle rules, or checksum headers; that a provider ETag is a content hash; that WazLink scans uploads for malware; that any statutory retention period applies; that encryption at rest is guaranteed; that WhatsApp accepts any particular media size or type; that any figure in `B11-D-B007` is a calibrated production value; that storage is or should be a plan entitlement; or that this self-check is an independent verification.

## 6. Dirty scope

Exactly two paths change, both additive:

| Path | Change |
|---|---|
| `Docs/backend/B11/**` | 35 new documents |
| `BACKEND_DOCUMENTATION_INDEX.md` | one new `## B11` section appended before the "Required next-phase gate" heading. **No B0–B10 section is rewritten, reordered, or edited.** |

No commit, no push, no stage, no reset, no rebase, no merge, no clean, and no checkout of a frozen file was performed at any point.

## 7. Corrections applied by B11-FIX.1

The first independent CTO verification found one MAJOR and four MINOR defects in this pack. All five are closed, and the corrections are recorded here rather than absorbed silently, because a self-check that quietly repairs its own false statements is worth less than one that names them.

| ID | What was wrong | What it is now |
|---|---|---|
| `B11-V-001` (MAJOR) | Frozen `FileAsset.content_type` is a **required, non-nullable string** on the `201` from `createFileUpload`, but `B11_STORAGE_MODEL.md` declared the column "null until finalize" — so the frozen `201` was unproducible, and `B11_UPLOAD_MODEL.md`'s `201` sketch omitted two frozen-required fields | `content_type` is `NOT NULL` from insert and **two-phase**: the validated provisional allow-list member while `pending`, overwritten once with the verified detected type at finalize (`B11_FILE_VALIDATION.md` §3.1). Raw client MIME is still never trusted and never promoted. `B11-AM-001` stays `ADDITIVE`; **no `NON_ADDITIVE` amendment is required** |
| `B11-V-002` (MINOR) | Two `FB-B11-*` citations resolved but pointed at the wrong evidence row | Corrected to `FB-B11-006` and `FB-B11-009`; all eleven citations re-read semantically (§3) |
| `B11-V-003` (MINOR) | `DeleteAsset`'s guard list admitted `pending → archived`, which the lifecycle table does not define; its `logical_bytes` decrement was unconditional though `failed` is never counted; and `failed → archived` was misattributed to orphan classes `O-1`/`O-2` | An explicit source-state guard (`available`\|`quarantined`\|`failed`), a conditional decrement rule (`B11_DELETION_RETENTION_MODEL.md` §2.1) that references the single canonical counted-set definition rather than restating it, and corrected trigger attribution. Finalize-vs-delete and detach-vs-delete are now stated races (`B11_IDEMPOTENCY_CONCURRENCY.md` §3) |
| `B11-V-004` (MINOR) | The frozen `502` on `createFileUpload` was implicitly dropped by a sentence scoping `502` to operations 2, 3, 6, 7 | The frozen `502` is **retained verbatim**; `B11_API_DTO_CONTRACTS.md` §5 now distinguishes *declared* from *actively raised*. `FROZEN_RESPONSE_REMOVALS = 0`, `UNREGISTERED_API_CONTRACT_EDITS = 0` |
| `B11-V-005` (MINOR) | Three mechanical claims in this document were false: "exactly one entry" from `git status`, "five fenced blocks", and "every document … is cited at least once" | `DIRTY_STATUS_ENTRY_COUNT = 2`, `FENCED_BLOCK_COUNT_DERIVED = 6`, `UNCITED_WITHIN_B11_DOCUMENT_COUNT = 2` — each re-derived by execution, not recalled (§3, §4) |

### B11-FIX.1a — pre-publication hygiene

The independent countersign of FIX.1 cleared V-001…V-005 and found one further defect of the same class as V-004, plus one localized command/state-machine mismatch. Both are closed here.

| ID | What was wrong | What it is now |
|---|---|---|
| `B11-C-001` (MINOR) | FIX.1 preserved `createFileUpload`'s frozen `502` but placed **`downloadFile`** — the *other* frozen Files operation, which declares `502 ProviderUnavailable` at `BACKEND_OPENAPI_V1.yaml` lines 1851-1853 — in a row asserting `502` was not declared. That was an unregistered removal of a frozen response, and it made `B11-AM-002`'s "complete declared response set" claim false | §5 now classifies all eleven operations into three explicit classes. **Both** frozen operations (1 and 5) retain their frozen `502` verbatim as class A — declared for contract compatibility, not actively raised by a Phase-1 path that touches no provider. `FROZEN_RESPONSE_REMOVALS = 0`, `UNREGISTERED_API_CONTRACT_EDITS = 0`, and `B11-AM-002` is now true as written, with **no new amendment required** |
| `I-1` (INFO) | `QuarantineFile`'s precondition was `lifecycle ∈ {pending, available}`, wider than the state machine, which defines `available → quarantined` as the only operator-quarantine edge | The precondition is narrowed to `lifecycle_state = 'available'`. `pending → quarantined` remains `FinalizeUpload`'s alone — the scanner integration point — and `B11_FILE_LIFECYCLE.md` §2 now states the two producers separately. Negative control `AT-B11LC-5` |
| `I-2` (INFO) | `B11_STORAGE_MODEL.md` cited `B11_FILE_VALIDATION.md` §3 where the rule now lives in §3.1 | Reference made exact |

`I-3` required no repository change: the countersign independently established that the executor report's touched-file wording appears nowhere in repository content, and nothing was edited to chase it.

**Nothing else was changed.** No architecture either independent pass found sound was reopened: Phase-1 application-proxied upload, the refusal to assume any Hostinger capability, B8's entitlement authority, B5's Message authority, and B10's tax authority all stand exactly as written. `CONTROLLED_AMENDMENT_COUNT` remains 12 (10 additive, 2 compatible clarifications, 0 non-additive) — the repairs required no new amendment, which is itself the evidence that the adjudications stayed inside the frozen contract.
