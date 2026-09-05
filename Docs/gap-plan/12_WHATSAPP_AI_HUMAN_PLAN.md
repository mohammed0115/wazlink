# 12 — WhatsApp AI + Human Operations Plan

> Resolves brief §17 and §18. **Extends B5. Does not replace it. Does not weaken `B5-D-A021`.**

## 1. What B5 already provides (reused verbatim)

Meta Cloud API integration · webhook signature verification (`B5_WEBHOOK_SECURITY_MODEL.md`) · inbound and outbound pipelines · message state machine with delivery/read/failure · template model and approval · **consent and opt-in/opt-out** (`B5_CONSENT_COMMUNICATION_POLICY.md`) · the 24-hour customer service window (`B5_CUSTOMER_SERVICE_WINDOW.md`) · media via B11 · idempotency and dedup · rate/cost/retry · reconciliation · `AssignConversation` + `ConversationAssigned` · `ConversationParticipant` visibility.

**Nothing above is redesigned.** Every provider constraint verified in `26_COMPETITOR_EVIDENCE_REGISTER.md` (E-13…E-16) is already encoded in B5, so this plan introduces **no new provider assumption**.

## 2. The one structural addition: handling mode

`B5_CONVERSATION_MODEL.md:23` fixes `status` as `enum(2)`: `open | closed`. Widening that enum would change a frozen state machine's fan-out. **This plan does not touch it.**

Instead it proposes an **orthogonal** column, `conversations.handling_mode`:

| Mode | AI may draft/propose | AI output auto-sent | Human may send |
|---|:--:|:--:|:--:|
| `ai_assisted` | yes | **never** | yes |
| `human` | no | never | yes |
| `ai_paused` | no (explicitly suppressed) | never | yes |

**The "auto-sent" column is `never` in every row, and that is the design — now an approved Owner decision.** `PD-013` **APPROVED: no autonomous customer-facing AI send in this programme.** AI may draft, suggest, summarize, qualify, retrieve knowledge, recommend and propose; **a human always sends**, through the frozen `SendMessage` command and its existing permission boundary. There is **no second, AI-owned send command.** Future autonomous send requires a separate controlled architecture, product and safety decision.

The original reasoning stands unchanged: Competitor evidence E-10 shows agents that send autonomously; WazLink must not, because `B5-D-A021` states *"Does a B4 recommendation authorize a send? **Never.** Recommendation existence ≠ send authorization"*, and `B7_ACTION_CATALOG.md` §3 makes `send_message` `approval_required` — *"mandatory, never `auto_safe`, not configurable per-rule"*. `PD-013` records the option to revisit this as an explicit Owner decision rather than a silent drift.

Mode names **approved** under `PD-011`, subject to B5 controlled-architecture consistency (`CA-02`).

## 3. Takeover semantics

| Question (brief §17) | Answer |
|---|---|
| Who can take over? | Any member with `messaging.manage`. Sales is scoped to own-assigned; Manager+ to any |
| Who returns control to AI? | The current assignee or Manager+, by setting mode back to `ai_assisted` |
| What happens to queued AI work? | **Nothing is cancelled; it is re-evaluated at execution time.** A queued proposal task re-reads `handling_mode` when it runs and no-ops if the mode changed — this is `FI-B12-05`'s frozen *"payloads carry references re-read at execution time, never cached decisions"* reused, not reinvented |
| Race: two humans take over at once | `SELECT … FOR UPDATE` on the conversation row + `If-Match` on `version`; the loser gets `409` and sees the winner |
| Race: AI proposal lands during takeover | The proposal is stored but rendered as **superseded**; it can never auto-send, so the race has no unsafe branch |
| Duplicate inbound messages | Frozen B5 dedup, unchanged (`B5_IDEMPOTENCY_CONCURRENCY.md`) |
| Out-of-order provider callbacks | Frozen B5 status monotonicity, unchanged (`AT-STATE-6`) |
| Message ownership | Unchanged: every message's `senderType` remains `user` for human sends; an AI-drafted body carries an `assistance` tag exactly as `AT-B4-2` already specifies |
| Audit trail | `ConversationHandlingModeChanged`, `HumanTakeoverStarted/Ended`, each with actor; plus the frozen `conversation_assigned` activity |
| Agent visibility | `ConversationParticipant` `visibility` role, already frozen |

