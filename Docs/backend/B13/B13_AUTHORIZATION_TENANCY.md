# B13 — Authorization & Tenancy Enforcement Contract

> Design only. Builds the production enforcement contract around frozen `B1_AUTHORIZATION_RBAC.md` (`FI-B1-05`…`FI-B1-08`) and every domain's own RBAC/tenancy document (B2–B12). B13 introduces no new permission code and no new doctrine; it states how the frozen doctrine is enforced end-to-end in production, including paths B1 did not need to cover (background jobs, webhooks, files, cross-domain aggregation).

## 1. The one rule

> Every workspace-owned durable object MUST be authorized using trusted workspace context. Client-supplied `workspace_id` — body, query, path, or header — is a presentation input and is never read by the authorization pipeline (`FI-B1-04`). Doctrine R-1/R-2/R-3 (`FI-B1-07`) apply without exception to every table added by B2–B12.

## 2. Queryset scoping

Every domain manager's tenant-owned entry point is `for_workspace(active_workspace)`; a bare `.objects.get(public_id=...)` is a review-visible defect, not a style preference (`FI-B1-07`). This applies identically to:

| Layer | Scoping mechanism | Source |
|---|---|---|
| API request | `sessions.active_workspace_id`, re-validated every request | `FI-B1-04` |
| CRM (Leads, Contacts, Tasks, Deals) | `for_workspace()` manager + Doctrine R-2 relationship injection | `FI-B2-02`, `FI-B6-02` |
| Discovery/AI | `for_workspace()`; global catalogs (`discovery_sources`, `signal_definitions`) are documented exceptions, mirroring `plans` | `FI-B3-02`, `FI-B4-02` |
| Messaging | `ChannelBinding`/`Conversation` scoped; workspace resolved from the verified binding for inbound, from session for outbound | `FI-B5-01`, `FI-B5-04` |
| Billing/Finance/Tax | `for_workspace()`; `legal_entities`/`tax_profiles` are documented global exceptions | `FI-B8-01`, `FI-B9-02`, `FI-B10-02` |
| Files | `for_workspace()`; storage-key prefix is containment only, **never** the access-control mechanism (`FI-B11-04`) | `FI-B11-02` |
| Platform operations (B12) | `for_workspace(active_workspace)` on `INT-*`, dead letters, reconciliation cases; **no exception** even for operator surfaces | `FI-B12-03` |

## 3. Object-level authorization

Step 10 of the pipeline (`FI-B1-05`) evaluates assignment/ownership conditions after tenant scoping and RBAC. The object-condition evaluator is one reusable mechanism, not per-domain bespoke logic:

- **Assigned/team scope** — `task.manage`, `appointment.manage`, `deal.create`/`.update` (sales: object owner or shared team, `FI-B6-02`).
- **Actor-who-requested-or-manager+ scope** — Discovery job cancel, Intelligence run cancel, automation-run cancel (identical pattern across B3/B4/B7, per the B2-B4 and B5-B7 research briefs).
- **Issuer-only scope** — invitation cancel/resend by a manager (only invitations they issued, `FI-B1-08`).

A condition failure is `403 PERMISSION_DENIED`, identical in shape to a flat deny — no distinct status or message leaks which condition failed beyond the safe `details.permission` field (`FI-B1-06`).

## 4. Command authorization (service-layer, not view-layer)

RBAC is enforced in application services; serializers and views are never the only gate (`FI-B0-02`). This holds for every command surface B13 formalizes:

- **User-initiated commands** — the 16-step pipeline in full.
- **System-actor commands** (`SubmitJob`, `DispatchOutboxEvent`, `RecordProviderAttempt`, reconciliation openers) — bound to exactly one workspace per invocation, resolved from the row acted on, recorded in audit as a system actor, never exempt from any guard (`FI-B12-03` §5).
- **Automation-invoked commands** — authority is delegated from the membership that activated the rule revision, re-resolved live at every invocation; automation can never exercise a permission no current member holds, and there is no workspace-level "automation" permission (`FI-B7-02`).

## 5. Background job workspace propagation

Celery tasks carry an explicit `workspace_id` in the task payload; a worker never reads a session and never has an "active workspace" (`FI-B1-04` §4.5). This is the production restatement of a rule already frozen in B1 and exercised throughout B12:

