# B14_30 — CI/CD and Deployment Baseline

> **Added by `B14-FIX.1` to close `V-06` (B) and (C).** `B13_B14_BOUNDARY.md` §4 assigns B14 *"the exact CI/CD pipeline, the exact infrastructure-as-code"*. The pre-fix pack contained neither, while asserting *"CI green"* as I0's DoD.

## 1. What the repository actually contains — verified, not assumed

Before adopting any deployment shape, the existing evidence was read directly.

| Evidence | Finding |
|---|---|
| `.github/workflows/` | **Exactly one workflow**: `deploy-pages.yml` |
| That workflow | Builds the **static frontend** with pnpm + Vite and deploys to **GitHub Pages** |
| Docker / compose / Traefik / nginx / Caddy / Procfile | **None present anywhere in the repository** |
| `.env.example` | **Frontend only** — `VITE_APP_ENV`, `VITE_API_BASE_URL`, with the comment *"Do not place secrets in VITE_* variables"* |
| `server/index.ts` | A **static file server**, not an application backend |
| Frontend CI discipline | pnpm, Node 22, **`pnpm install --frozen-lockfile`**, `actions/checkout@v4` |

**Conclusion, stated plainly: there is no existing backend production deployment baseline to inherit.** The frontend is a static site on GitHub Pages with **no origin server**.

Therefore the brief's conditional — *"If Docker/Traefik is the existing production baseline, verify from actual project evidence before adopting it"* — resolves to **it is not**. Docker/Traefik is **not** adopted as an inherited baseline. Containers are adopted below as a **new, reasoned decision**, and the hosting topology is recorded as a **pre-deployment gate** rather than invented.

**GitHub Actions is the evidenced CI platform** and is reused. Introducing a second CI system would contradict `B14_01` §3's "adopt nothing no contract requires".

## 2. Pipeline — exact stages

One workflow, `.github/workflows/backend-ci.yml`, on every push and pull request touching `backend/`.

| # | Stage | Command | Blocking |
|---:|---|---|---|
| 1 | Checkout | `actions/checkout@v4` | — |
| 2 | Toolchain | Install **uv**; Python **3.13** | yes |
| 3 | Install | `uv sync --frozen` | **yes** — a stale `uv.lock` fails |
| 4 | Format | `uv run ruff format --check .` | yes |
| 5 | Lint | `uv run ruff check .` | yes |
| 6 | Types | `uv run mypy` | yes |
| 7 | **Migration drift** | `uv run python manage.py makemigrations --check --dry-run` | **yes** — a model changed without a migration fails |
| 8 | **Migration on populated DB** | apply the seeded production-shaped fixture, then `migrate`; assert **no row loss** | **yes** (`B14_25` §1) |
| 9 | Unit + domain + constraint + API + permission + isolation + idempotency + concurrency + async | `uv run pytest` | yes |
| 10 | **Negative controls** | `uv run pytest -m nc` — **empty selection fails** | **yes** |
| 11 | **Security regression** | `uv run pytest -m security` | **yes, on every slice — not only I15** |
| 12 | **Import-graph DAG** | `T-ARCH-1/2` | yes |
| 13 | **Dependency audit** | `B14_34` §3 | **yes** at the declared severity |
| 13a | **Frozen-contract path resolver** | resolve every *Frozen source contracts* path in `B14_18` against the filesystem | **yes** — `BROKEN_FROZEN_SOURCE_REFERENCE_COUNT` must be `0` (`T-HANDOFF-PATH-1`) |
| **13c** | **Module DAG walker** | AST-walk every file under `apps/` per `B14_03` §4a and check `layer(a) > layer(b)` on every class `A` edge | **yes** — `SAME_LAYER_EDGE_COUNT`, `UPWARD_EDGE_COUNT` and `MODULE_DAG_CYCLE_COUNT` must all be `0`; the walker must also **fail** on the `T-ARCH-1a`/`1b`/`T-P360-12` injected mutations (`T-ARCH-10`) |
| **13d** | **Composition-boundary grep** | grep `apps/crm/`, `apps/customers/` for contributor imports; `apps/entitlements/` for `apps.billing`; `apps/platform_async/` for any `apps.<other>`; every app for `config` | **yes** — zero matches (`T-P360-8/9`, `T-ENT-7`, `T-DISP-4`, `T-ARCH-9`) |
| 13b | **Browser-origin config validation** | boot each settings module and assert the `B14_11` §3 fail-closed rules | **yes** — `T-CORS-3/4/7/8` |
| 14 | Django deploy check | `manage.py check --deploy --fail-level WARNING` (production settings) | yes |
| 15 | Build image | multi-stage build, digest-pinned base | yes |
| 16 | Publish image | on `main` only, immutable tag = commit SHA | — |

**Services for stages 8–11:** PostgreSQL **17** and Redis **8** as ephemeral CI service containers. Celery runs **eager or as a real worker per suite; beat off** (`B14_23` §1).

### Two rules the pipeline enforces structurally

