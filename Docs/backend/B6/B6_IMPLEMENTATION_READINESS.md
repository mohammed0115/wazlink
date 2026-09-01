# B6 — Implementation Readiness (Handoff)

> **B6 status:** Target design only. Sufficient for a later coding agent to implement B6 without inventing core architecture. **Does not implement anything.**

## 1. Entities

`Pipeline`, `PipelineStage`, `Deal`, `DealStageTransition`, loss-reason catalog row — full column lists, types, constraints, indexes: `B6_DATA_MODEL.md`. Field-by-field authority/mutability/lifecycle for `Deal`: `B6_DEAL_AGGREGATE.md` §2.

## 2. Constraints and indexes

Every constraint (`stage.pipeline_id == pipeline.id`, `status='won' ⇒ probability=100 AND won_at IS NOT NULL`, exactly-one-default-pipeline partial unique, etc.) and every index is enumerated in `B6_DATA_MODEL.md` §1–§6. No SQL DDL is authorized here — logical description only, matching B2–B5's identical discipline.

## 3. State transitions

Full table: `B6_DEAL_STATE_MACHINE.md` §2 (allowed), §3 (forbidden, with exact error codes). Guards, permissions, side effects, and events are columns of that same table — nothing is left to be inferred by an implementer.

## 4. Services / application layer

One application service per command in `B6_COMMAND_EVENT_CATALOG.md` §2, each executing the 16-step admission sequence in `B6_ENTITLEMENT_RBAC_TENANCY.md` §7 in order, unmodified. No service imports another bounded context's ORM manager (`B6_DOMAIN_OWNERSHIP.md` §7).

## 5. Commands, events, DTOs

Full catalogs: `B6_COMMAND_EVENT_CATALOG.md`, `B6_API_DTO_CONTRACTS.md`.

## 6. Permissions

Full catalog and role matrix: `B6_ENTITLEMENT_RBAC_TENANCY.md` §2–§3. Reused rows are frozen B1's own, unmodified — an implementer touches zero characters of `B1_AUTHORIZATION_RBAC.md`'s existing text; new rows are additive insertions.

## 7. Queries / read models

`B6_READ_MODELS_QUERY.md` — Deal list, Pipeline board, Dashboard/Analytics metrics, Lead 360 `deals[]`, Conversation Deal context, transition history. Every query's grouping/filtering/currency-bucketing rule is explicit.

## 8. Transaction boundaries

Every mutating command's transaction boundary is stated identically: lock target row(s) (`SELECT ... FOR UPDATE`) → check `expected_version` → apply the domain effect → write `deal_stage_transitions` (where applicable) → write the outbox event → write the `IdempotencyRecord` — all in **one** database transaction, per `B6_CONCURRENCY_IDEMPOTENCY.md` §1, §3–§4. No command's effect is ever split across two transactions.

## 9. Idempotency and concurrency

Full mechanism and every named race scenario resolved: `B6_CONCURRENCY_IDEMPOTENCY.md`.

## 10. Outbox requirements

Every event in `B6_COMMAND_EVENT_CATALOG.md` §3 is delivered through the frozen B0 transactional outbox, carrying the frozen event envelope unchanged (§5). No B6-specific outbox variant, no alternative canonical write store.

## 11. Timeline integration

Exact contract: `B6_CRM_TIMELINE_PROJECTION.md`. An implementer needs to expose `source_domain="pipeline"`, `source_event_type`, `source_resource_ref`, `source_event_id`, `occurred_at`, actor, and safe-summary template arguments on each event's read record — nothing else, nothing B2-side to build (B2 is closed and already reads this shape).

## 12. Failure mapping

Every `B6-DF-*` scenario maps to an exact HTTP status + error `code`: `B6_FAILURE_CATALOG.md`.

## 13. Acceptance evidence

128 tests across 26 categories, including 33 negative controls: `B6_ACCEPTANCE_TESTS.md`. Every Class A decision, every failure scenario, and every frontend behavior classified `A` in `B6_FRONTEND_BEHAVIOR_INVENTORY.md` maps to at least one test row.

## 14. What must happen before any of this is coded

1. `BACKEND_DOCUMENTATION_INDEX.md`'s B6 section (§`B6_EXECUTIVE_SUMMARY.md` §5) reflects `DESIGN IN PROGRESS / NOT CLOSED` — unchanged until an independent CTO audit closes it.
2. The 2-item controlled-amendment bundle (`B6_CONTROLLED_AMENDMENTS.md`) is approved as a whole.
3. `CLASS_A_UNRESOLVED = 0` is independently re-verified (`B6_DECISION_REGISTER.md` §2 already states "None," pending countersign).
4. No B0–B5 frozen file is edited to match any B6 target ahead of that approval.

## 15. Explicit non-scope reminder

This document, and every document in `Docs/backend/B6/`, authorizes **no** Django code, **no** DRF serializer/view, **no** migration, **no** PostgreSQL schema, **no** B7/B8/B9 implementation. It is a target design pack awaiting independent verification.
