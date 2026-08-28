# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Roles

Phase 1 roles are Owner, Admin, Manager, Sales, Member, and Viewer. Roles are workspace memberships, not global labels. Owner is the sole role that can transfer ownership or delete a workspace. Admin manages workspace configuration and members but cannot bypass financial audit or tenant isolation.

## Action matrix

| Action | Owner | Admin | Manager | Sales | Member | Viewer | Conditions |
|---|---|---|---|---|---|---|---|
| Workspace settings | allow | allow | conditional | deny | deny | deny | same workspace |
| Invite/remove member | allow | allow | conditional | deny | deny | deny | invite permission; cannot remove last Owner |
| Change plan | allow | conditional | deny | deny | deny | deny | Billing permission and confirmed workspace |
| Manage payment | allow | conditional | deny | deny | deny | deny | provider flow; no raw card data |
| Run Discovery | allow | allow | allow | allow | conditional | deny | entitlement + quota |
| Export Discovery results | allow | allow | allow | conditional | conditional | deny | export permission + quota |
| Create/update Lead | allow | allow | allow | allow | conditional | deny | object workspace scope |
| Send message | allow | allow | allow | allow | conditional | deny | channel + entitlement + approval policy |
| Use AI | allow | allow | allow | conditional | conditional | deny | AI quota and data policy |
| Create/modify Deal | allow | allow | allow | allow | conditional | deny | assigned/team scope |
| Close Deal | allow | allow | allow | conditional | deny | deny | explicit confirmation; audit |
| Create Automation rule | allow | allow | allow | conditional | deny | deny | sensitive actions need approval |
| Approve Automation execution | allow | allow | allow | conditional | deny | deny | never self-approve where policy forbids |
| View Analytics | allow | allow | allow | allow | allow | conditional | workspace scope |
| Export CRM data | allow | allow | conditional | conditional | deny | deny | data export permission and audit |
| View Billing | allow | allow | deny | deny | deny | deny | billing permission |
| Manage integrations | allow | allow | conditional | deny | deny | deny | secret access never returned to client |

`conditional` means the role is eligible only after workspace scope, object scope, capability entitlement, quota, state, and approval checks pass. Deny responses do not disclose whether another workspace object exists.
