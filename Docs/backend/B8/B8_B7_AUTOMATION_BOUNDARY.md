# B8 → B7 Automation Boundary

> Restates and closes the obligations `B7_B8_BILLING_BOUNDARY.md` already declared from B7's side, now from B8's.

## 1. What `B7_B8_BILLING_BOUNDARY.md` already committed B7 to

Quoted (research digest, verbatim from that frozen document): *"B7 does not invent subscription truth, payment truth, plan pricing, invoice truth, or a billing state machine... mints no capability key, no usage metric, and no plan-tier vocabulary of its own; it supplies no numeric plan limits, no pricing tier names, and no billing-cycle logic."* And: *"Never writes `subscriptions`/`plans`/`invoices`/`payments`/`upgrade_quotes`. Never reads raw payment-method/card data. Never gates automation on anything beyond a binary capability flag and a usage-count comparison — both read-only against the frozen boundary."*

B8 now closes the two obligations that document explicitly left open:

## 2. Closing `B7-D-B009` (numeric values behind `automation.rules`/`automationRuns`)

`B8_PLAN_CATALOG.md` §6 supplies the concrete Phase-1 numbers: STARTER denies `automation.rules` entirely (capability `false`); GROWTH grants it with `automationRuns` limit 200/period; SCALE grants it at 1,000/period. B7 consumes these through the identical read-only `EvaluateEntitlement`/quota-check path it already uses — no change to B7's own admission code, only real numbers now sitting behind the two keys it always expected to be populated.

## 3. Closing `B7-D-C005` (dry-run metering)

**Decision (`B8-D-A020`):** `RunAutomationTest` (dry-run) evaluations consume **zero** commercial quota — they produce no durable side effect, so metering them would charge a workspace for something that never happened. Only a real triggered/admitted run (already B7's own `automationRuns` reservation point) consumes the metric. This closes B7's deferred question without requiring any B7 document change — B7's existing text already anticipated exactly this answer as one of its live options.

## 4. Billing-triggered automation remains out of scope

Per `B7_B8_BILLING_BOUNDARY.md` §3 (*"Any future idea for automation to react to a billing event... is explicitly out of scope for B7 and is not preemptively designed here — it awaits B8's own closure and, if pursued, a controlled amendment against *this* document"*): B8 does **not** design a `subscription_downgraded`/`payment_failed`-shaped automation trigger in Phase 1. None of B8's new events (`SubscriptionCancelled`, `SubscriptionSuspended`, etc., §`B8_COMMAND_EVENT_CATALOG.md` §2) is added to B7's closed trigger catalog (`B7_TRIGGER_CATALOG.md`) by this document — doing so would require a controlled amendment against *both* `B7_TRIGGER_CATALOG.md` and this document, deliberately deferred (`B8-D-C008`, Class C) rather than silently assumed.

## 5. No automation side effect from any B8 event

Restating brief §36 directly: no B8 command or event triggers a B7 automation side effect by itself in Phase 1 — B7 only ever *reads* B8's entitlement/quota facts; B8 never *writes into* or *invokes* B7's automation engine, and B7 never silently subscribes to a B8 event without the explicit catalog amendment §4 describes.

## 6. Negative control

`AT-B7BILL-B8-1 (NC)`: an implementation where a B8 command's success handler directly creates an `AutomationRun` or writes to `automation_rules`/`runs` — fails; B8's application-service layer holds no repository reference to those tables (§`B8_RBAC_TENANCY.md` §5). `AT-B7BILL-B8-2 (NC)`: an implementation where B8 exposes a currency/price field consumed by any B7 DTO — fails; B7's own negative control (`AT-B8BILL-1`) already proves the reverse direction, and no B8 event payload (§`B8_COMMAND_EVENT_CATALOG.md` §2) carries a price field at all except inside Billing's own closed event set, none of which B7 consumes (§`B8_COMMAND_EVENT_CATALOG.md` §3's consumed-list has no B7 row, and no B7 document lists a B8 event as consumed).
