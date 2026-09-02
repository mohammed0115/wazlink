# B9 — Financial Reconciliation Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Frozen basis and the gap B9 fills

Frozen `BACKEND_RECONCILIATION.md` mandates: *"Repairs are explicit, permissioned, idempotent, and audited. Admin cannot edit financial truth directly with SQL. Every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time. Reconciliation must not guess or overwrite a newer authoritative provider state without a documented precedence rule."*

Its process table has rows for Payments, Subscriptions, Provider delivery, Discovery, Scraping, Webhooks, ZATCA and Usage — and **no row for Revenue**. B9 adds that row (`B9-AM-003`) and the entity carrying the seven mandated fields (`B9-AM-006`, with its `FRC-` prefix registered by `B9-AM-005`).

## 2. The cardinal rule

**Reconciliation detects; humans decide; commands act.**

A reconciliation scan is **read-only**. It opens cases. It never writes `revenue_events` or `revenue_reversals`, never adjusts a total, never "repairs" a financial fact. When a case genuinely requires a financial change, a human resolves it and, separately, issues `RecordRevenueEvent` or `ReverseRevenueEvent` under that command's own permission, validation and audit — which is exactly frozen B0's "repairs are explicit, permissioned, idempotent, and audited."

`AT-RECON-1` **(NC)** proves it: any code path where the reconciliation scanner writes a financial table fails.

## 3. Detected conditions — the closed Phase-1 set

| `case_type` | Detects | Default severity | Typical resolution |
|---|---|---|---|
| `payment_without_recognition` | a captured B8 payment with no `RevenueEvent` referencing it | `info` | usually correct — platform billing is never customer revenue (`B9-D-A021`); `dismissed` |
| `recognition_source_unresolvable` | a `RevenueEvent` whose `source_ref` no longer resolves in-workspace | `warning` | investigate; the event stands |
| `duplicate_recognition_candidate` | two events with distinct sources but identical `(amount, currency, recognized_at)` on the same provenance chain | `warning` | reverse one with `reason='duplicate'` |
| `refund_without_recognition` | a B8 `Refund` fact (`B9-AM-009`) with no related `RevenueEvent` | `info` | usually benign; `dismissed` |
| `refund_without_reversal` | a B8 `Refund` fact related to a recognized event, whose `amount` is not covered by that event's reversals | `warning` | a human issues `ReverseRevenueEvent` for the amount they judge warranted. The case carries the refund's own `amount`, so the operator has a concrete figure rather than a flag (`B9-AM-009`) |
| `reversal_exceeds_recognized` | `Σ reversals > event amount` | **`critical`** | must never occur — the write path forbids it (`B9_REVERSAL_MODEL.md` §5); a hit means corruption |
| `status_fold_mismatch` | `status` disagrees with the reversal fold | **`critical`** | corruption alarm (`B9_REVENUE_EVENT_MODEL.md` §5) |
| `over_attribution` | attributed > recognized for any event | **`critical`** | structurally impossible (`B9_ATTRIBUTION_MODEL.md` §10); corruption alarm |
| `orphan_attribution` | a `revenue_attributions` row whose event is missing, or whose workspace differs | **`critical`** | corruption alarm |
| `allocation_mismatch` | `allocation_bps ≠ 10000` in Phase 1 | **`critical`** | corruption alarm |
| `currency_mismatch` | a reversal's currency ≠ its event's | **`critical`** | corruption alarm |
| `unknown_currency` | a syntactically valid code that is not an economically active ISO-4217 currency | `info` | data quality (`B9_CURRENCY_MONEY_MODEL.md` §3) |
| `attribution_unresolved` | recognition committed but first-touch resolution failed | `info` | record a touchpoint; historical snapshot unchanged (`B9-D-A024`) |
| `backdated_recognition` | `recognized_at` precedes `created_at` by > 7 days | `info` | review (`B9_TIME_PERIOD_MODEL.md` §5) |
| `recognition_against_open_deal` | a `deal`-sourced recognition whose Deal is not `won` | `info` | legitimate; signal only (`B9-D-A023`) |
| `idempotency_anomaly` | a resolved `FinancialReconciliationCase` whose stored `resolution_request_hash` does not match a recomputation over its own persisted resolution fields | `warning` | investigate |
| `provider_discrepancy` | B8 reports a payment state contradicting the evidence a recognition cited | `warning` | investigate; B8 remains authoritative for payment state |

```
RECONCILIATION_CASE_TYPE_COUNT = 17
```

**`idempotency_anomaly` was redefined by `B9-FIX.1` (`N-2`).** It previously detected *"a stored idempotency result whose replay hash no longer matches its row"* — but B9 stores no replay hash for the three financial commands, because for those the **row itself is the replay record** (`B9_IDEMPOTENCY_CONCURRENCY.md` §2). The old wording specified a detector over a store that does not exist. The one place B9 genuinely does persist a hash is `financial_reconciliation_cases.resolution_request_hash`, so the case now names exactly that, and is computable from B9's own tables.

