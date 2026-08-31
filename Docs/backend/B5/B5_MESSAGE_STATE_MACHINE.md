# B5 — Message State Machine

> **B5 status:** Target design only. Two separate state machines — outbound and inbound — because they are driven by different actors and have no shared transition. Provider terminology is normalized into WazLink's own vocabulary; Meta's literal status strings are adapter-boundary detail (`B5_PROVIDER_ABSTRACTION.md` §3).

## 1. Why two state machines, not one

The frozen fixture's `messageDeliveryLabels` (`queued, sent, delivered, read, failed`) is written as if one enum covered both directions, but the actual code paths never apply it that way: `advanceMockMessageStatus` only ever touches `direction='outbound'` rows, and `markConversationRead` only ever touches `direction='inbound'` rows (`data.js:538,540`). Fixture data confirms it: `MSG-3042-3` is inbound with `status:"received"` — a value that never appears in `messageDeliveryLabels` at all. Collapsing both into one enum would make `"read"` ambiguous — for an inbound message it means *"an agent has read it"*; for an outbound message it means *"the counterparty has read it (WhatsApp blue tick)"* — two unrelated real-world facts sharing a string by accident. B5 does not inherit that ambiguity.

> **`B5-D-A006`/`B5-D-A007`: outbound and inbound messages use disjoint status vocabularies. `Message.status` is interpreted only in light of `Message.direction`.**

## 2. Outbound state machine

> **Seven states: `queued, submitted, sent, delivered, read, failed, cancelled`.**

Five of these (`queued, sent, delivered, read, failed`) are the frozen frontend's own labels (FB-04). Two are new, and each is justified rather than assumed:

- **`submitted`** — the provider call has been dispatched and a response is pending or ambiguous. The frontend's synchronous local simulation has no way to need this state (a mock mutation cannot time out); a real network call to Meta can. Without it, a provider-call timeout has nowhere honest to sit between "we haven't tried yet" and "the provider confirmed something" — collapsing the two would force a premature `sent`/`failed` guess. See `B5_OUTBOUND_PIPELINE.md` §4, `B5_RATE_COST_RETRY_MODEL.md` §5.
- **`cancelled`** — an actor or system withdraws a message before it is dispatched. No frontend affordance shows it today (composer has no "unsend" button), but every other domain in this corpus that admits async work (B3's Job, B4's IntelligenceRun) has a pre-execution cancel path, and B7's future governed-automation sends will need one (`B5_B6_B7_BOUNDARIES.md` §3) to withdraw a scheduled send before it commits provider spend.

| # | From | To | Trigger | Guard |
|---|---|---|---|---|
| 1 | — | `queued` | `SendMessage`/`SendTemplateMessage` admitted | admission sequence complete (`B5_OUTBOUND_PIPELINE.md` §2) |
| 2 | `queued` | `submitted` | worker dispatches the provider call | lease acquired |
| 3 | `submitted` | `sent` | provider returns a `provider_message_id` | response received, well-formed |
| 4 | `submitted` | `failed` | provider returns a definitive rejection (invalid recipient, policy rejection, auth failure) | `failure_code` set, non-retryable class (`B5_RATE_COST_RETRY_MODEL.md` §3) |
| 5 | `submitted` | `submitted` | provider call times out / network-ambiguous, retry budget remains | automatic transient retry (`B5-D-A027`); state does not advance until a definitive outcome |
| 6 | `submitted` | `failed` | timeout persists after retry budget exhausted, and reconciliation confirms no provider acceptance | `failure_code=ambiguous_unconfirmed`, only after §`B5_RECONCILIATION_OBSERVABILITY.md` §3's reconciliation check — **never** assumed from the timeout alone |
| 7 | `sent` | `delivered` | provider delivery-status webhook | signature-verified, deduplicated (`B5_WEBHOOK_SECURITY_MODEL.md`) |
| 8 | `sent` | `failed` | provider async failure webhook after initial acceptance (e.g. number blocked, undeliverable) | `failure_code` set |
| 9 | `delivered` | `read` | provider read-receipt webhook | same guard as 7 |
| 10 | `queued` | `cancelled` | `CancelMessage` | row lock; not yet dispatched |

