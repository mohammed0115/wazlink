# B9 — RBAC & Tenancy

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Reuse first

Frozen `B1_AUTHORIZATION_RBAC.md` holds the complete permission registry. It contains **no revenue, finance, or attribution permission**. The registry's **23** groups are Workspace, Members, Ownership, Invitations, Sessions, Discovery, Businesses, Leads, Tasks, Appointments, Conversations, Messages, Deals, Automation, Analytics, Billing, Subscription, Payments, Tax, Files, Audit, Settings and AI — counted from `B1_AUTHORIZATION_RBAC.md` §2 directly. (An earlier draft said 18; it had enumerated only the 18 domain groups and silently dropped the five identity groups. The substantive claim — that none of them is financial — is unchanged and independently verified.)

Reuse was attempted before invention, and each candidate was rejected for a stated reason:

| Frozen candidate | Why it cannot carry B9's meaning |
|---|---|
| `analytics.view` | **Partly reused** — see §2. It grants *reading* derived metrics, which is exactly what the attribution report is. It does not and must not grant creating revenue |
| `billing.manage` | Platform billing (WazLink charging the workspace). Frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md` keeps that a separate bounded context from customer revenue; reusing it would merge the two authorities the firewall separates |
| `payment.manage` | Payment operations on B8 objects; a payment operator is not a revenue recognizer |
| `deal.close` | Closing a Deal is precisely the act that must **not** recognize revenue. Reusing it would make `Won Deal ⇒ Recognized Revenue` an authorization fact |
| `tax.view` | B10's, and read-only |
| `audit.view` | Reading audit trails, not creating financial facts |

Therefore B9 requires new permissions, recorded as an **additive** amendment (`B9-AM-001`).

## 2. Permissions

| Permission | Grants | Origin |
|---|---|---|
| `revenue.view` | read `RevenueEvent`, reversals, revenue summary | additive |
| `revenue.recognize` | `RecordRevenueEvent` | additive |
| `revenue.reverse` | `ReverseRevenueEvent` | additive |
| `attribution.manage` | `RecordTouchpoint` | additive |
| `finance.reconciliation.view` | read reconciliation cases | additive |
| `finance.reconciliation.resolve` | `ResolveFinancialReconciliationCase` | additive |
| `analytics.view` | read attribution **structure** — the touchpoint list, source dimensions, report shape | **FROZEN — reused verbatim**, and never sufficient on its own for a monetary field (§2a) |

```
ADDITIVE_PERMISSION_COUNT = 6
REUSED_PERMISSION_COUNT   = 1   (analytics.view)
```

### 2a. Every monetary field requires `revenue.view` (Class A, `B9-D-A038`)

> **No B9 response containing a `Money` field is reachable without `revenue.view`, whatever else the caller holds.**

This closes a real hole. `analytics.view` is granted by frozen B1 to **`member` (A)** and **`viewer` (C)** — the two roles §3 says receive nothing financial. Yet ops 8 and 9 return `unattributed_amount`, `gross_attributed` and `net_attributed`. An earlier draft gated those on `analytics.view` alone, which would have made a broad analytics grant a silent finance-data grant, and made §3's stated policy false for exactly the roles it was written to protect.

The rule is stated on **every** operation whose response carries a `Money`, not only the ones where a role gap happens to exist today:

| Operation | Returns `Money`? | Required |
|---|:--:|---|
| 1 `createRevenueEvent` | **yes** (`gross`, `net`) | `revenue.recognize` **AND** `revenue.view` |
| 2 `listRevenueEvents`, 3 `getRevenueEvent`, 5 `listRevenueReversals`, 7 `getRevenueSummary` | **yes** | `revenue.view` |
| 4 `createRevenueReversal` | **yes** (`gross`, `net`) | `revenue.reverse` **AND** `revenue.view` |
| 6 `getRevenueEventAttribution` | **yes** | `revenue.view` |
| 8 `getAttribution`, 9 `listAttributionSources` | **yes** | `analytics.view` **AND** `revenue.view` |
| 10 `createAttributionTouchpoint`, 11 `listAttributionTouchpoints` | no | `attribution.manage` / `analytics.view` |
| 12, 13, 14 reconciliation | no `Money`-typed field, but `evidence` may carry amounts | `finance.reconciliation.view` / `.resolve` **AND** `revenue.view` |

**Ops 1 and 4 state the conjunction explicitly, and `B9-FIX.2` added it.** Under the §3 matrix the conjunction is currently redundant — no role holds `revenue.recognize` or `revenue.reverse` without `revenue.view` — but relying on that would make the rule true by coincidence of today's role assignments rather than by construction. If a later phase mints a narrower role, or a workspace-level grant is added, the rule must still hold. It is therefore enforced per operation, not inferred from the matrix. `AT-RBAC-8` **(NC)**.

`analytics.view` is still required on 8 and 9 rather than dropped: they *are* analytics surfaces, and a workspace that revokes analytics should lose them. The two permissions are conjunctive, so neither alone is a back door. No frozen permission changes meaning and no frozen role cell moves — a `member` who held `analytics.view` still holds exactly what B1 granted; they simply never had `revenue.view`, and now the monetary fields say so.

Reconciliation cases carry no `Money`-typed field, so the literal rule does not reach them — but a `refund_without_reversal` case's `evidence` carries a refund amount, and `B9_SECURITY_PRIVACY.md` §4 requires `revenue.view` for *anything* carrying a monetary amount. B9 applies the conjunction there too rather than leaving a monetary value reachable through an operational permission. Under the §3 matrix this is again redundant today (`finance.reconciliation.view` and `revenue.view` are both `A` for `owner`/`admin`/`manager`) and again stated so it does not depend on that remaining true.

`revenue.view` and `revenue.recognize` are deliberately **separate**: reading financial history is an ordinary reporting need; creating it is the most consequential act in the product. Likewise `revenue.recognize` and `revenue.reverse` are separate, so that the ability to book revenue does not automatically confer the ability to un-book it.

## 3. Role matrix

Following frozen B1's six roles (`owner`, `admin`, `manager`, `sales`, `member`, `viewer`) and its `A`/`C`/`·` legend, without altering a single frozen cell:

| Permission | owner | admin | manager | sales | member | viewer | Condition for `C` |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `revenue.view` | A | A | A | C | · | · | sales: revenue whose `source_ref` resolves to a Deal/Lead they own |
| `revenue.recognize` | A | A | · | · | · | · | — |
| `revenue.reverse` | A | A | · | · | · | · | — |
| `attribution.manage` | A | A | A | · | · | · | — |
| `finance.reconciliation.view` | A | A | A | · | · | · | — |
| `finance.reconciliation.resolve` | A | A | · | · | · | · | — |

Rationale, stated rather than assumed:

- **Recognition and reversal stop at `admin`.** `manager` may see and investigate everything but may not create or destroy financial truth. This follows frozen B1's own pattern, where `manager` holds `C`-conditional authority on consequential operations and full authority on none of the destructive ones.
- **`sales` gets conditional read only.** A salesperson seeing revenue on their own Deals is a legitimate need; seeing the whole workspace's finances is not implied by their role anywhere in the frozen matrix.
- **`member` and `viewer` get nothing financial.** Frozen B1 grants both `analytics.view`, so both can see attribution *structure*; §2a is what keeps that from becoming a monetary grant. B9 widens nothing.
- **No role gets a "financial superuser" grant.** `owner` holds the same six permissions as `admin` plus nothing extra.

The `C` condition on `revenue.view` reuses B1's existing resource-authorization machinery (`B1_AUTHORIZATION_RBAC.md` §166 already registers `RevenueEvent → source_ref` as *"polymorphic source resolved in-scope by `source_type`"*) — the ownership test is delegated to the source's own domain, not re-implemented by B9.

## 4. Tenancy

**Every** B9 authoritative row carries `workspace_id` NOT NULL. Every query is workspace-filtered before any other predicate. The workspace comes **only** from the authenticated session — no endpoint accepts a `workspace_id` field (`B9_API_DTO_CONTRACTS.md` §6).

| Rule | Enforcement |
|---|---|
| A `RevenueEvent` is readable only in its own workspace | session scope + `WHERE workspace_id = :ws` |
| A reversal's workspace must equal its event's | validated in the reversal transaction (`B9_STORAGE_MODEL.md` §2a); `B9-AF-019` |
| An attribution's workspace must equal its event's | written in the same transaction; `B9-AF-021` |
| A `source_ref` must resolve **inside** the caller's workspace | `B9-AF-005`; the upstream read is itself workspace-scoped |
| The provenance chain walk never crosses a workspace | every hop re-applies the workspace filter, including the read of B3's `discovery_results`; `AT-FT-7` **(NC)** |
| A touchpoint's `subject_ref` must resolve in-workspace | `B9-AF-022` |
| A reconciliation case is visible only in its workspace | `B9-AF-032` |
| Exports are workspace-scoped | `B9_SECURITY_PRIVACY.md` §4 |

**A public ID never authorizes access by itself.** `REV-*`, `REVR-*`, `ATT-*` and `FRC-*` are opaque lookup keys; resolution is always `(workspace_id, public_id)`. Presenting another workspace's `REV-*` yields `404 ENTITY_NOT_FOUND`, identical to a nonexistent id.

```
CROSS_WORKSPACE_FINANCE_LEAKS = 0
```

## 5. Actor identity

Every financial row names a real `membership_id`: `recognized_by_membership_id`, `reversed_by_membership_id`, `resolved_by_membership_id`. There is:

- no `system` actor on any financial row, and none on `attribution_touchpoints` either — `recorded_by_membership_id` is NOT NULL and names a human (`B9-D-A036`). The "system provenance resolver" an earlier draft referenced does not exist and never did; automatic Track-A attribution is a **read** of frozen B3 provenance at recognition time, not a write by anyone (`B9_ATTRIBUTION_MODEL.md` §2);
- no `system:automation` grant of any B9 permission (`B9_B7_AUTOMATION_BOUNDARY.md`);
- no service account, no impersonation, no actor override field on any DTO;
- no path by which an actor is inferred from a request body.

The one system-actor write in B9 is `OpenFinancialReconciliationCase` — which creates a **case**, not a financial fact, and holds no financial permission.

## 6. Entitlements

B9 defines **no new entitlement capability or usage metric**. Inventing a commercial key is B8's authority (`B9_B8_BILLING_BOUNDARY.md` §6), and B9 has no frozen capability to enforce. `B9-AF-026` exists so that *if* B8 later gates finance behind a capability, B9 already returns the frozen `ENTITLEMENT_LOCKED` code rather than inventing one; Phase 1 configures no such gate.

```
B8_BILLING_AUTHORITY_LEAKS = 0
```

## 7. Negative controls

`AT-RBAC-1` **(NC)**: a role gaining `revenue.recognize` outside the §3 matrix — fails.
`AT-RBAC-2` **(NC)**: an implementation accepting `revenue.view` as sufficient for `POST /revenue-events` — fails.
`AT-RBAC-3` **(NC)**: `system:automation` holding any B9 permission — fails.
`AT-RBAC-4` **(NC)**: a B9 endpoint reading `workspace_id` from the request — fails.
`AT-RBAC-5` **(NC)**: a `member` or `viewer` holding only `analytics.view` receiving any `Money` field from op 8, 9 or 6 — fails `403` (§2a).
`AT-RBAC-6` **(NC)**: an implementation gating a monetary response on `analytics.view` alone — fails.
`AT-RBAC-8` **(NC)**: an implementation authorizing op 1 or op 4 on `revenue.recognize`/`revenue.reverse` alone, without `revenue.view` — fails (§2a); both return `Money`.
`AT-TEN-1` **(NC)**: reading another workspace's `RevenueEvent` by public id — `404`, never `403`.
`AT-TEN-2` **(NC)**: reversing another workspace's event — `404`.
`AT-TEN-3` **(NC)**: attributing revenue to another workspace's touchpoint — rejected.
`AT-TEN-4` **(NC)**: any response distinguishing "absent" from "another workspace's" — fails.
