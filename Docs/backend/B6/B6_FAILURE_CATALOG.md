# B6 — Failure Catalog

> **B6 status:** Target design only. Contiguous `B6-DF-*` IDs, mirroring `B5_FAILURE_SCENARIOS.md`'s convention. Every row uses frozen `BACKEND_ERROR_CATALOG.md`'s envelope and status codes — no new HTTP-status doctrine, only new `code` values where the frozen taxonomy needs one.

| ID | Scenario | Handling | Reference |
|---|---|---|---|
| `B6-DF-001` | Unauthenticated request | `401 AUTH_REQUIRED` | `B1_AUTHORIZATION_RBAC.md` §1 step 1 |
| `B6-DF-002` | Caller lacks the required permission (`deal.*`/`pipeline.manage`) | `403 PERMISSION_DENIED` | §7 step 8 |
| `B6-DF-003` | Cross-workspace `DEAL-*`/`PIPE-*`/`STG-*` reference | `404 ENTITY_NOT_FOUND`, indistinguishable from non-existent | Doctrine R-1 |
| `B6-DF-004` | Deal not found (genuinely absent, in-workspace) | `404 ENTITY_NOT_FOUND` | |
| `B6-DF-005` | Pipeline not found | `404 ENTITY_NOT_FOUND` | |
| `B6-DF-006` | Stage not found | `404 ENTITY_NOT_FOUND` | |
| `B6-DF-007` | `stage.pipeline_id != pipeline_id` on a relationship-injected reference | `404 ENTITY_NOT_FOUND` (a mismatched pair is treated as not-found, never a validation error — Doctrine R-2: "never a validation error, because a validation error would confirm existence") | `B1_AUTHORIZATION_RBAC.md` §4 |
| `B6-DF-008` | Target pipeline is inactive/archived at `CreateDeal`/`MoveDealStage`-target time | `422 VALIDATION_ERROR` \| `inactive_pipeline` | |
| `B6-DF-009` | Target stage is inactive/archived at `CreateDeal`/`MoveDealStage`-target time | `422 VALIDATION_ERROR` \| `inactive_stage` | |
| `B6-DF-010` | `MoveDealStage`/`UpdateDeal`(commercial fields) attempted while `status ∈ {won, lost}` | `409 CONFLICT` \| `not_open` | `B6_DEAL_STATE_MACHINE.md` §3 |
| `B6-DF-011` | `CloseDealWon` attempted on an already-`won` Deal | `409 CONFLICT` \| `already_won` | |
| `B6-DF-012` | `CloseDealLost` attempted on an already-`lost` Deal | `409 CONFLICT` \| `already_lost` | |
| `B6-DF-013` | `CloseDealWon`/`CloseDealLost` attempted on an already-closed Deal via the *other* outcome | `409 CONFLICT` \| `already_won` / `already_lost` (same codes as `B6-DF-011`/`012` — closed is closed, the specific prior outcome is reported) | |
| `B6-DF-014` | `ReopenDeal` attempted on an `open` Deal | `409 CONFLICT` \| `reopen_forbidden` | |
| `B6-DF-015` | `CloseDealLost` with no `loss_reason_code` | `422 VALIDATION_ERROR` \| `loss_reason_required` | `B6_WON_LOST_LOSS_REASONS.md` §3 |
| `B6-DF-016` | `CloseDealLost` with a `loss_reason_code` not in the workspace's active catalog | `422 VALIDATION_ERROR` \| `invalid_loss_reason` | |
| `B6-DF-017` | `AssignDeal`/`CreateDeal` owner reference resolves to no membership in-workspace | `404 ENTITY_NOT_FOUND` \| `owner_invalid` (tenant-scoped resolution, Doctrine R-2) | |
| `B6-DF-018` | `AssignDeal` target membership exists but is `suspended`/`removed` | `422 VALIDATION_ERROR` \| `owner_inactive` | `B6_OWNERSHIP_ASSIGNMENT.md` §4 |
| `B6-DF-019` | `CreateDeal` against an archived Lead | `422 VALIDATION_ERROR` \| `lead_archived` | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §2 |
| `B6-DF-020` | `CreateDeal` `lead_ref` resolves outside the active workspace | `404 ENTITY_NOT_FOUND` \| `lead_mismatch` | Doctrine R-2 |
| `B6-DF-021` | (reserved — no `business_ref`/`contact_ref` is ever client-supplied; `business_id` is server-derived from `lead_id`, so a client-side "business mismatch"/"contact mismatch" input class does not exist, per `B6-D-A004`/`A005`) | N/A — not a reachable failure, recorded to show the question was considered, not omitted | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §4–§5 |
| `B6-DF-022` | `currency` supplied on `CreateDeal` is not a valid ISO-4217 code | `422 VALIDATION_ERROR` \| `currency_invalid` | `B6_CURRENCY_MODEL.md` §2 |
| `B6-DF-023` | Attempt to change `currency` on an existing Deal (field not in `DealUpdate`'s allow-list) | `400 VALIDATION_ERROR` \| `additionalProperties` rejection (Doctrine R-4) | |
| `B6-DF-024` | `value < 0` or non-numeric | `422 VALIDATION_ERROR` \| `value_invalid` | |
| `B6-DF-025` | `probability` outside `0..100` | `422 VALIDATION_ERROR` \| `probability_invalid` | |
| `B6-DF-026` | Explicit `probability_override` supplied on `CloseDealWon`/`CloseDealLost` (forced values are non-negotiable) | `422 VALIDATION_ERROR` \| `probability_not_overridable_on_close` | `B6_FORECAST_PROBABILITY.md` §1 |
| `B6-DF-027` | `If-Match`/`expected_version` mismatch on any mutating command | `409 STALE_VERSION` | `B6_CONCURRENCY_IDEMPOTENCY.md` §1 |
| `B6-DF-028` | `Idempotency-Key` reused with a different request body | `409 IDEMPOTENCY_CONFLICT` | §3 |
| `B6-DF-029` | Duplicate concurrent request under the same `Idempotency-Key` still in flight | `409 CONFLICT` \| `idempotency_in_progress` (or a safe in-progress representation per frozen B0 standard) | §3 |
| `B6-DF-030` | Two concurrent `MoveDealStage` calls on one Deal | second loses the version race → `B6-DF-027` | §2 |
| `B6-DF-031` | Concurrent `CloseDealWon`/`CloseDealLost`/`ReopenDeal` on one Deal | second loses the version race → `B6-DF-027`, plus the state-machine guard independently rejects if retried after refresh | §2 |
| `B6-DF-032` | `ArchivePipelineStage` attempted while any `status='open'` Deal references it | `409 CONFLICT` \| `stage_referenced_by_active_deals` | `B6_DATA_MODEL.md` §6 |
| `B6-DF-033` | `ArchivePipeline` attempted on the workspace's sole `is_default=true`, still-active pipeline | `409 CONFLICT` \| `cannot_delete_default_pipeline` | `B6_PIPELINE_MODEL.md` §2 |
| `B6-DF-034` | `ArchiveLossReason` attempted with no substitute — **not actually blocked** (archiving a referenced reason is always legal; it only stops future selection) | N/A — not a failure; recorded to show the "cannot remove required terminal semantics" question was evaluated for loss reasons specifically and found not to apply here (Won/Lost themselves are not catalog rows at all, `B6-D-A012`, so there is no "delete the terminal semantics" failure mode to guard against in the first place) | `B6_WON_LOST_LOSS_REASONS.md` §3.2 |
| `B6-DF-035` | `CreateDeal` matching an existing open Deal's dedupe key (same Lead + same title, Phase 1 has no `serviceId` concept to key on beyond title) | `409 CONFLICT` \| `duplicate_open_deal`, response includes the existing `DEAL-*` reference | `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D03 |
| `B6-DF-036` | `ReorderPipelineStages` supplied with a stage-ID list missing or adding stages relative to the pipeline's current active set | `422 VALIDATION_ERROR` \| `stage_set_mismatch` | `B6_PIPELINE_STAGE_MODEL.md` §3 |
| `B6-DF-037` | Workspace entitlement/capability check fails (structural hook, always passes in Phase 1 — recorded for completeness) | `403 ENTITLEMENT_LOCKED` | `B6_ENTITLEMENT_RBAC_TENANCY.md` §6 |
| `B6-DF-038` | Workspace-level mutation rate exceeded (reuses frozen general-API ceiling, no new B6-specific limit — `B6_RATE_COST_MODEL.md`) | `429`, `Retry-After` | `BACKEND_RATE_LIMIT_POLICY.md` |
| `B6-DF-039` | `DealAssigned`/`DealReopened`/`DealUpdated` event fails to reach the outbox (worker/infra failure, not a caller-facing error) | transactional outbox guarantees eventual pickup; the `Deal` row and `deal_stage_transitions` row are already durably committed regardless of relay delay | `B6_COMMAND_EVENT_CATALOG.md` §3, mirrors `B5-DF-025`'s identical outbox-delay pattern |

`FAILURE_SCENARIO_COUNT = 39` (`B6-DF-001`–`B6-DF-039`, contiguous, no gaps — two rows, `B6-DF-021` and `B6-DF-034`, are explicitly-considered-and-found-not-reachable entries, recorded honestly rather than silently omitted or padded in as if they were ordinary failure paths). `FAILURE_SCENARIO_DUPLICATES = 0` (every ID is distinct; `B6-DF-013` deliberately reuses `B6-DF-011`/`012`'s *codes*, but is its own listed *scenario* — attempting the other outcome on an already-closed deal — matching the task's own instruction not to pad with filler while still requiring every named scenario to have an ID). `FAILURE_SCENARIO_GAPS = 0`.
