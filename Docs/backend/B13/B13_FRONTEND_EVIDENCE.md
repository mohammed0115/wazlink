# B13 — Frontend Evidence

> Design only. Inspects the frozen frontend (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`) as evidence, never as authority, per `BACKEND_WORKSPACE_AUTH.md` ("Frontend compatibility") and the identical discipline B8/B10/B11/B12 already applied. Backend security and operations authority is fixed by B0–B12 and this pack; the frontend only corroborates or scopes UI-facing requirements.

## 0. Verification note

`client/` in the current working tree is confirmed byte-identical to the frozen reference SHA — `git log -1 --format=%H -- client` returns `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` exactly, the same commit already cited by B1–B12. Findings below are read directly from that tree.

## 1. Classification method

Identical to B8/B10/B11/B12: **A** = must be preserved or directly shapes a B13 backend contract; **B** = derivable/informative, non-binding; **C** = placeholder/presentation only; **D** = intentionally unsupported/deferred, informative by its absence. Each row carries a `FB-B13-###` ID, file:line citation, observed behavior, and classification.

## 2. Class A — backend-contract-shaping (11)

| ID | Source | Observed behavior | B13 interpretation |
|---|---|---|---|
| `FB-B13-001` | `features/auth/Login.tsx:12-34,79-81` | "Remember me" checkbox rendered but its value is never read by the submit handler | Session-duration policy is entirely a backend decision; the frontend carries zero contract for it (`B13_AUTHENTICATION_SESSION_SECURITY.md` §7) |
| `FB-B13-002` | `services/index.ts:138-140`, `AppProviders.tsx:50-58`, `Sidebar.tsx:96-102` | `signOutMock` exists but is called by zero components; the only plausible trigger has no `onClick` | No frontend evidence for a logout UX exists at all; B13's logout/session-revocation design is backend-only |
| `FB-B13-003` | `App.tsx:118-166`, `useHashRoute.ts:11,42-44` | Route rendering has no `signedIn` check anywhere; only a 3-item public-route allowlist gates auth screens | **The shipped client performs zero client-side authorization enforcement.** B13's session/authorization model must be 100% backend-enforced |
| `FB-B13-011` | `features/settings/Settings.tsx:337-388`, `domain/data.js:1027,298` | The only "Security & Privacy" screen persists `dataResidency` and `externalAiAccess` plus the `sessionPolicy` fixture; audits only changed fields | The genuine security-settings surface is a privacy/data-residency toggle, not session/credential management; diff-only audit is a reusable convention (`B13_AUDIT_LOGGING.md` §2) |
| `FB-B13-013` | `features/settings/Integrations.tsx:1-8,199-212`, `domain/data.js:1033` | Header comment states no OAuth/API-keys/provider-request/webhook exist client-side; secret field is permanently `disabled readOnly`; only `hasConfiguredSecret` boolean persists | Independently re-confirms B12's "no secret round-trips to the client" finding by direct read (`B13_SECRETS_MANAGEMENT.md` §5) |
| `FB-B13-014` | `domain/data.js:1031-1034,1059` | Guarded mutators refuse actions on `disabled`/`error` status; a self-test mechanically asserts no integration row ever carries a secret/token/apiKey field | The product's own code enforces the no-secret-on-client invariant, not just a comment |
| `FB-B13-015` | `features/settings/Billing.tsx:251-254`, `domain/data.js:328` | Payment method renders/stores only `{brand} ·•••• {last4}`; no field for a full card number exists in the fixture | Confirms "never persist a PAN" at the data-model level, reusable for `B13_PAYMENT_FINANCIAL_SECURITY.md`'s PCI-scope-avoidance framing |
| `FB-B13-016` | `features/settings/Checkout.tsx:1-8,146-161`, `domain/data.js:1056` | All checkout steps show masked brand+last4 only; a self-test mechanically confirms no cardNumber/PAN/CVV/expiry field ever exists | Second independent corroboration that card data never touches this client |
| `FB-B13-020` | `features/inbox/Inbox.tsx:2-7,70-76,405-415,444-447` | Messaging is human-only by construction; header states no API/webhook/auto-reply exists; composer disabled whenever `conversation.status !== "open"` | The write-guard-on-state pattern (composer disabled on non-open conversation) is the frontend's own version of a state-machine guard B13 replicates server-side (`B13_INPUT_OUTPUT_SECURITY.md` §4) |
| `FB-B13-022` | `shared/components/ErrorBoundary.tsx:12-44` | Crash isolation logs only to `console.error`; comment states no external monitoring service is called | **Zero client-side error telemetry ships today.** B13's observability design (`B13_OBSERVABILITY.md`) has no legacy client consumer shape to preserve |
| `FB-B13-024` | `features/discovery/DiscoveryModal.tsx:53-88` | The one confirmation dialog in the entire client is a **soft-cancel** ("retained as cancelled, never deleted"), not a delete confirmation | B13's destructive-action confirmation UX (workspace delete, member removal) has no frontend precedent to match — it is designed fresh in `B13_OPERATOR_MODEL.md` §4, informed by this soft-transition convention |

## 3. Class B — derivable/informative (8)

| ID | Source | Observed behavior | B13 interpretation |
|---|---|---|---|
| `FB-B13-004` | `domain/data.js:3,298` | `uiState` defaults `signedIn:false`; `securitySettings` groups `sessionPolicy` with the two privacy toggles | Corroborates the `session_only_mock` fixture cited in B1 |
| `FB-B13-006` | `AppProviders.tsx:41-48`, `Sidebar.tsx:23-27`, `services/index.ts:122-128` | Exactly one workspace is modeled; no switcher UI exists | No frontend constraint on workspace-switching UX; `B1_AUTH_SESSION_DESIGN.md` §4.3's `SwitchWorkspace` design stands unconstrained |
| `FB-B13-009` | `features/settings/Settings.tsx:221-256` | Existing members expose only active/inactive toggle; role is settable only at invite time, never changed after | Role-reassignment admin action (`ChangeMemberRole`, `FI-B1-08`) has no conflicting legacy UI shape to reconcile |
| `FB-B13-010` | `features/settings/Settings.tsx:257-304`, `domain/data.js:1025` | Invitation creates a durable `pending_mock` record; explicitly sends no email | Invitation-email delivery is a pure backend addition, evidenced as expected-missing rather than contradicted |
| `FB-B13-012` | `features/settings/Settings.tsx:107-169`, `shared.tsx:51-73` | Workspace-profile form writes through `mutate()` and renders its own capped `AuditList` | Reusable settings-change-writes-audit-row convention |
| `FB-B13-021` | `features/inbox/Inbox.tsx:385-401` | Failed send shows only a generic toast; no rate-limit/throttle/cooldown UI exists anywhere (confirmed by targeted search) | No frontend expectation of a distinct 429 presentation; `B13_RATE_LIMIT_ABUSE_MODEL.md`'s messaging limits are backend-only with no legacy UI to break |
| `FB-B13-023` | `shared/components/States.tsx:1-40`, `shared/store/toast.tsx` | Loading/Empty/Error primitives plus a transient, auto-dismissing toast are the sole error vocabulary; no persistent error log exists | Any backend-driven error surface should assume a transient, single-shot presentation model, not a dismissable inbox |
| `FB-B13-026` | `features/settings/shared.tsx:51-73` | One `AuditList` component, capped to 6 rows, reused across workspace/integrations/billing | No shipped consumer requires a paginated/filterable audit view; `B13_AUDIT_LOGGING.md`'s API surface is unconstrained by legacy UI |

## 4. Class C — placeholder/presentation only (4)

| ID | Source | Observed behavior |
|---|---|---|
| `FB-B13-005` | `features/auth/Login.tsx:82-89` | "Forgot password" is a ghost button producing only a toast; no recovery flow was ever built, even superficially |
| `FB-B13-007` | `Sidebar.tsx:96-102` vs `services/index.ts:130-137` | Sidebar hardcodes a display name rather than reading the session snapshot; both resolve to the same single mock actor — presentation drift only |
| `FB-B13-017` | `features/settings/Billing.tsx:277-281` | Invoice download button is permanently disabled ("not available") |
| `FB-B13-019` | `features/inbox/Inbox.tsx:416-440` | The messaging "attachment" is a hardcoded literal filename/size, never a real `File` object |

## 5. Class D — intentionally unsupported/deferred (3)

| ID | Source | Observed behavior |
|---|---|---|
| `FB-B13-008` | `features/settings/Settings.tsx:171-219` | Account section has no password field or change-password action at all; email field permanently disabled |
| `FB-B13-018` | repo-wide search for `type="file"` across `client/src` | Zero matches anywhere — independently re-confirms B11's "no file upload UI" finding by exhaustive search |
| `FB-B13-025` | repo-wide search for `window.confirm`/`confirm(` plus feature review | Zero native-confirm matches; no delete-workspace/remove-member/archive-with-confirmation UI exists anywhere |

## 6. Classification counts

`FRONTEND_EVIDENCE_COUNT = 26`. `FRONTEND_EVIDENCE_CLASS_COUNTS`: A = 11, B = 8, C = 4, D = 3 (11 + 8 + 4 + 3 = 26, mechanically re-derived in `B13_VERIFICATION_MATRIX.md` §2).

## 7. What this confirms about backend security requirements

The single most consequential finding is negative: **the shipped client performs no client-side authentication or authorization enforcement whatsoever.** `signedIn` is tracked in state but read by no route guard; `signOutMock` is wired but triggered by no UI; there is no session-expiry, re-auth, or 401-handling surface anywhere. Combined with the absence of any rate-limit UI (`FB-B13-021`), any file-upload UI (`FB-B13-018`), any credential/password-management UI (`FB-B13-008`), and any hard-delete confirmation pattern (`FB-B13-025`), the frontend evidence tells B13 that the entire security and operations surface — session lifecycle, authorization, secret handling, rate limiting, and destructive-action safety — must be specified as a pure backend concern with no legacy client behavior to preserve or reconcile against. The frontend's only genuine, positive constraints are the masking/no-secret invariants already product-committed (`FB-B13-013/014/015/016`) and the audit-per-settings-change convention reused three times (`FB-B13-011/012/026`). Per `BACKEND_WORKSPACE_AUTH.md`, none of this frontend evidence is treated as security authority — it is corroboration only, and every control in this pack is derived from B0–B12.
