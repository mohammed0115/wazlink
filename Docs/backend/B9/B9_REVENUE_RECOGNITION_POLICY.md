# B9 — Revenue Recognition Policy

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> This is **WazLink Phase-1 product policy**. It is not an accounting standard and asserts no statutory or IFRS compliance (`B9_FINANCIAL_MODEL.md` §7).

## 1. The policy in one sentence — resolved (Class A, `B9-D-A004`)

**Revenue is recognized when, and only when, an authorized human actor issues a successful `RecordRevenueEvent` command naming a resolvable in-workspace source, an explicit amount, an explicit currency, an explicit recognition timestamp, and a durable idempotency key.**

Frozen `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007 fixes this: *"Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent. The actor, source, amount, currency, recognition date, and idempotency key are mandatory for explicit recognition."* All six mandatory inputs are honoured below.

**Phase 1 ships no "explicitly approved recognition rule."** ADR-007 permits one to exist; B9 Phase 1 defines none, so the *only* path to a `RevenueEvent` is the explicit command. Any future rule is a Class-A decision of its own (`B9-D-C001`), never a default.

## 2. The deterministic answers

| Question | Phase-1 answer |
|---|---|
| **WHAT qualifies as revenue?** | An amount an authorized actor asserts the workspace has earned from its own customer, evidenced by a resolvable in-workspace `source_type`+`source_ref`. WazLink's own platform billing is categorically excluded (§5). |
| **WHEN does recognition occur?** | At the moment the command commits. The *reporting* period is governed separately by the caller-supplied `recognized_at` (§6, `B9_TIME_PERIOD_MODEL.md`). |
| **WHAT upstream evidence is required?** | A `source_ref` that resolves, in the caller's workspace, to a live entity of the declared `source_type`. The closed `source_type` set is in §4. |
| **WHO may authorize?** | A membership holding `revenue.recognize` (`B9_RBAC_TENANCY.md` §2). Never `system:automation`, never a provider, never the frontend (`B9-D-A022`). |
| **WHAT amount?** | Exactly the `gross` and `net` supplied. B9 derives neither from Deal value, plan price, payment amount, nor anything else (`B9-D-A006`). |
| **WHAT currency?** | Exactly the supplied ISO-4217 `currency`, immutable thereafter. No conversion, ever (`B9-D-A017`). |
| **WHAT timestamp controls the period?** | `recognized_at`, stored UTC (`B9-D-A019`). |
| **WHAT is the idempotency identity?** | `(workspace_id, idempotency_key)`, plus an independent canonical-source guard `(workspace_id, source_type, source_entity_type, source_public_id)` (§7). |
| **HOW are duplicates handled?** | Same key + same payload replays the stored result; same key + different payload is `IDEMPOTENCY_CONFLICT`; a second event for the same source is `B9-AF-002` (§7). |
| **HOW are corrections performed?** | Never by edit. A compensating reversal, and where appropriate a fresh recognition (`B9_REVERSAL_MODEL.md` §7). |
| **HOW are refunds handled?** | A refund is *evidence*, not an action. An authorized actor issues `ReverseRevenueEvent`; B8 refunds never auto-reverse (`B9_B8_BILLING_BOUNDARY.md` §6). |
| **HOW are reversals handled?** | Append-only compensating rows. The caller supplies `gross`; the `net` is **derived** from the event's own gross→net ratio, so exhausting gross always exhausts net (`B9_REVERSAL_MODEL.md` §4, `B9-D-A033`). The converse does not hold — rounding can exhaust net first, and the terminal gross-cleanup reversal closes the residual (`B9-D-A040`, §4.1a). |
| **IS partial recognition supported?** | Yes — by recognizing a smaller amount than the source's face value, and by recognizing more than once against distinct sources. B9 does **not** provide a schedule or instalment engine (`B9-D-B001`). |
| **IS manual recognition supported?** | Yes — and in Phase 1 it is the **only** mode (§3). |
| **Payment exists but conditions unmet?** | Nothing happens. No revenue. Reconciliation raises a `payment_without_recognition` case for a human to act on (`B9_RECONCILIATION_MODEL.md` §3). |

## 3. Manual recognition — resolved (Class A, `B9-D-A008`)

**MANUAL_RECOGNITION = YES, and it is the only Phase-1 mode.** There is no automatic, rule-driven, event-driven or provider-driven recognition path anywhere in B9. This is not an omission — it is the design:

- it is exactly what ADR-007's "explicit recognition" clause describes;
- it makes the firewall provable by construction rather than by policy — there is *no* code path from any upstream event to a `RevenueEvent`, so no upstream event can leak into revenue;
- it matches the frozen frontend, which contains no automatic recognition and no recognition UI at all.

Because manual is the only mode, "manual recognition" carries no special permission, no separate command, and no lesser audit standard. Its controls are the ordinary ones:

| Control | Requirement |
|---|---|
| Permission | `revenue.recognize` |
| Actor | a named `membership_id`, persisted on the row as `recognized_by_membership_id` |
| Reason | free-text `note` (≤ 1000 chars), optional; the *evidence* is the mandatory `source_ref` |
| Evidence | `source_type` + `source_ref`, resolvable in-workspace; existence-only, never a source of any amount |
| Amount validation | §8 |
| Currency | mandatory ISO-4217; must equal `gross.currency` and `net.currency` |
| Idempotency | mandatory `idempotency_key` |
| Audit | one immutable audit fact per command, via the frozen audit writer |
| Reversal | `ReverseRevenueEvent`, `revenue.reverse` |
| Workspace | the actor's active workspace; `source_ref` must resolve inside it |

**There is no admin bypass.** No SQL path, no superuser flag, no "backfill" endpoint, no import that writes `revenue_events` directly. Frozen `BACKEND_RECONCILIATION.md` already states the rule B9 inherits: *"Admin cannot edit financial truth directly with SQL."* `AT-REC-14` **(NC)**.

## 4. The closed `source_type` set — resolved (Class A, `B9-D-A005`)

Frozen `BACKEND_DTO_CONTRACTS.md`: *"`source_type` + `source_ref` is the canonical polymorphic source contract and replaces separate typed `business_ref`/`lead_ref`/`deal_ref`/`external_payment_ref`/`invoice_ref` fields."* B9 closes the set to exactly the five types that contract enumerates, plus nothing:

| `source_type` | `source_ref` resolves to | Owner | Phase-1 eligibility |
|---|---|---|---|
| `deal` | `DEAL-*` | B6 | eligible — the ordinary case. Deal need **not** be `won` (§9) |
| `lead` | `LEAD-*` | B2 | eligible — revenue from a customer with no Deal record |
| `business` | `BUS-*` | B3 | eligible — revenue attributed to a discovered business directly |
| `payment` | `PAY-*` | B8 | **eligible only for non-platform payments**; see §5 |
| `invoice` | `INV-BILL-*` | B8 | **eligible only for non-platform invoices**; see §5 |

An unrecognised `source_type` is `B9-AF-004`. A `source_ref` that does not resolve in-workspace is `B9-AF-005` (`ENTITY_NOT_FOUND`, never distinguishing "absent" from "another workspace's"). A `source_ref` whose entity type contradicts `source_type` is `B9-AF-006`.

## 5. Platform billing is categorically excluded — resolved (Class A, `B9-D-A021`)

Frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`: *"A successful WazLink subscription payment is platform Billing, not a customer Deal revenue event."* Frozen `BACKEND_ANALYTICS_SEMANTICS.md`: *"Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent."*

