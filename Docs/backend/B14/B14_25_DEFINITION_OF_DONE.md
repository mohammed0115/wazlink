# B14_25 — Definition of Done

## 1. Per-slice DoD

A slice is **Done** only when **all** hold:

**Code** — implements exactly the slice contract, nothing more · module boundaries respected (**import DAG acyclic and layer-respecting over the *AST-walked* edge set under the `B14_03` §4a rules** — `SAME_LAYER_EDGE_COUNT = 0`, `UPWARD_EDGE_COUNT = 0`, `MODULE_DAG_CYCLE_COUNT = 0`, `T-ARCH-1`, `T-ARCH-10`; no cross-app model import, `T-ARCH-4`; **no app imports `config/`**, `T-ARCH-9`; **Party360 sections and timeline entries resolved through `common/party360/`, never by importing a contributor**, `T-P360-8/9/12`, **`T-P360-16`**) · **every *Frozen source contracts* path resolves on the filesystem** (`T-HANDOFF-PATH-1`) · no frozen document edited · no `Docs/gap-plan/` file edited.

**Data** — migrations run forward on a **populated, production-shaped** database with **no row loss** · **`FORWARD_FK_COUNT = 0`** for the declared DAG (`T-MIG-1`) · every constraint the slice defines exists in the database, not only in a model · rollback documented.

**API** — every endpoint returns the frozen error envelope · idempotency and `If-Match` honoured where the contract requires · pagination and filtering work · **cross-workspace access returns `404`**.

**Security** — **the browser-origin contract holds: `BROWSER_TOPOLOGY` declared, no wildcard origin, no credentialed wildcard, `cross_site` refused in staging/production** (`T-CORS-3/4/7`) · every new endpoint has a permission · **every additive permission has a cell for all six workspace roles** (`T-RBAC-3`) · **Viewer masking applied server-side** · no secret in any response, log, audit row, task payload, trace or admin page · the slice's negative controls pass.

**Async** — tasks route to the correct frozen queue · idempotency identity implemented · **`unknown` non-idempotent outcomes are never retried** · dead-letter path exercised.

**Tests** — every invariant the slice touches is mapped to a **defined** test (`B14_19` §1) · **no DoD references a test that is vacuous in this slice** (`B14_19` §4, `T-SEQ-4`) · the **permanent security regression suite** passes · provider tests run against stubs.

**Demo** — the slice's demo runs end-to-end on real infrastructure, **not from frontend fixtures**, with the specific on-screen facts the demo requires · **no demo precedes an entity's owning table** (`T-DEMO-1`).

**Provider gate** — where the slice integrates a provider, its `FI-B12-12` facts are **discharged with URL, date and quoted clause** (`B14_33` §4).

**Evidence** — the full `B14_24` §3 package is produced.

**Verification** — **independent CTO verification passed.** Executor PASS is not closure.

## 2. Programme-level DoD

| # | Condition | Verified by |
|---:|---|---|
| 1 | All 12 `APPROVE_NOW` gaps implemented and verified | `B14_26` §2 |
| 2 | All 8 `APPROVE_AFTER_P0` gaps implemented or explicitly re-scheduled | `B14_26` §3 |
| 3 | **Zero deferred or conflict-blocked capabilities implemented** | `B14_26` §5, `T-RBAC-7` |
| 4 | All **15** amendments either consumed and registered, or explicitly still deferred | `B14_26` §4 |
| 5 | **`CA-01` complete — all five constraints**, with no fake Business, Job or provenance | `T-CA01-1..7` |
| 6 | **`CA-15` complete — a Business-less Lead has a usable identity with no copied PII** | `T-CA15-1..10` |
| 7 | **CRM proven independent of Discovery — both halves** | `T-TRACKB-1..5` (I5) **and** `T-TRACKB-6` (I7) |
| 8 | **B2B and B2C Customer** both working | `T-CUS-1..8` |
| 9 | **Identity resolution shipped with or before Business-less intake** | `T-SEQ-1`, I5 DoD |
| 10 | **All six frozen workspace roles preserved, zero frozen cells changed** | `T-RBAC-1..3` |
| 11 | **OpenAI replaceable behind the port** | `T-AI-6` |
| 12 | **AI cannot autonomously send** | `T-AI-1/2`, `T-WA-7` — **at I13, non-vacuously** |
| 13 | **Revenue firewall intact**, structurally and behaviourally | `T-REV-1..5`, `T-ARCH-1` |
| 14 | **No secret in Django Admin or any log** | `T-SEC-1..7` |
| 15 | **Platform starts and runs with zero provider credentials** | `T-ENV-3` |
| 16 | **Trust boundary configured or safely defaulted** | `T-PROXY-1..9` |
| 16a | **Browser origin and CORS carried from frozen B13, fail-closed** | `T-CORS-1..8`; `AT-B13CORS-1/2` mapped |
| 16b | **Every frozen source contract path resolves** | `T-HANDOFF-PATH-1` |
| **17** | **Party360 composition adds no upward/same-layer edge, no cycle, and persists nothing** | `T-P360-7/8/9/12`, `T-ARCH-1`, `T-ARCH-10` |
| **18** | **Every Party360 section a slice registers flips `unavailable → present` at that slice and no earlier** | `T-P360-1..6` |
| **19** | **Party360 widens no authorization and a failing section mutates nothing** | `T-P360-10`, `T-P360-11` |
| **19a** | **The `activities`/timeline merge is composed above its three contributors, each registered at its own slice, adding no upward edge and no cycle** | `T-P360-13/14/15/16` |
| **19b** | **The merged timeline persists nothing — no dedup store, cache or projection, and no cross-domain copy into `crm_activities`** | `T-P360-17` |
| **20** | **`entitlements` reads only its own rows; absent plan assignment is fail-closed** | `T-ENT-4..7` |
| **21** | **Cross-layer command invocation is by registered name, never by import** | `T-DISP-1..4` |
| 16c | **Module DAG clean over the actual edge set** | `T-ARCH-1` + `T-ARCH-1a/1b` |
| 17 | **`FI-B12-12` discharged for every enabled provider** | `T-FIB12-6` |
| 18 | **Supply-chain baselines captured and current** | `T-SUP-5` |
| 19 | Frontend fixtures retired for every completed domain | `T-DEMO-2` |
| 20 | **All 76 mapped invariants have passing, defined, non-vacuous tests** | `T-META-1/3/4` |
| 21 | **Four sequence zeros hold** | `T-SEQ-1..4` |

