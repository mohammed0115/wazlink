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
| Replay / reconciliation repair | re-runs **every** guard the original command had — state, idempotency, frozen attempt budgets, entitlement, tenant authorization, provider enablement (`FI-B12-06` §5); no shortcut path |
| Abandon a dead letter / dismiss a reconciliation case | **mandatory reason field** (`FI-B12-06`, `FI-B12-07`) |
| Applicability change (ZATCA) | Owner-only permission, structurally separated from routine `tax.manage` (`FI-B10-02`) |
| Global-scope provider rotation | platform-operator tier, audited at elevated sensitivity |

## 4. Reason requirement and audit

Every abandon, dismiss, override, and applicability-change action requires a `reason` field before it is accepted — enforced at the command layer, not merely encouraged (`FI-B12-06`, `FI-B10-02`). Every operator action is audited with a distinguishable operator/system actor (`FI-B1-09` T24: "Assert every operator-capable mutation writes an audit row with a distinguishable operator actor, and that no tenant role can invoke it").

## 5. Correlation

Every operator action carries `request_id`/`correlation_id`, joinable to the original failed attempt it is replaying or the case it is resolving (`FI-B12-05`) — an operator can always trace a replay back to the exact original committed intent.

## 6. Replay

Full model: `FI-B12-06`. Replay is never a universal admin superpower — `replay_eligible` is computed from the operation's own idempotency (safe for `outbox_dispatch` and idempotent provider ops; **never** for a non-idempotent operation with an unresolved `unknown` outcome, which must go through the unknown-outcome procedure first).

## 7. Abandon

Terminal, requires a mandatory reason, and — unlike replay — makes no further attempt at the underlying intent; the owning domain decides whether an abandoned intent needs a compensating business action (e.g., manually contacting a customer whose message was never sent).

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
| `AT-B13OPS-3` | Abandon/dismiss without a `reason` field is rejected before any state change |
| `AT-B13OPS-4` | A replay re-checks state, idempotency, budget, entitlement, tenancy, and provider enablement — verified by constructing a replay against a record where at least one of these now fails |
| `AT-B13OPS-5` | Every operator action writes an audit row with a distinguishable operator/system actor |
| `AT-B13OPS-6` | `ValidateProviderConfiguration` never returns a secret value under any response path, including error responses |
| `AT-B13OPS-7` | Django superuser access alone (without a corresponding governed command) cannot mutate tenant business state through any documented path |
