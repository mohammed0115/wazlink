# B6 — Security and Privacy Threat Model

> **B6 status:** Target design only.

## 1. Threats and mitigations

| # | Threat | Mitigation | Acceptance evidence |
|---|---|---|---|
| 1 | Cross-workspace IDOR on `DEAL-*`/`PIPE-*`/`STG-*` | Doctrine R-1 workspace-scoped queryset, every read/write | `AT-TEN-1`, `AT-TEN-2`, `AT-SEC-1` |
| 2 | Mass assignment (`status`, `version`, `public_id`, timestamps client-supplied) | Doctrine R-4 explicit allow-list DTOs, `additionalProperties:false` | `AT-API-1`, `AT-API-2` |
| 3 | Unauthorized `CloseDealWon`/`CloseDealLost` | `deal.close` permission, explicit-confirmation payload, `sales` role denied per frozen matrix | `AT-RBAC-3` |
| 4 | Unauthorized `ReopenDeal` | new `deal.reopen` permission, same audit tier as `deal.close`, mandatory reason note | `AT-REOPEN-4`, `B6_ENTITLEMENT_RBAC_TENANCY.md` §3 |
| 5 | Unauthorized owner reassignment | `deal.assign` permission, own-assigned/team object condition mirroring `lead.assign` | `AT-RBAC-4`, `AT-RBAC-5` |
| 6 | Pipeline/Stage-admin abuse (rewriting the sales process to hide/reroute Deals) | `pipeline.manage`, admin-tier, manager-conditional-only | `AT-PIPE-*` |
| 7 | Stale-version overwrite of a commercial state transition | `If-Match`/`version`, `409 STALE_VERSION`, row lock, no silent last-write-wins | `AT-CONC-*` |
| 8 | Duplicate commands (double-submit, network retry) | mandatory `Idempotency-Key` on every mutating command, single-transaction idempotency record | `AT-IDEM-*` |
| 9 | Forged/spoofed workspace ID on any B6 request | workspace resolved server-side from the authenticated session (`sessions.active_workspace_id`), never client-supplied — identical to every other domain, no B6-specific exception | `B1_AUTHORIZATION_RBAC.md` §1 step 5 |
| 10 | Cross-workspace `lead_ref`/`pipeline_ref`/`stage_ref`/owner reference injection | Doctrine R-2 relationship injection, resolved in-scope, mismatch → `404` never `422` | `AT-TEN-3`, `AT-TEN-4`, `AT-TEN-6` |
| 11 | Pipeline/Stage mismatch (`stage.pipeline_id != pipeline_id`) used to smuggle a cross-pipeline reference | explicit composite check at every command guard | `AT-MOVE-7`, `B6-DF-007` |
| 12 | Event replay poisoning a projection (e.g., a replayed `DealWon` double-counting a "Won Deals" period metric) | event envelope's stable `event_id`; read models aggregate from the durable `deals`/`deal_stage_transitions` state, not from a naive event-count accumulator — a replayed event changes nothing already-committed | `AT-EVENT-*` |
| 13 | Projection poisoning via the CRM timeline (a forged/duplicated Pipeline-sourced entry) | `entry_id = pipeline:<source_event_id>` deduplication at read-time merge, entirely B2-owned and unchanged (`B2_TIMELINE_IDENTITY_MODEL.md` §4.2) | `AT-TL-6`, `AT-TL-7` |
| 14 | Revenue-boundary bypass via any Deal-adjacent surface | structural unreachability — no B6 write path to Revenue tables, for any caller including a compromised B6 service account | `AT-REV-*`, `B6_REVENUE_FIREWALL.md` |
| 15 | Credential/secret leakage | N/A — B6 holds no provider credentials, no third-party secrets of any kind (`B6_RATE_COST_MODEL.md` §1) | — |
| 16 | PII over-logging | `B6_OBSERVABILITY_AUDIT.md` §3 |

## 2. What B6 does not need to threat-model

Unlike B3/B4/B5, B6 has no external provider, no webhook ingress, no third-party credential, and no AI-generated content path — a large fraction of those phases' threat surface (forged webhooks, provider credential leakage, prompt injection, ambiguous provider timeouts) does not exist for B6 at all. This is stated explicitly rather than left to be inferred from an unusually short threat list: B6's entire external attack surface is the same authenticated, workspace-scoped API surface every other B0-governed domain has, with no additional external trust boundary.

## 3. Privacy

`Deal.title`/`description` are free-text, actor-authored fields that may incidentally contain PII (a contact's name in a deal title, for instance) — the same class of risk `B2_LEAD_AGGREGATE.md`'s free-tag fields already carry, mitigated identically: no B6 field is logged at raw value in structured logs beyond what `B6_OBSERVABILITY_AUDIT.md` §3 allow-lists, and access is gated by the same `deal.view` permission as every other Deal field.
