# 21 — Demo Plan

> Resolves brief §37. Every demo maps to defined `GAP-*` IDs and produces client-visible progress.

## Demo A — Manual customer to first deal · **END OF G0**
**Gaps** `GAP-001`, `GAP-002`, `GAP-003`, `GAP-005`, `GAP-025`

*(Corrected: the earlier "after G0/G1" label was stale. Every dependency of this script lands in G0; `GAP-004` conversion is a G1 addition to the demo, not a precondition for it.)*
**Script** Create a customer manually (show **both** `party_kind` shapes: a company with two contacts, and an individual with one) → mark a primary contact → open Customer 360 → add a task → create a deal → show the timeline.
**Proves** CRM works with **ZERO Discovery dependency**, for B2B **and** B2C.
**The three things demonstrated explicitly on screen:**
1. **No `DiscoveryJob`** — the workspace is created with zero `discovery_jobs` rows and that is shown.
2. **No fake Business** — the Lead/Customer carries no `business_id`.
3. **No fake provenance** — no `lead_provenance` row exists for the manual Lead, and none is fabricated.
**Watch for** any prompt for a Business or a Discovery job, or any synthesized provenance — each is a failure, not a rough edge.

## Demo B — CSV to Customer 360 *(after G2)*
**Gaps** `GAP-008`, `GAP-006`, `GAP-010`/`GAP-011` (a custom field is mapped in the wizard)  *(duplicate **detection** only; `GAP-007` merge execution is P1 and not demonstrated here)*
**Script** Upload a CSV containing a deliberate duplicate and a deliberate invalid row → map columns including one custom field → **dry run** showing counts, the invalid row and the duplicate candidate → commit → watch live progress → results with 2 succeeded / 1 failed / 1 duplicate-flagged (**flagged as an advisory candidate, not merged**) → download the error CSV → correct and re-import → open an imported Customer 360.
**Proves** production-safe bulk onboarding with honest partial failure.
**Watch for** the dry run writing anything — the single most important negative control in the release.

## Demo C — WhatsApp inbound to OpenAI-backed assistance and human takeover · **END OF G3**
**Gaps** `GAP-006`, `GAP-012`, `GAP-013`, `GAP-014`, `GAP-015`
**Script** Inbound WhatsApp from a phone belonging to an **existing customer's contact** → identity resolves and the Team Inbox shows Customer 360 context → conversation is in `ai_assisted` → the AI Agent domain calls the **AI Provider Port → OpenAI Adapter → OpenAI** and drafts a reply **grounded in a published KB article, with the citation visible** → **a human** reviews, edits, and sends through the frozen `SendMessage` path → a second inbound arrives → human takes over → **mode flips to `human` and AI proposals stop immediately** → return to `ai_assisted`.
**Then the safety half:** an inbound from an **unknown** number → conversation opens **unlinked** with `unresolved` → **no Lead and no Customer is created** → the human accepts a proposal to create a Contact, and only then does a record exist.
**Proves** WhatsApp → Identity Resolution → Customer/Lead context → OpenAI-backed AI assistance → human takeover / human Send. Governed AI: helpful, grounded, and **incapable of sending or creating on its own**.
**The demo must NOT autonomously send an AI message** (`PD-013`). **Watch for** any auto-send, any auto-created Lead/Customer, any uncited answer, or any OpenAI-specific string surfacing in a business screen or contract.

## Demo D — Conversation to resolved ticket *(after G4)*
**Gaps** `GAP-016`, `GAP-017`
**Script** From the conversation in Demo C, create a ticket → it inherits customer and contact → SLA clock starts and the first-response target is visible → reply (first response satisfied) → set `pending` (**resolution clock pauses on screen**) → customer replies, back to `open` (clock resumes) → resolve → close. Then show a deliberately breached ticket in the list.
**Proves** support with real SLA semantics.
**Watch for** a breach auto-escalating or auto-messaging — it must only report.

## Demo E — Customer to accepted quote *(DEFERRED with G5)*
**Gaps** `GAP-018`, `GAP-019`, `GAP-020`
**Script** Open a Customer → create a Deal → build a Quote from catalog products with a discount → send → accept.
**Then the firewall demonstration, shown deliberately and out loud:**
1. Analytics revenue **before** accepting: *X*.
2. Accept the quote.
3. Analytics revenue **after**: **still exactly *X***.
4. Show the Deal is still open — accepting a quote did **not** move the stage.
5. Show that recognizing revenue requires the separate, permissioned `RecordRevenueEvent` path.
**Proves** *Accepted Quote ≠ Recognized Revenue* and *Won Deal ≠ Recognized Revenue* as observable behavior, not as documentation.
**Watch for** any revenue figure moving. That is a firewall breach and a release blocker.

## Demo F — Protected intake to assigned lead *(after G6)*
**Gaps** `GAP-022`, `GAP-021`  *(`GAP-009` public form intake deferred under `PD-010`)*
**Script** An **authenticated/protected API intake** creates a Lead with consent recorded → round-robin assigns it → the owner sees it and a follow-up task appears on the calendar.
**Watch for** an intake reaching another workspace. *(The public unauthenticated form demo returns only when `GAP-009` is approved and its abuse surface is designed.)*

## Coverage
Demos A–D and F exercise every gap in the approved waves. **Demo A is the earliest proof that CRM works without Discovery (end of G0); Demo C is the earliest proof of WhatsApp → Identity → Customer/Lead → AI/Human operation (end of G3).** Not demoed: `GAP-023` (reporting — shown as dashboards inside the other demos), and the deferred set (`GAP-007`, `GAP-009`, `GAP-018`–`GAP-020`, `GAP-024`, `GAP-026`, `GAP-027`).
