# B6 — Won / Lost / Loss Reasons

> **B6 status:** Target design only.

## 1. `DealOutcome` evaluated and rejected as a separate table

The task's candidate list includes `DealOutcome` as something to evaluate. B6 rejects it as a separate table: the outcome of a Deal is fully expressed by `Deal.status` (`open`/`won`/`lost`) plus, for `lost`, `Deal.loss_reason_code`/`loss_reason_note`. A separate `DealOutcome` row would duplicate `status` and introduce a second place that could drift from it. The frozen DTO sketch already has one `status` field — B6 does not add a second outcome concept beside it.

## 2. Won, precisely

**Won means a sales/commercial outcome — the buyer and seller reached agreement — recorded on the Deal aggregate. It is never, under any circumstance, recognized financial revenue** (`B6_REVENUE_FIREWALL.md`). `CloseDealWon`:

- requires `deal.close` and explicit confirmation (frozen B0: "explicit confirmation; audit" — the request body carries an explicit `confirm: true`-shaped field, never inferred from a bare `POST`);
- forces `probability := 100` (frozen `BACKEND_STATE_MACHINES.md`: "Won probability is 100");
- sets `won_at`/`closed_at`;
- freezes `stage_id` at its last-open value;
- emits `DealWon` — and nothing else. No `RevenueEvent`, no invoice, no payment row, no attribution row.

## 3. Lost, precisely

`CloseDealLost` forces `probability := 0` (frozen: "Lost is 0"), sets `lost_at`/`closed_at`, freezes `stage_id`, and **requires** a `loss_reason_code`.

**`B6-D-A013` (Class A, resolved): a loss reason is required on every `CloseDealLost` in Phase 1.** No "skip reason" path exists — this is a deliberate product-quality decision (a Lost Deal with no reason is unactionable for pipeline coaching) and is stated as its own decision so it is not silently assumed.

### 3.1 Loss reason catalog

- **Workspace-defined catalog** (`deal_loss_reasons`, `B6_DATA_MODEL.md` §5), seeded with a small set of **system-default rows** visible to every workspace out of the box (`budget`, `timing`, `competitor`, `no_response`, `no_budget_authority`, `other`) so Phase 1 ships usable without requiring every workspace to configure reasons before closing a first Lost Deal.
- Workspaces may add their own additional codes under `pipeline.manage` (`CreateLossReason`/`UpdateLossReason`/`ArchiveLossReason` — folded into `pipeline.manage`'s existing command set rather than minting three more top-level permissions for a low-risk catalog-management action).
- **Free-text notes** are supported alongside the required catalog code (`loss_reason_note`, nullable) — the catalog code is always required and structured (for reporting/coaching aggregation); the note is optional elaboration. This mirrors `B2_LEAD_AGGREGATE.md` §2's free-tag pattern: structured-for-filtering plus optional free text, never free text alone as the sole record.
- `other` is always present as a system-default catch-all so the required-reason rule never blocks a genuinely uncategorizable loss.

### 3.2 Deleting a referenced loss reason — forbidden

**A `deal_loss_reasons` row referenced by any historical `deals.loss_reason_code` cannot be hard-deleted, ever.** `ArchiveLossReason` sets `archived_at`/`active=false` only. An archived reason:

- **cannot** be selected on a *new* `CloseDealLost` (`422 VALIDATION_ERROR` \| `invalid_loss_reason`);
- **remains valid and displayed** on every historical Deal that already carries it — `Deal.loss_reason_code` is a stable reference to the catalog row's `code`, not a copied label, so a later label edit (`UpdateLossReason`) is reflected on historical Deals too (the code is authoritative identity; the label is presentation), while archiving only blocks *future* selection.

## 4. Reopen behavior

Full transition semantics are in `B6_DEAL_STATE_MACHINE.md` §2. Summarized here for the Won/Lost-specific fields:

| Field | On `ReopenDeal` |
|---|---|
| `status` | → `open` |
| `probability` | re-seeded from the retained `stage_id`'s current `default_probability` |
| `won_at` / `lost_at` / `closed_at` | cleared on the live row (history retained in `deal_stage_transitions`, §`B6_STAGE_TRANSITION_HISTORY.md`) |
| `loss_reason_code` / `loss_reason_note` | cleared (only relevant when reopening from `lost`) |
| `reopened_at` | set to `now()` |
| RevenueEvent (if any exists from a **separate, future B9 workflow**) | **untouched.** B6 never created one from `DealWon` in the first place (§`B6_REVENUE_FIREWALL.md`), so `ReopenDeal` has structurally nothing of B6's own to reverse. If a future B9 financial-recognition workflow separately recorded revenue against this Deal's outcome, reversing *that* is exclusively B9's own governed command (`ReverseRevenueEvent`), never a B6 side effect. |

**Negative control:** `NC — reopening a Won Deal does not reverse or create a RevenueEvent` (`B6_ACCEPTANCE_TESTS.md`, `B6_REVENUE_FIREWALL.md` §4).

Reopen is permitted from both `won` and `lost` — the task does not ask B6 to distinguish "reopening a mistaken Win" from "reopening a mistaken Loss" with different rules, and no frozen or frontend evidence suggests they should differ; both require `deal.reopen` and an audited reason note.
