# B12 — Unknown Outcome Model

> Design only. This is the most safety-critical document in the pack. It answers the brief's §23: what WazLink does when it cannot determine whether a provider accepted an operation.

## 1. Three outcomes, not two

> **`B12-D-A019`. Every provider interaction terminates in exactly one of three outcomes: `known_success`, `known_failure`, or `unknown`. `unknown` is a first-class, durable, recorded state — never coerced into either neighbour.**

| Outcome | Established by | Durable in |
|---|---|---|
| `known_success` | a complete provider response the adapter parsed and classified as success | `provider_request_attempts.outcome` |
| `known_failure` | a complete provider response classifying a deterministic rejection | same |
| `unknown` | **anything else** — connect timeout after the request left, read timeout, connection reset mid-response, worker killed by a hard time limit, TLS failure after handshake, unparseable response | same |

**Why the third state is not optional.** A read timeout after a `POST /charge` is indistinguishable, from WazLink's side, from a captured payment whose response was lost. Recording it as failure invites a second charge; recording it as success grants an entitlement that may not be paid for. Both are fabrications. The only honest record is "we do not know," followed by a bounded procedure to find out.

## 2. The five canonical unknown scenarios

Each is a real Phase-1 path, named with its provider and its resolution:

| # | Scenario | Provider | Safe? | Resolution |
|---:|---|---|:--:|---|
| 1 | Timeout after a WhatsApp send request | Meta | **not idempotent** — a repeat may send a second message to a customer | status lookup by the provider message reference if the response was partially read; otherwise wait for the delivery webhook, which Meta retries *"over the next 36 hours"* (`B12-X-003`); only then reconcile |
| 2 | Connection loss during a Tap charge creation | Tap | **not idempotent** — a repeat may charge twice | `retrieve_charge` — a read-only lookup. Frozen `B8_CHECKOUT_PAYMENT_MODEL.md` already mandates this: Tap's own documentation states *"the redirect alone does not prove payment success... must make a `/charge` request to retrieve the transaction details"* (`B8-X-011`) |
| 3 | Storage delete timeout | storage | **idempotent by contract** — `delete_object` on an absent key is success (`B11_STORAGE_PROVIDER_BOUNDARY.md` §2) | `stat_object` first, then a bounded repeat. B11 already governs this; B12 executes it and adds nothing |
| 4 | AI provider timeout | OpenAI | **not idempotent** — a repeat spends a provider attempt from B4's budget | classify `unknown`, consume **one** B4 provider attempt (it was spent), never retry silently past B4's maximum |
| 5 | Places response lost after remote success | Places | **read-only and therefore idempotent** | repeat is safe; only cost is spent, which the frozen page-and-combination ceilings already bound (`B3-INV-11`) |

> The pattern is visible across the five: **safety of a repeat is a property of the operation, not of the error.** B12 never decides "it timed out, so retry" — it decides "this operation is idempotent *and* the outcome is unknown, so a bounded repeat is safe."

## 3. The procedure

```
ON outcome = unknown:
  1. RECORD it durably first — provider_request_attempts.outcome='unknown',
     with the provider request reference if one was received.
     Nothing else happens until this row is committed.
  2. DO NOT retry a non-idempotent operation. Not once.
  3. IF the provider supports a status lookup (capability, evidenced):
        schedule a READ-ONLY lookup under normal backoff.
        A lookup is side-effect-free, so it may be retried freely.
  4. IF a provider callback can settle it (Meta status webhook, Tap webhook):
        wait for it within the domain's own pending window.
  5. IF neither settles it within the window:
        open a PlatformReconciliationCase (class P-1) and alert.
  6. An operator may then resolve it — with evidence — through the
     domain's own guarded command. Never by editing a row.
```

> **`B12-D-A020`. Step 2 has no exceptions and no override flag.** There is no configuration, permission, or operator action in this pack that retries a non-idempotent provider operation whose outcome is unknown without first establishing the outcome. `UNKNOWN_OUTCOME_SAFETY_GAPS = 0` and `BLIND_NON_IDEMPOTENT_RETRY_GAPS = 0` rest on this decision; negative controls `AT-B12UNK-3`, `AT-B12UNK-6`.

## 4. Write-before-call — the crash-window guarantee

> **`B12-D-A021`. A `provider_request_attempts` row is committed BEFORE the provider request is issued, and updated after.**

This costs one extra write per provider call and buys the only evidence that matters after a crash: an attempt row with no outcome means *"a request may have left this process."* Without it, a worker that dies mid-call leaves nothing, and the next execution cannot distinguish "never called" from "called, result lost" — so it would have to either risk a duplicate or refuse forever.

The three post-crash readings are then unambiguous:

| Evidence found | Reading | Action |
|---|---|---|
| no attempt row | the call never started | safe to proceed |
| attempt row, no outcome | **unknown** | §3's procedure |
| attempt row, terminal outcome | settled | apply or fail per the outcome |

## 5. What must never happen

| Forbidden | Why |
|---|---|
| Defaulting `unknown` to `failure` | invites a duplicate charge / duplicate message on the "retry" that follows |
| Defaulting `unknown` to `success` | grants entitlement, marks messages delivered, and recognizes revenue on evidence that does not exist |
| Letting a *webhook* silently overwrite an `unknown` without dedup | the callback is evidence and is welcome — but it flows through `B12_WEBHOOK_DEDUP_ORDERING.md`, and it updates the **domain's** state through the domain's own command, not `provider_request_attempts` alone |
| Resolving an `unknown` by operator judgement without provider evidence | a case may be *dismissed* with a mandatory reason, but a **business** state change requires the domain's command and its own guards |

## 6. Interaction with reconciliation

Every unresolved `unknown` becomes a `PlatformReconciliationCase` (`B12_RECONCILIATION_MODEL.md` §3, class `P-1`), whose **first scheduled action is always a read-only lookup**, never a mutating repeat. This mirrors B11's already-frozen rule one layer down (`B11_STORAGE_PROVIDER_BOUNDARY.md` §4: *"For any operation classified `unknown`, the next step is `stat_object`, not a blind repeat"*) and generalizes it to every provider.