Therefore a `PAY-*`/`INV-BILL-*` that belongs to a **WazLink platform subscription lineage** — i.e. any payment or invoice whose subscription reference resolves to the workspace's own WazLink `Subscription` — is **not eligible** as a recognition source. Attempting it is `B9-AF-007` (`PLATFORM_BILLING_NOT_RECOGNIZABLE`, 422).

This leaves `payment`/`invoice` source types available only for a future non-platform payment record. Phase-1 B8 models **only** platform billing, so in practice `B9-AF-007` rejects every `payment`/`invoice` source a Phase-1 workspace could construct. The types are kept eligible-in-principle because the frozen polymorphic contract enumerates them and B8's own boundary document §4 explicitly anticipates them; they are gated rather than deleted so that no future phase has to re-open the frozen DTO. `AT-B8-3` **(NC)** proves the gate.

## 6. Recognition timing vs recognition period

Two distinct instants, never conflated (`B9_TIME_PERIOD_MODEL.md`):

- **`created_at`** — when the row was written. System truth, never caller-supplied.
- **`recognized_at`** — the caller-supplied instant that determines the reporting period.

`recognized_at` may be **backdated** within a bounded window and may **not** be future-dated beyond a small clock-skew tolerance (`B9-D-A019`, `B9_TIME_PERIOD_MODEL.md` §5). Backdating is permitted because late recognition of a real past event is normal; future-dating is refused because it would let a workspace book revenue into a period that has not happened.

## 7. Idempotency and the duplicate-source guard

Two independent guards, neither substituting for the other:

| Guard | Constraint | Stops |
|---|---|---|
| **Key** | `UNIQUE (workspace_id, idempotency_key)` | a retried or replayed *request* creating a second event |
| **Source** | `UNIQUE (workspace_id, source_type, source_entity_type, source_public_id)` **WHERE** `status <> 'reversed'` | two *different* requests both recognizing the same live source |

