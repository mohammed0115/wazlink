# B14_34 — Supply-Chain Vulnerability Gate

> **Added by `B14-FIX.1` to close `V-06` (G).** `B13_IMPLEMENTATION_HANDOFF.md` §1 gate 5 is **open**, and the pre-fix pack contained **no** supply-chain content at all — no `pnpm`, no audit, no dependency-vulnerability policy. B13 states the gate is *"the unrun scan, not a missing lockfile."*

## 1. The inherited obligation, stated exactly

`B13_IMPLEMENTATION_HANDOFF.md` §1 gate 5:

> *"Establish the current frontend dependency vulnerability baseline — run the repository's own package-manager audit (`pnpm audit`-class, against the already-committed `pnpm-lock.yaml`) and triage the result per `B13_SUPPLY_CHAIN_SECURITY.md` §4. **No lockfile needs generating; the gate is the unrun scan**, not a missing lockfile."*

`SUPPLY_CHAIN_READY` is **`READY` (policy + pinning) / `CONDITIONAL` (current vulnerability baseline unrun)**.

**This document does not declare that gate closed.** Running a scan is execution work that cannot happen inside a documentation-only phase, and asserting a clean baseline without running it would be exactly the false-PASS pattern `V-09` identified elsewhere.

## 2. What already holds — verified from the repository

| Control | State | Evidence |
|---|---|---|
| Frontend package manager declared and version-pinned | **In force** | `package.json`; `pnpm/action-setup@v4` |
| `pnpm-lock.yaml` committed | **In force** | present at repository root, committed |
| CI installs with a frozen lockfile | **In force** | `.github/workflows/deploy-pages.yml` — `pnpm install --frozen-lockfile` |
| Backend equivalent | **Not yet applicable** — no Python dependency exists until I0 | `find` returns zero `*.py`, zero `pyproject.toml` |

**The frontend half is a pre-existing repository property, not a B14 deliverable.** B14 neither claims credit for it nor declares its scan run.

## 3. Two audit surfaces

| Surface | Resolved tree | Command | From |
|---|---|---|---|
| **Frontend** | `pnpm-lock.yaml` (**already committed**) | `pnpm audit --audit-level=high` | **now** — independent of B14 |
| **Backend** | `uv.lock` (created at I0, `B14_29` §3) | `uv run pip-audit` against the locked environment | **I0 onward** |

Both run as **CI stage 13** (`B14_30` §2) and are **blocking at the severity in §4**.

**Neither audit may run against a floating resolution.** Auditing anything other than the committed lock reports on a tree that will not be deployed.

## 4. Severity and response policy

Inherited from `B13-D-B026` — *"Critical/High dependency vulnerabilities patched within a proposed 7-day window or explicitly risk-accepted"* — and carried in `B14_32` as `CB-33`.

| Severity | CI | Response | Window |
|---|---|---|---|
| **Critical** | **fails the build** | patch, or an explicit recorded risk acceptance naming an approver and compensating control | **7 days** (`CB-33`) |
| **High** | **fails the build** | as above | **7 days** |
| Moderate | warns | triaged into the backlog | next planned dependency update |
| Low | warns | batched | next planned update |

**Risk acceptance is a named, recorded decision** — an approver, a rationale and a compensating control. A silent allowlist entry is a rejection ground (`B14_24` §5).

**A suppression must carry an expiry.** An indefinite suppression is how a Critical becomes permanent, so an expired suppression **fails the build**.

## 5. Baseline capture — the actual discharge

| Step | Action | Owner | When |
|---|---|---|---|
| 1 | Run `pnpm audit` against the committed `pnpm-lock.yaml`; record the **full output, tool version and date** | Platform/Frontend | **Before I0 completes** |
| 2 | Triage every Critical/High per §4 | Platform/Frontend + Security | with step 1 |
| 3 | Record the triaged result as **the frontend baseline** | Platform | with step 2 |
| 4 | At I0, generate `uv.lock` and capture the **backend baseline** the same way | Platform | I0 |
| 5 | Wire both into CI stage 13 | Platform | I0 |

**Step 1 discharges `B13_IMPLEMENTATION_HANDOFF.md` §1 gate 5.** Until it is executed the gate is **open**, and this document says so rather than assuming a result. It does **not** block I0 — a scan of the frontend tree does not gate backend foundation work — but it **does** block the production gate (§6).

## 6. Regression and release policy

| Rule | Statement |
|---|---|
| New vulnerability in an unchanged dependency | Detected by the **scheduled** run (§7), not only on PRs — a dependency does not have to change to become vulnerable |
| New Critical/High | Fails the **next** build; enters the `CB-33` window from disclosure |
| **Production blocking** | A release **may not** proceed with an unaccepted Critical or High on either surface. This is a **hard gate** in `B14_30` §4 |
| Bypass | **None available in the pipeline.** Stage 13 is not conditional on path, label or actor (`T-CI-1`) |
| Lock update | A deliberate reviewed change, never a slice side effect (`B14_24` rule 6) |

**No production release can accidentally bypass this gate**, because the only path to production runs through a stage that cannot be filtered out.

## 7. Scheduled scanning

| Cadence | Scope | Action |
|---|---|---|
| **Every PR / push** touching a lockfile | changed surface | blocking at §4 |
| **Daily** scheduled workflow | **both** locks on `main` | opens a tracked item on new Critical/High |
| **Before each production gate** | both | blocking |
| **Quarterly** | both | full triage review including accepted risks and expiring suppressions |

The daily scheduled run is the control that catches a newly disclosed vulnerability in a dependency nobody touched.

## 8. Boundaries

| Not in scope | Why |
|---|---|
| Rewriting `pnpm-lock.yaml` | B13: *"No lockfile needs generating"* |
| Modifying frontend dependencies | `B14-FIX.1` is documentation-only; the frozen frontend stays byte-identical |
| Claiming the frontend baseline is clean | It is **unrun**. Stating otherwise would be a fabricated PASS |
| Selecting a vendor SCA platform | The lockfile-native tooling above satisfies the obligation; a vendor platform is optional and not required |

## 9. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-SUP-1` | CI configured | Inspect stage 13 | Runs against the **committed lock** on both surfaces; **not** conditional on path, label or actor |
| `T-SUP-2` **(NC)** | Seeded Critical advisory | Run stage 13 | Build **fails**; no path allows merge without a recorded acceptance |
| `T-SUP-3` | Acceptance recorded | Inspect | Names an **approver, rationale, compensating control and expiry** |
| `T-SUP-4` **(NC)** | Expired suppression | Run stage 13 | Build **fails** — a suppression cannot silently become permanent |
| `T-SUP-5` | Production gate | Check both baselines | Both **current**; a stale or missing baseline **blocks the gate** |
| `T-SUP-6` **(NC)** | Backend lock modified in a feature slice | Run CI | Flagged as an out-of-scope change (`B14_24` rule 6) |
| `T-SUP-7` | Repository | Inspect install commands | Frontend uses `--frozen-lockfile`; backend uses `uv sync --frozen`. **Neither resolves freely** |
