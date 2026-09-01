# B6 — Deal Ownership and Assignment

> **B6 status:** Target design only. References frozen B1 membership/RBAC truth; modifies none of it.

## 1. Who can own a Deal

Any **active workspace member** may be assigned as `Deal.owner_membership_id` — ownership is not restricted to the `sales` role. This mirrors `B2_LEAD_AGGREGATE.md`'s identical `owner_membership_id` field exactly (FK → `memberships.id` `ON DELETE RESTRICT`, `EXTERNAL_DOMAIN_REFERENCE` to B1, "CRM holds the choice; Workspace owns the Membership" — applied verbatim to Pipeline).

## 2. Default at creation — convenience, not coupling

**`B6-D-A018` (Class A, resolved).** At `CreateDeal`, `owner_membership_id` defaults to the Lead's current `owner_membership_id` if the actor does not explicitly supply one, matching frontend evidence FB-D07 (`DealModal.tsx:138`, `defaultValue={lead?.ownerId}`). This is a **one-time convenience default**, evaluated once, at creation. It is explicitly **not** a live coupling:

- Reassigning the Lead's owner after Deal creation does **not** cascade to any existing Deal's owner.
- Reassigning a Deal's owner does **not** cascade back to the Lead's owner.

This is stated as its own decision because the task explicitly warns against inventing hidden coupling, and frontend evidence (FB-D07) independently confirms the two fields diverge freely in the mock with no reconciliation mutator anywhere.

## 3. Reassignment — `AssignDeal` / `deal.assign`

Reassignment is its own command (`AssignDeal`), gated by the new additive permission `deal.assign` (mirroring `lead.assign`'s existing precedent in `B1_AUTHORIZATION_RBAC.md` exactly), not folded into `UpdateDeal`/`deal.update`. Rationale: `lead.assign` is already a separate permission from `lead.update` in frozen B1 for the identical reason — reassigning ownership of a commercial object is a distinct, sometimes higher-trust action from editing its descriptive fields (a `sales` role can update a Deal's own assigned Deals but reassignment carries the same "own assignments only" object condition `lead.assign` already uses).

Reassignment is permitted regardless of `Deal.status` — a Won or Lost Deal can still be reassigned (e.g., for reporting/handoff/territory-realignment purposes) without needing `ReopenDeal` first, since reassignment does not touch any commercial-outcome field.

## 4. Suspended or removed owner

Frozen B1: membership rows are never hard-deleted (`ON DELETE RESTRICT`), only transitioned through `suspended`/`removed` status. B6 inherits this unchanged:

- `Deal.owner_membership_id` continues to reference the historical membership row even if that membership becomes `suspended` or `removed` — it is never nulled out or cascaded.
- A Deal whose owner's membership is no longer `active` is **not** itself blocked from further mutation by *other* actors with sufficient permission (`deal.update`/`deal.assign`/`deal.close`) — only the suspended/removed member's own further attempts to act on it fail, at frozen B1's decision-chain step 6 (membership-active gate), before B6's own RBAC step is ever reached.
- Such a Deal is visible in every list/filter exactly as before; nothing about its owner's membership state hides it. A workspace admin with `deal.assign` can reassign it to an active member at any time.

## 5. Can a Deal be unassigned?

**No — `owner_membership_id` is never null.** Every Deal has exactly one owner from creation onward (matching Lead's own `owner_membership_id NOT NULL` pattern). "Unassigned" is not a modeled state; a Deal whose intended owner has left the workspace must be explicitly reassigned to a specific remaining member via `AssignDeal`, never left ownerless. This avoids a null-owner Deal silently falling out of every owner-scoped filter/dashboard.

## 6. Owner snapshot vs. historical

`owner_membership_id` is a **live** field, not a per-transition snapshot — the current value always reflects the current owner. Historical ownership changes are reconstructable from `deal_stage_transitions`... no — ownership changes are **not** recorded in `deal_stage_transitions` (that table is status/stage-transition-scoped only, `B6_DATA_MODEL.md` §4). Ownership history is instead reconstructable from the `DealAssigned` event stream (via B2's projected timeline, `B6_CRM_TIMELINE_PROJECTION.md`), which carries `from_owner_ref`/`to_owner_ref` on every reassignment — mirroring B5's `ConversationAssigned` event payload shape exactly.
