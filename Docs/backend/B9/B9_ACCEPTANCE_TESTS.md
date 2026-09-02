# B9 — Acceptance Tests

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **NC** = negative control: the test passes only if the described implementation **fails**.

## 1. Domain ownership — AT-DOM

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-DOM-1 **NC** | — | a B9 table, service or handler holds a write reference to a B2/B3/B6/B7/B8/B10 table | rejected — B9's write surface is its own five tables | `B9_DOMAIN_OWNERSHIP.md` §5 |
| AT-DOM-2 **NC** | — | a sixth B9-owned authoritative table appears | rejected without a controlled amendment | `B9_DOMAIN_OWNERSHIP.md` §2 |
| AT-DOM-3 **NC** | — | a `DELETE` path exists against `revenue_events` or `revenue_reversals` | rejected — no endpoint, no `deleted_at`, `ON DELETE RESTRICT` inbound | `B9_STORAGE_MODEL.md` §6 |
| AT-DOM-4 | the controlled amendment set | count the frozen artifacts it targets, and compare against the enumeration beside the counter | `FROZEN_ARTIFACTS_AFFECTED = 11`, and the enumeration lists exactly eleven contract-bearing artifacts; the three downstream-synchronization files are listed separately and excluded by a stated metric | `B9_CONTROLLED_AMENDMENTS.md` §1a |

## 2. Financial model — AT-FM

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-FM-1 **NC** | — | an implementation stores a running `recognized_total` and serves selectors from it | rejected — totals are folds, a stored total is a second truth | `B9_FINANCIAL_MODEL.md` §4 |
| AT-FM-2 **NC** | a recognized event | an implementation corrects it by updating `gross_amount` | rejected — corrections are compensating facts | `B9_FINANCIAL_MODEL.md` §5 |
| AT-FM-3 **NC** | — | a B9 document or endpoint claims IFRS/ZATCA/statutory compliance | rejected | `B9_FINANCIAL_MODEL.md` §7 |
| AT-FM-4 **NC** | — | the gross contract reports an event exhausted while the net contract reports a residual on it | fails | `B9_FINANCIAL_MODEL.md` §4 |
| AT-FM-5 **NC** | an event with net exhausted and a gross residual outstanding | an implementation treating the state as impossible, or marking the event `reversed` | fails — it is reachable, is correctly `partially_reversed`, and is closed by the terminal gross-cleanup | `B9-D-A040` |

## 3. Recognition — AT-REC

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-REC-1 | a `DEAL-*` resolving in-workspace, actor holds `revenue.recognize` | `RecordRevenueEvent` with gross 1000 SAR, net 1000 SAR, `recognized_at` | **exactly one** `revenue_events` row, `status='recognized'`, one `RevenueRecognized` on the outbox | `B9_REVENUE_RECOGNITION_POLICY.md` §1 |
| AT-REC-2 | a `LEAD-*` source, no Deal exists | same | succeeds — a Deal is not required | §4 |
| AT-REC-3 | a `BUS-*` source | same | succeeds | §4 |
| AT-REC-4 **NC** | — | `source_type='subscription'` | rejected `B9-AF-004` — not in the closed set | §4 |
| AT-REC-5 **NC** | a `DEAL-*` belonging to another workspace | `RecordRevenueEvent` | `404 ENTITY_NOT_FOUND` (`B9-AF-005`), indistinguishable from absent | §4 |
| AT-REC-6 **NC** | `source_type='deal'`, `source_ref.entity_type='lead'` | `RecordRevenueEvent` | rejected `B9-AF-006` | §4 |
| AT-REC-7 | actor holds only `revenue.view` | `RecordRevenueEvent` | `403 PERMISSION_DENIED` (`B9-AF-001`); zero rows | `B9_RBAC_TENANCY.md` §3 |
| AT-REC-8 | a valid recognition | inspect the row | `recognized_by_membership_id` names a real human membership | `B9_REVENUE_RECOGNITION_POLICY.md` §3 |
| AT-REC-9 **NC** | — | any code path creates a `revenue_events` row other than a committed `RecordRevenueEvent` | rejected | §10 |
| AT-REC-10 **NC** | `gross` omitted from the request | `RecordRevenueEvent` | rejected — `gross` is frozen-required; **no** default from `Deal.value`/`Plan.price`/`Payment.amount` | §10 |
| AT-REC-11 **NC** | `recognized_at` = now + 1 hour | `RecordRevenueEvent` | rejected `B9-AF-016` | `B9_TIME_PERIOD_MODEL.md` §5 |
| AT-REC-12 | `recognized_at` = now + 2 minutes (clock skew) | `RecordRevenueEvent` | accepted — within the 5-minute tolerance | §5 |
| AT-REC-13 | `recognized_at` = 400 days ago | `RecordRevenueEvent` | accepted, and a `backdated_recognition` case is opened | §5 |
| AT-REC-14 **NC** | — | an admin/import/backfill surface writes `revenue_events` outside the governed command | rejected — no such surface exists | `B9_REVENUE_RECOGNITION_POLICY.md` §3 |
| AT-REC-15 **NC** | an event with any net recognized value remaining | recognize the same source again | rejected `B9-AF-002` — the guard's `status <> 'reversed'` predicate now requires **both** folds exhausted | `B9_REVENUE_RECOGNITION_POLICY.md` §7 |
| AT-REC-16 **NC** | — | a source-uniqueness index omitting `source_entity_type` | fails — one canonical identity, used everywhere | `B9_STORAGE_MODEL.md` §1 |
| AT-REC-17 | an event fully reversed in gross **and** net | recognize the same source again | **succeeds** — a source is released only when nothing remains | `B9_REVERSAL_MODEL.md` §7 |

## 4. Immutability — AT-IMM

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-IMM-1 **NC** | a recognized event | a `PATCH`/`PUT` route addressing it | rejected — no such route exists | `B9_API_DTO_CONTRACTS.md` §1 |
| AT-IMM-2 **NC** | a recognized event | an implementation updates `gross_amount`/`net_amount`/`currency`/`recognized_at`/`source_type`/`source_ref` after insert | rejected | `B9_REVENUE_EVENT_MODEL.md` §3 |
| AT-IMM-3 **NC** | a recognized event | `DELETE /revenue-events/{id}`, or a soft delete | rejected — no endpoint, no column | §3 |
| AT-IMM-4 **NC** | — | a typed `deal_id`/`payment_id` column or DTO field is added beside `source_ref` | rejected — contradicts the frozen "replaces separate typed refs" clause | §2 |
| AT-IMM-5 | reversals accumulate to the full amount | inspect `status` | reaches `reversed` only via the §5 fold, never by direct assignment | §5 |
| AT-IMM-6 **NC** | — | an implementation derives `status` from the gross fold alone | fails — it can mark an event `reversed` while net recognized revenue survives | `B9_REVENUE_EVENT_MODEL.md` §5 |
| AT-IMM-7 **NC** | an event whose net fold is exhausted but whose gross fold is not | an implementation derives `status` from the **net** fold alone | fails — it would label a live gross residual `reversed` and release the source early | `B9-D-A040` |

