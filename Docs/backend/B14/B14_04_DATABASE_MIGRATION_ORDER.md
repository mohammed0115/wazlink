# B14_04 — Database Migration Order

> Logical migration **sequence and contract**. **No migration file is authored in B14.** Every table inherits B0 conventions: UUIDv7 `id`, immutable prefixed `public_id`, UTC `created_at`/`updated_at`, optional `archived_at`, `workspace_id` on every tenant-owned row, JSONB only for provider metadata / raw snapshots / structured flexible metadata / audit detail — **never for relationships, state or ownership**.

**No destructive migration appears anywhere in this sequence.** Every group is additive; the single constraint-relaxing group (**M07**) is explicitly approved as `CA-01`.

> **`B14-FIX.3` amendment — closes `N-04`.** `M03` gains one table, **`workspace_plan_assignments`** (`entitlements`-owned), so that `EvaluateEntitlement` reads only `entitlements` rows and never reaches upward into `billing` (`B14_03` §6b). **No new migration group, no group re-ordering, no change to any existing table, and no new FK edge** — `subscription_ref` is stored as an opaque `SUB-*` string precisely because an FK from `M03` (position 2) to `M20` (position 11) would be a forward FK. `MIGRATION_GROUP_COUNT` stays **27** and `FORWARD_FK_COUNT` stays **0**.
>
> **`B14-FIX.1` rebuild — closes `V-01` and `V-M03`.** The previous sequence was **not executable**: `M04` (`leads`, I2) and `M07` (`customers`, I5) declared FKs to `businesses`/`discovery_jobs`, which the old `M12` created at I3 — **two slices later** — and `M06`'s import FK preceded the group creating `import_batches`. The DAG below is derived from **actual FK dependencies**, verified mechanically in §4.

## 1. The principle that resolves it — schema prerequisite ≠ feature enablement

Frozen `B2_LEAD_AGGREGATE.md` §1 gives `leads` two FKs into Discovery-owned tables:

```
leads.business_id    UUID FK → businesses.id      ON DELETE RESTRICT
leads.source_job_id  UUID null FK → discovery_jobs.id
```

and `B3_DOMAIN_OWNERSHIP.md` assigns `businesses`, `business_identities`, `discovery_jobs`, `discovery_queries`, `discovery_results` to **Discovery**. CRM cannot exist without those tables, so the CRM slice cannot precede their creation.

**The resolution is not to move ownership.** Discovery **retains** ownership of every one of those tables. What is split is *when the schema exists* from *when the feature is enabled*:

| | **Schema prerequisite** | **Feature enablement** |
|---|---|---|
| What | Discovery-owned tables created; the `discovery` app installed with models and migrations | Job orchestration, ports, `places`/`scraping` adapters, provider calls, quota, API, UI |
| Slice | **I2** (`M04`) | **I3** |
| Owner | **`discovery`** — unchanged | **`discovery`** — unchanged |
| Reachable at I2 | `UpsertBusiness` (the normalization service only — no provider, no job) | nothing |

`UpsertBusiness` is domain normalization, not provider integration: `B3_DOMAIN_OWNERSHIP.md` names *"the **normalization service** only"* as the writer of `businesses`. Nothing about it requires a credential, an adapter or a `DiscoveryJob`. **No CRM module writes a Discovery table at any point.**

**`M04` creates no CRM data and enables no Discovery feature.** At I2 the Discovery API, ports, adapters, jobs and UI do not exist.

## 2. Migration groups — 27

