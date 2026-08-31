# B5 — Provider Configuration Model

> **B5 status:** Target design only. Preserves the desired admin flow — credentials → configuration check → connected → enable — that the frozen `INT-1002` fixture already gestures at (FB-28), without freezing Meta field names the external validation register (`B5-X-001…006`) has not yet confirmed.

## 1. Phase-1 tenancy decision — the load-bearing question

> **`B5-D-A012`: exactly one `ChannelBinding` per workspace in Phase 1. There is no shared/global WazLink WhatsApp number.**

The frozen frontend never demonstrates otherwise (`INT-1002` is a per-workspace-scoped integration row like every other integration fixture), and a shared number would be structurally incompatible with §`B5_CONVERSATION_MODEL.md` §3's `(workspace, channel, lead, phone)` identity — two different merchants messaging the same customer phone from the same WhatsApp number is not a WhatsApp-supported scenario in the first place (Meta's own model binds a phone number to one WABA). Multi-number-per-workspace (e.g. a large merchant with several storefront numbers) is explicitly **not** designed here — `B5-D-C002`, deferred, purely additive if a future phase needs it.

## 2. `ChannelBinding` fields

| Field | Type | Required | Secret | Notes |
|---|---|---|---|---|
| `workspace_id` | UUID FK | yes | no | one row per workspace, Phase 1 |
| `provider` | enum | yes | no | `whatsapp_cloud_api` — future-proofs the row for a second provider without a schema change |
| `waba_id` | text | yes | no | WhatsApp Business Account identifier (external fact, `B5-X-003`) |
| `phone_number_id` | text | yes | no | the Cloud API phone-number identifier — this, not the human phone number, is what a webhook and every send call key on |
| `display_phone_e164` | text | yes | no | the human-facing number, shown in the admin UI and used for `counterparty_phone_e164` disambiguation |
| `access_token_ref` | secret reference | yes | **yes** | never the raw token — a reference into the platform's secret store (`B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1) |
| `app_secret_ref` | secret reference | yes | **yes** | used only for webhook signature verification (`B5_WEBHOOK_SECURITY_MODEL.md` §3), never sent outbound |
| `webhook_verify_token_ref` | secret reference | yes | **yes** | used only for the `GET` verification handshake (`B5_WEBHOOK_SECURITY_MODEL.md` §2) |
| `status` | enum(5) | yes | no | `not_connected` \| `configuration_required` \| `checking` \| `connected` \| `error` |
| `enabled` | boolean | yes | no | operator-controlled kill switch, independent of `status` (§4) |
| `error_code`, `error_reason` | text, nullable | no | no | populated only when `status=error` |
| `configured_by_ref`, `configured_at` | `MEM-*`, timestamptz, nullable | no | no | |
| `last_checked_at` | timestamptz, nullable | no | no | last successful/attempted health check |

## 3. Configuration status lifecycle

| From | To | Trigger |
|---|---|---|
| — | `not_connected` | workspace created; no binding row yet, or an unconfigured placeholder |
| `not_connected` | `configuration_required` | an operator begins entering credentials but has not completed all required secrets |
| `configuration_required` | `checking` | all required secrets present; a health check is requested (§4) |
| `checking` | `connected` | health check succeeds |
| `checking` | `error` | health check fails; `error_code`/`error_reason` set |
| `connected`, `error` | `checking` | operator retries the check |
| `connected` | `configuration_required` | a secret is rotated/cleared (§5) |

## 4. Startup and runtime health check

A health check calls a low-cost, side-effect-free Meta endpoint (exact endpoint is `B5-X-001`-adjacent adapter detail — e.g. a phone-number metadata read) using the configured credentials, and verifies:

1. the access token is valid and has the required permission scope,
2. the `phone_number_id` resolves and belongs to the configured `waba_id`,
3. the token has not expired (`B5-X-004`).

Failure at any step yields `status=error` with a specific `error_code` (`invalid_token`, `token_expired`, `phone_number_mismatch`, `insufficient_scope`, `provider_unavailable`) — never a generic failure, mirroring `B4`'s discipline of specific-over-generic diagnostics. This check runs on-demand (operator-triggered "Configuration Check") and on a bounded periodic schedule (exact interval is Class B, `B5-D-B002`; the *existence* of a periodic check is Class A) (`B5_RECONCILIATION_OBSERVABILITY.md` §1) — never inline on every send, which would add avoidable latency and provider load to the hot path.

## 5. Misconfiguration and disabled-provider behavior

| Condition | Effect on send |
|---|---|
| `status != connected` | every `SendMessage`/`SendTemplateMessage` for that workspace is rejected at admission — `403 ENTITLEMENT_LOCKED`, `details.reason=provider_not_configured` — **before** any provider call, matching the entitlement-gate discipline of `B5_ENTITLEMENT_RBAC_TENANCY.md` §1 |
| `enabled = false` | rejected identically, `details.reason=provider_disabled` — an operator-controlled kill switch distinct from a health-check failure, for a deliberate pause (e.g. during credential rotation) without losing the last-known-good `status` |
| inbound webhook arrives while `status != connected` or `enabled = false` | still accepted and persisted (an inbound message is not the workspace's fault to reject) — but no automatic reply path exists to violate, and the Conversation/Message are created normally; `B5_RECONCILIATION_OBSERVABILITY.md` flags this as an anomaly worth operator attention |

## 6. Secret redaction

No `ChannelBinding` field marked **Secret** in §2 is ever returned by any B5 API response, logged, or included in any event payload — the API's `ProviderConfigurationStatus` DTO (`B5_API_DTO_CONTRACTS.md` §3) exposes only `status`, `enabled`, `display_phone_e164`, `waba_id`, `last_checked_at`, `error_code`/`error_reason`, and `configured_by_ref`/`configured_at`. Writing a secret is one-directional: the configuration-update operation accepts new secret values and never echoes them back, including on the same response.

## 7. Rotation

Rotating `access_token_ref` (or any other secret field) moves `status` back to `configuration_required` (§3) and requires a fresh health check before `connected` is re-reachable — a rotation is never assumed successful; it is verified exactly like initial configuration. The prior token reference is invalidated (not merely replaced) as part of the same operation, consistent with `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1's credential-leakage mitigation.

## 8. Multi-workspace implication, stated plainly

Every `ChannelBinding` row, every health check, every secret reference is `workspace_id`-scoped. There is no code path anywhere in this design that reads a `ChannelBinding` without a `workspace_id` in scope — this is the tenancy foundation `B5_ENTITLEMENT_RBAC_TENANCY.md` §5's cross-workspace attack analysis depends on.

## 9. The admin runbook

Full operational sequence (credentials → verification → enable → sandbox send → receive → observe → rotate → disable) is `B5_ADMIN_PROVIDER_RUNBOOK.md`, not repeated here.
