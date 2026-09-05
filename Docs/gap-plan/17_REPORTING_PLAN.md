# 17 — Reporting Plan

> Resolves brief §25. **Additive selectors only. Recognized revenue keeps exactly one source.**

## 1. The invariant, restated

`BACKEND_ANALYTICS_SEMANTICS.md` and B9 fix recognized revenue as a sum over `revenue_events.recognized_at`. **No report in this plan derives recognized revenue from a Won Deal, an Accepted Quote, pipeline value, quote totals, or customer counts.** Where those figures appear they are labelled as pipeline, quote or count metrics and are visually and semantically separated from revenue.

`B8` platform billing (WazLink→workspace) remains excluded from customer revenue, per the frozen rule *"Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent"* (CRM-INV-8).

## 2. New report sections

| Section | Metrics | Source of truth | Revenue coupling |
|---|---|---|---|
| Customer growth | new customers by period, by `origin_kind`, active vs inactive, owner distribution | `customers` | **none** |
| Lead → Customer conversion | conversion count and rate, median time-to-convert, by origin | `leads` + `customers` | **none** |
| Sales activity | tasks created/completed, appointments held, conversations per owner | B2 + B5 | **none** |
| Pipeline | open deals by stage, `weighted_value`, stage ageing | B6 | **explicitly a forecast**, never revenue (`AT-REV-5` NC) |
| Quotes | issued/sent/accepted/rejected/expired, acceptance rate, median time-to-accept | `quotes` | **none — quote totals are never revenue** |
| Support | tickets by status/priority/category, backlog, reopen rate | `tickets` | **none** |
| SLA | first-response and resolution attainment, breach counts by policy | `ticket_sla_clocks` | **none** |
| Conversation performance | volume, response latency, resolution rate, unassigned age | B5 | **none** |
| **AI vs human** | proposals created / accepted / rejected, acceptance rate by kind, conversations handled per mode, takeover frequency | `agent_proposals` + `handling_mode` events | **none** |
| Assignment | distribution by member, unassigned backlog, fallback frequency | `assignment` | **none** |
| Import | batches, success/failure/unknown counts, top failure reasons | `import_batches` | **none** |
| **Revenue & attribution** | **unchanged frozen B9 selectors** | `revenue_events`, `attribution_touchpoints` | the only revenue source |

**Eleven new sections, none of which touch revenue.** The twelfth is the existing B9 surface, unmodified.

## 3. Track-B attribution reporting

`B9_ATTRIBUTION_MODEL.md` §4's degradation ladder already reports Track-B revenue as `import`/`manual`/`api`/`form`/`referral`-attributed or as **unattributed**, and §7 guarantees *"revenue is never lost to missing provenance."* Reporting therefore needs **no B9 change** — it needs a chart that renders `unattributed` as a first-class, expected category rather than as an error, so a Track-B-heavy workspace does not read its own dashboard as broken.

## 4. AI-vs-human measurement caveat

The AI-vs-human section measures **proposal acceptance**, not "conversations resolved by AI", because in this architecture the AI never resolves anything on its own — a human sends every message. Reporting "AI resolved N conversations" would be false. `PD-015` asks whether an *assisted-resolution* metric (human resolved, AI proposal accepted along the way) should be published, and how it must be labelled so it is not read as autonomy.

## 5. Implementation posture

All sections are **read-model selectors** over owning-domain tables, composed at read time — never new mutable projections that could drift (CRM-INV-13). Every section is permission-filtered independently, so a role without `ticket.view` sees Analytics without the Support section. Row-level workspace scoping is inherited from each owning domain's selector; no report introduces a new query path around it.
