# B3 — Security, Privacy, and Legal Boundaries

> **B3 status:** Target design only. **B3 makes no legal compliance claim.** Frozen B0 states that no document claims compliance and that Saudi data locality and exact retention are `PRODUCT / LEGAL DECISION REQUIRED`; B3 preserves that position and escalates rather than resolves.

## 1. Threat surface

Discovery is unusual: it **ingests untrusted third-party content at volume**, spends money per request, and accepts inbound callbacks. Its threat surface is therefore larger than a purely internal CRUD domain's.

| # | Threat | Mitigation |
|---:|---|---|
| 1 | cross-workspace data access | `B3_AUTHORIZATION_TENANCY.md` §2, §4 |
| 2 | public-ID enumeration | uniform `404`; scope check before every state check |
| 3 | provider credential exposure | §4 |
| 4 | **SSRF via a provider that accepts URLs** | §3 |
| 5 | forged provider callback | §5 |
| 6 | hostile content in provider results | §6 |
| 7 | cost-exhaustion abuse | `B3_QUOTA_COST_CONTROL.md` §5 |
| 8 | PII over-collection and over-retention | §7 |
| 9 | raw payload leakage | `B3_PROVIDER_ABSTRACTION.md` §7 |
| 10 | provider payload as an injection vector into exports | §6.2 |
| 11 | secrets in logs, traces, or errors | `B3_OBSERVABILITY.md` §3 |
| 12 | callback replay / stale application | `B3_IDEMPOTENCY_CONCURRENCY.md` layer 9, `B3_PROVIDER_ABSTRACTION.md` §6.2 |

## 2. Input validation

Every request field is validated against a **closed** specification before anything is created (`B3_DISCOVERY_REQUEST_MODEL.md` §8): array length bounds, per-element length bounds, control-character rejection, closed enum sets for every filter, a numeric allow-list for `result_limit`, a known-source check, and the combination cap.

There is no free-form field that reaches a query planner, a URL, a template, or a shell. Keywords and locations are **data** — they are normalized, stored as text, and handed to an adapter as a value.

## 3. SSRF

> **The strongest mitigation is structural: no B3 request field is ever a URL.**

The request model is keywords, locations, a source string, a closed filter set, and an integer limit. There is **no path from a client-supplied value to a fetched URL**, so the classic SSRF shape does not exist in the tenant API.

Where a scraping adapter itself constructs or follows URLs:

- target hosts come from **operator-configured** source configuration, never from a tenant request;
- outbound requests from adapters are restricted to an allow-list of provider hosts;
- private, loopback, link-local, and cloud-metadata address ranges are denied, including after DNS resolution and on every redirect hop;
- redirects are bounded and re-validated at each hop;
- every outbound call has a finite timeout and a response size cap.

A `website` field discovered in a provider result is **stored and normalized, never fetched**. Fetching a discovered URL would be enrichment — a different capability, not designed here, and recorded as **`B3-D-C009`**.

## 4. Provider credential isolation

| Rule | |
|---|---|
| credentials live in the platform secret store | never in `discovery_sources`, never in any B3 table (`B3_DATA_MODEL.md` §10) |
| only the adapter reads them | no domain service, no API layer, no worker outside the adapter |
| never logged, traced, error-reported, or serialized | `B3_OBSERVABILITY.md` §3 |
| never in an event payload or an API response | `B3_API_DTO_CONTRACTS.md` §5 |
| rotation requires no B3 contract change | credentials are configuration, not schema |
| a credential fault is a **job-scope** failure with a safe code | `B3_RETRY_FAILURE_MODEL.md` §4 — `provider_configuration_error`, never the provider's message |

## 5. Webhook authenticity

Scraping callbacks enter the frozen B0 **WebhookGateway** and are processed in this order — the order is the security property:

1. **Verify the signature** using the provider's configured secret, constant-time. Failure → `401 WEBHOOK_INVALID_SIGNATURE`, security alert, **no processing, no receipt applied**.
2. **Enforce a payload size cap** before parsing.
3. **Check freshness** — a timestamped signature outside the tolerance window is rejected as a replay.
4. **Persist a `WebhookReceipt`** (`WHR-*`) keyed by provider + event identity + payload hash.
5. **Deduplicate** — a known key returns `200 WEBHOOK_DUPLICATE` with no second effect.
6. **Enqueue** for asynchronous processing and acknowledge fast.
7. **Resolve** the referenced execution **within its workspace**. A callback naming an execution in another workspace, or one that is already terminal, is acknowledged and **not applied** (`B3_PROVIDER_ABSTRACTION.md` §6.2).

