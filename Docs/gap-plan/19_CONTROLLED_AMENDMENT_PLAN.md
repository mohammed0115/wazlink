# 19 — Controlled Amendment Plan

> **This is a plan. No amendment is executed. No frozen file is edited.** Baseline B13 = `5c759cea72baaec9ee0096039475162efd4eeec0`.

## 0. Governance vocabulary — aligned with frozen B13

`B13_CONTROLLED_AMENDMENTS.md` states the corpus rule: *"Every genuine change to a frozen B0–B12 artifact must be recorded here, classified `ADDITIVE`, `COMPATIBLE_CLARIFICATION`, or `NON_ADDITIVE`, and never applied by [the phase] itself."*

**A controlled amendment is the governance vehicle, not a severity.** An additive change to a frozen artifact is still an amendment and still requires registration. Earlier revisions of this pack used a narrower binary (`ADDITIVE_EXTENSION` *versus* `CONTROLLED_AMENDMENT_REQUIRED`), which understated the register. That is corrected here: the inventory below is derived mechanically from every frozen artifact this plan touches.

| Class | Meaning | Count |
|---|---|---:|
| `NON_ADDITIVE` | Changes a fact a frozen document explicitly stated | **2** |
| `ADDITIVE` | Adds to a frozen artifact without altering any existing statement | **12** |
| `COMPATIBLE_CLARIFICATION` | States a boundary the frozen text already implies, without changing it | **1** |
| **Total** | | **15** |

> **`B14-FIX.1` revision.** `CA-15` was added to close independent-verification finding `V-04`. The `NON_ADDITIVE` count rose from 1 to 2 and the total from 14 to 15. **The classification was derived from the actual contract change, not chosen to preserve the previous count** — frozen `B2_LEAD360_READ_MODEL.md` §1 states `required: [lead, business]`, and making `business` optional changes an explicitly stated fact.

Affected phases: **B0, B1, B2, B5, B7, B8, B11** (7 phases). Unaffected: **B3, B4, B6, B9, B10, B12, B13**.

`GAP-021`, `GAP-025` and the analytics selectors of `GAP-023` require **no** amendment — they add no frozen-artifact change at all. `GAP-018`–`GAP-020` place the Quote↔Deal FK on the new `quotes` table, so frozen B6 `deals` gains nothing and B6 needs no amendment item.

---
## `CA-01` — Lead origin opened to non-Discovery sources · **`NON_ADDITIVE`**

**Affected phase / contract** B2 — `B2_LEAD_AGGREGATE.md` §1 and §4; CRM-INV-10 in `B2_CRM_DOMAIN_BLUEPRINT.md`.
**Gaps requiring it** `GAP-003`, `GAP-005`, and transitively `GAP-004`, `GAP-008`, `GAP-009`.

**Why additive extension cannot solve it.** A CHECK constraint enumerating exactly one value cannot admit a second, and a NOT NULL column cannot hold a Business-less Lead. No new table works around a constraint on the existing one. `B2-D-C001` states the requirement in the frozen corpus's own words: *"needs a Business-less `Lead` schema amendment and its own identity/duplicate rule; must **not** fabricate a Business or a Job."*

### The five frozen constraints that block a non-Discovery Lead

All five were read directly from `B2_LEAD_AGGREGATE.md`; the earlier revision of this plan addressed only the first three.

