# B12 — Reconciliation Model

> Design only. Adds one row to frozen `BACKEND_RECONCILIATION.md` (`B12-AM-009`) and realizes it. B12 defines *platform* reconciliation semantics; every **domain** reconciliation listed in that frozen table stays with its domain.

## 1. Doctrine, inherited verbatim

Frozen `BACKEND_RECONCILIATION.md` governs without modification: *"Repairs are explicit, permissioned, idempotent, and audited. Admin cannot edit financial truth directly with SQL. Every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time. Reconciliation must not guess or overwrite a newer authoritative provider state without a documented precedence rule."*

Two B12-specific consequences:

- **Detection and repair are separate.** A scan opens a `PlatformReconciliationCase`; it never mutates a domain aggregate. Repair is always an ordinary, guarded, audited **domain** command.
- **The documented precedence rule** the frozen text demands: **PostgreSQL wins on intent; the provider wins on external effect.** Whether WazLink *decided* to send is our row; whether the message *left* is the provider's answer. Neither is ever asserted against the other's question.

## 2. B12 adds one row, not nine

Frozen `BACKEND_RECONCILIATION.md` already lists eight processes (Payments, Subscriptions, Provider delivery, Discovery, Scraping, Webhooks, ZATCA, Usage), each owned by its domain. B12 **does not absorb them**. `B12-AM-009` adds a single row for the substrate itself:

> *"Platform async/integration | outbox, receipts, executions, provider attempts vs. durable domain state | every 15 min | Platform operations with domain escalation"*

Absorbing the eight would make B12 the reconciler of every domain's business truth — the exact authority leak the frozen `Jobs` row forbids.

## 3. Eight platform mismatch classes

| Class | Detection | Precedence | Repair | Auto? |
|---|---|---|---|:--:|
| `P-1` | `provider_request_attempts.outcome = 'unknown'` past its settlement window | provider wins on external effect | **read-only status lookup** where the capability exists; else await callback; else escalate. **Never a mutating repeat** | lookup: yes · resolution: **no** |
| `P-2` | `outbox_events` in `pending`/`failed` past its dispatch window | postgres wins | re-claim and re-dispatch under the attempt budget | **yes** |
| `P-3` | `worker_executions` in `running` with no heartbeat past the job ceiling | postgres wins | classify as `unknown` (the provider attempt row decides) then `P-1`; **never** assume failure | **no** |
| `P-4` | `webhook_receipts` stuck in `queued` past its processing window | postgres wins | re-enqueue; the receipt is durable so nothing is lost | **yes** |
| `P-5` | verified receipt referencing a provider object WazLink does not know | neither — insufficient information | **report only.** A message ID we never issued may be another tenant's, a test, or a provider bug | **no** |
| `P-6` | same dedup key, different `payload_hash` | neither | **report only**; domain application withheld (`B12_IDEMPOTENCY_MODEL.md` §4) | **no** |
| `P-7` | receipt whose binding resolved to zero or several workspaces | neither | **report only**, quarantined — frozen `B8_WEBHOOK_MODEL.md` §3's *"never guessed"* | **no** |
| `P-8` | `IntegrationConnection` whose last check is stale or whose credential was rejected | provider wins on credential validity | re-run the **safe** configuration check | **yes** |

**Five of eight are report-only or operator-gated.** The split is not timidity: automatic repair is safe exactly where the correct action is unambiguous *and* the wrong action is recoverable. For `P-1`, `P-3`, `P-5`, `P-6`, and `P-7` it is neither — each involves either real money, a customer-visible message, or a possible tenancy boundary.

## 4. Case record

`platform_reconciliation_cases`: `id`, `public_id` (operator-internal, no registered prefix — the `platform_dead_letters` precedent), `workspace_id` (nullable for `P-5`/`P-7`), `mismatch_class`, `subject_type`/`subject_ref` (opaque), `fingerprint`, `state` (`open`/`repaired`/`dismissed`), `evidence` (JSONB: observed vs. expected, provider request reference — **never a URL, never a credential, never a raw payload**), `detected_at`, `attempted_repair` (the command name invoked, if any), `resolved_by_membership_id`, `resolution_reason` (**mandatory when `dismissed`**), `next_review_at`, `request_id`.

`UNIQUE (fingerprint, mismatch_class) WHERE state = 'open'` — a scan running every 15 minutes opens **one** case per real problem, not one per scan. This is the single canonical statement of the reconciliation-case identity, and `B12_IDEMPOTENCY_MODEL.md` class 8 and `B12_DATA_MODEL.md` §8 restate it unchanged.

> **`workspace_id` is not in the key, deliberately.** Both key columns are `NOT NULL`, while `workspace_id` is nullable by design — a `P-5` (unknown provider object) or `P-7` (unresolvable binding) case has no workspace to attribute. Including a nullable column would mean two identical global cases never collide under SQL `NULL` semantics, and the 15-minute sweep would open a new case every window forever. Workspace scoping is preserved *inside* `fingerprint`, which is computed over the workspace where one exists, so two workspaces observing the same subject still get distinct cases. `workspace_id` remains the authorization and filtering column it should be. This satisfies the frozen requirement's full list — status, evidence, attempted repair, operator, request ID, next review time — field by field, and mirrors `B9`'s `(workspace_id, fingerprint)` and `B11`'s `(file_id, mismatch_class)` precedents.

## 5. Repair is always someone else's command

> **`B12-D-A039`. A reconciliation repair never writes a domain table. It invokes the owning domain's own guarded, audited command, which re-checks its own preconditions and may refuse.**

A `P-1` case on a payment does not set `Payment.status`; it invokes B8's `ReconcilePayment`, which is a frozen B8 command with frozen B8 guards. A `P-1` on a message does not set `Message.status`; B5's own status-application path does, with its monotonicity rule intact. If the domain command refuses, the case stays open — that is the correct outcome, not an error to work around. `RECONCILIATION_AUTHORITY_LEAKS = 0`; negative controls `AT-B12REC-5`, `AT-B12FW-4`.

## 6. Cursors and checkpoints

Each scan is a bounded, resumable batch with a stable order and a persisted cursor, so a crash mid-run resumes rather than restarts and a single pathological workspace cannot starve the rest. Scans are **idempotent by construction**: every action is a guarded command whose guard is already false once it has happened, and the partial unique index makes a duplicate case impossible.

## 6a. Operator surface

Cases are read and resolved through three operator API operations — `GET /operations/reconciliation-cases`, `GET /operations/reconciliation-cases/{id}`, and `POST /operations/reconciliation-cases/{id}/resolve` (`B12_API_DTO_CONTRACTS.md` §1, operations 12-14, added in B12-FIX.1). Reads require `platform.operations.view`; `ResolvePlatformReconciliationCase` requires `platform.operations.replay`, because resolving a case may invoke a repair that re-enters a domain command. There is no other invocation path, and no case is mutable by any means that bypasses those operations. `UNOWNED_OPERATOR_SURFACES = 0`.

## 7. What belongs to B13

Cadence tuning beyond the frozen table's figures, alert routing, escalation policy, on-call runbooks, and dashboards. B12 names the classes, their precedence rules, their repair commands, and their auto/manual split (`B12_B13_BOUNDARY.md`).
