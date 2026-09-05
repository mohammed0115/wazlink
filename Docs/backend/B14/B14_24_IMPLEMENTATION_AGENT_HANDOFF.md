# B14_24 — Implementation Agent Handoff

## 1. The freeze pattern

```
Architecture Contract → Code → Tests → Integration → Demo
   → Independent Verification → Freeze → Next Slice
```

**Executor PASS is not architectural closure.** Every major slice requires independent CTO verification before it is frozen. An agent may not declare its own slice closed.

## 2. Rules every implementation agent must follow

1. **Work on exactly one approved slice.** Never combine slices. Never implement several major domains and call them one verified slice.
2. **Read the frozen contracts first**, verbatim — the ones named in the slice's *Frozen contracts* line. Never work from a summary.
3. **Read the B14 slice contract** in `B14_18` and the maps it references.
4. **Never edit a frozen B0–B13 document.** An amendment is consumed as implementation input; registration is a separate governance act.
5. **Never edit `Docs/gap-plan/`.**
6. **No unrelated refactor.** A cleanup outside the slice is a separate, separately-approved change.
7. **No new queue, no new provider, no new retry mechanism, no new operator command.**
8. **Never invent a provider contract.** Verify from official documentation inside that provider's slice, and record what was read.
9. **Never widen scope into a deferred capability** (`GAP-009`, `018`, `019`, `020`, `024`, `026`, `027`) or a rejected one.
10. **Run the full required test set**, including the permanent security regression suite — not only the slice's own tests.
11. **Do not commit or push** unless explicitly authorized in that slice's instruction.

## 3. Required evidence per slice

| Evidence | Form |
|---|---|
| **Git diff** | full diff, scoped to the slice |
| **Migration plan and result** | `makemigrations --dry-run`, then `migrate` output on a **populated** database |
| **Test evidence** | full run: unit, domain, constraint, API, permission, isolation, idempotency, concurrency, async, **security regression** |
| **API evidence** | real request/response per new endpoint, including a `403`, a `404` scoping case and a `409` |
| **Security evidence** | masking proof · no secret in logs/admin/audit · cross-workspace `404` · the slice's negative controls |
| **Demo evidence** | the slice's demo, executed, with the three "shown on screen" facts where the demo specifies them |
| **Invariant coverage** | each invariant the slice touches, mapped to a passing test |
| **Amendment record** | which `CA-*` was consumed, and where |
| **Provider-fact discharge** | for a provider slice: **URL, retrieval date and the quoted clause** for each `FI-B12-12` fact (`B14_33` §4), plus the `UNCHANGED` / `CHANGED_ADAPTER_ONLY` / `CHANGED_ARCHITECTURAL` classification |
| **Dependency audit** | CI stage 13 output for the changed surface, with any risk acceptance naming an approver, rationale, compensating control and **expiry** (`B14_34` §4) |
| **Trust-boundary state** | for a staging/production-bound slice: `TRUSTED_PROXY_COUNT`, `TRUSTED_PROXY_CIDRS` and `SECURE_PROXY_SSL_HEADER` as deployed, with the §6 assertions (`B14_31`) |
| **Non-vacuity proof** | for each negative control the slice claims: evidence it **fails** when the prohibited capability is stubbed present (`T-META-3`) |

## 4. Slice prompt template

```
SLICE: I<n> — <name>
READ FIRST (verbatim): <the slice's "Frozen source contracts" line in B14_18>
   — every slice now has one; if it resolves to nothing, STOP and report a defect.
CONTRACT: Docs/backend/B14/B14_18 §I<n> (all 24 fields), plus
          B14_03 (module DAG) · B14_04 (migration DAG) · B14_06 (API) ·
          B14_07 (commands) · B14_08 (RBAC, six roles) · B14_09 (async) ·
          B14_19 (test definitions) · B14_29 (toolchain) · B14_30 (CI/CD) ·
          B14_31 (trust boundary) · B14_32 (Class B values)
AMENDMENTS CONSUMED: <CA-* or none>
PROVIDER GATE: <FI-B12-12 facts for this slice, or none — B14_33>
BUILD: models · migrations · commands · selectors · APIs · permissions ·
       events · tasks · adapters · admin · tests — exactly as the slice defines.
       A field reading "N/A — <reason>" means BUILD NOTHING for it.
MUST NOT: edit frozen docs · edit Docs/gap-plan · add a queue/provider/
          operator command · mint a deferred permission code · touch a
          deferred capability · refactor outside the slice · commit or push
PROVE: migration on a POPULATED DB · FORWARD_FK_COUNT = 0 · full tests incl.
       the security regression suite · every negative control shown NON-VACUOUS ·
       API evidence · security evidence · demo · invariant coverage ·
       provider-fact discharge where applicable
STOP: report evidence and await independent verification. Do not self-close.
```

## 5. Grounds for rejecting a slice

A frozen document was edited · `Docs/gap-plan/` was edited · a deferred or rejected capability appeared · **a deferred permission code was minted** · a negative control was weakened, skipped, rewritten to pass, **or is vacuous in the slice claiming it** · **a slice closed on a test with no stated assertion** · a provider contract was guessed · **an `FI-B12-12` fact was not discharged from the provider's own current documentation** · a secret appeared in a log, admin page, audit row, task payload or fixture · a new queue or a second send command was introduced · **an additive permission was left without a cell for one of the six workspace roles** · **a forwarded header was trusted without the §5 preconditions** · **an FK was declared to a table created later in the DAG** · migrations were not run on a populated database · the agent declared its own closure.
