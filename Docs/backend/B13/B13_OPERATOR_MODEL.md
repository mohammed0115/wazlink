# B13 — Operator Model

> Design only. Defines platform operational access control around B12's already-frozen operator surface (`FI-B12-03`, `FI-B12-06`). **No unrestricted super-admin escape hatch is introduced.**

## 1. Who may perform platform operations

| Surface | Permission | Role floor |
|---|---|---|
| View integration status (workspace-scoped) | `integration.manage` | Owner/Admin (Manager conditional per frozen matrix) |
| Configure/enable/disable a workspace-scoped provider | `integration.manage` | Owner/Admin |
| Configure a global-scope provider (Places, AI Gateway, storage) | **not workspace-administrable at all** | platform operator only (`B12-D-A043`) |
| View dead letters / reconciliation cases | `platform.operations.view` | Owner/Admin |
| Replay a dead letter / resolve a reconciliation case | `platform.operations.replay` | Owner allow, **Admin conditional — never for a `billing`/`finance` owning-domain record**, which requires Owner (`FI-B9-02`, `B13_PAYMENT_FINANCIAL_SECURITY.md` §7) |
| Applicability/ZATCA changes | `tax.applicability.manage`/`zatca.manage` | Owner-only for applicability (`FI-B10-02`) |
| Financial recognition/reversal | `revenue.recognize`/`revenue.reverse` | Owner/Admin only, always a named human membership |

## 2. Separation from workspace admins

Platform operators (global-scope configuration, cross-workspace incident response) are a **distinct principal class** from workspace Owners/Admins. A workspace Admin's authority is bounded to their own workspace by Doctrine R-1 regardless of role (`FI-B1-07`); a platform operator's authority (where it exists at all — B12 grants only `platform.operations.view`/`.replay`, both still workspace-scoped per-record) never grants cross-workspace business authority. **Django superuser, if it exists operationally, is explicitly NOT a normal business-authorization mechanism** (`FI-B0-14`) — it is internal operational access for schema-level administration, never a path that bypasses audit, tenant, or financial controls.

## 3. Least privilege and sensitive-operation confirmation

| Action class | Confirmation requirement |
|---|---|
| Ordinary read (dead-letter list, reconciliation list) | none beyond RBAC |
| Replay / reconciliation repair | **mandatory non-empty reason** (frozen `ReplayRequest`, `FI-B12-15`), *and* re-runs **every** guard the original command had — state, idempotency, frozen attempt budgets, entitlement, tenant authorization, provider enablement (`FI-B12-06` §5); no shortcut path |
| Abandon a dead letter / dismiss a reconciliation case | **mandatory reason field** (`FI-B12-06`, `FI-B12-07`) |
| Applicability change (ZATCA) | Owner-only permission, structurally separated from routine `tax.manage` (`FI-B10-02`) |
| Global-scope provider rotation | platform-operator tier, audited at elevated sensitivity |

## 4. Reason requirement and audit

Every **replay**, abandon, dismiss, override, and applicability-change action requires a non-empty `reason` field before it is accepted — enforced at the command layer, not merely encouraged (`FI-B12-06`, `FI-B12-15`, `FI-B10-02`). Replay is included because frozen B12 already puts it there: `ReplayRequest` is specified as `{ reason: string (required, non-empty) }` because "a replay re-invokes a real provider effect, so it is reason-required exactly as `B10-D-A016` and `B11` require for privileged state changes." A human-initiated re-execution of a real provider effect is a privileged state change, and it carries the same justification burden as abandoning one. Every operator action is audited with a distinguishable operator/system actor (`FI-B1-09` T24: "Assert every operator-capable mutation writes an audit row with a distinguishable operator actor, and that no tenant role can invoke it").

## 5. Correlation

Every operator action carries `request_id`/`correlation_id`, joinable to the original failed attempt it is replaying or the case it is resolving (`FI-B12-05`) — an operator can always trace a replay back to the exact original committed intent.

## 6. Replay

Full model: `FI-B12-06`. Replay is never a universal admin superpower — `replay_eligible` is computed from the operation's own idempotency (safe for `outbox_dispatch` and idempotent provider ops; **never** for a non-idempotent operation with an unresolved `unknown` outcome, which must go through the unknown-outcome procedure first).

### 6a. The human-initiated replay contract

`replayDeadLetter` (`POST /operations/dead-letters/{id}/replay`, frozen operation 9) is the **only** human-initiated re-execution surface anywhere in the platform. Every clause below is either a restatement of a frozen B12 rule or a B13 production-hardening rule that tightens without altering it; none adds a field, an operation, or a state.

