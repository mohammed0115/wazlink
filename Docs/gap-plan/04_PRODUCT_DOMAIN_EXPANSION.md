# 04 — Product Domain Expansion

> Resolves brief §12 and §13. How three tracks converge on one model, and how 360 views generalize instead of multiplying.

## 1. The three tracks on one data model

| | Track A — Acquisition | Track B — Existing customers | Track C — Conversations & support |
|---|---|---|---|
| Entry | `DiscoveryJob → Business` | manual · CSV · API · form | WhatsApp inbound |
| First CRM object | `Lead` (`origin_kind=discovery`) | `Customer` **or** `Lead` (`origin_kind=manual\|import\|api`) | resolved party, **or nothing** |
| Converges at | `Customer` / `Lead` + `Contact` | same | same |
| Commercial outcome | `Deal` → `RevenueEvent` | `Deal` (± `Quote`) → `RevenueEvent` | `Ticket` **or** `Deal` |
| Revenue path | **identical** — `RecordRevenueEvent` only | identical | identical |

**One model, three doors.** The convergence point is `Customer`/`Lead` + `Contact`; everything downstream (Conversation, Deal, Task, Appointment, Quote, Ticket, RevenueEvent) is shared and unaware of which door was used. `customers.origin_kind` and `leads.origin_type` record the door for reporting and attribution — they never branch behavior.

## 2. Proving Track B works with zero Discovery (`GAP-005`)

Brief §12 requires proof. The acceptance obligation is stated as negative controls, mirroring B9's own `AT-TRACK-1/2` style:

| Control | Assertion |
|---|---|
| `GT-B-1` **NC** | A workspace with **zero** `discovery_jobs` rows creates a Customer, links Contacts, and opens a Conversation — **fails if any Discovery precondition is reached** |
| `GT-B-2` **NC** | Creating a Lead with `origin_type='manual'` requires no `business_id` — fails if a Business is fabricated (`B2-D-C001`'s explicit prohibition) |
| `GT-B-3` **NC** | Import commits with no `discovery_results` row anywhere — fails otherwise |
| `GT-B-4` | Tasks, appointments, deals, quotes, tickets, automation and analytics all operate on a Track-B Customer |
| `GT-B-5` | A Track-B Deal recognizes revenue and reports as **unattributed**, not as an error — already guaranteed by `B9_ATTRIBUTION_MODEL.md` §7 |
| `GT-B-6` **NC** | Discovery provenance is **preserved** where it exists — fails if Track-B changes erase `lead_provenance` for a Track-A Lead |

`GT-B-5` is the one that needs no new work: B9 already passes it (`AT-TRACK-3`, `AT-TRACK-4`).

## 3. New bounded contexts

Seven new Django apps, each with a single aggregate root. The count is deliberately small; every capability that could be an extension of a frozen domain **is** one.

| App | Aggregate root | Why a new app rather than an extension |
|---|---|---|
| `customers` | `Customer` | New commercial authority; B2 owns pursuit, not relationships |
| `identity` | `PartyIdentifier` | B2 explicitly disowned identity resolution (`B2_CONTACT_MODEL.md` §1) |
| `imports` | `ImportBatch` | Cross-domain writer; belongs to no single target domain |
| `customfields` | `FieldDefinition` | Serves five subject domains; cannot live in any one |
| `aiagent` | `AgentSession` | `B4-D-C002` names it *"a later, cross-cutting phase needing B2+B5+B6+B7"* |
| `knowledge` | `KnowledgeArticle` | New content authority; storage delegated to B11 |
| `support` | `Ticket` | New lifecycle; B2's activity model is not a case model |
| `catalog` + `quotes` | `Product`, `Quote` | New sales-document authority; **must stay outside B6** so Deal stays firewalled from documents |
| `assignment` | `AssignmentRule` | Serves Lead, Conversation, Ticket; belongs to none |

**Extended, not replaced:** B2 (Lead origin, Contact↔Customer), B5 (handling mode, routing), B6 (Quote↔Deal link), B7 (new triggers/actions), B11 (attachment subject enum), analytics (new selectors).

**Untouched:** B0 root contracts except the two registry/model amendments in `19_CONTROLLED_AMENDMENT_PLAN.md`, B1, B3, B4, B8, B9, B10, B12, B13.

## 4. Customer 360 — generalize Lead 360, do not copy it

Brief §13 asks whether Lead 360 should be extended, reused, parallel, or generalized. **Generalized.**

`B2_LEAD360_READ_MODEL.md` already composes a Lead 360 from **opaque objects supplied by owning domains** — intelligence from B4, conversations from B5, deals from B6, files from B11 — precisely because CRM-INV-4/5/6 forbid CRM copying them. That read model is already root-agnostic in everything but its entry key.

**Proposal: a `Party360` selector parameterized by root (`lead` | `customer`).**

| Section | Owning domain | Lead 360 | Customer 360 |
|---|---|---|---|
| Profile | B2 / customers | Lead + Business | Customer |
| Contacts | B2 | `lead_contacts` | `customer_contacts` |
| Intelligence | B4 | yes | only when a Business is linked |
| Conversations | B5 | yes | yes |
| Activities/Tasks/Appointments/Notes | B2 | yes | yes |
| Deals | B6 | yes | yes |
| Quotes | quotes | — | yes |
| Tickets | support | — | yes |
| Files | B11 | yes | yes |
| Custom fields | customfields | yes | yes |
| Revenue / attribution | B9 | read-only | read-only |

**Rules carried forward unchanged:** the read model copies no truth (CRM-INV-13); the timeline merges cross-domain entries **at read time** from `crm_activities` plus owning-domain projections; every section is independently permission-filtered, so a role without `deal.view` sees a Customer 360 with no Deals section rather than a denied page.

Why not parallel: two 360 read models would drift, and every future domain would have to be wired into both. Why not "Customer is a Lead subtype": it would inherit `business_id`, the discovery uniqueness rule and the Lead status machine, none of which apply.

## 5. Ownership rules for the new entities

| Entity | Owner | May write | May never write |
|---|---|---|---|
| `Customer` | `customers` | its own row, `customer_contacts` | `leads`, `deals`, `revenue_events`, `contacts` PII columns |
| `PartyIdentifier` | `identity` | its own index | any domain row |
| `ImportBatch` | `imports` | its own rows; invokes **owning-domain commands** for every record | target tables directly |
| `Ticket` | `support` | its own rows | `conversations`, `messages`, any financial table |
| `Quote` | `quotes` | its own rows; **links** to a Deal | `deals` state, `revenue_events`, `tax_invoices` |
| `KnowledgeArticle` | `knowledge` | its own rows; **references** `file_assets` | `file_assets` |
| `AgentProposal` | `aiagent` | its own rows | **anything else — the agent proposes, it does not execute** |

The `imports` rule is the one most often violated in practice: a bulk importer that writes target tables directly bypasses every command guard, quota check and audit row. **Import must call the same `CreateCustomer`/`CreateLead` commands a human uses.** This is the same principle B12 applies to `ReplayDeadLetter`, which *"re-invokes the owning domain's command"* rather than resurrecting rows.
