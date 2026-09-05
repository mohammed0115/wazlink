# 29 — AI Agent Domain and Provider Architecture

> **`PD-003` APPROVED: OpenAI is the initial provider. OpenAI must not become the domain boundary.** Design only — no adapter is implemented, no OpenAI endpoint or request schema is invented here.

## 1. Ownership — stated once, unambiguously

**The WazLink AI Agent domain owns AI business semantics. OpenAI owns nothing.**

```
   CRM · Messaging · Support · Knowledge          ← business domains
                   │  (typed, provider-agnostic requests)
                   ▼
          AI Agent Domain  (aiagent)              ← OWNS business semantics
                   │  AI Provider Port  (internal interface)
                   ▼
            OpenAI Adapter                        ← OWNS provider translation
                   │
              OpenAI API                          ← external system
```

| Layer | Owns | Must never own |
|---|---|---|
| Business domains | their own records and commands | any AI concept, prompt, model name or token count |
| **AI Agent domain** | sessions, proposals, the authority ladder, grounding and citation rules | provider request/response shapes, provider error codes |
| **AI Provider Port** | the internal contract: a typed request in, a normalized result out | anything provider-specific |
| **OpenAI Adapter** | translation, normalization, provider error mapping, provider timeouts | business meaning, permissions, what a proposal *means* |

**`B4-D-C002` named this phase** — *"S8 Sales Copilot / governed Agent integration — a later, cross-cutting phase needing B2+B5+B6+B7 simultaneously."* `GAP-014` is that phase, and it resolves the design-level ownership mismatch recorded in §7.

## 2. What must not leak into business domains

No provider-specific concept may appear in the CRM, Customer, Messaging, Support, Knowledge or Automation domains:

- no model name, no `gpt-*` identifier, no provider version string
- no prompt text, template or system message
- no token counts, `finish_reason`, or provider error code
- no provider request/response object of any kind
- no provider SDK import

**A model name is configuration, not domain truth.** No product-domain contract, table column, event payload, API DTO or acceptance test may name a specific model. Changing the model must never require a schema or contract change.

## 3. Configuration and secrets

**Environment-driven, with no code edit required** to change provider credentials, model selection, timeouts or feature toggles.

| Concern | Rule |
|---|---|
| API key | Resolved at call time through the frozen `*_REF` secret-reference contract (`FI-B0-23`, B13 secrets model) — **the adapter receives a reference and resolves it at the boundary, never a literal** |
| Model selection | Configuration value, defaulted, overridable per environment |
| Timeouts / retry budget | Configuration, bounded by B13's timeout policy |
| Feature enablement | The B8 capability key (`inbox.copilot`, per `PD-003`), evaluated read-only |

**Secrets must never enter** frontend bundles · logs · traces · metrics · audit payloads · event payloads · Celery task arguments · the repository · database business rows. This restates B13's exhaustive redaction list rather than creating a new rule. Any encrypted at-rest secret storage requires the separately approved secret-management design (`B13-D-C003`, still open).

## 4. Relationship to B12 (async / integration)

**B12 owns execution semantics; the adapter owns translation. Neither is duplicated.**

| Concern | Owner | Reuse |
|---|---|---|
| Queue | **B12** — existing `providers.slow` | No new queue |
| Attempt evidence | **B12** — `provider_request_attempts`, written **before** the call (`B12-D-A021`) | Unchanged |
| Outcome classification | **B12** — `known_success \| known_failure \| unknown` | Unchanged |
| Retry / backoff | **B12** — full jitter, capped | Unchanged |
| Dead letter / replay | **B12** | Unchanged |
| Provider capability claims | **B12** — `B12_PROVIDER_CAPABILITY_MODEL.md`; `unknown` is a legitimate value and **must not be guessed** | Unchanged |
| Reconciliation | **B12** — `P-1` unknown-outcome sweep | Unchanged |

