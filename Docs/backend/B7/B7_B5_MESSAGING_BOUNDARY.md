# B7 — B5 (Messaging) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 consumes from B5

**Nothing in Phase 1.** `B5_DOMAIN_OWNERSHIP.md` explicitly lists `AutomationRun` as **DEFERRED** and pre-declares no event consumer for Automation. `needs_reply` is a read-time computed flag, not an event (`B5_DOMAIN_OWNERSHIP.md` line 57), and cannot be a trigger regardless. `ConversationNeedsReply`/`ConversationClosed`/`MessageReceived`/`MessageDelivered`/`MessageFailed` are all deferred (`B7_TRIGGER_CATALOG.md` §3), despite appearing in the frontend's trigger catalog (FB-D02) — evidence for *consumption* is weaker here than for B2/B6 (no frozen consumer declaration, no dedicated boundary doc naming them), so Phase 1 does not include them.

## 2. What B7 invokes on B5

`SendMessage`/`SendTemplateMessage`, mandatory `approval_required`, per `B5-D-A025`'s explicit reservation of `senderType='system'` for exactly this and `B5_MESSAGE_STATE_MACHINE.md`'s explicit forward-reference to "B7's future governed-automation sends" (`B7_ACTION_CATALOG.md` §3). Through B5's unmodified admission sequence — consent, suppression, service-window policy, template requirements, rate limits, idempotency, and audit all apply exactly as they do to a human-invoked send (`B5-D-A025`, restated).

## 3. What B7 never does

Never writes `conversations`/`messages`/`message_deliveries`. Never bypasses consent, the customer-service-window rule, or template requirements — there is no B7 code path that reaches a `Message`/`Conversation` repository directly (`B7_DIRECT_WRITE_FIREWALL.md` §2). Never grants automation a larger or exempted rate/quota pool than any other caller (`B5_B6_B7_BOUNDARIES.md` §2's explicit "B7 does not get its own larger or exempted pool," restated and preserved unmodified).

## 4. The forbidden-list tension, resolved explicitly

`forbiddenAutomationActions` (FB-D06) names `send_message`/`send_whatsapp` — the mock's own conservative demo posture, explicitly self-disqualified as backend-mechanism truth (FB-D23). Two independent frozen documents (`B5_MESSAGE_MODEL.md` §2's reserved `senderType='system'`, `B5_MESSAGE_STATE_MACHINE.md`'s named forward-reference) point the opposite direction for the real backend. B7 resolves this by including the action under **mandatory, non-configurable `approval_required`** — full detail and justification in `B7_ACTION_CATALOG.md` §3.

## 5. Negative controls

`AT-B5MSG-1` **(NC)**: an implementation invoking `SendMessage` from a B7 action with `execution_policy='auto_safe'` — fails; the action's safety tier is fixed `approval_required` in the catalog and cannot be loosened by any rule's own policy (`B7_ACTION_AUTHORIZATION.md` §2). `AT-B5MSG-2` **(NC)**: an implementation writing a `messages` row directly, bypassing `SendMessage` — fails (`B7_DIRECT_WRITE_FIREWALL.md` §3).
