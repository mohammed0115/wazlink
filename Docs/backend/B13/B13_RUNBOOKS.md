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
| Signal | **`/health/ready` returning `not_ready` with `reason = redis_unavailable` across instances** — frozen `FI-B0-12` puts Redis connectivity in the readiness probe, so instances leave load-balancer rotation and the service stops serving traffic. Also: Celery broker connection errors; rate-limit counters unavailable |
| Triage | confirm Redis process/instance health |
| Safe immediate action | Treat as a **total service outage** and restore Redis: with readiness failing, every instance is out of rotation. No durable data is at risk — PostgreSQL remains authoritative and quotas are unaffected (`FI-B0-16`) — but availability is zero, so "no action required" is wrong. Do not attempt to serve traffic by removing Redis from the readiness probe: that is a frozen `FI-B0-12` contract, not a tunable |
| Actions NOT to take | do not attempt to reconstruct queue state from application memory; do not disable rate limiting entirely as a workaround (this removes an abuse control) |
| Recovery | provision/restart Redis; workers reconnect automatically |
| Verification | `queue_delay_ms` returns to baseline; rate-limit trips resume normally |
| Escalation | **SEV-1 — page immediately.** Readiness fails on every instance, so this is a full availability outage, not a degradation. **Corrected under `B13-FIX.1`:** this runbook previously read SEV-3 with "none required" as the immediate action, contradicting B13's own health model (`B13_HEALTH_READINESS.md` §3, "Redis unreachable → readiness fails → remove from load-balancer rotation"). Escalate to Platform on-call; engage the provider/infrastructure owner if the instance is managed |
| Evidence preservation | Redis instance logs and the readiness-failure window (start/end, instances affected) for the incident record. No durable domain data is lost — Redis holds no authoritative state — but the outage duration is the material fact for the post-incident review |

## 3. Celery worker unavailable

| Step | Content |
|---|---|
| Signal | `worker_executions` heartbeat lapse; `queue_delay_ms` rising |
| Triage | check worker process health, OOM kills, deploy status |
| Safe immediate action | restart worker processes |
| Actions NOT to take | do not manually mark a stale execution as failed — it may be `unknown` (`FI-B12-08`); let reconciliation class `P-3` classify it |
| Recovery | restart worker processes; they resume claiming new work. A reaped `outbox_events` row is re-claimed under a fresh `lease_token` (`B12-D-A055`). A heartbeat-stale `worker_executions` row is **not** re-claimed and **not** re-run — reconciliation class `P-3` classifies it `unknown`, and no non-idempotent effect in `unknown` is retried (`B12-D-A020`). Restarting workers does not resolve an `unknown` execution |
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
| Recovery | replay eligible records via `platform.operations.replay`, **each replay carrying its own mandatory non-empty reason** (`B13_OPERATOR_MODEL.md` §6a); abandon with a mandatory reason where the intent is no longer valid |
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

> **Standalone runbook.** Every field below is stated in full; the cross-references in §11b are supplementary context, never a substitute for a field. Rewritten under `B13-FIX.1` — this section previously read "identical shape to §10", which left an operator without a usable procedure and made `AT-B13INC-1` false.

**Read this precondition first.** No scraping vendor is selected (`B3_PROVIDER_ABSTRACTION.md` §6 — the boundary is deliberately replaceable and names no vendor), and the provider's webhook verification scheme is `UNRESOLVED` (`B12-D-B005`). Frozen `B12-D-A054` therefore applies: an integration whose verification scheme is unknown **cannot pass verification, cannot reach `connected`, cannot be `enabled`, and admits no outbound work**. Until a provider is selected and its scheme implemented, the correct steady state is *no scraping traffic at all*. Observing scraping traffic before that point is not an outage — it is a fail-closed control failure, and §11a routes it accordingly.

