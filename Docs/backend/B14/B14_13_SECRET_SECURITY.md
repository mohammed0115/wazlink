# B14_13 — Secret Security

## 1. Secret classes (frozen B13, nine classes)

Provider credentials (WhatsApp access token, app secret, verify token; OpenAI API key; Places key; scraping key + webhook secret; Tap secret/public/webhook keys) · `DJANGO_SECRET_KEY` · database and Redis URLs · storage credentials · session/CSRF material · any `*_REF` resolved value.

## 2. The prohibition list — exhaustive

A secret value must **never** be:

committed to the repository · returned by any API · rendered in the frontend · **rendered in Django Admin (including masked or truncated)** · written to an application log at any verbosity · written to an audit payload · included in a Celery task argument · included in an event payload or outbox row · included in a Sentry event, breadcrumb or context · included in a trace or metric label · stored in a database business row · included in an error message shown to any user or operator · included in `.env.example` · echoed by a management command · present in a test fixture, VCR cassette or snapshot.

This restates B13's exhaustive never-log list; **B14 adds no exception to it.**

## 3. Resolution discipline

Credentials are **`*_REF` names**, resolved **at call time** by the resolver (V1: the process environment). Consequences enforced in review and by tests:

- No domain object, model field, serializer or DTO carries a credential value.
- No Celery payload carries a credential — a task carries the **reference name**, and the worker resolves it at execution.
- No long-lived process variable caches a resolved value beyond the call scope.
- `provider_request_attempts` stores **safe metadata only** — never request/response bodies, credentials or headers (frozen B11/B12 rule).

## 4. Redaction implementation

A single structured-logging processor in `common/` scrubs, on every log record, trace attribute and Sentry event:

1. Known secret **variable names** and their values, sourced from the env contract.
2. Credential-shaped patterns (bearer tokens, long high-entropy strings, `sk-`-style prefixes, signature headers).
3. Frozen never-log field names: `authorization`, `x-hub-signature-256`, `hashstring`, `app_secret`, `verify_token`, `api_key`, `access_token`, `secret_key`.

**Redaction is a safety net, not the control.** The control is that a secret never enters the record in the first place; the processor exists because defence in depth is B13's posture.

## 5. `.env` handling

`.env` is git-ignored and **never** committed. `.env.example` is committed with **names and safe placeholders only**. Credentials reach a server through the deployment mechanism, never through the repository, an image layer, a ticket, a chat message or a screenshot.

Rotation follows frozen B13: issue the replacement at the vendor console → update the reference → restart consumers in a controlled order → audit **metadata only** (actor, timestamp, environment, credential class — **never the value**).

## 6. Leak response

Frozen `B13_RUNBOOKS.md` §"Leaked provider credential": rotate immediately at the provider console, invalidate the prior reference, audit the rotation, and **treat the incident record itself as redacted** — no credential value, no provider host, no raw body in an incident note, ticket or chat log.

## 7. Future secret management

Encrypted secret management (`B13-D-C003`) may replace the environment resolver later. **It is not required for V1**, and because the domain holds only a reference, adopting it changes the resolver alone — no domain object, adapter signature, table or API changes.

## 8. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-SEC-1` **(NC)** | Every provider configured with a known sentinel credential value | Exercise every API endpoint and capture all response bodies | **No response body contains the sentinel, or any substring of it ≥ 4 characters** |
| `T-SEC-2` **(NC)** | Sentinel credentials; logging at maximum verbosity | Exercise every provider call, webhook, task and error path | **No log record contains the sentinel or any fragment**; never-log field names never appear with values |
| `T-SEC-3` **(NC)** | Sentinel credentials | Inspect every `audit_logs` row, event payload, `outbox_events` row and Celery task argument produced | **None contains a credential value.** A task carries the **reference name** only |
| `T-SEC-4` **(NC)** | Sentinel credentials; staff session | Render **every** Django Admin page including Integration Operations, and read the raw HTML | **No sentinel, no prefix, no length, no masked or truncated fragment** — in body, form field, tooltip, page-source comment or Django message |
| `T-SEC-5` **(NC)** | Repository | Scan `.env.example` for credential-shaped patterns; check `.gitignore` | **No credential-shaped value**; `.env` is ignored and untracked |
| `T-SEC-6` **(NC)** | Provider returns `401` with a body echoing the credential | Surface the error to an operator and to the API | **Sanitized**: `error_code`, `error_reason`, `http_status`, `provider_code` only — **no credential fragment, no raw body** |
| `T-SEC-7` **(NC)** | Each platform-critical variable invalid in turn | Start the process and capture the failure message | **Names the variable, never its value or any fragment** |

**All seven are negative controls and all seven run in the permanent security-regression gate on every slice**, not only I15.
