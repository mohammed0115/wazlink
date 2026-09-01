# B6 — The Deal Aggregate

> **B6 status:** Target design only. `Deal` is the frozen B0 aggregate root of the Pipeline domain (`BACKEND_DOMAIN_OWNERSHIP.md`).

## 1. Naming precision: `value`, not `amount`

The task brief that produced this document colloquially calls the field "Deal.amount" throughout. **Frozen `BACKEND_DTO_CONTRACTS.md` already names it `value`**: *"Deal | public_id, lead_ref, business_ref, pipeline_ref, stage_ref, value, currency, probability, status, expected_close, closed_at, lost_reason, version"*. B6 does not introduce a second, competing field name for the identical frozen concept. Every document in this pack uses `value`. This is stated as its own decision (`B6-D-A007`) precisely because inventing a parallel `amount` field — or worse, silently renaming the frozen `value` — is exactly the class of error `B5-FIX.1` had to correct for `message.send`/`conversation.view`: check the frozen name before writing a new one.

`Deal.value` is explicitly documented as **expected / proposed / commercial deal value** — a sales estimate of what the opportunity is worth if won. It is **not** recognized revenue, not a payment, not an invoice amount, not cash received, and is never read by any recognized-revenue selector as authoritative financial truth (`B6_REVENUE_FIREWALL.md`).

## 2. Field-by-field authority

