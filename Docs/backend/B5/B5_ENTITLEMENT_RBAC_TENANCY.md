# B5 — Entitlement, RBAC, and Tenancy

> **B5 status:** Target design only. Reuses B1's authorization architecture and frozen B0's entitlement pattern. Provider credentials require materially stronger privilege than ordinary sending.

## 1. Permission codes

> **B5-FIX.1 correction:** the original B5 pass claimed *"Frozen `B1_AUTHORIZATION_RBAC.md` has no `conversation.*`/`messaging.*` code today... only `discovery.*`, `lead.*`... exist."* This was independently audited and found **false**. Direct inspection of frozen `B1_AUTHORIZATION_RBAC.md` §2 (permission catalog) and §3 (role matrix) shows it already defines **both** `conversation.view` and `message.send`, and both trace further back to frozen B0's own `BACKEND_AUTHORIZATION_MATRIX.md` (row 23, *"Send message | allow | allow | allow | allow | conditional | deny | channel + entitlement + approval policy"*). B2's own closed documentation independently confirms this lineage, calling `conversation.view` "B1-owned" (`B2_IMPLEMENTATION_READINESS.md` line 144) — it was never a B2-invented forward-reference for B5 to later "adopt as new," as the original pass claimed. This section is corrected below; see `B5_CONTROLLED_AMENDMENTS.md` item 4 and `B5_DECISION_REGISTER.md` `B5-D-A034` (revised) for the full reconciliation record.

**Frozen `B1_AUTHORIZATION_RBAC.md`'s existing rows, quoted exactly:**

| Permission | Frozen role matrix (owner/admin/manager/sales/member/viewer) | Frozen condition | Frozen source |
|---|---|---|---|
| `conversation.view` | A / A / A / A / A / **C** | — (unspecified in frozen B1; B5 introduces no new condition of its own) | `B1_AUTHORIZATION_RBAC.md` §2 ("Conversations"), §3 |
| `message.send` | A / A / A / A / **C** / **·** (deny) | `channel + entitlement + approval policy` | `B1_AUTHORIZATION_RBAC.md` §2 ("Messages"), §3; traces to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23 verbatim |

> **`B5-D-A034` (revised by B5-FIX.1): two permissions are REUSED verbatim from frozen B1 (`conversation.view`, `message.send`) with their existing role matrices unchanged; two are genuinely additive (`messaging.manage`, `messaging.provider.manage`).**

| Permission | Status | Covers |
|---|---|---|
| `conversation.view` | **REUSED — frozen B1, unchanged** | read Conversations/Messages, including what gates CRM-timeline messaging entries. B5 introduces no modification to the frozen matrix above — where `viewer` is only conditionally granted, B5 imposes no additional condition of its own and simply defers to whatever frozen B1's own (currently unstated) condition resolves to |
| `message.send` | **REUSED — frozen B1/B0, unchanged** | `SendMessage`, `SendTemplateMessage`, `CancelMessage` — this is the identical authority frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23 and B1's derived permission already name; B5 does **not** mint a second, differently-named permission (`messaging.send`) for the same authority |
| `messaging.manage` | **ADDITIVE — new** | `AssignConversation`, `ArchiveConversation` (close), `ReopenConversation`, template catalog viewing |
| `messaging.provider.manage` | **ADDITIVE — new** | `ChannelBinding` configuration, credential rotation, `SyncProviderTemplates` |

B5 does **not** name its view permission `messaging.view`, and does **not** name its send permission `messaging.send` — both would create a second, competing name for authority frozen B1 already grants under `conversation.view`/`message.send` respectively, which would force either an undeclared non-additive amendment or a permanent alias/ambiguity at implementation time. Reusing the frozen names verbatim is the only compatible choice, and is recorded as a correction, not silently as if it had always been the plan (`B5_CONTROLLED_AMENDMENTS.md` item 4).