Six are marked `critical` because they detect states the write paths make unreachable. They exist as **corruption alarms**: if one ever fires, an invariant has been violated by something outside the designed path, and that is worth knowing loudly. A design that only checks for things it believes can happen cannot detect being wrong.

### 3a. Where refund evidence comes from

Four of the seventeen case types compare B9's register against B8 state, and two of them — `refund_without_recognition` and `refund_without_reversal` — need a **refund** fact, with an amount. Frozen `B8_B9_FINANCE_BOUNDARY.md` §3 offers only `Payment`, `Invoice` and `Subscription`; it offers no `Refund` and no refund amount, and its §4 states that any new B8-exposed fact *"is a future controlled amendment against this document."*

An earlier draft promised both cases anyway and bound itself, in `B9_B8_BILLING_BOUNDARY.md` §4, to reading *"those fields and no others"* — so the evidence these cases require was unobtainable and the promise was empty. `Payment.status ∈ {refunded, partially_refunded}` — the exact frozen B8 values (`B8_CHECKOUT_PAYMENT_MODEL.md` §4, `BACKEND_STATE_MACHINES.md`) — is in the offered set and signals *that* a refund happened, but a partial refund's **amount** is a property of B8's `refunds` child row, not of the payment, so `refund_without_reversal` could not have carried an actionable figure.

`B9-AM-009` registers the amendment B8's own §4 prescribes, adding a read-only `Refund` fact to B8's offered set. B8 builds nothing new: `refunds` already exists as a frozen B8 table with exactly these columns (`B8_CHECKOUT_PAYMENT_MODEL.md` §4, `B8_STORAGE_MODEL.md`). B9 **reads** it and owns none of it.

| Fact | Fields B9 reads | Used for |
|---|---|---|
| `Refund` | `payment_ref` (`PAY-*`), `amount`, `currency`, `status`, `created_at` | `refund_without_recognition`, `refund_without_reversal`, `provider_discrepancy` |

A refund has no independent public ID in B8 (it is a child of its Payment), so it is addressed as `(payment_ref, created_at)` and carried in case `evidence` as identifiers and amounts only — never a provider payload (`B9_SECURITY_PRIVACY.md` §3).

**A refund still never reverses revenue.** It is evidence for a case; a human decides and issues `ReverseRevenueEvent` under that command's own permission (`B9-D-A009`, `B9_B8_BILLING_BOUNDARY.md` §6). Adding the fact widened what B9 can *see*, and changed nothing about what B8 can *do*.

## 4. Case lifecycle

The frozen document requires a status but does not name the states. B9 defines them:

```
        scan detects
             │
             ▼
        ┌─────────┐  claim   ┌───────────────┐  resolve   ┌──────────┐
        │  open   │─────────▶│ investigating │───────────▶│ resolved │
        └────┬────┘          └───────┬───────┘            └──────────┘
             │                       │
             │ dismiss               │ dismiss
             ▼                       ▼
        ┌───────────┐
        │ dismissed │
        └───────────┘
```

```
RECONCILIATION_CASE_STATE_COUNT = 4   (open, investigating, resolved, dismissed)
```

`resolved` and `dismissed` are terminal. A recurring condition re-detected after closure opens a **new** case linked by `recurrence_of_case_id` rather than reopening the old one — so a closed case is a permanent record of a decision that was made, and the history of "this kept happening" is legible.

`resolved` means *the underlying condition was addressed*; `dismissed` means *the condition was judged not to require action*. Both require an actor, a reason, and an audit fact.

## 5. Case record — the seven frozen-mandated fields, and the rest

| Frozen requirement | Column |
|---|---|
| status | `status` |
| evidence | `evidence` (jsonb, immutable) |
| attempted repair record | `resolution_action`, `resolution_command_ref` |
| operator | `resolved_by_membership_id`, `assigned_to_membership_id` |
| request ID | `resolution_request_id` |
| next review time | `next_review_at` |
| (mismatch identity) | `case_type`, `subject_type`, `subject_public_id` |

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `public_id` | `FRC-*` | immutable (`B9-AM-005`) |
| `workspace_id` | FK → workspaces | |
| `case_type` | enum (§3) | closed set |
| `severity` | enum(`info`,`warning`,`critical`) | |
| `status` | enum(§4) | |
| `subject_type` | enum(`revenue_event`,`revenue_reversal`,`revenue_attribution`,`payment`,`invoice`,`none`) | what the case is about |
| `subject_public_id` | text, nullable | |
| `evidence` | jsonb | **immutable** snapshot of what the scan observed, and only what it observed |
| `detected_at` | timestamptz | |
| `fingerprint` | text | `UNIQUE (workspace_id, fingerprint)` **WHERE** `status IN ('open','investigating')` — one live case per condition (§6) |
| `assigned_to_membership_id` | FK, nullable | |
| `resolution_action` | enum(`none`,`recognition_recorded`,`reversal_recorded`,`no_action_required`,`referred_upstream`), nullable | |
| `resolution_command_ref` | text, nullable | the `REV-*`/`REVR-*` the operator created, if any |
| `resolution_reason` | text, nullable | required to leave `open`/`investigating` |
| `resolution_request_id` | text, nullable | frozen requirement |
| `resolution_idempotency_key` | text, nullable | the key that closed the case; `UNIQUE (workspace_id, resolution_idempotency_key)` **WHERE NOT NULL** (`B9_IDEMPOTENCY_CONCURRENCY.md` §1). Written only on successful resolution, immutable thereafter |
| `resolution_request_hash` | text, nullable | SHA-256 over the canonicalised resolution payload; the basis for replay-vs-conflict, and the subject of `idempotency_anomaly` |
| `resolved_by_membership_id` | FK, nullable | |
| `resolved_at` | timestamptz, nullable | |
| `next_review_at` | timestamptz, nullable | frozen requirement |
| `recurrence_of_case_id` | FK → self, nullable | |
| `created_at`, `updated_at` | timestamptz | |

