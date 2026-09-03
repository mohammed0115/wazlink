# B12 — Provider Configuration Model

> Design only. Generalizes the pattern frozen `B5_PROVIDER_CONFIGURATION_MODEL.md` established for messaging, grounded in the frozen frontend's real integrations catalogue (`B12_FRONTEND_BEHAVIOR_INVENTORY.md`).

## 1. Target operator experience

The frozen frontend already ships the shape (`FB-B12-001`…`004`): a catalogue of integrations, each with a status, a category, a capability list, a `hasConfiguredSecret` flag, a `lastCheckedAt`, an error code/reason pair, and an activity log. B12's backend contract is the honest realization of that surface:

```
Credentials  →  Configuration Check  →  Connected  →  Enable
```

Each arrow is a separate, permissioned, audited command. Collapsing them — in particular, treating "credentials saved" as "connected" — is what makes an integration silently broken until a customer notices.

## 2. `IntegrationConnection`

One row per `(workspace_id, provider)` (or per global provider where the credential is platform-level, §6). Public ID `INT-*` (`B12-AM-010`), matching the identifier the frozen frontend already uses.

| Field | Notes |
|---|---|
| `public_id` | `INT-*` |
| `workspace_id` | nullable **only** for a global-scope provider (§6) |
| `provider` | closed enum |
| `category` | `business_sources` \| `messaging` \| `ai` \| `payments` \| `storage` \| `tax` — **frontend-informed where the surfaces overlap, backend-required elsewhere.** Three values (`business_sources`, `messaging`, `ai`) are the shipped fixture's own (`FB-B12-001`); three (`payments`, `storage`, `tax`) exist because Tap, storage, and `TaxProvider` are frozen Phase-1 ports with no frontend row. Three fixture values (`calendar`, `crm`, `developer`) are **not** adopted, because `B12-D-B010`/`B12-D-B011` register no backend connection for them |
| `status` | 5 states, §3 |
| `credential_refs` | **references only**, never values (`B12_SECURITY_PRIVACY.md` §2) |
| `capabilities` | the resolved capability map (`B12_PROVIDER_CAPABILITY_MODEL.md` §2) |
| `enabled` | boolean, **independent of `status`** — §4 |
| `configured_at`, `configured_by_membership_id` | provenance |
| `last_checked_at`, `last_check_outcome` | health evidence, §5 |
| `error_code`, `error_reason` | safe, redacted, operator-facing |
| `version` | optimistic concurrency |

## 3. Status — four states, answering one question

`not_connected → configuration_required → connected`, with `error` reachable and `connected → configuration_required` on a material change (machine 4, `B12_STATE_MACHINES.md` §4). The machine answers **"is this integration's configuration currently known-good?"** and nothing else.

Two frontend statuses are deliberately **not** backend states:

- **`mock_connected`** is a fixture artifact (`FB-B12-002`); promoting a mock status into the durable model would be exactly the "relational fixture shape alone does not justify a persistent resource" error `BACKEND_PUBLIC_ID_REGISTRY.md` §B warns against.
- **`disabled`** is not a status at all — it is the orthogonal `enabled = false` boolean (§4, `B12-D-A052`). Carrying it as *both* would give one fact two homes and, in the earlier draft, produced a status no command could reach. The frontend renders its `disabled` label from `enabled`.

## 4. `status` and `enabled` are orthogonal — deliberately

> **`B12-D-A034`. Connection health and operator intent are two different facts and are stored separately.**

A single `connected: true` boolean cannot express "credentials are valid but the operator has paused this integration," nor "the operator wants this on but the token expired." Both are ordinary states:

| `status` | `enabled` | Meaning | Outbound | Inbound webhooks |
|---|:--:|---|:--:|:--:|
| `connected` | true | normal — **the only combination that admits new outbound work** | yes | accepted |
| `connected` | false | operator paused | **no** — new work fails fast, `409 CONFLICT` · `provider_disabled` | **accepted** (`B12_WEBHOOK_GATEWAY.md` §6) |
| `error` | true | credential/health failure | **no** — `409 CONFLICT` · `provider_not_configured` | accepted |
| `error` | false | broken *and* paused | no | accepted |
| `configuration_required` | any | incomplete, or freshly rotated and not yet re-checked (§7) | **no** — `409 CONFLICT` · `provider_not_configured` | accepted if a prior binding still verifies |
| `not_connected` | any | never configured | no | no binding exists to verify against |

> **Admission rule, stated once.** New outbound work requires `status = connected` **and** `enabled = true`. Neither implies the other, and neither is inferred from the other. "Administratively off" is `enabled = false` — there is no fifth status for it (`B12-D-A052`).

Frozen `B5_ADMIN_PROVIDER_RUNBOOK.md` already models the pause this way: *"`enabled → false` — an immediate, reversible pause. In-flight `queued`/`submitted` sends are not silently dropped."*

## 5. Configuration check — safe by construction

