# B8 — Failure Catalog

> Design only. Reuses the frozen `BACKEND_ERROR_CATALOG.md` envelope and closed code list; adds only new `code` values within it — no new HTTP status, no new envelope shape (matching B6/B7's own discipline).

## 1. Reused codes (frozen, unchanged)

| Code | HTTP | B8 usage |
|---|---:|---|
| `PERMISSION_DENIED` | 403 | any command without `subscription.change`/`billing.manage`/`payment.manage` |
| `ENTITLEMENT_LOCKED` | 403 | capability not granted by resolution (§`B8_ENTITLEMENT_MODEL.md`) |
| `QUOTA_EXHAUSTED` | 403 | metric at/over limit |
| `ENTITY_NOT_FOUND` | 404 | cross-workspace or absent Subscription/Payment/UpgradeQuote/Plan reference |
| `VALIDATION_ERROR` | 400/422 | malformed request; semantic payment validation |
| `CONFLICT` | 409 | generic state/version conflict; reason vocabulary extended with `payment_in_progress` (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §3), `override_already_active`, and `override_not_active` (§`B8_STORAGE_MODEL.md` §lifecycle, `B8-D-A021`) — no new code, only new `details.reason` string values within the existing `409 CONFLICT` envelope, mirroring the corpus-wide CONFLICT-reason-extension pattern B2 established |
| `IDEMPOTENCY_CONFLICT` | 409 | same key, different body |
| `STALE_VERSION` | 409 | `Subscription.version` mismatch |
| `PROVIDER_RATE_LIMITED` | 429 | Tap rate limit |
| `PROVIDER_UNAVAILABLE` | 502/503 | Tap API call failure |
| `PAYMENT_FAILED` | 402/422 | final payment failure |
| `PAYMENT_PENDING` | 202 | async payment still resolving |
| `WEBHOOK_INVALID_SIGNATURE` | 401 | unverified Tap webhook (Webhooks-domain layer) |
| `WEBHOOK_DUPLICATE` | 200 | duplicate receipt, harmless ack |
| `QUOTE_EXPIRED` / `QUOTE_ALREADY_CONSUMED` / `QUOTE_NOT_ACTIVE` / `QUOTE_MISMATCH` | 409/422 | frozen UpgradeQuote lifecycle failures, unchanged |
| `INTERNAL_ERROR` | 500 | safe generic failure |

## 2. New `code` values (additive, existing HTTP statuses/envelope only)

| Code | HTTP | Meaning | Example scenario |
|---|---:|---|---|
| `PLAN_RETIRED` | 422 | `QuoteRequest.plan_ref` names a retired Plan | client retries a stale upgrade link after the plan was retired |
| `SUBSCRIPTION_TRANSITION_INVALID` | 409 | requested command is not a legal transition from the subscription's current state | `ReactivateSubscription` called when `cancel_at_period_end=false` |
| `DOWNGRADE_BLOCKED` | 409 | reserved for a future hard floor (none defined in Phase 1 — mechanism only) | not reachable in Phase 1 |
| `RECONCILIATION_MISMATCH` | 409 | local and provider terminal states disagree; admin resolution required | webhook says `captured`, later reconciliation query says `failed` at the same moment |
| `PROVIDER_CONFIGURATION_INVALID` | 409 | Tap environment/credentials not configured for the requested operation | `CreatePayment` attempted while `ProviderConfigurationHealth.configured = false` |
| `ENTITLEMENT_OVERRIDE_INVALID` | 422 | override request names an unknown code; a `grant_capability` request whose `value` is not exactly `true`; or an `extend_quota` request whose `value` does not strictly exceed the plan's current limit at grant time (and is not `null`) — per the absolute-stored-value, never-additive, broaden-only semantics in `B8_ENTITLEMENT_MODEL.md` §5b–5c (resolution-time behavior once the base later changes is §5b-i, `B8-D-A022`) | admin submits `override_type=extend_quota, value=5` for a metric whose plan limit is already 1000 |

`ERROR_NEW_COUNT = 6`, every one a new `code` string inside the existing envelope/status doctrine — zero new HTTP statuses, zero new envelope fields, matching the corpus-wide discipline (`B6_FAILURE_CATALOG.md`/`B7`'s "only new code values within the existing taxonomy").

## 3. Failure scenario table

| # | Scenario | User-visible result | Internal state | Retry/idempotency | Alert/reconciliation |
|---|---|---|---|---|---|
| BF1 | Tap callback missing | `Payment` stays `pending` | reconciliation-eligible | scheduled poll, max 8 (frozen retry class) | billing alert (frozen) |
| BF2 | Tap duplicate callback | no duplicate `Payment`/`Subscription` mutation | receipt duplicate, no-op | acknowledge `2xx` (frozen) | metrics only |
| BF3 | Unverified webhook | never reaches `ProcessPaymentWebhook` | `WebhookReceipt` stays unverified | n/a — Webhooks-domain rejects at signature stage | signature-failure alert |
| BF4 | Out-of-order webhook | later-committed state unaffected | stale event discarded as illegal backward transition | n/a — no-op | none (expected, observed only) |
| BF5 | Two concurrent upgrades, same subscription | second request gets `409 CONFLICT` | first payment proceeds | client may retry after first resolves | none |
| BF6 | Quote expired between issue and use | `409 QUOTE_EXPIRED` | quote row unaffected (still `active` until lazily evaluated, or system sweep marks `expired`) | client re-quotes | none |
| BF7 | Downgrade scheduled then cancellation requested | downgrade silently cleared, cancellation applied | `pending_plan_version_id` cleared in same transaction | n/a | audit only |
| BF8 | Grace window elapses with no successful charge | subscription `suspended`, capabilities `LOCKED` | reconciliation-driven transition | n/a | billing alert |
| BF9 | Provider timeout on `create_charge` | `Payment` stays `pending`/`created` | typed retryable error (frozen timeout policy: 3s/20s/5m) | reconciliation | provider outage alert |
| BF10 | Reconciliation finds genuine local/provider disagreement | admin-visible `RECONCILIATION_MISMATCH` | no automatic mutation | admin repair command | billing alert (frozen "repeated payment mismatch") |
| BF11 | Entitlement override request for unknown metric code | `422 ENTITLEMENT_OVERRIDE_INVALID` | no row created | n/a | none |
| BF12 | Cross-workspace `Subscription`/`Payment` reference | `404 ENTITY_NOT_FOUND` | no disclosure of existence elsewhere | n/a | IDOR-attempt observability (§`B8_SECURITY_THREAT_MODEL.md`) |
| BF13 | `CreatePayment` while provider not configured (e.g. test environment misconfigured) | `409 PROVIDER_CONFIGURATION_INVALID` | no Payment row left in an ambiguous state — rejected before creation | n/a | configuration-health alert |
| BF14 | Payment succeeds but workspace was suspended moments earlier | `Payment` still recorded `captured` (financial fact preserved); `Subscription` remains whatever state Billing computed, but entitlement resolution still reports deny-floor via the Workspace-state override (step 1, independent of Subscription) | no contradiction — financial truth and access-control truth are different questions, both correctly represented | n/a | none |
| BF15 | Retired plan referenced by an old bookmarked upgrade link | `422 PLAN_RETIRED` | no quote created | n/a | none |
| BF16 | Duplicate `GrantEntitlementOverride` request (same `Idempotency-Key`) | same `201` response replayed | single row created | frozen idempotency replay | none |
| BF17 | Renewal charge fails repeatedly across the grace window | `active→past_due→suspended` per §`B8_SUBSCRIPTION_STATE_MACHINE.md` | each attempt recorded in `payment_attempts` | frozen "Payment final failure: no retry, 1 attempt" applies per individual charge attempt; the *grace window* is what allows a next scheduled renewal attempt, not a retry of the same charge | billing alert on suspension |
| BF18 | Admin `ReconcilePayment` invoked for a Payment already fully resolved | idempotent no-op, same result returned | no state change | `(command_id, Payment.id)` idempotency | none |
| BF19 | Two concurrent `GrantEntitlementOverride` requests race to create the first `active` row for a `(workspace_id, code)` with no prior row | one succeeds `201`; the other gets `409 CONFLICT` (reason `override_already_active`) | exactly one `active` row exists after both resolve | partial unique index is the backstop (`B8-D-A021`, `B8_CONCURRENCY_MODEL.md` C11); client may retry as a replacement grant | none |
| BF20 | Data corruption produces more than one `active` `entitlement_overrides` row for the same `(workspace_id, code)` (unreachable through any governed command; e.g. manual DB tampering) | entitlement resolution returns `LOCKED`/`EXHAUSTED`, `source="deny_floor"`, `500 INTERNAL_ERROR` — never a summed/maxed/latest-wins broadened result | fails closed, does not silently pick a row | n/a — this is not a retryable transient condition | consistency-violation alert (`RECONCILIATION_MISMATCH`-class, `B8_OBSERVABILITY_AUDIT.md` §4) |

## 4. No failure path grants entitlement or loses tenant scope

Restated per `BACKEND_FAILURE_MATRIX.md`'s closing rule ("No failure path may silently convert a Deal into Revenue, grant entitlement, lose tenant scope, or expose provider internals"): every scenario above either fails closed (deny/pending/no-op) or resolves through an explicit, audited transition — none of BF1–BF20 ever results in an unearned `AVAILABLE`/`captured`/`active` outcome.

## 5. Scope note on BF-row coverage (`INFO-2` remediation)

`FAILURE_SCENARIO_GAPS = 0` describes the BF1–BF20 sequence: no numbering gap, no duplicate. It does not mean every `code` value has its own dedicated BF row — two reused codes, `SUBSCRIPTION_TRANSITION_INVALID` and `STALE_VERSION`, have no standalone BF narrative because a single-call validation failure (as opposed to a multi-step scenario worth narrating) is already fully specified by §2's worked example (`SUBSCRIPTION_TRANSITION_INVALID`: *"`ReactivateSubscription` called when `cancel_at_period_end=false`"*) and §1's frozen usage note (`STALE_VERSION`: *"`Subscription.version` mismatch"*), and both are independently exercised by acceptance tests (`AT-B8REACT-2`, `AT-B8CONC-1`…`3`). Canonical error coverage in this pack is therefore broader than a strict one-row-per-code mapping — every `code` value is covered by at least one of: a BF row, a §2 worked example, or a dedicated acceptance test — and BF rows are reserved for scenarios with multi-step or race/timing narrative worth spelling out.
