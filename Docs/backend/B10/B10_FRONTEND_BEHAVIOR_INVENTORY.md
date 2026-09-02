# B10 — Frontend Behavior Inventory

> Frontend evidence only. No frontend file is modified by B10. Frozen frontend reference: `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` (same reference every prior phase used, independently re-verified unchanged against current HEAD during this authoring pass). Evidence root: `client/src/`.

## 1. Method

Mechanical search of `client/src` for every tax/VAT/receipt/company-billing-detail/ZATCA/invoice-display behavior, using case-insensitive keyword search (`vat`, `tax`, `invoice`, `receipt`, `zatca`, `company`) across the full tree, then reading each genuine hit (excluding substring false-positives such as "avatar," "reactivated," "task") in full context. Files read in full or by targeted section: `Checkout.tsx`, `Billing.tsx`, `domain/data.js` (checkout/invoice section), `services/contracts/services.ts`, `services/index.ts`, `services/mock/legacyDataBridge.ts`. Classification identical to B8's precedent:

- **A** — must be preserved / directly shapes a B10 backend contract
- **B** — can be derived/composed from existing data, informative
- **C** — placeholder/presentation only
- **D** — intentionally unsupported/deferred, non-authoritative

**Result: zero ZATCA-specific frontend behavior of any kind exists** (no QR display, no XML/UBL reference, no CSID/certificate UI, no clearance/reporting status, no legal-sequence-number field) — confirmed by the same full-corpus grep that found zero `ZATCA`/`zatca` matches anywhere in `client/src` during the B8 authoring pass, independently re-run during this pass with an identical zero-match result. The frontend's tax-adjacent footprint is narrow: an optional VAT-number capture at checkout and a flat, explicitly-labeled mock display tax. This produces a real, small inventory of **6** distinct behaviors — it is not artificially padded to match B8's scale, because the underlying evidence genuinely does not support a larger count.

## 2. Totals

| Class | Count |
|---|---:|
| A | 2 |
| B | 1 |
| C | 1 |
| D | 2 |
| **Total** | **6** |

## 3. Class A evidence (backend-contract-shaping)

