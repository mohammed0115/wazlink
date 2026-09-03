# B12 — State Machines

> Design only. `STATE_MACHINE_COUNT = 6`, `STATE_COUNT = 27` (derived in §7). Machine 2 is frozen by B0 and reused verbatim; the other five are B12-owned and additive under `B12-AM-007`.

## 0. Why six and not more

Not every table earns a state machine. `provider_request_attempts` has an `outcome` (a three-valued classification, not a lifecycle) and `integration_health_snapshots` is append-only observation — neither transitions, so neither gets a machine. Forcing them into one would invent transitions that do not exist.

| # | Machine | Question | States |
|---:|---|---|---:|
| 1 | OutboxEvent | has this announcement reached the broker? | 5 |
| 2 | **WebhookReceipt (frozen)** | has this callback been verified and applied? | 6 |
| 3 | WorkerExecution | did this attempt run, and how did it end? | 5 |
| 4 | IntegrationConnection | is this integration's configuration known-good? | 4 |
| 5 | DeadLetterRecord | has this failure been dealt with? | 4 |
| 6 | PlatformReconciliationCase | has this mismatch been dealt with? | 3 |

## 1. OutboxEvent (5)

`pending` · `dispatching` · `dispatched` · `failed` · `dead_lettered`. Transitions and guards: `B12_OUTBOX_MODEL.md` §2. Terminal: `dispatched`, `dead_lettered`. **No transition returns to `pending`** — a redelivery is a new claim of a `failed` row.

## 2. WebhookReceipt (6, frozen)

Frozen `BACKEND_STATE_MACHINES.md` states verbatim: *"WebhookReceipt is `received→verified→queued→processed/failed/duplicate`."* B12 adopts these six names **unchanged** and adds no seventh.

| From | To | Trigger |
|---|---|---|
| `received` | `verified` | signature verification passed |
| `received` | `failed` | verification failed — **terminal; never processed** |
| `verified` | `duplicate` | dedup key already present — terminal |
| `verified` | `queued` | enqueued for processing |
| `queued` | `processed` | the owning domain's command completed (including a legitimate no-effect outcome) |
| `queued` | `failed` | processing exhausted its attempts — dead letter opened |

`processed`, `failed`, `duplicate` are terminal. **The table above is the complete set of legal transitions; there are exactly six, and no seventh exists.**

> **Invariant W-1.** No transition exists from any state into `verified` other than from `received`. A receipt cannot be retroactively "verified" after being recorded invalid, in any command, sweep, replay, or operator action. This is the structural form of `B12-D-A027`.

> **Invariant W-3 (receipt immutability, `B12-D-A050`).** A `WebhookReceipt` is an **immutable record of one provider delivery and the fate of its first processing pass**. No command, sweep, reconciliation repair, operator action, or dead-letter replay moves a receipt out of `processed`, `failed`, or `duplicate` — in particular **there is no `failed → queued` transition**. Reprocessing a failed receipt is a *new execution that references the receipt*, never a rewind of it (`B12_DEAD_LETTER_REPLAY_MODEL.md` §4a). This keeps frozen `BACKEND_STATE_MACHINES.md`'s six states, their fan-out, **and their terminals** literally unchanged, which is why `B12-AM-007` can truthfully classify itself `ADDITIVE`. Negative controls `AT-B12WH-15`, `AT-B12WH-16`.

**What a `failed` receipt does and does not mean.** It means *"this delivery's first processing pass exhausted its attempts."* It does **not** mean the evidence was never applied: a later successful replay applies it through the owning domain's command and is recorded on the `DeadLetterRecord` (`resolved`) and in the domain's own state, never by editing the receipt. Conflating the two would make B12 an authority on business completion, which `B12_OUTBOX_MODEL.md` §1's converse already forbids for the outbox and which applies identically here.

## 3. WorkerExecution (5)

`claimed` · `running` · `succeeded` · `failed` · `dead_lettered`.

| From | To | Trigger |
|---|---|---|
| `claimed` | `running` | worker began; `started_at` set |
| `running` | `succeeded` | task completed |
| `running` | `failed` | task raised, or a soft timeout fired |
| `failed` | `claimed` | retry admitted within the frozen class budget |
| `failed` | `dead_lettered` | budget exhausted; `DeadLetterRecord` opened |

