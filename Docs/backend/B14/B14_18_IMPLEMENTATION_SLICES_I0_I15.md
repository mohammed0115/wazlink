# B14_18 — Implementation Slices I0–I15

> Sixteen slices. Each is independently implementable, testable, demoable and verifiable. **No slice may be merged with another and called one verified slice.**

> **`B14-FIX.1` rebuild — closes `V-05`, and carries `V-01`, `V-02`, `V-08`.** Every slice now carries **all 24 contract fields**. A field that is legitimately empty reads **`N/A — <reason>`**; **no field is omitted**. Ten slices previously omitted between 5 and 14 fields, and I13 — carrying P0 `GAP-014` — had **no *Frozen source contracts* line at all**, which made `B14_24` §4's prompt template resolve to nothing.

**Applied order** (derived mechanically in `B14_28`): **I0 · I1 · I2 · I5 · I7 · I3 · I4 · I6 · I13 · I8 · I9 · I10 · I11 · I12 · I14 · I15.**

**Completion semantics.** A slice may deliver **groundwork** for a gap without **completing** it. A gap is `COMPLETE` only when every approved behaviour is implemented **and executable by a test that is not vacuous**. Groundwork is labelled and never counted as completion (`V-08`, `V-M09`).

---
## I0 — Django / PostgreSQL foundation
**Goal** A running Django project with PostgreSQL, Redis, Celery and the frozen cross-cutting primitives. No business domain.
**Frozen source contracts** `BACKEND_API_STANDARD.md`, `BACKEND_ERROR_CATALOG.md`, `BACKEND_IDEMPOTENCY_STANDARD.md`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `BACKEND_RETRY_POLICY.md`, `BACKEND_TIMEOUT_POLICY.md`, `B13_DJANGO_DRF_SECURITY_BASELINE.md`, `B13_CONFIGURATION_MANAGEMENT.md`, `B13_HEALTH_READINESS.md`, `B13_LOGGING_REDACTION.md`, `B13_DEPLOYMENT_SECURITY.md`.
**Gap Plan inputs** N/A — foundation slice; no gap is delivered here.
**Amendments consumed** N/A — no frozen contract is amended.
**Django modules** `config/`, `common/`.
**Models** N/A — no business model exists at I0 by design.
**Migrations** N/A — no table is created; `migrate` runs Django's own contrib migrations only.
**APIs** `GET /health`, `GET /ready` (three-tier, **never provider-dependent**). No `/api/v1/` resource endpoint.
**Commands** N/A — no domain exists.
**Selectors** N/A — no domain exists.
**Events** N/A — the outbox table lands at I1.
**Permissions** N/A — the permission catalog lands with B1 at I1.
**Celery tasks** N/A — no task; the **five frozen queues are declared and consumed** by a worker, carrying no work.
**Provider adapters** N/A — **deliberate**: I0 must start with zero provider credentials.
**Django Admin** N/A — no operator surface before I12; Django Admin is installed but registers nothing.
**Deliverables** settings per environment (`B14_29` §5) · **the browser-origin contract and its fail-closed validation (`B14_11` §2–§3)** · **five frozen Celery queues, no sixth** · error envelope · idempotency-key middleware · `If-Match`/`expected_version` helper · cursor pagination · public-ID generation and prefix validation · structured logging with the **redaction processor** · **fail-closed startup validation** · **`client_ip()` — the only forwarded-header parser** (`B14_31` §5) · `.env.example` · pinned toolchain (`B14_29`) · CI pipeline (`B14_30` §2) · container definition (`B14_30` §3).
**Tests** `T-ENV-1..5` · `T-SEC-2`, `T-SEC-5`, `T-SEC-7` · `T-TOOL-1..7` · `T-CI-1..8` · `T-PROXY-1,2,5,6,7,8` · **`T-CORS-1..8`** · **`T-HANDOFF-PATH-1`** · error-envelope shape · queue declaration.
**Security gates** `DEBUG=False` outside local · `ALLOWED_HOSTS` non-wildcard in staging/prod · secret validation fail-closed · **no secret in any startup log** · **trust-boundary safe default: `TRUSTED_PROXY_COUNT=0`, forwarded headers ignored** · **browser-origin fail-closed: `BROWSER_TOPOLOGY` declared, no wildcard origin, no credentialed wildcard, `cross_site` refused in staging/production (`B14_11` §3)** · `check --deploy` clean.
**Observability** structured JSON logging with the redaction processor · `request_id`/`correlation_id`/`causation_id` propagation primitives · Sentry wiring with mandatory before-send scrubbing (absent DSN disables telemetry without affecting the app).
**Migration/backfill** N/A — no data exists.
**Demo** **DEMO 0** — the app starts, connects to PostgreSQL and Redis, a Celery worker consumes the five queues, `/health` and `/ready` respond, and **starting with zero provider credentials succeeds**.
**DoD** CI green on all 16 stages · migrations run clean · redaction test passes · no provider dependency anywhere · **every `B14_29` pin present in `uv.lock`**.
**Dependencies** N/A — first slice.
**Rollback** N/A — greenfield; nothing to roll back.
**Non-goals** any business model · any provider · any operator surface · any authentication (I1).

---
## I1 — Tenant / Auth / Workspace + platform substrate
**Goal** Real sessions, workspaces, memberships, RBAC and entitlements — plus the B12 outbox/inbox substrate and the audit log.
**Frozen source contracts** B1 (all — `B1_AUTHORIZATION_RBAC.md`, `B1_AUTH_SESSION_DESIGN.md`, `B1_ENTITLEMENT_QUOTA_BOUNDARY.md`), `B12_OUTBOX_MODEL.md`, `B12_QUEUE_TOPOLOGY.md`, `B12_IDEMPOTENCY_MODEL.md`, `B13_AUTHENTICATION_SESSION_SECURITY.md`, `B13_AUTHORIZATION_TENANCY.md`, `B13_AUDIT_LOGGING.md`, B8 entitlement evaluation.
**Gap Plan inputs** N/A — no gap; this is frozen B1/B12 implemented as written.
**Amendments consumed** `CA-09` — **permission-catalog scaffolding only**; the 19 non-deferred additive codes are registered as the catalog grows, and **no deferred code is minted** (`B14_08` §5).
**Django modules** `accounts`, `identity_access`, `workspaces`, `entitlements`, `platform_async`, `auditlog`.
**Models** `users`, `user_credentials`, `user_email_tokens`, `sessions`, `workspaces`, `memberships`, `invitations`, `roles`; `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas`, `usage_counters`, `usage_ledger`, **`workspace_plan_assignments`**; `outbox_events`, `worker_executions`, `provider_request_attempts`, `webhook_receipts`, `integration_connections`, `integration_health_snapshots`, `platform_dead_letters`, `platform_reconciliation_cases`; `audit_logs`.
**Migrations** **M01, M02, M03**.
**APIs** the I1 set in `B14_06` §2.
**Commands** the 15 frozen B1 commands, plus **`AssignWorkspacePlan`** (`entitlements`; **system-only, no API, no permission code** — the downward seam `billing` will call from I9, `B14_03` §6b).
**Selectors** members, workspace, `EvaluateEntitlement` (**reads `entitlements`-owned rows only; an absent `workspace_plan_assignments` row resolves to the frozen default `PLAN-STARTER` — fail-closed to the lowest tier** — `B14_03` §6b), audit search.
**Events** `WorkspaceUpdated`, `MembershipRoleChanged`, `SessionRevoked` (frozen) via the outbox.
**Permissions** the frozen B1 catalog for **all six workspace roles**, enforced through the **16-step pipeline** implemented once in `common/authz.py`.
**Celery tasks** `dispatch_outbox_event` on `default`.
**Provider adapters** N/A — no provider is touched by B1 or the outbox substrate.
**Django Admin** audit log (**read-only**); dead letters (**read-only** at this stage — operator actions land at I12).
**Tests** 16-step pipeline order · **`T-RBAC-1..5` (six roles present, zero frozen cells changed, client-supplied role ignored)** · **cross-workspace isolation `T-ISO-1..n` (`404`, never `400`)** · session revocation · role-mutation rank guards · outbox atomicity `T-ASYNC-3` · **entitlement ordering: `ENTITLEMENT_LOCKED` before quota before permission** · **`T-ENT-5` (NC): with no `workspace_plan_assignments` row, evaluation resolves to `PLAN-STARTER`, never to unlimited** · **`T-ENT-7` (NC): `entitlements` imports nothing from `billing`**.
**Security gates** no authorization decision cached (`B1-D-006`) · session cookie/CSRF production settings · **client never supplies role, workspace or permissions** · every mutation writes an audit row with actor and workspace.
**Observability** audit rows for every B1 mutation · `outbox_pending_gauge`, `outbox_dispatch_attempts_total{outcome}` · correlation chain from HTTP request through command to outbox event.
**Migration/backfill** none — three new-table groups, no existing data.
**Demo** **DEMO 0+** — register, verify, log in, create a workspace, invite a member, switch workspace, see a real entitlement decision, and see the audit rows it produced.
**DoD** every subsequent slice can rely on `request.workspace` and `request.membership` · audit rows written · outbox dispatching · **all six workspace roles resolvable**.
**Dependencies** **I0**.
**Rollback** drop M01–M03 while unused; no external effect exists to reverse. Dropping `workspace_plan_assignments` restores default-tier evaluation, which is fail-closed.
**Non-goals** CRM · providers · Django Admin operator **actions** (I12) · any new permission beyond the frozen catalog.

