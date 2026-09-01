# B6 — Data Retention and Deletion

> **B6 status:** Target design only. Extends B0's `archived_at`-only removal doctrine — no B6 table has a `DELETE` path, matching every other domain in this corpus.

## 1. Behavior by upstream lifecycle event

| Upstream event | B6 effect |
|---|---|
| **Lead archived** (`B2_LEAD_AGGREGATE.md` §7) | **None.** Deals referencing the archived Lead remain fully intact, mutable, and visible (`B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §2). No cascade in either direction — B2 already forbids gating on B6's state, and B6 does not invent the mirror-image gate. |
| **Contact archived** (B2) | **None, structurally.** B6 has no direct Contact reference to react to (`B6_LEAD_BUSINESS_CONTACT_RELATIONSHIPS.md` §5) — a Deal never held a Contact FK to begin with. |
| **Business retained** (never archived by B2 today) | N/A — `Deal.business_id` is an immutable snapshot regardless (`B6_DEAL_AGGREGATE.md` §3). |
| **Deal archived** | **Not a modeled state in Phase 1** (`B6_DEAL_STATE_MACHINE.md` §1) — `status ∈ {open, won, lost}` already provides list hygiene; no `archived_at` column exists on `deals`. Evaluated and rejected as unnecessary machinery, `B6-D-A009`. |
| **Pipeline archived** | `archived_at` set, guarded by the "not the sole default" rule (`B6_PIPELINE_MODEL.md` §2). Every Deal referencing it (necessarily all closed, since an active pipeline's stages can't have been fully vacated of open Deals without first clearing them per §6's guard on the pipeline's own stages — though the pipeline-level archive itself does not independently re-check open-Deal references beyond what stage-level archiving already enforces) remains fully readable; historical `pipeline_ref`/`stage_ref` on old Deals continue to resolve. |
| **Stage archived** | Blocked while any `status='open'` Deal references it (`B6-DF-032`); once no open Deal does, archiving is permitted and every historically-closed Deal's frozen `stage_id` continues to resolve to the (now-archived, still-readable) row. |
| **User/membership removed** | `Deal.owner_membership_id` and every `deal_stage_transitions.actor_membership_id` continue to reference the historical (removed) membership row — `ON DELETE RESTRICT`, never nulled, never cascaded (`B6_OWNERSHIP_ASSIGNMENT.md` §4). Membership rows are never hard-deleted by B1 in the first place. |
| **Workspace deletion** (B1's own governed `DeleteWorkspace`, Owner-only, Class B re-auth) | Out of B6's design scope — whatever retention/purge policy B1/B0's future data-governance phase defines for a deleted workspace applies uniformly across every tenant-owned table, `deals` included. B6 introduces no domain-specific override of that eventual policy. |

## 2. Nothing is casually erased

No B6 table has a `DELETE` code path anywhere in `B6_COMMAND_EVENT_CATALOG.md` §2. `deal_stage_transitions` is explicitly append-only (`B6_DATA_MODEL.md` §4). `deal_loss_reasons` rows referenced by any historical Deal cannot be hard-deleted, only archived (`B6_WON_LOST_LOSS_REASONS.md` §3.2). Commercial history — who moved a Deal where, when it was won or lost and why, who owned it at each point — is permanent, matching the task's explicit instruction not to erase commercial history casually.

## 3. Future retention-policy hooks

B0's future data-governance/privacy phase may eventually define a time-bounded retention window for closed Deals (e.g., "purge Deal detail after N years, retain only aggregate counts"). B6 does not invent that policy — it is recorded as a forward dependency (`B6-D-C005`, Class C, mirroring `B4_DATA_MODEL.md` §4's and `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §5's identical "product/legal decision required" posture for their own retention questions) rather than either inventing a premature TTL or asserting Deals are retained forever by product decision (they are retained forever only because no shorter policy has been decided, not because permanence was chosen as a feature).
