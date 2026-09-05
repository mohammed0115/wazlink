# B14_31 — Trust Boundary and Reverse Proxy

> **Added by `B14-FIX.1` to close `V-06` (D).** Frozen `B13_DEPLOYMENT_SECURITY.md` §3 fixes the **trust contract** and explicitly assigns the topology to B14: *"This is a deployment decision recorded here as a dependency, not designed further — **the exact topology is `B14`**."* The pre-fix pack contained no occurrence of `X-Forwarded`, `reverse proxy` or `orchestrator`, so a security boundary was left entirely unspecified.

## 1. The frozen contract this implements

`B13_DEPLOYMENT_SECURITY.md` §3, verbatim:

> *"WazLink is behind exactly **one** reverse-proxy hop in the target deployment shape. The application trusts forwarded headers (`X-Forwarded-Proto`, `X-Forwarded-Host`) **only** because the network topology guarantees the application process is reachable exclusively from that proxy, never directly from the internet (§1). If a future deployment introduces a second proxy hop … the header-stripping-and-resetting requirement in §2 must hold at **every** hop, and the application's trust boundary does not change — it still trusts only the immediate hop it is configured for."*

Two obligations follow, and both are absolute:

1. **Trust is conditional on unreachability.** If the application process can be reached directly, trusting a forwarded header is trusting the client.
2. **Every hop must strip and reset.** A hop that forwards a client-supplied value unchanged destroys the guarantee for every hop behind it.

## 2. Why this is security-sensitive, not plumbing

Three controls read the client IP. Each fails in a specific, concrete way if the value is attacker-controlled:

| Control | Harm if the IP is spoofable |
|---|---|
| **Rate limiting / abuse** (`B13_RATE_LIMIT_ABUSE_MODEL.md`) | Every per-IP limit is bypassed by rotating a header value. Credential stuffing and the webhook/provider-check abuse limits become decorative |
| **Audit actor IP** (`B13_AUDIT_LOGGING.md`) | `audit_logs` records an attacker-chosen origin. The audit trail becomes **forgeable evidence** — worse than absent, because it is trusted |
| **Scheme/host** (`SECURE_PROXY_SSL_HEADER`, `USE_X_FORWARDED_HOST`) | A forged `X-Forwarded-Proto: https` makes Django believe a plaintext request was secure, so `SESSION_COOKIE_SECURE` and HSTS logic reason from a lie |

This is why the default below is **trust nothing**, and why enabling trust is gated on evidence rather than convenience.

## 3. Topology decision — recorded honestly

Per `B14_30` §1, the repository contains **no backend deployment infrastructure**: one GitHub Pages workflow for the static frontend, no Docker, compose, Traefik, nginx, Caddy or Procfile. **The production topology is therefore not verifiable from repository evidence and is not invented here.**

`ID-13` (`B14_27` §2) — **PRE-DEPLOYMENT SECURITY GATE**

| Field | Value |
|---|---|
| Decision | Reverse-proxy product, hop count, and the trusted-proxy identity mechanism |
| Owner | **Platform + Security** (joint — neither may close it alone) |
| Slice | configured in **I0**; **closed before the first staging deploy** |
| Source type | **Deployment evidence** — the actual provisioned topology, not a document |
| Latest safe decision point | **before the first staging deploy** |
| Blocks I0? | **No** — the safe default in §4 is fully implementable and correct at I0 |
| Blocks staging/production? | **Yes** |
| Failure behaviour | Deploy refused. **The application never silently upgrades to trusting a header** |

**The gate is about which proxy and which identity mechanism. The behaviour under both the open and closed state is fully specified below, so nothing is left to an implementer's judgement.**

## 4. Safe default — fail closed, trust nothing

This is the **I0 behaviour**, the local/test/CI behaviour, and the behaviour in any environment where the gate is unclosed.

