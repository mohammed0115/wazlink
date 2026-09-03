# B12 — Provider Capability Model

> Design only. Answers the brief's §24: what B12 may assume about a provider, and what it must refuse to assume.

## 1. Three values, not two

> **`B12-D-A024`. Every capability is tri-valued: `supported`, `not_supported`, or `unknown`. `unknown` is never promoted to either without evidence recorded in `B12_PROVIDER_RESEARCH_REGISTER.md`.**

A boolean capability flag forces a lie in one direction: `false` claims the provider *lacks* something nobody checked, and `true` claims it *has* something nobody verified. The design must behave correctly under `unknown`, which means treating it exactly as `not_supported` **for safety decisions** while never *recording* it as a verified absence.

| Value | Meaning | Design must |
|---|---|---|
| `supported` | a primary source documents it (`VERIFIED` in the register) | may rely on it, and says which fact it relies on |
| `not_supported` | a primary source documents its absence | must not rely on it |
| `unknown` | not established this pass | **behave as if absent**, and never assert absence |

## 2. The capability set

Four capabilities affect correctness. Nothing else is modelled, because an unused capability flag is a maintenance liability.

| Capability | Question | If absent, B12 must |
|---|---|---|
| `supports_idempotency_key` | can a client-supplied key make a repeated write safe? | never repeat a non-idempotent write on `unknown` (`B12_UNKNOWN_OUTCOME_MODEL.md` §3) |
| `supports_status_lookup` | is there a read-only "what happened to X?" call? | rely on a callback or reconciliation instead |
| `supports_webhook_replay` | can past events be re-requested? | treat a missed callback as permanently missed; reconcile from our own records |
| `supports_request_correlation` | does the provider return a stable request/event reference? | correlate by our own reference only; never fabricate a provider ID |

## 3. Phase-1 capability matrix — derived, not assumed

Every cell traces to `B12_PROVIDER_RESEARCH_REGISTER.md`. **No cell reads `supported` without a `VERIFIED` fact behind it.**

| Provider | idempotency key | status lookup | webhook replay | request correlation | Evidence |
|---|---|---|---|---|---|
| Meta WhatsApp Cloud API | `unknown` | `unknown` | `not_supported` (provider *pushes* retries for 36h; no pull-replay documented) | `supported` — the webhook carries provider message identifiers | `B12-X-003`, `B12-X-011` |
| Tap Payments | `unknown` | **`supported`** — `retrieve_charge`; Tap's own docs state the redirect alone is insufficient and a `/charge` request must be made | `not_supported` (bounded: *"two more retry attempts before the status of the POST is updated as ERROR"*) | `supported` — charge `id` | `B8-X-011`, `B12-X-006`, `B12-X-012` |
| Google Places (New) | `unknown` | n/a — read-only API, every call is a lookup | n/a | `unknown` | `B12-X-009`, `B12-X-010` |
| OpenAI / AI Gateway | `unknown` | `unknown` | n/a | `unknown` | `B12-X-013` |
| Storage (`FileStorageProvider`) | n/a — `delete_object` idempotent **by port contract** | **`supported`** — `stat_object` | n/a | `unknown` | `B11_STORAGE_PROVIDER_BOUNDARY.md` §2, `B11-X-007` |
| ZATCA / `TaxProvider` | `unknown` | `unknown` | `unknown` | `unknown` | not researched — B10 dormant, `B12-D-B006` |

> **The two `supported` status-lookup cells are the only provider capabilities Phase 1 relies on, and both are backed by a primary source.** Everything else is `unknown`, and the design works without it. `PROVIDER_CAPABILITY_ASSUMPTION_GAPS = 0` is that sentence, made checkable.

## 4. The critical asymmetry the research surfaced

Tap's webhook retry is **bounded to three total attempts** (`B12-X-006`: *"There will be two more retry attempts before the status of the POST is updated as ERROR"*), while Meta's is **generous** (`B12-X-003`: *"we will retry immediately, then try a few more times with decreasing frequency over the next 36 hours"*).

The design consequence is not symmetric and must not be treated as such:

- For **Meta**, a temporary WazLink outage is recoverable by *waiting* — the provider will redeliver.
- For **Tap**, a WazLink outage lasting past three attempts **permanently loses the callback**. Payment truth would be silently stale.

> **`B12-D-A025`. Because Tap's callback retry is bounded, payment reconciliation by `retrieve_charge` is not an optimization — it is the only guarantee.** Frozen `B8_RECONCILIATION_MODEL.md` already requires a payment reconciliation sweep; this research explains *why it cannot be dropped*, and B12 records the reason so a later implementer does not treat the sweep as redundant with the webhook.

## 5. Capability drift

A capability is a **snapshot of documentation**, not a permanent truth. Each cell carries its research ID; re-verification before implementation is a gate in `B12_IMPLEMENTATION_HANDOFF.md` §1. A capability that changes from `unknown` to `supported` may **only** remove work (a lookup, a reconciliation pass) — it may never become load-bearing without a controlled amendment, because the design would then depend on something it was built not to need.