| Step | Content |
|---|---|
| **Signal / detection** | WazLink-owned signals only — no provider status page, dashboard, or SLA may be assumed, because no vendor is selected. Watch: `provider_requests_total{provider="scraping",outcome}` error/timeout share rising; scraping-sourced Discovery executions stalling to the frozen 30-minute `providers.slow` ceiling; `platform_dead_letters_total{origin_kind}` rising for scraping-origin executions; `platform_reconciliation_cases_total{class}` rising for the frozen Scraping reconciliation process. **Absence signal:** a submit that receives no callback within the job's own ceiling is detected by WazLink's own poll/timeout — never by waiting on a redelivery the provider has not been established to perform. **Anomaly signal:** any non-zero `webhook_verification_failed_total{provider="scraping"}`, or any accepted scraping callback, while `B12-D-B005` is unresolved. |
| **Initial triage** | Classify into exactly one of four states before acting. **(a) Control failure** — the connection is not `enabled`/`connected` yet scraping traffic exists: stop, treat as §11a, not as an outage. **(b) Configuration fault** — `SCRAPING_PROVIDER`, `SCRAPING_API_KEY_REF`, `SCRAPING_BASE_URL`, `SCRAPING_WEBHOOK_SECRET_REF` are required-if-enabled and **workspace-scoped**, so a fault here is normally confined to one workspace. **(c) Provider unavailability** — outbound submit/poll failing or timing out across *multiple* workspaces. **(d) Submit-succeeded, callback-absent** — the outcome is `unknown` and must be treated as such. Always establish blast radius per workspace first: one workspace's misconfiguration is never evidence of a global outage, and a global outage is never remediated per workspace. |
| **Safe immediate action** | For the common case (c), **none is required** — this is the designed behaviour, not an omission. Scraping-sourced executions fail and retry within the frozen budget `MAX_JOB_ATTEMPTS = 3` (`B3-D-A031`), then dead-letter for later operator decision. For (d), record the outcome as `unknown` and hand it to the unknown-outcome procedure; never infer success or failure from a timeout. For (a), confirm the connection is refusing work — that refusal *is* the control working — and leave it refusing. Where continued attempts are judged wasteful, the only sanctioned lever is disabling the affected **workspace's** provider connection through its own governed, audited configuration command: per-workspace, reversible, and guard-respecting. |
| **Actions NOT to take** | Do not raise `MAX_JOB_ATTEMPTS` or `MAX_ACTOR_RETRIES_PER_JOB` — frozen B3 architectural bounds (`B3-D-A031`), not outage tuning knobs. Do not set a `DiscoveryJob`'s status by hand: the platform layer may route a scraper callback but **never decides a job's status** (`B12_DOMAIN_FIREWALLS.md`). Do not increment, reset, or bypass `attempt_no`. Do not widen the 30-minute `providers.slow` ceiling to "let it finish". Do not retry a non-idempotent submit whose outcome is `unknown`. Do not disable, stub, or "temporarily" bypass webhook signature verification to accept callbacks — and specifically do not mark the scraping connection `enabled` before its verification scheme exists (`B12-D-A054`). Do not edit `webhook_receipts`, `worker_executions`, or dead-letter rows. Do not replay a dead letter without a reason or outside the frozen eligibility guards. Do not reuse one workspace's credentials or configuration to service another. Do not assume a missed callback will be redelivered — no such provider guarantee is established. |
| **Recovery procedure** | In order. **1.** Confirm recovery from WazLink-side telemetry only (error share falling on `provider_requests_total{provider="scraping"}`). **2.** Confirm connection health with the read-only configuration check, which returns `{provider, environment, configured, last_verified_at}` and never a secret value. **3.** Re-enable only those per-workspace connections that were deliberately disabled in step (c) above, each through the governed command, each audited. **4.** Re-drive failed intents **only** through `replayDeadLetter` on records the system computes as `replay_eligible`: mandatory non-empty reason, all six re-checks re-run, invoking the **owning domain's own** guarded command. `RetryJob` and `RetryWebhook` are system-only and have no operator path — they are not part of this or any recovery. **5.** Let the frozen Scraping reconciliation process resolve residual divergence; any repair executes as the owning domain's command, never as a direct edit. **6.** Records that are not `replay_eligible` — a non-idempotent operation with an unresolved `unknown` outcome — go through the unknown-outcome procedure **first**, and are never replayed to "see what happens". |
| **Verification after recovery** | `provider_requests_total{provider="scraping",outcome}` error share back to baseline. Dead-letter count for scraping-origin records stops growing, and the backlog drains only by audited replay or audited abandon — never by deletion. Scraping reconciliation cases return to baseline, each closed with its own resolution record. No `DiscoveryJob` exceeded `MAX_JOB_ATTEMPTS` and no `attempt_no` was mutated outside the governed path. Every replay performed during recovery has an audit row carrying actor, target, timestamp and reason. Confirm per workspace that no cross-workspace effect occurred — a callback must never have been bound to a workspace other than the one whose configuration verified it. |
| **Escalation conditions / path** | **SEV-3** by default: provider unavailability that the frozen budgets and dead-letter path are absorbing as designed. **Escalate to SEV-2** if dead-letter growth outpaces the drain rate, reconciliation cases accumulate beyond baseline, or the outage repeatedly spans more than one job ceiling. **Escalate to SEV-1 and engage security on-call** for any of: a scraping webhook accepted while `B12-D-B005` is unresolved; evidence of a callback resolving to the wrong workspace; or any exposure of `SCRAPING_API_KEY_REF`/`SCRAPING_WEBHOOK_SECRET_REF`. **Boundary-specific escalation step, retained:** because the verification scheme is unresolved, explicitly confirm whether webhook-dependent scraping flows are affected differently from purely polled flows before declaring scope. **Path:** Platform on-call → Discovery domain owner → security on-call on any isolation or verification anomaly. |
| **Evidence to preserve** | `worker_executions` rows for the affected scraping executions, preserved immutably and never edited. `platform_dead_letters` records with their `replay_of` lineage intact. Scraping reconciliation cases and their resolution records. `webhook_receipts` for every callback received, including duplicates — a duplicate correctly acknowledges `200 WEBHOOK_DUPLICATE` and is evidence, not noise. Audit rows for every operator action taken (replay, abandon, configuration change) with reason. Correlation identifiers joining the original submit to its callback and to any replay. **Redaction discipline applies to the incident record itself:** no provider host or base URL, no credential or credential reference value, and no raw provider request or response body may appear in an incident note, ticket, or chat log. |

