# B12 — Acceptance Test Matrix

> Design only. Tests are **contracts, not implementation**. Every Class A decision cites at least one ID below. Prior phases' own tests (`AT-MEDIA-*`, `AT-RETRY-*`, `AT-IDEM-*`, …) test their side of a boundary and are **not** duplicated; B12's symmetric checks are distinctly prefixed so no ID collides.

## 1. Full test list

| Test ID | Category | Pos/Neg | Assertion |
|---|---|---|---|
| `AT-B12ASY-1` | Async model | positive | A committed command writes domain state, `IdempotencyRecord`, and the outbox row in **one** transaction; a rollback leaves none of the three |
| `AT-B12ASY-2` | Async model | negative | No layer's identity is reused as another's: a Celery task id never appears as a domain reference, and an outbox `event_id` never appears as a business identity |
| `AT-B12ASY-3` | Async model | positive | Losing every broker message loses no committed intent — after a flush, the sweep re-dispatches and every domain effect eventually occurs exactly once |
| `AT-B12ASY-4` | Async model | negative | No provider call is issued from inside an open database transaction |
| `AT-B12ASY-5` | Async model | negative | No document, DTO, or comment claims exactly-once delivery; the guarantee is stated as at-least-once with destination-side dedup |
| `AT-B12OBX-1` | Outbox | positive | The outbox row and its domain state commit atomically; a crash between them is impossible by construction |
| `AT-B12OBX-2` | Outbox | positive | Publish failure leaves the row `failed` with `next_attempt_at` set; the intent survives |
| `AT-B12OBX-3` | Outbox | positive | Two concurrent dispatchers claim **disjoint** row sets via `FOR UPDATE SKIP LOCKED`; neither blocks nor duplicates |
| `AT-B12OBX-4` | Outbox | positive | A dispatcher crash after publish leaves an expired lease; the reaper returns it to `failed` and re-publishes |
| `AT-B12OBX-5` | Outbox | positive | Re-publish causes duplicate delivery, and the consumer's constraint absorbs it with zero duplicate effect |
| `AT-B12OBX-6` | Outbox | positive | Dispatch attempts are bounded by the frozen 5; exhaustion yields `dead_lettered` + a `DeadLetterRecord` |
| `AT-B12OBX-7` | Outbox | negative | No transition returns a row from `dispatched` or `dead_lettered` to `pending` |
| `AT-B12OBX-8` | Outbox | negative | A dead-lettered outbox row never alters the domain state it announced |
| `AT-B12OBX-9` | Outbox | negative | **No code path creates an outbox row outside the transaction that created the state it announces** |
| `AT-B12OBX-10` | Outbox | negative | **A dispatcher whose lease expired while it was still alive cannot complete**: its fenced update on `(status, lease_owner, lease_token)` matches zero rows, is discarded, and never overwrites the reclaiming dispatcher's state |
| `AT-B12OBX-11` | Outbox | positive | `lease_token` is regenerated on **every** claim, including a re-claim of the same row, so a token proves one specific claim rather than the row's identity |
| `AT-B12INB-1` | Inbox | positive | External callbacks land in `webhook_receipts`; internal events land in the **consuming domain's** own inbox table |
| `AT-B12INB-2` | Inbox | positive | A duplicate internal event loses the consumer's unique insert and produces a silent no-op |
| `AT-B12INB-3` | Inbox | negative | An internal consumer relying on an application-level "have I seen this?" read instead of a DB constraint — fails |
| `AT-B12INB-4` | Inbox | negative | B12 owns no central internal-inbox table; no B12 table dedups another domain's event consumption |
| `AT-B12INB-5` | Inbox | positive | Consumption and the dedup insert commit in one transaction; a crash between them cannot occur |
| `AT-B12CEL-1` | Celery | positive | A worker re-reads authoritative state from PostgreSQL before acting; it never trusts the payload's snapshot |
| `AT-B12CEL-2` | Celery | positive | A task whose state was cancelled between publish and execution no-ops without a provider call |
| `AT-B12CEL-3` | Celery | positive | Acknowledgement is late: a crash mid-task redelivers rather than dropping |
| `AT-B12CEL-4` | Celery | negative | **No task payload contains a secret, a credential, a full domain aggregate, a webhook body, or PII beyond an identifier** |
| `AT-B12CEL-5` | Celery | positive | Every task has a soft and a hard limit; a soft timeout records `unknown` and exits cleanly |
| `AT-B12CEL-6` | Celery | negative | A Celery task id is never persisted or returned as a WazLink identity |
| `AT-B12CEL-7` | Celery | negative | **No `worker_executions` transition reads or writes a domain aggregate's state** |
| `AT-B12QUE-1` | Queue topology | positive | Five queues exist, and each carries only its declared workload class |
| `AT-B12QUE-2` | Queue topology | positive | A provider quota exhaustion on `providers.slow` does not delay `providers.fast` or `webhooks` |
| `AT-B12QUE-3` | Queue topology | positive | A `maintenance` backlog never displaces user-visible work |
| `AT-B12QUE-4` | Queue topology | negative | No second broker, exchange topology, dead-letter *exchange*, or streaming platform is introduced |
| `AT-B12RDS-1` | Redis boundary | negative | **No committed intent, payment/message/entitlement/revenue state, receipt, dead letter, reconciliation case, business budget, or credential exists only in Redis** |
| `AT-B12RDS-2` | Redis boundary | positive | After a full Redis flush, the system recovers from PostgreSQL with zero lost intents and zero incorrect business state |
| `AT-B12RDS-3` | Redis boundary | positive | Losing every Redis lock key degrades throughput only; every invariant still holds on a row lock or unique constraint |
| `AT-B12RDS-4` | Redis boundary | negative | No Redis lock is the sole correctness mechanism for any durable business invariant |
| `AT-B12RDS-5` | Redis boundary | negative | A Redis flush does not refund, reset, or widen any domain budget |
| `AT-B12IDM-1` | Idempotency | positive | Nine classes exist; each layer of the async model maps to exactly one, with a named non-Redis store |
| `AT-B12IDM-2` | Idempotency | positive | Same `Idempotency-Key` + body replays the stored terminal response (frozen class 1) |
| `AT-B12IDM-3` | Idempotency | negative | Same `Idempotency-Key`, different body → `409 IDEMPOTENCY_CONFLICT` |
| `AT-B12IDM-4` | Idempotency | negative | A client `Idempotency-Key` is never reused as a provider request key or a webhook dedup key |
| `AT-B12IDM-5` | Idempotency | positive | Removing any one of the nine classes reproduces a concrete duplicate effect — each class is load-bearing |
| `AT-B12IDM-6` | Idempotency | positive | Webhook dedup is `(provider, dedup_key)` unique, with `payload_hash` separately indexed (frozen constraint) |
| `AT-B12IDM-7` | Idempotency | negative | Same dedup key with a **different** payload hash is not treated as a duplicate; application is withheld and a case opened |
| `AT-B12IDM-8` | Idempotency | positive | Every class resolves concurrency with a database primitive, never a Redis lock |
| `AT-B12IDM-9` | Idempotency | positive | An operator replay carries a fresh key **and** a `replay_of` link, so replay-of-replay is itself deduplicated |
| `AT-B12RTY-1` | Retry | positive | Six retry counters exist with exactly one owner each |
| `AT-B12RTY-2` | Retry | positive | The frozen nine-class table is applied unchanged; a validation or authorization failure is retried **zero** times |
| `AT-B12RTY-3` | Retry | positive | Backoff is `base·2^(n-1)` with **full jitter**, capped at 15m ordinary / 60m reconciliation |
| `AT-B12RTY-4` | Retry | positive | A provider `Retry-After` longer than the computed backoff wins and is never shortened by jitter |
| `AT-B12RTY-5` | Retry | negative | **Transport retry never increments, resets, or consumes a domain attempt counter or admission slot** |
| `AT-B12RTY-6` | Retry | positive | `effective_attempts = MIN(frozen_class_max, domain_budget_remaining)` — the smaller always wins |
| `AT-B12RTY-7` | Retry | negative | A Celery retry counter is never read as a business budget |
| `AT-B12RTY-8` | Retry | negative | **B4's frozen ceiling wins over B0's larger generic one**: an AI run never exceeds `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` (2 logical calls × 3 = 6 provider call attempts), and neither a transport retry nor a worker-level execution retry may push it past that |
| `AT-B12UNK-1` | Unknown outcome | positive | Three outcomes exist; `unknown` is durable and recorded, never coerced |
| `AT-B12UNK-2` | Unknown outcome | negative | An unknown outcome is never defaulted to success or to failure |
| `AT-B12UNK-3` | Unknown outcome | negative | **A non-idempotent operation with an unresolved `unknown` outcome is never retried — no flag, permission, or configuration permits it** |
| `AT-B12UNK-4` | Unknown outcome | positive | The `provider_request_attempts` row is committed **before** the provider call |
| `AT-B12UNK-5` | Unknown outcome | positive | The three post-crash readings (no row / row without outcome / row with terminal outcome) are unambiguous and drive different actions |
| `AT-B12UNK-6` | Unknown outcome | positive | The first action on an unknown is a **read-only** lookup or an awaited callback, never a mutating repeat |
| `AT-B12UNK-7` | Unknown outcome | negative | An operator cannot resolve an unknown into a business state change without the domain's own command and provider evidence |
| `AT-B12HTTP-1` | HTTP policy | positive | Resolution order is `Retry-After` → frozen row → deployment override → platform default |
| `AT-B12HTTP-2` | HTTP policy | negative | A deployment override never widens a frozen timeout |
| `AT-B12HTTP-3` | HTTP policy | positive | Every outbound call has a finite deadline; no adapter can disable a timeout |
| `AT-B12HTTP-4` | HTTP policy | positive | `401`/`403` is `permanent`, retried zero times, and flips `credential_valid` |
| `AT-B12HTTP-5` | HTTP policy | negative | **A connect timeout and a read timeout are classified differently** — the first is retryable, the second is `unknown` |
| `AT-B12HTTP-6` | HTTP policy | negative | TLS verification cannot be disabled by any configuration in this pack |
| `AT-B12PRV-1` | Provider port | negative | No universal provider interface exists; no adapter is forced into another's signature |
| `AT-B12PRV-2` | Provider port | negative | **No design element depends on a provider idempotency key**; every capability marked `unknown` is treated as absent |
| `AT-B12PRV-3` | Provider port | positive | Every provider outcome maps to exactly one of four classes before crossing the boundary |
| `AT-B12PRV-4` | Provider port | negative | An unrecognized provider status maps to `unknown`, never optimistically to success |
| `AT-B12PRV-5` | Provider port | negative | A capability is never promoted from `unknown` to `supported`/`not_supported` without a register entry |
| `AT-B12PRV-6` | Provider port | negative | No bucket, region, endpoint, host, token, or raw provider body crosses the port boundary |
| `AT-B12WH-1` | Webhook gateway | positive | The pipeline order is route → gate → raw read → verify → resolve → receipt → dedup → ack → enqueue → normalize → apply |
| `AT-B12WH-2` | Webhook security | negative | **Nothing is parsed, enqueued, or applied before verification succeeds; a failed verification is recorded and never marked processed** |
| `AT-B12WH-3` | Webhook security | positive | Meta verifies HMAC-SHA256 over the payload under `X-Hub-Signature-256`; **Tap verifies over its documented field concatenation under `hashstring`** — one universal verifier fails at least one provider |
| `AT-B12WH-4` | Webhook security | negative | **No `workspace_id`, or any authorization-relevant field, is read from a webhook body and trusted** |
| `AT-B12WH-5` | Webhook security | negative | A payload signed with binding Y's secret claiming binding X's identifier never resolves to X's workspace |
| `AT-B12WH-6` | Webhook dedup | positive | A duplicate delivery is `200`, marked `duplicate`, with zero domain work |
| `AT-B12WH-7` | Webhook dedup | negative | A duplicate provider callback never produces a second business effect, whichever layer catches it |
| `AT-B12WH-8` | Webhook dedup | negative | **B12 never invents a provider event ID**; a provider without one uses the authenticated object/status/timestamp tuple |
| `AT-B12WH-9` | Webhook gateway | positive | **A disabled provider's inbound callbacks are still accepted and receipted**; only outbound work stops |
| `AT-B12WH-10` | Webhook ordering | positive | A late `delivered` arriving after `read` is absorbed by the domain's monotonicity rule with no regression |
| `AT-B12WH-11` | Webhook ordering | negative | **B12 never forces a domain state regression**; a normalized event that would move a domain backwards is refused by the domain and recorded as a no-effect `processed` |
| `AT-B12WH-12` | Webhook security | negative | Size, content-type, and rate gates run **before** HMAC computation |
| `AT-B12WH-13` | Webhook gateway | positive | Malformed and unrecognized-event payloads return `200` with zero domain effect |
| `AT-B12WH-14` | Webhook security | positive | A receipt resolving to zero or multiple bindings is quarantined with `workspace_id` NULL and a case, never guessed |
| `AT-B12WH-15` | Webhook gateway | negative | **A `failed` `WebhookReceipt` is terminal**: no command, sweep, reconciliation repair, operator action, or dead-letter replay moves it to `queued` or any other state |
| `AT-B12WH-16` | Webhook gateway | positive | Replaying a `webhook_processing` dead letter creates a **new** `worker_executions` row referencing the receipt; the receipt's `status` stays `failed` and the "eventually applied" fact is carried by the `DeadLetterRecord` reaching `resolved` plus the domain's own state |
| `AT-B12WH-17` | Webhook security | negative | **A validly-signed callback carrying another workspace's provider object cannot poison the rightful binding's dedup identity**: it is bound to the *signing* workspace, its domain application is refused (`P-5`), and the rightful workspace's later genuine callback is processed normally rather than swallowed as a duplicate |
| `AT-B12WH-18` | Webhook dedup | positive | `dedup_key` is prefixed by the verifying binding, and a genuine provider redelivery under the **same** binding still dedups exactly as before — the prefix narrows the identity, never widens it |
| `AT-B12REC-1` | Reconciliation | positive | Eight platform classes exist; five are report-only or operator-gated |
| `AT-B12REC-2` | Reconciliation | positive | **A payment whose Tap callback was lost past its three attempts is settled by `retrieve_charge`**, not by inference from the callback's absence |
| `AT-B12REC-3` | Reconciliation | positive | One open case per real problem — the partial unique index holds across repeated scans |
| `AT-B12REC-4` | Reconciliation | positive | A `dismissed` case carries a mandatory reason |
| `AT-B12REC-5` | Reconciliation | negative | **A reconciliation repair never writes a domain table; it invokes the domain's own command, and a refusal leaves the case open** |
| `AT-B12REC-6` | Reconciliation | negative | B12 does not absorb, reassign, or alter any of the eight frozen domain reconciliation processes |
| `AT-B12REC-7` | Reconciliation | positive | A scan crash resumes from its cursor rather than restarting |
| `AT-B12REC-8` | Reconciliation | positive | **Two global cases with NULL `workspace_id` still collide**: the open-case identity is `(fingerprint, mismatch_class)` with both columns `NOT NULL`, so a repeating `P-5`/`P-7` condition opens one case, not one per 15-minute sweep |
| `AT-B12REC-9` | Reconciliation | negative | **`ResolvePlatformReconciliationCase` is invocable only through `POST /operations/reconciliation-cases/{id}/resolve`** and only with `platform.operations.replay`: a caller holding merely `platform.operations.view` is denied `403`; a caller in another workspace gets `404`; only a case in `open` may be resolved and an already `repaired`/`dismissed` case is refused rather than re-mutated; `dismissed` requires a non-empty reason; the resolution obeys the command's `(workspace_id, resolution_idempotency_key)` contract so a repeated call replays rather than double-resolves; a platform-scope case with NULL `workspace_id` is resolvable only by a platform operator; and a `repaired` resolution mutates **no** domain table itself — it invokes the owning domain's guarded command, whose refusal correctly leaves the case `open` |
| `AT-B12DLQ-1` | Dead letter | positive | A dead letter is a durable PostgreSQL row with workspace, owning domain, failure class, and audit fields |
| `AT-B12DLQ-2` | Dead letter | negative | A Celery result backend is never treated as the dead-letter record |
| `AT-B12DLQ-3` | Dead letter | negative | A dead-letter DTO contains no raw payload, provider response, or credential |
| `AT-B12DLQ-4` | Replay | negative | **A non-idempotent operation with an `unknown` outcome is `replay_eligible = false`** and returns `409 dead_letter_not_replayable` |
| `AT-B12DLQ-5` | Replay | negative | A replay that would exceed a frozen domain budget is refused |
| `AT-B12DLQ-6` | Replay | negative | **No automatic replay exists**; a record leaves `open` only by human decision or by the underlying condition resolving |
| `AT-B12DLQ-7` | Replay | positive | A replay re-checks current domain state, idempotency, budgets, entitlements, tenancy, and provider enablement |
| `AT-B12DLQ-8` | Replay | positive | `abandoned` requires a mandatory reason |
| `AT-B12DLQ-9` | Replay | positive | `AbandonDeadLetter` is reachable **only** through `POST /operations/dead-letters/{id}/abandon` under `platform.operations.replay`, requires a non-empty reason, and is terminal |
| `AT-B12DLQ-10` | Replay | positive | Replay creates **new** execution evidence and never rewrites historical evidence, for all three `origin_kind` values: a fresh outbox claim, a new `worker_executions` row referencing an immutable receipt, or fresh domain-submitted work |
| `AT-B12RL-1` | Rate limits | positive | Six limiting layers exist with the declared keys and stores |
| `AT-B12RL-2` | Rate limits | positive | The frozen eight rate-limit rows are unchanged; exactly one row is added |
| `AT-B12RL-3` | Rate limits | positive | Webhook ingress is limited **before** signature verification |
| `AT-B12RL-4` | Rate limits | negative | **A durable domain budget is never enforced in Redis alone** |
| `AT-B12RL-5` | Rate limits | negative | A Redis flush never grants a workspace a free provider-cost retry |
| `AT-B12RL-6` | Rate limits | positive | **Two concurrent retries on a job at `attempt_no = 2` yield one success and one `409 attempt_limit_reached`** — never two attempts at 3 |
| `AT-B12RL-7` | Rate limits | negative | No worker, backpressure release, or replay causes a frozen budget to be exceeded |
| `AT-B12RL-8` | Rate limits | positive | Per-workspace accounting on a **shared global** credential prevents one tenant exhausting another's share |
| `AT-B12CFG-1` | Configuration | positive | The four-step flow (credentials → check → connected → enable) is four distinct permissioned, audited commands |
| `AT-B12CFG-2` | Configuration | positive | `status` and `enabled` are independent; "valid but paused" and "wanted but expired" are both representable |
| `AT-B12CFG-3` | Configuration | positive | Disabling fails new outbound work fast with `409 provider_disabled` and does not grow a queue |
| `AT-B12CFG-4` | Configuration | negative | **A configuration check never sends a message, creates a charge, uploads an object, or spends a business quota** |
| `AT-B12CFG-5` | Configuration | positive | Where no safe check exists, the result is `unavailable` with a capability limitation — never a faked success |
| `AT-B12CFG-6` | Configuration | positive | Credential rotation returns `status` to `configuration_required` and invalidates the prior reference |
| `AT-B12CFG-7` | Configuration | negative | **An integration whose webhook verification scheme is unknown or unimplemented cannot become `connected`, cannot be `enabled`, and admits no outbound work**; any inbound callback on its route fails verification and is never processed |
| `AT-B12CFG-8` | Configuration | positive | **Rotating a credential on a `connected` integration moves it to `configuration_required`** and a fresh safe check is required before `connected` is reachable again; a non-material edit (label, note) does not move the status |
| `AT-B12CFG-9` | Configuration | negative | **Rotation never changes `enabled`**, and `DisableIntegration` never changes `status`; there is no status value meaning "administratively off", and new outbound work requires `status = connected` **and** `enabled = true` |
| `AT-B12HLT-1` | Health | positive | Six orthogonal facts are exposed, not one boolean |
| `AT-B12HLT-2` | Health | positive | `webhook_configured` is derived from a real verified receipt, so a never-registered subscription is visible |
| `AT-B12HLT-3` | Health | negative | **A health fact never changes a business state**; a degraded integration does not fail a Message or a Payment |
| `AT-B12HLT-4` | Health | positive | A `401`/`403` flips `credential_valid` and moves the connection to `error` without automatic retry |
| `AT-B12HLT-5` | Health | negative | No health surface exposes a credential, provider host, or raw provider message |
| `AT-B12SEC-1` | Security | negative | **No API returns a credential value, masked fragment, prefix, length, or last-four** |
| `AT-B12SEC-2` | Security | negative | No secret appears in an outbox row, task payload, event, receipt, dead letter, reconciliation evidence, audit entry, metric, or log |
| `AT-B12SEC-3` | Security | negative | A webhook signature is never stored beside the body it signs |
| `AT-B12SEC-4` | Security | negative | An error crossing the boundary carries only the six safe metadata fields |
| `AT-B12SEC-5` | Security | negative | An incident view exposes identifiers and classes, never customer content |
| `AT-B12SEC-6` | Security | negative | **B12 exposes no URL-fetching feature**; the only such path remains B11's system-actor-only allow-listed import |
| `AT-B12SEC-7` | Security | negative | No credential **value** is stored in PostgreSQL by B12 |
| `AT-B12TEN-1` | Tenancy | negative | Reading another workspace's integration → `404`, indistinguishable from absent |
| `AT-B12TEN-2` | Tenancy | negative | Reading another workspace's dead letter or health record → `404` |
| `AT-B12TEN-3` | Tenancy | negative | **No cross-workspace replay exists at any privilege level** |
| `AT-B12TEN-4` | Tenancy | positive | A shared global credential still attributes and budgets usage per workspace |
| `AT-B12TEN-5` | Tenancy | negative | One tenant cannot exhaust another's share of a global provider |
| `AT-B12TEN-6` | Tenancy | negative | **A workspace admin cannot configure or rotate a global-scope provider credential** |
| `AT-B12TEN-7` | Tenancy | negative | A provider object ID is never used as a tenant identifier |
| `AT-B12RBAC-1` | RBAC | positive | `integration.manage` is reused verbatim with its frozen role row and condition |
| `AT-B12RBAC-2` | RBAC | negative | An actor with `platform.operations.view` cannot replay |
| `AT-B12RBAC-3` | RBAC | negative | An Admin cannot replay a dead letter whose owning domain is billing or finance |
| `AT-B12RBAC-4` | RBAC | negative | A system actor is not exempt from any guard, budget, or eligibility check |
| `AT-B12API-1` | API | positive | Ten operations exist; all are additive and none carries a `filters`/`sort` marker |
| `AT-B12API-2` | API | positive | Webhook routes are outside the user-facing catalog, per the frozen rule |
| `AT-B12API-3` | API | positive | `502` is declared only on the two provider-dependent operations |
| `AT-B12API-4` | API | positive | Configure/enable/disable require `expected_version` and return `409 STALE_VERSION` on mismatch |
| `AT-B12API-5` | API | negative | **No API mutates the outbox, receipts, executions, or provider attempts** |
| `AT-B12API-6` | API | negative | **`RetryJob` and `RetryWebhook` have no human-reachable surface at all** — no public API, no operator API, no CLI, and no operator path inside any other command; `replayDeadLetter` is the *only* human-initiated re-execution surface, and it passes through `replay_eligible` and the six re-checks |
| `AT-B12API-7` | API | positive | Every one of the 15 commands has exactly one named invocation surface, and every permission governs at least one real operation |
| `AT-B12API-8` | API | negative | **`ReplayDeadLetter` never invokes `RetryJob` or `RetryWebhook`**: for `worker_execution` origin it re-invokes the owning domain's command producing a **new** execution, and it neither resurrects the `dead_lettered` row nor manufactures a `dead_lettered → failed` transition to make `RetryJob`'s precondition reachable |
| `AT-B12ERR-1` | Errors | positive | Fourteen frozen codes are reused; exactly one is added |
| `AT-B12ERR-2` | Errors | negative | No new code duplicates a frozen code's meaning |
| `AT-B12ERR-3` | Errors | positive | `unknown` outcome surfaces to a client as `502 PROVIDER_UNAVAILABLE`; no `UNKNOWN_*` code invites a client retry |
| `AT-B12ERR-4` | Errors | positive | Every `409 CONFLICT` carries a `details.reason` from the extended closed set |
| `AT-B12SCH-1` | Scheduling | positive | Scheduled entries only detect or clean up |
| `AT-B12SCH-2` | Scheduling | positive | If every scheduled entry stopped forever, nothing becomes incorrect — only stale |
| `AT-B12SCH-3` | Scheduling | negative | **No scheduled entry decides a business outcome, and no automation wakeup sweep exists** |
| `AT-B12SCH-4` | Scheduling | positive | Double-firing a sweep is safe via `SKIP LOCKED`, partial-unique constraints, and guard-already-false preconditions |
| `AT-B12VER-1` | Schema versioning | positive | Every envelope carries `schema_version`; a consumer ignores unknown fields and refuses an unsupported major |
| `AT-B12VER-2` | Schema versioning | positive | An event produced by version N and consumed by N-1 does not corrupt state; it is retained and retried |
| `AT-B12VER-3` | Schema versioning | negative | No design element assumes deploy and queue drain are atomic |
| `AT-B12FW-1` | B9/B11 firewall | negative | **No frozen synchronous write path is made asynchronous** |
| `AT-B12FW-2` | B3 firewall | negative | B12 never increments, resets, or bypasses `attempt_no` or the actor-retry admission budget |
| `AT-B12FW-3` | B4 firewall | negative | Transport retry never exceeds B4's provider-attempt maximum |
| `AT-B12FW-4` | B5 firewall | negative | **No B12 path writes `messages`, `conversations`, or `message_deliveries`, or decides a Message's status** |
| `AT-B12FW-5` | B5 firewall | negative | No B12 replay, retry, or operator action creates a send path around B5's consent rule |
| `AT-B12FW-6` | B7 firewall | negative | **No B12 scheduler creates, skips, or completes an `AutomationRun`, and no wakeup sweep is built** |
| `AT-B12FW-7` | B8 firewall | negative | No B12 path grants an entitlement, activates a subscription, or emits `PaymentSucceeded`/`SubscriptionActivated` |
| `AT-B12FW-8` | B9 firewall | negative | **No B12 path creates a `RevenueEvent`, `RevenueReversal`, or `AttributionTouchpoint`**; transport evidence is not recognized revenue |
| `AT-B12FW-9` | B10 firewall | negative | No B12 path decides tax applicability, document classification, or submission state; B12 emits no domain's business event |
| `AT-B12FW-10` | B11 firewall | negative | No B12 path writes a `FileAsset` lifecycle field or hard-deletes a `file_assets` row |
| `AT-B12FW-11` | B1/B2/B6 firewall | negative | No B12 command names a B1, B2, or B6 table for write |
| `AT-B12FW-12` | Firewall summary | negative | **No B12 table can answer whether a Lead is qualified, a Message was read, a Payment succeeded, revenue was recognized, a tax document was cleared, or a file is available** |
| `AT-B12CON-1` | Concurrency | positive | The fixed lock order makes deadlock between two B12 paths structurally impossible |
| `AT-B12CON-2` | Concurrency | positive | A webhook arriving during outbound execution serializes on the domain row lock; neither path corrupts the other's table |
| `AT-B12CON-3` | Concurrency | positive | Operator replay and automatic retry cannot both move a dead letter to `replaying` |
| `AT-B12CON-4` | Concurrency | positive | Provider disablement is re-checked at execution, not only at enqueue |
| `AT-B12CON-5` | Concurrency | positive | **All five unknown-outcome interleavings produce no duplicate business effect** |
| `AT-B12CON-6` | Concurrency | positive | Concurrent configuration writes resolve by `expected_version`; the loser gets `409 STALE_VERSION` |
| `AT-B12CON-7` | Concurrency | positive | A stale dispatcher returning after its lease was reaped serializes correctly: the reclaiming dispatcher's state stands, the stale write matches zero rows, and no terminal outbox row is reopened |
| `AT-B12OBS-1` | Observability | positive | Every required correlation field propagates unbroken from API command to webhook application |
| `AT-B12OBS-2` | Observability | negative | No metric label carries a workspace ID, credential, URL, payload, or other unbounded-cardinality value |
| `AT-B12SM-1` | State machines | positive | **Every command's precondition state and effect transition exist in the machine it names, and every transition names a triggering command** — no unreachable state, no untriggered transition, no terminal state with an outgoing edge |