---
## I2 — CRM core + Discovery schema foundation
**Goal** Leads, Contacts, Tasks, Appointments, Notes and the activity timeline — **Discovery-shaped only**, exactly as frozen B2 stands today — on top of the Discovery-owned schema they structurally require.
**Frozen source contracts** B2 (all — `B2_LEAD_AGGREGATE.md`, `B2_CONTACT_MODEL.md`, `B2_TASK_APPOINTMENT_MODEL.md`, `B2_NOTE_ACTIVITY_TIMELINE.md`, `B2_TIMELINE_IDENTITY_MODEL.md`, `B2_STATE_MACHINES.md`, `B2_LEAD360_READ_MODEL.md`, `B2_CRM_LIST_QUERY_MODEL.md`, `B2_LEAD_PROVENANCE_DUPLICATION.md`, `B2_CRM_DOMAIN_BLUEPRINT.md`), `B3_DATA_MODEL.md`, `B3_BUSINESS_IDENTITY_MODEL.md`, `B3_DOMAIN_OWNERSHIP.md`, `B11_DOMAIN_ATTACHMENT_MODEL.md`.
**Gap Plan inputs** N/A — frozen B2 implemented as written; no gap is delivered.
**Amendments consumed** N/A — no frozen contract is amended at I2.
**Django modules** `discovery` (**schema + `UpsertBusiness` normalization only**), `crm`, `files`, **`analytics` — INTRODUCED** (`Party360Composer` only; **owns no table**, dashboard and report sections arrive at I10/I14 — `B14_03` §3, `N-03`).
**Models** `businesses`, `business_identities`, `discovery_jobs`, `discovery_queries`, `discovery_results` (**owned by `discovery`**); `leads`, `lead_tags`, `lead_provenance`, `contacts`, `lead_contacts`, `tasks`, `appointments`, `notes`, `crm_activities`; `file_assets`, `file_attachments`.
**Migrations** **M04, M05, M06** — in that order (`B14_04` §4). **`analytics` adds none — composition creates no table and no FK.**
**APIs** the I2 set in `B14_06` §2. **No Discovery API** — `/discovery/*` lands at I3.
**Commands** the 18 frozen B2 commands, plus `UpsertBusiness` (`discovery`-owned, **normalization service only, no provider, no job**).
**Selectors** lead list, **Lead 360 — composed by `analytics`'s `Party360Composer`, not by `crm`** (`B14_03` §5a), calendar, contacts-in-Lead-context, attachments by subject. **Register Party360 providers: `lead`, `contacts`, `tasks`, `appointments`, `notes` (`crm`) · `business` (`discovery`) · `files` (`files`)** — registration in `config/`; every other section resolves `unavailable` (`B14_03` §5b).
**Timeline** **the merged timeline is composed by `analytics`'s `TimelineComposer`, not by `crm`** (`B14_03` §5e). **Register Timeline contributor: `crm`** — its own `crm_activities` entries and nothing else. `messaging` and `pipeline` contributors do not exist yet, so the timeline is **CRM entries only** and requires neither module (`T-P360-13`). `GET /leads/{id}/timeline` and `Lead360.activities[]` are both served by the composer.
**Events** frozen B2 set — `LeadConverted`, `ContactAdded/Updated/Removed`, task/appointment/note events — via the outbox.
**Permissions** `lead.*`, `task.*`, `appointment.*`, `file.*`, `business.view` — frozen cells for all six roles.
**Celery tasks** N/A — B2 write paths are synchronous; the only async is outbox dispatch from I1.
**Provider adapters** N/A — **deliberate**: `M04` is a schema prerequisite; `places` and `scraping` land at I3.
**Django Admin** N/A — tenant business data is never admin-editable (`B14_12` §4).
**Tests** CRM-INV-1…18 · `last_activity_at` monotonicity under out-of-order events (`GREATEST()`) · one Lead per Business per workspace (CRM-INV-10) · contact PII never in an event or audit payload · **no unique index on `contacts.phone`/`email`** (CRM-INV-18) · **`T-MIG-5` (NC): no CRM code writes a Discovery-owned table** · **`T-MIG-6` (NC): no Discovery job, port or adapter is reachable** · `T-ARCH-1..10` · **`T-P360-1`** (Lead 360 renders with every optional section `unavailable`) · **`T-P360-7/8/9/11/12` (NC)** · **`T-P360-13`**: the merged timeline serves CRM entries alone, with **no `messaging`/`pipeline` module installed and no import of either** · **`T-P360-16` (NC)** and **`T-P360-17` (NC)**.
**Security gates** workspace isolation on every CRM query · contact PII excluded from events and audit payloads · file validation gates · cross-workspace `contact_ref` resolves `404` never `400`.
**Observability** CRM mutation audit codes · timeline **merge** read latency (per contributor) · attachment counts.
**Migration/backfill** none — three new-table groups, no existing data.
**Demo** **DEMO 1** — real CRM persistence: a Business (via `UpsertBusiness`, **no provider, no DiscoveryJob**), a Lead converted from it, a Contact, a Task, an Appointment and a timeline, all from PostgreSQL.
**DoD** frozen B2 acceptance suite green · Lead 360 **and the merged timeline** render from the API **through the composer, with `SAME_LAYER_EDGE_COUNT = 0` and `UPWARD_EDGE_COUNT = 0` over the AST-walked edge set** (`T-ARCH-1`, `W-4`) · **`T-P360-13` green — the timeline is executable with `crm` alone** · **`T-MIG-5`/`T-MIG-6` green** — the Discovery schema exists and the Discovery feature does not.
**Dependencies** **I1**.
**Rollback** drop M04–M06 while unused.
**Non-goals** manual Leads (I5) · Customers (I5) · **Discovery jobs, ports, adapters, quota, API or UI (I3)** · any provider · **any analytics dashboard, metric or report section (I10/I14)** — `analytics` at I2 is the `Party360Composer` and the `TimelineComposer` and nothing else · **any messaging or pipeline timeline entry (I6/I7)** · **any copy of a cross-domain entry into `crm_activities`** (frozen CRM-INV-13, permanently).

