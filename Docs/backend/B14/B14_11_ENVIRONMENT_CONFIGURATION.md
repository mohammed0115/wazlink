# B14_11 — Environment Configuration

## 1. Reconciling the V1 `.env` decision with frozen B13

Frozen B13 requires every credential to be a **`*_REF`** — *"a symbolic name resolved by the secret-management layer at call time, never cached in a task payload, domain object, or long-lived process variable"* — and leaves the secret-store product open (`B13-D-C003`).

The approved V1 operations decision is that credentials are supplied through **server environment variables / `.env`**.

**These are compatible, and the reconciliation is the architecture:**

> **In V1, the process environment *is* the secret-management layer.** The domain holds a **reference name**; a resolver reads that name from the environment **at call time**. The domain never holds a literal, nothing is cached, and replacing `.env` with a vault later changes the **resolver**, not a single domain object, adapter signature or table.

```
domain  →  credential_ref = "WHATSAPP_ACCESS_TOKEN"     (a NAME, never a value)
              ↓  resolved at call time
resolver  →  os.environ["WHATSAPP_ACCESS_TOKEN"]        (V1 = env; later = vault)
              ↓
adapter   →  provider call
```

**Consequences:** no credential value in a database business row · none in a Celery payload · none in a domain object · none in a long-lived process variable beyond the resolver's call scope · swapping to encrypted secret management is a one-adapter change.

## 2. Canonical environment contract

Names follow the frozen corpus where it already fixes them (`WHATSAPP_*`, `AI_API_KEY_REF`, `AI_BASE_URL`) and the brief's proposals elsewhere. `S` = secret.

### Core platform

| Variable | Req | S | Validation | Missing behaviour |
|---|:--:|:--:|---|---|
| `DJANGO_SECRET_KEY` | **yes** | ✅ | non-empty, ≥50 chars, not a known default | **fail closed at startup** |
| `DJANGO_DEBUG` | yes | · | boolean; **must be `False` in staging/production** | fail closed if true in prod |
| `DJANGO_ALLOWED_HOSTS` | **yes** | · | non-empty, no `*` in production | **fail closed** |
| `DATABASE_URL` | **yes** | ✅ | parseable; TLS required in prod | **fail closed** |
| `REDIS_URL` | **yes** | ✅ | parseable | **fail closed** |
| `CELERY_BROKER_URL` | yes | ✅ | defaults to `REDIS_URL` | fail closed |
| `ENVIRONMENT` | **yes** | · | `local\|test\|staging\|production` | **fail closed** |
| `SENTRY_DSN` | no | ✅ | URL | telemetry disabled; app runs |
| `FILE_STORAGE_*` | yes | ✅ | per B11 | fail closed |

### Providers — all optional; absence never crashes the platform

| Variable | Provider | S | Missing behaviour |
|---|---|:--:|---|
| `WHATSAPP_PROVIDER` | Meta | · | connection `not_connected` |
| `WHATSAPP_ACCESS_TOKEN` | Meta | ✅ | `configuration_valid=false` |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta | · | `configuration_valid=false` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta | · | `configuration_valid=false` |
| `WHATSAPP_APP_SECRET` | Meta | ✅ | **inbound webhooks rejected** (signature unverifiable) |
| `WHATSAPP_VERIFY_TOKEN` | Meta | ✅ | webhook verification handshake fails |
| `AI_PROVIDER` | AI | · | defaults `openai`; agent `not_connected` |
| `OPENAI_API_KEY` | OpenAI | ✅ | agent `configuration_valid=false`; **inbox still works, no proposals** |
| `OPENAI_MODEL` | OpenAI | · | **configuration, never domain truth**; documented default |
| `AI_BASE_URL` | AI | · | optional override (frozen name) |
| `AI_REQUEST_TIMEOUT_SECONDS` | AI | · | bounded by B13 timeout policy |
| `GOOGLE_PLACES_API_KEY` | Places | ✅ | Places discovery unavailable; CRM unaffected |
| `SCRAPING_PROVIDER` | Scraping | · | **unselected** — `B12-D-B005` open |
| `SCRAPING_API_KEY` / `SCRAPING_BASE_URL` | Scraping | ✅ / · | `not_connected` |
| `SCRAPING_WEBHOOK_SECRET` | Scraping | ✅ | **connection must not be enabled** (`B12-D-A054`) |
| `TAP_SECRET_KEY` | Tap | ✅ | checkout unavailable; app runs |
| `TAP_PUBLIC_KEY` | Tap | · | as above |
| `TAP_WEBHOOK_SECRET` | Tap | ✅ | Tap webhooks rejected |

