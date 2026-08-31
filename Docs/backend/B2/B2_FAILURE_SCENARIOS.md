# B2 — CRM End-to-End Failure Scenarios

> **B2 status:** Behavioural specification. Each scenario is a contract the implementation must satisfy exactly. "Authorization path" gives the B1 pipeline step (`B1_AUTHORIZATION_RBAC.md` §1) at which the request terminates.

---

### CF1 — Cross-workspace Lead lookup

**Precondition** `LEAD-X` belongs to W2. U is an Owner of W1 with no membership in W2. Session active workspace is W1.
**Request** `GET /api/v1/leads/LEAD-X`
**Authorization path** Steps 1–8 pass (U is an Owner and holds `lead.view`). Step 9 resolves through `for_workspace(W1)` and misses.
**Expected** `404` · `ENTITY_NOT_FOUND`
**State mutation** None.
**Event** None.
**Audit** `authz.object_not_in_scope` with the attempted public ID and the active workspace, `result=denied`.
**Disclosure** **Zero.** Byte-identical to a request for a randomly generated `LEAD-*`.
**Variant — U is also a member of W2:** still `404`. The correct action is `SwitchWorkspace` first (Doctrine R-3). Membership elsewhere never authorizes access from a session pointed here.

---

### CF2 — Duplicate conversion (sequential)

**Precondition** `BUS-1042` in W1 already has live `LEAD-1042`.
**Request** `POST /api/v1/businesses/BUS-1042/convert-to-lead` with a fresh `Idempotency-Key`
**Authorization path** Steps 1–14 pass. Conversion step 5 finds the live Lead.
**Expected** `201` with the **existing** `LEAD-1042` body, plus `X-Lead-Conversion-Outcome: existing`
**State mutation** **None.** No second Lead, no second Contact, no provenance row, no quota unit.
**Event** None.
**Audit** `lead.convert_deduplicated`, `result=succeeded`.
**Disclosure** None beyond the Lead the caller may already read.
**Why not `409`** The frozen `201` description is literally "Lead created or existing Lead returned", and the frozen UI routes the user to the existing Lead. A `409` would make the ordinary "someone already added this" path an error.

---

### CF3 — Concurrent conversion, two workers, different keys

**Precondition** `BUS-2000` in W1 has no Lead. Two workers fire simultaneously.
**Authorization path** Both pass authorization; both reach conversion step 4 and contend on `SELECT … FOR UPDATE` on the Business row.
**Expected** Worker A: `201` + `created`. Worker B: `201` + `existing`.
**State mutation** Exactly one `leads` row, one `lead_provenance` row, at most one Contact, and **exactly one** `leads` quota unit. Worker B's reservation is released by its rollback.
**Event** Exactly one `LeadCreated`.
**Audit** One `lead.converted`, one `lead.convert_deduplicated`.
**Guarantee** Even if the row lock were bypassed, the partial unique index `(workspace_id, business_id) WHERE archived_at IS NULL` makes a second live Lead impossible at the storage layer. **No Redis lock participates.**

---

### CF4 — Retry after a lost response

**Precondition** The conversion committed but the HTTP response was lost. The client retries with the **same** `Idempotency-Key` and body.
**Authorization path** Step 14 finds a terminal `IdempotencyRecord`.
**Expected** The stored `201` replayed **verbatim**, including the `X-Lead-Conversion-Outcome` header.
**State mutation** None. **No second Lead and no second quota unit** — the reason the key is REQUIRED rather than recommended.
**Variant — same key, different body:** `409 IDEMPOTENCY_CONFLICT`, no mutation.

---

### CF5 — Stale Lead version

**Precondition** Admin A1 reads `LEAD-1042` at `version=7`. Admin A2 changes its status, bumping it to 8. A1 submits.
**Request** `PATCH /api/v1/leads/LEAD-1042 {status:"qualified", version:7}`
**Authorization path** Steps 1–12 pass. Step 13 fails under the row lock.
**Expected** `409` · `STALE_VERSION`
**State mutation** **None.** The Lead keeps A2's status and `version=8`. A1's change is not merged, not queued, and not retried server-side.
**Event** None.
**Audit** `lead.status_changed` with `result=denied`, recording the submitted and actual versions.
**Client contract** Re-read, re-decide, re-submit. The server never guesses intent.

