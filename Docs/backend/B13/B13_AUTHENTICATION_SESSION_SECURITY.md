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
| Minimum password policy | **length ≥ 15** for Phase-1 single-factor login; no composition rules; blocklist screening against known-compromised passwords at register/change/reset; no periodic expiry; no KBA/security questions; no unauthenticated-readable hint; maximum length ≥ 64 accepted. Derived from current **NIST SP 800-63B-4** §3.1.1.2 (`B13-X-004`) — see §2a for the requirement-versus-choice split | B13-D-B002 |
| Password storage | hash only, in `user_credentials`; the raw value never appears in a log, audit row, event payload, or error message (`FI-B1-10` Rule P-1) | inherited, Class A |
| Password transmission | HTTPS only, request body, never a query parameter or URL path segment | B13-D-B027 |
| Reset/verification tokens | ≥256-bit CSPRNG, stored only as `sha256`, single-use, short expiry (reset 60 min, verification 72h per `B1_IDENTITY_DATA_MODEL.md` §2) | inherited, Class A |

### 2a. Password policy — what NIST requires, what WazLink chooses, what is deferred

**Corrected under `B13-FIX.1`.** The pre-FIX.1 policy (length ≥ 10, blocklist screening "recommended, not Phase-1-required") was derived from **NIST SP 800-63B (2020)**, which was withdrawn and superseded by **SP 800-63B-4** (final, 2025-07-31). Two of the guidance items B13 relied on changed materially, and one WazLink choice sat below the superseded figure as well as the current one.

**(1) What current NIST actually requires** — SP 800-63B-4 §3.1.1.2, verbatim in `B13-X-004`:

| # | Current NIST | Force | Changed from the stale source? |
|---:|---|---|---|
| 1 | Single-factor passwords ≥ **15** characters | SHALL | **Yes** — was 8 |
| 2 | Passwords used only within MFA ≥ 8 characters | MAY be shorter, SHALL ≥ 8 | New shape; irrelevant to Phase 1, which has no MFA |
| 3 | No other composition rules (character-class mixtures) | **SHALL NOT** | **Yes** — strengthened from SHOULD NOT |
| 4 | No periodic forced password change; force one on evidence of compromise | **SHALL NOT** / SHALL | **Yes** — strengthened from SHOULD NOT |
| 5 | Compare against a blocklist of commonly-used/expected/compromised passwords | SHALL | Unchanged in force |
| 6 | No KBA or security questions when choosing passwords | SHALL NOT | Explicit in the current edition |
| 7 | No hint readable by an unauthenticated claimant | SHALL NOT | Unchanged |
| 8 | Accept maximum length ≥ 64; accept printing ASCII, space, and Unicode | SHOULD | Unchanged |

**The 15-character SHALL applies to WazLink Phase 1.** Phase-1 login is single-factor by design, so the MFA-conditional 8-character floor is not available. This follows from the source, not from any new MFA position: **MFA remains `B13-D-C001`, a Class C future enhancement, and `B13-FIX.1` does not introduce, require, or schedule it.** The 8-character floor becomes available only if and when MFA is separately decided on its own merits.

**(2) What WazLink chooses — Class B target design (`B13-D-B002`)**

| Choice | Value | Basis |
|---|---|---|
| Minimum length | **15** | Adopts NIST item 1 rather than deviating from the pack's own cited authority. Supersedes the previous ≥ 10, which matched neither the current nor the superseded edition's rationale |
| Maximum length | ≥ 64 accepted, ASCII + space + Unicode | NIST items 8 |
| Composition rules | none | NIST item 3 |
| Periodic expiry | none | NIST item 4 |
| Forced change on evidence of compromise | yes, reusing the frozen revocation path (`FI-B1-03`) | NIST item 4; no new mechanism |
| KBA / security questions | none anywhere in the product | NIST item 6 |
| Password hints | none | NIST item 7 |
| Blocklist screening at register/change/reset | **required, not merely recommended** | NIST item 5 is a SHALL; the pre-FIX.1 downgrade to "recommended" was a silent deviation from the very source cited to justify the rest of the policy |

Because this is Class B (target design, not an inherited frozen fact), the length figure is changeable by a recorded decision. It is **not** changeable silently: a lower minimum is available only as an explicitly recorded deviation naming its approver and its compensating control, never by quietly restoring a smaller number.

**(3) What remains future implementation / security hardening**

Deferred, and deliberately not promoted to Phase-1 requirements here: the blocklist **product** choice (a local curated list, a k-anonymity range API, or an offline corpus) and its refresh cadence; rate-limiting and abuse handling for the blocklist lookup path; passphrase-oriented UX guidance and a strength meter; MFA (`B13-D-C001`, untouched); and migration of existing accounts created under a shorter minimum — which is an implementation-phase question about when to force an upgrade, not a design question B13 answers. None of these blocks Phase-1 architecture; all are named so an implementer cannot mistake silence for absence.

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
| Suspected credential compromise reported (support ticket, breach-notification feed) | **`DisableUser`** (frozen actor: platform operator) revokes **every** session of that user with reason `user_disabled` (`B1_STATE_MACHINES.md` transition `DisableUser`/`DeleteUser` → `revoked(user_disabled)`); where the account must remain enabled, the frozen operator path is **targeted per-session revocation** with reason `admin_revoke` (`B1_AUTH_SESSION_DESIGN.md` §3.10). A forced password reset independently revokes all sessions on confirmation. **`RevokeAllSessions` is not an operator path** — frozen B1 fixes its actor as `self` (`B1_COMMAND_EVENT_CATALOG.md`), its permission as `session.self.manage` ("own sessions only"), and its reason as `global_logout`; B13 mints no operator bulk-revocation command | Runbook: `B13_RUNBOOKS.md` §"Leaked provider credential" does **not** cover user credentials — see `B13_INCIDENT_MANAGEMENT.md` §2.2 "Authentication compromise" |
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
| `AT-B13AUTH-7` | A password below the single-factor minimum length, or one present on the known-compromised blocklist, is rejected at register, change, and reset with zero account mutation and no disclosure of which check failed in a way that confirms account existence |
| `AT-B13AUTH-8` | A passphrase at or above the minimum length composed only of lowercase letters and spaces is accepted, and a 64-character password is accepted — proving no composition rule is imposed and that space and long inputs are honoured |
| `AT-B13SESS-1` | `GET /auth/sessions` never returns another user's session, raw IP, or raw user agent |
| `AT-B13SESS-2` | Idle expiry is not extended by activity past the absolute expiry bound |
| `AT-B13SESS-3` | Revoking a session from a second device invalidates the first device's cookie on its next request |
| `AT-B13SESS-4` | `RevokeAllSessions` is idempotent and returns `204` on a caller with zero remaining sessions |
| `AT-B13SESS-5` | A cookie is never readable from injected JavaScript (`HttpOnly` verification) in a browser-driven test |
| `AT-B13SESS-6` | A user in workspaces W1+W2, removed from W1 while active on W1, continues the same session on W2 without re-login |
| `AT-B13SESS-7` | `SECRET_KEY` rotation invalidates all existing session cookies, and the procedure in `B13_SECRETS_MANAGEMENT.md` §7a is followed — a scheduled, pre-announced operation with a named owner, never a silent side effect of routine deployment |

## 10. What B13 does not invent

No persistent "remember me" mechanism (frozen frontend fixture is `session_only_mock`, `FI-B1-02`), no device-fingerprinting authority beyond the coarse `user_agent_label`, no IP-based geofencing, and no automatic account lockout beyond rate limiting (a hard lockout is a self-inflicted denial-of-service vector against the account owner and is explicitly not adopted).
