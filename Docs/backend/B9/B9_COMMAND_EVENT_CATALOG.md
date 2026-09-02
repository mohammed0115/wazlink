# B9 — Command / Event Catalog

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Commands

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` names three B9 commands verbatim: `RecordRevenueEvent`, `ReverseRevenueEvent` (Revenue row) and `RecordTouchpoint` (Attribution row). **B9 reuses all three names exactly** and adds two for the reconciliation surface.

| Command | Aggregate | Actor | Permission | Preconditions | Idempotency identity | Concurrency | Owned writes | Produced events | Origin |
|---|---|---|---|---|---|---|---|---|---|
| `RecordRevenueEvent` | RevenueEvent | **human membership only** | `revenue.recognize` + `revenue.view` | source resolves in-workspace; not platform billing; amounts valid; `recognized_at` not future | `(workspace_id, idempotency_key)` + `(workspace_id, source_type, source_entity_type, source_public_id)` where not fully reversed | insert-guarded by two unique constraints; no lock needed | `revenue_events` +1, `revenue_attributions` +0/1 | `RevenueRecognized` | **FROZEN name** |
| `ReverseRevenueEvent` | RevenueEvent | **human membership only** | `revenue.reverse` + `revenue.view` | event resolves in-workspace; not already fully reversed (both folds); currency matches; `Σ gross + this ≤ event gross`; **`net` is derived, not accepted** (`B9-D-A033`); derived `net > 0` **unless** this is the terminal gross-cleanup — `Σ gross + this = event gross` **and** `Σ net = event net` (`B9-D-A040`) | `(workspace_id, idempotency_key)` | `SELECT … FOR UPDATE` on the event row; the terminal test is evaluated under that lock | `revenue_reversals` +1 (with derived `net`, which is `0` only for the terminal cleanup), `revenue_events.status` recomputed from both folds | `RevenueReversed` | **FROZEN name** |
| `RecordTouchpoint` | AttributionTouchpoint | **human membership only** | `attribution.manage` | subject resolves in-workspace; `source_ref` names a registered §A entity; `origin_kind` in the closed set; `occurred_at` not future; `position` free for the subject | `(workspace_id, idempotency_key)` + `(workspace_id, subject_type, subject_public_id, position)` | insert-guarded | `attribution_touchpoints` +1 | `TouchpointRecorded` | **FROZEN name** |
| `OpenFinancialReconciliationCase` | FinancialReconciliationCase | **system** (scanner) | n/a — not an API surface | condition detected; no live case with the same fingerprint | `(workspace_id, fingerprint)` where status live | insert-guarded | `financial_reconciliation_cases` +1 | `FinancialReconciliationCaseOpened` | additive, internal |
| `ResolveFinancialReconciliationCase` | FinancialReconciliationCase | human membership | `finance.reconciliation.resolve` | case resolves in-workspace; status is `open`/`investigating`; reason present | `(workspace_id, resolution_idempotency_key)` | `SELECT … FOR UPDATE` on the case row | `financial_reconciliation_cases` (status/resolution fields only) | `FinancialReconciliationCaseResolved` | additive |

```
COMMAND_COUNT                = 5
FROZEN_REUSED_COMMAND_COUNT  = 3   (RecordRevenueEvent, ReverseRevenueEvent, RecordTouchpoint)
ADDITIVE_COMMAND_COUNT       = 2
```

**No command writes a table owned by B0-B8 or B10.** `RecordRevenueEvent` and `ReverseRevenueEvent` *read* B2/B3/B6/B8 entities to validate a source and resolve provenance; neither holds a write path (`B9_REVENUE_FIREWALL.md` §3). The provenance read now includes B3's `discovery_results` — strictly read-only, as a first-touch candidate source (`B9_FIRST_TOUCH_MODEL.md` §2.2); `AT-FT-13` **(NC)** is the control.

**Every command's actor is a human membership.** An earlier draft listed "the system provenance resolver" as an alternative actor for `RecordTouchpoint` and defined it nowhere; `B9-D-A036` removes it. The one system-initiated write in B9 remains `OpenFinancialReconciliationCase`, which creates a case rather than a financial or attribution fact and holds no financial permission.

### 1a. Adjudicated and **not** created

| Candidate | Verdict | Reason |
|---|---|---|
| `RecognizeRevenue` | **rejected as a name** | Frozen B0 already names the command `RecordRevenueEvent` in three places (`BACKEND_DOMAIN_OWNERSHIP.md`, ADR-007, `BACKEND_COMMAND_EVENT_CATALOG.md`). Inventing a synonym would be a non-additive rename of a frozen command. The task brief's `RecognizeRevenue` is treated as a description, not a name. `B9-D-A001` |
| `AssignRevenueAttribution` | **not created** | Attribution is snapshotted once, in the recognition transaction (`B9-D-A014`). A command to re-assign it after the fact is a way to change a historical financial report; corrections use reverse-and-re-recognize. `B9-D-A024`, deferred alternative `B9-D-B005` |
| `DeleteRevenueEvent` / `UpdateRevenueEvent` | **not created** | `B9-D-A010`; `REVENUE_EVENT_DELETE_PATHS = 0` |
| `AdjustRevenue` | **not created** | A third mutation shape beside recognition and reversal (`B9-D-A011`) |
| `CloseFinancialPeriod` | **not created** | Period close belongs to a ledger B9 explicitly is not (`B9-D-A003`) |
| `ConvertRevenueCurrency` | **not created** | No FX authority (`B9-D-A017`) |

## 2. Produced events

| Event | Payload | Transport | Dedup | Origin |
|---|---|---|---|---|
| `RevenueRecognized` | `revenue_event_ref, workspace_ref, source_type, source_ref, gross, net, currency, recognized_at, recognized_by, occurred_at` | transactional outbox | `(revenue_event_ref)` unique | **FROZEN** — `BACKEND_DOMAIN_OWNERSHIP.md` Revenue row |
| `RevenueReversed` | `reversal_ref, revenue_event_ref, workspace_ref, gross, net, currency, reason, reversed_by, occurred_at` | transactional outbox | `(reversal_ref)` unique | **FROZEN** — same row |
| `TouchpointRecorded` | `touchpoint_ref, workspace_ref, subject_type, subject_ref, source_type, source_ref, occurred_at, position` | outbox | `(touchpoint_ref)` unique | **FROZEN** — Attribution row |
| `RevenueAttributionAssigned` | `revenue_event_ref, workspace_ref, model, allocation_bps, source_type, source_ref, acquired_at, occurred_at` | outbox | `(revenue_event_ref)` unique — one per event | additive |
| `FinancialReconciliationCaseOpened` | `case_ref, workspace_ref, case_type, severity, subject_type, subject_ref, detected_at` | outbox | `(case_ref)` unique | additive |
| `FinancialReconciliationCaseResolved` | `case_ref, workspace_ref, case_type, status, resolution_action, resolved_by, resolved_at` | outbox | `(case_ref, status)` unique | additive |

```
PRODUCED_EVENT_COUNT      = 6
FROZEN_REUSED_EVENT_COUNT = 3   (RevenueRecognized, RevenueReversed, TouchpointRecorded)
ADDITIVE_EVENT_COUNT      = 3
EVENT_NAME_COLLISIONS     = 0
```

**Collision check.** Each additive name was checked against `BACKEND_COMMAND_EVENT_CATALOG.md` and every B1-B8 catalog's own event list; all produced event names are uniquely `Revenue*`/`Touchpoint*`/`FinancialReconciliation*`-prefixed and appear in no other domain.

**Payload sterility, in the other direction.** `RevenueRecognized` carries no Deal value, no payment status, no plan price — only what B9 itself decided. A downstream consumer cannot mistake it for a commercial fact about another domain.

**No B10/B11/B12 consumer is declared** for any of these events — matching the posture every earlier domain held before its downstream phases existed. Future phases may register as consumers without amending this catalog.

## 3. Consumed events — **none** — resolved (Class A, `B9-D-A002`)

```
CONSUMED_EVENT_COUNT = 0
```

This is a decision, not an omission, and it has three independent justifications:

1. **A frozen boundary requires it.** `B8_B9_FINANCE_BOUNDARY.md` §4 states: *"Any future B9-governed financial command reading B8 data is a **read-only, on-demand query** against B8's own frozen DTOs … **never an event subscription** requiring B8 to know about B9's existence."* Subscribing to `PaymentSucceeded` would contradict a frozen B8 document.

2. **It makes the firewall structural rather than procedural.** With zero consumed events there is *no listener anywhere in B9* that any upstream event could reach. `DealWon` cannot leak into revenue because nothing in B9 is listening for it. This is a stronger guarantee than "the handler is careful": there is no handler. `WON_DEAL_REVENUE_LEAKS = 0` and `B8_PAYMENT_AUTHORITY_LEAKS = 0` follow structurally.

3. **Nothing in B9 needs one.** Recognition is human-initiated (`B9-D-A008`). Provenance is resolved by on-demand read at recognition time (`B9_FIRST_TOUCH_MODEL.md` §3). Reconciliation compares settled state at scan time, which is more robust than stream ordering and immune to out-of-order delivery (`B9_TIME_PERIOD_MODEL.md` §6).

Consequently B9 requires **no** consumer-list amendment against any frozen B2/B3/B6/B8 catalog — `MISSING_EVENT_AMENDMENTS = 0`, `INVALID_CONSUMED_EVENT_REFS = 0`.

The upstream facts B9 reads on demand, and the frozen DTOs it reads them through:

| Fact | Owner | Frozen DTO | Used for |
|---|---|---|---|
| Deal | B6 | `Deal` | source validation, provenance chain |
| Lead | B2 | `Lead` | source validation, provenance chain |
| Business | B3 | `Business` | provenance chain |
| DiscoveryJob | B3 | `DiscoveryJob` | provenance chain; the `JOB-*` a derived candidate names |
| DiscoveryResult | B3 | `DiscoveryResult` | **derived first-touch candidates** — `job_id`, `business_id`, `discovered_at`, `page_index`, `position_in_page` (`B9_FIRST_TOUCH_MODEL.md` §2.2) |
| DiscoverySource | B3 | contract string | display-name resolution for `source_code`; never an `EntityRef` |
| Payment / Invoice / Subscription / Refund | B8 | `Payment`, `Invoice`, `SubscriptionDTO`, `Refund` — exactly the fields `B8_B9_FINANCE_BOUNDARY.md` §3 offers, as extended by `B9-AM-009` | source gating, reconciliation, refund evidence |

## 4. Why `RevenueRecognized` cannot be produced by anyone else

`RevenueRecognized` and `RevenueReversed` appear in the closed produced-event list of **no** other domain:

| Domain | Its closed event list contains `Revenue*`? |
|---|---|
| B2 CRM | no |
| B3 Discovery | no |
| B6 Pipeline | no — `B6_REVENUE_FIREWALL.md` §2 states it explicitly |
| B7 Automation | no — `B7_REVENUE_FIREWALL.md` |
| B8 Billing | no — `B8_REVENUE_FIREWALL.md` §2 enumerates all 17 B8 events and states `RevenueRecognized`/`RevenueReversed` "do not appear in it and are producible by no B8 command" |

`REVENUE_EVENT_PRODUCERS_OUTSIDE_B9 = 0`, established by five independent frozen documents plus this one.

## 5. Negative controls

`AT-CMD-1` **(NC)**: a sixth B9 command appearing without a controlled amendment — fails.
`AT-CMD-2` **(NC)**: any B9 command writing a B2/B3/B6/B7/B8/B10 table — fails.
`AT-CMD-3` **(NC)**: a B9 event consumer/listener of any kind existing in Phase 1 — fails; `CONSUMED_EVENT_COUNT = 0`.
`AT-CMD-4` **(NC)**: `RecordRevenueEvent` renamed to `RecognizeRevenue` in any contract — fails; frozen name.
`AT-CMD-5` **(NC)**: any B9 command accepting a non-human actor — fails; `OpenFinancialReconciliationCase` is the only system-initiated write and creates no financial or attribution fact.
