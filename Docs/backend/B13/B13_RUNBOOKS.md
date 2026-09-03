# B13 — Runbook Model

> Design only. Implementation-ready runbooks for the operational scenarios the brief names. Each follows the same shape: signal, triage, safe immediate action, actions NOT to take, recovery, verification, escalation, evidence preservation.

## 1. Database unavailable

| Step | Content |
|---|---|
| Signal | `/health/ready` reports `database_unavailable`; error rate spike |
| Triage | confirm scope (single instance vs. full cluster); check managed-database provider status page |
| Safe immediate action | readiness already removes the instance from rotation automatically (`FI-B0-12`); no manual intervention needed to stop traffic |
| Actions NOT to take | do not restart the application repeatedly hoping it reconnects — this does not fix a database-side outage and adds load once it recovers; do not fail over to a stale replica without confirming its lag |
| Recovery | wait for provider recovery, or execute `B13_DISASTER_RECOVERY.md` §2.1 if corruption is suspected |
| Verification | `/health/ready` returns `200`; run a smoke test against a read and a write path |
| Escalation | SEV-1 if full outage exceeds RTO target; SEV-2 otherwise |
| Evidence preservation | capture the exact outage window; do not truncate logs during the incident |

## 2. Redis unavailable

| Step | Content |
|---|---|
| Signal | Celery broker connection errors; rate-limit counters unavailable |
| Triage | confirm Redis process/instance health |
| Safe immediate action | none required — PostgreSQL-authoritative quotas are unaffected (`FI-B0-16`); accept degraded rate-limit acceleration temporarily |
| Actions NOT to take | do not attempt to reconstruct queue state from application memory; do not disable rate limiting entirely as a workaround (this removes an abuse control) |
| Recovery | provision/restart Redis; workers reconnect automatically |
| Verification | `queue_delay_ms` returns to baseline; rate-limit trips resume normally |
| Escalation | SEV-3 unless combined with a provider outage that depends on queue processing (e.g., webhook backlog approaching Tap's retry window — then SEV-2) |
| Evidence preservation | not typically needed — no data loss occurs |

## 3. Celery worker unavailable

| Step | Content |
|---|---|
| Signal | `worker_executions` heartbeat lapse; `queue_delay_ms` rising |
| Triage | check worker process health, OOM kills, deploy status |
| Safe immediate action | restart worker processes |
| Actions NOT to take | do not manually mark a stale execution as failed — it may be `unknown` (`FI-B12-08`); let reconciliation class `P-3` classify it |
| Recovery | workers resume claiming from the lease-expired queue |
| Verification | `queue_delay_ms` normalizes; no duplicate provider effects observed post-recovery |
| Escalation | SEV-3, escalating to SEV-2 if user-visible latency (message send, payment) exceeds a defined threshold |
| Evidence preservation | preserve `worker_executions` rows for the affected window |

## 4. Queue backlog

| Step | Content |
|---|---|
| Signal | `queue_delay_ms{queue}` above baseline |
| Triage | identify which queue (`providers.slow`/`.fast`/`webhooks`/`maintenance`/`default`) — isolation means only that workload class is affected (`FI-B12-10`) |
| Safe immediate action | if `webhooks` is backlogged, prioritize recovery given Tap's retry-window risk (`B13_WEBHOOK_SECURITY.md` §2); if `maintenance`, this is lower urgency by design |
| Actions NOT to take | do not manually re-route tasks between queues — queue assignment is fixed by workload class, not a runtime lever |
| Recovery | scale worker concurrency for the affected queue (deployment-owned, `FI-B12-10` §4) |
| Verification | delay returns to baseline |
| Escalation | SEV-3 generally; SEV-2 if `webhooks` backlog risks Tap's 3-attempt window |
| Evidence preservation | not typically needed |

## 5. Outbox backlog

| Step | Content |
|---|---|
| Signal | `outbox_pending_gauge` rising |
| Triage | confirm the dispatcher is running; check for a poison event blocking a claim |
| Safe immediate action | none — reconciliation class `P-2` re-claims and re-dispatches pending/failed rows automatically (`FI-B12-07`) |
| Actions NOT to take | do not manually publish an event a second time outside the dispatcher — every consumer's dedup constraint makes automatic re-dispatch safe; a manual duplicate risks confusing correlation tracing |
| Recovery | automatic once the dispatcher/worker issue is resolved |
| Verification | `outbox_pending_gauge` returns to baseline |
| Escalation | SEV-3 |
| Evidence preservation | not typically needed |

## 6. Webhook failures

| Step | Content |
|---|---|
| Signal | `webhook_verification_failed_total{provider}` spike, or `webhook_receipts` stuck in `queued` |
| Triage | distinguish a signature-verification failure (possible credential rotation mismatch or forgery attempt) from a processing failure (application bug) |
| Safe immediate action | if credential mismatch is suspected, verify the provider-side credential matches WazLink's configured reference; **never relax verification to "fix" the symptom** |
| Actions NOT to take | never disable signature verification, even temporarily; never accept an unverified payload "to unblock" traffic |
| Recovery | fix the credential mismatch or the processing bug; reconciliation class `P-4` re-enqueues stuck receipts automatically |
| Verification | `webhook_verification_failed_total` returns to baseline |
| Escalation | SEV-2 if sustained during Tap's payment flow; SEV-3 for Meta given its longer retry window |
| Evidence preservation | preserve rejected-receipt audit rows; never the rejected raw body beyond what the receipt already safely stores |

## 7. Dead-letter growth

| Step | Content |
|---|---|
| Signal | `platform_dead_letters_open_gauge{owning_domain}` rising |
| Triage | group by `owning_domain` — a payment dead letter is Billing's decision, a message dead letter is Messaging's (`FI-B12-06` §7) |
| Safe immediate action | investigate root cause before replaying anything — replaying without understanding why the original attempt failed risks repeating the failure |
| Actions NOT to take | do not bulk-replay without per-record review; do not replay a record whose domain budget is exhausted (`replay_eligible` computation prevents this, but manual SQL bypass must never be attempted, `FI-B0-14`) |
| Recovery | replay eligible records via `platform.operations.replay`; abandon with a mandatory reason where the intent is no longer valid |
| Verification | `platform_dead_letters_open_gauge` trends down; no new dead letters from the same root cause |
| Escalation | SEV-3, escalating to SEV-2 for `billing`/`finance` domain concentration |
| Evidence preservation | dead-letter records are already durable evidence by design |

## 8. Reconciliation growth

| Step | Content |
|---|---|
| Signal | `platform_reconciliation_cases_total{class}` rising for a given class |
| Triage | check which of the 8 classes (`P-1`…`P-8`, `FI-B12-07`) is accumulating — `P-1` (unknown provider outcome) is highest priority given financial implications |
| Safe immediate action | for `P-1`, confirm the provider's status-lookup capability is being exercised (e.g., `retrieve_charge` for Tap) |
| Actions NOT to take | never guess a resolution for `P-5`/`P-6`/`P-7` (report-only classes, `FI-B12-07`) — these require human judgment with evidence, not automation |
| Recovery | resolve cases via `finance.reconciliation.resolve`/`platform.operations.replay` as appropriate, each with a mandatory reason |
| Verification | open-case count trends down |
| Escalation | SEV-2 for sustained `P-1` growth on payment records; SEV-3 otherwise |
| Evidence preservation | reconciliation-case evidence JSONB is already the preserved record |

## 9. WhatsApp outage

| Step | Content |
|---|---|
| Signal | `provider_requests_total{provider="whatsapp",outcome=transient/unknown}` rising |
| Triage | check Meta's own status page; confirm it is provider-side, not a WazLink credential/configuration issue |
| Safe immediate action | none — sends queue and retry under the frozen backoff; inbound webhooks continue to be receipted even if outbound is degraded |
| Actions NOT to take | do not disable the provider connection reflexively — `enabled=false` blocks new sends but is a deliberate operator action, not an automatic outage response |
| Recovery | automatic once Meta recovers; Meta's own 36-hour webhook retry window means most inbound delivery-status callbacks self-heal |
| Verification | send success rate returns to baseline |
| Escalation | SEV-3, escalating to SEV-2 if outage exceeds several hours during business-critical send volume |
| Evidence preservation | not typically needed |

## 10. Google Places outage

| Step | Content |
|---|---|
| Signal | `provider_requests_total{provider="places",outcome}` degraded |
| Triage | confirm provider-side status; check for a per-project quota exhaustion vs. a genuine outage (`B12-X-009`) |
| Safe immediate action | Discovery jobs using Places fail/retry under the frozen attempt budget; no manual intervention needed |
| Actions NOT to take | do not raise `MAX_JOB_ATTEMPTS` or the per-workspace admission budget as a workaround — that is a frozen B3 architectural bound, not a tuning knob for an outage |
| Recovery | automatic once the provider recovers |
| Verification | Discovery job success rate returns to baseline |
| Escalation | SEV-3 |
| Evidence preservation | not typically needed |

## 11. Scraping provider outage

Identical shape to §10, scoped to the scraping provider's own capability. `B12-D-B005` notes the scraping provider's webhook verification scheme is not yet selected — until it is, this runbook's escalation path additionally includes confirming whether any webhook-dependent scraping flow is affected differently from a purely polled flow.

## 12. OpenAI/AI provider outage

| Step | Content |
|---|---|
| Signal | `provider_requests_total{provider="ai_gateway",outcome}` degraded |
| Triage | confirm provider-side status |
| Safe immediate action | Intelligence runs fail/retry under the frozen 3-attempt bound; results report `insufficient_evidence` rather than a fabricated score if the run cannot complete |
| Actions NOT to take | never substitute a cached/stale result for a fresh run without marking it explicitly; never bypass the closed-schema validation to "make do" with a malformed response |
| Recovery | automatic once the provider recovers |
| Verification | Intelligence run success rate returns to baseline |
| Escalation | SEV-3 |
| Evidence preservation | not typically needed |

## 13. Tap/payment unknown outcome

| Step | Content |
|---|---|
| Signal | `provider_unknown_outcomes_total{provider="tap"}` rising |
| Triage | **highest financial-security priority runbook in this pack**, given Tap's 3-attempt total webhook retry (`B12-X-006`) |
| Safe immediate action | confirm `retrieve_charge` reconciliation is running on schedule; do not wait passively for a webhook that may never arrive |
| Actions NOT to take | **never retry charge creation** for an unresolved unknown outcome; never manually mark a payment `captured`/`failed` by direct edit |
| Recovery | `ReconcilePayment` resolves each case using `retrieve_charge` evidence |
| Verification | `P-1` case count trends to zero; no duplicate charges observed |
| Escalation | SEV-1 if sustained during a webhook-ingress outage; SEV-2 otherwise |
| Evidence preservation | `provider_request_attempts` and reconciliation evidence are preserved by design |

## 14. File storage outage

| Step | Content |
|---|---|
| Signal | `provider_requests_total{provider="storage",outcome}` degraded |
| Triage | confirm provider-side status |
| Safe immediate action | uploads/downloads fail with `PROVIDER_UNAVAILABLE`; `unknown`-outcome writes are resolved via `stat_object` once the provider returns (`FI-B11-01` §9) |
| Actions NOT to take | never assume an in-flight upload succeeded or failed without a `stat_object` confirmation |
| Recovery | automatic once the provider recovers; reconciliation resolves any `unknown` states |
| Verification | upload/download success rate returns to baseline |
| Escalation | SEV-2 (file access is often business-critical for attachments) |
| Evidence preservation | not typically needed |

## 15. Leaked provider credential

| Step | Content |
|---|---|
| Signal | accidental commit detected, provider-side alert, or a security scan finding |
| Triage | identify exactly which credential and which provider |
| Safe immediate action | **rotate at the provider console immediately** — this is the only action that actually neutralizes the leak; WazLink-side reference invalidation (`B13_SECRETS_MANAGEMENT.md` §7) happens in the same motion |
| Actions NOT to take | do not merely delete the leaked value from a log/commit without rotating it at the provider — the value is already compromised regardless of where it is now visible |
| Recovery | confirm the new credential functions via a safe configuration check |
| Verification | the old value is confirmed rejected by the provider if tested; no anomalous provider activity in the affected window |
| Escalation | SEV-2, escalating to SEV-1 if evidence suggests the credential was actually used maliciously |
| Evidence preservation | identify and preserve exactly how the leak occurred, for the post-incident review |

## 16. Suspected cross-tenant access

| Step | Content |
|---|---|
| Signal | `platform_cross_workspace_denied_total` spike, `webhook_binding_unresolved_total` spike, or a support report |
| Triage | pull the specific `request_id`/`correlation_id` and audit rows (`authz.object_not_in_scope`, `.workspace_path_mismatch`) for the suspected window |
| Safe immediate action | if actively exploitable, disable the affected endpoint/feature immediately (`B13_INCIDENT_MANAGEMENT.md` §2.1) |
| Actions NOT to take | do not wait for a full root-cause analysis before containing an actively exploitable gap |
| Recovery | patch the scoping defect; add a regression acceptance test |
| Verification | the new test passes; no further denials of the same shape occur |
| Escalation | SEV-1 |
| Evidence preservation | preserve every audit row and log line for the affected `request_id`s; never truncate during investigation |

## 17. Failed deployment

| Step | Content |
|---|---|
| Signal | error-rate spike immediately following a deploy, or a failed smoke test |
| Triage | confirm the correlation with the deploy timestamp |
| Safe immediate action | roll back to the prior release |
| Actions NOT to take | do not attempt a forward-fix under production error pressure before rolling back — roll back first, diagnose second |
| Recovery | `B13_DISASTER_RECOVERY.md` §2.8 — rollback is safe for in-flight async work by construction (`B12-D-A049`) |
| Verification | error rate returns to baseline; smoke test passes |
| Escalation | SEV-2, escalating to SEV-1 if the regression caused data corruption or exposure |
| Evidence preservation | preserve the failing release's logs/traces for root-cause analysis |

## 18. Restore from backup

| Step | Content |
|---|---|
| Signal | database corruption or catastrophic data loss confirmed |
| Triage | determine the most recent verified-restorable backup point |
| Safe immediate action | stop write traffic (`B13_DISASTER_RECOVERY.md` §2.1 step 1) |
| Actions NOT to take | do not resume Redis/Celery/worker activity before PostgreSQL is verified consistent (§1 ordering principle, `B13_DISASTER_RECOVERY.md` §1) |
| Recovery | restore per `B13_BACKUP_RESTORE.md`; replay WAL to the most recent recoverable point; verify integrity |
| Verification | checksum/row-count spot checks pass, especially financial tables; smoke test the application against the restored database |
| Escalation | SEV-1 |
| Evidence preservation | document the exact data-loss window (backup timestamp to incident timestamp) for stakeholder communication |

## 19. Runbook count

`RUNBOOK_COUNT = 18` — mechanically the section count of §1–§18 (§11 and §12 each stand as their own numbered runbook despite brevity), re-derived in `B13_VERIFICATION_MATRIX.md` §2.
