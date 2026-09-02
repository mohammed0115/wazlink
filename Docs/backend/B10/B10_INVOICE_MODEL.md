# B10 — Invoice Model

> Design only. Realizes the frozen `TaxInvoice` aggregate (`TAX-*`, `tax_invoices`/`tax_invoice_lines` tables) `BACKEND_DOMAIN_OWNERSHIP.md`/`BACKEND_DATA_MODEL.md` already reserved. `B10-D-A004`/`A005`/`A006`/`A017` (§`B10_DECISION_REGISTER.md`).

## 1. `TaxInvoice` — closed shape

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `public_id` | `TAX-*` | frozen prefix, workspace-scoped uniqueness within the buyer's workspace |
| `document_kind` | `invoice` \| `credit_note` \| `debit_note` | closed vocabulary, `B10-D-A004`; renamed from `document_type` under `B10-FIX.1` (§1a) — the document's economic direction/UNCL1001 base type only, never a routing input |
| `invoice_classification` | `standard` \| `simplified` | closed vocabulary, added under `B10-FIX.1` (§1a) — B2B/B2G full-buyer-detail vs. B2C reduced-buyer-detail; the **sole** determinant of ZATCA clearance-vs-reporting routing (§`B10_ZATCA_BOUNDARY.md` §3) |
| `reference_invoice_id` | FK → `tax_invoices`, nullable | **required** when `document_kind ∈ {credit_note, debit_note}`; forbidden (must be null) for `document_kind = invoice` |
| `legal_entity_id` | FK → `legal_entities` | the seller |
| `tax_profile_version_id` | FK → `tax_profiles` | pinned snapshot source, `B10-D-A007` |
| `workspace_id` | FK → `workspaces` | the buyer |
| `source_type` | `"b8_invoice"` (closed, single value in Phase 1) | polymorphic-shaped for future extension, mirrors B9's `RevenueEvent.source_type` convention |
| `source_ref` | `INV-BILL-*` string | the B8 commercial `Invoice` this document evidences; **absent for `credit_note`/`debit_note`**, which instead carry `reference_invoice_id` |
| seller snapshot | `seller_legal_name`, `seller_tax_registration_number` (nullable), `seller_address_*` | copied from `TaxProfile`/`LegalEntity` at issuance, never a live join afterward |
| buyer snapshot | `buyer_name`, `buyer_tax_registration_number` (nullable), `buyer_address_*` (nullable) | copied from `TaxBuyerProfile` at issuance if one exists, else `buyer_name` falls back to the workspace's display name and the rest stay null |
| `subtotal` / `tax_amount` / `total` | `NUMERIC(19,4)` + `currency` | §`B10_CURRENCY_MONEY_ROUNDING.md` |
| `status` | `draft` \| `issued` \| `cancelled` \| `credited` | business lifecycle, §`B10_INVOICE_STATE_MACHINE.md` §1 |
| `zatca_status` | `not_applicable` \| `pending` \| `submitted` \| `accepted` \| `rejected` | transport lifecycle, §`B10_INVOICE_STATE_MACHINE.md` §2; always `not_applicable` while the issuing `TaxProfile` version was `applicable_not_enabled` or the applicability itself was `not_applicable`-adjacent at generation-only posture |
| `legal_sequence_number` | integer, nullable | `B10-D-A017`; assigned only under `applicable_*`/`enabled`, monotonic per `(legal_entity_id, environment)`, immutable once assigned |
| `issued_at` | UTC timestamp, nullable | null while `status=draft` |
| `cancelled_at` | UTC timestamp, nullable | |
| `version` | integer | optimistic concurrency, ADR-010 pattern |
| `created_at` | UTC timestamp | |

## 1a. `invoice_classification` derivation and immutability (`B10-FIX.1`, closes `B10-AUDIT-C1`)

`invoice_classification` is set exactly once, at row creation, and is then as immutable as every other content field (`B10-D-A006`):

| `document_kind` | How `invoice_classification` is set | Client input accepted? |
|---|---|---|
| `invoice` | Chosen by `IssueTaxInvoice` at generation time: `standard` if the buyer `Workspace` has a `TaxBuyerProfile` with a non-null `tax_registration_number` (a real B2B/VAT-registered counterparty); `simplified` otherwise (matches real Simplified Tax Invoice practice — reduced buyer detail is the norm, not an error, `B10-X-003`) | No — system-derived only, no operator/API input exists for this at issuance |
| `credit_note` | **Pinned, at creation, to the `invoice_classification` of the row `reference_invoice_id` points at.** Never independently chosen | No — `TaxNoteCreate` (§`B10_API_DTO_CONTRACTS.md` §2) carries no `invoice_classification` field at all; the value is computed server-side from the reference and is not client-suppliable |
| `debit_note` | Identical rule to `credit_note` | No — identical to `credit_note` |

**Negative control (`AT-B10CLASS-3`, §`B10_ACCEPTANCE_TESTS.md`):** because the DTO exposes no `invoice_classification` input for `CreateCreditNote`/`CreateDebitNote`, there is no code path through which a client could supply a conflicting value — the prior audit's concern ("a client-supplied note classification conflicting with original invoice") is closed structurally (no field to conflict through), and the acceptance test asserts exactly this absence rather than merely asserting a runtime rejection.

