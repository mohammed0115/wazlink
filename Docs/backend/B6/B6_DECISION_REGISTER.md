# B6 — Decision Register

> **Class A** — must be resolved before B6 closes. **Class B** — may be resolved during implementation preparation without changing architecture. **Class C** — belongs to a later phase or is genuinely non-blocking.
>
> **B6 cannot close with an unresolved Class A.**

## 1. Class A — resolved

| ID | Question | Decision | Rationale | Where |
|---|---|---|---|---|
| `B6-D-A001` | What is B6's aggregate/entity model? | **`Deal`** root; 4 owned entities (`Pipeline`, `PipelineStage`, `DealStageTransition`, loss-reason catalog); explicit non-ownership of Lead/Contact/Business/IntelligenceRun/Conversation/Message/RevenueEvent/AttributionTouchpoint/AutomationRun | matches frozen B0's own aggregate name and table-group list exactly | `B6_DOMAIN_OWNERSHIP.md` |
| `B6-D-A002` | Can one Lead have multiple Deals? | **Yes, 0..N.** Frozen ERD: `LEAD ||--o{ DEAL` | matches B2's own frozen cardinality | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §1 |
| `B6-D-A003` | Can a Deal exist without a Lead? | **No, in Phase 1.** `lead_id NOT NULL`, immutable | frozen ERD's "opens" relationship label; mirrors `B5-D-A002`'s post-conversion pattern | §1 |
| `B6-D-A004` | Can a Deal reference Business? | **Yes — as a derived snapshot of `Lead.business_id`, not an independent relationship** | reconciles frozen DTO's `business_ref` against frozen Doctrine R-2's `Deal → Lead, Pipeline, Stage` list without contradicting either | `B6_DEAL_AGGREGATE.md` §3 |
| `B6-D-A005` | Can a Deal reference Contact(s)? | **No direct reference. No `DealContactLink`.** Reached via `Deal.lead_id → Lead → lead_contacts` | avoids a second, driftable CRM relationship truth | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5 |
| `B6-D-A006` | Does `CreateDeal` mutate `Lead.status`? | **Never.** Pipeline is not among Lead's allowed writers | frozen `BACKEND_DOMAIN_OWNERSHIP.md`: "CRM services" is the sole writer of `leads` | §3 |
| `B6-D-A007` | Is the value field `amount` or `value`? | **`value`** — the frozen DTO's own name. B6 does not invent a second field name for the identical concept | matches `BACKEND_DTO_CONTRACTS.md`'s Deal DTO sketch verbatim; avoids the exact class of error `B5-FIX.1` corrected | `B6_DEAL_AGGREGATE.md` §1 |
| `B6-D-A008` | What currency rules apply? | **Workspace-default currency (SAR, Phase 1), immutable per-Deal after creation, no FX subsystem** | matches frozen `BACKEND_ANALYTICS_SEMANTICS.md`'s "Phase 1 defaults to SAR" and `NUMERIC(19,4)` money convention; matches frontend's uncontested single-currency evidence | `B6_CURRENCY_MODEL.md` |
| `B6-D-A009` | Does Deal have its own `archived` state, separate from `status`? | **No.** `status ∈ {open, won, lost}` already provides list hygiene | evaluated and rejected as unnecessary machinery — no `archived_at` column on `deals` | `B6_RETENTION_DELETION.md` §1, `B6_DEAL_STATE_MACHINE.md` §1 |
| `B6-D-A010` | Is weighted pipeline value financial truth? | **No — forecast/sales-projection only, computed at read time, never persisted, never revenue-selector-reachable** | matches frozen `BACKEND_ANALYTICS_SEMANTICS.md`'s "Weighted Pipeline" row and contradiction-prevention clause exactly | `B6_FORECAST_PROBABILITY.md` §2, `B6_REVENUE_FIREWALL.md` §4 item 5 |
| `B6-D-A011` | Can multiple pipelines exist per workspace? | **Architecturally yes; Phase 1 ships exactly one auto-created default per workspace, no creation UI** | frontend shows one implicit pipeline (`FB-D10`) over a multi-pipeline-capable schema; B6 preserves the capability without inventing unused UI | `B6_PIPELINE_MODEL.md` §1 |
| `B6-D-A012` | Are Won/Lost configurable pipeline stages or Deal-level terminal outcomes? | **Deal-level terminal outcomes (`Deal.status`), never `pipeline_stages` rows** | resolves the frozen DTO's separate `status`/`stage_ref` fields cleanly; avoids sentinel-stage protection scattered across every stage-admin command; resolves the frontend's dual-representation gap (`FB-D11`) to one authority | `B6_PIPELINE_STAGE_MODEL.md` §1 |
| `B6-D-A013` | Is a loss reason required on Lost? | **Yes, always**, structured `loss_reason_code` from a workspace catalog, plus optional free-text note | a Lost Deal with no reason is unactionable for pipeline coaching; restores the frontend's defined-but-unwired taxonomy (`FB-D19`) | `B6_WON_LOST_LOSS_REASONS.md` §3 |
| `B6-D-A014` | Can Won/Lost Deals be reopened? | **Yes.** `ReopenDeal`, `won→open`/`lost→open`, `deal.reopen`, mandatory reason note | task-required; no frontend evidence either way (`FB-D20`), added on the corpus's own `reopenConversation` precedent (B5); additive amendment to the frozen state-machine sketch | `B6_DEAL_STATE_MACHINE.md` §2, `B6_CONTROLLED_AMENDMENTS.md` item 1 |
| `B6-D-A015` | Can a Deal move backwards or skip stages? | **Yes, unrestricted, within the same pipeline** | matches frozen sketch's silence on ordering and frontend's zero-order-validation drag path (`FB-D12`) | `B6_DEAL_STATE_MACHINE.md` §4 |
| `B6-D-A016` | Can stages be reordered? | **Yes**, via `ReorderPipelineStages`, atomic full-list rewrite of `position`, no partial reorder | avoids two stages ever sharing a position mid-operation | `B6_PIPELINE_STAGE_MODEL.md` §3 |
| `B6-D-A017` | Can stages be deleted when Deals reference them? | **Forbidden while any `status='open'` Deal references the stage; permitted once none do — never a hard delete, only `archived_at`** | preserves historical `stage_id` integrity on closed Deals unconditionally | `B6_DATA_MODEL.md` §6, `B6-DF-032` |
| `B6-D-A018` | Are transition permissions enforced object-level? | **Yes — `assigned/team scope`, reusing B1's existing `task.manage`/`lead.assign`-style condition evaluator, no second mechanism invented** | frozen B0 action-matrix condition, operationalized identically to every other domain that already carries it | `B6_ENTITLEMENT_RBAC_TENANCY.md` §4 |
| `B6-D-A019` | Can the default pipeline be deleted? | **Never while it is the workspace's only active pipeline** | a workspace must always have a usable pipeline to create Deals against | `B6_PIPELINE_MODEL.md` §2, `B6-DF-033` |
| `B6-D-A020` | How many new vs. reused permission codes? | **3 new (`deal.assign`, `deal.reopen`, `pipeline.manage`), 4 reused verbatim (`deal.view`, `deal.create`, `deal.update`, `deal.close`)** | checked against frozen `B1_AUTHORIZATION_RBAC.md` first — the exact discipline `B5-FIX.1` had to retroactively apply | `B6_ENTITLEMENT_RBAC_TENANCY.md` §2 |
| `B6-D-A021` | Are commands idempotent? | **Yes — `Idempotency-Key` required on every state-mutating command**, stricter than the frozen minimum, matching B5's own precedent | commercial-state duplication is exactly the class of error idempotency exists to prevent | `B6_CONCURRENCY_IDEMPOTENCY.md` §3 |
| `B6-D-A022` | How is optimistic concurrency handled? | **`version`/`If-Match` on every mutable aggregate, row-locked, no silent last-write-wins, for every named race scenario** | frozen `BACKEND_ARCHITECTURE_DECISIONS.md` already names Deal among the versioned DTOs | `B6_CONCURRENCY_IDEMPOTENCY.md` §1–§2 |
| `B6-D-A023` | Which new B6 events qualify Lead's `last_activity_at`? | **Only `DealReopened` (additive amendment). `DealAssigned`/`DealUpdated` deliberately excluded** — administrative facts, not substantive commercial-progress facts | mirrors B2's own exclusion reasoning for carrier-receipt-class and machine-driven events | `B6_CRM_TIMELINE_PROJECTION.md` §3 |
| `B6-D-A024` | Can B6 mutate Messaging state? | **Never.** No write path to `conversations`/`messages`/`message_deliveries`; sending from Deal context uses B5's unmodified `SendMessage` | frozen B0 Messaging row's "no Deal mutation" restated symmetrically from B6's side; matches `B5-D-A024` | `B6_B5_MESSAGING_BOUNDARY.md` §1, §3 |
| `B6-D-A025` | Does a B4 recommendation authorize a Deal mutation? | **Never.** No B6 command accepts a B4 run/signal/recommendation ID as an authorization input | mirrors `B5-D-A021`'s "recommendation existence ≠ authorization" verbatim; direct frontend evidence `FB-D34`–`FB-D36` | `B6_B4_INTELLIGENCE_BOUNDARY.md` §2 |
| `B6-D-A026` | How will future B7 automation mutate Deals? | **Through the identical governed commands** every human actor uses — no second transport path | closes automation-bypasses-governance before B7 exists to be tempted by it; mirrors `B5-D-A025` | `B6_B7_AUTOMATION_BOUNDARY.md` §1 |
| `B6-D-A027` | Does B6 consume any cross-domain event? | **No — `CONSUMED_EVENT_COUNT = 0`.** Every dependency is a synchronous, on-demand read | mirrors `B4`'s and `B5`'s identical "zero consumed events, no circular dependency" precedent, now three phases running | `B6_COMMAND_EVENT_CATALOG.md` §4 |
| `B6-D-A028` | Does B6 create external provider cost? | **No — zero.** No third-party call of any kind exists in the domain | unlike B3/B4/B5, there is no provider to bound | `B6_RATE_COST_MODEL.md` §1 |
| `B6-D-A029` | Does a frozen messaging-style rate-limit row need adding? | **No — the frozen general-API ceiling (300/min/workspace) already covers B6's abuse-protection needs.** No new `BACKEND_RATE_LIMIT_POLICY.md` row | contrasted deliberately against B3/B4/B5, each of which had genuine provider cost to bound and B6 does not | §2 |
| `B6-D-A030` | Is Pipeline/Deal a metered or gated capability? | **Core CRM capability in Phase 1, unmetered**, with a reserved `pipeline.core` entitlement hook for future packaging | matches Lead/Task/Appointment's own unmetered-core-CRM precedent; defers pricing per the task's own instruction | `B6_ENTITLEMENT_RBAC_TENANCY.md` §6 |
| `B6-D-A031` | Can a Deal's `pipeline_id`/`currency` change after creation? | **No — both immutable.** Cross-pipeline moves and currency changes are `NOT_SUPPORTED` in Phase 1 | no frozen precedent for either; deferred rather than invented (see `B6-D-B002`) | `B6_DEAL_AGGREGATE.md` §2 |
| `B6-D-A032` | Is `Deal.owner_membership_id` ever null? | **Never.** Every Deal has exactly one owner from creation; "unassigned" is not a modeled state | avoids a null-owner Deal silently escaping owner-scoped filters | `B6_OWNERSHIP_ASSIGNMENT.md` §5 |
| `B6-D-A033` | Can a closed (Won/Lost) Deal still be reassigned? | **Yes — reassignment does not require `ReopenDeal` first**, since it touches no commercial-outcome field | reporting/handoff needs outlive a Deal's closure | `B6_OWNERSHIP_ASSIGNMENT.md` §3 |
| `B6-D-A034` | Can `won ↔ lost` transition directly? | **Never.** Must go `won → open` (`ReopenDeal`) then `open → lost` (`CloseDealLost`), two separately audited steps | prevents a silent one-step outcome flip from ever bypassing the reopen audit trail | `B6_DEAL_STATE_MACHINE.md` §3 |