| # | Group | Module | Slice | Class | FK depends on |
|---|---|---|---|---|---|
| M01 | Identity & tenancy | `accounts`, `identity_access`, `workspaces` | I1 | new | — |
| M02 | Platform substrate | `platform_async`, `auditlog` | I1 | new | M01 |
| M03 | Entitlements | `entitlements` | I1 | new | M01 |
| **M04** | **Discovery schema foundation** | **`discovery`** | **I2** | new | M01 |
| M05 | Files | `files` | I2 | new | M01 |
| M06 | CRM core | `crm` | I2 | new | M01, **M04**, M05 |
| **M07** | **Lead origin — `CA-01`** | `crm` | I5 | **`NON_ADDITIVE` (approved)** | M06 |
| M08 | Customers | `customers` | I5 | new | M01, M04, M06 |
| M09 | Contact↔Customer — `CA-05` | `crm`+`customers` | I5 | additive | M06, M08 |
| **M10** | **Lead display identity — `CA-15`** | `crm` | I5 | **`NON_ADDITIVE` (approved)** · **no schema change** | M07, M09 |
| M11 | Identity resolution | `identity` | I5 | new | M01 |
| M12 | Custom fields | `customfields` | I5 | new | M01 |
| M13 | Imports | `imports` | I5 | new | M01, M05 |
| **M14** | **Lead import origin FK — `CA-01` (part 2)** | `crm` | I5 | additive | **M07, M13** |
| M15 | Intelligence | `intelligence` | I4 | new | M04, M06 |
| M16 | Messaging | `messaging` | I6 | new | M06, M11 |
| M17 | Conversation handling mode — `CA-02` | `messaging` | I6 | additive | M16 |
| M18 | Pipeline | `pipeline` | I7 | new | M06, M08 |
| M19 | Automation | `automation` | I8 | new | M06, M16, M18 |
| M20 | Billing | `billing` | I9 | new | M01, M03 |
| M21 | Revenue & attribution | `revenue` | I10 | new | M01, M06, M08 — **never `deals`** |
| M22 | Tax | `tax` | I10 | new | M20 |
| M23 | Assignment | `assignment` | **I6** | new | M01 |
| M24 | AI agent | `aiagent` | I13 | new | M16 |
| M25 | Knowledge base | `knowledge` | I13 | new | M05 |
| M26 | Support & SLA | `support` | I14 | new | M08, M16 |
| M27 | Merge lineage — `CA-04` | `identity` | I14 | additive, **post-P0** | M08, M11 |

**`M07`, `M10` and `M11` must land in the same slice** — the hard sequencing rule from `CA-01` (identity resolution is the replacement duplicate control) plus `CA-15` (a Business-less Lead is unusable without its identity contract). I5 contains all three.

**`M23` moved from I14 to I6** — `GAP-013` (P0, team inbox/routing/ownership) depends on `GAP-022` per the approved Gap Plan. See `B14_02` §3.

### `CA-10` — `file_attachments.subject_type`, extended where first used

Enum values are added by the group that first needs them, never speculatively:

| Value | Added by | Slice |
|---|---|---|
| `customer` | M08 | I5 |
| `import_batch` | M13 | I5 |
| `kb_article` | M25 | I13 |
| `ticket` | M26 | I14 |

**B11 remains the single storage authority** (`T-FILE-1`).

## 3. Slice order and group order agree

Applied order (`B14_28` §1):

```
1 I0   2 I1   3 I2   4 I5   5 I7   6 I3   7 I4   8 I6
9 I13  10 I8  11 I9  12 I10  13 I11  14 I12  15 I14  16 I15
```

| Slice | Position | Groups |
|---|---:|---|
| I1 | 2 | M01, M02, M03 |
| I2 | 3 | **M04, M05, M06** (in that order) |
| I5 | 4 | **M07, M08, M09, M10, M11, M12, M13, M14** (in that order) |
| I7 | 5 | M18 |
| I3 | 6 | **none** — features only, schema landed at M04 |
| I4 | 7 | M15 |
| I6 | 8 | M16, M17, M23 |
| I13 | 9 | M24, M25 |
| I8 | 10 | M19 |
| I9 | 11 | M20 |
| I10 | 12 | M21, M22 |
| I11 | 13 | none — M05 extended |
| I12 | 14 | none — M02 extended |
| I14 | 15 | M26, M27 |
| I15 | 16 | none |

## 4. Mechanical DAG verification — the required negative check

**Required assertion: ZERO FK references to a table created later in the declared DAG.**

Every FK edge, checked against group number and applied slice position:

