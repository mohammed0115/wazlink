# B12 — Domain Authority Firewalls

> Design only. The frozen `Jobs` row's forbidden coupling is three words — **"no domain ownership"** — and this document is what makes them checkable. Each section states what B12 may do, what it may never do, and the negative control that proves it.

## 0. The one rule, stated once

> **`B12-D-A002` (`B12_SCOPE_AND_OWNERSHIP.md` §3). Every domain effect B12 causes is caused by invoking that domain's own guarded application command. B12 writes no domain table, ever, by any path: not a worker, not a dispatcher, not the webhook gateway, not a reconciliation repair, not an operator replay, not a migration.**

The frozen doctrine B12 inherits rather than invents: `BACKEND_DOMAIN_OWNERSHIP.md` forbids cross-context ORM access (*"ORM imports across bounded contexts are not permitted in domain code"*), and `BACKEND_INTEGRATION_BOUNDARIES.md` states *"Provider callbacks never directly mutate business aggregates outside an application service."*

## 1. B3 — Discovery

| B12 **may** | B12 **must never** |
|---|---|
| execute `PlacesProvider`/`ScrapingProvider` calls within B3's budgets | increment, reset, or bypass `attempt_no` |
| retry transport failures under the frozen 5/6-attempt classes | consume an actor-retry slot (`B3-D-A032`) |
| receive and route the scraper callback | decide a `DiscoveryJob`'s status |
| record provider attempts and cost metadata | normalize results into business meaning |

The critical distinction is frozen on B3's side already — verbatim in **`B3_DECISION_REGISTER.md` (`B3-D-A031`)**: *"Automatic transient retry (frozen B0's per-call backoff/attempt mechanics) is a distinct, unrelated counter: it never increments `attempt_no` and never creates a new Job attempt."* `B3_RETRY_FAILURE_MODEL.md` §1 supports it in its own words rather than containing that sentence. B12's five transport attempts happen **inside** one job attempt. `B3_AUTHORITY_LEAKS = 0`; `AT-B12FW-2`.

**The composite bound is preserved.** `B3-INV-11` fixes 50 combinations × 5 pages = 250 provider calls per attempt, × 3 attempts, and B12 adds only the frozen per-call transient multiplier — it never widens the fan-out, because it never decides how many queries to issue.

## 2. B4 — AI Lead Intelligence

