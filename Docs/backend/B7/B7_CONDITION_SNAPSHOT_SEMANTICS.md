# B7 — Condition Data / Snapshot Semantics

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Both — resolved, explicitly namespaced (Class A, `B7-D-A014`)

Conditions may evaluate against **both** the triggering event's payload (`event.*`) and a synchronous read of current authoritative domain state (`current.*`), and a rule author must name which one a given condition means — there is no ambiguous bare `deal.stage_id` field (the exact ambiguity the task brief's §14 example warns against).

| Namespace | Meaning | Freshness |
|---|---|---|
| `event.*` | the field's value as carried in the triggering event's own payload, exactly as delivered | frozen at the moment the event was produced — may be stale relative to the aggregate's current state by the time this condition evaluates |
| `current.*` | a synchronous, on-demand read of the live aggregate via the owning domain's own read path (e.g. `GET /deals/{id}` for `current.deal.*`) | as fresh as the read, taken at evaluation time, milliseconds before the run's condition check completes |

`B7_TRIGGER_CATALOG.md` §4 already listed which `event.*` fields exist per trigger (exactly the producing domain's frozen event schema). `current.*` fields are the intersection of that same field set with what the owning domain's read model actually exposes — never wider.

## 2. Which conditions require a synchronous domain read

Any condition naming a `current.*` field. Concretely: `current.deal.status`, `current.deal.value`, `current.lead.status`, `current.lead.priority` — anything an author wants evaluated against "the truth right now," not "the truth at the moment the trigger fired." `event.*` conditions require no additional read; they evaluate directly against the already-consumed event payload (`condition_snapshot` persists both, §4).

## 3. Stale-event behavior — resolved (Class A, `B7-D-A015`)

An `event.*` condition never re-reads live state — by definition it evaluates the payload as delivered, even if a later change has since superseded it (§`B7_EVENT_CONSUMPTION_MODEL.md` §5's out-of-order tolerance). A `current.*` condition always reflects the read at evaluation time regardless of how stale the *triggering* event was — this is the deliberate mechanism that makes `current.*` safe against out-of-order delivery: it never trusts the event's freshness, only its role as an admission signal ("something happened to this aggregate, go look at it now").

**Worked example (the task brief's own):** a rule with trigger `deal_stage_changed` and condition `event.to_stage_ref equals STG-PROPOSAL` evaluates strictly against what stage the event says the deal moved *to* — even if the deal has since moved again. The same rule authored instead with `current.deal.stage_ref equals STG-PROPOSAL` evaluates against wherever the deal actually sits *right now* — if a second, faster stage move already carried it past `STG-PROPOSAL` by evaluation time, the condition does not match, and no action fires for a state that no longer holds. Rule authors choose which guarantee they want; B7 does not silently pick one for them.

## 4. Snapshot persistence

`automation_runs.condition_snapshot` (`B7_DATA_MODEL.md` §3) stores both the `event.*` values used and any `current.*` values read, exactly as evaluated — so a historical run's audit trail (FB-D15) shows precisely what was compared, without requiring a second live read (which could now return a different answer) to explain a past decision.
