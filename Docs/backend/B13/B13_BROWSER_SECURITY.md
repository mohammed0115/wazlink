# B13 — Browser Security & Boundary

> Design only. Production browser-facing security expectations, compatible with the actual React SPA architecture confirmed by frontend evidence (`B13_FRONTEND_EVIDENCE.md`). CSP is derived from the SPA's actual asset/API shape, not invented abstractly.

## 1. Inherited from `B13_DJANGO_DRF_SECURITY_BASELINE.md`

HTTPS/HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, secure cookies, CSRF, CORS allow-list — all fixed in that document (§§2–7) and not restated in full here.

## 2. Content-Security-Policy — derived, not invented

The frozen frontend is a single-page React application (`V2_ARCHITECTURE.md`, `V2_FRONTEND_STRUCTURE.md`) served as static assets, calling the backend API same-origin (or a trusted subdomain per `CSRF_TRUSTED_ORIGINS`). Frontend evidence confirms: no external script tag beyond the SPA's own bundled JS, no third-party payment-gateway SDK (`FB-B13-015`/`016`: checkout is entirely local simulation with no gateway script), no external error-reporting script currently wired (`FB-B13-022`: `ErrorBoundary` logs only to `console.error`).

| Directive | Proposed value | Rationale |
|---|---|---|
| `default-src` | `'self'` | no legitimate cross-origin fetch target beyond the API itself |
| `script-src` | `'self'` | the SPA bundle only; no inline script, no third-party script (no payment SDK is embedded — confirmed by frontend evidence) |
| `style-src` | `'self'` (plus `'unsafe-inline'` **only if** the build tooling emits inline styles — a build-tooling fact to confirm at implementation time, not asserted here) | |
| `img-src` | `'self' data:` | avatar/asset images; `data:` for any inlined SVG/icon the build emits |
| `connect-src` | `'self'` plus the API origin if served from a distinct subdomain | the SPA's only network calls are to its own backend |
| `frame-ancestors` | `'none'` | matches `X-Frame-Options: DENY`; OWASP's HTTP Headers Cheat Sheet notes CSP's `frame-ancestors` directive *"obsoletes X-Frame-Options for supporting browsers"* (`B13-X-006`, VERIFIED) |
| `object-src` | `'none'` | no plugin content is ever legitimate |
| `base-uri` | `'self'` | prevents a base-tag injection redirecting relative URLs |
| `form-action` | `'self'` | the SPA has no legitimate cross-origin form submission target |

**Once a real payment gateway is integrated** (Tap's hosted checkout, if it involves an embedded script or iframe rather than a pure redirect — this is an implementation-time fact, `B13-D-C010`, Class C), `script-src`/`frame-src` require an explicit, minimal addition scoped to Tap's documented hosted-checkout origin only, never a broad third-party allowance. This document does not pre-authorize that addition without the confirmed integration shape.

## 3. Secure cookies and CSRF in the browser context

Already fixed (`B13_AUTHENTICATION_SESSION_SECURITY.md` §3). The browser-security-specific note: `SameSite=Lax` is defense-in-depth, not the primary CSRF control (`FI-B0-01`) — the primary control is the explicit CSRF token, required because `Lax` alone does not block a cross-site GET-triggered state change or certain top-level-navigation edge cases.

## 4. CORS — browser-enforced half

Restated from `B13_DJANGO_DRF_SECURITY_BASELINE.md` §7: an explicit origin allow-list, `Access-Control-Allow-Credentials: true` never paired with a wildcard origin. The browser enforces the actual block; the server-side allow-list is what determines whether the browser is ever told it may proceed.

## 5. Compatibility with the actual SPA

Given the SPA performs **zero client-side authorization enforcement** (`FB-B13-003`), the browser-security boundary is entirely about protecting the **transport and the session**, not about the SPA's own route-guarding logic — every meaningful security decision is server-side, and the browser-security controls in this document exist to prevent the transport layer (cookies, cross-origin requests, injected scripts) from being used to attack that server-side enforcement, not to compensate for a client-side gap that does not need compensating (the server never trusted the client's route-guarding in the first place, `FI-B1-04`).

## 6. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13CSP-1` | Every response carries the CSP header from §2 |
| `AT-B13CSP-2` | An injected `<script src="https://attacker.example/x.js">` is blocked by `script-src 'self'` in a browser-driven test |
| `AT-B13CSP-3` | The SPA is not renderable inside an `<iframe>` from a foreign origin |
| `AT-B13COOKIE-1` | Session and CSRF cookies are never sent on a cross-site top-level navigation from an untrusted origin (`SameSite=Lax` verification) |
| `AT-B13COOKIE-2` | The **session** cookie is not readable from injected JavaScript (`HttpOnly` verification, cross-referenced with `AT-B13SESS-5`). The **CSRF** cookie is deliberately readable: frozen B1 fixes CSRF as a "separate CSRF cookie/header pair on every unsafe request" (`B1_AUTH_SESSION_DESIGN.md`), which requires the SPA to read the token in order to echo it in the header. `CSRF_COOKIE_HTTPONLY` is therefore **not** set — setting it would make `AT-B13CSRF-2` unsatisfiable and break every unsafe request. The CSRF cookie carries a token, never the session key, and its confidentiality is not what stops CSRF: the header echo is |
| `AT-B13COOKIE-3` | Neither cookie is transmitted over plain HTTP (`Secure` verification) |
