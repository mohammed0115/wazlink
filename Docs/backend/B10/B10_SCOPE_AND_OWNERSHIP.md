# B10 — Scope & Ownership

> Design only. No Django app, model, or migration is created. Realizes the frozen `Tax` domain row (`BACKEND_DOMAIN_OWNERSHIP.md`: aggregate `TaxInvoice`, tables `tax_invoices, lines, submissions`, writer "tax service", command `SubmitTaxInvoice`, event `TaxSubmitted`, integration ZATCA, forbidden coupling "no payment truth") that B0, B8, and B9 all anticipated by name but none defined.

## 1. Scope statement

B10 is one bounded context, "Tax, Invoicing & ZATCA," realized as a new Django app `apps/tax/`. B10 answers **"is this workspace's commercial activity subject to a statutory tax-invoicing obligation, and if so, what does the compliant document look like"** — it never answers "how much revenue has been recognized" (B9's exclusive authority) and never answers "was this subscription paid for" (B8's exclusive authority). B10 must not assume every WazLink deployment is legally required to integrate with ZATCA; its Phase-1 target configuration is `zatca_applicability = not_applicable` for the current operating entity (§`B10_TAX_APPLICABILITY_MODEL.md`, `B10-X-OWNER-EXEMPTION`), fully dormant, while remaining structurally able to enable the appropriate mode later without re-architecture.

## 2. Sub-module split

| Sub-module | Aggregate root(s) | Authoritative tables | Allowed writers |
|---|---|---|---|
| Legal Entity & Tax Profile | `LegalEntity`, `TaxProfile` | `legal_entities`, `tax_profiles` | Tax admin service (`tax.manage`/`tax.applicability.manage`) |
| Buyer Tax Identity | `TaxBuyerProfile` | `tax_buyer_profiles` | Tax service, workspace-initiated (`tax.manage` or a lower-privilege self-service grant, `B10-D-B006`-adjacent, not designed further in Phase 1) |
| Invoice / Note Domain | `TaxInvoice` (hosts invoice/credit_note/debit_note via `document_kind`, crossed with `invoice_classification`; renamed/split from a single `document_type` under `B10-FIX.1`) | `tax_invoices`, `tax_invoice_lines` | Tax service only, system-triggered (`IssueTaxInvoice`) or operator-triggered (`CreateCreditNote`/`CreateDebitNote`/`CancelTaxInvoice`) |
| ZATCA Submission | (none — child of TaxInvoice) | `tax_submissions` | Tax service, system-triggered only (`SubmitTaxDocumentForProcessing`/`RetryTaxSubmission`) |
| Unknown-Mode Backlog (new, `B10-FIX.1`) | `PendingTaxDocumentClassification` | `pending_tax_document_classifications` | Tax service, system-triggered (`IssueTaxInvoice` creates; scheduled sweep resolves) or operator-triggered (`ResolvePendingTaxClassification`) |

`tax` never writes `subscriptions`/`payments`/`invoices`/`refunds`/`upgrade_quotes` (B8-owned) or `revenue_events`/`revenue_reversals`/`attribution_touchpoints` (B9-owned, future). This is `B10-D-A005`/`A009`/`A010` (§`B10_DECISION_REGISTER.md`).

## 3. Forbidden coupling, restated

B10 never: creates or mutates `revenue_events`/`revenue_reversals`/`attribution_touchpoints` (`B10_B9_FINANCE_BOUNDARY.md`); creates or mutates `subscriptions`/`payments`/`invoices`/`refunds`/`upgrade_quotes` (`B10_B8_BILLING_BOUNDARY.md`); writes to `leads`/`deals`/`automation_rules`/`conversations`/`discovery_jobs` or any domain table it does not own; is triggered automatically by an automation rule outside a governed command it itself exposes; treats a B9 `RevenueEvent` as evidence of a tax obligation or a tax point (`B9_B10_TAX_BOUNDARY.md` §5, restated symmetrically here).

## 4. Referenced Entity Registry

**Definition** (reused verbatim from `B8_DOMAIN_OWNERSHIP.md` §8's precedent): a *referenced entity* is a non-B10-owned, non-B10-writable domain entity that B10's contracts, storage FKs, API surface, event payloads, or permission/boundary semantics directly name or depend on as a read-only reference.

| Entity | Table(s) | Owning domain | How B10 references it (read-only) |
|---|---|---|---|
| Workspace | `workspaces` | B1 | Direct FK: `tax_buyer_profiles.workspace_id`, `tax_invoices.workspace_id` (buyer side) |
| Membership | `memberships` | B1 | Direct FK: `tax_profiles.applicability_set_by`, `tax_invoices.cancelled_by_membership_id`, `tax_submissions` operator fields where applicable |
| Subscription | `subscriptions` | B8 | Not a direct FK; named in `B10_B8_BILLING_BOUNDARY.md` as the aggregate a B8 `Invoice` belongs to |
| Payment | `payments` | B8 | Named in `B10_B8_BILLING_BOUNDARY.md` — read-only correlation evidence during manual credit-note workflows, never a write path |
| Invoice (commercial) | `invoices`, `invoice_lines` | B8 | `tax_invoices.source_ref` polymorphic pointer (`source_type="b8_invoice"`); consumed via the frozen `InvoiceIssued` event |
| Refund | `refunds` | B8 | Named in `B10_B8_BILLING_BOUNDARY.md` §4 as manual-correlation-only evidence — B10 never consumes a refund event because B8's frozen catalog produces none |
| RevenueEvent | `revenue_events` | B9 (future) | Named in `B10_B9_FINANCE_BOUNDARY.md` as read-only reconciliation evidence only, per `B9_B10_TAX_BOUNDARY.md` §4's already-declared surface |
| RevenueReversal | `revenue_reversals` | B9 (future) | Same surface, same document |

`REFERENCED_ENTITY_COUNT = 8`, mechanically counted as the number of distinct rows above, each independently verified to appear as a named reference somewhere in this pack.

## 5. Owned entities (summary; full DDL in `B10_STORAGE_MODEL.md`)

`legal_entities`, `tax_profiles`, `tax_buyer_profiles`, `tax_invoices`, `tax_invoice_lines`, `tax_submissions`, `pending_tax_document_classifications` (new, `B10-FIX.1`, closes `B10-AUDIT-M2`) — seven tables. `OWNED_ENTITY_COUNT = 7`.

## 6. Not a Phase-1 self-service surface

Mirroring `B8-D-B008`'s Plan Catalog precedent: `LegalEntity` authoring (creating the platform's own operating-entity row) is an internal, ops-managed seed process, not a client-facing command, in Phase 1 — there is exactly one row, seeded once. `TaxProfile` versioning (via `UpdateTaxProfile`/`SetTaxApplicability`) **is** a governed, RBAC'd command surface, because applicability changes over time and must be auditable, unlike the one-time entity seed.
