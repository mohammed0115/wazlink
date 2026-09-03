# B12 — Failure Catalog

> Design only. Every scenario states: detection · durable state · retryability · domain impact · operator visibility · recovery.

| ID | Scenario | Detection | Durable state | Retryable | Domain impact | Operator visibility | Recovery |
|---|---|---|---|---|---|---|---|
| `B12-F-001` | Broker (Redis) unavailable at publish | dispatcher publish error | outbox row `failed`, attempts +1 | **yes**, transient class (5) | **none** — intent is committed | metric; alert after budget | sweep re-dispatches |
| `B12-F-002` | Redis restarted / flushed | queue depth drops to zero; leases expire | outbox rows intact | yes | **none** | queue-depth alert | `P-2` reclaims `pending`/`failed` and expired `dispatching` |
| `B12-F-003` | Dispatcher crashes after publish, before marking `dispatched` | lease expiry | `dispatching` → `failed` | yes | **none** — duplicate delivery absorbed by consumer constraint | none needed | re-publish; consumer dedups |
| `B12-F-004` | Worker crashes mid-task | heartbeat stale past the job ceiling | `worker_executions` `running`; attempt row may lack an outcome | depends on the attempt row | **none until classified** | `P-3` case | classify as `unknown`; then `P-1` |
| `B12-F-005` | Task soft timeout fires | timeout raised | execution `failed`; attempt `unknown` | **not by blind repeat** | none | `P-1` case | status lookup or callback |
| `B12-F-006` | Task hard timeout kills the worker | no clean record written | attempt row exists without outcome | no | none | `P-3` → `P-1` | as `B12-F-004` |
| `B12-F-007` | Duplicate Celery delivery | consumer's unique insert fails | unchanged | n/a | **none** — silent no-op | metric only | none needed |
| `B12-F-008` | Stale task (state changed since publish) | worker re-reads and finds the precondition false | unchanged | no | **none** | metric only | no-op is correct |
| `B12-F-009` | Poison task (deterministic failure) | repeated identical failure | `failed` → `dead_lettered` after budget | no | domain intent unfulfilled | **dead letter + alert** | operator decision |
| `B12-F-010` | Outbox dispatcher crash loop | attempts climb across many rows | rows `failed`, then `dead_lettered` | bounded | announcements delayed | alert | fix and replay (always eligible) |
| `B12-F-011` | Invalid webhook signature | HMAC mismatch | receipt `failed`, verification `invalid_signature` | **no** | **none — never processed** | security metric; volume alert | none; a forged request needs no recovery |
| `B12-F-012` | Unknown webhook provider route | no route match | **no receipt** | no | none | `404` metric | none |
| `B12-F-013` | Webhook body exceeds the ceiling | size gate before full read | rejected pre-verification | no | none | abuse metric | provider-side |
| `B12-F-014` | Verified webhook, binding resolves to 0 or >1 workspaces | resolution step | receipt stored, `workspace_id` NULL, quarantined | no | **none — never guessed** | `P-7` case + alert | operator maps the binding |
| `B12-F-015` | Duplicate webhook delivery | dedup key collision | second receipt `duplicate` | n/a | **none** | metric | none — `200` per frozen policy |
| `B12-F-016` | Same dedup key, different payload hash | hash mismatch | second receipt stored, **application withheld** | no | none until adjudicated | `P-6` case + alert | operator adjudicates |
| `B12-F-017` | Malformed but signature-valid payload | normalization failure | receipt `processed` with no effect | no | none | metric | `200`, per frozen B5 §6 |
| `B12-F-018` | Unrecognized event type, signature-valid | no normalizer | receipt `processed`, zero effect | no | none | metric | `200`; a future provider event is not a fault |
| `B12-F-019` | Webhook receipt stuck in `queued` | age past processing window | receipt `queued` | yes | delayed | `P-4` case | re-enqueue |
| `B12-F-020` | Meta not acknowledged within 3s | provider retries for 36h (`B12-X-003`) | receipts accumulate as duplicates | n/a | none — dedup absorbs | latency alert | fix latency; dedup already protects |
| `B12-F-021` | **Tap callback lost past its 3 attempts** (`B12-X-006`) | absence — nothing arrives | payment state stale | n/a | **payment truth stale until reconciled** | `P-1`/B8 sweep | **`retrieve_charge`** — the guarantee, not a fallback (`B12-D-A025`) |
| `B12-F-022` | Provider connect timeout | adapter | attempt `known_failure` (request never left) | **yes, safe even for non-idempotent ops** | none | metric | ordinary retry |
| `B12-F-023` | **Provider read timeout after the request was sent** | adapter | attempt **`unknown`** | **no repeat** | none until settled | `P-1` case | lookup / callback / escalate |
| `B12-F-024` | Provider `429` | status | attempt `known_failure`, `retry_after` recorded | yes (6) | delayed | rate-limit metric | honor `Retry-After` |
| `B12-F-025` | Provider `5xx` | status | attempt `known_failure` | yes (5) | delayed | metric | backoff |
| `B12-F-026` | Provider returns a malformed/unparseable body | parse failure | attempt **`unknown`** | no repeat | none | `P-1` + alert | lookup |
| `B12-F-027` | Provider returns an unrecognized status code | classifier | mapped to **`unknown`**, never success | no repeat | none | alert | lookup — fail-closed per `B12-D-A023` |
| `B12-F-028` | Credential revoked mid-operation | `401`/`403` | attempt `known_failure`; `credential_valid=false`; connection `error` | **no** (frozen "Authorization, no, 1") | new work fails fast | **health alert** | operator reconfigures |
| `B12-F-029` | Credential rotated during a retry | none needed | reference resolved at call time | yes | none | audit entry | automatic |
| `B12-F-030` | Provider disabled while work is queued | admission re-check at execution | execution `failed` · `provider_disabled` | no | intent unfulfilled, explicitly | operator sees the disable | re-enable, then replay |
| `B12-F-031` | Provider configuration invalid at check | check outcome | `422 PROVIDER_CONFIGURATION_INVALID`; connection `error` | no | none | health surface | reconfigure |
| `B12-F-032` | No safe configuration check exists for a provider | capability | check outcome `unavailable` | n/a | none | **reported as a capability limitation** | accepted; never faked |
| `B12-F-033` | Reconciliation scan itself fails | scan error | cursor not advanced | yes | **none — detection is not a control** | metric | next window resumes |
| `B12-F-034` | Reconciliation repair refused by the domain command | command returns a guard failure | case stays **`open`** | n/a | none | case remains visible | correct outcome; escalate to the domain |
| `B12-F-035` | Dead-letter replay conflicts with current domain state | domain command guard | record returns to `open`, `replay_count` +1 | operator judgement | **none — the guard held** | replay outcome shown | investigate |
| `B12-F-036` | Replay attempted on a non-idempotent op with `unknown` outcome | `replay_eligible = false` | unchanged | **no** | none | `409 CONFLICT` · `dead_letter_not_replayable` | resolve the unknown first |
| `B12-F-037` | Replay would exceed a domain budget | budget check | unchanged | no | none | `409`/`403` | correct refusal |
| `B12-F-038` | Cross-workspace replay attempted | Doctrine R-1 + post-resolution re-assertion | unchanged | no | none | `404` | **cross-workspace authorization alert** (frozen alert class) |
| `B12-F-039` | Unsupported event `schema_version` | version check | execution `failed`; **event retained** | no, until deployed | delayed | alert | deploy the handler, then replay |
| `B12-F-040` | Deployment version skew (N publishes, N-1 consumes) | unknown field / version | consumer ignores unknown fields per §compat rule | yes | none | metric | rolling deploy completes |
| `B12-F-041` | Rate-limit race under concurrency | durable reservation refuses the (N+1)th | budget row exact | n/a | **none — budget held** | metric | none |
| `B12-F-042` | Redis abuse counters flushed | none | budgets unaffected (PostgreSQL) | n/a | **none** | metric | counters refill |
| `B12-F-043` | Secret reference missing at call time | resolution failure | attempt **not created**; no call made | no | new work fails fast | `PROVIDER_CONFIGURATION_INVALID` | configure |
| `B12-F-044` | Database deadlock between B12 paths | PostgreSQL | transaction rolled back | yes | none | metric | fixed lock order makes it structurally near-impossible; retry the transaction |
| `B12-F-045` | Lock/lease timeout while claiming | lease expiry | row reclaimed | yes | none | metric | `SKIP LOCKED` + lease reaping |
| `B12-F-046` | Health check itself exhausts provider quota | `429` on check | check `failed` | yes | **none — checks never spend business quota** | metric | check endpoint is rate-limited (`429` declared) |
| `B12-F-047` | Outbox row dead-lettered | budget exhausted | `dead_lettered` + `DeadLetterRecord` | replay **always eligible** | announcement stuck; **domain state correct** | dead letter + alert | replay after fixing the cause |

