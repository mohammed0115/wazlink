# B12 — Concurrency Model

> Design only. Adversarial by construction: every race the brief's §67–§69 names is traced to a serialization point, not to a hope.

## 1. Primitives — PostgreSQL only for correctness

Per frozen `BACKEND_DATA_GOVERNANCE.md` (*"Database constraints and `transaction.atomic` are preferred before distributed locks"*) and frozen `BACKEND_IDEMPOTENCY_STANDARD.md` (*"UpgradeQuote consumption is protected by PostgreSQL, not by a Redis lock"*):

| Mechanism | Used for |
|---|---|
| `SELECT … FOR UPDATE` | every state transition that must observe a predecessor |
| `FOR UPDATE SKIP LOCKED` | outbox claim, receipt claim, sweep batching |
| Unique / partial-unique constraints | dedup at every layer (`B12_IDEMPOTENCY_MODEL.md` §1) |
| Leases (`lease_owner`, `lease_expires_at`) | crash **detection** for claimed work — tells the *reaper* a claim looks abandoned |
| **Fencing tokens** (`lease_token`, regenerated per claim) | crash **safety** for claimed work — tells a returning *claimant* whether its claim is still authoritative (`B12-D-A055`) |
| `version` + `expected_version` | operator-facing mutations (integration config) |
| **Redis advisory locks** | **shaping only** — never the sole guard for an invariant |

**Fixed lock order**, so deadlock between two B12 paths is structurally impossible: `integration_connections` → `outbox_events` → `worker_executions` → `provider_request_attempts` → `webhook_receipts` → `platform_dead_letters`. Any command taking more than one takes them in this order.

## 2. The ten races (§67)

| Race | Resolution |
|---|---|
| **Two dispatchers claim the same outbox row** | impossible: `FOR UPDATE SKIP LOCKED` gives disjoint sets. The loser sees a different row, not a conflict |
| **A dispatcher's lease expires while it is still alive; another reclaims; the first returns late** | the stale claimant's completion write is a compare-and-set on `(status, lease_owner, lease_token)` and matches **zero rows**. It is discarded, never retried — so the second dispatcher's state is not clobbered and no terminal row is reopened (`B12_OUTBOX_MODEL.md` §3a, crash window 5). This is the case an expiry timestamp alone cannot answer, because a slow process cannot observe its own reaping |
| **Duplicate Celery delivery** | the consumer's durable `(workspace_id, source_event_id)` constraint loses the second insert; nothing else is needed |
| **Two workers execute the same intent** | both lock the domain aggregate; the first commits the transition; the second re-reads inside its lock, sees the precondition already false, and no-ops. Frozen `BACKEND_IDEMPOTENCY_STANDARD.md`: *"Worker execution… checks the target version/state before side effects"* |
| **Webhook arrives during outbound execution** | both take the domain aggregate's row lock. Whichever commits first wins; the second re-evaluates against committed state. The webhook path never writes `provider_request_attempts` and the worker path never writes the receipt, so there is no shared row to corrupt — only the domain row, which is locked |
| **Webhook duplicated** | receipt dedup key (unique index); the second delivery loses the insert before any domain code runs |
| **Reconciliation races a live callback** | the callback wins on **evidence**: reconciliation's first action is a read-only lookup, and it re-reads domain state under a lock before opening or closing a case. A case whose condition is already resolved closes without acting |
| **Operator replay races an automatic retry** | `platform_dead_letters` row lock plus the `state = 'open'` guard: only one may move the record to `replaying` |
| **Provider disabled while work is queued** | admission is re-checked **at execution**, not only at enqueue. A task for a now-disabled provider fails fast without a provider call (`B12_RATE_LIMIT_BACKPRESSURE.md` §4) |
| **Credential rotated during a retry** | the credential reference is resolved **at call time**, so the retry uses the new one automatically. If the old credential was mid-flight, its outcome is `unknown` and §4 governs |
| **Same integration configured concurrently** | `expected_version` on `integration_connections`; the loser gets `409 STALE_VERSION`, matching B8's, B10's and B11's identical choice |

