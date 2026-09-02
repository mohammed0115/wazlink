# B9 — Failure Mode Analysis (Self-Adversarial)

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> This document exists to try to break the design. Every scenario the task names is attacked, and each is followed to a deterministic outcome or recorded as a residual risk.

## 1. Method

For each scenario: state the attack, trace it through the actual design, name the mechanism that decides the outcome, and cite the test. Where the honest answer is "this is a residual risk", it is said (§4) rather than dressed up.

## 2. The twenty-six adversarial scenarios

| # | Scenario | Deterministic outcome | Mechanism | Test |
|---|---|---|---|---|
| 1 | **Won Deal without payment** | Nothing. No revenue. A human may still recognize if they judge revenue earned | no automatic path exists | `AT-FW-1` |
| 2 | **Payment without Deal** | Nothing. Platform payments are categorically unrecognizable; a non-platform payment would still need a human command | `B9-AF-007`; `B9-D-A008` | `AT-B8-3` |
| 3 | **Payment without Lead** | Same as 2. Provenance is irrelevant to eligibility | source validation is existence-only | `AT-B8-1` |
| 4 | **Revenue without Discovery** | **Fully valid.** Recognized, and attributed or unattributed depending on touchpoints | every provenance hop optional | `AT-TRACK-1`, `AT-TRACK-2` |
| 5 | **Revenue without attribution** | **Fully valid.** Recognized in full, reported as unattributed | resolver returns `NONE` when **both** candidate sources are empty, not an error | `AT-ATTR-1`, `AT-UNATT-1` |
| 6 | **Duplicate payment webhook** | Cannot reach B9 — no webhook path, no consumer. Even a human recognizing twice is stopped | `CONSUMED_EVENT_COUNT = 0`; source guard | `AT-FW-11`, `AT-IDEM-6` |
| 7 | **Duplicate B8 event** | Same — nothing listens | `B9-D-A002` | `AT-CMD-3` |
| 8 | **Out-of-order provider events** | Invisible. B9 reads settled state at scan time, never a stream position | state comparison, not ordering | `AT-TIME-8`, `AT-RECON-9` |
| 9 | **Refund before recognition** | `refund_without_recognition`, `severity=info`, usually `dismissed`. No revenue is created or destroyed | reconciliation detect-only | `AT-B8-6` |
| 10 | **Refund after recognition** | `refund_without_reversal` case. A human decides; `ReverseRevenueEvent` if warranted. **Never automatic** | `B9-D-A009` | `AT-B8-5`, `AT-B8-6` |
| 11 | **Partial refund twice** | Two independent reversals, each bounded at its own commit and each with its `net` derived under the lock. Together they cannot exceed the event in either contract | row lock + Σ bound + derived net | `AT-REVR-3`, `AT-CONC-3`, `AT-CONC-16` |
| 12 | **Full reversal + partial reversal race** | Whichever locks first commits. The loser gets `B9-AF-018` (if full won) or `B9-AF-014` (if the partial won and the full no longer fits) | `FOR UPDATE` serialisation | `AT-CONC-5` |
| 13 | **Manual recognition + payment recognition race** | Cannot arise — there is no payment-driven recognition. Two humans racing collapses to the duplicate case | `B9-D-A008` | `AT-CONC-2`, `AT-CONC-1` |
| 14 | **Backdated recognition** | Accepted without limit; a `backdated_recognition` case opens beyond 7 days. The affected **past** period restates | `B9-D-A019` | `AT-REC-13`, `AT-TIME-6` |
| 15 | **Future-dated recognition** | Rejected beyond a 5-minute skew tolerance | `B9-AF-016` | `AT-REC-11`, `AT-TIME-5` |
| 16 | **Currency mismatch** | Rejected at every entry point: gross/net/mirror disagreement, and reversal-vs-event | `B9-AF-011`, `B9-AF-015` | `AT-CUR-1`, `AT-CUR-2` |
| 17 | **Workspace substitution** | `404 ENTITY_NOT_FOUND`, indistinguishable from absent, at every surface | session-derived scope; no `workspace_id` input | `AT-TEN-1`…`AT-TEN-4` |
| 18 | **Business rediscovery** | B3 appends a new `discovery_results` row with a later `discovered_at`. It cannot win a first-touch decision already snapshotted, and cannot displace the original even for a future recognition | immutable snapshot + B3 append-only | `AT-ATTR-12` |
| 19 | **Lead merge** | Snapshots keep their captured `lead_public_id`. Future recognitions follow the surviving Lead. No historical attribution moves | immutability | `AT-ATTR-10`, `AT-FT-8` |
| 20 | **Deal edit after recognition** | Nothing changes — not the amount, not the period, not the attribution | no read path from `deals` into revenue | `AT-FW-2`, `AT-ATTR-11` |
| 21 | **Source rename** | Grouping unchanged (ids are snapshotted); display name updates (resolved live) | immutable vs display dimensions | `AT-ATTR-13` |
| 22 | **Source deletion/retirement** | Revenue stays attributed; the report marks the source retired | append-only touchpoints; snapshot holds the id | `AT-ATTR-14` |
| 23 | **Attribution duplicate** | Impossible — `UNIQUE (revenue_event_id)`, written inside the recognition transaction | schema | `AT-ATTR-3`, `AT-CONC-9` |
| 25 | **Strand an event on a rounding residual** | Reverse `999.9999` of a `1000/500` event, exhausting net while `0.0001` gross remains, then try to retire it. The cleanup **commits** (`net = 0`, terminal only); both folds close; `status='reversed'`; the source releases. A *non*-terminal zero-net reversal is still refused | terminal gross-cleanup under the row lock | `AT-REVR-23`…`AT-REVR-27` |
| 26 | **Race two terminal cleanups** | Both serialise on the event row. One commits; the other gets `B9-AF-018`, or replays on the same key. The residual is booked exactly once | `FOR UPDATE` + `uq_..._idempotency` | `AT-CONC-18`, `AT-CONC-19` |
| 24 | **Reconciliation duplicate / reconciliation + manual correction race** | One live case per fingerprint; concurrent resolvers serialise on the case row, the loser gets `B9-AF-024`. Any financial command either ran under its own authority or did not | partial unique + row lock | `AT-RECON-3`, `AT-CONC-10`, `AT-CONC-13` |