`evidence` stores **identifiers and amounts only** — never a provider payload, never PII beyond the public ids already in scope (`B9_SECURITY_PRIVACY.md` §3). For refund-derived cases that means the `PAY-*`, the refund amount and currency, and the timestamps — enough for an operator to act, and nothing more.

## 6. Scan idempotency

A scan re-run over unchanged data must not multiply cases. Each detection computes a deterministic `fingerprint` from `(case_type, subject_type, subject_public_id, the discriminating evidence values)`. The partial unique index on `(workspace_id, fingerprint) WHERE status IN ('open','investigating')` makes a repeat detection a no-op insert conflict while a case is live, and permits a genuinely new case once the previous one is closed. `AT-RECON-3`, `AT-RECON-4`.

## 7. Precedence — the frozen "documented precedence rule"

Frozen B0 forbids reconciliation from overwriting a newer authoritative provider state without a documented rule. B9's rule is simple because B9 never overwrites anything:

| Fact | Authority | B9's posture |
|---|---|---|
| Payment/refund/invoice/subscription state | **B8** | B9 reads it — refunds under `B9-AM-009` (§3a) — never contradicts it, never writes it |
| Deal state and value | **B6** | same |
| Lead/Business/provenance | **B2/B3** | same |
| Recognized revenue | **B9** | B8 and B6 have no authority over it and no write path to it |
| Tax treatment | **B10** | out of scope |

Because the authority sets are disjoint, "conflicting updates" cannot arise: a discrepancy is always a *case for a human*, never a merge B9 performs. `AT-RECON-2`.

## 8. Frequency

B9 declares the semantic requirement; B12 owns scheduling, workers and intervals (`B9_B12_ASYNC_BOUNDARY.md`).

| Scan | Target frequency | Compares |
|---|---|---|
| Revenue integrity | hourly | internal invariants — folds, statuses, allocations, orphans (the six `critical` types) |
| Revenue vs Billing | daily | B9 register vs B8 `Payment`/`Refund`/`Invoice` state, exactly as offered by `B8_B9_FINANCE_BOUNDARY.md` §3 as amended by `B9-AM-009` |
| Attribution quality | daily | unattributed ratio, unresolved attributions |

The first scan reads only B9's own tables and is the one that must never be skipped: it is how corruption becomes visible.

## 9. Negative controls

`AT-RECON-1` **(NC)**: the scanner writing any financial table — fails.
`AT-RECON-2` **(NC)**: reconciliation overwriting a B8 payment state — fails; B9 has no write path to B8.
`AT-RECON-5` **(NC)**: `ResolveFinancialReconciliationCase` mutating `revenue_events`/`revenue_reversals` as part of resolution — fails; it records a decision and may *reference* a command the operator ran separately.
`AT-RECON-6` **(NC)**: resolving a case without an actor or reason — rejected `B9-AF-025`.
`AT-RECON-7` **(NC)**: resolving a case in another workspace — `ENTITY_NOT_FOUND`.
`AT-RECON-8` **(NC)**: a repeat scan creating duplicate live cases for one condition — fails (§6).
`AT-RECON-10`: a **partial** B8 refund on a recognized event opens `refund_without_reversal` whose `evidence` carries the refund's own `amount` and `currency`.
`AT-RECON-11` **(NC)**: an implementation inferring a refund amount from `Payment.status` alone — fails; the amount comes from the `Refund` fact (§3a).
`AT-RECON-12` **(NC)**: a refund opening a case **and** writing a `revenue_reversals` row — fails; detection never writes financial truth (§2).
`AT-RECON-13`: `idempotency_anomaly` is computable from B9's own tables — it compares `resolution_request_hash` against a recomputation, with no external store.
