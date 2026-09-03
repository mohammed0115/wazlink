# B13 — Secrets Management

> Design only. Extends frozen `BACKEND_SECURITY_ARCHITECTURE.md` (`FI-B0-05`) and `B12_CONFIGURATION_INVENTORY.md`/`B12_SECURITY_PRIVACY.md` (`FI-B12-04`, `FI-B12-01`) into a production secrets-lifecycle contract. **No real secret, key, token, or account identifier appears in this document**, matching the discipline every frozen phase already holds.

## 1. Secret classes

| Class | Examples | Owner |
|---|---|---|
| Platform substrate | `SECRET_KEY`, PostgreSQL credentials, Redis credentials/URL | Platform/Infra |
| Messaging provider | WhatsApp access token, app secret, verify token (`WHATSAPP_*_REF`) | Messaging domain, workspace-scoped |
| Payment provider | Tap Secret API Key (also the `hashstring` HMAC key — one credential, two uses) | Billing domain, workspace-scoped |
| Discovery provider | Google Places API key (global, shared) | Platform, global-scoped |
| Scraping provider | Scraper API key, scraping webhook secret (verification scheme unresolved, `B12-D-B005`) | Discovery domain, workspace-scoped |
| AI provider | AI Gateway API key | Platform, global-scoped |
| Tax provider | ZATCA Compliance CSID, Production CSID, private key material, OTP/onboarding secrets | Tax domain, global-scoped (`FI-B10-01`) |
| Storage provider | Storage access key, secret key | Platform, global-scoped |
| Observability | Sentry DSN, OTel exporter token | Platform |

## 2. Where secrets may exist and must not exist

| Location | Permitted? |
|---|---|
| Secret-management layer (environment variables backed by a managed secret store — product choice deferred to `B14_IMPLEMENTATION_HANDOFF`) | **yes — the only permitted location for a secret value** |
| PostgreSQL, any column, any table | **never.** `integration_connections.credential_refs` and `tax_profiles.credential_ref` hold reference **names**, not values (`FI-B12-04`, `B12-D-A046`; `FI-B10-01`) |
| Outbox row, Celery task payload, internal event payload, webhook receipt, dead-letter record, reconciliation evidence, audit metadata | **never**, at any level (`FI-B12-01` §3) |
| Log line, metric label, Sentry context, error response, API DTO | **never** — a configuration read returns `configured: true|false` only, never a value, mask, prefix, or length (`FI-B12-04`, `B12-D-A042`; truncation is not redaction) |
| Git repository, commit history, CI logs, documentation | **never** — this is why this document itself contains none |
| Client bundle, frontend source | **never** (`FI-B0-05`; independently confirmed by frontend evidence `FB-B13-013`/`014`) |

## 3. Environment-variable / configuration boundary

Every credential is a `*_REF` — a symbolic name resolved by the secret-management layer **at call time**, never cached in a task payload, domain object, or long-lived process variable (`FI-B12-04`, `B12-D-A048`). This is what makes rotation take effect without a restart and without a cache-invalidation story. `B12_CONFIGURATION_INVENTORY.md`'s full symbolic key table (`WHATSAPP_ACCESS_TOKEN_REF`, `TAP_SECRET_KEY_REF`, `PLACES_API_KEY_REF`, `AI_API_KEY_REF`, `STORAGE_SECRET_KEY_REF`, etc.) is inherited unchanged; B13 adds no new key beyond what B10/B12 already named, and any new provider credential introduced at implementation time follows the identical `*_REF` naming and classification pattern.

## 4. Encryption at rest

B12 already recorded the reasoning B13 inherits rather than reopens (`FI-B12-01` §7, `B12-D-B009`): encrypting a value inside PostgreSQL requires a key-management story (storage, rotation, escrow, access audit) that is a product in itself, and building half of one — an encrypted blob with the key in the same environment — provides the appearance of protection with none of the properties. Phase 1 therefore relies on the secret-management layer's own at-rest guarantees, whatever the chosen product provides; **B13 does not claim a specific at-rest encryption guarantee** because the product is not yet chosen (`B13-D-C003`, Class C, resolved when `B14` selects the secret-store product).

## 5. Log redaction

The exhaustive never-log list from `FI-B12-01` §3 is the production log-redaction contract for every secret class in §1: an access token, secret key, app secret, verify token, or `hashstring`; an `Authorization` header; a webhook signature, whole or truncated; a provider host, bucket, region, or endpoint URL; a raw provider request or response body. Full detail and the always-safe list: `B13_LOGGING_REDACTION.md` §2.

## 6. UI masking

