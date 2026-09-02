# B9 — Revenue Firewall

> **B9 status:** Target design only. **Mandatory document.** This is the single most important proof in the B9 pack.
>
> Every earlier domain proved it could not *create* revenue. B9 is the domain that can — so this document proves the inverse: that nothing **outside** B9's one governed command can, and that B9 itself never derives revenue from a non-financial fact.

## 1. The frozen anchors (quoted verbatim, none authored by B9)

| Source | Quote |
|---|---|
| `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007 | *"`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent."* |
| `BACKEND_DOMAIN_OWNERSHIP.md` | Pipeline forbidden coupling: *"no automatic RevenueEvent."* Revenue forbidden coupling: *"no DealWon implicit write."* Revenue allowed writers: *"revenue service only."* Attribution: *"no amount mutation."* |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | *"`DealWon` MUST NOT emit `RevenueRecognized` by default."* … *"`UpgradeQuoteIssued` and `UpgradeQuoteConsumed` are Platform Billing events and MUST NOT emit `RevenueRecognized`."* |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | *"`DEAL-*` does not imply `REV-*`; a `REV-*` exists only after the explicit revenue-recognition command."* |
| `BACKEND_BILLING_TAX_ARCHITECTURE.md` | *"A successful WazLink subscription payment is platform Billing, not a customer Deal revenue event. A customer Deal becoming Won does not create a Billing payment, invoice, or RevenueEvent."* |
| `BACKEND_ANALYTICS_SEMANTICS.md` | *"Deal value is never used as Recognized Revenue."* … *"Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent."* |
| `B0_BACKEND_BLUEPRINT.md` | *"A Deal can become `won` without creating a RevenueEvent."* |
| `BACKEND_ERD.md` | `DEAL ||--o{ REVENUE_EVENT : may_reference` — optional, and only in that direction |

Frontend corroboration (Class A, `B9_FRONTEND_BEHAVIOR_INVENTORY.md`): `FB-B9-008`, `FB-B9-009`, `FB-B9-012`, `FB-B9-029`, `FB-B9-031`…`FB-B9-036`.

## 2. The nine required non-identities

| # | Non-identity | Why it holds in B9 | Test |
|---|---|---|---|
| 1 | **Won Deal ≠ Recognized Revenue** | B9 consumes no events at all, so `DealWon` reaches no B9 handler. The only writer of `revenue_events` is `RecordRevenueEvent`, whose actor is a human membership | `AT-FW-1` |
| 2 | **Deal amount ≠ Recognized Revenue** | `gross`/`net` are mandatory caller inputs (frozen `required[]`); B9 never reads `Deal.value` in the recognition path, and no default derives from it | `AT-FW-2` |
| 3 | **Pipeline value ≠ Recognized Revenue** | Open/Weighted Pipeline are B6 read-time snapshots over `deals`; B9 selectors query `revenue_events` exclusively and never union the two | `AT-FW-3` |
| 4 | **PaymentSucceeded ≠ Recognized Revenue** | No consumed events; and a platform `PAY-*` source is categorically rejected by `B9-AF-007` | `AT-FW-4` |
| 5 | **SubscriptionActivated ≠ Recognized Revenue** | `subscription` is not in the closed `source_type` set at all — `B9-AF-004` | `AT-FW-5` |
| 6 | **CheckoutSucceeded ≠ Recognized Revenue** | Not a frozen event name in any catalog, not consumed, not a source type | `AT-FW-6` |
| 7 | **Plan price ≠ Recognized Revenue** | B9 never reads `Plan`; `plan` is not a source type | `AT-FW-7` |
| 8 | **Invoice amount ≠ Recognized Revenue** | A platform `INV-BILL-*` is rejected by `B9-AF-007`; and even an eligible invoice supplies no amount — the caller does | `AT-FW-8` |
| 9 | **Frontend analytics ≠ Recognized Revenue** | The frozen frontend has no mutation path to either table (`B9_FRONTEND_BEHAVIOR_INVENTORY.md` §5); the only write API requires `revenue.recognize` on a server-validated session | `AT-FW-9` |

