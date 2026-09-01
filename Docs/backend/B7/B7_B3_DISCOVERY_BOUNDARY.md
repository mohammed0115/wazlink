# B7 — B3 (Discovery) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 consumes from B3

**Nothing in Phase 1.** No B3 event-consumer declaration names Automation anywhere in `B3_COMMAND_EVENT_CATALOG.md`, and no frontend evidence (`automationTriggerCatalog`, FB-A04) lists a Discovery-sourced trigger. `DiscoveryJobCompleted` is a plausible future trigger (task brief §10 names it as a candidate) but is deferred, Class B, pending either a frozen B3 consumer declaration or direct product evidence — the same evidentiary bar applied to every other excluded trigger candidate (`B7_TRIGGER_CATALOG.md` §3).

## 2. What B7 invokes on B3

Nothing. No B3 command is on the closed action catalog (`B7_ACTION_CATALOG.md` §1-2).

## 3. What B7 never does

Never writes `discovery_jobs`/`discovery_results`/`businesses`. Never bypasses B3's own provider/rate/cost admission (moot in Phase 1, since B7 has no code path into B3 at all).

## 4. Negative control

`AT-B3DISC-1` **(NC)**: an implementation adding a `discovery_job_completed` trigger without a corresponding frozen B3 consumer-declaration amendment — fails design review; `B7_TRIGGER_CATALOG.md` §1's evidentiary bar (frozen consumer declaration, dedicated boundary doc, or direct frontend evidence) is not met by product intuition alone.
