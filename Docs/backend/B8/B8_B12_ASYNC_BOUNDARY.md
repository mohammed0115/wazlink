# B8 → B12 Async & Integration Boundary

> B12 is not designed here (named forward-dependency only, per B2-FIX.3's precedent: "the retry scheduler, dead-letter store, and replay tooling belong to B12 — Async & Integration").

## 1. What B8 assumes exists (generic infrastructure, B12-owned when formally designed)

Celery task execution, scheduled/periodic task dispatch (for reconciliation sweeps and the period-boundary sweep), the transactional outbox dispatcher (ADR-005), and the dead-letter mechanism used when a retry class exhausts its bound (`BACKEND_RETRY_POLICY.md`). B8 uses these exactly as every prior phase (B3–B7) already does, inventing no B8-specific scheduling primitive.

## 2. What B8 owns instead

The **business semantics** of what runs on a schedule and why: which records are reconciliation-eligible (`B8_RECONCILIATION_MODEL.md` §1), the grace-window/period-boundary timing rules (`B8_SUBSCRIPTION_STATE_MACHINE.md` §4), and the retry/dead-letter *classification* for payment-specific failure classes (already frozen rows in `BACKEND_RETRY_POLICY.md`: "Payment pending," "Payment final failure," "ZATCA unavailable"). B12, when designed, would own the generic scheduler/queue mechanics that execute these B8-defined jobs — B8 does not design a second scheduler.

## 3. No B8-specific async primitive

B8 introduces no new queue, no new worker framework, no new outbox variant. Every asynchronous B8 operation (`CreatePayment`'s `202` response, the renewal-charge scan, the reconciliation sweeps) is a Celery task dispatched through the same transactional-outbox mechanism every other domain uses (ADR-004/ADR-005).

## 4. Forward dependency, not a design gap

Consistent with B2-FIX.3's and B7's own treatment of B12 as a recorded forward dependency rather than an unresolved B8 blocker: B8's reconciliation/scheduling requirements are fully specified at the *business-rule* level (§2) and require no B12 design decision to be usable by a future implementer — they need only an ordinary Celery Beat schedule entry, which any Phase-1 implementation can wire up without B12 existing yet, identical to how B3's Discovery reconciliation and B5's messaging reconciliation already work today without a formally designed B12.
