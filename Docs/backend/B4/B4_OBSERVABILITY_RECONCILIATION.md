# B4 — Observability, Auditability, Explainability, and Reconciliation

> **B4 status:** Target design only. Inherits frozen `BACKEND_OPERATIONS_OBSERVABILITY.md`. No dashboard, exporter, or alert rule is implemented.

## 1. Metrics

| Metric | Type | Labels |
|---|---|---|
| `intelligence_requested_total` | counter | workspace, mode (`analyze`\|`reanalyze`) |
| `intelligence_admitted_total` | counter | workspace |
| `intelligence_reused_total` | counter | workspace — same-input reuse (`B4_COST_RATE_LIMIT_MODEL.md` §7) |
| `intelligence_rate_limited_total` | counter | workspace |
| `intelligence_run_completed_total` | counter | workspace, `completion_kind` |
| `intelligence_run_failed_total` | counter | workspace, `failure_code` |
| `intelligence_run_cancelled_total` | counter | workspace |
| `intelligence_insufficient_total` | counter | workspace |
| `intelligence_run_duration_seconds` | histogram | `completion_kind` |
| `intelligence_provider_calls_total` | counter | provider, `task_type`, outcome |
| `intelligence_provider_latency_seconds` | histogram | provider, `task_type` |
| `intelligence_schema_invalid_total` | counter | provider, `task_type` — surfaces malformed-output rate distinctly from provider unavailability |
| `intelligence_tokens_total` | counter | provider, direction (`input`\|`output`) |
| `intelligence_cost_unknown_total` | counter | provider — mirrors `B3_QUOTA_COST_CONTROL.md` §7's "never silently zero" discipline |
| `intelligence_batch_size_rejected_total` | counter | workspace |
| `intelligence_stale_reads_total` | counter | workspace — how often a `stale: true` run is actually served, signalling whether re-analysis prompts are working |

No secret, raw prompt, or raw provider payload is ever a metric label — every label above is a closed enum or a `workspace_id`, matching `B4_SECURITY_PRIVACY_SAFETY.md` §2's logging discipline extended to metrics.

## 2. Logging

One log line per **state transition** and per **provider call**, never per signal (a run can carry a dozen signals; the frontend does not need a dozen log lines to explain one analysis, mirroring B3's exact reasoning for not logging per-result-row).

**Every line carries:** `request_id`, `workspace_id`, `business_public_id`, `run_public_id`, plus `provider_request_id` where applicable.

**Never logged**, at any level: anything `B4_SECURITY_PRIVACY_SAFETY.md` §1–§2 already prohibits sending or retaining.

## 3. Operator diagnostics

`provider_request_id` and `ai_usage_records` rows are reachable only through an **operator-scoped** diagnostic surface, never the tenant API — mirroring `B3_API_DTO_CONTRACTS.md` §6's exact pattern. Reading one writes an `AUD-*` row naming the operator, the run, and the reason (`B4_AUTHORIZATION_TENANCY.md` §4).

## 4. Auditability — the required trace

> An operator must be able to answer **"why did this Business receive this score?"** end to end, without a hidden or untraceable step.

```
overall_priority_score
  → score_components[]                (B4_SCORING_MODEL.md §2)
    → signals[] contributing            (B4_SIGNAL_TAXONOMY.md)
      → evidence_refs[]                   (B4_EVIDENCE_MODEL.md)
        → source_ref (B3 field, or provider extraction)
        → provider_metadata (if ai_extracted): provider, model, prompt_policy_version,
          structured_output_schema_version   (B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md §6)
  → input_snapshot_version, input_hash        (B4_INPUT_SNAPSHOT_MODEL.md)
  → scoring_model_version, signal_taxonomy_version
  → run_public_id (ANL-*), created_at, requested_by_ref
```

Every link in this chain is a stored field on `IntelligenceRunDetail` or its embedded `ai_usage_records` sibling (operator-scoped) — resolvable by a single read, no cross-run join, no reconstruction from logs. `B4_ACCEPTANCE_TESTS.md` includes a negative control for an opaque, unexplainable score (AT-EXPL-NC).

## 5. Explainability — the user-facing surface is deliberately smaller than the audit trail

| Audience | Sees |
|---|---|
| Operator (§4) | the full chain above, including provider/model identity |
| End user (actor viewing a Business's intelligence) | `top reasons` (from `signals[]`, gap-polarity, ranked by `strength`), `risks` (same, informational framing), `missing data` (`insufficient_reason_codes` or low-`DATA_COMPLETENESS` signals), `confidence`, `recommended_action` — **never** prompt internals, chain-of-thought, or provider raw output |

**No chain-of-thought is ever stored or displayed.** The structured-output contract (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4) asks the provider for a final classification/extraction against a closed schema, not for reasoning steps — there is no chain-of-thought field anywhere in the schema for a provider to populate even if it wanted to.

## 6. Reconciliation

| Condition | Response |
|---|---|
| Run stuck in `running` beyond its lease | worker lease expiry reclaims it — `B12`'s future scheduler owns the concrete mechanism, mirroring B3's exact "designs none of them, depends on them" boundary for its own async platform (`B3_RETRY_FAILURE_MODEL.md` §6) |
| `is_current` pointer references a run that is somehow not `completed` | structurally prevented — the pointer flip only ever happens inside the same transaction as the completion write (`B4_IDEMPOTENCY_CONCURRENCY.md` §4); a reconciliation sweep asserting this invariant holds is a B12 concern, not a B4 runtime one |
| Business input changed but current intelligence not marked stale | impossible by construction — staleness is computed at read time from live data, never cached (`B4_FRESHNESS_STALENESS.md` §2) |
| Completed run missing a required component | impossible by construction — a run only reaches `completed` after required (Class A/B) components succeed (`B4_RETRY_FAILURE_MODEL.md` §3); if one is missing, the run is `failed`, not `completed` with a hole in it |
| Provider call completed but local persistence uncertain (crash between provider response and write) | idempotency layer 3 (`(run_id, attempt_sequence, task_type)` unique, `B4_DATA_MODEL.md` §2) absorbs a duplicated write on retry; a lost write simply looks like a timeout to the run and is retried normally within the ≤3 automatic-attempt bound |
| Duplicate provider callback (if the adapter is ever webhook-based rather than synchronous) | same unique constraint; **B4 assumes a synchronous request/response provider boundary by default** — an async/webhook provider integration is Class C, deferred, and would need its own idempotency design when adopted |

`B12` (Async & Integration Platform, not yet designed) owns the concrete scheduler, dead-letter store, and replay tooling for all of the above — B4 requires them and designs none of them, the identical boundary B2 and B3 already state for their own async needs.
