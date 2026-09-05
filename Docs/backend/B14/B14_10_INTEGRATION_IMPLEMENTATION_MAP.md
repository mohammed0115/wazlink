# B14_10 — Integration Implementation Map

> **No provider is integrated in B14.** This defines the boundaries an implementation slice must respect. **Provider-specific request/response contracts must be verified against official documentation during that provider's slice** — B14 invents none.

## 1. Universal port/adapter contract

```
apps/<domain>/            owns business meaning
      │  calls a Port (a typed interface in the domain)
      ▼
adapters/<provider>/      owns translation ONLY
      │
      ▼
external provider API
```

**Every adapter must:** resolve credentials through the `*_REF` indirection **at call time** · write a `provider_request_attempts` row **before** the call (`B12-D-A021`) · normalize responses to the domain's typed shape · normalize errors to B12's closed error classes · return `known_success | known_failure | unknown` and **never coerce `unknown`** · respect timeouts and the frozen retry/backoff · never log request or response bodies, credentials or headers.

**Every adapter must NOT:** contain business rules · decide permissions · write a domain table · invent a provider capability · retry a non-idempotent operation on `unknown` · leak a provider-specific type into a domain signature.

## 2. Provider register

| Provider | Domain | Port | Adapter | Webhook | Queue | Slice |
|---|---|---|---|---|---|---|
| **Meta WhatsApp Cloud** | `messaging` (B5) | `MessagingProviderPort` | `adapters/whatsapp` | `GET|POST /webhooks/whatsapp` | `providers.fast` | I6 |
| **OpenAI** | `aiagent` (`GAP-014`) | **`AIProviderPort`** | `adapters/openai` | none | `providers.slow` | I13 |
| **Google Places** | `discovery` (B3) | `PlaceSearchPort` | `adapters/places` | none | `providers.slow` | I3 |
| **Scraping provider** | `discovery` (B3) | `ScrapingProviderPort` | `adapters/scraping` | `POST /webhooks/scraping` | `providers.slow` | I3 |
| **Tap Payments** | `billing` (B8) | `PaymentProviderPort` | `adapters/tap` | `POST /webhooks/tap` | `providers.fast` | I9 |
| Object storage | `files` (B11) | `StoragePort` | `adapters/storage` | none | `default` | I11 |

## 3. Frozen provider capability posture

`B12_PROVIDER_CAPABILITY_MODEL.md` uses a **three-valued** capability model — `supported | not_supported | unknown` — and **`unknown` must never be guessed**. Only two capabilities are relied on in Phase 1, both backed by a primary source. An adapter may not assume a capability the frozen model records as `unknown`.

Meta redelivers for 36h and offers no documented pull-replay, so a WazLink outage is recovered by **waiting**, not by fabricating a catch-up mechanism.

## 4. Health and configuration — frozen vocabulary

Every provider is an `integration_connections` row. **This is the only provider operational truth; no adapter keeps a second one.**

`status` (5 frozen states): `not_connected` → `configuration_required` → `connected`, `error` reachable, `connected → configuration_required` on material change.
`enabled` (**orthogonal boolean** — operator intent, `B12-D-A034`/`B12-D-A052`). **`disabled` is not a status.**
Six health facts: `configuration_valid` · `credential_valid` · `provider_reachable` · `webhook_configured` · `provider_enabled` · `degraded`.

`401`/`403` from a provider ⇒ `credential_valid=false`, `status → error`, alert, **no automatic retry** (frozen).

## 5. Provider absence is a safe, defined state

**WazLink must start and run with zero provider credentials configured.**

| Condition | Behaviour |
|---|---|
| No credential present | connection is `not_connected`; health `configuration_valid=false`; **the process starts normally** |
| Domain call attempted anyway | refused at the port with a domain error; **no crash, no partial write, no secret in the message** |
| Core CRM / Customer / Contact / Task / Deal | **fully functional** — none touches a provider |
| Mandatory-for-deployment provider | may be declared required per environment; startup then fails **closed with a sanitized message naming the variable, never its value** |

This is what makes **positions 1–5 — `I0 · I1 · I2 · I5 · I7` — fully deliverable with no provider account at all**, covering **DEMO 0, DEMO 0+, DEMO 1, DEMO A1, DEMO B and DEMO A2**.

> **`B14-FIX.2` repair — closes `M-02`.** The previous wording read *"I0–I5 and Demo A"*, which predates the `V-02` split. It was wrong twice: slice numbering is not applied order (position 5 is **I7**, not I5), and "Demo A" no longer exists as a single demo. Verified against each slice contract: I0, I1, I2, I5 and I7 all carry **Provider adapters — N/A** and require zero credentials (`B14_18`; `B14_28` §5). **`PROVIDER_FREE_POSITION_1_TO_5 = PASS`.** The claim is not broadened beyond position 5: position 6 is **I3**, which needs Google Places.

## 6. Operator runbook (V1)

```
Create provider account
  → complete provider-side activation/verification
  → obtain credentials
  → place them in the server .env
  → restart/reload the service
  → Django Admin → Integrations
  → Check Configuration        (local validation, no provider call)
  → Test Connection            (CheckProviderConfiguration → provider call)
  → status becomes CONNECTED
  → Enable Provider            (EnableIntegration; frozen precondition: status = connected)
```

The frozen `EnableIntegration` precondition is literally `status = connected`, so this sequence is not a convention — **the command cannot succeed out of order.**

### External prerequisites — evidence-marked

| Provider | Prerequisite | Evidence |
|---|---|---|
| Meta WhatsApp | Business/app setup, phone number, access token, app secret, verify token; templates require approval; opt-in required before template sends | **Verified** — Meta Cloud API overview (2026-09-04) |
| OpenAI | Account with API access and an API key | **Verified as a class**; exact console steps = **implementation-time verification** |
| Google Places | Google Cloud project with the Places API enabled and a key; attribution requirements apply | **Implementation-time verification** against current Google docs |
| Scraping provider | Account + key + base URL; verification scheme is **`B12-D-B005`, still open** | **Provider not selected** — see §7 |
| Tap | Merchant activation, secret/public keys | **Implementation-time verification** |

**No prerequisite is asserted as mandatory without provider evidence.** Rows marked *implementation-time verification* must be confirmed from official documentation in that provider's slice before code is written.

### The `FI-B12-12` gate is separate, narrower and stronger

`B13_B14_BOUNDARY.md` §4 grants B14 *"no shortcut to skip re-verifying the four load-bearing provider facts"*. Those four — **`B12-X-001`** (Meta signature scheme), **`B12-X-005`** (Tap `hashstring` field-concatenation HMAC), **`B12-X-006`** (Tap's three-attempt callback bound), **`B12-X-014`** (Meta raw-byte basis) — are facts whose change would **invalidate a load-bearing control**, not merely a comment.

**Satisfying the table above does not discharge that gate.** It is recorded, evidenced and tested separately in **`B14_33`**, with per-fact discharge (URL, retrieval date, quoted clause) inside the owning slice and a standing re-verification cycle. `T-FIB12-6` blocks the production gate on a stale or missing discharge.

## 7. Scraping provider — deliberately unselected

Frozen B12 records the scraping webhook verification scheme as **open** (`B12-D-B005`) and forbids marking the scraping connection `enabled` before a verification scheme exists (`B12-D-A054`).

**B14 does not select a scraping vendor and does not invent its contract.** Discovery depends on `ScrapingProviderPort` with a normalized result contract; vendor selection is an **implementation-time provider decision that does not alter the Discovery domain**. Until a scheme exists, the connection may reach `configuration_required` but **must not be enabled**.
