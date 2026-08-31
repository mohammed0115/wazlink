# B5 — B4 (AI Lead Intelligence) Handoff Contract

> **B5 status:** Target design only. B4's recommendation is advisory only. B4 does not send WhatsApp messages, and never will through any B5 code path.

## 1. What B5 consumes from B4

| Consumed | Via | Purpose |
|---|---|---|
| `IntelligenceSummary` (`score`, `tier`, `confidence`, `recommended_action`) | `GET /businesses/{id}/intelligence/summary` (B4-owned) | display-only context in the Conversation's side panel (FB — `Inbox.tsx:518-531`'s "ذكاء الفرص — قراءة فقط") |
| `Recommendation.reason` / `suggested_outreach_angle` presentation artifact | same endpoint | may inform what a human chooses to say — never what is actually sent without human action |

B5 never writes to any B4 table, never calls `RequestBusinessIntelligence`/`ReanalyzeBusinessIntelligence`, and never subscribes to `BusinessIntelligenceCompleted` — this read is a synchronous, on-demand display query, not an event-driven dependency, mirroring B4's own "no B4→B3 event dependency for correctness" precedent one layer forward.

## 2. What B4 explicitly does not do (restated from B4's own frozen boundary)

`B4_DOWNSTREAM_HANDOFFS.md` §2 (frozen at B4 closure) already states: *"B4 does not send messages, draft messages for auto-send, or hold any Conversation state. No B4 command references a `CONV-*` or `MSG-*` identity."* B5 does not weaken this — no B5 command accepts a B4 run ID as an authorization input, and no B4 field is treated by any B5 code path as send authorization.

## 3. Recommendation existence never equals send authorization

> **`B5-D-A021`: a B4 `Recommendation` (however high-confidence, however evidence-backed) is read-only display context. It has no field, flag, or side channel that admits a `SendMessage` call. Every send — regardless of what motivated the human to request it — passes through the identical admission sequence (`B5_OUTBOUND_PIPELINE.md` §2): permission, entitlement, consent, window policy, idempotency, rate limit.**

This is the direct architectural answer to the brief's §20: `contact_now` existing on a run changes nothing about whether a send is authorized. A human views it, and *decides* — the decision is the send request, not the recommendation.

## 4. AI-generated drafts — who owns generation, and why it doesn't matter for governance

The frozen frontend's S8 Sales Copilot (not B4 — see `B4_FRONTEND_TRACEABILITY.md` §2, `B4-D-C002`) generates `suggested_reply` text and stages it into the composer's draft (FB-30). B5 does not need to resolve *which* future domain (a B4 extension, a dedicated B5 draft-assist feature, or S8's eventual real backend) owns draft generation, because B5's governance boundary does not depend on the answer:

> **`B5-D-A021`'s companion: AI-generated or AI-assisted message text is untrusted content until a human submits it through the ordinary composer/send path. There is no distinct "AI send" command, permission, or bypass anywhere in `B5_COMMAND_EVENT_CATALOG.md`.**

Which future domain owns *generating* the draft (a B4 extension, a dedicated B5 draft-assist feature, or S8's own eventual real backend) is deliberately not resolved here — `B5-D-C009`, Class C — because B5's governance boundary is invariant to the answer: whoever generates the text, it enters B5 only as untrusted `body` content on an ordinary send request.

`Message.assistance` (`B5_MESSAGE_MODEL.md` §2) tags a send as Copilot-assisted for audit — it changes nothing about which admission checks run, mirroring FB-31's frozen evidence exactly: `senderType` stays `"user"`, and every check in `B5_OUTBOUND_PIPELINE.md` §2 applies identically whether the text was typed or drafted.

## 5. Provider prompt output never mutates transport state directly

No provider (AI or WhatsApp) response is ever written directly into `Message.status` or `MessageDelivery` outside the governed pipelines (`B5_INBOUND_PIPELINE.md`, `B5_OUTBOUND_PIPELINE.md`, `B5_WEBHOOK_SECURITY_MODEL.md`). An LLM's output reaching Messaging at all (as drafted text) is several steps removed from transport state and passes through the identical human-gated `SendMessage` admission as any other content — there is no code path where an AI provider's response field is interpreted as a status update, a delivery confirmation, or an authorization grant.

## 6. Forward corroboration from the frozen S8 Agent

`B4_FRONTEND_TRACEABILITY.md` FB-29 already documents the frozen S8 Agent's own hard-coded forbidden-action list, which includes `send_message` — a governed future Agent is explicitly forbidden from sending even with approval-mode enabled. This is independent corroboration, from the frontend's own source, that autonomous send is not merely undesigned but actively prohibited by the product's existing governance model. B5 preserves this prohibition structurally: no B5 permission, command, or DTO exists that a fully-autonomous caller could use to bypass human submission.
