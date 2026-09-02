# B9 — Failure Catalog

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 0. Doctrine

Every failure below reuses the **frozen error envelope** and the frozen HTTP status doctrine (`BACKEND_ERROR_CATALOG.md`). B9 introduces no new envelope and no new taxonomy — only new `code` values, exactly as B7 and B8 did before it.

Cross-workspace references always resolve to `404 ENTITY_NOT_FOUND`. The response never distinguishes "does not exist" from "exists in another workspace", per the frozen rule.

## 1. Catalog

| ID | Code | HTTP | Condition | Retryable | User-visible | Audit |
|---|---|---:|---|---|---|---|
| `B9-AF-001` | `PERMISSION_DENIED` | 403 | actor lacks the required B9 permission | no | yes | yes |
| `B9-AF-002` | `DUPLICATE_RECOGNITION` | 409 | a live `RevenueEvent` already exists for `(workspace, source_type, source_ref)` | no | yes | yes |
| `B9-AF-003` | `IDEMPOTENCY_CONFLICT` | 409 | same `idempotency_key`, different semantic payload | no | yes | yes |
| `B9-AF-004` | `VALIDATION_ERROR` | 422 | `source_type` outside the closed set | no | yes | no |
| `B9-AF-005` | `ENTITY_NOT_FOUND` | 404 | `source_ref` does not resolve in the caller's workspace | no | yes | yes |
| `B9-AF-006` | `VALIDATION_ERROR` | 422 | `source_ref.entity_type` contradicts `source_type` | no | yes | no |
| `B9-AF-007` | `PLATFORM_BILLING_NOT_RECOGNIZABLE` | 422 | source is a WazLink platform payment/invoice | no | yes | yes |
| `B9-AF-008` | `VALIDATION_ERROR` | 422 | amount malformed, scale > 4, or out of range | no | yes | no |
| `B9-AF-009` | `VALIDATION_ERROR` | 422 | `gross` or `net` is zero or negative on recognition | no | yes | no |
| `B9-AF-010` | `VALIDATION_ERROR` | 422 | `net > gross` — **recognition only**; a reversal's net is derived and cannot breach this | no | yes | no |
| `B9-AF-011` | `VALIDATION_ERROR` | 422 | `gross.currency`/`net.currency`/`currency` disagree | no | yes | no |
| `B9-AF-012` | `VALIDATION_ERROR` | 422 | `currency` is not a syntactically valid ISO-4217 code | no | yes | no |
| `B9-AF-013` | `VALIDATION_ERROR` | 422 | reversal `gross` is zero or negative | no | yes | no |
| `B9-AF-014` | `REVERSAL_EXCEEDS_REMAINING` | 409 | `Σ prior gross + this gross > event gross`; also the code returned to a concurrent reversal that lost the row-lock race | no | yes | yes |
| `B9-AF-015` | `CURRENCY_MISMATCH` | 422 | reversal currency ≠ event currency | no | yes | yes |
| `B9-AF-016` | `RECOGNITION_DATE_IN_FUTURE` | 422 | a business timestamp exceeds the 5-minute skew tolerance | no | yes | no |
| `B9-AF-017` | `VALIDATION_ERROR` | 422 | reversal `reason` outside the closed set | no | yes | no |
| `B9-AF-018` | `ALREADY_FULLY_REVERSED` | 409 | the event is already `reversed` | no | yes | yes |
| `B9-AF-019` | `ENTITY_NOT_FOUND` | 404 | reversal targets an event in another workspace | no | yes | yes |
| `B9-AF-020` | `CONFLICT` | 409 | touchpoint `position` already taken for that subject | no | yes | no |
| `B9-AF-021` | `VALIDATION_ERROR` | 422 | attribution workspace ≠ event workspace (internal invariant breach) | no | no | yes |
| `B9-AF-022` | `ENTITY_NOT_FOUND` | 404 | touchpoint `subject_ref` does not resolve in-workspace | no | yes | no |
| `B9-AF-023` | `VALIDATION_ERROR` | 422 | `Idempotency-Key` header disagrees with the body `idempotency_key` | no | yes | no |
| `B9-AF-024` | `CONFLICT` | 409 | reconciliation case is already terminal | no | yes | yes |
| `B9-AF-025` | `VALIDATION_ERROR` | 422 | resolution missing `resolution_reason` or `resolution_action` | no | yes | no |
| `B9-AF-026` | `ENTITLEMENT_LOCKED` | 403 | workspace lacks the finance capability, where one is configured | no | yes | yes |
| `B9-AF-027` | `AUTH_REQUIRED` | 401 | no valid session | no | yes | no |
| `B9-AF-028` | `PROVIDER_UNAVAILABLE` | 503 | an upstream in-workspace read (B2/B3/B6/B8) is transiently unavailable during source validation | **yes** | yes | yes |
| `B9-AF-029` | `REVERSAL_NET_UNDERFLOW` | 422 | the derived reversal `net` rounds to zero **and the reversal does not exhaust the event's gross** — a non-terminal reversal too small to allocate one net minor unit at the event's gross→net ratio. The *terminal* gross-cleanup reversal derives `net = 0` legitimately and is **not** this failure (`B9_REVERSAL_MODEL.md` §4.1a, `B9-D-A040`) | no | yes | yes |
| `B9-AF-030` | `INTERNAL_ERROR` | 500 | unexpected failure; never leaks detail | no | yes | yes |
| `B9-AF-031` | `VALIDATION_ERROR` | 422 | `period_end` ≤ `period_start`, or an unparseable period | no | yes | no |
| `B9-AF-032` | `ENTITY_NOT_FOUND` | 404 | reconciliation case not resolvable in-workspace | no | yes | yes |
| `B9-AF-033` | `VALIDATION_ERROR` | 422 | touchpoint `subject_type`/`source_type` outside its closed set | no | yes | no |
| `B9-AF-034` | `VALIDATION_ERROR` | 422 | `position` < 1 | no | yes | no |
| `B9-AF-035` | `VALIDATION_ERROR` | 422 | a reversal request supplies a `net` field — `net` is derived, never accepted (`B9-D-A033`) | no | yes | no |
| `B9-AF-036` | `WORKSPACE_CURRENCY_UNRESOLVED` | 422 | no `currency` parameter was supplied on an operation whose response carries a single-currency `Money`, **and** the workspace's own presentation currency could not be resolved or fails the `^[A-Z]{3}$` shape. Unreachable under frozen B1, which stores `workspaces.currency` NOT NULL with default `SAR` — named so the outcome is a deterministic 422 rather than a 500 (`B9_API_DTO_CONTRACTS.md` §3a) | no | yes | yes |

