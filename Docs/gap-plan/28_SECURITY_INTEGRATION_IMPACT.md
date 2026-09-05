# 28 — Security and Integration Impact

> Resolves brief §39, §40 and §41. **B13 is not weakened anywhere.**

## 1. Security impact per new capability

| Capability | Workspace isolation | RBAC | PII | Files | AI | Audit | Async | Notable risk |
|---|---|---|---|---|---|---|---|---|
| Customers | `workspace_id` on all tables | 6 new perms | Contact PII stays in `contacts` — customers hold none | via B11 enum | — | 5 new codes | — | low |
| Contacts UI | inherited | `contact.*` | **new bulk PII egress path** | — | — | reuse frozen + `contact.listed` | — | **RESOLVED — `PD-002` APPROVED: Viewer masked, enforced server-side in the selector before serialization** |
| Identity resolution | **`workspace_id` in every lookup key — cross-workspace not expressible** | none (system read) | reads PII, returns references only | — | consumed by agent | resolution logged without PII values | inline in B5 pipeline | medium |
| Merge | single-workspace only | `customer.merge` | survivorship exposes both records to the merger | — | **prohibited for AI** | reason-required audit | — | **highest data risk; `CA-04`** |
| Import | per-row workspace scoping | `import.manage` | **bulk PII ingress** | CSV as `file_asset` under B11's 10 gates | — | batch + per-row audit | B12 `default` | high |
| Custom fields | `workspace_id` on definitions and values | `customfield.manage` | **a free-text field can hold anything** — visibility is presentation, not authorization | — | — | definition changes audited | — | medium |
| AI agent (**OpenAI initial provider**) | every query workspace-scoped; cross-workspace context not expressible | holds **no** permissions | **deliberate bounded external PII egress** — minimum-necessary context only, with `PD-002` masking applied **before** egress; no prompt/completion text in logs, traces, metrics or audit payloads | reads published KB only | the authority ladder, enforced **above** the provider port | proposal create/accept/reject audited with actor | B12 `providers.slow`, `provider_request_attempts`, `B12-D-A020` unchanged | **highest AI risk — governed by `29_AI_PROVIDER_ARCHITECTURE.md`** |
| Knowledge base | workspace-scoped retrieval | `knowledge.manage` | articles should not hold customer PII | B11 sources | grounds answers | publish/archive audited | — | medium |
| Tickets/SLA | `workspace_id` | 5 new perms | subject/description may hold PII | B11 enum | — | lifecycle audited | B12 `maintenance` | low |
| Quotes/Products | `workspace_id` | 5 new perms | minimal | — | — | lifecycle audited | expiry sweep | low |
| Assignment | `workspace_id`; **counter is a PostgreSQL row, never Redis** | `assignment.manage` | none | — | — | assignment audited | — | low |
| **Forms (public)** | **DEFERRED — `PD-010` APPROVED: API-first** | n/a while deferred | n/a | — | — | — | — | **Removed from the initial wave; the plan's highest-risk surface is not built** |

## 2. New audit event codes

`customer.created|updated|archived|owner_changed|merged` · `contact.listed` (bulk-read, deliberately audited) · `import.created|committed|cancelled` · `customfield.defined|archived` · `conversation.handling_mode_changed|takeover_started|takeover_ended` · `agent.proposal_created|accepted|rejected` · `ticket.created|assigned|resolved|reopened|sla_breached` · `quote.created|sent|accepted|rejected` · `knowledge.published|archived` · `assignment.rule_changed|auto_assigned` · `form.submitted|rejected`.

**~30 additive codes.** Each follows B13's `<resource>.<past participle>` convention and none collides with a permission code — the near-miss discipline `B13_AUDIT_LOGGING.md` §3.3 already documents. Redaction rules are inherited unchanged: **PII values never appear in an event payload, an outbox row, a Celery argument, a log line, or an audit `details` blob** — only field *names* and references.

## 3. B13 controls extended, not weakened

| B13 control | Extension |
|---|---|
| Rate limiting | New classes for the public form surface and for import submission. The frozen four-counter-class separation is preserved — an abuse control never merges with a domain cost budget |
| Redaction | New subjects added to the exhaustive list; **nothing is removed** |
| Audit | ~30 additive codes; immutability and retention posture unchanged |
| Tenancy | New tables follow Doctrine R-1/R-2: a cross-workspace reference resolves to `404`, never `400` |
| Authorization | 25 additive permissions; the 16-step pipeline is untouched |
| Fail-closed startup | New provider config (AI) follows the existing `*_REF` secret contract |
| Observability | New signals for import progress, SLA breach, agent acceptance rate, form abuse |

**No B13 control is relaxed, made configurable, or given an exception.**

## 4. Billing / Finance / Tax impact — the discipline

Brief §40 warns against creating financial coupling merely because a feature contains a price, quote, deal, customer or invoice-like document.

| Gap | B8 Billing | B9 Revenue | B10 Tax |
|---|---|---|---|
| Customers, Contacts, Identity, Import, Custom fields, Calendar, Assignment, Forms, KB, Reporting | capability key only | **none** | **none** |
| Tickets / SLA | capability key only | **none** | **none** |
| AI agent | capability key + AI cost metering (existing B4 pattern) | **none** | **none** |
| **Products / Quotes** | capability key only | **none — `AcceptQuote` writes no `revenue_events` and is not an input to `RecordRevenueEvent`** | **none — a quote is not a tax document and writes no `tax_invoices`** |

**Only B8 is touched, and only through additive capability keys.** B9 and B10 are `NO_CHANGE` for every one of the 27 gaps. The presence of money in Quotes is precisely where the discipline is tested, and the answer is enforced by ownership plus four negative controls (`GQ-1`…`GQ-4`).

## 5. Async / integration impact

| Requirement | Verdict |
|---|---|
| New Celery tasks | Yes — import rows, SLA sweep, quote expiry, agent proposals. **All on existing queues** (`default`, `maintenance`, `providers.slow`) |
| New queue | **None** |
| Outbox | Reused for all 24 new events |
| Inbox | Reused shape for form submissions |
| New webhook **from** a provider | **None** — the OpenAI adapter is request/response only; it registers no inbound surface |
| New provider adapter | **One: the OpenAI Adapter**, behind B12's existing port/adapter boundary and capability model. Secrets resolve through the frozen `*_REF` contract at the adapter boundary; model choice is configuration, never domain truth. **No provider semantics enter any business domain** |
| Reconciliation | Import batches and SLA clocks get reconciliation classes following B12's existing pattern |
| Retry | Only for **idempotent** operations |
| **Auto-retry of `UNKNOWN` non-idempotent work** | **NEVER.** `B12-D-A020` applies unchanged. An import row whose target-command outcome is unknown is recorded `unknown` and surfaced for human resolution — it is never blindly re-executed. This is why the import results screen reports three counts, not two |
| Dead letter | Reused for poison import rows and failed agent tasks |
| Scheduled jobs | SLA sweep and quote expiry, both on the deliberately starvable `maintenance` queue |

**No frozen B12/B13 async semantic is altered.** In particular, no lease or fencing column is invented on `worker_executions`, and no heartbeat-stale execution is re-executed — the exact rules B13's own MUST-NOT list enumerates.
