# Feature Service Matrix — V2-S0-FIX.1

| Feature | Previous leak | Final service / selector path | Final local-state decision | Direct `domain/data.js` | Strict verdict |
|---|---|---|---|---:|---|
| Landing | broad adapter | Landing selectors and composition root | No mixed state access | NO | PASS |
| Dashboard | `uiState`, mixed dashboard state | `analyticsService`, dashboard selectors | Compatibility accessor remains | NO | PARTIAL |
| Discovery / Jobs / Results | `uiState`, raw result collections | Discovery functions, business selectors, named list selectors | Route/filter state remains compatibility-backed | NO | PARTIAL |
| Intelligence | `uiState`, signals collection | Intelligence functions, `listSignals()` | Processing/modal state remains compatibility-backed | NO | PARTIAL |
| CRM / Lead 360 | `uiState`, leads/users collections | Lead/business functions, `listLeads()`, `listUsers()` | Entity selection remains compatibility-backed | NO | PARTIAL |
| Deals / Pipeline | `uiState`, deals/users collections | Deal functions, `listDeals()`, `listUsers()` | Filters/modal selection remain compatibility-backed | NO | PARTIAL |
| Inbox / Copilot | `uiState`, conversation/users/templates collections | Conversation/message functions, named selectors | Draft/context state remains compatibility-backed | NO | PARTIAL |
| Agent | `uiState` | Agent functions and service root | Agent mode remains compatibility-backed | NO | PARTIAL |
| Automation | `uiState`, automation collections | Automation functions and automation catalog selectors | Filters/modal state remains compatibility-backed | NO | PARTIAL |
| Tasks / Appointments | `uiState`, users/leads collections | Task/appointment functions, named selectors | Filters remain compatibility-backed | NO | PARTIAL |
| Analytics | `uiState` analytics context | Analytics engine and selectors | Filters remain compatibility-backed | NO | PARTIAL |
| Settings / Integrations / Billing | `uiState`, raw plan/integration collections | Settings/integration/billing functions and named selectors | Form/detail state remains compatibility-backed | NO | PARTIAL |
| Shared Shell / App.tsx | mixed legacy state | local shell helpers plus composition root | Workspace/route context still compatibility-backed | NO | PARTIAL |

## Acceptance

The static identifier and composition checks pass **24/24**, but strict semantic acceptance remains **FAILED** because `getUiState()` still exposes the mixed legacy state shape to many consumers. No PARTIAL row may be accepted for CTO sign-off.
