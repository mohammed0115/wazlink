# B14_14 — OpenAI Adapter Plan

> `PD-003` **APPROVED: OpenAI is the initial AI provider. OpenAI must not become the domain boundary.** No OpenAI endpoint, request schema or SDK call is authored in B14; those are verified from official documentation during slice I13.

## 1. Layering

```
CRM · Messaging · Support · Knowledge      business domains
            ↓  typed, provider-agnostic intents
     AI Agent Domain (apps/aiagent)        OWNS business semantics
            ↓  AIProviderPort
     OpenAI Adapter (adapters/openai)      OWNS provider translation
            ↓
     OpenAI API
```

| Layer | Owns | Never owns |
|---|---|---|
| Business domains | their records and commands | any AI concept, prompt, model or token |
| **`aiagent`** | sessions, proposals, the authority ladder, grounding and citation rules | provider shapes, provider error codes |
| **`AIProviderPort`** | typed request in → normalized result out | anything provider-specific |
| **`adapters/openai`** | translation, normalization, error mapping, timeouts | business meaning, permissions, what a proposal means |

## 2. Port contract (provider-agnostic)

**Intents:** `draft_reply` · `summarize_conversation` · `answer_from_knowledge` · `qualify_lead` · `propose_action`.

**Request:** intent + **context references** (conversation ref, customer ref, KB article refs) + workspace ref. Resolved content is assembled inside the domain, **after `PD-002` masking**.

**Response:** normalized content · grounding citations (`KBA-*` + version) where the intent is knowledge-backed · an abstention/confidence signal · normalized usage counters carrying **no content**.

**Errors:** mapped onto B12's closed error classes and the frozen B0 envelope. **No provider error code, HTTP status or `finish_reason` reaches a business domain or a client.**

## 3. Prohibited leakage

No model name, `gpt-*` identifier, provider version string, prompt text or template, token count, `finish_reason`, provider error code, or provider SDK type may appear in: a domain model field · a DTO or serializer · an event payload · an API response · an acceptance test assertion · a database column.

**`OPENAI_MODEL` is configuration.** Changing the model must never require a schema, contract or test change. `T-AI-5` greps the business-domain packages for provider tokens and asserts zero matches.

## 4. Configuration and secrets

`AI_PROVIDER` (default `openai`) · `OPENAI_API_KEY` (secret, `*_REF`-resolved at call time) · `OPENAI_MODEL` (configuration, documented default) · `AI_BASE_URL` (optional, frozen name) · `AI_REQUEST_TIMEOUT_SECONDS` (bounded by B13 timeout policy).

Missing key ⇒ agent connection `not_connected` / `configuration_valid=false`. **The inbox continues to work; there are simply no proposals.** No crash, no secret in any message.

## 5. B12 relationship — reuse, not reinvention

Queue `providers.slow` · `provider_request_attempts` written **before** the call · outcome `known_success | known_failure | unknown`, never coerced · frozen retry/backoff for idempotent generation · dead-letter for poison tasks · **`B12-D-A020` applies unchanged**.

> Because `PD-013` forbids the AI from sending, **an unknown AI outcome can never mean "a customer may already have been messaged."** Proposal generation is effect-free, so abandoning an `unknown` generation is safe — which is a consequence of the safety decision, not an exception to `B12-D-A020`.

**No new queue, no new webhook, no provider-specific retry system.**

## 6. B13 relationship

Workspace-scoped requests; cross-workspace context not expressible · **`PD-002` masking applied before egress, not after** · minimum-necessary context only · **no prompt or completion text in logs, traces, metrics or audit payloads** · proposal create/accept/reject audited with actor · AI cost and abuse counters stay separate under B13's four-class rate-limit separation · aggregate-only usage telemetry.

**External PII egress is deliberate and bounded**, and is recorded as risk `R-19` in the Gap Plan.

## 7. Authority ladder (provider-independent)

| Tier | Abilities |
|---|---|
| **MAY EXECUTE** (closed allow-list) | knowledge retrieval · conversation summarization · **draft creation** |
| **MAY PROPOSE** | task · ticket · deal action · customer field update — typed, human-confirmable |
| **MAY RECOMMEND** | lead qualification · next action — rendered only |
| **PROHIBITED** | **send a customer-facing message** · recognize revenue · change SaaS billing · bypass consent or the service window · change permissions · merge identities · unrestricted CRM mutation · anything cross-workspace |

Enforced in `aiagent`, **above** the port — switching provider changes nothing in this table.

**The agent holds no permissions.** `AcceptAgentProposal` invokes the owning domain's ordinary command **as the human**, checked by that domain's guard. No agent service account, no elevated path, **no second send command**.

## 8. Replaceability test

`T-AI-6`: a second stub adapter registered behind `AIProviderPort` satisfies every `aiagent` test **with no change to any domain module, migration, API contract or test assertion**. If that test cannot pass, the boundary has leaked.
