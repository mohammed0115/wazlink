# B12 — Command & Event Catalog

> Design only. `COMMAND_COUNT = 15`, `PRODUCED_EVENT_COUNT = 10`, `CONSUMED_EVENT_COUNT = 0`. Frozen names are reused verbatim; every addition is registered under `B12-AM-001`.

## 1. Commands

| Command | Aggregate | Actor | Permission | Idempotency | Precondition | Effect | Events |
|---|---|---|---|---|---|---|---|
| `SubmitJob` **(frozen name)** | WorkerExecution | system | n/a — not an API surface | the source aggregate's own identity | a committed domain intent exists | `worker_executions` row `claimed`; task published | — |
| `RetryJob` **(frozen name)** | WorkerExecution | **system only** | n/a — **not an API surface, and no operator path exists** (`B12-D-A053`) | `(source_ref, effect_type, attempt_no)` | execution `failed`; transport budget remaining; **domain budget not exhausted** | new attempt `claimed` (machine 3 transition 4) | — |
| `ReceiveWebhook` **(frozen name)** | WebhookReceipt | provider (unauthenticated until verified) | n/a — signature **is** the authentication | `(provider, dedup_key)` unique | route resolves; size/type gates pass | receipt `received`→`verified`\|`failed`; `duplicate` on replay | `WebhookProcessed` (on `processed`) |
| `RetryWebhook` **(frozen name)** | WebhookReceipt | **system only** | n/a — **not an API surface, and no operator path exists** (`B12-D-A053`) | receipt identity + `attempt_count` | receipt status **`queued`** and `verification_state = verified`. **Never `failed`** — a failed receipt is terminal (`B12_STATE_MACHINES.md` invariant W-3) and is not recoverable through this command at all | re-enqueued for processing **in place**; `attempt_count` +1. **No state transition occurs** — the receipt is already `queued` and stays `queued` | `WebhookProcessed` (only if the re-enqueued pass reaches `processed`) |
| `DispatchOutboxEvent` | OutboxEvent | system | n/a | `event_id` + lease | `pending`/`failed`; `next_attempt_at` due | `dispatching`→`dispatched`\|`failed` | — |
| `RecordProviderAttempt` | (child of WorkerExecution) | system | n/a | `(source_type, source_ref, effect_type)` | an integration is `connected` and `enabled` | attempt row **committed before the call**; outcome after | — |
| `ConfigureIntegration` | IntegrationConnection | admin | `integration.manage` (**frozen**) | header key + `expected_version` | scope matches actor authority | credential **refs** stored; `status → configuration_required` | `IntegrationConfigured` |
| `CheckIntegrationConfiguration` | IntegrationConnection | admin | `integration.manage` | header key | credentials present | **safe** check; `status`/health updated | `IntegrationHealthChanged` |
| `EnableIntegration` | IntegrationConnection | admin | `integration.manage` | `expected_version` | `status = connected` | `enabled = true` | `IntegrationEnabled` |
| `DisableIntegration` | IntegrationConnection | admin | `integration.manage` | `expected_version` | `enabled = true` | `enabled = false`; **inbound webhooks still accepted** | `IntegrationDisabled` |
| `OpenDeadLetter` | DeadLetterRecord | system | n/a | `(origin_kind, source_ref, failure_class)` while `open` | an attempt budget was exhausted | record `open`; alert | `WorkDeadLettered` |
| `ReplayDeadLetter` | DeadLetterRecord | operator | `platform.operations.replay` | fresh header key + `replay_of` | `open`; **`replay_eligible = true`**; domain budget remaining; provider enabled | `replaying`; the **domain's own** command is invoked | `DeadLetterReplayed` |
| `AbandonDeadLetter` | DeadLetterRecord | operator | `platform.operations.replay` | `expected_version` | `open`; **mandatory reason** | `abandoned` | — |
| `OpenPlatformReconciliationCase` | PlatformReconciliationCase | system | n/a | `(fingerprint, mismatch_class)` while `open` | a mismatch was detected | case opened or joined | `PlatformReconciliationCaseOpened` |
| `ResolvePlatformReconciliationCase` | PlatformReconciliationCase | operator | `platform.operations.replay` | `(workspace_id, resolution_idempotency_key)` | `open`; reason present for `dismissed` | `repaired`\|`dismissed`; any repair runs as the **domain's** command | — |

`COMMAND_COUNT = 15`, counted as the rows above.

## 1a. Invocation surface — every command has exactly one owner

The brief's §14 rule: **no command may exist without an invocation owner.** Each of the fifteen is classified below; `UNOWNED_COMMANDS = 0`.