| Setting | Default | Meaning |
|---|---|---|
| `TRUSTED_PROXY_COUNT` | **`0`** | No hop is trusted |
| `TRUSTED_PROXY_CIDRS` | **empty** | No peer is a recognised proxy |
| `USE_X_FORWARDED_HOST` | **`False`** | `Host` comes from the request line; `ALLOWED_HOSTS` validates it |
| `USE_X_FORWARDED_PORT` | **`False`** | — |
| `SECURE_PROXY_SSL_HEADER` | **unset (`None`)** | Scheme is the actual connection scheme. **Never inferred from a header** |
| Client IP | **direct peer address** (`REMOTE_ADDR`) | `X-Forwarded-For` is **ignored entirely** |
| `X-Forwarded-*` on inbound | **ignored, and recorded as ignored** | Presence is logged as a `proxy.untrusted_forwarding_header` signal, never applied |

**Under the default the system is correct but stricter**: behind an unconfigured proxy every client appears as the proxy, so per-IP limits are conservative and audit rows record the proxy. That is a **safe, visible, non-silent** failure. The opposite default — trusting the header — is a **silent** authorization-grade failure. B13's fail-closed posture requires the former.

## 5. Configured state — the only permitted way to trust

Trust activates **only** when the gate is closed and all four preconditions hold. They are conjunctive.

| # | Precondition | Verified by |
|---|---|---|
| 1 | The application process is reachable **exclusively** from the proxy — no public route to the app port | Network policy / security-group assertion, captured as deploy evidence |
| 2 | The proxy **strips every inbound `X-Forwarded-*` and `Forwarded` header** and re-sets them from its own observation | Proxy configuration, captured as deploy evidence |
| 3 | The proxy identity is pinned by `TRUSTED_PROXY_CIDRS` (or an equivalent peer identity) | Configuration |
| 4 | **TLS terminates at the proxy**, and the proxy is the only TLS terminator | Deploy evidence |

Then, and only then:

| Setting | Configured value |
|---|---|
| `TRUSTED_PROXY_COUNT` | **`1`** (the frozen "exactly one hop") |
| `SECURE_PROXY_SSL_HEADER` | `("HTTP_X_FORWARDED_PROTO", "https")` |
| `USE_X_FORWARDED_HOST` | `True` **only if** the proxy rewrites `Host`; otherwise remains `False` |
| `ALLOWED_HOSTS` | Explicit hostnames. **No wildcard in staging or production** — startup fails closed (`B14_11` §3) |
| `CSRF_TRUSTED_ORIGINS` | Explicit `https://` origins matching `ALLOWED_HOSTS`. **No wildcard scheme, no bare host** |

### Client-IP derivation — rightmost-untrusted, never leftmost

```
Given X-Forwarded-For: c1, c2, …, cN   and TRUSTED_PROXY_COUNT = k

  if k == 0:                 client_ip = REMOTE_ADDR          # ignore the header
  if REMOTE_ADDR not in TRUSTED_PROXY_CIDRS:
                             client_ip = REMOTE_ADDR          # peer is not our proxy
  else:                      client_ip = element (N - k) counted from the right
  if that element is absent or unparseable:
                             client_ip = REMOTE_ADDR          # fail closed
```

**The leftmost element is never used.** The left of the list is written by the client and is freely forgeable; only the rightmost `k` entries were observed by infrastructure we control. Taking the leftmost value is the single most common form of this vulnerability, and it is prohibited here by name.

**One derivation, one place.** `common/` exposes exactly one `client_ip(request)`. Rate limiting (`B13_RATE_LIMIT_ABUSE_MODEL.md`) and audit actor IP (`B13_AUDIT_LOGGING.md`) both call it. **No module may parse `X-Forwarded-For` itself** — a second parser is a second trust boundary, and they would drift.

## 6. Deploy-time assertions

Before staging and before production (`B14_30` §4):

1. `TRUSTED_PROXY_COUNT` and `TRUSTED_PROXY_CIDRS` are **consistent** — a non-zero count with empty CIDRs **fails closed at startup**.
2. `SECURE_PROXY_SSL_HEADER` is set **only** when `TRUSTED_PROXY_COUNT > 0`. Setting it with a count of `0` **fails closed at startup** — this is the configuration that would let any client claim HTTPS.
3. `ALLOWED_HOSTS` is non-empty and wildcard-free.
4. `CSRF_TRUSTED_ORIGINS` entries are `https://` and correspond to `ALLOWED_HOSTS`.
4a. **`BROWSER_TOPOLOGY` is declared and consistent** (`B14_11` §2). `CORS_ALLOW_ALL_ORIGINS` is absent or `False`; no `CORS_ALLOWED_ORIGINS` entry contains `*`; `CORS_ALLOW_CREDENTIALS=True` only with a non-empty explicit list; `cross_site` is refused in staging and production. Each is a **startup failure**, not a warning (`B14_11` §3).
5. A synthetic request carrying a forged `X-Forwarded-For` and `X-Forwarded-Proto` from a **non-trusted** peer is proven not to influence derived IP or scheme.

