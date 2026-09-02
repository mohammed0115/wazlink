# B9 — Domain Ownership

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Method

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` already registers **Revenue** and **Attribution** as domains with named aggregates, tables, commands and events. B9 designs those registrations rather than inventing new ones. Every owned entity below is either a frozen B0 entity or an explicitly amended addition (`B9_CONTROLLED_AMENDMENTS.md`).

## 2. Owned entities

| # | Entity | Table | Public ID | Identity | Mutability | Origin |
|---|---|---|---|---|---|---|
| 1 | **RevenueEvent** | `revenue_events` | **`REV-*`** (frozen, registry §A) | `(workspace_id, public_id)` | **immutable** except the derived `status` column (§4) | FROZEN — B0 Revenue row |
| 2 | **RevenueReversal** | `revenue_reversals` | `REVR-*` (additive, `B9-AM-002`) | `(workspace_id, public_id)` | **immutable**, append-only | FROZEN table name — B0 Revenue table group |
| 3 | **AttributionTouchpoint** | `attribution_touchpoints` | **`ATT-*`** (frozen, registry §A) | `(workspace_id, public_id)` | **immutable**, append-only | FROZEN — B0 Attribution row |
| 4 | **RevenueAttribution** | `revenue_attributions` | none — addressed by its `RevenueEvent` | `(revenue_event_id)` — at most one per event | **immutable** | ADDITIVE (`B9-AM-004`) |
| 5 | **FinancialReconciliationCase** | `financial_reconciliation_cases` | `FRC-*` (additive, `B9-AM-005`) | `(workspace_id, public_id)` | status/assignment mutable; evidence immutable | ADDITIVE (`B9-AM-006`) |

```
OWNED_ENTITY_COUNT = 5
```

Row 4 exists because first-touch attribution must be **snapshotted at recognition time** and must not silently change when a Lead is edited or a Business is rediscovered (`B9_FIRST_TOUCH_MODEL.md` §6). It is a separate immutable row rather than columns on `revenue_events`, because the frozen `RevenueEvent` DTO is `additionalProperties: false` and because attribution is a distinct frozen domain with its own lifecycle.

Row 5 exists because frozen `BACKEND_RECONCILIATION.md` mandates that "every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time" while its own process table has **no Revenue row**. B9 adds the row and the entity that carries those seven required fields.

## 3. Referenced but **not** owned

B9 reads these on demand and never writes them. No B9 application service holds a write path, ORM manager, or migration authority for any of them.

| # | Entity | Owner | Why B9 references it | Access |
|---|---|---|---|---|
| 1 | Workspace | B1 | tenancy root for every B9 row | read |
| 2 | Membership | B1 | the recognizing/reversing/resolving actor | read |
| 3 | Role/permission | B1 | authorization of every B9 command | read |
| 4 | Deal | B6 | a `source_ref` may point at `DEAL-*`; commercial context only | read |
| 5 | Lead | B2 | provenance chain for first-touch; `source_ref` may point at `LEAD-*` | read |
| 6 | Contact | B2 | provenance display only | read |
| 7 | Business | B3 | provenance chain for first-touch | read |
| 8 | DiscoveryJob | B3 | provenance chain — the acquisition job | read |
| 9 | DiscoveryResult | B3 | **the derived first-touch candidate source** — B9 reads `discovery_results` at recognition time so Track-A attribution works without a touchpoint writer (`B9_FIRST_TOUCH_MODEL.md` §2.2) | read |
| 10 | DiscoverySource | B3 | display-name resolution for a snapshot's `source_code`. A bounded **global** catalogue and a **contract string**, never an `EntityRef`, never workspace-resolved (`B9-D-A037`) | read |
| 11 | Payment | B8 | recognition evidence when `source_type='payment'`; reconciliation | read |
| 12 | Invoice | B8 | recognition evidence when `source_type='invoice'`; reconciliation | read |
| 13 | Subscription | B8 | reconciliation context only | read |
| 14 | Refund | B8 | refund evidence for reconciliation — `payment_ref`, `amount`, `currency`, `status`, `created_at` (`B9-AM-009`). B9 owns no refund and creates none | read |
| 15 | AuditLog | B0/Audit | every B9 financial command writes an audit fact through the audit writer | append via audit writer |
| 16 | OutboxEvent | B0 | B9 produced events are published through the frozen transactional outbox | append |

```
REFERENCED_ENTITY_COUNT = 16
```

### 3a. Declared non-dependencies — listed, and deliberately **not** counted as references

These are recorded so the absence is visible rather than assumed. They are **not** referenced by any B9 code path, and counting them as referenced entities — as an earlier draft did — overstated B9's coupling by describing a non-reference as a reference.

| Entity | Owner | Statement |
|---|---|---|
| TaxInvoice | B10 (future) | **not referenced in Phase 1.** B9 reads no tax entity and would function identically if B10 never existed (`B9_B10_TAX_BOUNDARY.md` §6) |
| AutomationRun | B7 | **not referenced.** Automation holds no B9 authority, permission, or path (`B9_B7_AUTOMATION_BOUNDARY.md` §1) |

```
DECLARED_NON_DEPENDENCY_COUNT = 2
```

The two counters are reported separately and never summed: `REFERENCED_ENTITY_COUNT` counts entities B9 actually reads or appends to; `DECLARED_NON_DEPENDENCY_COUNT` counts entities B9 states it does not touch.

## 4. `RevenueEvent.status` — the one non-immutable column, and why it is safe

The frozen `RevenueEvent` DTO requires a `status` field. B9 defines it as a **derived, monotonic projection of reversal state**, not an independently settable field:

| Status | Meaning | Derivation |
|---|---|---|
| `recognized` | no reversal exists | `Σ gross = 0` |
| `partially_reversed` | reversed in part | neither of the other two |
| `reversed` | fully reversed | `Σ gross = gross_amount` **AND** `Σ net = net_amount` |

`reversed` requires **both** folds, and each conjunct guards a different failure. Deriving it from gross alone would let an event be marked fully reversed while net recognized revenue survived on it — unreversible, and with its source released for re-recognition (`B9-D-A034`). Deriving it from net alone would do the mirror: a rounding residual can exhaust the net fold while real gross revenue is still outstanding, and labelling that `reversed` would release the source early (`B9-D-A040`). The residual is retired by the terminal gross-cleanup reversal (`B9_REVERSAL_MODEL.md` §4.1a), after which both conjuncts are true together.

No command sets `status` directly. It is recomputed inside the same transaction that inserts a `revenue_reversals` row, under the row lock that transaction already holds (`B9_IDEMPOTENCY_CONCURRENCY.md` §4). Transitions are monotonic — `recognized → partially_reversed → reversed` — and never move backwards, because reversals are append-only and never deleted. `gross`, `net`, `currency`, `recognized_at`, `source_type` and `source_ref` are immutable for the life of the row. `UNCONTROLLED_REVENUE_MUTATION_PATHS = 0`.

The two mutable columns on `financial_reconciliation_cases` — its status/assignment fields and, once, its resolution key and hash — are operational, not financial: no case field is an input to any revenue total.

## 5. Write surface

B9's entire write surface is the five tables in §2, plus append-only audit and outbox rows through the frozen shared writers. B9 holds:

- no write path to `deals`, `pipelines`, `pipeline_stages` (B6)
- no write path to `payments`, `invoices`, `subscriptions`, `refunds`, `upgrade_quotes` (B8)
- no write path to `automation_rules`, `automation_runs`, `automation_run_steps` (B7)
- no write path to `leads`, `contacts`, `tasks`, `appointments` (B2)
- no write path to `businesses`, `discovery_jobs`, `discovery_results` (B3) — `discovery_results` is **read** for derived attribution candidates and never written (`AT-FT-13` **NC**)
- no write path to `tax_invoices`, `tax_lines`, `tax_submissions` (B10)

This mirrors the frozen B0 rule that ORM imports across bounded contexts are not permitted in domain code, and is proved per-domain in `B9_REVENUE_FIREWALL.md` §3.

## 6. Deliberately **not** created

| Candidate | Verdict | Reason |
|---|---|---|
| `AttributionAllocation` (generic n-way allocation table) | **not created** | Phase 1 is first-touch: exactly one winner at 100%. A generic allocation table would introduce rounding, split-percentage and sum-to-100 failure modes that Phase 1 cannot produce. `B9-D-A016`; the upgrade path is recorded as `B9-D-B002`. |
| `RecognitionReference` | **not created** | `source_type` + `source_ref` (frozen polymorphic contract) already carries the reference; a second indirection adds no information. `B9-D-A007`. |
| `FinancialAdjustment` | **not created** | Every correction in Phase 1 is either a reversal (`revenue_reversals`) or a new recognition. A third mutation shape would be a fourth way to change a total. `B9-D-A011`. |
| `RevenueSchedule` / instalment plans | **not created** | No frozen or frontend evidence of period spreading. `B9-D-B001` is the single record for schedules; `B9-D-C002` covers the accounting-standard concepts (deferred revenue, performance obligations) separately. |
| Revenue projection/snapshot table | **not created** | Selectors compute from the register; a materialized projection is a B12/Analytics concern with its own freshness contract (`B9_ANALYTICS_PROJECTIONS.md` §6). |

## 7. Negative controls

`AT-DOM-1` **(NC)**: any B9 table, command handler or service holding a write reference to a B2/B3/B6/B7/B8/B10-owned table — fails.
`AT-DOM-2` **(NC)**: a sixth B9-owned authoritative table appearing without a controlled amendment — fails.
`AT-DOM-3` **(NC)**: an implementation exposing a `DELETE` path against `revenue_events` or `revenue_reversals` — fails; no such operation exists in `B9_API_DTO_CONTRACTS.md` and both tables carry no `deleted_at` column.