| Command | Surface class | Owner |
|---|---|---|
| `SubmitJob` | **system** | the outbox dispatcher and each domain's application service |
| `RetryJob` | **system only** | the transport retry path — a worker re-admitting its own `failed` execution within the frozen class budget. **No operator path of any kind** (`B12-D-A053`) |
| `ReceiveWebhook` | **internal webhook route** | `POST /webhooks/{provider}` (`B12_API_DTO_CONTRACTS.md` §2) — outside the user-facing catalog by frozen rule |
| `RetryWebhook` | **system only** | the `P-4` receipt sweep, which re-enqueues receipts stuck in `queued`. **No operator path of any kind** (`B12-D-A053`) |
| `DispatchOutboxEvent` | **system** | the outbox dispatch sweep |
| `RecordProviderAttempt` | **system** | the provider adapter layer |
| `ConfigureIntegration` | **workspace admin API** | `PUT /integrations/{id}/configuration` (op 3) |
| `CheckIntegrationConfiguration` | **workspace admin API** | `POST /integrations/{id}/configuration/check` (op 4) |
| `EnableIntegration` | **workspace admin API** | `POST /integrations/{id}/enable` (op 5) |
| `DisableIntegration` | **workspace admin API** | `POST /integrations/{id}/disable` (op 6) |
| `OpenDeadLetter` | **system** | the attempt-budget exhaustion path |
| `ReplayDeadLetter` | **operator API** | `POST /operations/dead-letters/{id}/replay` (op 9) |
| `AbandonDeadLetter` | **operator API** | `POST /operations/dead-letters/{id}/abandon` (op 10) — **added in B12-FIX.1** |
| `OpenPlatformReconciliationCase` | **system** | the reconciliation sweeps |
| `ResolvePlatformReconciliationCase` | **operator API** | `POST /operations/reconciliation-cases/{id}/resolve` (op 14) — **added in B12-FIX.1** |

> **`B12-D-A053`. `RetryJob` and `RetryWebhook` are SYSTEM-ONLY. They have no public API, no operator API, no CLI path, and no human replay path — not a standalone endpoint, and not an operator path reached through any other command.**

**Why this is stated as an absolute rather than as "no standalone endpoint" (corrected in B12-FIX.1a).** An earlier wording claimed their operator paths ran *"only inside `ReplayDeadLetter`"*. That claim was **unreachable**, and an independent countersign proved it from the preconditions:

| Command | Its precondition | State at dead-letter replay time | Reachable? |
|---|---|---|:--:|
| `RetryWebhook` | receipt `queued` | a `webhook_processing` dead letter exists **only because** the receipt already went `queued → failed`, and `failed` is terminal (invariant W-3) | **no** |
| `RetryJob` | execution `failed` | a `worker_execution` dead letter is opened on `failed → dead_lettered`, and machine 3 gives `dead_lettered` **no outgoing transition** | **no** |

`ReplayDeadLetter` therefore **does not and must not invoke either command** (`B12_DEAD_LETTER_REPLAY_MODEL.md` §4b). Its effect is what its own row states — it invokes the **owning domain's** guarded command, and for a webhook it opens a *new* `worker_executions` row referencing the immutable receipt.

**Nothing is orphaned and nothing is loosened.** Both commands keep the real, reachable system invocations named in the table above, under their existing preconditions, which are **not relaxed**. Removing the phantom operator path removes a claim, not a capability: there was never an executable path to delete. The safety property is unchanged and is now stated without a false premise — **every human-initiated re-execution in this pack goes through `ReplayDeadLetter`, and there is no other human path to a provider effect.** A "retry this task" button would be a second, unguarded route to the same effect, precisely the override `B12-D-A020` forbids.

`UNOWNED_COMMANDS = 0` (both have system owners) · `UNOWNED_OPERATOR_SURFACES = 0` (neither claims one) · `COMMAND_EVENT_CONTRACT_GAPS = 0`. Negative controls `AT-B12API-6`, `AT-B12API-8`.

**Frozen-name compliance.** `BACKEND_DOMAIN_OWNERSHIP.md` names four platform commands — `ReceiveWebhook`, `RetryWebhook` (Webhooks row) and `SubmitJob`, `RetryJob` (Jobs row). All four appear above **unchanged**. The other eleven are additive under `B12-AM-001`, following the precedent by which B10 added nine commands to the frozen `SubmitTaxInvoice` and B11 added ten to `CreateUpload`/`DeleteAsset`.

## 2. Produced events

