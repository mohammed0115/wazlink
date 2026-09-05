# 18 — B0–B13 Impact Analysis

> **Status: FINALIZED.** Impact is expressed in the frozen B13 amendment vocabulary (`ADDITIVE` · `COMPATIBLE_CLARIFICATION` · `NON_ADDITIVE`), because B13 requires every change to a frozen artifact to be registered regardless of class. Full register: `19_CONTROLLED_AMENDMENT_PLAN.md` (**14 items**).

> Resolves brief §33. **No frozen document is edited. This is analysis, not amendment.** Baseline B13 = `5c759cea72baaec9ee0096039475162efd4eeec0`.

## 1. Impact by frozen phase

| Phase | Impact | Detail |
|---|---|---|
| **B0** (root contracts) | `ADDITIVE` ×3 | Registry prefixes (`CA-03`); data-model table groups (`CA-07`); authorization-matrix and command/event rows (`CA-08`) |
| **B1** Tenant & Identity | `ADDITIVE` ×3 | `contact.*` (`CA-06`); the remaining permission rows (`CA-09`); `workspaces.operating_mode` (`CA-13`, **deferred**). **No new role, no new rank, no changed cell** |
| **B2** CRM | **`NON_ADDITIVE` ×1**, `ADDITIVE` ×2, `COMPATIBLE_CLARIFICATION` ×1 | **`CA-01`** — the only non-additive item in the plan: Lead origin widened, `business_id` **and `converted_at`** nullable under conditional invariants, `last_activity_at` seeding rule, CRM-INV-10 index scoped. Plus `CA-05` (Contact↔Customer), `CA-04` (merge lineage, deferred with `GAP-007`), `CA-14` (`lead_provenance` is Discovery-only — a clarification, not a change). **Closes named deferrals `B2-D-C001`, `C002`, `C003`, `C007`** |
| **B3** Discovery | `NO_CHANGE` | Track A untouched. `business_identities` is cited as precedent, not modified |
| **B4** AI Intelligence | `NO_CHANGE` | B4 remains a recommender (`B4-D-A012`). The new `aiagent` app is the *separate* phase `B4-D-C002` anticipated; it does not extend B4 |
| **B5** Messaging | `ADDITIVE` ×1 | `CA-02` — new orthogonal `handling_mode` column. **The frozen `status` enum(2) is deliberately not widened**, so the state machine's fan-out is unchanged. `B5-D-A021` preserved verbatim and reinforced by `PD-013`: **no autonomous AI send, and no second AI-owned send command** |
| **B6** Pipeline & Deals | **`NO_CHANGE`** | `quotes.deal_id` is held by the new **quotes** app, so no frozen B6 artifact changes and **no amendment item exists** (and it is deferred with `GAP-018`–`GAP-020` in any case). `AT-REV-5`'s firewall is reused as the pattern |
| **B7** Automation | `ADDITIVE` ×1 | `CA-12` — 3 triggers, 1 action (`create_ticket`, `auto_safe`). **Safety tiers unchanged; `send_message` stays `approval_required`; the excluded-action list stays excluded** |
| **B8** Billing & Entitlements | `ADDITIVE` ×1 | `CA-11` — independent per-module capability keys (`PD-004`); `inbox.copilot` **reused, not replaced** (`PD-003`). Plan/quota mechanics unchanged; **pricing not frozen**. **No new financial coupling** |
| **B9** Revenue & Attribution | **`NO_CHANGE`** | Already dual-track ready. Its own §5 predicted this exact expansion and listed what would change: *"one additive value in the `origin_kind` closed set"* — and `customers.origin_kind` was deliberately aligned to B9's existing set, so even that is unnecessary. Immutable snapshots are never rewritten |
| **B10** Tax & ZATCA | `NO_CHANGE` | Quotes are not tax documents. `tax_invoices` remain WazLink→workspace. Customer invoicing stays `B9-D-C004` deferred |
| **B11** Files & Storage | `ADDITIVE` ×1 | `CA-10` — `file_attachments.subject_type` += 4 values, the extension path `B11_DOMAIN_ATTACHMENT_MODEL.md` §1 designed for. **B11 remains the single storage authority** |
| **B12** Async & Integration | **`NO_CHANGE`** | Queues, outbox, inbox, `provider_request_attempts`, retry and reconciliation **reused unmodified** — including for the OpenAI adapter, which runs on `providers.slow` under `B12-D-A020`. **No new queue, no new webhook, no second retry mechanism.** The form-intake surface is deferred (`PD-010`), removing the only candidate change |
| **B13** Security & Operations | **`NO_CHANGE`** | New audit codes and redaction subjects are B13-conformant *applications* of its existing exhaustive lists, not changes to them; the public-form rate-limit class is deferred with `GAP-009`. **No security contract is weakened, relaxed or made configurable** — see `28_SECURITY_INTEGRATION_IMPACT.md` |

