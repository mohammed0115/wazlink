# B14_08 — RBAC Implementation Map

> **`B14-FIX.1` repair — closes `V-03`, `V-M04`, `V-M05`, `V-M07`.** The previous revision claimed *"Six frozen roles: Owner · Admin · Manager · Sales · Viewer (+ platform Operator, B13)"* — which **dropped the frozen `member` role** and reached six by counting a B13 *platform* role as a workspace role. Every additive permission was therefore undefined for an active operational role. The matrix below has **six workspace-role columns**, and Platform Operator is documented separately in §6.

## 1. The frozen role set — read directly, not summarised

`B1_AUTHORIZATION_RBAC.md` §3's matrix header is:

```
| Permission | owner | admin | manager | sales | member | viewer |
```

and §4 states: *"**Custom roles are deferred** (`B1-D-009`, Class C). **Phase 1 has exactly six roles.**"*

**The six workspace roles are: `owner` · `admin` · `manager` · `sales` · `member` · `viewer`.**

**Platform Operator is not one of them.** It belongs to the separate B13 platform-operations namespace (`B13_OPERATOR_MODEL.md`), is not a `memberships.role` value, and **never holds tenant data authority**. Conflating the two namespaces is what produced `V-03`.

**No new role. No new rank. No changed frozen cell.** New permissions are additive rows only (`CA-06`, `CA-09`).

## 2. Structural rules

The frozen **16-step B1 authorization pipeline** is implemented once, in `common/`, and used by every endpoint. Ordering is frozen: **`ENTITLEMENT_LOCKED` → quota → permission → scope → object**.

Three rules with no exception:

1. **The client never supplies its role, workspace or permissions.** Authority is derived server-side from the session and the `memberships` row.
2. **Masking is server-side, in the selector, before serialization** — the API never emits a value the actor may not see.
3. **The frontend grants no authorization.** Hidden navigation is presentation only; a hidden route still resolves and its API still enforces.

Two frozen properties inherited unchanged: **no rank inheritance** (*"Owner does not 'inherit' permissions from Admin; every Owner cell is an explicit grant"*) and **no caching** of authorization decisions (`B1-D-006`) — membership, role and matrix are read per request inside the request transaction.

## 3. Reused frozen permissions

`lead.view|create|update|assign` · `business.view|convert` · `conversation.view` · `message.send` · `messaging.manage` · `messaging.provider.manage` · `deal.view|create|update|close` · `task.view|manage` · `appointment.view|manage` · `analytics.view` · `ai.use` · `file.upload|download` · `crm.export` · `discovery.view|run|export` · `integration.manage` · `settings.manage` · `billing.view|manage` · `payment.manage` · `subscription.change` · `audit.view` · `tax.view` · `workspace.*` · `member.*` · `invitation.*` · `ownership.transfer` · `session.self.manage`.

**Every frozen cell for these is used exactly as frozen.** Two reuses are load-bearing and their frozen `member` value matters:

- **`ai.use` — frozen `A A A C C ·`.** A holder who may use AI may use the agent. `member` holds it **conditionally** (AI quota and data policy), so `AcceptAgentProposal` is conditional for `member` too, and only *configuration* needs the new `agent.manage`.
- **`messaging.manage` covers takeover** — assignment and takeover are the same class of authority; a separate `conversation.takeover` would be held by no role separately.

## 4. New permissions (26) — the six-column matrix

`O`=owner `A`=admin `M`=manager `S`=sales **`Me`=member** `V`=viewer
**`A`** = allow · **`C`** = conditional (allowed only after the stated object/state condition passes) · **`·`** = deny

Legend symbols are the frozen `B1_AUTHORIZATION_RBAC.md` §3 symbols, deliberately reused so a reviewer can diff the two tables directly.

