# B10 — B8 Billing Boundary

> Design only. Mirrors `B9_B8_BILLING_BOUNDARY.md`'s pattern from Finance's side, now from Tax's side. B8 is frozen; this document proposes no change to it.

## 1. What B8 already committed (frozen, quoted)

`BACKEND_BILLING_TAX_ARCHITECTURE.md`: *"Invoice and TaxInvoice are separate. Invoice represents the commercial billing document; TaxInvoice represents the Saudi tax document and submission lifecycle."* This predates B10 and is the anchor B10 realizes, not invents.

## 2. B10 never writes a B8 table

`subscriptions`, `billing_customers`, `upgrade_quotes`, `payments`, `payment_attempts`, `refunds`, `invoices`, `invoice_lines` — B10's application-service layer (`apps/tax/`) holds no repository/ORM manager reference to any of them, mirroring the structural-unreachability proof pattern `B8_RBAC_TENANCY.md` §5 and `B9_B8_BILLING_BOUNDARY.md` both already establish for their own domains.

## 3. The one consumed event: `InvoiceIssued`

B8's frozen `B8_COMMAND_EVENT_CATALOG.md` §2 already produces `InvoiceIssued` (`invoice_ref, subscription_ref, total, currency`), currently consumed only by "Billing" itself. B10 becomes a **new** consumer of this already-frozen, already-produced event — adding a consumer to an existing event requires no change to B8, exactly as B7 became a new consumer of B1's `WorkspaceCreated` without B1 changing. `IssueTaxInvoice` (§`B10_INVOICE_MODEL.md` §4) is triggered by this event; B10 reads no other B8 event and produces no B8-consumed event of its own.

## 4. `Refund` is evidence, never a trigger

B8's frozen catalog produces **no** refund-specific event (verified: `PaymentSucceeded`, `PaymentFailed`, `PaymentReconciled` cover `Payment` state only; `refunds` is an unexported child table with no outbox signal). B10 therefore never "consumes a refund" — `CreateCreditNote` is always operator-initiated, correlating a visible B8 refund to a `reference_invoice_id` manually (`B10_CREDIT_NOTE_MODEL.md` §2). B10 may **read** `Payment`/`refunds` fields (amount, status, `provider_payment_ref`) read-only, on demand, through B8's own frozen DTOs — the identical "read-only, on-demand, no subscription" pattern B9 already established relative to B8 — solely to help an operator locate the right original document; this is evidence, never authority, and never an automatic trigger.

## 5. Payment success ≠ tax invoice requirement

A `PaymentSucceeded` event is never read by B10 at all (only `InvoiceIssued` is consumed, and only once B8 itself has already decided a commercial `Invoice` exists). This keeps B10's trigger surface identical to what B8 itself considers "billing is complete," never an earlier or parallel signal that could race B8's own commercial-invoice issuance.

## 6. Negative controls

`AT-B10B8-1 (NC)`: a B10 command, column, or endpoint writing to any B8-owned table — fails. `AT-B10B8-2 (NC)`: a `PaymentSucceeded` event triggering `IssueTaxInvoice` directly (bypassing `InvoiceIssued`) — fails; no such consumer path exists. `AT-B10B8-3 (NC)`: a B8 refund event triggering an automatic `CreateCreditNote` — fails; no such consumed event exists in B8's frozen catalog for B10 to subscribe to.

```
B8_PAYMENT_AUTHORITY_LEAKS = 0
```
