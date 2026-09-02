# B9 — PostgreSQL Storage Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **Architecture only. No migration is written, authorized, or implied.**

## 0. Inherited conventions

Frozen `BACKEND_DATA_MODEL.md`: *"All tables use UUIDv7 `id` internally, immutable prefixed `public_id`, UTC `created_at/updated_at`, optional `archived_at`, and `workspace_id` for tenant-owned records. Financial, tax, audit, and webhook receipt records are append-oriented and are not casually deleted."*

B9 tightens "not casually deleted" to **never deleted** and declines `archived_at` on both financial tables (`B9-D-A010`).

Its Revenue/Attribution row already names the group: *"`revenue_events, revenue_reversals, attribution_touchpoints` — source/idempotency unique; event/date and relation indexes."* Every constraint below traces to that clause.

## 1. `revenue_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, UUIDv7 |
| `public_id` | text | `REV-*`, immutable |
| `workspace_id` | uuid | FK → `workspaces`, NOT NULL |
| `source_type` | text | NOT NULL, closed set |
| `source_entity_type` | text | NOT NULL — e.g. `deal` |
| `source_public_id` | text | NOT NULL — e.g. `DEAL-01J...` |
| `gross_amount` | numeric(18,4) | NOT NULL |
| `net_amount` | numeric(18,4) | NOT NULL |
| `currency` | char(3) | NOT NULL |
| `recognized_at` | timestamptz | NOT NULL — the period key |
| `status` | text | NOT NULL, derived (`B9_REVENUE_EVENT_MODEL.md` §5) |
| `recognized_by_membership_id` | uuid | FK → `memberships`, NOT NULL |
| `idempotency_key` | text | NOT NULL |
| `note` | text | NULL |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

**Constraints**

| Name | Definition | Purpose |
|---|---|---|
| `pk_revenue_events` | PRIMARY KEY (`id`) | |
| `uq_revenue_events_public_id` | UNIQUE (`workspace_id`, `public_id`) | frozen workspace-scoped public ID |
| `uq_revenue_events_idempotency` | UNIQUE (`workspace_id`, `idempotency_key`) | frozen "idempotency unique" |
| `uq_revenue_events_source` | UNIQUE (`workspace_id`, `source_type`, `source_entity_type`, `source_public_id`) **WHERE** `status <> 'reversed'` | frozen "source unique"; the duplicate-recognition guard. **This four-column tuple is the canonical recognition-source identity** and is the only form used anywhere in B9 (`B9-D-A028`, `B9_REVENUE_RECOGNITION_POLICY.md` §7). The predicate releases a source only when the event is fully reversed in **both** gross and net (`B9-D-A034`), so a source is never released while net revenue survives |
| `ck_revenue_events_gross_positive` | CHECK (`gross_amount` > 0) | no zero/negative recognition |
| `ck_revenue_events_net_positive` | CHECK (`net_amount` > 0) | |
| `ck_revenue_events_net_le_gross` | CHECK (`net_amount` <= `gross_amount`) | |
| `ck_revenue_events_gross_product_max` | CHECK (`gross_amount` <= 999999999999.9999) | **WazLink product limit — 12 integer digits, ~1 trillion major units. NOT the maximum implied by `NUMERIC(18,4)`**, whose own maximum is `99999999999999.9999` (14 integer digits). An amount above the product bound is far more likely a misplaced decimal or a minor/major-unit confusion than a commercial fact (`B9_CURRENCY_MONEY_MODEL.md` §4). Overflow of either bound is `B9-AF-008`. Raising it is an amendment, never a silent exceedance |
| `ck_revenue_events_net_product_max` | CHECK (`net_amount` <= 999999999999.9999) | same limit on the net contract; `net <= gross` already implies it, and it is stated so neither column depends on the other's constraint |
| `ck_revenue_events_currency` | CHECK (`currency` ~ '^[A-Z]{3}$') | ISO-4217 shape |
| `ck_revenue_events_status` | CHECK (`status` IN ('recognized','partially_reversed','reversed')) | closed set |
| `ck_revenue_events_source_type` | CHECK (`source_type` IN ('deal','lead','business','payment','invoice')) | closed set |

