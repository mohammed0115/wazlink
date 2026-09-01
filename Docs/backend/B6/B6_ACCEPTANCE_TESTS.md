# B6 — Acceptance Tests

> **B6 status:** Target design only. `**NC**` rows are negative controls: an implementation that fails the cited invariant must fail these, not merely happen to pass the positive rows. IDs are stable, category-scoped, never renumbered.

## 1. Domain — AT-DOM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DOM-1 | — | inspect `deals`/`pipelines`/`pipeline_stages` write access | only B6 application services write them | `B6_DOMAIN_OWNERSHIP.md` §2 |
| AT-DOM-2 **NC** | — | an implementation writing `leads`/`contacts` from a B6 command | rejected at design review — no B6 command targets a B2 table | `B6_DOMAIN_OWNERSHIP.md` §6 |
| AT-DOM-3 **NC** | — | an implementation where any B6 event handler or command writes a `revenue_events`/`attribution_touchpoints` row | rejected at design review — no B6 table has that write path | `B6_REVENUE_FIREWALL.md` §2 |
| AT-DOM-4 | — | inspect `deal_stage_transitions`/`deal_loss_reasons` ownership | B6-owned, additive, no independent public-ID prefix on transitions | `B6_DATA_MODEL.md` §4–§5 |

## 2. Tenancy — AT-TEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TEN-1 | Deal in workspace A | `GET /deals/{id}` as a workspace B member | `404 ENTITY_NOT_FOUND` | Doctrine R-1 |
| AT-TEN-2 | Deal in workspace A | `PATCH`/`stage`/`won`/`lost`/`reopen`/`assign` as workspace B member | `404`, identical shape to a genuinely absent Deal | Doctrine R-1 |
| AT-TEN-3 | `lead_ref` in workspace B | `CreateDeal` from workspace A with that `lead_ref` | `404 ENTITY_NOT_FOUND` \| `lead_mismatch`, never a validation error | Doctrine R-2, `B6-DF-020` |
| AT-TEN-4 | `pipeline_ref`/`stage_ref` in workspace B | `CreateDeal`/`MoveDealStage` from workspace A | `404`, same non-disclosure shape | Doctrine R-2 |
| AT-TEN-5 **NC** | — | an implementation with any cache/index keyed on `DEAL-*` alone, no workspace component | fails AT-TEN-1/2 — this is the brief's explicit cross-workspace-IDOR negative control | Doctrine R-1 |
| AT-TEN-6 | member reference in workspace B | `AssignDeal` targeting that member from workspace A | `404 ENTITY_NOT_FOUND` \| `owner_invalid` | `B6-DF-017` |

## 3. RBAC — AT-RBAC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RBAC-1 | `viewer` role | `GET /deals` | `200`, read-only, conditional per frozen matrix | `B1_AUTHORIZATION_RBAC.md` §3, reused |
| AT-RBAC-2 | `member` role, not the assigned owner, no team overlap | `PATCH /deals/{id}` | `403 PERMISSION_DENIED` | assigned/team scope condition |
| AT-RBAC-3 | `sales` role, own-assigned Deal | `CloseDealWon` | `403` — `deal.close` is `conditional` only up to `manager`, `sales` row is `deny` per the frozen matrix | `B1_AUTHORIZATION_RBAC.md` §3, `deal.close` row |
| AT-RBAC-4 | `sales` role | `AssignDeal` reassigning their **own**-owned Deal to someone else | `200` — `deal.assign` conditional, own-assigned scope | `B6_ENTITLEMENT_RBAC_TENANCY.md` §3 |
| AT-RBAC-5 | `sales` role | `AssignDeal` on a Deal owned by a different `sales` rep, no team overlap | `403` | same |
| AT-RBAC-6 | `manager` role | `pipeline.manage`-gated `CreatePipelineStage` | `200` — `pipeline.manage` is `manager: conditional` on the non-financial-configuration-only condition; a stage's `default_probability` is configuration, not billing, so the condition is satisfied | `B6_ENTITLEMENT_RBAC_TENANCY.md` §3 |
| AT-RBAC-7 **NC** | — | an implementation letting `deal.update` also grant `deal.close`/`deal.reopen` authority | fails — three independently checked permission codes, no implicit escalation | `B6_ENTITLEMENT_RBAC_TENANCY.md` §2 |
| AT-RBAC-8 **NC** | — | an implementation inventing a `deal.move` permission distinct from `deal.update` for stage movement | fails design review — `MoveDealStage` is gated by `deal.update`, no second code for the same authority | §2 |

