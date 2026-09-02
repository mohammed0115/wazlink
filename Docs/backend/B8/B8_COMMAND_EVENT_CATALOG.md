# B8 — Command & Event Catalog

> Design only. Frozen commands/events are reused verbatim (column "Frozen?"); new ones are additive.

## 1. Commands

| Command | Frozen? | Aggregate | Actor | Permission | Idempotency | Expected version | Preconditions | Result | Event(s) |
|---|---|---|---|---|---|---|---|---|---|
| `CreateUpgradeQuote` | yes | UpgradeQuote | user | `subscription.change` | header, 7d | n/a (create) | workspace active; plan not retired; entitlement/permission checks pass | `201 UpgradeQuote{active}` | `UpgradeQuoteIssued` |
| `CancelUpgradeQuote` | yes | UpgradeQuote | user/system | `subscription.change` | header, 7d | quote `version` | quote `active` | quote `cancelled` | `UpgradeQuoteExpired`-sibling (see §2 note) |
| `CreatePayment` | yes | Payment (+Subscription lock) | user | `subscription.change` | header, 7d | subscription `version` | quote `active`+unexpired; no other in-flight payment for this subscription (`B8-D-A012`) | `202 Payment{pending}` | `PaymentSucceeded`/`PaymentFailed` (async, later) |
| `ProcessPaymentWebhook` | yes | Payment | system (verified webhook) | n/a (system) | `(provider,event_id,payload_hash)` + `(command_id,Payment.id,status)` | Payment legal-transition check | `WebhookReceipt.status=queued`, `provider="tap"` | `Payment.status` updated | `PaymentSucceeded` \| `PaymentFailed` \| `PaymentReconciled` |
| `ReconcilePayment` | yes | Payment | system (scheduled) / admin | `payment.manage` (admin path) | `(command_id,Payment.id)` | Payment legal-transition check | eligible per `B8_RECONCILIATION_MODEL.md` §1 | `Payment.status` updated or unchanged | `PaymentReconciled` (+ state event if changed) |
| `BootstrapWorkspaceSubscription` | new | Subscription | system (consumes `WorkspaceCreated`) | n/a | `(consumer="billing",event_id)` + `subscriptions.workspace_id` unique | workspace has no subscription yet | `Subscription{active, STARTER}` | `SubscriptionActivated` |
| `CancelSubscription` | new | Subscription | user/admin | `subscription.change` | header, 7d | subscription `version` | subscription not already `cancelled`/`expired` | `cancel_at_period_end=true` | `SubscriptionCancelled` |
| `ReactivateSubscription` | new | Subscription | user/admin | `subscription.change` | header, 7d | subscription `version` | `cancel_at_period_end=true`, status not terminal | `cancel_at_period_end=false` | `SubscriptionReactivated` |
| `ScheduleDowngrade` | new | Subscription | user | `subscription.change` | header, 7d | subscription `version` | target plan active, lower or equal tier | `pending_plan_version_id` set/cleared | `SubscriptionDowngradeScheduled` |
| `ApplyScheduledDowngrade` | new | Subscription | system (period-boundary sweep) | n/a | `(command_id,Subscription.id,current_period_end)` | `pending_plan_version_id` set, boundary reached | `plan_version_id` updated | `SubscriptionDowngradeApplied` |
| `GrantEntitlementOverride` | new | EntitlementOverride | admin | `billing.manage` | header, 7d | n/a (create) | code is a valid capability/metric (`B8_ENTITLEMENT_MODEL.md` §5c); `grant_capability` requires `value=true`; `extend_quota` requires `value` to strictly exceed the plan's current limit or be `null`; if an `active` row already exists for `(workspace_id, code)`, it is closed (`status=revoked`) in the same transaction as the new row's creation (`B8_STORAGE_MODEL.md` §lifecycle) | exactly one `active` override row for `(workspace_id, code)` after commit | `EntitlementOverrideGranted` |
| `RevokeEntitlementOverride` | new | EntitlementOverride | admin | `billing.manage` | header, 7d | override row exists, `status=active` | a non-`active` target row is `409 CONFLICT` (reason `override_not_active`) unless it is an idempotent replay | `status=revoked`, `revoked_at`/`revoked_by_membership_id` set | `EntitlementOverrideRevoked` |
| `StartTrial` | new, gated inactive | Subscription | user | `subscription.change` | header | subscription `version` | `trial_used_at IS NULL`; trials activated (`B8-D-B001`) | `Subscription{trialing}` | (none in Phase 1 — inactive) |
| `ValidateProviderConfiguration` | new | (none — stateless read) | admin | `billing.manage` | n/a (read) | n/a | n/a | health projection | (observability only, no event) |

