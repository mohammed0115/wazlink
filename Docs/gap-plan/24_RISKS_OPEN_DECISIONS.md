# 24 — Risks and Open Decisions

> Resolves brief §43. Open decisions live in `27_PRODUCT_DECISION_REGISTER.md`; this document carries risk.

## Risk register

| ID | Category | Risk | Rating | Mitigation |
|---|---|---|---|---|
| `R-01` | Architecture | `CA-01` widens a frozen CHECK and relaxes a NOT NULL on the CRM's central aggregate. A mistake here corrupts the Lead model for both tracks | **HIGH** | The frozen CHECK is already written as an *implication*, so the shape was reserved. Every existing row satisfies the widened constraint with no backfill. Ship with `GT-B-2` (no fabricated Business) and a full Track-A regression |
| `R-02` | Data | Merge (`GAP-007`) rewrites which row a reference resolves to, across B5/B6/B9 | **MEDIUM (was HIGH)** — `PD-006` moved merge **execution** out of the P0 wave; only advisory detection ships early | Archive-not-delete; append-only lineage; **no immutable B9 row ever rewritten**; human-only with mandatory reason; negative controls in `CA-04` |
| `R-03` | Security | Public unauthenticated form surface (`GAP-009`) — the only such surface in the corpus | **LOW while deferred (was HIGH)** — `PD-010` APPROVED: API-first; the public surface is **not built** in this programme | `PD-010` recommends API-first, forms second; token-bound workspace binding; B13 rate limits; spam rejection **before** any CRM write; no PII echoed in responses |
| `R-04` | AI safety | Pressure to let the AI send autonomously to match competitors (E-10) | **MEDIUM (was HIGH)** | **`PD-013` APPROVED: no autonomous send in this programme** — the question is now a decided Owner position, not an open pressure. The ladder is structural, not configurable: the agent holds no permissions, accepted proposals run as the human, and no AI-owned send command exists. Any future change requires a separate architecture, product and safety decision plus B5/B7/B13 re-verification |
| `R-05` | Financial | A future contributor wires Accepted Quote or Won Deal to revenue | **CRITICAL if it occurs** | Four negative controls (`GQ-1`…`GQ-4`); no quotes-app code path reaches B9; Demo E demonstrates the firewall on stage by showing the revenue figure not moving |
| `R-06` | Scope creep | Nine new apps invite an ERP drift toward inventory, orders and vendors | **HIGH** | Brief §7 non-goals are recorded as **rejections with reasons** in `03` §4 and `02`, not as "later" — a rejection is harder to quietly reverse than a deferral |
| `R-07` | UX complexity | Navigation grows past usability | **MEDIUM** | `08` caps at 7 groups / 21 entries by demoting configuration into Settings; operating mode hides an entire track |
| `R-08` | CRM complexity | Custom fields become unbounded and un-reportable | **MEDIUM** | Typed side table (`PD-005`); definitions archived not deleted; per-subject caps (`PD-008`) |
| `R-09` | Provider | WhatsApp rate limits (E-16: 1 msg / 6 s per user) throttle AI-assisted volume | **MEDIUM** | B5's frozen rate/cost model already governs this. **Because AI never auto-sends, AI cannot generate send bursts at all** — the human gate is also a rate control |
| `R-10` | Support | SLA figures become untrustworthy without a business-hours policy | **MEDIUM** | `PD-014` defaults to 24/7 clocks, which cannot silently under-report a breach |
| `R-11` | Migration | Some future contributor auto-converts existing Leads into Customers | **MEDIUM** | `23` §2 states explicitly that no sweep or backfill may create a Customer; conversion is human-only and retains the Lead |
| `R-12` | Integration | An AI provider outage blocks the inbox | **MEDIUM** | The agent is assistive only. Degradation is *no proposals*, never *no messaging*; humans keep working. B12 health/dead-letter patterns apply |
| `R-13` | Governance | `inbox.copilot` appears in the intended `PLAN-GROWTH` catalog and in two shipped frontend routes, with **no owning backend domain** | **MEDIUM — `DESIGN-LEVEL ENTITLEMENT / DOMAIN OWNERSHIP MISMATCH`, `NON_BLOCKING`** | **Corrected from the earlier "live exposure" wording.** Independently verified: there is **no backend implementation at all** (`server/index.ts` is a static file server), B8 is *"Design only"*, and the frontend is entirely mock. **Nothing is sold, so nothing is over-sold.** `GAP-014` gives the capability an owning domain; `PD-003` APPROVED reuses the key |
| `R-14` | Timeline | G2 and G3 are both `VERY_HIGH`; running them together over-commits | **MEDIUM** | Dependency order forces G2 before G3; G5 is independent and can absorb parallel capacity instead |
| `R-15` | Security | Contacts list creates a bulk PII egress path that did not exist | **MEDIUM** | Blocked on `PD-002`; `contact.listed` is audited as a bulk-read event |
| `R-16` | Architecture | `GAP-027` Customer Portal needs an external principal B1/B13 do not model | **HIGH if attempted** | Classified `CONFLICT`, `CONFLICT_BLOCKED` for B14, and excluded from every release |
| `R-19` | AI / privacy | Sending customer data to OpenAI is a deliberate external PII egress | **MEDIUM** | Minimum-necessary context only; `PD-002` masking applied **before** egress; no prompt/completion text in logs, audit payloads or metrics; egress boundary documented in `29_AI_PROVIDER_ARCHITECTURE.md` §5 and `28_SECURITY_INTEGRATION_IMPACT.md`. Provider portability preserved by the port, so a provider change is an adapter change |
| `R-20` | Architecture | OpenAI semantics leak into CRM/Messaging/Support/Knowledge domains | **MEDIUM** | Prohibited by `29_AI_PROVIDER_ARCHITECTURE.md` §2; model name is configuration, never domain truth; verification asserts no provider token appears in a business-domain contract |
| `R-17` | Data governance | Custom fields become a covert PII store outside the redaction list | **MEDIUM** | Visibility is presentation, not authorization; guidance states sensitive data needs a real field with a real permission; B13 redaction applies to values in logs |
| `R-18` | Process | The plan is approved piecemeal and `CA-01` ships without `GAP-006` | **MEDIUM** | `CA-01` narrows CRM-INV-10's index; without identity resolution, Business-less duplicate Leads have **no** duplicate control. `19` states the dependency; G0 and G2 must not be split across it without an interim rule |

## Ratings summary
**CRITICAL 1** (conditional — `R-05` only if it occurs) · **HIGH 3** · **MEDIUM 15** · **LOW 1**.

Four risks fell a level as a direct result of the approved decisions: `R-02` and `R-03` because their capabilities left the initial wave, `R-04` because the Owner decided it, and `R-13` because independent verification showed the exposure was not live. Two new AI-provider risks were added.

## Two risks that already exist today

`R-13` (a catalog capability with no owning domain) and `R-15`'s precondition are **pre-existing conditions this audit surfaced**, not consequences of the plan. Both would remain if the plan were rejected outright. `R-15` is now closed by `PD-002` (masked for Viewer, enforced server-side); `R-13` is closed by `GAP-014`.
