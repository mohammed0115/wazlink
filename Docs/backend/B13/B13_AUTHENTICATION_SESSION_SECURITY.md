# B13 — Authentication & Session Security

> Design only. Preserves `B1_AUTH_SESSION_DESIGN.md` and `B1_AUTHORIZATION_RBAC.md` §1 verbatim (`FI-B1-01`…`FI-B1-05`). B13 adds no new authentication mechanism; it states the production controls, tuning defaults, and operational behaviors around the frozen mechanism.

## 1. What is frozen and restated, not redecided

| Frozen fact | Source |
|---|---|
| Session cookie `sessionid`, `HttpOnly`+`Secure`+`SameSite=Lax`, host-only domain, `Path=/` | `FI-B1-01` |
| Idle expiry 8h, absolute expiry 24h never extended, session key rotated on every login | `FI-B1-02`, `FI-B1-03` |
| Login rate limits `10/min/IP` and `5/min/account`; timing-safe dummy-hash comparison for unknown users | `FI-B0-20`, `FI-B1-03` §3.1 |
| Logout revokes the registry row and destroys the Django session in one transaction; idempotent | `FI-B1-03` §3.2 |
| Password change requires the current password and revokes every other session; reset revokes all sessions | `FI-B1-03` §3.4–3.5 |
| Active-workspace resolution is server-side only (`sessions.active_workspace_id`), never client-supplied | `FI-B1-04` |
| OAuth/MFA/JWT are later phases requiring separate security review (ADR-009) | `FI-B0-09` |

B13 does not alter any value or mechanism in this table. What follows is the production hardening layer around it.

## 2. Password handling boundary

| Control | Requirement | Class |
|---|---|---|
| Hasher | Django's currently-recommended password hasher (PBKDF2/Argon2 per Django's own default at implementation time) — a **B14 implementation-time choice**, not frozen to a specific algorithm here | B13-D-B001 |
| Minimum password policy | length ≥ 10, no composition-rule theater (no forced special-character classes — NIST SP 800-63B: *"No other complexity requirements for memorized secrets SHOULD be imposed,"* `B13-X-004`); a breached-password check at register/change/reset is **recommended**, not Phase-1-required (NIST 800-63B requires verifiers to screen against known-compromised lists, `B13-X-004`) | B13-D-B002 |
| Password storage | hash only, in `user_credentials`; the raw value never appears in a log, audit row, event payload, or error message (`FI-B1-10` Rule P-1) | inherited, Class A |
| Password transmission | HTTPS only, request body, never a query parameter or URL path segment | B13-D-B027 |
| Reset/verification tokens | ≥256-bit CSPRNG, stored only as `sha256`, single-use, short expiry (reset 60 min, verification 72h per `B1_IDENTITY_DATA_MODEL.md` §2) | inherited, Class A |

## 3. Secure cookie flags — production values

| Attribute | Production value | Why not otherwise |
|---|---|---|
| `SESSION_COOKIE_SECURE` | `True` | cookie must never traverse plain HTTP; see `B13_DJANGO_DRF_SECURITY_BASELINE.md` §3 for the TLS-termination assumption this depends on |
| `SESSION_COOKIE_HTTPONLY` | `True` | frozen (`FI-B1-01`) |
| `SESSION_COOKIE_SAMESITE` | `Lax` | frozen (`FI-B1-01`) — `Strict` breaks email-link verify/invitation-accept flows |
| `CSRF_COOKIE_SECURE` | `True` | same transport requirement as the session cookie |
| `CSRF_COOKIE_SAMESITE` | `Lax` | matches the session cookie; `None` would require `Secure` plus a same-site relaxation with no product need |
| `SESSION_COOKIE_AGE` | not Django-default-managed — B1's dual idle/absolute expiry is enforced by the `sessions` registry row, not Django's session-engine expiry alone; Django's own cookie `Max-Age` is set to the absolute-expiry value as a client-side hint only, never trusted as the authority | B13-D-B028 |

## 4. Session invalidation triggers — production completeness

`FI-B1-03` §3.10 enumerates the frozen trigger table (password change/reset, `DisableUser`, `DeleteUser`, `RemoveMember`, `SuspendMembership`, `DeleteWorkspace`, operator action). B13 adds the operational completion of that table for production:

| Trigger | Sessions revoked | Operational note |
|---|---|---|
| Suspected credential compromise reported (support ticket, breach-notification feed) | `RevokeAllSessions` via operator action, `admin_revoke` reason | Runbook: `B13_RUNBOOKS.md` §"Leaked provider credential" does **not** cover user credentials — see `B13_INCIDENT_MANAGEMENT.md` §5 "Authentication compromise" |
| Deployment rotates `SECRET_KEY` | Django's session cookie-signing key change invalidates every existing session cookie signature — this is a deliberate, rare, all-sessions event and must be scheduled, communicated, and never done as a routine deploy step | B13-D-B003 |
| Rate-limit exhaustion pattern consistent with credential stuffing | no automatic session revocation; the account's login is rate-limited (`FI-B0-20`), and `security.credential_stuffing_suspected` fires for operator review | inherited, `FI-B1-09` T19 |

