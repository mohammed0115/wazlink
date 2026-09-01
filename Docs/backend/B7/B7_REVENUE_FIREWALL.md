# B7 — Revenue Firewall

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The invariant

**Automation must never recognize revenue.** Even when the trigger is `deal_won` (`B7_TRIGGER_CATALOG.md` §2) — a rule reacting to a Deal being won is exactly the case the task brief calls out by name (§17). B7 produces zero commands, zero actions, and zero code paths that write `revenue_events`, `revenue_reversals`, or `attribution_touchpoints`. If a future B9 exposes a legitimate governed financial command, that command remains B9's to design and B9's to invoke through — B7 does not preempt, wrap, or shortcut it now.

## 2. Structural proof

- **No action in the closed catalog targets B9.** `B7_ACTION_CATALOG.md` §2's ten Phase-1 actions target only B2 (7 actions), B6 (1), B5 (1), and B7-internal control flow (1) — B9 does not appear as a `target_domain` value anywhere in the schema (`B7_DATA_MODEL.md` §4's `target_domain` column has no B9 case, because no B7 action names one).
- **`create_revenue`/`create_attribution` are explicitly excluded**, not merely unimplemented (`B7_ACTION_CATALOG.md` §4) — named in `forbiddenAutomationActions` (FB-A13) and structurally impossible regardless of catalog content, since no B9 command exists anywhere in this corpus for any action to invoke.
- **`move_deal_stage` and the entire B6 boundary carry the identical restatement `B6_REVENUE_FIREWALL.md` already proved**: `DealWon` cannot and does not emit `RevenueRecognized` (`B6_COMMAND_EVENT_CATALOG.md` §3, restated verbatim from frozen `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007) — B7 consuming `DealWon` as a *trigger* changes nothing about what `DealWon` itself does or doesn't emit.
- **`close_won_deal`/`close_lost_deal` are excluded from the action catalog entirely** (§`B7_ACTION_CATALOG.md` §4) — automation cannot even cause the Won/Lost transition itself, let alone anything downstream of it; it can only react to a transition a human (or, per `B6-D-A026`, some other governed caller) already caused.

## 3. Required negative controls

| ID | Scenario | Expected |
|---|---|---|
| `AT-RFW-1` **NC** | a rule with trigger `deal_won` and action `create_task` executes | zero rows in `revenue_events`; zero `RevenueRecognized` events on any outbox — the rule's action list contains no B9-reaching action, so there is nothing capable of producing one |
| `AT-RFW-2` **NC** | an implementation defining a B7 action type that calls an undeclared/hypothetical `RecordRevenueEvent` command | rejected at design review — `B7_ACTION_CATALOG.md` §1's closed catalog has no such entry, and no B9 application-service interface is imported anywhere in the B7 module (§2) |
| `AT-RFW-3` **NC** | a `deal_won`-triggered run's `move_deal_stage` action is retried after a transient B6 failure | no duplicate `RevenueEvent` — trivially true, since `move_deal_stage` never touches revenue truth in the first place; retried per `B7_IDEMPOTENCY_MODEL.md`'s ordinary action-idempotency guarantee, unrelated to revenue |
| `AT-RFW-4` **NC** | an operator disables or archives a rule whose historical runs reacted to `deal_won` | zero effect on any `RevenueEvent`/`RevenueReversal` — disabling/archiving is a Phase-1 B7 lifecycle transition (`B7_RULE_LIFECYCLE.md` §2) with no B9 side effect, and none ever existed to reverse |
| `AT-RFW-5` **NC** | an operator deletes/retention-purges old `automation_runs`/`automation_run_steps` rows (`B7_RETENTION_DELETION.md`) | zero effect on financial truth — B7's own audit history is never the system of record for revenue; deleting it cannot alter a `RevenueEvent` that was never created by B7 in the first place |

`REVENUE_EVENT_PRODUCERS_IN_B7 = 0`, `RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0`.

## 4. False-positive guard

The phrase "revenue" appears in this document, in `B7_ACTION_CATALOG.md` §4, and in `B7_DECISION_REGISTER.md` **only** inside negative statements ("must not," "cannot," "excluded," "no such entry") or as the name of a forbidden/excluded action — never as a live action, command, event, or field B7 produces. No occurrence should be mechanically miscounted as a producer.