1. **CI holds no live provider credential.** No job has access to a provider secret. Adapter tests run against **stubs only** (`B14_19` §3, `B14_23` §1). A workflow change that adds a provider secret to a test job is a rejection ground.
2. **Stages 10 and 11 cannot be skipped or filtered.** They are not conditional on paths, labels or actor. This is the mechanism against `IR-04`.

## 3. Container and image

| Concern | Decision |
|---|---|
| Definition | `backend/Dockerfile`, multi-stage (builder → runtime) |
| Base | `python:3.13-slim-*`, **digest-pinned** |
| Build | `uv sync --frozen` in builder; runtime copies the virtualenv only |
| User | **non-root**, explicit UID |
| Entrypoints | one image, three commands: `web`, `worker`, `beat` |
| Tag | **immutable commit SHA**. `latest` is never deployed |
| Config | environment variables only — **never a baked credential, never a baked `.env`** |
| Migrations | a **separate one-shot job before** the `web` rollout — never in a container entrypoint, so N replicas cannot race |

**Why containers rather than a bare host.** Three process types share one dependency closure; the frozen five-queue topology needs independently scaled workers; and `B12-D-A049`'s rolling-deploy compatibility requires old and new code to coexist. An immutable digest-pinned image is the smallest mechanism satisfying all three.

**Kubernetes is not required and is not adopted.** Any runtime that can run three commands from one image with environment configuration, health checks and rolling replacement satisfies this contract.

## 4. Environment promotion

```
PR  →  CI (stages 1–15)
main →  CI + publish image
     →  STAGING GATE  → deploy staging  → provider activation proven here
     →  PRODUCTION GATE → deploy production
```

### Staging gate — all must hold (`B14_23` §2)

Migrations forward on a production-shaped dataset with **no row loss** · fail-closed startup validation passes · **security regression suite passes** · health/readiness respond and are **not provider-dependent** · rollback documented for the slice · `check --deploy` clean · **dependency audit within policy** (`B14_34`).

### Production gate — all of the above, plus

Backup **and a rehearsed restore** — *"a restored-but-never-tested backup is not a backup"* · alerts bound with runbooks (`B14_32`) · **the operator has completed the provider activation flow in staging first** (`B14_10` §6) · `DJANGO_DEBUG=False` and non-wildcard `ALLOWED_HOSTS` asserted · **`BROWSER_TOPOLOGY=same_origin` (or `same_site_subdomain`) with no wildcard and no credentialed wildcard origin** (`B14_11` §3) · **trust-boundary configuration asserted** (`B14_31` §6) · **`FI-B12-12` provider facts re-verified** for every enabled provider (`B14_33`).

## 5. Rolling deploy

Frozen `B12-D-A049` applies unchanged: new columns nullable or defaulted so old and new code coexist · unknown event types ignored by consumers · **no in-flight async work dropped or duplicated across a deploy** · no migration in this pack requires downtime, a maintenance window or a stop-the-world backfill.

Worker shutdown drains in-flight tasks within the frozen timeout ceiling; a task exceeding it is left `unknown` and handled by reconciliation `P-1`/`P-3` — **never auto-re-executed** (`B12-D-A020`).

## 6. Open — a pre-deployment gate, not an I0 blocker

`ID-12` (`B14_27` §2): **hosting provider and managed PostgreSQL/Redis vendor.**

| Field | Value |
|---|---|
| Owner | Platform |
| Latest safe decision point | **before the first staging deploy** — after I0 |
| Blocks I0? | **No.** I0 runs on local containers and CI service containers |
| Blocks staging? | **Yes** |
| Safe default | none — the gate must be closed deliberately |
| Constraints the choice must satisfy | managed PostgreSQL **17** with TLS and verified backups · managed Redis **8** · three process types from one image · environment-variable configuration · a **single** reverse-proxy hop satisfying `B14_31` |
| Failure behaviour | staging deploy is refused |

This is registered rather than invented, because inventing a topology would make `B14_31`'s trust boundary rest on a fiction.

## 7. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CI-1` | Workflow present | Inspect `backend-ci.yml` | Stages 10, 11 and 13 present and **not** conditional on path, label or actor |
| `T-CI-2` | Workflow present | Grep every test job's `env`/`secrets` | **No provider credential** reachable by any test job |
| `T-CI-3` | Model changed, migration absent | Run stage 7 | Build **fails** |
| `T-CI-4` | Populated fixture DB | Run stage 8 | Migrations apply forward; **row count preserved**; every pre-existing Discovery Lead still satisfies every constraint |
| `T-CI-5` | Negative controls deleted | Run stage 10 | Build **fails** on empty selection |
| `T-CI-6` | Built image | Inspect | Non-root user; digest-pinned base; **no `.env` or credential in any layer** |
| `T-CI-7` | Deploy simulation | Roll new revision over old | No in-flight task dropped or duplicated (`B12-D-A049`) |
| `T-CI-8` | Production settings | Stage 14 | `check --deploy` clean at `--fail-level WARNING` |
