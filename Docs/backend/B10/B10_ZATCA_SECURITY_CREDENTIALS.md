# B10 — ZATCA Security & Credential Model

> Design only. Realizes `B10-D-A012` (§`B10_DECISION_REGISTER.md`). Reuses B8's `payment.manage`/secret-handling doctrine as the template, not a novel standard.

## 1. What is treated as high-sensitivity

The ZATCA Compliance CSID and Production CSID (cryptographic stamp identity credentials), any private key material, and any OTP/onboarding secret used to obtain them. None of these is a WazLink invention — they are ZATCA's own credential model (`B10-X-008`, `PARTIAL`), referenced here only by role, never by exact API shape.

## 2. Storage

`tax_profiles.credential_ref` is an **opaque pointer** into environment/secret management (the same posture `B8-D-A016`/`ProviderConfigurationHealth` established) — never a database plaintext column, never a JSONB blob, never committed to Git, never written to a log statement, never returned in any API response body. `tax_profiles.environment` (`sandbox`/`production`) is stored openly (not sensitive) alongside the pointer.

## 3. Access boundary

Only the system-actor `SubmitTaxDocumentForProcessing`/`RetryTaxSubmission` commands and the operator-invoked `ValidateZatcaConfiguration` (read-only health check, `zatca.manage`) ever resolve `credential_ref` to an actual secret — and only inside the adapter layer behind `TaxProvider` (§`B10_ZATCA_BOUNDARY.md`), never inside a domain service. `ValidateZatcaConfiguration` returns only `{configured: boolean, environment, last_verified_at}` — identical shape and identical non-disclosure discipline to B8's `ProviderConfigurationHealth`.

## 4. Rotation, audit, redaction

Credential rotation is an infrastructure/ops action outside B10's own tables (identical to `B8_RBAC_TENANCY.md` §6's "actually writing/rotating a secret is infrastructure/ops tooling outside B8's own tables"). Every rotation is audited at the **metadata** level only (`provider_configuration.changed`, timestamp, actor, environment — never the credential value itself, §`B10_OBSERVABILITY.md` §2). Any log statement, error message, or audit record touching this area is reviewed for accidental credential inclusion before it can be emitted — architecture provides no field capable of carrying a secret value outward (§`B10_SECURITY_PRIVACY.md`).

## 5. Sandbox vs. production separation

`tax_profiles.environment` is a first-class field, not inferred. A `sandbox`-environment `credential_ref` is never used to submit a `production`-scoped `TaxInvoice`, and vice versa — enforced at the adapter's own configuration-resolution step, gated by the same `environment` value the currently-effective `TaxProfile` carries.

## 6. Backup/recovery

Credential backup/recovery is entirely an infrastructure/secret-management concern (the same environment/secret store used for Tap's own credentials in B8) — B10 introduces no separate backup mechanism and stores no recoverable copy of any credential in its own tables.

## 7. Negative controls

`AT-B10SEC-1`: inspect every B10 response schema and log statement for a secret-shaped field — assert none. `AT-B10SEC-2`: attempt to read `credential_ref`'s resolved value through any B10 API — assert `403`/field never present. `AT-B10SEC-3`: `ValidateZatcaConfiguration` response — assert no value beyond `{configured, environment, last_verified_at}`. `AT-B10SEC-4`: a `sandbox`-environment credential used against a `production`-flagged submission — assert rejected before any network call.

```
SECRET_EXPOSURE_PATHS = 0
```
