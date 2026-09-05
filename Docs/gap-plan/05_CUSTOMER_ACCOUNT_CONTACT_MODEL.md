# 05 — Customer / Account / Contact Model

> **`PD-001` APPROVED.** One canonical `Customer` commercial party with `party_kind ∈ {organization, person}`. **Account is not introduced.**

## 1. The approved model

```
                    Customer  (CUS-*)   ── the commercial party
                        │
          ┌─────────────┴─────────────┐
   party_kind =                  party_kind =
   'organization'                  'person'
   a company we sell to           an individual we sell to
   (B2B — many Contacts)          (B2C — exactly one Contact)
```

**One table. One commercial truth. Two shapes.**

Minting both `Account` and `Customer` is the classic CRM duplication: two tables that both mean "the party we do business with", each accumulating its own name, owner and lifecycle. `B2-D-A004` already rejected exactly this shape once — the frozen frontend's `CMP-` Company row was refused because *"a Company row that only mirrors `Business.name` adds a second name authority and a third hop between Lead and Business for no product behavior."* That reasoning applies unchanged to Account, and to `PersonAccount`, `ConsumerAccount` and `OrganizationCustomer`, **none of which is created**.

## 2. The five distinctions, enforced

| Assertion | Enforcement |
|---|---|
| **Business ≠ Customer** | `Business` is a Discovery observation of the outside world (`B3_BUSINESS_IDENTITY_MODEL.md`). `Customer` is a **commercial relationship a workspace asserts**. A Business exists whether or not anyone sells to it; a Customer exists because a human said so. `customers.business_id` is **nullable** — present only when the relationship began in Discovery |
| **Lead ≠ Customer** | A Lead is a *pursuit decision*; a Customer is an *established relationship*. `GAP-004` converts one to the other, **retains the Lead**, and records lineage in `customers.origin_lead_id` |
| **Contact ≠ Lead** | Frozen and unchanged: a Contact is *"a way to reach a Business, recorded inside one Workspace… not a person record, not a global identity"* (`B2_CONTACT_MODEL.md` §1) |
| **Account/Organization ≠ Business discovery result** | Resolved by **not creating Account**. The organization-level record is `Customer` with `party_kind='organization'` |
| **No duplicate commercial truth** | Exactly one table answers *"who are we doing business with"*: `customers`. `businesses` answers *"what organizations do we know of"*. `leads` answers *"what are we pursuing"*. None copies another's attributes |

## 3. `party_kind` — the invariants

| # | Invariant |
|---:|---|
| **CUS-1** | `party_kind ∈ ('organization','person')`, `NOT NULL`, **immutable after creation.** A company does not become a person |
| **CUS-2** | `party_kind='organization'` ⇒ zero or more linked Contacts; at most one primary |
| **CUS-3** | `party_kind='person'` ⇒ **exactly one** linked Contact, which is always primary |
| **CUS-4** | `customers.business_id` may be non-null **only** when `party_kind='organization'` — a discovered `Business` is by definition an organization |
| **CUS-5** | The Customer row holds **no PII**. Name is a commercial label; phone, email and WhatsApp identity live on the Contact, for both kinds |
| **CUS-6** | Every downstream reference (Deal, Ticket, Quote, Conversation context, revenue source) targets `customer_id` and is **blind to `party_kind`** |

**CUS-6 is what makes this one model rather than two.** No downstream domain branches on party kind; a Deal against a person and a Deal against a company are the same Deal.

## 4. The question the brief demands be answered explicitly

> **Can an individual Customer have a Contact row? If yes, why is that not duplicate identity?**

**Yes — and it is required (CUS-3), not merely allowed.**

It is not duplication because **`Customer` and `Contact` answer different questions, even when they describe the same human**:

| | `Customer` (`CUS-*`) | `Contact` (`CON-*`) |
|---|---|---|
| Answers | *Who is the commercial party?* | *How do we reach them?* |
| Holds | ownership, status, origin, commercial lineage | name, phone, email, provider identity — **the PII** |
| Referenced by | Deals, Quotes, Tickets, revenue sources | Conversations (`conversations.contact_id`, **frozen B5**), messaging, identity resolution |
| Frozen definition | new | *"a way to reach… not a person record, not a global identity"* |

A Contact is a **reachability record**, not an identity claim — exactly what frozen B2 says it is. Keeping the individual's phone number on a Contact rather than on the Customer is what preserves three frozen properties simultaneously:

1. **Messaging is unchanged.** `conversations.contact_id` is frozen B5; a person-Customer's conversation links to its Contact like any other, with no B5 change.
2. **Identity resolution is unchanged.** The resolver walks `phone → Contact → Customer` for both kinds; `06_IDENTITY_RESOLUTION.md` needs no person-specific path.
3. **CRM-INV-18 holds.** Contact PII is never an identity key — no unique index on phone or email, at any scope. If the individual's phone lived on `customers`, the temptation to make it unique would be immediate, and that is precisely the silent-merge harm the frozen invariant forbids.

**Contact is therefore never turned into a global identity record.** It gains one nullable `customer_id` FK (`CA-05`) and nothing else.

## 5. Canonical relationship map

```
   Discovery ──▶ Business (BUS-*, B3) ──optional──┐
                     │                            │
                  Lead (LEAD-*, B2)               │ business_id (nullable,
                     │ origin_lead_id (nullable)  │  organization only)
                     ▼                            │
        ┌──────────────────────────────┐◀─────────┘
        │   Customer (CUS-*)           │
        │   party_kind: organization   │
        │              | person        │
        └──┬────┬────┬────┬────┬───────┘
           │    │    │    │    │
 customer_contacts   │    │    │
           │    │    │    │    │
      Contact (CON-*, B2)  │   │        ← holds ALL PII, both kinds
           │    │    │    │    │
           ▼    ▼    ▼    ▼    ▼
   Conversation Deal Ticket Quote  (all reference customer_id; blind to party_kind)
      (B5)      (B6) (new)  (new)
                     │        │
                     │  QuoteAccepted ──── link only, never revenue
                     ▼
              RevenueEvent (B9, immutable) ◀── ONLY via RecordRevenueEvent
```

