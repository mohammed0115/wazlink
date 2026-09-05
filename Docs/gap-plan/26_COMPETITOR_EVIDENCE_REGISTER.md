# 26 — Competitor Evidence Register

> **Competitor research is evidence for gap analysis. It is NOT architectural authority.** No row here becomes a WazLink requirement by virtue of appearing in this document.

`EXTERNAL_COMPETITOR_VERIFICATION = RUN` (network access available; sources fetched 2026-09-04).

## 1. Classification vocabulary

| Class | Meaning |
|---|---|
| `VERIFIED_COMPETITOR_CAPABILITY` | Read directly from the vendor's own current page/documentation during this pass |
| `PROMPT_SUPPLIED_REQUIREMENT` | Named in the task brief; not independently verified against a vendor source |
| `INFERENCE` | Derived by reasoning, not read anywhere |
| `NOT_VERIFIED` | Attempted or assumed, but no primary source read |

## 2. Evidence rows

| # | Claim | Source | URL | Accessed | Class |
|---:|---|---|---|---|---|
| E-01 | Vtiger ships five apps: Marketing, Sales, Help Desk, Projects, Inventory | Vtiger official features page | `https://www.vtiger.com/features/` | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-02 | Vtiger names **"Cases"** (tickets), **"SLAs"** ("set response and resolution targets"), **"Customer Portal"**, **"FAQs"** knowledge base | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-03 | Vtiger names **"CPQ — Configure, Price, and Quote"** and **"Inventory"** including *"price books by customer segment"* | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-04 | Vtiger names **"Import & Export"** with *"field mapping and duplicate handling"* | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-05 | Vtiger names **"Web forms"** for lead capture | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-06 | Vtiger names **"Calendar and Events"**, **"Approvals"**, **"Workflows"**, **"User Management"** with role hierarchy | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-07 | Vtiger names **"Calculus AI"** (predictive recommendations), **"Chatbot"**, **"Prompt Builder"** | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-08 | Vtiger names **"Leads and Contacts"**, **"Deals"**, **"Forecast & Quota"**, **"Deal Room"** | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-09 | Vtiger supports multi-channel support incl. WhatsApp; knowledge base with articles and FAQs | Vtiger blog — CRM modules | `https://www.vtiger.com/blog/top-7-crm-modules-every-business-should-use/` | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-10 | respond.io AI agents *"qualify leads, update CRM and lifecycle fields, recommend products, assign or close chats, trigger workflows, block spam and escalate to human agents in real time"* | respond.io AI agents page | `https://respond.io/ai-agents` | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-11 | respond.io: human takeover lets agents *"claim conversations instantly with one click"*, handoff carries *"full chat history and all relevant context"*, and **"the AI pausing immediately"** | same + omnichannel page | `https://respond.io/omnichannel-ai-crm-conversation-platform` | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-12 | respond.io ships a **multi-user shared inbox** with AI handling routing/assignment | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-13 | WhatsApp Cloud API: templates *"generally require approval"* and are *"the only type of message that can be sent to WhatsApp users outside of a customer service window"* | Meta Cloud API overview | `https://developers.facebook.com/docs/whatsapp/cloud-api/overview` | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-14 | WhatsApp Cloud API: inbound messages **and** all outgoing delivery status updates arrive **via webhook** | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-15 | WhatsApp Cloud API: businesses *"must obtain user opt-in before sending message templates"* | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-16 | WhatsApp Cloud API throughput: 80 msg/s default; pair rate 1 msg / 6 s per user; 200–5000 requests/hour by account status | same | same | 2026-09-04 | `VERIFIED_COMPETITOR_CAPABILITY` |
| E-17 | Sales Orders, Purchase Orders, Vendors, Warehouse as CRM modules | task brief §6A / §7 | — | — | `PROMPT_SUPPLIED_REQUIREMENT` |
| E-18 | Round-robin assignment as a named competitor feature | task brief §6A, §22 | — | — | `PROMPT_SUPPLIED_REQUIREMENT` |
| E-19 | Vtiger's exact ticket-numbering, SLA-clock pause semantics, and escalation ladder | — | — | — | `NOT_VERIFIED` — not read; WazLink's SLA design in `13_SUPPORT_TICKETING_PLAN.md` is derived from first principles, not from Vtiger |
| E-20 | That mid-market Saudi/Arabic SMB buyers specifically demand Price Books | — | — | — | `NOT_VERIFIED` — no market evidence gathered; drives the `PD-009` recommendation to **reject** Price Books for now |

## 3. What the evidence does and does not license

**Licenses a gap investigation** (capability demonstrably exists in the category, and WazLink's absence is real): Tickets/SLA (E-02), Knowledge base (E-02, E-09), Quotes (E-03), Import with field mapping and duplicate handling (E-04), Web forms (E-05), Calendar (E-06), AI conversation agent with human takeover and immediate AI pause (E-10, E-11), shared team inbox (E-12).

**Does not license adoption:**
- **Price Books** (E-03) — verified in Vtiger, but WazLink has no multi-segment pricing evidence. `PD-009` recommends reject.
- **Inventory / Projects apps** (E-01) — explicit non-goals under brief §7. Rejected.
- **Customer Portal** (E-02) — verified, but requires an external-identity surface WazLink has no frozen authority for. Deferred to P2 (`GAP-027`).
- **Sales Orders** (E-17) — prompt-supplied only, no verified source, no WazLink evidence. Rejected.
- **"AI updates CRM fields / closes chats" autonomously** (E-10) — this is the single most consequential competitor behavior, and WazLink **must not** copy it as-designed. `B7_ACTION_CATALOG.md` §3 makes `send_message` `approval_required` *"mandatory, never `auto_safe`, not configurable per-rule"*, and `B4-D-A012` says B4 executes nothing. Adopting respond.io's autonomy model verbatim would breach both. `12_WHATSAPP_AI_HUMAN_PLAN.md` adopts the *capability* (AI drafts, proposes, escalates) while keeping WazLink's frozen human-gate.

## 4. Constraints imported as design input, not as features

E-13 through E-16 are **provider constraints**, not competitor features. B5 already encodes all four (`B5_CUSTOMER_SERVICE_WINDOW.md`, `B5_TEMPLATE_MODEL.md`, `B5_CONSENT_COMMUNICATION_POLICY.md`, `B5_RATE_COST_RETRY_MODEL.md`, and `B5_WHATSAPP_EXTERNAL_VALIDATION_REGISTER.md`). They are recorded here to confirm **no new provider assumption is introduced** by this gap plan. In particular, E-16's pair rate limit is the reason `12_WHATSAPP_AI_HUMAN_PLAN.md` refuses to design AI auto-reply bursts.
