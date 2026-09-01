# B6 — B2 (CRM) Handoff Contract

> **B6 status:** Target design only. Mirrors `B5_B2_CRM_LEAD360_HANDOFF.md`'s pattern one phase forward. States what B6 requires from frozen B2 and what B6 promises B2 in return — no B2 file is touched.

## 1. What B6 requires from B2 (read-only)

| Read | Contract | Source |
|---|---|---|
| `GET`/internal resolve of a `Lead` by `LEAD-*`, workspace-scoped | `id`, `workspace_id`, `business_id`, `status`, `archived_at`, `owner_membership_id` | `B2_LEAD_AGGREGATE.md` §1 |
| Lead-archived check at `CreateDeal` time only | `422 lead_archived` if archived | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §2 |
| Lead-owner default at `CreateDeal` time only | one-time read, not a live subscription | `B6_OWNERSHIP_ASSIGNMENT.md` §2 |

B6 never reads `lead_contacts`, `crm_activities`, `tasks`, or `appointments` directly — Contact/Task/Appointment linkage, if ever surfaced beside a Deal, is read by B2's own `GET /leads/{id}/360` composition, not duplicated into a B6 query (`B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5).

## 2. What B6 promises B2

| Promise | Satisfies |
|---|---|
| A stable `source_event_id` on every event (`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened`, `DealAssigned`, `DealUpdated`) | `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1's source-domain contract, verbatim |
| `entry_id = pipeline:<source_event_id>` resolvable at read time | §2.2, shape B |
| `occurred_at` = the event's own business-event instant, never CRM's ingestion time | §2.4's Pipeline row, already frozen |
| `deal.view` as the read-gate for Pipeline-sourced timeline entries | §7.2 step 2, already frozen — B6 introduces no second gate |
| `deals[]` on the Lead360 aggregate DTO | `BACKEND_DTO_CONTRACTS.md`'s already-frozen field, populated by B6's own read model (`B6_READ_MODELS_QUERY.md` §4) |
| `DealCreated`/`DealStageChanged`/`DealWon`/`DealLost` (unchanged) plus, pending the additive amendment, `DealReopened` qualify `Lead.last_activity_at` | `B2_LEAD_AGGREGATE.md` §4, `B6_CRM_TIMELINE_PROJECTION.md` §3 |
| Never writes `leads`, `contacts`, `lead_contacts`, `tasks`, `appointments`, `crm_activities` | `B6_DOMAIN_OWNERSHIP.md` §6 |
| Never mutates `Lead.status` as a side effect of any Deal command | `B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §3 |

## 3. Symmetry check against B2's own frozen text

Every claim in §2 either quotes `B2_LEAD_AGGREGATE.md`/`B2_TIMELINE_IDENTITY_MODEL.md` verbatim or is checked against it directly (§`B6_CRM_TIMELINE_PROJECTION.md` §1, §3). No claim here asserts something about B2's frozen behavior that B2's own text does not already state — this document supplies only the B6-side half of a contract B2 already wrote its half of.

## 4. Consumed events

**Zero.** B6 does not subscribe to any B2 event (`LeadCreated`, `LeadUpdated`, `LeadArchived`, etc.) — every B2 fact B6 needs (§1) is a synchronous, on-demand read at the moment a Deal command needs it, never a maintained subscription/cache (`B6_COMMAND_EVENT_CATALOG.md` §4).

## 5. What happens on the B2 side when a Deal exists

Nothing changes about how B2 itself behaves. `ArchiveLead` still has zero preconditions related to Deal state (`B2_LEAD_AGGREGATE.md` §7, unchanged); B6 adds no B2-side guard. The only new B2-visible surface is the read contract in §2, which B2's own `B2_TIMELINE_IDENTITY_MODEL.md` and `BACKEND_DTO_CONTRACTS.md` already anticipated before B6 was designed.