## 5. Idle/absolute lifetime policy and concurrent sessions

Both numeric windows (8h idle / 24h absolute) are **Class B, tunable in production** per `B1-D-007` — B13 does not change the mechanism (dual expiry, non-extending absolute bound, registry-backed revocation) and treats the numbers as environment configuration, not architecture. Concurrent sessions remain unlimited and individually enumerable/revocable (`FI-B1-03`) — B13 adds no session-count ceiling because none is a security requirement once idle/absolute expiry and per-session revocation exist; a ceiling would only convert a legitimate multi-device user into a support ticket.

**Suspicious session handling** (B13-additive, Class B — no code exists to detect this in Phase 1, and B13 does not invent detection logic): a session whose IP-hash or user-agent digest changes materially mid-session is *not* automatically revoked (IP change is normal on mobile networks and VPNs) but is a candidate signal for a future anomaly-detection feature, explicitly deferred (`B13-D-B004`). Phase 1 relies on the existing controls: short-lived sessions, per-session visibility (`GET /auth/sessions`), and user-initiated revocation.

## 6. Email verification and workspace access

`FI-B1-05` step 4 (`email_verified_at` required unless verification-exempt) is preserved unchanged. Production adds no new verification-exempt operation beyond the frozen list without a controlled amendment.

## 7. MFA — explicit future classification

**MFA is not Phase-1 authority.** Per ADR-009 (`FI-B0-09`), it is recorded as a **future security enhancement**, Class C in `B13_DECISION_REGISTER.md` (`B13-D-C001`), and no B13 control depends on its existence. If added later, the pipeline's step-4/step-8 insertion points (`FI-B1-05`) already accommodate an additional factor check without re-architecture, mirroring how `B1_AUTHORIZATION_RBAC.md` §5 reserves step 15 for future step-up re-authentication.

## 8. Session revocation on membership/workspace state change

Restated from `FI-B1-03` §3.10 and `FI-B1-04` §4.4 because it is the control most often broken by naive implementations: membership suspension and removal **do not** revoke the user's session outright — the session re-resolves to a remaining eligible workspace or, only if none remains, is revoked (`session.revoked_no_workspace`). B13 states the production consequence: **a workspace admin cannot use `RemoveMember`/`SuspendMembership` as a cross-tenant denial-of-service against a user who also belongs to another workspace** (`FI-B1-09` T22). This is verified by `AT-B13SESS-6`.

## 9. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13AUTH-1` | Login with wrong password, unknown email, and a disabled account all return byte-identical `401` bodies within a bounded timing window |
| `AT-B13AUTH-2` | Exceeding `10/min/IP` or `5/min/account` returns `429` with `Retry-After`; the account-scoped limit trips even from rotating source IPs |
| `AT-B13AUTH-3` | A pre-login session cookie is destroyed on successful login (session-fixation negative control) |
| `AT-B13AUTH-4` | Password change revokes every other session but not the acting session, and rotates the acting session's key |
| `AT-B13AUTH-5` | Password reset confirmation revokes **all** sessions including the one that requested the reset |
| `AT-B13AUTH-6` | A logged-out session cookie replayed after logout returns `401 SESSION_REVOKED`, never `401 AUTH_REQUIRED` |
| `AT-B13SESS-1` | `GET /auth/sessions` never returns another user's session, raw IP, or raw user agent |
| `AT-B13SESS-2` | Idle expiry is not extended by activity past the absolute expiry bound |
| `AT-B13SESS-3` | Revoking a session from a second device invalidates the first device's cookie on its next request |
| `AT-B13SESS-4` | `RevokeAllSessions` is idempotent and returns `204` on a caller with zero remaining sessions |
| `AT-B13SESS-5` | A cookie is never readable from injected JavaScript (`HttpOnly` verification) in a browser-driven test |
| `AT-B13SESS-6` | A user in workspaces W1+W2, removed from W1 while active on W1, continues the same session on W2 without re-login |
| `AT-B13SESS-7` | `SECRET_KEY` rotation invalidates all existing session cookies; this is documented as a scheduled, communicated operation in `B13_RUNBOOKS.md`, never a silent side effect of routine deployment |

## 10. What B13 does not invent

No persistent "remember me" mechanism (frozen frontend fixture is `session_only_mock`, `FI-B1-02`), no device-fingerprinting authority beyond the coarse `user_agent_label`, no IP-based geofencing, and no automatic account lockout beyond rate limiting (a hard lockout is a self-inflicted denial-of-service vector against the account owner and is explicitly not adopted).
