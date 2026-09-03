# B12 — RBAC & Tenancy

> Design only. Built on frozen B1 methodology (`B1_AUTHORIZATION_RBAC.md`) without altering one `allow`/`conditional`/`deny` cell.

## 1. Permissions — reuse first

Frozen `B1_AUTHORIZATION_RBAC.md` §2 line 76 already registers a `Settings` family containing **`integration.manage`**, and §3 line 131 already gives it a full role row with the condition *"secret access never returned to client."* B12 reuses it verbatim for every integration operation and mints nothing for them.

| Code | Status | Governs |
|---|---|---|
| `integration.manage` | **frozen, reused** | `ConfigureIntegration`, `CheckIntegrationConfiguration`, `EnableIntegration`, `DisableIntegration`, and reads of `/integrations` |
| `platform.operations.view` | **new, additive** (`B12-AM-006`) | `listDeadLetters`/`getDeadLetter` (ops 7-8), `getIntegrationHealth` (op 11), `listReconciliationCases`/`getReconciliationCase` (ops 12-13) |
| `platform.operations.replay` | **new, additive** (`B12-AM-006`) | `replayDeadLetter` (op 9), `abandonDeadLetter` (op 10), `resolveReconciliationCase` (op 14). **Exactly three operations, and nothing else** — `RetryJob` and `RetryWebhook` are system-only and require no permission at all (`B12-D-A053`) |

> **Every governed operation names a real, reachable endpoint — and no permission governs a path that cannot execute.** In the pre-FIX.1 draft this table claimed the view permission governed "reconciliation case reads" that no operation exposed, and gave the replay permission two commands (`AbandonDeadLetter`, `ResolvePlatformReconciliationCase`) with no surface at all. **B12-FIX.1a closes the mirror-image defect**: the replay permission also claimed `RetryJob`/`RetryWebhook` "operator paths" that were unreachable by those commands' own preconditions. Those two are system-only and appear in no permission cell. Both are closed: `B12_API_DTO_CONTRACTS.md` §1 now carries operations 10 and 12-14, and `B12_COMMAND_EVENT_CATALOG.md` §1a surface-classifies all fifteen commands. A permission that governs nothing invocable is either a dead cell or a hidden endpoint. `UNOWNED_OPERATOR_SURFACES = 0`.

`REUSED_PERMISSION_COUNT = 1`. `ADDITIVE_PERMISSION_COUNT = 2`.

**Why exactly two, and why they are split.** The brief (§39) warns against proliferation. Seven candidate operations were considered; five are absorbed:

| Candidate | Resolution |
|---|---|
| integration view | `integration.manage`. A separate read code would let someone see which providers a workspace uses without being able to act — a distinction with no product meaning and one more cell to get wrong |
| integration configure / enable / disable | `integration.manage` (frozen) |
| dead-letter view | `platform.operations.view` — **new.** It cannot be `integration.manage`: a dead letter names a failed *business intent* (a payment, a message), so seeing one is a broader disclosure than seeing which integrations exist |
| **replay** | `platform.operations.replay` — **new, and deliberately separate from view.** Replay re-invokes a real provider effect: it can send a customer a message or move money. Reading an incident and re-executing it are different powers, and folding them together would make every operator who can diagnose also able to charge a card |
| reconciliation read | `platform.operations.view` — a case names a failed business intent, the same disclosure class as a dead letter |
| reconciliation resolve | `platform.operations.replay` — same power class as replay: a `repaired` resolution may invoke a domain repair command |

## 2. Role matrix

Rows are **added**, never altered, following B10's and B11's precedent. Legend matches B1: **A** allow, **C** conditional, **·** deny.

| Permission | owner | admin | manager | sales | member | viewer | Condition for `C` |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `integration.manage` | A | A | C | · | · | · | *(frozen B1 row, unchanged)* secret access never returned to client |
| `platform.operations.view` | A | A | · | · | · | · | — |
| `platform.operations.replay` | A | C | · | · | · | · | admin: **not** for a dead letter whose `owning_domain` is `billing` or `finance` — those require Owner, mirroring the frozen matrix's own "cannot bypass financial audit" limit on Admin |