| # | Frozen constraint | Verbatim source | Target after `CA-01` |
|---:|---|---|---|
| 1 | `origin_type` CHECK `IN ('discovery')` | §1 — *"`discovery` only in Phase 1"* | Widen to `('discovery','manual','import','api','form')` |
| 2 | `business_id` `UUID FK … ON DELETE RESTRICT`, not nullable | §1 | **Nullable**, governed by the conditional invariant below |
| 3 | Partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` | §1 — CRM-INV-10 | Scope to `… AND business_id IS NOT NULL` |
| 4 | **`converted_at` `timestamptz NOT NULL`** | §1 — *"instant of the conversion decision; immutable"* | **Nullable**, required only for `origin_type='discovery'` |
| 5 | **`last_activity_at` — *"Initial value at conversion: `converted_at`"*** | §4 | Seed from `converted_at` for discovery; from row creation time for every other origin |

Constraints 4 and 5 were the **D-1 defect**: without them `CA-01` would not have unblocked G0, because no manual Lead row could be inserted at all.

### Target conditional invariants

```
origin_type ∈ ('discovery','manual','import','api','form')          -- immutable after creation
origin_type = 'discovery'  ⇒  business_id   IS NOT NULL
origin_type = 'discovery'  ⇒  converted_at  IS NOT NULL
origin_type ≠ 'discovery'  ⇒  business_id   IS NULL  or a deliberately linked Business
archived_at IS NULL OR converted_at IS NULL OR archived_at >= converted_at
last_activity_at seeded from converted_at (discovery) else from created_at
```

Constraint 1's frozen form is already written as an **implication** — `origin_type='discovery' ⇒ business_id IS NOT NULL` — not an equality. The frozen design therefore already reserved the shape for non-discovery origins; only the enumeration was closed. That is why this amendment relaxes rather than redesigns, and why every existing row satisfies the target unchanged.

### `whatsapp` is deliberately **not** an origin value

An inbound WhatsApp message must never create a Lead (`06_IDENTITY_RESOLUTION.md` §4). When a human deliberately creates a Lead while working a WhatsApp conversation, the origin is **`manual`** — a human made the pursuit decision. Minting a `whatsapp` origin would fabricate provider provenance for a human act and would invite the auto-creation this plan forbids.

### `lead_provenance` — no fake provenance, and no amendment required

`lead_provenance` carries `business_public_id NOT NULL`, `business_name_snapshot NOT NULL` and `intelligence_status NOT NULL` (`analyzed | insufficient_data`), with `lead_id` **unique** — *"One row per Lead, written inside the conversion transaction."*

**Non-Discovery Leads have no `lead_provenance` row at all.** The table is by definition a *Discovery→Lead conversion snapshot*, and CRM-INV-9 is already scoped to exactly that: *"Discovery→Lead conversion preserves provenance durably."* A Lead that was never converted has no conversion to snapshot.

This is registered as `CA-14` (`COMPATIBLE_CLARIFICATION`), **not** as a schema change. The earlier revision of this plan wrongly required non-Discovery Leads to write a `lead_provenance` row with `origin_kind='manual'` — impossible under three NOT NULL columns, and a fabrication of Discovery provenance. **That requirement is withdrawn.** Origin truth for non-Discovery Leads lives in `leads.origin_type` plus a nullable typed origin reference (`import_batch_id`, `form_submission_id`, or null for manual/api).

### Duplicate protection

Discovery-originated Leads keep CRM-INV-10 unchanged — the partial unique index still covers every row with a `business_id`. Business-less Leads have **no** business-keyed uniqueness and are protected instead by `GAP-006` advisory identity resolution.

> **Hard sequencing rule.** `GAP-006` must ship **with or before** any Business-less intake path (`GAP-003`, `GAP-008`). Shipping `CA-01` without it would narrow the duplicate index with no replacement. This is risk `R-18` and is enforced in `20_RELEASE_PLAN.md`.

**Backward compatibility / migration.** Every existing Lead has `origin_type='discovery'`, a non-null `business_id` and a non-null `converted_at`, so all satisfy the widened CHECKs and the narrowed index **unchanged**. Purely additive: **no row rewritten, no backfill, no provenance removed, no fake provenance created.** Reversible while no non-discovery row exists.

**Security impact** none — no permission, tenancy or authorization rule changes. **Revenue impact** **none**: `CA-01` changes no B9 ownership; Lead origin has no authority to recognize revenue, and `RecordRevenueEvent` remains B9's sole human-gated writer. **Async impact** none.

**Risk** **Low-medium.** The genuine risk is the uniqueness narrowing, mitigated by the sequencing rule above.

**Verification** `GT-B-1`…`GT-B-6`, plus negative controls: no Business is fabricated for a manual Lead; no `lead_provenance` row is written for a non-Discovery Lead; Track-A conversion behaviour is byte-identical to today; an existing Discovery Lead still satisfies every constraint.

**Recommendation** **`APPROVE_WITH_CHANGES`** — approved as corrected above.

---
## `CA-02` — Conversation handling mode · **`ADDITIVE`**
**Phase / contract** B5 — `B5_CONVERSATION_MODEL.md` §1.
**Gaps** `GAP-012`, `GAP-013`, `GAP-014`.
**Change** Add an **orthogonal** `conversations.handling_mode` column (`ai_assisted | human | ai_paused`, default `human`) plus three events. **The frozen `status` `enum(2)` is not widened and the frozen state machine's fan-out is unchanged** — the same technique B12 used when it refused to give `WebhookReceipt` a new terminal transition.
**Additive solution possible?** This *is* the additive solution; a mode cannot live in Redis (non-authoritative) or the frontend.
**Compatibility** Default `human` reproduces today's behaviour for every existing row. **Migration** column with default; no backfill. **Security/Revenue** none. **Async** queued AI work re-reads mode at execution (`FI-B12-05`), so no new mechanism. **Risk** Low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-03` — Public-ID registry prefixes · **`ADDITIVE`**
**Phase / contract** B0 — `BACKEND_PUBLIC_ID_REGISTRY.md` section A.
**Gaps** `GAP-001`, `GAP-015`, `GAP-016`, `GAP-018`, `GAP-019`.
**Change** Register `CUS-`, `TKT-`, `QUO-`, `PRD-`, `KBA-`. Formally resolve `CMP-` (section B fixture, ruled out by `B2-D-A004`) as **rejected**, closing the orphan.
**Additive solution possible?** No — the registry is the sole authority; an unregistered prefix is invalid by definition.
**Compatibility** No existing prefix changes meaning. **Migration** none. **Risk** Very low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-04` — Merge lineage and reference survivability · **`ADDITIVE`**
**Phase / contract** B2 — `B2_CONTACT_MODEL.md` §4 (duplicates advisory, no merge); cross-domain references held by B5 `conversations.contact_id`, B6, B9 attribution subjects.
**Gaps** `GAP-007` (**now P1**, per `PD-006`).
**Change** New `merge_records` lineage table; losing party **archived, never deleted**; references resolve through lineage.
**Additive solution possible?** The table is additive; the *semantic* change is that a reference may resolve through lineage, which is why it is registered rather than assumed.
**Compatibility / migration** New table; no existing data changes. **Security** merge is human-only, reason-required, single-workspace. **Revenue** **no immutable B9 row is ever rewritten** — lineage sits beside snapshots, never over them. **Risk** **Medium — the highest-risk item in the register**, which is why `PD-006` moved execution out of the P0 wave.
**Recommendation** **`APPROVE_WITH_CHANGES`** — bind explicitly to `PD-006`; register only when `GAP-007` is scheduled.

---
## `CA-05` — Contact ↔ Customer linkage · **`ADDITIVE`**
**Phase / contract** B2 — `B2_CONTACT_MODEL.md` §2 (`contacts` columns; `source` enum `discovery_business | manual`).
**Gaps** `GAP-001`, `GAP-002`.
**Change** Add nullable `contacts.customer_id`; widen `source` to add `manual_customer`, `import`. New `customer_contacts` join reusing the frozen `lead_contacts` shape verbatim.
**Compatibility** Both changes nullable/additive; **CRM-INV-18 untouched** — still no unique index on `phone` or `email` at any scope. **Migration** existing rows unaffected. **Risk** Low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-06` — `contact.*` permission family · **`ADDITIVE`**
**Phase / contract** B1 — `B1_AUTHORIZATION_RBAC.md` permission table; B2 — `B2_CONTACT_MODEL.md` §6's reasoning for not minting them.
**Gaps** `GAP-002`.
**Why registered rather than treated as free.** `B2_CONTACT_MODEL.md` §6 states a **condition, not a permanent refusal**: *"If a standalone address book is ever built, that is the moment to mint them (`B2-D-C007`)."* `GAP-002` builds exactly that, so this amendment is the frozen design's own stated trigger firing. It is still a change to a frozen table and is therefore registered — classified `ADDITIVE` because no existing cell changes.
**Change** Add `contact.view`, `contact.manage`. Lead-context contact operations remain `lead.update`-gated and behave identically.
**Security** The real consequence is a **new bulk PII egress path** (a contacts list) — governed by `PD-002`, now **APPROVED: masked for Viewer, enforced server-side**. **Risk** Low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-07` — Root data-model table groups · **`ADDITIVE`**
**Phase / contract** B0 — `BACKEND_DATA_MODEL.md` PostgreSQL logical model.
**Gaps** every new-entity gap.
**Change** Add table groups at the existing granularity (table names + key constraints, not column DDL): Customers, Identity, Imports, CustomFields, Support, Catalog/Quotes, Knowledge, Assignment, AIAgent.
**Precedent** `B12-AM-002` added five tables to this same document, classified `ADDITIVE`. **Migration** none (documentation). **Risk** Low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-08` — Authorization matrix and command/event catalog rows · **`ADDITIVE`**
**Phase / contract** B0 — `BACKEND_AUTHORIZATION_MATRIX.md`, `BACKEND_COMMAND_EVENT_CATALOG.md`.
**Change** Additive rows for the new commands and events. **No frozen command or event is redefined, renamed, or given a new payload field.**
**Precedent** B5's own amendment item 2 added 10 commands and 4 events this way. **Risk** Very low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-09` — B1 permission catalog rows (non-contact) · **`ADDITIVE`**
**Phase / contract** B1 — `B1_AUTHORIZATION_RBAC.md` permission table and role matrix.
**Gaps** `GAP-001`, `GAP-004`, `GAP-008`, `GAP-010`, `GAP-014`, `GAP-016`, `GAP-018`, `GAP-019`, `GAP-022`.
**Change** Add the remaining new permission codes (`customer.*`, `import.manage`, `customfield.manage`, `assignment.manage`, `ticket.*`, `knowledge.*`, `product.manage`, `quote.*`, `agent.manage`, `form.manage`). **No new role, no new rank, no changed cell.**
**Why registered.** The earlier revision treated B1 as "additive extension, not an amendment". Under B13 governance a change to a frozen table is an amendment regardless of class. **Risk** Very low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-10` — B11 attachment subject enum · **`ADDITIVE`**
**Phase / contract** B11 — `B11_DOMAIN_ATTACHMENT_MODEL.md` `file_attachments (subject_type, subject_id)`.
**Gaps** `GAP-001`, `GAP-008`, `GAP-015`, `GAP-016`.
**Change** Register subject values `customer`, `ticket`, `kb_article`, `import_batch`.
**Why registered.** This is precisely the extension path B11 designed (*"Adding a domain later — register an enum value"*), but the enum is now frozen, so the registration is an amendment. **B11 remains the single storage authority; no second file truth is created.** **Risk** Very low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-11` — B8 capability keys and plan catalog · **`ADDITIVE`**
**Phase / contract** B8 — `B8_PLAN_CATALOG.md`, `B8_ENTITLEMENT_MODEL.md`; B1 — `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` capability list.
**Gaps** most; packaging governed by `PD-004` (**APPROVED: independent per-module keys**).
**Change** Add independent capability keys for the new modules. `inbox.copilot` is **reused, not replaced**, per `PD-003`.
**Scope note** `PD-004` approves the **entitlement architecture only**. Final commercial pricing and tier placement are **not frozen** by this amendment. **Risk** Very low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-12` — B7 trigger and action catalogs · **`ADDITIVE`**
**Phase / contract** B7 — `B7_TRIGGER_CATALOG.md`, `B7_ACTION_CATALOG.md`.
**Gaps** `GAP-016`, `GAP-017`, `GAP-001`.
**Change** Add triggers `customer_created`, `ticket_created`, `sla_breached`; add action `create_ticket` at safety tier `auto_safe` (it creates internal work and contacts nobody — the same reasoning that makes frozen `create_task` `auto_safe`).
**Preserved verbatim** `send_message` stays `approval_required` — *"mandatory, never `auto_safe`, not configurable per-rule"* — and B7's excluded-action list stays excluded. **Risk** Low.
**Recommendation** **`APPROVE_AS_WRITTEN`**.

---
## `CA-13` — Workspace operating-mode preference · **`ADDITIVE`**
**Phase / contract** B1 — `workspaces` table.
**Gaps** `GAP-024` (**now DEFERRED**; the amendment is registered but not scheduled).
**Change** One nullable `workspaces.operating_mode` preference. **Navigation and defaults only — never the data model, never a permission.**
**Risk** Very low. **Recommendation** **`DEFER`** — approve when `GAP-024` is scheduled.

---
## `CA-14` — `lead_provenance` scope clarification · **`COMPATIBLE_CLARIFICATION`**
**Phase / contract** B2 — `B2_LEAD_PROVENANCE_DUPLICATION.md` §3; CRM-INV-9.
**Gaps** `GAP-003`, `GAP-005`, `GAP-008`.
**Change** Record explicitly that `lead_provenance` applies **only** to Discovery→Lead conversion, and that a non-Discovery Lead has **no** provenance row.
**Why a clarification and not a change.** CRM-INV-9 already reads *"Discovery→Lead conversion preserves provenance durably"*, and §3 already describes a row *"written inside the conversion transaction"*. Nothing is altered; the boundary is stated so B14 cannot guess. **No frozen column, constraint or invariant changes.**
**Risk** None. **Recommendation** **`APPROVE_AS_WRITTEN`**.


---
## `CA-15` — Business-less Lead display identity · **`NON_ADDITIVE`**

> Added by `B14-FIX.1` to close independent-verification finding **`V-04`**. `CA-01` relaxed the five constraints that stopped a Business-less Lead row from being *inserted*, but left it **unusable**: frozen B2 forbids every identifying attribute on `leads`, and the frozen Lead 360 read contract **requires** a Business. This amendment supplies the missing identity source without copying one byte of PII onto `leads`.

**Affected phase / contracts** B2 — `B2_LEAD360_READ_MODEL.md` §1 (the `required` list); `B2_CRM_LIST_QUERY_MODEL.md` §§4, 5, 7 (`LeadListItem`, search field set, `name` sort, `city` filter); `B2_CONTACT_MODEL.md` §3 (the `RemoveContact` primary-unlink rule, conditionally).
**Gaps requiring it** `GAP-003`, `GAP-005`; transitively `GAP-004`, `GAP-008`, and `GAP-009` when it is undeferred.

### Why an additive extension cannot solve it

Three frozen statements collide for a Lead with `business_id IS NULL`:

| # | Frozen statement | Verbatim source | Effect on a Business-less Lead |
|---:|---|---|---|
| 1 | `Lead360 { lead, business, … }` **`required: [lead, business]`** | `B2_LEAD360_READ_MODEL.md` §1 | The Lead 360 response is **invalid** — a required member cannot be produced |
| 2 | `name`, `company_name`, `city`, `category`, `phone`, `email`, `website` are **"Explicitly absent"** from `leads`, and the list is declared **normative** | `B2_LEAD_AGGREGATE.md` §1 | The Lead carries **no** identifying attribute of its own |
| 3 | CRM-INV-3 — *"Lead stores `business_id` and copies no Business attribute. `city`, `category`, `name`, `phone`, `website` are **read from Business**"* | `B2_CRM_DOMAIN_BLUEPRINT.md` | The only sanctioned identity source is a Business that does not exist |

Statement 1 is an explicit frozen fact being changed, so the class is **`NON_ADDITIVE`**. It is **not** classified `COMPATIBLE_CLARIFICATION`: nothing in frozen B2 implies that `business` is optional — B2 states the opposite, and `LeadListItem` projects four non-null Business columns. **The classification is derived from the contract change, not chosen to preserve a count.**

### The approved architecture — identity by reference, never by copy

```
Lead  (CRM process aggregate — owns no identity attribute, ever)
 ├── business_id   OPTIONAL   → Business owns organization attributes
 └── primary Contact  REQUIRED when business_id IS NULL
                              → Contact owns reachability PII