## 5. Reversal — AT-REVR

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-REVR-1 | recognized 1000 SAR | reverse 1000 SAR | one reversal row; `status='reversed'`; **the original 1000 row is unchanged and still readable** | `B9_REVERSAL_MODEL.md` §2 |
| AT-REVR-2 | recognized 1000 SAR | reverse 300 SAR | net recognized = **700**; `status='partially_reversed'`; original still 1000 | §2 |
| AT-REVR-3 | recognized 1000, reversed 300 | reverse a further 200 | net = **500**; two reversal rows; `status='partially_reversed'` | §2 |
| AT-REVR-4 **NC** | recognized 1000, reversed 500 | reverse 600 | rejected `B9-AF-014`; net stays 500 | §4 |
| AT-REVR-5 **NC** | recognized 1000 | two concurrent reversals of 600 and 600 | exactly one commits; the other gets `B9-AF-014` | §5 |
| AT-REVR-6 **NC** | a reversal row | an implementation deletes or updates it | rejected — append-only | §6 |
| AT-REVR-7 **NC** | — | a reversal represented as a negative-amount `revenue_events` row | rejected — `CHECK (gross_amount > 0)` | §9 |
| AT-REVR-8 **NC** | a SAR event | reverse in USD | rejected `B9-AF-015` | §4 |
| AT-REVR-9 **NC** | an event in another workspace | reverse it | `404 ENTITY_NOT_FOUND` (`B9-AF-019`), never `403` | §9 |
| AT-REVR-10 **NC** | a fully reversed event | reverse again | rejected `B9-AF-018` | §4 |
| AT-REVR-11 **NC** | — | reverse with `reason='oops'` | rejected `B9-AF-017` — closed reason set | §3 |
| AT-REVR-12 | a wrong-period recognition | full reversal `reason='correction'`, then a fresh recognition at the right date | both facts persist; the audit trail shows the compensating pair; nothing was edited | §7 |
| AT-REVR-13 | an event fully reversed | recognize the **same** source again | **succeeds** — the source guard's `status <> 'reversed'` predicate releases it | §7 |
| AT-REVR-14 **NC** | an event partially reversed | recognize the same source again | rejected `B9-AF-002` — a live source is still guarded | §7 |
| AT-REVR-15 **NC** | event gross 1000 / net 800 | reversal request carries its own `net` | rejected `B9-AF-035` — `net` is derived, never accepted | `B9_REVERSAL_MODEL.md` §4 |
| AT-REVR-16 | event gross 1000 / net 800 | full reversal, `gross=1000` | derived `net` = **800**; net recognized = **0**; both folds exhausted together | `B9_REVERSAL_MODEL.md` §4.1 |
| AT-REVR-17 | event gross 1000 / net 800 | partial reversal, `gross=250` | derived `net` = **200**; remaining gross 750 / net 600 | `B9_REVERSAL_MODEL.md` §4.2 |
| AT-REVR-18 **NC** | event gross 1000 / net 800 | attempt the pre-FIX.1 corruption `gross=1000, net=1` | rejected `B9-AF-035`; no path reaches `status='reversed'` with net still standing | `B9_FAILURE_MODE_ANALYSIS.md` §3.5 |
| AT-REVR-19 | event gross 1000 / net 800 | three reversals of `gross` 333.3333, 333.3333, 333.3334 | derived nets 266.6666 / 266.6667 / 266.6667 sum to **800.0000** exactly; nothing stranded | `B9_REVERSAL_MODEL.md` §4.2 |
| AT-REVR-20 **NC** | event gross 1000 / net 800 | an implementation rounding `Rg × N / G` per reversal instead of the running total | fails — `Σ net` misses 800 and the event can never reach `reversed` | `B9_REVERSAL_MODEL.md` §4.1 |
| AT-REVR-21 **NC** | event gross 1000 / net 1 | reversal `gross = 0.0001` | derived net rounds to 0 → rejected `B9-AF-029 REVERSAL_NET_UNDERFLOW` | `B9_FAILURE_CATALOG.md` |
| AT-REVR-22 **NC** | — | any state where the gross fold is exhausted but the net fold is not | **unreachable** by the write path; a hit is `reversal_exceeds_recognized` corruption | `B9-D-A034` |
| AT-REVR-23 | event gross 1000 / net 500 | reverse `gross = 999.9999` | derived `net` = **500.0000**; remaining gross **0.0001**, remaining net **0.0000**; `status` stays `partially_reversed` and the source is **not** released | `B9_REVERSAL_MODEL.md` §4.1 |
| AT-REVR-24 | the state left by `AT-REVR-23` | reverse the final `gross = 0.0001` | derived `net` = **0**; **commits** as the terminal gross-cleanup; both folds exhaust; `status='reversed'`; the source is released | `B9_REVERSAL_MODEL.md` §4.1a |
| AT-REVR-25 **NC** | event gross **1000** / net **1**, after one reversal of `gross = 999.95` — the state left by `AT-REVR-31`'s first step, where **net is already exhausted** (`Pg = 999.95`, `Pn = 1.0000`) and `0.05` of gross remains | reverse `gross = 0.02` — a valid scale-4 amount, and **less than** the remaining gross | derived `Rn = ROUND_HALF_UP(999.97 × 1 / 1000, 4) − 1.0000 = 1.0000 − 1.0000 = **0**`, but `Pg + Rg = 999.97 < 1000`, so §4.1a condition 1 fails and the reversal is **non-terminal** → rejected `B9-AF-029 REVERSAL_NET_UNDERFLOW`. Exhausted net (`Pn = N`) is **not** sufficient on its own: the cleanup must consume the *exact* remaining gross. `AT-REVR-31`'s second step then reverses the whole `0.05` and commits | §4.1a |
| AT-REVR-26 **NC** | an event with `Σ net = net_amount` but `Σ gross < gross_amount` | read `status`, or attempt to re-recognize the source | `status` is `partially_reversed` and the source is **still guarded** (`B9-AF-002`); an implementation releasing it fails | `B9-D-A034`, `B9-D-A040` |
| AT-REVR-27 **NC** | any event | a reversal request that would book `net = 0` while gross remains outstanding | rejected `B9-AF-029`; no arbitrary zero-net reversal is admissible | §4.1a |
| AT-REVR-28 **NC** | — | an implementation asserting `Σ gross = G ⟺ Σ net = N` in code, comment or constraint | fails — only the forward implication holds | `B9-D-A040` |
| AT-REVR-29 | event gross 3 / net 1 | three reversals of `gross` 1, 1, 1 | derived nets **0.3333 / 0.3334 / 0.3333** sum to exactly **1.0000**; `status='reversed'`; nothing stranded | `B9_REVERSAL_MODEL.md` §4.1 |
| AT-REVR-30 | event gross 7 / net 2 | reversals `2, 3, 2` and, on a second identical event, `3, 2, 2` | intermediate nets differ (**0.5714/0.8572/0.5714** vs **0.8571/0.5715/0.5714**) but both sum to exactly **2.0000**; order never changes the exhausted totals | `B9_REVERSAL_MODEL.md` §4.1 |
| AT-REVR-31 | event gross 1000 / net 1 | reverse `gross = 999.95`, then `gross = 0.05` | first derives `net = 1.0000`; second derives `net = 0` and commits as the terminal cleanup; `status='reversed'` | §4.1a |
| AT-REVR-32 | an event closed by a terminal gross-cleanup (`AT-REVR-24`) | recognize the **same** source again | **succeeds** — release follows the ordinary rule, both folds exhausted; no special case applies after a cleanup | `B9_REVERSAL_MODEL.md` §7 |

## 6. Attribution — AT-ATTR

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-ATTR-1 **NC** | a valid recognition whose attribution cannot be resolved | recognition | **must still commit**; an implementation that refuses, deletes or suppresses it fails | `B9_ATTRIBUTION_MODEL.md` §1 |
| AT-ATTR-2 **NC** | — | recognized revenue computed by summing attributed rows (the `FB-B9-006` defect) | rejected | §1 |
| AT-ATTR-3 **NC** | one event | two `revenue_attributions` rows | rejected by `UNIQUE (revenue_event_id)` | §5 |
| AT-ATTR-4 **NC** | — | `allocation_bps` other than 10000 in Phase 1 | rejected by `CHECK` | §5 |
| AT-ATTR-5 **NC** | — | an attribution whose workspace differs from its event's | rejected `B9-AF-021` | §5 |
| AT-ATTR-6 **NC** | a recognized event | any attribution operation mutates `gross`/`net` | rejected — ADR-008: *"Attribution never changes RevenueEvent amount"* | §5 |
| AT-ATTR-7 | 1000 SAR recognized, fully attributed to Source A | reverse 300 | net recognized **700** *and* net attributed to A **700** | §6 |
| AT-ATTR-8 **NC** | same | an implementation reporting recognized 700 with attributed 1000 | rejected — structurally unreachable | §6 |
| AT-ATTR-9 **NC** | an attributed event | the Lead is renamed/re-owned | the snapshot is unchanged | §8 |
| AT-ATTR-10 **NC** | an attributed event | the Lead is merged into another | the snapshot keeps its original `lead_public_id` | §8 |
| AT-ATTR-11 **NC** | an attributed event | the Deal is edited, reopened or re-valued | the snapshot is unchanged | §8 |
| AT-ATTR-12 **NC** | an attributed event | the Business is rediscovered by a later job | the snapshot is unchanged; a later touch cannot win a first-touch decision already made | §8 |
| AT-ATTR-13 | an attributed event | the DiscoverySource is renamed | the grouping is unchanged; the **display name** updates | §9 |
| AT-ATTR-14 | an attributed event | the DiscoverySource is deleted/retired | revenue stays attributed; the report marks the source `retired` | §9 |
| AT-ATTR-15 **NC** | any dataset | compute `gross_over_attributed` | **always 0**; a non-zero value opens the `over_attribution` critical case | §10 |
| AT-ATTR-16 **NC** | — | `SRC-*` written to `source_public_id`, or resolved workspace-scoped | fails — frozen registry §B keeps it a contract string | `B9_ATTRIBUTION_MODEL.md` §4c |
| AT-ATTR-17 **NC** | — | `RecordTouchpoint` accepted with a null or system `recorded_by_membership_id` | fails — touchpoints are human-recorded; the column is NOT NULL | `B9-D-A036` |
| AT-ATTR-18 **NC** | — | a snapshot whose `candidate_kind` disagrees with which of `touchpoint_id`/`derived_result_public_id` is populated | rejected by `CHECK` | `B9_STORAGE_MODEL.md` §4 |
| AT-ATTR-19 **NC** | — | any B9 write to `discovery_results` during resolution | fails | `B9_ATTRIBUTION_MODEL.md` §11 |
| AT-ATTR-20 | a touchpoint whose `source_ref` names `JOB-*` | resolve in-workspace | resolves — every touchpoint `source_type` names a registered §A workspace-scoped entity | `B9_ATTRIBUTION_MODEL.md` §4a |
| AT-ATTR-21 **NC** | — | an implementation storing a Deal owner on `revenue_attributions`, or otherwise snapshotting ownership into financial truth | fails — `owner_ref` is a display dimension resolved live | `B9-D-A042` |

