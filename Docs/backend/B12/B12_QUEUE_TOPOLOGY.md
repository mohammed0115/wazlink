# B12 — Queue Topology

> Design only. No queue is declared. Derived from actual Phase-1 workload classes, not from the list of domain names.

## 1. Derivation, not enumeration

The brief (§14) offers eight candidate queues and warns against creating one per name. Four properties actually justify separating a queue — everything else is a routing key on a shared one:

| Property | Why it forces separation |
|---|---|
| **Independent provider rate limit** | one throttled provider must not stall unrelated work |
| **Order-of-magnitude latency difference** | a 30-minute scrape behind a 2-minute send starves the send |
| **Failure isolation** | a poison class must not consume every worker slot |
| **Different resource profile** | long-blocking I/O vs. short bursts |

## 2. The Phase-1 topology — five queues

> **`B12-D-A013`. Five queues.** Each is justified by at least two of §1's properties against every other queue.

| Queue | Carries | Justification | Frozen job ceiling |
|---|---|---|---|
| `default` | outbox dispatch, internal event fan-out, short domain follow-ups | the substrate itself; must never queue behind provider work | — |
| `providers.slow` | Discovery (Places, scraper), AI Gateway | 30m and 5m job ceilings; independent per-project QPM quotas (`B12-X-009`); the longest-blocking work in the system | 30m / 5m |
| `providers.fast` | Meta send, Tap API, storage | 2m–10m ceilings; latency-sensitive and user-visible | 2m / 5m / 10m |
| `webhooks` | post-acknowledgement processing of verified receipts | must never queue behind a 30-minute scrape — Meta retries *"over the next 36 hours"* if we do not respond (`B12-X-003`), and a stalled processor turns into provider-side redelivery pressure | 5m |
| `maintenance` | reconciliation sweeps, health checks, expiry/cleanup | lowest priority; must never displace user-visible work; deliberately starvable | 60m (frozen reconciliation cap) |

**Rejected splits, with reasons** — the point of this section is that the topology is a decision, not a default:

| Rejected | Why |
|---|---|
| one queue per domain (`discovery`, `messaging`, `billing`, `files`…) | domains are not workload classes. Tap and Meta share a latency profile and differ from Places by an order of magnitude; splitting by domain would put Tap next to a 30-minute scrape and Meta next to nothing |
| separate `ai` queue | AI shares `providers.slow`'s profile (5m ceiling, blocking I/O, provider quota). A sixth queue would add operational surface with no isolation gain |
| separate `files` queue | B11's async work is purge/sweep only, and B11 states *"if every B11 background job stopped forever… uploads, downloads, attachments, and deletions would all continue to work correctly"* (`B11_B12_ASYNC_BOUNDARY.md` §1). It is `maintenance`-class by its own design, except the storage adapter call, which is `providers.fast` |
| priority levels inside a queue | Redis-backed Celery priorities are advisory and easy to mis-tune; separate queues give the same isolation with observable depth per class |

## 3. Isolation properties this buys

- A Places QPM exhaustion (`B12-X-009`: *"When the number of requests in your project reaches the quota limit, your service stops responding to requests"*) backs up `providers.slow` **only**. WhatsApp sends and payment callbacks are unaffected.
- A Meta outage backs up `providers.fast` without stalling `webhooks`, so inbound status callbacks continue to be receipted and processed while outbound is degraded.
- A reconciliation sweep that finds ten thousand stale rows cannot displace a user's message send, because `maintenance` is separately provisioned.

## 4. What is *not* decided here

Worker counts, per-queue concurrency, autoscaling thresholds, and whether queues share a Redis database are **deployment** decisions (`B12_B13_BOUNDARY.md` §2). B12 fixes the *partition*, because it is a correctness-adjacent isolation boundary; it does not fix the *provisioning*, because that is tuning.

## 5. No new broker

Frozen ADR-004 states Kafka and alternative worker frameworks are *"not justified for Phase 1."* B12 introduces no second broker, no exchange topology, no dead-letter *exchange* (the dead-letter mechanism is a PostgreSQL table, `B12_DEAD_LETTER_REPLAY_MODEL.md`), and no streaming platform. Negative control `AT-B12QUE-4`.
