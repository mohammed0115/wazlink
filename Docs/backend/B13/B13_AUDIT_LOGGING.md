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

**Two counters, deliberately separated.** A concrete audit-event code is an individually-named action that frozen source writes out verbatim. A wildcard family (`operator.*`) or a prose obligation ("every state-changing revenue command writes one audit fact") is **not** a concrete code and is never expanded into invented members. Conflating the two is what produced the pre-`B13-FIX.1` figure of 146, and again the `B13-FIX.1` figure of 151 — both of which included names no frozen backend catalog writes out. Both counters below were re-derived by reading each frozen domain's own catalog, and every code in §3.1 was located verbatim in the frozen document its row cites.

### 3.1 Concrete audit-event codes (139)

| Category | Frozen source | # | Actions |
|---|---|---:|---|
| Authentication | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 14 | `auth.registered`, `.register_duplicate_suppressed`, `.email_verified`, `.login_succeeded`, `.login_failed`, `.logout`, `.password_changed`, `.password_reset_requested`, `.password_reset_completed`, `.session_revoked`, `.sessions_revoked_all`, `.session_expired`, `.invitation_token_rejected`, `.session_revoke_denied` |
| Session/workspace | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 4 | `session.workspace_switched`, `.workspace_switch_denied`, `.workspace_reresolved`, `.revoked_no_workspace` |
| Workspace lifecycle | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 6 | `workspace.created`, `.updated`, `.suspended`, `.resumed`, `.archived`, `.deletion_requested` |
| Membership/invitation | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 11 | `invitation.created`, `.resent`, `.cancelled`, `.expired`, `.accepted`, `.accept_rejected`; `membership.activated`, `.suspended`, `.removed`, `.role_changed`; `ownership.transferred` |
| User lifecycle | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 3 | `user.disabled`, `.enabled`, `.deleted` |
| Authorization denials | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 8 | `authz.permission_denied`, `.object_not_in_scope`, `.workspace_path_mismatch`, `.relationship_out_of_scope`, `.role_change_denied`, `.invite_role_denied`, `.last_owner_blocked`, `.last_active_membership_blocked` |
| Security events | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | 4 | `security.csrf_rejected`, `.rate_limited`, `.unknown_field_rejected`, `.credential_stuffing_suspected` |
| CRM | `B2_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B2-01`) | 24 | `lead.converted`, `.convert_deduplicated`, `.status_changed`, `.priority_changed`, `.owner_changed`, `.tag_added`, `.tag_removed`, `.archived`, `.business_merged`; `contact.added`, `.updated`, `.removed`; `task.created`, `.updated`, `.assigned`, `.completed`, `.cancelled`; `appointment.created`, `.rescheduled`, `.cancelled`, `.completed`, `.no_show`; `note.added`, `.removed` |
| Discovery | `B3_AUTHORIZATION_TENANCY.md` §5 (`FI-B3-03`) | 5 | `discovery_job_created`, `discovery_job_retried`, `discovery_job_cancelled`, `business_merged`, `discovery_results_exported` |
| AI Intelligence | `B4_AUTHORIZATION_TENANCY.md` (`FI-B4-03`) | 3 | `intelligence_requested`, `intelligence_reanalyzed`, `intelligence_cancelled` |
| Messaging | `B5_ENTITLEMENT_RBAC_TENANCY.md` §4 (`FI-B5-04`) | 7 | `messaging_sent`, `message_cancelled`, `conversation_assigned`, `conversation_closed`, `conversation_reopened`; `provider_configuration_changed`, `credential_rotated` (both elevated sensitivity) |
| Billing | `B8_OBSERVABILITY_AUDIT.md` §2 (`FI-B8-05`) | 15 | `subscription.bootstrapped`, `.upgraded`, `.cancel_scheduled`, `.reactivated`, `.downgrade_scheduled`, `.downgrade_applied`, `.suspended`, `.expired`; `payment.captured`, `.failed`, `.refunded`; `entitlement_override.granted`, `.revoked`; `reconciliation.repaired`; `provider_configuration.changed` |
| Tax | `B10_OBSERVABILITY.md` §2 (`FI-B10-04`) | 11 | `tax_profile.updated`, `tax_applicability.changed`, `tax_invoice.issued`, `tax_invoice.cancelled`, **`tax_credit_note.issued`**, **`tax_debit_note.issued`**, `tax_submission.accepted`, `tax_submission.rejected`, `zatca_configuration.changed`, `tax_classification.resolved`, `tax_correction.rejected` |
| Files | `B11_COMMAND_EVENT_CATALOG.md` §5 (`FI-B11-08`) | 13 | `file.uploaded`, `.upload_failed`, `.quarantined`, `.released`, `.attached`, `.detached`, `.deleted`, `.purged`, `.purge_failed`, `.downloaded`, `.download_denied`, `.reconciliation_opened`, `.reconciliation_resolved` |
| Platform operations | `B12_COMMAND_EVENT_CATALOG.md` (`FI-B12-16`) | 11 | `integration.configured`, `.checked`, `.enabled`, `.disabled`, `.credential_rotated`; `platform.dead_lettered`, `.replayed`, `.abandoned`, `.reconciliation_opened`, `.reconciliation_resolved`; `webhook.rejected` |

