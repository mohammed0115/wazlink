# B10 — Tax Applicability Model

> Design only. Realizes `B10-D-A002`, `A003`, `A008`, `A015`, `A016` (§`B10_DECISION_REGISTER.md`). This is the single most implementation-critical document in the pack — every other B10 document defers to this one for applicability semantics.

## 1. Two independent axes (brief §4's "not a single boolean")

`TaxProfile` carries two conceptually independent facts, never merged into one field:

- **`zatca_applicability`** — does a ZATCA e-invoicing integration obligation currently apply to this `LegalEntity`, and if so, is the integration switched on. This is the state machine below.
- **Profile completeness** (whether `legal_name`/`tax_registration_number`/`address` are filled in) — a data-quality fact, not a state; a profile can be `not_applicable` with a fully-populated legal identity (common — most non-VAT-registered businesses still have a legal name and CR number) or `applicable_not_enabled` with an incomplete one (flagged by `B10_OBSERVABILITY.md`, never silently promoted to `enabled`).

## 2. `zatca_applicability` states (closed, five values)

| State | Meaning | Who may enter it | Reachable from |
|---|---|---|---|
| `unknown` | No authorized determination has been recorded yet. **Default at first `LegalEntity` bootstrap.** | system (bootstrap only) | *(initial)* |
| `not_applicable` | An authorized operator has determined ZATCA e-invoicing does not currently apply (e.g., not VAT-registered, below threshold, or another business-supplied reason) | `SetTaxApplicability` (`tax.applicability.manage`) | `unknown`, `applicable_not_enabled` (if circumstances genuinely reverse), `enabled`→`suspended`→ (never directly from `enabled`, see §4) |
| `applicable_not_enabled` | The entity **is** subject to ZATCA (VAT-registered / above threshold / otherwise obligated) but the technical integration is not yet configured | `SetTaxApplicability` | `unknown`, `not_applicable` |
| `enabled` | Fully configured; `TaxInvoice`s are submitted per `B10_ZATCA_APPLICABILITY.md`'s phase mapping | `SetTaxApplicability`, only after `ValidateZatcaConfiguration` reports `configured=true` (§`B10_ZATCA_SECURITY_CREDENTIALS.md`) | `applicable_not_enabled`, `suspended` |
| `suspended` | Was `enabled`; integration temporarily paused (credential issue, manual pause) — the underlying legal obligation is **unchanged**, unlike `not_applicable` | `SetTaxApplicability`, or system-automatic on a detected credential/certificate failure (§`B10_ZATCA_FAILURE_RETRY_MODEL.md`) | `enabled` only |

No sixth state is added. A missing/absent `TaxProfile` row is never read as `not_applicable` — it cannot occur, because `LegalEntity` bootstrap always creates the initial `unknown` row in the same transaction (mirrors `B8-D-A006`'s "a missing entitlement row never grants access" default-deny discipline, applied here to the opposite direction — a missing profile never grants *exemption* either).

## 3. Fail-safe behavior while `unknown` (`B10-D-A003`, backlog mechanism corrected under `B10-FIX.1`/`B10-D-A022`)

| Concern | Behavior |
|---|---|
| B8 commerce (subscriptions, payments, entitlements) | **Unaffected.** B10 has no read gate on any B8 command; a workspace can subscribe, pay, upgrade, and use the product exactly as if B10 did not exist |
| B8 `InvoiceIssued` event arrives while `unknown` | `IssueTaxInvoice` creates a durable `PendingTaxDocumentClassification{status=pending}` row (§`B10_STORAGE_MODEL.md`, `B10-D-A022`) — **corrected under `B10-FIX.1`**: the pre-FIX.1 pack described this only as prose ("a queryable list of pairs") with no owning table, command, or idempotency rule. The row is durably unique on `(source_type, source_ref)`, so a redelivered `InvoiceIssued` event while still `unknown` maps to the same backlog row rather than creating a duplicate — never dropped, never silently issued as a `TaxInvoice` |
| Manual `IssueTaxInvoice` retry while still `unknown` | `409 TAX_APPLICABILITY_UNKNOWN` — explicit, typed, never a silent no-op and never a silent success |
| Applicability finally resolved (`unknown` → any other state) | The new `ResolvePendingTaxClassification` command (system-scheduled after `TaxApplicabilityChanged`, also operator-invokable) processes every currently-`pending` row against the now-current `TaxProfile` version — never against the profile that was current when the original event first arrived (`B10-D-A015`, unchanged) |
| Health/readiness checks | The platform is **not** marked unhealthy merely because applicability is `unknown` — `unknown` is a valid, expected transient state, distinct from a ZATCA outage (§`B10_OBSERVABILITY.md`) |

This is deliberately asymmetric with `not_applicable`: `unknown` blocks exactly one thing (tax-document issuance, deferred to a durable, resolvable backlog) and nothing else, because issuing a document under an undetermined legal posture risks issuing the wrong document type (or none at all) under a regime that turns out to require one. Full backlog schema: `B10_STORAGE_MODEL.md`; state machine: `B10_INVOICE_STATE_MACHINE.md` §3; idempotency and resolution algorithm: `B10_IDEMPOTENCY_CONCURRENCY.md` §5, `B10_COMMAND_EVENT_CATALOG.md` §1.

## 4. Why `enabled → not_applicable` is not a direct edge

Legal applicability does not spontaneously become inapplicable while an integration is actively `enabled` without an intervening operator decision to re-classify. The modeled path is `enabled → suspended` (a technical/administrative pause) and, separately, a fresh `SetTaxApplicability` call re-classifying the entity — which is always legal from any state, including directly from `enabled`, but is recorded as a deliberate re-classification (new `applicability_reason` required), never an implicit side effect of suspension.

## 5. Applicability changes never retroactively rewrite history (`B10-D-A008`)

Every `TaxInvoice` pins `tax_profile_version_id` at issuance (`B10_LEGAL_ENTITY_TAX_PROFILE.md` §3). A `TaxApplicabilityChanged` event changes only which profile version is **current**; every already-issued document keeps referencing the version it was actually issued under. `AT-B10APP-4` asserts this by construction: mutate the current `TaxProfile`, re-read a historical `TaxInvoice`, assert its snapshotted seller fields are byte-identical to before the mutation.

## 6. The pending-classification backlog's own resolution rule (`B10-D-A015`)

When an operator finally resolves `unknown` (in either direction), the backlog is processed **against the profile version that is current at the moment each backlog item is processed** — not backdated to when the original B8 `Invoice` was issued. This is an explicit, intentional asymmetry: a backlog item is not "late-issued under yesterday's rules," it is issued now, under today's determination, because no rule existed to apply until today. If this produces a materially wrong outcome for a specific historical case, that is an admin-reviewed exception (`RECONCILIATION_MISMATCH`-class alert, §`B10_OBSERVABILITY.md`), not an automatic backdating.

## 7. Governance (`B10-D-A016`)

Only `tax.applicability.manage` (Owner-only, no Admin `conditional` grant in Phase 1) may call `SetTaxApplicability`. `tax.manage` (Owner + conditional Admin) may edit non-applicability profile fields (`legal_name`, address, `credential_ref` pointer) and issue credit/debit notes, but **cannot** change `zatca_applicability`. This structural separation is what makes brief §30's "never allow a normal user to mark ZATCA exempt merely to bypass integration" true by permission design, not by policy request. Full matrix: `B10_RBAC_TENANCY.md`.
