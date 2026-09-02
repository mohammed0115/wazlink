# B8 — Webhook Model

> Design only. B8 does not own the generic webhook inbox — the frozen Webhooks domain does (`WHR-*`, `webhook_receipts`, state machine `received→verified→queued→processed/failed/duplicate`, `BACKEND_DOMAIN_OWNERSHIP.md`: "Webhooks | webhooks | WebhookReceipt | receipts | gateway only... no direct domain mutation"). This document specifies the Billing-specific consumer behind that shared inbox.

## 1. Ownership split

The Webhooks domain's gateway receives every inbound Tap POST, verifies authenticity, deduplicates, and enqueues — generic, provider-agnostic infrastructure. B8 owns only `ProcessPaymentWebhook` (frozen command name), the Billing-specific consumer invoked once a `WebhookReceipt` reaches `queued` for `provider = "tap"`. B8 never receives a raw HTTP POST directly and never re-implements signature verification, deduplication, or receipt storage — those are the Webhooks domain's frozen responsibility.

## 2. Tap-specific authenticity mechanism (behind the generic `verified` gate)

Per `B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-007`: the inbound payload carries a `hashstring` header; authenticity is `HMAC-SHA256` over a fixed field concatenation (`x_id[...]x_amount[...]x_currency[...]x_gateway_reference[...]x_payment_reference[...]x_status[...]x_created[...]`), keyed by the **Tap secret API key** (not a separate webhook-signing secret). This computation happens inside the `PaymentProviderPort` adapter, invoked by the shared Webhooks gateway before a `WebhookReceipt` is ever marked `verified` — **an unverified webhook never reaches B8's `ProcessPaymentWebhook` at all**, satisfying brief §20's requirement structurally rather than by convention: there is no code path from `received`/unverified to any Subscription/Payment mutation.

## 3. Workspace resolution (never trust the payload)

`ProcessPaymentWebhook` resolves the target workspace by looking up the normalized event's provider customer/agreement/charge reference against `billing_customers`/`payments.provider_payment_ref` (§`B8_CHECKOUT_PAYMENT_MODEL.md` §5) — never by reading a `workspace_id`-shaped field out of the Tap payload itself, mirroring `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §1.4's frozen doctrine verbatim ("A receipt that resolves to zero or more than one workspace is quarantined and alerted, never guessed"). Zero matches or ambiguous matches route to a `failed` `WebhookReceipt` with an operational alert (`BACKEND_OPERATIONS_OBSERVABILITY.md`'s "missing callbacks" alert class), never a best-guess assignment.

## 4. Idempotency and dedup

Deduplication identity is `(provider, provider_event_identity, payload_hash)` at the Webhooks-domain layer (frozen, `BACKEND_IDEMPOTENCY_STANDARD.md`: "webhook processing uses provider + event identity + payload hash with a receipt lock"). `ProcessPaymentWebhook` itself is additionally idempotent by `(command_id="ProcessPaymentWebhook", target Payment.id, resulting status)` — replaying the same verified receipt against an already-`captured` Payment is a no-op that returns the same outcome, never a duplicate `PaymentSucceeded` (mirrors the general worker-idempotency rule "idempotent by `(command_id, effect_type)`," `BACKEND_IDEMPOTENCY_STANDARD.md`). A duplicate `WebhookReceipt` (Webhooks-domain-detected) never even reaches `ProcessPaymentWebhook` — it is acknowledged `2xx` and dropped at the gateway (frozen retry-policy row: "Duplicate webhook | no-op | n/a | acknowledge 2xx").

## 5. Status normalization

`ProcessPaymentWebhook` maps the normalized event (already provider-neutralized by the adapter, §`B8_PAYMENT_PROVIDER_PORT.md` §3) onto `Payment.status`. An event for a `Payment` already in a terminal state (`captured`/`failed`/`refunded`) that reports a *different* terminal outcome is a **reconciliation mismatch**, not silently applied — it is recorded (new `code` value `RECONCILIATION_MISMATCH`, `409`, admin-surfaced only) and routed to `B8_RECONCILIATION_MODEL.md`'s repair path rather than overwritten automatically, satisfying brief §22's "callback says success but provider reconciliation disagrees."

## 6. Out-of-order and duplicate deliveries (`B8-D-B010`)

Because Tap's own webhook-endpoint-precedence and delivery-ordering guarantees are unresolved (`B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-014`), B8's correctness does not depend on delivery order: `ProcessPaymentWebhook` is a pure function of "the normalized event's reported status" applied through the frozen `Payment` state machine's legal-transition table (§`B8_TAP_PROVIDER_BOUNDARY.md` §3 state table) — an event reporting a status that is not a legal forward transition from the Payment's current state (e.g., a stale `pending` event arriving after `captured` was already applied) is discarded as a no-op, not applied backwards. This makes the consumer naturally order-independent for any sequence Tap might actually deliver, without needing Tap to guarantee ordering.

## 7. Lost/missing webhook

Tap retries webhook delivery at most 3 times before giving up (`B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-007`). A `Payment` stuck in `pending`/`authorized` past a bounded window (illustrative: 30 minutes, matching the `Payment pending` retry class's "scheduled poll, max 8" in frozen `BACKEND_RETRY_POLICY.md`) is picked up by `B8_RECONCILIATION_MODEL.md`'s scheduled sweep, which calls `retrieve_charge` directly rather than continuing to wait — reconciliation is not optional insurance, it is the structural backstop for Tap's own bounded retry budget.

## 8. Minimal payload retention

Only the fields `ProcessPaymentWebhook` needs to resolve and normalize the event are retained on the `WebhookReceipt`/`payment_attempts` rows (charge id, status, amount, currency, timestamps) — the full raw JSON body is retained, if at all, only transiently and redacted of anything beyond those fields, per `BACKEND_PRIVACY_AND_DATA_HANDLING.md`'s "Provider payloads | restricted JSONB, short retention, hash/reference" classification and `B8_PRIVACY_RETENTION.md` §3.

## 9. What B8 never does at the webhook boundary

Never invents an HMAC header name or algorithm (§2 cites Tap's actual mechanism); never trusts `workspace_id` from the payload (§3); never processes an unverified receipt (§2); never applies an out-of-order or backward transition (§6); never treats webhook-delivery failure as reason to fall back to redirect-based truth (§`B8_CHECKOUT_PAYMENT_MODEL.md` §8).
