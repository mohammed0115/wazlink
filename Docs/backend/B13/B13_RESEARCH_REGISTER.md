# B13 — Research Register

> Design only. Every non-inherited external technical claim this pack makes is cited here, fetched from the source's own official documentation during this authoring pass (2026-09-03). Provider facts already verified by B8/B10/B12 (Meta, Tap, Google Places) are **not** re-fetched here — they are cited by their existing `B*-X-###` IDs (`FI-B12-12`) and are inherited, not re-researched.

## 1. Status legend

`VERIFIED` (read directly from the source's own official documentation during this pass) · `PARTIAL` (the source addresses the topic but not every specific claim made) · `UNRESOLVED` (no readable source established the fact) · `CONTRADICTED`.

## 2. External research findings

| ID | Source | Access date | Claim | Status | Used in |
|---|---|---|---|---|---|
| `B13-X-001` | `docs.djangoproject.com/en/stable/topics/security/` | 2026-09-03 | Django's own security documentation warns: *"If necessary, set `SECURE_PROXY_SSL_HEADER`, ensuring that you have understood the warnings there thoroughly. Failure to do this can result in CSRF vulnerabilities, and failure to do it correctly can also be dangerous!"* — confirming that trusting a forwarded-proto header without a guaranteed-stripping proxy is a genuine, officially-documented risk, not a B13-invented caution | **VERIFIED** | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §3, `B13_DEPLOYMENT_SECURITY.md` §3 |
| `B13-X-002` | same page | 2026-09-03 | *"Django now requires that you set `ALLOWED_HOSTS` explicitly rather than relying on web server configuration"*; Host-header validation applies only via `get_host()` — code reading `request.META` directly bypasses the protection | **VERIFIED** | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §2 |
| `B13-X-003` | same page | 2026-09-03 | The page confirms `SECURE_HSTS_SECONDS`/`SECURE_HSTS_INCLUDE_SUBDOMAINS`/`SECURE_HSTS_PRELOAD` are the three HSTS settings, but **does not itself provide a short-then-long rollout recommendation** — that specific escalation pattern is a general web-security operational practice (widely documented industry guidance, not a Django-specific claim), not asserted here as an official Django recommendation | **PARTIAL** | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §4 |
| `B13-X-004` | `pages.nist.gov/800-63-3/sp800-63b.html` (NIST SP 800-63B, Digital Identity Guidelines) | 2026-09-03 | *"No other complexity requirements for memorized secrets SHOULD be imposed"* and *"Verifiers SHOULD NOT impose other composition rules"*; minimum length 8 characters if user-chosen; verifiers *"SHALL compare the prospective secrets against a list that contains values known to be commonly-used, expected, or compromised"* | **VERIFIED** | `B13_AUTHENTICATION_SESSION_SECURITY.md` §2 (`B13-D-B002`) |
| `B13-X-005` | `docs.sentry.io/platforms/python/data-management/sensitive-data/` | 2026-09-03 | Sentry's `EventScrubber` runs automatically and filters a denylist including passwords, authentication, sessions, cookies, and CSRF tokens by default; an additional PII denylist (e.g., IP addresses) applies unless `send_default_pii` is enabled; `before_send`/`before_send_transaction`/`before_send_span` hooks allow further scrubbing before transmission | **VERIFIED** | `B13_LOGGING_REDACTION.md` §6, `B13_OBSERVABILITY.md` §1 |
| `B13-X-006` | `cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html` (OWASP HTTP Headers Cheat Sheet) | 2026-09-03 | *"Use `Content-Disposition: attachment` to force download instead of inline rendering"*; recommends `X-Content-Type-Options: nosniff`; notes CSP's `frame-ancestors` directive *"obsoletes X-Frame-Options for supporting browsers"* | **VERIFIED** | `B13_FILE_SECURITY.md` §7, `B13_BROWSER_SECURITY.md` §2/§5 |
| `B13-X-007` | `docs.celeryq.dev/en/stable/userguide/security.html` (Celery official security guide) | 2026-09-03 | *"The pickle serializer is convenient... but for the same reasons pickle is inherently insecure, and should be avoided whenever clients are untrusted or unauthenticated"*; JSON has been the default serializer since Celery 4.0; recommends `accept_content = ['json']` to whitelist trusted serializers | **VERIFIED** | `B13_REDIS_CELERY_SECURITY.md` §7 |
| `B13-X-008` | plain landing page at `owasp.org/www-project-secure-headers/` | 2026-09-03 | attempted fetch for CSP-directive-specific guidance; the page is a project hub with no technical content — superseded by `B13-X-006`'s successful fetch of the actual cheat sheet | **UNRESOLVED** (superseded, not blocking — `B13-X-006` covers the same ground from the correct page) | none — recorded for completeness only |

`RESEARCH_FINDING_COUNT = 8`. `RESEARCH_VERIFIED = 6` (`001`, `002`, `004`, `005`, `006`, `007`). `RESEARCH_PARTIAL = 1` (`003`). `RESEARCH_UNRESOLVED = 1` (`008`, superseded). `RESEARCH_CONTRADICTED = 0`. `6 + 1 + 1 + 0 = 8`, confirmed.

## 3. What this register does not re-research

Every provider/platform fact already `VERIFIED`/`PARTIAL`/`UNRESOLVED` in a frozen phase is inherited unchanged and cited by its original ID, never re-fetched or re-classified here: Meta's webhook signature scheme (`B12-X-001`/`002`/`003`/`004`/`014`), Tap's `hashstring` scheme and retry bound (`B12-X-005`/`006`/`007`/`008`), Google Places rate limits (`B12-X-009`), Tap's provider facts (`B8-X-001`…`014`), and ZATCA facts (`B10`'s research register). `B13_FROZEN_INPUT_INVENTORY.md` §5 (`FI-B12-12`) is the pointer to all of them.

## 4. Claims B13 explicitly does not make

- That any specific secret-management product (Vault, AWS Secrets Manager, cloud-provider equivalent) is selected — none is (`B13-D-C003`).
- That Django's own documentation prescribes the specific short-then-long HSTS rollout cadence B13 recommends — that is general industry practice, marked `PARTIAL` (`B13-X-003`), not attributed to Django's official guidance beyond confirming the three settings exist.
- That OpenTelemetry's specific PII-scrubbing mechanics were independently re-verified in this pass — B13 relies on the frozen `FI-B0-12`/`FI-B12-01` requirement that OTel spans exclude sensitive payloads, without re-fetching OpenTelemetry's own documentation; this is recorded as inherited policy, not independently re-verified technical capability, and is **not** claimed as `VERIFIED` in this register.
- That any WazLink deployment currently implements any control this pack describes — every claim is architectural, not an implementation-status assertion.

## 5. Re-verification gate

`B13-X-001` through `B13-X-007` are snapshots of official documentation as read on 2026-09-03, not permanent truths — a future Django/NIST/Sentry/OWASP/Celery documentation revision should be re-checked before `B14` treats any of these as still current, mirroring the identical re-verification discipline `B12_PROVIDER_RESEARCH_REGISTER.md` §4 already established for its own four load-bearing facts.
