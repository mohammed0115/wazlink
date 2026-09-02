# B11 — Observability

> Design only. Inherits frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` verbatim; adds no new telemetry infrastructure.

## 1. Correlation

Every B11 command, worker execution, and provider call carries the frozen `request_id`/`correlation_id` through to the adapter, the outbox event, the audit entry, Sentry, and OpenTelemetry. A `FileAsset`'s whole life — intent, bytes, verification, attachment, deletion, purge — is reconstructible from one workspace-scoped `FILE-*` plus the audit log, with no need to read a storage key or a provider log.

## 2. Metrics

The nine events §31 requires, plus the four B11-specific ones the failure catalog showed are worth separating.

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `files_upload_intent_created_total` | counter | `outcome` (`admitted`\|`quota_rejected`\|`validation_rejected`) | upload created / quota rejected |
| `files_upload_finalized_total` | counter | `outcome` (`available`\|`quarantined`\|`failed`), `failure_reason` | upload finalized / verification failed |
| `files_upload_bytes` | histogram | `content_type_family` | size distribution, capacity planning |
| `files_verification_failed_total` | counter | `failure_reason` (closed enum: `checksum_mismatch`, `size_mismatch`, `mime_mismatch`, `type_not_allowed`, `too_large`, `empty`, `object_missing`, `upload_expired`, `quota_exhausted`) | the security-relevant split |
| `files_attachment_created_total` | counter | `subject_type` | attachment created |
| `files_attachment_detached_total` | counter | `subject_type` | |
| `files_download_total` | counter | `outcome` (`authorized`\|`denied`), `denial_reason` (`permission`\|`state`\|`ticket`\|`tenant`) | download authorized / denied |
| `files_delete_requested_total` | counter | `actor_kind` (`user`\|`system`) | delete requested |
| `files_purge_total` | counter | `outcome` (`purged`\|`failed`\|`unknown`) | physical delete succeeded/failed |
| `files_reconciliation_case_total` | counter | `mismatch_class` (`R-1`…`R-8`) | reconciliation mismatch |
| `files_reconciliation_open_gauge` | gauge | `mismatch_class` | backlog of unresolved cases |
| `files_quota_rejected_total` | counter | `stage` (`intent`\|`finalize`) | quota rejected, split by whether the client understated the size |
| `files_storage_bytes_gauge` | gauge | `figure` (`logical`\|`physical`) | the two totals of `B11_STORAGE_USAGE_MODEL.md` §1, deliberately reported as two series |

## 3. Cardinality discipline

> **Never a metric label:** a filename, a `FILE-*` public ID, a workspace ID, a user ID, a storage key, a checksum, a URL, a ticket, a provider host, or a raw provider error string.

Every label above is drawn from a closed enum whose cardinality is fixed at design time — the largest is `failure_reason` at nine values, and `content_type_family` at four (B5's frozen families). `subject_type` has two. Workspace-level attribution lives in the structured **log** line, which is queryable and bounded by retention, not in a time series that would create one series per workspace forever.

`files_upload_bytes` is a histogram with fixed buckets rather than a per-file gauge, for the same reason.

## 4. Audit

The thirteen audit actions in `B11_COMMAND_EVENT_CATALOG.md` §5 are appended to the frozen `audit_logs` table, immutable and secret-free per B0. Two deserve comment:

- **`file.downloaded` / `file.download_denied`** are audit entries, not events. A download is an access record; putting one on the event bus per byte fetch would flood it and give no consumer anything to do. Both carry actor, `FILE-*`, workspace, `request_id`, and — for denials — the closed-enum reason, and never a ticket or a URL.
- **`file.released`** is the audit trail for a quarantine release, which deliberately emits no event (`B11_COMMAND_EVENT_CATALOG.md` §3). The reason string supplied by the operator is mandatory and is recorded here.

## 5. Alerting

Frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` already names "storage failures," "cross-workspace authorization errors," "quota ledger divergence," and "dead letters" as page-worthy. B11 binds each to a concrete signal rather than adding new alert classes:

| Frozen alert class | B11 signal |
|---|---|
| storage failures | `files_purge_total{outcome="failed"}` after the retry budget; `files_reconciliation_case_total{mismatch_class="R-3"}` |
| cross-workspace authorization errors | `files_download_total{outcome="denied", denial_reason="tenant"}`; `B11-F-014` |
| quota ledger divergence | `files_reconciliation_case_total{mismatch_class="R-7"}` |
| dead letters | purge and reconciliation workers exhausting the frozen five-attempt budget |
| *(new binding, same class)* integrity | `files_verification_failed_total{failure_reason="checksum_mismatch"}` and `R-4` — a rise here means corruption or tampering, and is the highest-signal metric in this pack |
| *(new binding, same class)* disguise attempts | `files_verification_failed_total{failure_reason="mime_mismatch"}` and `B11-F-005`'s under-declared size |

Alerts carry `request_id` and the `FILE-*` reference only — never a filename, never a key, never content, per §3 and `B11_SECURITY_PRIVACY.md` §4.

## 6. Health

B11 adds nothing to `/health/ready`. Per the frozen rule that readiness "does not depend on every external provider," a storage outage is represented by integration health metrics and the alerts above, **not** by failing readiness — matching the posture `B10_OBSERVABILITY.md` took for ZATCA. A blob-store outage must not take the whole application out of the load balancer when every non-file operation still works.
