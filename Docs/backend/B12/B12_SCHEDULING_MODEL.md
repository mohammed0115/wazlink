# B12 — Scheduling Model

> Design only. Answers the brief's §47. Short, because scheduling is a small idea that is easy to grow into something dangerous.

## 1. What may be scheduled

> **`B12-D-A045`. A scheduled entry may only *detect* or *clean up*. It may never *decide*.**

| Entry | Cadence source | What it does |
|---|---|---|
| Outbox dispatch sweep | frozen `BACKEND_RECONCILIATION.md` cadence class | re-claims `pending`/`failed` rows and expired leases (`P-2`) |
| Receipt processing sweep | same | re-enqueues `queued` receipts (`P-4`) |
| Stuck-execution sweep | same | classifies heartbeat-stale `running` rows (`P-3`) |
| Unknown-outcome sweep | same | opens `P-1` cases; **first action is always a read-only lookup** |
| Integration health check | operations | runs the **safe** configuration check (`P-8`) |
| Retention cleanup | operations | prunes what `B12_DATA_MODEL.md` permits pruning |
| **Domain reconciliation** | the **domain's** frozen row | B12 *fires* the entry; the **domain's own** scan runs |

The last row is the whole shape of the boundary: eight domain reconciliation processes already exist in frozen `BACKEND_RECONCILIATION.md`, each with its own frequency and its own repair authority. B12 provides the clock. It does not provide the judgement.

## 2. What may never be scheduled

- A business action of any kind: a send, a charge, a conversion, a stage change, an entitlement grant.
- An automation trigger. **B7 owns trigger semantics** and Phase 1 has no time-based trigger at all (`B12_DOMAIN_FIREWALLS.md` §4).
- A financial write. B9's write paths are synchronous by its own frozen design.
- A retry that would exceed a domain budget (`B12-D-A038`).
- An automatic dead-letter replay (`B12_DEAD_LETTER_REPLAY_MODEL.md` §6).

## 3. Schedule configuration is not business truth

A Beat entry is deployment configuration. It carries no workspace scope, no entitlement meaning, and no audit significance of its own. Changing a cadence changes *how quickly a problem is noticed*, never *whether something is true*. This is why cadence tuning belongs to B13 while the **classes** and their **precedence rules** belong here.

## 4. Missed schedules are safe

Every sweep is idempotent and cursor-based, so a missed window means later detection, never lost detection. Frozen `B11_B12_ASYNC_BOUNDARY.md` §4 already articulates the posture for one domain: *"no asynchronous failure in B11 can grant access to a file, resurrect a deleted file, cross a tenant boundary, corrupt integrity data, or bypass a quota."* B12 generalizes it: **if every scheduled entry stopped forever, nothing would become incorrect — only stale.** Dispatch would lag, unknowns would stay unresolved, health would go unrefreshed. Every one of those is a latency or a cost, never a correctness or a security failure.

## 5. Single-firing

Multiple schedulers must not double-fire a sweep into double work. The guard is not a Redis lock but the sweeps' own idempotency: `FOR UPDATE SKIP LOCKED` claiming, partial-unique case constraints, and guard-already-false command preconditions. A Redis single-flight key is permitted as an efficiency measure and is never the correctness mechanism (`B12_CONCURRENCY_MODEL.md` §5).
