# B14_32 — Class B Tuned Value Register

> **Added by `B14-FIX.1` to close `V-06` (E).** `B13_B14_BOUNDARY.md` §2 leaves B14 *"the exact tuned values for every Class B decision"* — naming rate-limit figures, HSTS escalation timing, backup cadence, restore-test cadence, alert thresholds and log-sampling rates. The pre-fix pack contained **none** of them.

## 1. Scope and the one rule that governs it

This register holds **only** values B13 leaves to B14. It **does not duplicate a value already frozen in B0–B13** — a duplicated value is a second authority, and the first time the two diverge the frozen one is silently wrong.

`B13_DECISION_REGISTER.md` §2 holds **29** Class B rows (`CLASS_B_DECISION_COUNT = 29`).

### Carry-forward rows are not approvals — inherited verbatim

`B13_DECISION_REGISTER.md` §2 closes with:

> *"**Carry-forward rows are not approvals.** `B13-D-B010`, `B13-D-B011`, `B13-D-B013` and `B13-D-B014` restate values frozen `B11-D-B007` holds open as `PRODUCT DECISION REQUIRED`. They are Class B because B13 records them, not because B13 closes them."*

**B14 applies the identical discipline and closes none of them.** They appear in §5 as *carried, still open*. Converting a frozen open product decision into settled policy by restating it in B14 would repeat exactly the defect `B13-FIX.2` corrected.

| Column | Meaning |
|---|---|
| **Value** | The operational figure B14 sets |
| **Env** | Where it applies |
| **Owner** | Who may propose a change |
| **Source** | Why this figure — never "seemed reasonable" |
| **Authority** | Who may approve a change |
| **Test/monitor** | What proves it is in force |
| **Safe default** | Behaviour if unset |

## 2. Security values

| ID | Item | Value | Env | Owner | Source | Authority | Test/monitor | Safe default |
|---|---|---|---|---|---|---|---|---|
| `CB-01` | HSTS `max-age` — **initial** | **86400** (1 day) | staging, prod | Platform | `B13-D-B005` adopts short-then-long escalation and **rejects preload in Phase 1**. A short first window keeps a misconfiguration recoverable | Security | response-header assertion | **unset ⇒ no HSTS**, never a long value |
| `CB-02` | HSTS `max-age` — **escalated** | **31536000** (1 year) | prod | Platform | Applied only after `CB-01` has run **≥ 30 days with no TLS incident**. `includeSubDomains` on; **`preload` stays off** (`B13-D-B005`) | Security | header assertion + escalation record | remain at `CB-01` |
| `CB-03` | `WEBHOOK_MAX_BODY_BYTES` | **1 MiB** | all | Platform | `B13-D-B008` defers the figure to implementation. Sized above the largest realistic Meta/Tap callback and far below a memory-pressure body. Enforced **before** parse, after signature verification ordering (`FI-B12-17`) | Security | `T-CB-3`: oversized body rejected pre-parse | **reject** — never unbounded |
| `CB-04` | Provider health/config-test abuse limit | **10 / operator / hour / connection** | all | Platform | `B13-D-B015` requires a limit distinct from domain budgets. Test Connection makes a real provider call | Security | rate-limit counter | **deny** past the ceiling |
| `CB-05` | Secret rotation cadence | **annual**; **immediate** on suspected compromise | all | Security | `B13-D-B007` verbatim | Security | rotation audit rows (metadata only, **never a value**) | treat as due |
| `CB-06` | Redis ACL scoping | **enabled** — separate broker/worker and cache/rate-limit identities | staging, prod | Platform | `B13-D-B017`, *"where the deployed Redis version supports it"*. Redis 8 supports ACLs (`B14_29` §2) | Platform | connection-identity assertion | single identity + recorded exception |

**`B13-D-B002` (password policy ≥15, blocklist screening) is not re-tuned here.** B13 settled it against NIST SP 800-63B-4; B14 implements it unchanged. Restating the number would create a second authority.

## 3. Rate limits — only what B12/B13 leave open

Frozen `B13_RATE_LIMIT_ABUSE_MODEL.md` fixes the **four classes** and `FI-B12-18` fixes the **per-workspace fairness rule and the store per layer**. Neither is re-decided. Only unfixed figures appear.

