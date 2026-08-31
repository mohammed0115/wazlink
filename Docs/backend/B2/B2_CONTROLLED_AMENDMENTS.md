# B2 — Controlled Amendment Register

> **B2 edits no frozen B0 or B1 artifact.** Every change B2 requires to a frozen file is recorded here, with the current frozen behavior stated verbatim and the target stated as a target. **No hidden contract drift.**

B1 demonstrated why this register is necessary: an earlier B1 revision described a target response as though the frozen contract already carried it, and an independent audit classified that as a Major finding. B2 therefore states, for every item, *what B0/B1 says now*, *what B2 targets*, and *that B2 has not made the change*.

## 1. The bundle — 11 items across 5 frozen artifacts

| # | ID | Frozen artifact | Current frozen behavior | B2 target | Timing |
|---|---|---|---|---|---|
| 1 | `B2-D-B001` | `BACKEND_PUBLIC_ID_REGISTRY.md` | `NOTE-` is a **section B** frontend fixture: *"Phase-1 B0 models no standalone Note table or aggregate … A future Note resource requires an ADR, data-model change, and a newly approved prefix"* | register `NOTE-` in **section A**: `NOTE- \| Note \| CRM \| Note \| Workspace-scoped` | before implementation |
| 2 | `B2-D-B002` | `BACKEND_DATA_MODEL.md` | CRM row reads `leads, contacts, lead_contacts, tasks, appointments` with `workspace/public_id; business/workspace conversion unique; lead/status/owner indexes` | add `notes, lead_tags, lead_provenance, lead_provenance_additional_jobs, crm_activities`; make the conversion constraint precise as **partial unique `(workspace_id, business_id) WHERE archived_at IS NULL`**; add the primary-contact partial unique and the `(lead_id, due_at) WHERE status='pending'` index | before implementation |
| 3 | `B2-D-B003` | `BACKEND_OPENAPI_V1.yaml` + `BACKEND_API_CATALOG.md` | `/leads/{id}` (PATCH) and `/leads/{id}/360` (GET) only. Catalog: *"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`."* | add the **25 additive operations** in `B2_API_DTO_CONTRACTS.md` §2 with their DTOs, and extend the filtering/sorting marker to `GET /leads` and `GET /tasks` with the **named allow-lists** (not an expression grammar) | before implementation |
| 4 | `B2-D-B004` | B1 `B1_AUTHORIZATION_RBAC.md` §2–§3 | 50 permission codes; `lead.*` is `view/create/update/assign` | add **`lead.archive`** (51st code) and one matrix row `owner A · admin A · manager A · sales · · member · · viewer ·`. **No existing cell changes** | before implementation |
| 5 | `B2-D-B005` | `BACKEND_OPENAPI_V1.yaml` `convertBusinessToLead` | `201` described as *"Lead created or existing Lead returned"*, with only an `X-Request-ID` response header | add response header `X-Lead-Conversion-Outcome: created \| existing`. **Body, status set, and schema unchanged** | before implementation |
| 6 | `B2-D-B006` | `BACKEND_DATA_MODEL.md` / `BACKEND_DOMAIN_OWNERSHIP.md` | Intelligence is `lead_intelligence_analyses`, unique on `lead/input_fingerprint`; the frozen frontend keys analyses on **`businessId`** | **not a CRM decision.** Recorded so the Intelligence domain design resolves it. `Lead360.intelligence` is a frozen opaque object, so the CRM contract holds under either keying | Intelligence domain design |
| 7 | `B2-D-B007` | `BACKEND_OPENAPI_V1.yaml` `DashboardOverview` | a read-only dashboard aggregate with no stated CRM counters | supply `total, new, contacted, qualified, high_priority, tasks_due_today` as projection inputs. **No new endpoint** | before implementation |
| 8 | `B2-D-B008` | `BACKEND_OPENAPI_V1.yaml` `Lead360` | properties `lead, business, contacts, intelligence, conversations, tasks, appointments, deals, activities, revenue_refs`; `required: [lead, business]` | add `notes: {type: array, items: {$ref: EntityRef}}`. **Purely additive**; no existing property or required entry changes | before implementation |
| 9 | `B2-D-B009` | `BACKEND_OPENAPI_V1.yaml` | no timeline route | add `GET /leads/{id}/timeline` → `TimelineList` (part of the 25 in item 3, listed separately because it introduces the `TimelineEntry` schema). **B2-FIX.1 revised the `TimelineEntry` shape** — see §6 | before implementation |
| 10 | `B2-D-B010` | `BACKEND_COMMAND_EVENT_CATALOG.md` | the event list contains `LeadUpdated` | record `LeadUpdated` as **superseded** by `LeadStatusChanged`, `LeadPriorityChanged`, and `LeadOwnerChanged`, so a consumer can react to an owner change without parsing a diff | before implementation |
| 11 | `B2-D-B011` | B1 `B1_API_DTO_CONTRACTS.md` §4.3 | *"`409 CONFLICT` always carries a `details.reason` from this closed set: `invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`."* | extend the closed set with the **8** CRM reasons in `B2_ERROR_CONTRACT.md` §2. **No new error code is minted** | before implementation |

