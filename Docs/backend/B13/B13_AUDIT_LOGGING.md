# B13 — Audit Logging

> Design only. Consolidates the per-domain audit-action catalogs already frozen in B1–B12 into one production audit model, distinct from ordinary business-timeline events (`crm_activities`, `B2_TIMELINE_IDENTITY_MODEL.md`). B13 mints no new audit table shape and reuses `audit_logs` (`FI-B1-10`) and the platform-specific tables B12 already defined (`platform_dead_letters`, `platform_reconciliation_cases`).

## 1. Two record classes, kept separate

| Class | Table | Mutability | Purpose |
|---|---|---|---|
| **Business timeline** | `crm_activities` and equivalents | append-only, customer-facing (Lead 360) | "what happened to this Lead/Deal/Conversation" |
| **Security/audit** | `audit_logs` (workspace-scoped) + platform tables (B12) | append-only, immutable, operator/compliance-facing | "who did what to a security- or authority-sensitive fact" |

A permission grant, a role change, a secret rotation, or a financial reversal is never routed through the business timeline; it is always an `audit_logs` row (or the domain's own immutable ledger, e.g. `revenue_events`/`revenue_reversals` themselves, which are self-auditing by construction, `FI-B9-03`).

## 2. Record shape (inherited from `FI-B1-10`, extended for platform actions)

| Field | Content |
|---|---|
| `public_id` | `AUD-*` (workspace-scoped actions) or none (platform-internal operator actions, following `payment_attempts`'/`platform_dead_letters`' operator-internal precedent) |
| `workspace_id` | resolved active workspace; nullable **only** for pre-tenant auth actions and global-scope platform actions |
| `actor_type` | `user` \| `system:scheduler` \| `system:webhook` \| `system:automation` \| `operator` \| `anonymous` — **never** used to grant authority, only to record it |
| `actor_user_ref` / `actor_membership_ref` | `USR-*`/membership identity; null for non-user actors. **Financial actions require a named membership — no system actor is ever the actor on a financial row** (`FI-B9-02`) |
| `action` | dotted past-participle action code (never confused with a permission code, which is imperative — `FI-B1-06`'s namespace-disambiguation rule extends to every domain) |
| `target_type` / `target_ref` | opaque pointer to the affected aggregate |
| `before` / `after` | JSONB, credential and free-text-PII fields excluded **at write time**, not filtered at read time |
| `result` | `succeeded` \| `denied` \| `failed` |
| `error_code` | when `result <> succeeded` |
| `request_id` / `correlation_id` | B0 correlation identifiers |
| `source_ip_hash` / `user_agent_digest` | reduced forms only, never raw |
| `occurred_at` | UTC |
| `permission_matrix_version` | reproducibility of the authorization verdict (`FI-B1-10`) |
| `reason` | **mandatory** on every abandon/dismiss/override/reversal action (`FI-B12-06`, `FI-B10-02` applicability changes) |

## 3. Consolidated security-sensitive event catalog

This is the union of every domain's own frozen audit-action list. B13 adds no new action beyond what each frozen phase already named; it is collected here so `B14` has one lookup table instead of eleven.

| Category | Actions | Source |
|---|---|---|
| Authentication | `auth.registered`, `.login_succeeded`, `.login_failed`, `.logout`, `.password_changed`, `.password_reset_requested`, `.password_reset_completed`, `.email_verified`, `.session_revoked`, `.sessions_revoked_all`, `.session_expired`, `.invitation_token_rejected` | `FI-B1-11` |
| Session/workspace | `session.workspace_switched`, `.workspace_switch_denied`, `.workspace_reresolved`, `.revoked_no_workspace` | `FI-B1-11` |
| Workspace lifecycle | `workspace.created`, `.updated`, `.suspended`, `.resumed`, `.archived`, `.deletion_requested` | `FI-B1-11` |
| Membership/invitation | `invitation.created`, `.resent`, `.cancelled`, `.expired`, `.accepted`, `.accept_rejected`; `membership.activated`, `.suspended`, `.removed`, `.role_changed`; `ownership.transferred` | `FI-B1-11` |
| Operator/user lifecycle | `user.disabled`, `.enabled`, `.deleted`; `operator.*` | `FI-B1-11` |
| Authorization denials | `authz.permission_denied`, `.object_not_in_scope`, `.workspace_path_mismatch`, `.relationship_out_of_scope`, `.role_change_denied`, `.invite_role_denied`, `.last_owner_blocked`, `.last_active_membership_blocked` | `FI-B1-11` |
| Security events | `security.csrf_rejected`, `.rate_limited`, `.unknown_field_rejected`, `.credential_stuffing_suspected` | `FI-B1-11` |
| CRM | 22-action catalog: `lead.converted`, `.status_changed`, `.priority_changed`, `.owner_changed`, `.tag_added`/`removed`, `.archived`, `.business_merged`; `contact.added`/`.updated`/`.removed`; `task.*` (5); `appointment.*` (5); `note.added`/`.removed` | `FI-B2-01` |
| Discovery | `discovery_job_created`, `.retried`, `.cancelled`; `business_merged`; `discovery_results_exported` | `FI-B3-02` |
| AI Intelligence | `intelligence_requested`, `.reanalyzed`, `.cancelled` | `FI-B4-02` |
| Messaging | `messaging_sent`, `message_cancelled`, `conversation_assigned`/`.closed`/`.reopened`; `provider_configuration_changed`, `credential_rotated` (elevated sensitivity) | `FI-B5-04` |
| Pipeline/Deals | Deal lifecycle audit rows per `B6_ENTITLEMENT_RBAC_TENANCY.md` (create/update/assign/close/reopen) | `FI-B6-02` |
| Automation | rule created/edited/activated/superseded/paused/disabled/archived; execution admitted/succeeded/failed/dead-lettered/cancelled/replayed; loop-prevention block | `B7_OBSERVABILITY_AUDIT.md` |
| Billing | `subscription.bootstrapped`, `.upgraded`, `.cancel_scheduled`, `.reactivated`, `.downgrade_scheduled`, `.downgrade_applied`, `.suspended`, `.expired`; `payment.captured`/`.failed`/`.refunded`; `entitlement_override.granted`/`.revoked`; `reconciliation.repaired`; `provider_configuration.changed` | `FI-B8-02` |
| Finance | every state-changing revenue/reversal/attribution command (one immutable audit fact per write, actor always a named membership) | `FI-B9-03` |
| Tax | applicability change, credential rotation (metadata only), submission/retry/cancel, credit/debit note issuance | `FI-B10-01`, `FI-B10-03` |
| Files | `file.uploaded`, `.upload_failed`, `.quarantined`, `.released`, `.attached`, `.detached`, `.deleted`, `.purged`, `.purge_failed`, `.downloaded`, `.download_denied`, `.reconciliation_opened`, `.reconciliation_resolved` | `FI-B11-01` |
| Platform operations (B12) | dead-letter replay/abandon, reconciliation-case resolve, integration configure/enable/disable/check, secret rotation | `FI-B12-03`, `FI-B12-06` |

`AUDIT_EVENT_COUNT` is mechanically the row count of this catalog's individual action codes, re-derived in `B13_VERIFICATION_MATRIX.md` §2 (not restated here as a single number to avoid a figure that drifts from the source tables it is drawn from).

## 4. Fields excluded — never in audit

Every item in `B13_LOGGING_REDACTION.md` §2's never-log list applies identically to audit `before`/`after` and `metadata` JSONB — a credential, session key, CSRF secret, raw invitation/verification/reset token, card/PAN, provider secret, or raw webhook body never appears in an audit row, enforced by an allow-list at the audit writer, not a redaction pass applied after the fact (`FI-B1-10` §2, restated for every domain).

## 5. Immutability and retention

`audit_logs` is append-only and immutable — no update or delete path exists at the application layer (mirroring the identical invariant already proven for `revenue_events`, `FI-B9-03`). Retention duration is **Class C, unresolved** — inherited from `FI-B0-17`/`FI-B1-10` Rule P-4 as PRODUCT/LEGAL DECISION REQUIRED; the structural requirement B13 does fix is that every retention-bearing table carries an explicit timestamp column so a policy, once decided, is implementable without a schema change.

## 6. Denials are audited

Every `403`/scoping-`404` outcome writes a `denied` audit row (`FI-B1-11`, restated identically across B2/B3/B4). This is what makes authorization-bypass attempts, mass-assignment attempts, and cross-tenant probing detectable rather than merely blocked — it is the audit half of every negative control in `B13_AUTHORIZATION_TENANCY.md` §10 and `B13_ACCEPTANCE_TESTS.md`.

## 7. Reproducibility

`permission_matrix_version` on every authorization-consequential audit row makes a verdict reproducible after a later RBAC change — a reviewer investigating an incident from three weeks ago can determine exactly which matrix version produced the decision, not just what the current matrix would say (`FI-B1-10`).

## 8. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13AUD-1` | Every permission grant/role change/ownership transfer writes an audit row with before/after role |
| `AT-B13AUD-2` | Every `403`/scoping-`404` writes a `denied` audit row |
| `AT-B13AUD-3` | No audit row, at any domain, ever contains a value from `B13_LOGGING_REDACTION.md` §2's never-log list |
| `AT-B13AUD-4` | Every financial audit row names a real membership, never a system actor |
| `AT-B13AUD-5` | An `abandon`/`dismiss`/`override`/`reversal` action without a `reason` field is rejected before the audit row is written |
| `AT-B13AUD-6` | Audit rows are immutable — no application code path issues an `UPDATE` or `DELETE` against `audit_logs` |