Confirmed by frontend evidence (`FB-B13-013`, `FB-B13-014`, `FB-B13-015`, `FB-B13-016`): the shipped client already never round-trips a secret or a full card number. B13's requirement for any future admin surface is the same: a provider-credential field is write-only from the client's perspective — the API accepts a new value on `ConfigureIntegration` and returns only `configured: true|false` on every subsequent read, never a masked fragment (masking implies a fragment is safe to display, which `B12-D-A042` explicitly rejects: "truncation is not redaction").

## 7. Credential rotation

| Step | Behavior | Source |
|---|---|---|
| 1 | Operator submits a new credential value through the domain's configuration command (`ConfigureIntegration`, ZATCA credential update) | `FI-B5-02`, `FI-B10-01` |
| 2 | The connection/profile status returns to `configuration_required`, forcing a fresh health check before re-reaching `connected` | `FI-B5-02` |
| 3 | **The prior credential reference is invalidated, not merely superseded** — the old reference is never left resolvable as a fallback | `FI-B5-02` (`B5_ADMIN_PROVIDER_RUNBOOK.md` §11), `FI-B12-04` rule 4 |
| 4 | A sandbox-environment credential is never used to submit a production-scoped document, and vice versa, enforced at the adapter's configuration-resolution step, before any network call | `FI-B10-01` (`B10-D-A0xx` environment separation) |
| 5 | Rotation is audited at metadata level only — actor, timestamp, environment, provider — never the value | `FI-B5-04` (`provider_configuration_changed`, elevated-sensitivity audit) |

**Rotation cadence** is a Class B operational decision (`B13-D-B007`) — no numeric interval is frozen; rotation is triggered by suspected compromise (mandatory, immediate) or by routine security hygiene (recommended, e.g. annually for long-lived platform credentials), whichever comes first.

## 8. Revocation and compromised-secret response

A confirmed or suspected credential leak follows `B13_RUNBOOKS.md` §"Leaked provider credential": rotate immediately at the provider console, invalidate the prior reference in WazLink's configuration (§7 above), and audit the operator action. Revocation never depends on WazLink's own systems alone — the provider-side key must also be revoked at its console, because a `*_REF` swap in WazLink does not itself invalidate the old value at the provider (that is the provider's own responsibility, outside this architecture's control).

## 9. Operator authorization for secret configuration

| Provider scope | Who may configure | Permission |
|---|---|---|
| Workspace-scoped (Meta, Tap) | workspace admin+ | `integration.manage` (`FI-B12-03`), `messaging.provider.manage` (`FI-B5-04`), `payment.manage` (`FI-B8-01`) |
| Global-scoped (Places, AI Gateway, storage, ZATCA) | platform operator only — **not** workspace-administrable | `B12-D-A043`; ZATCA gated further by Owner-only `tax.applicability.manage`/`zatca.manage` (`FI-B10-02`) |

## 10. Validation and startup failure behavior

A missing reference at call time fails **before** any provider request and creates **no** attempt row (`FI-B12-04` rule 5). A security-critical missing secret (`SECRET_KEY`, database credentials) fails application **startup** entirely — fail-closed (`B13_CONFIGURATION_MANAGEMENT.md` §4). A missing optional-provider credential (Places, scraping, AI) does **not** fail startup — the feature is unavailable and reports `configuration_required`, but the application serves every other feature (`B13_HEALTH_READINESS.md` §3).

## 11. Audit trail

Every configuration/rotation/revocation action writes `provider_configuration.changed` (`FI-B8-02`) or the equivalent domain-specific audit action, carrying actor, timestamp, environment, and provider — never the value. Combined with `B13_AUDIT_LOGGING.md`'s full catalog, this makes every secret-lifecycle event reconstructable without ever having stored the secret itself.

## 12. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13SEC-1` | No API response, at any endpoint, ever contains a value from §1 |
| `AT-B13SEC-2` | A configuration read returns only `configured: true|false`, never a masked fragment |
| `AT-B13SEC-3` | Scanning outbox rows, task payloads, events, receipts, dead letters, and logs for every secret class in §1 returns zero matches |
| `AT-B13SEC-4` | Rotating a credential invalidates the prior reference; a request made with adapter code still holding the old reference fails rather than succeeding against the old value |
| `AT-B13SEC-5` | A workspace admin attempting to configure a global-scope provider (Places, AI Gateway, storage) receives `403 PERMISSION_DENIED` |
| `AT-B13SEC-6` | Missing `SECRET_KEY` or database credentials at startup halts the process; missing an optional provider credential does not |
| `AT-B13SEC-7` | A sandbox ZATCA credential rejected against a production-scoped submission before any network call |
| `AT-B13SEC-8` | Error responses from every provider adapter never include the six always-safe-only fields' complements — i.e., never a credential, host, or raw response body (cross-reference `B13_LOGGING_REDACTION.md` `AT-B13LOG-*`) |
