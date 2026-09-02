# B8 — Domain Ownership

> Design only. No Django app, model, or migration is created in B8.

## 1. Scope statement

B8 is one bounded context, "Billing & Entitlements," realized as two Django apps already named in `B0_BACKEND_BLUEPRINT.md`'s target package structure — `apps/entitlements/` and `apps/billing/` — with a single-owner write split resolved by `B8-D-A001` (§3). B8 owns commercial ACCESS CONTROL and SUBSCRIPTION STATE. It answers "what is this workspace entitled to right now," never "how much revenue has been recognized" (§`B8_B9_FINANCE_BOUNDARY.md`) and never "is this a valid ZATCA tax document" (§`B8_B10_TAX_BOUNDARY.md`).

## 2. Sub-module split

| Sub-module | Django app | Aggregate root(s) | Authoritative tables | Allowed writers |
|---|---|---|---|---|
| Plan Catalog | `entitlements` | Plan | `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas` | Plan Catalog admin service only (internal/ops, not client-facing in Phase 1) |
| Usage/Quota | `entitlements` | (none — value objects over Subscription) | `usage_counters`, `usage_ledger` | every domain that owns a metered action, each inside its own transaction (§`B8_USAGE_QUOTA_MODEL.md`) |
| Entitlement Overrides | `entitlements` | EntitlementOverride | `entitlement_overrides` | Entitlements admin service (`billing.manage`) |
| Subscription/Billing | `billing` | Subscription | `subscriptions`, `billing_customers`, `upgrade_quotes`, `invoices`, `invoice_lines`, `payments`, `payment_attempts`, `refunds` | Billing service only |

`entitlements` never writes `subscriptions`; it reads the workspace's current `Subscription` (via an application-service call, never raw SQL/ORM cross-app import) to resolve capability/quota decisions. `billing` never writes `plans`/`plan_versions`/`quota_definitions`; it reads them to price a quote and to compute the plan-tier grants a newly activated subscription commits to. This is `B8-D-A001` (§3), a controlled clarification of the pre-B8 ambiguity in `BACKEND_DOMAIN_OWNERSHIP.md` and `BACKEND_DATA_MODEL.md`, where both the "Entitlements" and "Billing" rows listed `subscriptions` among their own authoritative tables.

## 3. `B8-D-A001` — Subscription write-ownership clarification

**Question.** Frozen `BACKEND_DOMAIN_OWNERSHIP.md` lists `subscriptions` as an authoritative table of both the Entitlements row (aggregate root `Subscription`) and the Billing row (aggregate root `Subscription/Invoice/UpgradeQuote`). Frozen `BACKEND_DATA_MODEL.md`'s Entitlements table group also lists `subscriptions` alongside `plans, capabilities, plan_capabilities, quota_definitions, usage_counters, usage_ledger`, while the Billing table group separately lists `subscriptions, upgrade_quotes, invoices, ...`. Two frozen documents therefore name two different single-owners for one physical table.

**Decision.** `billing` is the sole writer of `subscriptions`. Every subscription-state transition (`CreateUpgradeQuote`→`CreatePayment`→`ProcessPaymentWebhook`→`SubscriptionActivated`, `CancelSubscription`, `ReactivateSubscription`, `ApplyScheduledDowngrade`, reconciliation repairs) is a `billing`-owned command. `entitlements` performs a read-only query against the current `Subscription` row (through an application-service call, e.g. `EntitlementService.resolve()` calling `BillingService.get_current_subscription(workspace_id)`, never a direct table join across app boundaries) when it computes an `EntitlementDecision`.

**Reason.** A single physical table must have exactly one write owner or the "cross-domain writes occur only through commands/application services" doctrine (`BACKEND_DOMAIN_OWNERSHIP.md` "Ownership principles") is unenforceable. Billing is the natural owner because every event that changes `Subscription.status` originates from a Billing-owned command or a Billing-owned webhook/reconciliation process; Entitlements never independently decides to transition a subscription.

