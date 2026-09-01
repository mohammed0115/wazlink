# B7 — Retention and Deletion

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Archive, never destroy business history

| Entity | Retention posture |
|---|---|
| `AutomationRule` | `archived` (soft), never hard-deleted — a rule row persists indefinitely once created, since `AutomationRun`s reference it (`rule_id` FK) and those runs must remain explicable |
| `AutomationRuleTrigger` / `AutomationRuleCondition` / `AutomationRuleAction` | retained with their parent revision, always — they *are* the revision's definition (`B7_DATA_MODEL.md` §2a-§2c) and are never pruned independently of it |
| `AutomationRuleRevision` | retained for as long as any run references it, and beyond that per the workspace's general audit-retention window (deferred exact number, Class B — no frozen numeric precedent for automation-specific audit retention exists yet in this corpus; inherits whatever general audit-log retention period `BACKEND_DATA_GOVERNANCE.md` ultimately fixes, rather than B7 inventing a competing number) |
| `AutomationRun` / `AutomationRunStep` / `AutomationApproval` | same posture as revisions — retained for the audit-retention window, never purged merely because a rule was archived |
| `AutomationInboxRecord` | may be pruned after its dedup window is no longer operationally relevant (deferred exact number, Class B — a technical bookkeeping table, not business history; safe to prune far sooner than the audit trail itself since the value it protects, exactly-once admission, only matters within a redelivery's realistic time window) |

## 2. What archiving/deleting automation configuration never touches

Archiving or (if ever added) deleting an `AutomationRule` never deletes CRM truth (`B2`), Messages (`B5`), Deals (`B6`), or financial records (`B9`) — B7 owns none of them (`B7_DOMAIN_OWNERSHIP.md` §4), and its own retention/deletion operations are scoped exclusively to its own nine Phase-1 entities (`B7_DOMAIN_OWNERSHIP.md` §2). A Task/Appointment/Deal/Message an automation action already created remains exactly as durable as if a human had created it directly — deleting the *automation history that caused it* has zero effect on the created record itself (consistent with `B7_REVENUE_FIREWALL.md` §3's `AT-RFW-5`).

## 3. Unresolved numeric retention periods — safely deferred

Exact retention-period numbers (Class B/C, per task brief §57's own instruction) are deferred to `BACKEND_DATA_GOVERNANCE.md`'s eventual general policy rather than invented here — B7 states only the *shape* (archive-not-destroy for business-adjacent rows; short-window prune permitted for pure infrastructure bookkeeping) and which rows fall into which bucket.