> **`B12-D-A020` applies unchanged.** A non-idempotent AI operation whose outcome is `unknown` is **never** retried — no override flag, permission or configuration. In practice AI generation is **idempotent-safe** (it produces a draft or a proposal, never a customer-visible effect), which is a direct consequence of `PD-013`: because the AI cannot send, an unknown AI outcome can never mean "a customer may already have been messaged."

**No new webhook, no new provider inbound surface, no second retry mechanism.**

## 5. Relationship to B13 (security / operations)

| B13 concern | Application |
|---|---|
| Workspace isolation | Every AI request carries `workspace_id`; retrieval and history are workspace-scoped. Cross-workspace context is not expressible |
| Secrets | `*_REF` resolution at the adapter boundary; fail-closed startup validation |
| Redaction | Provider request/response bodies are **never** logged (extends B13's existing "never store request or response bodies" rule for `provider_request_attempts`) |
| Audit | Proposal creation, acceptance and rejection are audited with actor. **Prompt and completion text are not audit payloads** |
| PII egress | Sending customer data to an external provider is a **deliberate, bounded egress**. Only the minimum context needed is sent; the egress boundary, its data classes and its retention posture are named in `28_SECURITY_INTEGRATION_IMPACT.md` and require the `PD-002` masking rules to be applied *before* egress, not after |
| Rate limiting | AI cost and abuse controls stay separate counters under B13's four-class separation |
| Observability | Usage telemetry is **aggregate** (requests, latency, acceptance rate, cost) — never per-customer prompt content |

## 6. Normalization the adapter must perform

The port returns a **normalized** result so no business domain ever sees a provider shape:

- **Request** — typed intent (`draft_reply`, `summarize_conversation`, `answer_from_knowledge`, `qualify_lead`, `propose_action`) plus provider-agnostic context references.
- **Response** — normalized content, plus grounding citations where the intent is knowledge-backed, plus a confidence/abstention signal.
- **Errors** — mapped onto B12's existing closed error classes and the frozen B0 error envelope. **No provider error code reaches a business domain or a client.**
- **Usage** — normalized counters for telemetry and cost, carrying no content.

## 7. The ownership mismatch this resolves

`inbox.copilot` appears in `PLAN-GROWTH` (`B8_PLAN_CATALOG.md`) and in `B1_ENTITLEMENT_QUOTA_BOUNDARY.md`; `#/copilot` and `#/agent` are shipped frontend routes with real components. **No `*_DOMAIN_OWNERSHIP.md` in any frozen phase claims either.**

**Correct classification: `DESIGN-LEVEL ENTITLEMENT / DOMAIN OWNERSHIP MISMATCH` — `NON_BLOCKING`.**

It is **not** a live commercial exposure. Independently verified: there is **no backend implementation at all** (`server/index.ts` is a static file server), B8 is *"Design only. No Django model or migration is created,"* and the frontend is entirely mock (`legacyDataBridge`, `active_mock`, "فوترة تجريبية"). Nothing is sold, so nothing is over-sold.

`GAP-014` resolves it by giving the capability an owning domain. **Ownership is the WazLink AI Agent domain — never an "OpenAI domain."**

## 8. Authority ladder (unchanged by provider choice)

| Tier | Abilities |
|---|---|
| **MAY EXECUTE** (closed allow-list) | knowledge retrieval · conversation summarization · **draft creation** |
| **MAY PROPOSE** | task · ticket · deal action · customer field update — typed, human-confirmable |
| **MAY RECOMMEND** | lead qualification · next action — rendered only |
| **PROHIBITED** | **send a customer-facing message** · recognize revenue · change SaaS billing · bypass consent or the service window · change permissions · merge identities · unrestricted CRM mutation · anything cross-workspace |

Choosing OpenAI changes **nothing** in this table. The ladder is enforced in the AI Agent domain, above the port, so it is provider-independent by construction.

**The agent holds no permissions of its own.** Accepting a proposal invokes the owning domain's ordinary command **as the human**, checked by that domain's own guard. There is no agent service account and no elevated path.