| FK | Group | Pos | Target table | Created in | Pos | Forward? |
|---|---|---:|---|---|---:|:--:|
| `memberships.workspace_id` | M01 | 2 | `workspaces` | M01 | 2 | no (intra) |
| every `*.workspace_id` | M02–M27 | ≥2 | `workspaces` | M01 | 2 | **no** |
| `outbox/worker/attempts/receipts` | M02 | 2 | `workspaces` | M01 | 2 | **no** |
| `business_identities.business_id` | M04 | 3 | `businesses` | M04 | 3 | no (intra) |
| `discovery_results.job_id` / `.business_id` | M04 | 3 | `discovery_jobs`,`businesses` | M04 | 3 | no (intra) |
| **`leads.business_id`** | **M06** | **3** | **`businesses`** | **M04** | **3** | **no** ✅ |
| **`leads.source_job_id`** | **M06** | **3** | **`discovery_jobs`** | **M04** | **3** | **no** ✅ |
| `leads.owner_membership_id` | M06 | 3 | `memberships` | M01 | 2 | **no** |
| `contacts.business_id` | M06 | 3 | `businesses` | M04 | 3 | **no** |
| `lead_contacts.lead_id`/`.contact_id` | M06 | 3 | `leads`,`contacts` | M06 | 3 | no (intra) |
| `lead_provenance.lead_id` | M06 | 3 | `leads` | M06 | 3 | no (intra) |
| `file_attachments.file_asset_id` | M05 | 3 | `file_assets` | M05 | 3 | no (intra) |
| **`customers.business_id`** | **M08** | **4** | **`businesses`** | **M04** | **3** | **no** ✅ |
| `customers.origin_lead_id` | M08 | 4 | `leads` | M06 | 3 | **no** |
| `customer_contacts.customer_id`/`.contact_id` | M09 | 4 | `customers`,`contacts` | M08,M06 | 4,3 | **no** |
| `contacts.customer_id` | M09 | 4 | `customers` | M08 | 4 | **no** (M09 > M08) |
| `import_batches.file_asset_id` | M13 | 4 | `file_assets` | M05 | 3 | **no** |
| `import_rows.batch_id` | M13 | 4 | `import_batches` | M13 | 4 | no (intra) |
| **`leads.origin_import_batch_id`** | **M14** | **4** | **`import_batches`** | **M13** | **4** | **no** ✅ (M14 > M13) |
| `intelligence_runs.business_id`/`lead_id` | M15 | 7 | `businesses`,`leads` | M04,M06 | 3,3 | **no** |
| `conversations.contact_id` | M16 | 8 | `contacts` | M06 | 3 | **no** |
| `deals.lead_id` / `.customer_id` | M18 | 5 | `leads`,`customers` | M06,M08 | 3,4 | **no** |
| `automation_*` subject refs | M19 | 10 | M06,M16,M18 | | 3,8,5 | **no** |
| `subscriptions.plan_version_id` | M20 | 11 | `plan_versions` | M03 | 2 | **no** |
| **`workspace_plan_assignments.workspace_id`** | **M03** | **2** | `workspaces` | M01 | 2 | **no** (M03 > M01 in I1) |
| **`workspace_plan_assignments.plan_version_id`** | **M03** | **2** | `plan_versions` | M03 | 2 | no (intra) |
| *(`workspace_plan_assignments` → `subscriptions`)* | — | — | **no such FK exists** — opaque `SUB-*` reference | — | — | **deliberate** |
| `revenue_events` / `attribution_touchpoints` | M21 | 12 | `workspaces`,`leads`,`customers` | M01,M06,M08 | 2,3,4 | **no** |
| *(`revenue` → `deals`)* | — | — | **no such FK exists** | — | — | **firewall** |
| `tax_invoices.*` | M22 | 12 | M20 | | 11 | **no** |
| `assignment_rules.membership_id` | M23 | 8 | `memberships` | M01 | 2 | **no** |
| `agent_sessions.conversation_id` | M24 | 9 | `conversations` | M16 | 8 | **no** |
| `kb_sources` → `file_attachments` | M25 | 9 | `file_attachments` | M05 | 3 | **no** |
| `tickets.customer_id` / `.conversation_id` | M26 | 15 | `customers`,`conversations` | M08,M16 | 4,8 | **no** |
| `merge_records.*` | M27 | 15 | `customers`,`party_identifiers` | M08,M11 | 4,4 | **no** |

