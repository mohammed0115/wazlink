# getUiState Migration Audit — V2-S0-FIX.2

## Scope

This inventory records every remaining runtime `getUiState()` usage in `client/src/features`, `client/src/shared`, and `client/src/App.tsx` before the FIX.2 migration. The field is a mixed legacy object and must be eliminated from Feature/shared/App runtime code rather than renamed.

| Field | Measured occurrences | Category | Target boundary |
|---|---:|---|---|
| `s11Ui` | 21 | A Local UI state | Settings local state / feature hook |
| `scraperCrmUi` | 13 | A Local UI state | Discovery local state / feature hook |
| `analyticsUi` | 11 | A Local UI state | Analytics local typed state |
| `selectedBusinessId` | 8 | B Route state / C domain entity | Hash route or feature selection |
| `discoveryDraft` | 8 | A Local UI state | Discovery local state |
| `selectedLeadId` | 7 | B Route state / C domain entity | CRM route parameter |
| `selectedJobId` | 7 | B Route state / C domain entity | Discovery job route parameter |
| `workspace` | 6 | E Workspace/user context | Explicit WorkspaceContext/service |
| `selectedDealId` | 6 | B Route state / C domain entity | Deal route parameter |
| `dashboardView` | 6 | A Local UI state | Dashboard local state |
| `analyticsContext` | 6 | D Derived domain metric / A UI filter | Analytics typed filter DTO |
| `agentMode` | 6 | A Local UI state / C domain behavior | Agent local state or typed agent service |
| `selectedConversationId` | 5 | B Route state / C domain entity | Inbox route parameter |
| `onboardingErrors` | 5 | A Local UI state | Onboarding local state |
| `copilotTab` | 5 | A Local UI state | Copilot local state |
| `inboxContextOpen` | 4 | A Local UI state | Inbox local state |
| `dashboardTimeframe` | 4 | A Local UI state / D derived metric filter | Dashboard local typed state |
| `crmView` | 4 | A Local UI state | CRM local state |
| `automationFilters` | 4 | A Local UI state | Automation local typed state |
| `theme` | 3 | E Workspace/session preference | Explicit theme hook/context |
| `sidebarCollapsed` | 3 | A Local UI state | AppShell local state |
| `resultFilters` | 3 | A Local UI state | Results local typed state |
| `onboardingStep` | 3 | A Local UI state | Onboarding local state |
| `discoveryListFilters` | 3 | A Local UI state | Discovery local typed state |
| `dealFilters` | 3 | A Local UI state | Deals local typed state |
| `crmFilters` | 3 | A Local UI state | CRM local typed state |
| `taskFilters` | 2 | A Local UI state | Tasks local typed state |
| `signedIn` | 2 | E Workspace/session context | Explicit session context |
| `selectedAutomationId` | 2 | B Route state / C domain entity | Automation route/local selection |
| `onboardingDone` | 2 | E Workspace/session context | Explicit onboarding/session context |
| `loginErrors` | 2 | A Local UI state | Login local state |
| `inboxFilters` | 2 | A Local UI state | Inbox local typed state |
| `appointmentFilters` | 2 | A Local UI state | Appointments local typed state |
| `selectedResultIds` | 1 | A Local UI state | Results local selection state |
| `selectedLeadIds` | 1 | A Local UI state | CRM local selection state |
| `notifications` | 1 | E Workspace/session context | Explicit notification service/context |
| `intelligenceProcessing` | 1 | A Local UI state | Intelligence local processing state |
| `intelligenceModal` | 1 | A Local UI state | Intelligence local modal state |
| `inboxDrafts` | 1 | A Local UI state | Inbox local composer state |
| `inboxAttachment` | 1 | A Local UI state | Inbox local composer state |
| `discoveryModal` | 1 | A Local UI state | Discovery local modal state |
| `dealModal` | 1 | A Local UI state | Deal local modal state |
| `crmModal` | 1 | A Local UI state | CRM local modal state |
| `automationModal` | 1 | A Local UI state | Automation local modal state |
| `appointmentModal` | 1 | A Local UI state | Appointment local modal state |

## Migration rule

No field may remain reachable through a mixed object accessor. Local UI fields move to React state or feature hooks; navigational IDs move to hash/route parsing; entity data and derived metrics move to typed services/selectors; workspace/session values move to one explicit context boundary.

## V2-S0-FIX.2-A completion

| Field | Old owner | New owner | New API | Verdict |
|---|---|---|---|---|
| `workspace` | mixed `getUiState().workspace` | `WorkspaceProvider` | `useWorkspace().workspace`, `updateWorkspace()` | PASS |
| `signedIn` | mixed `getUiState().signedIn` | `SessionProvider` | `useSession().signedIn`, `signInMock()`, `signOutMock()` | PASS |
| `theme` | mixed `getUiState().theme` | `ThemeProvider` | `useTheme().theme`, `setTheme()`, `toggleTheme()` | PASS |
| `sidebarCollapsed` | mixed global state | `AppShell` local React state | `collapsed` and `onToggleCollapsed` props | PASS |
| `onboardingStep` | mixed global state | `Onboarding` local React state | `useState()` inside `Onboarding` | PASS |
| `onboardingDone` | mixed global state | `SessionProvider` lifecycle state | `useSession().onboardingDone`, `completeOnboarding()` | PASS |
| `onboardingErrors` | mixed global state | `Onboarding` local React state | local `errors` state | PASS |
| `loginErrors` | mixed global state | `Login` local React state | local `errors` state | PASS |
| `notifications` | mixed global state | explicit notification service | `notificationService.unreadCount()` | PASS |

Targeted runtime count after migration: `App.tsx = 0`, `client/src/shared/shell = 0`, `client/src/features/auth = 0`.

Global count remains for later FIX.2-B feature migrations and is intentionally not a gate in this phase.
