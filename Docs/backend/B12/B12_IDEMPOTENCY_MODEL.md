# B12 — Idempotency Model

> Design only. Built **on** frozen `BACKEND_IDEMPOTENCY_STANDARD.md` without extending or replacing it. The frozen standard governs layer 1; this document governs layers 3–6 and states how they compose.

## 1. Nine idempotency classes, nine different keys

> **`B12-D-A016`. There is no single idempotency key in WazLink.** Nine classes exist, each with its own key source, scope, and store. Reusing one key across layers is the defect this table exists to prevent: a client `Idempotency-Key` cannot dedup a provider retry, and a provider event ID cannot dedup a client command.

| # | Class | Key | Scope | Authority | Retention | Duplicate behavior | Mismatch behavior |
|---:|---|---|---|---|---|---|---|
| 1 | **Public API command** | `Idempotency-Key` header + workspace + principal + endpoint + body hash (**frozen**) | workspace + principal | PostgreSQL `IdempotencyRecord` | 24h normal / **7d payment & webhook** (frozen) | replay stored terminal response | `409 IDEMPOTENCY_CONFLICT` (frozen) |
| 2 | **Internal command** (system actor) | derived from the originating aggregate's PK + effect type | workspace | the domain's own constraint | life of the row | no-op | `409 CONFLICT` |
| 3 | **Outbox dispatch** | `outbox_events.event_id` + lease | global | `outbox_events` row + `FOR UPDATE SKIP LOCKED` | until pruned | second dispatcher skips the locked row | n/a — the tuple *is* the input |
| 4 | **Celery task execution** | the consumer's durable constraint + state precondition under row lock | workspace | consuming domain | life of the row | no-op, silent | n/a |
| 5 | **Provider outbound request** | `provider_request_attempts` `(source_type, source_ref, effect_type)` + the provider's own key **where one demonstrably exists** | workspace + provider | `provider_request_attempts` | life of the source row | reconcile before repeating (`B12_UNKNOWN_OUTCOME_MODEL.md` §4) | n/a |
| 6 | **Provider webhook** | `(provider, dedup_key)` where `dedup_key = integration_connection_id : provider_event_identity` (**frozen** constraint `BACKEND_DATA_MODEL.md` line 26: *"provider/dedup key unique; payload hash index"*, honored verbatim; composition per `B12-D-A056`) | **the verified binding**, hence the workspace — never global (`B12_WEBHOOK_DEDUP_ORDERING.md` §2a) | `webhook_receipts` | append-oriented (frozen: *"not casually deleted"*) | `200` + receipt marked `duplicate` (frozen state) | different hash, same identity ⇒ **new** receipt, flagged for reconciliation |
| 7 | **Domain event consumption** | `(workspace_id, source_event_id)` | workspace | the **consuming domain's** table | domain's own window | no-op | n/a |
| 8 | **Reconciliation command** | `(fingerprint, mismatch_class)` where `state = 'open'` — **both columns `NOT NULL`**; `workspace_id` is scope metadata, **not** part of the identity (`B12_DATA_MODEL.md` §8) | platform, with the workspace folded **into** `fingerprint` where one exists | `platform_reconciliation_cases` partial unique | until resolved | joins the existing open case | n/a |
| 9 | **Operator replay** | a fresh `Idempotency-Key` **plus** the dead-letter row's `replay_of` link | workspace + operator | `platform_dead_letters` | life of the record | `409 CONFLICT` · `dead_letter_not_replayable` | `409 IDEMPOTENCY_CONFLICT` |

`IDEMPOTENCY_SCOPE_GAPS = 0` rests on this table: every layer in `B12_ASYNC_EXECUTION_MODEL.md` §1 appears in exactly one row, with a named store that is not Redis.

> **Two keys were corrected in B12-FIX.1, and both corrections narrowed a scope rather than widening one.** Class 6 gained its binding prefix, so one tenant can no longer consume another's receipt identity (`B12-D-A056`). Class 8 dropped `workspace_id` from its identity, because a nullable column inside a uniqueness key defeats itself under SQL `NULL` semantics — a `P-5`/`P-7` case has no workspace, and two such cases must still collide. `RECONCILIATION_IDEMPOTENCY_CONTRADICTIONS = 0`; the three documents that state this key — here, `B12_DATA_MODEL.md` §8, and `B12_RECONCILIATION_MODEL.md` §4 — now agree word for word. Negative control `AT-B12REC-8`.

## 2. Composition — why nine keys are not nine chances to fail

The classes **stack**; they do not compete. A single user action passes through several, and each one narrows the space of possible duplicate effects:

```
user clicks "send"
  → class 1  stops a double-submitted HTTP request
  → class 3  stops two dispatchers publishing the same event
  → class 4  stops two workers acting on one delivery
  → class 5  stops a second provider call after an unknown outcome
  → class 6  stops Meta's 36-hour retry (B12-X-003) creating a second Message
  → class 7  stops B7 running the same rule twice for one event
```

Removing any one of them leaves a real, reachable duplicate. That is the argument for nine rather than one.

## 3. The provider-key rule

> **`B12-D-A012`. B12 uses a provider-supplied idempotency key only where `B12_PROVIDER_RESEARCH_REGISTER.md` records evidence that the provider offers one. No Phase-1 provider currently does.**

Frozen `BACKEND_IDEMPOTENCY_STANDARD.md` says *"Provider requests use provider-specific keys derived from the internal idempotency record"* — B12 honors the derivation rule and adds the honest caveat that a derived key is only *useful* if the provider honors it. Research found:

- **Meta WhatsApp Cloud API** — no client-supplied idempotency key documented (`B12-X-011`, UNRESOLVED).
- **Tap Payments** — none documented (`B12-X-012`, UNRESOLVED).
- **Google Places (New)** — the usage-and-billing page *"does not mention idempotency keys, request identifiers, or specific HTTP status codes related to quota exceeded errors"* (`B12-X-010`, UNRESOLVED).
- **OpenAI** — the advanced-usage documentation was not reachable during this pass (`B12-X-013`, UNRESOLVED).

**Consequence, stated so it cannot be forgotten:** because no provider idempotency key is confirmed, class 5 rests entirely on `provider_request_attempts` + status lookup + reconciliation. `PROVIDER_CAPABILITY_ASSUMPTION_GAPS = 0` is true precisely because the design assumes *none* of these capabilities. If a later pass verifies one, it becomes an **optimization** that removes a lookup — never a load-bearing dependency.

## 4. Payload-mismatch semantics

| Class | Same key, different payload |
|---|---|
| 1 | `409 IDEMPOTENCY_CONFLICT` (frozen, unchanged) |
| 6 | same `(provider, event_id)` with a **different** `payload_hash` is **not** a duplicate — it is either a provider re-send with corrected content or a tampering attempt. A second receipt is created, the domain application is **not** performed automatically, and a reconciliation case is opened (`B12_RECONCILIATION_MODEL.md` §3, class `P-6`). Silently accepting either version would be a guess |
| 9 | `409 IDEMPOTENCY_CONFLICT` |
| others | the key *is* the payload identity, so the case cannot arise |

## 5. Concurrency behavior

Every class resolves concurrency with a **database** primitive, never a Redis lock: a unique constraint (classes 2, 4, 6, 7, 8), a row lock (classes 1, 5, 9), or `FOR UPDATE SKIP LOCKED` (class 3). The frozen precedent is explicit — `BACKEND_IDEMPOTENCY_STANDARD.md`: *"UpgradeQuote consumption is protected by PostgreSQL, not by a Redis lock."* B12 generalizes that sentence to all nine classes (`B12_CONCURRENCY_MODEL.md` §5).