### 11a. If scraping traffic exists before a provider is selected

This is a **control failure, not an outage**, and it inverts the runbook. Frozen `B12-D-A054` makes the scraping connection structurally incapable of reaching `enabled` while its verification scheme is unresolved, so traffic in this state means a guard has been bypassed. Treat as SEV-1: engage security on-call, do not "drain" or replay the affected work, preserve every receipt and execution row as evidence, and determine how the enablement guard was defeated before restoring any flow. Nothing in §11's recovery procedure applies until that question is answered.

### 11b. What is not known about this provider, and stays not known

| Unknown | Frozen status | Operational consequence |
|---|---|---|
| Which vendor provides scraping | no vendor named; boundary designed replaceable (`B3_PROVIDER_ABSTRACTION.md` §6) | no status page, support channel, or SLA may be cited in this runbook |
| Webhook verification scheme | `B12-D-B005`, **UNRESOLVED** | callbacks cannot be verified, so the connection cannot be `enabled` (`B12-D-A054`); §11a governs any traffic seen |
| Provider contract, permitted sources, robots/terms, redistribution rights | `B3-X-006`, **UNRESOLVED** | no assumption about permitted retry volume or acceptable request rate |
| Retry, redelivery, cancel, and resume capability | never established by frozen research | absence of a callback is detected by WazLink's own timeout; no redelivery is awaited, and no cancel/resume step is offered |
| Rate-limit and quota signalling semantics | not established for this provider (unlike Places, `B12-X-009`) | a `429`-shaped response is treated as a generic transient failure under the frozen budget, not as a quota signal with known reset behaviour |

Every field in §11 is therefore built from WazLink-owned signals, WazLink-owned budgets, and frozen WazLink contracts alone. When a provider is selected, these five rows become research items to close — and closing them may add provider-specific detail to §11, but may not relax any bound it states.

### 11c. Supplementary cross-references

Context only; §11 is complete without them. Dead-letter drain mechanics: §7. Reconciliation growth: §8. Webhook-specific failures: §6. Operator replay contract including the mandatory-reason gate: `B13_OPERATOR_MODEL.md` §6a. Provider-boundary shape: `B3_PROVIDER_ABSTRACTION.md` §6.

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
| Safe immediate action | uploads/downloads fail with `PROVIDER_UNAVAILABLE`; `unknown`-outcome writes are resolved via `stat_object` once the provider returns (`FI-B11-07`, `B11_STORAGE_PROVIDER_BOUNDARY.md` §4; B13 procedure in `B13_FILE_SECURITY.md` §9) |
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

`RUNBOOK_COUNT = 18` — mechanically the section count of §1–§18, re-derived in `B13_VERIFICATION_MATRIX.md` §2. **Every one of the 18 carries all eight required operational fields** (signal/detection, initial triage, safe immediate action, actions NOT to take, recovery, verification after recovery, escalation, evidence to preserve), mechanically checkable as eight leading table cells per section, matched on the field concept rather than an exact string — §11 spells the contract names in full ("Initial triage", "Recovery procedure", "Verification after recovery", "Escalation conditions / path", "Evidence to preserve") where §§1–10 and 12–18 use the short forms ("Triage", "Recovery", "Verification", "Escalation", "Evidence preservation"). Before `B13-FIX.1`, §11 carried none of them — it deferred to §10 with "identical shape to §10" — and the pre-FIX.1 note here excused that as brevity rather than recording it as an incomplete runbook.
