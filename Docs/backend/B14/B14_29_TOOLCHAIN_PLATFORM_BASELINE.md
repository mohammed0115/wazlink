# B14_29 — Toolchain and Platform Baseline

> **Added by `B14-FIX.1` to close `V-07`.** The pre-fix pack contained **zero** version numbers, no dependency manager, no test runner and no container strategy, while `B14_18` I0's DoD asserted *"CI green"*. Two competent agents could not have produced the same foundation. Every value below is **pinned**, and every pin is sourced.

## 1. Research provenance

All versions were verified against **authoritative primary sources on 2026-09-05**, not recalled. Nothing here is guessed. Where a source publishes no formal lifecycle, that absence is stated rather than invented.

| Source | Fetched | Used for |
|---|---|---|
| `djangoproject.com/download/` | 2026-09-05 | Django release + support windows |
| `devguide.python.org/versions/` | 2026-09-05 | Python lifecycle phases |
| `docs.djangoproject.com/en/6.0/faq/install/` | 2026-09-05 | Django→Python matrix |
| `django-rest-framework.org/community/release-notes/` | 2026-09-05 | DRF release + Django support |
| `docs.celeryq.dev` (5.6 series) | 2026-09-05 | Celery release + Python support |
| `postgresql.org/support/versioning/` | 2026-09-05 | PostgreSQL supported majors + EOL |
| `code.djangoproject.com/wiki/SupportedDatabaseVersions` | 2026-09-05 | Django→PostgreSQL matrix |
| `psycopg.org/psycopg3/` | 2026-09-05 | Driver line |

## 2. The pinned baseline

| Component | **Pin** | Verified fact | Why this and not the alternative |
|---|---|---|---|
| **Python** | **3.13** (latest 3.13.x) | 3.13 is in **bugfix** support, EOL **2029-10**. 3.14 is also bugfix (EOL 2030-10); 3.12 is security-only | **Not 3.14**, because Celery 5.6 documents only *"initial support"* for 3.14. The async runtime is load-bearing for five queues and `B12-D-A020`; "initial support" is not a foundation. 3.13 is fully supported by every component below |
| **Django** | **5.2 LTS** (≥ 5.2.17) | 5.2 is the current **LTS**; extended support to **2028-04**. 6.0 mainstream ended **2026-08-04**; 6.1 extended support ends **2027-12** | **Not 6.1**, whose support window (2027-12) is *shorter* than 5.2 LTS (2028-04). 5.2 LTS is the only option that spans the whole 16-slice programme with **no forced framework upgrade mid-build** |
| **DRF** | **3.18.0** (2026-08-07) | 3.18.0 dropped Django 4.2/5.0/5.1 and added 6.1; supports **Django 5.2**, 6.0, 6.1 | Latest release; explicitly compatible with the Django 5.2 pin |
| **Celery** | **5.6.3** | Latest stable in the 5.6 series | Five frozen queues, JSON-only serialization (`B13-X-007`) |
| **PostgreSQL** | **17** (latest 17.x) | Supported; EOL **2029-11**. Django 5.2 supports **13+** | **Not 18** — 17 is universally available on managed providers, is a year more settled, and its EOL (2029-11) already outlives the programme. Squarely inside Django 5.2's matrix |
| **Redis** | **8** (≥ 8.0) | Redis publishes **no formal per-version LTS/EOL matrix**; the latest stable plus two prior versions receive support | Major pinned; minor tracks the managed provider's current. Redis is **broker/cache only and never business truth** (`FI-B0-16`), so the minor floor carries no correctness weight |
| **DB driver** | **psycopg 3** (3.3.x), installed as `psycopg[binary,pool]` | Django supports psycopg 3 since 4.2; connection pooling since Django 5.1 | psycopg2 is not selected for a greenfield project |

**Django 5.2 LTS × Python 3.13 × DRF 3.18 × Celery 5.6.3 × PostgreSQL 17 × psycopg 3.3 is a mutually compatible set**, each pairing confirmed against the sources in §1.

### Planned upgrade gate — not an open decision