```

Ownership is **unchanged**: Business remains the owner of organization/business attributes (CRM-INV-3), Contact remains the owner of reachability PII (CRM-INV-18, `B2_CONTACT_MODEL.md` §2), and Lead remains the CRM process aggregate. **No attribute is denormalized onto `leads`.**

### Schema change — none to any table

The relationship the amendment needs **already exists in frozen B2**: `lead_contacts` carries `is_primary boolean NOT NULL default false` under **partial unique `(lead_id) WHERE is_primary AND unlinked_at IS NULL`** (`B2_CONTACT_MODEL.md` §3), which already guarantees *at most one* primary Contact per Lead. `CA-15` adds the conditional *at least one* half, and nothing else.

**No new table. No new column. No new index. No data migration. No backfill.**

### Target conditional invariant

```
leads.business_id IS NULL
   ⇒ the Lead has exactly one active primary link in lead_contacts
     (is_primary = true AND unlinked_at IS NULL)

leads.business_id IS NOT NULL
   ⇒ unchanged frozen behaviour in every respect
```

Enforced as a **command guard plus a nightly integrity assertion**, *not* a database constraint — PostgreSQL cannot declaratively express a conditional cross-table cardinality. This is the identical technique frozen B2 already uses for CRM-INV-16 (`owner_membership.workspace_id = leads.workspace_id`) and is stated here so no implementer omits it.

### Consequence for `RemoveContact` — stated explicitly because it contradicts a frozen rule

`B2_CONTACT_MODEL.md` §3 currently states: *"When the unlinked link was primary, the Lead is left with **no** primary contact — B2 does **not** auto-promote another contact, because picking a new primary is a human decision."*

| Lead kind | Behaviour after `CA-15` |
|---|---|
| `business_id IS NOT NULL` (Discovery) | **Frozen behaviour unchanged.** Unlinking the primary leaves no primary; no auto-promotion |
| `business_id IS NULL` (non-Discovery) | Unlinking the **sole** primary Contact is **refused** with `409` — it would strand the Lead with no identity. The human must promote a replacement primary in the same operation |

**Auto-promotion is still never performed.** The refusal preserves B2's reasoning (picking a primary is a human decision) rather than overriding it.

### Display projection — provider-independent and Business-independent

A derived, read-time projection. **It is a projection, not a stored column, and it is never authoritative.**

| Field | `business_id IS NOT NULL` | `business_id IS NULL` |
|---|---|---|
| `display_name` | `business.name` | primary `contact.name` |
| `display_subtitle` | `business.category` + `business.city` (frozen list semantics) | **`null`** — a Contact does not own a business category or city |
| `display_source` | `"business"` | `"contact"` |

`display_source` exists so a client never has to infer which branch produced the value, and so a test can assert the branch directly.

**`display_subtitle` is deliberately `null` rather than synthesized.** Filling it from Contact data would make a Contact appear to own a business category or city, which is precisely the second-authority failure CRM-INV-3 exists to prevent.

### `LeadListItem` — nullability, search, sort, filter

**Nullability.** `business_ref`, `business_name`, `business_category`, `business_city` and `source_job_ref` / `source_job_name` become **nullable**, and are `null` for every Business-less Lead. `display_name`, `display_subtitle` and `display_source` are added. The frozen `Lead` schema itself is still **untouched** — `B2_CRM_LIST_QUERY_MODEL.md` §7 already established that `GET /leads` returns a separate `LeadListItem` DTO precisely so the frozen schema need not be amended.

**Search (§4).** Frozen field set: Business `name`, Business `category`, Business `city`, Lead `public_id`.

| Lead kind | Searched |
|---|---|
| Always | Lead `public_id` |
| Business-backed | Business `name`, `category`, `city` — **unchanged** |
| Business-less | primary Contact **`name` only** |

**Contact `phone` and `email` remain excluded from search**, for both Lead kinds. Frozen `B2-D-C014` refuses them because searching by phone or email would make `GET /leads` a reverse-lookup oracle. `CA-15` does not reopen that decision, and the exclusion is a negative control.

**Sort (§5).** `sort=name` orders by the **derived `display_name`** rather than `business_name ASC`. Arabic collation and the `public_id ASC` tiebreak are unchanged.

**Filters `city` and `category` (§2).** These read Business-owned data. A Business-less Lead **owns no value for them and therefore never matches either filter** — it is excluded, not defaulted, not coerced and not silently matched. No Contact field is substituted. If a workspace needs to filter Business-less Leads by locality, the sanctioned mechanism is a **custom field** (`GAP-010`), not a fabricated Business attribute.

### Lead 360

`business` moves from **required** to **optional**, present exactly when `business_id IS NOT NULL`. A `display` block (`display_name`, `display_subtitle`, `display_source`) is added and is **always** present, so no consumer needs a Business to render a header. `contacts[]` is already in the frozen contract and carries the primary Contact.

### Creation semantics — no partial, unusable Lead

A Business-less Lead and its primary Contact are created in **one transaction**. Either the Lead exists with a usable identity, or nothing is written.

```
BEGIN
  resolve or create Contact        (GAP-006 resolve_party, workspace-keyed)
  create Lead                      (business_id NULL, converted_at NULL, origin_type immutable)
  link Contact as primary          (lead_contacts, is_primary = true)
  assert the CA-15 conditional invariant
