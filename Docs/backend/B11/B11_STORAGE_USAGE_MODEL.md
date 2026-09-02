# B11 — Storage Usage Model

> Design only. Answers §30: what counts, what does not, and why the two totals are not the same number.

## 1. Two figures, deliberately not equal

> **`B11-D-A021`.** WazLink maintains two distinct storage totals per workspace and never conflates them.
>
> | Figure | Question it answers | Audience |
> |---|---|---|
> | **Logical (product) usage** | "how many bytes of this workspace's own, retrievable content does it currently hold?" | the customer; a future storage entitlement |
> | **Physical (provider) usage** | "how many bytes are actually occupying provider capacity for this workspace?" | operations; cost; capacity planning |

They diverge routinely and legitimately: a file deleted an hour ago is out of the logical figure immediately and out of the physical figure only after the purge grace period expires and the purge succeeds. Assuming they are equal would either bill a customer for bytes they cannot reach, or hide real capacity consumption from operations.

## 2. Authority

`file_assets` is authoritative for both figures. `workspace_storage_usage` is a **locked, repairable accumulator over that authority** — the same relationship B8's `usage_counters` has to its `usage_ledger`, with one improvement: because B11's underlying truth is a durable row set rather than an event stream, the accumulator can be recomputed exactly from `file_assets` at any time, so **B11 needs no ledger table.** Reconciliation class `R-7` performs that recomputation and repairs drift under the frozen "explicit, permissioned, idempotent, and audited" doctrine.

This is why the accumulator is not a second truth: it holds no fact that `file_assets` does not already hold, and any disagreement is resolved by recomputation, never by trusting the accumulator.

## 3. What counts

| Condition | Logical (product) | Physical (provider) | Rationale |
|---|:--:|:--:|---|
| `lifecycle=pending`, `object=unwritten` | no (counted as `in_flight`, §4) | no | nothing has been stored |
| `lifecycle=pending`, `object=present` | no (counted as `in_flight`) | **yes** | bytes are occupying capacity even though the file is not yet a business asset |
| `lifecycle=available` | **yes** | **yes** | the ordinary case |
| `lifecycle=quarantined` | **yes** | **yes** | the workspace caused these bytes and they still occupy capacity; excluding them would reward uploading content that gets held |
| `lifecycle=failed` | **no** | yes while `object=present` | a failed upload produced no asset; charging for it would penalize a network error |
| `lifecycle=archived`, `object` not yet `purged` | **no** | **yes** | the divergence case in §1 — access is gone, capacity is not |
| `lifecycle=archived`, `object=purged` | no | no | fully gone |
| `retention_class='legal'` (tax artifacts) | **no** | **yes** | the workspace neither chose to store it nor may delete it; charging a customer for a document WazLink keeps on its own behalf would be wrong (`B11_TAX_DOCUMENT_BOUNDARY.md` §5) |
| provider media import (B5 inbound WhatsApp media) | **yes** | **yes** | the workspace's own conversation caused it, and the workspace can see it — indistinguishable from an upload for accounting purposes |

Answering §30's five questions directly: **pending does not count** toward product usage (but does hold an in-flight reservation); **failed does not count**; **deleted-but-not-purged does not count** logically and **does** count physically; **provider media import counts**; **tax artifacts do not count** toward the workspace and do count toward the platform.

## 4. Race-safe enforcement, and where it happens

> **`B11-D-A020` (enforcement half). Quota is checked at BOTH points, with different authority.**

| Point | Uses | Authority | Purpose |
|---|---|---|---|
| `CreateUpload` | the *declared* size (client claim) | **advisory only** | fail fast before spending bandwidth; a lie here buys nothing |
| `FinalizeUpload` | the *measured* size | **authoritative** | the only check that can be trusted |

Only checking at intent would be trivially bypassed by understating the size. Only checking at finalize would let a workspace waste unlimited bandwidth before rejection. Both, with the intent check explicitly non-authoritative, is the correct pair.

**The parallel-intent race.** N concurrent `CreateUpload` calls, each individually within headroom, could collectively exceed the ceiling if only committed bytes were counted. `workspace_storage_usage` therefore carries two columns:

```
workspace_storage_usage(workspace_id PK, logical_bytes, in_flight_bytes, updated_at)
```

The enforcement protocol, mirroring B8's frozen reservation mechanics step for step:

1. `SELECT … FOR UPDATE` the workspace's row (creating it inside the same transaction if absent; an absent row reads as zero, never as "unlimited").
2. Compute `logical_bytes + in_flight_bytes + candidate_bytes` and compare against the effective ceiling.
3. If it exceeds, abort with `403 QUOTA_EXHAUSTED` **before any other side effect** — no `file_assets` row, no storage key, no provider call.
4. If admitted:
   - at `CreateUpload`: `in_flight_bytes += min(declared_size, MAX_FILE_BYTES)`;
   - at `FinalizeUpload`: `in_flight_bytes -= the reserved amount` and `logical_bytes += actual_size`, atomically;
   - at `ExpireUpload` / verification failure: `in_flight_bytes -= the reserved amount`, and nothing is added.
5. Every mutation commits in the **same transaction** as the `file_assets` state change it accompanies. A rollback for any reason undoes both together — usage is consumed only on committed effect, exactly the invariant `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` §6 states and B8 restates.

A declared size that is absent or zero reserves `MAX_FILE_BYTES` — the conservative assumption, so omitting the field is never an advantage.

**No Redis counter, cache, or lock participates in this decision.** PostgreSQL's row lock is the sole authority, per frozen `BACKEND_DATA_GOVERNANCE.md` and `B8_CONCURRENCY_MODEL.md` §1. `QUOTA_RACE_GAPS = 0` rests on §4. Acceptance: `AT-B11QUO-1` … `AT-B11QUO-6`.

## 5. Physical usage

Physical usage is **not** accumulated in `workspace_storage_usage`. It is computed on demand, by operations, as `SUM(size_bytes)` over rows where `storage_object_state = 'present'` grouped by workspace — and cross-checked against the provider's own `list_objects` totals by reconciliation class `R-5`. It has no enforcement point, because it is not a limit; it is a cost and capacity figure. Keeping it out of the hot accumulator avoids a second write on every purge and removes any temptation to enforce against a number whose repair path is a provider scan.

## 6. Leaked-reservation safety

An `in_flight_bytes` reservation whose transaction committed but whose upload then vanished (client abandoned, worker died) is released by `ExpireUpload` at `upload_expires_at`. Should that worker itself stop, reconciliation class `R-7`'s recomputation restores the correct `logical_bytes` and zeroes `in_flight_bytes` for every workspace with no `pending` rows — so a stalled worker degrades to "temporarily stricter than necessary," never to "silently unlimited." Failing toward strictness is the right direction for an abuse control.