The `platform.operations.replay` conditional cell is derived, not invented: `BACKEND_AUTHORIZATION_MATRIX.md` already states *"Admin manages workspace configuration and members but cannot bypass financial audit or tenant isolation,"* and re-charging a card is precisely a financial-audit action.

## 3. Global-scope integrations are not workspace-administrable

> **`B12-D-A043`. A workspace admin may configure a workspace-scoped integration (Meta, Tap) and may **not** configure a global-scope one (Places, AI Gateway, storage).**

A shared platform credential rotated by one tenant would break every other tenant. Global connections are platform-operator configuration (`B12_CONFIGURATION_INVENTORY.md` §3), visible to a workspace admin as status-only. Negative control `AT-B12TEN-6`.

## 4. Tenancy

Every B12 operation follows frozen Doctrine R-1 without exception:

```
conn = IntegrationConnection.objects.for_workspace(active_workspace).get(public_id=...)   # required
conn = IntegrationConnection.objects.get(public_id=...)                                    # FORBIDDEN
```

A `INT-*`, dead letter, reconciliation case, receipt, or health record that resolves outside the active workspace produces `404 ENTITY_NOT_FOUND` — never `403`, never a validation error — per B1's anti-enumeration rule.

**The cross-workspace attacks, and where each is stopped:**

| Attack | Stopped by |
|---|---|
| read another workspace's integration | Doctrine R-1 → `404` |
| read another workspace's dead letter or reconciliation case | Doctrine R-1 → `404` |
| **poison another workspace's webhook dedup identity** | `dedup_key` is prefixed by the **binding whose secret verified** the delivery, so an identity claimed under binding A cannot collide with one claimed under binding B (`B12-D-A056`, `B12_WEBHOOK_DEDUP_ORDERING.md` §2a) |
| **replay another workspace's dead letter** | Doctrine R-1 **plus** re-assertion that the record's `workspace_id` equals the active workspace **after** resolution (Doctrine R-2); there is no cross-workspace replay at any privilege level |
| forge a webhook to reach another tenant | signature must verify against **that binding's own secret** (`B12_WEBHOOK_SECURITY.md` §3) |
| use a provider object ID as a tenant claim | provider IDs are lookup keys only, never authorization claims (`B12-D-A029` rule 5) |
| exhaust another tenant's share of a global provider | per-workspace budgets on shared credentials (`B12_RATE_LIMIT_BACKPRESSURE.md` §5) |
| read another workspace's provider attempt / execution | no API exposes them at all (`B12_API_DTO_CONTRACTS.md` §1) |

`CROSS_TENANT_INTEGRATION_GAPS = 0` rests on this table. Negative controls `AT-B12TEN-1` … `AT-B12TEN-7`.

## 5. System actors

`SubmitJob`, `DispatchOutboxEvent`, `RecordProviderAttempt`, `OpenDeadLetter`, and `OpenPlatformReconciliationCase` run under the frozen `system:*` actor convention B2 established and B7 formalized. A system actor:

- is recorded in the audit trail as the actor, never as a human membership;
- is bound to **exactly one workspace per invocation**, resolved from the row it acts on — so a system command is as workspace-scoped as a user command;
- is **not exempt from any guard.** A system-actor replay still respects `replay_eligible`, still respects the domain's attempt budget, and still fails against a disabled provider. There is no privileged path that skips a guard because the caller is internal.

## 6. Operator visibility limits

A dead-letter DTO is readable by `platform.operations.view`, but it deliberately carries **no raw payload** (`B12_API_DTO_CONTRACTS.md` §4). An incident is exactly when the temptation to expose everything is highest; the record therefore carries identifiers, classes, and counts — enough to decide what to do, not enough to read a customer's message or a payment's details.
