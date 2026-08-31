# B4 — External Validation Register

> **B4 status:** Target design only. Provider and legal facts B4 must not invent. None blocks design closure — each is isolated behind the `AI Gateway` adapter boundary (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md`) or a configuration value, so learning the answer changes no contract in this package.

| ID | Item | Isolated behind |
|---|---|---|
| `B4-X-001` | current OpenAI (or chosen provider) structured-output mechanism (JSON mode, function/tool calling, or a dedicated structured-output API) | the adapter, not designed here — `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §1's port boundary |
| `B4-X-002` | currently supported model identifiers and their capabilities | `provider_metadata.model_identifier` (§6) — a string, not a domain type |
| `B4-X-003` | schema restrictions the chosen structured-output mechanism actually enforces (nesting depth, supported types, `additionalProperties` support) | `B4-D-B006`'s literal schema files, Class B |
| `B4-X-004` | tool/function-calling behavior, if the adapter uses it instead of direct structured-output mode | adapter implementation detail |
| `B4-X-005` | request size / token limits for the chosen provider and model | `B4-D-B003`-adjacent Class B bound on `input_payload` size (`B4_INPUT_SNAPSHOT_MODEL.md` §2) |
| `B4-X-006` | provider-side retry/rate-limit guidance (exact backoff recommendation, `Retry-After` semantics) | frozen B0's own retry policy already governs the *domain's* retry behavior (`B4_RETRY_FAILURE_MODEL.md` §1); this item only affects adapter-level backoff tuning |
| `B4-X-007` | provider data-retention / data-usage terms (does the provider retain request data for training, and for how long) | governs whether B4's input-minimization policy (`B4_SECURITY_PRIVACY_SAFETY.md` §1) needs a stronger contractual guarantee before enabling any provider; **must be confirmed before implementation**, not merely before some later date |
| `B4-X-008` | regional / data-residency implications of the chosen provider (does WazLink's Saudi data-locality posture, already `PRODUCT/LEGAL DECISION REQUIRED` per frozen ADR-012 and B3's own unresolved `B3-X-008`, extend to AI provider calls) | inherits B3's identical open legal question one layer further; not resolved here, escalated the same way |
| `B4-X-009` | how a safety refusal is represented in the provider's actual response shape | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §3's `outcome=safety_refused` is a normalized abstraction over whatever the real shape turns out to be |
| `B4-X-010` | provider request identifiers' exact format, for correlating an `ai_usage_records` row with a provider-side support ticket | `provider_metadata.request_id` (§6) — opaque string |
| `B4-X-011` | pricing / cost-metadata reporting granularity the provider actually exposes | `B4-D-C013` — `ai_usage_records.cost_units` stays nullable until this is known, never defaulted |

**B4 invents no legal conclusion or provider fact for any of these**, mirroring `B3_SECURITY_PRIVACY_LEGAL.md` §8 / `B3_PROVIDER_ABSTRACTION.md` §8's exact discipline for the identical class of question one phase earlier. No B4 contract in this corpus depends on any of the above being answered a particular way — learning the answer changes an adapter, never a domain table, DTO field, or state machine.