**Enforcement artifact.** `B8_DIRECT_WRITE_FIREWALL` clause in `B8_RBAC_TENANCY.md` §5; the `entitlements` Django app's repository layer holds no ORM manager reference to the `subscriptions` model, mirroring the structural-unreachability proof pattern in `B7_DIRECT_WRITE_FIREWALL.md` §1.

**Acceptance evidence.** `AT-DWF-B8-1` (§`B8_ACCEPTANCE_TESTS.md`).

**Classification.** `COMPATIBLE_CLARIFICATION` — no frozen row is deleted or contradicted; each is read as "the domain that most directly names this table's aggregate root is its sole writer," and this decision states that explicitly rather than leaving it inferred. See `B8_CONTROLLED_AMENDMENTS.md` item 1.

## 4. `B8-D-A002` — `InitiatePlanUpgrade` / `InitiateUpgrade` reconciliation

**Question.** `BACKEND_COMMAND_EVENT_CATALOG.md` names the command `InitiatePlanUpgrade`; `BACKEND_DOMAIN_OWNERSHIP.md`'s Billing row names it `InitiateUpgrade`. Neither name maps 1:1 to a frozen OpenAPI operation — the actual frozen API surface exposes `POST /billing/upgrade-quotes` (`CreateUpgradeQuote`) and `POST /billing/payments` (`CreatePayment`) as two separate steps.

**Decision.** `InitiatePlanUpgrade` (the fuller catalog's spelling is authoritative over the abbreviated domain-ownership-matrix spelling) is recorded as the **conceptual, non-endpoint-bound name for the upgrade capability as a whole**, realized at the API layer by the frozen two-command sequence `CreateUpgradeQuote` → `CreatePayment`. No new command or endpoint is added under this name; it is a superseded/aliased label, following the identical precedent `B2_COMMAND_EVENT_CATALOG.md` used for `LeadUpdated` ("superseded by three field-specific events").

**Reason.** Both frozen names refer to the same business capability; neither was ever bound to an OpenAPI `operationId`, so nothing observable changes by clarifying which is authoritative and how it is realized.

**Classification.** `COMPATIBLE_CLARIFICATION`, item 2 in `B8_CONTROLLED_AMENDMENTS.md`.

## 5. Full domain ownership table (B8 rows only)

| Domain | Owner/module | Aggregate root | Authoritative tables | Allowed writers | Primary readers | Commands | Events | Integrations | Forbidden coupling |
|---|---|---|---|---|---|---|---|---|---|
| Plan Catalog | `entitlements` | Plan | `plans`, `plan_versions`, `plan_capabilities`, `quota_definitions`, `plan_version_quotas` | plan-catalog admin service | Billing, Entitlements, Analytics | (internal catalog seed/update — not a Phase-1 client-facing command; see §6) | none | none | no per-workspace override written here |
| Entitlement Resolution | `entitlements` | (none — stateless resolver) | reads `subscriptions` (Billing-owned), `plans`/`plan_versions`/`plan_capabilities`/`plan_version_quotas`, `entitlement_overrides`, `usage_counters` | — (read-only) | API guards, every domain's admission check, Billing | `EvaluateEntitlement` (frozen), `ReserveQuota` (frozen) | `UsageReserved` (frozen) | none | no write path to `subscriptions` |
| Entitlement Overrides | `entitlements` | EntitlementOverride | `entitlement_overrides` | Entitlements admin service | Entitlements, Billing (admin read) | `GrantEntitlementOverride`, `RevokeEntitlementOverride` | `EntitlementOverrideGranted`, `EntitlementOverrideRevoked` | none | overrides may only broaden, never restrict below plan (`B8-D-A014`) |
| Subscription/Billing | `billing` | Subscription | `subscriptions`, `billing_customers`, `upgrade_quotes`, `invoices`, `invoice_lines`, `payments`, `payment_attempts`, `refunds` | `billing` service only | Billing, Admin, Entitlements (read) | `CreateUpgradeQuote`, `CancelUpgradeQuote`, `CreatePayment`, `ProcessPaymentWebhook`, `ReconcilePayment`, `CancelSubscription`, `ReactivateSubscription`, `ScheduleDowngrade`, `ApplyScheduledDowngrade`, `BootstrapWorkspaceSubscription` | `UpgradeQuoteIssued`, `UpgradeQuoteConsumed`, `UpgradeQuoteExpired`, `PaymentSucceeded`, `PaymentFailed`, `PaymentReconciled`, `SubscriptionActivated`, `SubscriptionCancelled`, `SubscriptionReactivated`, `SubscriptionPastDue`, `SubscriptionSuspended`, `SubscriptionExpired`, `SubscriptionDowngradeScheduled`, `SubscriptionDowngradeApplied`, `InvoiceIssued` | Tap (`PaymentProviderPort`) | no CRM Revenue write; quote/payment never recognizes revenue; no ZATCA/tax authority |

## 6. Plan Catalog is not a Phase-1 self-service surface

Frozen `BACKEND_API_CATALOG.md` exposes `GET /api/v1/plans` (read-only) and nothing that writes the catalog. B8 keeps this: Plan/PlanVersion authoring is an internal, ops-managed seed process (Django Admin or a future internal console per `BACKEND_OPERATIONS_OBSERVABILITY.md` "Internal operations"), not a client-facing command, in Phase 1. This is deliberate minimalism, not an omission — see `B8_DECISION_REGISTER.md` `B8-D-B008`.

## 7. Forbidden coupling, restated

B8 never: creates `revenue_events`/`revenue_reversals`/`attribution_touchpoints` rows (`B8_B9_FINANCE_BOUNDARY.md`); creates or mutates `tax_invoices`/`tax_submissions` rows (`B8_B10_TAX_BOUNDARY.md`); writes to `leads`/`deals`/`automation_rules`/`conversations`/`discovery_jobs` or any other domain's authoritative table (`B8_RBAC_TENANCY.md` §5 firewall); is triggered automatically by an automation rule outside a governed command it itself exposes (`B8_B7_AUTOMATION_BOUNDARY.md`).

## 8. Referenced Entity Registry (`B8-FIX.2`)

**Definition.** A *referenced entity* is a non-B8-owned, non-B8-writable domain entity that B8's contracts, storage FKs, API surface, event payloads, or permission/boundary semantics directly name or depend on as a read-only reference — as opposed to an entity B8 itself owns and writes (§2, §5 above). This is distinct from, and narrower than, both candidate interpretations a prior audit found didn't reproduce a claimed `REFERENCED_ENTITY_COUNT = 15`: it is more than the 2 direct FK targets alone (`workspaces`, `memberships`), because B8's own boundary documents name several more non-owned entities by table name even without a physical FK column pointing at them; it is not the same set as the 8-table direct-write-firewall list in `B8_RBAC_TENANCY.md` §5 either, because that list is deliberately scoped to *write*-forbidden tables only and omits entities B8 references without any write concern (e.g. `memberships`, which B8 *does* have an FK to, or `revenue_reversals`/`tax_submissions`/`tax_invoice_lines`, which are named in B8's boundary documents but happen to be omitted from that particular firewall sentence).

