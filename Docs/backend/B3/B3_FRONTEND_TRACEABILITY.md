# B3 — Frontend Discovery Traceability

> **B3 status:** Trace only. **No frontend file is modified by B3.** Every row below was read from the working tree at the B2 checkpoint and carries a file:line citation. Nothing here is inferred from a B3 assumption.

## 1. Method

Every Discovery behavior reachable in the frozen frontend was traced from its component to the service layer (`client/src/services/index.ts`) to the domain fixture layer (`client/src/domain/data.js`). Each behavior is classified:

| Class | Meaning | Backend consequence |
|---|---|---|
| **A** | backend-authoritative requirement | B3 must specify a durable contract for it |
| **B** | frontend projection / read-model behavior | B3 must supply the *inputs*; the shaping stays client-side |
| **C** | mock/demo-only behavior | B3 must **not** reproduce it; it is a prototype artifact |
| **D** | future/deferred behavior | B3 records it and defers; it is not a Phase-1 obligation |

## 2. Behavior inventory — 52 behaviors

### 2.1 Discovery request form (`client/src/features/discovery/Discovery.tsx`)

| # | Behavior | Source | Class | B3 consequence |
|---|---|---|---|---|
| 1 | Keyword free-text entry, added as a chip | `Discovery.tsx:157-169`, `:250-262` | **A** | `keywords[]` is a required request field |
| 2 | **Multiple** keywords per request | `Discovery.tsx:264-268`; helper text "كل كلمة ستقترن بكل موقع محدد" `:269` | **A** | `keywords` is an array, expanded against every location |
| 3 | Location free-text entry, added as a chip | `Discovery.tsx:157-169`, `:276-288` | **A** | `locations[]` is a required request field |
| 4 | **Multiple** locations per request | `Discovery.tsx:290-294` | **A** | `locations` is an array |
| 5 | Input is `.trim()`-ed before it becomes a chip | `Discovery.tsx:159` | **A** | trimming is part of admission normalization |
| 6 | Exact-duplicate chip is silently dropped | `Discovery.tsx:163` (`if (!draft[key].includes(value))`) | **A** | duplicate collapse is a server rule, not a client courtesy — and the server must also collapse **case** variants the client does not |
| 7 | Empty input is rejected with a toast, no job created | `Discovery.tsx:160-162` | **A** | empty keyword/location → `VALIDATION_ERROR` |
| 8 | Chip removal | `Discovery.tsx:266`, `:292` | **B** | draft state only; never reaches the server |
| 9 | Source selected from a dropdown | `Discovery.tsx:298-307` | **A** | `provider_source` is a request field (frozen `DiscoveryJobCreate.provider_source`) |
| 10 | Source list carries a `status` of `active` or `mock` | `data.js:85-90` | **A** | the source catalog must expose availability; a `mock` source is not dispatchable |
| 11 | Combination preview: K keywords × L locations | `Discovery.tsx:42-45`, `data.js:449` | **A** | expansion semantics are exactly the cross product |
| 12 | Combination count shown before submit | `Discovery.tsx:310-315`, `:331-334` | **A** | server must return `combination_count`; client must be able to predict it |
| 13 | Combination list preview, first 4 then expandable | `Discovery.tsx:46-72` | **B** | pure presentation of a client-computed cross product |
| 14 | Advanced filter — minimum rating (`any`/`4`/`4.5`) | `Discovery.tsx:97-104` | **A** | closed value set in the request contract |
| 15 | Advanced filter — minimum reviews (`any`/`50`/`100`/`500`) | `Discovery.tsx:105-113` | **A** | closed value set |
| 16 | Advanced filter — website (`any`/`yes`/`no`) | `Discovery.tsx:114-121` | **A** | closed value set |
| 17 | Advanced filter — activity (`any`/`active`/`open`) | `Discovery.tsx:122-129` | **A** | closed value set; `open` ("open now") is provider-capability dependent |
| 18 | Result limit (`500`/`1000`/`2000`) | `Discovery.tsx:130-138` | **A** | closed value set; **2000 is the hard per-job result ceiling** |
| 19 | Availability checkboxes — phone / email / whatsapp / instagram | `Discovery.tsx:80-85`, `:139-147` | **A** | closed set of four boolean post-filters |
| 20 | Entitlement gate wraps the submit button | `Discovery.tsx:339-343` | **A** | `discovery.basic` capability gates the operation |
| 21 | Entitlement evaluated again on submit, with `usage_exhausted` distinguished | `Discovery.tsx:198-202` | **A** | server returns `ENTITLEMENT_LOCKED` vs `QUOTA_EXHAUSTED` distinctly |
| 22 | Submit blocked when keywords or locations empty | `Discovery.tsx:193-197` | **A** | server-side validation is authoritative; the client check is convenience |
| 23 | Job created, then navigation to the job detail route | `Discovery.tsx:204-206` | **A** | `POST` returns the job resource; `202` per frozen OpenAPI |
| 24 | "لا تتصل هذه التجربة بـGoogle Maps أو أي مصدر خارجي" prototype notice | `Discovery.tsx:219-224` | **C** | a prototype disclaimer; it disappears when the backend is real |
| 25 | `ScraperReferenceImport` panel | `Discovery.tsx:241` | **D** | file-import acquisition path; deferred, not Phase-1 Discovery |

