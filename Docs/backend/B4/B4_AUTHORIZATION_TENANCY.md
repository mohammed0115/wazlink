# B4 — Authorization and Tenancy

> **B4 status:** Target design only. Reuses B1's authorization architecture. Two new permission codes are proposed (§1) because none of B1's existing codes covers this domain — recorded as a controlled amendment, not adopted silently.

## 1. Permission codes — genuinely new, and why

Frozen `B1_AUTHORIZATION_RBAC.md` registers permissions for Discovery (`discovery.*`), CRM (`lead.*`), and every other designed domain, but **no `intelligence.*` code exists**. Unlike B3 (which needed zero new codes because `discovery.run`/`discovery.view` already existed), B4 is the first domain in this corpus with no pre-existing permission family to reuse.

> **`B4-D-A029`: two new permission codes, `intelligence.view` and `intelligence.run`** — the same two-permission shape Discovery uses (`discovery.view`/`discovery.run`), for the same reason: viewing intelligence and causing provider spend are different-risk actions and must be independently grantable.

| Permission | owner | admin | manager | sales | member | viewer | Condition |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `intelligence.run` | A | A | A | A | C | · | member: entitlement + admission budget (`B4_COST_RATE_LIMIT_MODEL.md` §4 step 7) |
| `intelligence.view` | A | A | A | A | A | C | viewer: read-only, workspace scope |

Mirrors B1's exact matrix shape for `discovery.run`/`discovery.view` (`B1_AUTHORIZATION_RBAC.md`) — the same role reasoning applies: viewing is broadly safe, running costs money and is member-conditional. No separate "view evidence" permission is proposed — evidence is inseparable from the run it backs (`B4_EVIDENCE_MODEL.md` §5), and gating it separately would let a `viewer` see a score with no way to see why, contradicting `B4_OBSERVABILITY_RECONCILIATION.md` §4's auditability requirement.

Recorded as `B4_CONTROLLED_AMENDMENTS.md` item 4 (`ADDITIVE` — extends B1's permission table with two rows; no existing cell changes).

## 2. Per-operation authorization

| Operation | Permission | Additional condition |
|---|---|---|
| `POST /intelligence/analyze` | `intelligence.run` | workspace scope; admission sequence |
| `POST /intelligence/reanalyze` | `intelligence.run` | same |
| `POST /intelligence/runs/{id}/cancel` | `intelligence.run` | workspace scope; object scope (§3) |
| `GET /businesses/{id}/intelligence`, `.../summary`, `.../history` | `intelligence.view` | workspace scope |
| `GET /intelligence/runs/{id}` | `intelligence.view` | workspace scope |

## 3. Cancel object scope

Mirrors B3's exact cancel pattern (`B3_AUTHORIZATION_TENANCY.md` §3.1): the actor who requested the run, or a `manager`+ role, may cancel it. A `sales` member cannot cancel a colleague's in-flight run.

## 4. Audit

Actor-initiated commands only, mirroring B2/B3's exact audit discipline:

| Action | Audited | Why |
|---|:--:|---|
| `intelligence_requested` | **yes** | a human caused provider spend |
| `intelligence_reanalyzed` | **yes** | same |
| `intelligence_cancelled` | **yes** | a human stopped in-flight spend |
| deterministic/AI-extraction execution, structured-output validation, evidence write | **no** | machine execution of an already-audited command — traced and metered (`B4_OBSERVABILITY_RECONCILIATION.md`), not audited, for the identical reason B3 excludes page ingestion from the audit log |

## 5. New error codes

`NEW_ERROR_CODES = 0`. Every B4 error reuses a frozen `BACKEND_ERROR_CATALOG.md` code — `VALIDATION_ERROR`, `PERMISSION_DENIED`, `ENTITLEMENT_LOCKED`, `ENTITY_NOT_FOUND`, `CONFLICT`, `STALE_VERSION`, the generic `429`/`RateLimited` component, `INTERNAL_ERROR` — differentiated only by `details.reason`, the same technique every prior phase in this corpus uses for a novel rejection cause.

## 6. Tenancy

> **`B4-D-A028`: every B4 row is workspace-scoped directly, except the global definition catalogues.**

| Table | `workspace_id` | Justification |
|---|:--:|---|
| `intelligence_runs` | **required** | tenant-owned |
| `intelligence_signals`, embedded evidence, embedded recommendations | **required** (inherited from the owning run) | tenant-owned |
| `ai_usage_records` | **required** | tenant-owned technical telemetry |
| `signal_definitions`, `recommendation_definitions`, `scoring_model_versions` | **absent — documented exception** | global, versioned taxonomy/scoring catalogues — no tenant writes them, every workspace reads the same ones. Mirrors B3's exact `discovery_sources` exception (`B3_AUTHORIZATION_TENANCY.md` §2) |

## 7. Cross-workspace isolation — the specific attack this domain invites

> An identical public Business existing in two different workspaces (two agencies independently discovering the same real-world business) must produce **two completely independent `IntelligenceRun` histories, with zero shared state.**

| Attack | Defence |
|---|---|
| Same `business_id` value reused across a cache keyed only by Business, not by `(workspace_id, business_id)` | every cache/reuse key in `B4_COST_RATE_LIMIT_MODEL.md` §7 and `B4_INPUT_SNAPSHOT_MODEL.md` §5 is `(workspace_id, business_id, input_hash)` — never `business_id` alone. `business_id` itself is already workspace-scoped in B3's own identity model (`B3-INV-1`), but B4 restates the composite key explicitly because a provider-side cache (§`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md`, adapter-layer, not designed here) is exactly the kind of component that could be implemented carelessly and leak across workspaces if this weren't stated as a hard requirement |
| Provider prompt context bleeding between workspaces | each provider call's `input_payload` (`B4_INPUT_SNAPSHOT_MODEL.md` §2) is built fresh from one workspace's snapshot; no adapter-level session or conversation state persists across calls (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §2 — each request is stateless) |
| Analysis history leak via `GET /intelligence/runs/{id}` | resolved `WHERE workspace_id = :active AND public_id = :id` → `404`, identical to a non-existent ID, matching B3's exact cross-workspace defence table (`B3_AUTHORIZATION_TENANCY.md` §4) |

`B4_ACCEPTANCE_TESTS.md` includes a negative control (AT-TEN-NC) specifically for cross-workspace cache/reuse collision.