## 3. Quota and budget races (§69)

Distinguish four counters that a naive implementation would merge:

| Counter | Race-safe by |
|---|---|
| Redis abuse limiter | not race-exact, and does not need to be |
| **Durable admission budget** (B3's 10/hour) | `SELECT … FOR UPDATE` on the workspace's admission row; N concurrent retries serialize and the (N+1)th is refused |
| **Durable attempt counter** (`attempt_no`) | incremented inside the same transaction as the state transition; two concurrent retries cannot both increment from 2 to 3 |
| **Provider attempt counter** | a child row per attempt; counting rows is exact by construction |

> Two concurrent `RetryDiscoveryJob` calls on a job at `attempt_no = 2` must produce **one** success and one `409 attempt_limit_reached` — never two attempts at 3. The row lock, not the limiter, is what guarantees it. `AT-B12RL-6`.

## 4. Unknown-outcome concurrency (§68)

The five interleavings the brief demands, each traced:

| # | Interleaving | Outcome |
|---:|---|---|
| 1 | **Provider returns success, worker dies before commit** | the pre-call attempt row exists with no outcome ⇒ `unknown`. Next pass performs a lookup or awaits the callback. **No duplicate**, because a repeat is refused while `unknown` is unresolved (`B12-D-A020`) |
| 2 | **DB records the attempt but the request never left** | also `unknown` — indistinguishable from #1 at write time, and treated identically. The lookup resolves it as "not found at provider," and only then is a fresh attempt safe |
| 3 | **Timeout after the provider accepted** | `unknown`; resolved by lookup or callback. The domain state is unchanged until evidence arrives |
| 4 | **Webhook confirms success before the worker records `unknown`** | the webhook takes the domain row lock and applies the status through the domain command. When the worker then commits `unknown` to `provider_request_attempts`, it is writing a *different table* about a *different question* ("what did our request return?"), so nothing regresses. Reconciliation later closes the attempt as `known_success` on the webhook's evidence |
| 5 | **Reconciliation confirms success while a retry is queued** | the queued retry re-checks the attempt row and the domain precondition under a lock at execution time, observes the settled state, and no-ops without calling the provider |

**The invariant across all five:** the domain aggregate is the only row both paths write, and it is always locked. `provider_request_attempts` is written by exactly one path (the worker) and `webhook_receipts` by exactly one path (the gateway), so those two tables have no cross-path contention at all.

## 5. Redis locks — scope and failure behavior

| Use | TTL | If lost |
|---|---|---|
| single-flight guard on a health check | seconds | a duplicate harmless read-only check |
| sweep-instance guard | minutes | two sweeps run; `SKIP LOCKED` + partial unique indexes make that safe |

Every Redis lock has a durable guard beneath it that is sufficient on its own. Losing every lock key degrades throughput, never correctness (`B12_REDIS_BOUNDARY.md` §5).

## 6. Transaction boundaries

| Boundary | Contents |
|---|---|
| domain command | domain state + `IdempotencyRecord` + `outbox_events` insert — **one** transaction (ADR-005) |
| outbox claim | claim + lease + **fresh `lease_token`** + attempt increment; the **publish happens outside**, and the completion write is a fenced compare-and-set in its own short transaction (§2, `B12-D-A055`) |
| provider call | attempt row committed **before**; the network call outside any transaction; outcome recorded in a short transaction after |
| webhook ingress | receipt insert committed **before** acknowledgement; processing in a later transaction |
| replay | dead-letter transition + the domain command in one transaction where the domain permits it |

**No network call is ever held inside a database transaction.** That rule is what makes the crash windows enumerable (`B12_OUTBOX_MODEL.md` §4) rather than unbounded, and it is why `unknown` must exist as a state.