### 2.2 Job lifecycle (`DiscoveryJob.tsx`, `DiscoveryJobs.tsx`, `simulation.ts`, `data.js`)

| # | Behavior | Source | Class | B3 consequence |
|---|---|---|---|---|
| 26 | Job status vocabulary is exactly `pending, processing, completed, failed, cancelled` | `data.js:91`, `data.js:490`, `DiscoveryJobs.tsx:80` | **A** | **five states, closed set.** A sixth state would not render and would be unreachable by the status filter |
| 27 | Numeric progress 0–100 with a progress bar | `DiscoveryJob.tsx:143-155`, `data.js:478` | **A** | `progress` is a server-reported integer percentage |
| 28 | Count strip: found / duplicate / final | `DiscoveryJob.tsx:157-161` | **A** | three counters must be server-reported |
| 29 | Count identity `found − duplicate = final` is asserted | `data.js:489` | **A** | a server invariant, not a display coincidence |
| 30 | **Results are available only when `status === "completed"`** | `data.js:436` (`isDiscoveryResultsAvailable`) | **A** | the single most load-bearing visibility rule in B3 |
| 31 | Results button rendered only when results are available | `DiscoveryJobs.tsx:143`, `DiscoveryJob.tsx:61` | **A** | consequence of #30 |
| 32 | Result count shows `—` until available | `DiscoveryJobs.tsx:133` | **A** | consequence of #30 |
| 33 | Results route itself re-checks and blocks | `DiscoveryResults.tsx:78-91` | **A** | the gate is enforced twice client-side; the server must enforce it once, authoritatively |
| 34 | Cancel offered only while `pending`/`processing` | `shared.tsx:13` (`isProcessing`), `DiscoveryJobs.tsx:151`, `DiscoveryJob.tsx:176-179` | **A** | cancel is valid only from a non-terminal state |
| 35 | Cancel is confirmed by a modal; the job stays in the log as `cancelled`, never deleted | `DiscoveryModal.tsx:54-90`, `data.js:480` | **A** | cancellation is a state transition, not a delete |
| 36 | Retry offered only for `failed` and `cancelled` | `DiscoveryJobs.tsx:163`, `DiscoveryJob.tsx:184-188` | **A** | `completed` is **not** retryable |
| 37 | Retry resets counters and re-runs **the same `JOB-*`** | `data.js:481` | **A** | retry opens a new attempt on the existing job; it does not mint a new public ID |
| 38 | Failure carries a human-safe message, and "لم يتم فقد أي بيانات محفوظة" | `DiscoveryJob.tsx:166-171`, `data.js:80` (`failureMessage`) | **A** | a failed job exposes a safe error, and failure is non-destructive |
| 39 | Job list filter by free text over name and id | `DiscoveryJobs.tsx:27` | **A** | server-side search over job name + public id |
| 40 | Job list filter by status | `DiscoveryJobs.tsx:28`, `:81-89` | **A** | allow-listed filter |
| 41 | Job list filter by source | `DiscoveryJobs.tsx:29`, `:90-97` | **A** | allow-listed filter |
| 42 | Job list filter by date — `all` / `recent` / `today` | `DiscoveryJobs.tsx:19-23`, `data.js:437-438` | **A** | allow-listed filter; "today"/"recent" are workspace-timezone windows |
| 43 | Job list sort — `newest` / `oldest` / `results` | `DiscoveryJobs.tsx:34-40` | **A** | allow-listed sort keys |
| 44 | Job list columns: name, source, keyword count, location count, results, status, date | `DiscoveryJobs.tsx:105-114` | **A** | drives the list DTO field set |
| 45 | Job name derived as `"<keyword> — <location>[ + N مجموعات]"` | `data.js:465` | **A** | server-derived display name, deterministic from the request |
| 46 | Seven cosmetic processing stages | `DiscoveryJob.tsx:14-22`, `:24-31` | **C** | a fixed client-side animation driven by `progress`; **B3 must not model seven stages** |
| 47 | "تسريع المحاكاة" / "إكمال المحاكاة" force-complete button | `DiscoveryJob.tsx:71-75`, `:179` | **C** | a demo control with no backend counterpart |
| 48 | 900 ms client timer stepping progress by 16 | `simulation.ts:12-13`, `:22-32` | **C** | prototype simulation; real progress is server-reported |