### Browser origin and CORS — **`B14-FIX.2`, closing `F-02`**

Frozen `B13_DJANGO_DRF_SECURITY_BASELINE.md` §7 makes `CORS_ALLOWED_ORIGINS` and `CORS_ALLOW_CREDENTIALS` **INVARIANT**, and §6 makes `SESSION_COOKIE_SAMESITE="Lax"` **INVARIANT**. B14 carries them into configuration without restating a value frozen B13 already fixes.

| Variable | Req | S | Validation | Missing behaviour |
|---|:--:|:--:|---|---|
| `BROWSER_TOPOLOGY` | **yes** | · | `same_origin` \| `same_site_subdomain` \| `cross_site` | **fail closed** |
| `FRONTEND_ORIGINS` | staging/prod | · | explicit `https://` origins, comma-separated; **no `*`, no bare host, no scheme-only entry** | **fail closed** where cross-origin is enabled |
| `CORS_ALLOWED_ORIGINS` | derived | · | derived from `FRONTEND_ORIGINS`; **empty under `same_origin`** | — |
| `CORS_ALLOW_ALL_ORIGINS` | **never set** | · | **must be absent or `False`**; `True` in any environment is a startup failure | **fail closed** |
| `CORS_ALLOW_CREDENTIALS` | derived | · | `False` under `same_origin`; `True` only with a non-empty explicit allow-list | **fail closed** |
| `CSRF_TRUSTED_ORIGINS` | staging/prod | · | explicit `https://` origins matching `ALLOWED_HOSTS` (`B14_31` §5) | **fail closed** |

**None of these is a secret**; all are safe in logs.

### The topology decision, stated rather than inherited

Frozen B13 §7 states the target shape directly: *"WazLink's frontend is **same-origin** with the API in the target deployment shape (SPA served from the same domain, or a trusted subdomain listed in `CSRF_TRUSTED_ORIGINS`)."*

**B14 adopts `same_origin` as the production target and records the current GitHub Pages deployment as a *prototype* topology that does not govern production.** `B14_30` §1 established that the repository's only workflow publishes the static frontend to GitHub Pages; that is the **frontend prototype hosting shape**, not a production architecture decision, and it is explicitly not allowed to dictate one.

| | Production target | Staging | Local / CI | Frontend prototype (GitHub Pages) |
|---|---|---|---|---|
| `BROWSER_TOPOLOGY` | **`same_origin`** | `same_origin` (or `same_site_subdomain`) | `cross_site` permitted | **not a production topology** |
| SPA served from | the WazLink production origin, in front of `/api/v1/` | same | Vite dev server | `*.github.io` |
| `CORS_ALLOWED_ORIGINS` | **empty** — no cross-origin request exists | explicit list | explicit list (`http://localhost:5173`) | n/a |
| `CORS_ALLOW_CREDENTIALS` | **`False`** | `True` only with an explicit list | `True` only with an explicit list | n/a |
| Frozen `SameSite=Lax` | **correct and sufficient** | correct | correct | — |

**No real domain is frozen here.** Origins are environment configuration; the Owner supplies the hostname at deployment.

> ### Why `same_origin` and not a cross-site SPA
> Frozen `B13_AUTHENTICATION_SESSION_SECURITY.md` §3 fixes `SESSION_COOKIE_SAMESITE="Lax"` as **INVARIANT** (`FI-B1-01`), and explicitly rejects `None`: *"`None` would require `Secure` plus a same-site relaxation with no product need."* A genuinely cross-site SPA sending credentialed XHR **requires** `SameSite=None` — which would change a frozen invariant.
>
> **B14 does not change it, and does not quietly enable the topology that would require changing it.** `BROWSER_TOPOLOGY=cross_site` is therefore **unsupported in staging and production** and fails closed at startup there. Enabling it requires a separately approved controlled amendment against frozen B13 §6 — it is not an implementation decision. Under `same_origin` the frozen `Lax` value is not merely acceptable, it is *correct*: there is no cross-site request for `SameSite` to arbitrate.

