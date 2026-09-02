# B8 — Acceptance Test Matrix

> Design only. Every Class A decision has acceptance evidence. Categories map to brief §40's required minimum coverage.

## 1. Categories and counts (descriptive cross-reference only — **not** authoritative for `ACCEPTANCE_CATEGORY_COUNT`)

> **Methodology (`B8-FIX.2`).** This table is a hand-authored *thematic* mapping from brief §40's required coverage areas to test IDs — it is intentionally more granular in places (e.g. splitting "Metered quota" into four rows) and coarser in others (e.g. folding several `AT-B8SEC-*` IDs under named security sub-themes) than the per-row `Category` label each test actually carries in §2. Because of that intentional mismatch, counting rows in *this* table does not, and never did, reliably reproduce a "how many distinct categories does this pack cover" number — a prior draft asserted `ACCEPTANCE_CATEGORY_COUNT = 23` from this table's row count and that number was not reproducible from the pack's own canonical data. **The single authoritative source for `ACCEPTANCE_CATEGORY_COUNT` is `COUNT(DISTINCT Category)` over §2's `Category` column** (§2 is the canonical, one-row-per-test-ID table; every test has exactly one `Category` value there) — never this table. See §2's footer for the mechanically-computed value and the full list of distinct labels it is computed from.

| # | Category | Test IDs | Count |
|---|---|---|---|
| 1 | Workspace isolation | `AT-B8SEC-3`, `AT-B8SEC-14` | 2 |
| 2 | RBAC | `AT-B8SEC-11`, `AT-B8RBAC-1..4` | 5 |
| 3 | Plan version stability | `AT-B8PLAN-1..3` | 3 |
| 4 | Trial behavior | `AT-B8TRIAL-1..4` | 4 |
| 5 | Upgrade | `AT-B8UPG-1..5` | 5 |
| 6 | Duplicate upgrade | `AT-B8SEC-8`, `AT-B8SEC-9` | 2 |
| 7 | Downgrade | `AT-B8DOWN-1..5` | 5 |
| 8 | Cancel | `AT-B8CANCEL-1..4` | 4 |
| 9 | Reactivation | `AT-B8REACT-1..3` | 3 |
| 10 | Entitlement resolution | `AT-B8ENT-1..6` | 6 |
| 11 | Boolean capability | `AT-B8ENT-1`, `AT-B8ENT-2` | (subset of 10) |
| 12 | Metered quota | `AT-B8QUOTA-1..5` | 5 |
| 13 | Usage exhaustion | `AT-B8QUOTA-2`, `AT-B8QUOTA-3` | (subset of 12) |
| 14 | Quota reset | `AT-B8QUOTA-4` | (subset of 12) |
| 15 | Duplicate quota admission | `AT-B8QUOTA-5` | (subset of 12) |
| 16 | Checkout idempotency | `AT-B8SEC-8` | (listed under 6) |
| 17 | Price tampering | `AT-B8SEC-1` | (listed under security) |
| 18 | Fake redirect | `AT-B8SEC-5` | (listed under security) |
| 19 | Unverified webhook | `AT-B8SEC-6` | (listed under security) |
| 20 | Duplicate webhook | `AT-B8SEC-7`, `BF2` | (listed) |
| 21 | Out-of-order webhook | `AT-B8WH-1` | 1 |
| 22 | Provider pending | `AT-B8WH-2` | 1 |
| 23 | Provider failure | `AT-B8WH-3` | 1 |
| 24 | Provider timeout | `AT-B8WH-4` | 1 |
| 25 | Lost webhook | `AT-B8RECON-1` | 1 |
| 26 | Reconciliation recovery | `AT-B8RECON-1..4` | 4 |
| 27 | Provider/local mismatch | `AT-B8RECON-3` | (subset of 26) |
| 28 | `expected_version` conflict | `AT-B8CONC-1..3` | 3 |
| 29 | Secret redaction | `AT-B8SEC-12`, `AT-B8SEC-13` | (listed under security) |
| 30 | Cross-tenant provider reference attack | `AT-B8SEC-4`, `AT-B8SEC-14` | (listed) |
| 31 | Payment success ≠ RevenueEvent | `AT-B8REV-1..6` | 6 |
| 32 | Subscription activation ≠ recognized revenue | `AT-B8REV-1` | (subset of 31) |
| 33 | B8 cannot write B9 tables | `AT-B9FIN-B8-1` | 1 |
| 34 | B8 cannot write B10 tax authority | `AT-B10TAX-B8-1` | 1 |
| 35 | B8 does not bypass B7 ownership | `AT-B7BILL-B8-1`, `AT-B7BILL-B8-2` | 2 |
| 36 | Security threat model (full) | `AT-B8SEC-1..19` | 19 |
| 37 | Entitlement override precedence/lifecycle (`B8-FIX.1`, `B8-D-A021`) | `AT-B8OVR-1..10`, `AT-B8OVR-19` | 11 |
| 38 | Entitlement override × plan-change interaction (`B8-FIX.2`, `B8-D-A022`) | `AT-B8OVR-11..18` | 8 |

