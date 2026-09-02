# B10 — Public ID Registry

> Design only. Realizes brief §35: read the frozen registry before assuming any prefix is free.

## 1. Frozen prefix reused verbatim

`BACKEND_PUBLIC_ID_REGISTRY.md` already reserves `TAX-` → `TaxInvoice`, Tax domain, workspace-scoped. B10 reuses this prefix, unmodified, for **all `document_kind` values** (`invoice`, `credit_note`, `debit_note`, renamed from `document_type` under `B10-FIX.1`) crossed with either `invoice_classification` — a credit note is still a `TaxInvoice` row (`B10-D-A004`), so it still gets a `TAX-*` public_id, never a separate `CRN-*`/`DBN-*` prefix, and classification is never reflected in the prefix either.

## 2. Zero new public-ID prefixes minted

| Candidate entity | Public ID? | Reason |
|---|---|---|
| `LegalEntity` | No | Internal, ops-managed singleton in Phase 1 (§`B10_SCOPE_AND_OWNERSHIP.md` §6); not independently addressable by any client-facing operation; mirrors `PlanVersion`'s "internal child entities should not automatically receive public IDs" precedent |
| `TaxProfile` | No | Versioned child of `LegalEntity`; addressed only via its parent |
| `TaxBuyerProfile` | No | One-per-workspace preference object, addressed via `workspace_id`, never independently referenced elsewhere |
| `TaxSubmission` | No | Append-only child of `TaxInvoice`, addressed only as a child list under a `TAX-*` document, identical treatment to B8's `payment_attempts` |
| `PendingTaxDocumentClassification` (new, `B10-FIX.1`) | No | Internal, admin-only surface (`GET /tax/pending-classifications`); never workspace-facing, never referenced by a client outside the Owner/Admin tax-administration surface |

## 3. What required no amendment

`BACKEND_PUBLIC_ID_REGISTRY.md`'s existing `TAX-` row already anticipated exactly this usage — no amendment to the registry itself is required, only the controlled-amendment items in `B10_CONTROLLED_AMENDMENTS.md` for the *new tables* the registry's own table-group section did not yet detail.