```
FAILURE_SCENARIO_COUNT      = 36   (B9-AF-001 … B9-AF-036, contiguous)
FAILURE_SCENARIO_DUPLICATES = 0
FAILURE_SCENARIO_GAPS       = 0
OUT_OF_SCOPE_FAILURE_ROWS   = 0
```

**`B9-AF-029` was redefined by `B9-FIX.1` and narrowed by `B9-FIX.2`.** It previously read *"concurrent reversal lost the row-lock race and would breach the bound"* — the same condition as `B9-AF-014`, with the opposite retryability, and referenced by no flow: `B9_IDEMPOTENCY_CONCURRENCY.md` §4 and §5 both route the losing reversal to `B9-AF-014`. Rather than delete the id and leave a gap, `B9-FIX.1` gave it a real and previously unnamed condition arising from the derived-net rule. `B9-FIX.2` then **narrowed** it: as originally written it also rejected the *terminal* gross-cleanup reversal, which stranded a rounding residual and left the event permanently `partially_reversed` (`B9-D-A040`). It now fires only when the derived net is zero **and** gross would not be exhausted. The reversal bound/race remains `B9-AF-014`, and it is the only code for it.

**`B9-AF-036` was redefined by `B9-FIX.2`.** It previously read `CURRENCY_FILTER_REQUIRED` — raised when `currency` was omitted on operations 8 and 9, which `B9-FIX.1` had made a **required** parameter. Making it required was a breaking change to the frozen `getAttribution` operation, whose frozen definition declares `"parameters": []` (`B9-D-A039`, `B9_API_DTO_CONTRACTS.md` §3a). `B9-FIX.2` makes `currency` **optional**, defaulting to the workspace's own presentation currency, so the parameter is never "required" and the old condition no longer exists. The id is retained rather than deleted, and now names the residual condition that genuinely remains: the default could not be resolved. It is a corruption-alarm-class failure — unreachable under frozen B1's NOT NULL default — stated so an implementer returns a deterministic 422 instead of an unhandled 500.