## 3. Structural proof — table access lockout

B9's application-service layer holds no repository, ORM manager, or migration authority for any table it does not own. Symmetrically, no other domain holds one for B9's:

| Domain | Its write surface | Contains a B9 table? | Proof |
|---|---|---|---|
| B2 CRM | `leads`, `contacts`, `tasks`, `appointments`, `notes` | **no** | `B2` ownership doc; frozen forbidden coupling *"no Revenue recognition"* |
| B3 Discovery | `discovery_jobs`, `queries`, `results`, `businesses` | **no** | frozen ownership row |
| B6 Pipeline | `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions`, `deal_loss_reasons` | **no** | `B6_REVENUE_FIREWALL.md` §2 |
| B7 Automation | `automation_rules`, `automation_rule_revisions`, `automation_runs`, `automation_run_steps`, `automation_run_approvals`, `automation_inbox_records` | **no** | `B7_REVENUE_FIREWALL.md` |
| B8 Billing | `subscriptions`, `upgrade_quotes`, `invoices`, `payments`, `refunds` | **no** | `B8_REVENUE_FIREWALL.md` §2 |
| **B9** | `revenue_events`, `revenue_reversals`, `attribution_touchpoints`, `revenue_attributions`, `financial_reconciliation_cases` | — | `B9_DOMAIN_OWNERSHIP.md` §5 |

```
DIRECT_B6_WRITE_LEAKS = 0    DIRECT_B8_WRITE_LEAKS = 0    DIRECT_B7_WRITE_LEAKS = 0
WON_DEAL_REVENUE_LEAKS = 0   PIPELINE_REVENUE_LEAKS = 0   B8_PAYMENT_AUTHORITY_LEAKS = 0
PROVIDER_STATUS_REVENUE_AUTHORITY_LEAKS = 0
FRONTEND_REVENUE_AUTHORITY_LEAKS = 0
```

## 4. Structural proof — no listener

The strongest clause in this document is the absence of one:

> **B9 has zero event consumers** (`B9_COMMAND_EVENT_CATALOG.md` §3, `B9-D-A002`).

`DealWon`, `PaymentSucceeded`, `SubscriptionActivated`, `InvoiceIssued` and every other upstream event are published to the frozen outbox and reach **no B9 handler**, because B9 registers none. This is categorically stronger than a handler that checks a policy: a policy can be misconfigured, and a handler can be edited by a future contributor who does not know why the check is there. A domain with no subscription cannot be made to react by mistake.

`PROVIDER_STATUS_REVENUE_AUTHORITY_LEAKS = 0` follows immediately: B9 never reads a provider status string in any recognition path, because it never reads a provider at all — it reads B8's frozen DTOs, on demand, only to *reject* platform sources and to build reconciliation evidence.

## 5. Structural proof — no derivation

Even inside its own command, B9 never *computes* revenue from a commercial fact:

| Input | Source | B9's treatment |
|---|---|---|
| `gross`, `net` | **the caller**, mandatory (frozen `required[]`) | stored verbatim |
| `currency` | **the caller**, mandatory | stored verbatim |
| `recognized_at` | **the caller**, mandatory | stored verbatim |
| `source_ref` | the caller | **existence-checked only** — resolved to confirm it exists in-workspace and is not platform billing. Not one field of the resolved entity is copied into any monetary column |
| Reversal `gross` | **the caller**, mandatory | stored verbatim |
| Reversal `net` | **derived from the event's own `gross`/`net`** (`B9-D-A033`) | the only computed monetary value in B9, and its only inputs are the event's own immutable columns — never another domain's |
| B3 `discovery_results` | B3 | **read for attribution candidates only** (`B9_FIRST_TOUCH_MODEL.md` §2.2). It carries no amount and no currency; nothing on it can reach a monetary column |
| B8 `Refund.amount` | B8 | **read for reconciliation evidence only** (`B9-AM-009`). It is displayed in a case, never copied into `revenue_reversals`; the human supplies the reversal amount |
| `Deal.value` | B6 | **never read** in the recognition path |
| `Payment.amount` | B8 | **never read** in the recognition path |
| `Plan.price` | B8 | **never read** anywhere in B9 |