| # | Permission | O | A | M | S | **Me** | V | Condition for `C` | Mirrors frozen |
|--:|---|:-:|:-:|:-:|:-:|:-:|:-:|---|---|
| 1 | `customer.view` | A | A | A | A | **A** | **C** | viewer: read-only workspace scope, **contact PII masked** | `lead.view` (`A A A A A C`) |
| 2 | `customer.create` | A | A | A | A | **C** | · | member: object workspace scope | `lead.create` (`A A A A C ·`) |
| 3 | `customer.update` | A | A | A | A | **C** | · | member: object workspace scope | `lead.update` |
| 4 | `customer.archive` | A | A | A | · | **·** | · | — | archive is a lifecycle act above update |
| 5 | `customer.assign` | A | A | A | C | **·** | · | sales: own-owned only | `lead.assign` (`A A A C · ·`) |
| 6 | **`customer.merge`** | A | A | · | · | **·** | · | — | highest-trust; **separate from `.update` by design** |
| 7 | `contact.view` | A | A | A | A | **A** | **C** | viewer: read-only, **masked phone/email** | `lead.view` |
| 8 | `contact.manage` | A | A | A | A | **C** | · | member: object workspace scope | `lead.update` |
| 9 | `import.manage` | A | A | A | · | **·** | · | — | bulk write across a whole domain |
| 10 | `customfield.manage` | A | A | · | · | **·** | · | — | schema-shaping |
| 11 | `assignment.manage` | A | A | A | · | **·** | · | — | routes other people's work |
| 12 | `form.manage` | A | A | · | · | **·** | · | — | **deferred with `GAP-009`** |
| 13 | `ticket.view` | A | A | A | A | **A** | **C** | viewer: read-only workspace scope | `lead.view` |
| 14 | `ticket.create` | A | A | A | A | **C** | · | member: object workspace scope | `lead.create` |
| 15 | `ticket.update` | A | A | A | C | **C** | · | sales/member: own-assigned only | `task.manage` shape |
| 16 | `ticket.assign` | A | A | A | C | **·** | · | sales: own assignments only | `lead.assign` |
| 17 | `ticket.resolve` | A | A | A | C | **C** | · | sales/member: own-assigned only | `task.manage` shape |
| 18 | `knowledge.view` | A | A | A | A | **A** | **C** | viewer: read-only, published only | `lead.view` |
| 19 | `knowledge.manage` | A | A | A | · | **·** | · | — | publishing **grounds AI answers** |
| 20 | `agent.manage` | A | A | · | · | **·** | · | — | agent + provider/model configuration |
| 21 | `product.manage` | A | A | A | · | **·** | · | — | **deferred** |
| 22 | `quote.view` | A | A | A | A | **A** | **C** | viewer: read-only workspace scope | **deferred** |
| 23 | `quote.create` | A | A | A | A | **C** | · | member: object workspace scope | **deferred** |
| 24 | `quote.update` | A | A | A | A | **C** | · | member: object workspace scope | **deferred** |
| 25 | `quote.send` | A | A | A | C | **C** | · | sales/member: own quotes only | **deferred** |
| 26 | **`quote.accept`** | A | A | A | · | **·** | · | — | **deferred** — commercially consequential, deliberately not Sales |

**Every one of the 26 rows has an explicit cell for all six workspace roles. There is no blank, no inherited value and no "not applicable".**

### Permission arithmetic — mechanically recounted (`V-M04`)

| Quantity | Value | Method |
|---|---:|---|
| New permission **codes** | **26** | one per row; `quote.create` and `quote.update` now have **separate rows** (they previously shared one, which is what made "25" wrong) |
| Rows in the table | **26** | codes = rows, by construction |
| **Deferred** (ship with their deferred gap) | **7** | `form.manage`, `product.manage`, `quote.view`, `quote.create`, `quote.update`, `quote.send`, `quote.accept` |
| **Implemented in the approved waves** | **19** | 26 − 7 |
| Cells defined | **156** | 26 × 6 |

The previous "25 permissions, 20 implemented, 5 deferred" was wrong on all three figures.

### `member` cell rationale — deliberate, not defaulted