**Immediate AI pause on takeover** (competitor parity, E-11) is achieved by the mode flip itself — because no AI path can send, pausing is a state change, not a race against an in-flight send.

## 4. Team inbox behavior (`GAP-013`)

Queues: **unassigned** · **mine** · **all** (permission-scoped). Assignment is manual (frozen `AssignConversation`) or rule-driven (`GAP-022`). Ownership is the single `conversations.assigned_to`; standing visibility is `ConversationParticipant` — the frozen split is preserved rather than collapsed.

## 5. AI agent capability ladder (`GAP-014`, brief §18)

| Ability | Tier | Rationale |
|---|---|---|
| Answer a question from the knowledge base | **MAY EXECUTE** | Read-only retrieval; cites its source article |
| *(provider)* | *(n/a)* | **OpenAI is the initial provider, behind the AI Provider Port (`PD-003`).** The ladder is enforced in the AI Agent domain **above** the port, so it is provider-independent: switching providers changes nothing in this table (`29_AI_PROVIDER_ARCHITECTURE.md`) |
| Summarize a conversation | **MAY EXECUTE** | Read-only, no mutation |
| Draft a suggested reply | **MAY EXECUTE** (create draft only) | Producing a draft is not sending; the human submits it through the ordinary `SendMessage` path |
| Qualify a lead (produce a score/rationale) | **MAY RECOMMEND** | Mirrors `B4-D-A012` — B4 produces `Recommendation` rows and executes nothing |
| Propose a task | **MAY PROPOSE** | Human accepts → `CreateTask` runs as the human |
| Propose a ticket | **MAY PROPOSE** | Human accepts → `CreateTicket` runs as the human |
| Propose a deal action | **MAY PROPOSE** | Human accepts → `MoveDealStage` runs as the human, with B6's own guards |
| Recommend next action | **MAY RECOMMEND** | Rendered only |
| **Send a message** | **PROHIBITED** | `B5-D-A021`, `B7_ACTION_CATALOG.md` §3 |
| **Recognize revenue** | **PROHIBITED** | `B7_REVENUE_FIREWALL.md`; structurally impossible — no reachable command writes `revenue_events` |
| **Change SaaS billing** | **PROHIBITED** | B8 boundary |
| **Bypass consent / service window** | **PROHIBITED** | B5 guards apply to every send regardless of origin |
| **Change permissions** | **PROHIBITED** | B1 |
| **Merge identities** | **PROHIBITED** | `GAP-007` is human-only |
| **Unrestricted CRM mutation** | **PROHIBITED** | Only via accepted, typed proposals |
| **Cross-workspace anything** | **PROHIBITED** | Every query carries `workspace_id` |

**The distinction that matters:** *propose* creates an `agent_proposals` row; *execute* runs a command. Only a human moves a proposal to execution, and the command then runs **as that human**, checked by the owning domain's ordinary permission guard. There is no agent service account and no elevated path.

## 6. Inbound flow, end to end

```
Meta webhook → B12 webhook_receipts (verify, hash, dedup, fast-ack)   [frozen]
     → B5 inbound pipeline                                            [frozen]
        → identity.resolve_party(workspace, phone|wa_id)              [NEW, read-only]
           ├ 1 match  → link conversation to Contact → Customer/Lead context
           ├ 0 match  → identity_state=unresolved, conversation opens UNLINKED
           └ >1 match → identity_state=ambiguous, human chooses
     → if handling_mode = ai_assisted → enqueue proposal task (B12 providers.slow, unchanged)
        → AI Agent domain → AI Provider Port → OpenAI Adapter → OpenAI API   [PD-003]
        → task re-reads handling_mode at execution                    [FI-B12-05]
        → agent retrieves from published KB → creates draft/proposal
     → human reviews in Team Inbox → sends via SendMessage            [frozen, human-gated]
```

**No step creates a Lead or Customer automatically**, and no step sends anything without a human. Both properties are acceptance-tested as negative controls in `21_DEMO_PLAN.md` Demo C.