Note (`CancelUpgradeQuote`): frozen `BACKEND_STATE_MACHINES.md` names the transition `active→cancelled` but does not separately name its event; B8 records it as producing the same class of lifecycle signal as `UpgradeQuoteExpired` (an unused-quote terminal event) — no new event name is required since no consumer outside Billing currently needs to react to quote cancellation specifically; if one later does, it is added as a genuinely new, explicitly named event via controlled amendment, not silently folded into `UpgradeQuoteExpired`.

## 2. Events

| Event | Frozen? | Payload (key fields) | Consumers |
|---|---|---|---|
| `UpgradeQuoteIssued` | yes | quote_ref, workspace_ref, plan_ref, amount, currency, expires_at | Billing (outbox only; no external consumer declared yet) |
| `UpgradeQuoteConsumed` | yes | quote_ref, payment_ref | Billing |
| `UpgradeQuoteExpired` | yes | quote_ref | Billing |
| `PaymentSucceeded` | yes | payment_ref, subscription_ref, amount, currency, captured_at | Billing (triggers `SubscriptionActivated`) |
| `PaymentFailed` | yes | payment_ref, subscription_ref, failure_class | Billing |
| `PaymentReconciled` | new | payment_ref, prior_status, resulting_status, source(webhook\|reconciliation) | Billing, Observability |
| `SubscriptionActivated` | yes | subscription_ref, workspace_ref, plan_version_ref, effective_at | Billing, Entitlements (implicit — next read reflects it; no push consumer) |
| `SubscriptionCancelled` | new | subscription_ref, cancel_at_period_end_effective_at | Billing |
| `SubscriptionReactivated` | new | subscription_ref | Billing |
| `SubscriptionPastDue` | new | subscription_ref, since | Billing |
| `SubscriptionSuspended` | new | subscription_ref, since | Billing |
| `SubscriptionExpired` | new | subscription_ref, since | Billing |
| `SubscriptionDowngradeScheduled` | new | subscription_ref, target_plan_version_ref, effective_at | Billing |
| `SubscriptionDowngradeApplied` | new | subscription_ref, from_plan_version_ref, to_plan_version_ref | Billing |
| `EntitlementOverrideGranted` | new | workspace_ref, code, override_type, value, granted_by, expires_at | Entitlements |
| `EntitlementOverrideRevoked` | new | workspace_ref, code, revoked_by | Entitlements |
| `InvoiceIssued` | yes | invoice_ref, subscription_ref, total, currency | Billing |
| `WebhookProcessed` | yes (Webhooks-domain event, B8 is a consumer not a producer) | receipt_ref, outcome | consumed by Billing's `ProcessPaymentWebhook` trigger path |

`RevenueRecognized`/`RevenueReversed` (frozen, B9-owned) never appear in this list — see `B8_REVENUE_FIREWALL.md`. `TaxSubmitted`/`SubmitTaxInvoice` (frozen, B10/Tax-owned) never appear in this list — see `B8_B10_TAX_BOUNDARY.md`.

## 3. Consumed events (cross-domain)

| Event | Producer | B8 consumer action |
|---|---|---|
| `WorkspaceCreated` | B1 Workspace | `BootstrapWorkspaceSubscription` |
| `WorkspaceSuspended` | B1 Workspace | Billing takes no independent action — Workspace-level suspension already overrides entitlement resolution at step 1 (§`B8_ENTITLEMENT_MODEL.md` §5); Subscription's own `status` is untouched, so a later un-suspend restores exactly the prior billing state |
| `WorkspaceResumed` | B1 Workspace | same — no B8 state change, only removes the step-1 override |
| `WorkspaceArchived` / `WorkspaceDeletionRequested` | B1 Workspace | Billing participates in the retention/purge workflow (§`B8_PRIVACY_RETENTION.md` §4) — a scheduled, permissioned, audited process, never an immediate hard delete of financial records |
| `OwnershipTransferred` | B1 Workspace | audit-only; no Subscription field changes (subscription is workspace-scoped, not owner-scoped) |
| `WebhookProcessed` | Webhooks (shared domain) | triggers `ProcessPaymentWebhook` for `provider="tap"` receipts (§`B8_WEBHOOK_MODEL.md` §1) |

## 4. Naming reconciliation

`InitiatePlanUpgrade`/`InitiateUpgrade` — resolved per `B8-D-A002` (§`B8_DOMAIN_OWNERSHIP.md` §4): conceptual label only, realized by `CreateUpgradeQuote`→`CreatePayment`; not listed as a standalone row above to avoid implying a third, non-existent endpoint.
