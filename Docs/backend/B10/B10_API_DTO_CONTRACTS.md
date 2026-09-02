# B10 — API & DTO Contracts

> Design only. Base path `/api/v1/`, frozen transport conventions (`BACKEND_API_STANDARD.md`) apply unmodified: `snake_case`, UTC ISO-8601, `MoneyDTO{amount,currency}`, cursor pagination, `Idempotency-Key` header, `version`/`If-Match` for editable resources, closed `ErrorEnvelope`. All operations below are new/additive — B10 reuses zero existing endpoints, since none existed before this pack.

## 1. Endpoints (all new)

| Method | Path | operationId | Permission | Request | Response | Status | Idempotent/async |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/tax/profile` | `getTaxProfile` | `tax.view` | — | `TaxProfileDTO` | 200 | n/a/no |
| PATCH | `/api/v1/tax/profile` | `updateTaxProfile` | `tax.manage` | `TaxProfileUpdate` | `TaxProfileDTO` | 200 | yes/no |
| POST | `/api/v1/tax/applicability` | `setTaxApplicability` | `tax.applicability.manage` | `TaxApplicabilitySet` | `TaxProfileDTO` | 200 | yes/no |
| GET | `/api/v1/tax/invoices` | `listTaxInvoices` | `tax.view` | cursor, filters (`document_kind`, `invoice_classification`, `status`) | `TaxInvoiceList` | 200 | n/a/no |
| GET | `/api/v1/tax/invoices/{id}` | `getTaxInvoice` | `tax.view` | — | `TaxInvoiceDTO` | 200 | n/a/no |
| POST | `/api/v1/tax/invoices/{id}/credit-notes` | `createCreditNote` | `tax.manage` | `TaxNoteCreate` | `201 TaxInvoiceDTO` | 201 | yes/no |
| POST | `/api/v1/tax/invoices/{id}/debit-notes` | `createDebitNote` | `tax.manage` | `TaxNoteCreate` | `201 TaxInvoiceDTO` | 201 | yes/no |
| POST | `/api/v1/tax/invoices/{id}/cancel` | `cancelTaxInvoice` | `tax.manage` | empty | `TaxInvoiceDTO` | 200 | yes/no |
| GET | `/api/v1/tax/zatca-configuration` | `getZatcaConfiguration` | `zatca.manage` | — | `ZatcaConfigurationHealth` | 200 | n/a/no |
| GET | `/api/v1/tax/buyer-profile` | `getTaxBuyerProfile` | `tax.view` | — | `TaxBuyerProfileDTO` (nullable) | 200 | n/a/no |
| PUT | `/api/v1/tax/buyer-profile` | `setTaxBuyerProfile` | `tax.manage` | `TaxBuyerProfileUpdate` | `TaxBuyerProfileDTO` | 200 | yes/no |
| GET | `/api/v1/tax/pending-classifications` | `listPendingTaxClassifications` | `tax.view` | cursor, filters (`status`) | `PendingTaxClassificationList` | 200 | n/a/no |
| POST | `/api/v1/tax/pending-classifications/resolve` | `resolvePendingTaxClassifications` | `tax.manage` | empty (processes all currently-`pending` rows against the current `TaxProfile`) | `202 {accepted_count}` | 202 | yes/async |

`PUBLIC_API_OPERATION_COUNT = 13` (`B10-FIX.1` adds the two backlog operations, closes `B10-AUDIT-M2`'s admin-visibility gap). `ADDITIVE_API_OPERATION_COUNT = 13`. `listTaxInvoices` and `listPendingTaxClassifications` carry `filters`; per `BACKEND_API_CATALOG.md`'s "Explicit filtering and sorting markers" convention, both are recorded as controlled-amendment items (`B10_CONTROLLED_AMENDMENTS.md`), not silently assumed.

## 2. DTOs

**`TaxProfileDTO`**: `legal_entity_ref (internal, not public-ID'd — see B10_PUBLIC_ID_REGISTRY.md), legal_name, country_code, commercial_registration_number (nullable), tax_registration_number (nullable), address, zatca_applicability, applicability_reason, environment (nullable), configured (boolean, derived — never exposes credential_ref), config_version, effective_from`. Required: `zatca_applicability, applicability_reason, config_version, effective_from`.

**`TaxProfileUpdate`**: `legal_name?, commercial_registration_number?, tax_registration_number?, address?`. Explicitly **excludes** `zatca_applicability` — that field is writable only via `TaxApplicabilitySet`, enforcing `B10-D-A016`'s permission split at the DTO layer as well as the RBAC layer (defense in depth: even a `tax.manage` holder cannot smuggle an applicability change through this operation, because the field is not `additionalProperties`-accepted here).

**`TaxApplicabilitySet`**: `zatca_applicability (required, one of the 5 states), reason (required, non-empty string), evidence_ref (optional string)`.

**`TaxInvoiceDTO`**: `public_id (TAX-*), document_kind (renamed from document_type, B10-FIX.1), invoice_classification (new, B10-FIX.1: standard|simplified — read-only, system-derived, never client-settable on any operation), reference_invoice_ref (nullable, TAX-*), source_ref (nullable, INV-BILL-*), workspace_ref, seller{legal_name, tax_registration_number}, buyer{name, tax_registration_number}, subtotal (Money), tax_amount (Money), total (Money), status, zatca_status, legal_sequence_number (nullable), issued_at (nullable), version`. Required: `public_id, document_kind, invoice_classification, workspace_ref, subtotal, tax_amount, total, status, zatca_status, version`.

**`TaxNoteCreate`**: `reason (required, non-empty), lines ([{description, quantity, unit_price, tax_category, tax_rate}], required, min 1)`. `reference_invoice_id` is taken from the path (`{id}`), never a body field — closes the class of bug where a client could reference a different invoice than the URL implies. **`invoice_classification` is deliberately absent from this DTO (`B10-FIX.1`, closes `B10-AUDIT-C1`'s classification-conflict concern structurally)** — the note's classification is always derived server-side from the referenced invoice (§`B10_INVOICE_MODEL.md` §1a), so there is no field through which a client could supply a conflicting value; `AT-B10CLASS-3` asserts this absence directly against the schema.

**`PendingTaxClassificationDTO`** (new, `B10-FIX.1`): `{id (internal UUID — no public ID, admin-only surface), workspace_ref, source_ref (INV-BILL-*), status (pending|resolved_not_applicable|resolved_for_issuance|cancelled), received_at, resolved_tax_invoice_ref (nullable, TAX-*), resolved_at (nullable)}`. **`PendingTaxClassificationList`**: cursor-paginated collection of the above.

**`ZatcaConfigurationHealth`**: `{environment: "sandbox"|"production"|null, configured: boolean, last_verified_at (nullable)}`. No secret value ever appears (§`B10_ZATCA_SECURITY_CREDENTIALS.md`).

**`TaxBuyerProfileDTO`** / **`TaxBuyerProfileUpdate`**: `{company_name?, tax_registration_number?, address?}` — all optional/nullable, matching the frontend's existing optional-VAT-number precedent (`FB-B10-001`).

## 3. Amended DTOs

None. B10 does not amend any B8/B9 frozen DTO — `TaxInvoice.source_ref` is a plain string field on B10's own new DTO, not an addition to `EntitlementDecision`/`Payment`/any other frozen shape.

## 4. Idempotency / expected_version / errors per operation

Every `POST`/`PATCH`/`PUT` above requires `Idempotency-Key`. `updateTaxProfile`, `cancelTaxInvoice` require `expected_version` (body field, matching `BACKEND_API_STANDARD.md`'s explicit-version-field option, identical to B8's precedent) and return `409 STALE_VERSION` on mismatch. `setTaxApplicability` does not use `expected_version` — applicability transitions are append-only new-version-creation, not an edit of a specific row, so there is nothing to stale-check (a concurrent conflicting call instead races the partial unique index, §`B10_IDEMPOTENCY_CONCURRENCY.md` §3). New `code` values used: full list in `B10_ZATCA_FAILURE_RETRY_MODEL.md` §1.

## 5. Tenant behavior

Every workspace-scoped operation resolves its `TaxInvoice`/`TaxBuyerProfile` object under workspace scope before any other processing (Doctrine R-1/R-2); a cross-workspace reference resolves to `404 ENTITY_NOT_FOUND`. `getTaxProfile`/`updateTaxProfile`/`setTaxApplicability`/`getZatcaConfiguration` operate on the single global `LegalEntity`/`TaxProfile` (Phase 1: no `{legal_entity_id}` path parameter needed since exactly one row exists; the schema's own multi-entity extensibility, `B10-D-B005`, would add that parameter later without breaking this shape — an additive path change, not a breaking one). **`listPendingTaxClassifications`/`resolvePendingTaxClassifications` (new, `B10-FIX.1`) are global admin surfaces, not workspace-scoped** — each row's `workspace_id` is informational (which workspace's B8 `Invoice` originated the item), not an access filter, matching the same platform-operator posture already established for `getZatcaConfiguration`; both require `tax.view`/`tax.manage`, held only at Owner/conditional-Admin level, so no ordinary workspace member ever reaches this surface regardless of scoping.
