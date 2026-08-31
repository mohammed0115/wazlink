# B5 — Messaging & WhatsApp: Executive Summary

> **B5 status:** `DESIGN IN PROGRESS — NOT CLOSED`. This document orients a reader entering the corpus for the first time; every claim here is expanded and cited in its own document.

## 1. What B5 is

B5 converts a governed send decision — human-authored, AI-assisted-but-human-approved, or a future governed automation — into a durable, auditable WhatsApp message exchange, and exposes every inbound/outbound message to CRM as a live, non-authoritative read. It is not a generic messaging platform: it has one aggregate (`Conversation`), one turn unit (`Message`), one channel in Phase 1 (WhatsApp), and a closed set of output shapes (`B5_DOMAIN_OWNERSHIP.md`).

It sits between B2 (CRM/Lead 360, closed), B4 (AI Lead Intelligence, closed), and the future B6 (Pipeline/Deals) and B7 (Automation) — the fifth stop on the product's own stated journey: Discovery → Business → AI Lead Intelligence → CRM/Lead 360 → **Messaging/WhatsApp** → Pipeline/Deals → Automation → Revenue Attribution.

## 2. The central decisions

**Conversation identity is Lead-keyed**, not Business-keyed and not phone-keyed — the frozen frontend already keys every Conversation on `leadId`, and B2's own frozen cross-domain contract independently requires it (*"a Messaging record through the Conversation linked to the Lead"*). Unlike B4, this required no cross-domain tension to resolve; it required only stating it precisely (`B5-D-A002`).

**Exactly one reusable Conversation per `(workspace, channel, lead, phone)`.** The frozen fixture shows two simultaneously-open conversations for the identical Lead+contact+channel — a genuine inconsistency, not a demonstrated product rule. B5 resolves it explicitly (`B5-D-A003`), using the existence of `reopenConversation` itself as the deciding evidence: a "reopen the same thread" command is meaningless in a world where a new message could just fork a second one.

**Business truth and provider transport state are separated.** `Message` holds what was authored; `MessageDelivery` holds what the network did with it (`B5-D-A005`). Two disjoint status vocabularies — seven outbound states, two inbound — because the frozen fixture's own data (`status:"received"` on an inbound row) already disproves a shared enum.

## 3. Governance — the load-bearing half of this package

Every send, regardless of who or what requested it — a human typing, a human submitting Copilot-drafted text, or a future B7 automation rule — passes through the **identical** admission sequence: permission, provider-configured, entitlement, consent, customer-service-window policy, idempotency, rate limit (`B5_OUTBOUND_PIPELINE.md` §2). There is no second "AI send" or "automation send" transport path anywhere in this design (`B5-D-A021`, `B5-D-A025`). Opt-out is absolute — no override exists at any privilege level, including provider-credential-administrator (`B5-D-A017`).

Webhook authenticity is unconditional: every inbound POST is signature-verified before any processing, synchronous or asynchronous, and workspace resolution comes only from *which binding's secret verified* — never from any field inside the webhook body (`B5-D-A010`, `B5-D-A011`).

## 4. The cost lesson, applied — and corrected — proactively

B4's own independent audit found one minor imprecision: a retry ceiling's provenance was described as coming from frozen B0 when it was actually a stricter B5-... (B4-)owned bound layered underneath it. B5 states its own analogous ceiling's provenance correctly **from first authoring** (`B5_RATE_COST_RETRY_MODEL.md` §4), rather than requiring a second independent audit to catch the identical class of imprecision a phase later.

B5 also proposes the rate-limit anchor B4 could simply adopt — no frozen `BACKEND_RATE_LIMIT_POLICY.md` row for messaging exists today, so B5 states one explicitly as a controlled amendment (`Messaging send — 300/hour/workspace`, `B5-D-A028`) rather than assuming an unbounded default. Cancellation never refunds the workspace admission counter, a **stricter** rule than B4's own release-on-`queued`-cancel pattern, chosen because B5's ceiling is request-volume-shaped, not purely provider-cost-shaped — copying B4's rule verbatim would have reopened exactly the spend-loop attack it exists to close (`B5_RATE_COST_RETRY_MODEL.md` §6).

## 5. Boundaries held

- **B2**: Lead 360's conversation list is a live read-through, never a copy (`B5_B2_CRM_LEAD360_HANDOFF.md`). CRM timeline entries are B2's own read-time projection of a B5-exposed `source_event_id` — B5 never writes `crm_activities`, satisfying `B2_TIMELINE_IDENTITY_MODEL.md`'s frozen cross-domain contract exactly, reusing the identical `conversation.view` permission frozen `B1_AUTHORIZATION_RBAC.md` already defines (not a B2 forward-reference B5 "adopts" — `B5-FIX.1` corrected this attribution) rather than inventing a competing name.
- **B4**: a Recommendation's existence never equals send authorization. AI-drafted text is untrusted content until a human submits it through the ordinary composer path — direct frontend evidence (FB-30/FB-31) makes this a documented fact, not a policy preference.
- **B6/B7**: no Deal/PipelineStage/Revenue mutation from any B5 code path, structurally, not by policy. A future B7 automation send reuses the identical governed command every human uses — there is nowhere else to enter.
- **B11**: B5 owns media reference/metadata only; durable storage, scanning, and access control are B11's, referenced, not redesigned.
- **Generic Webhooks domain**: `InboundWebhookReceipt` is not B5's — the frozen `Webhooks` domain (`WebhookReceipt`/`WHR-*`) owns receipt/dedup mechanics; B5 owns only WhatsApp-specific signature verification and normalization on top.

