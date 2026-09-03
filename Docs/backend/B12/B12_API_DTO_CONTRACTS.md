# B12 — API & DTO Contracts

> Design only. All paths are under the frozen `/api/v1/` base. Frozen `BACKEND_API_CATALOG.md` contains **no** integration or operations row, so all fourteen operations are additive under `B12-AM-003`. Provider webhook routes are deliberately **not** in this count.

## 1. Operations

| # | Method | Path | operationId | Permission | Request | Response | Status | Idem./async |
|---:|---|---|---|---|---|---|---|---|
| 1 | GET | `/integrations` | `listIntegrations` | `integration.manage` | — | `IntegrationList` | 200 | n/a/no |
| 2 | GET | `/integrations/{id}` | `getIntegration` | `integration.manage` | — | `Integration` | 200 | n/a/no |
| 3 | PUT | `/integrations/{id}/configuration` | `configureIntegration` | `integration.manage` | `IntegrationConfigurationUpdate` | `Integration` | 200 | yes/no |
| 4 | POST | `/integrations/{id}/configuration/check` | `checkIntegrationConfiguration` | `integration.manage` | — | `IntegrationCheckResult` | 200 | yes/no |
| 5 | POST | `/integrations/{id}/enable` | `enableIntegration` | `integration.manage` | `IntegrationToggleRequest` | `Integration` | 200 | yes/no |
| 6 | POST | `/integrations/{id}/disable` | `disableIntegration` | `integration.manage` | `IntegrationToggleRequest` | `Integration` | 200 | yes/no |
| 7 | GET | `/operations/dead-letters` | `listDeadLetters` | `platform.operations.view` | — | `DeadLetterList` | 200 | n/a/no |
| 8 | GET | `/operations/dead-letters/{id}` | `getDeadLetter` | `platform.operations.view` | — | `DeadLetter` | 200 | n/a/no |
| 9 | POST | `/operations/dead-letters/{id}/replay` | `replayDeadLetter` | `platform.operations.replay` | `ReplayRequest` | `DeadLetter` | 202 | yes/**yes** |
| 10 | POST | `/operations/dead-letters/{id}/abandon` | `abandonDeadLetter` | `platform.operations.replay` | `AbandonRequest` | `DeadLetter` | 200 | yes/no |
| 11 | GET | `/operations/integration-health` | `getIntegrationHealth` | `platform.operations.view` | — | `IntegrationHealthList` | 200 | n/a/no |
| 12 | GET | `/operations/reconciliation-cases` | `listReconciliationCases` | `platform.operations.view` | — | `ReconciliationCaseList` | 200 | n/a/no |
| 13 | GET | `/operations/reconciliation-cases/{id}` | `getReconciliationCase` | `platform.operations.view` | — | `ReconciliationCase` | 200 | n/a/no |
| 14 | POST | `/operations/reconciliation-cases/{id}/resolve` | `resolveReconciliationCase` | `platform.operations.replay` | `ResolveCaseRequest` | `ReconciliationCase` | 200 | yes/no |

`PUBLIC_API_OPERATION_COUNT = 14`. `ADDITIVE_API_OPERATION_COUNT = 14`.

**Four operations were added in B12-FIX.1** (10, 12, 13, 14) to close a real gap: `AbandonDeadLetter` and `ResolvePlatformReconciliationCase` were normative operator commands with permissions, idempotency keys, and preconditions, but **no invocation surface** — and `platform.operations.view` claimed to govern "reconciliation case reads" that no operation exposed. A command with no owner is either dead or a hidden endpoint; neither is acceptable. Every one of the fifteen commands is now surface-classified in `B12_COMMAND_EVENT_CATALOG.md` §1a. `UNOWNED_COMMANDS = 0`, `UNOWNED_OPERATOR_SURFACES = 0`.

**What was deliberately *not* added.** `RetryJob` and `RetryWebhook` get **no endpoint of any kind** — they are **system-only** (`B12-D-A053`), invoked by the transport retry path and the `P-4` receipt sweep respectively, and reachable by no human at any privilege level. `replayDeadLetter` (op 9) is the *only* human-initiated re-execution surface in this pack, so every such action passes through `replay_eligible` and the six re-checks of `B12_DEAD_LETTER_REPLAY_MODEL.md` §5. A bare "retry this" button would be a second, unguarded route to the same provider effect.

**No outbox, inbox, receipt, or execution mutation API exists.** In particular there is **no** endpoint that moves a `WebhookReceipt` out of a terminal state; a failed receipt is recovered through `replayDeadLetter` (op 9), which creates a new execution and leaves the receipt immutable (`B12-D-A050`). There is no `POST /operations/outbox/{id}/dispatch`, no receipt editor, no execution-state override. Those are internal substrate tables; exposing a mutation surface on them would let an operator forge the very evidence the design depends on. Reads of them are operational telemetry and belong to B13's surface, not to a workspace API. Negative control `AT-B12API-5`.

**No filtering or sorting markers are added.** Frozen `BACKEND_API_STANDARD.md` restricts `filters`/`sort` to `GET /deals` and `GET /billing/invoices`; the collection reads — operations 1, 7, 11, and 12 — expose **pagination only**, so the frozen allow-list is untouched.

## 2. Webhook routes — outside this catalog, by frozen rule

Frozen `BACKEND_API_CATALOG.md`: *"Provider webhooks are internal gateway routes and are not user-facing resource mutations"* and *"internal provider webhook routes remain outside this user-facing catalog."* Three routes exist (`B12_WEBHOOK_GATEWAY.md` §8) and none is counted above.

| Route | Auth | Response semantics |
|---|---|---|
| `GET /webhooks/whatsapp` | `hub.verify_token`, constant-time | echo `hub.challenge`, `200`; else `403` |
| `POST /webhooks/whatsapp` | `X-Hub-Signature-256` | `200` on verified/duplicate/malformed/unsupported; `401` invalid |
| `POST /webhooks/tap` | `hashstring` | same |
| `POST /webhooks/scraping` | provider-defined (`B12-D-B005`) | same |

## 3. Transport rules

Every `POST`/`PUT` above requires `Idempotency-Key` per frozen `BACKEND_IDEMPOTENCY_STANDARD.md`. Operations 3, 5, 6, and 10 additionally require `expected_version` and return `409 STALE_VERSION` on mismatch — the explicit-version-field option `BACKEND_API_STANDARD.md` permits, matching B8's, B10's and B11's choice. Every request DTO is `additionalProperties: false`; an unknown field is `400 VALIDATION_ERROR`.

## 4. DTOs — the redaction contract

**`Integration`**: `{ public_id (INT-*), provider, category, status, enabled, capabilities[], configured: boolean, configured_at, configured_by_ref, last_checked_at, last_check_outcome, error_code, error_reason, health{…§5}, version, created_at, updated_at }`.

> **`B12-D-A042`. A configuration read returns `configured: true|false` and nothing else about the credential. No value, no masked fragment, no prefix, no length, no last-four.**
>
> Frozen `B1_AUTHORIZATION_RBAC.md`'s own `integration.manage` row states the requirement in its condition cell: *"secret access never returned to client."* A masked fragment is explicitly rejected rather than treated as a safe compromise: it leaks entropy, it is routinely logged by clients that would never log a full secret, and it gives an attacker a confirmation oracle. The frozen frontend already models exactly this — `hasConfiguredSecret: false` with **no** value field anywhere (`FB-B12-003`). `SECRET_EXPOSURE_GAPS = 0` rests on this decision; negative control `AT-B12SEC-1`.

**`IntegrationConfigurationUpdate`**: `{ credentials: { <field>: string }, expected_version }` — write-only. The response **never** echoes what was written.

**`IntegrationCheckResult`**: `{ outcome (`passed`|`failed`|`unavailable`), checked_at, error_code, error_reason, capability_limitation }` — `unavailable` is the honest value where the provider offers no safe check (`B12_PROVIDER_CONFIGURATION_MODEL.md` §5).

**`DeadLetter`**: `{ public_id, workspace_ref, origin_kind, owning_domain, source_type, source_ref, failure_class, last_error_code, last_error_message (redacted), attempt_summary, replay_eligible, replay_reason (why not, when false), replay_count, state, created_at }` — **never** the raw payload, the provider response, or a credential.

**`ReplayRequest`**: `{ reason: string (required, non-empty) }` — a replay re-invokes a real provider effect, so it is reason-required exactly as `B10-D-A016` and `B11` require for privileged state changes.

**`AbandonRequest`**: `{ reason: string (required, non-empty), expected_version }` — `abandoned` is terminal and carries a **mandatory** reason (`B12_STATE_MACHINES.md` §5), matching `B10-D-A016`'s reason-required posture. Abandoning declares that no replay will be attempted, which is a decision a later reader must be able to audit.

**`ReconciliationCase`**: `{ public_id, workspace_ref (nullable), mismatch_class, subject_type, subject_ref, state, evidence_summary, detected_at, attempted_repair, resolved_by_ref, resolution_reason, next_review_at }` — `evidence_summary` carries observed-vs-expected classes and an opaque `provider_request_reference` only, **never** a raw payload, a provider URL, or a credential (`B12_RECONCILIATION_MODEL.md` §4).

**`ResolveCaseRequest`**: `{ resolution: "repaired" | "dismissed", reason: string (required when `dismissed`) }` — a `repaired` resolution runs the owning **domain's** own guarded command, which may refuse; a refusal leaves the case `open` and is not an API error (`B12-D-A039`, `AT-B12REC-5`).

**`IntegrationHealth`**: the six facts of `B12_INTEGRATION_HEALTH_MODEL.md` §1 plus `last_checked_at`, `last_success_at`, `last_failure_at`, `degraded_since` — never a provider host or raw message.

## 5. Status codes

Every operation declares `401`, `403`, `404` (where an id is in the path), `422` (where a body exists), and the universal `500`. `502 ProviderUnavailable` is declared on the three provider-dependent operations — **4** (`checkIntegrationConfiguration`, which calls the provider), **9** (`replayDeadLetter`, which may), and **14** (`resolveReconciliationCase`, whose `repaired` path may invoke a domain repair that reaches a provider) — and on no other, honoring `BACKEND_API_STANDARD.md`'s rule that `502` is *"provider translation only on provider-dependent operations."* Operations 1, 2, 3, 5, 6, 7, 8, 10, 11, 12, and 13 are local reads or metadata writes and declare none.

`409 CONFLICT` is declared on 5, 6, 9, 10, and 14, with `details.reason` from the extended closed set (`B12-AM-005`): `dead_letter_not_replayable` on 9, and `STALE_VERSION` on 3, 5, 6, and 10.

`429 RateLimited` is declared on operation 4, because a configuration check consumes provider quota and must not be a free unlimited button (`B12_PROVIDER_CONFIGURATION_MODEL.md` §5).

## 6. What is never returned

A credential value or fragment; a provider URL, bucket, endpoint, or host; a raw provider error message or status string; a webhook body or signature; another workspace's integration, dead letter, health record, reconciliation case, or receipt; a Celery task ID; an internal UUID where a public ID exists.
