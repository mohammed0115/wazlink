# B9 — Scope

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B9 is

B9 is the **authoritative source of recognized-revenue truth and revenue attribution truth** for a workspace. It converts explicitly authorized recognition decisions into an immutable, auditable financial record, and it answers "how much revenue did this workspace recognize, in what currency, in what period, and which acquisition source earned it."

B9 unifies two domains frozen B0 already registered separately in `BACKEND_DOMAIN_OWNERSHIP.md`:

| Frozen B0 domain | Aggregate root | Frozen tables | Frozen commands | Frozen events |
|---|---|---|---|---|
| **Revenue** | `RevenueEvent` | `revenue_events`, `revenue_reversals` | `RecordRevenueEvent`, `ReverseRevenueEvent` | `RevenueRecognized`, `RevenueReversed` |
| **Attribution** | `AttributionTouchpoint` | `attribution_touchpoints` | `RecordTouchpoint` | `TouchpointRecorded` |

B9 does not rename, merge, or re-found either. It designs both, plus the reconciliation surface `BACKEND_RECONCILIATION.md` leaves open for finance.

## 2. The invariant B9 exists to protect

```
Won Deal            ≠ Recognized Revenue
Deal amount         ≠ Recognized Revenue
Pipeline value      ≠ Recognized Revenue
PaymentSucceeded    ≠ Recognized Revenue
SubscriptionActivated ≠ Recognized Revenue
CheckoutSucceeded   ≠ Recognized Revenue
Plan price          ≠ Recognized Revenue
Invoice amount      ≠ Recognized Revenue
Frontend analytics  ≠ Recognized Revenue
```

Recognized revenue exists **only** where a `RevenueEvent` row exists, and a `RevenueEvent` row exists **only** where the governed `RecordRevenueEvent` command succeeded. Every clause above is proved structurally in `B9_REVENUE_FIREWALL.md`, not asserted.

## 3. In scope

- Recognized revenue: what it is, when it is recognized, on what evidence, by whom, in what amount and currency (`B9_REVENUE_RECOGNITION_POLICY.md`)
- The immutable `RevenueEvent` register (`B9_REVENUE_EVENT_MODEL.md`)
- Compensating reversals — full, partial, repeated (`B9_REVERSAL_MODEL.md`)
- Revenue attribution, unattributed revenue, and the first-touch algorithm over its two candidate sources — recorded touchpoints and B3's immutable discovery provenance (`B9_ATTRIBUTION_MODEL.md`, `B9_FIRST_TOUCH_MODEL.md`)
- Currency and money representation (`B9_CURRENCY_MONEY_MODEL.md`)
- Time, periodisation and reporting windows (`B9_TIME_PERIOD_MODEL.md`)
- Financial reconciliation cases (`B9_RECONCILIATION_MODEL.md`)
- The canonical backend revenue selectors (`B9_ANALYTICS_PROJECTIONS.md`)
- Storage, API, commands/events, failures, RBAC, idempotency/concurrency, security/retention, observability
- The five boundary documents: B6 Pipeline, B8 Billing, B7 Automation, B10 Tax, B12 Async

## 4. Explicitly **out** of scope — and not silently omitted

B9 is a **revenue register**, not an accounting system. It does not own, and Phase 1 does not build:

| Not owned | Why | Where it belongs |
|---|---|---|
| General ledger / double-entry accounts | No product or frozen evidence; `B9-D-A003` | a future accounting phase, if ever |
| Chart of accounts, journals, trial balance | same | same |
| Accounts payable | WazLink does not model supplier obligations anywhere in B0-B8 | out of product |
| Accounts receivable ledger / ageing | No frozen entity; B8 owns `invoices`/`payments` for **platform** billing only | B8 for platform; not modelled for customers |
| Bank reconciliation / cash position | No bank entity exists in any frozen document | out of product |
| Payroll, inventory, cost accounting, COGS | No frozen evidence of any kind | out of product |
| VAT/tax calculation, tax invoice numbering, invoice XML, QR, ZATCA clearance/reporting | Frozen `BACKEND_DOMAIN_OWNERSHIP.md` assigns Tax to its own domain (`tax_invoices`, `SubmitTaxInvoice`, `TaxSubmitted`) | **B10** (`B9_B10_TAX_BOUNDARY.md`) |
| Customer invoicing (issuing invoices to the workspace's own customers) | No frozen entity; B8's `invoices` are WazLink→workspace platform invoices, not workspace→customer | out of Phase-1 product |
| Payment capture, refunds, provider integration | Frozen B8 owns `payments`, `refunds`, Tap. B9 **reads** a refund fact as reconciliation evidence under `B9-AM-009` and owns none of it | **B8** (`B9_B8_BILLING_BOUNDARY.md`) |
| FX conversion / multi-currency totalling | `B9-D-A017`: no FX authority exists in any frozen document | deferred (`B9-D-B004`) |
| Deal, pipeline, forecast truth | Frozen B6 | **B6** (`B9_B6_PIPELINE_BOUNDARY.md`) |
| Celery/Redis/worker topology | Frozen B0 ADR-005; platform work | **B12** (`B9_B12_ASYNC_BOUNDARY.md`) |

`B9_DECISION_REGISTER.md` `B9-D-A003` records the ledger-scope decision formally; `B9_FINANCIAL_MODEL.md` §2 gives the reasoning.

## 5. Phase-1 posture on the two acquisition tracks

B9 is designed so that **Track A** (Discovery → Business → Lead → Deal → Revenue) and **Track B** (import/manual/API/form → CRM customer → Deal → Revenue) both produce valid recognized revenue. Discovery is never a precondition for financial truth. Track B's own entities are *not* built here; only compatibility is designed. See `B9_DUAL_TRACK_COMPATIBILITY.md`.

## 6. What B9 produces for downstream phases

- **B10 (Tax)** may read `RevenueEvent` as *commercial context*. A `RevenueEvent` is not a tax invoice and creates no tax obligation by itself.
- **Analytics/Dashboard** consume B9's canonical selectors (`B9_ANALYTICS_PROJECTIONS.md`); they never recompute revenue from Deals, payments, or plans.
- **B12** operates the async surface B9 declares semantically (`B9_B12_ASYNC_BOUNDARY.md`).

## 7. Authorization status

B9 is **design-only**. It grants no implementation authorization, contains no Django/DRF/SQL/Celery artifact, and creates no B10/B11/B12 file.
