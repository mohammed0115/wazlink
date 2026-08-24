# V2-S0-FIX.2-H Prechange Type Audit

## Scope

This audit records the strict type-boundary state at the start of FIX.2-H on commit `36133cefd47601cae7759238b23593fdd2e98405`. The audit covers `client/src/services/data.ts`, `client/src/services/index.ts`, `client/src/services/contracts`, the legacy bridge, Feature consumers, shared shell, and `App.tsx`.

## Classification

| Finding | Location | Classification | Required action |
|---|---|---|---|
| `Record<string, any>` / `any[]` in public facade helpers | `client/src/services/data.ts` | A — Feature-facing contract | Replace with explicit DTOs or isolate below the boundary |
| Generic adapter intersection `Record<string, (...args: any[]) => any>` | `client/src/services/index.ts` | A — Feature-facing contract | Remove; enumerate every method in interfaces |
| `Record<string, unknown>` feature row aliases | `client/src/services/contracts/services.ts` | A — weak DTO substitute | Replace target reads with named DTO/read-model types |
| `unknown[]` on Task, Appointment, Automation, Settings, Integration contracts | `client/src/services/contracts/services.ts` | A — missing DTO substitute | Replace with named view/result types |
| Casts from bridge records into Feature DTOs | `client/src/services/index.ts` | B/A boundary leak | Add normalizers below the service boundary |
| `uiState` and `mockRecords` in composition root | `client/src/services/index.ts` | B — internal implementation | Keep internal; no Feature exposure |
| Bridge implementation uncertainty | `client/src/services/mock/legacyDataBridge.ts` | B — internal bridge | Keep contained and normalize before public return |
| `@services` imports in Features | `client/src/features/**/*.tsx` | A/C | Preserve presentation constants; migrate domain operations to typed services |
| Verifier checks | `scripts/verify-v2-s0-fix.mjs` | D — verifier-only | Add strict no-any, DTO, interface, and method-call gates |

## Before Counts

The prechange scan found the following classes of violations in target service/public-contract paths:

| Pattern | Before count/status |
|---|---|
| `any` in `client/src/services/index.ts` target adapter declarations | Present in 8 generic intersections |
| `any` in `client/src/services/data.ts` | Present, including `RecordRow` and `listBusinesses(): any[]` compatibility declarations |
| `any[]` | Present in public facade and/or inferred bridge-compatible declarations |
| `Record<string, any>` | Present in public facade |
| `Record<string, (...args: any[]) => any>` | Present in 8 target service declarations |
| `unknown[]` used as Feature DTO substitute | Present in Task, Appointment, Automation, Settings, Integration, and FeatureRow surfaces |
| `ReturnType` / `Parameters` legacy aliases | No primary target declaration found in the initial bounded scan |
| Implicit bridge-derived public return shapes | Present across several adapter methods and compatibility exports |

## Primary Prechange Conclusion

Runtime behavior was already stable. The blocking issue is contract purity: named service instances exist, but their public surfaces still permit arbitrary methods, generic `any`, broad row records, and bridge-inferred output shapes. FIX.2-H must remove those patterns without changing UI behavior or adding backend/network integrations.

## Non-Goals

This pass must not redesign UI, change Dashboard/Checkout/Billing behavior, add backend/API/database/auth, add fetch/Axios/GraphQL/OAuth, or change existing business rules.