## 3. Five attacks the design invites, and how it survives them

### 3.1 "Make the firewall leak through an intermediary"

Try: `deal_won` → B7 automation rule → a financial action. **Blocked four times over** — B7's closed action catalog has no financial action; `system:automation` holds no B9 permission; every financial row requires a human membership; B7 has no write path to any B9 table. Removing any single layer still leaves the attack blocked (`B9_B7_AUTOMATION_BOUNDARY.md` §3).

### 3.2 "Change revenue without a reversal"

Try: delete the CRM record the revenue points at, hoping the total recomputes. **The total does not move** — selectors fold `revenue_events`, and an unresolvable `source_ref` changes nothing except opening an informational case (`AT-SEC-2`). This is the single most valuable property in `B9_SECURITY_PRIVACY.md` §5: anyone with CRM delete rights would otherwise have had an untracked way to change reported revenue.

### 3.3 "Over-reverse by racing"

Try: fire N concurrent reversals summing past the event. **All serialise on the event row**; each sees every committed predecessor; the bound is re-evaluated under the lock every time (`B9_IDEMPOTENCY_CONCURRENCY.md` §4). The invariant is not "the code checks" — it is "no two reversals of one event can evaluate their check concurrently."

### 3.4 "Make attributed exceed recognized"

Try: attribute one event twice, or allocate 150%. **Both schema-impossible** — `UNIQUE (revenue_event_id)` and `CHECK (allocation_bps = 10000)`. The `over_attribution` critical case exists to catch the possibility that this reasoning is wrong (`B9_ATTRIBUTION_MODEL.md` §10).

### 3.5a "Exhaust net while leaving gross standing" — the mirror attack, and the one this analysis missed twice

Try the **inverse** of 3.5: reverse `gross = 999.9999` against a `1000/500` event. The derived net is `ROUND_HALF_UP(499.99995, 4) = 500.0000` — the net fold is exhausted — while `0.0001` of gross remains. Then reverse that residual: the derived net is `0`.

Under `B9-FIX.1` that reversal was **rejected** by `B9-AF-029`, and the event was stranded: permanently `partially_reversed`, with a live gross residual that no command could retire and a source that could never be released for the documented reverse-and-re-recognize correction. The design asserted `Σ gross = G ⟺ Σ net = N` as a biconditional while proving only the forward direction, so the state it had declared impossible was reachable by a single ordinary command.

**This is the defect §3.5 was too narrow to catch.** §3.5 asked whether gross could exhaust while net stood, found it blocked three ways, and stopped. It never asked the mirror question, and neither did `AT-REVR-22`, which tests only the direction that was already safe.