---

### CF6 — Invalid status transition (no-op)

**Precondition** `LEAD-1042.status = 'qualified'`.
**Request** `PATCH /leads/LEAD-1042 {status:"qualified", version:8}`
**Expected** `400` · `VALIDATION_ERROR`, `details.field="status"`, reason "value unchanged". If it reaches step 15, `409 CONFLICT` · `invalid_lead_transition`.
**State mutation** None; `version` stays 8.
**Event** None — this is the point. A silent `200` would emit `LeadStatusChanged` with `from == to`, bump the version, and break every concurrent client's `If-Match`.
**Variant — unknown value `"won"`:** `400 VALIDATION_ERROR`; the 5-value enum is closed.

---

### CF7 — Assigning an inactive owner

**Precondition** `MEM-9` in W1 is `suspended` (B1 §3.1).
**Request** `PATCH /leads/LEAD-1042 {owner_ref:{public_id:"MEM-9",entity_type:"membership"}, version:8}`
**Authorization path** Steps 1–14 pass (the caller holds `lead.assign`). Step 15 evaluates the owner-active guard.
**Expected** `409` · `CONFLICT`, `details.reason = "owner_membership_inactive"`
**State mutation** **None.**
**Audit** `lead.owner_changed`, `result=denied`.
**Disclosure** Only that a Membership the caller already administers is not active.
**Variant — `MEM-9` is in W2:** `404 ENTITY_NOT_FOUND`, **never** `409` — a `409` would confirm the Membership exists somewhere.

---

### CF8 — Owner Membership removed after assignment

**Precondition** `LEAD-1042.owner_membership_id = MEM-5`. A workspace admin then runs B1's `RemoveMember` on `MEM-5`.
**Request** `GET /api/v1/leads`
**Expected** `200`. `LEAD-1042` is listed with its **unchanged** `owner_ref = MEM-5`, `owner_display_name` still resolvable (B1 retains removed membership rows), and **`owner_inactive: true`**.
**State mutation** **None on the Lead.** CRM never auto-reassigns.
**Event** None from CRM.
**Rationale** Auto-reassignment would pick an owner no human chose and emit one `LeadOwnerChanged` per Lead — 400 events for a departing salesperson with 400 leads. `owner_inactive` makes the work visible; `AssignLeadOwner` is the remedy.

---

### CF9 — Duplicate Contact

**Precondition** W1 already has `CON-1042` with `phone=+966114568201`.
**Request** `POST /leads/LEAD-1137/contacts` with the same phone
**Expected** `201` · `Contact`, with `duplicate_candidates: [{public_id:"CON-1042", entity_type:"contact"}]`
**State mutation** A **new** Contact is created and linked.
**Event** `ContactAdded`.
**Rationale** A shared reception line is legitimately reachable for two Businesses. A unique index on `phone` would silently merge unrelated Leads (CRM-INV-18). The duplicate is surfaced, never enforced.

---

### CF10 — Cross-workspace Contact injection

**Precondition** `CON-W2` belongs to W2. The caller is on W1 and attempts to link it.
**Request** `POST /leads/LEAD-1042/contacts` referencing `CON-W2`, or `PATCH /contacts/CON-W2`
**Authorization path** Doctrine R-2: the reference is resolved through the W1 scope and misses.
**Expected** `404` · `ENTITY_NOT_FOUND` — **never `400`**, which would confirm existence.
**State mutation** **None.** No `lead_contacts` row is created.
**Audit** `authz.relationship_out_of_scope`.

---

### CF11 — Completing a Task twice

**Precondition** `TSK-1043` is `pending` at `version=3`. Two clients hold that version.
**Request** two × `POST /tasks/TSK-1043/complete {version:3}`
**Expected** First `200` (`completed`, `completed_at` set, `version=4`). Second `409 STALE_VERSION`.
**State mutation** One transition. `completed_at` written once.
**Event** **Exactly one `TaskCompleted`** — so a completion-count metric can never double.
**Variant — a client re-reads and submits `version:4`:** `409 CONFLICT` · `task_already_terminal`.

---

### CF12 — Task edit racing completion

