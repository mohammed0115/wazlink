# B7 — B8 (future Billing) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. B8 is not designed yet

B7 does not invent subscription truth, payment truth, plan pricing, invoice truth, or a billing state machine. `B7_ENTITLEMENT_RBAC_TENANCY.md` §4 enforces only the **two keys frozen B1 already fixed** — capability `automation.rules` and usage metric `automationRuns` — against the entitlement-decision boundary that already exists in this corpus. B7 mints no capability key, no usage metric, and no plan-tier vocabulary of its own; it supplies no numeric plan limits, no pricing tier names, and no billing-cycle logic.

## 2. What B7 never does

Never writes `subscriptions`/`plans`/`invoices`/`payments`/`upgrade_quotes`. Never reads raw payment-method/card data. Never gates automation on anything beyond a binary capability flag and a usage-count comparison — both read-only against the frozen boundary.

## 3. Deferred billing-trigger/action ideas

Any future idea for automation to react to a billing event (e.g. "trigger on subscription downgrade") or to invoke a billing action is explicitly out of scope for B7 and is not preemptively designed here — it awaits B8's own closure and, if pursued, a controlled amendment against *this* document, not an assumption baked into Phase-1 B7.

## 4. Negative control

`AT-B8BILL-1` **(NC)**: an implementation where B7 computes or displays a dollar/SAR-denominated automation plan price — fails; no such field exists anywhere in B7's DTOs (`B7_API_DTO_CONTRACTS.md`) or read models (`B7_READ_MODELS_QUERY.md`).

`B8_BILLING_AUTHORITY_LEAKS = 0`.
