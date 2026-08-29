# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Platform standard

Clients send `Idempotency-Key` for POST commands. The key is scoped by workspace, authenticated principal, endpoint/command, and a request-body hash. A successful or terminal response is retained for at least 24 hours for normal commands and 7 days for payment/webhook operations. Reuse with a different body returns `IDEMPOTENCY_CONFLICT`.

Command services create an `IdempotencyRecord` inside the same transaction as the command’s durable state. A unique constraint prevents concurrent duplicate execution. In-progress reuse returns `409` or a safe in-progress representation. Provider requests use provider-specific keys derived from the internal idempotency record; webhook processing uses provider + event identity + payload hash with a receipt lock.

Worker execution is idempotent by `(command_id, effect_type)` and checks the target version/state before side effects. RevenueEvent creation uses an explicit source reference and unique source/idempotency key. UpgradeQuote issue, UpgradeQuote consumption, payment initiation, invoice creation, subscription update, refund, Business→Lead conversion, Discovery retry, Message send, and Automation action reservation all follow this standard.

UpgradeQuote consumption is protected by PostgreSQL, not by a Redis lock. Payment initiation locks the `upgrade_quotes` row, re-checks `status = active` and `expires_at` in the future, and writes the quote transition and the Payment in one transaction; the partial unique index on `upgrade_quotes.payment_id` makes a second independent payment lineage against the same quote impossible. A retry under the same `Idempotency-Key` and body hash replays the stored terminal response and is not a second consumption; a different body under the same key returns `IDEMPOTENCY_CONFLICT`, and an independent attempt against an already-consumed quote returns `CONFLICT`.