**Precondition** `TSK-1044` `pending`, `version=2`. A1 edits the due date; A2 completes.
**Expected** Whoever commits first wins. Complete-first ⇒ the edit sees a terminal task ⇒ `409 CONFLICT` · `task_already_terminal`. Edit-first ⇒ the completion holds a stale version ⇒ `409 STALE_VERSION`.
**State mutation** Exactly one change applied. `leads.next_activity_at` reflects the committed task set in both orders, because both transactions recompute it under the `leads` row lock.

---

### CF13 — Appointment reschedule race

**Precondition** `APT-1042` `scheduled`, `version=1`. Two users reschedule to different times.
**Expected** One `200`; the other `409 STALE_VERSION`.
**State mutation** The appointment ends at exactly one of the two requested times — never a blend.
**Overlap** Re-evaluated by the winner only; `overlap_warning` reflects the committed times.
**Note** An overlap with another appointment is **never** an error (`B2_TASK_APPOINTMENT_MODEL.md` §6).

---

### CF14 — Note edit race

**Precondition** `NOTE-1042` exists.
**Request** two × attempted edit
**Expected** **Not reachable.** `UpdateNote` does not exist (`B2-D-C012`); notes are immutable after creation. Two concurrent `RemoveNote` calls resolve as one `200` and one `409 STALE_VERSION`.
**Rationale** Recorded here rather than omitted, so a future implementer who adds an edit path knows it introduces a race this package does not cover.

---

### CF15 — Mutating an archived Lead

**Precondition** `LEAD-1301` has `archived_at` set.
**Requests** (a) `PATCH /leads/LEAD-1301` (b) `POST /leads/LEAD-1301/tasks` (c) `POST /leads/LEAD-1301/notes`
**Authorization path** Steps 1–14 pass. Step 15 evaluates the archive guard.
**Expected** All three `409` · `CONFLICT`, `details.reason = "lead_archived"`.
**State mutation** None.
**Reads** `GET /leads/LEAD-1301`, `/360`, and `/timeline` still return `200`. History stays legible.

---

### CF16 — Conversation created against an archived Lead

**Precondition** `LEAD-1301` is archived. Messaging receives an inbound WhatsApp message for its contact.
**Expected** The Conversation and Message are created normally. `MessageReceived` advances `leads.last_activity_at` via `GREATEST()`.
**State mutation** No CRM row other than `last_activity_at`. The Lead stays archived.
**Rationale** CRM must not gate another domain's write path on its own archive flag, and a real customer message must never be dropped because an internal record was tidied away. The archived Lead with recent activity is exactly the signal a human needs to un-archive — which, in Phase 1, means re-converting the Business.

---

### CF17 — AI intelligence regenerated after conversion

**Precondition** `LEAD-1042` was converted when `BUS-1042` scored 92 (`high`). The analysis is re-run and now scores 78 (`good`).
**Request** `GET /leads/LEAD-1042/360`
**Expected** `200`. The `intelligence` section shows **78/good** (live). The provenance panel shows **92/high** (the conversion snapshot).
**State mutation** **None.** No CRM row changes — CRM stores neither number (CRM-INV-4, CRM-INV-12).
**Event** None from CRM.
**Rationale** This is the scenario CRM-INV-4 exists for. Had the score been copied onto the Lead, the two numbers would silently disagree and neither would be authoritative.

---

### CF18 — Discovery Business changed or archived

**Precondition** `BUS-1042` is re-crawled; its name and city change. Separately, `JOB-1028` is archived.
**Request** `GET /leads/LEAD-1042/360`
**Expected** `200`. `business` shows the **new** name and city. The provenance panel shows the **old** `business_name_snapshot` and renders `JOB-1028` as an unlinked historical identity with `resolvable: false`.
**State mutation** None.
**Rationale** CRM-INV-9: provenance survives its sources. The list projection's `business_city` is refreshed by the `BusinessUpserted` consumer within the stated lag.

---

### CF19 — Business merged after conversion