Assertion 2 is the highest-value one in this document: it converts the classic misconfiguration into a startup failure.

## 7. Relationship to the rest of the pack

| Concern | Relationship |
|---|---|
| **Webhook signature verification** | **Unaffected and unweakened.** Meta HMAC over raw bytes and Tap `hashstring` field-concatenation are cryptographic and independent of network trust (`B12-X-001`, `B12-X-005`). A trusted proxy is **never** an alternative to signature verification |
| **Workspace resolution** | **Unaffected.** Workspace comes from the session's `active_workspace_id`, never from a header or a client value (`FI-B0-07`) |
| **Authorization** | **Unaffected.** No permission decision reads an IP. The client IP is telemetry and rate-limit input, never authority |
| **Health/readiness** | `/health` and `/ready` are reachable by the platform without forwarded headers and remain **never provider-dependent** |
| **Secrets** | `TRUSTED_PROXY_CIDRS` is configuration, not a secret; it is safe in logs. **No value here is a credential** |
| **Browser origin / CORS** | A **separate** boundary, owned by `B14_11` §2. The proxy decides which *network peer* is trusted; CORS decides which *browser origin* is granted a cross-origin read. Neither substitutes for the other, and a trusted proxy is **never** a reason to widen an origin allow-list |

## 8. Environment matrix

| | local | test / CI | staging | production |
|---|---|---|---|---|
| Proxy | none | none | one hop | one hop |
| `TRUSTED_PROXY_COUNT` | `0` | `0` | `1` after gate | `1` after gate |
| `SECURE_PROXY_SSL_HEADER` | unset | unset | set after gate | set after gate |
| `ALLOWED_HOSTS` | `localhost` | `testserver` | explicit | explicit, **no wildcard** |
| TLS terminator | n/a | n/a | proxy | proxy |
| Client IP | `REMOTE_ADDR` | `REMOTE_ADDR` | rightmost-untrusted | rightmost-untrusted |

## 9. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-PROXY-1` **(NC)** | `TRUSTED_PROXY_COUNT=0` | Request with `X-Forwarded-For: 1.2.3.4` | Derived client IP is `REMOTE_ADDR`; **`1.2.3.4` appears in no rate-limit key and no audit row** |
| `T-PROXY-2` **(NC)** | `TRUSTED_PROXY_COUNT=0` | Request with `X-Forwarded-Proto: https` over plaintext | `request.is_secure()` is **`False`**; scheme is not upgraded |
| `T-PROXY-3` | `count=1`, peer in `TRUSTED_PROXY_CIDRS` | `X-Forwarded-For: 9.9.9.9, 10.0.0.5` | Client IP is the **rightmost-untrusted** element, **not** `9.9.9.9` |
| `T-PROXY-4` **(NC)** | `count=1`, peer **not** in CIDRs | Forged `X-Forwarded-For` | Falls back to `REMOTE_ADDR` — an untrusted peer cannot assert an IP |
| `T-PROXY-5` **(NC)** | `count=0` **and** `SECURE_PROXY_SSL_HEADER` set | Start the process | **Startup fails closed**, message names the setting, **never a value** |
| `T-PROXY-6` **(NC)** | `count>0`, `TRUSTED_PROXY_CIDRS` empty | Start the process | **Startup fails closed** |
| `T-PROXY-7` **(NC)** | Production settings, wildcard `ALLOWED_HOSTS` | Start the process | **Startup fails closed** |
| `T-PROXY-8` **(NC)** | Whole codebase | Grep for `X-Forwarded-For` / `HTTP_X_FORWARDED_FOR` parsing | Exactly **one** implementation, in `common/`; no module parses it independently |
| `T-PROXY-9` | Rate limit + audit | Issue requests through the configured path | Both read the **same** `client_ip(request)` helper |
