# WazLink Backend Rollout and Migration Plan

> Planning only. No backend deployment, frontend modification, migration, provider connection, or secrets are authorized in B0.

## Entry gate

Backend implementation starts only after explicit Product Owner GO, approval of the B0 document index, resolution of product/legal/provider decisions, and a security review. The frozen frontend reference remains `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`; local/mock service boundaries are replaced by transport adapters rather than rewriting feature ownership.

## Staged rollout

1. **Architecture freeze:** approve ownership, IDs, state machines, API/DTO, ERD, security, and integration contracts.
2. **Foundation:** create Django project, environment isolation, accounts/workspaces, request correlation, health, and test harness.
3. **Read path:** implement authenticated workspace-scoped reads and replace one frontend service adapter at a time behind existing typed contracts.
4. **Core acquisition:** Discovery, Business, CRM conversion, Lead 360, Tasks/Appointments, and audit.
5. **Communication and sales:** Messaging, Pipeline, Automation approval, and provider sandbox adapters.
6. **Analytics/outcome:** canonical analytics reads, explicit RevenueEvent, Attribution, and reconciliation.
7. **Billing/tax:** Subscription, Tap sandbox, webhook inbox, reconciliation, invoices, and ZATCA validation.
8. **Production readiness:** load/security/restore/provider contract tests, staged workspace allowlist, canary, monitoring, rollback drill, and formal go-live approval.

## Data migration principles

Import existing frontend/mock data only as a labeled seed or fixture; do not treat demo IDs as production database keys. Map `BUS-*`, `LEAD-*`, `CONV-*`, `DEAL-*`, and related references into immutable public IDs with generated internal UUIDv7 IDs. Preserve provenance and distinguish demo data from customer-owned data. Migration is additive and reversible until validation; financial/tax/audit records require reconciliation before cutover.

## Compatibility and rollback

Feature services remain the seams. A backend adapter may be selected by environment/feature flag per workspace, while the local adapter remains available for rollback until the server path is proven. Rollback disables the server adapter without deleting data. Provider callbacks, payment records, and outbox processing require replay-safe migration state. No plan/entitlement or RevenueEvent state is inferred from frontend query parameters or display snapshots.

## Go-live blockers

Do not launch with unresolved cross-workspace access, payment webhook ambiguity, untested idempotency, unvalidated ZATCA contract, missing backup restore test, provider secrets in source, unbounded retries, unmonitored dead letters, or a mismatch between `DealWon` and RevenueEvent semantics.