`ACCEPTANCE_TEST_COUNT` (distinct IDs, not category-subset double-counted) is not summed here — §2's full distinct list is the sole source of truth for totals; see its footer formula.

## 2. Full distinct test list (authoritative — this table, not §1's category counts, is the source of truth for totals)

| Test ID | Category | Positive/Negative | Assertion |
|---|---|---|---|
| `AT-B8SEC-1`…`AT-B8SEC-19` | Security (§`B8_SECURITY_THREAT_MODEL.md`) | 14 negative, 5 positive-path-with-negative-assertion | per threat table |
| `AT-B8REV-1`…`AT-B8REV-6` | Revenue firewall | negative control (all 6) | per `B8_REVENUE_FIREWALL.md` §3 |
| `AT-B9FIN-B8-1` | B9 boundary | negative control | per `B8_B9_FINANCE_BOUNDARY.md` §5 |
| `AT-B10TAX-B8-1` | B10 boundary | negative control | per `B8_B10_TAX_BOUNDARY.md` §4 |
| `AT-B7BILL-B8-1`, `AT-B7BILL-B8-2` | B7 boundary | negative control | per `B8_B7_AUTOMATION_BOUNDARY.md` §6 |
| `AT-DWF-B8-1` | Direct-write firewall | negative control | B8's `entitlements` app has no write path to `subscriptions`; no B8 app has a write path to another domain's table |
| `AT-B8PLAN-1` | Plan version stability | positive | editing today's PlanVersion's price does not change an already-committed Subscription's entitlements |
| `AT-B8PLAN-2` | Plan version stability | positive | a new `CreateUpgradeQuote` always prices from the *current* PlanVersion, never a stale cached one |
| `AT-B8PLAN-3` | Plan version stability | negative | quoting a retired plan → `422 PLAN_RETIRED` |
| `AT-B8TRIAL-1` | Trial | negative | `StartTrial` is unreachable via any Phase-1 API operation (mechanism inactive) |
| `AT-B8TRIAL-2` | Trial | positive (mechanism-level, run against the command directly, not via API) | a workspace with `trial_used_at` set cannot start a second trial |
| `AT-B8TRIAL-3` | Trial | positive | trial conversion transitions `trialing→active` only on `PaymentSucceeded`, never on redirect |
| `AT-B8TRIAL-4` | Trial | positive | trial expiry with no conversion transitions `trialing→expired` directly (never through `cancelled`) |
| `AT-B8UPG-1` | Upgrade | positive | `SubscriptionActivated` updates `plan_version_id` immediately, reflected in the very next `GET /entitlements` call |
| `AT-B8UPG-2` | Upgrade | positive | upgrade requires a captured payment or explicit reconciled acceptance — never activates from `CreatePayment`'s own `202` alone |
| `AT-B8UPG-3` | Upgrade | negative | a failed upgrade payment leaves `plan_version_id` completely unchanged |
| `AT-B8UPG-4` | Upgrade | positive | an upgrade success clears any pending `cancel_at_period_end`/downgrade (§`B8_UPGRADE_DOWNGRADE_MODEL.md` §7) |
| `AT-B8UPG-5` | Upgrade | negative | a stale webhook for a superseded payment does not downgrade a subscription already on a newer plan version |
| `AT-B8DOWN-1` | Downgrade | positive | `ScheduleDowngrade` does not change `plan_version_id` immediately |
| `AT-B8DOWN-2` | Downgrade | positive | `ApplyScheduledDowngrade` applies exactly at `current_period_end`, not before |
| `AT-B8DOWN-3` | Downgrade | positive | no CRM/business data is deleted or hidden by a downgrade |
| `AT-B8DOWN-4` | Downgrade | positive | `GET .../downgrade-preview` returns non-null `downgrade_warning` whenever any metric is over the target limit |
| `AT-B8DOWN-5` | Downgrade | positive | a running `DiscoveryJob`/`AutomationRun` admitted before a downgrade applies completes normally |
| `AT-B8CANCEL-1` | Cancel | positive | `CancelSubscription` sets `cancel_at_period_end=true`, status remains `active` until the boundary |
| `AT-B8CANCEL-2` | Cancel | positive | full access continues through `current_period_end` after cancellation is scheduled |
| `AT-B8CANCEL-3` | Cancel | negative | immediate hard-cancel is not reachable via any Phase-1 API operation |
| `AT-B8CANCEL-4` | Cancel | positive | `CancelSubscription` is idempotent — repeated calls return the same result, no duplicate audit spam |
| `AT-B8REACT-1` | Reactivation | positive | `ReactivateSubscription` clears `cancel_at_period_end` before the boundary |
| `AT-B8REACT-2` | Reactivation | negative | `ReactivateSubscription` against an `expired` subscription fails `409 SUBSCRIPTION_TRANSITION_INVALID` |
| `AT-B8REACT-3` | Reactivation | positive | post-`expired` reactivation requires a full new `CreateUpgradeQuote`→`CreatePayment` sequence |
| `AT-B8ENT-1` | Entitlement — boolean capability | positive | STARTER workspace resolves `automation.rules` → `LOCKED` |
| `AT-B8ENT-2` | Entitlement — boolean capability | positive | GROWTH workspace resolves `automation.rules` → `AVAILABLE` |
| `AT-B8ENT-3` | Entitlement — precedence | positive | a `suspended` workspace resolves every capability `LOCKED` regardless of subscription plan |
| `AT-B8ENT-4` | Entitlement — precedence | positive | a `past_due` subscription still resolves full access (`source="grace"`) |
| `AT-B8ENT-5` | Entitlement — precedence | positive | an active `EntitlementOverride` raises a `LOCKED` capability to `AVAILABLE`, `source="override"` |
| `AT-B8ENT-6` | Entitlement — fail-safe | negative | a simulated DB read failure during resolution returns `LOCKED`/`EXHAUSTED`, never `AVAILABLE` |
| `AT-B8QUOTA-1` | Quota | positive | `leads` usage below limit resolves `AVAILABLE` |
| `AT-B8QUOTA-2` | Quota exhaustion | negative | `leads` usage at limit → next admission `403 QUOTA_EXHAUSTED` |
| `AT-B8QUOTA-3` | Quota exhaustion | positive | a rolled-back `ConvertBusinessToLead` transaction releases its `leads` reservation |
| `AT-B8QUOTA-4` | Quota reset | positive | crossing `current_period_end` resets `discoveryRuns` usage to 0 for the new period |
| `AT-B8QUOTA-5` | Duplicate quota admission | negative | two concurrent admissions against the last remaining unit of quota — exactly one succeeds, serialized by row lock |
| `AT-B8WH-1` | Out-of-order webhook | negative | a stale `pending` event arriving after `captured` is discarded, not applied backward |
| `AT-B8WH-2` | Provider pending | positive | an `INITIATED`/`DEFERRED`-mapped event leaves `Payment` at `pending`, no premature grant |
| `AT-B8WH-3` | Provider failure | positive | a decline-mapped event transitions `Payment→failed`, subscription unchanged |
| `AT-B8WH-4` | Provider timeout | positive | adapter timeout (per frozen 3s/20s/5m budget) raises a typed retryable error, never blocks the request indefinitely |
| `AT-B8RECON-1` | Reconciliation recovery — lost webhook | positive | a `Payment` stuck `pending` past the bounded window is resolved by the scheduled sweep's direct provider query |
| `AT-B8RECON-2` | Reconciliation recovery — subscription mismatch | positive | a `past_due` subscription past its grace window is transitioned to `suspended` by the sweep |
| `AT-B8RECON-3` | Provider/local mismatch | negative | a genuine disagreement between local and provider terminal states produces `RECONCILIATION_MISMATCH`, no automatic mutation |
| `AT-B8RECON-4` | Reconciliation idempotency | positive | running reconciliation twice against an already-resolved Payment is a no-op both times |
| `AT-B8CONC-1`…`AT-B8CONC-3` | `expected_version` conflict | negative (all 3) | stale `version` on `CancelSubscription`/`ReactivateSubscription`/`ScheduleDowngrade` → `409 STALE_VERSION` |
| `AT-B8RBAC-1`…`AT-B8RBAC-4` | RBAC | negative (all 4) | Manager/Sales/Member/Viewer each denied every B8 command (`403 PERMISSION_DENIED`) |
| `AT-B8OVR-1` | Override lifecycle | positive | first `GrantEntitlementOverride` for a `(workspace, code)` with no prior row succeeds `201`, one `active` row created |
| `AT-B8OVR-2` | Override precedence | negative | a second, independent `GrantEntitlementOverride` attempt for a `(workspace, code)` that already has an `active` row, submitted as a genuinely separate request (different `Idempotency-Key`), does not result in two simultaneously `active` rows — either it transactionally revokes-then-replaces (intended replacement path) or, under the race in `AT-B8OVR-4`, the loser gets `409 CONFLICT` (reason `override_already_active`) |
| `AT-B8OVR-3` | Override lifecycle | positive | **post-sweep case:** an override whose `status` has already been transitioned to `expired` (or `revoked`) by the reconciliation sweep does not block a legitimate new `GrantEntitlementOverride` for the same `(workspace, code)` — the row is not `active`, so the partial unique index does not constrain it; the new grant is a plain first-grant `INSERT` |
| `AT-B8OVR-4` | Override concurrency | negative | two concurrent `GrantEntitlementOverride` calls racing to create the *first* `active` row for a `(workspace, code)` with no prior row — exactly one succeeds `201`, the other gets `409 CONFLICT` (reason `override_already_active`), enforced by the partial unique index (`B8_CONCURRENCY_MODEL.md` C11) |
| `AT-B8OVR-5` | Override lifecycle | positive | a replacement/re-grant (`GrantEntitlementOverride` when an `active` row already exists) leaves exactly one `active` row after commit — the prior row is `revoked`, never deleted, and remains queryable in history |
| `AT-B8OVR-6` | Entitlement resolution — override | positive | resolution with exactly one valid, unexpired `active` override for a code is fully deterministic — same input state always yields the same `EntitlementDecision` |
| `AT-B8OVR-7` | Override corrupt-data fail-closed | negative | a fixture with two `active` rows for the same `(workspace, code)` (constructed by bypassing the governed command, simulating corruption) causes resolution to return `LOCKED`/`EXHAUSTED` with `source="deny_floor"` and a `500 INTERNAL_ERROR` plus a consistency alert — never a summed/maxed/latest-wins broadened result |
| `AT-B8OVR-8` | Override tenancy | positive | an `active` override for `code=X` in workspace A does not affect, and is not visible to, workspace B's resolution of the same `code=X` — no cross-workspace bleed |
| `AT-B8OVR-9` | Override boolean semantics | positive | a `grant_capability` override with `value=true` on a `LOCKED` capability resolves `AVAILABLE`, `allowed=true`, `source="override"`; a `grant_capability` request with any `value != true` is rejected `422 ENTITLEMENT_OVERRIDE_INVALID` at creation |
| `AT-B8OVR-10` | Override metered semantics | positive | an `extend_quota` override with `value=500` against a plan limit of 200 makes `EntitlementDecision.limit=500` (`MAX(200,500)=500`, not `200+500=700`) and `remaining=500-usage`; a request with `value<=200` (the current limit) is rejected `422 ENTITLEMENT_OVERRIDE_INVALID` at creation |
| `AT-B8OVR-11` | Override — plan-change interaction | positive | base plan limit=100, `extend_quota` override granted at `value=200` (valid, exceeds base) → `EntitlementDecision.limit = MAX(100,200) = 200` |
| `AT-B8OVR-12` | Override — plan-change interaction | positive | starting from `AT-B8OVR-11`'s state, the workspace upgrades to a plan whose base limit=300 while the same override (`value=200`, unchanged, unrevoked) remains active → `EntitlementDecision.limit = MAX(300,200) = 300`, never `200` — the upgraded plan's own higher limit applies, the override becomes a dominated no-op without being deleted or rewritten |
| `AT-B8OVR-13` | Override — plan-change interaction | positive | starting from `AT-B8OVR-11`'s state, the workspace instead downgrades (at the period boundary) to a plan whose base limit=50 while the same override (`value=200`) remains active → `EntitlementDecision.limit = MAX(50,200) = 200` — the override continues to broaden above the lower base until the override itself expires or is revoked |
| `AT-B8OVR-14` | Override — plan-change interaction | positive | an `extend_quota` override with `value=NULL` (unlimited) against any finite plan base (e.g. 100) → `EntitlementDecision.limit = unlimited`, `remaining = null`, regardless of the base's numeric value |
| `AT-B8OVR-15` | Override — plan-change interaction | positive | continuing `AT-B8OVR-12`'s upgraded state (base=300, override dominated at 200), the override subsequently expires (`expires_at <= now()`, treated as absent per `B8_ENTITLEMENT_MODEL.md` §5) → `EntitlementDecision.limit` falls back to the current base alone (`300`), not to the override's now-irrelevant historical value |
| `AT-B8OVR-16` | Override — plan-change interaction | positive | continuing `AT-B8OVR-13`'s downgraded state (base=50, override active at 200), the override is explicitly revoked (`RevokeEntitlementOverride`) → `EntitlementDecision.limit` falls back to the current (downgraded) base alone (`50`) |
| `AT-B8OVR-17` | Override — plan-change interaction | positive | across `AT-B8OVR-12`/`13`'s upgrade and downgrade events, the `entitlement_overrides` row's own `value_int`/`status`/`expires_at`/`granted_at` columns are asserted byte-identical before and after the plan-version transition — no plan-change event ever performs a write to `entitlement_overrides` |
| `AT-B8OVR-18` | Override concurrency | negative | a `SubscriptionActivated` upgrade (raising the base) is committed concurrently (same instant, separate transactions) with an in-flight `EntitlementDecision` resolution for the same workspace/code; the resolution is asserted to return either the fully-pre-upgrade or fully-post-upgrade committed `MAX` result — never a value lower than whichever base was actually last committed, and never a torn/partial read |
| `AT-B8OVR-19` | Override lifecycle | positive | **pre-sweep case:** an override row still `status='active'` but whose `expires_at` is already in the past (the reconciliation sweep has not yet run) does not block a legitimate new `GrantEntitlementOverride` for the same `(workspace, code)` — the request takes the transactional replacement path (`SELECT...FOR UPDATE` → revoke old → insert new, §`B8_STORAGE_MODEL.md` lifecycle), distinct from `AT-B8OVR-3`'s post-sweep plain-insert path, but with the same observable outcome: exactly one `active` row after commit |

