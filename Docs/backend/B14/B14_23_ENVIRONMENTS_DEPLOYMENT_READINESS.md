# B14_23 — Environments and Deployment Readiness

## 1. Four environments

| | **local** | **test / CI** | **staging** | **production** |
|---|---|---|---|---|
| PostgreSQL | local instance | ephemeral per run | managed, TLS | managed, TLS, backups verified |
| Redis | local | ephemeral | managed | managed |
| Celery | worker + beat locally | **eager or a real worker per suite**; beat off | worker + beat | worker + beat, per-queue concurrency |
| File storage | local filesystem | temp dir | object storage (staging bucket) | object storage (prod bucket) |
| Provider mode | **stubs by default** | **stubs only — never a live call** | sandbox where the provider offers one, else disabled | live |
| Credentials source | developer `.env` (never real prod values) | fixture placeholders | deployment secrets | deployment secrets |
| Webhooks | tunnel or replay fixtures | synthetic signed payloads | provider → staging endpoint | provider → prod endpoint |
| `DJANGO_DEBUG` | `True` allowed | `False` | **`False`** | **`False`** |
| **`BROWSER_TOPOLOGY`** | `cross_site` permitted | `cross_site` permitted | **`same_origin`** (or `same_site_subdomain`) | **`same_origin`** |
| **CORS allow-list** | explicit `http://localhost:*` | explicit fixture origins | explicit `https://` list | **empty — no cross-origin request exists** |
| Logging | human-readable | captured | JSON | JSON + shipped |

**No production credential ever appears in a local `.env`, a test fixture, a CI variable for a test job, a VCR cassette or a snapshot.** `T-SEC-5` enforces the fixture half.

**CI never holds a live provider credential.** Adapter tests run against stubs; sandbox verification is a staging activity, run deliberately by an operator.

> **Toolchain, container and CI details are in `B14_29` and `B14_30`; tuned numeric values in `B14_32`; the trust boundary in `B14_31`.** This document states the environment matrix and the gates.

## 2. Deployment readiness gates

Before a slice reaches **staging**: migrations run forward on a production-shaped dataset with **no row loss** · **`FORWARD_FK_COUNT = 0`** · fail-closed startup validation passes · the security regression suite passes · **negative controls proven non-vacuous** · health/readiness respond and are **not** provider-dependent · **`check --deploy` clean** · **dependency audit within policy** (`B14_34` §4) · **`ID-13` trust boundary closed and asserted** (`B14_31` §6) · **browser-origin contract asserted — `BROWSER_TOPOLOGY` declared, no wildcard origin, no credentialed wildcard, `cross_site` refused (`B14_11` §3, `T-CORS-3/4/7`)** · **`ID-12` hosting gate closed** (`B14_30` §6) · rollback documented for the slice.

Before **production**: all of the above, plus backup **and a rehearsed restore** (frozen B13 — *a restored-but-never-tested backup is not a backup*; `CB-23`, `CB-25`) · alerts bound with **runbooks and panels** (`B13-D-B020`) · the operator has completed the provider activation flow in staging first · **`FI-B12-12` discharged and current for every enabled provider** (`B14_33` §5) · **both supply-chain baselines current with no unaccepted Critical or High** (`B14_34` §6).

## 3. Rolling-deploy compatibility

Frozen `B12-D-A049` applies unchanged: new columns are nullable or defaulted so old and new code coexist · new event types are ignored by consumers that do not know them · no in-flight async work is dropped or duplicated across a deploy · **no migration in this pack requires downtime, a maintenance window or a stop-the-world backfill**.

## 4. Provider activation per environment

A provider may be `not_connected` in one environment and `connected` in another; the connection row is per environment, and **an environment may declare a provider mandatory** — only then does its absence fail startup, still with a sanitized message.

Staging is where a provider is proven: activate in staging, run Check Configuration and Test Connection, observe health facts and a real webhook, **then** repeat in production.

## 5. Rollback

| Change | Rollback |
|---|---|
| New table | drop while unused |
| New nullable column | drop while unused |
| **`CA-01` constraint relaxation** | **reversible until the first non-discovery Lead exists** |
| `CA-02` `handling_mode` | reversible until the first non-`human` value |
| **`CA-04` merge** | **irreversible once executed** (`PD-006`) — the reason it is out of the P0 wave |
| Provider adapter | disable the connection; the domain degrades, the platform does not |
