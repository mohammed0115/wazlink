# B13 — Django/DRF Production Security Baseline

> Design only. Implementation-ready settings baseline. Every value below is classified as a **required production invariant**, an **environment-specific value**, or a **deployment decision** — B13 does not blindly freeze an unsafe default, and does not invent a value that depends on infrastructure not yet chosen.

## 1. Classification legend

| Class | Meaning |
|---|---|
| **INVARIANT** | must hold in every production deployment; a violation is a release blocker |
| **ENV-SPECIFIC** | correct value depends on the environment (dev/test/staging/production) but the *mechanism* is fixed |
| **DEPLOYMENT** | depends on infrastructure choice (reverse proxy, CDN, hosting) made in `B13_DEPLOYMENT_SECURITY.md` |

## 2. Core Django settings

| Setting | Production value | Class | Rationale |
|---|---|---|---|
| `DEBUG` | `False` | **INVARIANT** | `DEBUG=True` in production leaks stack traces, settings values, and SQL — the single most common Django production incident. Startup validation refuses to serve if `DEBUG=True` and `ENVIRONMENT=production` simultaneously (`B13_CONFIGURATION_MANAGEMENT.md` §4) |
| `SECRET_KEY` | ≥50-character random value, unique per environment, sourced from the secret store (`B13_SECRETS_MANAGEMENT.md` §2) | **INVARIANT** (mechanism) / **ENV-SPECIFIC** (value) | Signs sessions, CSRF tokens, password-reset tokens indirectly; a shared or weak key invalidates every session-security control in `B13_AUTHENTICATION_SESSION_SECURITY.md` |
| `ALLOWED_HOSTS` | explicit list of the production domain(s); never `["*"]` | **INVARIANT** (no wildcard) / **ENV-SPECIFIC** (values) | prevents HTTP Host-header injection into password-reset links and cache-poisoning-adjacent attacks; Django's own docs: *"Django now requires that you set `ALLOWED_HOSTS` explicitly rather than relying on web server configuration"* (`B13-X-002`, VERIFIED) |
| `CSRF_TRUSTED_ORIGINS` | explicit scheme+host list matching the SPA's origin(s) | **ENV-SPECIFIC** | required for any cross-scheme (http→https) or cross-subdomain POST from the SPA; must never include a wildcard subdomain unless the product genuinely serves multiple trusted subdomains |

## 3. Reverse-proxy trust and header spoofing

WazLink is deployed behind a reverse proxy (`B13_DEPLOYMENT_SECURITY.md` §2). Django must be told exactly which header carries the real scheme and must not trust it unconditionally.

