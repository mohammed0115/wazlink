# V2-S7 Route Matrix

| Route | Source | Expected context | Canonical IDs | Direct reload | Navigation entry | Empty state | Mobile | Verdict |
|---|---|---|---|---|---|---|---|---|
| `#/` / `#/landing` | `App.tsx` → Landing | Public marketing | none | PASS | Brand/public CTA | N/A | PASS | PASS |
| `#/login` | App public route | Demo login | session prototype | PASS | Public login CTA | safe demo state | PASS | PASS |
| `#/onboarding` | App public route | first-run workspace | workspace/session | PASS | Landing CTA | input validation | PASS | PASS |
| `#/dashboard` | Dashboard | workspace, KPIs, plan context | JOB/BUS/LEAD/CONV/DEAL as present | PASS | Sidebar/brand | projection-safe | PASS | PASS |
| `#/discovery` | Discovery | discovery setup and entitlement | JOB on creation | PASS | Sidebar/CTA | input guidance | PASS | PASS |
| `#/discovery/jobs` | DiscoveryJobs | job list | JOB-* | PASS | Discovery | empty job list | PASS | PASS |
| `#/discovery/jobs/:id` | DiscoveryJob | one job lifecycle | JOB-* | PASS for known; safe missing | list/results | missing-job PageHead | PASS | PASS |
| `#/discovery/results?job=:id` | DiscoveryResults | completed job results | JOB/BUS-* | PASS | Job detail | no/missing results | PASS | PASS |
| `#/intelligence?business=:id` | Intelligence | Business analysis/provenance | BUS/JOB-* | PASS | Results row | missing Business PageHead | PASS | PASS |
| `#/crm` / `#/leads` | CRM | lead collection | LEAD-* | PASS | Sidebar | empty Leads state | PASS | PASS |
| `#/crm/leads/:id` | Lead360 | Business, provenance, Intelligence, Inbox, tasks, appointments, deals | BUS/LEAD/CONV/DEAL/ACT-* | PASS for known; safe missing | CRM/related cards | missing Lead state | PASS | PASS |
| `#/inbox` / `#/whatsapp` | Inbox | conversation collection | CONV/LEAD/BUS-* | PASS | Sidebar/Lead context | no conversations | PASS | PASS |
| `#/inbox/:id` | Inbox | exact conversation | CONV/LEAD/BUS/MSG-* | PASS for known; safe missing | Lead360 row | missing conversation state | PASS | PASS |
| `#/tasks` | Tasks | task collection | TSK/LEAD-* | PASS | Sidebar/Lead context | empty tasks | PASS | PASS |
| `#/appointments` | Appointments | appointment collection | APT/LEAD-* | PASS | Sidebar/Lead context | empty appointments | PASS | PASS |
| `#/deals` | Deals | deal collection | DEAL/LEAD-* | PASS | Sidebar | empty deals | PASS | PASS |
| `#/deals/:id` | Deal360 | exact deal and Lead/Pipeline context | DEAL/LEAD/PIPE-* | PASS for known; safe missing | Deals/Pipeline/Lead | missing Deal state | PASS | PASS |
| `#/pipeline` | Pipeline | stages/open Deals | DEAL/PIPE/STAGE-* | PASS | Sidebar/Deal | empty pipeline | PASS | PASS |
| `#/automation` | Automation | rules/runs/approval queue | AUTO/AUTORUN/CONV/LEAD-* | PASS | Sidebar | no rules/runs | PASS | PASS |
| `#/automation/rules/:id` | Automation | exact rule | AUTO-* | PASS for known; safe missing | rule detail | missing rule state | PASS | PASS |
| `#/analytics` | Analytics | canonical analytics scope | RevenueEvent/Attribution/DEAL/LEAD-* | PASS | Sidebar | no-data selectors | PASS | PASS |
| `#/settings` | Settings | workspace/settings | workspace/session | PASS | Sidebar | safe sections | PASS | PASS |
| `#/settings/integrations` | Integrations | mock integration state | provider IDs only as local labels | PASS | Settings/Sidebar | safe mock state | PASS | PASS |
| `#/settings/billing` | Billing | current plan, usage, catalog | PLAN/INVOICE/CHK-* | PASS | Sidebar/Upgrade | safe plan state | PASS | PASS |
| `#/settings/billing/checkout` | Checkout | local checkout session | CHK/PLAN-* | PASS | Billing | safe form/error states | PASS | PASS |
| `#/contacts`, `#/companies`, `#/calls` | Placeholder | intentionally unimplemented product areas | none | PASS | Sidebar | explicit placeholder | PASS | PASS |
| unknown/malformed route | Placeholder fallback | safe generic fallback | none | PASS | direct hash | explicit fallback | PASS | PASS |
| malformed/unknown query | owning route | query ignored or safe context fallback | no invented ID | PASS | direct hash | safe base screen | PASS | PASS |

Route implementation is a single canonical hash router. Unknown IDs do not fall back to unrelated records. The S7 QA must verify these rows in the runtime and retain any deviations as findings rather than inventing routes.