`ID-11` (`B14_27`): **Django 6.2 LTS** releases **2027-04** with support to **2030-04**. Migration from 5.2 LTS is scheduled **after I15**, never mid-programme, and is a maintenance activity that changes no B14 contract. Recorded so the 2028-04 end of 5.2 LTS support cannot arrive unplanned.

## 3. Dependency management

| Concern | Decision |
|---|---|
| Manager | **uv** — `pyproject.toml` + committed **`uv.lock`** |
| Rationale | The repository already enforces a committed lockfile with `--frozen-lockfile` for the frontend (`.github/workflows/deploy-pages.yml`). Backend dependency handling **mirrors that existing, evidenced discipline** rather than inventing a different one |
| Install in CI/production | `uv sync --frozen` — fails if the lock is stale. The exact analogue of the frontend's `pnpm install --frozen-lockfile` |
| Pinning policy | Every direct dependency has an explicit lower bound in `pyproject.toml`; **`uv.lock` pins the full resolved tree**, including transitives |
| Lock updates | A deliberate, reviewed change. A slice may not update the lock as a side effect (`B14_24` rule 6) |
| Groups | `[project.dependencies]` runtime · `dev` (test, lint, type) · `security` (audit tooling) |
| **`django-cors-headers`** | **Direct runtime dependency**, added by `B14-FIX.2` to implement frozen `B13_DJANGO_DRF_SECURITY_BASELINE.md` §7. Declared with an explicit lower bound in `pyproject.toml`; the **exact resolved version is pinned by `uv.lock`** under the policy above. Required because staging and local declare explicit cross-origin allow-lists even though production is `same_origin` |

**`uv.lock` is the backend's resolved-tree artifact for the supply-chain gate (`B14_34`)**, exactly as `pnpm-lock.yaml` is the frontend's.

## 4. Test, lint and type tooling

| Concern | Decision | Command |
|---|---|---|
| Test runner | **pytest** + `pytest-django` | `uv run pytest` |
| Coverage | `pytest-cov` — reported, **never a merge gate**; `B14_19` §3 judges by **invariant coverage** | `uv run pytest --cov` |
| Security regression suite | pytest marker `security` — the **permanent gate** | `uv run pytest -m security` |
| Negative controls | pytest marker `nc` — must be **collected and non-empty**; an empty selection **fails** | `uv run pytest -m nc` |
| Lint + format | **ruff** (lint and format; replaces flake8/isort/black) | `uv run ruff check .` · `uv run ruff format --check .` |
| Type checking | **mypy**, strict on `apps/*/services/` and `apps/*/selectors/` | `uv run mypy` |
| Import-graph lint | custom `T-ARCH-1/2` test asserting the `B14_03` §5 dependency DAG | part of `pytest` |
| Migration drift | `manage.py makemigrations --check --dry-run` | `uv run python manage.py makemigrations --check --dry-run` |
| Django deploy checks | `manage.py check --deploy --fail-level WARNING` | run in staging/production settings |

**Why pytest and not the Django test runner.** `B14_19` requires parametrised permission matrices (six workspace roles × every command) and marker-selected suites (`security`, `nc`) that must run as an independent CI stage. `pytest` provides both natively; the Django runner does not.

**An empty `-m nc` selection is a build failure**, which is the mechanism that stops `IR-04` (a negative control quietly deleted rather than weakened).

## 5. Settings module strategy — exact

```
backend/config/settings/
  base.py         # every shared setting; imports NOTHING environment-specific
  local.py        # from .base import *
  test.py         # from .base import *
  staging.py      # from .production import *   (production posture, staging values)
  production.py   # from .base import *
```

