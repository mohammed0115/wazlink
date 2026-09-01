# B6 — Rate and Cost Model

> **B6 status:** Target design only. Deliberately minimal — does not reuse B3/B4/B5's provider-attempt machinery, because none of it applies.

## 1. No external provider cost

**`B6-D-A028` (Class A, resolved): B6 has zero external provider cost.** Every B6 command is a pure internal domain mutation against `deals`/`pipelines`/`pipeline_stages`/`deal_stage_transitions`/`deal_loss_reasons` — no third-party API call, no AI provider call, no messaging provider call, no webhook ingress. This is stated explicitly, as the task requires, rather than left to be inferred from an absent section: unlike B3 (Google Places/scraper calls), B4 (AI provider calls), and B5 (WhatsApp provider calls), B6 introduces no retry-attempt ceiling, no per-call cost-unit tracking, and no `MessagingUsageRecord`-style telemetry table, because there is no external call whose cost or transient-failure behavior needs bounding.

## 2. No new rate-limit policy row

**`B6-D-A029` (Class A, resolved): no amendment to `BACKEND_RATE_LIMIT_POLICY.md` is proposed.** The frozen general-API row already covers B6's abuse-protection needs: *"General API — 300/min/workspace"*, keyed `workspace + user`. This is a deliberate contrast with B3 (`Discovery submit`), B4 (`AI analysis`), and B5 (`Messaging send`), each of which added a domain-specific row *because* they had genuine provider cost or throughput to bound. B6 has neither, so no new row is warranted — proposing one anyway "for consistency" would be exactly the kind of un-motivated architecture the task's own instruction ("do not reuse B3/B4/B5's provider-attempt models without justification") warns against.

## 3. Abuse/rate protection still applies

Every B6 mutating endpoint is still subject to the frozen general-API ceiling like every other authenticated endpoint in the platform — a caller cannot, for instance, script an unbounded loop of `CreateDeal` calls without eventually hitting `429`, `Retry-After` (`B6-DF-038`). This is inherited, not designed here.

## 4. Internal transient-failure retry

B6's only "retry" concept is the ordinary database-contention retry every write-path command already has via its `SELECT ... FOR UPDATE` + optimistic-version pattern (`B6_CONCURRENCY_IDEMPOTENCY.md` §1–§2) — a client-visible `409 STALE_VERSION` that the *client* retries after re-fetching, not a server-side automatic retry loop. There is no B6-specific transient-error classification table (unlike B2's `CLOCK_SKEW` classification or B3/B4/B5's provider-timeout classification), because B6 has no cross-domain event consumer and no provider call to classify failures for.

## 5. Cost accounting

**Not applicable.** B6 produces no `*_usage_records` table and no `cost_units` field anywhere, because it meters no external resource. `B6_ENTITLEMENT_RBAC_TENANCY.md` §6's `pipeline.core` capability is a boolean entitlement gate, not a metered quota, consistent with this section's conclusion.
