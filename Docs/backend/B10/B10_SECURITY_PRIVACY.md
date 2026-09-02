# B10 — Security & Privacy

> Design only. Adopts the frozen data-classification table (`BACKEND_PRIVACY_AND_DATA_HANDLING.md`) verbatim; applies it to B10's specific tables. Credential-specific detail lives in `B10_ZATCA_SECURITY_CREDENTIALS.md`, not repeated here.

## 1. Classification

| B10 data | Frozen class | Handling |
|---|---|---|
| `tax_invoices`/`tax_invoice_lines` (seller/buyer identity, amounts, tax detail) | Financial / Tax (`BACKEND_PRIVACY_AND_DATA_HANDLING.md`: "Tax \| VAT, TaxInvoice, ZATCA submissions \| regulatory retention; official validation required") | strict `tax.view`/`tax.manage` permission; immutable once issued (`B10-D-A006`) |
| `tax_submissions` | Financial / Tax | same; append-only |
| `pending_tax_document_classifications` (new, `B10-FIX.1`) | Financial / Tax | same permission surface (`tax.view`/`tax.manage`); carries only `source_ref`/`workspace_id`/timestamps — no card, no personal PII, no ZATCA payload |
| `legal_entities`/`tax_profiles` | Operational/Financial (configuration, not customer PII) | `tax.view`/`tax.manage`/`tax.applicability.manage` per §`B10_RBAC_TENANCY.md` |
| `tax_buyer_profiles` | Financial (workspace-supplied commercial identity, not personal PII — a company name/VAT number, not an individual's data) | `tax.view`/`tax.manage`; workspace-scoped |
| `tax_profiles.credential_ref` | Secret-adjacent (opaque pointer only) | never returned by any API, never logged (§`B10_ZATCA_SECURITY_CREDENTIALS.md`) |

## 2. What B10 never stores

No card/payment-instrument data (B10 never touches that surface — B8's exclusive domain). No individual customer PII beyond what a workspace voluntarily supplies as its own **company's** tax identity (`tax_buyer_profiles`) — no personal names, no personal ID numbers, no biometric or health data of any kind.

## 3. Retention

Proposed starting point, consistent with `BACKEND_PRIVACY_AND_DATA_HANDLING.md`'s "Default retention must be a product/legal decision": `tax_invoices`/`tax_invoice_lines`/`tax_submissions` — policy-defined, longer retention, never auto-deleted absent legal/product sign-off (`B10-D-B004`, unresolved, matches `ADR-012`'s and `B8-D-B009`'s identical precedent). On `WorkspaceDeletionRequested` (consumed by B1/B8 already; B10 is not itself a direct consumer of workspace lifecycle events, §`B10_COMMAND_EVENT_CATALOG.md` §3), any `TaxInvoice` referencing the deleted workspace is anonymized on the buyer side rather than hard-deleted where legal retention applies — a statutory tax document is never silently erased merely because the underlying workspace account closes.

## 4. Safe logging and redaction

No B10 log statement includes `credential_ref`'s resolved value, a full ZATCA raw payload, or a card-shaped value. Structured logs reference `TaxInvoice.public_id`/`status`/`zatca_status` and decimal amounts only.

## 5. No legal compliance claim

Consistent with every prior phase's disclaimer (B3/B4/B5/B8's external-validation registers): no document in this pack makes a legal-compliance claim about Saudi tax law, ZATCA/FATOORA requirements, VAT treatment, or the current operating entity's actual regulatory status. `B10-X-OWNER-EXEMPTION` (§`B10_RESEARCH_REGISTER.md`) records the current business-supplied applicability determination as exactly that — business-supplied, not independently verified — and every document in this pack treats it accordingly.

```
UNVERIFIED_LEGAL_CLAIMS = 0
```
