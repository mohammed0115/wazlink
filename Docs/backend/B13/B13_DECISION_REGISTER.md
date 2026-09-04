# B13 — Decision Register

> Design only. Uses the decision classes fixed by the governing brief §35: **Class A** = frozen input inherited from B0–B12 and the frozen frontend (not re-decided here — the full 96-item register is `B13_FROZEN_INPUT_INVENTORY.md` §§2–6); **Class B** = a B13 additive implementation/security decision (closed for Phase 1, most carrying a proposed/tunable value); **Class C** = unresolved/environment/business/legal decision, inherited or newly surfaced. **No unresolved business/legal question is classified as Class A.**

## 1. Class A — frozen input inherited from B0–B12

Not restated here to avoid a second copy that could drift from the first.

**`CLASS_A_DECISION_COUNT = 96`.** Corrected under `B13-FIX.2`, which found this document publishing **82** — a pre-`B13-FIX.1` figure that survived the anchor repair — while `B13_FROZEN_INPUT_INVENTORY.md` §7 published **96**, and asserting the two were identical while they disagreed.

**Definition, so the counter is reproducible rather than asserted.** A Class A item is a frozen B0–B12 or frozen-frontend input that B13 inherits and does not re-decide. The population is exactly the set of distinct `FI-*` anchors **defined** in `B13_FROZEN_INPUT_INVENTORY.md`. Reproduce:

```
# 95 — anchors defined as table rows in §§2–5
grep -oP '^\| `FI-[A-Z0-9-]+`' Docs/backend/B13/B13_FROZEN_INPUT_INVENTORY.md \
  | grep -oP 'FI-[A-Z0-9-]+' | sort -u | wc -l
# 1 — FI-FE-01, the frozen frontend anchor, defined as prose in §6
grep -c '^`FI-FE-01`' Docs/backend/B13/B13_FROZEN_INPUT_INVENTORY.md
# 95 + 1 = 96
```

**`CLASS_A_DECISION_COUNT == FROZEN_ANCHOR_COUNT` because the two populations are provably the same set, not because the numbers happen to match.** Every Class A item is an `FI-*` anchor: §1 of this register admits no Class A item defined anywhere else. Every `FI-*` anchor is a Class A item: each quotes a closed, published B0–B12 or frozen-frontend clause and none is a B13-authored decision — B13's own decisions carry the disjoint Class B and Class C identifier series (29 + 12), and the Class A series of B13-authored decisions is empty, the three originally-misnumbered IDs having been renumbered into the Class B series during the authoring pass. `FI-FE-01` is inside the population, not an exception to it: the frozen frontend SHA is an inherited fact B13 does not re-decide, exactly like every other row.

`CLASS_A_UNRESOLVED = 0` — every Class A item quotes a closed, published clause.

## 2. Class B — B13 additive implementation/security decisions

