# B12 — Transactional Outbox Model

> Design only. Realizes frozen `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-005 (*"Transactional domain changes and an `OutboxEvent` commit in one transaction. A dispatcher publishes internal work to Celery."*) and the frozen table `outbox_events` (`BACKEND_DATA_MODEL.md` line 27, constraint note *"dispatch/status/time"*).

## 1. The single rule

> **`B12-D-A006`. An `outbox_events` row is INSERTed in the *same* PostgreSQL transaction as the domain state it announces, and by the *same* application service. There is no other way to create one.**

No dispatcher, worker, signal handler, or admin tool inserts an outbox row for state that is already committed. Doing so reintroduces exactly the window ADR-005 exists to close: state committed, announcement lost. Negative control `AT-B12OBX-9`.

The converse also holds: **the outbox row's presence is not a promise that the effect happened** — only that it was *decided*. Whether it reached the world is layers 5–6 (`B12_ASYNC_EXECUTION_MODEL.md` §1).

## 2. Lifecycle

`OutboxEvent` has five states (machine 1, `B12_STATE_MACHINES.md` §1):

| State | Meaning |
|---|---|
| `pending` | committed, not yet claimed |
| `dispatching` | claimed by a dispatcher under a lease; publish in flight |
| `dispatched` | the broker accepted the message (terminal, happy path) |
| `failed` | a publish attempt failed; eligible for re-claim after backoff |
| `dead_lettered` | the dispatch attempt budget is exhausted (terminal); a `DeadLetterRecord` exists |

| From | To | Trigger |
|---|---|---|
| `pending` | `dispatching` | dispatcher claim (§3) |
| `dispatching` | `dispatched` | broker publish returned success |
| `dispatching` | `failed` | broker publish errored, **or the lease expired** (§4) |
| `failed` | `dispatching` | re-claim after backoff, attempts remaining |
| `failed` | `dead_lettered` | `dispatch_attempts >= MAX_DISPATCH_ATTEMPTS` |

`dispatched` and `dead_lettered` are terminal. There is no transition back to `pending`: a re-dispatch is a *new claim* of a `failed` row, never a rewind.

## 3. Claim semantics

```
BEGIN
  SELECT id, ... FROM outbox_events
   WHERE status IN ('pending','failed')
     AND (next_attempt_at IS NULL OR next_attempt_at <= now())
   ORDER BY created_at
   FOR UPDATE SKIP LOCKED
   LIMIT :batch
  UPDATE  ... SET status='dispatching',
                  lease_owner   = :dispatcher_id,
                  lease_token   = gen_uuid_v7(),      -- NEW each claim; the fencing token
                  lease_expires_at  = now() + :lease_ttl,
                  dispatch_attempts = dispatch_attempts + 1
       RETURNING lease_token                          -- the claimant remembers it
COMMIT
  -- publish to Celery OUTSIDE the transaction
  UPDATE ... SET status='dispatched', dispatched_at=now()   -- short second transaction
        WHERE id = :id
          AND status      = 'dispatching'             -- ┐
          AND lease_owner = :dispatcher_id            -- ├─ THE FENCE (§3a)
          AND lease_token = :claimed_token            -- ┘
  -- 0 rows updated  ⇒  the claim is no longer authoritative. Do not retry, do not
  --                    overwrite. Record the stale-completion metric and stop.
