# B13 — Configuration Management

> Design only. Extends `B12_CONFIGURATION_INVENTORY.md` (`FI-B12-04`) into a complete configuration-lifecycle contract covering every class the brief names, not only B12's provider/platform keys.

## 1. Configuration classes

| Class | Examples | Where it lives |
|---|---|---|
| Non-secret static configuration | queue names, retry-class defaults, feature-flag defaults | deployment configuration (infrastructure-as-code), versioned in source control |
| Environment-specific configuration | `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, database/Redis connection hosts | per-environment configuration store, not hardcoded |
| Secret configuration | every `*_REF` in `B13_SECRETS_MANAGEMENT.md` §1 | secret-management layer only |
| Tenant integration configuration | `IntegrationConnection` rows (workspace-scoped provider credentials/status) | PostgreSQL (references only, `FI-B12-04`) |
| Operator-managed configuration | global-scope integration status, ZATCA applicability, platform safety ceilings (`MAX_FILE_BYTES`, `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES`) | PostgreSQL/deployment config, gated by operator-tier permissions |

## 2. Validation

| When | What is validated |
|---|---|
| **Startup** | every security-critical configuration class (§4) is present and well-formed before the process begins serving traffic |
| **Runtime** (per-request/per-task) | a `*_REF` is resolved and validated at call time, never assumed valid from a cached prior resolution (`FI-B12-04` rule 1) |
| **Configuration-change time** | a `ConfigureIntegration`-class command runs its own validation (format, provider-side test call where safe) before persisting the new reference |

## 3. Safe defaults

Every configuration value has a documented default that is the **more restrictive** option where restrictiveness and permissiveness are both plausible (e.g., `RAW_WEBHOOK_PAYLOAD_RETENTION` defaults to **off**, `FI-B12-04`; a new optional provider defaults to `disabled` until explicitly enabled). No configuration value defaults to a permissive/insecure state "to make setup easier."

## 4. Fail-open vs. fail-closed — the exact distinction

> **Security-sensitive missing configuration should generally fail closed. Availability-only optional providers should not necessarily prevent the entire application from starting.**

| Configuration | Missing/invalid behavior | Class |
|---|---|---|
| `SECRET_KEY` | **fail closed — process refuses to start** | security-critical |
| Database credentials | **fail closed — process refuses to start** | security-critical |
| `ALLOWED_HOSTS` containing a wildcard in production | **fail closed — process refuses to start** (`AT-B13CFG-2`) | security-critical |
| TLS/HSTS configuration missing in production | **fail closed** | security-critical |
| A workspace-scoped optional provider credential (WhatsApp, Tap) | **fails open for the application; fails closed for that feature** — the process starts, the workspace's provider-dependent feature reports `configuration_required`, every other feature works | availability-only |
| A global-scope optional provider credential (Places, AI Gateway, scraping) | **fails open for the application; fails closed for that feature**, identical reasoning | availability-only |
| `RAW_WEBHOOK_PAYLOAD_RETENTION` unset | defaults to off (§3) — not a startup failure | tuning, not security-critical |

This is the concrete boundary the brief asked B13 to document rather than leave as a vague "fail safely" instruction: **a missing credential that would grant unintended access or silently downgrade a security guarantee fails closed at startup; a missing credential that only disables one optional feature fails open at the application level and closed only for that feature.**

## 5. Audit

Every configuration change (secret rotation, provider enable/disable, safety-ceiling adjustment, ZATCA applicability change) is audited per `B13_AUDIT_LOGGING.md` §3's `provider_configuration.changed`/applicability-change actions — actor, timestamp, environment, provider — never the value.

## 6. Rotation and rollback

Rotation: `B13_SECRETS_MANAGEMENT.md` §7. Rollback: a configuration change that causes a regression is reverted through the identical governed command that made the change (never a direct database edit, `FI-B0-14`), and the prior value's audit row provides the exact before-state to restore.

## 7. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13CFG-1` | Application refuses to start with `DEBUG=True` in a production environment (restated from `B13_DJANGO_DRF_SECURITY_BASELINE.md`) |
| `AT-B13CFG-2` | Application refuses to start with a wildcard `ALLOWED_HOSTS` in production |
| `AT-B13CFG-3` | Application refuses to start without a valid `SECRET_KEY` or database credential |
| `AT-B13CFG-4` | Application starts successfully with every optional provider credential absent, and each absent provider's feature reports `configuration_required` rather than crashing the process |
| `AT-B13CFG-5` | `RAW_WEBHOOK_PAYLOAD_RETENTION` unset resolves to "off," never "on by omission" |
| `AT-B13CFG-6` | Every configuration change of a security-relevant value writes an audit row |
