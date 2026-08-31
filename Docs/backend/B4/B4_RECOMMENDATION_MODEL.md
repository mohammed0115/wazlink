# B4 — Recommendation Model and AI Presentation Artifacts

> **B4 status:** Target design only. B4 recommends; it never executes. Covers both structured recommendations and free-text presentation artifacts, because both are read-only outputs of the same run, differing only in whether their payload is machine-actionable or prose.

## 1. B4 never executes

> **`B4-D-A012`: `IntelligenceRun` produces `Recommendation` rows. It writes no CRM state, sends no message, creates no Deal, and triggers no automation.** Execution belongs to the domain that owns the affected truth — B2 (CRM state), B5 (messaging), B6 (deals), B7 (automation) — each reading B4's output and deciding independently whether to act (`B4_DOWNSTREAM_HANDOFFS.md`).

This mirrors — and is reinforced by — the frozen S8 Copilot's own governance model, which requires explicit human approval before any of its bounded actions execute and hard-forbids `send_message`, `create_revenue`, and `change_deal_value` outright (FB-29). B4 does not even reach that far: it has no execution path to gate in the first place.

## 2. Structured recommendation shape

| Field | Meaning |
|---|---|
| `recommendation_code` | closed enum, §3 |
| `priority` | `high` \| `medium` \| `low`, derived from `overall_priority_score`'s tier — never set independently of it |
| `reason` | short, evidence-anchored explanation (language-neutral structure; localized text is a presentation concern, `B4_SECURITY_PRIVACY_SAFETY.md` §5) |
| `evidence_refs` | `[evidence_id]`, non-empty (`B4-D-A007`) |
| `confidence` | the run's overall confidence, or a lower per-recommendation value if the recommendation depends on a subset of lower-confidence evidence |
| `valid_until` | `input_snapshot_version`-bound — a recommendation is valid only while the run that produced it remains current and non-stale (`B4_FRESHNESS_STALENESS.md`) |
| `eligibility` | precondition the recommending code required to fire (e.g. `service_gap_matched` present) — informational, not re-evaluated at read time |

## 3. The closed recommendation-code set

| `recommendation_code` | Fires when |
|---|---|
| `contact_now` | `tier = high`, ≥ 1 `REACHABILITY` positive signal, ≥ 1 `SERVICE_FIT` gap-matched signal |
| `review_manually` | `tier ∈ {good, medium}` — evidence exists but not strong enough for an automatic "contact now" |
| `enrich_data` | `DATA_COMPLETENESS` component below a threshold but not below the `insufficient_data` floor — more evidence would materially change confidence |
| `visit_website` | a `weak_website`/`no_website` gap signal fired and no direct-contact signal outranks it |
| `defer` | `tier = low`, no actionable gap identified |
| `not_fit` | no `SERVICE_FIT` signal has ever fired across the Business's run history (Class B nuance — exact "never" window is tunable) |

`create_lead` and `send_whatsapp` from the brief's candidate list are **not** adopted as recommendation codes — they name actions in domains B4 does not own (B2 conversion, B5 messaging) and recommending them by name would blur "B4 recommends, another domain executes" into "B4 names the exact cross-domain action," which is one step from B4 *triggering* it. `contact_now` is deliberately domain-neutral: it is a signal that a human (or, later, a governed automation) should act, not an instruction to use a specific channel.

Existence of a closed recommendation-code set is Class A (`B4-D-A012`); the exact roster above is Class B, extensible within the same evidence-backed discipline — the same "existence A, roster B" pattern used throughout this corpus.

## 4. Recommendations require sufficient evidence

`insufficient_data` runs (`B4_SCORING_MODEL.md` §6) produce **zero** recommendations. Recommending an action from evidence too thin to score is exactly the "high score forced from insufficient evidence" defect `B4_ACCEPTANCE_TESTS.md`'s negative controls target.

## 5. AI presentation artifacts — non-authoritative by construction

Three artifact types, all optional, all Arabic-first (`B4_SECURITY_PRIVACY_SAFETY.md` §5), all governed identically:

| Artifact | Purpose |
|---|---|
| `business_summary` | one-paragraph factual recap of what was observed |
| `why_this_lead` | prose version of the top reasons already present as structured `Signal`/`Recommendation` data |
| `suggested_outreach_angle` | phrasing suggestion for how a salesperson might open contact — the AI-assisted evolution of the frozen frontend's `salesApproach` (FB-14) |

`sales_talking_points` from the brief's list is **not** separately adopted — it is the same content as `suggested_outreach_angle` at a different granularity, and splitting them would create two prose artifacts that could silently disagree about the same evidence.

### 5.1 The hard constraints

- **Structured factual basis required.** Every sentence-level claim in an artifact must be traceable to at least one `evidence_ref` already present on the run's `Signal`/`Recommendation` set. An artifact is generated *after* signals and recommendations are finalized, never before, so there is nothing for it to say that isn't already grounded (§6).
- **Never hidden commercial truth.** An artifact never states a number (score, price, probability) that is not already present as a structured field elsewhere on the run — it explains, it does not introduce.
- **Language:** Arabic, matching the frozen product's RTL-first surface (`B4_SECURITY_PRIVACY_SAFETY.md` §5).
- **Generation/version:** every artifact carries `prompt_policy_version` and is regenerated (never edited in place) whenever its owning run is superseded.
- **Stale semantics:** identical to the owning run's — an artifact from a stale run is shown with the same staleness marker (`B4_FRESHNESS_STALENESS.md` §3), never silently presented as current.
- **Maximum size:** `business_summary` ≤ 400 characters, `why_this_lead` ≤ 300 characters, `suggested_outreach_angle` ≤ 300 characters — bounding both UI layout and provider output-token cost (`B4_COST_RATE_LIMIT_MODEL.md` §3).
- **Unsupported-claim policy:** structured-output validation (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4) rejects any artifact whose `evidence_refs` do not resolve within the same run. A rejected artifact is simply omitted — the run still `completed`/`partial` on its structured signals (§`B4_INTELLIGENCE_RUN_STATE_MACHINE.md` transition 4).
- **Hallucination guard:** the provider is never asked to invent facts — its structured-output prompt (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §5) supplies the finalized signal/recommendation set as its *only* permitted factual basis and requires every claim to cite one of the supplied `evidence_id`s. An artifact citing an `evidence_id` outside that supplied set fails validation exactly as any other schema violation would.

## 6. Ordering — why artifacts come last

```
1. deterministic signals extracted
2. AI-assisted structured signals extracted (Class B, §B4_SCORING_MODEL.md §5)
3. score + confidence computed
4. recommendations derived
5. (optional) presentation artifacts generated, constrained to cite only what steps 1–4 already produced
```

An artifact can fail (step 5) without affecting steps 1–4's validity — this is exactly the `completion_kind = partial` case (`B4_INTELLIGENCE_RUN_STATE_MACHINE.md` transition 4, `B4_RETRY_FAILURE_MODEL.md` §3).
