# B7 — Direct-Write Firewall

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Structural proof, not policy

B7's application-service layer holds **zero** repository/ORM write access to any table it does not itself own (`B7_DOMAIN_OWNERSHIP.md` §2's seven entities only). This is a build-time/module-boundary property, mirroring how `B6_DOMAIN_OWNERSHIP.md` §6 and `B5_DOMAIN_OWNERSHIP.md` proved the identical claim for their own domains: the Automation module imports only the *command-invocation* interface of B2/B5/B6's application services (`CreateTask(...)`, `SendMessage(...)`, `MoveDealStage(...)`, etc.), never their repository/model classes.

## 2. Per-domain proof table

| Domain | Tables B7 cannot write | How it's structurally prevented |
|---|---|---|
| B2 CRM | `leads`, `contacts`, `tasks`, `appointments`, `notes` | B7 calls exactly five B2 application-service methods (`CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`, `B7_ACTION_CATALOG.md` §2) — no `Lead`/`Contact`/`Note` repository is imported anywhere in the B7 module; `AddContact`/`UpdateContact`/`RemoveContact`/`AddNote`/`RemoveNote`/`ArchiveLead`/`AddLeadTag`/`RemoveLeadTag`/`UpdateTask`/`AssignTask`/`CompleteTask`/`CancelTask`/`RescheduleAppointment`/`CancelAppointment`/`CompleteAppointment`/`MarkAppointmentNoShow`/`ConvertBusinessToLead` are **not** on B2's automation-invocable list (`B2_COMMAND_EVENT_CATALOG.md` "Automation as actor" note) and B7 has no code path that calls them |
| B3 Discovery | `discovery_jobs`, `discovery_results`, `businesses` | B7 consumes zero B3 events (`B7_TRIGGER_CATALOG.md` §3) and invokes zero B3 commands — no B3 dependency exists in the B7 module at all |
| B4 Intelligence | `lead_intelligence_analyses`, `intelligence_runs`, `signals` | Same — zero B4 dependency; `B4_COMMAND_EVENT_CATALOG.md` names no automation-invocable command |
| B5 Messaging | `conversations`, `messages`, `message_deliveries` | B7 calls exactly `SendMessage`/`SendTemplateMessage`, through B5's unmodified admission sequence (`B5-D-A025`) — no `Conversation`/`Message` repository is imported |
| B6 Pipeline | `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions`, `deal_loss_reasons` | B7 calls exactly `MoveDealStage` (`B7_ACTION_CATALOG.md` §2) — `CreateDeal`/`UpdateDeal`/`CloseDealWon`/`CloseDealLost`/`ReopenDeal`/`AssignDeal` are not on B7's Phase-1 action catalog and no code path invokes them |
| future B8 Billing | `subscriptions`, `plans`, `invoices`, `payments` | B7 only ever performs a read-only entitlement-decision check (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4) against the frozen entitlement boundary — no B8 write dependency exists, and B8 does not exist yet to have one |
| future B9 Finance | `revenue_events`, `revenue_reversals`, `attribution_touchpoints` | `B7_REVENUE_FIREWALL.md` |

## 3. Negative controls

| ID | Scenario | Expected |
|---|---|---|
| `AT-DWF-1` **NC** | an implementation issuing `UPDATE leads SET ...` from any B7 code path | rejected at design review — no B7 code path has a `Lead` repository handle |
| `AT-DWF-2` **NC** | an implementation issuing `INSERT INTO messages ...` from any B7 code path, bypassing `SendMessage` | rejected — no `Message` repository handle exists in the B7 module; every send goes through `SendMessage`/`SendTemplateMessage` and B5's full admission sequence, consent/service-window/template checks included |
| `AT-DWF-3` **NC** | an implementation issuing `UPDATE deals SET stage_id = ...` directly, bypassing `MoveDealStage` | rejected — skips `B6_DEAL_STATE_MACHINE.md`'s guards and the `deal_stage_transitions` audit row; no `Deal` repository handle exists in the B7 module |
| `AT-DWF-4` **NC** | an implementation creating a `RevenueEvent` from any B7 action, trigger, or internal control action | rejected — `B7_REVENUE_FIREWALL.md` §2 |
| `AT-DWF-5` **NC** | an implementation marking a `Payment` row `succeeded` from a B7 action | rejected — no B8 write dependency exists in the B7 module (§2) |
| `AT-DWF-6` **NC** | an implementation directly setting a workspace's `entitlement` row to grant itself `automation.rules` | rejected — B7 only ever *reads* an entitlement decision (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4); it holds no write path to any entitlement/plan table |

`DIRECT_CRM_WRITE_LEAKS = 0`, `DIRECT_DISCOVERY_WRITE_LEAKS = 0`, `DIRECT_INTELLIGENCE_WRITE_LEAKS = 0`, `DIRECT_MESSAGING_WRITE_LEAKS = 0`, `DIRECT_PIPELINE_WRITE_LEAKS = 0`.
