# B3 — Business Normalization and Data Quality

> **B3 status:** Target design only. No implementation.

## 1. What normalization is for

Normalization converts a `NormalizedProviderResult` into a WazLink `Business`. It is the **only** writer of `businesses` (frozen `BACKEND_DOMAIN_OWNERSHIP.md`: "written by: normalization service").

Its contract has two halves:

- **Deterministic**: the same provider result, normalized twice, produces byte-identical field values. Normalization consults no clock, no random source, and no external service.
- **Non-destructive**: a field that cannot be normalized becomes `null` with a recorded reason. It never discards the record and never invents a value.

## 2. The Business field set

Derived from the frozen `Business` OpenAPI schema, the frozen frontend's business rows (`data.js:44-49`), and the export column contract (`data.js:37-41`).

| Field | Class | Frozen contract? | Notes |
|---|---|---|---|
| `public_id` (`BUS-*`) | **derived, immutable** | yes, required | UUIDv7-backed, minted once |
| `workspace_id` | **derived, immutable** | — | `B3-INV-1` |
| `provider_source` | **immutable provenance** | yes, required | the **anchor** identity's provider (§3) |
| `provider_external_id` | **immutable provenance** | yes, required | the anchor identity's external ID (§3) |
| `name` | **provider-asserted → normalized** | yes, required | the only required content field |
| `category` | provider-asserted → normalized | yes, nullable | free text; not an enum (§6) |
| `address` | provider-asserted → normalized | yes, nullable | |
| `city` | **derived** | — (additive) | parsed from address or provider locality |
| `country_code` | derived | — (additive) | ISO-3166-1 alpha-2 |
| `phone` | provider-asserted → normalized | yes, nullable | E.164 |
| `website` | provider-asserted → normalized | yes, nullable | absolute URL + `website_domain` |
| `coordinates` | provider-asserted → normalized | yes, nullable | WGS-84 |
| `rating` | provider-asserted | — (additive) | 0.0–5.0 |
| `review_count` | provider-asserted | — (additive) | ≥ 0 |
| `email` | provider-asserted → normalized | — (additive) | present in the frozen frontend and export columns |
| `instagram` | provider-asserted → normalized | — (additive) | handle form |
| `whatsapp_available` | **derived** | — (additive) | see §7 — a capability claim, not a channel |
| `data_quality` | derived | — (additive) | §4 |
| `first_discovered_at` | **derived, immutable** | — (additive) | earliest `discovery_results.discovered_at` |
| `last_observed_at` | derived, mutable | — (additive) | latest |
| `merged_into_business_id` | derived | — (additive) | tombstone pointer |
| `version` | derived | — | ADR-010 |

**No field on this list is user-editable in Phase 1.** A Business is an *observation record*; user-authored truth about a company belongs to the CRM Lead, which B2 owns. Introducing user edits would create a merge conflict between provider refresh and user intent that Phase 1 has no rule for — recorded as **`B3-D-C002`**.

### 2.1 Value classification

The brief asks these be distinguished, and they are, because each behaves differently on refresh and merge:

| Class | Examples | On re-observation | On merge |
|---|---|---|---|
| **provider-asserted** | `name`, `category`, `rating`, `review_count` | refreshed under §5 | survivor wins if populated |
| **normalized** | `phone` (E.164), `website_domain`, `coordinates` | refreshed under §5 | survivor wins if populated |
| **derived** | `city`, `country_code`, `whatsapp_available`, `data_quality` | recomputed | recomputed |
| **immutable provenance** | `public_id`, `provider_source`, `provider_external_id`, `first_discovered_at` | **never changes** | survivor's values retained |
| **user-editable** | *(none in Phase 1)* | — | — |

## 3. The anchor identity, and why the frozen DTO still holds

The frozen `Business` schema requires **one** `provider_source` and **one** `provider_external_id`, with `additionalProperties: false`. A Business with several provider identities would appear to contradict it.

It does not. Those two fields are the **anchor identity** — the `(provider, provider_external_id)` pair that created the Business — and they are immutable. Every additional identity lives in `business_identities` and is surfaced through the frozen schema's already-unconstrained `provenance` object:

```json
"provenance": {
  "anchor": { "provider": "google_places", "external_id": "…" },
  "identities": [
    { "provider": "google_places", "external_id": "…", "linked_at": "…", "link_basis": "anchor" },
    { "provider": "scraper_directory", "external_id": "…", "linked_at": "…", "link_basis": "strong_match" }
  ],
  "discovery": {
    "first_discovered_at": "…",
    "last_observed_at": "…",
    "job_refs": [ { "type": "DiscoveryJob", "public_id": "JOB-1028" } ],
    "observation_count": 3
  }
}
```

`provenance` is typed `{"type": "object"}` in the frozen contract with no property constraints, so nesting here is **contract-legal without an amendment**. B3 specifies its shape; it does not widen the schema. This is why `B3_CONTROLLED_AMENDMENTS.md` contains no `Business`-schema item.

## 4. Data quality — the minimum viable Business

> **A Business is viable iff it has a stable provider identity and a non-empty name.**

Everything else is optional. A clinic with no website, no email, and no rating is a perfectly good discovery result — the frozen frontend already renders exactly that (`BUS-1301` has `website:""`, `BUS-1198` has `email:""`).