## 7. First-touch — AT-FT

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-FT-1 | three qualifying touchpoints at distinct times | recognize | the **earliest** wins, at 10000 bps | `B9_FIRST_TOUCH_MODEL.md` §4 |
| AT-FT-2 | two touchpoints with identical `occurred_at` | recognize twice over unchanged data | the **same** winner both times — `position`, then `created_at`, then `public_id` decide | §4 |
| AT-FT-3 **NC** | — | the winner is selected with `LIMIT 1` and no total-order `ORDER BY` | rejected — non-deterministic | §8 |
| AT-FT-4 **NC** | a touchpoint with `occurred_at` after `recognized_at` | recognize | that touchpoint is **not** a candidate | §2 |
| AT-FT-5 **NC** | — | attribution recomputed at read time | rejected — history would change under later edits | §6 |
| AT-FT-6 **NC** | no qualifying touchpoint | recognize | **must succeed**, unattributed; an implementation that rejects fails | §5 |
| AT-FT-7 **NC** | a chain that would leave the workspace | walk provenance | rejected — every hop re-applies the workspace filter | §8 |
| AT-FT-8 | two Leads merged after recognition | re-read the snapshot | unchanged; future recognitions follow the surviving Lead | §5 |
| AT-FT-9 | the winning source is retired after recognition | re-read the snapshot | unchanged; still attributed | §5 |
| AT-FT-10 | a chain with **no** touchpoint but a qualifying `discovery_results` row | recognize | attributed from the derived candidate: `candidate_kind='derived_provenance'`, `touchpoint_id IS NULL`, `derived_result_public_id` set | `B9_FIRST_TOUCH_MODEL.md` §2.2, §4 |
| AT-FT-11 | a touchpoint and a derived candidate with identical `occurred_at` | recognize | the **touchpoint** wins (order key b), deterministically and repeatably | `B9_FIRST_TOUCH_MODEL.md` §4 |
| AT-FT-12 | the provenance read raises a DB error inside the recognition transaction | commit | `ROLLBACK TO SAVEPOINT` leaves the transaction usable; the event commits unattributed; `attribution_unresolved` opens | `B9_FIRST_TOUCH_MODEL.md` §4.1 |
| AT-FT-13 **NC** | — | any write to `discovery_results` or another B3 table during resolution | fails — the derived-candidate read is strictly read-only | `B9_DOMAIN_OWNERSHIP.md` §5 |
| AT-FT-14 **NC** | — | `SRC-*` used as a workspace-scoped `EntityRef`, or written to `source_public_id` | fails — it is a contract string carried in `source_code` | `B9_ATTRIBUTION_MODEL.md` §4c |
| AT-FT-17 | a Business with a `filtered = true` `discovery_results` row at `t0` and a `filtered = false` row at `t1 > t0`, both before `recognized_at` | recognize against that chain with no recorded touchpoint | attributes to the **`t1` unfiltered** observation; the earlier filtered row is not a candidate and does not win first-touch | `B9_FIRST_TOUCH_MODEL.md` §2.2a, `B9-D-A044` |
| AT-FT-18 **NC** | a Business whose **only** `discovery_results` row is `filtered = true` | recognize against that chain with no recorded touchpoint | the event commits and reports **unattributed**; an implementation that admits the filtered row as a first-touch candidate **fails**. Recognition is unaffected either way | `B9_FIRST_TOUCH_MODEL.md` §2.2a, `B9-D-A044` |
| AT-FT-15 | two derived candidates with equal `discovered_at` and `page_index` | resolve | ordered by `position_in_page`, then `RES-*`; same winner on every run | `B9_FIRST_TOUCH_MODEL.md` §4 |

## 8. Unattributed revenue — AT-UNATT

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-UNATT-1 | a recognition with no touchpoint | selectors | fully counted in recognized; appears in `unattributed_amount` | `B9_ATTRIBUTION_MODEL.md` §7 |
| AT-UNATT-2 | 1000 attributed + 500 unattributed | selectors | recognized 1500, attributed 1000, unattributed 500 | §7 |
| AT-UNATT-3 | mixed dataset | selectors | `Net Recognized = Attributed + Unattributed` **exactly** | `B9_ANALYTICS_PROJECTIONS.md` §3 |
| AT-UNATT-4 | an unattributed event | reverse 300 of 1000 | unattributed becomes 700; attributed unchanged | §7 |
| AT-UNATT-5 | an unattributed event | `GET /attribution` | `unattributed_amount` is populated (frozen field) | `B9_API_DTO_CONTRACTS.md` §2 |
| AT-UNATT-6 **NC** | — | an implementation hiding unattributed revenue from totals | rejected | `B9_ATTRIBUTION_MODEL.md` §7 |

## 9. Currency — AT-CUR

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-CUR-1 **NC** | a SAR event | reverse in USD | rejected `B9-AF-015` | `B9_CURRENCY_MONEY_MODEL.md` §7 |
| AT-CUR-2 **NC** | `gross.currency=SAR`, `net.currency=USD` | recognize | rejected `B9-AF-011` | §7 |
| AT-CUR-3 **NC** | — | a monetary value stored as binary float, or `amount` serialised as a JSON number | rejected | §7 |
| AT-CUR-4 **NC** | SAR and USD revenue in one workspace | request a summary | **no** scalar total; per-currency rows only | §2 |
| AT-CUR-5 **NC** | — | an exchange rate applied anywhere in B9 | rejected — no rate source exists | §2 |
| AT-CUR-6 | a workspace with presentation currency SAR | any single-`Money` operation called without `currency` | reports in SAR, and `Money.currency` names it; the default is read from frozen `BACKEND_ANALYTICS_SEMANTICS.md` and `B1_IDENTITY_DATA_MODEL.md`, not invented | §8 |
| AT-CUR-7 **NC** | — | an implementation treating an absent `currency` as "sum every currency", or as an arbitrary pick | fails | §8 |
| AT-CUR-8 | workspace presentation currency **SAR**; the workspace holds both SAR and USD recognized rows in a closed past period | call the parameterless single-`Money` operation; then `UpdateWorkspace` sets the workspace currency to **USD** (`workspace.manage`); then repeat the identical request | first call reports the **SAR** rows with `Money.currency = SAR`; second call reports the **USD** rows with `Money.currency = USD`. **No stored amount is converted, restated or moved** — the default selects, it never converts | `B9-D-A043`; `B9_CURRENCY_MONEY_MODEL.md` §8a |
| AT-CUR-9 **NC** | the same workspace after the currency change | an implementation resolving the default **"as of"** the reporting period rather than at request time | fails — frozen B1 stores no history of `workspaces.currency` (no history table; `version`/`updated_at` only), so an as-of rule must invent a history or apply an exchange rate | `B9-D-A043`, `B9-D-A017` |
| AT-CUR-10 **NC** | any workspace | an implementation converting a stored amount into the workspace presentation currency at read time, at any rate, from any source | fails — `FX_CONVERSION_LEAKS = 0`; B9 holds no rate, no rate date and no conversion authority | `B9-D-A017`; §2 |