> **`B12-D-A035`. A configuration check never produces a real customer-visible side effect. It never sends a message, creates a charge, uploads an object, or spends a business quota.**

| Provider | Safe check | Evidence |
|---|---|---|
| Meta | read the configured phone number / WABA metadata; confirm the token authorizes it | frozen `B5_PROVIDER_CONFIGURATION_MODEL.md` §4 already specifies exactly this (*"token validity, phone-number/WABA match, scope"*) |
| Tap | a read-only lookup on the merchant/customer object | `retrieve`-class call; `B12-X-006`-adjacent |
| Places | a minimal, cost-bounded read | counts against the project's QPM quota (`B12-X-009`) — the check is rate-limited so a check button cannot exhaust it |
| AI Gateway | a models/metadata read where available | `unknown` (`B12-X-013`) |
| Storage | `stat_object` on a namespace probe key | side-effect-free by the frozen port contract |
| ZATCA | **none designed** — B10 is dormant | `B12-D-B006` |

> **`B12-D-A054`. An integration whose webhook verification scheme is unknown or unimplemented cannot become `connected`, therefore cannot be `enabled`, and therefore admits no outbound work — and any inbound callback on its route fails verification and is never processed.** This is the fail-closed invariant for the scraping provider (`B12-D-B005`) stated in one sentence rather than left to be derived: it follows from `B12-D-A027` (no verify-later path, on every route) plus transition 2 of machine 4 (`connected` requires a *passed* safe check). Nothing in this pack admits "verification scheme unknown, but webhook processing enabled." Negative control `AT-B12CFG-7`.

**Where a provider offers no safe check**, B12 reports a **capability limitation** rather than inventing one. `status` then remains `configuration_required` with `error_code = provider_check_unavailable`, and the operator is told plainly that credentials cannot be validated without live use. Fabricating a check by sending a real message would be worse than admitting the gap. Negative control `AT-B12CFG-4`.

## 6. Scope — workspace versus global

| Scope | Providers | Why |
|---|---|---|
| **Workspace** | Meta (per-workspace WABA/phone binding), Tap (per-workspace merchant/customer) | each workspace has its own commercial relationship, and cross-tenant credential reuse would be a tenancy breach |
| **Global** | Places, AI Gateway, storage | one platform-level account serves every workspace; per-workspace credentials do not exist |

> **A global connection is still tenant-safe** because *usage* is always workspace-attributed and workspace-budgeted (`B12_RATE_LIMIT_BACKPRESSURE.md` §3). Sharing a credential is not sharing a quota. Negative control `AT-B12TEN-4`.

Global connections are configured by platform operators, never by a workspace admin — a workspace admin who could rotate the platform's Places key would be able to break every other tenant (`B12_RBAC_TENANCY.md` §3).

## 7. Rotation — from `connected`, not only from `error`

> **`B12-D-A051`. A material configuration change on a `connected` integration moves it to `configuration_required`, and a fresh safe check is required before `connected` is reachable again.** Transition 4 of machine 4 (`B12_STATE_MACHINES.md` §4a).

Rotating a *working* credential is the ordinary case, not an error path. Frozen `B5_ADMIN_PROVIDER_RUNBOOK.md` requires that *"The prior credential reference is invalidated, not merely superseded"* — so the validation that produced `connected` is stale the instant the reference changes, and continuing to report `connected` would be a claim B12 can no longer support.

**Material** (moves the status): a credential reference, an account/binding identifier (`phone_number_id`, WABA, merchant reference), or a base endpoint. **Non-material** (does not): a display label or an operator note. The distinction is deliberate — a status that flapped on a cosmetic edit would train operators to ignore it.

**`enabled` is untouched by rotation.** Operator intent is a separate fact (`B12-D-A034`); a rotation does not silently pause an integration, and un-pausing is not a side effect of re-checking. What changes is only whether new outbound work is *admissible*, which requires both (§4's admission rule).

In-flight work continues under the cooperative-checkpoint discipline; work that has not yet issued its provider call resolves the reference at call time and therefore picks up the new credential automatically (`B12_CONCURRENCY_MODEL.md` §2 race 9). **Inbound callbacks continue to be accepted and receipted throughout** — `B12-D-A028` is unaffected. Where one credential serves two purposes, rotation invalidates both at once: `TAP_SECRET_KEY_REF` is both the API key and the `hashstring` HMAC key (`B12_CONFIGURATION_INVENTORY.md` §3), so a callback signed under the prior key will fail verification after rotation. That loss is bounded by `retrieve_charge` reconciliation, which `B12-D-A025` already makes the guarantee rather than an optimization.

## 8. What configuration never contains

No secret value, no masked fragment, no token prefix, no partial key. A read returns `configured: true|false` and metadata only (`B12_API_DTO_CONTRACTS.md` §4). Frozen `B1_AUTHORIZATION_RBAC.md`'s own `integration.manage` row states the requirement in its condition cell: *"secret access never returned to client."*