| ID | Item | Value | Env | Owner | Source | Authority | Test/monitor | Safe default |
|---|---|---|---|---|---|---|---|---|
| `CB-07` | Auth attempts / IP | **10 / 15 min** | all | Security | Credential-stuffing signal is a frozen B13 alert; the figure is not frozen. Keyed on `client_ip()` from `B14_31` §5 | Security | `authz` counters | **deny** past ceiling |
| `CB-08` | Auth attempts / account | **5 / 15 min** | all | Security | Account-targeted lockout, independent of IP so a rotating-IP attack still trips it | Security | counters | deny |
| `CB-09` | Password reset requests / account | **3 / hour** | all | Security | Bounds enumeration and mail flooding | Security | counters | deny |
| `CB-10` | Tenant API burst | **600 / min / workspace** | all | Platform | Below any provider ceiling; DRF throttling is **defence-in-depth only** — the PostgreSQL/Redis-backed limit is authoritative (`B13-D-B006`) | Platform | `queue_delay_ms`, `429` rate | deny |
| `CB-11` | Import batch rows | **50 000 / batch** | all | Product | `ID-05`'s *conservative default*. Bounds a `default`-queue batch. **Not a frozen product decision** — `PD-008` remains open | Product | `import_rows_total` | reject with a typed error |

**`CB-07`–`CB-09` are only meaningful because `B14_31` §5 makes the client IP unforgeable.** With a spoofable IP these figures are decoration — which is why that document is a blocker for them.

## 4. Observability values

| ID | Item | Value | Env | Owner | Source | Authority | Test/monitor | Safe default |
|---|---|---|---|---|---|---|---|---|
| `CB-12` | Log sampling — routine 2xx reads | **10 %** | prod only | Platform | `B13-D-B018`: sampling is tunable, but **errors, financial, webhook and audit events are NEVER sampled** | Platform | sampled-vs-emitted ratio | **no sampling** (emit everything) |
| `CB-13` | Never-sampled classes | errors · financial · webhook · audit · security | all | — | `B13-D-B018` verbatim — **not tunable** | — | `T-CB-12` | never sampled |
| `CB-14` | Trace sampling | **5 %**; **100 % of error traces** | prod | Platform | `B14_22` §4: sampling configurable, error traces always kept | Platform | trace volume | 100 % |
| `CB-15` | Outbox backlog alert | **warn > 500 pending 5 min · page > 5 000 or oldest > 15 min** | staging, prod | Platform | `B13-D-B019` initial defaults, tunable without architecture review. Bound to `outbox_pending_gauge` | Platform | alert + **panel** (`B13-D-B020`) | alert on any backlog |
| `CB-16` | Queue delay alert | **warn > 60 s · page > 300 s** (`providers.slow` exempt to its 30 min ceiling; **`maintenance` exempt — deliberately starvable**, `FI-B12-10`) | staging, prod | Platform | `B13-D-B019` | Platform | `queue_delay_ms{queue}` | alert |
| `CB-17` | Dead-letter growth alert | **warn > 10 open / domain · page > 50 or any open > 24 h** | staging, prod | Platform | `B13-D-B019`; `platform_dead_letters_open_gauge{owning_domain}` | Platform | alert + panel | alert |
| `CB-18` | Reconciliation case growth | **warn > 20 open · page > 100**; **any `P-1` open > 4 h pages** | staging, prod | Platform | `P-1` is an unresolved provider outcome — a possible duplicate charge or message | Platform | alert + panel | alert |
| `CB-19` | Webhook failure rate | **warn > 1 % / 15 min · page > 5 %** | staging, prod | Platform | `B13-D-B019` | Platform | `webhook_receipts_total{provider,status}` | alert |
| `CB-20` | Provider `credential_valid=false` | **page immediately** | staging, prod | Platform | Frozen: `401`/`403` ⇒ `credential_valid=false`, **no automatic retry**. Only a human can fix it | Platform | `integration_health_gauge` | page |
| `CB-21` | Import stuck in `committing` | **warn > 30 min · page > 2 h** | staging, prod | Platform | `B14_22` §7 names the alert; the figure was unset | Platform | alert + panel | alert |
| `CB-22` | SLA breach volume | **warn > 10 / hour / policy** | prod | Product | `B14_22` §7 names the alert; the figure was unset | Product | `ticket_sla_breach_total{policy}` | alert |

**Every alert requires a dashboard panel before production enablement** (`B13-D-B020`) — a hard precondition, not a convention.

## 5. Backup, restore and DR

