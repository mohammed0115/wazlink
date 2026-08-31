# B5 — Implementation Readiness

> **B5 status:** `DESIGN IN PROGRESS`. **B5 is NOT closed.** Closure requires a fresh independent CTO audit — this document states readiness and shows the evidence; it does not claim closure, exactly as B4's own identical document never claimed it for B4.
>
> **`B5-FIX.1`:** a first independent CTO audit ran against the original pass and found `B5_VERIFICATION = FAIL` (1 MAJOR, 3 MINOR, 2 INFO). This document, and every gate below, reflects the state **after** `B5-FIX.1`'s remediation — see §4.2 for the itemized repair record. The gates below being `READY` is evidence for a fresh independent re-audit to check, not a self-declared pass.

## 1. Readiness gates

| Gate | Status | Evidence |
|---|---|---|
| `FRONTEND_TRUTH_ESTABLISHED` | **READY** | 32 messaging-adjacent behaviors traced with file:line citations; S7 (in scope) and S8's messaging touchpoints (governed boundary, not owned) separated on record |
| `DOMAIN_OWNERSHIP_READY` | **READY** | 1 aggregate, 9 entities; explicit non-ownership table for every candidate the brief names |
| `CONVERSATION_MODEL_READY` | **READY** | Lead-keyed identity resolved with direct frontend + B2 cross-domain evidence; the FB-26 fixture tension resolved explicitly, not silently copied |
| `MESSAGE_MODEL_READY` | **READY** | content/transport separation; immutability after admission |
| `MESSAGE_STATE_READY` | **READY** | two disjoint state machines, 7+2 states, monotonicity rule with the one stated exception (`read` implies `delivered`) |
| `PROVIDER_ABSTRACTION_READY` | **READY** | reuses frozen `MessagingProvider` port name; zero vendor-specific domain concept |
| `PROVIDER_CONFIGURATION_READY` | **READY** | one `ChannelBinding` per workspace, Phase 1, explicitly decided rather than defaulted to a shared number |
| `WEBHOOK_SECURITY_READY` | **READY** | signature-before-processing, workspace-resolution-never-from-body, both structural |
| `INBOUND_PIPELINE_READY` | **READY** | every case in the brief's §12 list traced to a deterministic outcome |
| `OUTBOUND_PIPELINE_READY` | **READY** | transaction boundaries explicit; ambiguous-timeout handling closed before requesting closure |
| `IDEMPOTENCY_READY` | **READY** | 5 layers, each with a stated key and mechanism |
| `CONCURRENCY_READY` | **READY** | every race in the brief's §44 list traced |
| `CONTACT_PHONE_READY` | **READY** | normalization, provenance, and the "never a global identity" rule stated structurally |
| `CONSENT_READY` | **READY** | absolute opt-out, no override path at any privilege level |
| `CUSTOMER_SERVICE_WINDOW_READY` | **READY** | 4-outcome evaluator; duration sourced externally, never hard-coded |
| `TEMPLATE_READY` | **READY** | mirror vs. immutable-snapshot split; 7-attack variable-safety table |
| `MEDIA_B11_BOUNDARY_READY` | **READY** | reference-only ownership; contract to B11 stated without designing B11 |
| `B4_HANDOFF_READY` | **READY** | recommendation-never-equals-authorization, with direct FB-30/FB-31 evidence |
| `B2_LEAD360_READY` | **READY** | live read-through only, no denormalization |
| `CRM_TIMELINE_READY` | **READY** | satisfies B2's frozen `source_event_id` contract exactly, checked against its actual text, not summarized from memory |
| `B6_B7_BOUNDARY_READY` | **READY** | structural negative invariants stated; governed-command-reuse principle fixed for B7 before B7 exists |
| `ENTITLEMENT_READY` | **READY** | five independent gates, none redundant |
| `RBAC_READY` | **READY** | two additive permissions (`messaging.manage`, `messaging.provider.manage`); two REUSED verbatim from frozen `B1_AUTHORIZATION_RBAC.md` (`conversation.view`, `message.send`, `message.send` tracing further to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23) — corrected by `B5-FIX.1` from the original pass's false claim that these were new inventions |
| `TENANCY_READY` | **READY** | every table scoped; no exception list needed (unlike B4's global catalogues) |
| `RATE_COST_RETRY_READY` | **READY** | proposes the missing frozen anchor explicitly rather than assuming one; retry-ceiling provenance stated precisely, learning B4's own post-audit correction proactively |
| `RECONCILIATION_READY` | **READY** | bounded, workspace-scoped, observable, idempotent — all four properties stated per process |
| `SECURITY_PRIVACY_READY` | **READY** | 21-item threat table, all from the brief's required list |
| `DATA_MODEL_READY` | **READY** | 8 tables, purpose/columns/constraints/retention stated; no DDL |
| `API_CONTRACT_READY` | **READY** | 16 operations, each with method, route, permission, DTOs, idempotency, errors |
| `DTO_CONTRACTS_READY` | **READY** | 4 request + 9 response DTOs; a leak-prohibition list |
| `COMMAND_EVENT_READY` | **READY** | 12 commands (2 frozen-refined, 10 additive — corrected by `B5-FIX.1`), 8 events (4 frozen-refined, 4 additive), 0 consumed |
| `FAILURE_SCENARIOS_READY` | **READY** | B5-DF-001–045 with deterministic outcomes (corrected from 40 by `B5-FIX.1`; 8 genuinely new scenarios added, 2 non-failure entries removed, 1 duplicate merged) |
| `ACCEPTANCE_TESTS_READY` | **READY** | 36 categories, 179 tests, 37 negative controls including three added by `B5-FIX.1` (RevenueEvent non-creation, duplicate-callback dedup, credential/binding cross-workspace) |
| `DECISION_REGISTER_READY` | **READY** | 34 Class A closed (one, `B5-D-A034`, revised by `B5-FIX.1` — decision unchanged in substance, corrected in its stated premise), 8 Class B, 9 Class C |
| `CONTROLLED_AMENDMENTS_READY` | **READY** | 6 operations / 5 decisions across 5 frozen packages; zero non-additive items after `B5-FIX.1`'s correction of item 4 (two permissions reclassified `NO_CHANGE_REQUIRED`/reused rather than `ADDITIVE`/new); overlap-matrix checked against B1–B4's own bundles, zero collisions found |
| `B5_CLOSED` | **NOT CLAIMED** | closure requires an independent CTO audit |

## 2. Mechanically recomputed evidence

Every number below is produced by a direct count over the corpus (`B5_EXECUTIVE_SUMMARY.md` §8 reproduces the full counter block; the acceptance-test counts were verified by `grep -c`, not estimated).

## 3. Frozen-contract safety

| Metric | Method |
|---|---|
| `B0_DRIFT = 0` | no frozen root artifact modified — every citation in this corpus is a read; `B5_CONTROLLED_AMENDMENTS.md` proposes changes without applying them |
| `B1_DRIFT = 0` | `B1_AUTHORIZATION_RBAC.md` unmodified — two new permission codes (`messaging.manage`, `messaging.provider.manage`) are a proposed amendment, not an edit; `conversation.view`/`message.send` are reused verbatim, requiring no edit at all (corrected by `B5-FIX.1`) |
| `B2_DRIFT = 0` | no file under `Docs/backend/B2/` modified |
| `B3_DRIFT = 0` | no file under `Docs/backend/B3/` modified |
| `B4_DRIFT = 0` | no file under `Docs/backend/B4/` modified |
| `EVENT_ENVELOPE_DRIFT_FROM_B0 = 0` | B5's eight events all declare the frozen envelope fields and no others |
| `IMPLEMENTATION_LEAKAGE = 0` | scanned for Django/DRF/Celery/migration/real-Meta-API-call patterns — zero hits across all 36 documents; no SQL fenced block |
| `UNAUTHORIZED_FILES = 0` | only `Docs/backend/B5/*.md` and the B5 section of `BACKEND_DOCUMENTATION_INDEX.md` are touched |

## 4. Self-adversarial review

Thirty attacks were run against this design (brief §58's list), each recorded with its outcome.

| # | Attack | Expected governing rule | Result | Artifact |
|---:|---|---|---|---|
| 1 | Same phone exists in two workspaces | independent histories | **closed.** `(workspace, channel, phone)`-scoped everywhere | `B5-D-A031` |
| 2 | Forged webhook chooses another workspace | resolution only via verified binding | **closed.** Workspace is a function of which secret verified | `B5-D-A011` |
| 3 | Duplicate inbound webhook | one durable effect | **closed.** Receipt-layer dedup | `B5-D-A013` |
| 4 | Duplicate outbound actor click | one send | **closed.** `Idempotency-Key` | `B5-D-A022` |
| 5 | Provider accepts send but response lost | no blind resend | **closed.** Worker re-reads delivery history before retrying | `B5_IDEMPOTENCY_CONCURRENCY.md` §5 |
| 6 | Provider response arrives after status webhook | resolved by monotonicity | **closed.** Legal-transition table governs regardless of arrival order | `B5-D-A014` |
| 7 | Read arrives before delivered | inferred intermediate transition | **closed, explicitly, not silently.** The one named exception in §4 | `B5_MESSAGE_STATE_MACHINE.md` §4 |
| 8 | Failed arrives after delivered | legal — async post-delivery failure is real | **closed.** Transition 8 |
| 9 | Delivered arrives after failed | rejected, not applied | **closed.** No outgoing edge from `failed` |
| 10 | Unknown provider status | recorded, not applied to the closed enum | **closed.** `B5_PROVIDER_ABSTRACTION.md` §3 |
| 11 | `provider_message_id` collision across bindings | uniqueness is per-binding | **closed.** `B5-D-A032` |
| 12 | Two agents create a Conversation simultaneously | one row, unique-constraint-backed | **closed.** `B5_IDEMPOTENCY_CONCURRENCY.md` §3 |
| 13 | Mark-read races inbound | new message stays unread | **closed.** §3, same document |
| 14 | Archived Conversation receives inbound | reopens as part of the same transaction | **closed.** `B5_CONVERSATION_MODEL.md` §4 |
| 15 | Lead is archived/deleted while a Conversation exists | Conversation continues to resolve, subject only to B2's own read rules | **closed.** `B5_B2_CRM_LEAD360_HANDOFF.md` §4–§5 |
| 16 | Contact phone changes | existing Conversation keeps its old key, never auto-merged | **closed.** `B5_CONTACT_PHONE_RESOLUTION.md` §7 |
| 17 | Unknown inbound phone later linked to a Contact | history not rewritten; only future messages resolve correctly | **closed.** §6, same document |
| 18 | B4 recommendation attempts direct send | no field admits it | **closed.** `B5-D-A021` |
| 19 | Future B7 automation bypasses consent | reuses the identical governed command | **closed.** `B5-D-A025` |
| 20 | Frontend entitlement flag forged | server re-checks all five gates regardless | **closed.** `B5-D-A026` |
| 21 | Actor loses permission between request and worker execution | admission already passed at request time; not re-authorized mid-flight (documented as deliberate, not overlooked) | **closed by design choice, stated explicitly.** `B5_FAILURE_SCENARIOS.md` B5-DF-011 |
| 22 | Provider credentials disabled after queueing | `queued` sends fail fast on the *next* admission; an already-admitted send is not retroactively cancelled but a disabled provider will reject it at dispatch | **closed.** `B5_PROVIDER_CONFIGURATION_MODEL.md` §5, B5-DF-009 |
| 23 | Template becomes rejected after local selection | provider-side rejection surfaces normally as a `failed` outcome | **closed.** `B5_TEMPLATE_MODEL.md` §7 |
| 24 | Media URL expires before worker send | provider rejects, `media_failure`; inbound-fetch case has its own `expired` state | **closed.** B5-DF-015, `B5_MEDIA_B11_HANDOFF.md` §3 |
| 25 | Provider throttles all workspaces | WazLink's own ceiling is independent of Meta's; throttling is surfaced, not silently absorbed into a retry storm | **closed.** `B5_RATE_COST_RETRY_MODEL.md` §3, `B5_RECONCILIATION_OBSERVABILITY.md` §1 |
| 26 | One workspace floods a shared worker pool | the workspace admission ceiling bounds request volume at the API boundary, before worker dispatch | **closed.** `B5-D-A028` |
| 27 | Cancellation/refund creates a provider-spend loop | **closed, and deliberately stricter than B4's own pattern.** Cancellation never refunds the admission counter at all (§6, `B5_RATE_COST_RETRY_MODEL.md`) — a stronger rule than B4's release-on-queued-cancel, chosen because B5's ceiling is request-volume-shaped | `B5-D-A027` |
| 28 | Raw webhook payload leaks a secret/PII | never logged in full at any level; secrets never appear in any payload B5 itself constructs | **closed.** `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §4 |
| 29 | Prompt injection in inbound message reaches Sales AI | stored as inert data, never interpolated into an instruction channel | **closed.** §2 item 10, same document |
| 30 | B5 attempts to mutate Deal/Revenue | structurally impossible — no B5 table has the FK | **closed.** `B5-D-A024`/`A033` |

No attack surfaced a working exploit. Two are worth restating as design choices rather than oversights: #21 (permission is checked at admission, not re-checked per worker tick) and #27 (B5's cancellation-refund rule is stricter than B4's, for a stated reason specific to what B5's ceiling represents).

### 4.1 Issues found by this review and repaired in this pass

| Found | Repair |
|---|---|
| the retry-ceiling provenance wording risked the exact imprecision an independent audit found and corrected in B4 (`MAX_SEND_ATTEMPTS_PER_MESSAGE=3` could read as if derived from B0's literal 5/6 ceiling) | `B5_RATE_COST_RETRY_MODEL.md` §4 states the corrected provenance from first authoring, learning the lesson proactively rather than requiring a second independent audit to catch it |
| `conversation.view` risked being independently reinvented as `messaging.view`, creating two names for the same B2-required permission | checked `B2_TIMELINE_IDENTITY_MODEL.md`/`B2_NOTE_ACTIVITY_TIMELINE.md` directly before naming any permission; adopted the frozen name verbatim (`B5_ENTITLEMENT_RBAC_TENANCY.md` §1). **This check stopped one step short**: it never checked whether `conversation.view` was *itself* already defined in frozen `B1_AUTHORIZATION_RBAC.md` (it was), and never applied the identical discipline to the send-side name, inventing `messaging.send` instead of checking for `message.send`. `B5-FIX.1` §4.2 completes the check this row describes |
| the frozen frontend's two-conversations-for-one-lead fixture (FB-26) could have been silently copied forward as "conversations may fork," reopening a duplicate-truth risk | resolved explicitly as `B5-D-A003`, with the `reopenConversation` command's own existence used as deciding evidence, mirroring B4's `B2-D-B006`/`B3-D-C011` resolution discipline |
| B4's own cancellation-refund pattern (release on `queued`-cancel) does not transfer safely to B5's request-volume-shaped ceiling — copying it verbatim would have reopened exactly the spend-loop attack (#27) it was designed to close in B4's context | designed a stricter, B5-specific rule (never refund) rather than assuming B4's precedent transfers unchanged |

### 4.2 Issues found by the independent CTO audit and repaired by `B5-FIX.1`

> This section exists precisely because §4.1 is self-review and self-review is not independent verification (§5 item 5). A fresh independent CTO audit ran against the original pass, returned `B5_VERIFICATION = FAIL`, and found the following. Every row below is a defect an outside reader found that this document's own §4.1 self-review did not.

| # | Found (independent audit) | Repair (`B5-FIX.1`) |
|---:|---|---|
| 1 (MAJOR) | `B5_ENTITLEMENT_RBAC_TENANCY.md` §1 claimed frozen `B1_AUTHORIZATION_RBAC.md` had "no `conversation.*`/`messaging.*` code today" — false. Direct inspection shows `conversation.view` and `message.send` already exist there (§2/§3), `message.send` tracing to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23. `messaging.send` was proposed as new without ever mentioning the pre-existing `message.send`, and the proposed `conversation.view` role matrix silently changed the frozen `viewer` grant from conditional to unconditional-allow. This was an undeclared non-additive amendment to frozen B1 truth | `B5_ENTITLEMENT_RBAC_TENANCY.md` §1 rewritten to quote the frozen matrices directly and reuse both verbatim; every `messaging.send` reference across the corpus reconciled to `message.send`; `B5_DECISION_REGISTER.md` `B5-D-A034` and `B5_CONTROLLED_AMENDMENTS.md` item 4 corrected to `REUSE`/`NO_CHANGE_REQUIRED` for the two frozen permissions and `ADDITIVE` for only `messaging.manage`/`messaging.provider.manage`. `UNDECLARED_NON_ADDITIVE_AMENDMENTS` restored to 0 |
| 2 (MINOR) | `FRONTEND_TRACE_B` stated as 6 in three documents, but the traceability matrix's own 32 rows recount to 5 (24+5+1+2=32; 24+6+1+2=33 did not match the stated total) | `B5_FRONTEND_TRACEABILITY_MATRIX.md`, `B5_EXECUTIVE_SUMMARY.md`, `B5_IMPLEMENTATION_READINESS.md` (this document) all corrected to 5 |
| 3 (MINOR) | `COMMAND_COUNT`'s breakdown stated "4 frozen-derived/refined, 8 additive" in three documents, though only `SendMessage`/`ReceiveMessage` (2) are marked frozen in the same table; `B5_CONTROLLED_AMENDMENTS.md` item 2 separately said "8 additive... 10 in total... 8 net-new," self-contradictory | `B5_COMMAND_EVENT_CATALOG.md`, `B5_EXECUTIVE_SUMMARY.md`, `B5_CONTROLLED_AMENDMENTS.md`, this document all corrected to "2 frozen, 10 additive" |
| 4 (MINOR) | `B5_FAILURE_SCENARIOS.md`'s 40 scenarios had real coverage gaps (malformed webhook, unregistered channel binding, idempotency-key/different-payload, baseline permission/entitlement denial, generic provider 5xx, concurrent-vs-sequential duplicate webhook, and generic permanent rejection were missing or only partially covered), plus two non-failure boundary-clarification entries and one near-duplicate inflating the count | Eight genuinely new scenarios added (DF-036–DF-043); the two non-failure entries removed (content undisturbed in the documents they already cited); the duplicate merged into its sibling. `FAILURE_SCENARIO_COUNT` recounted to 45 — not forced back to 40 |
| 5 (MINOR, folded into the same pass) | `B5_ACCEPTANCE_TESTS.md`: 3 of 12 required negative controls (RevenueEvent non-creation, duplicate-callback dedup, credential/binding cross-workspace) existed only as ordinary tests, not `**NC**`-tagged rows | Three new `**NC**`-tagged rows added (`AT-DOM-5`, `AT-WH-7`, `AT-TEN-6` — see `B5_ACCEPTANCE_TESTS.md` changelog); existing tests for the same properties left in place, not deleted. `NEGATIVE_CONTROL_COUNT` recounted to 37, `ACCEPTANCE_TEST_COUNT` to 179 |
| 6 (INFO) | Some frontend-evidence citations (FB-07) described the mock's documented/commented intent rather than confirmed-executing behavior — the mock's own `advanceMessageStatus`/`sendMessage` wiring has argument-shape defects that mean the local simulation does not run as its comments describe | `B5_FRONTEND_TRACEABILITY_MATRIX.md` §4 added, distinguishing `FRONTEND_INTENDED_CONTRACT`/`FRONTEND_EXECUTING_BEHAVIOR`/`FRONTEND_MOCK_DEFECT` for both cases; no backend requirement was ever derived from the defective execution, so no design change follows |

`MESSAGING_SEND_STALE_REFS = 0`, `RBAC_FALSE_BASELINE_CLAIMS = 0`, `COUNT_PROPAGATION_ERRORS = 0` after this pass — see the global consistency search recorded in `B5_CONTROLLED_AMENDMENTS.md`'s and this document's own citations above.

## 5. Known non-blocking observations

| # | Severity | Observation |
|---:|---|---|
| 1 | INFO | `B5_MESSAGE_CONTENT_MODEL.md` was added beyond the brief's 35-document base list (36 total, including this readiness document and the executive summary within the 35) — justified as a genuine content-taxonomy home, mirroring B4's `B4_SIGNAL_TAXONOMY.md` split |
| 2 | INFO | `B5-D-C009` (which future domain generates AI draft text) is a real, evidenced future question — the frozen frontend already implements Copilot-drafted replies against a mock. A future phase should read `B5_B4_HANDOFF_CONTRACT.md` §4 before designing it |
| 3 | INFO | Eighteen `B5-X-*` external-validation items must be resolved before **implementation**, not before design closure — two more than B4's eleven, reflecting WhatsApp's materially larger external-fact surface (webhooks, templates, media, customer-service window) compared to a single AI provider call |
| 4 | INFO | `B5-D-C006` (cross-workspace caching) is recorded as explicitly *considered and rejected*, not merely unconsidered |
| 5 | INFO | This document's own authoring party is the same party that produced the design being reviewed in §4. **This is not independent verification.** Every gate above reading `READY` states evidence; it does not substitute for the fresh independent CTO countersignature B5 requires before it may be considered closed — the identical caveat B2, B3, and B4 each carried into their own first closure attempts |

## 6. What an implementation agent still cannot do

Until the amendment bundle (`B5_CONTROLLED_AMENDMENTS.md`) is approved and applied, no agent may create any B5 table, serve any `/conversations/*`, `/messages/*`, or `/messaging/*` route, add the two new permission codes (`messaging.manage`, `messaging.provider.manage`), or promote `TPL-*` into the registry. `conversation.view`/`message.send` require no such action — they are reused, unmodified, from frozen `B1_AUTHORIZATION_RBAC.md`. Independently of the bundle, **B5 grants no implementation authorization at all.** It is design documentation.

## 7. B6 readiness

`B5_AI_INTELLIGENCE...`(n/a) — the equivalent forward statement: B6 inherits exactly what B5 promises it (§1 of `B5_B6_B7_BOUNDARIES.md` traces every guarantee to its use) and needs nothing B5 did not already provide. `B6_READINESS = BLOCKED pending independent B5 closure` — the same posture B5 itself is in relative to B4 one phase ago.