---
## I5 — Lead / Customer / Identity expansion · **the P0 heart**
**Goal** Track B: Customers (B2B **and** B2C), Contacts UI, manual Leads **with a usable identity**, identity resolution, import and custom fields. **CRM becomes independent of Discovery.**
**Frozen source contracts** `B2_LEAD_AGGREGATE.md` §1/§4, `B2_CONTACT_MODEL.md` §§2–4, `B2_LEAD360_READ_MODEL.md` §1, `B2_CRM_LIST_QUERY_MODEL.md` §§2,4,5,7, `B2_LEAD_PROVENANCE_DUPLICATION.md` §3, `B3_BUSINESS_IDENTITY_MODEL.md` §4 (precedent), `B9_DUAL_TRACK_COMPATIBILITY.md`, `B11_DOMAIN_ATTACHMENT_MODEL.md`, `B12_IDEMPOTENCY_MODEL.md`, `BACKEND_DATA_GOVERNANCE.md`.
**Gap Plan inputs** `GAP-001`, `GAP-002`, `GAP-003`, `GAP-004`, **`GAP-005` (part 1 — see `DEMO A1`)**, `GAP-006`, `GAP-008`, `GAP-010`, `GAP-025` (FE cutover trigger).
**Amendments consumed** **`CA-01`** (`NON_ADDITIVE`) · **`CA-15`** (`NON_ADDITIVE`) · `CA-03` · `CA-05` · `CA-06` · `CA-07` · `CA-08` · `CA-09` · `CA-10` (`customer`, `import_batch`) · **`CA-14`**.
**Django modules** `customers`, `identity`, `imports`, `customfields`, extended `crm`.
**Models** `customers`, **`customer_contacts`** (owned by `customers`); `party_identifiers`; `field_definitions`, `custom_field_values`; `import_batches`, `import_rows`; extended `leads` and `contacts`.
**Migrations** **M07 (`CA-01`) · M08 · M09 (`CA-05`) · M10 (`CA-15`) · M11 · M12 · M13 · M14 (`CA-01` import FK)** — in that order.
**APIs** the I5 set in `B14_06` §2, including **`POST /leads`** with the `CA-15` primary-Contact contract and the `display_*` projection on `LeadListItem` and Lead 360.
**Commands** `CreateCustomer`, `UpdateCustomer`, `ArchiveCustomer`, `LinkContactToCustomer`, `UnlinkContactFromCustomer`, `ConvertLeadToCustomer`, **`CreateLead`**, `DefineCustomField`, `ArchiveCustomField`, `SetCustomFieldValues`, `CreateImportBatch`, `SetImportMapping`, `RunImportDryRun`, `CommitImportBatch`.
**Selectors** customer list, **Customer 360 via `party360` — composed by `analytics`, root `customer`** (`B14_03` §5a), contacts list (**masked for Viewer**), `resolve_party` (**internal**), import preview/results, custom-field definitions and values, **the `CA-15` display projection**. **Register Party360 providers: `profile` (`customers`) · `custom fields` (`customfields`)** (`B14_03` §5b).
**Events** `CustomerCreated/Updated/Archived`, `LeadCreated`, `LeadConvertedToCustomer`, `ContactLinkedToCustomer`, `ImportBatchCreated/Completed`.
**Permissions** `customer.view|create|update|archive|assign`, `contact.view|manage`, `import.manage`, `customfield.manage` — **six-role cells per `B14_08` §4**. `customer.merge` is **registered but not granted** (post-P0).
**Celery tasks** `import_commit_batch`, `import_process_row` on `default`; per-row identity `(batch_id, row_number)`; **an `unknown` row is recorded and surfaced to a human, never re-executed** (`B12-D-A020`).
**Provider adapters** N/A — **deliberate and load-bearing**: I5 requires **zero** provider credentials.
**Django Admin** N/A — Customers, Contacts and Leads are tenant business data and are never admin-editable.
**Tests** **`T-CA01-1..7`** · **`T-CA15-1..8`** · **`T-TRACKB-1..5`** (zero `discovery_jobs`) · `T-CUS-1..8` · **`T-MASK-1..5`** · `T-IMP-1..6` (**dry run writes nothing**; `(batch,row)` idempotency; **`unknown` rows never auto-retried**) · `T-ID-1..3` · **`T-CF-1..6`** *(all six are `GAP-010` definition, validation, permission and isolation tests and all six execute here; `GAP-011` value search/filter is `T-CF-7..8` at I14 — `B14_19` §5.5, `N-02`)* · `T-RBAC-3,6,8` · `T-MIG-1..4` · **`T-P360-9` (NC): `customers` imports none of `intelligence`, `messaging`, `pipeline`, `support`, `revenue`** · **`T-P360-10`** (mixed authorization).
**Security gates** Viewer masking server-side, **including a Contact-derived `display_name`** · import invokes owning-domain commands, **never target tables** · identity resolution cannot omit `workspace_id` · **no PII column added to `leads`** · cross-workspace refs `404`.
**Observability** `identity_resolution_total{result}` (`resolved|unresolved|ambiguous`) · `import_rows_total{outcome}` · **alert: import batch stuck in `committing`** (`CB-21`) · customer/contact/import audit codes.
**Migration/backfill** **none** — every existing Lead has a Business, satisfies the widened `CA-01` constraints unchanged, and is unaffected by `CA-15`.
**Demo** **DEMO A1 — end of I5.** Manual **organization** Customer with two Contacts (one primary) → manual **person** Customer with its single Contact → Customer 360 → Task, in a workspace with **zero `discovery_jobs`**, showing on screen: **no DiscoveryJob, no fake Business, no `lead_provenance` row, no provider credential configured.** Then **DEMO B**: CSV → mapping → dry run → commit → partial-failure results → error CSV.
**DoD** `T-TRACKB-1..5`, `T-CA01-*` and `T-CA15-*` green · **`GAP-006` shipped in this same slice** as `GAP-003`/`GAP-008` (the hard sequencing rule) · **`CA-15` shipped in the same slice as `CA-01`** · Track-A regression byte-identical · **`GAP-005` is `PARTIAL` — completed at I7 by `DEMO A2`**.
**Dependencies** **I2** (needs `leads`, `contacts`, `file_assets`, and `businesses` for `customers.business_id`).
**Rollback** `CA-01` and `CA-15` reversible until the first non-discovery Lead exists; M08–M14 droppable while unused.
**Non-goals** merge **execution** (`GAP-007`, post-P0) · public forms (`GAP-009`, deferred) · quotes (deferred) · **Deals — I7**.

---
## I7 — Pipeline / Deals
**Goal** Real pipelines, stages and deals, with forecast value firewalled from revenue — and the **completion of the Track-B independence proof**.
**Frozen source contracts** `B2_NOTE_ACTIVITY_TIMELINE.md`, `B2_TIMELINE_IDENTITY_MODEL.md` (the Pipeline timeline contributor), B6 (all — `B6_PIPELINE_MODEL.md`, `B6_PIPELINE_STAGE_MODEL.md`, `B6_DEAL_AGGREGATE.md`, `B6_DEAL_STATE_MACHINE.md`, `B6_REVENUE_FIREWALL.md`), `B6_B2_HANDOFF_CONTRACT.md`, `B6_B5_MESSAGING_BOUNDARY.md`.
**Gap Plan inputs** **`GAP-005` (part 2 — completion)**. No other gap.
**Amendments consumed** N/A — B6 needs none (`19_CONTROLLED_AMENDMENT_PLAN.md` §0).
**Django modules** `pipeline`.
**Models** `pipelines`, `pipeline_stages`, `deals`.
**Migrations** **M18**.
**APIs** `GET/POST /deals` · `GET/PATCH /deals/{id}` · `POST /deals/{id}/stage` · `/deals/{id}/close` · `GET /pipelines`.
**Commands** `CreateDeal`, `UpdateDeal`, `MoveDealStage`, `CloseDeal`.
**Selectors** pipeline board, deal detail, `weighted_value`. **Register Party360 provider: `deals`** — `EntityRef[]` only; **no `value`, `stage` or `probability` crosses into the 360** (frozen `B2_LEAD360_READ_MODEL.md` §2, `B14_03` §5b, `T-P360-4`). **Register Timeline contributor: `pipeline`** — its own deal entries, enforcing `deal.view` and existing masking; from this slice the merged timeline carries CRM **+ authorized Messaging + authorized Pipeline** entries, and **`crm` still imports no `pipeline` symbol** (`B14_03` §5e, `T-P360-15`).
**Events** `DealWon`, `DealLost` (frozen).
**Permissions** `deal.view|create|update|close` — frozen cells, all six roles.
**Celery tasks** N/A — B6 write paths are synchronous.
**Provider adapters** N/A — Pipeline touches no provider.
**Django Admin** N/A — tenant business data.
**Tests** stage transitions and guards · `expected_version` concurrency · **`T-REV-1` (NC): closing a Deal writes no `revenue_events` row** · `weighted_value` computed but never persisted to revenue · **`T-TRACKB-6`: a Deal is created for a Track-B Customer in a workspace with 0 `discovery_jobs`** · **`T-ARCH-1`: no import edge `revenue → pipeline` or `pipeline → revenue`** · **`T-P360-4`**: the `deals` section flips `unavailable → present` at this slice and at no earlier one · **`T-P360-15`**: authorized Pipeline entries join the merged timeline in deterministic order from this slice, `deal.view` is preserved, and **`crm` imports no `pipeline` symbol**.
**Security gates** workspace isolation · `deal.close` gated above ordinary update · no deal field reaches `revenue`.
**Observability** deal stage-transition metrics · win/loss counts (**never revenue**).
**Migration/backfill** none.
**Demo** **DEMO A2 — end of I7.** Take the **existing Track-B Customer from DEMO A1** (organization and person) → create a Deal → move it through stages → close it Won, in a workspace with **still zero `discovery_jobs`**, showing on screen: **no revenue figure changes**. Plus a Kanban board with real stage moves.
**DoD** frozen B6 acceptance suite green · `T-REV-1` and `T-TRACKB-6` passing · **`T-P360-15` green — the Pipeline timeline contributor is registered and `crm → pipeline` remains absent** · **`GAP-005` now `COMPLETE`** (A1 + A2 together).
**Dependencies** **I2, I5**.
**Rollback** drop M18 while unused.
**Non-goals** quotes (deferred) · forecasting tooling · multi-currency (`B6-D-C002`) · any revenue write.

