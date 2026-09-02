# B8 — Revenue Firewall

> Structural proof, mirroring `B6_REVENUE_FIREWALL.md` and `B7_REVENUE_FIREWALL.md`'s four-part method exactly. **PAYMENT SUCCESS ≠ RECOGNIZED REVENUE.**

## 1. Frozen anchors (quoted verbatim, pre-existing — not authored by B8)

- `BACKEND_BILLING_TAX_ARCHITECTURE.md` "Revenue boundary": *"No Billing event creates customer RevenueEvent unless an explicit, separately approved revenue-recognition rule exists. A successful WazLink subscription payment is platform Billing, not a customer Deal revenue event. A customer Deal becoming Won does not create a Billing payment, invoice, or RevenueEvent."*
- `BACKEND_COMMAND_EVENT_CATALOG.md`: *"`UpgradeQuoteIssued` and `UpgradeQuoteConsumed` are Platform Billing events and MUST NOT emit `RevenueRecognized`; issuing or consuming a quote is commercial authorization, not customer revenue recognition."*
- `BACKEND_BILLING_TAX_ARCHITECTURE.md` "UpgradeQuote": *"An UpgradeQuote is commercial authorization only. Issuing, consuming, expiring, or cancelling a quote never creates, implies, or mutates a customer `REV-*` RevenueEvent."*
- `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007: *"`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent. Platform Billing remains a separate bounded context from customer CRM Revenue."*
- `BACKEND_ANALYTICS_SEMANTICS.md`: *"Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent unless an explicit cross-domain reporting contract is approved."*
- Frontend corroboration (Class A/B evidence, not authority but independently consistent): `FB-B8-030` (`Billing.tsx` header comment: platform subscription is "completely separate" from customer revenue), `FB-B8-040` (`Checkout.tsx`: "payment success never creates a `RevenueEvent` or `AttributionTouchpoint`"), `FB-B8-051`/`FB-B8-074` (two independent frontend self-check functions asserting the same invariant).

## 2. Structural proof

**Table access lockout.** B8's `billing`/`entitlements` application-service layers hold no repository/ORM manager reference to `revenue_events`, `revenue_reversals`, or `attribution_touchpoints` (§`B8_RBAC_TENANCY.md` §5). No B8 command has a write path to any of the three tables — not through a direct write, not through a triggered side effect, not through an outbox-consumed downstream handler B8 itself owns.

**Event-production lockout.** B8's complete, closed event list (`B8_COMMAND_EVENT_CATALOG.md` §2) is: `UpgradeQuoteIssued`, `UpgradeQuoteConsumed`, `UpgradeQuoteExpired`, `PaymentSucceeded`, `PaymentFailed`, `PaymentReconciled`, `SubscriptionActivated`, `SubscriptionCancelled`, `SubscriptionReactivated`, `SubscriptionPastDue`, `SubscriptionSuspended`, `SubscriptionExpired`, `SubscriptionDowngradeScheduled`, `SubscriptionDowngradeApplied`, `EntitlementOverrideGranted`, `EntitlementOverrideRevoked`, `InvoiceIssued`. **`RevenueRecognized` and `RevenueReversed` do not appear in it and are producible by no B8 command.**

**Payload sterility.** `PaymentSucceeded`'s payload (`payment_ref, subscription_ref, amount, currency, captured_at`) and `SubscriptionActivated`'s payload (`subscription_ref, workspace_ref, plan_version_ref, effective_at`) carry no `recognized_amount`, no `revenue_status`, no field named or shaped like a revenue fact. `Payment.amount`/`.currency` are commercial-transaction facts (what the workspace paid WazLink for its own subscription), never copied into any `RevenueEvent.gross`/`net` field — there is no code path that could copy them, since B8 never touches that table (§ above).

**Field-naming discipline.** No B8 DTO (`SubscriptionDTO`, `Payment`, `Invoice`, `UpgradeQuote`, `BillingOperationList`) exposes a field named or documented as "revenue." No B8 read model (`B8_READ_MODELS_QUERY.md`) aggregates Payment/Invoice totals under a "revenue" metric name — `BACKEND_ANALYTICS_SEMANTICS.md`'s own "Recognized Revenue" metric row sources exclusively from `RevenueEvent.recognized_at`, a table B8 never writes.

## 3. Required negative-control tests

| # | Claim | Test ID | Mechanism |
|---|---|---|---|
| 1 | `ProcessPaymentWebhook` succeeding creates zero `revenue_events` rows | `AT-B8REV-1 (NC)` | execute a full `CreatePayment`→webhook→`captured` sequence; assert zero rows in `revenue_events`, zero `RevenueRecognized` on outbox |
| 2 | Refunding/reversing a Payment does not reverse an existing `RevenueEvent` | `AT-B8REV-2 (NC)` | `create_refund` has no write path to `revenue_reversals`; a pre-existing unrelated `RevenueEvent` for the same workspace is unaffected |
| 3 | Subscription/Invoice totals are never exposed under a "revenue" metric name | `AT-B8REV-3 (NC)` | grep `B8_READ_MODELS_QUERY.md`/`B8_API_DTO_CONTRACTS.md` for any field/metric literally named `revenue`; zero matches outside negative statements |
| 4 | A webhook redelivery/retry produces no duplicate `RevenueEvent` | `AT-B8REV-4 (NC)` | redeliver the same verified webhook twice; `revenue_events` row count unchanged (trivially — it was already zero, and stays zero) |
| 5 | Purging/retention-deleting old Payment/Invoice rows has zero effect on financial (Revenue) truth | `AT-B8REV-5 (NC)` | run the retention workflow (§`B8_PRIVACY_RETENTION.md` §4) against Payment/Invoice history; `revenue_events` row count and content unchanged |
| 6 | A `DealWon` event (B6) never triggers a B8 command | `AT-B8REV-6 (NC)` | B8 consumes zero Pipeline events (§`B8_COMMAND_EVENT_CATALOG.md` §3's consumed-event list has no `Deal*` row) |

`REVENUE_EVENT_PRODUCERS_IN_B8 = 0`. `RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0`.

## 4. The one legitimate link

A future B9 `RecordRevenueEvent` **may** create a `RevenueEvent` whose polymorphic `source_ref` points at a `PAY-*`/`INV-BILL-*`/`SUB-*` (the same `source_type`+`source_ref` polymorphic contract already frozen in `BACKEND_DTO_CONTRACTS.md` for `RevenueEvent`), but only initiated exclusively by B9's own governed command, and read-only from B8's perspective — B8 supplies the fact (a payment happened), B9 decides, separately and later, whether and how it becomes recognized revenue. Full detail in `B8_B9_FINANCE_BOUNDARY.md`.

## 5. False-positive guard

Every occurrence of the word "revenue" in this document (and in every other B8 document) is inside a negative statement ("never creates," "does not," "excluded," "zero," "no such field") or a citation of frozen text stating the same — no occurrence should be mechanically miscounted as a producer. `B8_VERIFICATION_MATRIX.md` §4 re-runs this scan mechanically across the full document pack.

## 6. Closure statement

`WON PAYMENT ≠ RECOGNIZED REVENUE` holds by construction, not by convention — identical epistemic status to B6's `WON DEAL ≠ RECOGNIZED REVENUE` and B7's automation-level restatement of the same invariant.