## 3. Not Done

A slice is **not** Done if: a negative control was weakened, skipped, or **is vacuous in the slice claiming it** · a demo used fixture data for a completed domain · migrations were tested only on an empty database · a provider contract was assumed rather than verified · **an `FI-B12-12` fact was not discharged** · the agent declared its own closure · a deferred capability was "just scaffolded" — **including minting a permission code for it** · a test ID was referenced without a definition · **an additive permission was left without a `member` cell**.

## 4. I0 determinism re-test

> **The test.** Hand two competent coding agents **only** the frozen contracts I0's *Frozen source contracts* line names, plus B14's I0 contract and the documents it references. Ask whether both arrive at materially the same foundation.

| Choice | Determined? | Where |
|---|:--:|---|
| Python baseline | **Yes** — 3.13 | `B14_29` §2 |
| Django baseline | **Yes** — 5.2 LTS | `B14_29` §2 |
| DRF baseline | **Yes** — 3.18.0 | `B14_29` §2 |
| Celery baseline | **Yes** — 5.6.3 | `B14_29` §2 |
| PostgreSQL baseline | **Yes** — 17 | `B14_29` §2 |
| Redis baseline | **Yes** — 8 (≥8.0) | `B14_29` §2 |
| Database driver | **Yes** — psycopg 3.3, `psycopg[binary,pool]` | `B14_29` §2 |
| Dependency manager + lock | **Yes** — uv + committed `uv.lock`, `uv sync --frozen` | `B14_29` §3 |
| Test runner | **Yes** — pytest + pytest-django, markers `security` / `nc` | `B14_29` §4 |
| Lint / format / types | **Yes** — ruff, ruff format, mypy | `B14_29` §4 |
| Settings layout | **Yes** — five modules, `staging` inherits `production` | `B14_29` §5 |
| Container approach | **Yes** — digest-pinned slim base, multi-stage, non-root, three commands, gunicorn sync | `B14_29` §6, `B14_30` §3 |
| CI pipeline | **Yes** — 16 named stages, GitHub Actions | `B14_30` §2 |
| Health / readiness | **Yes** — three-tier, never provider-dependent | `B14_18` I0, `B14_22` §6 |
| Secret-reference behaviour | **Yes** — `*_REF` name, resolver reads env at call time | `B14_11` §1, `B14_13` §3 |
| **Trust-boundary behaviour** | **Yes** — trust-nothing default; misconfiguration fails startup | `B14_31` §4 |
| Observability baseline | **Yes** — structured JSON, redaction processor, correlation chain, Sentry scrubbing | `B14_22`, `B14_18` I0 |
| Migration baseline | **Yes** — none at I0; contrib only | `B14_18` I0 |
| Demo | **Yes** — DEMO 0 | `B14_20` §1 |
| DoD | **Yes** — §1 above | — |

**`I0_UNDETERMINED_CHOICE_COUNT = 0`.**

**Two decisions remain open at I0 and neither is a foundation choice:** `ID-12` (hosting vendor) and `ID-13` (reverse-proxy product). Both are **pre-staging** gates; I0 runs on local and CI service containers, and `ID-13`'s behaviour is fully specified in both the open and closed state. **Neither requires an agent to invent architecture.**

**Verdict: I0 is deterministic.** The pre-fix pack contained zero version numbers, no dependency manager, no test runner, no container strategy and no CI pipeline, while asserting *"CI green"* as its DoD — the condition `V-07` identified.
