# V2 Frontend Structure

## Current structure

```text
client/
  index.html                 # single HTML mount
  src/
    App.tsx                  # app composition and canonical route dispatch
    main.tsx                 # single React root
    config/
      env.ts                 # centralized public Vite config
    domain/
      data.js                # retained V1 mock/domain implementation
      types.ts               # canonical domain contracts and IDs
      *.js                   # deterministic domain engines retained by V1
    features/
      ai/
      analytics/
      auth/
      automation/
      crm/
      dashboard/
      discovery/
      inbox/
      intelligence/
      landing/
      sales/
      settings/
      ui-kit/
    services/
      data.ts                # feature-facing mock data adapter
      contracts/
        repositories.ts      # future repository contracts, no HTTP
    shared/
      components/            # ErrorBoundary, States, PageHead, Placeholder
      lib/                   # formatting helpers
      router/                # one Hash Router implementation
      shell/                 # AppShell, Sidebar, Topbar, route metadata
      store/                 # current state bridge and toast provider
    styles/                  # one CSS entry plus legacy-compatible sheets
```

## Ownership rules

Features own their screen-specific components and interaction flows. Shared shell owns navigation chrome only. Shared components must not import feature internals. Domain code owns deterministic calculations and mutation rules, while `services` owns the feature-facing data access boundary. The UI must import mock records through `services/data.ts`, never directly from `domain/data.js`.

The current mock adapter is intentionally thin. This is a migration seam, not a new business abstraction: all V1 data and behavior remain in place until a later phase provides an approved API implementation.

## Naming and migration rules

New domain types belong in [`client/src/domain/types.ts`](client/src/domain/types.ts). New cross-feature data access belongs behind [`client/src/services/data.ts`](client/src/services/data.ts). New environment reads belong in [`client/src/config/env.ts`](client/src/config/env.ts). A feature may use local state for UI concerns, but domain state must not be duplicated in page components.

Large feature files are not split mechanically in S0. Splitting is justified only when a section has a coherent responsibility, a separately testable behavior, or a reusable boundary. Existing large files are therefore recorded as technical debt rather than riskily rewritten.