**Deliberately absent:** any variable carrying business policy (quotas, limits, SLA targets, plan pricing). Those are domain data, not configuration.

## 3. Startup validation

Two tiers, both **fail-closed with sanitized messages**:

1. **Platform-critical** (core table above) — missing/invalid ⇒ **the process refuses to start**. This is B13's frozen fail-closed startup requirement.
2. **Provider** — missing/invalid ⇒ the process **starts normally**; the connection reports `not_connected` / `configuration_valid=false`.

A validation message may name **the variable**, never its value, and never a fragment of it. `T-ENV-2` asserts no startup log line contains a secret value.

An environment may declare a provider **mandatory for that deployment**; only then does its absence fail startup — still with a sanitized message.

### Browser-origin fail-closed rules (`F-02`)

These run in the **platform-critical** tier — the process refuses to start:

| # | Rejected configuration | Why |
|---:|---|---|
| 1 | `CORS_ALLOW_ALL_ORIGINS=True` in **any** environment | Frozen §7 makes the explicit list INVARIANT. There is no environment in which a wildcard is correct |
| 2 | `*` appearing in any `CORS_ALLOWED_ORIGINS` entry | Same invariant, enforced on the value as well as the flag |
| 3 | `CORS_ALLOW_CREDENTIALS=True` with an empty or wildcard allow-list | The exact combination frozen §7 names: *"never `True` combined with a wildcard origin"* |
| 4 | `BROWSER_TOPOLOGY` unset, or not one of the three values | An unstated topology is how a cross-site deployment happens by accident |
| 5 | `BROWSER_TOPOLOGY=cross_site` with `ENVIRONMENT` in {`staging`,`production`} | Would require changing frozen `SameSite=Lax`; unsupported without a controlled amendment |
| 6 | Cross-origin enabled (`FRONTEND_ORIGINS` non-empty) with `CSRF_TRUSTED_ORIGINS` empty or mismatched | CSRF and CORS must describe the same origin set or one of them is decorative |
| 7 | Any `FRONTEND_ORIGINS`/`CSRF_TRUSTED_ORIGINS` entry that is not `https://` in staging/production | Matches the `B14_31` §5 rule for `CSRF_TRUSTED_ORIGINS` |
| 8 | `BROWSER_TOPOLOGY=same_origin` with a non-empty `CORS_ALLOWED_ORIGINS` | Contradictory: same-origin needs no allow-list, and a stray entry is an unnoticed cross-origin grant |

**The dangerous state is unreachable, not discouraged** — the same discipline `B14_31` §6 applies to `SECURE_PROXY_SSL_HEADER`.

## 4. `.env.example`

Committed. **Names and safe placeholders only — never a real credential, never a partial one.** Every variable present with its requirement tier and a one-line comment. `T-SEC-5` asserts `.env.example` matches no credential-shaped pattern, and `.env` is git-ignored.

**Browser-origin variables** (above) and **trust-boundary variables** (`B14_31`): `TRUSTED_PROXY_COUNT` (default `0`), `TRUSTED_PROXY_CIDRS` (default empty), `USE_X_FORWARDED_HOST` (default `False`), `SECURE_PROXY_SSL_HEADER` (default unset), `CSRF_TRUSTED_ORIGINS`. **None is a secret**; all are safe in logs.

## 5. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-ENV-1` | A platform-critical variable (`DJANGO_SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `ALLOWED_HOSTS`, `ENVIRONMENT`, `FILE_STORAGE_*`) missing or invalid | Start the process | **Startup refuses**; the message names the **variable**, never its value or any fragment |
| `T-ENV-2` **(NC)** | Any startup path, valid or failing | Capture every startup log line at every verbosity | **No line contains a secret value or any fragment of one** |
| `T-ENV-3` | **Zero provider credentials** configured (`WHATSAPP_*`, `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SCRAPING_*`, `TAP_*` all absent) | Start web, worker and beat; call `/health` and `/ready`; exercise CRM, Customer, Contact, Task and Deal | **All start normally**; `/ready` is green; every core flow works; each provider connection reports `not_connected` / `configuration_valid=false` |
| `T-ENV-4` **(NC)** | `DJANGO_DEBUG=True` with `ENVIRONMENT=production` | Start the process | **Startup refuses** |
| `T-ENV-5` **(NC)** | An environment declaring a provider **mandatory**, credential absent | Start the process | **Startup refuses** with a sanitized message naming the variable only |

