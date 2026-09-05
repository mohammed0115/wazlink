# B14_15 — WhatsApp Adapter Plan

> Extends frozen B5 + B12. **Nothing in B5 or B12 is redesigned.** Meta-specific request/response shapes are verified from official documentation during slice I6.

## 1. Verified provider constraints (2026-09-04, Meta Cloud API overview)

Templates require approval and are **the only message type sendable outside the customer service window** · businesses **must obtain opt-in before sending templates** · inbound messages **and** all outbound delivery status updates arrive **via webhook** · throughput ~80 msg/s per number, pair rate ~1 msg / 6 s per user, 200–5000 requests/hour by account tier.

All four are already encoded in frozen B5 (`B5_CUSTOMER_SERVICE_WINDOW.md`, `B5_TEMPLATE_MODEL.md`, `B5_CONSENT_COMMUNICATION_POLICY.md`, `B5_RATE_COST_RETRY_MODEL.md`). **B14 introduces no new provider assumption.**

## 2. Outbound

`SendMessage` / `SendTemplateMessage` (**human actor only**) → guards: workspace, permission `message.send`, **consent**, **service window**, template approval, rate/cost budget → `messages` row + `provider_request_attempts` **before** the call → `providers.fast` → adapter → normalized result.

**`unknown` outcome ⇒ never resend.** A duplicate WhatsApp message is precisely the harm `B12-D-A020` exists to prevent; resolution goes through the unknown-outcome procedure and reconciliation `P-1`.

> **AI does not own Send.** There is exactly one send path, and its actor is a human (`PD-013`, `B5-D-A021`). An AI draft is text placed in a composer; it becomes a message only when a human submits it through this same command, and the message's `senderType` remains `user` with an `assistance` tag (frozen `AT-B4-2`).

## 3. Inbound

`GET /webhooks/whatsapp` — `hub.verify_token` compared in **constant time**; echo `hub.challenge` with `200`, else `403`.
`POST /webhooks/whatsapp` — verify `X-Hub-Signature-256`; **`200` on verified/duplicate/malformed/unsupported; `401` only on an invalid signature** (frozen B12 contract).

Pipeline: verify → receipt (`webhook_receipts`, hash, dedup on `(provider, provider_event_identity)`) → **fast acknowledge** → enqueue on `webhooks` → domain processing → **identity resolution** (`resolve_party`) → conversation linked or opened **unlinked** when unresolved/ambiguous.

**No inbound message creates a Lead or Customer.** Unresolved ⇒ `identity_state=unresolved`, a human-confirmable proposal is offered, and nothing is created automatically.

## 4. Status, duplicates, ordering

Delivery/read/failure statuses applied through `ApplyProviderMessageStatus` with the frozen **monotonicity key** `(message_id, status_value, provider_timestamp)` — a duplicate application is a no-op, and an out-of-order `read` before `delivered` infers `delivered` first (frozen `AT-STATE-6`). Duplicate callbacks are absorbed at the receipt layer **and** again at the status layer — two independent defences, as frozen B5 specifies.

## 5. Media, health, reconciliation

Media is stored through **B11** (`file_assets` + `MessageMedia.file_asset_ref`) — no second file truth. Health uses the six frozen facts; `401`/`403` ⇒ `credential_valid=false`, `status → error`, alert, **no automatic retry**. Reconciliation: `P-1` unknown sends, `P-4` receipts stuck in `queued` (safe auto re-enqueue), `P-7` unresolved workspace binding (**report only, quarantined — never guessed**).

**Meta redelivers for 36h and documents no pull-replay**, so a WazLink outage is recovered by **waiting**. No catch-up mechanism is fabricated.

## 6. Safe logging

Never logged: access token, app secret, verify token, `X-Hub-Signature-256`, raw payload bodies, `Authorization`. Logged: `request_id`, correlation ID, provider message reference, outcome class, latency, error class. Raw payload storage is **off by default** (frozen `B12-D-B004`) and never contains the signature.

## 7. Configuration

`WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Missing ⇒ `not_connected`; **inbound webhooks are rejected when the app secret is absent** because a signature cannot be verified — refusing is the fail-closed behaviour.

## 8. Tests

| ID | Slice | Precondition | Action | Expected assertion |
|---|---|---|---|---|
| `T-WA-1` | I6 | App secret configured | POST a payload with a valid, then an invalid, `X-Hub-Signature-256` | Valid ⇒ `200`; **invalid ⇒ `401`**; malformed/duplicate/unsupported ⇒ `200` (frozen B12 contract) |
| `T-WA-2` | I6 | Verify token configured | `GET /webhooks/whatsapp` with correct then incorrect `hub.verify_token` | Correct ⇒ `200` echoing `hub.challenge`; incorrect ⇒ `403`; comparison is **constant-time** |
| `T-WA-3` **(NC)** | I6 | A processed callback | Re-deliver the identical callback | Absorbed at the **receipt** layer and again at the **status** layer — **two independent defences**; no duplicate domain effect |
| `T-WA-4` | I6 | A message with `delivered` applied | Apply `read` with an earlier `provider_timestamp`, then a later one | Monotonicity key `(message_id, status, provider_ts)` holds; an out-of-order `read` before `delivered` **infers `delivered` first** (`AT-STATE-6`) |
| `T-WA-5` **(NC)** | I6 | Contact without consent / outside the service window | `SendMessage` | **Refused before any provider call**; `provider_request_attempts` records no outbound attempt |
| `T-WA-6` **(NC)** | I6 | A send whose outcome is forced to `unknown` | Run every retry and sweep path | **Never resent**; `P-1` case opened. A duplicate WhatsApp message is the exact harm `B12-D-A020` prevents |
| **`T-WA-7`** **(NC)** | **I13** | The full codebase **with `aiagent` present** | Trace every call path from `aiagent` and from `adapters/openai` | **No path reaches `SendMessage`.** *(Assigned to I13, not I6 — before `aiagent` exists this passes vacuously; `B14_19` §4)* |
| `T-WA-8` **(NC)** | I6 | Sentinel credentials, maximum verbosity | Exercise inbound and outbound | **No access token, app secret, verify token, `X-Hub-Signature-256`, `Authorization` header or raw payload body** in any log record |
| `T-WA-9` | I6 | App secret **absent** | POST an inbound webhook | **Rejected** — a signature cannot be verified, and refusing is the fail-closed behaviour |
