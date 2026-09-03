# B13 — Dependency / Supply-Chain Security

> Design only. Defines the operational policy for dependency inventory, scanning, and triage. **B13 does not modify any dependency.** Where the repository's current state cannot be mechanically verified, that is recorded as a finding, not silently assumed resolved.

## 1. Current repository state — verified during this pass

| Check | Result | Evidence |
|---|---|---|
| Root `package.json` (frontend, `leadflow-scenario`) | present | repository root |
| `package-lock.json` / any frontend lockfile | **absent** — no lockfile is committed to the repository | confirmed by directory listing during this pass |
| `npm audit` | **cannot run** — `npm audit` requires an existing lockfile (`ENOLOCK`); attempting `npm audit --json` in this pass failed with exactly that error | command output captured during this pass |
| Backend dependency manifest (`requirements.txt`/`pyproject.toml`/`Pipfile`) | **does not exist** — no backend implementation exists yet (B0–B13 are architecture only) | directory search during this pass |

**This is a finding, not a resolved baseline.** Without a committed lockfile, dependency versions are not pinned or reproducible, and no tool in this environment can enumerate the exact resolved dependency tree to scan it for known vulnerabilities. `B13 does not claim the current vulnerability baseline is fixed or known` — it is recorded here as existing repository risk requiring implementation-phase triage, per the brief's explicit instruction not to silently claim resolution.

## 2. Dependency inventory policy (forward-looking)

| Requirement | Detail |
|---|---|
| Lockfile committed | every dependency manifest (frontend `package-lock.json`, backend `requirements.lock`/`poetry.lock`/equivalent) is committed to the repository once generated — the current gap in §1 is closed at the point a lockfile is first generated and committed, which is an implementation-phase action, not a B13 action |
| Inventory visibility | a Software Bill of Materials (SBOM) or equivalent dependency-tree listing is generated at build/CI time so the exact resolved version set is always inspectable |
| Transitive dependencies | scanning covers the full resolved tree, not only direct dependencies — most real-world vulnerable-package incidents are transitive |

## 3. Vulnerability scanning

| Ecosystem | Tool class (product choice deferred to `B14`) | Cadence |
|---|---|---|
| Python (future backend) | a dependency-vulnerability scanner integrated into CI (e.g., `pip-audit`-class tooling) | every CI run against every pull request, plus a scheduled scan independent of code changes (dependencies can become vulnerable after merge, when a new CVE is disclosed) |
| Node/frontend | `npm audit`-class tooling, functional only once a lockfile exists (§1) | same cadence as above |
| Container/base image (once implementation begins) | image-scanning tooling as part of the build pipeline | every image build |

## 4. Severity triage and patch cadence

| Severity | Response |
|---|---|
| Critical/High, with a known exploited or easily exploitable path | patch within a defined short window (**PROPOSED**: 7 days, `B13-D-B026`, Class B) or apply a documented compensating control if an immediate patch is infeasible |
| Critical/High, no known exploitation path, requires a breaking upgrade | tracked, scheduled into the next planned dependency-upgrade cycle, with a documented risk-acceptance if deferred past the initial window |
| Medium/Low | addressed in routine dependency-maintenance cycles, not emergency patched |
| Abandoned package (no maintainer activity, no fix forthcoming) | evaluated for replacement; if replacement is infeasible short-term, the risk is documented and monitored, never silently ignored |

**Every deferral or risk-acceptance is a documented decision, not silence.** A dependency review log entry is required before any release that ships a known unpatched Critical/High vulnerability, naming the vulnerability, why it was not patched, and the compensating control (if any).

## 5. Container/base-image dependencies

Recorded as a forward requirement for when implementation begins: the base image is chosen for minimal attack surface (§7 of `B13_DEPLOYMENT_SECURITY.md`), scanned at every build, and rebuilt on a defined cadence even absent an application code change, because base-image vulnerabilities are disclosed independently of WazLink's own release cycle.

## 6. What B13 does not do

B13 does not run `npm install`, generate a lockfile, upgrade any dependency, or otherwise modify `client/**` or any manifest — the write scope for this phase is documentation only (per the governing brief's hard repository rules). The lockfile gap in §1 is flagged for the implementation phase to close, not closed here.

## 7. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13DEP-1` | A committed lockfile exists for every dependency manifest before the first production deployment |
| `AT-B13DEP-2` | CI fails (or explicitly flags) a pull request that introduces a Critical-severity known-vulnerable dependency without a documented risk-acceptance |
| `AT-B13DEP-3` | A scheduled scan independent of code changes runs at least weekly against the resolved dependency tree |
| `AT-B13DEP-4` | Every documented risk-acceptance for a deferred vulnerability has an owner and a review date |