| ID | Decision | Owning document |
|---|---|---|
| `B13-D-B001` | Password hasher selection deferred to Django's current recommended default at implementation time | `B13_AUTHENTICATION_SESSION_SECURITY.md` §2 |
| `B13-D-B002` | Minimum password policy, **revised under `B13-FIX.1`**: length **≥15** for single-factor login (was ≥10), no composition rules, no periodic expiry, no KBA/hints, maximum ≥64, and blocklist screening against known-compromised passwords **required** at register/change/reset (was "recommended"). Revised because the decision rested on NIST SP 800-63B (2020), withdrawn and superseded by SP 800-63B-4 (final 2025-07-31), which raises the single-factor minimum to 15 (SHALL) and strengthens the composition and expiry rules to SHALL NOT (`B13-X-004`). Remains Class B target design: changeable by a recorded decision naming an approver and compensating control, never silently. **No MFA requirement is created** — MFA stays `B13-D-C001`, Class C | `B13_AUTHENTICATION_SESSION_SECURITY.md` §2, §2a |
| `B13-D-B003` | `SECRET_KEY` rotation is a scheduled, communicated, all-sessions event, never a routine deploy side effect | same §4 |
| `B13-D-B004` | Suspicious-session anomaly detection (IP/UA-change-triggered) deferred — no detection logic designed in Phase 1 | same §5 |
| `B13-D-B005` | `SECURE_HSTS_PRELOAD` not enabled in Phase 1; short-then-long HSTS escalation adopted instead | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §4 |
| `B13-D-B006` | DRF built-in throttling is defense-in-depth only; PostgreSQL/Redis-backed limits are authoritative | same §8 |
| `B13-D-B007` | Secret rotation cadence: mandatory on suspected compromise, recommended annually otherwise | `B13_SECRETS_MANAGEMENT.md` §7 |
| `B13-D-B008` | Webhook ingress body-size ceiling: exact figure deferred to `WEBHOOK_MAX_BODY_BYTES` implementation value | `B13_WEBHOOK_SECURITY.md` §3 |
| `B13-D-B009` | A Tap `x_created` freshness window may be added as defense-in-depth once semantics are confirmed; never the primary replay control | same §5 |
| `B13-D-B010` | `MAX_FILE_BYTES` carried forward at frozen B11's proposed 25 MiB. **Not settled by B13** — the value is frozen `B11-D-B007`, still `PRODUCT DECISION REQUIRED`; this row records the carry-forward, not an approval | `B13_FILE_SECURITY.md` §2 |
| `B13-D-B011` | `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` carried forward at frozen B11's proposed 5 GiB, uniform across plans. **Not settled by B13** — value remains frozen `B11-D-B007`, `PRODUCT DECISION REQUIRED` | same §2 |
| `B13-D-B012` | Malware-scanner integration point reserved at `FinalizeUpload`, not built in Phase 1 | same §4 |
| `B13-D-B013` | Download-ticket TTL carried forward at frozen B11's proposed 5 minutes, single-use. **Not settled by B13** — value remains frozen `B11-D-B007`, `PRODUCT DECISION REQUIRED` | same §6 |
| `B13-D-B014` | File retention timers (`UPLOAD_INTENT_TTL`≈1h, `ORPHAN_GRACE`≈7d, `PURGE_GRACE`≈30d) carried forward from frozen B11 unchanged, never applied to `legal`-class files. **Not settled by B13** — values remain frozen `B11-D-B007`, `PRODUCT DECISION REQUIRED` | same §8 |
| `B13-D-B015` | Provider health/config-test endpoints carry their own abuse-prevention rate limit, distinct from domain budgets | `B13_RATE_LIMIT_ABUSE_MODEL.md` §2 |
| `B13-D-B016` | Row-Level Security evaluated and **rejected for Phase 1**; recorded as a defense-in-depth future option | `B13_DATABASE_SECURITY.md` §7 |
| `B13-D-B017` | Redis ACL scoping (worker/broker vs. cache/rate-limit) adopted where the deployed Redis version supports it | `B13_REDIS_CELERY_SECURITY.md` §3 |
| `B13-D-B018` | Log sampling rate for high-volume routine traffic is a tunable production value; errors/financial/webhook/audit are never sampled | `B13_LOGGING_REDACTION.md` §4 |
| `B13-D-B019` | Alert trigger thresholds are initial operational defaults, tunable without an architecture review | `B13_OBSERVABILITY.md` §4 |
| `B13-D-B020` | Every alert requires a corresponding dashboard panel before being enabled in production | same §6 |
| `B13-D-B021` | Backup frequency: daily full + continuous WAL archiving (proposed) | `B13_BACKUP_RESTORE.md` §2 |
| `B13-D-B022` | Pre-incident snapshots retained minimum 7 days post-operation-confirmation | same §3 |
| `B13-D-B023` | Monthly automated restore-to-staging test (proposed cadence) | same §5 |
| `B13-D-B024` | Quarterly full disaster-recovery drill (proposed cadence) | same §5 |
| `B13-D-B025` | Non-production environments must not exercise a provider lacking sandbox support against real external effect | `B13_ENVIRONMENT_STRATEGY.md` §3 |
| `B13-D-B026` | Critical/High dependency vulnerabilities patched within a proposed 7-day window or explicitly risk-accepted | `B13_SUPPLY_CHAIN_SECURITY.md` §4 |
| `B13-D-B027` | Password transmitted only via HTTPS request body, never a query parameter or path segment | `B13_AUTHENTICATION_SESSION_SECURITY.md` §2 |
| `B13-D-B028` | `SESSION_COOKIE_AGE` set as a client-side hint mirroring absolute expiry; the `sessions` registry row remains the sole authority | same §3 |
| `B13-D-B029` | DRF renderer restricted to JSON in production; browsable API renderer disabled | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §8 |

