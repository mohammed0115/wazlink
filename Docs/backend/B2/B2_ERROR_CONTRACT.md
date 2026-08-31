# B2 — CRM Error Contract

> **B2 status:** Contract only. **B2 mints zero new error codes.** Every CRM outcome is expressible with an existing B0 or B1 code plus a `details.reason` from a closed vocabulary.

## 1. Reused codes (16)

Twelve from `BACKEND_ERROR_CATALOG.md` and four from B1's new set. All sixteen are verified present in their source catalogs.

| Code | HTTP | Source | CRM use |
|---|---|---|---|
| `AUTH_REQUIRED` | 401 | B0 | no session, expired session |
| `SESSION_REVOKED` | 401 | B0 | session registry row revoked |
| `PERMISSION_DENIED` | 403 | B0 | RBAC deny, including a failed `conditional` and the `RemoveNote` author-or-manager condition |
| `ENTITLEMENT_LOCKED` | 403 | B0 | plan lacks `crm.core` |
| `QUOTA_EXHAUSTED` | 403 | B0 | `leads` metric exhausted at conversion |
| `WORKSPACE_NOT_FOUND` | 404 | B0 | active workspace unresolvable (including a no-workspace session) |
| `ENTITY_NOT_FOUND` | 404 | B0 | Lead/Contact/Task/Appointment/Note/Business/Job/Membership/Deal not visible in the active workspace |
| `VALIDATION_ERROR` | 400/422 | B0 | malformed body, unknown field, unknown query parameter, unknown enum value, no-op transition, `end_at <= start_at`, blank note body, invalid cursor |
| `CONFLICT` | 409 | B0 | every domain-invariant guard, carrying a `details.reason` (§2) |
| `IDEMPOTENCY_CONFLICT` | 409 | B0 | same `Idempotency-Key`, different body |
| `STALE_VERSION` | 409 | B0 | `If-Match`/`version` mismatch on any CRM aggregate |
| `INTERNAL_ERROR` | 500 | B0 | universal |
| `MEMBERSHIP_INACTIVE` | 403 | B1 | the **caller's** Membership is `suspended` |
| `WORKSPACE_INACTIVE` | 403 | B1 | workspace is `suspended`/`archived`/`deleting` and the operation is unsafe |
| `EMAIL_VERIFICATION_REQUIRED` | 403 | B1 | unverified caller on any CRM route |
| `RATE_LIMITED` | 429 | B1 | WazLink-side rate limit |

**`ERROR_REUSED_COUNT = 16` · `ERROR_NEW_COUNT = 0` · `ERROR_COLLISIONS = 0` · `ERROR_SEMANTIC_DUPLICATES = 0`.**

## 2. The `409 CONFLICT` reason vocabulary

B1 established `409 CONFLICT` + a closed `details.reason` set as the mechanism for rare domain guards, explicitly rejecting near-duplicate codes (`LAST_WORKSPACE_REQUIRED`, `LAST_ACTIVE_MEMBERSHIP_REQUIRED`). B2 extends that closed set rather than minting codes.

**B1's existing reasons:** `invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`.

**B2's additions (8):**

| `details.reason` | Raised when | Client remedy |
|---|---|---|
| `lead_archived` | any CRM mutation targets an archived Lead, or one of its Tasks/Notes/Contacts/Appointments | nothing — the Lead is closed history |
| `invalid_lead_transition` | `ChangeLeadStatus`/`ChangeLeadPriority` where `to == from` reaches step 15 | re-read; the value is already set |
| `owner_membership_inactive` | `AssignLeadOwner` targets a Membership that is not `active` in this workspace | pick an active member |
| `assignee_membership_inactive` | `CreateTask`/`AssignTask`/`ScheduleAppointment` targets an inactive Membership | pick an active member |
| `task_already_terminal` | a Task command targets a `completed` or `cancelled` Task | create a new Task |
| `appointment_already_terminal` | an Appointment command targets a terminal Appointment | schedule a new Appointment |
| `business_not_convertible` | the Business is archived, merged away, or in `not_analyzed`/`analysis_error` | analyse it, or convert the surviving Business |
| `primary_contact_exists` | `AddContact` explicitly demands `is_primary` while a primary link exists | add as non-primary, or change the primary first |

Extending B1's closed vocabulary is a **controlled amendment** (`B2-D-B011`) — the set is closed by contract, so adding to it is a contract change and is registered as one. **A `409 CONFLICT` without a `reason` is invalid.**

## 3. Codes explicitly rejected as duplicates (9)

