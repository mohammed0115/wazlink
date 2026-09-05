# 23 — Migration and Compatibility

> Resolves brief §34. **Additive migrations only. No destructive migration is proposed anywhere in this plan.**

## 1. Existing data remains valid

| Existing entity | Effect | Migration |
|---|---|---|
| `Business` | **None.** Track A unchanged; `businesses` gains no column | none |
| `Lead` | `business_id`, **`converted_at`** become nullable; `origin_type` widens; CRM-INV-10 index scoped to rows having a `business_id`; `last_activity_at` seeding rule extended. **Every existing row already satisfies all five** (`origin_type='discovery'`, non-null `business_id`, non-null `converted_at`) | constraint relaxation only; **no row rewritten, no backfill, no provenance removed** |
| `lead_provenance` | **Unchanged.** Remains the Discovery→Lead conversion snapshot; non-Discovery Leads simply have **no row** (`CA-14`). **No fake `business_public_id`, `business_name_snapshot` or `intelligence_status` is ever written** | none |
| `Contact` | Gains nullable `customer_id`; `source` enum widens | additive column; existing values valid |
| `lead_contacts` | **Unchanged.** `customer_contacts` is a new parallel table, not a replacement | none |
| `Conversation` | Gains `handling_mode` defaulting to `human` — i.e. exactly today's behavior | additive column with default |
| `Message` | **None** | none |
| `Deal` | **None.** The Quote FK lives on `quotes`, not on `deals` | none |
| `Task` / `Appointment` | **None.** Calendar is a read model | none |
| `RevenueEvent` | **None.** Immutable and untouched | none |
| `AttributionTouchpoint` | **None.** Snapshots immutable; historical attribution preserved exactly (`AT-TRACK-5` NC) | none |
| `file_assets` | **None.** Only the `file_attachments.subject_type` enum widens | additive enum value |
| Automation rules/runs | **None.** Existing triggers/actions unchanged; new ones additive | none |
| `webhook_receipts`, `outbox_events`, `worker_executions` | **None** | none |
| Billing/plans/subscriptions | **None** except new capability keys, which default to absent | additive rows |

## 2. Leads and Customers coexisting — the explicit answer

Brief §34 requires this be addressed directly.

**Existing Leads are not migrated into Customers. Nothing is converted automatically.**

1. Every existing Lead stays a Lead, with its Business, provenance and status intact.
2. `Customer` is a **new, parallel** record type. A workspace may operate with only Leads (Track A), only Customers (Track B), or both.
3. Conversion is **explicit, human-initiated and one-way** (`ConvertLeadToCustomer`), and it **retains the Lead** — lineage lives in `customers.origin_lead_id`.
4. No sweep, backfill or migration ever creates a Customer from a Lead.
5. Deals, Conversations, Tasks and Appointments attach to **either** a Lead or a Customer; existing attachments are untouched.

**Why not auto-convert every qualified Lead:** it would fabricate commercial relationships nobody asserted, double the apparent record count, and break `(workspace_id, business_id)` uniqueness expectations. The same reasoning `B2-D-C001` applies to fabricating a Business applies here in reverse.

## 2b. `party_kind` and existing data

`customers` is a **new** table, so `party_kind` introduces no migration against existing data at all. Within the new table it is `NOT NULL` and defaulted to `organization` for any import path that does not map it, which matches WazLink's B2B-first reality; `person` is opt-in per record. **`party_kind` is immutable after creation (CUS-1)** — a company never becomes a person, so no state transition or backfill can ever be required.

No `Account`, `PersonAccount`, `ConsumerAccount` or `OrganizationCustomer` table is created, so there is no second commercial model to migrate between.

## 3. Rollout order and reversibility

Migrations follow the release order in `20_RELEASE_PLAN.md`. Each is independently deployable and, because all are additive, each is **reversible while no dependent data exists**:

- `CA-01`'s constraint relaxation (all five constraints) is reversible until the first non-discovery Lead is created.
- `CA-02`'s column is reversible until the first non-`human` mode is set.
- New tables are droppable until first use.
- **`CA-04` merge lineage is the exception**: once a merge is executed, the losing party is archived and references resolve through lineage. Un-merge is not designed (`PD-006`). This is why merge is gated behind an explicit human command with a mandatory reason.

## 4. Rolling-deploy compatibility

B12's frozen `B12-D-A049` rolling-deploy rule applies unchanged: new columns are nullable or defaulted so old and new code coexist; new event types are ignored by consumers that do not know them; no in-flight async work is dropped or duplicated across a deploy. **No migration in this plan requires downtime, a maintenance window, or a stop-the-world backfill.**

## 5. Compatibility with the frozen frontend

The frozen frontend (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`) continues to function throughout: every route it serves today keeps serving; `#/contacts`, `#/companies` and `#/calls` render `Placeholder` until G0 replaces the first and `PD-012` resolves the other two. **No frozen frontend file is modified by this plan** — frontend work belongs to the approved releases, not to this planning pass.
