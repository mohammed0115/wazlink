# B6 — Verification Matrix

> **B6 status:** Target design only. Self-authored mechanical verification — not an independent audit. Every counter below was recomputed from the actual committed files via `grep`/`comm`, not estimated, following the exact discipline this pack's own author applied auditing the prior B5 checkpoint.

## 1. Semantic verifiers, and how each resists a false positive

| Verifier | Method | Result |
|---|---|---|
| All acceptance IDs unique | `grep -oE "^\| AT-[A-Z0-9]+-[0-9]+ "` deduplicated vs. raw count | 128 raw = 128 unique → `DUPLICATE_ACCEPTANCE_TESTS = 0` |
| All failure IDs unique and contiguous | `B6-DF-001`…`B6-DF-039` enumerated, no gap, two rows explicitly marked "considered, not reachable" rather than silently skipped | `FAILURE_SCENARIO_GAPS = 0`, `FAILURE_SCENARIO_DUPLICATES = 0` |
| All referenced acceptance IDs exist | every `AT-*` cross-reference in this pack points into `B6_ACCEPTANCE_TESTS.md`'s own defined set (no external AT-* namespace is referenced) | `UNDEFINED_AT_REFS = 0` |
| All referenced failure IDs exist | every `B6-DF-*` cross-reference points into `B6_FAILURE_CATALOG.md`'s own 001–039 range | `BROKEN_FAILURE_REFS = 0` |
| All decision references exist | `comm -23` of every `B6-D-[ABC][0-9]+` cited anywhere in the pack against every one defined in `B6_DECISION_REGISTER.md` — **empty diff**, verified mechanically before this document was written | `UNDEFINED_DECISION_REFS = 0` |
| All event names declared | every event named in any document (`DealCreated`, `DealStageChanged`, `DealWon`, `DealLost`, `DealReopened`, `DealAssigned`, `DealUpdated`) appears in `B6_COMMAND_EVENT_CATALOG.md` §3's closed list — no document names a Deal event outside this set | consistent |
| All command names declared | every command named anywhere appears in §2's closed list | consistent |
| No RevenueEvent production by B6 | `grep`-checked: `RevenueEvent`/`RevenueRecognized`/`RevenueReversed` appear only in `B6_REVENUE_FIREWALL.md` and other documents' explicit negative-control/boundary prose — never as an output of any B6 command or event | `REVENUE_EVENT_PRODUCERS_IN_B6 = 0` |
| No recognized-revenue authority in B6 | no B6 DTO field is named or documented as revenue; `Deal.value` is explicitly labeled expected/proposed only, everywhere it appears | `RECOGNIZED_REVENUE_AUTHORITY_LEAKS = 0` |
| No B5 Message ownership leakage | no B6 command/table references `messages`/`conversations`/`message_deliveries` as a write target — checked against `B6_DOMAIN_OWNERSHIP.md` §6 and `B6_B5_MESSAGING_BOUNDARY.md` | `B5_OWNERSHIP_LEAKS = 0` |
| No B2 Lead/Contact ownership leakage | no B6 command/table writes `leads`/`contacts`/`lead_contacts`/`tasks`/`appointments`/`crm_activities` | `B2_OWNERSHIP_LEAKS = 0` |
| No B4 intelligence ownership leakage | no B6 command/table writes `intelligence_runs`/signals; no B6 command accepts a B4 run ID as authorization | `B4_OWNERSHIP_LEAKS = 0` |
| No B7 direct table-write authority | `B6_B7_AUTOMATION_BOUNDARY.md` §3 states it explicitly; no command exists outside the closed catalog for a future automation caller to use as a bypass | `B7_DIRECT_WRITE_LEAKS = 0` |
| No B0–B5 drift | `git`-verifiable: this authoring pass created only new files under `Docs/backend/B6/` plus (pending) one addition to `BACKEND_DOCUMENTATION_INDEX.md`; zero B0–B5 files were opened in write mode | `B0_DRIFT = B1_DRIFT = B2_DRIFT = B3_DRIFT = B4_DRIFT = B5_DRIFT = 0` |
| No implementation files | zero `.py`, `.sql`, migration, or Django/DRF file exists under `Docs/backend/B6/` or anywhere else from this pass | `IMPLEMENTATION_LEAKAGE = 0` |
| No B7/B8/B9 implementation leakage | no document in this pack designs B9 financial-recognition workflow in detail, starts B7, or writes B8 billing logic — each is explicitly named only at its boundary | confirmed by inspection of `B6_REVENUE_FIREWALL.md` §5, `B6_B7_AUTOMATION_BOUNDARY.md` |
| No broken cross-document references | every `B5_*`/`B2_*`/`B1_*`/`BACKEND_*` quotation in this pack is a verbatim excerpt read directly from the cited frozen file during authoring (not paraphrased from memory) | `BROKEN_CROSS_DOCUMENT_REFS = 0` |

**Resistance to false positives, stated explicitly per the task's own warning:** the mechanical checks above do not flag (a) example/wildcard prose — none exists in this pack in the way `B5-D-A0xx` existed in B5's; (b) historical/rejected names — `messaging.send`-style rejected-name prose does not occur here because B6 invented no rejected name to warn against; (c) negative-control rows — every `**NC**` row's cited invariant ID is checked to exist, not merely grepped as a bare string; (d) headings — `##`/`###` section markers are excluded from every ID-pattern count above by construction of the extraction regex (`^\| ` table-row anchoring, not a bare substring match).

## 2. What this document is not

This is **not** an independent verification. It is the author's own mechanical self-check, offered so the independent CTO audit that must follow has a starting mechanical baseline to re-derive and distrust-by-default, exactly as this pack's own author was instructed to do when auditing the prior (B5) checkpoint. Every number here should be re-run from scratch, not read off this table, by whoever performs that audit.
