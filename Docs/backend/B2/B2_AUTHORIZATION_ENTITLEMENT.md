# B2 — CRM Authorization, Entitlement, and Quota

> **B2 status:** Target design only. B1's authorization pipeline is reused **verbatim**. B2 adds no pipeline step, reorders none, and changes no B1 matrix cell.

## 1. The pipeline is B1's, unchanged

Every CRM operation passes B1's 16 ordered steps (`B1_AUTHORIZATION_RBAC.md` §1) inside the request transaction. B2 restates only what is CRM-specific:

| B1 step | CRM specifics |
|---|---|
| 5 Workspace resolved | a no-workspace session (`|E(U)| = 0`) reaches **no** CRM route; every one terminates here with `404 WORKSPACE_NOT_FOUND` |
| 6 Membership active | a `suspended` Membership gets `403 MEMBERSHIP_INACTIVE` on every CRM route, read or write |
| 7 Workspace state | in `suspended`/`archived`, CRM **reads** are permitted to `*.view` holders and every CRM **write** is `403 WORKSPACE_INACTIVE` |
| 8 RBAC permission | §2 below |
| 9 Tenant-scoped object resolution | Doctrine R-1: `LEAD-*`, `CON-*`, `TSK-*`, `APT-*`, `NOTE-*` are resolved through the active-workspace queryset. A miss is `404 ENTITY_NOT_FOUND` |
| 10 Object-level condition | the `conditional` matrix cells, plus `RemoveNote`'s author-or-manager rule |
| 11 Entitlement | `crm.core` (§4) |
| 12 Quota | `leads` (§4) |
| 13 Concurrency | `If-Match`/`version` on every mutable CRM resource |
| 15 Domain invariant | archive guard, terminal-state guard, owner-active guard, duplicate index |

## 2. Permissions per operation

All permissions below are **existing B1 catalog codes**, except `lead.archive`.

| Operation | Permission | Object condition |
|---|---|---|
| `GET /leads`, `/leads/{id}`, `/leads/{id}/360`, `/leads/{id}/timeline`, `/leads/{id}/contacts`, `/leads/{id}/notes` | `lead.view` | Viewer's `conditional` cell = read-only workspace scope |
| `POST /businesses/{id}/convert-to-lead` | `business.convert` | Member's `conditional` cell = object workspace scope |
| `PATCH /leads/{id}` — `status` and/or `priority` | `lead.update` | Member's `conditional` cell = object workspace scope |
| `PATCH /leads/{id}` — `owner_ref` | `lead.assign` | Sales' `conditional` cell = own assignments only |
| `PATCH /leads/{id}` — mixed fields | **all** of the above that apply | a request changing status **and** owner needs `lead.update` **and** `lead.assign`; failing either denies the whole request and writes nothing |
| `POST /leads/{id}/archive` | **`lead.archive`** *(new, `B2-D-B004`)* | — |
| `POST /leads/{id}/tags`, `DELETE /leads/{id}/tags/{tag}` | `lead.update` | — |
| Contact create / update / remove | `lead.update` | — |
| `GET /tasks`, `/leads/{id}/tasks` | `task.view` | Viewer's `conditional` cell |
| Task create / update / assign / complete / cancel | `task.manage` | Member's `conditional` cell = assigned/team scope |
| `GET /leads/{id}/appointments` | `appointment.view` | Viewer's `conditional` cell |
| Appointment schedule / reschedule / cancel / complete / no-show | `appointment.manage` | Member's `conditional` cell |
| `POST /leads/{id}/notes` | `lead.update` | — |
| `DELETE /notes/{id}` | `lead.update` | **plus**: actor is the note's author **or** role rank ≥ `manager` (40) |
| CRM export (future) | `crm.export` | not implemented in Phase 1 |

**`CRM_PERMISSION_COUNT = 9`**: `lead.view`, `lead.update`, `lead.assign`, `lead.archive`, `business.convert`, `task.view`, `task.manage`, `appointment.view`, `appointment.manage`. (`crm.export` and `lead.create` exist in B1 but are referenced by **no** Phase-1 CRM operation and are therefore not counted.)

### 2.1 Reuse decisions, stated

