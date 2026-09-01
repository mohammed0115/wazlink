# B6 — Entitlement, RBAC, and Tenancy

> **B6 status:** Target design only. Reuses frozen `B1_AUTHORIZATION_RBAC.md`'s decision chain and existing Deal permissions verbatim. Checked against frozen B1 before proposing anything as new — the exact discipline `B5-FIX.1` had to retroactively apply.

## 1. Frozen anchor, quoted

`B1_AUTHORIZATION_RBAC.md` §2 permission catalog already lists: *"Deals | `deal.view`, `deal.create`, `deal.update`, `deal.close`"*. §3's role matrix already states:

| Permission | owner | admin | manager | sales | member | viewer | Condition |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `deal.view` | A | A | A | A | A | C | — |
| `deal.create` / `deal.update` | A | A | A | A | C | · | assigned/team scope |
| `deal.close` | A | A | A | C | · | · | explicit confirmation; audit |

B6 does not touch a single cell of this table. `NO_CHANGE_REQUIRED`.

Doctrine R-2 (`B1_AUTHORIZATION_RBAC.md` §4): *"Deal → Lead, Pipeline, Stage | all three in-scope; `stage.pipeline_id == pipeline.id`"* — already frozen, unchanged, enforced by every Deal-mutating command's relationship-injection step.

## 2. Permission codes

| Permission | Status | Covers |
|---|---|---|
| `deal.view` | **REUSED — frozen B1, unchanged** | `GET /deals`, `GET /deals/{id}`, `GET /deals/{id}/transitions`, contributes to `pipeline` source-domain eligibility in B2's timeline (`B2_TIMELINE_IDENTITY_MODEL.md` §7.2 step 2, already names `deal.view` verbatim) |
| `deal.create` | **REUSED — frozen B1, unchanged** | `CreateDeal` |
| `deal.update` | **REUSED — frozen B1, unchanged** | `UpdateDeal`, `MoveDealStage` (stage movement is "modify Deal" — B6 does not mint a separate `deal.move` for authority `deal.update` already grants) |
| `deal.close` | **REUSED — frozen B1, unchanged** | `CloseDealWon`, `CloseDealLost` (the frozen "Close Deal" row does not distinguish Won from Lost — both are closing actions under one permission) |
| `deal.assign` | **ADDITIVE — new** | `AssignDeal` — mirrors `lead.assign`'s existing precedent exactly (own-assignments-only object condition for `sales`) |
| `deal.reopen` | **ADDITIVE — new** | `ReopenDeal` — a genuinely new sensitive action (undoing a closed, audited commercial outcome) with no frozen precedent to reuse |
| `pipeline.manage` | **ADDITIVE — new** | `CreatePipeline`, `UpdatePipeline`, `ArchivePipeline`, `CreatePipelineStage`, `UpdatePipelineStage`, `ReorderPipelineStages`, `ArchivePipelineStage`, `CreateLossReason`, `UpdateLossReason`, `ArchiveLossReason` — admin-tier configuration, mirrors `messaging.provider.manage`'s "credential/configuration sits above ordinary use" precedent from B5 |

**`B6-D-A020` (Class A, resolved): three new permissions, four reused verbatim.** No competing name is minted for authority an existing permission already grants (no `deal.move`, no `deal.finish`, no `pipeline.deal.manage`).

## 3. Role matrix — new permissions only (reused rows are frozen B1's own, unmodified, quoted in §1)

| Permission | owner | admin | manager | sales | member | viewer | Condition |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `deal.assign` | A | A | A | C | · | · | sales: own-assigned Deals only, mirrors `lead.assign`'s condition verbatim |
| `deal.reopen` | A | A | A | C | · | · | sales: own-assigned Deals only; explicit confirmation + reason required, same audit tier as `deal.close` |
| `pipeline.manage` | A | A | C | · | · | · | manager: non-financial configuration only (mirrors `workspace.manage`'s manager-conditional shape); loss-reason catalog management included |

## 4. Object-level condition — "assigned/team scope"

Frozen B0's action-matrix condition for "Create/modify Deal" is *"assigned/team scope"*. B6 operationalizes this identically to how `lead.update`'s "object workspace scope" and `task.manage`'s "assigned/team scope" are already operationalized elsewhere in the corpus: a `sales` actor may mutate a Deal only if `Deal.owner_membership_id` is their own membership, **or** they share a team with the current owner (team membership is a B1 concept this document does not redefine — B6 calls the identical object-condition evaluator B1's existing `task.manage`/`appointment.manage` rows already use, rather than inventing a second team-scope mechanism).

