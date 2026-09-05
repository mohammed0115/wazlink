# B14_06 — API Implementation Map

> Base path `/api/v1/`. Every endpoint inherits the frozen B0 API standard: error envelope, idempotency-key standard, `If-Match`/`expected_version` optimistic concurrency (ADR-010), cursor pagination, and the 16-step B1 authorization pipeline.

## 1. Universal rules

| Concern | Rule |
|---|---|
| **Workspace resolution** | From the **session's active workspace** (`sessions.active_workspace_id`). **A client-supplied `workspace_id` is never read** (`FI-B0-07`). **No endpoint trusts a role sent by the client.** |
| **Cross-workspace reference** | Resolves to `404 ENTITY_NOT_FOUND`, never `400` (Doctrine R-2) |
| **Idempotency** | Every mutating endpoint accepts the frozen idempotency key; replay returns the original result |
| **Concurrency** | Versioned resources require `If-Match`; mismatch ⇒ `409` |
| **Errors** | Frozen envelope; **never** leaks internal IDs, SQL, stack traces, or another workspace's existence |
| **Audit** | Every mutation writes an `audit_logs` row with actor, workspace, target, before/after **field names** |
| **Masking** | Applied **server-side in the selector before serialization** (`PD-002`). **A Contact-derived `display_name` (`CA-15`) is Contact PII and is masked for Viewer on every surface**, including list, 360, export and AI egress |
| **Derived display (`CA-15`)** | `display_name`, `display_subtitle`, `display_source` are **read-time projections, never stored columns and never authoritative**. `display_source ∈ {"business","contact"}` so a client never infers the branch |
| **Async** | `202` where work continues asynchronously; the response carries the durable row, never an optimistic guess |
| **Timeline endpoint** | **`GET /api/v1/leads/{id}/timeline`** — the frozen `B2-D-B009` operation — is **served by `analytics`'s `TimelineComposer`** and routed from `config/urls.py` (`B14_03` §5e, `N-09`). It merges `crm`, `messaging` and `pipeline` entries at read time, ordered `(occurred_at DESC, entry_id DESC)` with the frozen opaque cursor; each contributor enforces its own permission (`conversation.view`, `deal.view`) and masking, and unauthorized entries are **absent, never a placeholder**. `Lead360.activities[]` is the **first page of the same merge**, served by the same composer. **`crm` does not import `messaging` or `pipeline`, and frozen B2 is not modified** |
| **Party360 endpoints** | `GET /leads/{id}` and `GET /customers/{id}` are **served by `analytics`'s `Party360Composer`** and routed from `config/urls.py` (`B14_03` §5a, `N-01`). **Path, DTO, permission, status codes and the frozen `Lead360` response shape are unchanged**; only the composing module changed. Every other `/leads/*` and `/customers/*` endpoint stays with `crm`/`customers`. A section the actor may not read, and a section whose owning slice has not shipped, are **both key-absent** and indistinguishable on the wire (`B14_07` §2) |

## 2. Endpoint inventory by slice

### I1 — Tenant / Auth / Workspace (B1)
`POST /auth/register` · `/auth/verify-email` · `/auth/login` · `/auth/logout` · `/auth/password/change` · `/auth/password/reset` · `/auth/sessions` (GET) · `DELETE /auth/sessions/{id}` · `POST /auth/sessions/revoke-all` · `GET/POST /workspaces` · `POST /workspaces/{id}/switch` · `GET/POST /workspaces/{id}/members` · `POST /invitations` `/accept` `/cancel` `/resend` · `PATCH /memberships/{id}/role` · `POST /workspaces/{id}/transfer-ownership` · `GET /entitlements`.

### I2 — CRM core (B2)
`GET /leads` (filters: status, priority, owner, tag, q) · `GET /leads/{id}` (Lead 360) · `POST /leads/{id}/status|priority|owner|tags|archive` · `GET/POST /leads/{id}/contacts` · `PATCH/DELETE /contacts/{id}` · `GET/POST /tasks` · `PATCH /tasks/{id}` · `GET/POST /appointments` · `POST /leads/{id}/notes` · **`GET /leads/{id}/timeline`** (the frozen `B2-D-B009` operation — **served by the composer**, `B14_03` §5e; the earlier wording `GET /leads/{id}/activities` was a substitution for it and is withdrawn as ambiguous, `N-09`).

### I5 — Customer / Identity / Import / Custom fields *(P0 core)*