## 4. Pipeline configuration — AT-PIPE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PIPE-1 | new workspace | inspect | exactly one `is_default=true` Pipeline auto-provisioned | `B6_PIPELINE_MODEL.md` §2 |
| AT-PIPE-2 | `pipeline.manage` | `CreatePipeline` | `201`, `is_default=false` | §1 |
| AT-PIPE-3 | second active pipeline exists | `UpdatePipeline{is_default:true}` on it | atomically promotes it and demotes the prior default in one transaction | §2 |
| AT-PIPE-4 | sole active (default) pipeline | `ArchivePipeline` | `409` \| `cannot_delete_default_pipeline` | `B6-DF-033` |
| AT-PIPE-5 | two active pipelines, one default | `ArchivePipeline` on the **non**-default one | `200` | §2 |
| AT-PIPE-6 **NC** | — | an implementation permitting two simultaneously `is_default=true` pipelines in one workspace | fails the partial-unique-index invariant | `B6_DATA_MODEL.md` §1 |

## 5. Deal creation — AT-DEAL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DEAL-1 | valid Lead, no pipeline/stage specified | `CreateDeal` | `201`, workspace default pipeline + its first stage used | `B6_DEAL_STATE_MACHINE.md` §2 |
| AT-DEAL-2 | valid Lead, explicit pipeline/stage | `CreateDeal` | `201`, specified pipeline/stage used | same |
| AT-DEAL-3 | no `probability` supplied | `CreateDeal` | `probability := stage.default_probability` | `B6_FORECAST_PROBABILITY.md` §1 |
| AT-DEAL-4 | `probability` explicitly supplied | `CreateDeal` | stored override, survives the next stage's default | same |
| AT-DEAL-5 | second open Deal, different title, same Lead | `CreateDeal` | `201` — multiple open Deals per Lead permitted | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §1 |
| AT-DEAL-6 | an open Deal already exists with the identical title on this Lead | `CreateDeal` with the same title | `409` \| `duplicate_open_deal`, references the existing `DEAL-*` | `B6-DF-035` |
| AT-DEAL-7 **NC** | — | an implementation creating a Deal with no `lead_id` | rejected — `lead_id NOT NULL`, no such request shape exists | `B6-D-A003` |
| AT-DEAL-8 **NC** | — | an implementation copying Contact fields onto `Deal` as authoritative | fails design review — no such column exists | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5 |

## 6. Lead relationship — AT-LEAD

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LEAD-1 | archived Lead | `CreateDeal` against it | `422` \| `lead_archived` | `B6-DF-019` |
| AT-LEAD-2 | open Deal, then Lead archived | inspect Deal | Deal remains fully open/mutable, unaffected | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §2 |
| AT-LEAD-3 | Deal exists | `CreateDeal` → inspect `leads.status` | unchanged — B6 never writes it | §3 |
| AT-LEAD-4 | Lead has 3 Deals across all statuses | `GET /leads/{id}/360` | `deals[]` shows all 3 | `B6_READ_MODELS_QUERY.md` §4 |
| AT-LEAD-5 **NC** | — | an implementation where `ArchiveLead` is blocked by an open Deal | fails — `B2_LEAD_AGGREGATE.md` §7 already forbids this gate, from B2's side | §2 |

## 7. Business/Contact relationship — AT-BIZ

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-BIZ-1 | Lead with `business_id=B1` | `CreateDeal` | `Deal.business_id = B1`, snapshotted | `B6_DEAL_AGGREGATE.md` §3 |
| AT-BIZ-2 | Deal created, then Lead's Business re-pointed by `BusinessMerged` | inspect `Deal.business_id` | unchanged (historical snapshot, not live) | same |
| AT-BIZ-3 | filter Deals by current Business | query | resolves via `Deal.lead_id → Lead.business_id` (live), not the stale snapshot | same |
| AT-BIZ-4 **NC** | — | an implementation with a `DealContactLink` M:N table | fails design review — no such table exists; Contacts reached via `Deal.lead_id → Lead → lead_contacts` only | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5 |

