# B3 — Decision Register

> **Class A** — must be resolved before B3 closes. **Class B** — may be resolved during implementation preparation without changing architecture. **Class C** — belongs to a later backend design phase.
>
> **B3 cannot close with an unresolved Class A.**

## 1. Class A — resolved

| ID | Question | Decision | Rationale | Where |
|---|---|---|---|---|
| `B3-D-A001` | What are B3's aggregates? | **Two: `DiscoveryJob` and `Business`**, exactly as frozen `BACKEND_DOMAIN_OWNERSHIP.md` assigns them | a job is bounded and terminates; a Business outlives every job. One aggregate could not hold both lifecycles, which is why `discovery_results` exists as the join | ownership §1 |
| `B3-D-A002` | What is the difference between a provider result, a Business, a Discovery result, and a Lead? | **Four distinct concepts**: evidence, identity, provenance, intent. B3 owns the first three and never writes the fourth | conflating any two produces a specific nameable defect, listed in the table | identity §1 |
| `B3-D-A003` | How is an acquired Business identified? | **`(workspace_id, provider, provider_external_id)` → `business_id`** in `business_identities`; one Business may hold many identities | a provider ID is authoritative only within that provider; without `provider` in the key two providers can collide | identity §2–§4 |
| `B3-D-A004` | How are keywords and locations normalized? | a 10-step pipeline producing a **display form** (NFKC + trim + collapse) that is **dispatched**, and a **normalized key** (adds casefold, tatweel, harakat, alef, digits) used **only** for dedup and identity. `ة`/`ه`, `ى`/`ي`, article stripping, and stemming are excluded | over-normalizing the dispatched text changes search semantics in a language the design cannot reason about | request §2 |
| `B3-D-A005` | Are locations validated at admission? | **No.** An unresolvable location becomes a per-execution `PROVIDER_NO_MATCH`; a job of only such executions ends `completed` / `empty` | WazLink has no gazetteer, and asking a provider to validate is itself a billable call | request §2.3 |
| `B3-D-A006` | How many job states? | **Five**: `pending, processing, completed, failed, cancelled`. Partial success is `completion_kind` on a `completed` job, not a sixth state | a sixth state would render untranslated, be unreachable through the frozen status filter, and make partial results permanently invisible behind `status === "completed"` | state §1–§2 |
| `B3-D-A007` | When are results visible? | **Only while `job.status = completed`.** Persistence during execution is not visibility | the frozen frontend gates on it in two independent places; and an immutable set is what makes cursor stability free | state §5 |
| `B3-D-A008` | Does one failed combination fail the job? | **No.** ≥1 success ⇒ `completed` with `completion_kind = partial` | failing would discard paid-for provider data from the combinations that succeeded, and retry would spend it again | state §6 |
| `B3-D-A009` | What can auto-merge? | **Deterministic** identity, or **≥ 2 independent strong signals** (E.164 phone, registrable domain) with matching country and no contradiction. Everything else records a candidate | a wrong merge is irreversible; an unresolved duplicate is recoverable. The asymmetry sets the threshold | identity §5 |
| `B3-D-A010` | Can name similarity merge anything? | **Never** — at any threshold, in any language, with or without a shared city, category, or country | chains, franchises, branches, and translations all collide | identity §5.2 |
| `B3-D-A011` | Which job decides a conversion's provenance? | `source_job_ref` when supplied — **validated** against `discovery_results`; otherwise the **earliest** discovering job by `(discovered_at ASC, public_id ASC)` | total, deterministic, and it closes provenance forgery | identity §8 |
| `B3-D-A012` | How does B3 satisfy B2 consumed contract 9? | a **dedicated `BusinessRediscovered` event** carrying exactly B2's four fields, emitted **unconditionally** on rediscovery without reading CRM | a filtered `DiscoveryJobCompleted` would put Discovery internals inside CRM; reading CRM would invert the dependency. B2's guards already discard non-applicable events silently | B2 boundary §4 |
| `B3-D-A013` | What clock stamps `discovered_at`? | **WazLink's trusted server clock at ingestion**, never a provider timestamp | it makes B2's future-skew branch structurally unreachable at the source while B2's defence still runs | provenance §3.1 |
| `B3-D-A014` | Are raw provider payloads stored? | **hash always; bounded snapshot only under an explicit flag, PII-excluded, 30 days, never exposed** | "never store" loses reconciliation and normalization-bug diagnosis; indefinite multiplies the deletion, legal, and storage surface for value that decays in days | provider §7 |
| `B3-D-A015` | Where does provider pagination live? | **server-side execution state only.** The WazLink API cursor is independent and opaque | a provider token in a public cursor leaks vendor vocabulary, expires under the client, and breaks on a provider swap | pagination §1–§3 |
| `B3-D-A016` | What is the unit of quota? | **one `discoveryRuns` unit per admitted job**, reserved at admission, never re-charged by retry | matches the frozen frontend metric; predictable before submit; cannot be inflated by provider behaviour | quota §3 |
| `B3-D-A017` | Is quota released on cancellation? | **released** from `pending`; **retained** from `processing` | releasing after spend would give unlimited free provider calls by cancel-spam; retaining on `pending` would charge for nothing | quota §4 |
| `B3-D-A018` | What bounds provider fan-out? | 10 keywords, 10 locations, **50 combinations**, 5 pages per execution, ≤2000 results, 4 concurrent executions, 2 concurrent jobs, plus the frozen 10/hour submit limit ⇒ **≤ 250 provider calls per job attempt** | the worst case must be finite and computable in advance, not merely unlikely | quota §5 |
| `B3-D-A019` | Does B3 consume any domain event? | **No — zero.** Entitlement checks are synchronous calls; provider callbacks are transport | Discovery heads the journey; an inbound domain dependency would create a cycle and require knowledge B3 must not own | catalog §4 |
| `B3-D-A020` | Which provider ports does B3 define? | **none new** — it uses the frozen `PlacesProvider` and `ScrapingProvider`, with one shared normalized capability contract | frozen B0 already named them; inventing a `DiscoveryPort` would be gratuitous drift | provider §1 |
| `B3-D-A021` | Does B3 need new public-ID prefixes? | **No.** `JOB-`, `RES-`, `BUS-` are already registered in section A; nothing else is publicly addressable | `PUBLIC_ID_COLLISIONS = 0` and the frozen registry is untouched | data model §1 |
| `B3-D-A022` | Does B3 need new permission codes? | **No.** `discovery.run`, `discovery.view`, `discovery.export` already exist; cancel and retry bind to `discovery.run` with object scope | a fourth code would need a B1 amendment for an action already covered | authz §1, §3 |
| `B3-D-A023` | Does B3 need new error codes? | **No.** `ERROR_NEW_COUNT = 0` | every outcome maps to a frozen catalog code | retry §3 |
| `B3-D-A024` | Is Discovery a CRM timeline source? | **No.** B2's `source_domain` set `{messaging, pipeline}` is unchanged | a re-crawl would flood every Lead's timeline with entries nobody performed — B2's own stated reason | B2 boundary §6 |
| `B3-D-A025` | Is a minimum-viable Business defined? | **Yes**: a stable provider identity and a non-empty name. Every other field is optional | one invalid optional field must never discard an otherwise usable business | quality §4 |
| `B3-D-A026` | Is `category` an enum? | **No — free text** | providers use open, localized, evolving taxonomies; an enum would force everything unmapped to `other` and destroy the frozen frontend's derived category filter | quality §6 |
| `B3-D-A027` | Who resolves provider field disagreement? | **B3, deterministically**: most-recent → anchor → lexicographic, with the loser retained in field history. Never averaged, concatenated, or longest-wins | a reproducible winner is required; inventing a value no provider asserted is not | quality §5.1 |
| `B3-D-A028` | Does a retry mint a new job? | **No** — the same `JOB-*`, a new `attempt_no` | the frozen frontend navigates back to the same id after retry | state §3.2 |
| `B3-D-A029` | Does B3 define retry mechanics? | **No.** It classifies B3 conditions into frozen B0 classes and adds no row, number, or amendment | a classification is not a modification; a competing policy is the defect | retry §1 |
| `B3-D-A030` | Does B3 introduce a queue technology? | **No.** ADR-004's Celery + Redis stands; mechanism is B12's | no Kafka, no BullMQ, no new broker anywhere in this package | catalog §5 |