| Method | Path | Request DTO | Response | Permission | Notes |
|---|---|---|---|---|---|
| GET | `/customers` | filters: `party_kind`, `status`, `owner`, `q` | `CustomerSummary[]` | `customer.view` | cursor pagination |
| POST | `/customers` | `CreateCustomerRequest{party_kind*, name*, origin_kind, business_ref?, owner_ref?}` | `CustomerDetail` `201` | `customer.create` | idempotency key; `party_kind` **immutable** |
| GET | `/customers/{id}` | — | `CustomerDetail` (Party360) | `customer.view` | **served by the composer**; per-section permission filtering enforced **by each owning domain's provider**, never by the composer |
| PATCH | `/customers/{id}` | `UpdateCustomerRequest` + `If-Match` | `CustomerDetail` | `customer.update` | `409` on version mismatch |
| POST | `/customers/{id}/archive` | `If-Match` | `CustomerDetail` | `customer.archive` | archive-only, no delete |
| POST | `/customers/{id}/contacts` | `{contact_ref, is_primary}` | `CustomerDetail` | `customer.update` | CUS-3 guard for `person` |
| DELETE | `/customers/{id}/contacts/{cid}` | `If-Match` | `204` | `customer.update` | refused if sole Contact of a `person` |
| **POST** | **`/leads`** | `CreateLeadRequest{origin_type*, business_ref?, owner_ref?, primary_contact{contact_ref \| {name*, phone?, email?}}?}` | `LeadDetail` `201` | `lead.create` | **`CA-01` + `CA-15`** — non-discovery origins; `whatsapp` rejected. **`primary_contact` is REQUIRED when `business_ref` is absent** and is resolved-or-created **in the same transaction** (`B14_07` §1c); omitting it returns `422` and **writes nothing** |
| GET | `/leads` | filters: status, priority, owner, tag, `q`, `city`, `category` | `LeadListItem[]` | `lead.view` | **`CA-15`**: `business_*` fields **nullable**; `display_name`/`display_subtitle`/`display_source` always present; `sort=name` orders by `display_name`; **`city`/`category` never match a Business-less Lead** |
| GET | `/leads/{id}` | — | `LeadDetail` (Lead 360) | `lead.view` | **served by the composer**. **`CA-15`**: `business` is **optional**, present iff `business_id IS NOT NULL`; a `display` block is **always** present |
| POST | `/leads/{id}/convert-customer` | `{party_kind}` + `If-Match` | `CustomerDetail` | `customer.create` | Lead retained; `409` if already converted |
| GET | `/contacts` | `q`, `linked_to` | `ContactSummary[]` | **`contact.view`** | **Viewer sees masked phone/email** |
| GET/PATCH | `/contacts/{id}` | | `ContactDetail` | `contact.view`/`.manage` | |
| GET/POST | `/imports` | `CreateImportBatchRequest{file_ref, target_kind}` | `ImportBatch` | `import.manage` | |
| PUT | `/imports/{id}/mapping` | `{mapping[]}` | `ImportBatch` | `import.manage` | `422` if a required field is unmapped |
| POST | `/imports/{id}/dry-run` | — | `ImportPreview` | `import.manage` | **writes nothing** |
| POST | `/imports/{id}/commit` | `If-Match` | `ImportBatch` `202` | `import.manage` | async; `409` if already committed |
| GET | `/imports/{id}/errors.csv` | — | CSV | `import.manage` | |
| GET/POST | `/custom-fields` | `FieldDefinitionRequest` | `FieldDefinition` | `customfield.manage` | admin-only |
| POST | `/customers/{id}/merge` | `{surviving_ref, reason*}` | `CustomerDetail` | **`customer.merge`** | **post-P0**; reason mandatory |

### I3/I4 — Discovery & Intelligence
`GET/POST /discovery/jobs` · `POST /discovery/jobs/{id}/cancel` · `GET /discovery/jobs/{id}/results` · `GET /businesses/{id}` · `POST /businesses/{id}/convert` (→ Lead) · `POST /intelligence/analyses` · `GET /intelligence/analyses/{id}` · `POST /intelligence/analyses/{id}/reanalyze`.

### I6 — Messaging
`GET /conversations` (filters: assigned, unassigned, `handling_mode`) · `GET /conversations/{id}` · `POST /messages` (**`SendMessage` — human only**) · `POST /messages/template` · `POST /conversations/{id}/assign` · `/read` · `/archive` · `/reopen` · **`POST /conversations/{id}/handling-mode`** · **`POST /conversations/{id}/takeover`** · `GET /templates`.
**Webhooks (B12-owned, not `/api/v1/`):** `GET|POST /webhooks/whatsapp`.

### I7–I11 — Pipeline · Automation · Billing · Revenue · Files
`GET/POST /deals` · `/deals/{id}` · `/deals/{id}/stage` · `/deals/{id}/close` · `GET /pipelines` · `GET/POST /automation/rules` · `/runs` · `/runs/{id}/approve` · `GET /billing/subscription` · `/plans` · `POST /billing/checkout` · `GET /billing/invoices` · `POST /revenue/events` (**`RecordRevenueEvent`**) · `/revenue/events/{id}/reverse` · `POST /revenue/touchpoints` · `POST /files/upload-intent` · `GET /files/{id}/download`.
**Webhooks:** `POST /webhooks/tap`, `POST /webhooks/scraping`.

### I12 — Platform operations (operator)
`GET /operations/dead-letters` · `POST /operations/dead-letters/{id}/replay` (reason required) · `/abandon` · `GET /operations/reconciliation-cases` · `POST /operations/reconciliation-cases/{id}/resolve` · `GET/PUT /integrations` `/{id}/configuration` · `POST /integrations/{id}/check` `/enable` `/disable`.

### I13/I14 — AI agent · Knowledge · Support · Assignment
`POST /agent/sessions` · `POST /agent/proposals` · **`POST /agent/proposals/{id}/accept`** (human) · `/reject` · `GET/POST /knowledge/articles` · `/{id}/publish` `/archive` · `GET/POST /tickets` · `/{id}` `/assign` `/resolve` `/reopen` · `GET/POST /assignment/rules` · `GET /activities/calendar` · `GET /analytics/{section}`.

**Endpoints deliberately absent:** any Party360 write or refresh endpoint — the composition is read-only and has no command (`T-P360-7`) · `POST /forms/{token}/submit` (**deferred**, `PD-010`) · any AI-owned send endpoint (**`PD-013`**) · any endpoint writing `revenue_events` outside `revenue` · any operator endpoint beyond frozen B13's model · `DELETE /customers/{id}` (archive-only).

## 3. Frontend fixture → API cutover

Full map in `B14_21`. Rule: **once a slice ships, its owning frontend fixture stops being business truth.** A demo may not use `legacyDataBridge` for a domain whose backend slice is complete.
