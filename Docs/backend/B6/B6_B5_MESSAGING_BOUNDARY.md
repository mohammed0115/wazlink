# B6 — B5 (Messaging) Boundary

> **B6 status:** Target design only. Frozen `B5_B6_B7_BOUNDARIES.md` already pre-registered this boundary from B5's side (`B5-D-A024`) before B6 existed to occupy it; this document is B6's own mirror-image statement, checked for consistency against B5's, not written independently of it.

## 1. Frozen anchor from B5's side, quoted

`B5_B6_B7_BOUNDARIES.md` §1: *"`B5-D-A024`: B5 never creates a Deal, never changes a PipelineStage, never marks a Deal won or lost, and never recognizes or attributes revenue. Frozen `BACKEND_DOMAIN_OWNERSHIP.md`'s Messaging row already states this forbidden coupling (`"no Deal mutation"`) — B5 restates it structurally, not merely by policy."*

`BACKEND_DOMAIN_OWNERSHIP.md`'s Messaging row forbidden coupling: *"no Deal mutation."* B6's own Pipeline row carries no symmetric-named forbidden coupling toward Messaging in the frozen text, so B6 states it explicitly here, completing the pair.

**`B6-D-A024` (Class A, resolved): B6 never creates a Conversation, never sends a Message, and never mutates `messages`/`message_deliveries`/`conversations` state.** No B6 command has write access to any B5-owned table (`B6_DOMAIN_OWNERSHIP.md` §6).

## 2. What B6 may read from B5

- `GET /leads/{id}/conversations` — B5's own frozen read contract (`B5_B2_CRM_LEAD360_HANDOFF.md` §1), the identical read Lead 360 already uses — to display conversation existence/summary beside Deal context (e.g., a Deal-detail sidebar showing "3 related conversations").
- Nothing else. B6 does not read `message_deliveries`, provider status, or consent state — those remain entirely B5's concern.

**Direct frontend corroboration:** `B6_FRONTEND_BEHAVIOR_INVENTORY.md` FB-D33 — Inbox's conversation context panel already reads the Lead's full Deal list (the reverse direction: Messaging reading Pipeline via the shared Lead), one-directionally; Deal never reads Conversation state in the mock. B6's design keeps this bidirectional-by-shared-Lead, never-direct-to-each-other shape as the target contract.

## 3. Sending a message from Deal context — no shortcut

If a future UI surface allows composing a message directly from a Deal-detail screen, **it must invoke B5's governed `SendMessage`/`SendTemplateMessage` command unchanged**, with every one of B5's own guards intact: RBAC (`message.send`), consent/opt-out, template/customer-service-window rules, provider admission, idempotency, and tenancy. B6 introduces **no** shortcut send path, no B6-owned message-composition command, and no B6 table that could serve as an alternate transport. The Deal-detail screen is, from B5's perspective, just another caller of the identical command every other surface uses — mirroring exactly how `B5_B6_B7_BOUNDARIES.md` §2 already requires of B7's future automation sends.

## 4. Negative control

`AT-B5-1 (NC)`: an implementation where any B6 command or event handler writes a `messages`/`message_deliveries`/`conversations` row, or where a Deal-context "send" affordance bypasses `SendMessage`'s admission sequence — structurally impossible; no B6 command DTO or application service holds a reference to a B5-owned table's write manager.

## 5. Consistency check against B5's own text

B5's `B5-D-A024` states B5 will never mutate Deal/PipelineStage/RevenueEvent/Attribution. This document states the mirror: B6 will never mutate Conversation/Message. Both statements are independently true and non-contradictory — there is no scenario either phase's design permits where one silently reaches into the other's tables. `BROKEN_CROSS_DOCUMENT_REFS` against `B5_B6_B7_BOUNDARIES.md` from this document = 0 (every claim above is either quoted verbatim from B5's frozen text or a symmetric restatement checked against it).
