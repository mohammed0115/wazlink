# B5 — Rate Limits, Cost Control, and Retry Model

> **B5 status:** Target design only. Closed before B5 requests closure, applying the exact lesson B4 applied proactively (and the lesson B4's own audit corrected about accurately citing provenance): every bound here is finite, computable in advance, and its provenance is stated precisely rather than implied.

## 1. What frozen B0 does and does not already anchor

Unlike B4 (which had "AI analysis — 60/hour/workspace" already frozen in `BACKEND_RATE_LIMIT_POLICY.md`), **no messaging-specific row exists there today.** B5 does not invent a number and call it frozen — it proposes one, explicitly, as a controlled amendment.

> **`B5-D-A028`: `BACKEND_RATE_LIMIT_POLICY.md` gains a new row, `Messaging send — 300/hour/workspace plus quota`, key `workspace` — additive, `B5_CONTROLLED_AMENDMENTS.md` item 6.**

The number 300 is **Class B** (`B5-D-B007`) — chosen as a round ceiling comfortably above realistic human-agent throughput (a human cannot type 300 distinct messages an hour) while still bounding worst-case actor/automation abuse; the *existence* of a workspace-level ceiling, closed before this document is considered done, is Class A. This is structurally distinct from Meta's own per-number throughput/quality-rating limits (`B5-X-012`, `B5-X-013`) — WazLink's ceiling governs *actor request volume into WazLink*, Meta's governs *WazLink's own provider-side sending capacity*, and a workspace can be throttled by either independently.

## 2. Admission counter

```
sent_this_hour < MESSAGING_SEND_CEILING_PER_WORKSPACE_PER_HOUR (= 300, B5-D-B007)
```

Checked at `B5_OUTBOUND_PIPELINE.md` §2 step 8 — **after** consent and window-policy checks (a blocked send should never consume a rate-limit slot it was never going to draw from, mirroring `B4_COST_RATE_LIMIT_MODEL.md` §4's identical "reuse check before rate-limit check" ordering) and **before** the transactional admission write.

## 3. Failure classification

| B5 condition | Frozen class | Retryable | Terminal action |
|---|---|:--:|---|
| malformed request, invalid recipient format | Validation | no | `400`/`422 VALIDATION_ERROR` |
| lacks `message.send` | Authorization | no | `403 PERMISSION_DENIED` |
| provider not configured/disabled | Authorization/entitlement | no | `403 ENTITLEMENT_LOCKED` |
| consent/suppression | Authorization | no | `403 PERMISSION_DENIED`, `recipient_suppressed` |
| window policy (`TEMPLATE_REQUIRED` + free-form attempt) | Validation | no | `422 VALIDATION_ERROR`, `template_required` |
| workspace admission ceiling reached | Rate limited | client | `429`, `messaging_rate_limited` |
| provider timeout | Network timeout | **yes**, ≤3 | see `B5_OUTBOUND_PIPELINE.md` §4 |
| provider 5xx / unavailable | Network timeout | **yes**, ≤3 | same |
| provider rate-limited (429) | Rate limited | **yes**, honors `Retry-After` | same |
| invalid recipient (provider-confirmed) | Validation, provider-boundary | **no** | `failed`, `failure_code=invalid_recipient` |
| template rejected at provider | Validation, provider-boundary | **no** | `failed`, `failure_code=template_rejected_at_provider` |
| media send failure (expired URL, unsupported format at provider) | Validation, provider-boundary | **no** | `failed`, `failure_code=media_failure` |
| ambiguous timeout, budget exhausted | — | terminal for automatic processing | `failed`, `failure_code=ambiguous_unconfirmed`, only after reconciliation (`B5_OUTBOUND_PIPELINE.md` §4) |
| cancelled | terminal by actor request | n/a | `B5_MESSAGE_STATE_MACHINE.md` §2 transition 10 |

`ERROR_NEW_COUNT = 0` — every row reuses a frozen `BACKEND_ERROR_CATALOG.md` code (`VALIDATION_ERROR`, `PERMISSION_DENIED`, `ENTITLEMENT_LOCKED`, `ENTITY_NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, the generic `429`/rate-limited component, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`), differentiated only by `details.reason` — the identical technique `B3-D-A032` and `B4-D-A018`'s sibling decisions use.

## 4. Automatic transient retry ceiling — provenance stated precisely

> **`B5-D-A027`: `MAX_SEND_ATTEMPTS_PER_MESSAGE = 3` — 1 initial attempt plus a maximum of 2 automatic retries.**

This is **B5-owned**, not a citation of frozen `BACKEND_RETRY_POLICY.md`'s own generic ceilings, which are higher for the applicable classes (5 for Network timeout, 6 for Rate limited) and remain frozen and unmodified by this document. B5 imposes a stricter, domain-specific bound layered *underneath* that frozen retry architecture — B0 still supplies the retryable/non-retryable classification and the backoff mechanics; for B5's provider calls the lower B5 ceiling of 3 governs and wins over B0's larger generic ceiling. No provider retry path for B5 may fall back to B0's 5- or 6-attempt ceiling to exceed this bound. This wording deliberately follows the corrected pattern from `B4_COST_RATE_LIMIT_MODEL.md` §5 (post-independent-audit) rather than the pre-correction phrasing, precisely so the same imprecision is not repeated a phase later.

## 5. The worst case, computed

```
(A) provider calls per admitted send
    at most 1 send call = 1 logical call

(B) absolute call-attempt bound per admitted send, including automatic
    transient retry (MAX_SEND_ATTEMPTS_PER_MESSAGE = 3)
    1 × 3 = 3 call attempts

(C) admission-based hourly bound, per workspace
    300 admissions/hour × 3 = 900 absolute call attempts/hour/workspace

(D) inbound has no analogous bound — inbound admission is not actor-throttled
    (WazLink cannot rate-limit a customer's own messages), but inbound
    processing cost is bounded per-message and carries no provider-spend
    risk, unlike outbound
```

(C) is an **admission-based bound**, not a wall-clock guarantee, exactly as B3's and B4's own identical figures are stated — a send admitted in the final minute of the rolling hour can still be retrying after the window closes.

## 6. Cancellation and the admission slot

> **`B5-D-A027`'s companion, restating `B5_MESSAGE_STATE_MACHINE.md` §2's asymmetry as a cost rule: cancelling a `queued` Message releases nothing to "refund," because the workspace admission ceiling (§2) is consumed at admission and is never released by cancellation — cancellation only prevents the provider call from ever being dispatched.**

| Cancellation from | Provider spend | Admission-counter effect |
|---|---|---|
| `queued` | none incurred | **already counted at admission; not released** — cancelling does not grant a free extra send this hour |
| `submitted` or later | may already be incurred | not applicable — cancellation is not legal past `queued` (`B5_MESSAGE_STATE_MACHINE.md` §2) |

This differs deliberately from B4's release-on-`queued`-cancel pattern: B4's admission slot represented *provider-cost eligibility* that a never-dispatched run genuinely never drew on, so releasing it back to the pool was safe. B5's workspace ceiling represents *actor request volume*, not solely provider spend — releasing it on cancel would let an actor cycle `send → cancel → send` to manufacture unlimited requests against a fixed ceiling, exactly the "cancellation refund creates provider-spend loop" attack the brief's self-adversarial review names explicitly. B5 closes it by **never** releasing the counter on cancel, a stricter and simpler rule than B4's, chosen because B5's ceiling is request-volume-shaped rather than pure-provider-cost-shaped. `B5_ACCEPTANCE_TESTS.md` AT-COST-4 (NC) is the negative control.

## 7. Cost accounting — telemetry, not billing truth

Mirrors `B4_COST_RATE_LIMIT_MODEL.md` §9's identical discipline: `MessagingUsageRecord` (provider calls by outcome, latency, `cost_units` nullable and never defaulted to zero) is technical telemetry only. **B8 owns billing.** No B5 field is presented to a customer as an invoice line.

## 8. Idempotency never double-spends

`Idempotency-Key` is required on `SendMessage`/`SendTemplateMessage`/`CancelMessage`. A replayed request under the same key consumes no second admission slot (`B5_IDEMPOTENCY_CONCURRENCY.md` §2) — identical in mechanism to every prior phase's identical rule.

## 9. Commercial quota — separate from the technical admission ceiling

Whether `SendMessage` consumes a commercial quota unit (a `messagingSends` capability) is a **B8-owned, provisional** decision (`B5-D-B008`-adjacent, Class C until B8 ships). What is **not** provisional: the technical admission ceiling of §2 is consumed on every admitted send whether or not a commercial unit is also charged — "no commercial charge" must never be read as "no provider-cost bound," the identical warning B3/B4 encode for their own domains.
