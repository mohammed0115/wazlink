# B12 — Async & Integration Platform — Executive Summary

> **B12 is NOT closed.** It is uncommitted and awaits independent CTO verification. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B12/` holds the B12 Async & Integration Platform target-design package — **45 documents**. It is **additive**: it modifies no frozen B0–B11 file and no frontend file. B0–B10 remain at the SHAs `BACKEND_DOCUMENTATION_INDEX.md` records, and the B11 pack is committed at `d15a64a3a082848923bc7ad19352e0678e7fee74`, which is this pass's `HEAD` and `origin/main`.

## What B12 found before designing anything

B12 is the first phase whose charter is written almost entirely in three words. Frozen `BACKEND_DOMAIN_OWNERSHIP.md` gives the `Jobs` row the forbidden coupling **"no domain ownership"** and the `Webhooks` row **"no direct domain mutation."** Eleven domains had already delegated work to a substrate that did not exist: B3's provider budgets, B4's call ceilings, B5's entire webhook pipeline, B7's event delivery and liveness sweep, B8's payment callbacks and reconciliation, B9's *refusal* of async writes, B11's storage sweeps. Four of those phases wrote a `B*_B12_ASYNC_BOUNDARY.md` telling B12 in advance what it owed them.

So B12's task was not to invent an architecture. It was to build the substrate eleven closed domains already assumed, **without becoming an authority for any of them** — and to say plainly where the frozen corpus was silent rather than filling silence with confidence.

## The central design problem, and its resolution

The naive shape is `request → Celery task → provider call → hope`. It fails four ways, each reachable in Phase 1: a broker restart loses committed intent; a redelivery duplicates a business effect; a worker crash double-charges a card; a timeout gets guessed as success or failure.

**B12's answer is six layers that are never collapsed** (`B12-D-A001`): business command · durable intent · outbox event · broker delivery · worker execution · provider attempt. **Only layer 4 — the broker — may be lost.** Everything above and below it is a committed PostgreSQL row. That single property makes the whole design recoverable: losing Redis degrades *latency*, never *correctness*, because the intent can always be re-scanned and the attempt record always says whether the outside world was already contacted.

The corollary is stated rather than hidden: **B12 does not claim exactly-once delivery** (`B12-D-A004`). Broker delivery is at-least-once; effectively-once *effect* is achieved at the destination by nine idempotency classes, durable uniqueness constraints, state-machine preconditions, and reconciliation — none of which is the broker.

## The research that changed the design

Nine facts were verified from primary provider documentation this pass. Two of them redirected the architecture rather than confirming it.

**Providers do not sign the same thing.** Meta signs the payload with HMAC-SHA256 under `X-Hub-Signature-256` (`B12-X-001`). Tap signs a **field concatenation** — `"x_id"+id+"x_amount"+amount+…+"x_created"+created` — under `hashstring` (`B12-X-005`). A universal "HMAC the raw body" verifier is therefore simply *wrong* for Tap, and a universal field-concatenation verifier is wrong for Meta. `B12-D-A030` makes verification an adapter responsibility with a shared contract, and frozen `BACKEND_SECURITY_ARCHITECTURE.md`'s own phrase — *"provider-specific deduplication"* — turns out to have been right for a reason nobody had yet written down.

**Provider retry generosity is asymmetric, and the asymmetry is load-bearing.** Meta retries a failed callback *"immediately, then… over the next 36 hours"* and explicitly instructs *"your server should handle deduplication"* (`B12-X-003`). Tap gives *"two more retry attempts before the status of the POST is updated as ERROR"* (`B12-X-006`). For Meta, a WazLink outage is survivable by waiting. **For Tap, a callback lost past three attempts is lost permanently** — which is why `B12-D-A025` records that B8's `retrieve_charge` reconciliation is not an optimization but the only guarantee, and why a later implementer must not treat that sweep as redundant with the webhook.

**And four capabilities are genuinely unknown.** No Phase-1 provider is confirmed to accept a client-supplied idempotency key: Meta, Tap, and Places document none, and OpenAI's advanced-usage page returned 404 this pass. Rather than guess, `B12-D-A024` makes every capability **tri-valued** and `B12-D-A012` builds a design that depends on none of them. Exactly **two** capability cells read `supported` platform-wide — Tap's `retrieve_charge` and storage's `stat_object` — and both are primary-sourced.

## What B12 designed

**A transactional outbox with five enumerated crash windows.** Each has a durable answer, and window 2 — published to the broker, crashed before marking dispatched — is answered honestly: the message is delivered twice, because there is no way to atomically commit across Redis and PostgreSQL. B12 chooses duplicate delivery over lost delivery, in one direction only, and makes the duplicate harmless at the consumer.

**Two inboxes, one owned.** B12 owns the *external* inbox (`webhook_receipts`, frozen) and deliberately does **not** own the *internal* one — frozen `B7_DATA_MODEL.md` §6 had already drawn that line, and centralizing eleven domains' dedup guarantees in a table B12 owns would be the authority leak the `Jobs` row forbids. B12 states the obligation and owns none of the rows.

**Nine idempotency classes, not one key.** A client `Idempotency-Key` cannot dedup a provider retry; a provider event ID cannot dedup a client command. Removing any one of the nine leaves a real, reachable duplicate — which is the argument for nine.

**Six retry counters with six owners.** Three belong to B12; three belong to domains and may never be consumed, reset, or exceeded by transport retry. Frozen `B3_DECISION_REGISTER.md` (`B3-D-A031`) had already stated the separation from the other side, verbatim, and B12 ratifies rather than reinterprets it.

**Three outcomes, not two.** `known_success`, `known_failure`, and **`unknown`** — durable, first-class, never coerced. A read timeout after a charge is indistinguishable from a captured charge whose response was lost; both binary answers are fabrications. The attempt row is committed **before** the provider call so a crash leaves evidence, and `B12-D-A020` forbids retrying a non-idempotent operation on an unresolved unknown with **no override flag, permission, or configuration**. Across 50 failure scenarios, exactly one produces a wrong business state if mishandled, and it is this one.

**Five queues derived from four isolation properties**, with four rejected splits documented — because domains are not workload classes, and putting Tap next to a 30-minute scrape is how a payment callback starves.

**A Redis boundary reduced to one question:** *if this instance is flushed now, is the system still correct after recovery from PostgreSQL?* A "no" means the use is forbidden. The genuinely subtle case is spelled out: an abuse counter may live in Redis; a counter that bounds **provider cost or commercial entitlement** is a PostgreSQL row, because a flush must not hand a workspace ten free provider-cost retries.

## Firewalls, restated a domain further

> **A B12 table can tell you that something was *attempted*, *delivered*, or *failed to dispatch*. It can never tell you that a Lead is qualified, a Message was read, a Payment succeeded, revenue was recognized, a tax document was cleared, or a file is available. Those eleven answers live in eleven other places, and B12 is not one of them.**

Two firewalls deserve naming. **B7**: generic scheduling is not automation — B7 explicitly *removed* its wakeup-sweep request, and B12 builds none. **B9**: financial write paths are synchronous by B9's own design, so B12 has no asynchronous write path into B9 at all.

## Numbers, derived rather than asserted

**10 controlled amendments** — 10 additive, **0 compatible clarifications, 0 non-additive** — across 12 frozen artifacts, none applied. **56 Class A decisions, 0 unresolved**; 12 Class B; 4 Class C. **1 new error code**, with **10 of 11** candidates absorbed into frozen ones. **1 permission reused** (`integration.manage`, frozen, with its role row untouched) and **2 added**, with five candidate operations composed rather than granted codes. **1 new public-ID prefix** (`INT-`), grounded in both shipped frontend evidence and a real API resource. **14 additive API operations** plus 3 uncounted webhook routes. **6 state machines, 27 states.** **191 acceptance tests across 42 categories, 93 negative controls.** **50 failure scenarios.** **95 Class-A frozen references**, each with an exact location. **15 research facts** — 9 `VERIFIED` from primary provider documentation fetched in this pass, 1 `PARTIAL`, 5 `UNRESOLVED`, 0 `CONTRADICTED`; none of the unresolved blocks Phase 1.

## What B12-FIX.1 repaired

An independent CTO verification returned `FAIL` — not on the safety core, which held under adversarial testing, but on a **cross-check that had never been run**: the command catalog and the state machines were each internally coherent and disagreed with one another in three places. That class of defect is worth naming, because it is the one a self-check is worst at finding.

- **A frozen terminal state was about to gain an outgoing edge.** `RetryWebhook` accepted a `failed` receipt and re-enqueued it, which would have required `failed → queued` on a machine frozen B0 defines and `B12-AM-007` reports as unchanged. The repair keeps the receipt **immutable** and routes reprocessing through the dead-letter replay machinery that already existed — a *new execution referencing the receipt*, never a rewind (`B12-D-A050`). The amendment's `ADDITIVE` classification is now true rather than assumed.
- **Rotating a working credential had no legal transition.** Machine 4 could reach `configuration_required` only from `error`, so an operator would have had to break an integration before rotating it. `B12-D-A051` adds `connected → configuration_required` on a material change, with `enabled` explicitly untouched.
- **A status no command could reach was removed rather than justified.** `disabled` duplicated the orthogonal `enabled = false` boolean; the fix deletes the state instead of inventing a command for it (`B12-D-A052`), taking `STATE_COUNT` from 28 to 27.
- **`lease_expires_at` was not a fence.** A dispatcher that is slow rather than dead cannot observe its own reaping, so a stale completion could clobber a legitimate owner. Every completion write is now a compare-and-set on `(status, lease_owner, lease_token)` (`B12-D-A055`), and window 5 traces the interleaving.
- **A global dedup identity written under per-binding authority was poisonable.** One tenant could claim another's receipt identity with a validly-signed callback, causing the rightful callback to be swallowed as a `duplicate`. `dedup_key` is now prefixed by the verifying binding (`B12-D-A056`) — strictly narrower, no frozen constraint changed, no verification weakened.
- **Two operator commands had no way to be invoked.** `AbandonDeadLetter` and `ResolvePlatformReconciliationCase` had permissions and preconditions but no surface; all 15 commands are now surface-classified, and four operator operations were added.
- **And the mirror-image defect, closed in B12-FIX.1a.** `RetryJob` and `RetryWebhook` claimed an operator path *"only inside `ReplayDeadLetter`"* that a second independent countersign proved **unreachable** — at replay time the receipt is terminal `failed` and the execution is `dead_lettered`, satisfying neither command's precondition. Both are now stated as **system-only**, `ReplayDeadLetter` is documented as invoking neither, and no permission cell governs a path that cannot execute (`B12-D-A053`). Removing a phantom path removed a claim, not a capability.

Nine counters moved as a consequence and were re-derived rather than preserved.

## Frontend evidence

Unlike B11's file surface, the integrations surface is **substantially built**: 226 lines of real UI over a seven-row catalogue with five statuses, per-integration capabilities, an activity log, and four guarded operator actions. Most importantly, the shipped client already stores **only** `hasConfiguredSecret: false` — no token field, no mask, no last-four — and its own header comment says so. B12's hardest redaction rule was therefore **corroborated, not invented**. Eleven behaviors, individually itemized; four of the ten API operations are frontend-grounded and six are frozen-backend-grounded, and that distinction is recorded rather than blurred.

## What remains open, and why it is safe

One `CONDITIONAL`: the scraping provider's webhook verification scheme cannot be designed before the provider is selected (`B12-D-B005`). Everything around it is decided — route, pipeline order, receipt shape, dedup hierarchy, tenant binding, error taxonomy — so choosing a provider adds an adapter's `verify()` and changes nothing else. That is precisely the property `B12-D-A030` was built to give, and the two providers Phase 1 actually depends on are both fully specified from primary sources.

B12 is design-only and grants no implementation authorization.
