# B13 — Incident Management

> Design only. Defines WazLink-specific incident severity semantics and per-class response for the categories the brief names. No legal-notification deadline is fabricated — jurisdiction-dependent items are marked explicitly (`FI-B0-17`, ADR-012).

## 1. Severity model

| Severity | Definition | Response time target (proposed, Class B) |
|---|---|---|
| **SEV-1** | Active cross-tenant data exposure, confirmed financial corruption, authentication bypass, or total production outage | page immediately, all-hands, CTO notified |
| **SEV-2** | Payment authority failure, provider secret leak, database/storage outage affecting a subset of workspaces, sustained webhook-ingress failure during a provider's retry window | page on-call, notify domain owner within 30 min |
| **SEV-3** | Single-provider outage (messaging, discovery, AI) with graceful degradation, queue backlog trending toward SLA breach | on-call investigates within business hours unless trending toward SEV-2 |
| **SEV-4** | Isolated dead-letter growth, a single reconciliation case, a non-urgent configuration drift | ticketed, addressed in normal operational cadence |

## 2. Incident classes — detection, containment, evidence, recovery, communication, review

### 2.1 Cross-tenant data exposure

- **Detection**: `platform_cross_workspace_denied_total` spike, a support report, or a code-review finding.
- **Containment**: if actively exploitable, disable the affected endpoint/feature flag immediately; do not wait for a full root-cause before containing.
- **Service action**: patch the scoping defect (Doctrine R-1/R-2 violation); add a regression acceptance test before closing.
- **Evidence preservation**: capture the exact request(s) that triggered exposure via `request_id`/`correlation_id`; preserve audit rows (`authz.object_not_in_scope`, `.workspace_path_mismatch`) — never delete or truncate logs during investigation.
- **Recovery**: verify no further exposure via the added regression test; audit which workspaces/records were actually exposed (bounded query against the logged `request_id`s).
- **Communication**: affected workspace owners are notified per a jurisdiction-dependent legal/privacy obligation (**PRODUCT/LEGAL DECISION REQUIRED** — B13 does not fabricate a notification deadline; see §4).
- **Post-incident review**: mandatory for SEV-1; documented root cause plus the acceptance test that now guards against recurrence.

### 2.2 Authentication compromise

- **Detection**: `security.credential_stuffing_suspected`, an abnormal `auth.login_succeeded` pattern, or a user report of unrecognized session activity.
- **Containment**: `RevokeAllSessions` for the affected account(s) via operator action (`admin_revoke`); force password reset.
- **Service action**: if a systemic weakness is found (e.g., a rate-limit gap), patch and add the missing negative-control test.
- **Evidence preservation**: `sessions`, `audit_logs` rows for the affected account, retained per §5's retention policy.
- **Recovery**: confirm the account's sessions are all revoked and the new session set is clean.
- **Communication**: notify the affected user directly; broader disclosure only if the compromise is systemic (a platform-wide vulnerability, not one credential-stuffed account).
- **Post-incident review**: for SEV-1/SEV-2 only (an isolated single-account compromise via credential reuse elsewhere is not a WazLink defect).

### 2.3 Provider secret leak

- **Detection**: `B13_RUNBOOKS.md` §"Leaked provider credential" trigger — a scan finding, an accidental commit, a provider-side alert.
- **Containment**: rotate at the provider console **immediately** (§7, `B13_SECRETS_MANAGEMENT.md`); invalidate the WazLink-side reference.
- **Service action**: confirm no `configured: true` read ever exposed the value (structural guarantee, `FI-B12-04`) — this incident class is about the credential's exposure path (e.g., a log line, a misconfigured export), not necessarily a WazLink code defect.
- **Evidence preservation**: identify exactly how the leak occurred (log scrape, repository scan, third-party breach) before closing.
- **Recovery**: confirm the new credential is functioning (`ValidateProviderConfiguration`/health check) before declaring resolved.
- **Communication**: internal; external only if the leaked credential could have exposed customer data at the provider (jurisdiction-dependent).
- **Post-incident review**: mandatory — add a redaction/log-scanning safeguard against recurrence.

### 2.4 Payment authority failure

- **Detection**: `provider_unknown_outcomes_total{provider="tap"}` sustained rise, or a `RECONCILIATION_MISMATCH` spike.
- **Containment**: do **not** attempt to manually resolve payment state by direct SQL — every repair is a domain command (`ReconcilePayment`, `FI-B12-07`).
- **Service action**: if the root cause is a webhook-ingress outage during Tap's 3-attempt retry window, this is SEV-1-eligible because delivery confirmation may be **permanently** lost (`FI-B8-01`, `B12-X-006`) — `retrieve_charge` reconciliation is the only remaining recovery path.
- **Evidence preservation**: preserve `provider_request_attempts` rows and reconciliation case evidence.
- **Recovery**: every unresolved case is worked to a `repaired`/`dismissed` terminal state with a mandatory reason.
- **Communication**: affected workspace(s) notified if a charge is genuinely ambiguous pending resolution.
- **Post-incident review**: mandatory for SEV-1/SEV-2.

