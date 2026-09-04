# B13 — Privacy & Data Minimization

> Design only. Extends `FI-B0-17` (eight-class data classification) and every domain's own minimization rule into a single production privacy contract. No legal retention period is invented.

## 1. Minimum provider payload retention

| Domain | Raw payload retention | Source |
|---|---|---|
| Discovery (Places/scraper) | 30 days, adopted (`B3-X-007`) | `FI-B3-02` |
| AI (provider prompt/response) | **never retained, at any duration** — no flag to enable it; the wire response is discarded after validation, only normalized fields survive | `FI-B4-02` |
| Webhook raw payload (B12) | default **off** (`RAW_WEBHOOK_PAYLOAD_RETENTION`, `FI-B12-04`) | `FI-B12-04` |
| Messaging provider payload | never logged in full at any level including debug; only normalized `outcome`/metadata | `FI-B5-01` |

## 2. Personal data minimization

Restated from `FI-B0-17`'s eight-class table, cross-referenced per domain:

| Class | Minimization rule |
|---|---|
| Contact PII (phone/email/name) | workspace access only, masked in admin/export views (`FI-B0-17`); CRM free text never leaves its own column (`FI-B2-01`) |
| Private communications (messages) | least privilege, message content never logged (`FI-B5-04`) |
| AI content | minimized at the boundary — phone/website reduced to presence booleans before ever reaching a provider (`FI-B4-02`); no protected/sensitive personal trait is ever inferable (no schema field exists for it) |
| Provider payloads | restricted JSONB, short retention, hash/reference rather than full retention (`FI-B0-17`) |
| Financial | no card/PAN/bank data ever stored (`FI-B9-03`) |

## 3. Log minimization

Full contract: `B13_LOGGING_REDACTION.md`. This document notes the privacy-specific consequence: a log line never becomes a secondary store of Contact PII, message content, or provider payload — "logs MUST NOT become a second data warehouse" (`FI-B0-06`).

## 4. AI provider payload minimization

Restated as the single strictest rule in this pack because it is stricter than every other domain's own retention policy: **zero retention of the raw wire exchange**, ever, with no configuration flag to change that (`FI-B4-02`). Prohibited inferences (health, religion, ethnicity, political views, sexual orientation, criminal status) are structurally impossible — no schema field exists for them (`additionalProperties: false` on the closed extraction schema).

## 5. File access minimization

Every file access is per-request re-authorized (`B13_FILE_SECURITY.md` §6); a file's contents are never logged, and a checksum is never logged below a restricted operator tier because a hash is a content oracle (`FI-B11-01`).

## 6. Deletion implications

| Domain | Deletion behavior |
|---|---|
| Identity | anonymization, not erasure, wherever a relational or audit reference exists (`FI-B1-10` Rule P-3) |
| CRM | anonymization on workspace-deletion purge; note bodies and contact PII anonymized, audit rows preserved (`FI-B2-01`) |
| Financial | **never deleted, under any circumstance** — a deleted Lead/Business/Deal leaves the referencing `RevenueEvent` unchanged at its original amount; `source_ref` becomes unresolvable but the event stays recognized and counted (`FI-B9-03`) |
| Files | soft-delete, async physical purge, no hard delete of the row ever (`FI-B11-05`); `legal`-class files never purged regardless of age |
| Audit | never deleted (immutable, `B13_AUDIT_LOGGING.md` §5) |

## 7. Audit retention

Class C, unresolved (`FI-B1-10` Rule P-4) — inherited, not decided here. Structural requirement satisfied: every retention-bearing table carries an explicit timestamp column.

## 8. Provider response retention

Bounded by §1's per-domain table; a provider response is never retained purely "in case it's useful later" — retention exists only where a specific reconciliation or dispute-resolution need justifies it (Discovery's 30-day window), and defaults to off/never otherwise.

## 9. Export implications

No CRM export exists in Phase 1 (`B2-D-C017`, `FI-B2-01` Rule CP-4). If introduced later, any export inherits: formula-injection neutralization (`B13_INPUT_OUTPUT_SECURITY.md` §3), masking of phone/email in the exported view (`FI-B0-17`), and an audit row for the export action itself (`crm.export` permission, `FI-B2-02`).

## 10. Retention: technical vs. business vs. legal

| Layer | What it fixes | What remains open |
|---|---|---|
| **Technical requirement** | every table has a timestamp enabling a retention policy to be implemented without a schema change (`FI-B1-10` Rule P-4) | — |
| **Business policy** | which retention window is commercially sensible (e.g., how long to keep a cancelled workspace's data before purge) | not decided here — `B13-D-C011`, Class C |
| **Legal policy** | Saudi data-locality, mandatory minimum/maximum retention for specific record classes, breach-notification timing | not decided here — `B13-D-C007` (notification timing) and `B13-D-C012` (data-locality/retention duration), both Class C, inherited unresolved from ADR-012 |

B13 does not collapse these three into one number. Where a frozen phase already proposed a starting point (30/30/90 days, `FI-B0-17`), it is carried forward as a **technical default**, not asserted as the business or legal answer.

## 11. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13PRIV-1` | No AI provider wire payload is retained beyond the validation step, under any configuration |
| `AT-B13PRIV-2` | A deleted Lead's referencing `RevenueEvent` remains at its original amount, unchanged |
| `AT-B13PRIV-3` | Admin/export views mask phone and email; no view ever shows a raw card number or secret |
| `AT-B13PRIV-4` | `RAW_WEBHOOK_PAYLOAD_RETENTION` defaults to off in a fresh environment configuration |
| `AT-B13PRIV-5` | Every retention-bearing table has a non-null creation/occurrence timestamp column, confirmed by schema inspection |
