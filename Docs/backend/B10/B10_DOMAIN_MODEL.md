# B10 — Domain Model (Overview)

> Design only. This document is the map; `B10_LEGAL_ENTITY_TAX_PROFILE.md`, `B10_INVOICE_MODEL.md`, and `B10_CREDIT_NOTE_MODEL.md` are the territory — field-level detail lives there, not here.

## 1. Entity relationship overview

```
LegalEntity (1, Phase-1 singleton, future-extensible)
   │  effective-dated
   ▼
TaxProfile (versioned; exactly one row has effective_to IS NULL per LegalEntity)
   │  zatca_applicability: unknown | not_applicable | applicable_not_enabled | enabled | suspended
   │  snapshotted onto ↓ at issuance time (tax_profile_version_id)
   ▼
TaxInvoice (document_kind: invoice | credit_note | debit_note)
   │  invoice_classification: standard | simplified — pinned at creation, inherited (never re-chosen) for credit_note/debit_note
   │  reference_invoice_id (self-FK, required for credit_note/debit_note)
   │  source_type="b8_invoice" / source_ref → B8 Invoice (read-only pointer, no FK across app boundary)
   │  workspace_id → Workspace (the buyer)
   ├── TaxInvoiceLine (1..N child rows: description, quantity, tax_category, tax_rate, tax_amount)
   └── TaxSubmission (0..N append-only attempt rows; meaningful only when applicability requires transmission)

TaxBuyerProfile (0 or 1 per Workspace, optional)
   │  supplies the buyer_* snapshot fields TaxInvoice copies at issuance
   ▼ (read at issuance time only, never joined live afterward)

PendingTaxDocumentClassification (new, B10-FIX.1 — created while zatca_applicability = unknown)
   │  status: pending | resolved_not_applicable | resolved_for_issuance | cancelled
   │  source_type="b8_invoice" / source_ref → B8 Invoice (same identity space as TaxInvoice.source_ref)
   └── resolved_tax_invoice_id → TaxInvoice (set only when status=resolved_for_issuance)
```

## 2. Why two separate "profile" concepts

`TaxProfile` (§`B10_LEGAL_ENTITY_TAX_PROFILE.md`) governs whether **WazLink itself**, as seller, has a statutory tax-invoicing obligation on its own subscription revenue. `TaxBuyerProfile` is unrelated: it is the optional company name/tax-registration-number a **workspace** (buyer) supplies so its own tax invoice shows correct buyer details — the same data the frozen frontend already captures at checkout (`FB-B10-001`, §`B10_FRONTEND_BEHAVIOR_INVENTORY.md`). A workspace supplying a `TaxBuyerProfile` never changes WazLink's own applicability, and WazLink's applicability never requires a workspace to supply one (a `TaxInvoice`'s buyer section is simply less complete without it — matching the real Standard-vs-Simplified invoice distinction, `B10-X-003`).

## 3. Why `TaxInvoice` hosts four document shapes across two independent dimensions (`B10-FIX.1` correction)

`B10-D-A004` (§`B10_DECISION_REGISTER.md`), corrected under `B10-FIX.1`. The pre-FIX.1 pack collapsed two independent regulatory facts into one four-value `document_type` enum, which produced an incorrect ZATCA routing rule (`B10-AUDIT-C1`). `TaxInvoice` now carries two separate, orthogonal columns instead:

- **`document_kind`** (`invoice` \| `credit_note` \| `debit_note`) — the document's economic direction and its UNCL1001 base type code (`388` tax invoice, `381` credit note, `383` debit note per the officially-defined code list). `credit_note`/`debit_note` require `reference_invoice_id`; `invoice` forbids it.
- **`invoice_classification`** (`standard` \| `simplified`) — B2B/B2G full-buyer-detail vs. B2C reduced-buyer-detail, corresponding to the UNCL1001 subtype distinguishing a standard/business document from a simplified/consumer one. For `document_kind = invoice`, this is chosen at issuance (driven by whether a `TaxBuyerProfile` establishes a B2B relationship, §`B10_INVOICE_MODEL.md` §1a). **For `document_kind ∈ {credit_note, debit_note}`, this value is never independently chosen — it is pinned, at creation, from the `invoice_classification` of the `reference_invoice_id` row, and the API rejects any client-supplied value that conflicts with it** (§`B10_INVOICE_MODEL.md` §1a, §`B10_API_DTO_CONTRACTS.md` §2).

ZATCA's own clearance/reporting routing (§`B10_ZATCA_BOUNDARY.md` §3) is a function of `invoice_classification` alone — `document_kind` never enters that decision. This is why the two columns must be independent rather than folded into one enum: a `credit_note` on a `standard` invoice and a `debit_note` on a `standard` invoice must route identically (clearance), while a `credit_note` on a `simplified` invoice and a `debit_note` on a `simplified` invoice must also route identically (reporting) — a single `document_type` value keyed on credit-vs-debit could never express this. No document shape is ever represented outside this one aggregate.

## 4. What B10 does not model

No general-ledger/chart-of-accounts, no multi-currency conversion engine, no accounts-receivable aging, no full ERP bookkeeping. B10 is scoped to exactly what brief §11 asks for: commercial-invoice-adjacent tax evidence, ZATCA readiness, and B8/B9 reconciliation facts — not a rewrite of WazLink into an accounting system.

## 5. Counters (cross-checked against `B10_STORAGE_MODEL.md`/`B10_SCOPE_AND_OWNERSHIP.md`)

`OWNED_ENTITY_COUNT = 7` (`legal_entities`, `tax_profiles`, `tax_buyer_profiles`, `tax_invoices`, `tax_invoice_lines`, `tax_submissions`, `pending_tax_document_classifications` — `B10-FIX.1` adds the seventh). `REFERENCED_ENTITY_COUNT = 8` (§`B10_SCOPE_AND_OWNERSHIP.md` §4, unchanged).
