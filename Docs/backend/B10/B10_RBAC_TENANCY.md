# B10 — RBAC & Tenancy

> Design only. Realizes `B10-D-A016` (§`B10_DECISION_REGISTER.md`). Reuses `tax.view` (already frozen in `B1_AUTHORIZATION_RBAC.md` §2, owner/admin: allow) verbatim; mints three new permissions because no existing permission covers write/management actions on tax configuration.

## 1. Permission set

| Permission | Owner | Admin | Manager/Sales/Member/Viewer | B10 usage |
|---|:--:|:--:|:--:|---|
| `tax.view` (**reused**, frozen) | allow | allow | deny | `GET /tax/profile`, `GET /tax/invoices`, `GET /tax/invoices/{id}`, `GET /tax/buyer-profile`, `GET /tax/pending-classifications` (new, `B10-FIX.1`) |
| `tax.manage` (new) | allow | conditional | deny | `UpdateTaxProfile`, `CancelTaxInvoice`, `CreateCreditNote`, `CreateDebitNote`, `PUT /tax/buyer-profile`, `POST /tax/pending-classifications/resolve` (new, `B10-FIX.1`) |
| `tax.applicability.manage` (new) | allow | **deny** (no conditional grant) | deny | `SetTaxApplicability` only |
| `zatca.manage` (new) | allow | conditional | deny | `ValidateZatcaConfiguration`, operator-invoked `RetryTaxSubmission` |

`REUSED_PERMISSION_COUNT = 1`. `ADDITIVE_PERMISSION_COUNT = 3`.

## 2. Why `tax.applicability.manage` has no Admin `conditional` grant (`B10-D-A016`)

Every other B10/B8 permission follows the frozen matrix's "Admin: conditional on Billing permission and confirmed workspace" pattern. Applicability is deliberately **stricter**: brief §30 requires that "compliance applicability changes should require a high-privilege permission" and that no normal user (nor, by extension, a role one notch below full ownership) may mark an entity ZATCA-exempt merely to sidestep integration work. Owner-only, no conditional path, is the structural enforcement of that requirement — not a policy note asking operators to be careful.

## 3. Role matrix (B10 rows)

| Action | Owner | Admin | Manager | Sales | Member | Viewer | Conditions |
|---|---|---|---|---|---|---|---|
| View tax profile / invoices / buyer profile | allow | allow | deny | deny | deny | deny | `tax.view` |
| Edit tax profile detail / cancel / credit / debit note / edit buyer profile | allow | conditional | deny | deny | deny | deny | `tax.manage`; admin conditional on confirmed workspace, mirroring `billing.manage`'s own condition |
| Change ZATCA applicability | allow | deny | deny | deny | deny | deny | `tax.applicability.manage`, Owner-only |
| ZATCA configuration health check / retry submission | allow | conditional | deny | deny | deny | deny | `zatca.manage` |

No Manager/Sales/Member/Viewer role ever gains tax authority in Phase 1.

## 4. Ordering (frozen pipeline position, unchanged)

Every B10 command passes the frozen 16-step chain (`B1_AUTHORIZATION_RBAC.md` §1) unmodified: authentication → workspace membership → RBAC (step 8) → tenant-scoped resolution (step 9) → object condition (step 10) → entitlement/quota (steps 11–12, not applicable to B10 — tax operations are not gated by B8 plan entitlements) → concurrency (step 13) → idempotency (step 14) → domain invariant (step 15) → allow (step 16).

## 5. Tenancy

`tax_buyer_profiles` and the buyer-side (`workspace_id`) of `tax_invoices` carry `workspace_id NOT NULL` and are resolved workspace-scoped before any other processing (Doctrine R-1/R-2, reused verbatim) — a cross-workspace `TAX-*` reference resolves to `404 ENTITY_NOT_FOUND`, matching the frozen `UpgradeQuote`/`Payment` precedent exactly. `legal_entities` and `tax_profiles` are **global** (no `workspace_id`), consistent with `BACKEND_WORKSPACE_AUTH.md`'s "global catalogs are explicitly global" — identical treatment to B8's Plan Catalog.

## 6. Direct-write firewall

B10's application-service layer (`apps/tax/`) holds no repository/ORM manager reference to `leads`, `deals`, `automation_rules`, `conversations`, `discovery_jobs`, `revenue_events`, `attribution_touchpoints`, `subscriptions`, `payments`, `invoices`, `refunds`, or any table it does not itself own — mirroring `B8_RBAC_TENANCY.md` §5's structural-unreachability proof, extended to B10.

```
CROSS_WORKSPACE_TAX_LEAKS = 0
```
