# B7 — Controlled Amendments

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The bundle — 2 operations, 2 decisions, across 2 frozen artifacts

**`CONTROLLED_AMENDMENT_COUNT = 2`.** Mechanically searched: every B7 document that cites a frozen B0-B6 source was checked for whether it merely *reads* that source (no amendment) or asks it to *change* (amendment candidate). Two genuine candidates were found; both are additive; neither is assumed away.

| # | Frozen artifact | Frozen rule | B7 target rule | Decision | Classification |
|---|---|---|---|---|---|
| 1 | `BACKEND_PUBLIC_ID_REGISTRY.md` §A | No row exists for `AutomationRule` — §B explicitly rejects `AUTO-` as canonical for anything but frontend fixture identity | add a new §A row: `ARULE-` \| AutomationRule \| Automation \| AutomationRule \| Workspace-scoped \| `ARULE-01J...` | `B7-D-A002` | `ADDITIVE` — inserts one new row; changes no existing row's meaning, does not reassign `RUN-*` or any other prefix |
| 2 | `B2_COMMAND_EVENT_CATALOG.md` lines 69-70 | `AppointmentCompleted`/`AppointmentNoShowRecorded` consumer lists read "Analytics" / "Analytics" only | extend both consumer lists to "Analytics, Automation" | `B7-AMEND-01` (referenced from `B7_TRIGGER_CATALOG.md` §2) | `ADDITIVE` — extends two consumer-list cells with one new named consumer each; the event's own schema, producer, and every other consumer's behavior are untouched |

## 2. The items that are not purely additive, stated plainly

**None.** Both items above insert new content (a registry row; a consumer-list entry) without narrowing, renaming, removing, or contradicting any existing frozen sentence, row, or semantic. `NON_ADDITIVE_AMENDMENTS = 0`, `COMPATIBLE_CLARIFICATIONS = 0`.

## 3. What every item satisfies

1. **It is minimal.** Item 1 adds exactly the one row Phase-1 rule-CRUD genuinely needs (`B7_DOMAIN_OWNERSHIP.md` §5); item 2 adds exactly the two consumer-list cells direct frontend evidence (FB-D02) justifies, no more.
2. **It is non-destructive.** Neither item deletes, renames, or reinterprets an existing frozen row/cell.
3. **It is traceable.** Item 1 maps to `B7-D-A002` and to the registry's own explicit refusal to mint `AUTO-` as the rule prefix — a gap the registry itself flags rather than silently fills. Item 2 maps directly to FB-D02's frontend evidence and is applied only where that specific evidence exists (not, for instance, to `ContactAdded`/`LeadArchived`, which have neither frontend nor architectural pressure behind them).

## 4. What was deliberately *not* amended, despite temptation

- **B6's Deal-command list** (`CreateDeal`/`CloseDealWon`/etc.) is not amended to explicitly enumerate B7 as an automation-invocable caller — `B6-D-A026` already states the general rule ("a future automation-triggered Deal mutation must call the identical command... through the identical admission sequence") in a form that requires no per-command amendment; B7 choosing to invoke only `MoveDealStage` in Phase 1 is a B7-side scoping decision, not something B6's text needs to change to permit.
- **B5's `SendMessage`/`SendTemplateMessage`** are not amended for the identical reason — `B5-D-A025` and the reserved `senderType='system'` already anticipate exactly this caller.
- **`B2_COMMAND_EVENT_CATALOG.md`'s "Automation as actor" note** already names the five B2 commands B7 invokes — no amendment needed there; only the two consumer-list *cells* in item 2 needed extension, and only because those two specific events' consumer lists were silent while direct frontend evidence exists for them.

## 5. Blocking rules until the bundle is applied

Neither item blocks B7's own Phase-1 design work — both are read as *proposed* text in the relevant B7 documents (`B7_TRIGGER_CATALOG.md` §2, `B7_DOMAIN_OWNERSHIP.md` §5) and require CTO approval before an implementation agent may treat the registry/consumer-list as actually amended. No B7 command, event, or acceptance test *depends* on the amendment having already landed — `ARULE-` is simply the prefix B7's own schema uses (self-consistent within this pack regardless of when the registry file itself is edited), and `AppointmentCompleted`/`AppointmentNoShowRecorded` are simply two of B7's own thirteen trigger-catalog rows, each independently justified in `B7_TRIGGER_CATALOG.md` §2's own citation column.