**Method.** Every table/entity name below was found by grepping the full 36-file `Docs/backend/B8/` pack for cross-domain table references (FK columns in `B8_STORAGE_MODEL.md`; the direct-write firewall in `B8_RBAC_TENANCY.md` §5; the forbidden-coupling list in §7 above; the B7/B9/B10 boundary documents; the quota-metric ownership table in `B8_USAGE_QUOTA_MODEL.md` §1; and the shared Webhooks-domain inbox referenced throughout). Each row below is verified to actually appear as a named reference somewhere in the pack — none is guessed or carried over from a prior draft's unverified list.

| Entity | Table(s) | Owning domain | How B8 references it (read-only) |
|---|---|---|---|
| Workspace | `workspaces` | B1 | Direct FK: `subscriptions.workspace_id`, `billing_customers.workspace_id`, and every other workspace-scoped B8 table (`B8_STORAGE_MODEL.md`) |
| Membership | `memberships` | B1 | Direct FK: `refunds.created_by_membership_id`; `entitlement_overrides.granted_by_membership_id`/`revoked_by_membership_id` (`B8_STORAGE_MODEL.md`) |
| Lead | `leads` | B2 | Named in the direct-write firewall (`B8_RBAC_TENANCY.md` §5) and forbidden-coupling list (§7); the `leads` quota metric's reserving domain is CRM/B2 (`B8_USAGE_QUOTA_MODEL.md` §1); capability `crm.core` gates it (`B8_ENTITLEMENT_MODEL.md`) |
| Deal | `deals` | B2 | Named in the direct-write firewall (§5) and forbidden-coupling list (§7) |
| AutomationRule / AutomationRun | `automation_rules`, (`runs`) | B7 | Named in the direct-write firewall (§5) and forbidden-coupling list (§7); named again in `B8_B7_AUTOMATION_BOUNDARY.md` §6's negative control (`AT-B7BILL-B8-1`); the `automationRuns` quota metric's reserving domain is Automation/B7 (`B8_USAGE_QUOTA_MODEL.md` §1); capability `automation.rules` gates it |
| Conversation | `conversations` | B5 | Named in the direct-write firewall (§5) and forbidden-coupling list (§7) |
| DiscoveryJob | `discovery_jobs` | B3 | Named in the direct-write firewall (§5) and forbidden-coupling list (§7); the `discoveryRuns` quota metric's reserving domain is Discovery/B3 (`B8_USAGE_QUOTA_MODEL.md` §1) |
| RevenueEvent | `revenue_events` | B9 (future) | Named in the direct-write firewall (§5), forbidden-coupling list (§7), and the full structural lockout proof in `B8_REVENUE_FIREWALL.md`/`B8_B9_FINANCE_BOUNDARY.md` |
| RevenueReversal | `revenue_reversals` | B9 (future) | Named in the forbidden-coupling list (§7) and `B8_REVENUE_FIREWALL.md`/`B8_B9_FINANCE_BOUNDARY.md` (not separately named in the §5 firewall sentence — a pre-existing asymmetry between §5's and §7's lists, noted here, not itself a `B8-FIX.2` scope item) |
| AttributionTouchpoint | `attribution_touchpoints` | B9 (future) | Named in the direct-write firewall (§5), forbidden-coupling list (§7), and `B8_VERIFICATION_MATRIX.md`'s `ATTRIBUTION_AUTHORITY_LEAKS` gate |
| TaxInvoice | `tax_invoices` | B10 (future) | Named in the direct-write firewall (§5), forbidden-coupling list (§7), and `B8_B10_TAX_BOUNDARY.md`; the frozen `TaxInvoice.invoice_ref` DTO field points *at* B8's own `INV-BILL-*`, the one place a future B10 entity is expected to reference B8 rather than the reverse |
| TaxInvoiceLine | `tax_invoice_lines` | B10 (future) | Named in `B8_B10_TAX_BOUNDARY.md` §2 (not separately named in the §5 firewall sentence) |
| TaxSubmission | `tax_submissions` | B10 (future) | Named in the forbidden-coupling list (§7) and `B8_B10_TAX_BOUNDARY.md` §2 (not separately named in the §5 firewall sentence) |
| WebhookReceipt | `webhook_receipts` | Shared Webhooks domain (frozen, pre-dates the B1–B10 numbering) | Not an FK column, but a structural read dependency: `ProcessPaymentWebhook` only ever acts on a `verified` row from this shared inbox; `billing_customers`' `provider_customer_ref`/`provider_agreement_ref` is the join key a webhook uses to resolve its workspace (`B8_CHECKOUT_PAYMENT_MODEL.md`); the `WHR-*` prefix and this table are referenced across 10 of the pack's 36 files |

`REFERENCED_ENTITY_COUNT = 14` — mechanically counted as the number of distinct rows in the table above, each independently verified to appear as a named, non-B8-owned reference somewhere in the current 36-file pack. This does not match either of a prior audit's two candidate interpretations (`2` direct-FK-only, `8` the §5 firewall list alone) because both were narrower slices of the same underlying set this registry now makes explicit and enumerable; it is not forced to any prior asserted number, including `15` — 14 is what a genuine enumeration against the current pack produces. If a future amendment adds a new cross-domain reference to any B8 document, this table and count are the place to update, not a number restated elsewhere without re-deriving it.
