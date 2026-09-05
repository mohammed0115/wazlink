# B14_12 — Django Admin Integration Operations

> **V1 decision: Django Admin is the internal operator surface for provider integration operations.** It is staff-only, MFA-guarded where B13 requires, fully audited, and **never displays a raw secret**.

## 1. Scope

Django Admin in V1 is an **operator** surface, not a tenant surface. It exposes provider integration operations, platform dead letters, reconciliation cases and audit search. **It is not a back door into tenant business data**: it never edits a Lead, Customer, Deal, Message or `revenue_events` row. Every write it performs invokes an existing frozen command with the operator as actor.

## 2. Integration Operations view

One row per `integration_connections` record. **Every field below is non-secret.**

| Column | Source | Notes |
|---|---|---|
| Provider | `provider` | closed enum |
| Scope | workspace or platform | |
| **Configuration status** | `status` | **frozen 5 states**: `not_connected` · `configuration_required` · `connected` · `error` |
| **Enabled** | `enabled` | **orthogonal boolean, rendered separately from status** — never merged into it |
| Health facts | `integration_health_snapshots` | `configuration_valid` · `credential_valid` · `provider_reachable` · `webhook_configured` · `provider_enabled` · `degraded` |
| Last check / last successful check | `last_checked_at`, `last_check_outcome` | |
| **Last sanitized error** | `error_code`, `error_reason` | **safe, redacted, operator-facing** — the frozen fields, which are already specified as sanitized |
| Webhook status | health fact | "callback verified at …" or "never received" |
| Reconciliation | open case count | links to cases |
| Environment / mode | `ENVIRONMENT` | safe |
| Credential presence | **derived boolean only** — *"reference resolves: yes/no"* | **never the value, never a prefix, never a length, never a masked fragment** |
| Operational notes | free text | operator-authored; **must not contain a credential** |

**Deliberately never rendered:** API keys · access tokens · app secrets · verify tokens · webhook secrets · `hashstring` · Authorization headers · raw provider request/response bodies · any masked or truncated form of the above.

> **A masked secret is still a secret.** The admin shows *whether* a reference resolves, never any part of the value.

## 3. Operator actions

| Action | Frozen command | Permission | Guard |
|---|---|---|---|
| **Check Configuration** | local validation | `integration.manage` | no provider call; sets `configuration_valid` |
| **Test Connection** | `CheckProviderConfiguration` | `integration.manage` | real provider call; writes a `provider_request_attempts` row **before** calling; sets `credential_valid`, `provider_reachable`; may move `status → connected` or `error` |
| **Enable Provider** | `EnableIntegration` | `integration.manage` | **frozen precondition `status = connected`** + `expected_version` |
| **Disable Provider** | `DisableIntegration` | `integration.manage` | `enabled = true`; **inbound webhooks continue to be accepted and receipted** (frozen) |
| **Re-run Health Check** | health sweep | `integration.manage` | `providers.fast` |
| **Trigger reconciliation** | `ResolvePlatformReconciliationCase` | `platform.operations.replay` | only classes frozen B12 permits; **`P-1`/`P-3`/`P-5`/`P-6`/`P-7` remain report-only** |
| **Replay dead letter** | `ReplayDeadLetter` | `platform.operations.replay` | **reason mandatory**; re-runs every original guard |

**Prohibited admin actions:** editing a credential value in the UI (V1 credentials come from `.env`) · a "retry this task" button (`B12-D-A053`) · forcing `status = connected` by hand · enabling a connection whose `status ≠ connected` · bulk replay without per-item guard re-evaluation · editing `webhook_receipts`, `worker_executions`, `audit_logs` or any dead-letter row · setting a `DiscoveryJob` status by hand · **enabling the scraping connection before its verification scheme exists** (`B12-D-A054`).

## 4. Other admin surfaces

| Surface | Read/Write | Notes |
|---|---|---|
| Dead letters | read + replay/abandon | reason mandatory, audited |
| Reconciliation cases | read + resolve | frozen class rules |
| Audit log | **read-only** | immutable; `audit.view` |
| Outbox / worker executions | **read-only** | diagnostics; **never editable** |
| Plans & capabilities | read/write | Plan Catalog admin (internal, B8) |
| Tenant business data | **not exposed** | Leads, Customers, Contacts, Messages, Deals, revenue are **not** admin-editable |

## 5. Security

Staff-only, separate from tenant auth · every action audited with a **distinguishable operator actor** (`FI-B1-09` T24) · every operator mutation requires a reason where the frozen command requires one · admin is served on a restricted path/network per B13 deployment security · **no admin page renders a secret in HTML, a form field, a tooltip, a page-source comment, or a Django message**.

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-ADMIN-1` **(NC)** | Sentinel credentials configured; staff session | Render **every** admin page and read the raw HTML | **No secret value, prefix, length, or masked/truncated fragment** in body, form field, tooltip, page-source comment or Django message |
| `T-ADMIN-2` **(NC)** | Connection with `status ≠ connected` | Invoke **Enable Provider** | **Refused** — the frozen `EnableIntegration` precondition `status = connected` plus `expected_version` |
| `T-ADMIN-3` | An `enabled` connection | Invoke **Disable Provider**, then deliver an inbound webhook | Disable succeeds; **inbound webhooks continue to be accepted and receipted** (frozen) |
| `T-ADMIN-4` | Any admin action | Perform it, then read `audit_logs` | An audit row exists with a **distinguishable operator actor** (`FI-B1-09` T24) and, where the frozen command requires one, a **reason** |
| `T-ADMIN-5` **(NC)** | Admin site registry | Enumerate registered models | **No tenant business model is registered as editable** — Lead, Customer, Contact, Message, Deal, `revenue_events`, `webhook_receipts`, `worker_executions`, `audit_logs` and dead-letter rows are absent or read-only |
| `T-ADMIN-6` **(NC)** | Admin UI | Search for a per-task retry affordance | **No "retry this task" control exists** (`B12-D-A053`) |
| `T-ADMIN-7` **(NC)** | Scraping connection, no verification scheme | Attempt enable from Admin | **Refused** (`B12-D-A054`) |
