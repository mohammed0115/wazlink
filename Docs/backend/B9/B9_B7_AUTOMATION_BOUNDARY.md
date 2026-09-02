# B9 — B7 Automation Boundary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> The counterpart of `B7_B9_FINANCE_BOUNDARY.md`, written from B9's side.

## 1. The decision — automation holds no financial authority in Phase 1 (Class A, `B9-D-A022`)

**No B7 automation rule, action, run, or approval may invoke `RecordRevenueEvent`, `ReverseRevenueEvent`, `RecordTouchpoint`, or `ResolveFinancialReconciliationCase`, under any configuration, with or without human approval.**

This is not a default that can be relaxed by configuration. There is no permission a rule can be granted, no approval tier that unlocks it, and no action catalog entry to enable.

## 2. Why the strict answer is the right one

The task asked whether Phase 1 should prohibit generic automation from invoking recognition. Four independent lines of evidence say yes:

1. **The frozen frontend forbids it twice, in two separate subsystems.** `forbiddenAutomationActions` includes `create_revenue` and `create_attribution` (`FB-B9-010`); `forbiddenAgentActions` independently includes the same two (`FB-B9-038`); and the agent capability matrix marks `create_revenue` **"ممنوع" in both the with-approval and without-approval columns** (`FB-B9-039`). Two subsystems, three statements, no approval tier that unlocks it.

2. **B7's own closed action catalog has no financial action.** Its ten Phase-1 actions target B2 (five commands), B6 (`MoveDealStage`) and B5 (`SendMessage`/`SendTemplateMessage`), plus one internal control action. `B7_B9_FINANCE_BOUNDARY.md` §3 states that adding a B9 action would require *B7's own future controlled amendment* — "never assumed, never pre-authorized here."

3. **Recognition is a judgment, not a rule outcome.** B9's whole recognition model rests on a human asserting an amount, a currency and a date (`B9-D-A008`). A rule cannot supply those from a trigger payload without deriving them from a Deal or a payment — which is precisely what the firewall forbids. An automated recognition would necessarily be a derived recognition.

4. **It keeps `WON_DEAL_REVENUE_LEAKS = 0` structural.** B7 *does* consume `deal_won` as a trigger. If automation could reach B9, then `deal_won → rule → RecordRevenueEvent` would reconstruct the exact prohibited chain through an intermediary, and the firewall would become a matter of nobody configuring that rule.

## 3. Structural enforcement, not policy

| Layer | Guarantee |
|---|---|
| **Action catalog** | B7's Phase-1 catalog is closed at ten actions, none financial. A rule DTO naming a financial action is rejected `422 unsupported_action` by B7's own validation |
| **Permission** | `system:automation` holds **no** B9 permission (`B9_RBAC_TENANCY.md` §5). B7's authority is delegated from `activated_by_membership_id`, and B9 grants nothing to that path either — the six B9 permissions are held by memberships acting through the session-authenticated API, not through B7's command invocation layer |
| **Actor** | Every B9 financial row requires a `membership_id` naming a human — and so does every `attribution_touchpoints` row, whose `recorded_by_membership_id` is NOT NULL (`B9-D-A036`). There is no `system` actor column value anywhere in B9's write surface, and the "system provenance resolver" an earlier draft referenced does not exist |
| **Write path** | B7 holds no ORM reference or write path to any B9 table (`B7_REVENUE_FIREWALL.md`) |

Four independent layers. Removing any one still leaves automation unable to create financial truth.

## 4. If a future phase wants automated recognition

It would require **all** of:

1. a B9 Class-A decision superseding `B9-D-A022`, with product evidence for what a rule would supply as amount, currency and date;
2. a B7 controlled amendment adding a financial action to its closed catalog;
3. a recognition-rule design under ADR-007's "explicitly approved recognition rule" clause, which Phase 1 leaves empty (`B9-D-C001`);
4. an authorization model for the delegated actor, since B9 currently requires a human;
5. a firewall re-proof, since `WON_DEAL_REVENUE_LEAKS = 0` currently depends on this prohibition.

None is assumed here. The deferred item is `B9-D-C001`.

## 5. What automation *may* legitimately do

Nothing in B9 — and that is complete. It may continue to act on Deals, Leads, Tasks, Appointments and Messages exactly as B7 designs. A rule may fire on `deal_won` and create a follow-up task; it simply cannot turn that into revenue.

## 6. Negative controls

`AT-B7-1` **(NC)**: a B7 action, rule, or run invoking any B9 command — fails; no such action exists in B7's closed catalog and `system:automation` holds no B9 permission.
`AT-B7-2` **(NC)**: `system:automation` granted `revenue.recognize`, `revenue.reverse`, or `attribution.manage` — fails.
`AT-B7-3` **(NC)**: an approval tier or rule flag that unlocks a financial action — fails; `FB-B9-039` forbids it in both approval columns.
`AT-B7-4` **(NC)**: a `revenue_events` row whose `recognized_by_membership_id` refers to a system/service principal rather than a human membership — fails.
`AT-B7-5` **(NC)**: a `deal_won`-triggered rule producing a `RevenueEvent` through any chain — fails.

```
DIRECT_B7_WRITE_LEAKS = 0
```