---
## I3 — Discovery features
**Goal** DiscoveryJob orchestration and provider access, on the schema already created at I2 — provider-free domain plus two adapters behind ports.
**Frozen source contracts** B3 (all — `B3_DISCOVERY_BLUEPRINT.md`, `B3_DISCOVERY_REQUEST_MODEL.md`, `B3_JOB_STATE_MACHINE.md`, `B3_PROVIDER_ABSTRACTION.md`, `B3_NORMALIZATION_DATA_QUALITY.md`, `B3_QUOTA_COST_CONTROL.md`, `B3_ACQUISITION_PROVENANCE.md`, `B3_RETRY_FAILURE_MODEL.md`), `B12_PROVIDER_CAPABILITY_MODEL.md`, `B12_PROVIDER_CONFIGURATION_MODEL.md`, `B12_OUTBOUND_HTTP_POLICY.md`.
**Gap Plan inputs** N/A — frozen B3 implemented as written.
**Amendments consumed** N/A.
**Django modules** `discovery` (features); `adapters/places`, `adapters/scraping`.
**Models** N/A — **all Discovery tables were created at I2 (`M04`)**; I3 adds none.
**Migrations** **N/A — none.** This is the schema-prerequisite / feature-enablement split (`B14_04` §1).
**APIs** `GET/POST /discovery/jobs` · `POST /discovery/jobs/{id}/cancel` · `GET /discovery/jobs/{id}/results` · `GET /businesses/{id}` · `POST /businesses/{id}/convert`. **Webhook** `POST /webhooks/scraping` (receipts and rejects until a verification scheme exists).
**Commands** `CreateDiscoveryJob`, `CancelDiscoveryJob`, `MergeBusiness`, `ExportResults` (frozen).
**Selectors** jobs, results, business detail, quota state.
**Events** `BusinessDiscovered`, `BusinessUpserted`, `BusinessMerged`, `JobSucceeded` (frozen).
**Permissions** `discovery.view|run|export`, `business.view|convert` — frozen cells, all six roles.
**Celery tasks** `run_discovery_job` on **`providers.slow`**; `unknown` outcome opens reconciliation `P-1` and **never blindly repeats**.
**Provider adapters** **`places`** (Google Places — **`ID-02` verify official docs in-slice**); **`scraping`** (vendor **unselected**, `B12-D-B005`; **`ID-01`**).
**Django Admin** Discovery connections appear in Integration Operations **read-only** at I3; operator **actions** land at I12.
**Tests** `T-DISC-1..6` · normalized mapping · `unknown` opens a case and never repeats · **`T-DISC-6` (NC): scraping connection cannot be enabled while no verification scheme exists** · `T-DISC-5`: missing key ⇒ `not_connected`, platform unaffected.
**Security gates** no vendor identifier in the `discovery` domain · provider payload minimization · attribution obligations honoured where results display · no raw provider body logged · **`MAX_JOB_ATTEMPTS` treated as an architectural bound, never an outage knob**.
**Observability** `provider_request_latency_ms{provider,operation}` · `provider_rate_limited_total{provider}` · quota signals · job outcome counts.
**Migration/backfill** N/A — no schema change in this slice.
**Demo** **DEMO 2** — a real Discovery job producing real Businesses (Places configured; scraping stubbed and **not enabled**).
**DoD** domain contains zero vendor identifiers · a stub adapter passes every test (`T-DISC-2`) · `ID-02` verification evidence recorded.
**Dependencies** **I2** (schema `M04`).
**Rollback** disable the Places connection; the Discovery domain degrades, the platform does not. No schema to reverse.
**Non-goals** selecting a scraping vendor · AI analysis (I4) · enabling scraping.

---
## I4 — AI Lead Intelligence
**Goal** Business → analysis → score and recommendations. **B4 executes nothing** (`B4-D-A012`).
**Frozen source contracts** B4 (all — `B4_EXECUTIVE_SUMMARY.md`, `B4_INTELLIGENCE_SUBJECT_MODEL.md`, `B4_DATA_MODEL.md`, `B4_INTELLIGENCE_RUN_STATE_MACHINE.md`, `B4_SCORING_MODEL.md`, `B4_B3_ACQUISITION_BOUNDARY.md`, `B4_COST_RATE_LIMIT_MODEL.md`), `B3_B4_HANDOFF_CONTRACT.md`, `B12_UNKNOWN_OUTCOME_MODEL.md`.
**Gap Plan inputs** N/A.
**Amendments consumed** N/A.
**Django modules** `intelligence`.
**Models** `intelligence_runs`, `intelligence_signals`, `ai_usage_records`.
**Migrations** **M15**.
**APIs** `POST /intelligence/analyses` · `GET /intelligence/analyses/{id}` · `POST /intelligence/analyses/{id}/reanalyze`.
**Commands** `RequestAnalysis`, `Reanalyze`, `CancelAnalysis` (frozen).
**Selectors** analysis detail, recommendations. **Register Party360 provider: `intelligence`** — the section flips `unavailable → present` here and **not one slice earlier** (`B14_03` §5b, `T-P360-2`).
**Events** `LeadIntelligenceCompleted` (frozen) — **does not move `last_activity_at`** (CRM-INV-12).
**Permissions** `ai.use` — frozen cells (`A A A C C ·`), all six roles.
**Celery tasks** `run_intelligence_analysis` on **`providers.slow`**; identity `(lead, input_fingerprint)`; `unknown` ⇒ `P-1`.
**Provider adapters** the AI provider **through the same `AIProviderPort`** introduced properly at I13. **I4 may ship against a deterministic stub** — the domain contract is identical either way.
**Django Admin** N/A — no operator surface for B4.
**Tests** analysis reuse by `(lead, input_fingerprint)` · **(NC) no B4 code path writes a CRM, messaging, deal or automation row** · cost/rate limits · **no cross-workspace result caching (`B4-D-A028`)** · **`T-B4-1` (NC): no field or flag on a recommendation admits a send** (`B5-D-A021`) · **`T-P360-2`**: the `intelligence` section flips `unavailable → present` at this slice and at no earlier one.
**Security gates** workspace-scoped analysis · **`PD-002` masking before any provider egress** · no prompt or completion text in logs, traces or audit payloads · aggregate-only usage telemetry.
**Observability** `ai_usage_records` aggregates · analysis latency · reuse-hit ratio.
**Migration/backfill** none.
**Demo** **DEMO 3** — Business → AI Intelligence → Lead conversion with provenance.
**DoD** recommendations render · **nothing is auto-applied** · `T-B4-1` green.
**Dependencies** **I2** (schema), **I3** (Businesses to analyse).
**Rollback** drop M15 while unused; disable the provider connection.
**Non-goals** the conversational agent (I13) · any execution of a recommendation.

