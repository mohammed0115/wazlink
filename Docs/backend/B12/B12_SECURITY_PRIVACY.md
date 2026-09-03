# B12 — Security & Privacy

> Design only. Extends frozen `BACKEND_SECURITY_ARCHITECTURE.md` without weakening any clause of it.

## 1. Threat model

Fourteen threats, each with its control and the acceptance test that proves it.

| # | Threat | Control | Test |
|---:|---|---|---|
| 1 | **Forged webhook** | per-provider signature verification before any parse, enqueue, or domain code; constant-time compare (`B12_WEBHOOK_SECURITY.md` §2) | `AT-B12WH-2` |
| 2 | **Cross-tenant webhook injection** | workspace is a consequence of *which secret verified*, never a payload field (`B12-D-A031`) | `AT-B12WH-4`, `AT-B12WH-5` |
| 3 | **Replay of a captured callback** | dedup on the receipt's unique key; HMAC has no freshness and B12 says so rather than assuming it (`B12_WEBHOOK_SECURITY.md` §4) | `AT-B12WH-6` |
| 4 | **Credential exfiltration via API** | no read path returns a value, fragment, prefix, or length (`B12-D-A042`) | `AT-B12SEC-1` |
| 5 | **Credential leak via async payload** | no secret in an outbox row, task payload, event, receipt, dead letter, or log (§3) | `AT-B12SEC-2` |
| 6 | **Credential leak via error** | six safe metadata fields only; raw provider text never crosses the boundary (`B12_ERROR_TAXONOMY.md` §5) | `AT-B12SEC-4` |
| 7 | **Signature-oracle via retained payload** | a signature is never stored beside the body it signs (`B12_WEBHOOK_GATEWAY.md` §7) | `AT-B12SEC-3` |
| 8 | **DoS via unauthenticated ingress** | size, content-type, and rate gates run **before** HMAC computation (`B12_WEBHOOK_SECURITY.md` §5) | `AT-B12WH-12` |
| 9 | **SSRF via a client-supplied URL** | B12 exposes no URL-fetching feature; the only such path is B11's system-actor-only, allow-listed `ImportFileFromUrl` | `AT-B12SEC-6` |
| 10 | **Duplicate financial effect** | write-before-call attempt rows + no blind retry on `unknown` (`B12-D-A020`, `B12-D-A021`) | `AT-B12UNK-3` |
| 11 | **Cross-tenant replay** | Doctrine R-1 plus post-resolution workspace re-assertion; no cross-workspace replay at any privilege (`B12_RBAC_TENANCY.md` §4) | `AT-B12TEN-3` |
| 12 | **Privilege escalation via replay** | replay is a separate permission from view, and is Owner-gated for financial domains (`B12_RBAC_TENANCY.md` §2) | `AT-B12RBAC-3` |
| 13 | **Global-credential sabotage by one tenant** | global-scope integrations are not workspace-administrable (`B12-D-A043`) | `AT-B12TEN-6` |
| 14 | **Sensitive data in an incident view** | dead-letter DTOs carry identifiers and classes, never payloads (`B12_RBAC_TENANCY.md` §6) | `AT-B12SEC-5` |

## 2. Secret boundary

> **`B12-D-A046`. B12 stores credential *references*, never credential *values*. It is not, and does not become, a secrets manager.**

Phase 1 uses environment/configuration-backed references, resolved at call time from the frozen secret-management layer. `integration_connections.credential_refs` holds reference **names** (`WHATSAPP_ACCESS_TOKEN_REF`, …), and the value never enters PostgreSQL.

**Why not encrypted-at-rest values in the database?** Because that requires a key-management story (storage, rotation, escrow, access audit) that is a product in itself, and Phase 1 has a working alternative. Building half of one — encrypted blobs with the key in the same environment — provides the *appearance* of protection with none of the properties. Recorded as `B12-D-B009`, deferred with its reasoning, not omitted.

## 3. Redaction — the exhaustive list

**Never present** in any of these, at any level: outbox payload · Celery task payload · internal event payload · `webhook_receipts` row · `provider_request_attempts` row · `platform_dead_letters` row · reconciliation `evidence` · audit metadata · log line · metric label · Sentry context · error response · API DTO:

an access token, secret key, app secret, verify token, or `hashstring` · an `Authorization` header · a webhook signature, whole or truncated · a provider host, bucket, region, or endpoint URL · a raw provider request or response body · customer message content · a phone number outside the owning domain's own contract · a payment instrument detail.

**Always safe to carry**: public IDs, opaque provider *references*, closed-enum classes and codes, counts, timestamps, latencies, `workspace_id`, `correlation_id`/`request_id`.

**Truncation is not redaction.** A masked token fragment is treated as a secret, not as a safe compromise (`B12-D-A042`).

## 4. Logging

| Always logged | Never logged |
|---|---|
| `request_id`, `correlation_id`, `causation_id` | any item in §3's list |
| `workspace_id`, actor membership or `system:*` | raw payloads of any kind |
| provider, operation, normalized class, `http_status` | provider error text |
| attempt numbers, latencies, queue, outcome | credential references' **values** |
| receipt public ID and outcome class | the receipt's body |

Sentry and OpenTelemetry inherit the frozen scrubbing rules (`BACKEND_INTEGRATION_BOUNDARIES.md`: *"scrub PII"*, *"without sensitive payloads"*).

## 5. Data classification

Webhook payloads and provider responses may contain the most sensitive classes frozen `BACKEND_PRIVACY_AND_DATA_HANDLING.md` defines — private communications and Contact PII. Because B12 never interprets content semantically, it applies the **most restrictive** handling uniformly: minimize at ingress, hash rather than store, normalize to the smallest projection the owning domain needs, and never export.

## 6. Transport

TLS to every provider, verification mandatory and non-disableable (`B12_OUTBOUND_HTTP_POLICY.md` §6). Webhook endpoints are TLS-only. No plaintext provider path exists in any configuration.

## 7. What B12 does not claim

B12 does **not** claim: that any provider offers idempotency keys; that any provider's signature scheme includes replay freshness; that IP allow-listing is available or reliable for any Phase-1 provider; that credentials are encrypted at rest by the deployed target; that any compliance, PCI, or data-locality property holds. Each is either recorded as `unknown` in `B12_PROVIDER_RESEARCH_REGISTER.md` or deferred with reasoning, and none is load-bearing.
