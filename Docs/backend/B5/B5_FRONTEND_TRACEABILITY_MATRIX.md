# B5 — Frontend Traceability Matrix

> **B5 status:** Target design only. Every row was traced from the frozen frontend (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`) before any backend concept was invented. Classification follows B2/B3/B4's convention: **A** = authoritative current product behavior B5 must preserve, **B** = UX prototype requiring a backend target, **C** = future/placeholder, **D** = conflicting/stale/dead.

## 0. Where messaging concepts live

| Subsystem | File(s) | Scope |
|---|---|---|
| **S7 — Inbox / WhatsApp (mock)** | `client/src/features/inbox/Inbox.tsx`, `client/src/domain/data.js` (conversations/messages fixtures + service functions) | The full messaging surface. **This is B5's scope.** Self-discloses as local-only: *"رسائل واتساب محلية تجريبية فقط: لا API ولا Webhook ولا Meta/Twilio ولا رد آلي"* (`Inbox.tsx:5-7`) |
| **S8 — Sales Copilot** | `client/src/domain/sales-ai.js`, `client/src/features/ai/CopilotPanel.tsx` | Reads Conversation/Message read-only, stages a draft into the composer. **Governed by B4's boundary, consumed by B5 only as an untrusted-text source — see `B5_B4_HANDOFF_CONTRACT.md`.** |
| **S11 — Integrations** | `client/src/features/settings/Integrations.tsx`, `data.js` (`INT-1002`) | The WhatsApp provider-configuration UI. **This is B5's scope for `B5_PROVIDER_CONFIGURATION_MODEL.md`.** |

## 1. S7 — Inbox (B5 scope)

| # | Behavior | File:line | Frontend field/state | Class |
|---|---|---|---|---|
| FB-01 | Conversation has exactly two states: `open`, `closed` | `data.js:519` | `conversationStatusLabels` | **A** |
| FB-02 | Every Conversation carries `leadId`, `contactId` (nullable), `channel`, `assignedTo`, `status`, `lastMessageAt`, `unreadCount`, `createdAt`, `updatedAt` | `data.js:60-63` | `conversations` fixture | **A** (shape) / **B** (fixture values) |
| FB-03 | `contactId` can be `null` — a Conversation can exist with no linked CRM Contact (unknown/unlinked counterparty) | `data.js:62` (`CONV-3044`) | `contactId:null` | **A** — first-class "unknown inbound" case |
| FB-04 | Outbound message delivery states observed/labelled: `queued`, `sent`, `delivered`, `read`, `failed` | `data.js:520` | `messageDeliveryLabels` | **A** (label set) — `read` is defined but never reached by the local simulation (§3 below); this is a labelled-but-unreachable state in the mock, not evidence it is unused in the real system |
| FB-05 | Inbound message status observed: `received`, `read` — a **distinct** vocabulary from outbound | `data.js:67,69,72,73` (`status:"received"` / `"read"`) | `messageFixtures` | **A** — inbound and outbound do not share one status enum |
| FB-06 | Every outbound message starts `senderType:"user"`; there is no automated/AI sender type anywhere in the fixture | `data.js:539` (`sendMockMessage`) | `message.senderType` | **A** — no autonomous send exists today, at any layer |
| FB-07 | Local outbound simulation advances `queued → sent → delivered` only, on an 800ms interval; it never reaches `failed` or `read` on its own | `Inbox.tsx:70-76`, `data.js:540` | `advanceMockMessageStatus` | **B** — pure client-side animation. The backend target is a real async provider pipeline with real states (§`B5_MESSAGE_STATE_MACHINE.md`); it owes the frontend no timer-driven reveal protocol |
| FB-08 | Retry re-uses the **same** message row — no new message is created | `Inbox.tsx:344-355`, `data.js:541` | *"أُعيدت المحاولة على الرسالة نفسها بلا نسخة جديدة"* | **A** — retry is in-place, not a new send |
| FB-09 | Composer is disabled and send is rejected unless `conversation.status === "open"` | `Inbox.tsx:394,410,444`, `data.js:539` | — | **A** |
| FB-10 | Closing a conversation is rejected while any inbound message is unread; the failure is distinguishable from a hard error | `data.js:542` | `{kind:"unread"}` vs `{kind:"closed"}` | **A** |
| FB-11 | Reopen is only legal from `closed`; there is no "start a second conversation" affordance anywhere in the UI | `data.js:543` | `reopenConversation` | **A** — reopening the same identity is the only continuation path, never a new `CONV-*` |
| FB-12 | Unread count is a **derived** value: count of inbound messages with `status !== "read"` on that conversation | `data.js:527` | `getConversationUnreadCount` | **A** — computed, not an independently trusted integer |
| FB-13 | "Needs reply" is `status === "open" && latest message direction === "inbound"` — a function of the **latest** message only, not the unread count | `data.js:528` | `getConversationNeedsReply` | **A** — these are two distinct, independently meaningful signals |
| FB-14 | Opening a conversation route (`inbox/{id}`) auto-marks **all** unread inbound messages on it as `read` in one bulk action | `App.tsx:114`, `data.js:538` | `markConversationRead` | **A** — read state is view-driven, not a separate explicit control |
| FB-15 | Inbox summary: `open`/`closed` = conversation counts by status; `unread` = **sum of per-conversation unread message counts** (a message count, not a conversation count); `needsReply` = conversation count | `data.js:536` | `getInboxSummary` | **A** — the four counters have three different units and must not be conflated |
| FB-16 | Filters: full-text search over business name/contact name/phone/Lead ID/conversation ID; status filter (`all/unread/needs_reply/open/closed`); owner filter; channel filter | `data.js:537` | `state.inboxFilters` | **A** |
| FB-17 | Sort: `latest` (default, `lastMessageAt` desc), `unread` (unread count desc then `lastMessageAt`), `oldest_waiting` (needs-reply conversations first, ascending `lastMessageAt` — oldest unanswered first) | `data.js:537` | `filters.sort` | **A** |
| FB-18 | Assignment (`assignedTo`) is a **conversation-level** owner, explicitly independent of the Lead's own owner ("يختلف عن مالك Lead عند الحاجة") | `Inbox.tsx:504-515` | `assignConversation` | **A** |
| FB-19 | Reassigning to the same owner is a no-op (not an error, not a logged change) | `data.js:544` | — | **A** |
| FB-20 | Content types observed in fixtures: `text`, `image`, `document`; attachment shape `{name, size, mime}` | `data.js:67-74` | `message.type`, `message.attachment` | **A** (shape) / **B** (the exact type roster is a fixture sample, not necessarily closed — see `B5_MESSAGE_MODEL.md` §5) |
| FB-21 | A `failed` message carries a human-readable `failureReason` string | `data.js:74` | `message.failureReason` | **B** — the backend target replaces free text with a closed failure-code taxonomy (`B5_RETRY…` — see `B5_RATE_COST_RETRY_MODEL.md`) |
| FB-22 | Every conversation/message mutation writes a **conversation-scoped** activity (`CVA-*`) via `logConversationActivity`, **and** the outbound-send and retry mutations additionally write a **Lead-scoped** CRM activity (`ACT-*`) via `logLeadActivity` — two logs for one event | `data.js:535,539,541-544` | `mockModel.conversationActivities`, `mockModel.activities` | **B** — a legitimate mock shortcut, but copying it literally would violate B2's frozen read-time-merge timeline model (`B2_TIMELINE_IDENTITY_MODEL.md` §3, forbidden pattern). B5's real target is **one** canonical B5-owned event; B2's timeline projects it — see `B5_CRM_TIMELINE_PROJECTION.md` |
| FB-23 | Quick-reply templates (`listQuickReplyTemplates()`) insert canned text into the composer; they are a fixed local library, **not** Meta-approved WhatsApp message templates | `Inbox.tsx:371-383` | `QRT-*` fixture | **D** — naming collision risk only. `QRT-*` (already classified non-authoritative in `BACKEND_PUBLIC_ID_REGISTRY.md` §B) must not be confused with the real Meta template concept B5 designs in `B5_TEMPLATE_MODEL.md`; the two are unrelated and B5 does not adopt `QRT-*` |
| FB-24 | Lead 360 shows a **read-only** list of the Lead's conversations; explicit code comment: *"المحادثات (S7): عرض مرجعي؛ لا ينشئ رسالة"* | `LeadControlPanels.tsx:5,17-61` | `LeadConversationControls` | **A** |
| FB-25 | Every Lead can have more than one Conversation (`getLeadConversations` returns a list, unfiltered by channel) | `data.js:516`, `Lead360.tsx:71` | `getLeadConversations` | **A** (shape: a Lead may have N conversations, e.g. historical + reopened) |
| FB-26 | Two fixture conversations (`CONV-3042`, `CONV-3045`) share the identical `(leadId, contactId, channel)` triple and are simultaneously `open` | `data.js:60,63` | — | **D** — this is a fixture inconsistency, not a demonstrated product rule: nothing in the UI offers "start a new conversation" for an existing Lead+contact+channel, and `reopenConversation` existing at all is strong evidence the intended model is **one** identity, continued, never forked. B5 resolves this tension explicitly as `B5-D-A003` rather than copying the ambiguity forward — see `B5_CONVERSATION_MODEL.md` §3 |
| FB-27 | Dashboard surfaces an `ATTN-CONVERSATION` attention item for any conversation with an unanswered inbound message | `dashboardProjection.ts:80-85` | `ATTN-CONVERSATION` | **B** — confirms a downstream Analytics/dashboard consumer exists; the aggregate itself is not B5's to own, mirroring B4's identical `ATTN-DISCOVERY`/`REC-BUSINESS-*` precedent |
| FB-28 | A workspace-scoped WhatsApp integration exists as its own connectable unit (`INT-1002`, provider `whatsapp`, category `messaging`, capabilities `read_messages_mock`/`send_messages_mock`) with states `not_connected → configuration_required → mock_connected` / `error` | `data.js:307`, `Integrations.tsx:34-61` | `integrationFeatureService` | **B** — the desired admin flow (credentials → configuration check → connected → enable) is real; the current mechanism is a mock toggle with no real credential input. See `B5_PROVIDER_CONFIGURATION_MODEL.md` |
| FB-29 | A notification preference exists for "conversation needs reply", disabled by default, spanning `in_app`/`whatsapp_mock` channels | `data.js:295` | `NP-1005` | **C** — real notification delivery is a later-phase capability; B5 exposes the triggering fact (§`B5_RECONCILIATION_OBSERVABILITY.md`), not the notification mechanism itself |

## 2. S8 — Sales Copilot, as it touches Messaging (governed boundary, not B5 scope)

| # | Behavior | File:line | Class |
|---|---|---|---|
| FB-30 | "استخدام الرد" ("use the reply") inserts AI-suggested text into the composer's draft state **only**, and explicitly does **not** create a message: *"أُدرج الرد المقترح في Composer فقط؛ لم تُنشأ أي رسالة"* | `CopilotPanel.tsx:207-226` | **A** — the load-bearing evidence for `B5-D-A021`. A human must still submit the composer form (`sendMockMessage`) for anything to send, and `senderType` remains `"user"` even when the text originated from Copilot |
| FB-31 | A Copilot-assisted send is tagged, not hidden: `assistance:{assistedBy:"copilot", suggestionId}` travels on the resulting Message and its activity log | `data.js:539` | **A** — the audit trail requirement for AI-assisted sends |
| FB-32 | A stale Copilot recommendation (conversation changed since analysis) disables reply-insertion until re-analysis | `CopilotPanel.tsx:218,225` | **A** — inherited from B4's freshness discipline one layer forward |

## 3. Counts

```
FRONTEND_MESSAGING_BEHAVIOR_COUNT = 32
FRONTEND_TRACE_A = 24
FRONTEND_TRACE_B = 5    (corrected by B5-FIX.1 — was miscounted as 6; 24+5+1+2=32 matches the
                          total, 24+6+1+2=33 did not)
FRONTEND_TRACE_C = 1
FRONTEND_TRACE_D = 2
```

(FB-04, FB-20, FB-23, FB-26 each carry a primary classification with a narrower secondary note inline — the sole classification counted in §1–§2 is the leading bold letter; the note is for the reader's precision, not a second row. The B-count is FB-07, FB-21, FB-22, FB-27, FB-28 — five rows, independently recounted.)

`D` (conflicting/stale) appears twice, both resolved rather than left open: FB-23 is a naming-collision risk only (no functional contradiction — `QRT-*` and Meta templates are simply unrelated concepts, and B5 keeps them unrelated), and FB-26 is a genuine fixture inconsistency that B5 resolves explicitly (`B5-D-A003`) rather than silently inheriting.

## 4. Evidence precision — intended contract vs. executing behavior

`B5-FIX.1` note: the independent audit's own frontend reconstruction found that the *local mock's actually-executing runtime* does not always match its own code comments. Two cases, neither changing any B5 architectural conclusion (B5 designs the correct real-async target regardless of what the mock does), but worth stating precisely rather than leaving FB-07 to imply confirmed-executing behavior:

| Surface | FRONTEND_INTENDED_CONTRACT | FRONTEND_EXECUTING_BEHAVIOR | FRONTEND_MOCK_DEFECT |
|---|---|---|---|
| FB-07 — outbound status auto-advance (`advanceMockMessageStatus`, `Inbox.tsx` L70-76) | an 800ms interval advances `queued → sent → delivered` for the in-flight mock message | **does not run** — the interval calls `advanceMessageStatus()` with no message ID; `findById` never matches `undefined`, so the function is a no-op on every tick | the ticker's call site never passes the message ID the underlying function requires |
| Composer send (`sendMockMessage`, feeds FB-06/FB-08/FB-31) | `sendMessage(conversationId, {body, attachment})` should persist the typed body text and the staged attachment | the call site passes the whole options object as the function's positional `body` parameter, so the persisted body is the literal string `"[object Object]"` and the attachment is silently dropped | argument-shape mismatch between the composer's call site and `sendMockMessage`'s real `(conversationId, body, options)` signature |

Neither defect is a backend requirement — B5's target design (`B5_OUTBOUND_PIPELINE.md`, `B5_MESSAGE_STATE_MACHINE.md`) already specifies real async status progression and real typed request bodies independent of what the mock's wiring happens to execute. The typed service contracts (`SendHumanMessageInput`, `services/contracts/services.ts`) and the surrounding product behavior (composer disabled-until-open, retry-same-message, attachment chip UI) remain the correct intended-contract evidence for FB-06/FB-08/FB-09/FB-20; only the mock's own runtime execution of that contract is defective, and B5 does not treat the defective execution as authoritative.