### 2.3 Results, business, and the CRM hop (`DiscoveryResults.tsx`, `DiscoveryModal.tsx`)

| # | Behavior | Source | Class | B3 consequence |
|---|---|---|---|---|
| 49 | Result rows carry Business identity, category, city, rating, reviews, phone/email/website/instagram availability | `DiscoveryResults.tsx:340-372`, `data.js:44-49` | **A** | drives the normalized Business field set |
| 50 | Per-row and select-all batch selection | `DiscoveryResults.tsx:106-108`, `:290-299`, `:355-364` | **B** | selection is client state; the server sees only the resulting command |
| 51 | Business preview modal shows the **discovering job** and its source | `DiscoveryModal.tsx:90-131` | **A** | a Business must expose its acquisition provenance |
| 52 | Selected results route to **Excel export** or **explicit CRM conversion**; conversion counts `created` vs `duplicate` and never duplicates a Lead | `DiscoveryModal.tsx:132-207`, `data.js:579-593` | **A** | conversion is an explicit, human-initiated, **B2-owned** command. Discovery never performs it |

## 3. The canonical journey, traced end to end

| Hop | Frozen frontend evidence | Owner |
|---|---|---|
| Discovery request → `JOB-1028` | `createDiscoveryJob(config)` builds a job from `keywords`, `locations`, `sourceId`, `filters` — `data.js:460-475` | **B3** |
| `JOB-1028` → `BUS-1042` | `businesses` rows carry `discoveryJobId:"JOB-1028"` — `data.js:44-46`; `getJobResults` filters by `job.resultBusinessIds` — `data.js:448` | **B3** |
| `BUS-1042` → intelligence | `getBusinessIntelligence(businessId)` — `DiscoveryResults.tsx:29`, `domain/intelligence.js` | **B4** (not designed) |
| `BUS-1042` → `LEAD-1042` | `convertBusinessToLead` — `data.js:579`; carries `sourceJobId: job.id` — `data.js:587` | **B2** (frozen) |

`LEAD-1042` stores `businessId:"BUS-1042"` and `sourceJobId:"JOB-1028"`, which is precisely B2's `lead_provenance` shape. **B3's obligation is to make `business_public_id` and the deciding `discovery_job_public_id` stable and permanently resolvable** — that is the whole of what B2 needs from B3 at conversion time.

## 4. Behaviors B3 deliberately does not reproduce

| Frontend behavior | Why B3 does not adopt it |
|---|---|
| `business.discoveryJobId` — a **single** job per Business (`data.js:44`), asserted by the mock integrity check `resultsOwnership` (`data.js:491`) | This is the prototype's simplification and it is **wrong for the real domain**. One real business is routinely found by several keywords, locations, jobs, and providers. B3 replaces the single scalar with the `discovery_results` provenance table (`B3-INV-4`). This is the single most important divergence in the package, and `B3_ACQUISITION_PROVENANCE.md` §2 justifies it in full. |
| Seven fixed processing stages | A client animation keyed off `progress` (`DiscoveryJob.tsx:24-31`), not a domain state machine. B3 models query executions, which are real. |
| Client-side force-complete | No backend counterpart may exist; a job completes only when its executions terminate. |
| `foundCount = 1420`, `duplicateCount = 172` constants | Fixture scenario values (`data.js:467-468`). B3 specifies how the counters are *computed*, not what they equal. |
| Client-side result filtering and sorting over the loaded sample (`DiscoveryResults.tsx:31-66`) | Class **B**. These filters operate on intelligence fields B4 will own. B3 supplies the Business rows; it does not implement opportunity-tier filtering. |
| `SRC-*` treated as an entity | Frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §B: "`DiscoveryJob.provider_source` is a plain contract string, not an `EntityRef`". B3 keeps it a string. |

## 5. Counts

| Metric | Value |
|---|---|
| Behaviors inventoried | **52** |
| Class A — backend-authoritative | **44** |
| Class B — frontend projection | **3** |
| Class C — mock/demo only | **4** |
| Class D — future/deferred | **1** |

Every Class A behavior maps to at least one acceptance test in `B3_ACCEPTANCE_TEST_MATRIX.md` §2 and to a contract in `B3_API_DTO_CONTRACTS.md`.