The four-column tuple is the **canonical recognition-source identity** and is used in exactly this form everywhere in B9 — the storage index, this policy, the command catalog and the idempotency register (`N-9`). An earlier draft wrote the identity as `(workspace_id, source_type, source_ref)` in prose and indexed `(workspace_id, source_type, source_public_id)` in storage, dropping `source_entity_type`; the two were harmless in practice but were not the same constraint, and only one of them can be the specification.

The source guard is what makes "payment replay cannot duplicate recognized revenue" true even when the two attempts carry different idempotency keys (`AT-IDEM-6`). A second recognition against an already-recognized source is `B9-AF-002` (`DUPLICATE_RECOGNITION`, 409) — not silently merged.

The predicate `status <> 'reversed'` exists for exactly one reason, stated in `B9_REVERSAL_MODEL.md` §7: a **fully reversed** event releases its source so a correction can re-recognize it. A live or partially-reversed event does not.

This is safe only because `reversed` requires **both** folds exhausted (`B9-D-A034`) — and *both* is load-bearing in each direction: a gross-only rule releases a source while net revenue stands, and a net-only rule releases it while a gross rounding residual is still open (`B9-D-A040`). Under the earlier gross-only rule, a reversal of `gross=1000, net=1` against a `1000/800` event flipped the status while 799 net revenue still stood on it — releasing the source and letting the same `DEAL-*` be recognized again on top of revenue the register had already declared fully reversed. A source is now released only when the event retains zero gross **and** zero net. `AT-REC-15` **(NC)**. Recognizing the same source twice *concurrently* (e.g. two instalments against one Deal) is not Phase-1 supported — the caller supplies a distinct `source_ref`, or the capability is added under `B9-D-B003`, deferred because no Phase-1 evidence requires it and a wider escape hatch invented now would be the exact hole the guard exists to close.

## 8. Amount validation

| Rule | Failure |
|---|---|
| `gross.amount` and `net.amount` are decimal strings matching the frozen `Money` pattern | `B9-AF-008` |
| `gross.amount > 0` | `B9-AF-009` — zero and negative recognitions are refused; a negative "recognition" is a reversal |
| `net.amount > 0` | `B9-AF-009` |
| `net.amount ≤ gross.amount` | `B9-AF-010` |
| `gross.currency = net.currency = currency` | `B9-AF-011` (the frozen DTO's own mirror rule) |
| `currency` is a syntactically valid ISO-4217 code | `B9-AF-012` |
| scale ≤ 4 decimal places | `B9-AF-008` |

These rules govern **recognition**. A reversal supplies only `gross`; its `net` is derived (`B9_REVERSAL_MODEL.md` §4.1), so `B9-AF-009`/`B9-AF-010` are recognition-only rules.

`gross` vs `net` is a **caller assertion**, not a computation: B9 does not compute discounts, fees, or tax. What "net" means commercially is the workspace's own business judgment; B9 stores it, reports it, and constrains only its arithmetic relationship to gross.

## 9. A Deal need not be `won`

Deliberate and load-bearing. If B9 required `Deal.status = 'won'` before allowing a `deal`-sourced recognition, it would have re-created the coupling the entire firewall exists to prevent — recognition would become a function of pipeline state, and a Deal reopening would raise the question of un-recognizing. B9 asks only that the `DEAL-*` **resolve in-workspace**. The Deal's status is recorded in the reconciliation surface as context, and a recognition against a non-won Deal raises a `recognition_against_open_deal` reconciliation case for human review (`B9_RECONCILIATION_MODEL.md` §3) — a *signal*, never a rejection. `B9-D-A023`; `AT-B6-5`.

## 10. Negative controls

`AT-REC-9` **(NC)**: any code path creating a `revenue_events` row other than a committed `RecordRevenueEvent` — fails.
`AT-REC-10` **(NC)**: an implementation defaulting `gross`/`net` from `Deal.value`, `Plan.price`, or `Payment.amount` when the caller omits them — fails; all three are mandatory inputs (frozen `RevenueEventCreate.required`).
`AT-REC-11` **(NC)**: an implementation accepting `recognized_at` more than the tolerance into the future — fails (`B9-AF-016`).
`AT-REC-14` **(NC)**: any admin/import/backfill surface writing `revenue_events` outside the governed command — fails.
`AT-REC-15` **(NC)**: a source released for re-recognition while its original event still carries net recognized revenue — fails (§7, `B9-D-A034`).
`AT-REC-16` **(NC)**: an implementation whose source guard omits `source_entity_type` from the identity — fails; one canonical tuple, used everywhere (§7).
