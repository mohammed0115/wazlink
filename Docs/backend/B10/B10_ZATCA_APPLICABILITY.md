# B10 — ZATCA Phase Model & Applicability Mapping

> Design only. Answers brief §14 ("ZATCA PHASE MODEL") directly: what does officially-researched ZATCA architecture actually require, and how does it map onto `B10_TAX_APPLICABILITY_MODEL.md`'s five-state model. All facts here are cross-referenced to `B10_RESEARCH_REGISTER.md`; none is invented.

## 1. Official phase structure (`B10-X-001`, `VERIFIED`, fetched live from `zatca.gov.sa`)

- **Phase 1 — Generation.** Effective 4 December 2021. Taxpayers must generate and store tax invoices and notes through a compliant electronic solution. Applies to resident VAT-registered taxpayers (and any party issuing a tax invoice on their behalf); non-resident taxpayers are excluded.
- **Phase 2 — Integration.** Effective 1 January 2023, rolled out in waves by targeted taxpayer group, with each group notified at least six months before its own wave begins. Requires the electronic solution to integrate with ZATCA's own systems for **clearance** of standard tax invoices/notes and **reporting** of simplified tax invoices/notes.

## 2. Clearance vs. reporting (`B10-X-002`, `PARTIAL` — corroborated by multiple independent secondary sources; the specific ZATCA overview page fetched during this pass did not itself state the distinction)

- **Clearance** (standard tax invoices, B2B/B2G, and debit notes referencing them): the seller's system submits the document to ZATCA for real-time validation **before** delivery to the buyer; only the ZATCA-cleared, cryptographically-stamped version may be delivered.
- **Reporting** (simplified tax invoices, B2C, and credit notes referencing them): the document is issued and delivered to the buyer immediately; a copy is reported to ZATCA afterward, within a bounded window commonly cited as 24 hours (`B10-X-004`, `PARTIAL`).

## 3. Mapping onto `zatca_applicability` (`B10-D-A018`)

| `zatca_applicability` | Real-world equivalent | What B10 does |
|---|---|---|
| `unknown` | undetermined | nothing — pending-classification backlog only |
| `not_applicable` | non-resident, below VAT threshold, or otherwise not obligated | nothing — no `TaxInvoice` ever generated |
| `applicable_not_enabled` | Phase-1-obligated but Phase-2 integration not yet live (a real, common transitional posture — Phase 2 rolls out in waves over years) | generate + store locally only (§1's Phase-1 requirement), no transmission |
| `enabled` | Phase-2-integrated | generate, store, **and** submit via clearance/reporting per §2's routing |
| `suspended` | Phase-2-integrated entity with a temporarily paused integration | generate + store continues; submission queues for retry |

This mapping is why `applicable_not_enabled` is a first-class, expected state rather than a transient error condition — it is the architecturally correct representation of a taxpayer who is legitimately Phase-1-compliant while not yet Phase-2-integrated, which is the real, common, current situation for many Saudi businesses per the wave-based rollout (`B10-X-013`, wave thresholds).

## 4. What is Phase-1-architecture-decided now vs. gated

**Decided now, not reopened by future reconfirmation:** the five-state model, the two-path routing table, the generate-vs-submit split, the fail-closed unknown-outcome rule (`B10-D-A019`). **Gated behind `B10-D-B001`, `REQUIRES OFFICIAL ZATCA VALIDATION`:** exact XML/UBL schema, exact QR TLV encoding, exact cryptographic stamp algorithm, exact CSID onboarding call shape, exact ICV/PIH chaining mechanics, exact 24-hour-window edge-case handling. None of the gated items affects any Phase-1 architecture decision in this pack, because Phase-1's target deployment (§`B10_SCOPE_AND_OWNERSHIP.md` §1) never reaches `enabled`.

## 5. Non-invention statement

No ZATCA endpoint path, XML field name, QR encoding, or cryptographic algorithm detail is asserted anywhere in this pack. Where official documentation was fetched and read directly, it is cited `VERIFIED`; where corroborated only by concordant secondary sources, it is cited `PARTIAL`; where no source could be read at all (the Security Features Implementation Standard PDF), it is `UNRESOLVED`. See `B10_RESEARCH_REGISTER.md` for the full register.
