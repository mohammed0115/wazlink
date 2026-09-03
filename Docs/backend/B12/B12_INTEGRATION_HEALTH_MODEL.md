# B12 — Integration Health Model

> Design only. Answers the brief's §35: one `connected=true` boolean is insufficient.

## 1. Six independent facts, not one flag

> **`B12-D-A036`. Integration health is six orthogonal booleans plus a derived summary. Collapsing them loses the ability to tell an operator *what to fix*.**

| Fact | Question | Established by |
|---|---|---|
| `configuration_valid` | are all required fields present and well-formed? | local validation, no provider call |
| `credential_valid` | does the provider accept our credential? | configuration check (`B12_PROVIDER_CONFIGURATION_MODEL.md` §5) |
| `provider_reachable` | did the last call reach the provider at all? | most recent attempt outcome |
| `webhook_configured` | has a verified callback ever been received? | first successful receipt for the binding |
| `provider_enabled` | does the operator want this on? | `IntegrationConnection.enabled` |
| `degraded` | recent elevated failure/rate-limit rate? | rolling window over `provider_request_attempts` |

**Why each earns its place.** "Credentials are right but we cannot reach the provider" (network) and "we reach the provider but it rejects us" (expired token) demand opposite operator actions. "Never received a webhook" is invisible in any outbound-only check yet is the most common real misconfiguration — Meta's subscription registration is an external step (`B5_ADMIN_PROVIDER_RUNBOOK.md` §2) that can simply be forgotten, and nothing outbound would ever notice.

## 2. Health is evidence, never authority

> **`B12-D-A037`. A health snapshot never changes business state.** A degraded Meta integration does not fail a Message; a degraded Tap integration does not fail a Payment. Health explains *why* work is failing; the domain's own state machine records *what* happened. `RECONCILIATION_AUTHORITY_LEAKS = 0` extends to health; negative control `AT-B12HLT-3`.

## 3. `integration_health_snapshots`

Append-only observations: `integration_connection_id`, `observed_at`, the six facts, `check_kind` (`active_check` | `passive_observation`), `outcome`, safe `error_code`, `request_id`. Bounded retention; a snapshot is operational telemetry, and durable retention policy belongs to B13.

**Passive observation matters as much as active checking.** Every `provider_request_attempts` row is health evidence for free. An integration that fails 40% of real calls is degraded regardless of what a synthetic check said five minutes ago.

## 4. Automatic transitions

| Trigger | Effect |
|---|---|
| `401`/`403` from the provider | `credential_valid = false`; `status → error`; alert. **No automatic retry** — frozen "Authorization / no / 1" |
| Sustained `transient` failures over the window | `degraded = true`; backpressure engages (`B12_RATE_LIMIT_BACKPRESSURE.md` §4) |
| Sustained `429` | `degraded = true`; honor `Retry-After` |
| First verified webhook receipt | `webhook_configured = true` (latching — it stays true) |
| Successful configuration check | `credential_valid = true`; `status → connected` if the operator has enabled it |

`credential_valid = false` is the one fact that flips `status` on its own, because a rejected credential is unambiguous and continuing to spend attempts against it is pure waste.

## 5. No circuit breaker in Phase 1

The brief (§34) explicitly cautions against over-engineering. B12 implements **degraded state + backoff + queue isolation** and **no** distributed circuit-breaker state machine (`B12-D-B008`, deferred). Reasons: a breaker needs shared state across workers (Redis — which cannot hold correctness, `B12-D-A014`); half-open probing on a *payment* provider means gambling a real charge; and the frozen `Retry-After` + exponential-backoff + per-queue-isolation combination already prevents the failure mode a breaker exists to prevent, without new state.

## 6. Health and the paused provider

An integration with `enabled = false` is not *unhealthy* — it is off, and "off" is that boolean rather than a status value (`B12-D-A052`). Its last known health facts are retained, its inbound webhooks are still accepted (`B12_WEBHOOK_GATEWAY.md` §6), and no active check is run against a provider the operator asked us to stop calling. This is why `provider_enabled` is one of the six orthogonal facts in §1 and not a derivative of `status`: an operator needs to distinguish *"we paused it"* from *"it is broken"* at a glance.

## 7. Operator surface

`GET /operations/integration-health` returns the six facts, the last check time and outcome, the last safe error code, and the degraded window — never a credential, a raw provider message, or an endpoint host (`B12_API_DTO_CONTRACTS.md` §5).