`member` is an **active operational role** in frozen B1: `A` on `lead.view`, `business.view`, `conversation.view`, `task.view`, `member.view`, `workspace.view`; `C` on `discovery.run`, `business.convert`, `lead.create`, `lead.update`, `task.manage`, `message.send`, `ai.use`; `·` on `lead.assign` and everything administrative.

The additive cells above follow that shape exactly:

| Class | `member` | Because |
|---|---|---|
| Read a working record (`customer.view`, `contact.view`, `ticket.view`, `knowledge.view`, `quote.view`) | **`A`** | frozen `member` reads `lead.view`, `business.view`, `conversation.view` at `A` |
| Create/update a working record (`customer.create/update`, `contact.manage`, `ticket.create`, `quote.create/update`) | **`C`** | frozen `member` holds `lead.create`/`lead.update` at `C` — object workspace scope |
| Own-scoped completion (`ticket.update`, `ticket.resolve`, `quote.send`) | **`C`** | own-assigned only, matching `task.manage` |
| Routing others' work (`customer.assign`, `ticket.assign`) | **`·`** | frozen `member` is `·` on `lead.assign` |
| Administrative / schema / commercial (`archive`, `merge`, `import`, `customfield`, `assignment`, `agent`, `knowledge.manage`, `product`, `form`, `quote.accept`) | **`·`** | frozen `member` holds no administrative permission |

**No `member` cell is more permissive than the frozen cell it mirrors.**

### `V-M07` — the `customer.view` shape, corrected

The previous revision gave `customer.view` **Viewer `✓` and Sales `own`**, which inverted frozen `lead.view` (`sales A`, `viewer C`) — Sales had *narrower* access to Customers than to Leads while Viewer had *broader*. Row 1 now mirrors `lead.view` exactly: **`A A A A A C`**, with the Viewer cell conditional and masked. The same correction is applied to `contact.view`, `ticket.view`, `knowledge.view` and `quote.view`.

## 5. Deferred permissions are registered, not minted (`V-M05`)

The previous revision had `B14_05`'s `CA-09` row listing `quote.*`, `product.manage` and `form.manage` among permissions to mint at I1/I5, while §3 said they ship with their deferred gaps — a direct contradiction.

**Resolved:** `CA-09` mints, in the approved waves, **only the 19 non-deferred codes**. The 7 deferred codes are **registered in this matrix** (so no future implementer invents a different shape) and are **minted only when their gap is undeferred**. A permission row created for a capability that is not built is scaffolding a deferred capability, which `B14_25` §3 forbids.

`T-RBAC-7` **(NC)** asserts the 7 deferred codes exist in **no** permission table row and are granted to **no** role in the approved waves.

## 6. Platform Operator — a separate namespace

| Property | Value |
|---|---|
| Where defined | `B13_OPERATOR_MODEL.md` — **not** `B1_AUTHORIZATION_RBAC.md` |
| Stored as | Staff/platform identity, **never a `memberships.role` value** |
| Permissions | `platform.operations.view`, `platform.operations.replay` |
| Scope | Platform operations only — dead letters, reconciliation cases, integration connections, audit search |
| **Tenant data** | **None.** Never reads or writes a Lead, Customer, Contact, Message, Deal or `revenue_events` row |
| Surface | Django Admin (`B14_12`) |
| Guards | Mandatory reason where the frozen command requires one; distinguishable operator actor in every audit row (`FI-B1-09` T24); superuser is **not** a business-authorization path |

**Platform Operator appears in no cell of §4's matrix**, because it is not a workspace role. `T-RBAC-4` **(NC)** asserts it is never treated as one.

## 7. Viewer masking (`PD-002`) — implementation contract

Applies to `contacts.phone`, `contacts.phone_normalized`, `contacts.email` wherever they surface: contacts list/detail, Lead 360, Customer 360, conversation context, exports, **and any AI provider egress**.