Verification precedes parsing, and parsing precedes any domain effect — so an unsigned payload never reaches a parser and a signed-but-stale one never reaches a Business. Frozen B0's rule that "provider callbacks never directly mutate business aggregates outside an application service" is satisfied by step 6: the gateway enqueues, and only `IngestProviderPage` writes.

## 6. Hostile provider content

Every field in a provider result is **untrusted input authored by a third party**.

### 6.1 On ingestion

Length caps per field; control characters and lone surrogates stripped; invalid UTF-8 rejected at the field level; no field is ever evaluated, executed, or interpolated into a query or a template; a field that fails validation becomes `null` with a recorded reason rather than being coerced (`B3_NORMALIZATION_DATA_QUALITY.md` §4.1).

### 6.2 On output

| Surface | Rule |
|---|---|
| JSON API | values are JSON-encoded data; no HTML is generated server-side |
| **CSV / Excel export** | **formula injection is neutralized**: a value beginning with `=`, `+`, `-`, `@`, TAB, or CR is prefixed so a spreadsheet treats it as text |
| logs | business text is not logged at info level (`B3_OBSERVABILITY.md` §3) |
| events | payloads carry public IDs, enums, counts, and timestamps only — no free provider text |

The CSV rule matters because the frozen frontend already offers an Excel export of exactly these fields (`DiscoveryModal.tsx:163`, `data.js:37-41`). A business name of `=HYPERLINK(...)` acquired from a provider would otherwise execute in a user's spreadsheet — an injection whose whole path is already built.

## 7. Privacy and PII

### 7.1 Classification

Per frozen `BACKEND_PRIVACY_AND_DATA_HANDLING.md`:

| B3 data | Frozen class | Handling |
|---|---|---|
| business name, category, address, website, coordinates, rating | **Public business** | provenance, correction/deletion policy |
| **phone, email, Instagram handle** | **Contact PII** | workspace access, masking, purpose limitation |
| raw provider payloads | **Provider payloads** | restricted JSONB, short retention, hash/reference |
| job/query/execution logs and errors | **Operational** | scrubbed, bounded retention |

A discovered business phone or email **is Contact PII** even though the business is an organization — it frequently identifies a person, and treating it as public business data because it arrived from a public directory would be a category error.

### 7.2 Minimization

- **Field minimization at the source**: only fields the model stores are requested from a provider (`B3_PROVIDER_ABSTRACTION.md` §5.2). Unrequested personal data is never received, so it cannot leak, cannot be retained, and cannot need deletion.
- **PII excluded from raw snapshots** — it is already normalized into `businesses`; a second copy on a different retention clock creates a second deletion obligation for no diagnostic gain.
- **No enrichment**: no discovered contact is looked up, verified, or cross-referenced against any other source.
- **Masking** in admin/export views per frozen B0.

### 7.3 Deletion and retention

A deletion request for a discovered business nulls the contact fields on `businesses` while `discovery_results` survives with identity references and a timestamp only (`B3_ACQUISITION_PROVENANCE.md` §7). Frozen B0 asks for exactly this: *"anonymize rather than erase relational history where necessary."*

Concrete durations remain **PRODUCT / LEGAL DECISION REQUIRED** (ADR-012). B3 adopts B0's proposed 30 days for raw payloads (`B3-X-007`) and sets no other duration.

## 8. Legal escalations — stated, not resolved

Frozen B0: *"Scraping must respect provider contracts, robots/terms considerations, provenance, user deletion, and applicable law. No document claims legal compliance."*

| ID | Item | Must be resolved before |
|---|---|---|
| `B3-X-005` | Google Places terms: caching, storage duration, permitted display, attribution | implementing the Places adapter |
| `B3-X-006` | Scraping provider contract, permitted sources, robots/terms posture, redistribution rights | implementing the scraping adapter |
| `B3-X-007` | Confirmation of the 30-day raw-payload retention as policy | enabling raw snapshots |
| `B3-X-008` | **Saudi personal-data obligations** for acquired business contact data — lawful basis, data-subject rights, locality | production launch |
| `B3-X-009` | Whether acquired contact data may be used for outbound messaging, and under what basis | the B5 Messaging boundary |

**B3 invents no legal conclusion for any of these**, and no B3 contract depends on their answers: each is isolated behind an adapter, a configuration value, or a retention duration, so learning the answer changes no design in this package.

`B3-X-009` is recorded here rather than deferred silently because it is the point at which acquisition meets outreach — B3 acquires the phone number, and a later domain may want to message it. That is a different lawful basis from acquisition, and Discovery must not be read as having granted it.

## 9. Audit

`B3_AUTHORIZATION_TENANCY.md` §5 defines what is audited. Audit rows carry actor, workspace, action, target public ID, request ID, and timestamp — and **never** a provider payload, credential, or contact PII field.
