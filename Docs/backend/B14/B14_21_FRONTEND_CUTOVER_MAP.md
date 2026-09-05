# B14_21 — Frontend Cutover Map

> **B14 modifies no frontend file.** This is a handoff map for a later frontend programme. The frozen frontend (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`) stays byte-identical throughout B14.

## 1. Cutover rule

Every frontend screen today reads `client/src/domain/data.js` through `client/src/services/mock/legacyDataBridge.ts`. **When a slice ships, the fixture for that domain stops being business truth.** Cutover replaces the data source; it does not redesign the screen.

## 2. Map

| Frontend surface | Current fixture source | Future API | Cutover slice | Notes |
|---|---|---|---|---|
| **`Landing`** | static | **none** | **never** | Marketing surface; no backend domain. Listed so it is not mistaken for an omission (`V-M06`) |
| **`Login`** | `signedIn` local flag | `POST /auth/login`, `/auth/logout`, `GET /auth/sessions` | **I1** | Real session replaces the local flag. **`signedIn` must not become a client-side route guard** — see §5 |
| **`Onboarding`** | local state | `POST /workspaces`, `POST /invitations/accept`, `GET /entitlements` | **I1** | Real workspace creation and membership. Operating-mode onboarding (`GAP-024`) stays **deferred** |
| **`UiKit`** | none | **none** | **never** | Component gallery; not a product surface |
| `Dashboard` | `dashboardData`, `metrics` | `GET /analytics/dashboard` | I2 → I10 | mock KPIs (`aiRevenue` "بيانات Mock") replaced by real selectors |
| `Discovery`, `DiscoveryJobs`, `DiscoveryJob`, `DiscoveryResults` | `jobs`, `businesses`, `DISCOVERY` | `/discovery/*` | I3 | |
| `Intelligence` | `intelligence.js` | `/intelligence/*` | I4 | |
| `Crm` (`#/crm`) | `CRM` fixtures | `GET /leads` | I2 | + **"New Lead" (manual)** at I5. **`CA-15`: the list renders `display_name`; `business_*` may be null; `city`/`category` filters never match a Business-less Lead** |
| `Lead360` | `CRM`, `activities` | `GET /leads/{id}` · **`GET /leads/{id}/timeline`** | I2 | + contact add/link at I5; + custom fields at I5. **`CA-15`: the `business` block is optional; the `display` block is always present, so the header never depends on a Business.** **The timeline is composed, not CRM-owned** (`B14_03` §5e): it carries CRM entries from I2, **gains Messaging entries at I6 and Pipeline entries at I7**, and a screen must not present the I2 timeline as complete |
| **`#/contacts`** | **`Placeholder`** | `GET /contacts` | **I5** | placeholder → real screen; **Viewer sees masked values from the API** |
| **`#/customers` (new)** | — | `/customers*` | **I5** | new screens; both `party_kind` shapes |
| **`#/imports` (new)** | — | `/imports*` | **I5** | 4-step wizard |
| `Inbox` | `conversations` | `/conversations*` | I6 | + `handling_mode` + takeover controls |
| `Copilot`, `Agent` | `sales-ai.js` | `/agent/*` | **I13** | **closes the UI-only orphan**; renders proposals with explicit confirm; **no send affordance** |
| `Pipeline`, `Deals`, `Deal360` | `dealStatusLabels` etc. | `/deals*`, `/pipelines` | I7 | |
| `Tasks`, `Appointments` | `CRM` | `/tasks`, `/appointments` | I2 | + calendar view at I14 |
| `Automation` | `automation.js` | `/automation/*` | I8 | |
| `Analytics` | `analytics-engine.js` | `/analytics/{section}` | I10 → I14 | **revenue always from `revenue_events`** |
| `Settings`, `Integrations` | `integrationStatusLabels` | `/integrations*` | I12 | **`mock_connected` disappears; `disabled` renders from `enabled`, not from `status`** |
| `Billing`, `Checkout` | `active_mock`, `paid_mock`, "فوترة تجريبية" | `/billing/*` | I9 | mock billing replaced by real B8 |
| **`#/companies`, `#/calls`** | `Placeholder` | **none** | **never** | **`PD-012`: removed/deferred. No fake backend domain is created to preserve the label** |

## 3. Per-screen state requirements

Every cut-over screen must implement, from the API rather than from fixtures: **loading** (skeletons, never a spinner over stale data) · **error** (frozen error envelope; never leaks internal IDs or another workspace's existence) · **empty** (offers the next action; the Customers empty state offers **both** manual creation and import) · **permission** (a section the actor cannot read renders **absent**, never a denied page) · **entitlement** (the existing upgrade affordance, reused).

**The timeline grows by contributor, not by section state** (`B14_03` §5e). It is `present` from I2 and never `unavailable`; what changes is **which sources contribute**. Entries the actor may not read are **simply absent, with no placeholder and no count**, so a screen must never render a gap marker or a "hidden entries" affordance.

**Party360 section states — four** (`V-M08`, extended by `B14-FIX.3`; `B14_07` §2). A section may be `present`, **`unavailable`** (its owning slice has not shipped — e.g. `deals` before I7, `tickets` before I14), `forbidden` (shipped, but the actor lacks the permission) or **`degraded`** (the owning provider raised or timed out — `null`/`[]`, never a `500`). **`unavailable` and `forbidden` both render as absent** and are indistinguishable in the payload, so no permission fact leaks through a shape difference. A screen must not render an empty `deals` section as "no deals" before I7 ships — that would report a false product state.

## 4. Fixture-truth retirement checklist

Per slice: identify the fixture export · replace the service call · delete the bridge path **for that domain only** · assert the demo runs with the fixture module unreachable · confirm no screen silently falls back to mock data on API error.

## 5. Two frontend facts that must not regress

1. **The frozen frontend performs zero client-side authorization enforcement.** Cutover must not introduce any. Navigation hiding stays presentation; the API decides.
2. **`signedIn` is tracked but read by no route guard.** Real session handling arrives with I1; the cutover must not invent a client-side guard as a security control.