**Indexes**: `(workspace_id, recognized_at)` — the period scan, frozen "event/date"; `(workspace_id, currency, recognized_at)` — the per-currency fold; `(workspace_id, status)`; `(workspace_id, source_entity_type, source_public_id)` — frozen "relation index".

**No** `deleted_at`, **no** `archived_at`, **no** `version`.

## 2. `revenue_reversals`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, UUIDv7 |
| `public_id` | text | `REVR-*`, immutable |
| `workspace_id` | uuid | FK → `workspaces`, NOT NULL |
| `revenue_event_id` | uuid | FK → `revenue_events`, NOT NULL, **ON DELETE RESTRICT** |
| `gross_amount` | numeric(18,4) | NOT NULL |
| `net_amount` | numeric(18,4) | NOT NULL |
| `currency` | char(3) | NOT NULL |
| `reason` | text | NOT NULL, closed set |
| `evidence_ref` | text | NULL — opaque |
| `note` | text | NULL |
| `reversed_by_membership_id` | uuid | FK → `memberships`, NOT NULL |
| `reversed_at` | timestamptz | NOT NULL |
| `idempotency_key` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

**Constraints**

| Name | Definition |
|---|---|
| `pk_revenue_reversals` | PRIMARY KEY (`id`) |
| `uq_revenue_reversals_public_id` | UNIQUE (`workspace_id`, `public_id`) |
| `uq_revenue_reversals_idempotency` | UNIQUE (`workspace_id`, `idempotency_key`) |
| `ck_revenue_reversals_gross_positive` | CHECK (`gross_amount` > 0) |
| `ck_revenue_reversals_net_non_negative` | CHECK (`net_amount` >= 0) — **not `> 0`**. A reversal's net is `> 0` for every ordinary reversal, and `= 0` **only** for the terminal gross-cleanup of `B9_REVERSAL_MODEL.md` §4.1a. Which of the two a given row is depends on the `Σ` of sibling rows and on the parent event, so it is not expressible in a single-row `CHECK`; it is enforced in the command under the event row lock (§2a), exactly like the `Σ` bound |
| `ck_revenue_reversals_net_le_gross` | CHECK (`net_amount` <= `gross_amount`) |
| `ck_revenue_reversals_gross_product_max` | CHECK (`gross_amount` <= 999999999999.9999) — the same explicit product limit as `revenue_events`, not a type implication |
| `ck_revenue_reversals_currency` | CHECK (`currency` ~ '^[A-Z]{3}$') |
| `ck_revenue_reversals_reason` | CHECK (`reason` IN ('refund','chargeback','correction','duplicate','cancellation','write_off')) |

**Indexes**: `(revenue_event_id)` — the fold; `(workspace_id, reversed_at)` — reversal activity reporting.

**No** `updated_at`, `deleted_at`, `archived_at`, `version`.

### 2a. The two invariants that are deliberately **not** CHECK constraints

```
Σ revenue_reversals.gross_amount ≤ revenue_events.gross_amount   (per event)
Σ revenue_reversals.net_amount   ≤ revenue_events.net_amount     (per event)
Σ gross = gross_amount  ⟹  Σ net = net_amount                    (one direction only)
revenue_reversals.net_amount = 0 ⟹ this row is the terminal gross-cleanup
revenue_reversals.currency        = revenue_events.currency
revenue_reversals.workspace_id    = revenue_events.workspace_id
```

A PostgreSQL `CHECK` evaluates one row of one table and **cannot** aggregate sibling rows or read a parent row. Writing these as `CHECK` constraints would be a specification that cannot be built. They are enforced where cross-row invariants actually can be:

| Invariant | Mechanism |
|---|---|
| Σ gross bound | `SELECT … FROM revenue_events WHERE id = ? FOR UPDATE` at the top of the reversal transaction, then re-read both sums under that lock, **derive `net`**, validate, insert, recompute `status` from both folds — all in one transaction (`B9_IDEMPOTENCY_CONCURRENCY.md` §4) |
| Σ net bound, and `Σ gross = G ⟹ Σ net = N` | a theorem of the running-total derivation (`B9_REVERSAL_MODEL.md` §4.1), not a second validation; asserted by reconciliation as a corruption alarm. The **converse does not hold** — net may exhaust while a gross rounding residual remains (`B9-D-A040`) |
| `net_amount = 0` admissible only as the terminal gross-cleanup | evaluated in the command under the event row lock: `Pg + Rg = G` **and** `Pn = N`, both read under that lock (`B9_REVERSAL_MODEL.md` §4.1a, `B9_IDEMPOTENCY_CONCURRENCY.md` §4 step 4b). A single-row `CHECK` cannot see the sibling sums or the parent event, so `ck_revenue_reversals_net_non_negative` admits the shape and the transaction admits the case |
| currency equality | validated in the same transaction, under the same lock |
| workspace equality | same; plus the FK to `revenue_events` means the parent is always resolvable |