**The arrow that does not exist is the important one.** No line runs from Customer, Deal, Quote or Ticket *into* `RevenueEvent`.

## 6. `customers` — proposed logical shape

| Column | Type | Null | Notes |
|---|---|:--:|---|
| `id` | uuid v7 | no | PK |
| `public_id` | text | no | `CUS-*` — registered under `CA-03` |
| `workspace_id` | uuid FK | no | tenant column |
| **`party_kind`** | text | no | **`organization` \| `person` — immutable (CUS-1)** |
| `name` | text | no | 1–160 chars. For `person`, the individual's commercial name; the authoritative contact detail still lives on the Contact (CUS-5) |
| `business_id` | uuid FK → `businesses.id` | yes | organization only (CUS-4) |
| `origin_lead_id` | uuid FK → `leads.id` | yes | set only by `ConvertLeadToCustomer` |
| `origin_kind` | text | no | `manual \| import \| api \| form \| lead_conversion \| discovery` — **aligned with B9's existing `origin_kind` closed set**, so attribution needs no translation layer |
| `status` | text | no | `active \| inactive` — not a sales stage |
| `owner_membership_id` | uuid FK | no | workspace-equality guard, as CRM-INV-16 |
| `archived_at`, `version`, `created_at`, `updated_at`, `created_by_membership_id` | | | B0 conventions |

**Explicitly absent** — each would create a second authority: `revenue`, `lifetime_value`, `balance` (B9) · `plan`, `subscription_status` (B8 — a *WazLink* customer is not a *workspace's* customer) · `score`, `tier` (B4) · `stage`, `deal_value` (B6) · `last_message_at`, `unread_count` (B5) · **`phone`, `email` (Contact owns them — CUS-5)** · `tax_number` (deferred with `B9-D-C004`).

**Constraints.** Unique `public_id`. Index `(workspace_id, status)`, `(workspace_id, party_kind)`, `(workspace_id, owner_membership_id)`, `(workspace_id, name)`. **No unique index on `name`** — identity is `CUS-*`, resolved through `GAP-006`, never by string match.

## 7. `customer_contacts`

Deliberately the **same shape** as frozen `lead_contacts` (`B2_CONTACT_MODEL.md` §3): `customer_id`, `contact_id`, `is_primary`, `linked_at`, `unlinked_at`, workspace column; unique `(customer_id, contact_id) WHERE unlinked_at IS NULL`; partial unique `(customer_id) WHERE is_primary AND unlinked_at IS NULL`.

For `party_kind='person'`, a command guard enforces CUS-3: exactly one active link, always primary; unlinking the sole Contact is refused. Reusing the proven shape lets one Contact serve a Lead **and** the Customer that Lead became, with no PII duplication — the property `lead_contacts` was built to guarantee.

`contacts` gains one nullable `customer_id` FK; `contacts.source` widens with `manual_customer` and `import` (`CA-05`).

## 8. Lifecycle transitions — adopted and rejected

| Transition | Verdict | Justification |
|---|---|---|
| Business → Lead | **Keep** (frozen) | Track A, unchanged |
| Lead → Customer | **Adopt** (`GAP-004`) | Lineage preserved, Lead retained. Resulting `party_kind` is `organization` when the Lead had a Business, else chosen by the human |
| Manual → Customer (either kind) | **Adopt** (`GAP-001`) | Track B entry |
| CSV → Customer (either kind) | **Adopt** (`GAP-008`) | Bulk entry; `party_kind` is a mapped column |
| API → Customer | **Adopt** (`GAP-009`, deferred) | |
| Form → **Lead** | **Adopt** (`GAP-009`, deferred) | A form submission is an unqualified inbound |
| Form → Customer | **Reject** | Would let a public surface assert a commercial relationship |
| WhatsApp identity → resolve only | **Adopt resolution, reject creation** | An inbound message must never create a party |
| Business → Customer (skipping Lead) | **Reject** | Bypasses the pursuit decision and frozen conversion provenance |
| Customer → Lead (reverse) | **Reject** | No product evidence |
| `party_kind` change | **Reject** (CUS-1) | A company does not become a person |
| Customer hard delete | **Reject** | Archive-only, consistent with the corpus |

## 9. Discovery provenance when it exists

Preserved, not copied: `customers.origin_lead_id` → `leads.id` → the immutable `lead_provenance` snapshot written at conversion. B9's resolver walks `DEAL → LEAD → BUS → discovery_results → JOB` and *"every hop is optional"*, so a Track-B Customer yields a shorter chain and, at worst, unattributed-but-fully-recognized revenue. **No B9 change is required for either track or either `party_kind`.**

## 10. Customer 360 generalizes Lead 360

`B2_LEAD360_READ_MODEL.md` already composes from **opaque objects supplied by owning domains** (CRM-INV-4/5/6), so it is root-agnostic in everything but its entry key. The proposal is a `Party360` selector parameterized by root (`lead | customer`) — **not** a copied read model, and **not** Customer-as-a-Lead-subtype, which would wrongly inherit `business_id`, the discovery uniqueness rule and the Lead status machine. For `party_kind='person'`, the Contacts section renders the single Contact inline rather than as a list; every other section is identical.
