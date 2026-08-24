# FIX.2-C Browser Findings

## Inbox fresh load
URL: http://localhost:3000/#/inbox

The shared Wazlink shell, readable navigation, usage card, Inbox title, status counters, filters, and conversation list rendered successfully. No blank screen or visible runtime error was observed. The fresh list intentionally has no selected conversation, so the thread area prompts the user to select a conversation.

## Direct conversation route
URL: http://localhost:3000/#/inbox/CONV-3042

The selected conversation route rendered successfully. The message thread, WhatsApp demo disclosure, human composer, attachment control, send action, CRM context, Lead 360 action, linked deals, Copilot panel, evidence chain, and local-only disclosures were visible. No Promise values or external messaging UI appeared. The local Composer draft and Copilot insertion callback are now owned by Inbox React state.

## Copilot route
URL: http://localhost:3000/#/copilot

Copilot loaded with its local-only disclosure and no hidden conversation selected by default. It prompts the user to open Inbox, avoiding implicit global conversation identity.

## Agent route
URL: http://localhost:3000/#/agent

Agent loaded with local mode controls, policy table, proposal/failure log, and explicit forbidden actions. The interface states no autonomous send and no financial mutations. No runtime error was observed.

## Automation route
URL: http://localhost:3000/#/automation

Rules list, local filters, no-code builder strip, dry-run buttons, approval queue, and audit trace rendered successfully. The page disclosed local-only execution and no background scheduler or external sending.

## Tasks route
URL: http://localhost:3000/#/tasks

Task table rendered with local filter controls, owners, due dates, provenance, and completion actions. No runtime error or blank page was observed.

## Temporary modal-route issue during HMR

A query URL for `appointments?modal=create-appointment` initially produced a blank page and exposed a React hook-order warning in AppointmentModal. The modal hook was moved before the visibility guard in AppointmentModal and AutomationModal. After subsequent HMR, the local Vite process stayed HTTP 200 but the browser tab needed a clean server restart to clear the stale module graph; this is being revalidated from a fresh process.

Automation and Tasks rendered successfully before the HMR issue; Appointments rendered successfully before the query-modal route was opened.

## Clean-restart Dashboard
URL: http://localhost:3000/#/dashboard

Dashboard and shared AppShell rendered successfully from a fresh Vite process, including the journey banner, KPIs, pipeline metrics, quick actions, task/activity panels, and sidebar.

## Appointment creation modal
URL: http://localhost:3000/#/appointments?modal=create-appointment

The query-driven appointment modal now renders successfully after moving useModalDismiss before the visibility guard. The local form includes title, lead, owner, start/end, type, location, and local description fields, with cancel/create actions. No blank page was observed after clean restart.
