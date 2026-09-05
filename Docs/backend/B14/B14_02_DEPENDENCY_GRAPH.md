# B14_02 — Dependency Graph

> **`B14-FIX.1` repair — closes the `V-08` half that lived here, and aligns with `V-10`.** The previous revision drew the correct Gap chain (`GAP-014 ── GAP-012 ── GAP-013`) and was then contradicted by `B14_18`/`B14_28`, which scheduled `GAP-012`/`GAP-013` **before** `GAP-014`. Three documents told two stories. They now tell one.

## 1. Frozen-phase dependency spine

```
B0 root contracts (data model · API standard · public IDs · errors · idempotency · retry)
 └─ B1 Tenant/Identity/RBAC ──────────────────────────────────┐
     ├─ B3 Discovery (Business · DiscoveryJob) ───┐           │
     │   └─ B4 AI Lead Intelligence               │           │
     ├─ B2 CRM (Lead · Contact · Task · …) ◄──────┘           │
     │   ├─ B5 Messaging / WhatsApp                           │
     │   ├─ B6 Pipeline / Deals                               │
     │   └─ B7 Automation                                     │
     ├─ B8 Billing / Entitlements ─── B9 Revenue/Attribution  │
     │                                └─ B10 Tax / ZATCA      │
     ├─ B11 Files / Storage                                   │
     └─ B12 Async / Integration Platform ─────────────────────┘
          └─ B13 Security / Operations (cross-cutting over all)
```

> **The B3 → B2 edge is drawn deliberately.** Frozen `B2_LEAD_AGGREGATE.md` §1 gives `leads` two FKs into Discovery-owned tables (`business_id`, `source_job_id`). The previous revision drew B2 above B3, which is what made the impossible I2-before-I3 ordering look reasonable. **Schema-wise, CRM depends on Discovery's tables** — which is why `M04` precedes `M06` (`B14_04` §1), while Discovery's *features* still follow CRM.

**B12 and B13 are cross-cutting**: every provider-touching and every secured surface depends on them, so their substrate lands early (I12 completes rather than introduces — see §4).

## 2. Gap dependency chain — as approved, and as scheduled

Read directly from `03_MASTER_GAP_MATRIX.md` §§2–3:

```
GAP-025 (nav IA, FE-only) ───────────────────────────────┐
GAP-001 Customer ──┬─ GAP-002 Contacts UI                │
                   ├─ GAP-004 Lead→Customer              │  G0/G1
                   ├─ GAP-010 Custom fields              │
                   └─ GAP-006 Identity ──┬─ GAP-007 Merge (post-P0)
GAP-003 Manual Lead (CA-01 + CA-15) ─┬─ GAP-005 proof ───┘
                                     └─ GAP-008 Import ──┘  G2

GAP-015 KB ── GAP-014 AI Agent ── GAP-012 AI/Human mode ── GAP-013 Team inbox
                                                            ▲
GAP-022 Assignment ─────────────────────────────────────────┘        G3
```

**Scheduled completion positions** (`B14_28` §2), which now respect every edge:

| Gap | Depends on | Completes at |
|---|---|---:|
| `GAP-001/002/003/004/006/008/010` | see chain | **4** (I5) |
| **`GAP-005`** | 001, 003, 008 | **5** (I7) — needs a Deal |
| **`GAP-022`** | — | **8** (I6) — pulled forward, see §3 |
| **`GAP-013`** | 012 *(scoped)*, 022 | **8** (I6) |
| **`GAP-015`** | 001 | **9** (I13) |
| **`GAP-014`** | 015 | **9** (I13) |
| **`GAP-012`** | **014** | **9** (I13) |
| `GAP-007/011/016/017/021/023` | — | **15** (I14) |

## 3. The three sequencing rules

> ### Rule 1 — `GAP-006` with or before any Business-less intake
> From `CA-01` and risk `R-18`. `CA-01` narrows the CRM-INV-10 duplicate index to rows that **have** a `business_id`. **`GAP-006` identity resolution is the replacement duplicate control and MUST ship with or before `GAP-003` and `GAP-008`.** Shipping `CA-01` without it leaves Business-less Leads with no duplicate protection at all. **I5 contains `M07`, `M10` and `M11` together.**

> ### Rule 2 — `CA-15` with `CA-01`, never after
> From `V-04`. `CA-01` makes a Business-less Lead **insertable**; `CA-15` makes it **usable**. Frozen `B2_LEAD360_READ_MODEL.md` §1 declares `required: [lead, business]` and `B2_LEAD_AGGREGATE.md` §1 forbids every identifying attribute on `leads`. Registering `CA-01` alone produces rows that cannot be rendered, sorted or searched — and invites exactly the fake Business `B2-D-C001` forbids. **Both land in `M07`/`M10`, same slice.**

> ### Rule 3 — a gap completes only when its behaviour is executable
> From `V-08` and `V-M09`. `GAP-012`'s approved dependency is `GAP-014`. Its **schema and commands** are deliverable at I6; its **AI behavioural controls** are not, because `aiagent` does not exist until I13. A test asserting *"no AI path reaches `SendMessage`"* passes **vacuously** where there is no AI. Therefore:
> - **I6 delivers `GAP-012` GROUNDWORK** — column, default, three commands, CAS race, permissions. `T-CA02-1..4`.
> - **I13 COMPLETES `GAP-012`** — mode re-read at execution, proposals stop on takeover. `T-CA02-5..6`, `T-WA-7`.
> - **No slice closes on a vacuous test** (`B14_19` §4).

