## Direct fresh-load

Fresh-loaded `http://localhost:3000/#/settings/billing/checkout` without visiting Billing first. Checkout mounted directly as a modal-like route-owned surface with invoice form and four visible steps. No Settings fallback or blank screen.

## Invoice → Payment → Review

The existing in-memory Checkout draft advanced from invoice to masked Visa payment and then to review. The review showed subtotal, experimental tax, total, masked payment reference, and explicit local-only disclosure. No external payment request occurred.
## Review → Success

The review step advanced to success. Confirmation rendered receipt `INV-BILL-1003`, total `113.85 ر.س`, masked `Visa •••• 4242`, and explicitly stated no customer revenue or attribution was created.
## Clean direct-load and invoice → payment

After replacing the stale server, the exact canonical route `#/settings/billing/checkout` fresh-loaded into the invoice step with a valid default CRM plan. Submitting the invoice advanced to the masked payment step with no blank screen or console error.
## Review → Failure

The intentional `محاكاة فشل` action rendered the failed-payment state with `فشل تجريبي مقصود`, explicitly confirming that no subscription, paid invoice, or external data submission was created. A `حاول مجددًا` action was visible.
