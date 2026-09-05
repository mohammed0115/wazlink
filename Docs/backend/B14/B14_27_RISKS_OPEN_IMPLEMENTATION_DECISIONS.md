# B14_27 — Risks and Open Implementation Decisions

> **`B14-FIX.1` rebuild.** The previous register held ten decisions and declared *"None blocks the start of implementation"* — which was true of the ten listed, but **nine material decisions were unregistered**, three of which met the blocker test (a security boundary, an authorization boundary, and schema semantics). All are now registered or closed.

## 1. Implementation risks

| ID | Risk | Rating | Mitigation |
|---|---|---|---|
| `IR-01` | **`CA-01`/`CA-15` (M07/M10) touch the CRM's central aggregate.** A mistake corrupts both tracks | **HIGH** | All five `CA-01` constraints migrated together; conditional CHECKs; `CA-15` adds **no schema change**; migration tested **forward on a populated DB**; `T-CA01-1..7` + `T-CA15-1..10` incl. 12 negative controls; reversible until the first non-discovery Lead |
| `IR-02` | **`GAP-006` slips behind Business-less intake**, leaving duplicates uncontrolled | **HIGH** | Same-slice rule: I5 contains `M07`, `M10` **and** `M11`; a DoD gate blocks I5 without all three; `T-SEQ-1` |
| `IR-03` | An agent implements several domains and calls it one slice | **MEDIUM** | `B14_24` rule 1; independent verification per slice; **all 16 slice contracts now complete**, so the prompt template resolves for every slice |
| `IR-04` | A negative control is weakened to make a slice pass | **MEDIUM** | Negative controls are a **permanent CI gate**; `T-META-2` fails on an empty `-m nc` selection; **`T-META-3` proves each control can actually fail**; verification re-reads them |
| `IR-05` | Provider contract guessed instead of verified | **MEDIUM** | `B14_33` `FI-B12-12` gate with per-fact discharge evidence; `B14_10` §6 in-slice verification; CI holds no live credentials |
| `IR-06` | **A secret leaks into a log, admin page or fixture** | **HIGH** | Redaction processor + `T-SEC-1..7`; **masked-is-still-secret** rule in Admin; `.env.example` scanned |
| `IR-07` | OpenAI semantics leak into a business domain | **MEDIUM** | `T-AI-5` greps domain packages; `T-AI-6` proves replaceability with a stub |
| `IR-08` | Pressure to let AI auto-send to match competitors | **MEDIUM** | `PD-013` decided; no AI-owned send command exists; `T-AI-1/2` and `T-WA-7` are negative controls **exercised at I13 where they are non-vacuous**; any change needs a new Owner decision + B5/B7/B13 re-verification |
| `IR-09` | **A future contributor wires a Deal or Quote to revenue** | **CRITICAL if it occurs** | `T-REV-1..4`; `RecordRevenueEvent` sole writer; **and `revenue` and `pipeline` are the same layer (L7), so `T-ARCH-1` fails on the import edge itself** (`B14_03` §5) |
| `IR-10` | Migration tested only on an empty database | **MEDIUM** | DoD requires a populated, production-shaped dataset; **CI stage 8 enforces it** |
| `IR-11` | A deferred capability is "just scaffolded" | **MEDIUM** | `B14_26` §5 asserts zero; **`T-RBAC-7` asserts the 7 deferred permission codes are never minted**; rejection ground in `B14_24` §5 |
| `IR-12` | Frontend cutover leaves a fixture fallback on API error | **MEDIUM** | `T-DEMO-2`: a completed domain's demo must pass with the fixture module **unreachable** |
| `IR-13` | Provider absence crashes the platform | **MEDIUM** | Two-tier startup validation; `T-ENV-3`; provider health never fails `/ready` |
| `IR-14` | Scraping vendor chosen under delivery pressure without a verification scheme | **MEDIUM** | `B12-D-A054` forbids enabling it; `T-DISC-6` is a negative control |
| `IR-15` | External PII egress to OpenAI exceeds minimum necessary | **MEDIUM** | Masking applied **before** egress — **including a Contact-derived `display_name`** (`CA-15`); minimum-context rule; no prompt text in logs/audit |
| **`IR-16`** | **A forwarded header is trusted before the topology guarantees it**, making rate limits bypassable and audit actor IPs forgeable | **HIGH** | `B14_31`: **trust-nothing default**; `SECURE_PROXY_SSL_HEADER` with `TRUSTED_PROXY_COUNT=0` **fails startup**; rightmost-untrusted derivation; **one parser only**; `T-PROXY-1..9` |
| **`IR-17`** | **A vacuous negative control closes a slice**, giving false assurance | **MEDIUM** | `B14_19` §4 vacuity rule; `T-META-3`; `T-SEQ-4` asserts no DoD references a test vacuous in its slice |
| **`IR-18`** | **A test ID is referenced but never defined**, so a traceability counter reports coverage that does not exist | **MEDIUM** | `B14_19` §1 definition rule; **`T-META-1` asserts `UNDEFINED_TEST_ID_COUNT = 0`**; `B14_26` counters computed over definitions |
| **`IR-19`** | **Django 5.2 LTS reaches end of extended support (2028-04) unplanned** | **LOW** | `ID-11`: migration to Django 6.2 LTS (2027-04 → 2030-04) scheduled **after I15**, never mid-programme |

