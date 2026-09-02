# B9 — Security, Privacy & Retention

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Threat posture

B9 holds the most consequential data in the product: the numbers a workspace reports as its revenue. The threats that matter are **fabrication**, **silent alteration**, **cross-tenant disclosure**, and **quiet erasure**.

| Threat | Mitigation | Control |
|---|---|---|
| Fabricated revenue | one command, one permission, human actor, resolvable evidence, full audit | `B9_REVENUE_RECOGNITION_POLICY.md` §1 |
| Silent alteration | no update path on any financial column | `AT-IMM-2` |
| Silent erasure | no delete path; `ON DELETE RESTRICT` inbound | `AT-IMM-3` |
| Over-reversal | row lock + bounded sum | `AT-CONC-4` |
| Cross-tenant read | workspace filter on every query; `404` never `403` | `AT-TEN-1`…`AT-TEN-4` |
| Privilege escalation via automation | automation holds no B9 permission | `AT-B7-2` |
| Escalation via a payment provider | no provider path into B9 at all | `AT-FW-4` |
| Escalation via the frontend | no client-side write path; permission checked server-side | `AT-FW-9` |
| Export exfiltration | export is permissioned, workspace-scoped, audited | §4 |
| Repudiation | every financial row names a membership; audit facts are immutable | §6 |

## 2. What B9 must never store

Inside `revenue_events`, `revenue_reversals`, `attribution_touchpoints`, `revenue_attributions` or reconciliation `evidence`:

- **no** card numbers, PAN, CVV, expiry, or any cardholder data
- **no** provider API keys, secrets, tokens, or webhook signing keys
- **no** raw provider payloads
- **no** bank account or IBAN details
- **no** authentication material of any kind

A `RevenueEvent` referencing a payment stores **only** the `PAY-*` public id. Everything else about that payment stays in B8, where it is already governed. This mirrors the frozen frontend's own checkout discipline (`FB-B9-035`: no card number or CVV is ever entered, and payment success creates no financial record).

## 3. PII minimisation

B9 stores **identifiers, not people**. It holds no name, email, phone number, address, or free-text customer description. The `lead_public_id`/`business_public_id` in an attribution snapshot are opaque references; the human-readable name is resolved live from B2/B3 at render time and never copied into a B9 row.

Reconciliation `evidence` is likewise restricted to identifiers, amounts, currencies and timestamps — never a provider payload and never a customer record.

`source_code` and `origin_kind` on touchpoints and attribution snapshots are bounded catalogue values and channel labels — never free text, never personal data.

The one free-text field per financial table (`note`) is operator-authored, capped at 1000 characters, and documented as **not** a place for customer PII. It is included in exports and audit and must be treated accordingly.

## 4. Export authorization

| Rule | Detail |
|---|---|
| Permission | `revenue.view` for anything carrying a monetary amount — including attribution exports, which do, and reconciliation cases, whose `evidence` may carry a refund amount (`B9_RBAC_TENANCY.md` §2a). `analytics.view` is required *in addition* on attribution surfaces, never instead |
| Scope | always the session's workspace; no cross-workspace export exists |
| Audit | every export writes an audit fact: actor, workspace, filters, row count, request id |
| Contents | exactly the API's own DTO fields — an export can never reveal more than the API. The frozen frontend's per-event attribution export (`FB-B9-053`) has fourteen columns and **all fourteen** are composable from op 6 (`B9_API_DTO_CONTRACTS.md` §2a). `B9-FIX.1` added op 6 but still omitted the export's `ownerId` and `touchpointCount`, so this rule and that export remained in contradiction for two columns; `B9-FIX.2` added `owner_ref`, `touchpoint_count` and `trace_status` and closed it. `AT-API-12` |
| Rate | subject to the frozen rate-limit policy |

## 5. Deletion, retention, and the customer-deletion interaction

| Data | Retention | Deletion |
|---|---|---|
| `revenue_events` | indefinite | **never** |
| `revenue_reversals` | indefinite | **never** |
| `revenue_attributions` | indefinite | **never** |
| `attribution_touchpoints` | indefinite | **never** |
| `financial_reconciliation_cases` | ≥ 24 months after closure | prunable thereafter; never while live |
| Audit facts | per frozen audit retention | never by B9 |

### The rule that matters most

> **Financial audit facts do not disappear because CRM data was deleted.**

If a Lead, Business, Contact or Deal is deleted or anonymised in B2/B3/B6, the `RevenueEvent` that referenced it **remains, unchanged, at its original amount**. Its `source_ref` becomes unresolvable; the event is still recognized, still counted, still exported. Reconciliation opens an informational `recognition_source_unresolvable` case so the dangling reference is visible rather than mysterious.

This is deliberate and non-negotiable: allowing a CRM deletion to alter a revenue total would make financial history a function of data-hygiene operations, and would hand anyone with CRM delete rights an untracked way to change reported revenue.

### Redaction rather than deletion

Where a subject-erasure obligation applies to a person, the resolution is **redaction at the referenced domain** (B2/B3 remove or anonymise the personal record) plus **suppression of resolved display names** in B9's read models. B9's own rows are unaffected because they contain no personal data to erase (§3) — only an opaque identifier and a number.

### Workspace deletion

Workspace deletion is a B1 concern. Whatever B1 decides, B9 states its own constraint: `revenue_events` and `revenue_reversals` are **never** deleted by any B9 code path, and B9 exposes no operation that removes them. If a workspace is purged wholesale by a platform-level process, that is a B1/platform decision executed outside B9's command surface, and it must be preceded by an export — B9 offers no way to recover an erased register.

## 6. Audit

Every state-changing B9 command writes one immutable audit fact through the frozen audit writer: actor membership, workspace, command name, target public id, request id, outcome, and — for failures — the failure code. Audit facts carry no secrets and no amounts beyond what the command itself recorded.

Because financial rows are themselves immutable and append-only, the audit log is corroboration rather than the primary reconstruction mechanism: the register *is* its own history.

## 7. Logging and telemetry

No secrets, no PII, no card data, and no raw provider payloads in logs, traces, metrics or error responses. Amounts may appear in **metrics** as aggregates (`B9_OBSERVABILITY.md` §2) but never as per-customer log lines. Error responses never reveal stack traces, SQL, internal ids, or another workspace's existence (`B9_FAILURE_CATALOG.md` §5).

## 8. Negative controls

`AT-SEC-1` **(NC)**: any B9 column or `evidence` payload containing card data, a secret, or a raw provider payload — fails.
`AT-SEC-2` **(NC)**: deleting a Lead/Business/Deal changing any revenue figure — fails.
`AT-SEC-3` **(NC)**: an export crossing a workspace boundary — fails.
`AT-SEC-4` **(NC)**: an unaudited export — fails.
`AT-SEC-5` **(NC)**: a customer name, email or phone stored in any B9 table — fails.
`AT-SEC-6` **(NC)**: a retention job deleting a `revenue_events` row — fails.
`AT-SEC-7` **(NC)**: an error response distinguishing another workspace's `REV-*` from a nonexistent one — fails.
`AT-SEC-8` **(NC)**: an export of monetary data authorized by `analytics.view` alone — fails (`B9-D-A038`).
`AT-SEC-9` **(NC)**: an export column that no B9 DTO field can supply — fails; the export is bounded by the API surface (§4, `AT-API-12`).
