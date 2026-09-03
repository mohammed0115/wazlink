# B12 — Frontend Behavior Inventory

> Frontend evidence only. **No frontend file is modified by B12.** Frozen frontend reference: `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` — independently re-verified byte-identical against current `client/` during this pass. Evidence root: `client/src/`.

## 1. Method

Mechanical, case-insensitive search of the whole `client/src` tree for every integration/async/provider term (`integration`, `provider`, `webhook`, `connect`, `disconnect`, `retry`, `status`, `health`, `secret`, `configured`, `capability`, `queue`, `job`, `async`, `تكامل`, `ربط`, `إعداد`), then reading every genuine hit in full context and discarding React-framework false positives (`AppProviders`, `ToastProvider`, `QueryClientProvider`, `Context.Provider`). Files read in full or by targeted section: `features/settings/Integrations.tsx`, `features/settings/shared.tsx`, `domain/data.js` (`integrations`, `integrationActivities`, the five mock mutators, `integrationStatusLabels`, `getS11IntegrityReport`), `services/data.ts`, `services/index.ts`, `App.tsx`.

Classification identical to B8/B10/B11 precedent: **A** must be preserved / directly shapes a B12 backend contract · **B** derivable, informative · **C** placeholder/presentation only · **D** intentionally unsupported/deferred.

**The single most important finding:** unlike B11's file surface, the integrations surface is **substantially built**. `client/src/features/settings/Integrations.tsx` is 226 lines of real UI over a seven-row fixture catalogue with five statuses, per-integration capabilities, an activity log, and a configuration form that stores a boolean and never a secret. B12's admin contract is therefore **constrained by shipped shape**, not invented. Eleven behaviors.

## 2. Totals

| Class | Count |
|---|---:|
| A | 4 |
| B | 2 |
| C | 3 |
| D | 2 |
| **Total** | **11** |

`FRONTEND_BEHAVIOR_COUNT = 11`, `FRONTEND_A_COUNT = 4`, `FRONTEND_B_COUNT = 2`, `FRONTEND_C_COUNT = 3`, `FRONTEND_D_COUNT = 2`. `4 + 2 + 3 + 2 = 11`, confirmed.

## 3. Class A — backend-contract-shaping