### Why `GAP-022` moved to I6

P0 `GAP-013` depends on post-P0 `GAP-022`. Leaving assignment at I14 (position 15) would have deferred a **P0** gap behind a **post-P0** one — the inversion `V-08` identified. `assignment` depends only on `memberships` (`M01`), touches no provider, and owns two tables. Delivering an approved post-P0 gap early to unblock a P0 gap is scheduling, not scope creep: **`GAP-022` remains `APPROVE_AFTER_P0` in the Gap Plan and is not re-classified.**

## 4. Slice ordering rationale

The order in `B14_28` §2 is derived from `B14_04` §4's FK edges, `B14_03` §5's import DAG, §2's Gap edges and `B14_20` §6's demo edges. **Five deviations from the original candidate numbering are deliberate and justified; the rest is preserved.**

| Deviation | Reason |
|---|---|
| **B12 substrate built inside I0/I1, not at position 12** | B12's outbox, inbox, queues and `provider_request_attempts` are prerequisites for B5, B8 and the AI agent. Building them at position 12 would force every earlier provider-touching slice to invent a temporary substitute. I12 is retained as the slice that *completes* reconciliation, dead-letter and operator surfaces |
| **Discovery schema (`M04`) inside I2, features at I3** | Frozen `leads` FKs make the tables a prerequisite for CRM. **Ownership stays with `discovery`**; only the schema moves (`B14_04` §1) |
| **I5 precedes I6** | Inbound WhatsApp identity resolution needs `party_identifiers` |
| **I7 at position 5** | `GAP-005` (P0) needs a Deal on a Track-B Customer. I7 depends only on I2 and I5 and needs no provider |
| **I13 after I6** | The agent proposes into conversations; the conversation must exist first — and `T-CA02-5..6` need real queued work against a real conversation |

## 5. Provider dependency map

| Position | Slice | Provider | Blocking? |
|---:|---|---|---|
| 1–5 | I0, I1, I2, I5, **I7** | **none** | Core CRM, Customer, Identity **and Deals** need **no provider credential at all** |
| 6 | I3 Discovery | Google Places · Scraping | Domain built provider-free; adapters activate later; scraping **must not be enabled** (`B12-D-A054`) |
| 7 | I4 Intelligence | AI (or stub) | Deterministic stub is sufficient |
| 8 | I6 Messaging | Meta WhatsApp Cloud | Domain built first; adapter activates on credentials |
| 9 | I13 AI Agent | OpenAI | Same |
| 11 | I9 Billing | Tap | Same |

**Consequence: implementation can proceed from I0 through I7 — including DEMO A1 and DEMO A2, the complete Track-B proof — with zero provider credentials configured.**

## 6. Circular-dependency prohibition

Module dependencies form a **DAG**, defined in `B14_03` §5 over the **five edge classes `A`–`E`** of `B14_03` §4 — **only class `A` (a static import between apps) constrains layering**, and `B14_03` §4a publishes the walker rules that decide the classification so it cannot be reinterpreted. A Django FK declared by **string reference creates no import** and constrains migration order only.

**Read composition is class `E`.** `party360` is composed by **`analytics` (L10)**, above every contributing domain, through the `common/party360/` registry — **not** by `crm`/`customers` reaching upward into `intelligence`, `messaging`, `pipeline`, `revenue` and `support`, which was `N-01`'s 7 upward edges, 2 same-layer edges and 5 cycles (`B14_03` §5a).

**The `activities`/timeline merge is class `E` on the same boundary.** It is composed by **`analytics`'s `TimelineComposer`** from three registered contributors — `crm`, `messaging`, `pipeline` — each supplying only its own entries. It is **not** composed by `crm` reaching upward into `messaging` and `pipeline`, which was `N-09`'s 2 upward edges and 2 cycles (`B14_03` §5e). Frozen `B2_NOTE_ACTIVITY_TIMELINE.md` §3 forbids the alternative independently: a cross-domain entry is **never** copied into `crm_activities`, so no event-based workaround exists either.

**Infrastructure dispatch is class `D`.** `platform_async` invokes an owning domain's command **by registered name** through `common/dispatch.py`, never by import (`B14_03` §6a).

**`billing`(L4) → `entitlements`(L3) is the only direction between them.** `EvaluateEntitlement` reads `entitlements`-owned rows only (`B14_03` §6b).

Cross-domain reads go through the owning module's **public selector**; cross-domain writes go through the owning module's **command**. Direct ORM access to another app's models is prohibited (frozen B8 rule: *"never raw SQL/ORM cross-app import"*).

Two-way *behavioural* needs are resolved by **events**, never by a mutual import: the producer emits through the outbox; the consumer subscribes. This is why `imports` calls `CreateCustomer` rather than writing `customers`, and why `support` links to a conversation rather than writing `messages`.

**`crm ↔ customers` is not a cycle**: the only import edge is `customers → crm`, and `contacts.customer_id` is a string FK written by a `customers` command (`B14_03` §5). **`T-ARCH-1` tests the graph as documented**, not an idealized one.