| Event | Payload (safe fields only) | Emitted when |
|---|---|---|
| `WebhookProcessed` **(frozen name)** | `receipt_ref` (`WHR-*`), `provider`, `workspace_ref`, `outcome`, `occurred_at` | a verified receipt reaches `processed` |
| `JobSucceeded` **(frozen name)** | `execution_ref`, `workspace_ref`, `task_kind`, `source_ref`, `latency_ms`, `occurred_at` | a `worker_executions` row reaches `succeeded` |
| `JobFailed` **(frozen name)** | `execution_ref`, `workspace_ref`, `task_kind`, `source_ref`, `failure_class`, `occurred_at` | reaches `failed` |
| `IntegrationConfigured` | `integration_ref` (`INT-*`), `workspace_ref`, `provider`, `configured_by_ref`, `occurred_at` | credentials stored |
| `IntegrationEnabled` | `integration_ref`, `workspace_ref`, `provider`, `occurred_at` | `enabled → true` |
| `IntegrationDisabled` | `integration_ref`, `workspace_ref`, `provider`, `reason_code`, `occurred_at` | `enabled → false` |
| `IntegrationHealthChanged` | `integration_ref`, `workspace_ref`, `provider`, `status`, `credential_valid`, `degraded`, `occurred_at` | a health fact flipped |
| `WorkDeadLettered` | `dead_letter_ref`, `workspace_ref`, `owning_domain`, `origin_kind`, `failure_class`, `occurred_at` | a record is opened |
| `DeadLetterReplayed` | `dead_letter_ref`, `workspace_ref`, `replayed_by_ref`, `outcome`, `occurred_at` | replay concluded |
| `PlatformReconciliationCaseOpened` | `case_ref`, `workspace_ref` (nullable), `mismatch_class`, `occurred_at` | a case is opened |

`PRODUCED_EVENT_COUNT = 10`.

**No payload ever carries** a credential, a provider URL or host, a raw provider response, a webhook body or signature, customer content, or a full domain aggregate. Every `*_ref` is a public ID or an opaque internal reference — never a provider object ID used as a WazLink identity.

> **These ten events describe the *substrate*, not the domains it serves.** There is no `PaymentSucceeded`, `MessageSent`, or `FileUploaded` in this list — those are their domains' events, which B12 *transports* through `outbox_events` without ever authoring or re-emitting them. Negative control `AT-B12FW-9`.

## 3. Events considered and rejected

| Candidate | Verdict | Reason |
|---|---|---|
| `OutboxEventDispatched` | **rejected** | it would put an event on the bus for every event on the bus — unbounded self-reference and no consumer. Dispatch is a metric and a log line, not a domain fact |
| `ProviderRequestAttempted` | **rejected** | one per provider call would double the platform's event volume for telemetry that `B12_OBSERVABILITY_HANDOFF.md` already carries as metrics |
| `WebhookReceived` | **rejected** | a receipt is not yet a fact about the world; `WebhookProcessed` (frozen) is the point at which something became true. Emitting on receipt would announce forgeries |
| `IntegrationDegraded` | **rejected** | a duplicate of `IntegrationHealthChanged` with a narrower trigger; degradation is a field on that event |
| `TaskRetried` | **rejected** | transport retries are the substrate's own bookkeeping. Publishing them would let a consumer build business logic on a counter B12 explicitly says is not a business budget (`B12-D-A003`) |

## 4. Consumed events

**`CONSUMED_EVENT_COUNT = 0`.**

B12 **dispatches** every domain's events and **consumes** none. The distinction is exact and load-bearing: dispatching reads an `outbox_events` row and publishes it to a broker without interpreting its `payload`; consuming would mean acting on its meaning. B12 never branches on an event's `event_type` to decide a business outcome — the type is a routing key, and the consumer is always the owning domain.

Two candidate consumptions were considered and are genuinely unnecessary:

- **"A workspace was archived, so disable its integrations."** Frozen B1 owns workspace archival and defines no cascade; inventing one would be B12 asserting a lifecycle decision over another domain's aggregate.
- **"A payment succeeded, so mark the integration healthy."** Health is derived from `provider_request_attempts`, which B12 already owns directly. Consuming a business event to infer transport health would couple the substrate to its passengers' semantics for no gain.

Declaring zero rather than manufacturing a consumer matches the posture B9 and B11 both held.

## 5. Audit actions

Per frozen `B1_AUTHORIZATION_RBAC.md` §2's namespace rule (permissions are `<resource>.<imperative>`, audit actions are `<resource>.<past participle>`, and no string is valid in both):

`integration.configured`, `integration.checked`, `integration.enabled`, `integration.disabled`, `integration.credential_rotated`, `platform.dead_lettered`, `platform.replayed`, `platform.abandoned`, `platform.reconciliation_opened`, `platform.reconciliation_resolved`, `webhook.rejected`.

`webhook.rejected` is an **audit entry, not an event** — a forged callback is a security observation, and putting one on the event bus per rejection would let an attacker generate unbounded bus traffic. It carries `request_id`, provider, outcome class, and the resolved binding where one exists, and **never** the body, the signature, or the secret.