This is the same discipline frozen B0 applies elsewhere: application transaction + row lock + unique index, never an impossible declarative constraint.

## 3. `attribution_touchpoints`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, UUIDv7 |
| `public_id` | text | `ATT-*` |
| `workspace_id` | uuid | FK → `workspaces`, NOT NULL |
| `subject_type` | text | NOT NULL — `business` \| `lead` |
| `subject_public_id` | text | NOT NULL |
| `source_type` | text | NOT NULL, closed set — always an **entity type with a registered `public_id` prefix** (`B9-D-A037`) |
| `source_entity_type` | text | NOT NULL |
| `source_public_id` | text | NOT NULL — a registered §A prefix (`JOB-*`, `RES-*`, `LEAD-*`, `BUS-*`) |
| `origin_kind` | text | NOT NULL, closed set — the acquisition-channel dimension (`discovery`, `import`, `manual`, `api`, `form`, `referral`, `other`). **Not** an entity reference |
| `source_code` | text | NULL — the DiscoverySource *contract string* (e.g. `SRC-1004`), carried exactly as frozen B3 carries `DiscoveryJob.provider_source`. Never an `EntityRef`, never workspace-resolved (`B9-D-A037`) |
| `occurred_at` | timestamptz | NOT NULL |
| `position` | integer | NOT NULL, ≥ 1 |
| `channel` | text | NULL |
| `campaign` | text | NULL |
| `recorded_by_membership_id` | uuid | FK → `memberships`, **NOT NULL** — every touchpoint names the human who recorded it (`B9-D-A036`) |
| `idempotency_key` | text | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

**Constraints**: PK (`id`); UNIQUE (`workspace_id`,`public_id`); UNIQUE (`workspace_id`,`idempotency_key`); **UNIQUE (`workspace_id`,`subject_type`,`subject_public_id`,`position`)** — one touch per ordinal per subject; CHECK (`position` >= 1); CHECK (`subject_type` IN ('business','lead')); CHECK (`source_type` IN ('discovery_job','discovery_result','lead','business')); CHECK (`origin_kind` IN ('discovery','import','manual','api','form','referral','other')).

**Indexes**: `(workspace_id, subject_type, subject_public_id, occurred_at)` — the first-touch candidate scan; `(workspace_id, occurred_at)`.

## 4. `revenue_attributions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, UUIDv7 |
| `revenue_event_id` | uuid | FK → `revenue_events`, NOT NULL, **UNIQUE**, ON DELETE RESTRICT |
| `workspace_id` | uuid | FK → `workspaces`, NOT NULL |
| `touchpoint_id` | uuid | FK → `attribution_touchpoints`, NULL, ON DELETE RESTRICT — set when the winner was a persisted touchpoint; NULL when the winner was a derived provenance candidate (`B9_FIRST_TOUCH_MODEL.md` §4) |
| `candidate_kind` | text | NOT NULL — `touchpoint` \| `derived_provenance`; records which resolution source won |
| `derived_result_public_id` | text | NULL — the `RES-*` `DiscoveryResult` that won, when `candidate_kind='derived_provenance'` |
| `origin_kind` | text | NOT NULL — closed set, as on touchpoints |
| `source_code` | text | NULL — DiscoverySource contract string; never an `EntityRef` |
| `model` | text | NOT NULL |
| `allocation_bps` | integer | NOT NULL |
| `source_type` | text | NOT NULL |
| `source_entity_type` | text | NOT NULL |
| `source_public_id` | text | NOT NULL |
| `discovery_job_public_id` | text | NULL |
| `business_public_id` | text | NULL |
| `lead_public_id` | text | NULL |
| `deal_public_id` | text | NULL |
| `acquired_at` | timestamptz | NOT NULL |
| `resolved_at` | timestamptz | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

