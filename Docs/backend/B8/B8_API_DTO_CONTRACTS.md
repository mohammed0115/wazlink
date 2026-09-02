# B8 — API & DTO Contracts

> Design only. Base path `/api/v1/`, frozen transport conventions (`BACKEND_API_STANDARD.md`) apply unmodified: `snake_case`, UTC ISO-8601, `MoneyDTO{amount,currency}`, cursor pagination, `Idempotency-Key` header, `version`/`If-Match` for editable resources, closed `ErrorEnvelope`.

## 1. Endpoints reused verbatim (frozen, unchanged)

| Method | Path | operationId | Permission | Request | Response | Idempotent/async |
|---|---|---|---|---|---|---|
| GET | `/api/v1/plans` | `listPlans` | authenticated | — | `PlanList` | n/a/no |
| GET | `/api/v1/entitlements` | `getEntitlements` | authenticated | — | `EntitlementList` | n/a/no |
| GET | `/api/v1/usage` | (frozen, unnamed op) | `billing.view` | — | `UsageDTO` list | n/a/no |
| POST | `/api/v1/billing/upgrade-quotes` | `createUpgradeQuote` | `subscription.change` | `QuoteRequest` | `201 UpgradeQuote` | yes/no |
| POST | `/api/v1/billing/payments` | `createPayment` | `subscription.change` | `PaymentCreate` | `202 Payment` | yes/yes |
| GET | `/api/v1/billing/invoices` | `listInvoices` | `billing.view` | cursor/filters/sort | `InvoiceList` | n/a/no |

## 2. New endpoints (additive)

| Method | Path | operationId | Permission | Request | Response | Status | Idempotent/async |
|---|---|---|---|---|---|---|---|
| GET | `/api/v1/billing/subscription` | `getCurrentSubscription` | `billing.view` | optional `?capability=` (deep-link context — `Billing.tsx:52` reads only this parameter to render the upgrade-context banner, `B8-FIX.1`-corrected evidence in `B8_FRONTEND_BEHAVIOR_INVENTORY.md` §4) | `SubscriptionDTO` | 200 | n/a/no |
| GET | `/api/v1/billing/subscription/downgrade-preview` | `previewDowngrade` | `billing.view` | `plan_ref` (query) | `DowngradePreviewDTO` | 200 | n/a/no |
| POST | `/api/v1/billing/subscription/cancel` | `cancelSubscription` | `subscription.change` | empty | `SubscriptionDTO` | 200 | yes/no |
| POST | `/api/v1/billing/subscription/reactivate` | `reactivateSubscription` | `subscription.change` | empty | `SubscriptionDTO` | 200 | yes/no |
| POST | `/api/v1/billing/subscription/downgrade` | `scheduleDowngrade` | `subscription.change` | `{plan_ref}` (null clears a pending downgrade) | `SubscriptionDTO` | 200 | yes/no |
| GET | `/api/v1/billing/operations` | `listBillingOperations` | `billing.view` | cursor | `BillingOperationList` (Payments + UpgradeQuotes, unified pending/recent view) | 200 | n/a/no |
| POST | `/api/v1/billing/entitlement-overrides` | `grantEntitlementOverride` | `billing.manage` | `EntitlementOverrideCreate` | `201 EntitlementOverride` | 201 | yes/no |
| DELETE | `/api/v1/billing/entitlement-overrides/{id}` | `revokeEntitlementOverride` | `billing.manage` | — | `204` | 204 | yes/no |
| GET | `/api/v1/billing/provider-configuration` | `getProviderConfiguration` | `billing.manage` | — | `ProviderConfigurationHealth` | 200 | n/a/no |
| POST | `/webhooks/tap` | (internal gateway route, not user-facing catalog) | none — Webhooks-domain signature verification | raw Tap payload | `2xx` ack | — | n/a — Webhooks-domain owned, out of B8's own catalog per `BACKEND_API_CATALOG.md`'s "Provider webhooks are internal gateway routes and are not user-facing resource mutations" |

`POST /billing/payments`'s existing catalog marker for filtering/sorting is unchanged (none — only `deals`/`billing/invoices` carry `filters`/`sort`, per frozen `BACKEND_API_CATALOG.md` §"Explicit filtering and sorting markers"); the new endpoints above add none either.

## 3. New DTOs

**`SubscriptionDTO`**: `public_id (SUB-*), status, plan_ref (EntityRef), pending_plan_ref (EntityRef, nullable), current_period_start, current_period_end, trial_end (nullable), cancel_at_period_end, version`. Required: `public_id, status, plan_ref, current_period_start, current_period_end, cancel_at_period_end, version`.