**`CLASS_A_UNRESOLVED = 0`.** All 30 Class A questions are decided.

## 2. Class A unresolved

**None.**

## 3. Class B — implementation preparation

Each may be settled during implementation preparation without changing an architectural contract.

| ID | Item | Why it is not Class A |
|---|---|---|
| `B3-D-B001` | the exact additive OpenAPI shapes for the amended `DiscoveryJobCreate`, `DiscoveryJob`, `DiscoveryResult` and the added responses | the field set and semantics are decided; only the serialized declaration remains |
| `B3-D-B002` | the exact DDL for the five additive tables and the precise `business_identities` key | every column, constraint, and index is specified; only the migration text remains |
| `B3-D-B003` | the `filters`/`sort` allow-list declaration for `GET /discovery/jobs` in the API catalog | the allow-list itself is fixed |
| `B3-D-B004` | the `>5 Businesses` shared-signal disqualification threshold | the *existence* of such a guard is Class A; the number is tunable |
| `B3-D-B005` | the additive event declarations for `DiscoveryJobCancelled` and `BusinessRediscovered` | payloads are fixed |
| `B3-D-B006` | the coordinate-proximity radius (75 m) for weak matching | weak signals never decide a link, so the radius cannot change an outcome class |
| `B3-D-B007` | provider pages per execution (5), concurrency (4 per job, 2 per workspace) | the presence of a finite bound is Class A; the values are operational |
| `B3-D-B008` | the duplicate-request suppression window | the mechanism is Class A |
| `B3-D-B009` | the free-host / aggregator deny-list for domain signals | maintained configuration |
| `B3-D-B010` | the workspace default region used for national-format phone parsing | a per-workspace setting |
| `B3-D-B011` | the workspace provider-budget ceiling | operational |