There is no code path in which a monetary value flows *from* another domain *into* `revenue_events` or `revenue_reversals`. The single derivation B9 performs — a reversal's `net` — reads only the event it compensates. `AT-FW-10` **(NC)**: an implementation defaulting a missing `gross` from any upstream amount — fails. `AT-B8-10` **(NC)**: an implementation defaulting a reversal amount from a `Refund` fact — fails.

## 6. Attribution cannot alter money

Frozen ADR-008: *"Attribution never changes RevenueEvent amount."* In B9 this is structural: `revenue_attributions` holds an **allocation in basis points** and identity snapshots — it has **no amount column and no currency column** (`B9_STORAGE_MODEL.md` §4). There is no field for it to write a money value into, and `revenue_events` has no update path for it to call.

This survives `B9-FIX.1`'s addition of a second attribution candidate source. Reading B3's `discovery_results` widened where a *winner* can come from; it did not add an amount to the snapshot, because `discovery_results` has no monetary column either. Attribution still cannot express money, whichever source won. `AT-ATTR-6` **(NC)**, `AT-FT-13` **(NC)**.

```
ATTRIBUTION_RECOGNITION_COUPLING_LEAKS = 0
```

## 7. Revenue cannot become tax

`RevenueEvent ≠ TaxInvoice`. B9 owns no tax table, computes no VAT, issues no invoice, and produces no tax event. `B9_B10_TAX_BOUNDARY.md` carries the proof.

```
B10_TAX_AUTHORITY_LEAKS = 0
```

## 8. Required negative controls

| # | Claim | Test | Mechanism |
|---|---|---|---|
| 1 | `CloseDealWon` creates zero `revenue_events` rows | `AT-FW-1` **(NC)** | execute the full B6 close sequence; assert zero new rows and zero `RevenueRecognized` on the outbox |
| 2 | Editing `Deal.value` after recognition changes no revenue figure | `AT-FW-2` **(NC)** | recognize, then `UpdateDeal`; re-run every selector; all identical |
| 3 | Weighted-pipeline change moves no revenue | `AT-FW-3` **(NC)** | change a stage probability; revenue selectors unchanged |
| 4 | A captured platform payment creates no revenue | `AT-FW-4` **(NC)** | run B8 checkout→webhook→captured; zero rows |
| 5 | Plan price change moves no revenue | `AT-FW-7` **(NC)** | change plan price; selectors unchanged |
| 6 | Payment webhook redelivery cannot duplicate revenue | `AT-FW-11` **(NC)** | redeliver twice; zero rows both times (trivially — B9 has no webhook path) |
| 7 | No B9 code path writes a B2/B3/B6/B7/B8/B10 table | `AT-FW-12` **(NC)** | static: no ORM import, no FK write target |
| 8 | No non-B9 code path writes a B9 table | `AT-FW-13` **(NC)** | static, corroborated by the five upstream firewall documents |
| 9 | Deleting a Deal/Payment/Lead leaves revenue untouched | `AT-FW-14` **(NC)** | B6 has no delete; B8 retention pruning leaves `revenue_events` count and content unchanged |
| 10 | A `RevenueEvent` row cannot be deleted | `AT-IMM-3` **(NC)** | no endpoint, no `deleted_at`, `ON DELETE RESTRICT` inbound |

## 9. False-positive guard

Every occurrence of "Deal", "payment", "plan" or "invoice" in a B9 document is inside a negative statement, a source-gating rule, a reconciliation-evidence description, or a citation of frozen text — never a producer path. `B9_VERIFICATION_MATRIX.md` §6 re-runs this scan mechanically across the whole pack, so the claim is reproducible rather than asserted.

## 10. Closure statement

`WON DEAL ≠ RECOGNIZED REVENUE` and `PAYMENT SUCCESS ≠ RECOGNIZED REVENUE` hold in B9 **by construction**: no listener exists to hear the events, no write path exists to reach the tables, no derivation exists to compute the amounts, and no actor other than a permissioned human can invoke the one command that creates revenue.
