# B10 — Failure Mode Analysis

> Design only. Adversarial analysis per brief §48's explicit list. Each row cross-references the failure catalog row (`B10_FAILURE_CATALOG.md`) or decision (`B10_DECISION_REGISTER.md`) that closes it — this document is the adversarial derivation, that one is the resolved record.

| # | Adversarial scenario | Why it cannot silently succeed |
|---|---|---|
| 1 | Incorrect exemption configuration | Not structurally preventable (it is a business judgment call), but bounded: Owner-only permission, mandatory non-empty reason, full audit trail (`BF3`, `B10-D-A016`) — an incorrect determination is *visible and attributable*, never silent |
| 2 | Applicability accidentally enabled | `SetTaxApplicability(enabled)` requires `ValidateZatcaConfiguration` to have already reported `configured=true`; an unconfigured environment cannot reach `enabled` (`BF2`) |
| 3 | Applicability accidentally disabled | Same Owner-only/audited/reasoned gate as #1; "accidentally" reaching `not_applicable` requires an Owner to deliberately call the command with a reason — no automatic or side-effect path sets it |
| 4 | Expired credentials | `ValidateZatcaConfiguration` surfaces expiry proximity before failure (`B10_OBSERVABILITY.md` §1); an actual expiry during submission fails closed to `pending`/`suspended`, never silently treated as success (`BF4`) |
| 5 | Duplicate invoice issuance | Durable partial unique index on `(source_type, source_ref)` — a database-level impossibility, not a discipline (`BF5`, `B10-D-A013`) |
| 6 | Duplicate submission | `(tax_invoice_id, attempt scope)` idempotency; a retry appends an attempt row, never a second document (`BF6`) |
| 7 | Provider timeout after acceptance | Fail-closed to `pending`; reconciliation's `retrieve_submission_status` is authoritative once queried, never overwritten by a stale local guess (`BF7`, `B10-D-A019`) |
| 8 | Partial external failure | Same fail-closed `pending` rule; never inferred as either terminal outcome from an incomplete signal (`BF8`) |
| 9 | Credit note without original invoice | `reference_invoice_id` is a required, in-workspace-resolved FK — a note cannot be created without a real original (`BF9`, DB `CHECK` + application validation, `B10_CREDIT_NOTE_MODEL.md` §1) |
| 10 | Refund without credit note | Explicitly not an error — B10 never assumes every B8 refund requires a note (`B10-D-A009`); surfaced only as a review signal, never auto-corrected (`BF10`) |
| 11 | Credit note without B9 reversal | Explicitly not an error — B9 owns that decision entirely (`B10-D-A010`); `CreditNoteIssued` is a fact, not a request (`BF11`) |
| 12 | B9 reversal without credit note | Symmetric to #11 — B10 never infers a note is owed from a B9 fact it doesn't even read for this purpose (`BF12`, `B10_B9_FINANCE_BOUNDARY.md` §3) |
| 13 | Wrong tax rate | Rate is read fresh and snapshotted atomically inside the issuing transaction — no code path exists that could apply a stale or substituted rate (`BF13`, `B10-D-A007`) |
| 14 | Historical configuration change | Snapshot-on-issuance (`tax_profile_version_id`) makes this structurally inert for already-issued documents (`BF14`, `B10-D-A008`, `AT-B10APP-4`) |
| 15 | Workspace currency change | Each document independently carries its own `currency`, copied from its own `source_ref` at issuance — no shared, mutable currency state exists to change underneath a document (`BF15`) |
| 16 | Cross-workspace invoice reference | Doctrine R-1/R-2 workspace-scoped resolution; `404`, indistinguishable from absent (`BF16`) |
| 17 | Deleted customer | Statutory document retained and anonymized, never deleted, per the same purge-workflow discipline B8/B9 already use for financial records (`BF17`) |
| 18 | Legal entity change | Out of Phase-1 scope by explicit decision (`BF18`, `B10-D-C004`) — not silently unhandled, deliberately deferred with a recorded reason |
| 19 | Concurrent issuance | Row lock + `version` check; deterministic winner, explicit conflict for the loser, never last-write-wins (`BF19`) |
| 20 | Replay attack | `Idempotency-Key` + `expected_version`/`config_version` context together make a captured-and-replayed request either a safe no-op (identical replay) or an explicit conflict (stale context) — never a silent reapplication (`BF20`) |

## Closing statement

Every adversarial scenario brief §48 lists resolves to one of: (a) a structural impossibility (a DB constraint makes the bad state unreachable), (b) an explicit, typed failure surfaced to the caller or an admin queue, or (c) a deliberate non-error where the brief's own framing assumed an automatic linkage B10 correctly does not create (#10–#12). None resolves to a silent success, a silent data mutation, or an invented business rule.