## 8. Stage movement — AT-MOVE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-MOVE-1 | open Deal, stage 2 of 6 | `MoveDealStage` → stage 5 | `200` — forward skip permitted | `B6_DEAL_STATE_MACHINE.md` §4 |
| AT-MOVE-2 | open Deal, stage 5 | `MoveDealStage` → stage 1 | `200` — backward move permitted | same |
| AT-MOVE-3 | no override set | `MoveDealStage` | `probability` re-seeded from the target stage's default | `B6_FORECAST_PROBABILITY.md` §1 |
| AT-MOVE-4 | override previously set | `MoveDealStage` | override survives unless this same call overrides it again | same |
| AT-MOVE-5 | won Deal | `MoveDealStage` | `409` \| `not_open` | `B6-DF-010` |
| AT-MOVE-6 | target stage archived | `MoveDealStage` | `422` \| `inactive_stage` | `B6-DF-009` |
| AT-MOVE-7 | target stage belongs to a different pipeline | `MoveDealStage` | `404` (Doctrine R-2, never a validation error) | `B6-DF-007` |
| AT-MOVE-8 **NC** | — | an implementation requiring sequential/adjacent-only stage progression at the domain layer | fails — unrestricted movement is the target contract (`B6-D-A015`), the button-adjacent-only UX is a presentation choice, not a domain guard | `B6_DEAL_STATE_MACHINE.md` §4 |

## 9. Won — AT-WON

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-WON-1 | open Deal | `CloseDealWon{confirm:true}` | `200`, `status=won`, `probability=100`, `won_at`/`closed_at` set | `B6_WON_LOST_LOSS_REASONS.md` §2 |
| AT-WON-2 | open Deal at stage 3 | `CloseDealWon` | `stage_id` frozen at stage 3 permanently | `B6_DEAL_AGGREGATE.md` §2 |
| AT-WON-3 | already-won Deal | `CloseDealWon` again | `409` \| `already_won` | `B6-DF-011` |
| AT-WON-4 | — | `CloseDealWon` with no `confirm:true` | `422 VALIDATION_ERROR` | frozen B0: "explicit confirmation" |
| AT-WON-5 **NC** | — | an implementation accepting a manual `probability` override alongside `CloseDealWon` | fails — probability is forced to 100, unconditionally | `B6-DF-026` |

## 10. Lost — AT-LOST

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LOST-1 | open Deal, valid `loss_reason_code` | `CloseDealLost` | `200`, `status=lost`, `probability=0` | §3 |
| AT-LOST-2 | open Deal, no `loss_reason_code` | `CloseDealLost` | `422` \| `loss_reason_required` | `B6-DF-015` |
| AT-LOST-3 | invalid/archived-inactive `loss_reason_code` | `CloseDealLost` | `422` \| `invalid_loss_reason` | `B6-DF-016` |
| AT-LOST-4 | already-lost Deal | `CloseDealLost` again | `409` \| `already_lost` | `B6-DF-012` |
| AT-LOST-5 **NC** | — | an implementation transitioning `won → lost` directly | fails — must go through `ReopenDeal` first, two audited steps | `B6_DEAL_STATE_MACHINE.md` §3 |

## 11. Reopen — AT-REOPEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REOPEN-1 | won Deal | `ReopenDeal{reason_note}` | `200`, `status=open`, `won_at`/`closed_at` cleared, `probability` re-seeded | `B6_WON_LOST_LOSS_REASONS.md` §4 |
| AT-REOPEN-2 | lost Deal | `ReopenDeal{reason_note}` | `200`, `status=open`, `lost_at`/`loss_reason_*` cleared | same |
| AT-REOPEN-3 | open Deal | `ReopenDeal` | `409` \| `reopen_forbidden` | `B6-DF-014` |
| AT-REOPEN-4 | — | `ReopenDeal` with no `reason_note` | `422 VALIDATION_ERROR` | `B6_API_DTO_CONTRACTS.md` §2 |
| AT-REOPEN-5 | Deal won, then reopened, then won again | `GET /deals/{id}/transitions` | shows **both** `won_at` events distinctly, never collapsed | `B6_STAGE_TRANSITION_HISTORY.md` §1 |
| AT-REOPEN-6 **NC** | RevenueEvent exists (hypothetical, B9-created) against this Deal | `ReopenDeal` | RevenueEvent untouched — this is the brief's explicit "reopening a Won Deal does not reverse/create a RevenueEvent" negative control | `B6_REVENUE_FIREWALL.md` §4 item 3 |