`CONCRETE_AUDIT_EVENT_CODE_COUNT = 139` — the sum of the `#` column, and equal to the number of distinct codes (no code is claimed by two domains). `provider_configuration.changed` is B8-owned and counted once under Billing; `B10_OBSERVABILITY.md` §2 reuses it rather than minting a second code, and Messaging's `provider_configuration_changed` is B5's own separately-named undotted action.

**Corrected under `B13-FIX.2`: 151 → 139.** The published 151 included an Automation row of twelve dotted codes attributed to `B7_OBSERVABILITY_AUDIT.md` (`FI-B7-05`). That document contains none of them and publishes no audit-action catalog at all. Within frozen B7 the twelve tokens occur in exactly one place — `B7_FRONTEND_BEHAVIOR_INVENTORY.md` row `FB-A41`, an inventory of the **frontend mock's** local audit-trail fixture cited to `client/src/domain/data.js` — so they are frontend evidence, which `FI-FE-01` forbids treating as backend authority, and not a frozen `audit_logs.action` vocabulary. B7's real published vocabulary is its `Automation*` domain-event set (`B7_COMMAND_EVENT_CATALOG.md` §2), which §3.3 excludes from this counter by construction. The requirement itself is real and is preserved verbatim as non-enumerated requirement 5 in §3.2 — the same treatment B13 already gives B6 and B9, applied consistently rather than selectively.

**Credit and debit notes are concrete, not prose.** Frozen `B10_OBSERVABILITY.md` §2 names `tax_credit_note.issued` and `tax_debit_note.issued` as individual codes. The pre-`B13-FIX.1` catalog compressed them into the phrase "credit/debit note issuance", which left an implementer unable to tell whether one code or two were required, and whether cancellation of a note had its own code (it does not — `tax_correction.rejected` and `tax_invoice.cancelled` are the adjacent codes, and neither is note-specific).

### 3.2 Non-enumerated audit requirements (5)

These are real, binding audit obligations that frozen source states **without** enumerating member codes. They are counted separately and must never be expanded into invented codes or added to the concrete total.

| # | Requirement | Frozen source | Why it is not enumerable |
|---:|---|---|---|
| 1 | `operator.*` — the platform-operator action family (actor `operator`, workspace nullable) | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`) | Frozen B1 names the family as a wildcard and never lists a member. Implementation must name each operator action it introduces and register it before use |
| 2 | Deal lifecycle audit rows (create/update/assign/close/reopen) | `B6_ENTITLEMENT_RBAC_TENANCY.md` (`FI-B6-02`) | B6 defines the audit obligation and its permission surface but publishes no dotted audit-action catalog. B13 mints none on its behalf |
| 3 | One immutable audit fact per state-changing revenue/reversal/attribution command — actor always a named membership | `B9_SECURITY_PRIVACY.md` §6 (`FI-B9-03`) | B9 deliberately derives the audit action from the **command name** and publishes no dotted event catalog. Inventing Finance codes to round out a total is precisely the error `B13-FIX.1` corrects |
| 4 | Denials are audited — every `403`/scoping-`404` writes a `denied` row, including paths beyond the eight enumerated `authz.*` codes | `B1_PRIVACY_AUDIT_MODEL.md` §3 (`FI-B1-11`), restated across B2/B3/B4 | A blanket obligation over all denial paths; the enumerated `authz.*` set is the named subset, not the boundary |
| 5 | Automation lifecycle and action execution must be reconstructable from durable rows alone — rule created/edited, revision activated/superseded, paused/disabled/archived, execution admitted, trigger source, condition result, action planned/invoked/result, retry, failure, dead letter, cancel, replay | `B7_OBSERVABILITY_AUDIT.md` §1 (`FI-B7-05`) | B7 states the obligation as reconstructability over durable rows and its own `Automation*` domain events, and publishes **no** dotted audit-action catalog — `grep -rniE 'audit action' Docs/backend/B7/` returns nothing across all 51 frozen B7 documents. Domain event names are excluded from the concrete counter by §3.3. B13 mints no Automation code on B7's behalf, exactly as it mints none for B6 (requirement 2) or B9 (requirement 3) |

`NON_ENUMERATED_AUDIT_REQUIREMENT_COUNT = 5` — the row count of §3.2. Raised from 4 under `B13-FIX.2` by requirement 5, which was previously mis-carried as twelve concrete codes in §3.1.

### 3.3 Derivation note

Both counters are the row/sum counts of §3.1 and §3.2 and are re-derived in `B13_VERIFICATION_MATRIX.md` §2. Permission codes (imperative, `<resource>.<verb>` — `invitation.cancel`, `workspace.suspend`), column references (`users.status`), entitlement keys (`crm.core`), domain event names (`SessionRevoked`), and alert names (`identity.invariant_violation`, `workspace.owner_unavailable`) are excluded by construction: they are not `audit_logs.action` values. Frozen B1 states the disambiguation rule directly (`B1_AUTHORIZATION_RBAC.md`), and near-miss pairs are deliberate — `invitation.cancel` (permission) against `invitation.cancelled` (audit action).

Two provenance notes a reviewer should have: `auth.session_revoke_denied` is carried as concrete on the strength of `B1_SECURITY_THREAT_MODEL.md`'s T23 audit-signal column, which is the sole place frozen B1 names it — it is absent from B1's own §3 catalog table, an inconsistency inside frozen B1 that B13 records rather than resolves. And `B2_PRIVACY_AUDIT_MODEL.md` §3 is headed "CRM audit actions (22)" while its table enumerates 24 rows; B13 counts the table, not the heading, and does not amend frozen B2.

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
