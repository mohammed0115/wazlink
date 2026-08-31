# B5 — Domain Ownership

> **B5 status:** Target design only. Defines exactly what B5 owns, in the minimum defensible model, and proves what it explicitly does not.

## 1. What B5 is, precisely

> Converts a governed send decision (human-authored, AI-assisted-but-human-approved, or later a governed automation) into a durable, auditable WhatsApp message exchange with one counterparty, and exposes every inbound/outbound message on that exchange to CRM as a live, non-authoritative read.

B5 sits between B2 (CRM/Lead 360, closed), B4 (AI Lead Intelligence, closed), and the future B6 (Pipeline/Deals) and B7 (Automation). It has one aggregate (`Conversation`), one execution unit per turn (`Message`), and a closed set of output shapes. It does not score opportunities, does not compute pipeline state, and does not execute anything in another domain.

`B5-D-A001`: this document is the source of that decision.

## 2. Frozen anchor — what B0 already committed to

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` already names Messaging's shape, and B5 does not redefine it:

| Frozen field | Frozen value | B5 target |
|---|---|---|
| Canonical owner/module | `messaging` | unchanged |
| Aggregate root | `Conversation` | unchanged — confirmed, not merely inherited (§4) |
| Authoritative tables | `conversations, participants, messages, deliveries` | all four exist in `B5_DATA_MODEL.md`, named `conversations`, `conversation_participants`, `messages`, `message_deliveries` |
| Allowed writers | messaging service/webhook worker | unchanged |
| Primary readers | Inbox, Lead360 | unchanged, confirmed by FB-24 |
| Commands | `SendMessage, ReceiveMessage` | retained; B5 adds additive commands (`B5_COMMAND_EVENT_CATALOG.md` §2) |
| Events | `MessageSent, MessageReceived` | retained; B0's data model row separately names `MessageDelivered`, `MessageFailed` — all four are honored (§`B5_COMMAND_EVENT_CATALOG.md` §3) |
| Integrations | Meta | unchanged |
| Forbidden coupling | "no Deal mutation" | honored structurally (§5, `B5_B6_B7_BOUNDARIES.md`) |

Frozen `BACKEND_INTEGRATION_BOUNDARIES.md` already names the provider port: `MessagingProvider`, outbound + webhook, boundary `Messaging/Webhooks`, notes *"WABA/phone ID, signed callbacks, provider message ID, ordering, session/template rules"*. `B5-D-A008`: B5 reuses this name verbatim — no new port is invented (`B5_PROVIDER_ABSTRACTION.md` §1).

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` also already names a **separate** `Webhooks` domain: aggregate `WebhookReceipt`, table `receipts`, commands `ReceiveWebhook`/`RetryWebhook`, event `WebhookProcessed`, integrations "all callbacks", forbidden coupling "no direct domain mutation". `B5-D-A009`: B5 does **not** duplicate this. Inbound webhook receipt/durability/dedup is that domain's job; B5 consumes its output and owns only the WhatsApp-specific signature verification and payload normalization on top (`B5_WEBHOOK_SECURITY_MODEL.md` §1).

## 3. The minimum entity model

One aggregate root, nine entities, no more:

| Entity | What it is | Persisted? | Public ID? | Owner |
|---|---|---|---|---|
| `Conversation` | one durable exchange with one counterparty on one channel, scoped to one Lead | **yes** | `CONV-*` (frozen, Section A, already workspace-scoped) | B5 |
| `Message` | one inbound or outbound turn within a Conversation | **yes**, immutable content once admitted | `MSG-*` (frozen, Section A, already workspace-scoped) | B5 |
| `MessageDelivery` | the provider transport lifecycle of one outbound Message, or the receipt facts of one inbound Message | **yes**, append-only per status transition | no (embedded/child of Message) | B5 |
| `ConversationParticipant` | a workspace member or CRM contact with standing visibility on a Conversation, distinct from the single current `assigned_to` owner | **yes** | no (workspace-scoped internal id) | B5 |
| `MessageMedia` | metadata for one attachment on one Message | **yes**, metadata only | no (child of Message; the durable file itself is `FILE-*`, B11-owned — `B5_MEDIA_B11_HANDOFF.md`) | B5 (metadata) / B11 (bytes) |
| `TemplateDefinition` | one workspace's local mirror of one Meta-approved template's current metadata | **yes**, mutable (re-synced) | `TPL-*` (**new**, §5, `B5_CONTROLLED_AMENDMENTS.md`) | B5 |
| `MessageTemplateSnapshot` | the immutable template content actually sent, frozen at send time | **yes**, embedded on the sending Message | no | B5 |
| `CommunicationConsent` | opt-in/opt-out/suppression state for one `(workspace, channel, counterparty)` | **yes** | no (workspace+channel+phone keyed) | B5 |
| `ChannelBinding` | one workspace's WhatsApp provider credential/configuration binding | **yes**, one row per workspace in Phase 1 | no (singleton per workspace) | B5 |
| `MessagingUsageRecord` | technical provider-cost/latency telemetry for one provider call | **yes** | no | B5 |