## 12. Loss reasons — AT-LOSSR

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LOSSR-1 | `pipeline.manage` | `CreateLossReason{code:"budget"}` | `201` | `B6_WON_LOST_LOSS_REASONS.md` §3.1 |
| AT-LOSSR-2 | new workspace | inspect catalog | 6 system-default rows pre-seeded, including `other` | same |
| AT-LOSSR-3 | reason referenced by a historical `lost` Deal | `ArchiveLossReason` | `200` — always permitted | §3.2 |
| AT-LOSSR-4 | archived reason | `CloseDealLost` selecting it | `422` \| `invalid_loss_reason` — blocked for *new* selection only | same |
| AT-LOSSR-5 | Deal historically closed with an archived reason | `GET /deals/{id}` | still shows the (archived) reason's current label | same |
| AT-LOSSR-6 **NC** | — | an implementation hard-deleting a referenced `deal_loss_reasons` row | fails — no `DELETE` path exists, archive-only | `B6_DATA_MODEL.md` §5 |

## 13. Owner/assignment — AT-OWNER

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OWNER-1 | Lead owned by M1, no owner specified | `CreateDeal` | `Deal.owner_membership_id = M1` | `B6_OWNERSHIP_ASSIGNMENT.md` §2 |
| AT-OWNER-2 | Deal owned by M1, Lead reassigned to M2 | inspect Deal | `Deal.owner_membership_id` still `M1` — no cascade | same |
| AT-OWNER-3 | won Deal | `AssignDeal` to a new owner | `200` — reassignment permitted on closed Deals | `B6_OWNERSHIP_ASSIGNMENT.md` §3 |
| AT-OWNER-4 | target membership `suspended` | `AssignDeal` | `422` \| `owner_inactive` | `B6-DF-018` |
| AT-OWNER-5 | owner's membership later suspended | other actor with `deal.assign` reassigns it | `200` — the Deal itself is never blocked from mutation by others | `B6_OWNERSHIP_ASSIGNMENT.md` §4 |
| AT-OWNER-6 **NC** | — | an implementation permitting `owner_membership_id = NULL` | fails — never nullable, `B6_OWNERSHIP_ASSIGNMENT.md` §5 | |

## 14. Currency — AT-CCY

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CCY-1 | no `currency` supplied | `CreateDeal` | defaults to workspace default (`SAR`, Phase 1) | `B6_CURRENCY_MODEL.md` §1 |
| AT-CCY-2 | Deal created with `currency=SAR` | `UpdateDeal` attempting to change it | rejected — not in `DealUpdate`'s allow-list | `B6-DF-023` |
| AT-CCY-3 | invalid ISO code | `CreateDeal{currency:"XXX"}` | `422` \| `currency_invalid` | `B6-DF-022` |
| AT-CCY-4 | Deals in two different currencies (hypothetical) | Weighted Pipeline query | returns per-currency buckets, never a summed cross-currency total | `B6_CURRENCY_MODEL.md` §3 |

## 15. Probability/Forecast — AT-PROB

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PROB-1 | `probability=150` supplied | `CreateDeal`/`UpdateDeal` | `422` \| `probability_invalid` | `B6-DF-025` |
| AT-PROB-2 | `value=1000, probability=40` | read `weighted_value` | `400` | `B6_FORECAST_PROBABILITY.md` §2 |
| AT-PROB-3 | stage `default_probability` later edited via `UpdatePipelineStage` | inspect Deals already sitting in that stage | their `probability` is **unchanged** — not retroactively re-derived | `B6_PIPELINE_STAGE_MODEL.md` §4 |
| AT-PROB-4 **NC** | — | an implementation persisting `weighted_value` as a stored column | fails — computed at read time only, no such column exists | `B6-D-A010` |

## 16. Concurrency — AT-CONC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONC-1 | two `MoveDealStage` calls, same `expected_version` | both submitted near-simultaneously | one `200`, one `409 STALE_VERSION` | `B6_CONCURRENCY_IDEMPOTENCY.md` §2 |
| AT-CONC-2 | `MoveDealStage` racing `CloseDealWon` | both submitted with the same base `version` | one wins; the loser's stale retry, if it's the move, additionally fails `not_open` once refreshed | same |
| AT-CONC-3 | `AssignDeal` racing `AssignDeal` (different targets) | both submitted | one wins, one `409`, retry shows the winning owner | same |
| AT-CONC-4 | `UpdateDeal(value)` racing `CloseDealWon` | both submitted | one wins; a stale value-update retry fails `not_open` post-refresh | same |
| AT-CONC-5 | `ArchivePipelineStage` racing `MoveDealStage` onto it | both submitted | whichever commits first determines the other's rejection (`inactive_stage` or `stage_referenced_by_active_deals`) — never both succeed | same |
| AT-CONC-6 **NC** | — | an implementation applying a Deal mutation without a `SELECT ... FOR UPDATE` row lock | fails — every mutating command locks the row inside its transaction | §1 |

