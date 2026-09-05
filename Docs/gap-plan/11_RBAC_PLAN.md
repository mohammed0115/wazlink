# 11 — RBAC Plan

> Resolves brief §30. **Frozen permissions are reused wherever semantically correct. No frontend-only authorization exists anywhere in this plan.**

## 1. Reused frozen permissions (no change)

`lead.view|create|update|assign` · `business.view|convert` · `conversation.view` · `message.send` · `messaging.manage` · `messaging.provider.manage` · `deal.view|create|update|close` · `task.view|manage` · `appointment.view|manage` · `analytics.view` · `ai.use` · `file.upload|download` · `crm.export` · `settings.manage` · `workspace.*` · `member.*` · `billing.*` · `audit.view`.

**`ai.use` is the load-bearing reuse.** The AI agent (`GAP-014`) needs no new *usage* permission — a member who may use AI may use the agent. What it adds is `agent.manage` for *configuration*, which is a different power. This mirrors B12's own reasoning that reading and re-executing are different powers.

**`messaging.manage` is reused for takeover.** Assignment and takeover are the same class of authority over a conversation; minting `conversation.takeover` would add a permission that no role would ever hold separately.

## 2. New permissions

| Permission | Owner | Roles (O/A/M/S/V) | Why a new code is necessary |
|---|---|---|---|
| `customer.view` | customers | ✓/✓/✓/own/✓ | Customers are a new resource class; no frozen code covers them |
| `customer.create` | customers | ✓/✓/✓/✓/· | |
| `customer.update` | customers | ✓/✓/✓/own/· | |
| `customer.archive` | customers | ✓/✓/✓/·/· | Destructive-adjacent; manager+ |
| `customer.assign` | customers | ✓/✓/✓/·/· | Mirrors `lead.assign` |
| **`customer.merge`** | identity | ✓/✓/·/·/· | **Deliberately separate from `.update`** — merge rewrites references across B5/B6/B9; it is a higher-trust power, exactly as B12 separates replay from view |
| `contact.view` | B2 | ✓/✓/✓/✓/masked | **`B2-D-C007`'s stated trigger has fired**: a standalone address book now exists. Until now contacts had *"no independent management surface"*; N3 creates one |
| `contact.manage` | B2 | ✓/✓/✓/✓/· | Covers create/update/unlink outside a Lead context |
| `import.manage` | imports | ✓/✓/✓/·/· | Bulk write authority; must not follow from `lead.create` |
| `customfield.manage` | customfields | ✓/✓/·/·/· | Schema-shaping authority — admin-only |
| `assignment.manage` | assignment | ✓/✓/✓/·/· | Controls who receives work |
| `form.manage` | imports | ✓/✓/·/·/· | Creates a **public unauthenticated** surface — admin-only by risk |
| `ticket.view` | support | ✓/✓/✓/✓/✓ | |
| `ticket.create` | support | ✓/✓/✓/✓/· | |
| `ticket.update` | support | ✓/✓/✓/own/· | |
| `ticket.assign` | support | ✓/✓/✓/·/· | |
| `ticket.resolve` | support | ✓/✓/✓/own/· | |
| `knowledge.view` | knowledge | ✓/✓/✓/✓/✓ | |
| `knowledge.manage` | knowledge | ✓/✓/✓/·/· | Published articles ground AI answers — content authority is consequential |
| `product.manage` | catalog | ✓/✓/✓/·/· | |
| `quote.view` | quotes | ✓/✓/✓/✓/✓ | |
| `quote.create` / `quote.update` | quotes | ✓/✓/✓/✓/· | |
| `quote.send` | quotes | ✓/✓/✓/own/· | Customer-facing egress |
| **`quote.accept`** | quotes | ✓/✓/✓/·/· | Commercially consequential — deliberately **not** granted to Sales, mirroring how B6 gates `deal.close` above ordinary update |
| `agent.manage` | aiagent | ✓/✓/·/·/· | Configures what the AI may propose — and the provider/model configuration boundary (`PD-003`). Distinct from `ai.use`, which is merely permission to *use* AI |

**25 new permissions.** Roles are Owner/Admin/Manager/Sales/Viewer; `own` = own-assigned records only, the frozen conditional pattern B5 already uses for Sales.

## 3. Structural rules preserved

**No new role and no new rank.** B1's six roles and its rank ordering are untouched; every new permission is an additive row in the matrix, changing no existing cell — the same shape B5 used for `messaging.manage`.

**Every protected UI action maps to a backend permission.** The traceability matrix (`22_TRACEABILITY_MATRIX.md`) carries the mapping, and any screen action without one is a defect.

**`PD-002` APPROVED — Viewer receives masked contact phone and email; authorized operational roles receive full values. Masking is applied server-side, in the selector, before serialization** — the API never emits a full value the actor may not see, and frontend masking is never the security control. This also applies **before** any AI provider egress (`29_AI_PROVIDER_ARCHITECTURE.md` §5).

**No frontend-only authorization.** The frozen frontend performs *zero* client-side authorization enforcement (`B13_FRONTEND_EVIDENCE.md`), and this plan preserves that: navigation hiding is presentation; the API decides.

**Consequential commands require explicit permissions**: `customer.merge`, `quote.accept`, `customfield.manage`, `form.manage`, `import.manage` and `agent.manage` are each separated from the ordinary update permission of their resource, because each can affect data or surfaces beyond the record being edited.

**The AI agent holds no permissions of its own.** When a human accepts a proposal, the resulting command executes **as that human**, and their permission is checked by the owning domain's ordinary guard. There is no agent service account, no elevated path, and no bypass.

## 4. Entitlement (B8) interaction

Permission answers *may this actor*; entitlement answers *does this plan include it*. They compose in the frozen order — `ENTITLEMENT_LOCKED` fires before any quota check, which fires before the permission check reaches the resource (`B1_AUTHORIZATION_RBAC.md`). New capability keys are proposed in `PD-004`; **no new key is assumed by any permission above**, so an unresolved `PD-004` blocks packaging, not authorization design.
