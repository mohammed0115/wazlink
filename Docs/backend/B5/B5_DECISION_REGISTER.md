# B5 — Decision Register

> **Class A** — must be resolved before B5 closes. **Class B** — may be resolved during implementation preparation without changing architecture. **Class C** — belongs to a later phase or is genuinely non-blocking.
>
> **B5 cannot close with an unresolved Class A.**

## 1. Class A — resolved

| ID | Question | Decision | Rationale | Where |
|---|---|---|---|---|
| `B5-D-A001` | What is B5's aggregate/entity model? | **`Conversation`** root; 9 owned entities (`Message`, `MessageDelivery`, `ConversationParticipant`, `MessageMedia`, `TemplateDefinition`, `MessageTemplateSnapshot`, `CommunicationConsent`, `ChannelBinding`, `MessagingUsageRecord`); explicit non-ownership of Lead/Contact/Business/IntelligenceRun/Deal/PipelineStage/AutomationRun/RevenueEvent/Attribution/Billing/Entitlement | matches frozen B0's own aggregate name and table-group list exactly | `B5_DOMAIN_OWNERSHIP.md` |
| `B5-D-A002` | Is Conversation identity Business-keyed, Lead-keyed, or phone-keyed? | **Lead-keyed.** `lead_id` required, immutable | frontend evidence (FB-02/FB-25) and B2's own frozen cross-domain contract both require it; unlike B4, Messaging is post-conversion by product design | `B5_CONVERSATION_MODEL.md` §2–§3 |
| `B5-D-A003` | How many Conversations per Lead+contact+channel? | **Exactly one, reusable.** `(workspace, channel, lead_id, counterparty_phone_e164)` unique; reopen, never fork | resolves the FB-26 fixture tension explicitly, using `reopenConversation`'s own existence as deciding evidence | `B5_CONVERSATION_MODEL.md` §3 |
| `B5-D-A004` | Is Message content mutable after admission? | **No.** Immutable except `status`/delivery history | matches frozen frontend's own in-place-retry rule (FB-08) exactly | `B5_MESSAGE_MODEL.md` §3 |
| `B5-D-A005` | Business truth vs. provider transport state? | **Separated.** `Message` = authored content; `MessageDelivery` = transport lifecycle | prevents provider callbacks from ever rewriting what was said | `B5_MESSAGE_MODEL.md` §1 |
| `B5-D-A006`/`B5-D-A007` | One status vocabulary or two? | **Two, disjoint.** Outbound: 7 states; inbound: 2 states | the frozen fixture's own data already disproves a shared enum (`received` never appears in `messageDeliveryLabels`) | `B5_MESSAGE_STATE_MACHINE.md` §1–§3 |
| `B5-D-A008` | What provider port name? | **`MessagingProvider`** — reuses frozen `BACKEND_INTEGRATION_BOUNDARIES.md`'s already-assigned name | no new port name where a frozen one already fits | `B5_PROVIDER_ABSTRACTION.md` §1 |
| `B5-D-A009` | Who owns `InboundWebhookReceipt`? | **The frozen generic `Webhooks` domain** (`WHR-*`). B5 references it, owns only WhatsApp-specific verification/normalization | frozen B0 already names this domain; duplicating it is gratuitous drift | `B5_DOMAIN_OWNERSHIP.md` §2 |
| `B5-D-A010` | Is webhook signature verification mandatory before any processing? | **Yes, unconditionally**, sync or async, no "verify later" path | closes the forged-webhook attack class at the root | `B5_WEBHOOK_SECURITY_MODEL.md` §3 |
| `B5-D-A011` | Where does webhook workspace resolution come from? | **Only the verified `ChannelBinding`, never the payload.** Workspace is a consequence of *which secret verified*, not a claimed field | closes the cross-workspace webhook-routing attack structurally | `B5_WEBHOOK_SECURITY_MODEL.md` §4 |
| `B5-D-A012` | How many WhatsApp numbers per workspace, Phase 1? | **Exactly one `ChannelBinding`.** No shared/global WazLink number | matches Meta's own one-number-one-WABA model and the frontend's per-workspace `INT-1002` fixture | `B5_PROVIDER_CONFIGURATION_MODEL.md` §1 |
| `B5-D-A013` | Is webhook processing idempotent? | **Yes, at two layers** — generic receipt dedup, plus status-application monotonicity | prevents duplicate/redelivered webhooks from double-counting or corrupting state | `B5_WEBHOOK_SECURITY_MODEL.md` §5 |
| `B5-D-A014` | Can a stale/regressive status webhook mutate durable truth? | **No.** Only forward-legal transitions apply; regressions are recorded, never applied | closes the "stale webhook regresses truth" attack | `B5_MESSAGE_STATE_MACHINE.md` §4 |
| `B5-D-A015` | How is an ambiguous provider timeout handled? | **Never a blind resend.** A `submitted` state plus bounded reconciliation resolves it | closes the double-send-via-timeout attack | `B5_OUTBOUND_PIPELINE.md` §4 |
| `B5-D-A016` | Who owns consent/suppression? | **B5**, via `CommunicationConsent`, keyed `(workspace, channel, phone)` — not a B2 Contact field | a phone can be opted out before any Contact link exists | `B5_CONSENT_COMMUNICATION_POLICY.md` §1 |
| `B5-D-A017` | Can opt-out ever be overridden? | **No. Absolute, no override path, at any privilege level, in Phase 1** | the brief's explicit question, answered directly | `B5_CONSENT_COMMUNICATION_POLICY.md` §3 |
| `B5-D-A018` | Is the customer-service window hard-coded or evaluated? | **An explicit 4-outcome evaluator**, duration sourced externally (`B5-X-010`), never hard-coded in domain logic | avoids baking an unconfirmed provider fact into frozen architecture | `B5_CUSTOMER_SERVICE_WINDOW.md` §2 |
| `B5-D-A019` | Is a synced template mirror the same as the sent record? | **No — two concepts.** `TemplateDefinition` (mutable mirror) vs. `MessageTemplateSnapshot` (immutable, embedded) | a later template edit/disable must never rewrite sent history | `B5_TEMPLATE_MODEL.md` §1 |
| `B5-D-A020` | Does B5 own media storage? | **No.** Reference/metadata only; durable bytes are B11's `FILE-*` | frozen B0 already owns a Files domain; no duplication | `B5_MEDIA_B11_HANDOFF.md` §1 |
| `B5-D-A021` | Does a B4 recommendation authorize a send? | **Never.** Recommendation existence ≠ send authorization; AI-drafted text is untrusted until a human submits it through the ordinary path | direct frontend evidence (FB-30/FB-31); mirrors S8's own hard-coded `send_message` prohibition | `B5_B4_HANDOFF_CONTRACT.md` §3–§4 |
| `B5-D-A022` | Is actor-initiated send idempotent? | **Yes.** `Idempotency-Key` required on `SendMessage`/`SendTemplateMessage`/`CancelMessage`; replay = stored response, no second slot | prevents double-click/network-retry double-sends | `B5_IDEMPOTENCY_CONCURRENCY.md` §2 |
| `B5-D-A023` | Does B5 write CRM timeline rows directly? | **Never.** B5 exposes a stable `source_event_id`; B2 projects it at read time | satisfies frozen `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1's cross-domain contract exactly | `B5_CRM_TIMELINE_PROJECTION.md` |
| `B5-D-A024` | Can B5 mutate Deal/Pipeline/Revenue state? | **Never.** Structural — no B5 table has a foreign key toward one | matches frozen B0's "no Deal mutation" forbidden-coupling note | `B5_B6_B7_BOUNDARIES.md` §1 |
| `B5-D-A025` | How will future B7 automation send messages? | **Through the identical `SendMessage`/`SendTemplateMessage` command and admission sequence** every human actor uses — no second transport path | closes automation-bypasses-governance before B7 exists to be tempted by it | `B5_B6_B7_BOUNDARIES.md` §2 |
| `B5-D-A026` | Is "can send" one flag or several checks? | **Five independent gates** — provider-configured, feature-entitled, quota-available, permission-granted, recipient-eligible | no client-side flag is ever trusted as send authority | `B5_ENTITLEMENT_RBAC_TENANCY.md` §5 |
| `B5-D-A027` | What bounds automatic transient retry, and where does cancellation stand? | **`MAX_SEND_ATTEMPTS_PER_MESSAGE = 3`**, B5-owned, layered under (not derived from) frozen B0's higher generic ceilings; cancellation never refunds the workspace admission counter | learns B4's post-audit provenance-wording lesson proactively; closes the cancel-refund-spend-loop attack | `B5_RATE_COST_RETRY_MODEL.md` §4, §6 |
| `B5-D-A028` | Does a frozen messaging rate limit already exist? | **No — B5 proposes one.** New row, `Messaging send — 300/hour/workspace`, controlled amendment, existence Class A / exact number Class B | closes unbounded-send before requesting closure, the exact B4 lesson applied here from the start | `B5_RATE_COST_RETRY_MODEL.md` §1 |
| `B5-D-A029` | Is unread count stored or computed? | **Computed at read time**, never a maintained/cached counter | avoids the drift risk the frozen fixture's own cached-counter pattern would introduce in a real concurrent system | `B5_CONVERSATION_MODEL.md` §7 |
| `B5-D-A030` | What is the message ordering key? | **`(conversation_id, created_at ASC, public_id ASC)`**, immutable, stable under every status transition | thread order must never re-sort on a status change | `B5_MESSAGE_MODEL.md` §2, `B5_MESSAGE_STATE_MACHINE.md` §6 |
| `B5-D-A031` | Is a phone number ever a cross-workspace identity? | **Never.** Every resolution is `(workspace, channel, phone)`-scoped | two workspaces messaging the same real phone number get two fully independent histories | `B5_CONTACT_PHONE_RESOLUTION.md` §9 |
| `B5-D-A032` | What is `provider_message_id` unique against? | **`(workspace_id, channel_binding_id, provider_message_id)`**, never global | two different WABAs must never collide on an overlapping provider-assigned ID | `B5_ENTITLEMENT_RBAC_TENANCY.md` §7 |
| `B5-D-A033` | Can any B5 field/event imply revenue? | **Never.** No B5 table has a foreign key toward a Billing/Revenue table | mirrors frozen B0's `DealWon`/`RevenueRecognized` separation | `B5_B6_B7_BOUNDARIES.md` §1 |
| `B5-D-A034` (revised, `B5-FIX.1`) | Are new permission codes needed? | **Two new** (`messaging.manage`, `messaging.provider.manage`); **two REUSED verbatim from frozen `B1_AUTHORIZATION_RBAC.md`** (`conversation.view`, `message.send`) with their existing role matrices unchanged — not invented as new. The original B5 pass incorrectly claimed frozen B1 had no `conversation.*`/`messaging.*` permission at all; independent audit found both `conversation.view` and `message.send` already frozen there, `message.send` tracing further to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23 | credential handling needs materially higher privilege than sending; `conversation.view`/`message.send`'s exact names and role matrices are not B5's to redefine — B1/B0 already committed to them, and B5 must not mint a second, differently-named permission (`messaging.send`) for authority `message.send` already grants | `B5_ENTITLEMENT_RBAC_TENANCY.md` §1 |

**`CLASS_A_UNRESOLVED = 0`.** All 34 Class A questions are decided.

## 2. Class A unresolved

**None.**

## 3. Class B — implementation preparation

| ID | Item | Why it is not Class A |
|---|---|---|
| `B5-D-B001` | the exact ambiguous-send reconciliation window duration | existence of a bounded window is Class A (`B5-D-A015`); the duration is tunable |
| `B5-D-B002` | the exact `ChannelBinding` periodic health-check interval | existence of a periodic check is Class A; the interval is operational |
| `B5-D-B003` | the exact trigger/mechanism for updating `Conversation.contact_id` after a late Contact link | the "history is never rewritten" principle is Class A (`B5-D-A004`'s corollary); the forward-update mechanism is implementation detail |
| `B5-D-B004` | the exact stop-keyword list for inferring opt-out from inbound text | the *existence* of an inbound-derived opt-out path is Class A (`B5-D-A016`); the keyword roster is tunable and jurisdiction-dependent |
| `B5-D-B005` | the exact template-variable validation rule set beyond the seven attack classes named | the requirement of closed-schema validation is Class A (`B5-D-A019`'s companion); the precise rule list is refinable |
| `B5-D-B006` | the exact content-type roster beyond the nine defined | the closed-set discipline is Class A; the roster is extensible within it, same "existence A, roster B" pattern as B4's signal taxonomy |
| `B5-D-B007` | the exact `MESSAGING_SEND_CEILING_PER_WORKSPACE_PER_HOUR` value (currently 300) | existence of a ceiling is Class A (`B5-D-A028`); the number is calibrated in staging, per `BACKEND_RATE_LIMIT_POLICY.md`'s own "initial architecture targets, not guarantees" framing |
| `B5-D-B008` | whether `SendMessage` consumes a commercial quota unit | provisional, pending B8 — mirrors `B3_QUOTA_COST_CONTROL.md`/`B4_COST_RATE_LIMIT_MODEL.md` §10's identical "provisional until B8" posture |

**`CLASS_B_UNRESOLVED = 8`.**

## 4. Class C — later phases / non-blocking

| ID | Item | Owner |
|---|---|---|
| `B5-D-C001` | Conversation labels/tags | no frontend evidence or stated need exists today; purely additive if a future phase needs it |
| `B5-D-C002` | multiple `ChannelBinding`s per workspace (multi-number merchants) | a later phase; Phase 1 is one binding per workspace (`B5-D-A012`) |
| `B5-D-C003` | resolution for a genuinely unlinked inbound number (no Contact, no Lead at all) | deferred pending product decision; the demonstrated frozen case (known Lead, unknown Contact) is designed as Class A |
| `B5-D-C004` | Conversation merge across a Contact phone-number change | never automatic (`B5-D-A031`'s companion); an explicit future operator action if ever built |
| `B5-D-C005` | Lead hard-deletion cascade behavior | B2 exposes no delete path today to design against |
| `B5-D-C006` | cross-workspace result caching of any kind | **prohibited**, not deferred — listed to record it was considered and rejected, mirroring `B4-D-C006`'s identical framing |
| `B5-D-C007` | CSV/formula-injection mitigation for a future message export feature | no export surface exists in this phase |
| `B5-D-C008` | data retention durations for `conversations`/`messages`/`message_media` | **PRODUCT/LEGAL** decision required, mirrors `B4_DATA_MODEL.md` §4's identical posture |
| `B5-D-C009` | which future domain owns AI draft-text *generation* (a B4 extension, a dedicated B5 feature, or S8's real backend) | B5's governance boundary is invariant to the answer (`B5-D-A021`) — the question does not need resolving to close B5 |

**`CLASS_C_UNRESOLVED = 9`.**

## 5. External validation register

See `B5_WHATSAPP_EXTERNAL_VALIDATION_REGISTER.md` for provider-specific and legal facts B5 must not invent — none blocks design closure.

## 6. Decisions inherited rather than made

Recorded so no reader mistakes silence for an open question: every ADR, the frozen B0 event envelope/retry policy/idempotency standard/error catalog/API standard, B1's roles/permissions/authorization pipeline (extended additively, `B5_ENTITLEMENT_RBAC_TENANCY.md` §1), and every B2/B3/B4 contract this corpus consumes unchanged.