## 10. Money — AT-MON

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-MON-1 **NC** | `gross=0` or `gross=-100` | recognize | rejected `B9-AF-009` | `B9_CURRENCY_MONEY_MODEL.md` §4 |
| AT-MON-2 **NC** | `net > gross` | recognize | rejected `B9-AF-010` | §4 |
| AT-MON-3 **NC** | `amount="10.123456"` | recognize | rejected `B9-AF-008` — scale ≤ 4 | §4 |
| AT-MON-4 | `100.00` then `100.0000` for one source | recognize twice | the second is a **duplicate**, not a distinct amount — canonical decimal comparison | `B9_IDEMPOTENCY_CONCURRENCY.md` §2 |
| AT-MON-5 **NC** | — | a document asserting scale 4 is an ISO-4217 requirement | fails — it is a product policy inherited from the frozen `Money` pattern | `B9_CURRENCY_MONEY_MODEL.md` §4 |
| AT-MON-6 **NC** | — | a document calling `999999999999.9999` "implied by `NUMERIC(18,4)`" | fails — the type permits `99999999999999.9999`; the tighter bound is an explicit product limit | `B9_CURRENCY_MONEY_MODEL.md` §4 |
| AT-MON-7 **NC** | — | a recognition or reversal whose amount exceeds the `999999999999.9999` product bound | rejected `B9-AF-008` by a named `CHECK` on both financial tables, not merely by the column type | `B9_STORAGE_MODEL.md` §1, §2 |

## 11. Time & period — AT-TIME

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-TIME-1 **NC** | — | revenue periodised by `created_at`, `Deal.closed_at`, or `Payment.captured_at` | rejected — `recognized_at` only | `B9_TIME_PERIOD_MODEL.md` §7 |
| AT-TIME-2 **NC** | — | a naive local timestamp stored in any B9 column | rejected — all `timestamptz` UTC | §7 |
| AT-TIME-3 **NC** | an event at exactly local midnight on a period boundary | run two adjacent period queries | counted **once**, in the later period — half-open ranges | §3 |
| AT-TIME-4 | a workspace in a DST-observing zone | month boundaries | computed by the zone's own rules, not a fixed offset | §3 |
| AT-TIME-5 **NC** | `recognized_at` = now + 1 hour | recognize | rejected `B9-AF-016` | §5 |
| AT-TIME-6 | `recognized_at` = 400 days ago | recognize | accepted; `backdated_recognition` case opened | §5 |
| AT-TIME-7 **NC** | January recognition reversed in March | period queries | **January's** net falls; March's is unaffected. An implementation reducing March fails | §4 |
| AT-TIME-8 | a provider refund arrives after a manual recognition | reconciliation scan twice over unchanged state | identical case sets both times — determinism from state, not ordering | §6 |

## 12. Idempotency — AT-IDEM

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-IDEM-1 **NC** | — | `RecordRevenueEvent` without `idempotency_key` | rejected — frozen `required[]` | `B9_IDEMPOTENCY_CONCURRENCY.md` §8 |
| AT-IDEM-2 **NC** | a successful recognition | same key, **different** payload | `409 IDEMPOTENCY_CONFLICT` (`B9-AF-003`); nothing written. Silently returning the original fails | §2 |
| AT-IDEM-3 **NC** | a successful recognition | a **fresh** key, same source | `409 DUPLICATE_RECOGNITION` (`B9-AF-002`). An implementation relying on the key alone fails | §8 |
| AT-IDEM-4 | a successful recognition | same key, same payload | the **stored result** is returned; one row total | §2 |
| AT-IDEM-5 | recognition with `gross="100.00"` | replay with `gross="100.0000"` | treated as the **same** payload — canonical decimal comparison, not a conflict | §2 |
| AT-IDEM-6 **NC** | a payment-evidenced recognition | the client retries three times with three different keys | **one** event; the source guard stops the others | §1 |
| AT-IDEM-7 | a resolved case | replay `ResolveFinancialReconciliationCase` with the same key and payload | the stored outcome is returned; no second write; `resolution_request_hash` matches | `B9_IDEMPOTENCY_CONCURRENCY.md` §1-§2 |
| AT-IDEM-8 **NC** | a resolved case | the same resolution key with a **different** payload | `B9-AF-003 IDEMPOTENCY_CONFLICT`; nothing written | `B9_IDEMPOTENCY_CONCURRENCY.md` §2 |
| AT-IDEM-9 **NC** | — | any B9 idempotency identity enforced only in Redis or an in-process cache | fails — every one is a database unique index | `B9_IDEMPOTENCY_CONCURRENCY.md` §2 |
| AT-IDEM-10 | many open cases in one workspace | inspect storage | all carry `resolution_idempotency_key IS NULL`; the partial unique index tolerates them | `B9_STORAGE_MODEL.md` §5 |
| AT-IDEM-11 | a committed terminal gross-cleanup reversal | replay with the same key and payload | the stored zero-net row is returned unchanged; no second row | `B9_IDEMPOTENCY_CONCURRENCY.md` §2 |
| AT-IDEM-12 **NC** | the same terminal-cleanup key | a different payload (different `gross`, `reason` or `reversed_at`) | `409 IDEMPOTENCY_CONFLICT` (`B9-AF-003`); nothing written | `B9_IDEMPOTENCY_CONCURRENCY.md` §2 |

## 13. Concurrency — AT-CONC

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-CONC-1 | two concurrent recognitions for the same source | commit | exactly one succeeds; the other gets `B9-AF-002`/`B9-AF-003` | `B9_IDEMPOTENCY_CONCURRENCY.md` §5 |
| AT-CONC-2 | a payment-triggered path is attempted alongside a manual one | — | cannot arise — no payment-triggered path exists | §5 |
| AT-CONC-3 | recognized 1000 | two concurrent reversals of 300 and 200 | both commit, serialised; net 500 | §5 |
| AT-CONC-4 **NC** | recognized 1000 | two concurrent reversals of 700 and 700 | one commits, one gets `B9-AF-014`. **Never over-reversed** | §5 |
| AT-CONC-5 | recognized 1000 | a full reversal races a 300 partial | whichever locks first wins; the loser gets `B9-AF-018` or `B9-AF-014` | §5 |
| AT-CONC-6 | recognized 1000 | two identical full reversals, same key | one row (replay); different keys → the second gets `B9-AF-018` | §5 |
| AT-CONC-7 | a recognition racing a B8 refund | commit | independent; the recognition commits; `refund_without_reversal` opened later | §5 |
| AT-CONC-8 | a recognition racing a reconciliation scan | scan completes | the scan is read-only; at most one case; a stale case closes on the next run | §5 |
| AT-CONC-9 **NC** | one event | two attribution snapshots attempted | impossible — `UNIQUE (revenue_event_id)`, written in the recognition transaction | §5 |
| AT-CONC-10 | two operators resolving one case concurrently | commit | one succeeds; the other gets `B9-AF-024` | §5 |
| AT-CONC-11 **NC** | two touchpoints claiming `position=1` for one subject | commit | the second is rejected `B9-AF-020` | §5 |
| AT-CONC-12 **NC** | a reversal racing deletion of its event | — | impossible — no delete path plus `ON DELETE RESTRICT` | §5 |
| AT-CONC-13 | two scans detecting the same condition | commit | one live case — the `fingerprint` partial unique | §5 |
| AT-CONC-14 **NC** | — | a reversal path reading `Σ reversals` **before** locking the event row | rejected — the read must be under the lock | §8 |
| AT-CONC-15 | provenance resolution raises inside the recognition transaction | commit | savepoint rollback; the recognition commits unattributed; a case opens | `B9_FIRST_TOUCH_MODEL.md` §4.1 |
| AT-CONC-16 **NC** | two concurrent partial reversals | derive `net` outside the event row lock, or from a pre-lock read | fails — net must be derived from sums read under the lock | `B9_IDEMPOTENCY_CONCURRENCY.md` §4 |
| AT-CONC-17 | two concurrent resolutions of one case with the same key | fire simultaneously | one commits; the other replays the stored outcome | `B9_IDEMPOTENCY_CONCURRENCY.md` §5 |
| AT-CONC-18 **NC** | an event with a `0.0001` gross residual and net exhausted | two clients concurrently issue the same terminal gross-cleanup, different keys | exactly one commits and `status` becomes `reversed`; the other gets `B9-AF-018`. The residual is booked once | `B9_IDEMPOTENCY_CONCURRENCY.md` §4 |
| AT-CONC-19 | the same race, **same** idempotency key | both requests complete | one row; the second returns the stored `REVR-*` verbatim | `B9_IDEMPOTENCY_CONCURRENCY.md` §5 |
| AT-CONC-20 **NC** | — | an implementation evaluating the §4.1a `terminal` predicate outside the event row lock, or from values read before it | fails — both clients could believe themselves terminal | `B9_REVERSAL_MODEL.md` §4.1a |

