# WazLink Workspace, Authentication, and Authorization Architecture

> Design only. No authentication provider, Django project, endpoints, migrations, or secrets are implemented in B0.

## Tenancy

Workspace/Organization is the primary tenant. User identity is global; Membership connects a User to a Workspace with a role and status. Invitation is workspace-scoped and expires. The active workspace is selected from authenticated membership, never from an untrusted client-only identifier. Every tenant-owned table contains `workspace_id`; global catalogs such as Plans and Capabilities are explicitly global.

Workspace states are `active`, `suspended`, `archived`, and `deleting`. Suspension blocks writes and provider side effects while preserving authorized administrative access. Archive prevents normal access; deletion is an asynchronous, audited workflow with legal/financial retention exceptions. Switching workspace re-evaluates permission and entitlement context on every request.

## Phase 1 authentication choice

Use Django session authentication with secure HttpOnly SameSite cookies, email/password, email verification, password reset, session expiry, device/session revocation, and rate limiting. Unsafe requests require CSRF. OAuth and MFA are later phases; if added, they must preserve the internal User identity and membership model. JWT is not selected for the first server because browser sessions and revocation are simpler for the initial web product.

## Authorization layers

Every request passes authentication, workspace membership, role permission, object-level scope, entitlement, and state checks. A public ID lookup without workspace scope is invalid. Application services enforce the same rules independent of API views or future admin tools. Querysets are scoped before object lookup to avoid IDOR. Admin access is internal operational access, not a bypass of audit, tenant, or financial controls.

## Roles and security rules

Owner controls workspace lifecycle and ownership transfer. Admin manages members, settings, integrations, and Billing subject to policy. Manager manages team CRM and approved automation. Sales manages assigned CRM/conversations/deals. Member has limited operational access. Viewer is read-only. The detailed action matrix is in `BACKEND_AUTHORIZATION_MATRIX.md`; conditional permission always includes object scope, entitlement, quota, approval, and state.

## Frontend compatibility

The existing frontend workspace/session context remains a UI projection. A future adapter will obtain a server session and workspace summary through existing service boundaries without requiring route or domain rewrites. Client-provided workspace IDs, plan IDs, or capability query parameters are presentation inputs only and never security decisions.