| ID | Class | Source | Line/Range | Observed behavior | B12 interpretation | Contract required |
|---|---|---|---|---|---|---|
| `FB-B12-001` | A | `client/src/domain/data.js` | 305-313 | A seven-row `integrations` fixture. Each row: `{ id:"INT-100n", provider, name, category, status, mode, capabilities[], context, configuredAt, connectedBy, lastCheckedAt, errorCode, errorReason, hasConfiguredSecret }`. Providers are `google_maps`, `whatsapp`, `email`, `google_calendar`, `crm_import_export`, `ai_provider`, `webhook`; categories are `business_sources`, `messaging`, `calendar`, `crm`, `ai`, `developer` | This is the product's own integration model, and B12 adopts its **shape** rather than inventing one: `IntegrationConnection` carries provider, category, status, capabilities, configured/connected provenance, `last_checked_at`, and a safe error pair (`B12_PROVIDER_CONFIGURATION_MODEL.md` §2). The `INT-*` identifier is why `B12-AM-010` registers that exact prefix rather than a new one. **Four of the seven providers are not Phase-1 backend integrations** (`email`, `google_calendar`, `crm_import_export`, and the `webhook` developer row) — frozen `BACKEND_INTEGRATION_BOUNDARIES.md` states email/Gmail/Calendar are *"optional/deferred and are not Phase 1 dependencies"*, so B12 registers **no** backend connection for them (`B12-D-B010`) | **Yes** |
| `FB-B12-002` | A | `client/src/domain/data.js` | 1006 | `integrationStatusLabels = { not_connected, mock_connected, configuration_required, error, disabled }` — five statuses with Arabic labels | **Three** of the five become backend `IntegrationConnection` states verbatim — `not_connected`, `configuration_required`, `error` — joined by the backend-only `connected`, for **four** states in total (`B12_STATE_MACHINES.md` §4). Two fixture values are deliberately excluded, for two different reasons: **`mock_connected`** is a frontend-only artifact, and promoting a mock status into durable truth is exactly the "relational fixture shape alone does not justify a persistent resource" error `BACKEND_PUBLIC_ID_REGISTRY.md` §B warns against; **`disabled`** is not a connection *status* at all but the orthogonal `enabled = false` boolean (`B12-D-A034`, `B12-D-A052`), so the client's `disabled` label renders from that flag. **Corrected in B12-FIX.1**: the earlier draft carried `disabled` as a fifth backend status and no command could reach it | **Yes** |
| `FB-B12-003` | A | `client/src/domain/data.js` | 1033 (`updateIntegrationConfiguration`); `Integrations.tsx` header comment (lines 3-8) | The configuration mutator accepts `values` and persists **only** `hasConfiguredSecret = Boolean(values.hasConfiguredSecret)`. The file's own header states: *"لا OAuth ولا API keys ولا provider request ولا Webhook. تُحفظ `hasConfiguredSecret` فقط ولا تُخزَّن أو تُعرض أي قيمة سرية"* — "no OAuth, no API keys, no provider request, no webhook. Only `hasConfiguredSecret` is saved, and no secret value is stored or displayed" | **The product already committed to the exact redaction contract B12 formalizes.** There is no field anywhere in the fixture for a token, a masked fragment, or a last-four. This is the frontend corroboration for `B12-D-A042` and for reusing frozen `integration.manage`'s own condition *"secret access never returned to client"* — the shipped client neither sends nor expects a secret value in a read | **Yes** |
| `FB-B12-004` | A | `client/src/domain/data.js` | 1031-1034; `Integrations.tsx` 28-74 | Four distinct mutators exist and are wired to four distinct buttons: `connectIntegrationMock`, `disconnectIntegrationMock`, `updateIntegrationConfiguration`, `retryIntegrationMock`. `connect` refuses when status is `disabled` or `error`; `retry` moves `error → mock_connected` **only if `hasConfiguredSecret`**, else `→ configuration_required`; every mutator sets `lastCheckedAt` and clears the error pair | Four operator actions, with **guards**, not one toggle. This grounds B12's four integration commands (`ConfigureIntegration`, `CheckIntegrationConfiguration`, `EnableIntegration`, `DisableIntegration`) and — importantly — the guard that a check cannot succeed without credentials present, which is machine 4's `configuration_required → connected` edge. The fixture's `updateIntegrationConfiguration` also **re-evaluates status on every configuration write**, including from a connected row, which is the frontend's own version of the `connected → configuration_required` edge `B12-D-A051` makes normative. The retry-depends-on-configured rule is the frontend's own version of "health is not one boolean" | **Yes** |

## 4. Class B

| ID | Class | Source | Line/Range | Observed behavior | B12 interpretation | Contract required |
|---|---|---|---|---|---|---|
| `FB-B12-005` | B | `client/src/domain/data.js` | 314-317 | `integrationActivities` — `{ id:"INTA-100n", integrationId, actorId, type, createdAt, metadata }` with types `status_changed` and `mock_connected`, metadata carrying `{from, to, reason}` | An audit trail per integration, with actor and a from/to transition. B12 satisfies it through the **frozen** `audit_logs` table and the eleven audit actions of `B12_COMMAND_EVENT_CATALOG.md` §5 rather than a new `integration_activities` table — the frozen `AUD-*` audit contract already carries actor, target, and metadata, and a second audit store would be drift | No |
| `FB-B12-006` | B | `client/src/features/settings/Integrations.tsx` | 1, 10, 20-22 | The page imports `integrationFeatureService` and label maps `integrationStatusLabels`, `providerLabels`, `categoryLabels`, `modeLabels`, `capabilityLabels`, plus `integrationStatusClass` for styling | Status, provider, category, and capability are all **closed enumerations** on the client, each with a presentation label. B12's corresponding fields are therefore closed enums rather than free text (`B12_DATA_MODEL.md` §5) — a useful negative finding, since a free-text `status` would have broken a shipped label map | No |