**`CLASS_A_UNRESOLVED = 0`.** All 34 Class A questions are decided.

## 2. Class A unresolved

**None.**

## 3. Class B — implementation preparation

| ID | Item | Why it is not Class A |
|---|---|---|
| `B6-D-B001` | Whether Deal-filtering-by-Business re-resolves live (`Deal.lead_id → Lead.business_id`) or accepts the `Deal.business_id` snapshot in every read-model query | the *rule* (snapshot is historical/display-only, live filters must resolve through Lead) is Class A (`B6-D-A004`); the exact query-implementation detail per read model is refinable |
| `B6-D-B002` | Whether cross-pipeline Deal movement is ever supported | the *current* prohibition is Class A (`B6-D-A031`); whether a future phase lifts it is implementation-adjacent product scope |
| `B6-D-B003` | The exact default-probability seed values for the 6 open stages of the default pipeline template | the existence of a `default_probability`-seeded creation flow is Class A (`B6_PIPELINE_STAGE_MODEL.md` §4); the specific numbers are operational/product calibration |
| `B6-D-B004` | The exact system-default loss-reason catalog wording (beyond "6 rows including `other`") | the requirement of a required, structured, catalog-backed reason is Class A (`B6-D-A013`); the specific label text is refinable, localization-dependent |
| `B6-D-B005` | Whether `pipeline.manage`'s "non-financial configuration only" manager-conditional scope needs a more granular sub-condition | the three-tier permission shape itself is Class A (`B6-D-A020`); the exact condition text is B1-precedent-following but not pinned to a single literal wording here |
| `B6-D-B006` | Exact cursor page-size default/max for `GET /deals` and `GET /deals/{id}/transitions` | cursor pagination's existence is Class A (`B6_API_DTO_CONTRACTS.md` §4); the specific limit is operational, matching every other domain's identical deferral |
| `B6-D-B007` | Whether `DealUpdated`'s `changed_fields[]` payload needs before/after values or just field names | the event's existence and audit purpose is Class A; the exact payload richness is an implementation-preparation refinement |