`DOMAIN_AGGREGATE_COUNT = 1`. `DOMAIN_ENTITY_COUNT = 9`.

Two further concepts are **derived, never stored**:

| Concept | Why it is not a table |
|---|---|
| `unread_count` | computed at read time from `messages` (inbound, `status != 'read'`) per Conversation (`B5_MESSAGE_STATE_MACHINE.md` §5) — a result of a query, not a maintained counter with its own drift risk |
| `needs_reply` | computed at read time: `status='open' AND latest_message.direction='inbound'` (FB-13) |

## 4. What each entity is not

| Entity | Explicit non-ownership |
|---|---|
| `Conversation` | does not own Lead status, priority, owner, or any CRM state — those are B2's. It only *references* `lead_id` |
| `Conversation` | does not own the Business, Intelligence score, or any B4 field — those are read live, never copied (`B5_B4_HANDOFF_CONTRACT.md`) |
| `Message` | is not a CRM timeline row and never becomes one directly — B5 exposes a `source_event_id`; B2 projects it (`B5_CRM_TIMELINE_PROJECTION.md`) |
| `Message` | is never itself a Deal, a PipelineStage transition, or a RevenueEvent — B6 reads B5's events and decides independently (`B5_B6_B7_BOUNDARIES.md`) |
| `ChannelBinding` | does not own commercial/entitlement truth — it is a technical credential binding, checked *alongside*, never *instead of*, entitlement (`B5_ENTITLEMENT_RBAC_TENANCY.md` §1) |
| `MessagingUsageRecord` | is never billing truth (mirrors `B4_COST_RATE_LIMIT_MODEL.md` §9's identical discipline) |

## 5. Explicit proof of non-ownership — every candidate the brief names

| Domain concept | B5 relationship |
|---|---|
| `Lead` | **REFERENCED BY B5** — `Conversation.lead_id`, FK only, no write |
| `Contact` | **REFERENCED BY B5** — `Conversation.contact_id` (nullable), FK only, no write |
| `Business` | **READ FROM ANOTHER DOMAIN** — resolved transitively via `Lead.business_id` for context display only, never stored on `Conversation` |
| `IntelligenceRun` | **READ FROM ANOTHER DOMAIN** — `GET /businesses/{id}/intelligence/summary` (B4-owned), read-only, display context only (`B5_B4_HANDOFF_CONTRACT.md`) |
| `Deal` | **READ FROM ANOTHER DOMAIN** (future B6) — never written, never created by B5 |
| `PipelineStage` | **NOT REFERENCED** — B5 has no field naming a stage |
| `AutomationRun` | **DEFERRED** — B7 does not exist yet; B5 designs only the command boundary a future automation must reuse (`B5_B6_B7_BOUNDARIES.md` §3) |
| `RevenueEvent` | **NOT REFERENCED, structurally** — no B5 table has a foreign key toward a Revenue/Billing table (`B5-D-A033`) |
| `Attribution` | **NOT REFERENCED** — same structural argument |
| `Billing` | **NOT REFERENCED** — `ChannelBinding` is a technical credential, never a billing record |
| `Entitlement` (commercial truth) | **READ FROM ANOTHER DOMAIN** — B5 checks capability/quota; it does not own the subscription or plan (`B5_ENTITLEMENT_RBAC_TENANCY.md` §1) |
| `InboundWebhookReceipt` | **REFERENCED BY B5** — owned by the frozen generic `Webhooks` domain (`WHR-*`); B5 consumes its verified, deduplicated output (§2, `B5-D-A009`) |

## 6. Domain boundary summary

```
B2 CRM                       │  B5 Messaging                    │  B4 Intelligence      │  B6 Pipeline (future)
────────────────────────────  ┼ ──────────────────────────────── ┼ ──────────────────── ┼ ───────────────────
owns Lead/Contact/status      │  owns Conversation/Message        │  owns score/signals   │  owns Deal/stage
reads Conversation summary    │  Conversation, Message, Delivery, │  never sends           │  reads Message events
  live (Lead360)               │  Participant, Media, Templates,   │  never holds           │  (future), never
never copies Message truth    │  Consent, ChannelBinding, Usage    │  Conversation state    │  writes Messaging
                               │  reads Lead/Contact/Business/     │                        │
                               │  Intelligence live, never copies  │                        │
                               │  emits source_event_id for CRM    │                        │
                               │  timeline projection              │                        │
                               │  never writes crm_activities,     │                        │
                               │  businesses, leads, or a          │                        │
                               │  Revenue/Billing table            │                        │
```

`B5-D-A001` (full statement): B5 owns `Conversation` (aggregate root) and the nine entities of §3. It references `Lead`, `Contact`, `Business`, and `IntelligenceRun` by stable ID only. It never writes a B2, B3, B4, B6, B7, or Billing/Revenue table.