**Constraints**: PK (`id`); **UNIQUE (`revenue_event_id`)** — at most one attribution per event, the structural guarantee against over-attribution; CHECK (`allocation_bps` = 10000); CHECK (`model` = 'first_touch'); CHECK (`candidate_kind` IN ('touchpoint','derived_provenance')); CHECK (`origin_kind` IN ('discovery','import','manual','api','form','referral','other')); CHECK (`candidate_kind` = 'touchpoint' AND `touchpoint_id` IS NOT NULL AND `derived_result_public_id` IS NULL OR `candidate_kind` = 'derived_provenance' AND `touchpoint_id` IS NULL AND `derived_result_public_id` IS NOT NULL) — the two resolution sources are mutually exclusive and each is fully identified, which is expressible on a single row.

**Indexes**: `(workspace_id, origin_kind)`; `(workspace_id, discovery_job_public_id)`; `(workspace_id, source_type, source_entity_type, source_public_id)` — revenue-by-source rollups.

`revenue_attributions.workspace_id = revenue_events.workspace_id` is a cross-row invariant, enforced in the recognition transaction (which writes both rows), not as a `CHECK`.

## 5. `financial_reconciliation_cases`

Columns as tabulated in `B9_RECONCILIATION_MODEL.md` §5.

Two columns exist for resolution idempotency and are added here by `B9-FIX.1` (`M-9`): `resolution_idempotency_key` (text, NULL) and `resolution_request_hash` (text, NULL). Both are written **only** by a successful `ResolveFinancialReconciliationCase` and are immutable thereafter. They are nullable because a case exists, openable and assignable, long before any resolution attempt — putting a NOT NULL key on the case at open time would have invented a key for an action nobody had taken.

**Constraints**: PK (`id`); UNIQUE (`workspace_id`,`public_id`); **UNIQUE (`workspace_id`,`resolution_idempotency_key`) WHERE `resolution_idempotency_key` IS NOT NULL** — durable idempotency for the one resolution a case can have (`B9_IDEMPOTENCY_CONCURRENCY.md` §1); **UNIQUE (`workspace_id`,`fingerprint`) WHERE `status` IN ('open','investigating')** — one live case per condition; CHECK (`status` IN ('open','investigating','resolved','dismissed')); CHECK (`severity` IN ('info','warning','critical')); CHECK (`case_type` IN … 17 values …); CHECK (`status` NOT IN ('resolved','dismissed') OR (`resolved_by_membership_id` IS NOT NULL AND `resolution_reason` IS NOT NULL AND `resolved_at` IS NOT NULL)) — a closed case always names who closed it and why, which *is* expressible on a single row; CHECK (`status` NOT IN ('resolved','dismissed') OR `resolution_idempotency_key` IS NOT NULL) — and always names the key that closed it.

**Indexes**: `(workspace_id, status, severity)`; `(workspace_id, detected_at)`; `(workspace_id, case_type)`.

## 6. Retention and deletion

| Table | Retention | Deletion |
|---|---|---|
| `revenue_events` | indefinite | **never** |
| `revenue_reversals` | indefinite | **never** |
| `revenue_attributions` | indefinite | **never** |
| `attribution_touchpoints` | indefinite | **never** |
| `financial_reconciliation_cases` | ≥ 24 months after closure (`B9-D-B006`) | prunable after retention; never while `open`/`investigating` |

`ON DELETE RESTRICT` on every inbound FK means a `revenue_events` row cannot be removed while a reversal or attribution references it — a second, database-level guarantee behind the "no delete path" rule. Workspace-deletion interaction is in `B9_SECURITY_PRIVACY.md` §5.

## 7. Summary

```
B9_TABLE_COUNT = 5
  revenue_events, revenue_reversals, attribution_touchpoints,
  revenue_attributions, financial_reconciliation_cases
```

**No table stores a currency exponent, an FX rate, a running total, or a provider payload.** `revenue_attributions` stores no amount and no currency, so attribution cannot express a money value (`B9_REVENUE_FIREWALL.md` §6).

Three are frozen B0 table names; two are additive (`B9-AM-004`, `B9-AM-006`). No table is owned by B9 outside this list, and B9 writes no table outside it.
