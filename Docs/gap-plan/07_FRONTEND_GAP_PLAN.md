# 07 — Frontend Gap Plan

> Resolves brief §27. **No new screen where an existing WazLink screen can safely be extended.**

## 1. Classification summary

| Class | Count |
|---|---:|
| `NEW_SCREEN` | **14** (10 in the approved waves, 4 deferred) |
| `EXTEND_EXISTING_SCREEN` | **11** |
| `NO_UI_REQUIRED` | **6** |

Every screen below is Arabic-first RTL, responsive, and permission-gated at the API — **the frontend never grants authorization** (B13 invariant; frozen frontend already performs *zero* client-side authorization enforcement, which this plan preserves).

## 2. `NEW_SCREEN`

| # | Route | Screen | Type | User goal | Roles | Nav | Primary components | States | Mobile / RTL | API dep. | Acceptance |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| N1 | `#/customers` | Customers | List | Find/manage customers (both `organization` and `person`) | Owner, Admin, Manager, Sales(own), Viewer(ro) | العملاء › العملاء | Table, filters (status/owner/tag/custom field), search, bulk-select (deferred), "New Customer" | empty ("no customers yet — add one or import"), loading skeleton, error retry, `403` hidden nav, quota banner | card list <768px; RTL table dir | `GET /customers` | list paginates; filters compose; empty state offers **both** manual and import |
| N2 | `#/customers/:id` | Customer 360 | Detail | See everything about a customer | as N1 | from N1 | Profile header (with a `party_kind` badge), Contacts (a list for `organization`; the single Contact rendered inline for `person`), Conversations, Deals, Quotes, Tickets, Activities, Files, Custom fields, Timeline | missing-customer safe state (no fallback to another record), per-section permission-empty, per-section loading | stacked accordion sections | `GET /customers/{id}` + section selectors | each section loads independently; a `403` on one section renders that section absent, never a denied page |
| N3 | `#/contacts` | Contacts | List | Standalone address book | as N1 | العملاء › جهات الاتصال | Table, search by name, link-to indicator | empty, loading, error | card list | `GET /contacts` | **replaces the current `Placeholder`**; masking honors `B2-D-C008` |
| N4 | `#/contacts/:id` | Contact detail | Detail | One contact + its links | as N1 | from N3 | Profile, linked Leads, linked Customers, conversations | missing-contact safe state | stacked | `GET /contacts/{id}` | unlink never deletes |
| N5 | `#/imports` | Imports | List | See past/running imports | Owner, Admin, Manager | العملاء › الاستيراد | Table with status + progress | empty, running (live progress), failed | stacked | `GET /imports` | progress reflects async truth, never optimistic |
| N6 | `#/imports/new` | Import upload | Wizard 1 | Upload a CSV | as N5 | from N5 | Dropzone, file validation | file-too-large, wrong-type, virus-pending | full-width | `POST /imports` | reuses B11 upload gates |
| N7 | `#/imports/:id/mapping` | Import mapping | Wizard 2 | Map columns to fields | as N5 | from N6 | Column↔field mapper incl. custom fields, required-field indicator | unmapped-required blocking, auto-suggested mapping | vertical pairs | `PUT /imports/{id}/mapping` | cannot advance while a required field is unmapped |
| N8 | `#/imports/:id/preview` | Import preview / dry run | Wizard 3 | See what will happen before it happens | as N5 | from N7 | Sample rows, validation errors, **duplicate candidates**, counts | all-rows-invalid, partial-valid, zero-duplicates | scroll table | `POST /imports/{id}/dry-run` | **dry run writes nothing** — the load-bearing test |
| N9 | `#/imports/:id/results` | Import results | Detail | Outcome + fix failures | as N5 | from N8 | Summary counts, error table, **error CSV download** | partial failure (the normal case), full success, full failure | stacked | `GET /imports/{id}`, `…/errors.csv` | error export re-importable after correction |
| N10 | `#/inbox` (rebuilt) | Team Inbox | Split view | Work conversations as a team | Owner, Admin, Manager, Sales | المحادثات | Conversation list w/ assignment + mode filters, thread, composer, **AI/Human control**, assign, customer context panel | unassigned queue, no conversations, AI-paused banner, outside-service-window banner, consent-missing banner | list↔thread drill-down | `GET /conversations`, `POST …/assign`, `POST …/handling-mode` | takeover is a single action and **pauses AI immediately** |
| N11 *(after P0)* | `#/tickets` | Tickets | List | Manage support queue | Owner, Admin, Manager, Sales | الخدمة › التذاكر | Table, status/priority/assignee/SLA-breach filters | empty, breach-highlighted | card list | `GET /tickets` | SLA breach visually distinct |
| N12 | `#/tickets/:id` | Ticket 360 | Detail | Resolve one ticket | as N11 | from N11 | Header, SLA clock, customer context, source conversation, activity, resolution | missing-ticket safe state, paused-clock, breached | stacked | `GET /tickets/{id}` | clock reflects server truth, never client time |
| N13 *(after P0)* | `#/knowledge` | Knowledge Base | List | Manage articles | Owner, Admin, Manager | الخدمة › قاعدة المعرفة | Article table, status filter, search | empty, draft-only | card list | `GET /knowledge/articles` | draft never retrievable by AI |
| N14 *(DEFERRED)* | `#/quotes` + `#/quotes/:id` | Quotes | List + Detail | Build/send/track quotes | Owner, Admin, Manager, Sales | المبيعات › عروض الأسعار | Line editor, totals, status, linked Deal/Customer | draft, sent, accepted, rejected, expired | stacked editor | `GET/POST /quotes` | **accepted quote shows no revenue figure anywhere** |