`CLASS_B_DECISION_COUNT = 29` — the row count of §2.

**Carry-forward rows are not approvals.** `B13-D-B010`, `B13-D-B011`, `B13-D-B013` and `B13-D-B014` restate values frozen `B11-D-B007` holds open as `PRODUCT DECISION REQUIRED`. They are Class B because B13 records them, not because B13 closes them; **corrected under `B13-FIX.2`**, which found the frozen open-decision status silently dropped merely because B13's values matched B11's proposals. No B13 row converts a frozen open product decision into settled policy.

## 3. Class C — unresolved / environment / business / legal decisions

| ID | Question | Owning document |
|---|---|---|
| `B13-D-C001` | MFA — future security enhancement, not Phase-1 authority | `B13_AUTHENTICATION_SESSION_SECURITY.md` §7 |
| `B13-D-C002` | Whether any public/unauthenticated endpoint beyond the three frozen operations is ever needed | `B13_DJANGO_DRF_SECURITY_BASELINE.md` §7 |
| `B13-D-C003` | Secret-store product choice and its specific at-rest encryption guarantee | `B13_SECRETS_MANAGEMENT.md` §4 |
| `B13-D-C004` | CSV/import boundary — no Phase-1 surface exists; inherits controls if introduced | `B13_INPUT_OUTPUT_SECURITY.md` §6 |
| `B13-D-C005` | Whether a read-replica database role is ever introduced | `B13_DATABASE_SECURITY.md` §1 |
| `B13-D-C006` | Whether WazLink commits to a published external SLO | `B13_OBSERVABILITY.md` §5 |
| `B13-D-C007` | Legal breach-notification timing (jurisdiction-dependent) | `B13_INCIDENT_MANAGEMENT.md` §4; `B13_PRIVACY_DATA_MINIMIZATION.md` §10 |
| `B13-D-C008` | Per-workspace (vs. full-instance) restore granularity | `B13_BACKUP_RESTORE.md` §6 |
| `B13-D-C009` | File-storage RPO/RTO, dependent on the unresolved Hostinger capability question (`B11-X-007`) | `B13_BACKUP_RESTORE.md` §7 |
| `B13-D-C010` | Exact CSP addition once a real payment-gateway embedded script/iframe shape is confirmed | `B13_BROWSER_SECURITY.md` §2 |
| `B13-D-C011` | Business retention policy — how long to keep a cancelled workspace's data | `B13_PRIVACY_DATA_MINIMIZATION.md` §10 |
| `B13-D-C012` | Legal data-locality and exact retention duration (Saudi jurisdiction and others), inherited unresolved from ADR-012 | same §10 |

`CLASS_C_DECISION_COUNT = 12`. **None of these twelve items is silently treated as resolved anywhere else in this pack** — every citation of a `B13-D-C001`…`B13-D-C012` ID elsewhere is phrased as "not decided," "unresolved," or "deferred," never as an operative fact.

## 4. Cross-check against the frozen unresolved set

Every Class C item traces to either (a) a frozen unresolved item this pack inherits without attempting to resolve (data locality/ADR-012, RPO/RTO for file storage/`B11-X-007`, MFA/ADR-009), or (b) a genuinely new B13-surfaced open question (SLO commitment, restore granularity, CSP for a not-yet-integrated payment gateway). No Class C item was manufactured to avoid making a decision that the frozen corpus had actually already made — each is checked against `B13_FROZEN_INPUT_INVENTORY.md` before being classified C rather than A or B.

## 5. Totals

`CLASS_A_DECISION_COUNT = 96` (§1's derivation), `CLASS_B_DECISION_COUNT = 29` (§2 row count), `CLASS_C_DECISION_COUNT = 12` (§3 row count). Each is the row/derivation count of the section named beside it; `B13_VERIFICATION_MATRIX.md` §2 reproduces the same three commands rather than pointing back here for the method.
