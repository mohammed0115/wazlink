# B12 — Webhook Dedup & Ordering

> Design only. Answers the brief's §27 and §28. Both concerns are real Phase-1 paths, and they are **different problems** with different mechanisms.

## 1. Dedup and ordering are not the same problem

| | Dedup | Ordering |
|---|---|---|
| Question | "have I seen *this delivery* before?" | "is this event *older* than what I already applied?" |
| Mechanism | uniqueness on provider event identity | monotonicity check on the domain's state machine |
| Owner | **B12** (receipt layer) | **the domain** (B5, B8) |
| Failure if absent | duplicate business effect | a stale status regresses durable truth |

Both layers are required. Frozen `B5_WEBHOOK_SECURITY_MODEL.md` §5 says so explicitly: *"Both layers exist because they solve different problems: the receipt layer prevents re-processing the exact same HTTP delivery; the status-application layer prevents a later-arriving but logically-stale status from regressing durable truth."*

## 2. Dedup identity — a hierarchy, because providers differ

> **`B12-D-A032`. Dedup identity is resolved in priority order, and B12 never invents a provider event ID where the provider does not supply one.**

| Priority | Provider event identity | Use when | Phase-1 provider |
|---:|---|---|---|
| 1 | `provider_event_id` | the provider supplies a stable per-event identifier | Meta |
| 2 | `(provider_object_id, status_value, provider_timestamp)` | no event ID, but the payload identifies an object and a transition | **Tap** |
| 3 | `payload_hash` within a bounded window | neither of the above | fallback only |

> **`B12-D-A056`. The stored `dedup_key` is `integration_connection_id : <provider event identity>` — the identity above, prefixed by the **binding whose secret verified the delivery**.** For a global-scope provider with a single platform binding the prefix is that one binding's id, so nothing changes in practice; for a workspace-scoped provider (Meta, Tap) it makes the receipt-layer identity binding-scoped by construction.

The frozen constraint is honored **verbatim and unchanged**: `BACKEND_DATA_MODEL.md` line 26 requires *"provider/dedup key unique; payload hash index"*, and the index remains exactly `UNIQUE (provider, dedup_key)` with `payload_hash` separately indexed. The frozen text names the constraint; it never defined the key's composition, and defining it is what `B12-AM-002` (column-level specification of the three previously-undetailed frozen tables) already covers. **No new amendment, and no frozen uniqueness is weakened** — binding-scoping makes the key strictly *narrower*, never broader.

### 2a. Why the prefix exists — the cross-workspace poisoning sequence

Without it, the receipt-layer identity is global while the *authority* to write it is per-binding, and those two facts can be pried apart. The sequence, traced in full:

```
Workspace A holds a legitimate Tap binding (its own Secret API Key).
Workspace B holds a different legitimate Tap binding.

t0  Attacker, controlling A, learns a charge id belonging to B (chg_B).
t1  Attacker POSTs /webhooks/tap a payload carrying chg_B, correctly signed
    with A's OWN Secret API Key.
t2  VERIFY passes — the signature is genuine for binding A.
t3  RESOLVE binds the receipt to workspace A, from A's secret. (Tenant binding
    holds: `B12-D-A031` is not bypassed, and B is never named.)
t4  DEDUP claims the identity.
        Unscoped key  →  dedup_key = "chg_B:CAPTURED:<ts>"       ← GLOBAL
        Scoped key    →  dedup_key = "<A's binding>:chg_B:..."   ← A's namespace
t5  APPLY: B8's command is invoked for workspace A with an object A does not
    own. It refuses. Reconciliation class `P-5` opens, report-only.
    NO CROSS-TENANT MUTATION OCCURS — this was already true before the fix.
t6  B's genuine Tap callback for chg_B arrives, signed with B's key.
        Unscoped key  →  collides with t4's row → marked `duplicate` → 200 →
                         ZERO domain work. B's payment evidence is DISCARDED.
        Scoped key    →  "<B's binding>:chg_B:..." ≠ "<A's binding>:chg_B:..."
                         → new receipt → processed normally.
```

**The defect the prefix closes is `t6`, not `t5`.** Tenant *binding* was never broken — `t5` is refused by the owning domain either way. What an unscoped key permitted was a **denial of evidence**: one tenant consuming another tenant's receipt-layer identity and causing the rightful callback to be swallowed as a duplicate. Given Tap's three-attempt bound (`B12-X-006`), that callback would not come again.

**The residual, stated rather than implied.** Even unscoped, this was survivable — `B12-D-A025` makes `retrieve_charge` reconciliation the guarantee rather than an optimization, so B's payment would still settle, late. The fix removes the need to rely on that for a *preventable* cause. Defence in depth is the right posture here precisely because the recovery path exists.

