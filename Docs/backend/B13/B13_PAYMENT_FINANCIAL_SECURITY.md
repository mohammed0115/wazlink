# B13 — Payment & Financial Security

> Design only. Preserves every revenue/payment firewall proof already closed in B6, B7, B8, B9, B10 (`FI-B6-01`, `FI-B7-01`, `FI-B8-01`/`03`/`04`, `FI-B9-01`/`02`/`03`, `FI-B10-03`) verbatim. B13 mints no new financial rule; it states the production security posture around the already-proven authority firewalls.

## 1. The invariants, restated once

> **Frontend cannot grant entitlement. Frontend cannot declare payment success. Webhook receipt alone cannot blindly grant entitlement. Won Deal cannot create recognized Revenue. Billing money cannot become customer Revenue. Revenue mutations require domain authority. Financial reversal/correction follows frozen append-only semantics.**

Every clause is already structurally proven in a frozen document:

| Clause | Structural proof | Source |
|---|---|---|
| Frontend cannot grant entitlement | entitlement resolution is a server-side, five-step deterministic algorithm; the frontend evidence confirms zero payment-gateway SDK reference and a fully local checkout simulation (`FB-B13-015`/`016`) | `FI-B8-01` |
| Frontend cannot declare payment success | payment truth advances only via `ProcessPaymentWebhook`/`ReconcilePayment`; a browser redirect is documented by Tap's own docs as insufficient proof | `FI-B8-01`, `B12-X-008` |
| Webhook receipt alone cannot blindly grant entitlement | webhook processing is receipt→verify→dedup→**invoke the owning domain's own guarded command**, which re-checks its own preconditions | `FI-B12-09` |
| Won Deal cannot create recognized Revenue | `B6_REVENUE_FIREWALL.md` structural proof: B6's write surface excludes every revenue table; 5 negative-control tests | `FI-B6-01` |
| Billing money cannot become customer Revenue | `B8_REVENUE_FIREWALL.md`: B8's event list has no `RevenueRecognized`/`RevenueReversed`; 6 negative-control tests | `FI-B8-03` |
| Revenue mutations require domain authority | B9 has zero event consumers; `DealWon`/`PaymentSucceeded`/`SubscriptionActivated`/`InvoiceIssued` reach no B9 handler because none is registered | `FI-B9-01` |
| Financial reversal/correction follows append-only semantics | no update path on any financial column; a reversal is a bounded, row-locked, separately-permissioned compensating event | `FI-B9-03` |

## 2. Tap webhook authenticity — production posture

Tap's `hashstring` HMAC-SHA256 field-concatenation signature (`FI-B8-01`) covers only the enumerated fields (`id`, `amount`, `currency`, `gateway_reference`, `payment_reference`, `status`, `created`) — **any field outside the concatenation is unauthenticated and must never drive an authorization or routing decision** (`FI-B12-02` §2). Combined with Tap's 3-attempt total retry bound (`B12-X-006`), a webhook-ingress outage during Tap's retry window is the single highest-priority payment-security operational risk in this pack (`B13_INCIDENT_MANAGEMENT.md` §5 "Payment authority failure").

## 3. Unknown outcome — production procedure

A connection loss during Tap charge creation is `unknown`, never coerced to success or failure (`FI-B12-08`). Production procedure: record the attempt row **before** the provider call (write-before-call, `B12-D-A021`); never retry the non-idempotent charge creation; resolve via `retrieve_charge` (read-only, safe to retry freely); if unresolved within the domain's pending window, open a `P-1` reconciliation case and alert. **No configuration, permission, or operator action retries a non-idempotent payment operation whose outcome is unknown without first establishing the outcome** (`B12-D-A020`, no override flag exists anywhere in this pack).

## 4. Reconciliation

`retrieve_charge` sweep every 15 minutes (frozen `BACKEND_RECONCILIATION.md` row, `FI-B12-07`). Precedence: PostgreSQL wins on intent (did WazLink decide to charge), the provider wins on external effect (did the charge actually happen). Repair is always the owning domain's own command (`ReconcilePayment`) — B12's reconciliation scan never mutates a domain aggregate directly (`FI-B12-07`, `B12-D-A039`).

## 5. Duplicate callbacks and idempotency

