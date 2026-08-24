# WazLink Final Feature Service Matrix — V2-S0-FIX.2-E

All runtime Feature/shared/App rows are **PASS**. No row is PARTIAL. UI state is local React state or route/hash/query state; domain reads and mutations cross explicit service/selector boundaries.

| Feature | UI state owner | Route owner | Services/selectors | Verdict |
|---|---|---|---|---|
| Landing | local component state | hash route | business/discovery services | PASS |
| Dashboard | Dashboard local state | hash/query | analyticsService, automation/inbox selectors | PASS |
| Discovery | local draft/filter state | hash/query | business/discovery services | PASS |
| Jobs | local filters | hash/query | discovery service | PASS |
| Results | local selection/export state | hash/query | discovery/analytics services | PASS |
| Intelligence | local mode/processing state | hash/query | intelligence/analytics services | PASS |
| CRM | local filters/view state | hash/query | leadService/business service | PASS |
| Lead 360 | local view state | hash route | lead/deal/conversation services | PASS |
| Deals | local filters | hash/query | dealService | PASS |
| Pipeline | local interaction state | hash/query | deal/pipeline selectors | PASS |
| Inbox | local composer/filter/context state | hash/query | conversationService/messageService | PASS |
| Copilot | local tab/mode state | explicit conversation route | conversation/message services | PASS |
| Agent | local mode state | route context | explicit agent/approval boundaries | PASS |
| Automation | local filters/modal state | hash/query | automation service | PASS |
| Tasks | local filters | route context | task service | PASS |
| Appointments | local filters/modal state | hash/query | appointment service | PASS |
| Analytics | local filters/drilldown state | hash/query | analyticsService/read selectors | PASS |
| Settings | local subsection/form state | canonical settings routes | settings/workspace services | PASS |
| Integrations | local selection/config state | settings/integrations | integrationService | PASS |
| Billing | local plan/preview/confirmation state | settings/billing | billingService | PASS |
| Checkout | local invoice/payment/review/result state | settings/billing/checkout | typed BillingService + internal mock bridge | PASS |
| Shared Shell/App | AppShell local drawer; providers own session/workspace/theme | hash router | session/workspace/theme/notification services | PASS |

## Final status

`getUiState`, `uiState`, `mockRecords`, and `mockModel` are absent from runtime Feature/shared/App consumers. The only direct legacy domain importer is the internal controlled bridge. Checkout supports direct fresh-load initialization through a local mock session, and the public service facade does not expose the legacy bridge. No Backend or production integration is included.
