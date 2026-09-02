# B8 — Implementation Readiness

> `IMPLEMENTATION_HANDOFF = PASS`. No coding is authorized by this pack — this document evaluates whether a later implementation agent could act on it without inventing a Class-A decision.
>
> **`B8-FIX.1` applied** — a first independent audit found `IMPLEMENTATION_HANDOFF = FAIL`, blocked by one MAJOR gap: entitlement-override precedence had no rule for multiple simultaneously active overrides on one `(workspace, code)`. `B8-D-A021` closes it (§1 row "Override multiplicity/semantics"). See `B8_VERIFICATION_MATRIX.md` §9 for the full repair record.
>
> **`B8-FIX.2` applied** — a fresh independent re-countersign confirmed `B8-D-A021` itself closed, but found a materially separate MAJOR gap: no rule defined what a metered override resolves to once the workspace's base plan subsequently changes (an implementer would have had to invent whether an upgrade past a frozen override value is honored). `B8-D-A022` closes it (§1 row "Override × plan-change resolution") — effective limit is always `MAX(current_base_limit, override.value)`, recomputed fresh on every resolution, never the override's frozen value applied unconditionally.

## 1. Handoff checklist (brief §48)

| Area | Answer | Evidence |
|---|---|---|
| Entity ownership | closed | `B8_DOMAIN_OWNERSHIP.md`, `B8_STORAGE_MODEL.md` |
| Subscription state | closed | `B8_SUBSCRIPTION_STATE_MACHINE.md` |
| Plan versioning | closed | `B8_PLAN_CATALOG.md` |
| Price snapshot | closed | `B8_CHECKOUT_PAYMENT_MODEL.md` §2 |
| Entitlement resolution | closed | `B8_ENTITLEMENT_MODEL.md` |
| Override multiplicity/semantics (`B8-D-A021`, `B8-FIX.1`) | closed — at most one active override per `(workspace, code)`, DB-enforced; boolean=absolute grant; metered=absolute stored value; corrupt state fails closed | `B8_ENTITLEMENT_MODEL.md` §5/§5a/§5b/§5c, `B8_STORAGE_MODEL.md`, `B8_CONCURRENCY_MODEL.md` C11–C12 |
| Override × plan-change resolution (`B8-D-A022`, `B8-FIX.2`) | closed — effective metered limit is always `MAX(current_base_limit, override.value)`, recomputed fresh on every resolution against the currently effective `PlanVersion`/trial; an override row is never rewritten by an upgrade, downgrade, trial conversion, or catalog-only plan-version publish | `B8_ENTITLEMENT_MODEL.md` §5b/§5b-i, `B8_UPGRADE_DOWNGRADE_MODEL.md` §8, `B8_CONCURRENCY_MODEL.md` C13 |
| Usage limits / quota authority | closed | `B8_USAGE_QUOTA_MODEL.md` |
| Trial | mechanism closed, activation withheld by explicit gate | `B8_TRIAL_MODEL.md` |
| Upgrade | closed | `B8_UPGRADE_DOWNGRADE_MODEL.md` §1–3 |
| Downgrade | closed | `B8_UPGRADE_DOWNGRADE_MODEL.md` §4–5 |
| Cancellation | closed (Phase-1 scope explicit) | `B8_UPGRADE_DOWNGRADE_MODEL.md` §6 |
| Payment checkout | closed | `B8_CHECKOUT_PAYMENT_MODEL.md` |
| Provider boundary | closed | `B8_PAYMENT_PROVIDER_PORT.md`, `B8_TAP_PROVIDER_BOUNDARY.md` |
| Webhook authority | closed | `B8_WEBHOOK_MODEL.md` |
| Idempotency | closed | `B8_IDEMPOTENCY_MODEL.md` |
| Concurrency | closed | `B8_CONCURRENCY_MODEL.md` |
| Reconciliation | closed | `B8_RECONCILIATION_MODEL.md` |
| RBAC | closed, zero new permissions | `B8_RBAC_TENANCY.md` |
| Tenancy | closed | `B8_RBAC_TENANCY.md` §5 |
| API DTOs | closed | `B8_API_DTO_CONTRACTS.md` |
| Failures | closed | `B8_FAILURE_CATALOG.md` |
| Events (produced/consumed) | closed | `B8_COMMAND_EVENT_CATALOG.md` |
| B9 firewall | closed | `B8_REVENUE_FIREWALL.md`, `B8_B9_FINANCE_BOUNDARY.md` |
| B10 firewall | closed | `B8_B10_TAX_BOUNDARY.md` |
| Security | closed | `B8_SECURITY_THREAT_MODEL.md` |
| Observability | closed | `B8_OBSERVABILITY_AUDIT.md` |

Every row is "closed" in the sense that an implementer has one, and only one, deterministic answer to follow — not that every number is final (illustrative Phase-1 catalog figures, per `B8-D-B008`, remain Product-Owner-adjustable data, not an open architecture question).

## 2. What remains explicitly gated (not a readiness gap)

`B8-D-B001` (trial activation), `B8-D-B002`/`B8-D-B003` (exact Tap status/recurring-charge mapping — `REQUIRES PROVIDER CONTRACT VALIDATION`, matching B0's own identical marker), `B8-D-B004` (step-up re-auth policy), `B8-D-B009` (retention durations), `B8-D-B010` (Tap webhook endpoint precedence). None of these blocks a Phase-1 implementer: each has a safe, fully-specified default behavior (trial inactive; fail-closed unmapped-status handling; session-auth-only; conservative non-deletion default; order-independent consumer design) that ships correctly without the gated question being answered first.

## 3. Pre-implementation gate (mirrors every prior phase's own gate)

Before coding: (a) CTO approval of the 7 `B8_CONTROLLED_AMENDMENTS.md` items against frozen B0; (b) resolution or formal acceptance of the 10 Class B items in `B8_DECISION_REGISTER.md`, at minimum confirming the Phase-1-safe defaults are acceptable to ship as-is; (c) a live Tap sandbox validation pass against `B8_TAP_PROVIDER_BOUNDARY.md`'s `UNRESOLVED=yes` rows before the adapter is built; (d) independent CTO verification of this pack, per brief §51 — this pack is left uncommitted for exactly that purpose.

## 4. Consistency self-check performed during authoring

- Every frozen prefix (`PLAN-`, `SUB-`, `UPQ-`, `INV-BILL-`, `PAY-`, `TAX-`, `WHR-`) is reused verbatim; zero new prefixes minted.
- Every frozen command/event name (`CreateUpgradeQuote`, `CancelUpgradeQuote`, `CreatePayment`, `ProcessPaymentWebhook`, `ReconcilePayment`, `UpgradeQuoteIssued/Consumed/Expired`, `PaymentSucceeded/Failed`, `SubscriptionActivated`, `InvoiceIssued`) is reused verbatim; zero renamed.
- Every frozen permission (`billing.view`, `billing.manage`, `subscription.change`, `payment.manage`) is reused verbatim; zero new permissions.
- Every frozen error code is reused verbatim; 6 new `code` values added inside the existing envelope/status doctrine, zero new HTTP status.
- Every frozen closed-vocabulary item from B1 (5 metrics, 6 capabilities, 4 statuses, 3 reasons, 3 plans) is reused verbatim; zero additions.
- Zero B9/B10 file was created by this pack (`ls Docs/backend/B9 Docs/backend/B10` confirmed absent).
- Zero `.py`/migration file exists anywhere under this pack's output.

## `IMPLEMENTATION_HANDOFF = PASS`