## 2. What B2 does **not** amend

Stated explicitly, because the absence of a change is as load-bearing as its presence:

- **The frozen `Lead` schema.** Not one field, type, or required entry changes. The CRM list and detail views are served by the new `LeadListItem` and `LeadDetail` DTOs instead — the same technique B1 used to avoid touching the frozen `Workspace` projection.
- **`LeadUpdate`, `ConvertBusinessRequest`, `Business`, `EntityRef`, `PageInfo`, `ErrorEnvelope`.** Unchanged.
- **`PATCH /leads/{id}` and `POST /businesses/{id}/convert-to-lead`.** Paths, methods, request DTOs, response bodies, and status sets are unchanged; only a response header is added to the latter.
- **The B0 error catalog.** `ERROR_NEW_COUNT = 0`. No CRM code is minted.
- **B1's authorization pipeline.** No step is added, removed, or reordered.
- **B1's 50 existing permission codes and every existing matrix cell.**
- **The six roles, the five lead statuses, the three priorities, the four appointment statuses/types/locations, the six capabilities, and the five usage metrics.**
- **Any Discovery, Intelligence, Messaging, Pipeline, Revenue, Attribution, Automation, Billing, or Tax contract.**

## 3. Amendment properties

Every item above satisfies all four:

1. **The decision is already made.** No item leaves an implementation agent a choice; §1 states the exact target text or shape.
2. **It is additive.** No frozen field, type, status code, required set, permission grant, or error code is removed or altered. Item 2 makes an existing constraint *precise* rather than changing its intent; items 4 and 11 add to sets without modifying members.
3. **It is traceable.** Each maps to a Class B decision, to the frontend behavior that requires it, and to acceptance tests.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied.

## 4. Blocking rules until the bundle is applied

- No implementation may mint `NOTE-*`.
- No implementation may enforce or grant `lead.archive`.
- No implementation may ship any of the 25 additive operations.
- No implementation may rely on `Lead360.notes` or on `X-Lead-Conversion-Outcome`.
- No implementation may emit a `409 CONFLICT` carrying a CRM `details.reason`.

Because B0's registry scopes prefix registration and API amendment to *"before implementation"* rather than before design, none of these blocks B2 **design** closure: `PUBLIC_ID_REGISTRY_BLOCKS_B2 = NO`, `API_AMENDMENT_BLOCKS_B2 = NO`.

## 5. Relationship to B1's outstanding bundle

B1's own amendment bundle (`B1-D-001`, `B1-D-002`, `B1-D-003`, `B1-D-019`, `B1-D-021`) is **still outstanding** at the B1 checkpoint. B2 depends on one of its items: **`B1-D-002` registers `MEM-`**, and every CRM `owner_ref`, `assignee_ref`, and `organizer_ref` is a `MEM-*`.

**B2's bundle must therefore be applied after, or together with, B1's.** This dependency is recorded rather than assumed, so the two bundles are not approved out of order. B2 introduces no dependency on `WINV-`, on the invitation response amendment, or on `Session.workspace_ref` nullability.

## 6. What B2-FIX.1 and B2-FIX.2 changed in this register

B2-FIX.1 repaired three architectural defects in B2's own design, and B2-FIX.2 repaired the cross-domain timeline contract. Neither **added any new frozen-artifact amendment**, so the bundle remains **11 items across 5 frozen artifacts** and every blocking rule in §4 stands unchanged. Two existing items had their *target shape* revised, one B3 alignment obligation is recorded (§6.3), and one instance of accidental drift was reverted rather than registered (§7).

### 6.1 Item 9 — the `TimelineEntry` target shape is now precise

The target schema for `TimelineEntry` was under-specified when item 9 was written. Its revised target, from `B2_TIMELINE_IDENTITY_MODEL.md` §2.2–§2.3 and carried verbatim into `B2_API_DTO_CONTRACTS.md` §3 by B2-FIX.2:

