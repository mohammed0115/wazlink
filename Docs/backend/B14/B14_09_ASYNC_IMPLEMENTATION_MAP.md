# B14_09 — Async Implementation Map

> **B12 semantics are reused verbatim.** No new queue, no new retry mechanism, no provider-specific retry system, no automatic replay of unsafe `UNKNOWN` work.

## 1. The five frozen queues — and nothing else

| Queue | Purpose | Starvable |
|---|---|---|
| `default` | domain work with no provider call | no |
| `providers.fast` | short provider calls (ceiling ~1 min) | no |
| `providers.slow` | long provider calls (ceiling 30 min) — incl. **OpenAI** and scraping | no |
| `webhooks` | inbound callback processing after fast-ack | no |
| `maintenance` | sweeps, reconciliation, SLA, expiry | **yes, deliberately** (`FI-B12-10`) |

**A sixth queue is prohibited.** A business-named queue (`ai`, `imports`, `tickets`) is prohibited.

## 2. Non-negotiable async rules

1. **Outbox:** every event is written in the **same transaction** as its state change and dispatched by the relay under a per-claim `lease_token` fence (`B12-D-A055`) — **`outbox_events` only**.
2. **`worker_executions` has no lease, lease-owner or fencing column.** A heartbeat-stale `running` row is classified `unknown` by reconciliation class `P-3`, **operator-gated, never auto-repaired, never automatically re-executed**.
3. **`B12-D-A020`: a non-idempotent operation whose outcome is `unknown` is NEVER retried** — no override flag, permission or configuration.
4. **Attempt-before-call:** `provider_request_attempts` is written **before** the provider call (`B12-D-A021`), so a crash leaves evidence.
5. **Payloads carry references, re-read at execution time** (`FI-B12-05`) — never cached decisions.
6. **JSON serialization only** — no pickle.
7. Retry uses full jitter, capped at 15/60 min; **only for idempotent operations**.

## 3. Task inventory

| Task | Producer | Queue | Payload | Idempotency identity | Retry | Unknown policy | Dead letter |
|---|---|---|---|---|---|---|---|
| `dispatch_outbox_event` | outbox relay | `default` | `outbox_event_id` | `event_id` + `lease_token` fence | yes | n/a | yes |
| `process_webhook_receipt` | webhook endpoint | `webhooks` | `webhook_receipt_id` | `(provider, provider_event_identity)` | yes | n/a | yes |
| `run_discovery_job` | `CreateDiscoveryJob` | `providers.slow` | `job_id` | `job_id` | yes | **case `P-1`; no blind repeat** | yes |
| `run_intelligence_analysis` | `RequestAnalysis` | `providers.slow` | `run_id` | `(lead, input_fingerprint)` | yes | `P-1` | yes |
| `send_outbound_message` | **`SendMessage` (human)** | `providers.fast` | `message_id` | `message_id` | yes | **`unknown` ⇒ never resend** — a duplicate WhatsApp message is the exact harm `B12-D-A020` prevents | yes |
| `apply_provider_status` | webhook | `webhooks` | receipt ref | `(message_id, status, provider_ts)` monotonic | yes | n/a | yes |
| **`import_commit_batch`** | `CommitImportBatch` | `default` | `batch_id` | `batch_id` | yes | n/a | yes |
| **`import_process_row`** | batch task | `default` | `(batch_id, row_number)` | **`(batch_id, row_number)`** | **only if the target command is idempotent** | **row recorded `unknown`, surfaced for a human — never re-executed** | yes |
| **`generate_agent_proposal`** | `StartAgentSession` / inbound | `providers.slow` | `(session_id, intent, context_refs)` | `(session, intent, context_hash)` | yes | proposal generation is **effect-free**, so `unknown` is safe to abandon | yes |
| `charge_payment` | `StartCheckout` | `providers.fast` | `payment_attempt_id` | attempt id | yes | **`unknown` ⇒ never retried**; `P-1` reconciliation | yes |
| `sla_breach_sweep` | beat | **`maintenance`** | window | `(ticket, policy, clock)` | yes | n/a | no |
| `quote_expiry_sweep` *(deferred)* | beat | `maintenance` | window | `(quote_id, date)` | yes | n/a | no |
| `reconciliation_sweep` | beat | `maintenance` | class | case identity | yes | **opens a case; never auto-repairs `P-1`/`P-3`/`P-5`/`P-6`/`P-7`** | no |
| `integration_health_check` | operator / beat | `providers.fast` | `connection_id` | `(connection, check_kind, window)` | yes | records `provider_reachable=false` | no |
| `orphan_file_sweep` | beat | `maintenance` | window | file id | yes | n/a | no |

## 4. Reconciliation classes (frozen, reused)

`P-1` unknown provider outcome · `P-2` outbox stuck · **`P-3` heartbeat-stale `worker_executions` ⇒ `unknown`, operator-gated** · `P-4` receipt stuck in `queued` (auto re-enqueue — safe) · `P-5` unknown provider object · `P-6` dedup/payload mismatch · `P-7` unresolved workspace binding · `P-8` stale integration check.

**Five of eight are report-only or operator-gated. No implementation may add an automatic repair to `P-1`, `P-3`, `P-5`, `P-6` or `P-7`.**

New reconciliation surfaces reuse the same shape: an import batch stuck `committing`, and an SLA clock whose ticket vanished, both open a case rather than self-healing.

## 5. Operator actions

> **`B14-FIX.3` — `N-04` closed.** "Re-invokes the owning domain's command" was read as a direct call, which would be `platform_async`(L3) importing `billing`(L4) / `messaging`(L6) / `support`(L8) — **upward**. It is **infrastructure dispatch by registered name** (class `D`, `B14_03` §4a `W-6` and §6a): `platform_async` resolves `common/dispatch.py::CommandRegistry`, which `config/` populated, and dispatches `(command_name, reference_payload)`. It imports **no** other app (`T-DISP-4`), an unregistered name is **refused** (`T-DISP-2`), and **`B12-D-A020` is untouched** — an `unknown`-outcome non-idempotent operation is never dispatched by replay, on any route (`T-DISP-3`). Celery tasks are routed the same way. **Class `D` adds no domain edge.**

`ReplayDeadLetter` (**reason mandatory**, re-runs every original guard, dispatches the owning domain's command **by registered name** — never resurrects a row) · `AbandonDeadLetter` (reason mandatory) · `ResolvePlatformReconciliationCase` (`platform.operations.replay`) · `CheckProviderConfiguration` · `EnableIntegration` / `DisableIntegration`.

**Prohibited:** a "retry this task" button (`B12-D-A053` — `RetryJob`/`RetryWebhook` are SYSTEM-ONLY) · bulk replay without per-item guard re-evaluation · any operator path that mutates tenant business data directly.