**No other transition exists.** In particular: `delivered`/`read` never regress to an earlier state (§4); `cancelled` is reachable only from `queued`, because once a provider call is dispatched (`submitted`), cancellation cannot un-spend the attempt (mirrors `B4_COST_RATE_LIMIT_MODEL.md` §7.1's identical release/retain asymmetry, restated for B5 in `B5_RATE_COST_RETRY_MODEL.md` §6); `failed` is terminal — retry always opens a fresh `MessageDelivery` attempt on the **same** `Message` row (§`B5_MESSAGE_MODEL.md` §3), never a state transition on the failed one itself past its terminal marker.

## 3. Inbound state machine

> **Two states: `received, read`.**

| # | From | To | Trigger | Guard |
|---|---|---|---|---|
| 1 | — | `received` | inbound webhook processed, Message persisted | `B5_INBOUND_PIPELINE.md` admission complete |
| 2 | `received` | `read` | `MarkConversationRead` (bulk, per Conversation — FB-14) | any inbound message on the Conversation still `received` |

There is no `failed` for inbound — a message that arrived, arrived; there is nothing to retry on WazLink's side. There is no `delivered` for inbound — delivery is a fact about WazLink's own receipt, which is definitionally already true once the row exists.

## 4. Monotonicity — a stale webhook can never regress durable truth

> **`B5-D-A014`'s state-machine half: a `MessageDelivery` status update is applied only if it represents forward progress in the transition table above (or is a duplicate of the current state). A status that would regress the machine is recorded for audit and discarded as a state change.**

```
ON provider status webhook for message M, new_status S:
  current = M.status
  IF S == current:
      -- duplicate/redelivered callback; record MessageDelivery row, no-op on Message.status
  ELIF transition(current -> S) is legal per §2/§3:
      APPLY: M.status = S; append MessageDelivery row
  ELSE:
      -- out-of-order or provider correction attempting a regression
      RECORD MessageDelivery row (audit trail preserved)
      DO NOT mutate M.status
      emit an observability signal (B5_RECONCILIATION_OBSERVABILITY.md §5)
```

**Concrete cases the brief requires traced:**

| Scenario | Outcome |
|---|---|
| `read` arrives before `delivered` (provider reordering) | `delivered` is legal from `sent` and `read` is legal only from `delivered` per §2 — a `read` callback received while `M.status='sent'` is applied as if it implies `delivered` first (Meta's own documented behavior: a read receipt entails prior delivery) — `MessageDelivery` records both the inferred `delivered` and the `read` in one processing pass, `M.status` ends at `read`. This is the **one** documented exception to "only tabled transitions apply," stated explicitly rather than silently assumed |
| `failed` arrives after `delivered` | legal (transition 8) — an async post-delivery failure is a real Meta behavior (e.g. later-detected policy violation); `M.status` moves to `failed` |
| `delivered` arrives after `failed` | **not legal** — `failed` has no outgoing edge in §2. Recorded, not applied. A provider correction implying an already-failed message actually succeeded is a reconciliation case (`B5_RECONCILIATION_OBSERVABILITY.md` §3, `status_drift` signal), not a silent state flip |
| Duplicate `delivered` callback (Meta redelivery) | idempotent no-op on `M.status`; a new `MessageDelivery` row is still appended for the audit trail (never silently dropped — `B5_IDEMPOTENCY_CONCURRENCY.md` §3 governs the dedup key that prevents this from being double-counted in metrics) |
| Unknown/unrecognized provider status string | not applied; recorded as `MessageDelivery.status = 'unknown'` with the raw provider status preserved in `provider_metadata` (never the WazLink-facing `status` enum, which stays closed) — `B5_PROVIDER_ABSTRACTION.md` §3 |

## 5. Terminal states and visibility

| State | Direction | Terminal? | Visible to actor? |
|---|---|---|---|
| `read` | outbound | yes | yes — the highest-progress outbound state |
| `failed` | outbound | yes | yes, `failure_code` only, never a raw provider error (mirrors `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §3) |
| `cancelled` | outbound | yes | yes |
| `delivered`, `sent`, `submitted`, `queued` | outbound | no | yes |
| `read` | inbound | yes (for read-tracking purposes; the message itself is simply "read") | yes |
| `received` | inbound | no (advances to `read`) | yes |

## 6. Ordering key stability

`created_at` is set once at admission/receipt and never changes (§`B5_MESSAGE_MODEL.md` §3). Thread display order — `(conversation_id, created_at ASC, public_id ASC)` — is therefore stable under every status transition in this document; a status change never re-sorts message history (`B5-D-A030`).