---
## I6 — Messaging / WhatsApp + team inbox + assignment
**Goal** Real conversations and human-sent WhatsApp; the team inbox with **rule-based routing and ownership**; and the **schema and command groundwork** for AI/human handling mode.
**Frozen source contracts** `B2_NOTE_ACTIVITY_TIMELINE.md`, `B2_TIMELINE_IDENTITY_MODEL.md` (the Messaging timeline contributor), B5 (all — `B5_CONVERSATION_MODEL.md`, `B5_OUTBOUND_PIPELINE.md`, `B5_CUSTOMER_SERVICE_WINDOW.md`, `B5_TEMPLATE_MODEL.md`, `B5_CONSENT_COMMUNICATION_POLICY.md`, `B5_WEBHOOK_SECURITY_MODEL.md`, `B5_RATE_COST_RETRY_MODEL.md`, `B5_CONTACT_PHONE_RESOLUTION.md`, `B5_B4_HANDOFF_CONTRACT.md`), `B12_WEBHOOK_GATEWAY.md`, `B12_UNKNOWN_OUTCOME_MODEL.md`, `B13_WEBHOOK_SECURITY.md`.
**Gap Plan inputs** **`GAP-013` — COMPLETE** (team inbox, routing, ownership) · **`GAP-022` — COMPLETE** (assignment rules; pulled forward from I14 because P0 `GAP-013` depends on it) · **`GAP-012` — GROUNDWORK ONLY** (see below).
**Amendments consumed** **`CA-02`**.
**Django modules** `messaging`, `assignment`; `adapters/whatsapp`.
**Models** `conversations`, `participants`, `messages`, `message_deliveries`, `templates`; `assignment_rules`, `assignment_counters`.
**Migrations** **M16, M17 (`CA-02`), M23**.
**APIs** the I6 set in `B14_06` §2, plus `GET/POST /assignment/rules`. **Webhooks** `GET|POST /webhooks/whatsapp`.
**Commands** the frozen B5 twelve, plus `SetConversationHandlingMode`, `StartHumanTakeover`, `EndHumanTakeover`, `UpsertAssignmentRule`.
**Selectors** inbox (conversations + assignment + `handling_mode`), conversation detail, eligible assignee. **Register Party360 provider: `conversations`** (`B14_03` §5b, `T-P360-3`). **Register Timeline contributor: `messaging`** — its own message entries, enforcing `conversation.view` and existing masking; from this slice the merged timeline carries CRM **+ authorized Messaging** entries, and **`crm` still imports no `messaging` symbol** (`B14_03` §5e, `T-P360-14`).
**Events** frozen `Conversation*` and `Message*` set, plus `ConversationHandlingModeChanged`, `HumanTakeoverStarted/Ended`.
**Permissions** `conversation.view`, `message.send`, `messaging.manage`, `messaging.provider.manage` (frozen); **`assignment.manage`** (new, six-role cells).
**Celery tasks** `send_outbound_message` on **`providers.fast`** (**`unknown` ⇒ never resend**); `process_webhook_receipt` and `apply_provider_status` on **`webhooks`**.
**Provider adapters** **`whatsapp`** — **`FI-B12-12` gate: `B12-X-001` and `B12-X-014` must be re-verified in-slice** (`B14_33` §3) before any verification code.
**Django Admin** WhatsApp connection appears in Integration Operations **read-only**; operator actions at I12.
**Tests** `T-WA-1..6, 8` · `T-CA02-1..4` (**structural half only — see below**) · takeover race resolves to one winner via row-locked CAS · **`T-ASG-1..4`** (round-robin fairness; **counter is a PostgreSQL row under `FOR UPDATE`, never Redis**; workspace isolation; permission enforcement) · **`T-TKT-*` not applicable here** · `T-FIB12-1`, `T-FIB12-3` · **`T-P360-3`**: the `conversations` section flips `unavailable → present` at this slice and at no earlier one · **`T-P360-14`**: authorized Messaging entries join the merged timeline in deterministic order from this slice, unauthorized entries are absent, and **`crm` imports no `messaging` symbol**.
**Security gates** signature verification **before any parse** · `WEBHOOK_MAX_BODY_BYTES` (`CB-03`) enforced pre-parse · consent and service-window refusal **before** any provider call · no secret or raw body in any log · **one send path, human actor**.
**Observability** `webhook_receipts_total{provider,status}` · delivery-status monotonicity counters · `provider_rate_limited_total{whatsapp}` · alert on webhook failure rate (`CB-19`).
**Migration/backfill** `handling_mode` defaults to `'human'`, reproducing current behaviour for every existing row; no backfill.
**Demo** Real inbound + human-sent outbound with delivery status; identity-resolved Customer context in the inbox; a conversation **routed by an assignment rule** to a specific member and reassigned by a human.
**DoD** frozen B5 acceptance suite green · `handling_mode` defaults reproduce prior behaviour · **`T-P360-14` green — the Messaging timeline contributor is registered and `crm → messaging` remains absent** · **`GAP-013` and `GAP-022` `COMPLETE`** · **`GAP-012` explicitly `GROUNDWORK`, not complete**.
**Dependencies** **I5** (`resolve_party` for inbound identity), **I1**.
**Rollback** disable the WhatsApp connection; `handling_mode` reversible until the first non-`human` value; drop M23 while unused.
**Non-goals** AI proposals (I13) · **claiming `GAP-012` complete** · email (`GAP-026`, deferred).

> ### `GAP-012` is groundwork at I6 — and the tests say so (`V-08`, `V-M09`)
> The approved Gap Plan makes **`GAP-012` depend on `GAP-014`**, which lands at I13. I6 therefore delivers only what is **executable without an AI agent**:
> **Delivered at I6** — the `handling_mode` column and CHECK, its `'human'` default, the three mode/takeover commands, the row-locked CAS race resolution, permission enforcement, and the mode-change events. `T-CA02-1..4` test **exactly these** and nothing else.
> **NOT delivered, NOT tested and NOT claimed at I6** — *"queued AI work re-reads mode at execution"* and *"no AI path reaches `SendMessage`"*. **`aiagent` does not exist at I6, so both assertions would pass vacuously.** They are `T-CA02-5..6` and `T-WA-7`, and they belong to **I13**.
> **A vacuous test may not close a slice.** I6's DoD does not reference them.