## 3. `EXTEND_EXISTING_SCREEN`

| # | Existing screen | Extension | Why not a new screen |
|---:|---|---|---|
| X1 | `Crm.tsx` (`#/crm`) | "New Lead" action creating a **Business-less** Lead | The Lead list is already the Lead management surface |
| X2 | `Lead360.tsx` | "Convert to Customer" action + Customer link | The conversion belongs where the Lead is worked |
| X3 | `Lead360.tsx` | Contacts section gains add/link/unlink (currently render-only — the frozen `MISSING_TARGET_CONTRACT` in `B2_CONTACT_MODEL.md` §4) | Fixes an existing defect in place |
| X4 | `Lead360.tsx` + Customer 360 | Custom-fields section | Custom fields are an attribute of the record, not a destination |
| X5 | `Deal360.tsx` | Linked Quotes section + customer link | Deal detail already aggregates |
| X6 | `Appointments.tsx` | **Calendar view toggle** (month/week/day) over existing tasks+appointments | `GAP-021` is a view, not a domain — no new entity, no new permission |
| X7 | `Tasks.tsx` | Customer/ticket-scoped task filters | Same list, more scopes |
| X8 | `Analytics.tsx` | New sections: customer growth, conversion, support/SLA, conversation & AI-vs-human, import | Analytics is already section-routed (`#/analytics/:section`) |
| X9 | `Settings.tsx` | New sections: custom fields, assignment rules, forms, operating mode | Settings is already section-routed |
| X10 | `Dashboard.tsx` | Mode-aware KPI set (Track A / B / both) | Same dashboard, different projection |
| X11 | `Copilot.tsx` / `Agent.tsx` | Wire to the real `aiagent` backend (OpenAI behind the provider port, `PD-003`); render **proposals** with explicit confirm. **No autonomous send affordance exists** (`PD-013`) | The UI exists; only its backend is missing |

## 4. `NO_UI_REQUIRED`

| Capability | Classification | Justification |
|---|---|---|
| Identity resolution (`GAP-006`) | `SYSTEM_ONLY` | A resolver invoked inside the inbound pipeline. Its *output* surfaces in N10's context panel; the resolver itself has no screen |
| `party_identifiers` maintenance | `SYSTEM_ONLY` | Written as a side effect of contact/customer writes |
| SLA clock ticking (`GAP-017`) | `SYSTEM_ONLY` | Scheduled sweep on B12's `maintenance` queue; surfaced in N12 |
| API record intake (`GAP-009`) | `API_ONLY` | Programmatic surface; its *configuration* is X9. `PD-010` **APPROVED: API-first** — the authenticated surface is the only intake in scope; the public form UI is deferred |
| Outbox/reconciliation for new events | `SYSTEM_ONLY` | B12-owned; B13 operator surfaces already cover it |
| Merge execution (`GAP-007`) | **has UI** (in N2) | Listed here only to record that it is *not* system-only — merge must never be automatic |

## 5. Screens deliberately not created

`#/companies` and `#/calls` — currently orphan nav entries rendering `Placeholder`. **Recommendation: remove both from `navItems`.** `companies` is subsumed by Customers (`PD-001`: no separate Account entity); `calls` is a brief §7 non-goal (telephony). Leaving them as permanent placeholders advertises capability that will not ship. This is `PD-012`.

## 6. Cross-cutting requirements for every new screen

**Empty states** must offer the next action, and for Customers must offer **both** manual creation and import — an empty CRM that only says "no data" is the single largest Track-B onboarding failure. **Loading** uses skeletons, never spinners over stale data. **Errors** map to the frozen B0 error envelope and never leak internal IDs or another workspace's existence. **Permission states** hide navigation the role cannot use and render sections absent rather than denied. **RTL** is the default direction, not a mode: tables, wizards, timelines and the inbox split all mirror. **Accessibility**: labelled controls, keyboard-navigable wizards and inbox list, visible focus, and status conveyed by text plus color — never color alone (SLA breach and AI/human mode both depend on this).