`ACCEPTANCE_TEST_COUNT` — recomputed per-category directly from this table (`B8-FIX.2`, extending the `B8-FIX.1` per-category formula with the 8 new plan-change-interaction tests plus the 1 new pre-sweep-expiry test): 19 (SEC) + 6 (REV) + 1 (B9) + 1 (B10) + 2 (B7) + 1 (DWF) + 3 (PLAN) + 4 (TRIAL) + 5 (UPG) + 5 (DOWN) + 4 (CANCEL) + 3 (REACT) + 6 (ENT) + 5 (QUOTA) + 4 (WH) + 4 (RECON) + 3 (CONC) + 4 (RBAC) + 19 (OVR, was 10) = **99**.

`ACCEPTANCE_CATEGORY_COUNT` — per the §1 methodology note, this is `COUNT(DISTINCT Category)` mechanically read off every row of the table directly above (§2), never §1's row count. Reading all 70 rows of §2 (each `AT-*`/`AT-*…AT-*` row carries exactly one `Category` value, even where it covers a range of IDs) and deduplicating the `Category` string yields **38** distinct values, listed here in first-appearance order for reproducibility: Security (§`B8_SECURITY_THREAT_MODEL.md`); Revenue firewall; B9 boundary; B10 boundary; B7 boundary; Direct-write firewall; Plan version stability; Trial; Upgrade; Downgrade; Cancel; Reactivation; Entitlement — boolean capability; Entitlement — precedence; Entitlement — fail-safe; Quota; Quota exhaustion; Quota reset; Duplicate quota admission; Out-of-order webhook; Provider pending; Provider failure; Provider timeout; Reconciliation recovery — lost webhook; Reconciliation recovery — subscription mismatch; Provider/local mismatch; Reconciliation idempotency; `expected_version` conflict; RBAC; Override lifecycle; Override precedence; Override concurrency; Entitlement resolution — override; Override corrupt-data fail-closed; Override tenancy; Override boolean semantics; Override metered semantics; Override — plan-change interaction. `ACCEPTANCE_CATEGORY_COUNT = 38`. (A prior draft asserted `23` from §1's row count, which does not reproduce from either table: §1 currently has 38 rows of its own — a different, larger number arrived at independently, by coincidence — but §1's row labels are a hand-authored thematic grouping that does not correspond 1:1 with §2's per-row `Category` strings, so its row count is not a valid way to derive this metric even now that both happen to total 38.)