**CRITICAL 1 (conditional) · HIGH 4 · MEDIUM 13 · LOW 1.**

## 2. Open implementation decisions

**Registered honestly, with the blocker test from `V-06`/`V-08` applied to each:** *does it change domain ownership, schema semantics, a security boundary, revenue ownership or the tenant model?*

| ID | Decision | Owner | Slice | Latest safe point | Source type | Changes architecture? | Blocks I0? | Blocks later? | Failure behaviour / safe default |
|---|---|---|---|---|---|:--:|:--:|---|---|
| `ID-01` | **Scraping vendor** + webhook verification scheme (`B12-D-B005`) | Platform | I3 | before enabling the connection | provider docs | No — port fixed | **No** | enabling only | Port + normalized contract built; adapter stubbed; **connection never enabled** (`B12-D-A054`) |
| `ID-02` | Google Places API surface, field masks, quota, attribution | Backend | I3 | before adapter code | **official Google docs** | No | **No** | I3 | **Verify from official docs before writing the adapter**; slice stops otherwise |
| `ID-03` | Tap API surface, status vocabulary, sandbox availability | Backend | I9 | before adapter code | **official Tap docs** | No | **No** | I9 | Verify in-slice; slice stops otherwise |
| `ID-04` | OpenAI request/response shape and default model value | Backend | I13 | before adapter code | **official OpenAI docs** | No — model is configuration | **No** | I13 | Verify in-slice; `OPENAI_MODEL` documented default |
| `ID-05` | Import batch cap, error-file retention, max custom fields (`PD-008`) | Product | I5 | in-slice | product | No | **No** | No | **Conservative defaults** (`CB-11`); inherits the frozen unresolved retention decisions |
| `ID-06` | SLA business-hours policy (`PD-014`) | Product | I14 | in-slice | product | No | **No** | No | **24/7 elapsed time** — the only assumption that cannot silently under-report a breach |
| `ID-07` | AI-assisted resolution metric (`PD-015`) | Product | I14 | in-slice | product | No | **No** | No | Proposal-acceptance metrics only |
| `ID-08` | Encrypted secret management (`B13-D-C003`) | Platform | post-V1 | post-V1 | product | No — resolver-only swap | **No** | No | **`.env` resolver**; swapping changes the resolver alone |
| `ID-09` | Celery per-queue concurrency and autoscaling | Platform | I15 | operational | operational | No | **No** | No | Conservative defaults; tuned from `queue_delay_ms` |
| `ID-10` | Object-storage vendor for B11 | Platform | I11 | in-slice | product | No — vendor is configuration | **No** | No | Port + adapter; vendor is configuration |
| **`ID-11`** | **Django 6.2 LTS migration** | Platform | post-I15 | **before 2028-04** | official Django docs | No | **No** | No | Remain on 5.2 LTS; scheduled, not drifting (`B14_29` §2) |
| **`ID-12`** | **Hosting provider and managed PostgreSQL/Redis vendor** | Platform | — | **before the first staging deploy** | deployment evidence | No | **No** — I0 runs on local + CI containers | **staging** | **None** — the gate must be closed deliberately; staging deploy refused (`B14_30` §6) |
| **`ID-13`** | **Reverse-proxy product, hop count, trusted-proxy identity** | **Platform + Security** (joint) | configured I0 | **before the first staging deploy** | **deployment evidence** | **No — the contract is fixed either way** | **No** | **staging + production** | **`TRUSTED_PROXY_COUNT=0`, forwarded headers ignored, scheme never inferred.** Fail-closed and fully specified (`B14_31` §4) |