## 6. Mechanical counters

```
B5_DOCUMENT_COUNT = 36

FRONTEND_MESSAGING_BEHAVIOR_COUNT = 32
FRONTEND_TRACE_A = 24
FRONTEND_TRACE_B = 5    (corrected from 6 by B5-FIX.1 — 24+5+1+2=32, matches the total; 24+6+1+2=33 did not)
FRONTEND_TRACE_C = 1
FRONTEND_TRACE_D = 2

DOMAIN_AGGREGATE_COUNT = 1        (Conversation)
DOMAIN_ENTITY_COUNT = 9           (Message, MessageDelivery, ConversationParticipant,
                                    MessageMedia, TemplateDefinition, MessageTemplateSnapshot,
                                    CommunicationConsent, ChannelBinding, MessagingUsageRecord)
CONVERSATION_STATE_COUNT = 2
MESSAGE_STATE_COUNT = 8           (7 outbound + 2 inbound, "read" shared by name only)
CONTENT_TYPE_COUNT = 9

API_OPERATION_COUNT = 16
REQUEST_DTO_COUNT = 4
RESPONSE_DTO_COUNT = 9

COMMAND_COUNT = 12                (2 frozen-derived/refined, 10 additive — corrected from "4 frozen/8 additive" by B5-FIX.1)
EVENT_COUNT = 8                   (4 frozen-refined, 4 additive)
CONSUMED_EVENT_COUNT = 0

FAILURE_SCENARIO_COUNT = 45       (corrected from 40 by B5-FIX.1 — see B5_FAILURE_SCENARIOS.md changelog)
ACCEPTANCE_TEST_COUNT = 179       (corrected from 176 by B5-FIX.1 — 3 new NC-tagged rows added, see B5_ACCEPTANCE_TESTS.md changelog)
ACCEPTANCE_CATEGORY_COUNT = 36
DUPLICATE_ACCEPTANCE_TESTS = 0
NEGATIVE_CONTROL_COUNT = 37       (corrected from 34 by B5-FIX.1 — NC-1/NC-2/NC-3 added)

CLASS_A_DEFINED = 34
CLASS_A_UNRESOLVED = 0
CLASS_B_UNRESOLVED = 8
CLASS_C_UNRESOLVED = 9

EXTERNAL_VALIDATION_ITEM_COUNT = 18

CONTROLLED_AMENDMENT_DECISION_COUNT = 5
CONTROLLED_AMENDMENT_OPERATION_COUNT = 6
CONTROLLED_AMENDMENT_TARGET_ARTIFACT_COUNT = 5

NEW_PUBLIC_ID_PREFIXES = 1        (TPL- — TemplateDefinition; CONV-/MSG- already exist)
NEW_PERMISSION_CODES = 2          (messaging.manage, messaging.provider.manage)
REUSED_PERMISSION_CODES = 2       (conversation.view, message.send — frozen B1/B0, unchanged;
                                    corrected from "4 new" by B5-FIX.1)
NEW_ERROR_CODES = 0

UNDEFINED_AT_REFS = 0
UNDEFINED_B5_DECISION_REFS = 0
BROKEN_CROSS_DOCUMENT_REFS = 0

B0_DRIFT = 0
B1_DRIFT = 0
B2_DRIFT = 0
B3_DRIFT = 0
B4_DRIFT = 0
EVENT_ENVELOPE_DRIFT_FROM_B0 = 0

IMPLEMENTATION_LEAKAGE = 0
UNAUTHORIZED_FILES = 0
```

## 7. Findings by severity

```
Self-review, before any independent audit:
  CRITICAL_FINDINGS = 0
  MAJOR_FINDINGS = 0
  MINOR_FINDINGS = 0
  INFO_FINDINGS = 5   (B5_IMPLEMENTATION_READINESS.md §5)

Independent CTO verification (fresh audit, this pass untrusted):
  CRITICAL_FINDINGS = 0
  MAJOR_FINDINGS = 1   (RBAC/permission-catalog reconciliation — see below)
  MINOR_FINDINGS = 3   (count-arithmetic errors; failure-scenario coverage gaps;
                         acceptance-test negative-control tagging gaps)
  INFO_FINDINGS = 2

B5-FIX.1 remediation status: all four findings above (1 MAJOR, 3 MINOR) addressed.
See B5_IMPLEMENTATION_READINESS.md §4.2 for the itemized repair record.
```

## 8. What this phase does not claim

This is a self-authored design pass. `B5_IMPLEMENTATION_READINESS.md` §4 records three defects this pass found and repaired in itself before requesting review — a corrected retry-provenance statement, a checked (not assumed) permission name, and a stricter-than-B4 cancellation rule chosen deliberately rather than copied — the same discipline B2, B3, and B4 each applied before their own first independent countersign, none of which self-closed. A subsequent independent audit found one further defect self-review missed — a false claim about frozen B1's permission catalog — plus documentation-quality gaps in count bookkeeping and failure/acceptance-test coverage; `B5_IMPLEMENTATION_READINESS.md` §4.2 records the `B5-FIX.1` remediation of all of them. B5 does not self-close either the original pass or this remediation pass — both require independent countersignature.

**`B5_STATUS = DESIGN IN PROGRESS — NOT CLOSED (B5-FIX.1 remediation applied, pending fresh independent re-verification)`. `B6_READINESS = BLOCKED pending independent B5 closure.`**