---
## I13 — AI Agent / OpenAI + Knowledge base
**Goal** Close the `inbox.copilot` ownership orphan with a governed agent, and **complete `GAP-012`** by making its AI behavioural controls executable.
**Frozen source contracts** *(the line whose absence was `V-05`'s worst instance)* — `B4_EXECUTIVE_SUMMARY.md` and `B4-D-C002`; **`B5_B4_HANDOFF_CONTRACT.md` (`B5-D-A021`)**; `B5_CONVERSATION_MODEL.md`; `B5_OUTBOUND_PIPELINE.md`; **`B7_ACTION_CATALOG.md` §3**; `B7_REVENUE_FIREWALL.md`; `B12_QUEUE_TOPOLOGY.md`; `B12_UNKNOWN_OUTCOME_MODEL.md` (`B12-D-A020`); `B12_PROVIDER_PORT_ARCHITECTURE.md` (`B12-D-A022`); `B13_PRIVACY_DATA_MINIMIZATION.md`; `B13_LOGGING_REDACTION.md`; `B11_DOMAIN_ATTACHMENT_MODEL.md`; `B8_PLAN_CATALOG.md` (`inbox.copilot`).
**Gap Plan inputs** `GAP-014` — **COMPLETE** · `GAP-015` — **COMPLETE** (KB ships here as the grounding source) · **`GAP-012` — COMPLETION** (the AI behavioural half).
**Amendments consumed** `CA-03` (`KBA-`), `CA-09`, `CA-10` (`kb_article`), `CA-11`.
**Django modules** `aiagent`, `knowledge`; `adapters/openai`.
**Models** `agent_sessions`, `agent_proposals` (**no provider fields**); `kb_articles`, `kb_article_versions`, `kb_sources`.
**Migrations** **M24, M25**.
**APIs** `POST /agent/sessions` · `POST /agent/proposals` · **`POST /agent/proposals/{id}/accept`** (human) · `/reject` · `GET/POST /knowledge/articles` · `POST /knowledge/articles/{id}/publish` `/archive`.
**Commands** `StartAgentSession`, `GenerateAgentProposal` (**system**), **`AcceptAgentProposal` (human)**, `RejectAgentProposal`, `CreateArticle`, `PublishArticle`, `ArchiveArticle`. **`AgentSendMessage` is deliberately not created.**
**Selectors** proposals, `kb_retrieval` (**published only**, workspace-scoped, with citations).
**Events** `AgentProposalCreated/Accepted/Rejected`, `KnowledgeArticlePublished`.
**Permissions** `ai.use` (frozen, `member` = `C`), **`agent.manage`**, `knowledge.view|manage` — six-role cells per `B14_08` §4.
**Celery tasks** `generate_agent_proposal` on **`providers.slow`**; identity `(session, intent, context_hash)`; **mode re-read at execution** (`FI-B12-05`); proposal generation is **effect-free**, so abandoning an `unknown` is safe — a consequence of `PD-013`, **not an exception to `B12-D-A020`**.
**Provider adapters** **`openai`** behind **`AIProviderPort`** — **`ID-04` verify request/response shapes in-slice**.
**Django Admin** the AI connection appears in Integration Operations; **no prompt, completion or model output is ever rendered**.
**Tests** `T-AI-1..6` · **`T-CA02-5..6` (the AI half of `GAP-012`, now executable)** · **`T-WA-7` (NC): no AI path reaches `SendMessage`** · `T-KB-1..3` · **`T-AI-1/2` (NC): no AI-owned send command exists** · `T-AI-5` (no provider token in any business-domain contract) · **`T-AI-6` (a second stub adapter passes every `aiagent` test unchanged)** · every answer cites a **published** article · missing `OPENAI_API_KEY` ⇒ inbox works, no proposals.
**Security gates** **`PD-002` masking applied before provider egress, not after** · minimum-necessary context · **no prompt or completion text in logs, traces, metrics or audit payloads** · workspace-scoped context, cross-workspace not expressible · the **authority ladder enforced in `aiagent`, above the port** · **the agent holds no permissions** — accepting invokes the owning domain's command as the human, checked by that domain's guard.
**Observability** `agent_proposals_total{kind,outcome}` · citation-coverage ratio · aggregate-only AI usage · **no content in any label**.
**Migration/backfill** none — two new-table groups.
**Demo** **DEMO C — end of I13.** *Part 1* — WhatsApp inbound from an existing customer's contact → identity resolution → Customer 360 context in the inbox → `ai_assisted` → **AI Provider Port → OpenAI Adapter → OpenAI** → grounded draft **with visible citation** → **a human** reviews, edits and sends through the frozen `SendMessage` path → delivery status by webhook. *Part 2* — a human takes over → **mode flips and AI proposals stop immediately** → an inbound from an **unknown** number opens the conversation **unlinked** with `unresolved` → **no Lead and no Customer is created** → only after a human accepts a proposal does a Contact exist.
**DoD** the authority ladder is enforced **above the port** · `T-AI-5`/`T-AI-6` green · **`T-CA02-5..6` and `T-WA-7` green and non-vacuous** · **`GAP-012` now `COMPLETE`** · `ID-04` verification evidence recorded.
**Dependencies** **I6** (conversations must exist before the agent proposes into them), **I5** (identity + Customer context), **I2**.
**Rollback** disable the OpenAI connection — the inbox continues to work with no proposals; drop M24/M25 while unused.
**Non-goals** **autonomous send (prohibited, `PD-013`)** · any AI-owned send command · AI-driven automation (I8's frozen tiers stand).

---
## I8 — Automation
**Goal** Rules, triggers, conditions, actions and the approval queue, with frozen safety tiers intact.
**Frozen source contracts** B7 (all — `B7_EXECUTIVE_SUMMARY.md`, `B7_AUTOMATION_RULE_AGGREGATE.md`, `B7_TRIGGER_CATALOG.md`, `B7_ACTION_CATALOG.md`, `B7_REVENUE_FIREWALL.md`, `B7_EXECUTION_MODEL.md`, `B7_ACTION_EXECUTION_MODEL.md`, `B7_ACTION_AUTHORIZATION.md`), `B12_INBOX_MODEL.md`.
**Gap Plan inputs** N/A — frozen B7 as written.
**Amendments consumed** N/A at I8 — **`CA-12` lands at I14** with `support`, because its `create_ticket` action needs `tickets` to exist.
**Django modules** `automation`.
**Models** `automation_rules`, revisions, triggers, conditions, actions, `runs`, `step_runs`, `approvals`, `automation_inbox_records`.
**Migrations** **M19**.
**APIs** `GET/POST /automation/rules` · `GET/PATCH /automation/rules/{id}` · `GET /automation/runs` · `POST /automation/runs/{id}/approve` · `/reject`.
**Commands** `CreateRule`, `ActivateRevision`, `PauseRule`, `ApproveRun`, `RejectRun`.
**Selectors** rules, runs, approval queue.
**Events** the frozen `Automation*` set.
**Permissions** `automation.rule.manage|view`, `automation.run.approve` — frozen cells, all six roles.
**Celery tasks** rule evaluation and action execution on `default`; inbox dedup on `(workspace_id, source_event_id)`.
**Provider adapters** N/A — automation never calls a provider directly; a message action routes through `messaging` **after approval**.
**Django Admin** N/A.
**Tests** **`T-AUTO-1` (NC): `send_message` remains `approval_required` — mandatory, non-configurable** · the frozen excluded-action list stays excluded (`close_won_deal`, `change_deal_value`, `create_revenue`, `delete_lead`) · loop prevention and re-entrancy · inbox dedup idempotency · entitlement `automation.rules` gating before quota.
**Security gates** **no automation path reaches a provider send without human approval** · no automation path writes `revenue_events` · workspace isolation on every rule and run.
**Observability** run outcome and loop-block metrics · approval-queue depth.
**Migration/backfill** none.
**Demo** A rule creating a follow-up task automatically, and a message action **held in the approval queue until a human approves**.
**DoD** frozen B7 acceptance suite green · `T-AUTO-1` passing.
**Dependencies** **I2, I5, I6, I7**.
**Rollback** pause all rules; drop M19 while unused.
**Non-goals** new action types beyond `CA-12`'s `create_ticket` (I14) · AI-driven automation · any autonomous customer-facing send.

---
## I9 — Billing / Entitlements + Tap
**Goal** Real subscriptions, plans, invoices and payments — **platform billing only**.
**Frozen source contracts** B8 (all — `B8_EXECUTIVE_SUMMARY.md`, `B8_SUBSCRIPTION_AGGREGATE.md`, `B8_SUBSCRIPTION_STATE_MACHINE.md`, `B8_PLAN_CATALOG.md`, `B8_CHECKOUT_PAYMENT_MODEL.md`, `B8_TAP_PROVIDER_BOUNDARY.md`), `B1_ENTITLEMENT_QUOTA_BOUNDARY.md`, `B12_WEBHOOK_GATEWAY.md`, `B12_UNKNOWN_OUTCOME_MODEL.md`, `B13_PAYMENT_FINANCIAL_SECURITY.md`, `B9_RECONCILIATION_MODEL.md` (`B9-D-A021`).
**Gap Plan inputs** N/A.
**Amendments consumed** `CA-11` (independent per-module capability keys; **`inbox.copilot` reused, not replaced**; **pricing not frozen**).
**Django modules** `billing`, extended `entitlements`; `adapters/tap`.
**Models** `billing_customers`, `subscriptions`, `upgrade_quotes`, `invoices`, `invoice_lines`, `payments`, `payment_attempts`, `refunds`.
**Migrations** **M20**.
**APIs** `GET /billing/subscription` · `GET /plans` · `POST /billing/checkout` · `GET /billing/invoices`. **Webhook** `POST /webhooks/tap`.
**Commands** `StartCheckout`, `ChangePlan`, `ApplyPaymentWebhook` — **each calls `entitlements.AssignWorkspacePlan` downward inside its own transaction** (`B14_03` §6b). **`billing` → `entitlements` is the only direction; `entitlements` never reads `billing`.**
**Selectors** subscription, plan catalog, invoices, entitlement evaluation (**unchanged — still reads `entitlements`-owned rows only**).
**Events** the frozen billing set.
**Permissions** `billing.view|manage`, `payment.manage`, `subscription.change` — frozen cells, all six roles.
**Celery tasks** `charge_payment` on **`providers.fast`** (**`unknown` ⇒ never retried**); `process_webhook_receipt` on `webhooks`.
**Provider adapters** **`tap`** — **`FI-B12-12` gate: `B12-X-005` and `B12-X-006` re-verified in-slice** (`B14_33` §3); **`ID-03`**.
**Django Admin** Tap connection in Integration Operations (read-only until I12).
**Tests** `T-TAP-1..7` · **server-side pricing — a client-supplied amount is rejected** · `hashstring` webhook signature · duplicate webhook no-op · **`unknown` charge never retried** · **`T-REV-3` (NC): a captured payment creates no `RevenueEvent`** · no card data anywhere · `T-FIB12-2`, `T-FIB12-4`, `T-FIB12-7` · **`T-ENT-4`** and **`T-ENT-6` (NC)**: `AssignWorkspacePlan` is written inside the subscription transaction and carries **no amount, currency, payment or card fact** · **`T-ENT-7` (NC)**: `entitlements` imports nothing from `billing`.
**Security gates** **no card data stored, logged or received** · secrets `*_REF`-resolved at call time · amounts server-priced from `upgrade_quotes` · webhook signature verified before parse.
**Observability** payment attempt and webhook metrics · **amounts only as aggregates, never per-customer series**.
**Migration/backfill** none.
**Demo** A real plan upgrade through the Tap sandbox, with entitlements changing and **no customer-revenue row created**.
**DoD** `T-TAP-*` and `T-REV-3` green · connection reaches `connected` then `enabled` · `FI-B12-12` discharge recorded.
**Dependencies** **I1**, plus the I0/I1 B12 substrate.
**Rollback** disable the connection — checkout unavailable, **platform unaffected**; drop M20 while unused.
**Non-goals** customer-facing invoicing (`B9-D-C004`) · refunds beyond frozen B8 scope · **any `revenue_events` write**.

---
## I10 — Revenue / Attribution + Tax
**Goal** The revenue register and attribution, plus the tax boundary — with the firewall demonstrated.
**Frozen source contracts** B9 (all — `B9_REVENUE_EVENT_MODEL.md`, `B9_REVENUE_RECOGNITION_POLICY.md`, `B9_REVENUE_FIREWALL.md`, `B9_ATTRIBUTION_MODEL.md`, `B9_DUAL_TRACK_COMPATIBILITY.md`, `B9_RECONCILIATION_MODEL.md`, `B9_DECISION_REGISTER.md`), B10 (all), `BACKEND_ANALYTICS_SEMANTICS.md`, `B13_PAYMENT_FINANCIAL_SECURITY.md`.
**Gap Plan inputs** N/A.
**Amendments consumed** N/A.
**Django modules** `revenue`, `tax`, **`analytics` — EXTENDED** (the dashboard; the module itself was introduced at I2 — `B14_03` §3).
**Models** `revenue_events`, `revenue_reversals`, `attribution_touchpoints`; `legal_entities`, `tax_profiles`, `tax_buyer_profiles`, `tax_invoices`, `tax_invoice_lines`, `tax_submissions`.
**Migrations** **M21, M22**.
**APIs** `POST /revenue/events` · `POST /revenue/events/{id}/reverse` · `POST /revenue/touchpoints` · `GET /revenue` · `GET /attribution`; tax read surfaces.
**Commands** **`RecordRevenueEvent`** (**human membership only**), `ReverseRevenueEvent`, `RecordTouchpoint`, `IssueTaxInvoice`, `SubmitToZatca`.
**Selectors** revenue totals, attribution ladder, tax documents. **Register Party360 provider: `revenue_refs`** — **identities only, never an amount** (frozen `B2_LEAD360_READ_MODEL.md` §2, `B14_03` §5b, `T-P360-6`).
**Events** `RevenueRecognized` (frozen).
**Permissions** `revenue.recognize|view`, `tax.view` — frozen cells, all six roles.
**Celery tasks** ZATCA submission on `providers.slow` (**deferred activation**).
**Provider adapters** ZATCA — **deferred**; not built in this slice.
**Django Admin** N/A — **`revenue_events` is never admin-editable**.
**Tests** **`T-REV-4` (NC): no module other than `revenue` can write `revenue_events`** · **`T-REV-5`: a Track-B Customer with no Discovery recognizes revenue and reports as *unattributed*, not as an error** (`AT-TRACK-3/4`) · attribution snapshots immutable (`AT-TRACK-5` NC) · amounts `NUMERIC(19,4)` + ISO-4217 · **no customer PII in any B9 table (`AT-SEC-5` NC)** · **`T-ARCH-1`: no `revenue ↔ pipeline` import edge** · **`T-P360-6`**: the `revenue_refs` section flips `unavailable → present` at this slice, carrying **identities only**.
**Security gates** amounts only as aggregates in metrics · no per-customer revenue log lines · human-membership-only writer · **no Deal, Quote, Billing, Automation, AI, Messaging, Ticket or conversion path reaches the writer**.
**Observability** the frozen B9 signal set · recognition and reversal counts.
**Migration/backfill** none.
**Demo** Recognizing revenue for a **manually created (Track-B) Customer**, reported as **unattributed with full recognition** — and a Won Deal from DEMO A2 that changed no revenue figure.
**DoD** `T-REV-1..5` green · the firewall demonstrated end-to-end.
**Dependencies** **I5, I7, I9**.
**Rollback** drop M21/M22 while unused.
**Non-goals** double-entry GL · AR ageing · customer-facing invoicing — all explicitly disowned by frozen B9.

---
## I11 — Files / Storage completion
**Goal** Complete the file lifecycle: upload intents, validation gates, deterministic keys, download tickets, retention and orphan cleanup.
**Frozen source contracts** B11 (all — `B11_EXECUTIVE_SUMMARY.md`, `B11_DOMAIN_MODEL.md`, `B11_STORAGE_MODEL.md`, `B11_UPLOAD_MODEL.md`, `B11_DOMAIN_ATTACHMENT_MODEL.md`, `B11_FILE_VALIDATION.md`, `B11_STORAGE_PROVIDER_BOUNDARY.md`, `B11_DELETION_RETENTION_MODEL.md`, `B11_ORPHAN_CLEANUP_MODEL.md`), `B13_FILE_SECURITY.md`.
**Gap Plan inputs** supports `GAP-008`, `GAP-015`, `GAP-016` — delivers no gap of its own.
**Amendments consumed** `CA-10` — **completed here**; the four enum values were added incrementally by their first users (`B14_04` §2).
**Django modules** `files`; `adapters/storage`.
**Models** `file_assets`, `file_attachments` (created at **M05**, extended here).
**Migrations** N/A — **no new group**; M05 is extended.
**APIs** `POST /files/upload-intent` · `GET /files/{id}/download` · attach/detach.
**Commands** `RequestUpload`, `AttachFile`, `DetachFile`, `DeleteFile`.
**Selectors** attachments by subject, download ticket.
**Events** the frozen file event set.
**Permissions** `file.upload|download` — frozen cells, all six roles.
**Celery tasks** `orphan_file_sweep` on **`maintenance`**; purge with grace periods (`CB-32`, **carried, still open**).
**Provider adapters** object storage behind **`StoragePort`** — **vendor is configuration** (`ID-10`).
**Django Admin** N/A.
**Tests** the **10 ordered validation gates** · deterministic key with **no client-supplied segment** · **tenancy enforced by authorization, never by key parsing** · single-use download tickets · **`T-FILE-1` (NC): B11 is the single storage authority — no second file table** · `legal`-class files undeletable · **no hard delete in Phase 1**.
**Security gates** `access_class` is `private` only · **every byte response re-runs the full authorization chain** · no signed public URL in Phase 1.
**Observability** storage usage and orphan metrics · upload gate rejection counts by gate.
**Migration/backfill** `CA-10` enum values added; no row rewritten.
**Demo** Upload a document, attach it to a Customer **and** a Ticket, download it under permission, and see an unauthorized download **refused**.
**DoD** frozen B11 acceptance suite green · `T-FILE-1` passing.
**Dependencies** **I2, I5**.
**Rollback** unused enum values are droppable; storage vendor swappable behind the port.
**Non-goals** public/anonymous read paths · provider-signed URLs · malware scanning (`B13-D-B012`, reserved not built).

---
## I12 — Async / Integration platform completion + Admin operations
**Goal** Complete the substrate started at I0/I1: dead letters, all eight reconciliation classes, integration health, and the **Django Admin Integration Operations** surface.
**Frozen source contracts** B12 (all), `B13_OPERATOR_MODEL.md`, `B13_RUNBOOKS.md`, `B13_OBSERVABILITY.md`, `B12_IMPLEMENTATION_HANDOFF.md` (`B12-D-A053`).
**Gap Plan inputs** N/A.
**Amendments consumed** N/A.
**Django modules** `platform_async`, `integrations` (operator surface, **owns no tables**).
**Models** completed: `platform_dead_letters`, `platform_reconciliation_cases`, `integration_connections`, `integration_health_snapshots`, `provider_request_attempts`.
**Migrations** N/A — **no new group**; M02 is extended.
**APIs** `GET /operations/dead-letters` · `POST /{id}/replay` · `/abandon` · `GET /operations/reconciliation-cases` · `POST /{id}/resolve` · `GET/PUT /integrations` · `/{id}/configuration` · `/check` · `/enable` · `/disable`.
**Commands** `ConfigureIntegration`, **`CheckProviderConfiguration`**, `EnableIntegration`, `DisableIntegration`, `ReplayDeadLetter`, `AbandonDeadLetter`, `ResolvePlatformReconciliationCase`.
**Selectors** dead letters, cases, health snapshots.
**Events** the frozen platform event set.
**Permissions** `integration.manage`, `platform.operations.view|replay` — **B13 platform namespace, not workspace roles** (`B14_08` §6).
**Celery tasks** `reconciliation_sweep` and `integration_health_check` on `maintenance` / `providers.fast`.
**Provider adapters** all — this slice makes them **operable**, not newly integrated.
**Django Admin** **the full Integration Operations area** (`B14_12`).
**Tests** `T-ADMIN-1..5` · `T-ASYNC-1..6` — **no lease/fence column on `worker_executions`** · **heartbeat-stale ⇒ `unknown`, operator-gated, never re-executed** · **no auto-retry of `UNKNOWN` non-idempotent work** · replay re-runs every original guard and requires a reason · **`EnableIntegration` refused unless `status = connected`** · disable keeps inbound webhooks accepted · **`T-SEC-4` (NC): no secret in any rendered admin response, masked or otherwise** · `T-RBAC-4` · **`T-DISP-1..4`**: registered-name dispatch works, an unknown name is refused, an `unknown`-outcome operation is never dispatched by replay (`B12-D-A020`), and `apps/platform_async/` imports **no** other app.
**Security gates** operator actions audited with a **distinguishable operator actor** · **tenant business models not admin-editable** · no "retry this task" button (`B12-D-A053`) · **no automatic repair of `P-1`/`P-3`/`P-5`/`P-6`/`P-7`**.
**Observability** dead-letter and case gauges with alert bindings (`CB-17`, `CB-18`) · `integration_health_gauge{provider,fact}` · **every alert has a panel** (`B13-D-B020`).
**Migration/backfill** none.
**Demo** The full operator runbook: place credentials in `.env` → restart → Admin → Check Configuration → Test Connection → `connected` → **Enable** — with **no secret visible anywhere**, and a heartbeat-stale worker execution shown as `unknown` and **not** re-executed.
**DoD** every operator action audited · `T-ADMIN-*` and `T-ASYNC-*` green.
**Dependencies** **I1** substrate, plus at least one provider slice (**I3, I6 or I9**).
**Rollback** disable connections; the operator surface is additive and removable.
**Non-goals** a "retry this task" button · operator access to tenant business data · automatic repair of report-only reconciliation classes.

---
## I14 — Support / SLA / merge / calendar / reporting *(post-P0)*
**Goal** Customer support with SLA, the calendar read model, reporting expansion, and governed merge execution.
**Frozen source contracts** `B2_TASK_APPOINTMENT_MODEL.md`, `B2_CRM_ACTIVITY_VOCABULARY.md`, `B2_CONTACT_MODEL.md` §4, `B7_TRIGGER_CATALOG.md`, `B7_ACTION_CATALOG.md`, `B11_DOMAIN_ATTACHMENT_MODEL.md`, `B12_QUEUE_TOPOLOGY.md` (`maintenance`), `BACKEND_ANALYTICS_SEMANTICS.md`, `B9_ATTRIBUTION_MODEL.md`.
**Gap Plan inputs** `GAP-016`, `GAP-017`, `GAP-021`, `GAP-011`, `GAP-023`, and **`GAP-007` merge execution**. *(`GAP-022` completed at I6.)*
**Amendments consumed** **`CA-12`** (triggers `customer_created`, `ticket_created`, `sla_breached`; action `create_ticket`, tier `auto_safe`), **`CA-04`** (merge lineage), `CA-10` (`ticket`).
**Django modules** `support`, `identity` (merge), extended `customfields`, extended `crm` (calendar), **`analytics` — EXTENDED** (the 11 report sections), extended `automation` (`CA-12` action).
**Models** `tickets`, `ticket_activities`, `sla_policies`, `ticket_sla_clocks`; `merge_records`.
**Migrations** **M26, M27**.
**APIs** `GET/POST /tickets` · `GET/PATCH /tickets/{id}` · `/assign` `/resolve` `/reopen` · `POST /customers/{id}/merge` · `GET /activities/calendar` · `GET /analytics/{section}`.
**Commands** `CreateTicket`, `AssignTicket`, `ChangeTicketStatus`, `ResolveTicket`, `ReopenTicket`, **`MergeParties`** (human only, reason mandatory).
**Selectors** ticket list, Ticket 360, calendar (union of tasks + appointments), the 11 new report sections, custom-field value search. **Register Party360 provider: `tickets`** (`B14_03` §5b, `T-P360-5`).
**Events** `TicketCreated/Assigned/Resolved/Reopened`, `TicketSlaBreached` (identity `(ticket, policy, clock)`), `PartiesMerged`.
**Permissions** `ticket.view|create|update|assign|resolve`, **`customer.merge`** — six-role cells per `B14_08` §4.
**Celery tasks** `sla_breach_sweep` on **`maintenance`** — idempotent on `(ticket, policy, clock)`; **breach reports, never auto-acts**.
**Provider adapters** N/A — support and merge touch no provider.
**Django Admin** N/A — tickets and merges are tenant business data.
**Tests** **`T-TKT-1..5`**, **`T-SLA-1..4`** (pause/resume; breach emitted **exactly once**), **`T-CAL-1..2`**, **`T-RPT-1..3`** · **`T-MERGE-1..4`** — **no immutable B9 row rewritten**, **no cross-workspace merge**, **no automatic merge**, reason mandatory · **the 11 report sections derive no revenue from Deals, Quotes, pipeline value or counts** · `T-AUTO-1` re-run with `CA-12`'s `create_ticket` · **`T-P360-5`**: the `tickets` section flips `unavailable → present` at this slice · **`T-CF-7`** and **`T-CF-8` (NC)**: custom-field value search returns only matching, in-workspace values (`GAP-011`).
**Security gates** **tickets touch no financial table** · merge is **human-only, reason-required, single-workspace** · report sections read `revenue_events` for every revenue figure · workspace isolation on every new selector.
**Observability** `ticket_sla_breach_total{policy}` with alert `CB-22` · merge audit rows with actor and reason · report query latency.
**Migration/backfill** additive; `CA-04` lineage table added, **no existing row changed**.
**Demo** **DEMO D** — conversation → ticket → SLA clock pause/resume → resolution; plus a governed merge of two duplicate Customers showing the lineage row and **an unchanged revenue figure**.
**DoD** SLA clocks correct under pause/resume · breach emitted exactly once · `T-MERGE-1..4` green · the 11 report sections derive no revenue from Deals, Quotes, pipeline value or counts.
**Dependencies** **I5, I6, I13** *(`GAP-022` already complete at I6)*.
**Rollback** **merge is irreversible once executed (`PD-006`)** — which is why it is post-P0; everything else drops while unused.
**Non-goals** email support (`GAP-026`) · customer portal (`GAP-027`) · quotes (`GAP-018`–`020`) · a full ITSM platform.

---
## I15 — Security / Operations hardening
**Goal** Bring B13 from inherited to **demonstrated**.
**Frozen source contracts** B13 (all 39 documents), with `B13_ACCEPTANCE_TESTS.md` and `B13_VERIFICATION_MATRIX.md` as the checklist.
**Gap Plan inputs** N/A — I15 adds no capability.
**Amendments consumed** N/A.
**Django modules** N/A — **no new module**; I15 hardens existing ones.
**Models** N/A — **no new model**; adding one would be a new capability.
**Migrations** N/A — **none**; hardening is behavioural, not schema.
**APIs** N/A — **no new endpoint**.
**Commands** N/A — **no new command**.
**Selectors** N/A — **no new selector**.
**Events** N/A — **no new event**.
**Permissions** N/A — **no new permission**; the full catalog already exists.
**Celery tasks** N/A — no new task; existing beat schedules are tuned per `B14_32`.
**Provider adapters** N/A — no new adapter; existing ones are re-verified per `B14_33` §5.
**Django Admin** N/A — no new surface; the existing one is audited.
**Deliverables** the full audit-code catalogue · **the `ID-14` CSP inline-style build check executed against a real production bundle (`T-CSP-BUILD-1`)** · redaction verified across logs, traces, audit, events and task payloads · the four rate-limit classes kept separate · **`B14_32` Class B values applied and asserted** · backup **and rehearsed restore** (`CB-23`, `CB-25`) · the 18 runbooks bound to alerts · **the negative-control suite as a permanent CI gate** · **`FI-B12-12` annual re-verification cycle established** (`B14_33` §5) · supply-chain baselines current (`B14_34`).
**Tests** `T-SEC-1..7` · `T-CB-1..28` · `T-PROXY-1..9` · `T-CORS-1..8` · **`T-CSP-BUILD-1`** · `T-SUP-1..7` · `T-FIB12-6` · every B13 acceptance control relevant to implemented surfaces.
**Security gates** every invariant in `B14_01` §5 has a passing test · **no secret in any response, log, audit row, task payload, trace or admin page** · trust boundary asserted at deploy · rate-limit classes separate.
**Observability** all alerts bound to runbooks **and panels** · correlation chain verified end-to-end · **no PII or secret in any label, span attribute or breadcrumb**.
**Migration/backfill** N/A — no schema change.
**Demo** **GOLDEN DEMO** — Discovery → Business → AI Intelligence → Lead → WhatsApp → Deal, end to end on real infrastructure, plus a **security walkthrough**: masked Viewer data, sanitized provider errors, **no secret in Admin**, a heartbeat-stale worker execution shown as `unknown` and **not re-executed**, and a forged `X-Forwarded-For` proven to influence nothing.
**DoD** every invariant in `B14_01` §5 has a passing test · the negative-control suite is a **permanent CI gate** · **a restore has been rehearsed, not merely configured**.
**Dependencies** **all prior slices**.
**Rollback** hardening is additive; no business behaviour changes.
**Non-goals** **new product capability of any kind** — I15 adds no feature, it proves the ones already built.

---
## Slice → wave map

| Wave | Slices |
|---|---|
| **Foundation** | I0, I1 |
| **P0 core** | I2, **I5**, I7, I6, I13 (+ I3/I4 where Discovery value is wanted early) |
| **Frozen-domain completion** | I8, I9, I10, I11, I12 |
| **Post-P0** | I14 |
| **Hardening** | I15 |

**P0 gap completion:** all 12 `APPROVE_NOW` gaps are `COMPLETE` by **I13** — `GAP-001/002/003/004/006/008/010/025` at I5, **`GAP-005` at I7**, **`GAP-013` at I6**, **`GAP-012` and `GAP-014` at I13**.

**Deferred capabilities appear in no slice:** `GAP-009`, `GAP-018`, `GAP-019`, `GAP-020`, `GAP-024`, `GAP-026`, `GAP-027`.