| Proposed | Rejected because |
|---|---|
| `LEAD_NOT_FOUND` | identical to `ENTITY_NOT_FOUND`; a per-type not-found code would also let a caller learn *which* type a public ID belongs to |
| `DUPLICATE_LEAD` | **there is no duplicate error.** Converting an already-converted Business returns `201` with the existing Lead (`B2_LEAD_PROVENANCE_DUPLICATION.md` §5) |
| `INVALID_STATUS_TRANSITION` | expressed as `409 CONFLICT` + `reason="invalid_lead_transition"`, following B1's rejection of `LAST_WORKSPACE_REQUIRED` |
| `LEAD_ARCHIVED` | as above, `reason="lead_archived"` |
| `OWNER_INACTIVE` | as above, `reason="owner_membership_inactive"` |
| `TASK_ALREADY_COMPLETED` | as above, `reason="task_already_terminal"`; and the common path is `STALE_VERSION`, which already exists |
| `APPOINTMENT_CONFLICT` | **there is no overlap error.** Overlap is a non-blocking `overlap_warning` response field (`B2_TASK_APPOINTMENT_MODEL.md` §6) |
| `DUPLICATE_CONTACT` | **there is no duplicate-contact error.** Duplicates are advisory `duplicate_candidates[]`; enforcing uniqueness on phone/email would violate CRM-INV-18 |
| `CROSS_WORKSPACE_REFERENCE` | it would confirm that the referenced object exists in *some* workspace; folded into `404 ENTITY_NOT_FOUND` |

## 4. Deterministic outcome for every scenario the brief names

| Scenario | Status · code · reason | State change |
|---|---|---|
| Lead missing, or in another workspace | `404 ENTITY_NOT_FOUND` | none |
| Duplicate Lead (Business already converted) | **`201 Lead`** + `X-Lead-Conversion-Outcome: existing` | none |
| Invalid state transition (`to == from`) | `400 VALIDATION_ERROR` at the DTO layer; `409 CONFLICT`·`invalid_lead_transition` if it reaches step 15 | none |
| Unknown status/priority value | `400 VALIDATION_ERROR` | none |
| Invalid or inactive owner | `409 CONFLICT`·`owner_membership_inactive`; `404` if in another workspace | none |
| Duplicate Contact | `201 Contact` with `duplicate_candidates[]` populated | contact created |
| `CompleteTask` on a completed Task | `409 STALE_VERSION` (normal path) or `409 CONFLICT`·`task_already_terminal` | none |
| Appointment overlap | `201`/`200` with `overlap_warning = true` | appointment created |
| Reschedule a terminal Appointment | `409 CONFLICT`·`appointment_already_terminal` | none |
| Stale version on any aggregate | `409 STALE_VERSION` | **none** — no merge, no server-side retry |
| Cross-workspace `owner_ref`/`deal_ref`/`contact_ref`/`source_job_ref` | `404 ENTITY_NOT_FOUND` — **never `400`** | none |
| Business not convertible | `409 CONFLICT`·`business_not_convertible` | none |
| Business already converted | `201` existing Lead | none |
| Invalid AI reference | **not reachable** — CRM stores no AI reference; `Lead360.intelligence` is `null` when unavailable | none |
| Mutation on an archived Lead | `409 CONFLICT`·`lead_archived` | none |
| Archive an already-archived Lead | `409 CONFLICT`·`lead_archived` | none |
| Quota exhausted at conversion | `403 QUOTA_EXHAUSTED` | none |
| Plan lacks `crm.core` | `403 ENTITLEMENT_LOCKED` | none |
| Unauthorized mutation | `403 PERMISSION_DENIED` | none |
| Idempotent replay, same key and body | the **stored** response, replayed verbatim | none |
| Same key, different body | `409 IDEMPOTENCY_CONFLICT` | none |
| Unknown request field or query parameter | `400 VALIDATION_ERROR` naming it | none |

## 5. Anti-enumeration summary

| Probe | Response | Why it is safe |
|---|---|---|
| `GET`/mutate a `LEAD-*` in another workspace | `404 ENTITY_NOT_FOUND` | byte-identical to a random `LEAD-*` |
| Same for `TSK-*`, `APT-*`, `CON-*`, `NOTE-*` | `404 ENTITY_NOT_FOUND` | one uniform answer across all five types |
| Convert a `BUS-*` from another workspace | `404 ENTITY_NOT_FOUND` | identical to a non-existent Business |
| Assign an owner from another workspace | `404 ENTITY_NOT_FOUND` | never `403`, which would confirm the Membership exists |
| Reference a `DEAL-*` from another workspace | `404 ENTITY_NOT_FOUND` | never `400` |
| `PATCH` a Lead without `lead.update` | `403 PERMISSION_DENIED` at step 8, **before** object resolution | an unauthorized caller cannot probe `LEAD-*` existence |
| `GET /leads` as a non-member | `404 WORKSPACE_NOT_FOUND` | identical for member and non-member |
| Search a phone number via `q` | **not supported** — contact details are excluded from search | `GET /leads` cannot become a reverse-lookup oracle |
| Timeline as a caller without `conversation.view` | a shorter timeline, no placeholder | a placeholder would disclose that a conversation exists |