| Field | Authority | Mutability | Nullability | Lifecycle |
|---|---|---|---|---|
| `id` | `AUTHORITATIVE_PERSISTED` | immutable | never null | generated at creation |
| `public_id` (`DEAL-*`) | `AUTHORITATIVE_PERSISTED` | immutable | never null | generated at creation, frozen registry section A |
| `workspace_id` | `AUTHORITATIVE_PERSISTED` | immutable | never null | set at creation from the active workspace |
| `lead_id` | `AUTHORITATIVE_PERSISTED` | immutable | **never null (Phase 1)** | required at `CreateDeal`; see `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §1 |
| `business_id` | `SNAPSHOT` (derived from `lead.business_id`) | immutable after creation | never null (Lead always has one) | copied once at `CreateDeal`, never re-derived even if the Lead's Business is later re-pointed by `BusinessMerged` — see §3 |
| `pipeline_id` | `AUTHORITATIVE_PERSISTED` | immutable after creation | never null | required at `CreateDeal`; changing pipelines is **`NOT_SUPPORTED`** in Phase 1 (`B6-D-B002`, Class B — moving a Deal between pipelines has no frozen precedent and is deferred rather than invented) |
| `stage_id` | `AUTHORITATIVE_PERSISTED` | mutable while `status='open'`; frozen at close | never null | `MoveDealStage` writes it; retains its last-open value permanently after `won`/`lost` (history is never rewritten) |
| `owner_membership_id` | `AUTHORITATIVE_PERSISTED` (`EXTERNAL_DOMAIN_REFERENCE` to B1) | mutable | never null | `B6_OWNERSHIP_ASSIGNMENT.md` |
| `title` | `AUTHORITATIVE_PERSISTED` | mutable | never null, 1–140 chars | free text, actor-authored |
| `description` | `AUTHORITATIVE_PERSISTED` | mutable | nullable | free text |
| `value` | `AUTHORITATIVE_PERSISTED` | mutable while `open` | never null, `>= 0` | expected/proposed commercial value, §1 |
| `currency` | `AUTHORITATIVE_PERSISTED` | **immutable after creation** | never null | ISO-4217, `B6_CURRENCY_MODEL.md` |
| `probability` | `AUTHORITATIVE_PERSISTED` | mutable while `open`; forced `100`/`0` at close | never null, `0..100` | `B6_FORECAST_PROBABILITY.md` |
| `expected_close_date` | `AUTHORITATIVE_PERSISTED` | mutable while `open` | nullable | sales estimate, no system meaning beyond display/filter |
| `status` | `AUTHORITATIVE_PERSISTED` | governed by the state machine only | never null | `open` \| `won` \| `lost`, `B6_DEAL_STATE_MACHINE.md` |
| `loss_reason_code` | `AUTHORITATIVE_PERSISTED` (`EXTERNAL_DOMAIN_REFERENCE` to `deal_loss_reasons`) | set only by `CloseDealLost`; cleared only by `ReopenDeal` | required iff `status='lost'` | `B6_WON_LOST_LOSS_REASONS.md` |
| `loss_reason_note` | `AUTHORITATIVE_PERSISTED` | set only by `CloseDealLost` | nullable free text | optional elaboration alongside the required catalog code |
| `created_at` / `updated_at` | `AUTHORITATIVE_PERSISTED` | system-maintained | never null | UTC |
| `closed_at` | `AUTHORITATIVE_PERSISTED` | set on `won`/`lost`; cleared on `ReopenDeal` | nullable | `= won_at` or `= lost_at`, kept as one column for simple "is this deal closed" queries |
| `won_at` / `lost_at` | `AUTHORITATIVE_PERSISTED` | set exactly once per closing transition; cleared on `ReopenDeal` | nullable | history-preserving: if a Deal is closed, reopened, and closed again differently, the **transition history** (`deal_stage_transitions`) retains every prior `won_at`/`lost_at`, even though the live column reflects only the current closure |
| `reopened_at` | `AUTHORITATIVE_PERSISTED` | set by `ReopenDeal` | nullable | last reopen instant, for display; full history is in `deal_stage_transitions` |
| `version` | `AUTHORITATIVE_PERSISTED` | system-incremented | never null, `>= 1` | optimistic concurrency, `B6_CONCURRENCY_IDEMPOTENCY.md` |

## 3. Why `business_id` is a snapshot, not a live relationship

Frozen `B1_AUTHORIZATION_RBAC.md` Doctrine R-2's relationship-injection table lists *"Deal → Lead, Pipeline, Stage | all three in-scope"* — it does not list Business. Frozen `BACKEND_DTO_CONTRACTS.md`'s Deal DTO sketch nonetheless includes `business_ref`. Both are true simultaneously under one reading: `Deal.lead_id` is the sole **independently validated** relationship (workspace-scoped, resolved through Doctrine R-2 at every command); `Deal.business_id` is a **read-convenience snapshot** of `lead.business_id`, copied once at `CreateDeal` and never re-validated as its own relationship thereafter. This is the identical pattern `B2_LEAD_PROVENANCE_DUPLICATION.md` uses for Lead's own provenance snapshot fields, and it avoids two independent authorities for "which Business does this Deal belong to."

**Consequence for `BusinessMerged`.** If the Lead's Business is later re-pointed by a `BusinessMerged` event (`B2_LEAD_AGGREGATE.md` §1: `business_id` is "immutable except by `BusinessMerged` re-pointing"), `Deal.business_id` is **not** automatically re-pointed. It remains a snapshot of the Business at Deal-creation time. This is stated explicitly as `B6-D-B001` (Class B — a filter/read-model reconciliation detail, not an architectural blocker) rather than left ambiguous: query surfaces that filter Deals by Business must resolve through `Deal.lead_id → Lead.business_id` (the live value) for correctness, and treat `Deal.business_id` as historical/display-only.

## 4. Concurrency behavior

Every field marked `AUTHORITATIVE_PERSISTED` and mutable is guarded by `version`/`If-Match` (`B6_CONCURRENCY_IDEMPOTENCY.md`). No field on `Deal` is ever written by a last-write-wins race; every mutating command locks the row (`SELECT ... FOR UPDATE`), checks `expected_version`, applies its change, and increments `version` inside one transaction alongside the corresponding `deal_stage_transitions` row and outbox event.

## 5. Audit implications

Every field change that matters commercially (`status`, `stage_id`, `value`, `probability`, `owner_membership_id`, `loss_reason_code`) is reconstructable from `deal_stage_transitions` plus the outbox event stream — never solely from the current row (`B6_STAGE_TRANSITION_HISTORY.md`, `B6_OBSERVABILITY_AUDIT.md`). `title`/`description` free-text edits are **not** individually versioned beyond the aggregate `version` counter in Phase 1 — a full field-level edit history is `B6-D-C003` (Class C, no frontend evidence or stated need for it today).
