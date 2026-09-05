# 02 — Competitor Capability Matrix

> Read with `26_COMPETITOR_EVIDENCE_REGISTER.md`, which carries the sources. **A competitor capability is not a WazLink requirement.** The final column is this plan's recommendation, not a decision.

| # | Capability | Evidence | WazLink status | Relevant to WazLink? | Recommendation |
|---:|---|---|---|---|---|
| 1 | Contacts | E-08 | `BACKEND_DESIGNED_ONLY` | **Yes** — already designed, unsurfaced | Adopt: build UI (`GAP-002`) |
| 2 | Organizations / Accounts | E-08 | `MISSING` | **Yes** — Track B needs a commercial counterparty | Adopt as **Customer** (`GAP-001`); do **not** mint both Account and Customer |
| 3 | Leads | E-08 | `EXISTS_PARTIAL` | **Yes** — exists but Discovery-locked | Adopt: widen origin (`GAP-003`) |
| 4 | Deals / Opportunities | E-08 | `EXISTS_COMPLETE` | No gap | Reuse B6 unchanged |
| 5 | Forecast & Quota | E-08 | `EXISTS_PARTIAL` (`weighted_value`) | Partial | Reporting only (`GAP-023`); quota management rejected |
| 6 | Deal Room (customer microsite) | E-08 | `MISSING` | No | **Reject** — external-surface complexity, no WazLink evidence |
| 7 | Activities / Tasks / Notes / Appointments | E-06 | `EXISTS_COMPLETE` | No gap | Reuse B2 |
| 8 | Calendar and Events | E-06 | `EXISTS_PARTIAL` | **Yes** — no calendar surface | Adopt view-only (`GAP-021`); external sync stays `B2-D-C011` |
| 9 | Manual customer creation | E-08 | `MISSING` | **Yes — P0** | Adopt (`GAP-001`, `GAP-003`) |
| 10 | CSV import, field mapping, duplicate handling | E-04 | `DEFERRED_BY_DESIGN` (`B2-D-C002`) | **Yes — P0** | Adopt (`GAP-008`) |
| 11 | Web forms / Web-to-Lead | E-05 | `MISSING` | **Yes — P1** | Adopt (`GAP-009`) |
| 12 | API record creation | E-04 | `MISSING` | **Yes — P1** | Adopt as part of `GAP-009` |
| 13 | Custom Fields | E-06 (customization) | `MISSING` | **Yes — P0 (minimum safe)** | Adopt narrowly (`GAP-010`) |
| 14 | Tags | — | `EXISTS_COMPLETE` (`lead_tags`) | No gap | Reuse; extend to Customer |
| 15 | Assignment / Round Robin | E-18 (prompt only) | `EXISTS_PARTIAL` (manual only) | **Yes — P1** | Adopt bounded rules (`GAP-022`) |
| 16 | Products / Services | E-03 | `MISSING` | **Yes — P1** | Adopt minimal catalog (`GAP-018`) |
| 17 | Price Books | E-03 | `MISSING` | **No** — no segment-pricing evidence | **Reject now** (`PD-009`) |
| 18 | Quotes / CPQ | E-03 | `MISSING` | **Yes — P1** | Adopt minimal Quote+QuoteLine (`GAP-019`, `GAP-020`) |
| 19 | Sales Orders | E-17 (prompt only) | `MISSING` | No | **Reject** — brief §7 non-goal, no verified source |
| 20 | Inventory / Warehouse / Vendors / POs | E-01, E-17 | `MISSING` | No | **Reject** — brief §7 non-goals |
| 21 | Projects app | E-01 | `MISSING` | No | **Reject** |
| 22 | Help Desk / Cases (tickets) | E-02 | `MISSING` | **Yes — P1** | Adopt minimal (`GAP-016`) |
| 23 | SLAs | E-02 | `MISSING` | **Yes — P1** | Adopt minimal policy+clock (`GAP-017`) |
| 24 | Knowledge base / FAQs | E-02, E-09 | `MISSING` | **Yes — P1** | Adopt on B11 (`GAP-015`) |
| 25 | Customer Portal | E-02 | `MISSING` | Later | **Defer P2** (`GAP-027`) |
| 26 | Live Chat / Chatflows | E-02 | `MISSING` | No | **Reject** — WhatsApp-first differentiation |
| 27 | Email integration / campaigns | E-06 | `MISSING` | Later | **Defer P2** (`GAP-026`) |
| 28 | Reports / dashboards | E-06 | `EXISTS_COMPLETE` for Track A | **Yes — extend** | Extend (`GAP-023`) |
| 29 | Approvals | E-06 | `EXISTS_COMPLETE` (B7 approval queue) | No gap | Reuse B7 |
| 30 | Workflows / process automation | E-06 | `EXISTS_COMPLETE` (B7) | Extend triggers only | Additive to B7 |
| 31 | Mobile apps | E-01 | `MISSING` | No | **Reject** — brief §7 non-goal; responsive web only |
| 32 | AI predictive recommendations | E-07 | `EXISTS_COMPLETE` (B4) | No gap | Reuse B4 |
| 33 | AI chatbot answering customers | E-07, E-10 | `UI_ONLY` (`#/agent`) | **Yes — P0** | Adopt **governed** (`GAP-014`) |
| 34 | AI updates CRM fields autonomously | E-10 | `MISSING` | **Partially** | Adopt as *propose*, never *execute* — see `18_B0_B13_IMPACT_ANALYSIS.md` |
| 35 | AI assigns/closes chats autonomously | E-10 | `MISSING` | **No** | **Reject autonomy**; adopt as human-confirmed action |
| 36 | Human takeover with immediate AI pause | E-11 | `MISSING` | **Yes — P0** | Adopt (`GAP-012`) |
| 37 | Shared multi-agent team inbox | E-12 | `EXISTS_PARTIAL` (`assigned_to`, participants) | **Yes — P0** | Adopt UI + routing (`GAP-013`) |
| 38 | WhatsApp templates / opt-in / delivery status | E-13, E-14, E-15 | `EXISTS_COMPLETE` (B5) | No gap | Reuse B5 verbatim |
| 39 | Identity resolution from inbound message | E-10 (implied) | `MISSING` | **Yes — P0** | Adopt bounded (`GAP-006`, `GAP-007`) |
| 40 | Telephony / calls / SMS | `#/calls` nav slot | `MISSING` | No | **Reject** — brief §7 non-goal; resolve the orphan nav entry |

**Adopt: 21 · Extend: 5 · Reuse unchanged: 6 · Defer: 2 · Reject: 9.**
