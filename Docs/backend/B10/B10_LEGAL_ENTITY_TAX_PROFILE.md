# B10 — Legal Entity & Tax Profile

> Design only. Realizes `B10-D-A001` and `B10-D-A007` (§`B10_DECISION_REGISTER.md`).

## 1. `LegalEntity` — the seller identity

A `LegalEntity` represents one operating entity capable of selling WazLink subscriptions and bearing a tax obligation for that revenue. Phase 1 seeds **exactly one row** (the current WazLink operating entity), ops-managed (§`B10_SCOPE_AND_OWNERSHIP.md` §6), with the schema left open for more.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal; no public ID (§`B10_PUBLIC_ID_REGISTRY.md` — not independently addressable in Phase 1) |
| `legal_name` | string | as registered |
| `country_code` | ISO-3166 alpha-2 | ops-entered |
| `commercial_registration_number` | string, nullable | CR number where applicable |
| `tax_registration_number` | string, nullable | VAT/TRN; null until VAT-registered |
| `address` | typed sub-fields (street, city, postal_code, country_code) | no JSONB (per `BACKEND_DATA_GOVERNANCE.md`'s core-relationship/state prohibition, reused verbatim from B8's identical discipline) |
| `status` | `active` \| `superseded` | superseded only if the entity itself is replaced (Class C, `B10-D-C004`) |
| `created_at` / `updated_at` | UTC timestamps | |

## 2. `TaxProfile` — the versioned applicability + configuration record

One `TaxProfile` row per effective period per `LegalEntity`. At most one row per `LegalEntity` has `effective_to IS NULL` (partial unique index, identical pattern to `B8_PLAN_CATALOG.md` §5's `PlanVersion`). Publishing a new profile (via `UpdateTaxProfile`/`SetTaxApplicability`) closes the prior row's `effective_to` and inserts a new one in the same transaction — never a bare mutation of the existing row's `zatca_applicability`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `legal_entity_id` | FK → `legal_entities` | |
| `zatca_applicability` | `unknown` \| `not_applicable` \| `applicable_not_enabled` \| `enabled` \| `suspended` | default `unknown` at first bootstrap row; see `B10_TAX_APPLICABILITY_MODEL.md` for the full state machine |
| `applicability_reason` | string, required whenever `zatca_applicability != unknown` | e.g. "below mandatory VAT registration threshold per business-supplied assessment" |
| `applicability_evidence_ref` | string, nullable | pointer/URL to supporting evidence (e.g. a recorded `B10-X-OWNER-EXEMPTION` note); never a legal certification by WazLink itself |
| `applicability_set_by` | FK → `memberships`, nullable | null only for the system-seeded initial `unknown` row |
| `applicability_set_at` | UTC timestamp, nullable | |
| `credential_ref` | opaque string, nullable | pointer into environment/secret management (§`B10_ZATCA_SECURITY_CREDENTIALS.md`) — never a secret value itself |
| `environment` | `sandbox` \| `production`, nullable | null while `zatca_applicability ∈ {unknown, not_applicable}` |
| `config_version` | integer, monotonic per `legal_entity_id` | |
| `effective_from` | UTC timestamp | |
| `effective_to` | UTC timestamp, nullable | null = currently in force |
| `created_at` | UTC timestamp | |

## 3. Why every `TaxInvoice` pins a `tax_profile_version_id`

`B10-D-A007`. Every issued `TaxInvoice` copies the seller's `legal_name`/`tax_registration_number`/`address` from the `TaxProfile` version current **at the moment of issuance**, as typed columns on the invoice row itself (§`B10_STORAGE_MODEL.md`) — never a live join re-read later. This is why a subsequent applicability or profile-detail change can never alter what an already-issued document says (`B10-D-A006`/`A008`).

## 4. `TaxBuyerProfile` — optional workspace-supplied buyer identity

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `workspace_id` | FK → `workspaces`, unique | one per workspace |
| `company_name` | string, nullable | |
| `tax_registration_number` | string, nullable | the workspace's own VAT number, if any — closes the frontend gap at `FB-B10-001` (§`B10_FRONTEND_BEHAVIOR_INVENTORY.md`) |
| `address` | typed sub-fields, nullable | |
| `updated_at` | UTC timestamp | |

Absence of a `TaxBuyerProfile` is not an error — a `TaxInvoice`'s buyer section is populated from whatever is known (workspace display name only) with tax-identity fields left blank, which is a legitimate, real ZATCA posture (a Simplified Tax Invoice does not mandate full buyer VAT detail, `B10-X-003`).

## 5. Verification status

`LegalEntity`/`TaxProfile` fields are **business-supplied configuration**, not independently verified legal fact (§`B10_RESEARCH_REGISTER.md` `B10-X-OWNER-EXEMPTION`). No B10 document or API response asserts that WazLink has confirmed a `LegalEntity`'s VAT-registration or exemption status with ZATCA or any government authority — it records who made the applicability determination, when, and on what stated reason, and nothing more.
