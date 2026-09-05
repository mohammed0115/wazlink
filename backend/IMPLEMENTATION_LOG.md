# WazLink Backend — Wave 1 Implementation Log

Baseline: `13097a72654386801e7aedebf6971a1325c38074` (B14 frozen pack).
Slices executed in the frozen order: **I0 → I1 → I2 → I5 → I7**.

## Stack (B14_29 §2 pins, all verified present in `uv.lock`)

Python 3.13.15 · Django 5.2.17 LTS · DRF 3.18.0 · Celery 5.6.3 ·
PostgreSQL 17.11 · Redis 8.10.1 · psycopg 3.3.5 · uv 0.12.10.

## I0 — Foundation

| | |
|---|---|
| Files | `config/settings/{base,local,test,staging,production,validation}.py`, `config/{celery,urls,api_urls,health,wsgi,registry,apps}.py`, `common/*` (18 modules), `pyproject.toml`, `uv.lock`, `Dockerfile`, `docker-compose.yml`, `.env.example` |
| Migrations | none — Django contrib only, by design |
| Gate | system check clean · `check --deploy --fail-level WARNING` clean under production settings · Celery worker ready on exactly the 5 frozen queues · `/health` + `/ready` green with **zero** provider credentials |

## I1 — Tenant / auth / workspace + platform substrate

| | |
|---|---|
| Modules | `accounts`(L1) `identity_access`(L2) `workspaces`(L2) `entitlements`(L3) `platform_async`(L3) `auditlog`(L3) |
| Notable | invitation and session raw tokens are **hash-only** (32-byte entropy); zero-workspace login succeeds; an absent plan assignment resolves to `PLAN-STARTER`, never unlimited |
| Gate | 14 auth/session tests · 11 RBAC tests · 6 workspace roles, 77 permission codes, 462 explicit cells |

## I2 — CRM core + Discovery schema

| | |
|---|---|
| Modules | `discovery`(L4, schema only) `crm`(L5) `files`(L3) `analytics`(L10, no tables) |
| Notable | `Party360Composer` + `TimelineComposer` live in `analytics`; `crm` contributes only its own `crm_activities` entries, through the registry |
| Gate | Lead 360 renders with every optional section key-absent · the timeline is executable with `crm` alone |

## I5 — Customer / identity / imports / custom fields

| | |
|---|---|
| Modules | `customers`(L6) `identity`(L4) `customfields`(L3) `imports`(L8) |
| Notable | CA-01 + CA-15 are the **initial** constraint state. This is a greenfield schema with zero pre-existing Leads, so the amendments' target invariants are the initial invariants — no row rewritten, no backfill, exactly as `19_CONTROLLED_AMENDMENT_PLAN` §CA-01 anticipates ("purely additive: no row rewritten, no backfill"). The constraint set in the database is precisely CA-01's target, verified by test. |
| Gate | 13 Track-B tests · 10 custom-field tests · 8 import tests |

## I7 — Pipeline / Deals

| | |
|---|---|
| Modules | `pipeline`(L7) |
| Notable | `pipeline` registers both a Party360 `deals` section (EntityRef[] only) and a timeline contributor; closing a Deal writes **nothing** to revenue |
| Gate | 15 revenue-firewall + pipeline tests |

## Defects found and fixed during implementation

The architecture walker caught **four real violations in my own code**. None was
waived; each was fixed at the architecture level, not by relaxing the check.

| # | Defect | Fix |
|---|---|---|
| 1 | `identity_access`(L2) → `workspaces`(L2), a **same-layer** edge — login resolved the initial workspace by importing `Membership` | Resolution moved behind the class B **membership port**, bound in `config/` |
| 2 | `common/` imported `apps/` (`authz`, `audit`, `outbox`, `authentication`) — this would have inverted the entire layering | Introduced `common/ports.py`; all four now reach domain data through ports bound at the composition root (T-ARCH-8) |
| 3 | `discovery`(L4) → `crm`(L5), **upward** — the `business` section looked up the Lead to find its Business | `SubjectRef.related` now carries the subject owner's own refs, supplied by the composing view |
| 4 | `customfields`(L3) → `crm`/`customers` and `workspaces`(L2) → `entitlements`(L3), **upward** | Custom-field subject endpoints moved to the **subject owners**; the entitlements endpoint moved into `entitlements` |

Three test-side defects were also corrected: a docstring-matching regex in the
revenue scan, a version assertion on a mutated object, and a `request_id`
comparison that differs per request by design. No test was weakened to make the
implementation pass, and no frozen acceptance requirement was deleted.

## Final gate results

```
DJANGO_SYSTEM_CHECK      PASS   (0 issues; --deploy clean under production settings)
POSTGRESQL_MIGRATIONS    PASS   (32 applied from empty; rollback + reapply verified)
MIGRATION_DRIFT          PASS   (makemigrations --check: no changes detected)
FORWARD_FK_COUNT         0
MODULE_EDGE_COUNT        14     (Wave 1 subset of the 26-module programme)
SAME_LAYER_EDGE_COUNT    0
UPWARD_EDGE_COUNT        0
MODULE_DAG_CYCLE_COUNT   0
TESTS                    157 passed / 0 failed   (19 nc · 48 security · 3 e2e)
RUFF                     clean       MYPY  clean (53 source files)
```

## Reproducing the demo

```bash
docker compose up -d postgres redis          # or the two dev containers
uv sync --frozen && source .venv/bin/activate
python manage.py migrate
python manage.py runserver 127.0.0.1:8000 &
bash scripts/demo_wave1.sh
```

## Not in Wave 1 (by design, per the frozen slice order)

Discovery features and providers (I3) · Intelligence (I4) · Messaging (I6) ·
AI agent (I13) · Automation (I8) · Billing (I9) · Revenue (I10) · Tax (I11) ·
Support / Knowledge / Assignment (I14) · operator surface (I12).

The `messaging` timeline contributor registers at I6. The composition boundary
already accommodates it with **no change to `crm`** — which is the property
`B14-FIX.4` was written to guarantee.