### 2.5 Financial corruption

- **Detection**: `attribution_integrity_failure_total > 0` (an "impossible state" alert, `FI-B9-01`) or a manual audit finding an unexplained revenue discrepancy.
- **Containment**: financial rows are immutable — there is no "roll back" action; containment means stopping further incorrect writes (e.g., disabling a buggy `RecordRevenueEvent` call site) while preserving history intact.
- **Service action**: a compensating reversal, never an edit, corrects the record (`FI-B9-03`).
- **Evidence preservation**: the full immutable history is already preserved by design — this incident class is unusual in that evidence preservation is largely automatic.
- **Recovery**: verify the reversal restores the correct net position; confirm `attribution_integrity_failure_total` returns to zero.
- **Communication**: Finance/Product leadership; customer-facing only if a customer-visible figure (an invoice, a reported metric) was wrong.
- **Post-incident review**: mandatory, SEV-1.

### 2.6 Database outage / data loss

Recovery ordering: authority before derived execution — PostgreSQL recovery precedes Redis/Celery replay (`B13_DISASTER_RECOVERY.md` §1). Full procedure: `B13_RUNBOOKS.md` §"Database unavailable" and §"Restore from backup".

### 2.7 Queue outage / webhook outage / messaging outage / discovery provider outage / AI provider outage / storage outage

Each follows the identical shape: detect via the domain's own health/metric signal, contain by relying on the durable PostgreSQL record of intent (nothing async is ever the only copy of a decision, `FI-B12-01`), recover via the domain's own retry/reconciliation mechanism once the provider/infrastructure returns, and communicate degraded-status to affected workspaces via the existing integration-health surface rather than a bespoke incident-specific channel. Per-provider runbooks: `B13_RUNBOOKS.md`.

### 2.8 Deployment regression

- **Detection**: error-rate spike immediately following a deploy, or a failed acceptance/smoke test.
- **Containment**: roll back to the prior known-good release; the rolling-deploy compatibility rule (`FI-B12-13`, `B12-D-A049`) ensures a rollback does not corrupt in-flight async work, because a consumer that cannot handle a newer `schema_version` fails and retains the event rather than discarding it.
- **Recovery**: `B13_RUNBOOKS.md` §"Failed deployment".

## 3. Detection → containment → recovery ordering principle

Across every class above: **preserve evidence before remediating, and remediate via the owning domain's guarded command, never a direct data edit.** This is the incident-response restatement of `B12-D-A039` ("a reconciliation repair never writes a domain table; it invokes the owning domain's own guarded, audited command").

## 4. Legal/privacy notification — explicitly unresolved

**B13 does not fabricate a data-breach notification deadline.** Saudi and any other applicable jurisdiction's notification timeline (if any) is **PRODUCT/LEGAL DECISION REQUIRED**, inherited unresolved from `FI-B0-17`/ADR-012 (`B13-D-C007`, Class C). What B13 does fix: the technical capability to identify exactly which records/workspaces were affected by any incident class in §2 (via `request_id`/`correlation_id` and the immutable audit trail), so that whatever notification obligation is later determined can be fulfilled without a forensic scramble.

## 5. Evidence retention for incident investigation

Logs, audit rows, and reconciliation-case evidence relevant to an open or recently closed incident are retained for the duration of investigation regardless of the ordinary retention policy (`B13_PRIVACY_DATA_MINIMIZATION.md` §4) — an incident investigation is never cut short by a routine log-rotation job.

## 6. Communication responsibility

| Audience | Trigger | Owner |
|---|---|---|
| Internal on-call/engineering | any SEV-1/SEV-2 | Platform on-call |
| Affected workspace(s) | data exposure, payment ambiguity, financial correction affecting their figures | Product/Support, informed by the incident owner |
| All customers | platform-wide outage or breach | Product leadership |
| Regulator/authority | only if a legal obligation is later confirmed to apply (§4) | Legal (not designed here) |

## 7. Post-incident review

Mandatory for every SEV-1 and SEV-2. Produces: root cause, the specific acceptance-test or control added to prevent recurrence, and — where the incident traces to a B13 control gap — a controlled amendment or decision-register update (`B13_CONTROLLED_AMENDMENTS.md`, `B13_DECISION_REGISTER.md`).
