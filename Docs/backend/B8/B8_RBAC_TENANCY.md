# B8 — RBAC & Tenancy

> Design only. Zero new permissions — full reuse of frozen `B1_AUTHORIZATION_RBAC.md`.

## 1. Permission reuse (zero additions)

| Permission | Frozen role matrix (owner/admin/manager/sales/member/viewer) | B8 usage |
|---|---|---|
| `billing.view` | A/A/·/·/·/· | `GET /billing/subscription`, `GET /plans`, `GET /entitlements`, `GET /usage`, `GET /billing/invoices`, `GET /billing/operations` |
| `billing.manage` | A/C/·/·/·/· | `GrantEntitlementOverride`, `RevokeEntitlementOverride`, provider-configuration health checks (§`B8_ADMIN_PROVIDER_CONFIGURATION` in this document §6) |
| `subscription.change` | A/C/·/·/·/· | `CreateUpgradeQuote`, `CreatePayment`, `CancelSubscription`, `ReactivateSubscription`, `ScheduleDowngrade` |
| `payment.manage` | A/C/·/·/·/· | admin-invoked `ReconcilePayment`, refund initiation, Tap provider connection/configuration (`B8-D-A016`, §6) |

`B8-D-A015`: **zero new permissions are minted.** The brief's §26 named `billing.view`, `billing.manage`, and `provider.manage` only as *illustrative candidates* ("These are examples only. Do not automatically create them.") — it never claimed all three were already frozen. Of those three, `billing.view` and `billing.manage` genuinely already exist verbatim in frozen `B1_AUTHORIZATION_RBAC.md`; `provider.manage` does **not** exist there at all (confirmed by direct inspection — no such code appears anywhere in that file's permission catalog or role matrix). B8 does not need it: `B8-D-A016` establishes that Phase 1 requires **no** `provider.manage`-shaped permission for Tap-provider-sensitive billing management, because `payment.manage`'s existing conditional scope ("provider flow; no raw card data," `BACKEND_AUTHORIZATION_MATRIX.md`) already covers connecting/reconfiguring the Tap account — no separate `billing.provider.manage` or `provider.manage` is created, following the exact discipline `B6_ENTITLEMENT_RBAC_TENANCY.md` states ("no competing name is minted for authority an existing permission already grants"). The net result — zero new permissions — is unchanged; only the earlier sentence's inaccurate premise (that `provider.manage` "already exists") is corrected (`B8-FIX.1`).

## 2. Role matrix (B8 rows, reused verbatim from frozen `BACKEND_AUTHORIZATION_MATRIX.md`)

| Action | Owner | Admin | Manager | Sales | Member | Viewer | Conditions |
|---|---|---|---|---|---|---|---|
| View billing/subscription/usage/invoices | allow | allow | deny | deny | deny | deny | `billing.view` |
| Change plan (upgrade/downgrade/cancel/reactivate) | allow | conditional | deny | deny | deny | deny | `subscription.change`; admin conditional on Billing permission and confirmed workspace |
| Manage payment / provider connection | allow | conditional | deny | deny | deny | deny | `payment.manage`; provider flow; no raw card data |
| Grant/revoke entitlement override | allow | conditional | deny | deny | deny | deny | `billing.manage` |

No Manager/Sales/Member/Viewer role ever gains billing authority in Phase 1 — matching the frozen matrix exactly, with zero B8-invented widening.

## 3. Ordering (frozen pipeline position, unchanged)

Every B8 command passes the frozen 16-step chain (`B1_AUTHORIZATION_RBAC.md` §1) unmodified: authentication → workspace membership → RBAC (step 8) → tenant-scoped resolution (step 9) → object condition (step 10) → **Entitlement** (step 11) → **Quota** (step 12) → concurrency (step 13) → idempotency (step 14) → domain invariant (step 15) → allow (step 16). A caller who lacks `subscription.change` never learns whether the workspace's quota is exhausted — RBAC deny always wins, per the frozen rationale ("A caller who may not perform the action at all must never learn the workspace's plan or usage").

## 4. Step-up re-authentication (`B8-D-B004` — re-deferred, still open)

`B1_DECISION_REGISTER.md` `B1-D-005` named billing changes among the actions that might require step-up re-authentication and left it unresolved. B8 does not resolve it either — Phase 1 ships session-authentication-only for every billing command (no additional re-auth step), consistent with `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-009's Phase-1 scope. This is recorded as a still-open Class B item, not silently closed, because closing it would require a security-policy decision outside this phase's charter.

## 5. Tenancy and direct-write firewall

Every B8-owned table carries `workspace_id NOT NULL` except the global Plan Catalog rows (`plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas` — intentionally global, consistent with `BACKEND_WORKSPACE_AUTH.md`'s "global catalogs such as Plans and Capabilities are explicitly global"). Every workspace-scoped query is authorized by workspace membership before object resolution (Doctrine R-1/R-2, reused verbatim) — an `UpgradeQuote`/`Payment`/`Subscription` belonging to another workspace resolves to `404 ENTITY_NOT_FOUND`, never a distinguishable "exists elsewhere" signal (frozen, restated in `BACKEND_ERROR_CATALOG.md`).

**B8's own direct-write firewall** (mirroring `B7_DIRECT_WRITE_FIREWALL.md`'s structural-unreachability proof, extended to B8): B8's application-service layer (`entitlements`/`billing` Django apps) holds no repository/ORM manager reference to `leads`, `deals`, `automation_rules`, `conversations`, `discovery_jobs`, `revenue_events`, `attribution_touchpoints`, `tax_invoices`, or any table it does not itself own (§`B8_DOMAIN_OWNERSHIP.md` §2). Every other domain's write into a B8-owned table happens only through a B8-governed command (`entitlements` app holds the only write path to `subscriptions`' *reader* role, never a writer role; no other domain ever writes `subscriptions`/`upgrade_quotes`/`payments`/`invoices` directly).

## 6. Admin provider configuration (design-only, no secrets)

`billing.manage` (grant/revoke overrides, health-check) and `payment.manage` (provider connection) jointly gate the future admin flow: Credentials → Configuration Check → Connected → Enable Provider (brief §28). B8 designs only the read side: `ValidateProviderConfiguration` (new, read-only command) checks that required secret classes exist in environment/secret management (never reads their values into a domain table) and returns `{provider: "tap", environment: "test"|"live", configured: boolean, last_verified_at, safe_public_metadata: {}}`. No secret value ever appears in this response, a log, or an audit record (`BACKEND_SECURITY_ARCHITECTURE.md`). Actually writing/rotating a secret is infrastructure/ops tooling outside B8's own tables — B8 stores only the boolean/timestamp health projection, never the credential.