## 2. Counts

`ACCEPTANCE_TEST_COUNT` — distinct IDs in §1, summed by prefix: `API(8) + ASY(5) + CEL(7) + CFG(9) + CON(7) + DLQ(10) + ERR(4) + FW(12) + HLT(5) + HTTP(6) + IDM(9) + INB(5) + OBS(2) + OBX(11) + PRV(6) + QUE(4) + RBAC(4) + RDS(5) + REC(9) + RL(8) + RTY(8) + SCH(4) + SEC(7) + SM(1) + TEN(7) + UNK(7) + VER(3) + WH(18) = **191**`.

**B12-FIX.1 added 16 controls** across eight prefixes, one per repaired finding and its adversarial converse: `OBX-10`/`OBX-11`/`CON-7` (lease fencing), `WH-15`/`WH-16` (receipt immutability), `WH-17`/`WH-18` (cross-workspace dedup poisoning), `REC-8` (NULL-workspace case identity), `DLQ-9` (abandon surface), `CFG-7`/`CFG-8`/`CFG-9` (fail-closed, rotation, status/enabled orthogonality), `API-6`/`API-7` (no bare retry endpoint; every command owned), `RTY-8` (B4's ceiling wins), and `SM-1` (the command ↔ state-machine cross-check). A new prefix, `SM`, was introduced because the defect this pass repaired was precisely that no test asserted the two documents agreed.

**B12-FIX.1a added three more and corrected one.** `API-8` (`ReplayDeadLetter` never invokes `RetryJob`/`RetryWebhook`), `REC-9` (the specific eight-part operator control for `ResolvePlatformReconciliationCase`, which previously relied on the generic `API-7`), and `DLQ-10` (replay creates new evidence for all three `origin_kind` values). `API-6` was **corrected**: it asserted "no standalone endpoint … every human-initiated re-execution passes through `replayDeadLetter`", whose second clause rested on an operator path that an independent countersign proved unreachable. It now asserts the stronger and true property — those two commands have **no** human-reachable surface at all.

`ACCEPTANCE_CATEGORY_COUNT` — `COUNT(DISTINCT Category)` over §1's Category column, the authoritative method B8 established: API; Async model; B10 firewall; B11 firewall; B1/B2/B6 firewall; B3 firewall; B4 firewall; B5 firewall; B7 firewall; B8 firewall; B9 firewall; B9/B11 firewall; Celery; Concurrency; Configuration; Dead letter; Errors; Firewall summary; Health; HTTP policy; Idempotency; Inbox; Observability; Outbox; Provider port; Queue topology; Rate limits; RBAC; Reconciliation; Redis boundary; Replay; Retry; Scheduling; Schema versioning; Security; **State machines**; Tenancy; Unknown outcome; Webhook dedup; Webhook gateway; Webhook ordering; Webhook security = **42**.

`NEGATIVE_CONTROL_COUNT` — counted directly from the Pos/Neg column: **93**, against 98 positive. `93 + 98 = 191` ✓.

`DUPLICATE_ACCEPTANCE_TESTS = 0` — every `AT-B12*` ID above is unique.

## 3. Brief §71–§72 coverage

| Required category | Test(s) |
|---|---|
| outbox durability | `AT-B12OBX-1`…`9` |
| inbox dedup | `AT-B12INB-1`…`5` |
| Celery redelivery | `AT-B12CEL-3`, `AT-B12OBX-5`, `AT-B12INB-2` |
| idempotency | `AT-B12IDM-1`…`9` |
| provider retry | `AT-B12RTY-1`…`7` |
| unknown outcomes | `AT-B12UNK-1`…`7`, `AT-B12CON-5` |
| webhook security | `AT-B12WH-2`…`5`, `AT-B12WH-12`, `AT-B12WH-14` |
| webhook duplicate | `AT-B12WH-6`, `AT-B12WH-7`, `AT-B12WH-8` |
| webhook out-of-order | `AT-B12WH-10`, `AT-B12WH-11` |
| rate limits | `AT-B12RL-1`…`8` |
| budget preservation | `AT-B12RL-4`…`7`, `AT-B12RTY-5`, `AT-B12FW-2`, `AT-B12FW-3` |
| dead-letter | `AT-B12DLQ-1`…`3`, `AT-B12DLQ-8` |
| replay | `AT-B12DLQ-4`…`7`, `AT-B12TEN-3` |
| reconciliation | `AT-B12REC-1`…`7` |
| provider enable/disable | `AT-B12CFG-3`, `AT-B12WH-9`, `AT-B12CON-4` |
| credential redaction | `AT-B12SEC-1`…`4`, `AT-B12SEC-7` |
| tenant isolation | `AT-B12TEN-1`…`7` |
| cross-domain authority | `AT-B12FW-1`…`12` |
| Redis-loss recovery | `AT-B12RDS-1`…`5` |
| deployment compatibility | `AT-B12VER-1`…`3` |
| schema versioning | `AT-B12VER-1`, `AT-B12VER-2` |
| B3/B4/B5/B7/B8/B9/B10/B11 firewalls | `AT-B12FW-2`…`AT-B12FW-10` |
| state machine ↔ command agreement | `AT-B12SM-1`, `AT-B12WH-15`, `AT-B12CFG-8`, `AT-B12CFG-9`, `AT-B12API-7` |
| outbox lease fencing | `AT-B12OBX-10`, `AT-B12OBX-11`, `AT-B12CON-7` |
| cross-workspace dedup poisoning | `AT-B12WH-17`, `AT-B12WH-18` |
| operator surface ownership | `AT-B12DLQ-9`, `AT-B12REC-9`, `AT-B12API-6`, `AT-B12API-7`, `AT-B12API-8` |
| replay creates new evidence, never rewrites history | `AT-B12WH-16`, `AT-B12API-8`, `AT-B12DLQ-10` |
| **§72 negative controls** — Redis as sole truth · grant entitlement · recognize revenue · create Deal · change Lead semantics · change Message state · exceed AI budget · exceed Discovery budget · trust unsigned webhook · trust webhook workspace ID · log a secret · blindly retry unknown · cross-tenant replay · Celery id as domain id · provider id as tenant id · scheduling as automation | `AT-B12RDS-1` · `AT-B12FW-7` · `AT-B12FW-8` · `AT-B12FW-11` · `AT-B12FW-11` · `AT-B12FW-4` · `AT-B12FW-3` · `AT-B12FW-2` · `AT-B12WH-2` · `AT-B12WH-4` · `AT-B12SEC-2` · `AT-B12UNK-3` · `AT-B12TEN-3` · `AT-B12CEL-6` · `AT-B12TEN-7` · `AT-B12FW-6` |

```
ACCEPTANCE_TEST_COUNT = 191
POSITIVE_CONTROL_COUNT = 98
NEGATIVE_CONTROL_COUNT = 93
ACCEPTANCE_CATEGORY_COUNT = 42
DUPLICATE_ACCEPTANCE_TESTS = 0
```