## 14. Tenancy — AT-TEN

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-TEN-1 **NC** | another workspace's `REV-*` | `GET /revenue-events/{id}` | `404`, never `403` | `B9_RBAC_TENANCY.md` §7 |
| AT-TEN-2 **NC** | another workspace's event | reverse it | `404` | §7 |
| AT-TEN-3 **NC** | another workspace's touchpoint | attribute revenue to it | rejected | §7 |
| AT-TEN-4 **NC** | — | any response distinguishing "absent" from "another workspace's" | rejected | `B9_FAILURE_CATALOG.md` §5 |

## 15. RBAC — AT-RBAC

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-RBAC-1 **NC** | — | a role gains `revenue.recognize` outside the §3 matrix | rejected | `B9_RBAC_TENANCY.md` §7 |
| AT-RBAC-2 **NC** | actor holds `revenue.view` only | `POST /revenue-events` | `403`; `revenue.view` is not sufficient | §7 |
| AT-RBAC-3 **NC** | — | `system:automation` holds any B9 permission | rejected | §7 |
| AT-RBAC-4 **NC** | — | a B9 endpoint reads `workspace_id` from the request | rejected | §7 |
| AT-RBAC-5 **NC** | a `member` or `viewer` holding `analytics.view` only | request any operation returning a `Money` field | `403 PERMISSION_DENIED` | `B9-D-A038` |
| AT-RBAC-6 **NC** | — | an implementation gating a monetary response on `analytics.view` alone | fails | `B9_RBAC_TENANCY.md` §2a |
| AT-RBAC-7 | a `member` holding `analytics.view` | `GET /attribution/touchpoints` | **succeeds** — the response carries no monetary field | `B9_RBAC_TENANCY.md` §2a |
| AT-RBAC-8 **NC** | a caller holding `revenue.recognize` or `revenue.reverse` but **not** `revenue.view` | `POST /revenue-events`, or `POST /revenue-events/{id}/reversals` | `403` — both responses carry `Money`, so both require `revenue.view` conjunctively. Not inferred from today's role matrix | `B9_RBAC_TENANCY.md` §2a |
| AT-RBAC-9 **NC** | a caller holding `finance.reconciliation.view` but not `revenue.view` | `GET /finance/reconciliation-cases` | `403` — case `evidence` may carry a refund amount | `B9_SECURITY_PRIVACY.md` §4 |

## 16. Revenue firewall — AT-FW

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-FW-1 **NC** | an open Deal | `CloseDealWon` | **zero** new `revenue_events` rows; zero `RevenueRecognized` on the outbox; recognized revenue unchanged | `B9_REVENUE_FIREWALL.md` §8 |
| AT-FW-2 **NC** | a won Deal with a recognized event | `UpdateDeal` changes `value` | every revenue selector returns identical values | §8 |
| AT-FW-3 **NC** | open Deals | a stage probability change moves weighted pipeline | recognized revenue unchanged | §8 |
| AT-FW-4 **NC** | — | a full B8 checkout → webhook → `captured` sequence | zero `revenue_events` rows | §8 |
| AT-FW-5 **NC** | — | `SubscriptionActivated` | zero rows; `subscription` is not even a source type | §2 |
| AT-FW-6 **NC** | — | a checkout redirect succeeds | zero rows | §2 |
| AT-FW-7 **NC** | — | a plan price changes | recognized revenue unchanged | §8 |
| AT-FW-8 **NC** | — | a platform invoice is issued | zero rows | §2 |
| AT-FW-9 **NC** | — | the frontend attempts to create recognized revenue | rejected — no client write path; permission checked server-side | §2 |
| AT-FW-10 **NC** | `gross` omitted | recognize | rejected; **no** default from any upstream amount | §5 |
| AT-FW-11 **NC** | — | a payment webhook is redelivered twice | zero rows both times | §8 |
| AT-FW-12 **NC** | — | a B9 code path writes a B2/B3/B6/B7/B8/B10 table | rejected | §8 |
| AT-FW-13 **NC** | — | a non-B9 code path writes a B9 table | rejected | §8 |
| AT-FW-14 **NC** | recognized revenue exists | a Deal/Payment/Lead is deleted or retention-pruned | `revenue_events` count and content unchanged | §8 |

## 17. B6 Pipeline boundary — AT-B6

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-B6-1 **NC** | — | `CloseDealWon` produces a `RevenueEvent` or `RevenueRecognized` | rejected | `B9_B6_PIPELINE_BOUNDARY.md` §8 |
| AT-B6-2 **NC** | — | `gross`/`net` defaulted from `Deal.value` | rejected | §8 |
| AT-B6-3 **NC** | — | a B9 command writes any B6 table, including a "recognized" flag on `deals` | rejected | §8 |
| AT-B6-4 **NC** | — | a selector unions `deals.value` into a revenue figure | rejected | §8 |
| AT-B6-5 | a Deal still `open` | recognize against it | **succeeds**; an informational `recognition_against_open_deal` case is opened | §5 |
| AT-B6-6 **NC** | a recognized event on a won Deal | `ReopenDeal` | the event is **not** reversed or voided | §8 |
| AT-B6-7 | a recognized event on a Deal | `AssignDeal` to a new owner | op 6's `owner_ref` changes; no amount, attribution or total changes | `B9_B6_PIPELINE_BOUNDARY.md` §3 |

## 18. B8 Billing boundary — AT-B8

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-B8-1 **NC** | — | `PaymentSucceeded` produces a `revenue_events` row | rejected | `B9_B8_BILLING_BOUNDARY.md` §8 |
| AT-B8-2 **NC** | — | a B9 event subscription against any B8 event | rejected — contradicts `B8_B9_FINANCE_BOUNDARY.md` §4 | §8 |
| AT-B8-3 **NC** | a platform `PAY-*` | recognize against it | rejected `B9-AF-007` | §5 |
| AT-B8-4 **NC** | — | `Payment.amount` copied into `gross`/`net` | rejected | §8 |
| AT-B8-5 **NC** | a refund in B8 on a recognized event | — | **no** automatic `revenue_reversals` row | §6 |
| AT-B8-6 | same | reconciliation scan | `refund_without_reversal` case opened; nothing financial written | §6 |
| AT-B8-7 **NC** | — | a B9 command writes any B8 table | rejected | §8 |
| AT-B8-8 **NC** | — | `source_type='subscription'` accepted | rejected `B9-AF-004` | §8 |
| AT-B8-9 | a partial B8 refund | scan | visible with its own `amount`; opens `refund_without_reversal` | `B9_B8_BILLING_BOUNDARY.md` §4 |
| AT-B8-10 **NC** | a `Refund` fact | any B9 path | never auto-creates, proposes, or pre-fills a reversal | `B9-D-A009` |
| AT-B8-11 **NC** | — | B9 reading a B8 field outside the four facts of `B9_B8_BILLING_BOUNDARY.md` §4 | fails | `B9-AM-009` |

## 19. B7 Automation boundary — AT-B7

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-B7-1 **NC** | — | a B7 action/rule/run invokes any B9 command | rejected — no such action in B7's closed catalog | `B9_B7_AUTOMATION_BOUNDARY.md` §6 |
| AT-B7-2 **NC** | — | `system:automation` granted `revenue.recognize`/`revenue.reverse`/`attribution.manage` | rejected | §6 |
| AT-B7-3 **NC** | — | an approval tier or rule flag unlocks a financial action | rejected — forbidden in **both** approval columns (`FB-B9-039`) | §6 |
| AT-B7-4 **NC** | — | `recognized_by_membership_id` refers to a system/service principal | rejected | §6 |
| AT-B7-5 **NC** | a rule triggered by `deal_won` | it attempts to produce a `RevenueEvent` through any chain | rejected | §6 |

