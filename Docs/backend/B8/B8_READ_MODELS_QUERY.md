# B8 — Read Models & Query

> Design only. Every read model listed is a direct projection of B8's own canonical tables — never a second source of truth (mirrors `BACKEND_ANALYTICS_SEMANTICS.md`'s "Analytics is read-only" doctrine).

## 1. Read models

| Read model | Endpoint | Composition |
|---|---|---|
| Current plan + subscription state | `GET /billing/subscription` | `Subscription` joined to its committed `PlanVersion`/`Plan` |
| Plan catalog | `GET /plans` (frozen) | `Plan` joined to its current `PlanVersion` + capability/quota rows |
| Entitlements | `GET /entitlements` (frozen) | `B8_ENTITLEMENT_MODEL.md` resolution algorithm, one row per capability |
| Usage | `GET /usage` (frozen) | resolution algorithm, one row per metric |
| Upgrade options | derived client-side from `GET /plans` + `GET /entitlements`'s `target_plan_ref` — no dedicated endpoint (matches frozen frontend's own `upgradeProjection` client-side composition, `FB-B8-013`) | — |
| Pending commercial operation | `GET /billing/operations` | unified `UpgradeQuote`+`Payment` recent/pending list |
| Payment/checkout status | `GET /billing/operations` (same) or the `Payment` returned synchronously from `CreatePayment`'s `202` | — |
| Downgrade impact preview | `GET /billing/subscription/downgrade-preview` | live comparison of current usage against a candidate plan's limits |
| Invoices | `GET /billing/invoices` (frozen) | `Invoice`/`InvoiceLine` |
| Provider configuration health | `GET /billing/provider-configuration` | `ProviderConfigurationHealth` projection, no secret values |

## 2. No caching

Every read model above is computed at request time from PostgreSQL — no Redis-cached projection, no materialized view refreshed out-of-band, consistent with `B8_ENTITLEMENT_MODEL.md` §7's unproven-invalidation stance. Analytics/Dashboard (`B2`/frozen `DashboardOverview`) already composes from `GET /entitlements`/`GET /usage` and needs no B8 change (`FB-B8-057`).

## 3. Provider internals never exposed

No read model surfaces a Tap-specific status string, the raw `hashstring`, or any adapter-internal field — every response uses B8's own provider-neutral vocabulary (§`B8_PAYMENT_PROVIDER_PORT.md` §3).
