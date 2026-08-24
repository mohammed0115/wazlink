# V2-S0-FIX.2-D Browser Findings

## Analytics — local fresh load

Route `http://localhost:3000/#/analytics` rendered successfully with the shared RTL shell, WazLink branding, navigation, six analytics tabs, filter controls, export/reset actions, KPI cards, attribution reconciliation, data-quality warnings, and acquisition funnel. KPI values rendered from the existing selectors, including recognized revenue 382,000 SAR and attributed revenue 382,000 SAR. No blank screen or visible runtime error occurred.

## Settings — local fresh load

Route `http://localhost:3000/#/settings` rendered successfully with the shared RTL shell, workspace governance rail, settings subsection controls, workspace identity form, timezone/currency/locale selectors, and local-save action. The page disclosed local/mock-only behavior and no external persistence. No blank screen or visible runtime error occurred.

Further checks for Integrations, Billing, and Checkout remain pending.

## Integrations — local fresh load

Route `http://localhost:3000/#/integrations` rendered successfully with integration cards for business maps, WhatsApp, email, Google Calendar, CRM import/export, AI provider, and Webhook. The page clearly disclosed mock/local-only behavior and no OAuth, API key, production connection, or Webhook. No blank screen or visible runtime error occurred.

## Billing — local fresh load

Route `http://localhost:3000/#/billing` rendered successfully with current subscription, usage meters, plan cards, invoices, payment method display, and local/mock-only billing disclosure. The page preserved the separation between subscription billing and customer RevenueEvent/AttributionTouchpoint truth. No blank screen or visible runtime error occurred.

Checkout query-route smoke remains pending.

