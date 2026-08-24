# getUiState Migration Audit — V2-S0-FIX.2-C

## Scope

This phase covers only Inbox, Conversations, Messages, Copilot, Agent, Automation, Tasks, and Appointments. Analytics, Settings, Product Entitlements, Backend, HTTP, scheduler, worker, and redesign are explicitly out of scope.

## Target inventory before FIX.2-C

| File / surface | Legacy field or accessor | Category | Target owner |
|---|---|---|---|
| `features/inbox/Inbox.tsx` | `inboxDrafts`, `inboxAttachment` | Composer/draft state | React local state |
| `features/inbox/Inbox.tsx` | `inboxFilters` | Local UI/filter state | React local state |
| `features/inbox/Inbox.tsx` | `selectedConversationId` | Route state | `#/inbox/:id` or canonical hash route |
| `features/inbox/Inbox.tsx` | `inboxContextOpen` | Local panel state | React local state |
| `features/automation/Automation.tsx` | `automationFilters` | Local UI/filter state | React local state |
| `features/automation/Automation.tsx` | `selectedAutomationId` | Route/selection state | hash/query state or local selection |
| `features/automation/Automation.tsx` | `automationModal` | Modal UI state | route/query state |
| `features/automation/AutomationModal.tsx` | `automationModal` | Modal UI state | route/query state |
| `features/automation/Tasks.tsx` | `taskFilters` | Local UI/filter state | React local state |
| `features/automation/Appointments.tsx` | `appointmentFilters` | Local UI/filter state | React local state |
| `features/automation/Appointments.tsx` | `appointmentModal` | Modal UI state | route/query state |
| `features/automation/AppointmentModal.tsx` | `appointmentModal` | Modal UI state | route/query state |
| `features/automation` | rules/runs/approvals | Domain/service data | typed automation service/read models |
| `features/intelligence` | Copilot tab, analysis, evidence, export | Local UI/composer state | feature-local React state and explicit service arguments |

## Required end state

Target runtime consumers must contain zero `getUiState`, `uiState`, `mockRecords`, `mockModel`, direct `domain/data.js`, and renamed mixed-state accessor usage. Domain records and mutations must remain behind stable typed services.

## Locked contracts

Conversation identity, read/unread behavior, retry semantics, human-only outbound sending, Copilot insert-only behavior, Agent proposal-versus-execution safety, automation idempotency and approval rules, `manual_only` semantics, task/appointment relationships, time validation, and overlap warnings must remain unchanged.

No Backend, HTTP, fetch, Axios, real WhatsApp API, real OpenAI API, scheduler, worker, cron, webhook, redesign, or new product feature is permitted in this phase.

## Prior completion retained

FIX.2-A remains complete for AppShell, Sidebar, Topbar, Session, Workspace, Theme, Login, and Onboarding. FIX.2-B remains complete for Discovery, Intelligence, CRM, Lead 360, Deals, and Pipeline. The present audit is additive and records the next target scope only.

## Verification requirements

The final phase must run TypeScript, production build, V2-S0, architecture, React shell, S8/S9, FIX.2-C-specific checks, forbidden-identifier scans, and browser smoke checks for Inbox, Copilot, Agent, Automation, Tasks, and Appointments. Commit and push are allowed only when the file-specific acceptance gates pass.