| `B12-F-048` | **Outbox lease expires while the dispatcher is still alive; another reclaims** | the stale claimant's fenced update matches 0 rows | row owned by the new claimant under a fresh `lease_token`; state intact | the stale write is **discarded, never retried** | **none** — duplicate delivery absorbed at the consumer | `outbox_stale_completion_total` metric | none needed (`B12-D-A055`, `B12_OUTBOX_MODEL.md` window 5) |
| `B12-F-049` | **Validly-signed callback carries another workspace's provider object** | `P-5` on application; binding ≠ object owner | receipt bound to the **signing** workspace; `dedup_key` in that binding's namespace | no | **none** — domain command refuses; **and the rightful workspace's later callback is not swallowed** | `P-5` case + cross-workspace metric | report-only; the rightful callback processes normally (`B12-D-A056`) |
| `B12-F-050` | **Credential rotated on a `connected` integration** | `ConfigureIntegration` on a material field | `status → configuration_required`; `enabled` untouched | n/a | new outbound work fails fast `409 provider_not_configured`; **inbound still receipted** | health surface shows the status drop | run the safe check (`B12-D-A051`) |

`FAILURE_SCENARIO_COUNT = 50`, counted as the rows above. **Three were added in B12-FIX.1** (`048`-`050`), one per repaired race.

## Coverage of the frozen failure matrix

Frozen `BACKEND_FAILURE_MATRIX.md`'s provider/webhook/worker rows are realized rather than contradicted: transport failures land in `B12-F-022`…`B12-F-027`, webhook failures in `B12-F-011`…`B12-F-020`, and worker failures in `B12-F-004`…`B12-F-010`. The frozen "Storage upload failure" row remains B11's, realized by B11's own catalog.

## The pattern worth naming

Across 47 scenarios, **exactly one** produces a wrong business state if mishandled, and it appears three times: `B12-F-023`, `B12-F-026`, `B12-F-027` — the unknown outcome. Every other failure is a delay, a duplicate that a constraint absorbs, or an explicit refusal. That concentration is why `B12_UNKNOWN_OUTCOME_MODEL.md` is the pack's safety-critical document and why `B12-D-A020` has no override.