| ID | Class | Source File(s) | Line/Range | Observed Behavior | B10 Interpretation | Contract Required |
|---|---|---|---|---|---|---|
| FB-B10-001 | A | `client/src/features/settings/Checkout.tsx`; `client/src/services/contracts/services.ts` | 82-95, 111-122; 29 | Checkout invoice-step form captures `companyName` (required), `email` (required), and an optional `vatNumber` field (label: "رقم ضريبي اختياري للعرض" — "optional tax number for display"; placeholder: "اختياري — لا تحقق خارجي" — "optional, no external verification"), submitted as `{companyName, billingEmail, taxNumber}` matching the typed `CheckoutInvoiceInput` contract | Directly informs `TaxBuyerProfile`'s field shape (`company_name`, `tax_registration_number`, both optional) and confirms the buyer-VAT-number-is-optional posture already matches real Simplified Tax Invoice practice (`B10-X-003`) rather than requiring an architecture change | Yes |
| FB-B10-002 | A | `client/src/domain/data.js` | 1049, 1051 | `updateMockCheckoutInvoice()` stores `{companyName, email, vatNumber}` verbatim on `checkout.invoice`; `getMockCheckoutPreview()` computes `tax = Math.round(subtotal*0.15*100)/100` — a hardcoded, always-applied 15% flat tax with no exemption/zero-rate branch of any kind | Confirms the mock model treats tax as a single flat rate with no category distinction — explicitly **not** adopted as B10 architecture (`B10_TAX_CALCULATION_MODEL.md` §2's four-category model is required precisely because this mock precedent is too simplistic to be authoritative); corroborates `B10-X-010`'s 15% standard-rate figure as at least directionally consistent with the frontend author's own assumption | Yes |

## 4. Class B evidence

| ID | Class | Source File(s) | Line/Range | Observed Behavior | B10 Interpretation | Contract Required |
|---|---|---|---|---|---|---|
| FB-B10-003 | B | `client/src/features/settings/Billing.tsx` | 245-286 | Invoice history table renders the B8 commercial `Invoice` list (id/period/amount/status/issued-date) with no tax-specific column of any kind (no VAT amount, no tax-invoice status) | Confirms the existing invoice display surface is entirely B8-owned and tax-unaware today; a future `TaxInvoice`-aware UI (`B10-D-B006`, deferred) would be additive to this table, not a replacement of it | No |

## 5. Class C evidence

| ID | Class | Source File(s) | Line/Range | Observed Behavior | B10 Interpretation | Contract Required |
|---|---|---|---|---|---|---|
| FB-B10-004 | C | `client/src/features/settings/Checkout.tsx` | 124-128, 192-195 | Both the invoice-step form and the review step display "ضريبة عرض تجريبية" ("demo display tax") as an explicit, labeled line item alongside the subtotal/total | Pure presentation of the Class-A mock tax figure (`FB-B10-002`); the explicit "تجريبية" (demo/trial) labeling is itself evidence the frontend author already intended this figure as non-authoritative, corroborating `B10_TAX_CALCULATION_MODEL.md` §8's "dormant calculation engine" posture | No |

## 6. Class D evidence

| ID | Class | Source File(s) | Line/Range | Observed Behavior | B10 Interpretation | Contract Required |
|---|---|---|---|---|---|---|
| FB-B10-005 | D | `client/src/features/settings/Billing.tsx` | 277-281 | Invoice-download button rendered `disabled` with `title="غير متاح في S11"` ("not available in S11") and static "قريبًا" ("coming soon") label (same evidence B8 independently cited as `FB-B8-101` for its own purposes) | Confirms zero frontend precedent exists for any invoice/receipt document rendering, tax or otherwise — a future `TaxInvoice` display surface has no UI convention to preserve or contradict | No |
| FB-B10-006 | D | `client/src/domain/data.js` | 1051 | The mock tax figure is computed **live** on every preview call, never persisted as its own field on the mock `Invoice`/checkout record beyond the transient preview object | Explicitly not adopted — B10's `TaxInvoice`/`tax_invoice_lines` are persisted, immutable-once-issued rows (`B10-D-A006`), never a recomputed-on-read projection | No |

## 7. What the frontend does not answer, and B10 must design without frontend precedent

Tax category distinction (standard/zero-rated/exempt/out-of-scope) — the mock model has exactly one flat rate; ZATCA applicability/state of any kind — no such concept exists anywhere in the frontend; credit/debit note issuance — no UI exists; legal entity / seller tax identity — the frontend only ever captures **buyer**-side detail (`FB-B10-001`), never seller-side, since the mock checkout has no concept of WazLink's own tax posture; QR/XML/cryptographic-stamp display — absent entirely. These are recorded as B10 decisions made without frontend precedent (§`B10_DECISION_REGISTER.md`), never silently invented from absent evidence.

## 8. Self-check — reference integrity

`DEFINED_FB_IDS` (6, this file's table rows): `001, 002, 003, 004, 005, 006`.
`CITED_FB_IDS` (every `FB-B10-###` match found elsewhere in the pack via `grep -oE 'FB-B10-[0-9]+'`, excluding this file): `001`.
`BROKEN_FRONTEND_REFS = CITED_FB_IDS − DEFINED_FB_IDS = ∅` → **0**. `DUPLICATE_FB_ID_DEFINITIONS = 0`. `FRONTEND_DUPLICATE_BEHAVIORS = 0` (no two rows describe the same product-level behavior).

```
FRONTEND_BEHAVIOR_COUNT = 6
FRONTEND_A = 2
FRONTEND_B = 1
FRONTEND_C = 1
FRONTEND_D = 2
```