| Permission | owner | admin | manager | sales | member | viewer | Condition |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `conversation.view` | A | A | A | A | A | **C** | frozen B1's own condition, unspecified — B5 adds none |
| `message.send` | A | A | A | A | **C** | **·** | frozen: `channel + entitlement + approval policy`; B5 operationalizes this as entitlement + consent + window + rate budget at admission (`B5_OUTBOUND_PIPELINE.md` §2) — a specification of the frozen condition, not a change to who is granted the permission |
| `messaging.manage` | A | A | A | C | · | · | manager+: assign/close/reopen any; sales: own-assigned only |
| `messaging.provider.manage` | A | A | · | · | · | · | admin+ only — credential handling is materially higher-trust than sending |

This mirrors B1's own established shape (Discovery's `discovery.run`/`discovery.view`, B4's `intelligence.run`/`intelligence.view`) while adding a **third** tier B4 did not need, because B5 introduces a genuinely new higher-privilege class of action (third-party credentials) that neither Discovery nor Intelligence has.

`NEW_PERMISSION_CODES = 2` (`messaging.manage`, `messaging.provider.manage`). `REUSED_PERMISSION_CODES = 2` (`conversation.view`, `message.send`). Recorded as `B5_CONTROLLED_AMENDMENTS.md` item 4 (`ADDITIVE` for the two new rows; `NO_CHANGE_REQUIRED` for the two reused permissions — no existing cell in frozen `B1_AUTHORIZATION_RBAC.md` changes).

## 2. Per-operation authorization

| Operation | Permission | Additional condition |
|---|---|---|
| `POST /conversations/{id}/messages` (send), `POST /conversations/{id}/messages/template` | `message.send` | consent, window policy, rate budget (`B5_OUTBOUND_PIPELINE.md` §2) |
| `POST /messages/{id}/cancel` | `message.send` | object scope — creator or `manager`+ |
| `POST /conversations/{id}/assign` | `messaging.manage` | manager+: any; sales: own-assigned only |
| `POST /conversations/{id}/archive`, `/reopen` | `messaging.manage` | |
| `GET /conversations`, `GET /conversations/{id}`, `GET /conversations/{id}/messages` | `conversation.view` | workspace scope |
| `GET /messaging/templates` | `conversation.view` | read-only catalog view is not credential-sensitive |
| `POST /messaging/templates/sync`, `GET/PUT /messaging/provider/configuration` | `messaging.provider.manage` | admin+ only |

## 3. Cancel object scope

Mirrors B3's/B4's identical cancel pattern: the actor who requested the send, or a `manager`+ role, may cancel it while `queued` (`B5_MESSAGE_STATE_MACHINE.md` §2 transition 10). A `sales` member cannot cancel a colleague's queued send.

## 4. Audit

| Action | Audited | Why |
|---|:--:|---|
| `messaging_sent`, `messaging_reanalyzed`(n/a)/`message_cancelled` | **yes** | a human caused provider spend or withdrew it |
| `conversation_assigned`, `conversation_closed`, `conversation_reopened` | **yes** | CRM-relevant workspace action |
| `provider_configuration_changed`, `credential_rotated` | **yes**, at elevated sensitivity — never logs the secret value itself | credential handling |
| inbound message receipt, webhook processing, automatic retry | **no** | machine execution of an already-audited or externally-caused event — traced and metered (`B5_RECONCILIATION_OBSERVABILITY.md`), not audited, mirroring B3/B4's identical exclusion of page-ingestion/signal-extraction from the audit log |
| operator access to `provider_request_id`/raw diagnostic surface | **yes** | mirrors `B4_OBSERVABILITY_RECONCILIATION.md` §3's identical operator-access audit requirement |

## 5. Entitlement — five independent gates, restated

> **`B5-D-A026`: `provider_configured`, `feature_entitled`, `quota_available`, `permission_granted`, `recipient_eligible` are five separate checks. No frontend flag or single boolean grants send authority.**

