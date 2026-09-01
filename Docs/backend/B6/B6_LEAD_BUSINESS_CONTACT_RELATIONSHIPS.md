# B6 — Lead, Business, and Contact Relationships

> **B6 status:** Target design only. Designed against frozen `B2_LEAD_AGGREGATE.md` and `B1_AUTHORIZATION_RBAC.md` Doctrine R-2, not invented independently.

## 1. Lead → Deal cardinality

**`B6-D-A002`: 0..N Deals per Lead.** Frozen `B2_LEAD_AGGREGATE.md` §9's ERD already states `LEAD ||--o{ DEAL : "referenced by (Pipeline)"` — zero-to-many, Pipeline-owned. A Lead may have no Deal, one Deal, or several (e.g., a repeat customer, or a lost Deal followed by a new opportunity later). B6 does not constrain this further; there is no "one Deal per Lead" uniqueness constraint.

**`B6-D-A003`: a Deal cannot exist without a Lead in Phase 1.** `deals.lead_id` is `NOT NULL`, immutable. The frozen ERD's relationship label is `"opens"` — a Deal originates from an already-converted Lead, never from a bare Business or a raw Discovery result. This mirrors B5's `B5-D-A002` (Conversation is Lead-keyed because Messaging is post-conversion by product design) applied identically to Pipeline: a Deal is a post-conversion commercial artifact.

## 2. Lead archival — no cascade

Frozen `B2_LEAD_AGGREGATE.md` §7 states plainly: *"Open Deals and open Conversations do **not** block archiving — CRM must not gate on another domain's state"* and *"Cascade: **none.** ... Deals, Conversations, RevenueEvents, and Touchpoints are untouched."*

B6 honors this exactly and does not invent the inverse coupling either:

| Question | Answer |
|---|---|
| Does `ArchiveLead` block if the Lead has open Deals? | **No.** B2 already decided this; B6 adds no gate. |
| Can a Deal remain active/open after its Lead is archived? | **Yes**, unconditionally. `Deal.lead_id` continues to resolve; nothing in B6's admission sequence checks `Lead.archived_at`. |
| Does archiving the Lead block further Deal mutation? | **No.** B6's own RBAC/entitlement/state guards are the only gates on Deal mutation (`B6_ENTITLEMENT_RBAC_TENANCY.md`). A Deal whose Lead is archived remains fully mutable by B6's own rules — display surfaces (Lead 360, Deal detail) simply show the Lead as archived alongside it. |
| Can B6 read an archived Lead to resolve `lead_id`? | **Yes.** Frozen `B2_LEAD_AGGREGATE.md` §7: "Reads after archive ... still succeed. History stays legible." `CreateDeal` against an archived Lead is `422 VALIDATION_ERROR` \| `lead_archived` at creation time only (starting a *new* opportunity against an archived Lead is a genuine product guard); every subsequent Deal mutation is unaffected once the Deal exists. |

## 3. Deal creation never mutates Lead

**`B6-D-A006` (Class A, resolved): `CreateDeal` does not write `leads.status` or any other Lead column.** Frozen `BACKEND_DOMAIN_OWNERSHIP.md` names "CRM services" as the sole allowed writer of `leads`; Pipeline is not among them. B6 therefore does **not** implicitly advance `Lead.status` (e.g., to some notion of "in commercial progression") when a Deal is created, won, or lost. Commercial progression is visible on the Lead 360 aggregate purely through the projected `deals[]` list (frozen `BACKEND_DTO_CONTRACTS.md`'s Lead360 DTO already carries it) — a live read, never a write to `leads`.

If a product requirement later wants `Lead.status` to advance automatically on `DealWon` (e.g., to `qualified` or a new status value), that is an **explicit, separate, B2-owned command** (`UpdateLead`, called by a future governed automation reacting to `DealWon` — B7's territory, `B6_B7_AUTOMATION_BOUNDARY.md`), never an implicit side effect inside `CloseDealWon`. This is recorded as `B6-D-C001` (Class C — no frontend evidence of this behavior exists to design against today).

## 4. Business reference

**`B6-D-A004`: `Deal.business_id` is a derived snapshot of `Lead.business_id` at Deal-creation time**, not an independent relationship. See `B6_DEAL_AGGREGATE.md` §3 for the full reasoning reconciling this against Doctrine R-2's `Deal → Lead, Pipeline, Stage` list. B6 does not duplicate any other Business field (name, city, category, website) onto `Deal` — those remain `EXTERNAL_DOMAIN_REFERENCE`s resolved by joining through `Lead → Business` at read time, exactly as `B2_LEAD_AGGREGATE.md` §1 already refuses to duplicate them onto `Lead` itself.

## 5. Contact reference

**`B6-D-A005`: Deal does not reference Contact(s) directly. No `DealContactLink` table exists.**

The task explicitly asks whether this concept is necessary; it is evaluated and rejected:

- Frozen B1 Doctrine R-2's relationship-injection table does not list `Deal → Contact`.
- The frozen Deal DTO sketch (`BACKEND_DTO_CONTRACTS.md`) does not carry a contact field.
- `B2_LEAD_AGGREGATE.md` already models `Lead ||--o{ LEAD_CONTACT : links` (M:N Lead↔Contact via `lead_contacts`). A Deal reaching Contacts through `Deal.lead_id → Lead → lead_contacts` is sufficient: the CRM's contact list for a Deal is the CRM's contact list for its Lead, read at query time.

Introducing a parallel `DealContactLink` M:N table would create a second, independently driftable membership of "which contacts are on this opportunity" — exactly the duplicate-CRM-truth failure mode `B2_LEAD_AGGREGATE.md` §1's "explicitly absent" list exists to prevent for the Lead side, and B6 declines to introduce the mirror-image mistake on the Deal side.

**Read model consequence.** `GET /deals/{id}` and `GET /leads/{id}/360` both surface contacts by joining `deal.lead_id → lead.lead_contacts` at read time (`B6_READ_MODELS_QUERY.md`); no Deal-owned contact membership table is written or maintained.

## 6. Owner following Lead owner

Answered in full in `B6_OWNERSHIP_ASSIGNMENT.md` §1: Deal owner **defaults to** the Lead's current owner at `CreateDeal` time (a convenience default, not a live coupling) and is **independently mutable** thereafter — it does not silently re-sync if the Lead's owner later changes, avoiding the hidden coupling the task explicitly warns against.