> **What the prefix does not do.** It does not weaken signature verification, does not read `workspace_id` from a body, does not admit cross-tenant mutation, and does not make two genuine deliveries of the same Meta event under the same binding distinguishable — Meta's globally-unique event IDs still dedup exactly as before, because a genuine redelivery arrives under the *same* binding and therefore the *same* prefix. `WEBHOOK_DUPLICATE_GAPS = 0`, `CROSS_WORKSPACE_DEDUP_POISONING_GAPS = 0`, `CROSS_TENANT_INTEGRATION_GAPS = 0`; negative controls `AT-B12WH-17`, `AT-B12WH-18`.

### 2b. Tap's tier-2 identity, unchanged

**Tap sits at priority 2, and that is a research finding, not a default.** The Tap webhook documentation read this pass documents the `hashstring` scheme, the retry behavior, and that only `CAPTURED` or `FAILED` transactions trigger a webhook — but **no per-event identifier** (`B12-X-012`). Its signed concatenation, however, includes `x_id`, `x_status`, and `x_created`, which together form exactly the priority-2 tuple *and* are inside the authenticated envelope. So the dedup key for Tap is derivable from authenticated fields — which is the property that matters, and it is a happy accident worth recording rather than relying on silently.

The frozen constraint is honored either way: `BACKEND_DATA_MODEL.md` line 26 requires *"provider/dedup key unique; payload hash index"* — the unique index is on the resolved `dedup_key`, whatever tier produced its identity component, and the payload hash is separately indexed.

## 3. Duplicate handling

A delivery matching an existing receipt's dedup key transitions the **new** receipt to the frozen `duplicate` state, returns `200`, and performs **zero** domain work. Frozen `BACKEND_RETRY_POLICY.md` states the same: *"Duplicate webhook / known receipt key / no-op / acknowledge 2xx."*

**Same key, different payload hash** is *not* a duplicate (`B12_IDEMPOTENCY_MODEL.md` §4): it is either a corrected re-send or tampering. A second receipt is created, domain application is **withheld**, and reconciliation case `P-6` is opened. Guessing which reading is correct would be exactly the fabrication this pack refuses elsewhere.

`WEBHOOK_DUPLICATE_GAPS = 0`; negative controls `AT-B12WH-6`, `AT-B12WH-7`.

## 4. Out-of-order handling — B12 transports, the domain decides

> **`B12-D-A033`. B12 delivers normalized evidence in arrival order and applies no ordering opinion of its own. Whether an event is too old to matter is a question only the owning state machine can answer.**

Meta's own documentation makes ordering an explicit design constraint: *"Event Notifications are aggregated and sent in a batch with a maximum of 1000 updates. However batching cannot be guaranteed"* (`B12-X-004`). Combined with 36 hours of retries, WhatsApp status callbacks can arrive duplicated, late, and out of order — all three at once.

**Messaging (B5 owns the rule).** The frozen progression is `queued → submitted → sent → delivered → read`, with `failed` terminal. `B5_MESSAGE_STATE_MACHINE.md` §4's monotonicity key `(message_id, status_value, provider_timestamp)` decides whether a legal, non-duplicate status may advance `Message.status`.

| Arrival | Domain outcome |
|---|---|
| `read` then `delivered` (out of order) | `delivered` is **absorbed** — it is logically stale; `read` already implies it. No regression |
| `delivered` twice | second absorbed by dedup, or by monotonicity if dedup was bypassed |
| `failed` after `delivered` | **the domain decides.** B12 does not reinterpret it; the state machine's own legality rules apply |
| a status for an unknown provider message ID | receipted, not applied; reconciliation case `P-5` |

**Payments (B8 owns the rule).** Tap only emits on `CAPTURED` or `FAILED` (`B12-X-007`), so the ordering surface is narrower — but a late `FAILED` after a `CAPTURED` must never silently revoke a subscription. `Payment`'s frozen provider-neutral machine (`created→pending→authorized→captured`, terminal `failed`/`cancelled`) governs, and `B8_CONCURRENCY_MODEL.md` C5 already handles the webhook-vs-user-action race.

> **B12 never forces an invalid state regression.** If a normalized event would move a domain backwards, the domain's own command rejects it and B12 records the receipt as `processed` with a no-effect outcome — not as a failure, because nothing failed. `WEBHOOK_ORDERING_GAPS = 0`; negative controls `AT-B12WH-10`, `AT-B12WH-11`.

## 5. Late-arriving evidence versus an in-flight unknown

The genuinely hard interleaving, and the reason §4's ownership split matters:

```
t0  worker sends via Meta; read timeout ⇒ provider_request_attempts.outcome = 'unknown'
t1  Meta's delivery webhook arrives — the message WAS sent
t2  worker's reconciliation pass runs
```

At `t1` the webhook is authoritative *evidence*, and it flows through the ordinary path: verified → receipted → deduped → **the domain's own command** applies the status. At `t2` reconciliation observes that the domain state is already settled and closes the `unknown` attempt as resolved — **without** re-sending. The attempt row is updated from `unknown` to `known_success`, because evidence arrived; it is never updated on inference. `B12_CONCURRENCY_MODEL.md` §4 traces the locking.
