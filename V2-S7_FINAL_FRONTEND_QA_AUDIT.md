# V2-S7 Final Frontend QA Audit

## Baseline

The mandated baseline is `28f689635389f0741614c1d28e0f975d4e970051` on `main`, with `HEAD == origin/main` and a clean working tree. V2-S0 through V2-S6 are treated as closed inputs and are not reopened except for regression evidence.

## Mission

This audit evaluates whether the frontend is coherent, route-safe, RTL-safe, responsive, typed at closure-relevant boundaries, entitlement-safe, commercially truthful, journey-consistent, and ready to freeze before any backend work. The audit is QA-first; implementation changes are restricted to legitimate closure defects and must remain frontend-only.

## Source Evidence Reviewed

The canonical route switch is `client/src/App.tsx`; the canonical hash routing helper is `client/src/shared/router/useHashRoute.ts`; AppShell is `client/src/shared/shell/AppShell.tsx`; Landing is `client/src/features/landing/Landing.tsx`; Dashboard is `client/src/features/dashboard/Dashboard.tsx`; Analytics is `client/src/features/analytics/Analytics.tsx`; EntitlementService is `client/src/services/entitlementService.ts`; S6 upgrade projection is `client/src/services/upgradeProjection.ts`; Checkout is `client/src/features/settings/Checkout.tsx`; and local export behavior is `client/src/features/intelligence/export.ts`.

## Initial Defect Inventory

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| S7-001 | MAJOR | Public Landing / analytics truth | The live Landing preview and value strip render hardcoded counts, growth percentages, adoption numbers, and revenue-like claims without a canonical account scope or explicit illustrative-data boundary. | Fix minimally by replacing unsupported numeric claims with clearly illustrative, non-analytical copy and explicit preview disclosure. |
| S7-002 | MAJOR | Public Landing / deferred domain contract | Landing copy says the journey reaches first revenue and shows a Company → Lead → Conversation → Deal → Revenue flow, while Deal → customer RevenueEvent remains formally deferred. | Fix copy only: describe recognized revenue as a separate measured outcome and do not imply automatic Deal-to-Revenue continuity. |
| S7-003 | MINOR | Public Landing / action semantics | A public `أضف إلى CRM` CTA routes only to generic CRM and does not perform or preserve a selected Business context. | Fix copy to a truthful `استكشف CRM`/discovery CTA; no mutation or new route is required. |
| S7-004 | INFO | Existing scraper/CRM verifier | Legacy `verify-scraper-or-crm.mjs` has stale text predicates G/H/R against current implementation; selected-column export is source-correct in `export.ts`. | Do not change unrelated legacy verifier in S7; document as baseline technical debt unless closure verifier relies on it. |
| S7-005 | INFO | Existing type debt | Some pre-existing feature files use broad `Record<string, any>` adapters. | Do not perform broad type rewrite; distinguish from new S7 leakage. |
| S7-006 | INFO | Dependencies | Known baseline dependency vulnerabilities exist. | No dependency changes or automated remediation. |
| S7-007 | DEFERRED | Domain / backend | Deal → RevenueEvent, real persistence/auth/providers/payments/observability remain outside frontend scope. | Carry forward; do not implement. |

## Closure Assessment Before Remediation

The core authenticated app is service-backed and coherent across Dashboard, Discovery, Business/Lead, Lead 360, Inbox, Tasks/Appointments, Deals/Pipeline, Automation, Analytics, Billing, and Checkout. The principal closure blocker is the public Landing’s unsupported analytical/social-proof language and its implication that Won Deal automatically becomes customer revenue. Existing domain and service boundaries are otherwise preserved by the S6 baseline.

## Allowed Remediation

Only S7-001 through S7-003 may be corrected, using minimal Landing copy/preview changes and a final semantic verifier. No new product feature, domain entity, analytics formula, router, store, provider, backend, dependency, or deferred revenue contract may be added.