**`CLASS_B_UNRESOLVED = 7`.**

## 4. Class C — later phases / non-blocking

| ID | Item | Owner |
|---|---|---|
| `B6-D-C001` | `Lead.status` auto-advancing on `DealWon` via a future governed automation | no frontend evidence or stated need exists today; explicitly not an implicit B6 side effect if ever built (`B6-D-A006`) |
| `B6-D-C002` | True multi-currency Deals with cross-currency aggregation/FX | no frontend evidence multi-currency was ever considered; would need an FX-rate source B6 deliberately does not invent |
| `B6-D-C003` | Full field-level edit history beyond the aggregate `version` counter | no frontend evidence or stated need today |
| `B6-D-C004` | Stage default-probability calibration tooling from historical win-rate data | would need B4-adjacent statistical machinery, out of scope here |
| `B6-D-C005` | A time-bounded retention/purge policy for closed Deal detail | product/legal decision required, mirrors `B4_DATA_MODEL.md` §4's and `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §5's identical posture |
| `B6-D-C006` | Which future domain (B9, or a B6 extension) owns detailed financial-recognition workflow design | B6's revenue-firewall boundary is invariant to the answer (`B6_REVENUE_FIREWALL.md` §5) — the question does not need resolving to close B6 |

**`CLASS_C_UNRESOLVED = 6`.**

## 5. External validation register

B6 requires no external validation register (`B6_RATE_COST_MODEL.md` §1) — Pipeline/Deals is internal domain architecture with no provider dependency, matching the task's own expectation that this phase would need little to no provider research.

## 6. Decisions inherited rather than made

`B6-D-A007`'s `value` naming, `B6-D-A012`'s Won/Lost-as-status, `B6-D-A020`'s permission reuse, and `B6-D-A024`'s no-Deal-mutation-from-Messaging boundary are each, in substance, already implied by frozen B0/B1/B2/B5 text that predates this document — B6's contribution in each case is making the implication explicit and checked, not inventing new architecture. This mirrors the general finding stated in `B6_EXECUTIVE_SUMMARY.md` §1: B6 is the most purely `COMPATIBLE_REFINEMENT`-heavy phase of the corpus so far, because frozen B0 specified more of Pipeline's shape up front than it did for Discovery, Intelligence, or Messaging at their respective phase starts.
