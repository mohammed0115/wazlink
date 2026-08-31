# B2 — Lead 360 Read Model (`GET /leads/{id}/360`)

> **B2 status:** Read-contract design only. Lead 360 is a **projection**. It owns no business truth, mints no identity, and is reachable by no command.

## 1. The frozen contract

`GET /api/v1/leads/{id}/360` → `200 Lead360` is a **frozen B0 operation**. The frozen schema is:

```
Lead360 { lead, business, contacts[], intelligence?, conversations[], tasks[],
          appointments[], deals[], activities[], revenue_refs[] }   required: [lead, business]
```

`contacts`, `conversations`, `tasks`, `appointments`, `deals`, and `revenue_refs` are `EntityRef[]`; `intelligence` is an opaque nullable object; `activities` is an array of opaque objects. B2 changes none of that. It makes exactly **one** additive amendment: a `notes: EntityRef[]` array (`B2-D-B008`), required because Note is a new aggregate the frozen schema predates and Lead 360 is the only surface that renders notes.

## 2. Section-by-section authority

| Section | Authority | Shape | What it must never carry |
|---|---|---|---|
| `lead` | **CRM** | the frozen `Lead` schema, unchanged | any Business, AI, Deal, or Revenue value |
| `business` | **Discovery/Business** | the frozen `Business` schema, read live | a CRM-edited copy of any field |
| `contacts[]` | **CRM** | `EntityRef[]` (`CON-*`) | phone/email inline — they are fetched from `GET /leads/{id}/contacts` under the same authorization |
| `intelligence` | **AI Intelligence** | the frozen opaque object, read live | anything CRM persisted. If the analysis is regenerated, this section changes and no CRM row does |
| `conversations[]` | **Messaging** | `EntityRef[]` (`CONV-*`) | message bodies, unread counts as CRM truth |
| `tasks[]` | **CRM** | `EntityRef[]` (`TSK-*`) | — |
| `appointments[]` | **CRM** | `EntityRef[]` (`APT-*`) | — |
| `notes[]` *(amendment)* | **CRM** | `EntityRef[]` (`NOTE-*`) | note bodies — fetched from `GET /leads/{id}/notes` |
| `deals[]` | **Pipeline** | `EntityRef[]` (`DEAL-*`) | `value`, `stage`, `probability` as CRM truth |
| `activities[]` | **CRM read model** | the first page of the merged timeline (§3) | free text, PII |
| `revenue_refs[]` | **Revenue** | `EntityRef[]` (`REV-*`) | **any amount** |

**`revenue_refs` carries identities, never amounts.** This is the single most important line in the document. A number rendered next to a Lead must be fetched from Analytics/Revenue with its own `metric_id`, `period`, `semantics`, and `currency` per `BACKEND_ANALYTICS_SEMANTICS.md`. Embedding a scalar here would create a second revenue figure with no period, no timezone, and no recognition semantics — and would be the exact path by which "won deal value" silently becomes "revenue" (CRM-INV-7).

The frozen Lead 360 UI renders **no** monetary figure at all (inventory item 77). B2 does not add one.

## 3. `activities[]` and the dedicated timeline route

`Lead360.activities[]` returns the **first page** of the merged timeline defined in `B2_NOTE_ACTIVITY_TIMELINE.md` §3.1 — ordered `(occurred_at DESC, entry_id DESC)`, capped at 20 entries, carrying safe summaries only.

For anything beyond the first page, B2 adds `GET /api/v1/leads/{id}/timeline` (`B2-D-B009`) with the same entry contract and proper cursor pagination. Paginating inside an aggregate response would give `Lead360` two pagination contracts and no place to put the cursor without amending the frozen schema.

Cross-domain entries appear only if the caller can read their source (`conversation.view` for messages, `deal.view` for deal activity). A caller without those permissions sees a shorter timeline, never a redacted placeholder — a placeholder would itself disclose that a conversation exists.

## 4. Provenance

The provenance panel (`Source → Job → Business → Analysis → Opportunity`, inventory item 73) is served from the **immutable `lead_provenance` snapshot**, not from live joins.

Each identity is rendered as text with a `resolvable` boolean. A `JOB-*` whose Discovery Job has since been archived renders as an unlinked historical identity, not as an error and not as a missing value. This is what makes CRM-INV-9 observable: the panel keeps explaining the decision after every source has moved on.

The panel additionally shows `intelligence_score`/`intelligence_tier` **as they were at conversion time**, distinct from the live `intelligence` section. When they differ, the client may show both — "converted at 92, now 78" is a genuinely useful signal and is only possible because the snapshot exists.

## 5. Contract obligations

1. **Read-only.** No `POST`, `PATCH`, or `DELETE` targets `/leads/{id}/360`, and no command reads it.
2. **No independent identity.** Every element carries the owning domain's public ID.
3. **No caching of authorization.** Section visibility is evaluated per request inside the request transaction (B1 `B1-D-A11`).
4. **Tenant-scoped throughout.** Every section is resolved through the active-workspace queryset (Doctrine R-1). A cross-workspace `LEAD-*` is `404 ENTITY_NOT_FOUND`, byte-identical to a random ID.
5. **A degraded section is `null`/`[]`, never a 500.** If the Intelligence read model is unavailable, `intelligence` is `null` and the rest of the response is served. The Lead's own truth does not depend on another domain being up.
6. **Archived Leads are readable.** `GET /leads/{id}/360` succeeds for an archived Lead with `lead.archived_at` populated, so history stays legible.

## 6. Sections deliberately excluded

| Excluded | Why |
|---|---|
| Revenue **amounts** | CRM-INV-7; the frozen UI shows none |
| Attribution **allocations** | Attribution-owned; `Lead360` has no attribution field in the frozen schema and B2 adds none |
| Deal `value`/`stage`/`probability` inline | Pipeline-owned; `EntityRef[]` is the frozen shape |
| Message bodies | Messaging-owned and PII-bearing; `conversation.view` gates them at their own route |
| AI `sales_approach` as a CRM field | AI-owned (`B2-D-A013`); it arrives inside the opaque `intelligence` object, exactly as the frozen UI reads it |
| Automation runs | the frozen panel reads them from the Automation service directly, and `Lead360` has no such field |
| File attachments | out of Phase-1 CRM scope |