**`CLASS_B_UNRESOLVED = 11`.**

## 4. Class C — later design phases

| ID | Item | Owner |
|---|---|---|
| `B3-D-C001` | un-merge / merge reversal | a later Discovery phase; forward correction is available now |
| `B3-D-C002` | user-editable Business fields and the provider-refresh conflict rule | product + a later phase |
| `B3-D-C003` | a WazLink category taxonomy with provider mappings | a later phase |
| `B3-D-C004` | streaming partial results before completion | requires a frontend change too |
| `B3-D-C005` | exposing a failed or cancelled job's rows under an operator permission | operations |
| `B3-D-C006` | retrying only the failed executions of a completed job | product |
| `B3-D-C007` | overage, burst credits, per-provider metering, cost-based limits | **B8 Billing** |
| `B3-D-C008` | cross-job result caching | blocked on `B3-X-005` provider terms |
| `B3-D-C009` | website/enrichment fetching of a discovered URL | a separate capability |
| `B3-D-C010` | a `BusinessUpdated` event | **B4**, once a consumer exists |
| `B3-D-C011` | whether analysis is keyed by Business or by Lead | **B4** — already open as B2's `B2-D-B006` |
| `B3-D-C012` | the analysis trigger policy | **B4** |
| `B3-D-C013` | the analysis input fingerprint | **B4** |
| `B3-D-C014` | how B4 exposes results to Discovery surfaces | **B4** |
| `B3-D-C015` | whether an unanalyzed Business is convertible | product |
| `B3-D-C016` | file-import acquisition (`ScraperReferenceImport`, `file_import` source) | a later Discovery phase; Class D in the frontend trace |
| `B3-D-C017` | the concrete retry scheduler, dead-letter store, and replay tooling | **B12** |
| `B3-D-C018` | Discovery data retention durations | **PRODUCT / LEGAL** (frozen ADR-012) |

**`CLASS_C_UNRESOLVED = 18`.**

## 5. External validation register

Provider and legal facts B3 must not invent. All eight are listed in `B3_PROVIDER_ABSTRACTION.md` §8, plus `B3-X-009` in `B3_SECURITY_PRIVACY_LEGAL.md` §8: `B3-X-001` place-identifier stability · `B3-X-002` field masks and billing tiers · `B3-X-003` SKU/pricing · `B3-X-004` rate-limit signalling · `B3-X-005` Places terms · `B3-X-006` scraping provider contract · `B3-X-007` raw retention confirmation · `B3-X-008` Saudi personal-data obligations · `B3-X-009` lawful basis for outbound use of acquired contacts.

**None blocks design closure.** Each is isolated behind an adapter, a configuration value, or a retention duration, so learning the answer changes no contract in this package.

## 6. Decisions inherited rather than made

Recorded so no reader mistakes silence for an open question: ADR-001 through ADR-012; the frozen B0 event envelope, retry policy, idempotency standard, rate-limit policy, error catalog, and API standard; B1's roles, permissions, and authorization pipeline; and every B2 contract, all of which B3 consumes unchanged.