| ID | Item | Value | Env | Owner | Source | Authority | Test/monitor | Safe default |
|---|---|---|---|---|---|---|---|---|
| `CB-23` | Backup cadence | **daily full + continuous WAL archiving** | staging, prod | Platform | `B13-D-B021` (proposed) — adopted | Platform + Ops | backup-success alert (frozen B0's fourth requirement, `AT-B13BAK-6`) | **deploy refused** without backups |
| `CB-24` | Backup retention | **35 days** full + WAL | prod | Ops | Covers `CB-25`'s monthly cycle with margin | Ops + Legal | retention monitor | 35 days |
| `CB-25` | Restore test | **monthly, automated, to staging** | staging | Platform | `B13-D-B023` (proposed cadence) — adopted. *"A restored-but-never-tested backup is not a backup"* | Platform + Ops | restore-test record; **a missed cycle blocks the production gate** | treat as failed |
| `CB-26` | DR drill | **quarterly, full** | prod | Ops | `B13-D-B024` (proposed) — adopted | Ops | drill record | treat as due |
| `CB-27` | Pre-incident snapshot retention | **≥ 7 days after operation confirmation** | prod | Ops | `B13-D-B022` verbatim | Ops | snapshot inventory | retain |
| `CB-28` | **RPO / RTO** | **NOT SET — `B13_DECISION_REGISTER.md` §3 Class C** | — | Product + Ops | B13 marks targets **explicitly proposed**, requiring approval. **B14 does not close a Class C item** | Product + Ops | — | mechanism operates; **targets unpublished** |

## 6. Carried, still open — B14 closes none of these

| ID | Item | Status | Frozen holder |
|---|---|---|---|
| `CB-29` | `MAX_FILE_BYTES` (25 MiB) | **carried, `PRODUCT DECISION REQUIRED`** | `B11-D-B007` via `B13-D-B010` |
| `CB-30` | `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` (5 GiB) | **carried, `PRODUCT DECISION REQUIRED`** | `B11-D-B007` via `B13-D-B011` |
| `CB-31` | Download-ticket TTL (5 min, single-use) | **carried, `PRODUCT DECISION REQUIRED`** | `B11-D-B007` via `B13-D-B013` |
| `CB-32` | File retention timers (intent ≈1 h · orphan ≈7 d · purge ≈30 d; **never `legal`-class**) | **carried, `PRODUCT DECISION REQUIRED`** | `B11-D-B007` via `B13-D-B014` |
| `CB-33` | Dependency patch window (7 days, Critical/High) | **carried** — `B13-D-B026` proposes it | `B14_34` §4 |
| `CB-34` | Password hasher | **deferred to Django's current recommended default at implementation time** | `B13-D-B001` |
| `CB-35` | Tap `x_created` freshness window | **not adopted in Phase 1** — `B13-D-B009` permits it only as defence-in-depth **once semantics are confirmed**, never the primary replay control | `B13-D-B009` |

Implementation uses these values; **B14 does not mark them settled.** The distinction is the whole point of the row.

## 7. Change discipline

1. A value here changes by a **recorded decision naming an approver**, never silently (`B13-D-B002`'s own standard).
2. A value in the **Never-tunable** class (`CB-13`) may not change at all.
3. **A tuned value may never be used to work around an architectural bound.** `MAX_JOB_ATTEMPTS` and `MAX_ACTOR_RETRIES_PER_JOB` are *"architectural bounds, not outage tuning knobs"* (`B14_16` §5) and appear nowhere in this register.
4. No value here may weaken a frozen control. `CB-01`/`CB-02` may not disable HSTS in production; `CB-12` may not sample a `CB-13` class.

## 8. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CB-1` | staging/prod settings | Inspect responses | HSTS present at `CB-01` or `CB-02`; **`preload` absent** (`B13-D-B005`) |
| `T-CB-2` | Register vs frozen corpus | Cross-check every row | **No row duplicates a value frozen in B0–B13**; `CB-29`–`CB-32` are marked carried, not settled |
| `T-CB-3` **(NC)** | Webhook endpoint | POST body > `CB-03` | Rejected **before parse**; no domain code runs |
| `T-CB-12` **(NC)** | Production logging at `CB-12` | Emit error, financial, webhook, audit and security events | **None is sampled away** — all present |
| `T-CB-15` | Alert config | Enumerate alerts | Every alert has a **panel** (`B13-D-B020`) and a **runbook** (`B14_22` §7) |
| `T-CB-20` | Provider returns `401` | Observe | `credential_valid=false`, **page raised, no automatic retry** |
| `T-CB-25` | Production gate | Check restore-test record | **Missing or failed monthly restore blocks the gate** |
| `T-CB-28` **(NC)** | Register | Inspect `CB-28` | RPO/RTO remain **unset**; no B14 document publishes a target |