```

The shape above is a **conceptually required compare-and-set**, not frozen SQL. Any equivalent primitive — a monotonically increasing `claim_version` integer, an optimistic `expected_version`, a `WHERE` on a composite claim identity — satisfies it. What is normative is the *predicate*, not the syntax.

`FOR UPDATE SKIP LOCKED` is the concurrency control for the *claim*; the fencing predicate of §3a is the concurrency control for the *completion*. Two dispatchers running simultaneously claim **disjoint** row sets, and no distributed lock is required. This is the same PostgreSQL-first discipline frozen `BACKEND_DATA_GOVERNANCE.md` states (*"Database constraints and `transaction.atomic` are preferred before distributed locks"*) and `B8_CONCURRENCY_MODEL.md` already applies. `B12-D-A007`.

### 3a. The fence — every completion write is a compare-and-set (`B12-D-A055`)

> **`B12-D-A055`. A dispatcher may only write the outcome of a claim it still holds. Every post-publish update to an `outbox_events` row is conditioned on `status = 'dispatching'` **and** the claimant's own `lease_owner` **and** the `lease_token` minted by that claim. A stale claimant's write affects zero rows and is discarded, never retried.**

`lease_expires_at` alone is **not** a fence. It tells the *reaper* when a claim looks abandoned; it tells the *claimant* nothing, because a dispatcher that is merely slow — a long GC pause, a stalled broker socket, a paused container — has no way to know its lease was reaped while it was alive. Without the token, that dispatcher returns and writes `dispatched` onto a row a second dispatcher now legitimately owns.

`lease_token` is regenerated on **every** claim, including a re-claim of the same row, so a token is proof of *one specific claim*, not of the row's identity. That is what makes the predicate a fence rather than an ownership check.

**Ordering.** Claims are issued in `created_at` order per batch, but B12 **does not guarantee global ordering** of delivery. Consumers must be order-tolerant; where order matters it is enforced by the consumer's own monotonicity rule, exactly as `B5_MESSAGE_STATE_MACHINE.md` §4 already does for message status (`B12_WEBHOOK_DEDUP_ORDERING.md` §4).

## 4. The five crash windows, answered

The brief's §8 names four; B12-FIX.1 adds a fifth that an expiry timestamp alone cannot close. Each has a durable answer, not a hope.

| # | Window | What is true afterwards | Recovery |
|---:|---|---|---|
| 1 | **DB commit succeeds, broker publish fails** | the row is `dispatching` or `failed`; the intent is safe | the sweep re-claims it after backoff. This is the *ordinary* case the outbox exists for |
| 2 | **Broker publish succeeds, dispatcher crashes before marking `dispatched`** | the row is stuck in `dispatching` with an expired lease | the sweep reclaims expired leases → `failed` → re-publish. **The message is therefore delivered twice**, which is safe precisely because §5's consumer constraint absorbs the duplicate. B12 chooses *duplicate delivery* over *lost delivery*, deliberately and in one direction only |
| 3 | **Same outbox message reaches Celery twice** | two workers may run | the consumer's durable `(workspace_id, source_event_id)` uniqueness constraint makes the second a no-op (`B12_INBOX_MODEL.md` §3) |
| 4 | **Worker crashes after the provider call** | `provider_request_attempts` has a row written *before* the call, with no recorded outcome | classified `unknown`; resolved by `stat`/status-lookup or reconciliation, **never** by a blind repeat (`B12_UNKNOWN_OUTCOME_MODEL.md` §3) |
| 5 | **Lease expires while dispatcher A is still alive; B reclaims; A returns late** *(added in B12-FIX.1)* | the row is owned by B under a **new** `lease_token`; A holds a stale one | A's completion write matches zero rows (§3a's fence) and is **discarded**. B's claim proceeds normally. The message may be published twice — absorbed at the consumer exactly as window 2 — but **the outbox row's own state is never clobbered** |

**Window 5, traced.** This is the case `lease_expires_at` alone cannot answer, so it is worth walking:

```
t0  A claims row R  → status=dispatching, lease_owner=A, lease_token=T1, expires t0+TTL
t1  A publishes to the broker; the call stalls (GC pause / socket hang). A is ALIVE.
t2  t0+TTL passes. The reaper sees an expired lease → R becomes `failed`.
t3  B claims R      → status=dispatching, lease_owner=B, lease_token=T2  (T2 ≠ T1)
t4  B publishes successfully → B's fenced UPDATE matches (dispatching, B, T2) → `dispatched`
t5  A finally returns and attempts  UPDATE ... WHERE status='dispatching'
                                            AND lease_owner=A AND lease_token=T1
    → 0 rows. A discards the result, emits `outbox_stale_completion_total`, and stops.
```

Outcome: **one row, one correct terminal state, two deliveries, zero clobbering.** Had A's write been unfenced it would have overwritten B's lease at `t5` — and if B's publish had then failed, B would have tried to move an already-`dispatched` row to `failed`, a transition §2 does not contain. `OUTBOX_CLAIM_RACE_GAPS = 0`; negative controls `AT-B12OBX-10`, `AT-B12OBX-11`.

> **Invariant O-1.** Window 2's resolution is the reason this design is *at-least-once* and not *exactly-once*: there is no way to atomically commit "published to Redis" and "marked dispatched in PostgreSQL" across two systems. B12 states that plainly rather than pretending a two-phase commit exists.

## 5. Duplicate dispatch is prevented at the consumer, not at the dispatcher

The dispatcher makes duplicates *rare* (lease + `SKIP LOCKED`). The consumer makes them *harmless*. Only the second is a guarantee. Every internal consumer of a B12-dispatched event MUST hold a durable uniqueness constraint keyed on the event envelope's `event_id` — the obligation is stated in `B12_INBOX_MODEL.md` §3 and already satisfied by `automation_inbox_records`'s `(workspace_id, source_event_id)` unique index (`B7_DATA_MODEL.md` §6).

## 6. Retry, backoff, dead-letter

Dispatch failure is an **execution** retry class (`B12_RETRY_BACKOFF_MODEL.md` §2), governed by frozen `BACKEND_RETRY_POLICY.md`'s network/unavailable row (*"yes, 5, dead letter + alert"*). `MAX_DISPATCH_ATTEMPTS = 5` is that frozen figure reused, not a new number. On exhaustion the row becomes `dead_lettered` and a `DeadLetterRecord` is opened (`B12_DEAD_LETTER_REPLAY_MODEL.md` §2).

**A dead-lettered outbox row never loses its payload.** The domain state it announced is untouched and still correct; only its announcement is stuck. This is why outbox dead-lettering is an *operations* incident and not a *data* incident.

## 7. Retention

`dispatched` rows are prunable after a bounded window; `dead_lettered` rows are not pruned while their `DeadLetterRecord` is unresolved. The exact window is `PRODUCT/OPERATIONS DECISION REQUIRED` (`B12-D-B003`) — frozen `BACKEND_DATA_MODEL.md` states webhook receipts are *"append-oriented and are not casually deleted"* but says nothing about outbox retention, so B12 proposes rather than asserts. Nothing in the model breaks at any value; only storage cost and forensic depth move.