**Precondition** `LEAD-A` → `BUS-B`. Discovery merges `BUS-B` into `BUS-A`. W1 also has `LEAD-C` → `BUS-A`.
**Expected** Inside the merge transaction, `LEAD-A.business_id` is re-pointed to `BUS-A`, which collides with `LEAD-C` on the partial unique index. The **older** Lead by `converted_at` (tie-broken by `public_id`) survives; the newer is archived with `LeadArchived{reason:"business_merged"}` and releases its quota unit.
**State mutation** One live Lead for `BUS-A`. `lead_provenance` on both rows is **untouched** — the archived one still names `BUS-B`, which is the honest record of what a human converted.
**Audit** `lead.business_merged` and `lead.archived` with the system actor.

---

### CF20 — Quota exhausted at conversion

**Precondition** W1 is at its `leads` limit on `PLAN-STARTER`.
**Request** `POST /businesses/BUS-2001/convert-to-lead`
**Authorization path** Steps 8 and 11 pass. Step 12 fails on the locked `usage_counters` row — **before** any insert.
**Expected** `403` · `QUOTA_EXHAUSTED`, `details = {metric:"leads", reason:"usage_exhausted", period:"<p>", target_plan_ref:{…}}`
**State mutation** **None.** No Lead, no Contact, no provenance, no activity row, no event. **No Redis counter is decremented**, because none participates.
**Remedy** Archive a Lead (which releases a unit) or upgrade.

---

### CF21 — Entitlement denied

**Precondition** A hypothetical future plan omits `crm.core`. U is an Owner.
**Request** `GET /leads`
**Authorization path** Step 8 passes (Owner holds `lead.view`). Step 11 fails.
**Expected** `403` · `ENTITLEMENT_LOCKED`, `details = {capability:"crm.core", reason:"capability_locked", target_plan_ref:{…}}`
**State mutation** None. Quota is **never consulted** — `not_included` is an entitlement fact, so step 12 never runs.
**Contrast** A **Viewer** on the same plan issuing a `PATCH` gets `403 PERMISSION_DENIED` at step 8 and never learns the plan's capabilities. RBAC denial always precedes and masks entitlement state.

---

### CF22 — Unauthorized mutation

**Precondition** U is `viewer` in W1. `MEM-M` is a valid membership; `TSK-9999` does not exist.
**Requests** (a) `PATCH /leads/LEAD-1042 {status:"qualified", version:8}` (b) `POST /tasks/TSK-9999/complete`
**Authorization path** Step 8 — `viewer` has no `lead.update` and no `task.manage`.
**Expected** Both `403` · `PERMISSION_DENIED`, `details.permission` naming the code.
**State mutation** None.
**Disclosure** (b) does **not** reveal whether `TSK-9999` exists: RBAC (step 8) runs before object resolution (step 9), so an unauthorized caller cannot probe CRM public IDs.

---

### CF23 — Cross-workspace relationship injection

**Precondition** The caller is on W1. `DEAL-W2`, `JOB-W2`, and `MEM-W2` all belong to W2.
**Requests** `POST /leads/LEAD-1042/appointments {deal_ref: DEAL-W2}` · `POST /businesses/BUS-1042/convert-to-lead {source_job_ref: JOB-W2}` · `PATCH /leads/LEAD-1042 {owner_ref: MEM-W2}`
**Authorization path** Doctrine R-2 for all three: each reference is resolved through the W1 scope and misses.
**Expected** All three `404` · `ENTITY_NOT_FOUND` — **never `400`**.
**State mutation** **None.** Zero rows created.
**Audit** `authz.relationship_out_of_scope` for each.
**Disclosure** Zero. Identical to a randomly generated ID of the same shape.

---

### CF24 — Unstable pagination under concurrent activity

**Precondition** W1 has 60 Leads, several sharing `priority='high'`. The client pages with `sort=priority&limit=25` while colleagues update Leads.
**Request** page 1, then the returned `next_cursor`
**Expected** `200` for both. **No Lead is skipped and none is returned twice** within a stable ordering key, because the sort key is `(priority_rank DESC, public_id DESC)` and the cursor encodes the full tuple.
**Variant — the client changes `sort` while presenting the old cursor:** `400 VALIDATION_ERROR`. The cursor is never silently reinterpreted against a different ordering.
**Rationale** The frozen client sorts with no tie-break (`Crm.tsx`), so `LEAD-1042` and `LEAD-1137` — both `high` — may swap between requests. This scenario is the acceptance-visible reason `B2_CRM_LIST_QUERY_MODEL.md` §5 makes every sort key total.