> **Invariant W-2 (the authority firewall).** No transition in this machine reads or writes a **domain** aggregate's state. A `failed` execution does not make a Message failed, a Payment failed, or a Job failed — only the domain's own command can do that. A `running` row with a stale heartbeat becomes reconciliation class `P-3`, which classifies it as **`unknown`**, never as failure. `CELERY_BUSINESS_AUTHORITY_LEAKS = 0`; negative control `AT-B12CEL-7`.

## 4. IntegrationConnection (4)

`not_connected` · `configuration_required` · `connected` · `error`. This machine answers exactly one question — **"is this integration's configuration currently known-good?"** — and nothing else. Whether the operator *wants* it used is the orthogonal `enabled` boolean, not a state (`B12-D-A034`, `B12_PROVIDER_CONFIGURATION_MODEL.md` §4).

| # | From | To | Trigger (command) | Guard |
|---:|---|---|---|---|
| 1 | `not_connected` | `configuration_required` | `ConfigureIntegration` | credentials supplied, incomplete or unchecked |
| 2 | `configuration_required` | `connected` | `CheckIntegrationConfiguration` | safe configuration check passed |
| 3 | `configuration_required` | `error` | `CheckIntegrationConfiguration` | check failed |
| 4 | **`connected`** | **`configuration_required`** | **`ConfigureIntegration`** | **a material configuration change (§4a) invalidates the prior validation** |
| 5 | `connected` | `error` | `CheckIntegrationConfiguration`, or a provider `401`/`403` observed on a real call | credential rejected |
| 6 | `error` | `configuration_required` | `ConfigureIntegration` | credentials re-supplied (rotation) |
| 7 | `error` | `connected` | `CheckIntegrationConfiguration` | re-check passed |

No state is terminal — an integration can always be re-configured. Every transition names the command that triggers it, and every command's effect appears here: `UNTRIGGERED_TRANSITIONS = 0`, `COMMAND_STATE_PRECONDITION_GAPS = 0`.

### 4a. Why `connected → configuration_required` must exist (`B12-D-A051`)

> **A material configuration change invalidates the validation that produced `connected`.** Rotating a working credential is the *ordinary* case, not an error path, and frozen `B5_ADMIN_PROVIDER_RUNBOOK.md` already requires that *"The prior credential reference is invalidated, not merely superseded."* A model in which rotation is reachable only from `error` would force an operator to break an integration before they could rotate it.

A **material** change is one that could alter what the provider accepts: a credential reference, an account/binding identifier (`phone_number_id`, WABA, merchant reference), or a base endpoint. A non-material change — a display label, an operator note — does not move the status. `CheckIntegrationConfiguration` is then required before `connected` is reachable again (transition 2).

**Outbound work while `status ≠ connected`.** New outbound work is admitted only when `status = connected` **and** `enabled = true`; otherwise it fails fast at admission with `409 CONFLICT` · `provider_not_configured` (status) or `provider_disabled` (enabled), and no queue grows (`B12_RATE_LIMIT_BACKPRESSURE.md` §4). In-flight work already past admission continues under the cooperative-checkpoint discipline and resolves its credential reference at call time, so it picks up the rotated credential automatically (`B12_CONCURRENCY_MODEL.md` §2 race 9). **Inbound callbacks are still accepted and receipted** throughout — `B12-D-A028` is unchanged by rotation.

### 4b. Why there is no `disabled` *state* (`B12-D-A052`)

An earlier draft carried a fifth status, `disabled`, reached by "administrative removal". It is **removed**, for a reason worth stating rather than hiding: **nothing reached it.** No command produced it, no API operation produced it, and no actor was named for it — while `DisableIntegration` sets the orthogonal `enabled` boolean and deliberately does *not* touch `status` (`B12-D-A034`). A state that duplicates a boolean and has no producing command is not a state; it is a contradiction waiting for an implementer to resolve arbitrarily.

"Off" is therefore expressed exactly once, as `enabled = false`, which is the orthogonality `B12-D-A034` already argued for. The frontend's own `disabled` presentation label (`FB-B12-002`) renders from that boolean, not from a durable status value. `UNREACHABLE_STATES = 0`.

## 5. DeadLetterRecord (4)

`open` · `replaying` · `resolved` · `abandoned`.

| From | To | Trigger | Guard |
|---|---|---|---|
| `open` | `replaying` | `ReplayDeadLetter` | `replay_eligible = true`; permission; row lock |
| `replaying` | `resolved` | replay succeeded | |
| `replaying` | `open` | replay failed | `replay_count` incremented |
| `open` | `resolved` | the underlying condition resolved (e.g. reconciliation settled it) | |
| `open` | `abandoned` | operator decision | **mandatory reason** |