## 5. Class C — placeholder/presentation only

| ID | Class | Source | Line/Range | Observed behavior | B12 interpretation |
|---|---|---|---|---|---|
| `FB-B12-007` | C | `client/src/domain/data.js` | 306-312 (`mode` field) | Every row carries `mode: "mock"`, except `ai_provider` which carries `mode: "local_deterministic_mock"` | `mode` describes *the fixture's own fakeness*, not a product concept. B12 registers **no** `mode` field: a backend integration is real or it does not exist, and a `mode` column would be a permanent monument to the mock |
| `FB-B12-008` | C | `client/src/domain/data.js` | 309 | The `google_calendar` row ships in `status:"error"` with `errorCode:"MOCK_CONFIGURATION_EXPIRED"` and an Arabic `errorReason` that says explicitly it is a fixture | A seeded demo error, not a real error taxonomy. B12's error codes derive from the frozen catalogue (`B12_ERROR_TAXONOMY.md`), not from this string. Recorded so the absence of `MOCK_*` codes in B12 is an explicit finding rather than an oversight |
| `FB-B12-009` | C | `client/src/features/settings/Integrations.tsx` | 34-74 | Button labels are explicitly demo-marked — *"ربط تجريبي"* (mock connect), *"فصل تجريبي"* (mock disconnect), *"إعادة محاولة محلية"* (local retry) — and each toast says no network request was sent | Presentation only. Confirms **no shipped client calls a backend integration API**, so B12's ten operations have no legacy shape to preserve and no shipped consumer to break |

## 6. Class D — intentionally unsupported/deferred

| ID | Class | Source | Line/Range | Observed behavior | B12 interpretation |
|---|---|---|---|---|---|
| `FB-B12-010` | D | `client/src/domain/data.js` | 312 | An integration row exists for `provider:"webhook"`, `category:"developer"`, `capabilities:["event_preview_mock"]`, `status:"disabled"` | An **outbound customer-facing webhook** product (WazLink notifying a customer's endpoint) — a different feature from the inbound provider gateway B12 designs. B12 builds **no** outbound webhook feature: it would be a client-supplied-URL fetcher, i.e. an SSRF surface, and no frozen backend artifact requires one (`B12_SECURITY_PRIVACY.md` §1 threat 9, `B12-D-B011`) |
| `FB-B12-011` | D | `client/src/domain/data.js` | 1057 (`getS11IntegrityReport`) | A client-side integrity report enumerates `allowedStatuses = Object.keys(integrationStatusLabels)` and checks fixture consistency | A **local fixture self-check**, entirely client-side, with no server call. It is not an integration-health contract; B12's health model derives from provider evidence (`B12_INTEGRATION_HEALTH_MODEL.md`), not from this. Registering it as a backend surface would be inventing a resource from a test harness |

## 7. What the inventory implies for B12

The frontend supports exactly: an integration **catalogue** with closed enums; **five** statuses of which four are real; a **hard** no-secret-value contract already shipped; **four** distinct operator actions with guards; an **audit trail** per integration; and **no** shipped backend call. It contains **no** dead-letter view, no queue depth display, no reconciliation surface, and no health panel — so B12's `/operations/*` endpoints (`B12_API_DTO_CONTRACTS.md` §1 rows 7-10) have **no frontend evidence** and are justified instead by frozen `BACKEND_RETRY_POLICY.md`'s *"Workers must use timeouts, heartbeats, and dead-letter records"* and `BACKEND_RECONCILIATION.md`'s operator-repair doctrine. That distinction is recorded rather than blurred: four operations are frontend-grounded, six are frozen-backend-grounded, and none is invented.

`FRONTEND_DRIFT = 0`: no file under `client/` is created, modified, or deleted by B12.
