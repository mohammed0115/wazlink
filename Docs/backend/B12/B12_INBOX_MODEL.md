# B12 — Inbox Model

> Design only. Two inboxes exist in WazLink and they are **not** the same thing. Conflating them is the defect this document prevents.

## 1. Two inboxes, one owned

| | **External inbox** | **Internal inbox** |
|---|---|---|
| Dedups | provider callbacks (Meta, Tap, scraper) | cross-domain WazLink events |
| Table | `webhook_receipts` (**frozen**, `BACKEND_DATA_MODEL.md` line 26) | one table **per consuming domain** |
| Public ID | `WHR-*` (**frozen** registry) | none — child bookkeeping |
| Owner | **B12** | **the consuming domain** |
| Dedup key | `(provider, provider_event_identity)` + payload hash | `(workspace_id, source_event_id)` |
| Precedent | frozen `Webhooks` domain row | `automation_inbox_records` (`B7_DATA_MODEL.md` §6) |

> **`B12-D-A008`. B12 owns the external inbox and specifies — but does not own — the internal one.** Frozen `B7_DATA_MODEL.md` §6 already drew this line: `automation_inbox_records` is *"B7's own inbox-side dedup boundary, distinct from … `WHR-*` `WebhookReceipt` (that table dedups external provider callbacks; this one dedups internal cross-domain events)."* B12 ratifies that split instead of centralizing it.

## 2. External inbox — `webhook_receipts`

Realizes the frozen `Webhooks` row's charter verbatim: *"verify, receipt, hash, deduplicate, enqueue, fast acknowledge"* (`BACKEND_INTEGRATION_BOUNDARIES.md` line 17), with the frozen forbidden coupling **"no direct domain mutation."**

The frozen six-state machine is adopted **unchanged** (`BACKEND_STATE_MACHINES.md`: *"WebhookReceipt is `received→verified→queued→processed/failed/duplicate`."*). Full pipeline in `B12_WEBHOOK_GATEWAY.md`; security in `B12_WEBHOOK_SECURITY.md`; dedup and ordering in `B12_WEBHOOK_DEDUP_ORDERING.md`.

**Fields the receipt carries** (full DDL in `B12_DATA_MODEL.md` §2): provider, resolved `workspace_id` (nullable until §`B12_WEBHOOK_SECURITY.md` §4 resolves it), provider event identity where one exists, `payload_hash` (the frozen index), verification state, processing state, attempt count, error class, `received_at`, `provider_occurred_at` (nullable), `processed_at`, `request_id`.

**Raw vs normalized.** The receipt stores a **hash** and a **normalized** projection, never the raw body by default (`B12_WEBHOOK_GATEWAY.md` §6). Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` already requires that *"raw payload retention is restricted and time-bounded"*; B12 honors it and declines to invent a duration (`B12-D-B004`).

## 3. Internal inbox — the obligation B12 imposes

> **`B12-D-A009`. Every domain that consumes a B12-dispatched event MUST hold a durable, workspace-scoped uniqueness constraint on the envelope's `event_id`, in its own schema, enforced by the database rather than by application logic.**

The contract each consumer owes:

| Requirement | Why |
|---|---|
| Constraint is `UNIQUE (workspace_id, source_event_id)` (or a superset) | duplicate delivery loses the insert; no lock, no read-then-write race |
| Constraint lives in the consuming domain's schema | the consumer keeps its own dedup guarantee; B12 cannot become a single point of correctness for eleven domains |
| Consumption and dedup insert commit in **one transaction** | otherwise a crash between them re-opens the duplicate window |
| Duplicate is a **silent no-op**, not an error | redelivery is normal operation, not a fault (frozen ADR-005's own posture) |

**Satisfied today by:** `automation_inbox_records` `UNIQUE (workspace_id, source_event_id)` (`B7_DATA_MODEL.md` §6) — the only Phase-1 internal consumer that exists. B7 additionally holds a *second* layer, `uq_automation_runs_event_rule`, at the execution layer (`B7_IDEMPOTENCY_MODEL.md` §4a); B12 does not require the second layer, and notes it as the pattern a consumer should copy where the effect is expensive.

**B12 registers no consumer of its own.** `CONSUMED_EVENT_COUNT = 0` (`B12_COMMAND_EVENT_CATALOG.md` §4).

## 4. Why not one central inbox table

Rejected as `B12-D-A008`'s alternative, for three reasons:

1. **It would make B12 a business authority.** Deciding "this event was already consumed" is a statement about the *consumer's* effects, which only the consumer can make. A shared table would encode eleven domains' idempotency in one place B12 owns — precisely the frozen `Jobs` row's forbidden *"no domain ownership."*
2. **Different consumers need different keys.** B7's identity excludes `rule_revision_id` on purpose (`B7-D-A040`); a generic table could not express that without becoming a schema of special cases.
3. **A shared row is a shared failure.** One poison event blocking a shared table stalls every domain; a per-domain table fails only its own consumer.

## 5. Replay of an inbox row

Replaying an internal event means asking the consumer to process `event_id` again — which its constraint will refuse. That is the correct answer: replay of an already-consumed event is a no-op, not a re-execution (`B12_DEAD_LETTER_REPLAY_MODEL.md` §4). Genuine re-execution requires a **new** business intent with a new `event_id`, issued by the domain that owns it.