## 17. Idempotency — AT-IDEM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IDEM-1 | same key, same body, `MoveDealStage` replayed | replay | stored terminal response returned, no second transition/event | `B6_CONCURRENCY_IDEMPOTENCY.md` §3 |
| AT-IDEM-2 | same key, different body | retry | `409 IDEMPOTENCY_CONFLICT` | `B6-DF-028` |
| AT-IDEM-3 | no `Idempotency-Key` on `CreateDeal` | request | `400`/rejected — required on every mutating command | §3 |
| AT-IDEM-4 **NC** | — | an implementation creating two `deal_stage_transitions` rows for one retried logical command | fails — the negative control this brief explicitly names | `B6_DEAL_STATE_MACHINE.md` §5 |

## 18. API — AT-API

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-API-1 | `CreateDeal` payload includes `status:"won"` | request | `400 VALIDATION_ERROR` \| `additionalProperties` — mass-assignment rejected | Doctrine R-4 |
| AT-API-2 | `CreateDeal` payload includes `version:5` | request | `400`, rejected | same |
| AT-API-3 | `GET /deals` with `filters`/`sort` | request | allow-listed expressions only, matching `BACKEND_API_CATALOG.md`'s already-frozen inclusion of this endpoint | `B6_API_DTO_CONTRACTS.md` §4 |
| AT-API-4 | `GET /pipelines` | request | pagination-only, no generic filter/sort | same |
| AT-API-5 **NC** | — | an implementation echoing internal `command_id`/`deal_version_before/after` on the public `DealTransition` DTO | fails — those fields are audit-internal only | `B6_API_DTO_CONTRACTS.md` §2 |

## 19. Events — AT-EVENT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EVENT-1 | `CreateDeal` | inspect outbox | `DealCreated` with envelope fields, `source_event_id` set | `B6_COMMAND_EVENT_CATALOG.md` §5–§6 |
| AT-EVENT-2 | `MoveDealStage` | inspect outbox | `DealStageChanged` only — no `DealUpdated` also fires for a pure stage move | §3 |
| AT-EVENT-3 | `UpdateDeal` changing `value` | inspect outbox | `DealUpdated{changed_fields:["value"]}` | §3 |
| AT-EVENT-4 **NC** | — | an implementation emitting `RevenueRecognized` or `RevenueReversed` from any B6 command | fails — not in B6's event list, structurally unproducible | `B6_REVENUE_FIREWALL.md` §2 |

