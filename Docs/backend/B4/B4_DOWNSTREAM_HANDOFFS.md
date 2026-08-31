# B4 — Downstream Handoffs (B5, B6, B7) and the Revenue Negative Invariant

> **B4 status:** Target design only. None of B5 (Messaging), B6 (Pipeline/Deals), or B7 (Automation) is designed. This document states only what B4 guarantees them, mirroring exactly how `B3_B4_HANDOFF_CONTRACT.md` states guarantees to B4 without designing B4 itself.

## 1. The shared rule

> **B4 recommends. It never sends, never creates a Deal, never triggers automation, and never touches revenue.** Every downstream domain reads B4's structured output and decides, independently, whether to act (`B4_RECOMMENDATION_MODEL.md` §1).

## 2. B5 — Messaging (future)

| B5 may consume | Field |
|---|---|
| outreach angle | `Recommendation.reason` / `suggested_outreach_angle` artifact (`B4_RECOMMENDATION_MODEL.md` §5) |
| recommended channel | **not provided** — `contact_now` is deliberately channel-neutral (`B4_RECOMMENDATION_MODEL.md` §3); B4 does not know or assert which channel (WhatsApp, phone, email) is best, because no evidence source in this design currently supports that judgement |
| talking points | `why_this_lead` artifact |
| language preference | **not asserted** — B4's own output is Arabic-first (`B4_SECURITY_PRIVACY_SAFETY.md` §5); it does not infer a Business's preferred language from unverifiable signals |

**B4 does not send messages, draft messages for auto-send, or hold any Conversation state.** No B4 command references a `CONV-*` or `MSG-*` identity.

## 3. B6 — Pipeline / Deals (future)

B4 may provide intelligence **context** to a future Deal-creation flow (e.g., a B6-owned "create Deal from Business" action reading `GET /businesses/{id}/intelligence/summary` the same way Lead 360 does). B6 owns all Deal truth — stage, value, probability, win/loss.

> **Explicit negative invariant: a high `overall_priority_score` or a `contact_now` recommendation never implies, and is never read by any B4 code path as implying, a Deal being won, a Deal's value, a Deal's win probability, or any payment/conversion outcome.** No B4 field is named, typed, or documented in a way that could be mistaken for a commercial probability estimate (`fit_score` and `intent_or_opportunity_score` were deliberately *not* adopted in `B4_SCORING_MODEL.md` §1 partly for this reason — either name invites exactly this conflation).

## 4. B7 — Automation (future)

> **`B4-D-A032`: automation may depend only on versioned, structured `signal_code`/`recommendation_code` values and their thresholds — never on free-form prose.**

| Safe for B7 to key on | Unsafe for B7 to key on |
|---|---|
| `recommendation_code = contact_now` | any substring match against `business_summary` or `why_this_lead` prose |
| `signal_code = weak_website` present | "the AI said the website looked bad" |
| `overall_priority_score >= 80` | `suggested_outreach_angle` phrasing |
| `tier = high` | any field not present in `B4_API_DTO_CONTRACTS.md`'s structured response |

This mirrors — and is reinforced by — the frozen S8 Copilot's own governance discipline: its Agent never executes on raw LLM prose either, only on typed `actionType` values behind an approval gate (FB-29). B4 stops one step earlier: it does not execute at all, structured or not, but the *contract shape* it exposes for a future automation consumer is already disciplined the same way.

Whether a stale run's signals remain eligible for an automation trigger is answered in `B4_FRESHNESS_STALENESS.md` §3: **no** — stale intelligence is excluded from automation-trust surfaces.

## 5. The revenue negative invariant, stated exhaustively

> **`B4-D-A026`: B4 emits no event, writes no field, and computes no value that implies recognized or attributed revenue.**

| Concept | B4's relationship to it |
|---|---|
| `RevenueRecognized` (frozen B0 event) | never emitted by B4; B4 has no write path to any revenue-adjacent table or command |
| `RecordRevenueEvent` (frozen B0 command) | never called by B4 |
| Deal `value`, `probability` | never read, written, or estimated by B4 |
| Payment, invoice, subscription state | B4 has no knowledge of it — no field in any B4 DTO references `PAY-*`, `INV-BILL-*`, `SUB-*`, or `UPQ-*` |
| Attribution (`ATT-*`, `REV-*`) | never touched — B4's own `evidence_refs` are a distinct, run-scoped concept and are never confused with attribution touchpoints |

This is enforced structurally, not by policy alone: no B4 table has a foreign key toward a Billing/Revenue table, no B4 command is declared with write scope over one, and `B4_ACCEPTANCE_TESTS.md` includes a negative control (AT-REV-NC) asserting that no implementation may emit a revenue-adjacent event from any B4 code path, mirroring the exact discipline frozen B0 already applies to `DealWon` (*"MUST NOT emit `RevenueRecognized` by default"* — `BACKEND_COMMAND_EVENT_CATALOG.md`).