COMMIT
```

Applies identically to `manual`, `import` and `api` origin. **No intake path may commit a Business-less Lead without a primary Contact.** `form` origin inherits the same rule for whenever `GAP-009` is undeferred; **this amendment does not enable public form intake** (`PD-010` stands).

**No duplicate Contact truth is created.** The Contact is resolved through `GAP-006`'s workspace-keyed `resolve_party` and reused when it already exists — the same reuse-before-insert discipline frozen B2 §3 already applies to Discovery contacts. `GAP-006`'s safety boundary is unchanged: workspace-keyed, advisory, no automatic merge, no cross-workspace resolution.

### Compatibility, migration, security, revenue

**Migration** none — no table, column or index changes. **Backfill** none. Every existing Lead has a Business and is unaffected in schema, projection, search, sort and filter.

**Backward compatibility** a Business-backed Lead behaves **byte-identically** to today on every surface. The only observable change for existing data is the presence of three additional derived fields, which are additive to the DTO.

**Security** none — no permission, tenancy or authorization rule changes. Contact PII continues to be masked for Viewer under `PD-002`, and the masking applies to `display_name` **wherever it is Contact-derived**, on every surface including exports and AI provider egress. **Revenue** none. **Async** none.

**Reversibility** fully reversible while no Business-less Lead exists — the same window as `CA-01`, which it is bound to.

### Risk

**Low-medium.** The genuine risk is a projection that silently falls back to a Business attribute for a Business-less Lead, or a masking gap on the Contact-derived branch. Both are covered by negative controls.

**Verification** negative controls: no Business is fabricated; no `lead_provenance` row is written; **no PII column appears on `leads`**; `display_subtitle` is `null` and never Contact-derived; Contact `phone`/`email` never enter search; a Business-less Lead never matches `city` or `category`; Viewer masking applies to a Contact-derived `display_name`; a Business-less Lead cannot be committed without a primary Contact; unlinking the sole primary is refused; Track-A behaviour is byte-identical.

**Recommendation** **`APPROVE_WITH_CHANGES`** — approved as written above, bound to `CA-01` and `GAP-003`; register only together with `CA-01`.

---
## Register summary

| ID | Phase | Class | Disposition | Blocking |
|---|---|---|---|---|
| `CA-01` | B2 | **`NON_ADDITIVE`** | `APPROVE_WITH_CHANGES` | **G0 — the whole programme** |
| `CA-02` | B5 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G3 |
| `CA-03` | B0 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-04` | B2 + cross | `ADDITIVE` | `APPROVE_WITH_CHANGES` | post-P0 (`GAP-007`) |
| `CA-05` | B2 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-06` | B1 / B2 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-07` | B0 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-08` | B0 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-09` | B1 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-10` | B11 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 |
| `CA-11` | B8 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G0 packaging |
| `CA-12` | B7 | `ADDITIVE` | `APPROVE_AS_WRITTEN` | G4 |
| `CA-13` | B1 | `ADDITIVE` | `DEFER` | — |
| `CA-14` | B2 | `COMPATIBLE_CLARIFICATION` | `APPROVE_AS_WRITTEN` | G0 |
| **`CA-15`** | **B2** | **`NON_ADDITIVE`** | **`APPROVED` — explicit Owner/CTO ratification, `B14-FIX.2`** | **G0 — bound to `CA-01`** |

**15 items · 7 phases · 2 `NON_ADDITIVE` · 12 `ADDITIVE` · 1 `COMPATIBLE_CLARIFICATION`. None executed by this plan.** All require CTO registration before B14 may consume them.

**Two items change a fact a frozen document explicitly stated: `CA-01` and `CA-15`.** Every other item adds to a frozen artifact or states a boundary it already implied.

**`CA-15` was added by `B14-FIX.1`** to close independent-verification finding `V-04`. It is bound to `CA-01`: `CA-01` makes a Business-less Lead *insertable*, `CA-15` makes it *usable*. Registering `CA-01` without `CA-15` produces Lead rows that cannot satisfy the frozen Lead 360 contract and cannot be displayed, sorted or searched — so the two are registered together or not at all.

### `CA-15` Owner ratification — the self-referential chain, closed (`M-01`)

**Independent countersign finding `M-01`:** `CA-15` was *proposed* by `B14-FIX.1`, which also wrote the register row authorising it. The engineering was correct and the `NON_ADDITIVE` classification was right, but the approval chain pointed at its own author. A `NON_ADDITIVE` change to a frozen contract may not be self-authorised.

**Resolved.** The Owner/CTO has now ratified `CA-15` explicitly and independently of the pass that proposed it. Status moves `APPROVE_WITH_CHANGES` → **`APPROVED`**, and the authority is the Owner decision below, not `B14-FIX.1`.

**The ratified semantics — frozen verbatim.** For a non-Discovery Lead where `business_id IS NULL`:

| # | Ratified rule |
|---:|---|
| 1 | **No identity/PII field is copied into `leads`** |
| 2 | **No Business is fabricated** |
| 3 | The **primary Contact** is the Lead's display and reachability identity |
| 4 | **Lead remains the CRM process aggregate** |
| 5 | **Contact owns PII and reachability** |
| 6 | **Business owns organization/business attributes** when one exists |
| 7 | The Lead 360 **Business projection is optional** for non-Discovery Leads |
| 8 | Lead List derives identity: Business-backed → **Business projection**; Business-less → **primary Contact projection** |
| 9 | **Existing Discovery Lead semantics are unchanged** |
| 10 | **No fake `DiscoveryJob`, `Business` or `lead_provenance` row is created** |

**The engineering semantics are unchanged by this ratification** — every rule above already matched what `B14-FIX.1` specified and what the independent countersign verified against frozen `B2_LEAD360_READ_MODEL.md` §1, `B2_LEAD_AGGREGATE.md` §1 (CRM-INV-3) and `B2_CONTACT_MODEL.md` §3. Ratification supplies the missing *authority*, not a new design.

**`CA15_OWNER_RATIFIED = PASS`.** Recorded as Owner decision `PD-016` in `27_PRODUCT_DECISION_REGISTER.md` §1.
