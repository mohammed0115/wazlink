# B6 — CRM Timeline Projection

> **B6 status:** Target design only. Satisfies a contract frozen B2 already wrote in anticipation of this exact phase — `B2_TIMELINE_IDENTITY_MODEL.md` already names `pipeline` as an eligible cross-domain timeline source domain, with `deal.view` as its read gate, before B6 existed to fulfill it.

## 1. The frozen contract, quoted

`B2_TIMELINE_IDENTITY_MODEL.md` §2.1: *"A Deal can generate four separate timeline entries: `DealCreated` (source event), `DealStageChanged` (source event), `DealWon` (source event), `DealLost` (source event). All four reference the same `DEAL-*`. All four require different entry identities."*

§7.2 step 2: *"`pipeline` requires `deal.view`."* §4.2: *"Entry identity for Pipeline events. One rule, no branches: `entry_id = pipeline:<source_event_id>` (§2.2, shape B)."*

`B2_LEAD_AGGREGATE.md` §4's `last_activity_at` qualifying-events table, "Pipeline" row: *"`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost` | nothing"* — all four qualify, nothing else does, and this set is stated as closed.

B6 does not redesign any of this. It supplies exactly what §2.2.1 requires a source domain to expose, and nothing more.

## 2. What B6 exposes

Per event in `B6_COMMAND_EVENT_CATALOG.md` §3, B6's read model exposes: `source_domain = "pipeline"`, `source_event_type` (`deal_created`, `deal_stage_changed`, `deal_won`, `deal_lost`, `deal_reopened`, `deal_assigned`, `deal_updated`), `source_resource_ref` (the `DEAL-*` public ID), `source_event_id` (the event envelope's `event_id` — stable across redelivery, distinct per logical event, never the aggregate's public ID or `version`), `occurred_at` (the event's own business-event instant — the stage-change instant, the won/lost instant — never CRM's ingestion time, matching `B2_TIMELINE_IDENTITY_MODEL.md` §2.4's Pipeline row exactly: *"Event instant (stage change, won, lost) | Pipeline's event timestamp, not CRM's ingestion time"*), actor (`EntityRef` to `MEM-*`, or `system:automation` reserved), and the arguments a timeline safe-summary template consumes (e.g., for `deal_stage_changed`: from-stage name, to-stage name).

**B6 persists none of this as a CRM entry.** `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE` (frozen B2-FIX.2, unchanged): B2 reads B6's own event/read records at query time and constructs `TimelineEntry` itself. B6 has no `crm_activities` write path (`B6_DOMAIN_OWNERSHIP.md` §6).

## 3. Which events qualify for `last_activity_at` — closed set, additive amendment for exactly one

Frozen B2's qualifying-events table names exactly `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`. B6 introduces three additional events (`DealReopened`, `DealAssigned`, `DealUpdated`) not on that frozen list. Rather than silently assume they qualify (which would contradict B2's own explicit "closed set" framing) or silently assume they don't (leaving a real product question unresolved), B6 makes an explicit, itemized call for each:

| New B6 event | Qualifies for `last_activity_at`? | Reasoning |
|---|---|---|
| `DealReopened` | **Yes — proposed as an additive amendment to `B2_LEAD_AGGREGATE.md` §4** (`B6_CONTROLLED_AMENDMENTS.md` item 1). | Reopening a closed Deal is unambiguously human activity on the Lead's commercial history — the same class of significance as the four already-frozen Pipeline events, and excluding it would under-count genuine activity for no principled reason. |
| `DealAssigned` | **No.** | Mirrors `B2_LEAD_AGGREGATE.md` §4's own exclusion of `LeadOwnerChanged`... — wait, `LeadOwnerChanged` **is** listed as qualifying for CRM's own events. Re-examined: B2 treats *its own* ownership changes as qualifying but excludes cross-domain administrative changes with no direct product signal (e.g., excludes `MessageDelivered`/`MessageFailed` carrier receipts). `DealAssigned` is closer to a carrier-receipt-class administrative fact than a substantive commercial-progress fact — reassigning a Deal's owner does not, by itself, indicate anyone did anything *with* the Lead. **Decided: does not qualify**, recorded as a deliberate choice, not an oversight. |
| `DealUpdated` | **No.** | A field-level edit (title/value/probability/expected-close-date tweak) is, by the identical reasoning `B2_LEAD_AGGREGATE.md` §4 already applies to exclude `LeadIntelligenceCompleted` ("a machine re-scoring a Business is not activity on the Lead"), not itself evidence that a human engaged with the Lead in the qualifying sense — it is bookkeeping on an already-known opportunity. **Decided: does not qualify.** |

This resolves the ambiguity explicitly rather than leaving three new event types in an undefined relationship to a frozen closed set — exactly the kind of thing a careless B6 pass could get wrong the way the original B5 pass got `messaging.send` wrong, if it weren't checked against frozen B2 text directly.

## 4. Ordering, deduplication, clock skew

All inherited unchanged from `B2_TIMELINE_IDENTITY_MODEL.md` §3–§5, with no B6-specific variance:

- Total order `(occurred_at DESC, entry_id DESC)`.
- Deduplication key `(source_domain, source_event_id)` = `("pipeline", <event_id>)`, applied at read-time merge — B6 maintains no dedup store of its own.
- Clock-skew eligibility (`CLOCK_SKEW_TOLERANCE`, default 300s) evaluated by the CRM consumer at read time and at each `last_activity_at` processing attempt — B6's events simply need to carry a truthful `occurred_at`; the skew-handling machinery is entirely B2's, unchanged.
- `DealReopened`'s inclusion in the qualifying set (§3) inherits the identical recovery contract (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5) automatically once the additive amendment (§`B6_CONTROLLED_AMENDMENTS.md` item 1) is approved — no new recovery mechanism is designed here, because none is needed.

## 5. Lead 360's `deals[]` list — a separate projection from timeline entries

Frozen `BACKEND_DTO_CONTRACTS.md`'s Lead360 DTO already lists `deals` as its own array field, distinct from the timeline/`activities` array. This is **not** the timeline projection of §2 — it is a direct list of the Lead's Deal summaries (`B6_READ_MODELS_QUERY.md` §4), read via `Deal.lead_id`, gated by `deal.view`. Both projections exist simultaneously and serve different UI needs (a scannable deal-summary panel vs. a chronological activity feed) — exactly mirroring how B5 exposes both `GET /leads/{id}/conversations` (a list) and messaging timeline entries (chronological) side by side.