**Counts.** Phases with amendment items: **7** (B0, B1, B2, B5, B7, B8, B11). Phases unchanged: **7** (B3, B4, B6, B9, B10, B12, B13). Amendment items: **14** — **1 `NON_ADDITIVE`** (`CA-01`), **12 `ADDITIVE`**, **1 `COMPATIBLE_CLARIFICATION`**. `CONFLICT` **1** (`GAP-027`, no phase — it is the *absence* of a frozen authority).

## 2. The one CONFLICT

**`GAP-027` Customer Portal.** Requires authenticating a **non-member external person** (a workspace's own customer). B1's frozen identity model contains users, memberships, workspaces and invitations — every principal is a membership. B13's authorization and session contract assumes the same. There is no frozen concept of an external principal, and inventing one touches the deepest security boundary in the corpus.

This is not solvable by an additive extension and must not be attempted inside a CRM release. **Owner/CTO decision required before any design work.** `B14: CONFLICT_BLOCKED`.

## 3. Why B9 genuinely needs no change

This is the plan's most consequential finding, so it is stated with its evidence:

- `B9_DUAL_TRACK_COMPATIBILITY.md` §2: `TRACK_B_DISCOVERY_REQUIRED = NO`.
- §3: source validation *"requires only that `source_ref` resolve in-workspace"*; the provenance chain's *"every hop is optional"*.
- §3: five of seven `origin_kind` values (`import`, `manual`, `api`, `form`, `referral`) are already Track-B native.
- §7: `AT-TRACK-1` and `AT-TRACK-2` are **negative controls** that fail if recognition ever requires a `DiscoveryJob` or a `Business`.
- §5 predicted the Customer entity's arrival and named the only thing that would change — an `origin_kind` value — which this plan avoids needing by aligning `customers.origin_kind` to B9's existing set.

**B9 was designed forward-compatible for exactly this programme.** Treating it as needing change would be the error.

## 4. Invariants verified as preserved

| Invariant | Status |
|---|---|
| Workspace isolation | **Preserved** — every new table has `workspace_id`; identity resolution is workspace-keyed by construction |
| PostgreSQL authoritative / Redis non-authoritative | **Preserved** — the assignment rotation counter is explicitly a PostgreSQL row, not Redis |
| Frozen session/auth boundaries | **Preserved** — no new principal type (which is why `GAP-027` is blocked, not designed) |
| Frozen async/reconciliation rules | **Preserved** — no auto-retry of `UNKNOWN` non-idempotent work; import rows follow `B12-D-A020` |
| B11 storage ownership | **Preserved** — enum registration only |
| B12 webhook/integration contracts | **Preserved** — form intake reuses the receipt/dedup shape |
| B13 security requirements | **Preserved and extended** |
| **Won Deal ≠ Recognized Revenue** | **Preserved** — unchanged B6 |
| **Accepted Quote ≠ Recognized Revenue** | **Preserved** — enforced by ownership + 4 negative controls |
| **Subscription Billing ≠ Customer Revenue** | **Preserved** — CRM-INV-8 untouched |
| **Customer invoice ≠ SaaS invoice** | **Preserved** — customer invoicing not built |
| **Discovery not required for CRM** | **Achieved via corrected `CA-01`** — all five blocking constraints addressed (`origin_type`, `business_id`, **`converted_at`**, CRM-INV-10 index, **`last_activity_at` seeding**), with **no fake Business, no fake Job and no fake `lead_provenance`** |
| AI recommendations ≠ mutations | **Preserved and strengthened** — propose/execute ladder; agent holds no permissions; `PD-013` APPROVED forbids autonomous customer-facing send; OpenAI sits behind a provider port and owns no business semantics |
| Frontend grants no authorization | **Preserved** |
| No cross-workspace identity merging | **Preserved** — not expressible in the API |
| No duplicate commercial truth | **Preserved** — one `customers` table; Account rejected |
