# B12 — Dead-Letter & Replay Model

> Design only. Answers the brief's §31 and §32. A Celery failed-task screen is explicitly **not** sufficient.

## 1. Why a durable table and not a Celery result backend

Frozen `BACKEND_RETRY_POLICY.md` requires *"Workers must use timeouts, heartbeats, and dead-letter records"* and, per class, *"dead letter + alert"*. A Celery result backend cannot satisfy this: it lives in Redis (which may not hold durable truth, `B12-D-A014`), it holds an exception string rather than the *intent* that failed, it has no workspace scope, no operator field, no replay eligibility, and no audit trail.

> **`B12-D-A040`. A dead letter is a durable PostgreSQL record of *which committed intent failed to reach the world*, not a record of which task raised an exception.**

## 2. `DeadLetterRecord`

| Field | Why |
|---|---|
| `public_id` | — (operator-internal; no registered prefix, following `payment_attempts`' and `file_reconciliation_cases`' precedent) |
| `workspace_id` | tenancy — every operator view is workspace-scoped |
| `origin_kind` | `outbox_dispatch` \| `worker_execution` \| `webhook_processing` |
| `source_type` / `source_ref` | **opaque** pointer to the owning domain's aggregate — never an FK |
| `owning_domain` | who must be escalated to |
| `failure_class` | the normalized class (`B12_PROVIDER_PORT_ARCHITECTURE.md` §3) |
| `attempt_summary` | counts and timestamps — **not** a transcript |
| `last_error_code`, `last_error_message` | **safe and redacted** |
| `replay_eligible` | §4 — computed, not free text |
| `replay_count`, `replayed_at`, `replay_of` | replay lineage |
| `state` | 4 states, §3 |
| `resolved_by_membership_id`, `resolution_reason` | mandatory on `abandoned` |
| `correlation_id`, `request_id` | traceability |

**Never stored:** a credential, a raw provider response, a webhook body, a full task payload, or customer content. A dead-letter row is read by operators during an incident, which is exactly when the temptation to dump everything is strongest and the risk is highest (`B12_SECURITY_PRIVACY.md` §4).

## 3. Lifecycle

`open → replaying → resolved | abandoned` (machine 5, `B12_STATE_MACHINES.md` §5). `resolved` and `abandoned` are terminal; `abandoned` requires a mandatory reason, matching `B10-D-A016`'s and `B11`'s reason-required posture for privileged state changes.

## 4. Replay eligibility — the safety gate

> **`B12-D-A041`. Replay is not a universal admin superpower. `replay_eligible` is computed from the operation's own idempotency, never assumed.**

| Origin | Eligible? | Why |
|---|---|---|
| `outbox_dispatch` | **yes, always** | re-publishing an event is safe: every consumer holds a durable dedup constraint (`B12_INBOX_MODEL.md` §3) |
| `webhook_processing` | **yes** | re-processing a stored receipt is guarded by the same dedup key and the domain's monotonicity rule. **The receipt itself is never mutated** — §4a |
| `worker_execution`, provider op **idempotent** (e.g. storage delete, a read) | **yes** | the port contract makes a repeat safe |
| `worker_execution`, provider op **non-idempotent**, outcome `known_failure` | **yes** | the world is known not to have the effect |
| `worker_execution`, provider op **non-idempotent**, outcome **`unknown`** | **NO** | replay could send a second message or make a second charge. Must go through `B12_UNKNOWN_OUTCOME_MODEL.md` §3 first |
| any record whose domain budget is exhausted | **NO** | replay must not manufacture a 4th Discovery attempt where `MAX_JOB_ATTEMPTS = 3` |

`REPLAY_SAFETY_GAPS = 0` and `DEAD_LETTER_SAFETY_GAPS = 0` rest on rows 5 and 6; negative controls `AT-B12DLQ-4`, `AT-B12DLQ-5`, `AT-B12DLQ-6`.

### 4a. Replaying a `webhook_processing` dead letter — the receipt is read, never rewritten

> **`B12-D-A050`. A `WebhookReceipt` is immutable once terminal. Replaying its processing creates a *new* `worker_executions` row that **references** the receipt; the receipt's own `status` stays `failed` forever.**

This is the mechanism that replaces the earlier draft's `RetryWebhook` on a `failed` receipt, which would have required a `failed → queued` transition on a **frozen** state machine whose terminals `B12-AM-007` truthfully reports as unchanged.

```
receipt WHR-x : queued --(attempts exhausted)--> failed        [TERMINAL, forever]
                          │
                          └─▶ DeadLetterRecord  origin_kind = webhook_processing
                                                source_type = webhook_receipt
                                                source_ref  = WHR-x
                                     open ──ReplayDeadLetter──▶ replaying
                                                │
                                                ├─ NEW worker_executions row (claimed → running)
                                                ├─ re-reads the receipt's stored normalized_payload
                                                ├─ invokes the OWNING DOMAIN's guarded command
                                                └─ dedup key + domain monotonicity still apply
                                     replaying ──success──▶ resolved
                                     replaying ──failure──▶ open, replay_count +1
```