| Setting | Production value | Class | Rationale |
|---|---|---|---|
| `SECURE_PROXY_SSL_HEADER` | `("HTTP_X_FORWARDED_PROTO", "https")` **only if** the proxy is configured to strip any client-supplied `X-Forwarded-Proto` and always set it itself | **DEPLOYMENT** | Django trusts this header unconditionally once configured — if the proxy ever forwards a client-controlled value, an attacker can force Django to believe an HTTP request was HTTPS, bypassing `SECURE_SSL_REDIRECT` and defeating `Secure`-cookie enforcement server-side logic. Django's own security documentation warns exactly this: *"If necessary, set `SECURE_PROXY_SSL_HEADER`, ensuring that you have understood the warnings there thoroughly. Failure to do this can result in CSRF vulnerabilities, and failure to do it correctly can also be dangerous!"* (`B13-X-001`, VERIFIED). The proxy configuration that guarantees stripping is a `B13_DEPLOYMENT_SECURITY.md` §2 requirement, not optional |
| `USE_X_FORWARDED_HOST` | `True` only if the proxy similarly guarantees the header | **DEPLOYMENT** | same spoofing risk as above, for `Host` |
| Trusted proxy count | exactly one hop (the deployment's own reverse proxy) — Django has no built-in concept of "trust the Nth proxy," so this is enforced by network topology (the app process accepts connections only from the proxy, never directly from the internet) | **DEPLOYMENT** | see `B13_DEPLOYMENT_SECURITY.md` §3 for the network-segmentation requirement this depends on |

## 4. Transport and HSTS

| Setting | Production value | Class | Rationale |
|---|---|---|---|
| `SECURE_SSL_REDIRECT` | `True` | **INVARIANT** | every HTTP request is redirected to HTTPS before touching application logic |
| `SECURE_HSTS_SECONDS` | start at `300` (5 minutes) for the first production rollout, escalate to `31536000` (1 year) once TLS configuration is proven stable over several deploys | **DEPLOYMENT** (initial default), escalates over time | a long HSTS value is very hard to undo if TLS is ever misconfigured — the standard safe rollout is short-then-long, not long-from-day-one. Django's own documentation confirms the three HSTS settings (`SECURE_HSTS_SECONDS`/`_INCLUDE_SUBDOMAINS`/`_PRELOAD`) but does not itself prescribe this escalation cadence — it is general web-security operational practice, recorded honestly as `PARTIAL` rather than attributed to Django (`B13-X-003`) |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` once the escalated value is reached, **not** during the short initial window | **DEPLOYMENT** | protects subdomains, but only after confidence the escalated policy will not need reversal |
| `SECURE_HSTS_PRELOAD` | not enabled in Phase 1 — preload-list submission is effectively irreversible for the domain's lifetime | **B13-D-B005**, Class B | deferred, not rejected; revisit once HSTS has run at the 1-year value without incident |

## 5. Response security headers

| Setting | Production value | Class |
|---|---|---|
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | **INVARIANT** |
| `X_FRAME_OPTIONS` | `DENY` | **INVARIANT** — the SPA is not designed to be framed; no legitimate embedding use case exists |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | **INVARIANT** — Django's default since 3.x; explicit here for completeness |
| `Content-Security-Policy` | see `B13_BROWSER_SECURITY.md` §2 for the derived policy — not fixed here because it depends on the SPA's actual asset/API origins | **DEPLOYMENT** |

## 6. Session and CSRF cookies

Restated from `B13_AUTHENTICATION_SESSION_SECURITY.md` §3 for a single settings-reference location: `SESSION_COOKIE_SECURE=True`, `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE="Lax"`, `CSRF_COOKIE_SECURE=True`, `CSRF_COOKIE_SAMESITE="Lax"`. All four are **INVARIANT**.

## 7. CORS policy

WazLink's frontend is same-origin with the API in the target deployment shape (SPA served from the same domain, or a trusted subdomain listed in `CSRF_TRUSTED_ORIGINS`). Production CORS configuration:

| Rule | Value | Class |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | explicit list, never a wildcard | **INVARIANT** |
| `CORS_ALLOW_CREDENTIALS` | `True` only for origins in the explicit allow-list; **never** `True` combined with a wildcard origin (browsers reject this combination, and relying on the rejection instead of an explicit list is not a design) | **INVARIANT** |
| Public/unauthenticated endpoints (`login`, `health/*`) | may be reachable without CORS credentials if a future public integration needs them; not required for the SPA itself | **B13-D-C002**, Class C — no external consumer identified yet |

## 8. DRF-specific baseline

| Control | Production value | Source |
|---|---|---|
| Default authentication classes | `SessionAuthentication` only; no `BasicAuthentication`, no unauthenticated default | `FI-B0-19` |
| Default permission classes | `IsAuthenticated` globally; per-view overrides only for the three frozen public operations | `FI-B0-19` |
| Renderer | JSON only in production (no browsable API renderer, which would otherwise expose a form-based UI and CSRF-adjacent surface to any authenticated browser session) | **INVARIANT**, B13-D-B029 |
| Throttling | DRF's built-in throttle classes are **not** the authoritative rate-limit mechanism (PostgreSQL/Redis-backed limits in `B13_RATE_LIMIT_ABUSE_MODEL.md` are) — DRF throttling, if used, is a defense-in-depth layer only | B13-D-B006, Class B |
| Exception handler | custom handler mapping every exception to the frozen `ErrorEnvelope` (`FI-B0-18`); never lets a raw exception/traceback serialize to the client | `FI-B0-18` |
| `additionalProperties: false` | enforced on every request serializer (Doctrine R-4) | `FI-B1-07` |

## 9. What this document does not decide

The exact reverse-proxy product (nginx, Caddy, a managed load balancer) and its configuration syntax are deployment implementation, owned by B14. This document fixes the settings Django itself must carry and the trust assumptions those settings depend on; `B13_DEPLOYMENT_SECURITY.md` fixes the proxy-side half of the same contract.

## 10. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13CFG-1`, `AT-B13CFG-2` | canonically defined in `B13_CONFIGURATION_MANAGEMENT.md` §7 (`DEBUG=True` and wildcard-`ALLOWED_HOSTS` startup refusal) — this document's settings in §2 are what those controls verify |
| `AT-B13DEPLOY-3` | canonically defined in `B13_DEPLOYMENT_SECURITY.md` §9 — a forged `X-Forwarded-Proto` reaching the app process directly is not trusted; this document's §3 is what that control verifies |
| `AT-B13CORS-1` | A CORS preflight from an origin not in the explicit allow-list is rejected |
| `AT-B13CORS-2` | `Access-Control-Allow-Credentials: true` is never paired with `Access-Control-Allow-Origin: *` in any response |
| `AT-B13API-1` | Every non-exempt operation returns `401` without a session cookie |
| `AT-B13API-2` | The browsable API renderer is unavailable in a production-configured instance |
| `AT-B13API-3` | An oversized request body is rejected with `413` before deserialization |
| `AT-B13API-4` | An unsupported `Content-Type` on a write operation is rejected with `415` |