**`DowngradePreviewDTO`**: `target_plan_ref (EntityRef), effective_at (timestamp), downgrade_warning (string, nullable), differences ([{metric: string, current_limit: integer|null, target_limit: integer|null, current_usage: integer, over: boolean}])`. Closes `FB-B8-025`/`FB-B8-026`.

**`BillingOperationList`**: `items: [{public_id, kind: "quote"|"payment", status, amount (Money), created_at}], page_info (PageInfo)`.

**`EntitlementOverrideCreate`**: `code (string), override_type ("grant_capability"|"extend_quota"), value (boolean|integer, nullable for unlimited), reason (string), expires_at (timestamp, nullable)`. Required: `code, override_type, reason`. `value` is validated per `B8_ENTITLEMENT_MODEL.md` §5c at creation time — `grant_capability` requires `value=true`; `extend_quota`'s `value` is stored as an **absolute limit number** (never an additive delta) and must strictly exceed the plan's current limit at grant time or be `null` (unlimited), or the request is rejected `422 ENTITLEMENT_OVERRIDE_INVALID`. At *resolution* time (not creation time), this stored value is combined with the workspace's then-current base limit via `MAX(current_base_limit, value)` — never applied unconditionally — so a later plan upgrade past this value is reflected immediately without requiring the override row to change (`B8_ENTITLEMENT_MODEL.md` §5b/§5b-i, `B8-D-A022`). If an `active` override already exists for `(code)` in this workspace, a successful call transactionally revokes it and creates the new one (`B8-D-A021`) — the response always reflects the single resulting `active` row, never two.

**`EntitlementOverride`** (response): adds `public_id`-free internal `id` only — not independently public-ID'd (`B8_DOMAIN_OWNERSHIP.md`, `B8-D-A014`'s companion), addressed by opaque internal id within the workspace scope; `status ("active"|"revoked"|"expired"), granted_by (EntityRef to Membership), granted_at, revoked_at (nullable), revoked_by (EntityRef to Membership, nullable)`.

**`ProviderConfigurationHealth`**: `{provider: "tap", environment: "test"|"live", configured: boolean, last_verified_at (timestamp, nullable)}`. No secret value ever appears (§`B8_RBAC_TENANCY.md` §6).

## 4. Amended DTOs (additive fields only, `B8-D-A005`)

`EntitlementDecision` gains `reset_at (timestamp, nullable), source (string, nullable), reason (string, nullable)` — all optional, all nullable, no existing required field changed. `UsageDTO` gains `reset_at (timestamp, nullable)`.

## 5. Idempotency / expected_version / errors per new operation

Every `POST`/`DELETE` above requires `Idempotency-Key`. `cancelSubscription`, `reactivateSubscription`, `scheduleDowngrade` require the current `Subscription.version` (body field `expected_version`, following the same "explicit version field" option `BACKEND_API_STANDARD.md` allows alongside `If-Match`) and return `409 STALE_VERSION` on mismatch. Every operation inherits the closed error envelope; new `code` values used here are `PLAN_RETIRED`, `SUBSCRIPTION_TRANSITION_INVALID`, `DOWNGRADE_BLOCKED`, `RECONCILIATION_MISMATCH`, `PROVIDER_CONFIGURATION_INVALID`, `ENTITLEMENT_OVERRIDE_INVALID` — full mapping in `B8_FAILURE_CATALOG.md`.

## 6. Tenant behavior

Every new endpoint resolves its `Subscription`/`EntitlementOverride`/`Payment`/`UpgradeQuote` object under workspace scope before any other processing (Doctrine R-1/R-2, reused verbatim); a cross-workspace reference resolves to `404 ENTITY_NOT_FOUND`, matching the frozen UpgradeQuote precedent exactly.

## 7. Side effects summary

| Operation | Side effects |
|---|---|
| `cancelSubscription` | sets `cancel_at_period_end`; emits `SubscriptionCancelled`; audit row |
| `reactivateSubscription` | clears `cancel_at_period_end`; emits `SubscriptionReactivated`; audit row |
| `scheduleDowngrade` | sets/clears `pending_plan_version_id`; emits `SubscriptionDowngradeScheduled`; audit row |
| `grantEntitlementOverride` | creates override row; emits `EntitlementOverrideGranted`; audit row |
| `revokeEntitlementOverride` | sets `revoked_at`; emits `EntitlementOverrideRevoked`; audit row |
| `getProviderConfiguration` | none — pure read |
| `previewDowngrade` | none — pure read |