## 20. B10 Tax boundary — AT-B10

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-B10-1 **NC** | — | a B9 command, column or endpoint computes VAT or any tax amount | rejected | `B9_B10_TAX_BOUNDARY.md` §8 |
| AT-B10-2 **NC** | — | recognizing revenue creates a tax invoice or `TaxSubmitted` | rejected | §8 |
| AT-B10-3 **NC** | a tax invoice exists | infer a `RevenueEvent` exists | rejected — independent | §8 |
| AT-B10-4 **NC** | — | a B9 document asserts ZATCA/IFRS/statutory compliance | rejected | §8 |
| AT-B10-5 **NC** | — | a B9 write path to `tax_invoices`/`lines`/`submissions` | rejected | §8 |

## 21. B12 Async boundary — AT-B12

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-B12-1 **NC** | — | a worker or scheduled job writes `revenue_events`/`revenue_reversals` | rejected | `B9_B12_ASYNC_BOUNDARY.md` §5 |
| AT-B12-2 **NC** | — | recognition made asynchronous, returning before commit | rejected | §5 |
| AT-B12-3 **NC** | — | a B9 document specifies Celery/Redis/worker configuration | rejected | §5 |
| AT-B12-4 **NC** | — | a time-based trigger creates or reverses revenue | rejected | §5 |

## 22. Reconciliation — AT-RECON

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-RECON-1 **NC** | — | the scanner writes any financial table | rejected | `B9_RECONCILIATION_MODEL.md` §9 |
| AT-RECON-2 **NC** | — | reconciliation overwrites a B8 payment state | rejected | §9 |
| AT-RECON-3 | a detected condition | scan runs twice over unchanged data | **one** live case | §6 |
| AT-RECON-4 | a case resolved, then the condition recurs | next scan | a **new** case linked by `recurrence_of_case_id`; the old one stays closed | §4 |
| AT-RECON-5 **NC** | — | `ResolveFinancialReconciliationCase` mutates `revenue_events`/`revenue_reversals` | rejected | §9 |
| AT-RECON-6 **NC** | — | a case resolved without actor or reason | rejected `B9-AF-025` | §9 |
| AT-RECON-7 **NC** | another workspace's case | resolve it | `404` (`B9-AF-032`) | §9 |
| AT-RECON-8 **NC** | — | a repeat scan creates duplicate live cases | rejected | §9 |
| AT-RECON-9 | provider events arrived out of order in B8 | two scans over the settled state | identical, deterministic case sets | `B9_TIME_PERIOD_MODEL.md` §6 |
| AT-RECON-10 | a **partial** B8 refund of 300 against a recognized event | scan | `refund_without_reversal` opens carrying the refund's own `amount` and `currency` in `evidence` | `B9_RECONCILIATION_MODEL.md` §3a |
| AT-RECON-11 **NC** | — | inferring a refund amount from `Payment.status` alone | fails — the amount comes from the `Refund` fact | `B9-AM-009` |
| AT-RECON-12 **NC** | a refund | scan | a case opens and **no** financial row is written | `B9_RECONCILIATION_MODEL.md` §2 |
| AT-RECON-13 | a resolved case | run the integrity scan | `idempotency_anomaly` is computed from `resolution_request_hash` against B9's own tables, with no external store | `B9_RECONCILIATION_MODEL.md` §3 |

## 23. Selectors — AT-SEL

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-SEL-1 | any dataset | compute all selectors | `Net Recognized = Attributed + Unattributed`, exactly, per currency | `B9_ANALYTICS_PROJECTIONS.md` §3 |
| AT-SEL-2 **NC** | — | a selector reads `deals`/`payments`/`plans`/`invoices` | rejected | §8 |
| AT-SEL-3 **NC** | — | a selector treats `Deal.status='won'` or a payment status as recognized revenue | rejected | §8 |
| AT-SEL-4 **NC** | — | a selector returns one scalar across currencies | rejected | §8 |
| AT-SEL-5 **NC** | reversals exist | a "recognized revenue" figure omits them | rejected — net is the reported figure | §8 |
| AT-SEL-6 **NC** | — | a stored/materialised total inside B9 serves as authoritative | rejected | §8 |
| AT-SEL-7 | randomised recognitions and reversals | recompute | the §3 identity holds in every generated scenario | §3 |
| AT-SEL-8 **NC** | an event of 1000 with 300 reversed | a selector filtering `WHERE status = 'recognized'` | fails — it would report 0 instead of 700 | `B9_ANALYTICS_PROJECTIONS.md` §1a |
| AT-SEL-9 | randomised recognitions and reversals | evaluate the identity under both contracts | `Net Recognized = Attributed + Unattributed` holds at gross **and** at net | `B9_ANALYTICS_PROJECTIONS.md` §3 |

## 24. Dual track — AT-TRACK

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-TRACK-1 **NC** | a Lead with no DiscoveryJob | recognize | **must succeed**; rejecting fails | `B9_DUAL_TRACK_COMPATIBILITY.md` §7 |
| AT-TRACK-2 **NC** | a Deal whose Lead has no Business | recognize | **must succeed** | §7 |
| AT-TRACK-3 | a manually-created Lead with a `manual` touchpoint | recognize | succeeds and attributes to `manual` | §7 |
| AT-TRACK-4 | an imported Lead with **no** touchpoint | recognize | succeeds; reported unattributed | §7 |
| AT-TRACK-5 **NC** | a later Track-B phase adds an Account entity | — | no existing attribution snapshot is rewritten | §7 |
| AT-TRACK-6 **NC** | — | an implementation requires AI analysis before recognition | rejected | §7 |
| AT-TRACK-7 | a Track-A business with **visible** (`filtered = false`) `discovery_results` rows and **no** touchpoint | recognize | attributed automatically from the derived candidate; nobody recorded anything | `B9_DUAL_TRACK_COMPATIBILITY.md` §4 |
| AT-TRACK-8 **NC** | — | an implementation requiring a persisted touchpoint before Track-A revenue can attribute | fails | `B9-D-A035` |

## 25. Security & privacy — AT-SEC

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-SEC-1 **NC** | — | a B9 column or `evidence` payload holds card data, a secret, or a raw provider payload | rejected | `B9_SECURITY_PRIVACY.md` §8 |
| AT-SEC-2 **NC** | recognized revenue referencing a Lead | the Lead is deleted | **every revenue figure is unchanged**; a `recognition_source_unresolvable` case is opened | §5 |
| AT-SEC-3 **NC** | — | an export crosses a workspace boundary | rejected | §8 |
| AT-SEC-4 **NC** | — | an export completes without an audit fact | rejected | §8 |
| AT-SEC-5 **NC** | — | a customer name/email/phone stored in any B9 table | rejected | §8 |
| AT-SEC-6 **NC** | — | a retention job deletes a `revenue_events` row | rejected | §8 |
| AT-SEC-7 **NC** | — | an error response distinguishes another workspace's `REV-*` from a nonexistent one | rejected | §8 |
| AT-SEC-8 **NC** | an export containing monetary amounts | authorize with `analytics.view` alone | rejected `403` — every monetary surface also requires `revenue.view` | `B9-D-A038` |
| AT-SEC-9 **NC** | the frozen CSV export's fourteen columns | an export column that no B9 DTO field can supply | fails — an export is bounded by the API surface; all fourteen come from op 6 | `B9_SECURITY_PRIVACY.md` §4 |

