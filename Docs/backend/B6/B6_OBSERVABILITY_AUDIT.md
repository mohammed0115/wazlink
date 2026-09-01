# B6 — Observability and Audit

> **B6 status:** Target design only.

## 1. Structured audit entries

Every successful mutating command writes, in the same transaction as its domain effect: `command_id` (the idempotency identity), `actor_membership_id` (or `system:automation`, reserved), `workspace_id`, `deal_id`/`pipeline_id`/`stage_id` (whichever the command targets), `from_status`/`to_status` and `from_stage_id`/`to_stage_id` where applicable (via `deal_stage_transitions`, `B6_STAGE_TRANSITION_HISTORY.md` §2), `deal_version_before`/`deal_version_after`, and `occurred_at`. This is the identical field set the task requires, already fully specified as `deal_stage_transitions`' own column list — no separate audit table duplicates it for status/stage transitions.

For non-transition mutations (`UpdateDeal` field edits, `AssignDeal`), the audit record is the `DealUpdated`/`DealAssigned` event itself (envelope fields plus `changed_fields`/`from_owner_ref`/`to_owner_ref`) — B6 does not maintain a second, B6-owned audit-log table beyond the outbox event stream and `deal_stage_transitions`, mirroring the corpus-wide "the event stream and the transition history are the audit trail" pattern rather than inventing a third parallel log.

## 2. Failure reason and latency

Every rejected command surfaces its `B6-DF-*` failure code in the error envelope's `code` field (`B6_FAILURE_CATALOG.md`), correlated to `request_id` per frozen B0's error envelope. Latency and conflict-rate metrics (version-conflict frequency per endpoint, idempotency-replay frequency) are operational metrics, not domain data — collected the same way every other domain's command latency is, via the platform's general operations/observability layer (`BACKEND_OPERATIONS_OBSERVABILITY.md`), with no B6-specific mechanism invented.

## 3. PII discipline

Structured logs and audit entries carry `actor_membership_id`/`owner_membership_id` (opaque references, resolved to a display name only at the UI layer) and `DEAL-*`/`LEAD-*` public IDs — never raw `Deal.title`/`description` free text, never a Lead's or Contact's name/phone/email (B6 doesn't hold those fields at all, `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5). `loss_reason_note` (free text) is treated the same as `title`/`description` — never emitted into a structured log line, readable only through the normal `deal.view`-gated API.

## 4. Reconstructability

**Every commercial state transition is reconstructable** from `deal_stage_transitions` alone, without inference from the current `Deal` row (`B6_STAGE_TRANSITION_HISTORY.md` §1–§2) — the explicit requirement this section exists to satisfy. A support investigation into "why is this Deal in this state" never needs to guess; it reads the ordered transition list, each row carrying its own `command_id` for exact API-call correlation.

## 5. Metrics worth alerting on

- Version-conflict rate on `deals`/`pipeline_stages` mutations — an unusually high rate suggests a UI-level race condition (e.g., two board views open simultaneously) worth investigating, though it is not itself an error the platform needs to prevent (the conflict mechanism is working as designed).
- `stage_referenced_by_active_deals` / `cannot_delete_default_pipeline` rejection frequency — repeated attempts may indicate a confusing admin UX rather than a security concern.
- Outbox delivery lag for `DealCreated`/`DealStageChanged`/`DealWon`/`DealLost` specifically, since these feed `Lead.last_activity_at` (`B6_CRM_TIMELINE_PROJECTION.md` §3) and a sustained lag would visibly stale-out CRM activity recency — the identical class of alert `B2_TIMELINE_IDENTITY_MODEL.md` §5.5.4 already requires for its own dead-letter path, applied here to B6's outbox as the upstream producer.