| B12 **may** | B12 **must never** |
|---|---|
| execute `AIProvider` calls behind `AIService` | exceed B4's provider-attempt maximum by transport retry |
| enforce the frozen 3s/60s/5m budget | spend a logical call B4 did not authorize |
| record latency, model, usage metadata | interpret a completion into a score, signal, or recommendation |
| classify a timeout as `unknown` | mark an `IntelligenceRun` failed or completed |

Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` states the port rule verbatim: *"no direct vendor calls from domains."* B12 provides the only path, and it is budgeted by B4. A generic worker retry may **never** silently exceed B4's frozen provider-attempt maximum.

**The bound, cited precisely rather than gestured at.** Frozen `B4_COST_RATE_LIMIT_MODEL.md` §5 fixes `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` and states that it *"wins over B0's larger generic ceiling"*, forbidding any fallback to B0's 5- or 6-attempt rows; §6 computes the envelope as **2 logical calls × 3 attempts = 6 provider call attempts per admitted run**, inside a 60-admissions-per-workspace-per-hour pool. B12 records these figures only to make the `MIN(frozen_class_max, domain_budget_remaining)` rule checkable (`B12_RETRY_BACKOFF_MODEL.md` §4). **It creates no second budget authority**: the counter lives in B4's rows, B4 alone may change it, and `B12-D-B012` already refuses B12 a cost model of its own. `B4_AUTHORITY_LEAKS = 0`, `B4_RETRY_BUDGET_GAPS = 0`; `AT-B12FW-3`, `AT-B12RTY-8`.

## 3. B5 — Messaging

| B12 **may** | B12 **must never** |
|---|---|
| issue the `MessagingProvider` send request | decide `Message.status` |
| verify, receipt, dedup, and normalize Meta callbacks | decide Conversation ownership, assignment, or service window |
| deliver normalized status evidence to B5's command | decide recipient/contact truth or consent |
| retry transport failures | decide template business eligibility |
| classify a send timeout as `unknown` | mark a message sent, delivered, read, or failed |

B5 owns the monotonicity rule that decides whether a status may advance (`B5_MESSAGE_STATE_MACHINE.md` §4); B12 delivers evidence in arrival order and applies no ordering opinion (`B12_WEBHOOK_DEDUP_ORDERING.md` §4). Consent in particular is absolute on B5's side — *"No field, permission, or command in this design admits a send against an `opted_out` recipient, at any privilege level"* — and no B12 replay, retry, or operator action creates a second send path around it. `B5_AUTHORITY_LEAKS = 0`; `AT-B12FW-4`, `AT-B12FW-5`.

## 4. B7 — Automation

**The most important firewall in this pack**, because B12 owns a scheduler and B7 owns triggers, and the two look alike from a distance.

| B12 **may** | B12 **must never** |
|---|---|
| run Celery Beat entries for reconciliation, cleanup, health checks | schedule a business action |
| deliver domain events to B7's inbox consumer | decide that a rule matched |
| provide the liveness sweep that recovers lost dispatch of already-`queued` runs | create, skip, or complete an `AutomationRun` |

> **`B12-D-A044`. Generic scheduling is not automation.** A Beat entry that fires every 15 minutes to detect stale rows is infrastructure; a rule that fires because a Lead became qualified is business. B12 has only the former, and it may never grow the latter.

Frozen `B7_B12_ASYNC_BOUNDARY.md` is unusually explicit and B12 honors it literally: B7 Phase 1 requires *"no timer-driven automation scheduling, no scheduled-trigger sweep, and no `automation_wakeups` polling mechanism"*, and an earlier draft's request for a periodic wakeup sweep is *"removed, not deferred to a footnote."* **B12 builds no wakeup sweep.** The one reconciliation requirement B7 does state *"is a liveness mechanism that recovers already-`queued` work whose dispatch was lost, never a schedule that decides when automation runs"* — which is exactly `B12_RECONCILIATION_MODEL.md` class `P-2`, and nothing more. `B7_AUTHORITY_LEAKS = 0`; `AT-B12FW-6`, `AT-B12SCH-3`.

## 5. B8 — Billing

| B12 **may** | B12 **must never** |
|---|---|
| call the Tap adapter | grant an entitlement |
| verify, receipt, and dedup Tap callbacks | activate, renew, or suspend a Subscription |
| perform the read-only `retrieve_charge` status lookup | decide `Payment.status` independently |
| reconcile transport-level unknowns | treat a redirect as evidence of payment |

Frozen `B8_CHECKOUT_PAYMENT_MODEL.md`: *"`PaymentSucceeded`/`SubscriptionActivated` are produced exclusively by `ProcessPaymentWebhook` or `ReconcilePayment`"* — both **B8** commands. B12 supplies verified evidence to them and never emits either event. `B8_AUTHORITY_LEAKS = 0`; `AT-B12FW-7`.

**Tap's bounded retry makes this firewall load-bearing rather than ceremonial:** because a lost callback is lost permanently (`B12-X-006`), B8's reconciliation sweep is the guarantee, and it is B8's command that settles truth — not a B12 inference from a missing webhook.

## 6. B9 — Finance

| B12 **may** | B12 **must never** |
|---|---|
| dispatch B9's own events | create a `RevenueEvent`, `RevenueReversal`, or `AttributionTouchpoint` |
| run B9's reconciliation detection scans | recognize or reverse revenue |

Frozen `B9_B12_ASYNC_BOUNDARY.md`: *"No revenue is ever created by a worker, and no financial correctness depends on a job running."* B12 therefore has **no** asynchronous write path into B9 at all, and B9's own negative control (`B9_B12_ASYNC_BOUNDARY.md` §5, B9-numbered) forbids making recognition asynchronous. Provider/transport evidence is **not** recognized revenue. `B9_AUTHORITY_LEAKS = 0`; `AT-B12FW-8`.

## 7. B10 — Tax

B10 is dormant: `zatca_applicability` starts `unknown` and reaches `not_applicable` only by an explicit Owner-only command; the artifact format is gated under `B10-D-B001`. B12 therefore designs a `TaxProvider` **port compatibility** posture and nothing else — no submission flow, no retry semantics beyond the frozen "ZATCA unavailable / yes / 8" row, no applicability logic. B12 never decides applicability, document classification, submission state, or correction semantics, and asserts no ZATCA claim. `B10_AUTHORITY_LEAKS = 0`; `AT-B12FW-9`.

## 8. B11 — Files

| B12 **may** | B12 **must never** |
|---|---|
| execute `FileStorageProvider` calls | decide a `FileAsset`'s `lifecycle_state` |
| run B11's purge, expiry, and orphan sweeps by invoking B11's guarded commands | hard-delete a `file_assets` row |
| carry B11's unknown-outcome discipline | move B11 lifecycle truth into Celery task state |

Frozen `B11_B12_ASYNC_BOUNDARY.md` §5 already states the negative controls from B11's side, including *"a file becoming `available`, or a download succeeding, as a result of a background job — fails"* and *"a purge-worker failure causing any change to `lifecycle_state` — fails."* B12 satisfies both by construction: the two state machines are orthogonal on B11's side, and B12 writes neither. `B11_AUTHORITY_LEAKS = 0`; `AT-B12FW-10`.

## 9. B1, B2, B6 — no B12 write path at all

B1 (workspaces, memberships, sessions), B2 (leads, contacts, tasks, appointments), and B6 (deals, pipelines, stages) have **no** asynchronous provider interaction in Phase 1. B12 references B1 read-only for tenancy and dispatches B2/B6 events without consuming them. There is no B12 command that names a B2 or B6 table. `AT-B12FW-11`.

## 10. The summary invariant

> **A B12 table can tell you that something was *attempted*, *delivered*, or *failed to dispatch*. It can never tell you that a Lead is qualified, a Message was read, a Payment succeeded, revenue was recognized, a tax document was cleared, or a file is available. Those eleven answers live in eleven other places, and B12 is not one of them.**
