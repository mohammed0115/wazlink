# B13 — Environment Strategy

> Design only. Defines security differences across development, test, staging, and production. No environment-specific credential value appears here.

## 1. Environment matrix

| Property | Development | Test (CI) | Staging | Production |
|---|---|---|---|---|
| `DEBUG` | may be `True` locally | `False` | `False` | `False` (**INVARIANT**, `B13_DJANGO_DRF_SECURITY_BASELINE.md` §2) |
| Database | local/ephemeral, synthetic data only | ephemeral per test run | isolated instance, staging data only | isolated instance, production data |
| Redis | local/ephemeral | ephemeral per test run | isolated instance | isolated instance |
| Provider credentials | **sandbox/test credentials only**, where the provider supports them | mocked/stubbed, no live provider calls | **sandbox credentials**, where supported | **production credentials only** |
| Secrets source | local `.env` (never committed) or local secret-store emulation | CI secret store, scoped to test-only values | environment-specific secret store | environment-specific secret store, most restricted access |
| Observability | optional, local-only | disabled or a dedicated test project | separate Sentry/OTel project from production | dedicated production project |
| TLS | optional locally | not applicable | required | required (**INVARIANT**) |

## 2. Production secrets never reused in development/test

> **Production secrets MUST NOT be reused in development/test.**

Every secret class in `B13_SECRETS_MANAGEMENT.md` §1 has a distinct value per environment. This is not merely good practice — it bounds the blast radius of a development-environment compromise (a laptop, a CI runner) to never include production credentials, and it means a leaked test/sandbox credential (§3) causes no production impact.

## 3. Provider sandbox/test credential isolation

| Provider | Sandbox support | Isolation requirement |
|---|---|---|
| Tap Payments | Tap documents a distinct test/sandbox mode | staging/development use only sandbox credentials; `B10_ZATCA_SECURITY_CREDENTIALS.md`'s environment-separation rule (`FI-B10-01`) — sandbox credentials are never used for a production-scoped submission — extends identically to Tap |
| Meta WhatsApp Cloud API | Meta provides test phone numbers/WABA configurations for development | non-production environments use test-tier WhatsApp configuration, never a real customer-facing phone number |
| Google Places | a separate API key/project for non-production, to keep quota and billing isolated from production usage | distinct project per environment recommended |
| ZATCA | `sandbox`/`production` is a first-class field on `tax_profiles.environment` (`FI-B10-01`) | enforced at the adapter's configuration-resolution step before any network call |
| AI Gateway, scraping provider | separate API keys per environment where the provider supports project/key separation | isolate to bound cost and blast radius |

Where a provider does **not** support a sandbox distinct from production (unconfirmed for some Phase-1 providers — see `B12_PROVIDER_RESEARCH_REGISTER.md` unresolved items), non-production environments must not exercise that provider against real external effect (e.g., a real WhatsApp send to a real phone number) — this is a testing-discipline requirement, not an architecture control, and is recorded as `B13-D-B025`, Class B.

## 4. Safe fixture/test data policy

> **Do not use production customer data casually in development.**

| Rule | Requirement |
|---|---|
| Synthetic-first | development and CI-test data is synthetic (generated fixtures), never a copy of production |
| Staging data | if staging is seeded from a production snapshot for realistic testing, PII fields (Contact PII, financial-instrument references — though the latter are never stored raw per `B13_PAYMENT_FINANCIAL_SECURITY.md` §9) are anonymized before the snapshot is used, following the same anonymization discipline `FI-B1-10` Rule P-3 already requires for workspace deletion |
| Prohibition | an engineer's local development database is never seeded directly from a raw production export without the anonymization step above |

## 5. Environment-specific configuration values

Every value classified **ENV-SPECIFIC** in `B13_DJANGO_DRF_SECURITY_BASELINE.md` (`ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `SECRET_KEY`) and **DEPLOYMENT** (`SECURE_PROXY_SSL_HEADER`, HSTS escalation) is set per-environment through the configuration-class mechanism in `B13_CONFIGURATION_MANAGEMENT.md` §2, never hardcoded per-environment in application code.

## 6. Observability project separation

Sentry/OTel projects are separated per environment so a development exception never pollutes the production error stream and a production incident is never diluted by test-environment noise (`FI-B0-05`: "environments isolated per-provider/DB/Redis/storage/observability").

## 7. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13ENV-1` | No production secret value is present in any development or CI-test configuration, verified by a secret-scanning pass across both |
| `AT-B13ENV-2` | Staging's Tap/ZATCA credentials are confirmed sandbox-tier, not production-tier |
| `AT-B13ENV-3` | A production-scoped tax submission using a sandbox credential (or vice versa) is rejected before any network call |
| `AT-B13ENV-4` | Development/CI databases contain no unanonymized production PII |
| `AT-B13ENV-5` | Sentry/OTel events from a development run never appear in the production project |
