# B7 — B2 (CRM) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 consumes from B2

Seven trigger-eligible events (`LeadCreated`, `LeadStatusChanged`, `LeadPriorityChanged`, `LeadOwnerChanged`, `TaskCreated`, `TaskCompleted`, `AppointmentCreated`), plus two added by controlled amendment (`AppointmentCompleted`, `AppointmentNoShowRecorded` — `B7_CONTROLLED_AMENDMENTS.md` `B7-AM-002`). Condition fields: `lead.status`, `lead.priority`, `lead.owner_ref`, `task.status`, `appointment.status` — all sourced from B2's own frozen event/DTO shapes, never a wider traversal (`B7_CONDITION_ENGINE.md` §6).

## 2. What B7 invokes on B2

Exactly five commands, all already named by B2's own frozen "Automation as actor" note: `CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner` — through B2's unmodified admission sequence, with `actor_type='system:automation'`, `actor_label='automation_run:RUN-*'` (`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §1).

## 3. What B7 never does

Never writes `leads`/`contacts`/`tasks`/`appointments`/`notes` directly. Never invokes `AddContact`/`UpdateContact`/`RemoveContact`/`ArchiveLead`/`AddLeadTag`/`RemoveLeadTag`/`UpdateTask`/`AssignTask`/`CompleteTask`/`CancelTask`/`RescheduleAppointment`/`CancelAppointment`/`CompleteAppointment`/`MarkAppointmentNoShow`/`ConvertBusinessToLead`/`AddNote`/`RemoveNote` — none of these is on B2's automation-invocable list, and B7 has no code path that calls them. Never mutates `Lead.status`/`Lead.priority` outside `ChangeLeadStatus`/`ChangeLeadPriority` themselves.

## 4. Provenance

B2-owned `tasks`/`appointments` rows carry a nullable `created_by_automation_run_id`-shaped backreference (evidenced FB-A34) — B2's column, B2's migration; B7 only ever supplies the `RUN-*` value at `CreateTask`/`ScheduleAppointment` invocation time.

## 5. Negative controls

`AT-B2CRM-1` **(NC)**: an implementation invoking `AddContact`/`UpdateContact`/`ArchiveLead` from a B7 action — fails; not on the closed action catalog (`B7_ACTION_CATALOG.md` §1). `AT-B2CRM-2` **(NC)**: an implementation deriving `workspace_id` for a `LeadCreated`-triggered run from the event payload's Lead content rather than the envelope — fails (`B7_ENTITLEMENT_RBAC_TENANCY.md` §3).