## 2. New `code` values, and why each is justified

Eight codes are new. Each names a condition the frozen taxonomy has no word for, and each sits inside the frozen envelope at a frozen HTTP status:

| New code | HTTP | Why not an existing code |
|---|---:|---|
| `DUPLICATE_RECOGNITION` | 409 | Generic `CONFLICT` would not tell a caller that revenue for this source already exists — the single most important thing to know before retrying |
| `PLATFORM_BILLING_NOT_RECOGNIZABLE` | 422 | The categorical exclusion in `B9-D-A021`; a generic validation error would invite a caller to "fix" the input, when nothing can fix it |
| `REVERSAL_EXCEEDS_REMAINING` | 409 | The bound is the central financial invariant; it deserves an unambiguous code |
| `CURRENCY_MISMATCH` | 422 | Distinguishes a currency error from every other validation failure, so a caller can correct precisely |
| `ALREADY_FULLY_REVERSED` | 409 | A terminal-state conflict distinct from an amount breach |
| `RECOGNITION_DATE_IN_FUTURE` | 422 | A period-integrity violation, not a format error |
| `REVERSAL_NET_UNDERFLOW` | 422 | A reversal that would book gross but no net is not a reversal; a generic validation error would not tell the caller the amount is simply too small for the event's ratio |
| `WORKSPACE_CURRENCY_UNRESOLVED` | 422 | Names precisely what could not be determined — the workspace's presentation currency — so a caller knows to pass `currency` explicitly rather than to re-check its period filters |

The remaining 28 rows use frozen codes verbatim. No frozen code is renamed anywhere in B9.

The two codes added by `B9-FIX.1` sit at `422`, a status the frozen `BACKEND_ERROR_CATALOG.md` already sanctions for semantic validation failures (*"VALIDATION_ERROR | 400/422"*). Because `B9-AF-031` and `B9-AF-036` can both be raised by the **frozen** `getAttribution` operation, whose frozen response set declares no `422`, that response-set change is registered as `B9-AM-011` rather than assumed.

## 3. Retryability

Only `B9-AF-028` is retryable, and it cannot duplicate revenue on retry: it fails **before** any write, so the transaction never opened.

`B9-AF-014` — the reversal-bound breach, including the case where a concurrent reversal committed first — is **not** retryable as issued. It fails inside a rolled-back transaction, and re-sending the same amount is rejected again for the same reason. The correct client action is to re-read the remaining amount and issue a *different, smaller* reversal, which is a new command rather than a retry.

`B9-AF-029` is likewise not retryable as issued, and the correct client action is the inverse: issue a **larger** reversal. Reversing the *entire* remaining gross always succeeds — it derives `Rn = N − Pn ≥ 0`, allowed as an ordinary reversal when positive and as the terminal gross-cleanup when zero — so no event can be left with an irreducible residual (`B9_REVERSAL_MODEL.md` §4.1a).

Every other failure is deterministic: retrying with the same input produces the same failure. A retried *successful* command replays through idempotency instead (`B9_IDEMPOTENCY_CONCURRENCY.md` §2).

## 4. Audit

Every row marked "Audit = yes" writes an immutable audit fact through the frozen audit writer, carrying actor, workspace, command, failure code and request id — **never** the rejected amounts in a way that would let the audit log become a shadow financial record. Pure input-format failures (`VALIDATION_ERROR` on shape) are not audited: they carry no security or financial signal and would drown the log.

## 5. What no failure ever reveals

Stack traces, SQL, internal ids, provider credentials, another workspace's existence, or whether a `public_id` exists elsewhere. `B9-AF-005`, `B9-AF-019`, `B9-AF-022` and `B9-AF-032` are all indistinguishable from a genuine absence. `AT-TEN-4` **(NC)**.