## 20. CRM timeline — AT-TL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TL-1 | `DealCreated`, `DealStageChanged`, `DealWon` on one Deal | `GET /leads/{id}/timeline` | 3 distinct entries, `entry_id = pipeline:<event_id>` each, sharing one `source_resource_ref` | `B6_CRM_TIMELINE_PROJECTION.md` §1–§2 |
| AT-TL-2 | caller lacks `deal.view` | timeline read | Pipeline-sourced entries excluded entirely — no placeholder, no error | §2, frozen §7.2 step 2 |
| AT-TL-3 | `DealWon` occurs | inspect `Lead.last_activity_at` | advances (already-frozen qualifying event) | `B2_LEAD_AGGREGATE.md` §4, unchanged |
| AT-TL-4 | `DealReopened` occurs, amendment approved | inspect `Lead.last_activity_at` | advances (additive amendment) | `B6_CONTROLLED_AMENDMENTS.md` item 1 |
| AT-TL-5 | `DealAssigned`/`DealUpdated` occurs | inspect `Lead.last_activity_at` | **does not** advance — deliberate exclusion | `B6_CRM_TIMELINE_PROJECTION.md` §3 |
| AT-TL-6 **NC** | — | an implementation writing a `crm_activities` row directly from a B6 command | fails — B6 has no such write path | `B6_DOMAIN_OWNERSHIP.md` §6 |
| AT-TL-7 **NC** | — | an implementation using `DEAL-*` as an `entry_id` | violates B2's frozen rule that an aggregate's public ID is never an `entry_id` | `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1 |

## 21. B4 boundary — AT-B4

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B4-1 **NC** | — | an implementation where a B4 run ID is accepted as a `CreateDeal`/`CloseDealWon` authorization parameter | fails — this is the brief's explicit "B4 recommendation cannot mutate Deal directly" negative control | `B6_B4_INTELLIGENCE_BOUNDARY.md` §3 |
| AT-B4-2 | B4 suggests a probability | Copilot-style staged create-deal draft | inserted into an unsubmitted form only; `CreateDeal` still requires a human submit | §1 |

## 22. B5 boundary — AT-B5

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B5-1 **NC** | — | an implementation where a B6 command/event handler writes `messages`/`conversations` | fails — this is the brief's explicit "B5 cannot mutate Deal" boundary read in reverse; B6 symmetrically never mutates B5 tables | `B6_B5_MESSAGING_BOUNDARY.md` §1, §4 |
| AT-B5-2 | Deal-context "send message" affordance used | inspect the executed command | `SendMessage`/`SendTemplateMessage`, B5's full admission sequence, no shortcut | §3 |

## 23. B7 boundary — AT-B7

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B7-1 **NC** | — | an implementation exposing a second "automation deal-mutation" endpoint that skips any admission-sequence step | fails — this is the brief's explicit "B7 cannot bypass governed commands" negative control | `B6_B7_AUTOMATION_BOUNDARY.md` §6 |
| AT-B7-2 | future B7 caller, `reason_source='automation'` | `MoveDealStage` | identical admission sequence, identical guards, as any human actor | §1 |

## 24. Revenue firewall — AT-REV

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REV-1 **NC** | — | `CloseDealWon` executed | zero rows in `revenue_events`, zero `RevenueRecognized` events — this is the brief's explicit "Won Deal creates no RevenueEvent" negative control | `B6_REVENUE_FIREWALL.md` §4 item 1 |
| AT-REV-2 **NC** | — | `UpdateDeal{value:...}` | no change to any `RevenueEvent.gross`/`net` — this is the brief's explicit "changing Deal.amount does not change Recognized Revenue" negative control | item 2 |
| AT-REV-3 **NC** | — | `ReopenDeal` on a won Deal | no existing RevenueEvent reversed/created — this is the brief's explicit "reopening a Won Deal does not reverse/create RevenueEvent" negative control | item 3 |
| AT-REV-4 **NC** | — | Open/Weighted Pipeline query | never unioned with or relabeled as Recognized/Attributed Revenue — this is the brief's explicit "pipeline totals do not become financial revenue" negative control | item 4 |
| AT-REV-5 **NC** | — | `weighted_value` computed and displayed | never written to `revenue_events`, never an input to `RecordRevenueEvent` — this is the brief's explicit "forecast does not become recognized revenue" negative control | item 5 |

## 25. Frontend parity — AT-FP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-FP-1 | matches FB-D06 | `weighted_value` formula | `value × probability / 100`, computed at read time | `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D06 |
| AT-FP-2 | matches FB-D07 | Deal owner defaults from Lead owner, independently editable | confirmed | FB-D07 |
| AT-FP-3 | matches FB-D18 | `CloseDealWon` | no revenue/attribution row created | FB-D18 |
| AT-FP-4 **NC** | matches FB-D11's resolved gap | an implementation carrying forward `stage.kind` as a second source of Won/Lost truth alongside `Deal.status` | fails — `B6-D-A012` resolves this to `status` alone | FB-D11 |

## 26. Cross-workspace isolation — AT-SEC (beyond §2's tenancy basics)

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SEC-1 | — | inspect every `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`/`deal_loss_reasons` query path | none constructed without a workspace predicate | `B6_SECURITY_THREAT_MODEL.md` |
| AT-SEC-2 **NC** | — | an implementation returning a distinguishable error for "exists in another workspace" vs. "does not exist" | fails AT-TEN-1/AT-TEN-5 | Doctrine R-1 |

## 27. Counts

```
ACCEPTANCE_TEST_COUNT = 128
ACCEPTANCE_CATEGORY_COUNT = 26
DUPLICATE_ACCEPTANCE_TESTS = 0
NEGATIVE_CONTROL_COUNT = 33
```

Recomputed mechanically (row-count per `##` category section, minus this "27. Counts" section itself; `**NC**` markers within table rows, excluding this summary's own prose mentions) — the same discipline `B5_ACCEPTANCE_TESTS.md` §"Counts" documents. Every Class A decision in `B6_DECISION_REGISTER.md` §1, every failure scenario in `B6_FAILURE_CATALOG.md`, and every frontend behavior classified `A` in `B6_FRONTEND_BEHAVIOR_INVENTORY.md` maps to at least one row above.
