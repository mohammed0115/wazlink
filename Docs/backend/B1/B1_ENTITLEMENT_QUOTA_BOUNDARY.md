# B1 — RBAC vs Entitlement vs Quota

> **B1 status:** Boundary design only. The Entitlements domain and its vocabulary are inherited from B0 and from the frozen frontend; B1 does not redefine them.

## 1. Three separate authorities

| Authority | Question | Subject | Owning domain | Denial |
|---|---|---|---|---|
| **RBAC** | *May **this user** perform this action?* | Membership role | Workspace | `403 PERMISSION_DENIED` |
| **Entitlement** | *Does **this workspace's plan** include this capability?* | Subscription/Plan | Entitlements | `403 ENTITLEMENT_LOCKED` |
| **Quota** | *Has **this workspace** allowance left for this metric and period?* | `usage_counters` | Entitlements | `403 QUOTA_EXHAUSTED` |

They are independent and non-substitutable:

- An **Admin** has `automation.rule.manage`, but on `PLAN-STARTER` the workspace has no `automation.rules` capability ⇒ `403 ENTITLEMENT_LOCKED`. Permission does not buy capability.
- A workspace on `PLAN-GROWTH` **is** entitled to `automation.rules`, but a **Viewer** still cannot manage rules ⇒ `403 PERMISSION_DENIED`. Capability does not grant permission.
- An **Owner** on `PLAN-GROWTH` with `discoveryRuns` exhausted ⇒ `403 QUOTA_EXHAUSTED`. Entitlement does not imply remaining allowance.
- Conversely, remaining quota on a capability the plan excludes is meaningless: `not_included` is reported as `LOCKED`, an entitlement fact, and quota is never consulted.

## 2. Ordering

Pipeline steps 8 → 11 → 12 (see `B1_AUTHORIZATION_RBAC.md` §1): **RBAC, then Entitlement, then Quota.**

Rationale: a caller who may not perform the action must not learn the workspace's plan or usage. RBAC denial is therefore always evaluated and returned first, and quota is evaluated last because it is the only one of the three whose answer changes with concurrent traffic.

## 3. Inherited vocabulary (do not reinvent)

From the frozen frontend `client/src/services/contracts/entitlements.ts` and B0's `EntitlementDecision`:

| Element | Values |
|---|---|
| Capabilities | `discovery.basic`, `crm.core`, `export.csv`, `pipeline.core`, `inbox.copilot`, `automation.rules` |
| Statuses | `AVAILABLE`, `LIMITED`, `EXHAUSTED`, `LOCKED` |
| Usage metrics | `leads`, `discoveryRuns`, `seats`, `automationRuns`, `aiAnalyses` |
| Upgrade reasons | `capability_locked`, `usage_exhausted`, `higher_limit` |
| Plans | `PLAN-STARTER`, `PLAN-GROWTH`, `PLAN-SCALE` (catalog slugs on `Plan.code`; the opaque identity is `PLAN-*`) |

Status → HTTP mapping: `LOCKED` ⇒ `403 ENTITLEMENT_LOCKED`; `EXHAUSTED` ⇒ `403 QUOTA_EXHAUSTED`; `AVAILABLE`/`LIMITED` ⇒ proceed. `LIMITED` is an advisory state for the UI, never a denial.

## 4. The identity ↔ entitlement contact point: `seats`

`seats` is the only usage metric B1 owns a write path for. It is the number of **`active` Memberships** in the workspace.

| Event | Seat effect | Where enforced |
|---|---|---|
| `CreateWorkspace` | +1 (founder) | quota check inside the create transaction |
| `InviteMember` | **0** — a pending invitation reserves nothing | not checked at invite time |
| `AcceptInvitation` | +1 | quota check inside the acceptance transaction, after the invitation row is locked |
| `ReactivateMembership` | +1 | quota check inside the transaction |
| `SuspendMembership` | −1 | seat released. Suspending the target's **final eligible** membership is refused first (`409 CONFLICT` · `last_active_membership`), so no seat is released by a transition that would strand a global identity. |
| `RemoveMember` / `LeaveWorkspace` | −1 | seat released |
| `DisableUser` | 0 | the membership stays `active`; the seat stays consumed. Disabling a user is an identity action, not a licensing action, and must not silently change what the workspace is billed for. |

**Why acceptance, not invitation.** Reserving a seat at invitation time would let an admin exhaust the workspace's seat allowance with invitations nobody accepts, and it would require a compensating release on expiry/cancel — a reconciliation surface with no product benefit. Checking at acceptance means the check happens exactly once, in the same transaction that creates the seat.

**Race.** Two invitees accepting the last seat simultaneously: both transactions take the workspace's `usage_counters` row for `seats` with `SELECT … FOR UPDATE` (B0: "Quota enforcement remains transactional and authoritative in PostgreSQL"), so they serialize. One commits; the other re-reads, finds no allowance, and returns `403 QUOTA_EXHAUSTED` with its invitation left `pending` and re-usable after a seat frees or the plan is upgraded.

**Redis.** B0 permits Redis counters as "acceleration/abuse controls, not the source of truth". B1 forbids a Redis seat counter from ever being the value a decision commits against; the authoritative read is the locked PostgreSQL row inside the transaction.

## 5. Failure payloads

All three denials use the B0 envelope `{"error":{"code","message","details","request_id"}}` and never disclose out-of-tenant facts.

| Code | HTTP | `details` | Client meaning |
|---|---|---|---|
| `PERMISSION_DENIED` | 403 | `{"permission": "<code>"}` | your role cannot do this — upgrading the plan will not help |
| `ENTITLEMENT_LOCKED` | 403 | `{"capability": "<id>", "reason": "capability_locked", "target_plan_ref": {…}}` | the plan must change |
| `QUOTA_EXHAUSTED` | 403 | `{"metric": "<key>", "reason": "usage_exhausted", "period": "<p>", "target_plan_ref": {…}}` | wait for the period to roll over, free allowance, or upgrade |

`target_plan_ref` is present only for entitlement and quota denials and is the same `EntityRef` the frozen `EntitlementDecision.target_plan_ref` carries. It is never present on a `PERMISSION_DENIED`, because no plan resolves a role problem — that distinction is what lets the frontend show an upgrade prompt only when an upgrade is actually the remedy, matching the frozen `UpgradeReason` vocabulary.

## 6. Boundary invariants

1. A role never appears in an entitlement or quota computation.
2. A plan, capability, or usage counter never appears in an RBAC decision.
3. Entitlement and quota are workspace-scoped and identical for every member of a workspace.
4. RBAC is membership-scoped and differs per member within the same workspace.
5. No single error code may mean two of the three. `PERMISSION_DENIED`, `ENTITLEMENT_LOCKED`, and `QUOTA_EXHAUSTED` are mutually exclusive and all exist in B0 already.
6. Quota is consumed only on committed effect. A transaction that rolls back for any later reason releases the reservation with it, because the reservation is a row in the same transaction — never a pre-committed Redis decrement.