| # | Requirement | Source |
|---:|---|---|
| 1 | **Authorization first.** `platform.operations.replay` is required. Owner allow; Admin conditional and **never** for a `billing`/`finance` owning-domain record, which requires Owner. An unauthorized caller receives `403 PERMISSION_DENIED` and learns nothing about the record or about the validity of the submitted body | `FI-B12-03`, `FI-B9-02` |
| 2 | **Mandatory non-empty reason.** `ReplayRequest` is frozen as `{ reason: string (required, non-empty) }`. Absent, empty, or whitespace-only is rejected `422 VALIDATION_ERROR` at the command layer, **before** any state transition, guard evaluation with a side effect, or provider contact | frozen `ReplayRequest` (`FI-B12-15`) |
| 3 | **The reason may never carry a secret.** The submitted reason is checked against `B13_LOGGING_REDACTION.md` §2's must-redact classes and is **rejected**, never redacted-and-stored (§6b) | `FI-B12-01`, B13 rule |
| 4 | **Frozen guards are unchanged and are additional, never substituted.** The reason requirement is evaluated *alongside* — never in place of — `replay_eligible = true`, record status `open`, remaining domain budget, provider enablement, fresh idempotency header key plus `replay_of` lineage, and the full six re-checks. A valid reason never advances a record that the frozen guards would refuse | `FI-B12-06` §5, `B12-D-A041` |
| 5 | **Replay invokes the owning domain's own guarded command.** It does **not** invoke `RetryJob` and does **not** invoke `RetryWebhook`; both remain **system-only** with no API, no CLI, and no operator path inside any other command. This contract adds no human path to either | `B12-D-A053` |
| 6 | **Durable audit.** One `platform.replayed` audit row is written recording the **actor** (a named operator membership — never a system actor), the **target** (the dead-letter record reference), the **timestamp**, the **action**, the **reason verbatim**, `request_id`/`correlation_id`, the `replay_of` lineage, and the `result`. The audit row is the durable home of the reason; B13 mints no new column on `platform_dead_letters` to hold it | `FI-B1-10`, `FI-B12-05` |

**Evaluation order is fail-closed at every step:** authorization → reason presence → reason content → frozen eligibility guards → domain command. A failure at any step leaves the record untouched and emits no provider effect.

### 6b. Why a secret-bearing reason is rejected rather than redacted

Everywhere else in this pack, a secret encountered on an outbound path is redacted at the write boundary (`B13_LOGGING_REDACTION.md` §4's allow-list-at-write rule). The replay reason is the deliberate exception, for two reasons. First, the reason exists *to be read later* as the operator's justification; a redacted reason is an audit record that has lost the very thing it was written to preserve, so silently storing `[REDACTED]` would satisfy the letter of the redaction rule while destroying the control it serves. Second, an operator pasting a credential into a free-text field is itself a security event: rejecting tells the operator immediately, whereas quietly scrubbing it teaches them the field is a safe place to put secrets. The rejection response reports *that* a disallowed class was detected and **never echoes the submitted value**, in any response body, error message, log line, or audit row — a rejected reason is not persisted anywhere.

## 7. Abandon

Terminal, requires a mandatory reason exactly as replay does (§6a), and — unlike replay — makes no further attempt at the underlying intent; the owning domain decides whether an abandoned intent needs a compensating business action (e.g., manually contacting a customer whose message was never sent).

## 8. Reconciliation resolution

`ResolvePlatformReconciliationCase` requires `platform.operations.replay` because resolution may invoke a repair that re-enters a domain command (`FI-B12-07` §6a) — reading a case and re-executing its repair are different powers, deliberately gated by the same higher-trust permission as replay, for the identical reason replay is separated from view (`FI-B12-03` §1: "Reading an incident and re-executing it are different powers").

## 9. Integration diagnostics

`ValidateProviderConfiguration`/health checks are **read-only** and return `{provider, environment, configured, last_verified_at, safe_public_metadata}` — never a secret value, in response, log, or audit record (`FI-B8-01` §6).

## 10. Secret management authorization

Restated from `B13_SECRETS_MANAGEMENT.md` §9: workspace-scoped provider credentials require `integration.manage`/`messaging.provider.manage`/`payment.manage` at the workspace level; global-scope credentials require platform-operator tier, never a workspace role, regardless of rank.

## 11. Destructive-action confirmation UX — no frontend precedent

Frontend evidence confirms **zero** native or custom hard-delete confirmation pattern exists anywhere in the shipped client (`FB-B13-025`) — the one confirmation dialog that exists is a soft-cancel, not a delete (`FB-B13-024`). B13's design for genuinely destructive operator/admin actions (workspace deletion, dead-letter abandon, ZATCA applicability lock-in) is therefore designed fresh: a two-step confirmation (explicit intent + mandatory reason where applicable) is required for every action in this document marked "mandatory reason" above, informed by — but not copying — the frontend's soft-transition convention.

## 12. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13OPS-1` | A workspace Admin cannot configure a global-scope provider |
| `AT-B13OPS-2` | An Admin-level replay/resolve on a `billing`/`finance` owning-domain record is refused, requiring Owner |
| `AT-B13OPS-3` | Abandon/dismiss/**replay** without a non-empty `reason` field is rejected before any state change, provider contact, or eligibility evaluation with a side effect |
| `AT-B13OPS-4` | A replay re-checks state, idempotency, budget, entitlement, tenancy, and provider enablement — verified by constructing a replay against a record where at least one of these now fails |
| `AT-B13OPS-5` | Every operator action writes an audit row with a distinguishable operator/system actor |
| `AT-B13OPS-6` | `ValidateProviderConfiguration` never returns a secret value under any response path, including error responses |
| `AT-B13OPS-7` | Django superuser access alone (without a corresponding governed command) cannot mutate tenant business state through any documented path |
| `AT-B13OPS-8` | A replay attempted without `platform.operations.replay` — and an Admin-level replay of a `billing`/`finance` owning-domain record — is refused `403` before the request body is validated, revealing nothing about the record or the body |
| `AT-B13OPS-9` | An authorized replay carrying a valid non-empty reason writes exactly one `platform.replayed` audit row containing the actor membership, target record reference, timestamp, action, verbatim reason, correlation identifiers, and `replay_of` lineage |
| `AT-B13OPS-10` | A replay whose `reason` contains any value from `B13_LOGGING_REDACTION.md` §2's must-redact classes is rejected with zero state change, and the submitted value appears in no response body, log line, or audit row |
