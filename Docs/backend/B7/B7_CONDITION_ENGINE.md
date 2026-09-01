# B7 — Condition Engine

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Closed DSL — resolved (Class A, `B7-D-A012`)

No Python, JavaScript, SQL, shell, or `eval()` of any kind, at any layer — matching the frontend's own architectural comment that "no expressions, no JavaScript, no executable templates" governs the condition authoring UI (`AutomationModal.tsx:3-6`). Every condition is `{field, operator, value}`, evaluated by a fixed interpreter over a fixed field/operator allow-list. This is directly evidenced and reused near-verbatim from `automationConditionFieldCatalog` (FB-A05).

## 2. Operators — justified individually

| Operator | Justified by | Applies to |
|---|---|---|
| `equals` / `not_equals` | evidenced (FB-A06), used by every field in the frontend catalog | enum, boolean, string, number |
| `is_known` / `is_unknown` | evidenced (FB-A06) — null/missing-field check | any type |
| `greater_than` / `greater_or_equal` / `less_than` / `less_or_equal` | `greater_than`/`less_than` evidenced (FB-A06) on `deal.value`; `_or_equal` variants added for completeness on the same numeric/timestamp types, zero new risk surface | number, timestamp |
| `in` / `not_in` | not evidenced by frontend, but required to express an enum field against a set without N repeated `equals`/`or` conditions once `B7_ACTION_AUTHORIZATION.md`-adjacent multi-value filters appear; included because every enum field already carries a closed `allowedValues[]` set to validate the operand against | enum |
| `before` / `after` | required for any timestamp-typed condition (none evidenced yet in Phase-1's actual trigger set, since no included trigger currently exposes a bare timestamp field beyond `occurred_at`, which is not user-conditionable) — **deferred, not included** (§4) | — |
| `changed` / `changed_from` / `changed_to` | evidenced structurally — `LeadStatusChanged`/`DealStageChanged`-shaped events already carry `from`/`to` in their frozen payload; a condition can express `event.from equals X` / `event.to equals Y` using plain `equals` against those two named fields, so a dedicated `changed_from`/`changed_to` operator would duplicate what `equals` on the right field already does — **not included**, avoiding operator proliferation | — |
| `contains` / `not_contains` | declared in the frontend's operator-label map (FB-A06) but never actually attached to any field's `operators[]` list in the same fixture (a dead declaration) — **not included** in Phase 1; no field currently justifies substring matching, and re-introducing it later is a pure additive change | — |

**Included operator set: `equals`, `not_equals`, `in`, `not_in`, `is_known`, `is_unknown`, `greater_than`, `greater_or_equal`, `less_than`, `less_or_equal`.** Ten operators, each justified above; `contains`/`not_contains`/`before`/`after`/`changed*` are explicitly deferred rather than silently omitted.

## 3. Field allow-list and type system

Every condition field belongs to exactly one trigger-compatible `entity_type` (`lead`, `task`, `appointment`, `deal`) and carries a fixed `data_type` ∈ {`enum`, `boolean`, `number`, `timestamp`}. The allow-list is the union of every field the relevant domain's frozen event/DTO already exposes for that `entity_type` — never an arbitrary property-path traversal (§6). Concretely for Phase-1: `lead.status`, `lead.priority`, `lead.owner_ref`; `task.status`; `appointment.status`; `deal.status`, `deal.value` (numeric); the mock's `deal.stage` enum-slug field is **not carried forward** (§4, per `B6_B7_AUTOMATION_BOUNDARY.md` §4's explicit instruction) — replaced by `deal.stage_ref` (an opaque `STG-*` reference, `equals`/`not_equals`/`is_known`/`is_unknown` only, since stages are workspace-configurable, not a fixed enum).

## 4. Type semantics

- **Null/missing-field:** `is_known`/`is_unknown` are the only operators legal against a field the event payload didn't populate; every other operator against a missing field evaluates to `false` (the condition does not match) rather than raising an evaluation error — a rule authored against a field that later becomes legitimately absent degrades to "does not match," never to a run-blocking exception.
- **Enum comparison:** exact string match against the field's `allowedValues[]`; a `value` operand outside the allow-list fails rule validation at author time (`B7_AUTOMATION_RULE_AGGREGATE.md` §4), never silently evaluates to false at run time.
- **Numeric comparison:** IEEE-754 double, matching every other domain's `value`/`weighted_value` numeric handling (`B6_API_DTO_CONTRACTS.md`).
- **Timestamp comparison:** not present in Phase-1's actual field set (§2) — deferred with the `before`/`after` operators together, so no timezone/DST semantics need resolving yet; when a timestamp-typed field is added, it inherits `B6_CURRENCY_MODEL.md`-adjacent precedent of storing/comparing in UTC only.
- **List semantics (`in`/`not_in`):** operand is a finite array of the field's `allowedValues[]` members; empty-array operand is a validation error at author time, never evaluated as "matches nothing" silently.
- **String comparison:** enum fields only use exact match (§ above); no free-text string field is in the Phase-1 allow-list, so case-sensitivity/locale questions do not arise yet.

## 5. Invalid rule behavior

A condition referencing a field/operator combination outside §2-3's allow-list is rejected at `CreateAutomationRule`/`UpdateAutomationRule`/`ActivateAutomationRule` validation time (`B7_AUTOMATION_RULE_AGGREGATE.md` §4) with `422 VALIDATION_ERROR`. It can never reach evaluation — there is no runtime "unknown operator" branch to reason about, because a revision's `automation_rule_conditions` rows (`B7_DATA_MODEL.md` §2b) are only ever inserted after passing this validation, and the table's own `(field, operator)` check constraint refuses anything else.

## 6. Traversal safety — resolved (Class A, `B7-D-A013`)

Fields are matched by exact, enumerated `field` string against the fixed allow-list in §3 — never by dotted-path traversal into an arbitrary object (no `lead.metadata.raw_provider_response`-shaped access is possible, because the interpreter looks up a field by exact catalog membership, not by resolving a path expression against the event/aggregate object graph). This structurally prevents any condition from reaching a secret, provider payload, or any field a domain's own frozen DTO does not already expose publicly — the same boundary `BACKEND_PRIVACY_AND_DATA_HANDLING.md`'s data-class discipline enforces elsewhere in this corpus.