**`FORWARD_FK_COUNT = 0`.** The three previously-broken edges are marked ✅.

Enforced by `T-MIG-1` (§6).

> **`B14-FIX.2` repair — closes `M-03`.** The previous statement reasoned over the **group index** (`M01`…`M27`) and used the self-contradictory phrase *"strictly less than or equal"*. Group index is **not** the execution order: `M18` is applied at position 15, **before** `M15`, `M16`, `M17`. A group-index test is therefore the wrong assertion even though both happen to pass today.
>
> **`T-MIG-1` is restated over the applied execution position.** For every FK dependency edge:
>
> ```
> position(dependency) < position(dependent)          -- applied order, NOT group number
> ```
>
> where `position` is the index of the group in the applied sequence of §3, and intra-group edges are ordered **inside** the group. `MIGRATION_DEPENDENCY_ORDER_VIOLATION_COUNT = 0` and `FORWARD_FK_COUNT = 0` are both computed on that sequence.

---
## M03 — Entitlements *(amended by `B14-FIX.3`)*

Frozen source: `B1_ENTITLEMENT_QUOTA_BOUNDARY.md`, `B8_PLAN_CATALOG.md`.

Creates `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas`, `usage_counters`, `usage_ledger` as frozen — plus **`workspace_plan_assignments`**:

```
workspace_plan_assignments
  workspace_id      FK -> workspaces.id           (M01, backward)
  plan_version_id   FK -> plan_versions.id        (M03, intra)
  subscription_ref  TEXT  null   -- opaque SUB-* public ID, NEVER an FK
  status            TEXT         -- the frozen B8 subscription status vocabulary, reused
  period_end        TIMESTAMPTZ null
  unique (workspace_id)          -- one effective assignment per workspace
```

| Rule | Statement |
|---|---|
| Writer | **`AssignWorkspacePlan` only** (an `entitlements` command), invoked by `billing` inside its own transaction (`B14_03` §6b) |
| Absent row | resolves to the frozen default **`PLAN-STARTER`** — fail-closed to the lowest tier, never to unlimited (`T-ENT-5`) |
| **Carries no commercial value** | no amount, currency, payment, invoice, refund or card fact (`T-ENT-6`) |
| Before I9 | the table exists and is empty; every workspace evaluates against the default. `billing` does not exist until `M20`, and nothing else writes here |
| Backfill | **none** — new table, no rows |
| Rollback | droppable while unused; after I9, reverting restores default-tier evaluation, which is fail-closed |

---
## M04 — Discovery schema foundation *(schema prerequisite)*

Frozen source: `B3_DATA_MODEL.md`, `B3_BUSINESS_IDENTITY_MODEL.md`, `B3_ACQUISITION_PROVENANCE.md`.

Creates `businesses`, `business_identities`, `discovery_jobs`, `discovery_queries`, `discovery_results` exactly as frozen B3 specifies. `businesses` + `business_identities` keep unique `(workspace_id, provider_external_id)`.

**Frozen absences preserved** (`B3_DOMAIN_OWNERSHIP.md`): no `businesses.lead_id`/`converted`/`converted_at` (`B3-INV-2`), no `businesses.score`/`tier`/`confidence`/`signals` (`B3-INV-16`), no `businesses.discovery_job_id`.

**Ownership is unchanged and is `discovery`'s.** At I2 no Discovery API, port, adapter, job runner or UI exists; only the schema and `UpsertBusiness` normalization. **No CRM module may write these tables** — `T-ARCH-2`.

---
## M07 — `CA-01` Lead origin *(non-additive)*

Frozen source: `B2_LEAD_AGGREGATE.md` §1, §4; CRM-INV-10. **Five constraints change. All five are required; addressing only three leaves the table unable to accept a manual Lead.**