**What carries the "it was eventually applied" fact.** Not the receipt — the `DeadLetterRecord` reaching `resolved`, plus the domain's own state, which is the only place business truth ever lives (`B12_DOMAIN_FIREWALLS.md` §10). A receipt that reads `failed` next to a settled domain aggregate is not a contradiction; it is the substrate correctly reporting *"this delivery's first processing pass failed"* and declining to claim anything about business completion. The same discipline `B12_OUTBOX_MODEL.md` §1 states for `dispatched` applies here in reverse.

**Why not a second receipt.** A replay is not a second provider delivery, so fabricating a second `webhook_receipts` row would overstate what the provider did and would collide with the `(provider, dedup_key)` unique index. One delivery, one receipt, N executions. `RETRYWEBHOOK_TERMINAL_STATE_CONTRADICTIONS = 0`; negative controls `AT-B12WH-15`, `AT-B12WH-16`, `AT-B12DLQ-9`.

### 4b. What `ReplayDeadLetter` invokes — and what it never invokes

> **`ReplayDeadLetter` invokes the owning domain's own guarded command. It does not invoke `RetryJob`, and it does not invoke `RetryWebhook`.** Both are system-only commands (`B12-D-A053`), and neither could run here even if it were called: at replay time the receipt is terminal `failed` (not `queued`, which `RetryWebhook` requires) and the execution is `dead_lettered` (not `failed`, which `RetryJob` requires, and machine 3 gives `dead_lettered` no outgoing transition).

| `origin_kind` | What replay does | What it must never do |
|---|---|---|
| `outbox_dispatch` | re-publishes the committed `outbox_events` row under a **fresh claim** — new `lease_token`, ordinary dispatch path (`B12_OUTBOX_MODEL.md` §3) | rewrite a `dead_lettered` outbox row's history |
| `webhook_processing` | opens a **new** `worker_executions` row referencing the immutable receipt and re-invokes the owning domain's command (§4a) | move the receipt out of `failed`; fabricate a second `webhook_receipts` row |
| `worker_execution` | re-invokes the **owning domain's** command, which — if its own guards pass — submits fresh work through the ordinary `SubmitJob` path, producing a **new** `worker_executions` row | resurrect the `dead_lettered` execution, or manufacture a `dead_lettered → failed` transition so that `RetryJob`'s precondition becomes reachable |

**The shape is the same in all three rows: replay creates new execution evidence and never rewrites historical evidence.** That is what keeps `worker_executions`, `webhook_receipts`, and `outbox_events` honest as an audit trail — a row records what happened on *that* attempt, not the eventual outcome of the intent, which is the domain's to state (`B12_DOMAIN_FIREWALLS.md` §10). Negative controls `AT-B12WH-16`, `AT-B12API-8`, `AT-B12DLQ-10`.

## 5. What a replay must respect

A replay is an ordinary command with an operator actor, and it re-checks **everything**:

1. **Current domain state** — an intent superseded or cancelled since the failure is not replayed; the domain command refuses it.
2. **Idempotency** — a fresh `Idempotency-Key`, plus the `replay_of` link so replay-of-replay is itself deduplicated (the mechanism frozen `B7`'s `ReplayAutomationExecution` already uses).
3. **Frozen attempt budgets** — `B12-D-A038`; a replay never resets or exceeds one.
4. **Entitlements** — a replay does not bypass B8; if the workspace's quota is now exhausted, the replay fails the way an ordinary command would.
5. **Tenant authorization** — the operator must hold the permission **in that workspace**. There is no cross-workspace replay (`B12_RBAC_TENANCY.md` §4).
6. **Provider enablement** — a replay against a disabled provider fails fast, exactly like new work.

## 6. Automatic versus manual

| | Automatic | Manual |
|---|---|---|
| Trigger | attempt budget exhausted | operator judgement |
| Creates | the record | nothing — acts on an existing record |
| Permission | none (system) | `platform.operations.replay` |
| Surface | none — internal | `POST /operations/dead-letters/{id}/replay` · `POST /operations/dead-letters/{id}/abandon` |
| Audit actor | `system:platform` | the membership |

There is **no** automatic replay. A record enters `open` automatically and leaves it only by a human decision or by reconciliation resolving the underlying condition. Auto-replaying a dead letter would re-run exactly the work that already exhausted its budget, which is either futile or dangerous.

## 7. Escalation

A dead letter names its `owning_domain` because platform operations frequently cannot resolve it: a payment dead letter is a Billing decision, a message dead letter is a Messaging decision. B12 provides the record and the safe replay mechanism; the domain decides whether replay is the right business answer.