## 26. API — AT-API

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-API-1 **NC** | — | a route accepts `workspace_id` in body or query | rejected | `B9_API_DTO_CONTRACTS.md` §7 |
| AT-API-2 **NC** | — | a `DELETE`/`PATCH` route on a revenue resource | rejected | §7 |
| AT-API-3 **NC** | — | `POST /revenue-events` succeeds without `idempotency_key` | rejected | §7 |
| AT-API-4 **NC** | — | `RevenueSummary` carries a single cross-currency total | rejected | §7 |
| AT-API-5 **NC** | — | a field is added to a frozen DTO | rejected — all are `additionalProperties: false` | §7 |
| AT-API-6 **NC** | — | `POST /revenue-events/{id}/reversals` accepting a `net` field | rejected `B9-AF-035` | `B9_API_DTO_CONTRACTS.md` §2 |
| AT-API-7 | a workspace holding SAR and USD revenue, presentation currency SAR | `GET /attribution` with **no parameters** — the frozen request form | **succeeds `200`**, reporting SAR only, with `unattributed_amount.currency = "SAR"`. Never summed across currencies, never an undeclared choice | `B9_API_DTO_CONTRACTS.md` §3a |
| AT-API-8 **NC** | a caller holding only `analytics.view` | `GET /attribution` or `/attribution/sources` | `403` — every monetary response also needs `revenue.view` | `B9_RBAC_TENANCY.md` §2a |
| AT-API-9 | a recognized event with an attribution snapshot | `GET /revenue-events/{id}/attribution` | returns amounts net of reversals, the snapshot and the resolved chain — enough for the Revenue tab, the trace modal and the CSV export | `FB-B9-051`…`FB-B9-053` |
| AT-API-10 | a single-currency SAR workspace | `GET /attribution?currency=SAR` | returns exactly what the frozen frontend renders today | `B9_CURRENCY_MONEY_MODEL.md` §8 |
| AT-API-11 | a recognized, attributed event | `GET /revenue-events/{id}/attribution` | returns `touchpoint_count`, `trace_status` and `owner_ref` alongside the amounts, so each of the Revenue tab's eight rendered columns maps to one op-6 field | `B9_API_DTO_CONTRACTS.md` §2a |
| AT-API-12 | the period's events | build the CSV export from op 6 | all **fourteen** columns of `FB-B9-053` are composable from op 6's own DTO fields; the export reveals nothing the API does not | `B9_SECURITY_PRIVACY.md` §4 |
| AT-API-13 | a recognized event on a Deal | `AssignDeal` to a different owner, then re-read op 6 | `owner_ref` reports the **new** owner; the amounts and the attribution snapshot are unchanged | `B9-D-A042` |
| AT-API-14 **NC** | — | an implementation making `currency` a **required** parameter on op 8 | fails — frozen `getAttribution` declares `"parameters": []`, so a required parameter breaks the only frozen request form | `B9-D-A039`, `B9-AM-012` |
| AT-API-15 **NC** | a multi-currency workspace | an implementation summing across currencies when `currency` is absent, instead of defaulting to the workspace currency | fails — `MULTI_CURRENCY_SUMMATION_LEAKS = 0` | `B9_CURRENCY_MONEY_MODEL.md` §2 |
| AT-API-16 **NC** | — | an implementation snapshotting `owner_ref` into `revenue_attributions` | fails — owner is display-only, resolved live | `B9-D-A042` |
| AT-API-17 **NC** | a Track-A event with three `discovery_results` and one recorded touchpoint | an implementation computing `touchpoint_count` as candidates *considered* | fails — it would report `4` where the frozen UI renders `1`; the count is allocations **made** | `B9_API_DTO_CONTRACTS.md` §2a |
| AT-API-18 **NC** | a workspace whose presentation currency cannot be resolved | `GET /attribution` with no `currency` | `422 WORKSPACE_CURRENCY_UNRESOLVED` (`B9-AF-036`), never a `500` and never an arbitrary currency | `B9_FAILURE_CATALOG.md` |
| AT-API-19 | the 36-code failure catalog | map every `B9-AF-*` to at least one operation that can raise it — operation-specific rows plus the universal set | every code maps; `UNMAPPED_OPERATION_FAILURE_CODES = 0`. `034` is reachable only from op 10 and `028` only from op 1, and both are listed on those operations | `B9_API_DTO_CONTRACTS.md` §4 |

## 27. Observability — AT-OBS

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-OBS-1 **NC** | — | a metric/log/trace carries card data, a secret, a provider payload, or PII | rejected | `B9_OBSERVABILITY.md` §7 |
| AT-OBS-2 **NC** | — | a per-customer revenue time series in telemetry | rejected | §7 |
| AT-OBS-3 **NC** | — | a report sources a revenue figure from a metrics store | rejected | §7 |
| AT-OBS-4 | the full acceptance suite | run to completion | `attribution_integrity_failure_total` is **0** throughout | §7 |

## 28. Command/event catalog — AT-CMD

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-CMD-1 **NC** | — | a sixth B9 command appears | rejected without a controlled amendment | `B9_COMMAND_EVENT_CATALOG.md` §5 |
| AT-CMD-2 **NC** | — | a B9 command writes a B2/B3/B6/B7/B8/B10 table | rejected | §5 |
| AT-CMD-3 **NC** | — | any B9 event consumer/listener exists in Phase 1 | rejected — `CONSUMED_EVENT_COUNT = 0` | §5 |
| AT-CMD-4 **NC** | — | `RecordRevenueEvent` renamed `RecognizeRevenue` in any contract | rejected — frozen name | §5 |
| AT-CMD-5 **NC** | — | any B9 command accepting a non-human actor | fails — `OpenFinancialReconciliationCase` is the only system write and creates no financial or attribution fact | `B9_COMMAND_EVENT_CATALOG.md` §1 |

## 29. Public identifiers — AT-ID

| ID | Given | When | Then | Ref |
|---|---|---|---|---|
| AT-ID-1 | a recognition | inspect the row | `public_id` matches `REV-*` and is immutable | `BACKEND_PUBLIC_ID_REGISTRY.md` §A |
| AT-ID-2 **NC** | — | a B9 entity minting a prefix outside `REV-`/`ATT-`/`REVR-`/`FRC-` | rejected | `B9_CONTROLLED_AMENDMENTS.md` |
| AT-ID-3 **NC** | `REV-01J…` and `REVR-01J…` | resolve both | resolved as distinct exact-token prefixes; an implementation matching by `startswith` fails | `B9_CONTROLLED_AMENDMENTS.md` §3 |

## 30. Counts

```
ACCEPTANCE_TEST_COUNT      = 295
ACCEPTANCE_CATEGORY_COUNT  =  29
NEGATIVE_CONTROL_COUNT     = 205
DUPLICATE_ACCEPTANCE_TESTS =   0
OUT_OF_SCOPE_ACCEPTANCE_ROWS = 0
```

Every count above is recomputed mechanically from this file's own rows, not carried forward:

```
grep -oE '^\| AT-[A-Z0-9]+-[0-9]+' B9_ACCEPTANCE_TESTS.md | sort -u | wc -l          -> 295
grep -oE '^\| AT-[A-Z0-9]+-'       B9_ACCEPTANCE_TESTS.md | sort -u | wc -l          ->  29
grep -cE  '^\| AT-[A-Z0-9]+-[0-9]+ \*\*NC\*\*' B9_ACCEPTANCE_TESTS.md                -> 205
```

Every category is contiguous from 1 with no gaps and no duplicate ids.

`B9-FIX.1` added **54** tests across 16 existing categories and no new ones — the corrections tightened rules that already had a home rather than opening new subject areas. The additions concentrate where the defects were: reversal arithmetic (`AT-REVR-15`…`AT-REVR-22`), first-touch's second candidate source (`AT-FT-10`…`AT-FT-15`), source identity (`AT-ATTR-16`…`AT-ATTR-20`), refund evidence (`AT-RECON-10`…`AT-RECON-13`, `AT-B8-9`…`AT-B8-11`), monetary RBAC (`AT-RBAC-5`…`AT-RBAC-7`, `AT-API-8`), multi-currency API behaviour (`AT-API-7`, `AT-API-10`), resolution idempotency (`AT-IDEM-7`…`AT-IDEM-10`, `AT-CONC-17`) and the savepoint mechanism (`AT-FT-12`, `AT-CONC-15`).

`B9-FIX.2` added **33** more, again across existing categories only, and again concentrated on what independent verification actually broke:

| Area | Tests | What they pin |
|---|---|---|
| Terminal rounding cleanup | `AT-REVR-23`…`AT-REVR-32`, `AT-IMM-7`, `AT-FM-5` | the rounding residual is reachable, the cleanup closes it, a non-terminal zero-net reversal is refused, and neither fold alone may drive `status` |
| Cleanup concurrency and replay | `AT-CONC-18`…`AT-CONC-20`, `AT-IDEM-11`, `AT-IDEM-12` | exactly one cleanup commits; replay returns it; a differing payload conflicts; the terminal predicate lives inside the lock |
| `getAttribution` compatibility | `AT-API-7`, `AT-API-14`, `AT-API-15`, `AT-API-18`, `AT-CUR-6`, `AT-CUR-7` | the frozen parameterless request still succeeds, the default is the workspace currency, and neither summing nor a required parameter is admissible |
| Per-event frontend support | `AT-API-11`…`AT-API-13`, `AT-API-16`, `AT-API-17`, `AT-ATTR-21`, `AT-B6-7` | all fourteen CSV columns are composable from op 6; owner is live, not snapshotted; the count is allocations, not candidates |
| Money RBAC on write ops | `AT-RBAC-8`, `AT-RBAC-9` | ops 1, 4, 12-14 require `revenue.view` conjunctively, by construction rather than by today's role matrix |
| Product amount bound | `AT-MON-7` | the `999999999999.9999` limit is a real named `CHECK`, not an assertion in prose |
| Export boundedness | `AT-SEC-9` | no export column may exist that the API cannot supply |