Tap's `reference.idempotent` body field, 24h window, is a **secondary backstop**; WazLink's own 7-day `Idempotency-Key` retention (payment/webhook tier, `FI-B0-22`) is authoritative and derived internally from `Payment.public_id`, never client input (`FI-B8-01`). A duplicate webhook delivery is deduplicated on `(provider, dedup_key)`, binding-scoped (`FI-B12-02`).

## 6. Authorization for financial operations

| Action class | Permission | Production note |
|---|---|---|
| View billing/subscription | `billing.view` | Owner/Admin only |
| Change subscription, initiate payment | `subscription.change`, `payment.manage` | Owner allow, Admin conditional on confirmed workspace |
| Grant/revoke entitlement override | `billing.manage` | broaden-only rule (`MAX(current_base, override)`) enforced server-side, never client-suppliable |
| Recognize/reverse revenue | `revenue.recognize`, `revenue.reverse` | Owner/Admin only; **mandatory named human membership on every write — no system actor, no `system:automation` grant, ever** (`FI-B9-02`) |
| Resolve financial reconciliation | `finance.reconciliation.resolve` | Owner/Admin only |
| Applicability/ZATCA changes | `tax.applicability.manage`, `zatca.manage` | Owner-only for applicability, structurally stricter than routine `tax.manage` (`FI-B10-02`) |

The **conjunctive money-gate** (`FI-B9-02`, `B9-D-A038`): no response containing a `Money` field is reachable without `revenue.view`, whatever else the caller holds.

## 7. Operator actions on financial records

A dead letter or reconciliation case whose `owning_domain` is `billing` or `finance` requires **Owner**, not Admin, to replay/resolve — the frozen matrix's "Admin cannot bypass financial audit" limit, restated at the operator layer (`FI-B12-03` §2). No B13 control weakens this.

## 8. Audit

Every state-changing financial command writes one immutable audit fact — actor **membership** (never a system actor), workspace, command, target public ID, request ID, outcome, failure code (`FI-B9-03`). Because financial rows are themselves immutable and append-only, the audit log is corroboration, not the primary reconstruction mechanism.

## 9. Redaction

No card/PAN/CVV/expiry, no provider API keys/secrets/tokens/webhook signing keys, no raw provider payloads, no bank/IBAN, no auth material ever stored (`FI-B9-03`). A `RevenueEvent` referencing a payment stores only the `PAY-*` public ID.

## 10. Tax document security boundary

`TaxProvider` credential handling mirrors B8/B12's opaque-reference doctrine exactly (`FI-B10-01`). An ambiguous ZATCA response maps to `pending` plus a mandatory reconciliation alert — never silently to `accepted` or `rejected` (`FI-B10-03`, `B10-D-A019`). Transport retry (`RetryTaxSubmission`) never creates a second `TaxInvoice` for the same source — business re-issuance is only ever an explicit operator action (`CreditNote`/`DebitNote`/`CancelTaxInvoice`), never automatic.

## 11. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13PAY-1` | A redirect from Tap's hosted checkout never mutates `Payment.status`; only `ProcessPaymentWebhook`/`ReconcilePayment` do |
| `AT-B13PAY-2` | A field outside Tap's signed concatenation is never read for an authorization or routing decision |
| `AT-B13PAY-3` | A connection loss during charge creation records `unknown`, never `known_failure` or `known_success`, and is never blindly retried |
| `AT-B13PAY-4` | Duplicate Tap webhook delivery produces zero duplicate `Payment` state transitions |
| `AT-B13FIN-1` | `CloseDealWon` produces zero rows in `revenue_events` |
| `AT-B13FIN-2` | `PaymentSucceeded`/`SubscriptionActivated` produce zero rows in `revenue_events` |
| `AT-B13FIN-3` | No B9 write path is reachable without a named human membership; a `system:automation` actor is refused on every financial command |
| `AT-B13FIN-4` | A response containing a `Money` field is unreachable without `revenue.view`, regardless of any other permission held |
| `AT-B13FIN-5` | A reversal never creates negative `net`/`gross` on the original event beyond the documented terminal gross-cleanup case |
| `AT-B13FIN-6` | A dead letter or reconciliation case with `owning_domain=billing`/`finance` refuses an Admin-level replay/resolve, requiring Owner |
| `AT-B13FIN-7` | An entitlement-override read/write is scoped by `workspace_id`; a cross-tenant override collision is structurally impossible |
| `AT-B13FIN-8` | An ambiguous ZATCA response never resolves to `accepted` or `rejected` without a mandatory reconciliation case |