`NEGATIVE_CONTROL_COUNT` — recomputed by reading each category's actual Positive/Negative column above, not by formula shorthand: SEC=14, REV=6, B9=1, B10=1, B7=2, DWF=1, PLAN=1 (`PLAN-3` only), TRIAL=1 (`TRIAL-1` only), UPG=2 (`UPG-3`, `UPG-5`), DOWN=0, CANCEL=1 (`CANCEL-3` only), REACT=1 (`REACT-2` only), ENT=1 (`ENT-6` only), QUOTA=2 (`QUOTA-2`, `QUOTA-5`), WH=1 (`WH-1` only), RECON=1 (`RECON-3` only), CONC=3 (all), RBAC=4 (all), OVR=4 (`OVR-2`, `OVR-4`, `OVR-7`, `OVR-18`). Sum: 14+6+1+1+2+1+1+1+2+0+1+1+1+2+1+1+3+4+4 = **47**.

`DUPLICATE_ACCEPTANCE_TESTS = 0` — every `AT-*` ID in §2 is unique; §1's subset notations reference §2's IDs rather than duplicating them.

## 3. Class-A-to-evidence traceability

Every `B8-D-A0##` decision in `B8_DECISION_REGISTER.md` cites at least one test ID above in its own "acceptance evidence" field — cross-checked in `B8_VERIFICATION_MATRIX.md` §2.
