# B4 — Provider Abstraction and Structured Output Contract

> **B4 status:** Target design only. No provider adapter is implemented. Covers the provider port, the structured-output contract, prompt policy architecture, and provider/model versioning as one layered boundary — they are one wall between the domain and the outside world, specified together for the same reason B3 specified its provider ports and normalized outcomes in one document.

## 1. The port

> **`B4-D-A014`: B4 reuses frozen B0's already-named port, `AI Gateway` (`BACKEND_DOMAIN_OWNERSHIP.md`), rather than inventing `LeadIntelligenceProvider`.** No new port name is proposed where a frozen one already exists and fits.

```
B4 Application Service (RequestBusinessIntelligence handler)
        │
        ▼
AI Gateway port  ── request contract / response contract (§2–§3), provider-neutral
        │
        ▼
Provider Adapter (not designed here — implementation detail)
        │
        ▼
Normalized Structured Result  ── validated (§4), the only thing the domain ever sees
```

The domain model — `IntelligenceRun`, `Signal`, `Recommendation` — never references a provider-specific type, field name, or response shape. Everything provider-specific is confined to the adapter, which does not exist in this design phase.

## 2. Request contract

| Field | Meaning |
|---|---|
| `run_id` | the `IntelligenceRun` this call belongs to |
| `input_payload` | the minimized provider-facing subset of the input snapshot (`B4_INPUT_SNAPSHOT_MODEL.md` §2, `B4_SECURITY_PRIVACY_SAFETY.md` §2) |
| `task_type` | `structured_extraction` \| `presentation_generation` — the port distinguishes Class B (§`B4_SCORING_MODEL.md` §5) from Class C calls, because they have different schemas and different failure tolerance (a failed presentation call degrades to `partial`; a failed structured-extraction call may not, `B4_RETRY_FAILURE_MODEL.md` §2) |
| `output_schema_ref` | which JSON schema (§4) the response must validate against |
| `prompt_policy_version` | which template/policy (§5) generated this request |
| `timeout_ms` | bounded, Class B value |
| `max_output_tokens` | bounded (`B4_COST_RATE_LIMIT_MODEL.md` §3) |

## 3. Response contract

| Field | Meaning |
|---|---|
| `outcome` | `success` \| `schema_invalid` \| `timeout` \| `rate_limited` \| `provider_unavailable` \| `safety_refused` |
| `structured_result` | present only on `success`; validated against `output_schema_ref` before the adapter returns it to the domain — the domain layer never sees an unvalidated payload |
| `provider_metadata` | `provider`, `model_identifier`, `provider_model_version` (if the provider exposes one), `request_id`, `latency_ms` |
| `token_usage` | `input_tokens`, `output_tokens` — technical telemetry only (`B4_COST_RATE_LIMIT_MODEL.md` §6) |

## 4. Structured output is the only channel — no free-form mutation

> **`B4-D-A015`: no free-form provider response ever mutates domain truth. Every response is validated against a strict JSON schema before a single `Signal` or `Recommendation` field is written.**

| Validation | Rule |
|---|---|
| Enum fields | value must be a member of the declared enum (e.g. `polarity`, `signal_code`) — an unrecognized value is `schema_invalid`, not coerced to a nearest match |
| Numeric fields | must fall within the declared bound (e.g. a confidence field outside `[0,1]`, a `strength` above its dimension's max) — out-of-bound is `schema_invalid` |
| Evidence references | every `evidence_id` the response cites must resolve to an item the request actually supplied as permitted factual basis (`B4_RECOMMENDATION_MODEL.md` §5) — a fabricated reference is `schema_invalid` |
| Unknown fields | rejected — the schema uses `additionalProperties: false`, matching every frozen B0 DTO's own discipline |
| Malformed JSON | `schema_invalid`, immediately, no retry-with-repair attempt |
| Partial response (valid JSON, missing required field) | `schema_invalid` — there is no "accept what's there" mode |

> **No "best-effort parse."** `schema_invalid` is always terminal for that provider call. It is handled per `B4_RETRY_FAILURE_MODEL.md` §2 (retryable up to `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST`, then the affected component fails and the run may still `complete` as `partial` if it was a Class C/presentation call, or `fail` if it was a required Class B structured-extraction call).

## 5. Prompt policy architecture

No vendor-specific production prompt text is authored here (brief §20) — only the architecture a prompt must satisfy:

| Element | Requirement |
|---|---|
| `prompt_template_version` | every template is versioned; a version change is tracked the same way `scoring_model_version` is |
| System/domain instructions | fixed per `task_type`; never workspace-customizable in Phase 1 (avoids a per-workspace prompt-injection surface) |
| Allowed input | exactly the minimized `input_payload` of §2 — nothing else is interpolated into a prompt |
| Forbidden input | secrets, credentials, internal UUIDs, raw unrelated CRM data, full provider payloads from other runs (`B4_SECURITY_PRIVACY_SAFETY.md` §2) |
| Output schema | `output_schema_ref` (§4) is supplied as a hard constraint on generation, not a hopeful hint |
| Evidence-only claims | the prompt supplies the finalized deterministic signal set as the *only* factual basis a Class C call may cite (`B4_RECOMMENDATION_MODEL.md` §6) |
| Determinism expectations | Class B (structured extraction) calls request the lowest-variance setting the provider offers, because `B4-D-A005` requires the same input to reproduce the same signals; Class C (presentation) calls tolerate ordinary phrasing variance since prose is not score-affecting |
| No secret inclusion | enforced by construction — §2's `input_payload` never contains one |

## 6. Model / provider versioning — technical metadata, not business semantics

> **`B4-D-A016`: provider and model identity are audit metadata. No domain rule, score, or recommendation branches on which provider or model produced a signal.**

Persisted per provider call (on `IntelligenceUsageRecord`, `B4_DOMAIN_OWNERSHIP.md` §2):

```
provider, model_identifier, provider_model_version (if available),
prompt_policy_version, structured_output_schema_version, run_timestamp
```

This is exactly the audit chain `B4_OBSERVABILITY_RECONCILIATION.md` §4 requires to answer "why did this Business get this score" all the way down to which model version produced which extracted signal — without ever making that identity part of the domain's decision logic.

## 7. Provider swappability

The domain model contains no OpenAI-specific (or any other vendor-specific) concept anywhere in `B4_DOMAIN_OWNERSHIP.md`, `B4_SIGNAL_TAXONOMY.md`, `B4_SCORING_MODEL.md`, or `B4_DATA_MODEL.md`. A future provider change touches only the adapter (not designed here) and the `provider`/`model_identifier` metadata fields (§6) — no domain table, no signal definition, no score formula requires redesign. `B4_EXTERNAL_VALIDATION_REGISTER.md` isolates every provider-specific fact (current structured-output mechanism, supported model identifiers, token limits, retry guidance) as external validation, never baked into this document.

## 8. What is never retained

- No full prompt text.
- No full raw provider response.
- `structured_result` fields are copied into `Signal`/`Recommendation`/artifact rows in normalized form; the wire response itself is discarded after validation, mirroring B3's own "hash always, snapshot only under an explicit flag, never full retention by default" discipline (`B3_PROVIDER_ABSTRACTION.md` §7) — `B4_DATA_MODEL.md` §6 states the exact retention rule.