| Condition | Outcome |
|---|---|
| missing/blank `provider_external_id` | **rejected**; counted `rejected_no_identity`; not ingested |
| missing/blank `name` after normalization | **rejected**; counted `rejected_no_name` |
| both present, every optional field invalid | **accepted**; `data_quality.level = "minimal"` |
| both present, some optional fields invalid | **accepted**; invalid fields `null`; reasons recorded |
| both present, all fields valid | **accepted**; `data_quality.level = "complete"` |

**One bad optional field never discards a usable Business.** Rejections are per-record and per-field; they never fail an execution or a job. They increment `found_count` and `duplicate_count` consistently — a rejected record is counted in neither, since it never became a result.

### 4.1 Per-field validation

| Field | Rule | On failure |
|---|---|---|
| `name` | NFKC, trim, collapse whitespace, strip control chars, ≤ 300 chars | blank → **record rejected** |
| `phone` | parse to E.164 using the workspace default region for national formats | `null` + `invalid_phone` |
| `website` | absolute `http`/`https`; host is a valid public domain; derive registrable domain | `null` + `invalid_url` |
| `email` | single address, syntactically valid, ≤ 254 chars | `null` + `invalid_email` |
| `coordinates` | lat ∈ [−90, 90], lng ∈ [−180, 180], not `(0,0)` | `null` + `invalid_coordinates` |
| `rating` | 0.0–5.0, one decimal | `null` + `invalid_rating` |
| `review_count` | integer ≥ 0 | `null` + `invalid_review_count` |
| `category` | NFKC, trim, ≤ 120 chars; **no enum** | `null` + `invalid_category` |
| `address` | NFKC, trim, collapse whitespace, ≤ 500 chars | `null` + `invalid_address` |
| `instagram` | `@handle` or a profile URL reduced to a handle | `null` + `invalid_instagram` |
| any text | invalid UTF-8 or lone surrogates → replacement stripped; if the field empties, treat as absent | per-field rule above |

`data_quality` records `{ level, missing[], invalid[] }` — never a raw provider error string.

### 4.2 Duplicate address

A shared address is **not** a data-quality problem and never rejects a record. Malls, towers, and clinics legitimately share one. It is a **weak** dedup signal only (`B3_BUSINESS_IDENTITY_MODEL.md` §5) and nothing more.

## 5. Refresh on re-observation

When an existing identity is observed again, fields are refreshed under one rule:

> **A newer non-null provider assertion replaces an older value of the same class. A null never overwrites a non-null.**

| Situation | Result |
|---|---|
| provider now returns a phone, stored phone is null | **updated** |
| provider now returns null, stored phone is non-null | **kept** — absence from one response is not evidence of deletion |
| provider returns a different phone | **updated**, and the previous value is retained in the append-only field-history record |
| `provider_source` / `provider_external_id` / `first_discovered_at` | **never updated** — immutable provenance |
| `last_observed_at` | always advanced to the new `discovered_at` |

**Never overwriting with null** is the rule that keeps a transient provider outage from silently erasing a workspace's contact data.

### 5.1 Provider A vs provider B disagreement

When two linked identities assert different values for one field, the Business keeps **one** value, chosen deterministically:

1. **Most recently observed** non-null value wins.
2. Tie → the **anchor** provider's value wins.
3. Both still tied → the lexicographically smaller `provider` string wins (a total order, so the outcome is reproducible).

The losing value is not discarded: it is retained in the field-history record with its provider and observation instant, so "Google says X, the directory says Y" remains answerable. **Disagreement is never resolved by averaging, concatenating, or picking the longer string** — all three invent a value no provider asserted.

A field-level *contradiction* between strong signals also feeds back into identity: it demotes a candidate match from STRONG to PROBABLE (`B3_BUSINESS_IDENTITY_MODEL.md` §5.1), so persistent disagreement surfaces as a review candidate rather than an ever-flipping field.

## 6. Unknown category

`category` is **free text**, not an enum. Providers use open, localized, evolving taxonomies, and the frozen frontend derives its category filter from whatever values are present (`DiscoveryResults.tsx:99`) rather than from a fixed list. An enum would force every unmapped provider category to `other`, destroying exactly the signal the filter depends on.

A WazLink category taxonomy with provider mappings is a real product need but a later one — **`B3-D-C003`**. Until then `category` is stored as observed, and no code branches on its value.

## 7. `whatsapp_available` is a capability claim, not a channel

The frozen frontend carries `whatsapp: true` on business rows (`data.js:44`) and filters on it (`Discovery.tsx:82`). B3 derives `whatsapp_available` **solely** from the presence of a normalized mobile-class phone number, and it means only *"a number exists that could plausibly be reachable on WhatsApp"*.

It is **not** a verified WhatsApp registration, not a Messaging-domain fact, and never a claim that a message can be delivered. Messaging (B5) owns reachability, and B3 asserting it would be an ownership violation dressed as a convenience field.

## 8. Normalization failure is never a job failure

| Scope | Effect |
|---|---|
| one field invalid | field `null`, reason recorded, record ingested |
| one record unusable | record rejected and counted; page continues |
| one page unparseable | `MalformedResponse` → that page fails, non-retryable; the execution keeps its earlier pages |
| every page of an execution unparseable | execution `FAILED_PERMANENT`; other executions unaffected |
| every execution failed | job `failed` (`B3_JOB_STATE_MACHINE.md` §6) |

Failure escalates one level at a time and never further. This is what makes a single malformed record structurally incapable of destroying a job.