## 5. Tenancy — Doctrine R-1/R-2/R-3/R-4, unchanged

- **R-1 (workspace-scoped queryset):** every `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`/`deal_loss_reasons` read/write is resolved through `.for_workspace(active_workspace)`, never by public ID alone. A cross-workspace `DEAL-*`/`PIPE-*`/`STG-*` reference is `404 ENTITY_NOT_FOUND`, indistinguishable from non-existent.
- **R-2 (relationship injection):** already frozen for `Deal → Lead, Pipeline, Stage` (§1); B6 adds no new relationship type beyond it (`business_id` is a snapshot, not an injected relationship — `B6_DEAL_AGGREGATE.md` §3).
- **R-3 (path/active agreement):** N/A — B6 exposes no `{workspace_id}` path-segment routes; every route is workspace-implicit via the active session, matching every other domain's route shape in `BACKEND_API_CATALOG.md`.
- **R-4 (mass assignment):** `CreateDeal`/`UpdateDeal` request DTOs are explicit allow-lists; `workspace_id`, `public_id`, `id`, `status`, `version`, and every server-generated timestamp are never client-writable (`B6_API_DTO_CONTRACTS.md`).

## 6. Entitlements

**`B6-D-A030` (Class A, resolved with a deferred hook).** Deal/Pipeline is treated as **core CRM capability in Phase 1**, not separately plan-gated or quota-metered — consistent with Lead/Task/Appointment (which are also core CRM, unmetered) and unlike Discovery/AI/Messaging (which meter against genuine provider cost B6 has none of, `B6_RATE_COST_MODEL.md`). An architecture hook is reserved — a capability code `pipeline.core`, permanently entitled on every plan in Phase 1 — so a future commercial-packaging decision (e.g., a Deal-count quota on a lower tier) needs no re-architecture, without B6 inventing quota machinery no product decision has requested. This follows the task's own instruction: "If exact commercial packaging is not frozen, define architecture hooks and defer pricing/product decisions." Frontend entitlement state is never authority — B6's own admission sequence (§7) is the sole enforcement point, matching B1's "no caching, no client-trusted flag" doctrine.

## 7. Full admission sequence for a Deal-mutating command

Identical to frozen `B1_AUTHORIZATION_RBAC.md` §1's 16-step chain, unmodified, with Pipeline's own values at the domain-specific steps:

1–7. Authenticated → session valid → user usable → email verified → workspace resolved → membership active → workspace state (unchanged, B1's own).
8. **RBAC permission** — the command's permission code from §2/§3.
9. **Tenant-scoped object resolution** — `Deal`/`Pipeline`/`PipelineStage` resolved workspace-scoped (§5 R-1); a miss is `404`.
10. **Object-level condition** — "assigned/team scope" for `conditional` grants (§4).
11. **Entitlement** — `pipeline.core` capability check (§6; always satisfied in Phase 1, structurally present for future gating).
12. **Quota** — none metered in Phase 1 (§6); step is a structural no-op, not skipped.
13. **Concurrency** — `If-Match`/`version` (`B6_CONCURRENCY_IDEMPOTENCY.md`).
14. **Idempotency** — `Idempotency-Key` reuse check.
15. **Domain invariant** — the Deal state-machine guard for the specific command (`B6_DEAL_STATE_MACHINE.md` §2–3).
16. **Allow** — execute, write `deal_stage_transitions` (where applicable), audit, outbox.

No step is reordered, skipped, or given B6-specific exception semantics.
