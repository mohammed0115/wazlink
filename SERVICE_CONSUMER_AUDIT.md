# Service Consumer Audit — V2-S0-FIX.1

## Scope

This audit covers the frontend-only service-boundary migration. The legacy domain module remains the behavioral source of truth. No backend, HTTP, database, authentication, or production API integration was added.

| Feature | Previous leak | Final service path | Final local state decision | Verdict |
|---|---|---|---|---|
| Dashboard | Mixed state and raw collections | Dashboard selectors and `analyticsService` | UI and route context still use `getUiState()` | PARTIAL |
| Discovery / Jobs / Results | Mixed state and raw collections | Discovery/business functions and named selectors | Filters and selections still use compatibility state | PARTIAL |
| Intelligence | Mixed state and signal collection | Intelligence functions and `listSignals()` | Modal/processing state still uses compatibility state | PARTIAL |
| CRM / Lead 360 | Leads/users through raw store | Lead/business functions and named selectors | Entity selections and UI fields still use compatibility state | PARTIAL |
| Deals / Pipeline | Deals/users through raw store | Deal functions and named selectors | Filters and modal state still use compatibility state | PARTIAL |
| Inbox / Copilot | Conversations/users/templates through raw store | Conversation/message functions and named selectors | Draft/context state still uses compatibility state | PARTIAL |
| Agent | Mixed agent state | Agent functions | Mode/approval display state still uses compatibility state | PARTIAL |
| Automation | Automation collections and mixed state | Automation functions and catalog selectors | Filters/modal state still uses compatibility state | PARTIAL |
| Tasks / Appointments | Raw users/leads and mixed filters | Task/appointment functions and selectors | Filters still use compatibility state | PARTIAL |
| Analytics | Global analytics context | Analytics engine/selectors | Analytics filters still use compatibility state | PARTIAL |
| Settings / Integrations / Billing | Raw collections and mixed settings state | Settings/integration/billing functions and selectors | Form/detail state still uses compatibility state | PARTIAL |
| Shared Shell / App.tsx | Mixed workspace/route state | Composition root and shell helpers | Workspace/route context still uses compatibility state | PARTIAL |

## Before/after measurements

Before migration, Features imported a broad adapter exposing mutable legacy state and the complete mock model. After migration, the forbidden identifiers `uiState`, `mockRecords`, `mockModel`, and direct Feature-to-`domain/data.js` imports are absent from the scanned runtime Feature/Shared source. Named selectors and service facades exist, and the fix-specific static verifier reports **24/24**.

The remaining semantic leak is `getUiState()`: it is a controlled accessor name, but it still returns the mixed legacy state object. Therefore the strict requirement that Features must not know the internal shape of the legacy store is not yet met, and every row remains PARTIAL until those fields are moved to local React state, route parameters, or typed service methods.
