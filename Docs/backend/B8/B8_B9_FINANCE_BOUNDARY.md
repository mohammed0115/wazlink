# B8 → B9 Finance/Revenue Boundary

> Mirrors `B7_B9_FINANCE_BOUNDARY.md`'s exact four-section shape, from B8's side. B9 is not designed here.

## 1. B9 is not designed yet, and B8 does not preempt it

No `RevenueEvent`, `RevenueReversal`, `AttributionTouchpoint`, recognized-revenue selector, or financial-ledger concept is owned, referenced as a write target, or invented anywhere in B8. Full structural proof is `B8_REVENUE_FIREWALL.md` — this document is the boundary statement; that one is the proof.

## 2. What B8 never does

Never writes `revenue_events`/`revenue_reversals`/`attribution_touchpoints`. Never invokes a hypothetical B9 command (none exists to invoke). Never treats a `PaymentSucceeded`/`SubscriptionActivated`/`InvoiceIssued` event as authorization for anything beyond B8's own closed, non-financial-recognition event catalog (§`B8_COMMAND_EVENT_CATALOG.md` §2).

## 3. What B8 *does* provide B9

B8 is a **fact source**, never a decision-maker, for B9. The commercial/payment facts B8 makes available for B9 to later consume (through B9's own governed read or event-subscription mechanism, not designed here) are: `Payment{public_id, amount, currency, status, captured_at}`, `Invoice{public_id, total, currency, issued_at}`, `Subscription{public_id, plan_version_ref, status}`. B9 may build a `RevenueEvent` whose `source_type="payment"`/`source_ref=PAY-*` (or `source_type="invoice"`/`source_ref=INV-BILL-*`) from these facts, but the decision of *whether*, *when*, and *how much* to recognize is entirely B9's — B8 asserts nothing about recognition timing, gross-vs-net treatment, or accounting period.

## 4. If a future B9 command needs a B8 fact

Any future B9-governed financial command reading B8 data is a **read-only, on-demand query** against B8's own frozen DTOs — the same "no circular dependency" pattern B4/B5/B6/B7 each independently established with their own upstream domains (never an event subscription requiring B8 to know about B9's existence). If B9 needs a *new* B8-exposed fact not already in §3, that is a future controlled amendment against this document, never an assumption baked into B8 today.

## 5. Negative control

`AT-B9FIN-B8-1 (NC)`: an implementation where a B8 command's success handler independently computes and stores an "estimated/recognized revenue" value anywhere in a B8 table — fails; no such column exists on `subscriptions`/`payments`/`invoices` (§`B8_CHECKOUT_PAYMENT_MODEL.md` §9's storage table has no such field). `B9_FINANCE_AUTHORITY_LEAKS = 0`.

## 6. Symmetry check against `B7_B9_FINANCE_BOUNDARY.md`

B7's boundary document states the identical invariant one domain earlier (Automation → Finance); B8's statement here is Billing → Finance. Both converge on the same B9 authority: only `RecordRevenueEvent` (frozen B0 command name, B9-owned) creates recognized revenue, from any source domain, ever.
