# B5 — B6 (Pipeline) and B7 (Automation) Boundaries

> **B5 status:** Target design only. Neither B6 nor B7 is designed. This document states only what B5 guarantees them, mirroring `B3_B4_HANDOFF_CONTRACT.md`'s and `B4_DOWNSTREAM_HANDOFFS.md`'s identical pattern one phase forward.

## 1. B6 — Pipeline / Deals (future)

> **`B5-D-A024`: B5 never creates a Deal, never changes a PipelineStage, never marks a Deal won or lost, and never recognizes or attributes revenue. Frozen `BACKEND_DOMAIN_OWNERSHIP.md`'s Messaging row already states this forbidden coupling ("no Deal mutation") — B5 restates it structurally, not merely by policy.**

| B6 may consume from B5 | Field |
|---|---|
| Conversation existence/status for a Lead | `GET /leads/{id}/conversations` (`B5_B2_CRM_LEAD360_HANDOFF.md` §1) — the same read Lead 360 uses |
| Message events, for a future "customer replied" Deal-stage-suggestion signal | `OutboundMessageAccepted`/`InboundMessageReceived` domain events, if B6 later chooses to consume them (not required by B5) |

| B6 must never assume | Why |
|---|---|
| that a B5 event implies a stage change | B5 has no concept of pipeline stages; a message being sent or received carries no commercial-progress semantics on its own |
| that B5 will create a Deal | out of scope structurally — no B5 command references `DEAL-*` anywhere in `B5_COMMAND_EVENT_CATALOG.md` |

**Explicit negative invariant:** a Conversation reaching any state, a Message being sent, delivered, or read, never implies, and is never read by any B5 code path as implying, a Deal being created, won, or lost, or any payment/conversion outcome. No B5 field is named, typed, or documented in a way that could be mistaken for a commercial probability estimate — mirroring `B4_DOWNSTREAM_HANDOFFS.md` §3's identical `fit_score`-naming caution.

## 2. B7 — Automation (future) — the governed command boundary

> **`B5-D-A025`: a future automation-triggered send must call the identical `SendMessage`/`SendTemplateMessage` command, through the identical admission sequence (`B5_OUTBOUND_PIPELINE.md` §2), as any human actor. There is no second "automation send" transport path, now or reserved for later.**

This is the direct architectural answer to the brief's §24: automation cannot bypass RBAC, entitlement, consent, suppression, customer-service-window policy, template requirements, rate limits, idempotency, or audit, because none of those checks live *outside* the one shared admission sequence — there is nowhere else to enter. A `senderType` value already exists for this (`system`, `B5_MESSAGE_MODEL.md` §2, reserved and unused in Phase 1) precisely so that when B7 arrives, it is a new **caller** of the existing command, not a new code path.

| What B5 reserves for B7, undesigned | What B5 already fixes so B7 cannot loosen it |
|---|---|
| the concrete automation trigger catalogue (which events fire which rule) | none — that is entirely B7's to design |
| whether an automation-originated send requires a distinct approval step before admission | none — but *whatever* B7 designs, the send itself still passes through `B5_OUTBOUND_PIPELINE.md` §2 unmodified |
| rate/quota treatment specific to automation | the workspace-level admission ceiling (`B5_RATE_COST_RETRY_MODEL.md` §2) is shared across every caller by construction — B7 does not get its own larger or exempted pool |

**Corroboration from the frozen frontend:** `forbiddenAutomationActions` already includes both `"send_message"` and `"send_whatsapp"` (`data.js:815`) — the product's own existing automation-forbidden-list independently confirms that autonomous send is not merely undesigned but actively excluded from what a rule may do directly. B5's design is compatible with that list remaining exactly as strict as it is today, or with a future B7 phase deliberately, explicitly relaxing it through the *same governed command* — never through a bypass.

## 3. What B5 does not build for either

No Deal table, no PipelineStage enum, no AutomationRule/Trigger/Condition/Action table, no RevenueEvent reference anywhere in `B5_DATA_MODEL.md`. `B5_ACCEPTANCE_TESTS.md`'s `B6_BOUNDARY`/`B7_BOUNDARY` categories carry the negative controls proving this structurally, not merely by convention.