| Rule | Implementation |
|---|---|
| Where | `crm/selectors/contacts.py` — a single `mask_contact_pii(actor, row)` applied **before** serializer construction |
| Never | in the serializer, the template, or the frontend |
| Format | last-4 for phone (`•••• 4821`), domain-only for email (`•••@clinic.example`) — never the raw value |
| Exemption | actors holding `contact.manage` or a domain permission granting full detail |
| **`CA-15` display identity** | When `display_name` is **Contact-derived** (a Business-less Lead), it is a Contact field and **is masked for Viewer on every surface**, including list, 360, export and AI egress. A Business-derived `display_name` is not PII and is not masked |
| Egress | masking is applied **before** the AI adapter is called, not after |
| Test | `T-MASK-1..5`: a Viewer's API response body contains **no** full phone or email for any surface |

## 8. Role → permission → command → UI trace

| Role | Representative authority | UI |
|---|---|---|
| **Owner** | Everything, including `customer.merge`, `customfield.manage`, `agent.manage`, `ownership.transfer` | all |
| **Admin** | Everything Owner holds except workspace lifecycle and ownership transfer | all |
| **Manager** | Team-wide CRM, tickets, imports, assignment; **no** merge, **no** field definitions, **no** agent configuration | all except admin settings |
| **Sales** | Full create/update on customers, contacts, tickets, quotes; own-scoped assign/resolve/send; **may not** accept quotes, merge, import or define fields | own-scoped lists |
| **`member`** | **Reads every working record; creates and updates within workspace scope (conditional); own-assigned completion only; routes nobody's work; holds no administrative permission** | working lists, no admin affordances |
| **Viewer** | Read-only, **masked contact PII**, conditional workspace scope; no mutation anywhere | read-only, no mutation affordances |
| *Platform Operator (B13)* | *Platform operations only, never tenant data* | *Django Admin* |

**Every protected UI action in `B14_21` maps to exactly one backend permission. A UI action without one is a defect.**

## 9. Tests — semantic assertions

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-RBAC-1` **(NC)** | Implemented role enum | Enumerate `memberships.role` values | Exactly **six**: `owner`, `admin`, `manager`, `sales`, **`member`**, `viewer`. **No seventh; none removed** |
| `T-RBAC-2` **(NC)** | Frozen B1 §3 matrix + implemented matrix | Diff every frozen permission × role cell | **Zero changed cells.** Any difference fails |
| `T-RBAC-3` **(NC)** | All 26 additive permissions | For each, read its cell for all six roles | **156 cells defined.** A missing, null or inherited cell fails |
| `T-RBAC-4` **(NC)** | Platform Operator identity | Attempt any tenant-scoped endpoint; inspect role enum | Operator is **not** a `memberships.role` value and resolves **no** tenant permission |
| `T-RBAC-5` **(NC)** | Authenticated session | Send `role`, `permissions` and `workspace_id` in body, query and headers | **All ignored.** Authority derives only from session + membership (`FI-B0-07`) |
| `T-RBAC-6` | Each of the six roles | Call every new command | Outcome matches the §4 cell exactly, including every `C` condition |
| `T-RBAC-7` **(NC)** | Approved waves complete | Enumerate permission rows | The **7 deferred codes** are absent and granted to no role |
| `T-RBAC-8` **(NC)** | `member` session | Call each administrative command (`archive`, `merge`, `import.manage`, `customfield.manage`, `assignment.manage`, `agent.manage`, `knowledge.manage`) | **`403` on every one** |
| `T-RBAC-9` | `member` session, valid AI quota | `AcceptAgentProposal` | Conditional per frozen `ai.use` `C`; the **target command's own permission is also required** |
| `T-RBAC-C1..3` **(NC)** | Viewer session | `GET /contacts`, Lead 360, Customer 360, export, AI egress | Phone/email masked in **every** response body; Contact-derived `display_name` masked |
| `T-RBAC-10` **(NC)** | Every new endpoint | Enumerate | Each maps to **exactly one** permission; an endpoint without one fails |