| Gate | Owner | Failure |
|---|---|---|
| `provider_configured` | `B5_PROVIDER_CONFIGURATION_MODEL.md` §5 | `403 ENTITLEMENT_LOCKED`, `provider_not_configured`/`provider_disabled` |
| `feature_entitled` | B8 (Entitlements, provisional until it closes — mirrors `B4_COST_RATE_LIMIT_MODEL.md` §10's identical framing) | `403 ENTITLEMENT_LOCKED` |
| `quota_available` | B8, provisional | `403 ENTITLEMENT_LOCKED` |
| `permission_granted` | `B1_AUTHORIZATION_RBAC.md` + §1 above | `403 PERMISSION_DENIED` |
| `recipient_eligible` | consent (`B5_CONSENT_COMMUNICATION_POLICY.md`) + window policy (`B5_CUSTOMER_SERVICE_WINDOW.md`) | `403 PERMISSION_DENIED`/`422 VALIDATION_ERROR`, distinguishable reasons |

No B5 field named `can_send`/`entitled` is ever returned to the frontend as a single flag the client is trusted to act on — every gate above is re-checked server-side on every admission (`B5_OUTBOUND_PIPELINE.md` §2), regardless of what a stale or forged client-side flag claims.

## 6. Tenancy

> **`B5-D-A012`'s companion: every B5 row is workspace-scoped directly.**

| Table | `workspace_id` | Justification |
|---|:--:|---|
| `conversations`, `messages`, `message_deliveries`, `conversation_participants` | **required** | tenant-owned |
| `message_media` | **required** (inherited from owning Message) | tenant-owned |
| `channel_bindings` | **required** | one per workspace, Phase 1 |
| `template_definitions`, `communication_consents`, `messaging_usage_records` | **required** | tenant-owned — unlike B4's global scoring catalogues, WhatsApp templates and consent are inherently per-WABA/per-workspace facts, not shared platform knowledge |

There is no B5 global/unscoped table analogous to B4's `signal_definitions` — every entity B5 owns is genuinely tenant-specific, so no exception list is needed here.

## 7. Cross-workspace isolation — the specific attacks this domain invites

> An identical phone number existing in two different workspaces, or two channel bindings sharing infrastructure, must produce **zero shared state.**

| Attack | Defence |
|---|---|
| Same phone number reused across a cache/lookup keyed only on phone, not `(workspace_id, channel, phone)` | every lookup key in `B5_CONVERSATION_MODEL.md` §3 and `B5_CONTACT_PHONE_RESOLUTION.md` §9 is workspace-composite — never phone alone (`B5-D-A031`) |
| Same provider `provider_message_id` colliding across two different `ChannelBinding`s | uniqueness is `(workspace_id, channel_binding_id, provider_message_id)`, never global (`B5-D-A032`) — two different WABAs can, in principle, echo overlapping provider-assigned IDs and must never be conflated |
| Cross-workspace webhook routing | structurally prevented by `B5_WEBHOOK_SECURITY_MODEL.md` §4 — resolution is a function of *which binding's secret verified*, not a claimed field |
| Cross-workspace template lookup | `TemplateDefinition.workspace_id` required; `GET /messaging/templates` is always workspace-scoped |
| Cross-workspace media access | delegated to B11's own access-controlled references (`B5_MEDIA_B11_HANDOFF.md` §4) |
| Cross-workspace conversation search | every search/filter in `B5_CONVERSATION_MODEL.md` §8 runs inside a `workspace_id` predicate applied first, never after |
| Cross-workspace cache of any kind (a provider-adapter-level response cache, if one is ever added) | **prohibited** by `B5-D-A028`/this section — recorded as considered and rejected (`B5-D-C006`, mirroring `B4-D-C006`'s identical pattern), not merely unconsidered |

`B5_ACCEPTANCE_TESTS.md` includes negative controls (`AT-TEN-*`) for each row above.