| Rule | Statement |
|---|---|
| Selection | `DJANGO_SETTINGS_MODULE` only. **Never** branch on a hostname, a Git branch, or a guessed environment |
| `ENVIRONMENT` | Independently required and validated (`local\|test\|staging\|production`); a mismatch with the loaded settings module **fails closed at startup** |
| **Browser origin** | `BROWSER_TOPOLOGY`, `FRONTEND_ORIGINS`, `CORS_*` and `CSRF_TRUSTED_ORIGINS` are read in `base.py` and validated fail-closed for **every** environment including `test` (`B14_11` §3). `corsheaders.middleware.CorsMiddleware` is placed **above `CommonMiddleware` and above every authentication/CSRF middleware**, per the library's required ordering; a misplaced entry is a rejection ground. Frozen `SESSION_COOKIE_*`/`CSRF_COOKIE_*` values are set in `base.py` **unchanged** from frozen B13 §6 |
| Secrets | **No settings module reads a credential value.** It reads a **reference name**; the resolver reads the environment at call time (`B14_11` §1, `B14_13` §3) |
| Defaults | `base.py` carries **no** production-unsafe default. `DEBUG = False` in `base.py`; only `local.py` may set it `True` |
| `staging` inherits `production` | So a production-hardening setting cannot be present in production and absent in staging — the failure mode where staging silently proves nothing |
| Validation | Fail-closed startup validation (`B14_11` §3) runs from `base.py` for every environment including `test` |

## 6. Container and runtime

Full deployment topology is in **`B14_30`**; the runtime pins are here.

| Concern | Decision |
|---|---|
| Base image | `python:3.13-slim-*` (Debian slim), digest-pinned |
| Build | Multi-stage: `uv sync --frozen` in a builder stage, runtime stage copies the virtualenv only |
| Process user | **Non-root**, explicit UID |
| WSGI server | **gunicorn**, sync workers |
| ASGI | **Not adopted in Phase 1.** No frozen contract requires async views or websockets; `B12` async work runs on Celery |
| Processes | Three distinct commands off one image: `web` (gunicorn) · `worker` (`celery -A config worker -Q …`) · `beat` (`celery -A config beat`) |
| Queue assignment | Workers subscribe by explicit `-Q`; **the five frozen queues only** (`B14_09` §1). No sixth |
| Static files | **WhiteNoise** for Django Admin and DRF assets only. The tenant frontend is a separate static artifact and is **not** served by Django |

**Why gunicorn + sync and not ASGI.** Adopting ASGI would add an async-safety surface across every ORM call for no frozen requirement. `B14_01` §3's "explicitly not introduced" discipline applies: nothing is adopted that no contract requires.

## 7. What this document does not decide

| Item | Where |
|---|---|
| Reverse proxy, TLS termination, forwarded-header trust | **`B14_31`** — security-sensitive, has its own gate |
| CI/CD stages and deployment gates | **`B14_30`** |
| Class B tuned numeric values | **`B14_32`** |
| Hosting provider / managed-service vendor | **`B14_30`** §6 — a pre-deployment gate, not an I0 blocker |

## 8. I0 determinism statement

Every choice `B14_18` I0 requires is pinned above or in `B14_30`–`B14_32`: Python, Django, DRF, Celery, PostgreSQL, Redis, driver, dependency manager and lock, test runner, lint/format/type tooling, settings layout, container approach, CI pipeline, health/readiness, secret-reference behaviour, observability baseline and migration baseline.

**No material I0 choice is left to the implementing agent.** The I0 determinism re-test is recorded in `B14_25` §4.

## 9. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-TOOL-1` | Repository checked out | Read `pyproject.toml` + `uv.lock` | Python, Django, DRF, Celery and psycopg resolve to the §2 pins; **no unpinned direct dependency** |
| `T-TOOL-2` | Clean environment | `uv sync --frozen` | Succeeds; a stale lock **fails** the build |
| `T-TOOL-3` | Test suite present | `uv run pytest -m nc --collect-only` | Selection is **non-empty**; an empty negative-control selection fails |
| `T-TOOL-4` | Any environment | Load each settings module | `DEBUG` is `False` everywhere except `local`; `ENVIRONMENT` mismatch fails closed |
| `T-TOOL-5` | Production settings | `manage.py check --deploy --fail-level WARNING` | Exits clean |
| `T-TOOL-7` **(NC)** | Built dependency tree | Inspect middleware order and `uv.lock` | `django-cors-headers` is present and version-pinned; `CorsMiddleware` precedes `CommonMiddleware` and all auth/CSRF middleware |
| `T-TOOL-6` | Built image | Inspect running container | Process user is **non-root**; only the five frozen queues appear in any worker command line |
