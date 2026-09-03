# B13 — Controlled Amendments

> Design only. Every genuine change to a frozen B0–B12 artifact must be recorded here, classified `ADDITIVE`, `COMPATIBLE_CLARIFICATION`, or `NON_ADDITIVE`, and never applied by B13 itself.

## 1. Result: zero amendments

**`CONTROLLED_AMENDMENT_COUNT = 0`.** B13 requires no change to any B0–B12 artifact. This is a deliberate architectural consequence, not an oversight: B13's mandate is to specify how the already-frozen contracts are secured and operated in production — session cookies, RBAC permissions, error codes, public-ID prefixes, rate-limit categories, retry classes, webhook verification rules, and the platform tables are all already fixed by B0–B12, and every B13 control in this pack (`B13_SECURITY_PRINCIPLES.md` through `B13_VERIFICATION_MATRIX.md`) operationalizes an existing clause rather than extending its shape.

## 2. What was checked and found not to require an amendment

| Candidate change | Why it was not needed |
|---|---|
| A new error code for a B13-specific failure | every B13 failure mode maps onto an already-frozen code (`FI-B0-18`, `FI-B12-11`) — e.g., a security-critical startup failure is an operational/process concern, not an API error code |
| A new permission code for platform-operations runbook actions | `integration.manage`, `platform.operations.view`/`.replay`, and every domain's own finance/tax/messaging permission (`FI-B12-03`, `FI-B9-02`, `FI-B10-02`) already cover every operator action this pack names |
| A new public-ID prefix for a B13-introduced record | B13 introduces no new persistent aggregate; every record it discusses (`DeadLetterRecord`, `PlatformReconciliationCase`, `audit_logs`) is already frozen by B12/B1 with its own identity scheme |
| A new `CONFLICT` reason value | no B13 control needed one; every fail-closed/fail-open behavior in `B13_CONFIGURATION_MANAGEMENT.md` §4 is a startup/process behavior, not an API conflict response |
| A new row in `BACKEND_RATE_LIMIT_POLICY.md` | the frozen table's "Webhooks — provider-specific burst protection" row already anticipates the ingress-rate control `B13_WEBHOOK_SECURITY.md` §3 operationalizes; no new category was needed |
| A new table in `BACKEND_DATA_MODEL.md` | B13 designs no new domain table; every platform table it relies on (`platform_dead_letters`, `platform_reconciliation_cases`, `integration_connections`) is already in `B12_DATA_MODEL.md` |
| A change to any state machine | B13 introduces no new lifecycle state anywhere |
| A change to the API/DTO contract | B13 adds no operation and no field; it constrains how existing operations are secured, not what they return |

## 3. Amendment classification counts

`ADDITIVE_AMENDMENT_COUNT = 0`. `COMPATIBLE_CLARIFICATION_COUNT = 0`. `NON_ADDITIVE_AMENDMENT_COUNT = 0`. No CTO-review blocker exists on this axis.

## 4. If a future pass finds a genuine gap

Should implementation (`B14`) discover that a B13 control genuinely requires a frozen-artifact change (for example, if a chosen secret-store product needs a schema addition beyond `*_REF` string columns), that change is filed as a controlled amendment against **this document**, following the identical additive-first discipline every prior phase used (B2 through B12), and is never silently absorbed into implementation without CTO approval.
