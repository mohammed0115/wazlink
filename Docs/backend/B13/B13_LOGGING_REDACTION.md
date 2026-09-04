# B13 — Logging & Redaction

> Design only. Consolidates every domain's own never-log list (B1, B2, B4, B9, B11, B12) into one production logging contract. B13 mints no new exception to any of them.

## 1. Structured log fields — production shape

| Field | Content |
|---|---|
| `timestamp` | UTC, ISO-8601 |
| `level` | standard severity |
| `service`/`component` | which app/worker/adapter emitted the line |
| `environment` | dev/test/staging/production |
| `request_id` | per-HTTP-request |
| `correlation_id` | per-workflow, survives every hop including the webhook rejoin (`FI-B12-05`, `B12-D-A047`) |
| `causation_id` | immediate predecessor |
| `workspace_ref` | when safe (never for a cross-tenant-ambiguous record, `FI-B12-07` class `P-5`/`P-7`) |
| `actor_ref` | when safe — membership or `system:*` |
| `operation` | closed enum per port/domain |
| `result`/`outcome` | closed set |
| `error_code` | the B0/B1/B12 error code |

## 2. Must-redact classes — the exhaustive list

Union of every frozen redaction list (`FI-B0-06`, `FI-B1-10`, `FI-B4-02`, `FI-B9-03`, `FI-B11-01`, `FI-B12-01`):

> password · password hash · session key or its hash · CSRF secret · raw invitation/verification/reset token · an access token, secret key, app secret, verify token, or `hashstring` · an `Authorization` header · a webhook signature, whole or truncated · a provider host, bucket, region, or endpoint URL · a raw provider request or response body · card/PAN/CVV/expiry · bank/IBAN details · customer message content · a phone number outside the owning domain's own contract · a payment instrument detail · file contents, at any level · a file checksum at INFO or below (a hash is a content oracle) · signed URLs or download tickets, complete or truncated · a storage key outside operator-authenticated views · raw `original_filename` at INFO or below · unnecessary personal data (name, email, address) outside the fields a given log line genuinely needs.

**Truncation is not redaction** — a masked token fragment (`sk_***abc`) is treated as a secret, not a safe compromise (`FI-B12-01` §3).

## 3. Always-safe-to-carry fields

Public IDs, opaque provider *references* (never the credential that produced them), closed-enum classes and codes, counts, timestamps, latencies, `workspace_id`, `correlation_id`/`request_id`, size classes (bucketed, never exact byte counts that could fingerprint content), content-type families.

## 4. Sampling and volume strategy

> **Logs MUST NOT become a second data warehouse containing unrestricted customer or provider payloads** (`FI-B0-06`, `FI-B12-05`).

| Traffic class | Sampling |
|---|---|
| Errors | 100% — never sampled away |
| Low-volume financial/provider flows (payment, webhook) | 100%, per `FI-B0-12`'s "sampling is higher for errors and low-volume financial/provider flows" |
| High-volume routine reads (list endpoints, health checks) | sampled; exact rate is a Class B tuning decision (`B13-D-B018`) |
| Audit (`audit_logs`) | never sampled — audit is a durable business record, not telemetry (`FI-B12-05` §6) |

## 5. Redaction enforcement point

Redaction is enforced by an **allow-list at the point of write** — a field is logged/audited only if it appears in an explicit safe-field list for that log statement — never a deny-list scrub applied after construction (`FI-B1-10` §2: "enforced by an allow-list at the audit writer, not by a redaction pass"). This is the same discipline as Doctrine R-4's serializer allow-lists (`FI-B1-07`), applied to the logging boundary instead of the request boundary.

## 6. Sentry / OpenTelemetry

Both inherit the frozen scrubbing rules verbatim (`FI-B0-06`, `FI-B12-01` §4): Sentry captures backend exceptions, job failures, provider error classes, environment, release SHA, request correlation, and **scrubbed** context — never a raw payload. Sentry's own documentation confirms its `EventScrubber` runs automatically and filters a denylist including passwords, authentication, sessions, cookies, and CSRF tokens by default, with `before_send`-class hooks available to extend scrubbing further (`B13-X-005`, VERIFIED) — this corroborates, rather than merely asserts, the frozen "Sentry scrubs PII" requirement. OpenTelemetry traces HTTP/DB/Redis/worker/provider/webhook/payment/reconciliation boundaries **without capturing sensitive payloads** as span attributes. Neither product choice is fixed by this document — see `B13_OBSERVABILITY.md` §1 for the runtime/vendor boundary.

## 7. Error responses

An error crossing the API boundary carries only the frozen safe fields: `category`, `provider_code` (opaque short token), `http_status`, `retryable`, `retry_after`, `provider_request_reference` (`FI-B12-11` §5). Never a stack trace, SQL text, internal exception message, or any item from §2.

## 8. Domain-specific redaction cross-references

Every domain-specific redaction rule already frozen is preserved unchanged and is not re-derived here: CRM free text never leaves its column (`FI-B2-01`), AI provider payloads never retained and phone/website reduced to presence booleans before leaving the boundary (`FI-B4-02`), file contents/checksums/signed URLs (`FI-B11-01`), financial rows never carry payment-instrument detail (`FI-B9-03`), platform/webhook payloads apply the most restrictive handling uniformly since B12 never interprets content semantically (`FI-B12-01` §5).

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13LOG-1` | Scanning every log sink for every item in §2's list returns zero matches under a fuzzed end-to-end test exercising all major flows |
| `AT-B13LOG-2` | A masked token fragment (e.g. last 4 characters of a secret) never appears in any log line |
| `AT-B13LOG-3` | An error response never contains a field outside `FI-B12-11` §5's safe list |
| `AT-B13LOG-4` | Audit rows are never subject to sampling — 100% of security-sensitive events are captured |
| `AT-B13LOG-5` | Sentry/OTel context for a captured exception contains no item from §2 |
| `AT-B13LOG-6` | A log statement's field set is enumerable and reviewable as an allow-list, not discoverable only by runtime inspection |