### `ID-14` — CSP inline-style build check (`M-06`)

Frozen `B13_BROWSER_SECURITY.md` §2 fixes the CSP directive table but leaves **one** value conditional: `style-src` is `'self'` *"plus `'unsafe-inline'` **only if** the build tooling emits inline styles — a build-tooling fact to confirm at implementation time, not asserted here."* The pre-`FIX.2` pack carried that obligation nowhere, so it could have been silently resolved in either direction.

| Field | Value |
|---|---|
| Decision | Whether the production frontend build emits inline styles, and therefore whether `style-src` may drop `'unsafe-inline'` |
| Owner | **Frontend + Security** (joint) |
| Slice | verified in **I15** (browser-security hardening); **closed before production CSP hardening** |
| Source type | **Build evidence** — the actual production bundle, not a document or a recollection |
| Blocks I0? | **No** |
| Blocks production CSP tightening? | **Yes** |
| Safe default | **Retain `'unsafe-inline'` under the frozen B13 policy** and keep the obligation open. Tightening on an unverified assumption would break the SPA; loosening silently would lose the control |
| Failure behaviour | **`CSP_INLINE_STYLE_BUILD_CHECK = REQUIRED_BEFORE_PRODUCTION_HARDENING`.** Not verified ⇒ the directive stays as frozen B13 permits and the item stays open. **It is never recorded as verified without the build evidence** |

**No frontend file is modified in this pass** — `B14-FIX.2` is documentation-only, and the check is executed at I15 against a real build.

### Why `ID-13` is registered but does not block I0

`V-06` correctly held that an **unregistered** security-boundary decision is a blocker. The repair is not to invent a topology — it is to **specify the behaviour under both states** and register the gate:

- The **safe default is fully implementable at I0** and is the *correct* behaviour absent a verified topology: trust nothing, derive the client IP from the peer address, never infer the scheme from a header.
- The **misconfiguration is converted into a startup failure** (`T-PROXY-5`, `T-PROXY-6`), so the dangerous state is unreachable rather than merely discouraged.
- The gate has an **owner, a latest safe point, a source type and a failure behaviour**, and it blocks staging.

**No implementer is left to invent a security cell**, which was the actual defect.

### Decisions `B14-FIX.1` closed rather than registered

| Was | Now |
|---|---|
| Python / Django / DRF / Celery / PostgreSQL / Redis / driver versions | **Pinned** — `B14_29` §2, verified against primary sources 2026-09-05 |
| Dependency manager, lock strategy, test runner, lint/type tooling | **Pinned** — `B14_29` §§3–4 |
| Settings-module strategy | **Fixed** — `B14_29` §5 |
| CI/CD pipeline | **Defined** — `B14_30` §2, 16 stages |
| Container and deployment baseline | **Defined** — `B14_30` §3 |
| Class B tuned values | **Set** — `B14_32`, 35 rows; 7 carried as still-open with their frozen holder named |
| `FI-B12-12` re-verification | **Gated** — `B14_33`, four facts with per-fact discharge |
| Supply-chain baseline | **Gated** — `B14_34`; **the frontend scan is declared UNRUN, not clean** |
| `member` role permission cells | **Defined** — `B14_08` §4, 156 cells |
| Business-less Lead identity | **Decided** — `CA-15` |

## 3. Carried forward from the Gap Plan, still deferred

`GAP-009` public forms (`PD-010`) · `GAP-018/019/020` products & quotes (`PD-009` rejects Price Books) · `GAP-024` operating-mode onboarding (`CA-13`) · `GAP-026` email · **`GAP-027` customer portal — `CONFLICT_BLOCKED`**, requires an external principal B1/B13 do not model. **B1/B13 must not be reopened for it in this programme.**

**`CB-28` (RPO/RTO) and `CB-29`–`CB-35`** remain **Class C / carried-open**; `B14-FIX.1` closes none of them, because B13 did not (`B14_32` §§1, 6).

Rejected outright and not extension points to be quietly promoted: inventory · warehouse · vendors · purchase orders · payroll · full accounting/ERP · projects · native mobile · telephony/SMS · live chat · deal room · sales orders · price books · KB external crawling.