| # | Current frozen state | Target | Migration operation |
|---:|---|---|---|
| 1 | CHECK `origin_type IN ('discovery')` | `IN ('discovery','manual','import','api','form')` | drop + recreate CHECK |
| 2 | `business_id` NOT NULL | nullable | `ALTER COLUMN … DROP NOT NULL` |
| 3 | `converted_at` NOT NULL | nullable | `ALTER COLUMN … DROP NOT NULL` |
| 4 | partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` | `… AND business_id IS NOT NULL` | drop + recreate partial index |
| 5 | `last_activity_at` seeded from `converted_at` | seeded from `converted_at` when discovery, else `created_at` | service-layer rule; **no schema change** |

**Conditional invariants added as CHECK constraints:**

```
origin_type = 'discovery' ⇒ business_id  IS NOT NULL
origin_type = 'discovery' ⇒ converted_at IS NOT NULL
archived_at IS NULL OR converted_at IS NULL OR archived_at >= converted_at
```

**New nullable column:** `origin_form_submission_id` (nullable, reserved — `GAP-009` deferred; authorised verbatim by the approved `CA-01`). **`origin_import_batch_id` is NOT created here** — it is `M14`, after `import_batches` exists.

**`origin_type` remains immutable after creation** (frozen). `whatsapp` is **not** an origin value.

**Backfill: none.** Every existing row has `origin_type='discovery'`, non-null `business_id` and non-null `converted_at`, so all satisfy the widened CHECKs and the narrowed index unchanged.

**`lead_provenance` is NOT touched** (`CA-14`). It keeps `business_public_id NOT NULL`, `business_name_snapshot NOT NULL`, `intelligence_status NOT NULL` and unique `lead_id`. **A non-Discovery Lead simply has no row.** Writing a synthetic row is prohibited and is a negative-control test.

**Rollback:** reversible until the first non-discovery Lead exists.

---
## M10 — `CA-15` Lead display identity *(non-additive · no schema change)*

Frozen source: `B2_LEAD360_READ_MODEL.md` §1 (`required: [lead, business]`); `B2_CRM_LIST_QUERY_MODEL.md` §§4, 5, 7; `B2_CONTACT_MODEL.md` §3.

**`M07` makes a Business-less Lead insertable. `M10` makes it usable.** Without it, frozen B2 forbids every identifying attribute on `leads` (normative "Explicitly absent" list, CRM-INV-3) while requiring `business` in Lead 360 — so the row exists and cannot be rendered, sorted or searched.

**No table, column or index changes.** The relationship already exists in frozen B2: `lead_contacts.is_primary boolean NOT NULL default false` under **partial unique `(lead_id) WHERE is_primary AND unlinked_at IS NULL`** — already *at most one* primary per Lead. `CA-15` adds the *at least one* half for Business-less Leads:

```
leads.business_id IS NULL
   ⇒ exactly one active primary lead_contacts link
     (is_primary = true AND unlinked_at IS NULL)
