# B4 — Evidence Model

> **B4 status:** Target design only. Every material intelligence claim is evidence-backed; evidence is traceable without hoarding raw provider payloads.

## 1. The rule

> **`B4-D-A007`: A score component, a signal, or a recommendation with no `evidence_refs` is a defect, not an edge case.** `B4_ACCEPTANCE_TESTS.md` includes a negative control that fails any implementation producing an evidence-free claim.

## 2. Evidence shape

Evidence is embedded, not a standalone table (`B4_DOMAIN_OWNERSHIP.md` §2) — it exists only as an attribute of the `Signal`/`Recommendation`/score component that cites it:

| Field | Meaning |
|---|---|
| `evidence_id` | run-scoped identifier (e.g. `ev_01J...`), unique within the run |
| `source_type` | `business_field` \| `discovery_result_field` \| `provider_extraction` \| `rule_derivation` |
| `source_ref` | the specific field path or provider-call reference this evidence came from (e.g. `business.website`, `discovery_result.rating`) |
| `extracted_value` | the normalized value actually used (never the raw provider payload — §5) |
| `observed_at` | when the underlying fact was last confirmed (from B3's `discovered_at`/`last_observed_at`, or the provider-call timestamp for AI-extracted evidence) |
| `freshness` | `observed_at` compared against the signal's `freshness_window` (`B4_SIGNAL_TAXONOMY.md` §2) — `fresh` \| `aging` \| `expired` |
| `confidence` | this specific evidence item's own reliability, `0..1` — distinct from the run's overall confidence (`B4_SCORING_MODEL.md` §7 combines many) |
| `derivation` | `provider_observed` \| `rule_derived` \| `ai_extracted` |
| `redaction_policy` | `none` \| `presence_only` \| `masked` — governs what a consumer sees when the evidence itself is sensitive (§4) |

## 3. Deterministic vs. AI-extracted evidence

| `derivation` | Example | Traceability requirement |
|---|---|---|
| `provider_observed` | rating, review count, phone presence | `source_ref` points directly at the B3 field; no interpretation step to audit |
| `rule_derived` | "service gap matched because `weak_website` is present" | the rule's deterministic logic (§`B4_SCORING_MODEL.md` §5) is itself the audit trail — no provider call involved |
| `ai_extracted` | "website quality judged weak" | `source_ref` points at the specific structured-output field the provider returned, plus the `run_provider_call_id` that produced it (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §6) — **not** the raw prompt or raw response |

## 4. What is never persisted as evidence

`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §7 and `B4_SECURITY_PRIVACY_SAFETY.md` §4 own the full policy; stated here because it bounds this model directly:

- No raw provider prompt or raw provider response is stored as an `Evidence` row. Evidence stores the **normalized, extracted value**, never the payload that produced it.
- No evidence row ever carries a secret, credential, or full unrelated CRM record.
- A signal whose only possible evidence would require an unjustified sensitive-data send (`B4_SECURITY_PRIVACY_SAFETY.md` §3, prohibited inferences) is never generated in the first place — there is no "evidence-light" fallback that relaxes this.

## 5. Evidence references in output

Every consumer-visible object — a `Signal`, a `Recommendation`, a score component, an AI presentation artifact (`B4_RECOMMENDATION_MODEL.md` §5) — carries `evidence_refs: [evidence_id]`, resolvable only within the same `IntelligenceRun` (evidence never crosses runs, matching immutability, `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §2). A UI evidence drill-down (mirroring the frozen `IntelligenceModal.tsx` evidence view) resolves `evidence_id → Evidence` from the same run response — no second endpoint, no cross-run lookup, no dangling reference is possible by construction.