| Question | Decision | Reason |
|---|---|---|
| Does conversion need `lead.create` too? | **No** — `business.convert` alone | B0's catalog labels the conversion row "CRM create", and B1 mints `business.convert` for exactly this action. Requiring two permissions would deny Member (whose `business.convert` is `conditional` but whose `lead.create` is also `conditional`) nothing extra while doubling the authorization surface. `lead.create` stays reserved for the future manual path (`B2-D-A022`) |
| A `contact.*` family? | **No** — reuse `lead.update` | contacts have no independent management surface, list route, or lifecycle; every mutation is in service of working a Lead. Three new codes for an unmanaged resource is authorization surface with no product requirement (`B2-D-C007`) |
| A `note.*` family? | **No** — reuse `lead.update` + an object condition | same reasoning; the one genuinely distinct rule (who may remove someone else's note) is an object-level condition, which B1 pipeline step 10 already supports |
| A `lead.archive` code? | **Yes** — new | archiving removes a Lead from every working view and releases a quota unit. `lead.update` is `conditional` for Member, so reusing it would let any Member archive any Lead they can edit. B1 itself minted `workspace.archive` separately from `workspace.manage` for the same reason |

### 2.2 The one new permission

| | |
|---|---|
| Code | `lead.archive` |
| Proposed grant | `owner` **A** · `admin` **A** · `manager` **A** · `sales` **·** · `member` **·** · `viewer` **·** |
| Why not `conditional` for manager | archiving is a workspace-hygiene action a Manager performs across the pipeline they run; a per-object condition would have no stated predicate |
| Amendment | `B2-D-B004` — adds one row to B1's permission catalog and one row to the role matrix. **No existing cell changes.** |
| Until applied | no implementation may enforce or grant `lead.archive`, and `POST /leads/{id}/archive` may not ship |

## 3. Owner Membership lifecycle

`leads.owner_membership_id` references a B1 Membership (CRM-INV-16). B1 guarantees membership rows are retained forever, so the reference always resolves.

| Owner Membership becomes | Effect on the Lead | Rationale |
|---|---|---|
| `suspended` | **none.** The Lead keeps its owner. `LeadListItem.owner_inactive = true` | suspension is a reversible pause (B1 §3.1); reassigning on a pause and back on resume would churn ownership and flood the timeline |
| `removed` | **none.** The Lead keeps the historical owner reference; `owner_inactive = true` | B1 retains removed membership rows precisely "so audit and historical assignment references stay resolvable" — this is that case |
| role changed | **none** | ownership is not a role |
| Workspace `suspended`/`archived` | CRM reads permitted, writes `403 WORKSPACE_INACTIVE` | B1 §1.6 |
| Workspace `deleting` | all CRM operations refused | B1 §1.5 |

**CRM never auto-reassigns a Lead.** An automatic reassignment would pick an owner no human chose, emit `LeadOwnerChanged` events nobody requested, and — for a workspace losing a salesperson with 400 leads — produce 400 events and 400 timeline entries attributing a decision to the system. The remedy is an explicit `AssignLeadOwner`, made discoverable by `owner_inactive` in the list and by filtering `owner_ref` to the departed Membership. A bulk reassignment tool is `B2-D-C016`.

**Assigning to an inactive Membership is refused.** `AssignLeadOwner` requires the target Membership to be `active` in this workspace ⇒ otherwise `409 CONFLICT`, `details.reason = "owner_membership_inactive"`. A Membership in **another** workspace ⇒ `404 ENTITY_NOT_FOUND`, never `403` — distinguishing "exists but elsewhere" from "does not exist" is a cross-tenant membership oracle.

## 4. Entitlement and quota boundary

The three authorities stay separate exactly as B1 §1 defines them: **RBAC** answers *may this user act*, **Entitlement** answers *does this workspace's plan include the capability*, **Quota** answers *is there allowance left*. None implies another, and the order is RBAC (8) → Entitlement (11) → Quota (12).

### 4.1 Capability

| Capability | Gates | Frozen evidence |
|---|---|---|
| `crm.core` | every CRM operation, read and write | `entitlementService.ts:26` maps `crm.core` → the `leads` metric |
| `export.csv` | CRM export — **not implemented in Phase 1** | — |

**`crm.core` is in all three plans** (`PLAN-STARTER`, `PLAN-GROWTH`, `PLAN-SCALE` — `entitlementService.ts:31–33`), so in Phase 1 it can never resolve to `LOCKED`. The check is nonetheless specified and must be implemented: a future plan tier that omits it must lock CRM without a code change. B2 invents no plan and no price.

### 4.2 The `leads` quota — the identity↔entitlement contact point

`leads` is the only usage metric CRM owns a write path for. It counts **live (non-archived) Leads in the workspace**.

| Event | Seat effect | Enforced |
|---|---|---|
| `ConvertBusinessToLead` (created) | **+1** | reserved against the locked `usage_counters` row **inside the transaction, before the insert** |
| `ConvertBusinessToLead` (existing returned) | **0** | no new Lead, so no reservation |
| `ArchiveLead` | **−1** | released in the archive transaction |
| `BusinessMerged` archiving a colliding Lead | **−1** | released in the merge transaction |
| every other CRM command | **0** | tasks, notes, contacts, appointments, tags, and status changes consume nothing |

**Quota is checked before durable mutation.** `403 QUOTA_EXHAUSTED` with `details = {metric:"leads", reason:"usage_exhausted", period, target_plan_ref}` and **no Lead row, no Contact, no provenance row, and no event**. The reservation is a row in the same transaction, so any later failure releases it on rollback — **no Redis counter is decremented** (CRM-INV-11, B0: "Quota enforcement remains transactional and authoritative in PostgreSQL; Redis counters are acceleration/abuse controls, not the source of truth").

**Un-archive would need a re-check.** It is `NOT_SUPPORTED` (`B2-D-C006`) partly for this reason: restoring a Lead into a workspace now at its limit has no defined outcome, and that is a product decision.

### 4.3 What is deliberately not plan-gated

| Candidate | Decision | Reason |
|---|---|---|
| advanced filtering / sorting | **not gated** | the frozen UI offers every filter on every plan; gating would remove behavior users have |
| bulk operations | n/a | `NOT_SUPPORTED` in Phase 1 |
| Tasks, Appointments, Notes, Contacts | **not gated, not metered** | no frozen metric counts them; inventing one would be pricing design, which B2 must not do |
| AI actions from CRM | **not gated by CRM** | `ai.use` and the `aiAnalyses` metric are the AI domain's; CRM only renders AI output |
| automation-created Tasks | **not separately gated** | `automationRuns` is already metered by the Automation domain; metering the resulting Task would double-charge one action |

**No pricing design appears in B2.** Limit values per plan are Entitlements-owned and remain a product decision.

### 4.4 Denial payloads

| Code | HTTP | `details` | Client meaning |
|---|---|---|---|
| `PERMISSION_DENIED` | 403 | `{"permission": "<code>"}` | your role cannot do this — upgrading will not help |
| `ENTITLEMENT_LOCKED` | 403 | `{"capability":"crm.core","reason":"capability_locked","target_plan_ref":{…}}` | the plan must change |
| `QUOTA_EXHAUSTED` | 403 | `{"metric":"leads","reason":"usage_exhausted","period":"<p>","target_plan_ref":{…}}` | archive leads, wait for the period, or upgrade |

`target_plan_ref` is present **only** on entitlement and quota denials, never on `PERMISSION_DENIED` — no plan resolves a role problem, and that distinction is what lets the frontend show an upgrade prompt only when an upgrade is actually the remedy (frozen `UpgradeReason` vocabulary).

## 5. IDOR and enumeration posture

- Every CRM object is resolved through `for_workspace(active_workspace)` before it is read (Doctrine R-1, pipeline step 9).
- RBAC (step 8) runs **before** object resolution (step 9), so a caller without `lead.view` cannot time or probe `LEAD-*` existence.
- `TSK-*`, `APT-*`, `CON-*`, and `NOTE-*` addressed at top-level routes are resolved by public ID **within the active workspace**; a hit belonging to another workspace is `404`, byte-identical to a random ID.
- Every cross-domain reference a request supplies — `owner_ref`, `assignee_ref`, `organizer_ref`, `source_job_ref`, `deal_ref`, `contact_ref` — is resolved through the **same** active-workspace scope, and a resolution outside it is `404`, **never** `400` (Doctrine R-2). A validation error would confirm existence.
- No CRM error message names a workspace, a Business, or a Membership the caller cannot already see.