- Task payloads carry **references, not snapshots** (`B12_CELERY_EXECUTION_MODEL.md`, cited in `FI-B12-05`'s correlation contract) — a task re-reads current state and re-checks authorization-relevant preconditions (entitlement, quota, tenancy) at execution time, never trusts a payload-embedded permission decision.
- A worker never widens its own scope: `B12_DOMAIN_FIREWALLS.md` (`FI-B12-09`) proves per-domain that async execution invokes the owning domain's own guarded command, which re-runs its own RBAC/entitlement/tenancy checks exactly as a synchronous caller would.

## 6. Outbox/inbox tenant context

An `OutboxEvent` is stamped with `workspace_id` at write time, in the same transaction as the domain state it announces (`FI-B12-01`, `B12_OUTBOX_MODEL.md`). Dispatch never re-derives tenancy from anything but that stamped value. The internal inbox (B7's automation trigger consumption) and the external inbox (`webhook_receipts`, B12-owned) are kept structurally separate (`B12_INBOX_MODEL.md`), and neither infers workspace from message content — external inbox tenancy comes from the verified webhook binding (§7 below); internal inbox tenancy comes from the producing domain event's own `workspace_id`.

## 7. Webhook tenant binding

> Workspace resolution for an inbound webhook is a **consequence of which secret verified**, never a value read from the payload (`FI-B12-02`, `B12-D-A031`; `FI-B5-01`, `B5-D-A011`; `FI-B8-04`).

A provider identifier (`phone_number_id`, `provider_customer_ref`) is a **lookup key**, never an authorization claim (`B12-D-A029` rule 5). Zero or multiple resolved bindings is never guessed — the receipt is quarantined (`workspace_id = NULL`) and a reconciliation case (`P-7`) is opened. Full detail: `B13_WEBHOOK_SECURITY.md` §3.

## 8. File tenant ownership

`FileAsset` tenancy is enforced by **authorization**, never by parsing the storage key — the `w/<workspace_uuid>/` key prefix is containment/operational-hygiene only (`FI-B11-04`, `B11-D-A005`). Every download re-runs the full chain (session → active workspace → Doctrine R-1 → `file.download` → lifecycle-state gate → ticket validation) on every request; possession of a previously issued signed URL/ticket grants nothing on its own (`FI-B11-02`, `B11-D-A022`). Attachment composes `file.upload` with the subject domain's own write permission and re-asserts three-way workspace equality (file, subject, active workspace) at write time.

## 9. Billing/finance/messaging/CRM/discovery/AI ownership summary

| Domain | Tenant scope authority | Global exception | Source |
|---|---|---|---|
| Billing | `subscriptions`, `payments`, `invoices` workspace-scoped | `plans`, `plan_versions` (catalog) | `FI-B8-01` |
| Finance | `revenue_events`, `revenue_reversals`, `attribution_touchpoints` workspace-scoped, **no system actor ever writes one** | none | `FI-B9-02` |
| Messaging | `conversations`, `messages`, `channel_bindings` workspace-scoped | none — `CommunicationConsent` is workspace+channel+phone keyed, not global | `FI-B5-04` |
| CRM | `leads`, `contacts`, `tasks`, `deals` workspace-scoped | none | `FI-B2-02`, `FI-B6-02` |
| Discovery | `discovery_jobs`, `businesses` workspace-scoped | `discovery_sources` (catalog) | `FI-B3-02` |
| AI | `intelligence_runs` workspace-scoped, cache/reuse key is `(workspace_id, business_id, input_hash)` **never** `business_id` alone (prevents cross-workspace provider-cache bleed) — frozen in `B4_AUTHORIZATION_TENANCY.md`, anchored `FI-B4-03` | `signal_definitions`, `recommendation_definitions`, `scoring_model_versions` (catalog) | `FI-B4-03` (tenancy and cache-key scoping), `FI-B4-02` (input-minimization boundary) |

## 10. Explicit cross-tenant negative controls

| Attack | Stopped by | Test |
|---|---|---|
| Read another workspace's object by public ID | Doctrine R-1 → `404` | `AT-B13TEN-1` |
| Path-segment workspace override (`/workspaces/{W2}/...` while active on W1) | Doctrine R-3 → `404 WORKSPACE_NOT_FOUND` even for a genuine W2 member | `AT-B13TEN-2` |
| Body/header `workspace_id=W2` on any request | never read by the pipeline | `AT-B13TEN-3` |
| Cross-workspace relationship injection (Deal referencing a W2 Lead) | Doctrine R-2 → `404` for the reference, never `400` | `AT-B13TEN-4` |
| Forge a webhook to reach another tenant | signature must verify against **that binding's own secret** | `AT-B13TEN-5` |
| Poison another workspace's webhook dedup identity | `dedup_key` prefixed by the verifying binding (`B12-D-A056`) | `AT-B13TEN-6` |
| Replay another workspace's dead letter | Doctrine R-1 plus post-resolution workspace re-assertion | `AT-B13TEN-7` |
| Exhaust another tenant's share of a shared global provider credential | per-workspace budgets on shared credentials (`B12_RATE_LIMIT_BACKPRESSURE.md`) | `AT-B13TEN-8` |
| Configure a global-scope integration (Places, AI Gateway, storage) as a workspace admin | `B12-D-A043` — global integrations are not workspace-administrable | `AT-B13TEN-9` |
| Cross-workspace AI provider-cache collision (`business_id` alone as cache key) | `(workspace_id, business_id, input_hash)` composite key | `AT-B13TEN-10` |
| Read another workspace's file by a previously issued signed URL/ticket | per-request re-authorization; ticket alone is insufficient | `AT-B13TEN-11` |
| Cross-tenant entitlement-override collision | partial unique index scoped by `workspace_id` | `AT-B13TEN-12` |

`CROSS_TENANT_ISOLATION_GAPS = 0` rests on this table plus the domain-specific tables in `B13_FROZEN_INPUT_INVENTORY.md` §4; `TENANT_ISOLATION_GAPS` and `OBJECT_LEVEL_AUTHORIZATION_GAPS` are the semantic gates `B13_VERIFICATION_MATRIX.md` §5 re-runs against this table.

## 11. Mass-assignment protection restated for production

Doctrine R-4 (`FI-B1-07`) plus its domain-specific instances: `workspace_id`, `public_id`, `id`, `status`, `version`, `role` (on self), every server-generated timestamp, and every domain's own server-owned field (`Deal.value` snapshot fields, `RevenueEvent.gross`/`net`, `FileAsset.checksum`, `entitlement_overrides.status`) are never client-writable, and an unknown field is rejected (`400 VALIDATION_ERROR`), never silently dropped. Full detail: `B13_INPUT_OUTPUT_SECURITY.md` §2.

## 12. What B13 does not add

No new role, no new rank, no custom-role mechanism (deferred, `B1-D-009`, Class C), no caching of authorization decisions (prohibited, `FI-B1-06`), and no privileged bypass for any operator surface beyond the two additive `platform.operations.*` permissions already frozen by B12 (`FI-B12-03`).
