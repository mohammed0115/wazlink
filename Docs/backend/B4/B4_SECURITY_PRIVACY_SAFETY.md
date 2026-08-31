# B4 — Security, Privacy, and Safety

> **B4 status:** Target design only. Business public data does not imply permission to send arbitrary workspace data to a third-party provider.

## 1. Input minimization — the hard boundary

> Business public data ≠ permission to send arbitrary workspace data. Every provider call sends only the minimized `input_payload` (`B4_INPUT_SNAPSHOT_MODEL.md` §2) — never the full local snapshot, never anything outside it.

**Never sent to a provider, under any code path:**

| Category | Examples |
|---|---|
| Auth/session material | tokens, session IDs, CSRF tokens |
| Workspace secrets | API keys, webhook secrets, provider credentials of *other* integrations |
| Internal identifiers | UUIDs (only public `BUS-*`-derived, non-identifying context is sent, and even the `public_id` itself is withheld per `B4_INPUT_SNAPSHOT_MODEL.md` §2's table) |
| Payment data | anything Billing-owned |
| Unrelated CRM data | other Leads, Conversations, Deals, Notes — a provider call for Business X never includes anything about Business Y or any Lead/Conversation at all |
| Raw contact PII | phone/website values themselves are reduced to presence booleans before leaving the boundary (`B4_INPUT_SNAPSHOT_MODEL.md` §2) |

## 2. Redaction and logging policy

| Surface | Rule |
|---|---|
| Structured logs | one line per state transition and per provider call, carrying `request_id`, `workspace_id`, `business_public_id`, `run_public_id` — never the provider payload itself (mirrors `B3_OBSERVABILITY.md` §3's exact discipline) |
| Provider request/response | never logged in full, at any log level — not even at debug. Only the normalized `outcome` (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §3) and `provider_metadata` are logged |
| Traces | carry no sensitive payload, per frozen B0 |
| Evidence values | `extracted_value` on an `Evidence` row is the *normalized* value only — a raw phone number is never stored as evidence when a presence boolean already answers the signal's question |

## 3. Prohibited inferences

> **B4 analyzes a business's sales opportunity. It does not infer anything about the people who work there.**

| Prohibited | Rule |
|---|---|
| Protected/sensitive personal traits (health, religion, ethnicity, political views, sexual orientation, criminal status) | never a permitted output of any signal, recommendation, or presentation artifact, at any confidence — no schema field exists for any of these, so there is no field to populate even by accident |
| Company solvency without reliable evidence | never asserted — B4 has no financial data source; "commercial potential" was deliberately not adopted as a score component (`B4_SCORING_MODEL.md` §1) for exactly this reason |
| Individual-level behavioral profiling | out of scope entirely — every signal is about the *business*, never about a named individual associated with it |
| Any inference the structured-output schema does not have a field for | structurally impossible — `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4's `additionalProperties: false` schema validation rejects any field the provider might volunteer outside the declared, evidence-bounded schema |

This closed-schema enforcement (§`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4) is what makes this section more than policy prose: a provider cannot smuggle a prohibited inference into a `Signal` even if asked to, because there is no schema slot to write it into.

## 4. What "sensitive" evidence means here, concretely

The one sharp case this domain actually has: `websiteQuality`-style judgements (`B3_B4_HANDOFF_CONTRACT.md` §2) are opinions about an *artifact* (a website), never about a *person*. B4 draws the line at the entity the judgement is about, not at whether a judgement was involved at all — an AI-derived signal about a website's quality is fine (Class B, `B4_SCORING_MODEL.md` §5); an AI-derived signal about the business owner's competence would not be, and no such signal exists in `B4_SIGNAL_TAXONOMY.md` §4.

## 5. Localization

WazLink's frontend is Arabic RTL. B4 separates language from truth:

| Layer | Language rule |
|---|---|
| `signal_code`, `recommendation_code`, `insufficient_reason_codes`, `failure_code` | **language-neutral**, stable machine identifiers — never translated, never localized, safe for B7 automation to key on (`B4_DOWNSTREAM_HANDOFFS.md` §4) |
| `evidence.extracted_value` | source-faithful — a Business's category or address is stored and returned exactly as B3 normalized it, in whatever language the source data was in; B4 never translates a fact |
| `presentation.*` (summaries, outreach angle), `Recommendation.reason` display text | Arabic, generated to match the product's existing RTL surface — the only place natural-language prose appears |

> **`B4-D-A031`: Arabic prose is never the sole representation of a signal or recommendation.** A `recommendation_code` always exists as the stable identifier; the Arabic `reason` text explains it but is never the only way to know what happened — exactly as `B4_DOWNSTREAM_HANDOFFS.md` §4 requires for safe automation consumption. Non-Arabic output is Class C, deferred (`B4-D-C007`).

## 6. Threats mitigated — summary table

| # | Threat | Mitigation |
|---|---|---|
| 1 | secret/credential leakage to provider | §1 — never in the minimized payload |
| 2 | cross-Lead/cross-Business data bleeding into one prompt | `B4_INPUT_SNAPSHOT_MODEL.md` §2 — one Business's snapshot only |
| 3 | cross-workspace leakage | `B4_AUTHORIZATION_TENANCY.md` §7 |
| 4 | raw provider payload retained indefinitely | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §8, `B4_DATA_MODEL.md` §6 |
| 5 | hallucinated/unsupported claim reaching a user | `B4_RECOMMENDATION_MODEL.md` §5's evidence-citation validation |
| 6 | prohibited personal-trait inference | §3, enforced by closed schema |
| 7 | prompt injection via Business-supplied text (e.g. a scraped business description containing adversarial instructions) | §5 of `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` — system/domain instructions are fixed and not workspace-customizable; the model is asked to extract/classify against a closed schema, not to follow instructions found inside the input data |
| 8 | free-form AI output silently becoming automation truth | `B4_DOWNSTREAM_HANDOFFS.md` §4 |
| 9 | AI score implying revenue | `B4_DOWNSTREAM_HANDOFFS.md` §5 |
| 10 | logs/traces leaking sensitive payloads | §2 |
