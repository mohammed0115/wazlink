# B6 — Concurrency and Idempotency

> **B6 status:** Target design only. Uses frozen B0's generic optimistic-concurrency and idempotency standards unchanged; adds no new mechanism.

## 1. Optimistic concurrency

Every mutable B6 aggregate (`deals`, `pipelines`, `pipeline_stages`) carries `version` (frozen `BACKEND_ARCHITECTURE_DECISIONS.md`: *"Editable Lead, Deal, Task, and AutomationRule DTOs carry an integer `version`. Update commands require the client version; mismatches return `409 CONFLICT`."* — Deal is explicitly named already). Every mutating command:

1. Locks the target row(s) with `SELECT ... FOR UPDATE` inside the request transaction (mirrors B1's privileged-actions pattern, `B1_AUTHORIZATION_RBAC.md` §5).
2. Compares the caller-supplied `If-Match`/`expected_version` against the locked row's current `version`.
3. On mismatch: `409 STALE_VERSION`, no write, no event, no `deal_stage_transitions` row.
4. On match: applies the change, increments `version` by exactly 1, writes the corresponding `deal_stage_transitions` row (for status/stage transitions) and outbox event, all in the same transaction.

**No silent last-write-wins for any commercial state transition** — the task's explicit requirement — is satisfied structurally: there is no code path that writes `deals` without first passing the version check.

## 2. Named race scenarios, resolved

| Race | Resolution |
|---|---|
| **Two users move the same Deal to different stages simultaneously** | Both requests carry the same `expected_version`. First to commit wins, incrementing `version`; the second's `If-Match` no longer matches the now-current row → `409 STALE_VERSION`. The loser re-fetches the current state and retries with the new `version` — an explicit, visible conflict, never a silently overwritten stage. |
| **Move + Close race** (one actor moves stage, another closes as Won, near-simultaneously) | Same mechanism: whichever command's transaction commits first wins; the other's stale `version` is rejected `409`. If the close wins, a subsequent stale `MoveDealStage` retry additionally fails the state-machine guard (`not_open`) even after a version refresh, because the Deal is now closed — two independent layers of protection, not one. |
| **Close + Reopen race** | Identical version-check mechanism. A `ReopenDeal` racing a `CloseDealLost` on the same Deal cannot both succeed — one sees a stale version and is rejected; if by some ordering a `ReopenDeal` on an already-open Deal somehow reaches the guard, the state-machine guard (`reopen_forbidden`) rejects it independently. |
| **Owner reassignment race** (two managers reassign to different people at once) | Same version-check mechanism; the loser's `409 STALE_VERSION` surfaces the current (winning) owner on retry. |
| **Amount update + Close race** | `UpdateDeal` (value edit) and `CloseDealWon`/`CloseDealLost` both require `If-Match` against the same `deals.version` — only one can win. If close wins first, the queued `UpdateDeal`'s stale-version retry additionally fails `not_open` once refreshed, since a closed Deal's `value` is frozen (`B6_DEAL_STATE_MACHINE.md` §3). |
| **Pipeline stage archive + Deal move race** (an admin archives a stage while a rep is mid-drag onto it) | `ArchivePipelineStage` requires `If-Match` on `pipeline_stages.version` **and** re-checks "no open Deal currently references this stage" inside the same locked transaction. `MoveDealStage` targeting that stage independently re-validates the target stage's `active`/`archived_at` state inside its own transaction. Whichever transaction commits first determines the outcome for the other: if the archive commits first, the pending move fails `422 VALIDATION_ERROR` \| `inactive_stage`; if the move commits first, the archive's own "no open Deal references this stage" check now sees the newly-arrived Deal and fails `409 CONFLICT` \| `stage_referenced_by_active_deals`. Neither ordering allows an open Deal to end up silently pointing at an archived stage. |

## 3. Idempotency

`Idempotency-Key` (frozen `BACKEND_IDEMPOTENCY_STANDARD.md`, header transport, scoped by workspace + principal + endpoint + body hash) is **required** on every state-mutating B6 command: `CreateDeal`, `UpdateDeal`, `MoveDealStage`, `CloseDealWon`, `CloseDealLost`, `ReopenDeal`, `AssignDeal`, and every Pipeline/Stage administration command (`CreatePipeline` … `ArchivePipelineStage`). This is a deliberately stricter posture than the frozen general standard's minimum (which names it required for a specific list of sensitive commands) — matching B5's own precedent of requiring it on every actor-initiated send/cancel command, because every one of these B6 commands mutates commercial state in a way a duplicate would corrupt.

- **Same key, same body:** the stored terminal response is replayed. No second `deal_stage_transitions` row, no second event, no second `version` increment.
- **Same key, different body:** `409 IDEMPOTENCY_CONFLICT` (frozen error code, unchanged meaning).
- **In-progress reuse:** `409` or a safe in-progress representation, per frozen B0's standard, unchanged.

`GET` operations (list/detail/transitions) carry no idempotency requirement, as usual.

## 4. Duplicate commands cannot create duplicate transitions or events

**Negative control, `AT-IDEM-4 (NC)` / `NC — duplicate MoveDeal does not create duplicate transition/event`:** an `IdempotencyRecord` is created inside the same transaction as the `Deal` row mutation, the `deal_stage_transitions` insert, and the outbox event insert (frozen B0's idempotency standard: *"Command services create an `IdempotencyRecord` inside the same transaction as the command's durable state."*). A retried request under the same key can therefore never produce two transition rows or two events for one logical command execution — the unique constraint on the idempotency record prevents concurrent duplicate execution outright, not merely detects it after the fact.

## 5. Worker/automation idempotency (forward-looking, B7)

Per frozen B0: *"Worker execution is idempotent by `(command_id, effect_type)` and checks the target version/state before side effects."* A future B7 automation invoking `CreateDeal`/`MoveDealStage`/etc. inherits this identical discipline — it is not a special B6 rule, it is the same rule every governed command in the platform already follows (`B6_B7_AUTOMATION_BOUNDARY.md`).