`B9-FIX.2a` added **7** more — again across existing categories only. Six pin rules the pack relied on but had never stated, and one is the mapping check that would have caught an unmapped code:

| Area | Tests | What they pin |
|---|---|---|
| Workspace-currency mutability | `AT-CUR-8`, `AT-CUR-9` **(NC)**, `AT-CUR-10` **(NC)** | the default is resolved at **request time** from a *mutable* column; changing it re-selects rather than converts; an "as-of the period" resolution and any read-time FX both fail (`B9-D-A043`) |
| Filtered discovery observations | `AT-FT-17`, `AT-FT-18` **(NC)** | a `filtered = true` `discovery_results` row is **not** a first-touch candidate; the worst case is an unattributed event, never a moved amount (`B9-D-A044`) |
| Failure-code coverage | `AT-API-19` | every one of the 36 codes maps to an operation that can raise it — `034` to op 10, `028` to op 1 |
| Amendment counting | `AT-DOM-4` | `FROZEN_ARTIFACTS_AFFECTED` and its enumeration agree, under a metric stated before the number |

One existing row was **replaced rather than added**: `AT-REVR-25`'s stimulus reversed `gross = 0.00005`, which is scale 5 and is rejected by `B9-AF-008` before any net is derived — so the test could never observe the `B9-AF-029` it asserted, and from `AT-REVR-23`'s state no valid scale-4 non-terminal zero-net reversal exists at all. It now runs from the `1000 / 1` state where net is already exhausted and `0.05` of gross remains, and reverses `0.02` — reachable, scale-4, genuinely non-terminal, and genuinely `B9-AF-029`. It no longer duplicates `AT-REVR-21` (which covers the first-reversal case, `Pn = 0`); the two now pin the two different ways a zero-net reversal can be non-terminal.

## 31. Mapping of the brief's mandatory scenarios

Every scenario the task enumerates as `AT-01`…`AT-42` is covered. The pack uses categorised IDs (the repository convention since B2) rather than a flat sequence:

| Brief | Covered by |
|---|---|
| AT-01 Deal Won → no RevenueEvent | `AT-FW-1`, `AT-B6-1` |
| AT-02 Won Deal value changes | `AT-FW-2`, `AT-B6-2` |
| AT-03 Pipeline weighted value changes | `AT-FW-3`, `AT-SEL-3` |
| AT-04 Plan price changes | `AT-FW-7` |
| AT-05 Checkout redirect succeeds | `AT-FW-6` |
| AT-06 Subscription becomes active | `AT-FW-5`, `AT-B8-8` |
| AT-07 Provider payment status alone | `AT-FW-4`, `AT-B8-1` |
| AT-08 Valid recognition → exactly one event | `AT-REC-1` |
| AT-09 Replay → no duplicate | `AT-IDEM-4`, `AT-IDEM-6` |
| AT-10 Same key, different payload → conflict | `AT-IDEM-2` |
| AT-11 Concurrent recognitions → exactly one | `AT-CONC-1` |
| AT-12 Cannot be deleted | `AT-IMM-3`, `AT-DOM-3` |
| AT-13 Financial fields cannot silently mutate | `AT-IMM-2`, `AT-IMM-6` |
| AT-14 Full reversal keeps the original visible | `AT-REVR-1`, `AT-REVR-16` |
| AT-15 Partial reversal computes correct net | `AT-REVR-2`, `AT-REVR-17` |
| AT-16 Two valid partial reversals | `AT-REVR-3`, `AT-CONC-3` |
| AT-17 Reversal exceeds remaining → rejected | `AT-REVR-4` |
| AT-18 Concurrent reversals cannot over-reverse | `AT-CONC-4`, `AT-REVR-5` |
| AT-19 Recognition without attribution allowed | `AT-ATTR-1`, `AT-FT-6`, `AT-FT-12` |
| AT-20 Unattributed reported correctly | `AT-UNATT-1`…`AT-UNATT-5` |
| AT-21 First-touch deterministic | `AT-FT-1` |
| AT-22 Timestamp tie → deterministic tie-breaker | `AT-FT-2`, `AT-FT-3` |
| AT-23 Rediscovery does not rewrite attribution | `AT-ATTR-12` |
| AT-24 Later Lead/Deal edits do not rewrite it | `AT-ATTR-9`, `AT-ATTR-10`, `AT-ATTR-11` |
| AT-25 Manual/CRM customer without Discovery | `AT-TRACK-1`, `AT-TRACK-3` |
| AT-26 Discovery missing does not reject revenue | `AT-TRACK-2`, `AT-TRACK-4` |
| AT-27 Cross-workspace event access rejected | `AT-TEN-1` |
| AT-28 Cross-workspace reversal rejected | `AT-TEN-2`, `AT-REVR-9` |
| AT-29 Cross-workspace attribution rejected | `AT-TEN-3`, `AT-ATTR-5` |
| AT-30 1000 recognized − 300 reversed = 700 | `AT-REVR-2`, `AT-REVR-17` |
| AT-31 Net attributed = 700 | `AT-ATTR-7`, `AT-ATTR-8` |
| AT-32 Currencies never summed directly | `AT-CUR-4`, `AT-API-7` |
| AT-33 Frontend cannot create revenue authority | `AT-FW-9` |
| AT-34 Automation cannot bypass authorization | `AT-B7-1`…`AT-B7-5` |
| AT-35 Recognition does not create a tax invoice | `AT-B10-2` |
| AT-36 Tax invoice does not imply RevenueEvent | `AT-B10-3` |
| AT-37 Payment replay cannot duplicate revenue | `AT-IDEM-6`, `AT-FW-11` |
| AT-38 Refund with no recognition | `AT-B8-6`, `AT-RECON-11` + `refund_without_recognition` (`B9_RECONCILIATION_MODEL.md` §3) |
| AT-39 Refund after recognition | `AT-B8-5`, `AT-B8-9`, `AT-RECON-10` |
| AT-40 Out-of-order provider events deterministic | `AT-TIME-8`, `AT-RECON-9` |
| AT-41 Reconciliation does not mutate history | `AT-RECON-1`, `AT-RECON-5` |
| AT-42 Correction creates a compensating fact | `AT-REVR-12`, `AT-FM-2` |

All 42 mapped; **0 unmapped**.

## 32. The `B9-FIX.1` remediation scenarios

The `B9-FIX.1` brief enumerates fifteen further scenarios (A…O). Each is covered:

| Brief | Covered by |
|---|---|
| A gross/net proportional reversal | `AT-REVR-16`, `AT-REVR-19` |
| B caller cannot supply an independent reversal `net` | `AT-REVR-15`, `AT-REVR-18`, `AT-API-6` |
| C partial reversal gross 250 → derived net 200 | `AT-REVR-17` |
| D source cannot be re-recognized while net remains | `AT-REC-15`, `AT-REC-17`, `AT-REVR-22` |
| E refund evidence includes a partial refund amount | `AT-RECON-10`, `AT-B8-9`, `AT-RECON-11` |
| F attribution with no persisted touchpoint | `AT-FT-10`, `AT-ATTR-18` |
| G Track-A attribution has a deterministic creation path | `AT-TRACK-7`, `AT-TRACK-8`, `AT-FT-15` |
| H `SRC-*` stays compatible with frozen B3 semantics | `AT-FT-14`, `AT-ATTR-16`, `AT-ATTR-20` |
| I partially reversed revenue stays in the register net of reversal | `AT-SEL-8`, `AT-SEL-9` |
| J multi-currency `GET /attribution` is deterministic | `AT-API-7`, `AT-API-10` |
| K per-event attribution API supports table/modal/export | `AT-API-9` |
| L viewer/member financial access obeys the chosen policy | `AT-RBAC-5`, `AT-RBAC-6`, `AT-RBAC-7`, `AT-API-8` |
| M resolution retry, same key + same payload | `AT-IDEM-7`, `AT-CONC-17` |
| N same key + different payload → conflict | `AT-IDEM-8` |
| O provenance DB error does not abort a valid recognition | `AT-FT-12`, `AT-CONC-15` |

All 15 mapped; **0 unmapped**.
