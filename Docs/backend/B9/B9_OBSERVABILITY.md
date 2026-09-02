# B9 — Observability

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What must be observable, and why

B9's failure modes are quiet ones. Revenue that was never recognized looks exactly like a workspace that earned nothing; an attribution that silently stopped resolving looks like a marketing result. Observability exists to make silence audible.

## 2. Metrics

Names follow the project's existing `snake_case` counter/histogram convention.

| Metric | Type | Dimensions | Meaning |
|---|---|---|---|
| `revenue_recognition_success_total` | counter | `workspace_id`, `source_type` | successful `RecordRevenueEvent` |
| `revenue_recognition_failure_total` | counter | `workspace_id`, `failure_code` | rejected recognitions |
| `duplicate_recognition_suppressed_total` | counter | `workspace_id`, `guard` (`idempotency`\|`source`) | duplicates stopped — the firewall working |
| `revenue_reversal_total` | counter | `workspace_id`, `reason` | reversals issued |
| `revenue_reversal_amount` | histogram | `workspace_id`, `currency` | reversal magnitudes |
| `revenue_recognized_amount` | histogram | `workspace_id`, `currency` | recognition magnitudes |
| `unattributed_revenue_ratio` | gauge | `workspace_id`, `currency` | unattributed ÷ net recognized |
| `attribution_resolution_failure_total` | counter | `workspace_id`, `stage` | first-touch resolution failed; recognition still committed |
| `attribution_integrity_failure_total` | counter | `workspace_id`, `check` | over-attribution, orphan, allocation mismatch — **should always be 0** |
| `currency_mismatch_total` | counter | `workspace_id` | `B9-AF-015` occurrences |
| `reconciliation_open_cases` | gauge | `workspace_id`, `case_type`, `severity` | live cases |
| `reconciliation_case_age_seconds` | histogram | `workspace_id`, `severity` | how long cases stay open |
| `reconciliation_scan_duration_seconds` | histogram | `scan` | scan cost |
| `financial_command_latency_seconds` | histogram | `command` | end-to-end command latency |
| `revenue_reversal_bound_rejection_total` | counter | `workspace_id` | `B9-AF-014` — over-reversal attempts blocked |
| `reversal_net_underflow_total` | counter | `workspace_id` | `B9-AF-029` — **non-terminal** reversals too small to allocate a net minor unit |
| `terminal_gross_cleanup_total` | counter | `workspace_id` | reversals committed with `net = 0` as the terminal gross-cleanup (`B9_REVERSAL_MODEL.md` §4.1a). Expected to be rare and non-zero; a **rising** rate suggests callers are reversing with scale-4 precision that leaves residuals, which is legitimate but worth seeing |
| `events_with_gross_residual` | gauge | `workspace_id` | events whose net fold is exhausted while gross is not — the state the terminal cleanup exists to close. It is a correct, visible, closable state, not an error; a *persistently* rising gauge means operators are not retiring residuals |
| `attribution_candidate_source_total` | counter | `workspace_id`, `candidate_kind` | which resolution source won: `touchpoint` vs `derived_provenance` (`B9_FIRST_TOUCH_MODEL.md` §4) |

Amounts appear only as **aggregate** histograms dimensioned by workspace and currency — never as per-customer, per-deal, or per-event series (`B9_SECURITY_PRIVACY.md` §7).

## 3. Alerts that matter

| Condition | Severity | Why |
|---|---|---|
| `attribution_integrity_failure_total > 0` | **critical** | detects a state the write paths make unreachable; a hit means an invariant broke |
| `reconciliation_open_cases{severity="critical"} > 0` | **critical** | over-reversal, status-fold mismatch, orphan attribution, allocation mismatch, currency mismatch |
| `revenue_reversal_bound_rejection_total` spiking | warning | either a client bug or an attempt to over-reverse |
| `unattributed_revenue_ratio` rising sharply | warning | provenance resolution likely degraded |
| `attribution_candidate_source_total{candidate_kind="derived_provenance"}` falling to zero in a Track-A workspace | warning | the B3 provenance read is failing or returning nothing; Track-A attribution has silently stopped |
| `duplicate_recognition_suppressed_total` spiking | warning | a client retry loop, or a genuine duplicate-submission problem |
| `reconciliation_case_age_seconds` p95 growing | warning | cases are being opened faster than resolved |
| Reconciliation scan not completing on schedule | warning | detection is blind while it is down |

The first two are the important ones: they alert on **impossible** states. A monitoring design that only watches for expected failures cannot tell you the model was wrong.

## 4. Structured logs

Every financial command logs one structured record: `request_id`, `workspace_id`, `actor_membership_id`, `command`, `target_public_id`, `outcome`, `failure_code?`, `duration_ms`, `idempotency_replay: bool`.

**Never logged:** amounts at per-event granularity in a searchable field, customer names, provider payloads, secrets, session tokens, or another workspace's identifiers.

`idempotency_replay` is included deliberately — a replay that returns a stored result looks identical to a fresh success from the outside, and distinguishing them is essential when investigating "did we book this twice?"

## 5. Traces

Recognition and reversal are traced with spans for: source validation (upstream read), provenance walk, financial write, attribution write, outbox append. The provenance walk is separately spanned because it is the only step that reads another domain and the only one whose slowness could pressure a financial transaction (`B9_IDEMPOTENCY_CONCURRENCY.md` §6).

Trace attributes carry ids and durations only — no amounts, no PII.

## 6. Audit vs telemetry

Distinct, and never substituted for one another:

| | Audit | Telemetry |
|---|---|---|
| Purpose | who did what to financial truth | how the system is behaving |
| Retention | long, governed | short, operational |
| Granularity | per command | aggregated |
| Contains amounts | yes, as recorded | only as aggregates |
| Authoritative | yes | **no** |

A metric is never evidence of a financial fact. `AT-OBS-3` **(NC)**.

## 7. Negative controls

`AT-OBS-1` **(NC)**: a metric, log or trace carrying card data, a secret, a provider payload, or customer PII — fails.
`AT-OBS-2` **(NC)**: a per-customer revenue time series in telemetry — fails.
`AT-OBS-3` **(NC)**: a selector or report sourcing a revenue figure from a metrics store rather than the register — fails.
`AT-OBS-4`: `attribution_integrity_failure_total` is zero across the full acceptance suite.