| Property | Target |
|---|---|
| `entry_id` | immutable text, globally unique across domains; `ACT-*` for CRM-owned entries, `<source_domain>:<source_event_id>` for cross-domain projections. **Never** a source aggregate's public ID |
| `source_domain`, `source_event_type`, `source_resource_ref` | separated from `entry_id`; `source_resource_ref` may repeat across entries. `source_event_type` is the canonical name — B2-FIX.2 removed the `kind` and `source_type` aliases the DTO draft had used for the same value, and added no source-class field, because `source_domain` already carries the class |
| `source_event_id` | required for cross-domain entries, null for CRM-owned |
| `occurred_at` | the immutable business event instant, never `task.due_at` or `appointment.start_at` |
| ordering / cursor | `(occurred_at DESC, entry_id DESC)`; the cursor is an opaque encoding of that pair |

**Still purely additive.** `TimelineEntry` and `TimelineList` are new schemas on a new route; no frozen property, type, or required set is touched. **No new public-ID prefix is introduced** — in particular B2 does not mint `TLE-*`, and `NOTE-` remains the only prefix B2 proposes.

### 6.2 Item 2 — `lead_provenance_additional_jobs` now has a named writer

Item 2 already lists `lead_provenance_additional_jobs` among the tables to add to `BACKEND_DATA_MODEL.md`; that target is unchanged. What B2-FIX.1 adds is the missing writer — `RecordLeadRediscoveryProvenance` (`B2-D-A024`) — plus the unique constraint `(lead_id, discovery_job_public_id)` the process depends on, which item 2's constraint list must carry.

### 6.3 The one obligation carried into B3

> **B2 defines the consumer semantic contract. B3 must align the producer event and schema.**

CRM requires a Discovery signal meaning *"a Business already the subject of a live Lead in this workspace was observed by another Discovery Job"*, carrying `workspace_id`, `business_public_id`, `discovery_job_public_id`, and `discovered_at`, delivered at-least-once. B2 refers to it as `BusinessRediscoveredSignal` — **a CRM-side alias for the semantics, not a claim about the producer's event name**.

**This is not an open B2 decision, and it is not a frozen-artifact amendment.** It is admissible precisely because CRM's own behavior is already deterministic without it: the guards, their order, the idempotency mechanism, the concurrency argument, the transaction boundary, and every side effect are fully specified in `B2_REDISCOVERY_PROVENANCE_PROCESS.md`, and none of them changes when B3 chooses a name. Until B3 publishes, the table is created and read normally and simply has no inbound producer.

**Symmetrically for the timeline:** B2 requires every cross-domain source domain to expose, on the records CRM reads, a stable immutable `source_event_id` (`B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1). This is a semantic contract on a **source read model**, not an amendment to B0's event envelope: because the timeline is a read-time merge, CRM reads records rather than in-flight events, so the obligation is that the identity be *readable*, which the envelope alone does not provide. It constrains no storage schema and no column name. A domain that cannot honor it is excluded from the timeline; CRM never synthesizes an identity on its behalf.

## 7. B2-FIX.2 — one instance of drift reverted, not registered

An earlier B2 draft restated B0's event envelope with two additions — `aggregate version` inserted, and `correlation/request ID` replaced by `correlation/causation ID` — and described the result as B0 *"restated verbatim"*. It was not.

| | Envelope |
|---|---|
| **Frozen B0** (`BACKEND_COMMAND_EVENT_CATALOG.md`) | event ID · workspace · aggregate public ID · occurred timestamp · actor/system source · schema version · **correlation/request ID** |
| **The B2 draft** | …the same, **plus `aggregate version`**, and with **`causation ID`** in place of request ID |

`BACKEND_COMMAND_EVENT_CATALOG.md` is a frozen artifact — item 10 above amends it — so widening its envelope required a registered amendment and had none. That is exactly the hidden-drift failure this register exists to prevent — see the opening rule of this document: *"Every change B2 requires to a frozen file is recorded here… **No hidden contract drift**."*

**The resolution is reversion, not a 12th item.** A controlled amendment is for a change B2 *needs*; this one was accidental, and no B2 contract depends on either addition:

- **`aggregate version`** — timeline identity rests on `source_event_id` read from a source record (§6.3), never on an aggregate version. `B2_TIMELINE_IDENTITY_MODEL.md` §4.2 explicitly rejects version-derived identity as neither replay-stable nor deterministic. Nothing else in B2 reads it.
- **`causation ID`** — B0 defines no causation field, so a `crm_activities.causation_id` column had no authoritative producer to populate it from. B2-FIX.2 restored the column pair to `correlation_id` / `request_id`, both of which B0 does define, rather than silently renaming request to causation. Should a later frozen contract define causation, adding it is additive and no B2 correctness depends on it.

**`EVENT_ENVELOPE_DRIFT_FROM_B0 = 0`.** `B2_COMMAND_EVENT_CATALOG.md` now quotes B0's sentence unchanged, and `BUNDLE_ITEM_COUNT` remains **11**.