## 2. `TaxInvoiceLine`

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `tax_invoice_id` | FK → `tax_invoices` | |
| `description` | string | |
| `quantity` | integer, default 1 | Phase-1 WazLink lines are always quantity 1 (one subscription period); modeled as an integer for correctness, not because Phase 1 needs multi-quantity |
| `unit_price` | `NUMERIC(19,4)` | |
| `line_subtotal` | `NUMERIC(19,4)` | `quantity * unit_price` |
| `tax_category` | `standard` \| `zero_rated` \| `exempt` \| `out_of_scope` | §`B10_TAX_CALCULATION_MODEL.md` §2 |
| `tax_rate` | `NUMERIC(5,4)`, nullable | null for `exempt`/`out_of_scope` |
| `tax_amount` | `NUMERIC(19,4)` | **Corrected under `B10-FIX.1`: an informational, per-line display allocation only** (`line_subtotal * tax_rate` at full precision) — `0` for `exempt`/`out_of_scope`, `0` for a genuinely `zero_rated` line (distinguished from the two above only by `tax_category`, never conflated per `B10_TAX_CALCULATION_MODEL.md` §7). **Never summed to produce `tax_invoices.tax_amount`** — the document-level figure is independently computed at the VAT-category-subtotal level (§`B10_CURRENCY_MONEY_ROUNDING.md` §3) |
| `line_total` | `NUMERIC(19,4)` | `line_subtotal + tax_amount` — an informational per-line total using this row's own display allocation, not a component summed into `tax_invoices.total` |

## 3. `legal_sequence_number` — a WazLink product/legal numbering field, **not** the ZATCA ICV (`B10-D-A017`, corrected under `B10-FIX.1`)

**`B10-FIX.1` correction.** The prior revision of this section implied `legal_sequence_number` *is* ZATCA's Invoice Counter Value (ICV). Re-research (`B10-X-009` re-verified, `B10-X-015` added, `B10_RESEARCH_REGISTER.md`) confirms this is not a safe equivalence: ZATCA's ICV/PIH hash-chain is scoped **per Electronic Generation Solution (EGS) unit / production-CSID-bearing device or server** — a device onboarded independently receives its own CSID and its own ICV sequence starting at 1, and a sequence break is repaired by re-issuing at `last-accepted-ICV + 1`, not by any legal-entity-wide counter. B10 does not yet model an EGS-unit/production-CSID aggregate — Phase 1 has no concept of "how many signing units does this `LegalEntity` operate" — so asserting `legal_sequence_number`'s scope as the *same* counter ZATCA will validate would freeze an unverified (and plausibly wrong) assumption the moment a real EGS unit is onboarded.

Two distinct fields are therefore recorded, deliberately not conflated:

| Field | Scope | Purpose | Status |
|---|---|---|---|
| `legal_sequence_number` (this table) | monotonic integer per `(legal_entity_id, environment)` | WazLink's own product/legal document-sequence field — human-readable evidence of issuance order, useful for reconciliation and any Phase-1 (`not_applicable`/`applicable_not_enabled`) audit need, independent of whether or how ZATCA is ever integrated | Phase-1 architecture decided now: a durable, per-`(legal_entity_id, environment)` monotonic counter, enforced by a DB sequence or an equivalent serializable-allocation pattern, never a client-suppliable value |
| `zatca_invoice_counter_value` / ICV | per-EGS-unit (device/signing-server), **not yet modeled** | the actual value ZATCA's Phase-2 clearance/reporting API validates and hash-chains via PIH | **not designed in B10** — deferred to the future EGS-unit/production-CSID design that must exist before any `enabled`-path implementation; explicitly gated behind `B10-D-B001` together with the rest of the wire-level submission mechanics |

`legal_sequence_number` remains distinct from `public_id` (`TAX-*`, opaque, WazLink-internal, always present) and is assigned only at the instant a document is issued under an `applicable_not_enabled`/`enabled` `TaxProfile`, never reused, never assigned under `not_applicable`/`unknown`. **It must not be presented to, or accepted by, ZATCA as the ICV** once the `enabled` path is designed — that mapping (one WazLink EGS unit ⇒ one `legal_sequence_number` sequence, or some other correspondence) is exactly the kind of decision the not-yet-designed EGS-unit aggregate must make, and is recorded here as an explicit open question rather than a false equivalence.

## 4. Generation trigger and applicability gate

`IssueTaxInvoice` (system-actor, consumes B8's frozen `InvoiceIssued` event) behaves per the current `TaxProfile.zatca_applicability`:

| Applicability | Behavior |
|---|---|
| `unknown` | Deferred to the pending-classification backlog (`B10_TAX_APPLICABILITY_MODEL.md` §3); no row created yet |
| `not_applicable` | **No `TaxInvoice` row is ever created.** The B8 `Invoice` alone remains the customer's document |
| `applicable_not_enabled` | A `TaxInvoice` row **is** created and stored (`status=issued`, `zatca_status=not_applicable`-meaning-"not yet transmitted") — satisfies the real ZATCA Phase-1 "generate and store" posture (`B10-X-001`) without any network call |
| `enabled` | Created, stored, and handed to `SubmitTaxDocumentForProcessing` in the same logical workflow (§`B10_ZATCA_BOUNDARY.md`) |
| `suspended` | Created and stored identically to `applicable_not_enabled` (generation never stops); submission is queued for retry once un-suspended (§`B10_ZATCA_FAILURE_RETRY_MODEL.md`) |

## 5. What B10's `Invoice` model explicitly is not

Not a general ledger. Not an accounts-receivable aging report. Not a replacement for B8's own commercial `Invoice`, which remains the customer-facing billing document regardless of `TaxInvoice`'s existence (§`B10_B8_BILLING_BOUNDARY.md`).