`resolved` and `abandoned` are terminal.

## 6. PlatformReconciliationCase (3)

`open` · `repaired` · `dismissed` — mirroring `B11`'s and `B9`'s identical three-state case shape, and the frozen *"explicit, permissioned, idempotent, and audited"* repair doctrine. `dismissed` requires a mandatory reason. A case never mutates a domain aggregate by itself (`B12-D-A039`).

## 7. Count derivation

`5 + 6 + 5 + 4 + 4 + 3 = 27`. `STATE_MACHINE_COUNT = 6`, `STATE_COUNT = 27`.

**The count moved from 28 to 27 in B12-FIX.1**, because machine 4's `disabled` status was removed as unreachable (§4b). No state was added anywhere; the frozen `WebhookReceipt` six are untouched.

### 7a. Command ↔ transition cross-check

Every B12-owned machine's transitions are triggered by a named command, and every state-mutating command's effect appears as a transition:

| Machine | Transitions | Triggering commands |
|---|---:|---|
| 1 OutboxEvent | 5 | `DispatchOutboxEvent` (1-4; lease reaping is the same command's sweep path), `OpenDeadLetter` (5) |
| 2 WebhookReceipt (frozen) | 6 | `ReceiveWebhook` (1-4), processing settlement (5-6). `RetryWebhook` triggers **no** transition — it re-enqueues a `queued` receipt in place (§2) |
| 3 WorkerExecution | 5 | worker start (1), execution settlement (2-3), `RetryJob` (4), `OpenDeadLetter` (5). `SubmitJob` creates the row in `claimed` |
| 4 IntegrationConnection | 7 | `ConfigureIntegration` (1, 4, 6), `CheckIntegrationConfiguration` (2, 3, 5, 7) |
| 5 DeadLetterRecord | 5 | `OpenDeadLetter` (creates the row in `open`), **`ReplayDeadLetter` (1, 2, 3)**, reconciliation settlement (4), `AbandonDeadLetter` (5) |
| 6 PlatformReconciliationCase | 2 | `OpenPlatformReconciliationCase` (entry), `ResolvePlatformReconciliationCase` (both) |

Numbered transitions refer to the order of rows in each machine's own table above. Every transition in every normative table has a named trigger in this summary, and every summary attribution matches the normative table it summarizes — checked row by row in B12-FIX.1a after an independent countersign found `ReplayDeadLetter`'s transition 1 omitted here while §5 named it correctly.

`STATE_MACHINE_CONTRADICTIONS = 0` · `COMMAND_STATE_PRECONDITION_GAPS = 0` · `UNREACHABLE_STATES = 0` · `UNTRIGGERED_TRANSITIONS = 0` · `STALE_COUNTERS = 0`. Negative control `AT-B12SM-1`.

## 8. States considered and rejected

| Candidate | Verdict | Reason |
|---|---|---|
| `retrying` on OutboxEvent | rejected | `failed` + `next_attempt_at` already expresses it; a separate state would need its own transition table for zero information gain |
| `paused` on WorkerExecution | rejected | pausing is a **queue/provider** property (`enabled`, backpressure), not a property of one execution |
| `unknown` as a WorkerExecution state | **rejected** | the unknown belongs to the *provider attempt*, not the execution. An execution that ended with an unknown provider outcome still ended — it is `succeeded` or `failed` **as an execution** while the attempt row carries `unknown`. Collapsing them would make "did the worker run?" and "did the provider act?" the same question, which is precisely the confusion `B12_ASYNC_EXECUTION_MODEL.md` §1 separates |
| a state machine on `provider_request_attempts` | rejected | `outcome` is a terminal classification set once, not a lifecycle. It has no legal transitions to enumerate |
| `verified_pending_replay` on WebhookReceipt | rejected | frozen B0 names six states; a seventh would be non-additive drift, and `queued` already covers it |
| a `failed → queued` edge on WebhookReceipt | **rejected (B12-FIX.1)** | it would give a frozen terminal state an outgoing transition. Reprocessing is a **new execution referencing an immutable receipt**, not a rewind (invariant W-3, `B12-D-A050`) |
| `disabled` on IntegrationConnection | **removed (B12-FIX.1)** | unreachable: no command, API, or actor produced it, and it duplicated the orthogonal `enabled = false` (`B12-D-A052`, §4b) |