### `T-CORS-*` — browser origin and CORS (`F-02`)

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-CORS-1` | `BROWSER_TOPOLOGY=cross_site` (local/CI) with origin `O` in `FRONTEND_ORIGINS` | Preflight `OPTIONS` and a credentialed `GET` from `O` | `Access-Control-Allow-Origin: O` exactly (**never `*`**) and `Access-Control-Allow-Credentials: true`; the request succeeds |
| `T-CORS-2` **(NC)** | Same, origin `X` **not** in the list | Preflight from `X` | **No `Access-Control-Allow-Origin` header for `X`**; the browser-visible grant is absent. Maps **`AT-B13CORS-1`** |
| `T-CORS-3` **(NC)** | `CORS_ALLOW_ALL_ORIGINS=True`, or `*` in `CORS_ALLOWED_ORIGINS` | Start the process in any environment | **Startup fails closed**; the message names the setting, never a value |
| `T-CORS-4` **(NC)** | `CORS_ALLOW_CREDENTIALS=True` with an empty or wildcard allow-list | Start the process | **Startup fails closed.** Additionally, no response anywhere pairs `Access-Control-Allow-Credentials: true` with `Access-Control-Allow-Origin: *`. Maps **`AT-B13CORS-2`** |
| `T-CORS-5` | Configured `CSRF_TRUSTED_ORIGINS` | Issue a state-changing POST from a listed origin, then from an unlisted one | Listed succeeds with a valid CSRF token; unlisted is **rejected**; the set matches `ALLOWED_HOSTS` (`B14_31` §5) |
| `T-CORS-6` | `BROWSER_TOPOLOGY=same_origin`, production settings, frozen `SameSite=Lax` | Full login → workspace switch → mutation → logout | **All succeed.** `CORS_ALLOWED_ORIGINS` is empty and no CORS header is emitted — proving `Lax` is correct, not tolerated, under the declared topology |
| `T-CORS-7` **(NC)** | `BROWSER_TOPOLOGY=cross_site` with `ENVIRONMENT=staging` or `production` | Start the process | **Startup fails closed.** A topology requiring a change to frozen `SESSION_COOKIE_SAMESITE` **cannot be enabled silently** — it needs a controlled amendment |
| `T-CORS-8` **(NC)** | `BROWSER_TOPOLOGY=same_origin` with a non-empty `CORS_ALLOWED_ORIGINS` | Start the process | **Startup fails closed** — no stray cross-origin grant survives a same-origin declaration |

**Frozen traceability:** `AT-B13CORS-1` → `T-CORS-2`; `AT-B13CORS-2` → `T-CORS-4`.

> **Where the frozen CORS contract actually lives — stated so it is not mis-cited again (`B14-FIX.3`, `N-08`).** A `B14-FIX.2` working note asserted that `B13_ACCEPTANCE_TESTS.md` §12 carries a *stale* pointer to `B13_DJANGO_DRF_SECURITY_BASELINE.md` **§10** where the contract is **§7**. **That assertion is wrong and is withdrawn.** Both sections are correct and they hold different things:
>
> | Frozen location | Holds |
> |---|---|
> | `B13_DJANGO_DRF_SECURITY_BASELINE.md` **§7** | the **CORS policy** — `CORS_ALLOWED_ORIGINS` explicit-list and `CORS_ALLOW_CREDENTIALS`, both **INVARIANT** |
> | `B13_DJANGO_DRF_SECURITY_BASELINE.md` **§10** | the **acceptance controls** — where `AT-B13CORS-1` and `AT-B13CORS-2` are canonically defined |
>
> `B13_ACCEPTANCE_TESTS.md` §12's *"Owning document"* line names the section that owns the **assertions**, which is §10 — the register's own convention throughout. **The pointer is correct, nothing in B13 is stale, and no B13 document is modified.** B14 traces the authoritative content of **both**: §7's policy into §2/§3 above, and §10's assertions into `T-CORS-2`/`T-CORS-4`. Frozen `SESSION_COOKIE_SAMESITE`/`SECURE`/`HTTPONLY` and `CSRF_COOKIE_*` values are **implemented unchanged** and are not restated as tunable values here (`B14_32` §1's anti-duplication rule).
