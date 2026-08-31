# B5 — Outbound Message Pipeline

> **B5 status:** Target design only. The provider network call is never the sole durable record of send intent.

## 1. The full flow and transaction boundaries

```
authorized actor/system request (SendMessage / SendTemplateMessage)
 │
 ├─ TXN 1 (synchronous, request/response):
 │    entitlement + permission + recipient-eligibility checks (B5_ENTITLEMENT_RBAC_TENANCY.md §1)
 │    → consent/suppression check (B5_CONSENT_COMMUNICATION_POLICY.md §3)
 │    → customer-service-window policy check (B5_CUSTOMER_SERVICE_WINDOW.md §4)
 │    → idempotency check (B5_IDEMPOTENCY_CONCURRENCY.md §1)
 │    → Conversation resolve/create (B5_CONVERSATION_MODEL.md §3)
 │    → persist Message (status=queued), IdempotencyRecord, outbox row — ONE transaction
 │    → respond 202
 │
 └─ TXN 2+ (asynchronous, worker):
      worker claims the queued Message (lease)
      → Message.status = submitted
      → provider call via MessagingPort (B5_PROVIDER_ABSTRACTION.md §2-3)
      → persist normalized MessageDelivery result — TXN
      → publish B5 event (OutboundMessageAccepted / MessageFailed) via outbox
      → later: webhook-driven status updates (B5_WEBHOOK_SECURITY_MODEL.md, B5_MESSAGE_STATE_MACHINE.md §4)
```

**The provider call happens strictly after TXN 1 commits.** A `Message` row exists, durably, with `status=queued`, before any network request to Meta is made — satisfying the brief's explicit requirement that the provider call must not be the sole durable record of intent.

## 2. Admission sequence

| Step | Check | Failure |
|---|---|---|
| 1 | Authenticate | `401 AUTH_REQUIRED` |
| 2 | Authorize — `message.send` (`B5_ENTITLEMENT_RBAC_TENANCY.md`) | `403 PERMISSION_DENIED` |
| 3 | Provider configured and enabled (`B5_PROVIDER_CONFIGURATION_MODEL.md` §5) | `403 ENTITLEMENT_LOCKED`, `provider_not_configured`/`provider_disabled` |
| 4 | Entitlement — messaging capability/quota (Class B, provisional until B8 closes, mirroring `B3_QUOTA_COST_CONTROL.md`/`B4_COST_RATE_LIMIT_MODEL.md` §10's identical "provisional until B8" framing) | `403 ENTITLEMENT_LOCKED` |
| 5 | Recipient resolves within workspace scope (Conversation or resolvable Lead+Contact+phone) | `404 ENTITY_NOT_FOUND` |
| 6 | Consent/suppression check | `403 PERMISSION_DENIED`, `consent_required`/`recipient_suppressed` |
| 7 | Customer-service-window policy | `422 VALIDATION_ERROR`, `template_required` (if `TEMPLATE_REQUIRED` and a free-form send was attempted) — never silently downgraded to a template |
| 8 | Workspace admission counter — `sent_this_hour < ceiling` (`B5_RATE_COST_RETRY_MODEL.md` §2) | `429`, `messaging_rate_limited` |
| 9 | Idempotency-Key check | replay of stored response if duplicate (`B5_IDEMPOTENCY_CONCURRENCY.md` §1) |
| 10 | Atomically persist Message(`queued`), IdempotencyRecord, outbox row — one transaction | — |
| 11 | Respond `202` with the admitted Message | — |

Step 7's window check runs **after** consent (step 6) and **before** rate-limiting (step 8) — a message blocked on consent should never consume a rate-limit slot or a window-evaluation cost, and a window-blocked message should never be charged against the hourly ceiling either, matching `B4_COST_RATE_LIMIT_MODEL.md` §4's "cheaper check first" discipline.

## 3. Crash scenarios, traced

| Scenario | Outcome |
|---|---|
| DB committed (TXN 1), outbox publish to the worker queue failed | the transactional outbox pattern (frozen B0) guarantees the row is still picked up by the outbox relay — no message is lost; `status` remains `queued` until a worker claims it |
| Provider call succeeded, the local worker crashed before persisting the result | on worker restart/lease-expiry, the lease is reclaimed; reconciliation (`B5_RECONCILIATION_OBSERVABILITY.md` §3) queries provider status by `provider_message_id`, if one was captured, or treats the send as ambiguous (§4) if not |
| Provider call succeeded, DB update failed (crash between provider response and commit) | same as above — this is exactly the `submitted`-state ambiguity §4 exists for |
| Worker retries after an ambiguous timeout | governed by §4 — never a blind resend |
| Duplicate actor click (double-submit) | `client_request_id`/`Idempotency-Key` absorbs it at step 9 — no second Message |
| Duplicate automation request (future B7) | identical admission path, identical idempotency layer — `B5_B6_B7_BOUNDARIES.md` §3 |
| Provider itself duplicates delivery of an accepted send (rare, provider-side) | not preventable by WazLink; `B5-X-015` records whether Meta's own behavior makes this possible; WazLink's own `Message` row is created exactly once regardless |

## 4. Ambiguous-send handling — the critical case

> **`B5-D-A015`: a provider-call timeout after dispatch never triggers a blind resend. The Message moves to (or remains in) `submitted` and is resolved only by reconciliation.**

```
ON provider call timeout for Message M:
  IF automatic-retry budget remains (B5_RATE_COST_RETRY_MODEL.md §5):
      retry the SAME logical provider call (new attempt, same Message, same content)
      -- this is a *retry of the call*, not a *new send*: idempotency layer 3
         (B5_IDEMPOTENCY_CONCURRENCY.md §1) prevents Meta from ever seeing this
         as anything but a resend of the identical logical request where the
         adapter supports a client-supplied dedup token; where it does not
         (B5-X-015 unconfirmed), the retry is still bounded and the ambiguity
         it might create is exactly what reconciliation resolves
  ELSE (budget exhausted):
      M.status remains 'submitted'
      → reconciliation job (B5_RECONCILIATION_OBSERVABILITY.md §3; window
        duration is Class B, B5-D-B001 — existence of a bounded window is
        Class A) queries
        provider status by any captured correlation, or waits for a
        status webhook that might still arrive referencing this Message's
        content/recipient/timestamp window
      → IF a matching provider_message_id is found within the reconciliation
           window: M.status = 'sent', mapping recorded — the send succeeded,
           WazLink just did not learn synchronously
      → ELSE, after the bounded reconciliation window closes:
           M.status = 'failed', failure_code = 'ambiguous_unconfirmed'
           -- never silently retried again automatically; a human/actor
              decides whether to retry via the ordinary retry path
```

This is the direct answer to the brief's §29 critical case: WazLink never resends into an unknown-acceptance state, and never asserts a definitive `failed` before reconciliation has had its bounded window to resolve the ambiguity honestly.

## 5. Idempotency, restated for this pipeline

Full model is `B5_IDEMPOTENCY_CONCURRENCY.md`. Summarized here: `Idempotency-Key` is required on `SendMessage` and `SendTemplateMessage`; a request replayed under the identical key returns the stored `202` response and creates no second Message, regardless of what has happened to the original Message since (even if it has since reached `delivered` or `failed`) — replay is a transport guarantee, not a "give me current status" query, exactly mirroring `B4_IDEMPOTENCY_CONCURRENCY.md` §2's identical rule.