```

**Enforced as a command guard plus a nightly integrity assertion**, not a DB constraint — PostgreSQL cannot declaratively express a conditional cross-table cardinality. This is the identical technique frozen B2 uses for CRM-INV-16 and B14 uses for CUS-3.

**No PII column is added to `leads`.** `name`, `company_name`, `city`, `category`, `phone`, `email`, `website` remain absent, and their absence is a negative control (`T-CA15-3`).

**Registers the derived display projection** (read-time, never stored, never authoritative):

| Field | `business_id IS NOT NULL` | `business_id IS NULL` |
|---|---|---|
| `display_name` | `business.name` | primary `contact.name` |
| `display_subtitle` | `business.category` + `business.city` | **`null`** — a Contact owns neither |
| `display_source` | `"business"` | `"contact"` |

**Backfill: none** — every existing Lead has a Business. **Rollback:** reversible until the first Business-less Lead exists (the same window as `CA-01`, to which it is bound).

---
## M14 — `CA-01` part 2: Lead import origin FK

Adds `leads.origin_import_batch_id` (FK → `import_batches`, **nullable**).

**Split from `M07` by `B14-FIX.1` to close `V-M03`.** `import_batches` is created in `M13`; declaring the FK in `M07` referenced a table five groups later. Both groups are in I5, so no slice boundary is crossed — but the *group* order now matches the FK direction. **Additive, nullable, no backfill.**

---
## M08 — `customers`

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid v7 | no | PK |
| `public_id` | text | no | `CUS-*`, unique, immutable (`CA-03`) |
| `workspace_id` | uuid FK → `workspaces` | no | tenant column |
| **`party_kind`** | text | no | `organization` \| `person` — **immutable** (CUS-1) |
| `name` | text | no | 1–160 trimmed |
| `business_id` | uuid FK → `businesses` | yes | organization only (CUS-4) |
| `origin_lead_id` | uuid FK → `leads` | yes | set only by `ConvertLeadToCustomer` |
| `origin_kind` | text | no | `manual\|import\|api\|form\|lead_conversion\|discovery` — aligned to B9's set |
| `status` | text | no | `active` \| `inactive` |
| `owner_membership_id` | uuid FK → `memberships` | no | workspace-equality guard |
| `archived_at`, `version`, `created_at`, `updated_at`, `created_by_membership_id` | | | B0 conventions |

**Absent by design (each would be a second authority):** `phone`, `email` (Contact owns — CUS-5) · `revenue`, `lifetime_value`, `balance` (B9) · `plan`, `subscription_status` (B8) · `score`, `tier` (B4) · `stage`, `deal_value` (B6) · `last_message_at` (B5) · `tax_number` (`B9-D-C004`).

**Constraints:** unique `public_id` · CHECK `party_kind IN ('organization','person')` · CHECK `party_kind='person' ⇒ business_id IS NULL` · CHECK `status IN ('active','inactive')` · CHECK `version >= 1`.
**Indexes:** `(workspace_id, status)`, `(workspace_id, party_kind)`, `(workspace_id, owner_membership_id)`, `(workspace_id, name)`, `(workspace_id, updated_at DESC, public_id)`. **No unique index on `name`.**

## M09 — `customer_contacts` + `CA-05`

**Table ownership (`V-M02`, resolved): `customer_contacts` is owned by `customers`.** `M09` is a **two-module group** — it adds `contacts.customer_id` (owned by `crm`) and creates `customer_contacts` (owned by `customers`). The group spans both because the two changes are one logical unit; **ownership of each table is unambiguous and matches `B14_03` §4 and `B14_26`.**

`customer_contacts` mirrors frozen `lead_contacts`: `workspace_id`, `customer_id`, `contact_id`, `is_primary`, `linked_at`, `unlinked_at`, `linked_by_membership_id`.
Unique `(customer_id, contact_id) WHERE unlinked_at IS NULL`; **partial unique `(customer_id) WHERE is_primary AND unlinked_at IS NULL`**; index `(workspace_id, contact_id)`.

`contacts` gains nullable `customer_id` FK; `contacts.source` CHECK widens to `('discovery_business','manual','manual_customer','import')`.

**CUS-3 (`party_kind='person'` ⇒ exactly one active, primary Contact) is a command guard, not a DB constraint** — PostgreSQL cannot express it declaratively across tables. Enforced in `services/` plus a nightly integrity assertion, exactly as B2 handles CRM-INV-16.

## M11 — `party_identifiers` · `merge_records` (M27)

`party_identifiers`: `workspace_id`, `identifier_kind` (`phone|whatsapp_id|email|external_crm_id`), `identifier_normalized`, `party_type` (`contact|lead|customer|business`), `party_id`, `confidence` (`provider_asserted|human_entered|imported|inferred`), `first_seen_at`, `last_seen_at`.
Index `(workspace_id, identifier_kind, identifier_normalized)` — **non-unique**, per CRM-INV-18. **`workspace_id` is part of every lookup key; a cross-workspace query is not expressible.**

## M12–M13 — Custom fields · Imports

`field_definitions`: `workspace_id`, `subject_type` (`lead|contact|customer|deal|ticket`), `key` (immutable), `label`, `field_type` (`text|number|date|boolean|single_select|multi_select`), `required`, `options`, `position`, `active`, `archived_at`, `version`. Unique `(workspace_id, subject_type, key)`.
`custom_field_values`: `workspace_id`, `definition_id`, `subject_type`, `subject_id`, and **one typed column per type** (`value_text`, `value_number NUMERIC(19,4)`, `value_date`, `value_boolean`, `value_option_id`). Unique `(subject_type, subject_id, definition_id)`. **Not JSONB** (`PD-005`).

`import_batches`: `workspace_id`, `file_asset_id` (B11), `target_kind`, `mapping` (JSONB — *structured flexible metadata*, permitted), `status` (`uploaded|mapped|dry_run_complete|committing|completed|failed|cancelled`), counts (`succeeded`, `failed`, **`unknown`**), `version`.
`import_rows`: `batch_id`, `row_number`, `raw` (JSONB), `outcome` (`pending|succeeded|failed|unknown`), `error_code`, `created_public_id`. **Unique `(batch_id, row_number)`** — the per-row idempotency identity.

## M17 — `CA-02` handling mode

`conversations` gains `handling_mode` text NOT NULL DEFAULT `'human'`, CHECK `IN ('ai_assisted','human','ai_paused')`. **The frozen `status` `enum(2)` (`open|closed`) is NOT widened**; the state machine's fan-out is unchanged. Default `'human'` reproduces today's behaviour for every row. Index `(workspace_id, handling_mode) WHERE status='open'`.

## M24–M26 — AI agent · Knowledge · Support · Assignment

`agent_sessions`, `agent_proposals` (`proposal_kind`, `payload` JSONB, `status`, `accepted_by_membership_id`, `resulting_command`) — **no provider fields**: no model name, no token counts, no `finish_reason`, no provider error code.
`kb_articles` (`KBA-*`, `draft|published|archived`), `kb_article_versions` (append-only), `kb_sources` → B11 `file_attachments`.
`tickets` (`TKT-*`), `ticket_activities`, `sla_policies`, `ticket_sla_clocks`.
`assignment_rules`, `assignment_counters` (**M23, I6**) — **counter is a PostgreSQL row under `SELECT … FOR UPDATE`, never Redis** (CRM-INV-11).

## 5. Frozen fixture → schema mapping

| Frontend fixture | Backend outcome |
|---|---|
| `CMP-*` Company | **Not modelled** (`B2-D-A004`); formally rejected in the registry (`CA-03`) |
| `mock_connected` integration status | **Not a backend state** — fixture artifact |
| `disabled` integration status | **Not a status** — the orthogonal `enabled=false` boolean |
| `active_mock` / `paid_mock` billing | Real B8 states replace them at I9 |
| Lead `status:"active"` on contacts | Replaced by `archived_at` (frozen B2 decision) |

## 6. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-MIG-1` **(NC)** | The **applied execution sequence** of §3 | Walk every FK dependency edge and compare **applied positions**, never group numbers | **`FORWARD_FK_COUNT = 0`** and **`MIGRATION_DEPENDENCY_ORDER_VIOLATION_COUNT = 0`** — for every edge, `position(dependency) < position(dependent)`; intra-group edges ordered inside the group. A test written over group index **fails this test** (`M-03`) |
| `T-MIG-2` | Empty DB | Apply all groups in order | Every group applies; no group requires a table that does not yet exist |
| `T-MIG-3` | **Populated, production-shaped DB** | Apply forward | **No row loss**; every pre-existing Discovery Lead satisfies every constraint (`T-CA01-6`) |
| `T-MIG-4` **(NC)** | Any group | Inspect operations | **No destructive operation**; the only relaxations are `M07`'s five, approved as `CA-01` |
| `T-MIG-5` **(NC)** | After M04 at I2 | Inspect the `crm` module | **No CRM code writes `businesses`, `business_identities` or `discovery_jobs`** |
| `T-MIG-6` **(NC)** | After M04 at I2 | Attempt a Discovery job / adapter call | **Unavailable** — schema exists, feature does not |
| `T-SCHEMA-1` | All groups | Enumerate tables | Every table belongs to **exactly one** owning module (`CA-07`) |
