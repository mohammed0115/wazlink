# B9 — B8 Billing / Payment Boundary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> The counterpart of `B8_B9_FINANCE_BOUNDARY.md`, written from B9's side and honouring every clause of it.

## 1. Two authorities, disjoint

| Authority | Owner | Means |
|---|---|---|
| **Payment authority** | **B8** | whether money moved between the workspace and WazLink: payment state, capture, refund, invoice issuance, subscription state, provider truth |
| **Recognition authority** | **B9** | whether the workspace's *own* revenue is recognized: whether, when, how much, in what currency |

B8 answers *did a payment succeed*. B9 answers *is this revenue*. Neither can answer the other's question, and neither can override the other.

## 2. A B8 event is evidence, never a decision

Frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`: *"No Billing event creates customer RevenueEvent unless an explicit, separately approved revenue-recognition rule exists."* Phase 1 defines **no such rule** (`B9_REVENUE_RECOGNITION_POLICY.md` §1).

Every one of B8's 17 produced events is classified. The exact frozen names are taken from `B8_COMMAND_EVENT_CATALOG.md` §2 via `B8_REVENUE_FIREWALL.md` §2; **no name is invented**:

| B8 event | Class | B9 treatment |
|---|---|---|
| `PaymentSucceeded` | **C — reconciliation evidence** | read on demand at scan time as *settled state*, never as a subscription; may open `payment_without_recognition`. **Never recognizes** |
| `PaymentFailed` | **D — ignored** | |
| `PaymentReconciled` | **C — reconciliation evidence** | provider-discrepancy context |
| `InvoiceIssued` | **C — reconciliation evidence** | |
| `SubscriptionActivated` | **D — ignored** | platform lifecycle; `subscription` is not even a B9 source type |
| `SubscriptionCancelled` | **D — ignored** | |
| `SubscriptionReactivated` | **D — ignored** | |
| `SubscriptionPastDue` | **D — ignored** | |
| `SubscriptionSuspended` | **D — ignored** | |
| `SubscriptionExpired` | **D — ignored** | |
| `SubscriptionDowngradeScheduled` | **D — ignored** | |
| `SubscriptionDowngradeApplied` | **D — ignored** | |
| `UpgradeQuoteIssued` | **D — ignored** | frozen catalog: *"MUST NOT emit `RevenueRecognized`"* |
| `UpgradeQuoteConsumed` | **D — ignored** | same |
| `UpgradeQuoteExpired` | **D — ignored** | |
| `EntitlementOverrideGranted` | **D — ignored** | |
| `EntitlementOverrideRevoked` | **D — ignored** | |

```
Class A (recognition input)      = 0     ← no B8 event is ever a recognition input
Class B (reversal input)         = 0     ← no B8 event ever triggers a reversal
Class C (reconciliation evidence)= 3     (PaymentSucceeded, PaymentReconciled, InvoiceIssued)
Class D (ignored)                = 14
```

**Class A and Class B are empty by design.** Even `PaymentSucceeded` cannot bypass recognition rules, because there is nothing for it to bypass *through*.

## 3. Evidence is pulled, not pushed

`B8_B9_FINANCE_BOUNDARY.md` §4 requires this in terms B9 adopts verbatim: *"a **read-only, on-demand query** against B8's own frozen DTOs … **never an event subscription** requiring B8 to know about B9's existence."*

```
B9 consumed events from B8 = 0
```

The three "reconciliation evidence" rows above are read as **settled state** during a scan, not as a stream. B8 does not know B9 exists, needs no consumer-list amendment, and gains no coupling.

## 4. The facts B9 reads — exactly those B8 offers

`B8_B9_FINANCE_BOUNDARY.md` §3 enumerates what B8 makes available. B9 reads those fields and no others:

| Entity | Fields B8 offers | Origin | B9 uses them for |
|---|---|---|---|
| `Payment` | `public_id, amount, currency, status, captured_at` | frozen §3 | reconciliation matching; platform-source gating |
| `Invoice` | `public_id, total, currency, issued_at` | frozen §3 | reconciliation matching; platform-source gating |
| `Subscription` | `public_id, plan_version_ref, status` | frozen §3 | determining whether a payment/invoice is platform lineage (§5) |
| `Refund` | `payment_ref, amount, currency, status, created_at` | **`B9-AM-009`** | `refund_without_recognition`, `refund_without_reversal`, `provider_discrepancy` (§6) |

**The `Refund` row is an amendment, and is registered rather than assumed.** Frozen `B8_B9_FINANCE_BOUNDARY.md` §3 lists three facts and no refund; its §4 says that needing a fourth *"is a future controlled amendment against this document, never an assumption baked into B8 today."* An earlier draft of this document promised refund-driven reconciliation in §6 while simultaneously binding B9, here in §4, to reading *"those fields and no others"* — the two sections contradicted each other and the promise had no evidence source. `B9-AM-009` is exactly the amendment §4 prescribes.

B8 builds nothing for it. `refunds` is already a frozen B8 table carrying `payment_id`, `amount`, `currency`, `status` and `created_at` (`B8_CHECKOUT_PAYMENT_MODEL.md` §4; `B8_STORAGE_MODEL.md` classes it *Financial*, append-only). The amendment exposes what exists; it does not ask B8 to model anything new, and it does not give B8 any knowledge of B9.

`Payment.status ∈ {refunded, partially_refunded}` was considered as a substitute and **rejected**: it says *that* a refund occurred but not *how much*, and B8 supports partial refunds where the amount lives on the child row (`B8-X-008`). A `refund_without_reversal` case whose evidence could not name an amount would hand the operator a flag instead of a figure.

If B9 ever needs a B8 fact outside this list, `B8_B9_FINANCE_BOUNDARY.md` §4 requires a further controlled amendment against **that** document. B9 Phase 1 needs no other.

**`Payment.amount` is never copied into `revenue_events`.** It is compared during reconciliation and used to gate platform sources; it is not a recognition amount. The caller supplies the amount, always.

## 5. Platform billing is categorically not recognizable

Frozen: *"A successful WazLink subscription payment is platform Billing, not a customer Deal revenue event."*

A `PAY-*`/`INV-BILL-*` whose lineage resolves to the workspace's own WazLink `Subscription` is rejected with `B9-AF-007 PLATFORM_BILLING_NOT_RECOGNIZABLE`. Since Phase-1 B8 models **only** platform billing, this rejects every payment/invoice source a Phase-1 workspace can construct. The source types remain in the closed set because the frozen polymorphic DTO enumerates them and B8's boundary anticipates them — gated, not deleted, so no future phase must re-open a frozen contract. `AT-B8-3` **(NC)**.

## 6. Refunds

A B8 refund **never** reverses revenue automatically.

| Step | Actor |
|---|---|
| Refund occurs in B8 | B8 / provider |
| Reconciliation reads the `Refund` fact (§4, `B9-AM-009`) as settled state at scan time | B9 scanner (read-only) |
| `refund_without_reversal` case opened | B9 scanner |
| A human decides whether the refund warrants reversing revenue | human, `finance.reconciliation.resolve` |
| If yes, `ReverseRevenueEvent` issued | human, `revenue.reverse` |

A refund and a revenue reversal are different facts: a refund may be a goodwill gesture, a partial credit, or a chargeback the workspace disputes. Auto-reversing would make B8 the recognition authority through the back door. `B9-D-A009`; `AT-B8-5`, `AT-B8-6`.

Reading the refund **amount** does not weaken this. The amount is what makes the case actionable — the operator sees "300 SAR refunded against `REV-…`, no reversal recorded" instead of "a refund happened somewhere" — and the reversal they then issue is their own decision, in their own amount, under `revenue.reverse`. B9 never pre-fills, never proposes, and never books it. `AT-B8-9`, `AT-B8-10` **(NC)**.

A refund with **no** recognized revenue is `refund_without_recognition`, `severity=info` — the ordinary case (platform refunds are never customer revenue), resolved as `dismissed`.

## 7. No writes in either direction

B9 holds no write path to `payments`, `invoices`, `subscriptions`, `refunds`, `upgrade_quotes`. B8 holds none to any B9 table — proved independently in `B8_REVENUE_FIREWALL.md` §2, which enumerates B8's whole event list and states `RevenueRecognized`/`RevenueReversed` "are producible by no B8 command."

B9 also defines **no entitlement capability and no usage metric** — inventing a commercial key is B8's authority (`B9_RBAC_TENANCY.md` §6).

```
DIRECT_B8_WRITE_LEAKS                   = 0
B8_PAYMENT_AUTHORITY_LEAKS              = 0
B8_BILLING_AUTHORITY_LEAKS              = 0
PROVIDER_STATUS_REVENUE_AUTHORITY_LEAKS = 0
```

## 8. Negative controls

`AT-B8-1` **(NC)**: `PaymentSucceeded` producing a `revenue_events` row — fails.
`AT-B8-2` **(NC)**: any B9 event subscription against a B8 event — fails; contradicts `B8_B9_FINANCE_BOUNDARY.md` §4.
`AT-B8-3` **(NC)**: recognition against a platform `PAY-*`/`INV-BILL-*` — rejected `B9-AF-007`.
`AT-B8-4` **(NC)**: `Payment.amount` copied into `gross`/`net` — fails.
`AT-B8-5` **(NC)**: a B8 refund automatically creating a `revenue_reversals` row — fails.
`AT-B8-6`: a refund on a recognized event opens `refund_without_reversal` and writes nothing financial.
`AT-B8-7` **(NC)**: a B9 command writing any B8 table — fails.
`AT-B8-8` **(NC)**: `SubscriptionActivated` recognized as revenue, or `subscription` accepted as a `source_type` — fails `B9-AF-004`.
`AT-B8-9`: a partial B8 refund is visible to reconciliation with its own `amount`, and opens `refund_without_reversal` carrying that amount.
`AT-B8-10` **(NC)**: an implementation deriving a reversal amount from a `Refund` fact automatically, or pre-filling `ReverseRevenueEvent` from it — fails; the human supplies the amount (`B9-D-A009`).
`AT-B8-11` **(NC)**: B9 reading any B8 field outside the four facts of §4 — fails; a further fact requires its own amendment.
