# V2-S6 Upgrade Reason Matrix

This matrix is derived from `EntitlementService.evaluate()`, `currentPlan()`, `planCatalog()`, and `usageFor()` through `upgradeProjection`. It is presentation-only and never grants access.

| State | Canonical source | User meaning | Product action | Upgrade action | Safety |
|---|---|---|---|---|---|
| `LOCKED` | `evaluate(capability).status === "LOCKED"` and `reason === "capability_locked"` | The capability is not included in the current plan | The gated product action remains blocked by `EntitlementGate` | Show the existing canonical Billing route with capability/reason query context only when `upgradeTarget` exists | No raw plan gating; query cannot grant access |
| `LIMITED` | `evaluate(capability).status === "LIMITED"`; usage is below a finite limit | The capability is available and has remaining allowance | Keep the normal product action available; show a small usage note where the gate is used | No interruption and no upgrade CTA by default | Limited is not treated as blocked |
| `EXHAUSTED` | `evaluate(capability).status === "EXHAUSTED"`; usage reaches the finite limit | The allowance is consumed | Block the unavailable gated action and show used/limit context | Show canonical Billing route only when EntitlementService supplies an upgrade target | Remaining is canonical and never invented |
| `AVAILABLE` | `evaluate(capability).status === "AVAILABLE"` | The current plan permits normal use | Render the normal product action without an upgrade interruption | None | Product action dominates commercial UX |
| `UNKNOWN` | Defensive projection fallback for an unrecognized future status or missing relation | Availability cannot be confirmed | Do not grant access or manufacture an action | No upgrade target is invented | Fail closed |

## Plan / Capability Mapping Actually Used

The projection does not create a second map. EntitlementService remains the source of the following canonical mappings:

| Capability | Usage dimension when applicable | S6 presentation label |
|---|---|---|
| `discovery.basic` | `discoveryRuns` | الاكتشاف الأساسي |
| `crm.core` | `leads` | إدارة العملاء |
| `export.csv` | none | تصدير CSV |
| `pipeline.core` | `leads` | مسار المبيعات |
| `inbox.copilot` | none | Inbox وCopilot |
| `automation.rules` | `automationRuns` | الأتمتة |

Usage pressure is deterministic and informational only: no usage metric means `unknown`; unlimited means `unlimited`; exhausted means `exhausted`; finite usage at 90–99% is `near_limit`; finite usage at 70–89% is `approaching_limit`; lower finite usage is `normal`. These thresholds do not block actions, alter entitlements, or create urgency claims.

Target plans are read from `EntitlementDecision.upgradeTarget` and resolved through the canonical `planCatalog()`. S6 never assumes Starter → Growth or Growth → Scale, never duplicates numeric pricing, and never changes subscription state from a contextual panel.