It is now closed by the terminal gross-cleanup reversal (`B9-D-A040`, `B9_REVERSAL_MODEL.md` §4.1a): a zero derived net is admitted **only** when the reversal exhausts gross and net is already exhausted, so the residual is retired, both folds close, and `status` reaches `reversed`. Every other zero-net reversal is still `B9-AF-029`. The reachability theorem makes the guarantee general rather than case-specific: reversing the *whole remaining gross* always succeeds from any state, so no event can be stranded. `AT-REVR-23`…`AT-REVR-28`, `AT-IMM-7`.

### 3.5 "Exhaust gross while leaving net standing"

Try: reverse `gross=1000, net=1` against a `1000/800` event, so the gross fold completes, `status` flips to `reversed`, 799 net survives unreversible, and the source is released for a second recognition on top of it. **This worked in the pre-FIX.1 model and is the one defect this analysis previously missed.** It is now blocked three times over: the API accepts no reversal `net` at all (`B9-AF-035`), the derived net makes the two folds exhaust together (`B9_REVERSAL_MODEL.md` §4.1), and `reversed` requires both folds regardless (`B9-D-A034`). `AT-REVR-15`…`AT-REVR-18`.

## 4. Residual risks — stated, not hidden

| # | Risk | Why it remains | Mitigation | Accepted? |
|---|---|---|---|---|
| R-1 | **A human recognizes revenue that was never earned** | B9's model rests on human judgment; no system can validate a commercial assertion it has no evidence for | permission separation, mandatory resolvable evidence, full audit, immutable history, reconciliation signals for the unusual cases | **yes** — this is inherent to explicit recognition and is why the audit trail is absolute |
| R-2 | **A closed period's net changes when a reversal lands** | The deliberate consequence of `B9-D-A020`; the alternative hides corrections in the wrong month | `as_of` on every response; reversals reportable by `reversed_at`; `backdated_recognition` cases | **yes** |
| R-3 | **A workspace uses B9 figures for statutory reporting** | B9 asserts product policy, not accounting compliance | stated explicitly in `B9_FINANCIAL_MODEL.md` §7 and `B9_B10_TAX_BOUNDARY.md` §7; recorded UNRESOLVED in the research register | **yes**, with the caveat documented |
| R-4 | **Attribution quality degrades silently** | Track A derives from B3 provenance automatically, but Track B still depends on touchpoints being recorded, which B9 cannot compel | `unattributed_revenue_ratio` gauge with a rising-trend alert; `attribution_unresolved` cases; data-quality counters | **yes** |
| R-5 | **Manual-only recognition does not scale** | A deliberate Phase-1 trade: safety over throughput | `B9-D-C001` records the automation path and everything it would require | **yes** for Phase 1 |
| R-6 | **A `status` column drifts from the reversal folds** | It is materialised for query performance, so a defect could desynchronise it from either fold | `status_fold_mismatch` is a **critical** reconciliation case, scanned hourly, and now checks **both** folds | **yes** — detected, not assumed away |
| R-8 | **An event carries a live gross residual for some time before anyone retires it** | The terminal cleanup is a *command*, not an automatic sweep — B9 has no timer-driven financial action (`B9_B12_ASYNC_BOUNDARY.md` §1), and inventing one would be exactly the automatic write the firewall forbids | The residual is real unreversed gross and is reported as such; `status` says `partially_reversed`, which is true; the operator retires it with one ordinary command, and the reachability theorem guarantees that command always succeeds | **yes** — a visible, correct, closable state rather than a hidden one |
| R-7 | **A future phase adds multi-touch and reintroduces rounding** | Phase 1 cannot round, but `B9-D-B002` would | `allocation_bps` integer basis points summing to 10000 is a constraint a database can enforce | **deferred** |

None of R-1…R-8 is a Phase-1 defect; each is a property of the chosen model, stated so a reviewer can disagree with the trade rather than discover it later.

## 5. What would falsify this design

Stated so the design is refutable rather than merely asserted:

- a frozen document requiring automatic recognition from a payment or a won Deal (**none found**; five frozen documents say the opposite);
- product evidence that recognition must be automated to be usable (**none found** in the frozen frontend, which has no recognition surface at all);
- a currency requirement that forces cross-currency totalling (**none found**; the frozen analytics contract is per-currency);
- an accounting obligation requiring double-entry (**none found**; and B9 claims no compliance);
- evidence that attribution must be recomputable (**the opposite**: ADR-008 requires *deterministic* attribution);
- evidence that a reversal's net is commercially independent of its gross (**none found**; and permitting it produced the `3.5` corruption, so B9 now derives it);
- evidence that a zero-net reversal is ever legitimate outside the terminal gross-cleanup (**none found**; if one were, `B9-D-A040`'s three conditions would have to be reopened rather than widened in place).

If any of these were later established, the affected Class-A decision would need to be reopened by amendment — not worked around.
