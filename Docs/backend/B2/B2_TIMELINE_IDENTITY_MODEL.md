# B2 — Timeline Identity, Ordering, and Deduplication Model

> **B2 status:** Timeline identity model specification (B2-FIX.3). Timeline entry identity, `occurred_at`, total ordering, cursor stability, and deduplication are precisely specified.
>
> **B2-FIX.3 added §5.5, the `last_activity_at` recovery contract.** The read-time-merge architecture below is unchanged and was not reopened. What changed is one thing: recovery of the persisted `last_activity_at` column after a future-clock-skew rejection is now **normatively caused** — a rejection is a retryable processing failure that is never acknowledged as successful — instead of being asserted as "the source redelivers it", which at-least-once delivery does not guarantee once a message has been acknowledged.
>
> **B2-FIX.2 locked the architecture: `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE`.** CRM persists `crm_activities` for its own actions and persists **nothing** for cross-domain entries — they are constructed from the owning domain's records during retrieval and exist only for the duration of the response. Identity (§2.2.1), deduplication (§4.2), and clock-skew eligibility (§5) are therefore all **read-path** properties, evaluated by the single algorithm in §7.2.

## 1. Core principle

**One logical business event → One timeline entry. Different events → Different entries. Same event replayed → Same entry.**

A timeline is a faithful, immutable record of everything that happened to a Lead. No entry is skipped, no entry is duplicated, and pagination does not corrupt traversal.

## 2. Concepts defined

### 2.1 Entry identity

**Definition:** A stable, deterministic, immutable identifier for ONE LOGICAL TIMELINE EVENT.

**NOT a source aggregate's public ID.** A Deal can generate four separate timeline entries:
- `DealCreated` (source event)
- `DealStageChanged` (source event)
- `DealWon` (source event)
- `DealLost` (source event)

All four reference the same `DEAL-*`. **All four require different entry identities.**

### 2.2 Entry identity — the canonical form

`entry_id` is a single **immutable text token, globally unique across every source domain**, in exactly one of two shapes. There is no third shape, no fallback, and no new persistent public-ID namespace: B2 mints neither `TLE-*` nor any per-domain timeline prefix.

| Shape | Used by | Form | Example |
|---|---|---|---|
| **A — CRM-owned** | every `crm_activities` row | the `crm_activities.public_id` verbatim | `ACT-7f3a91c2` |
| **B — cross-domain projection** | every entry merged from another domain | `<source_domain>:<source_event_id>` | `messaging:01J8F2K…`, `pipeline:01J8G4M…` |

**Why cross-domain collisions are impossible, not merely unlikely.** The proof rests on a rule the frozen registry actually states, not on a character-set restriction it does not.

`BACKEND_PUBLIC_ID_REGISTRY.md` defines the generation rule `public_id = <PREFIX>-<opaque immutable token>` and states that **prefixes are case-sensitive**. Every prefix registered in its section A is uppercase (`ACT-`, `MSG-`, `DEAL-`, …). A shape-A token therefore always begins with an uppercase registered prefix followed by `-`.

Shape B always begins with a **lowercase** `source_domain` token drawn from the closed set `{messaging, pipeline}` (`B2_DOMAIN_OWNERSHIP.md` §4), followed by `:`. Because prefix matching is case-sensitive and no lowercase domain token is a registered prefix, no shape-A token can begin with `messaging` or `pipeline`, so no shape-A token can equal a shape-B token. Two shape-B tokens can collide only if one domain issues a duplicate `source_event_id`, which §2.2.1 forbids of any eligible source.

**The registry does not constrain the opaque token's character set**, so B2 claims no `:`-exclusion grammar and does not depend on one. Disjointness follows from the case-sensitive registered-prefix rule alone. Uniqueness is structural rather than probabilistic; no hashing and no coordination between domains is required.

### 2.2.1 The cross-domain source contract

Because cross-domain entries are **merged at read time and never persisted by CRM** (§7), CRM cannot derive an identity from anything it stores. The identity must be *readable from the source domain at query time*. That is the whole of what B2 requires of another domain.

> **Every source record eligible for the CRM timeline exposes, on its own readable timeline record or read model, a stable immutable `source_event_id` identifying one logical business event.**

`source_event_id` MUST:

| Requirement | Why |
|---|---|
| be **stable across replay and redelivery** | the same logical event read twice must resolve to the same `entry_id` |
| **distinguish multiple events from the same aggregate** | `DEAL-4042` emits four events; four identities are required |
| **not** be the aggregate's public ID | `DEAL-4042` cannot identify four distinct events |
| **not** be the aggregate's `version` | a version repeats across replays and skips across concurrent writes |
| **not** be a mutable row position, offset, or ordinal | any reordering would silently re-identify history |
| **not** be a synthesized side-effect counter | a counter CRM invents is not deterministic and not replay-stable |
| **not** depend on CRM persistence | CRM stores nothing for cross-domain entries |

Alongside it, an eligible source record exposes the metadata §2.3 needs to construct a `TimelineEntry`: `source_domain`, `source_resource_ref`, `source_event_type`, `occurred_at`, `recorded_at`, actor information where the source has it, and the arguments its safe summary template consumes.

**This is a semantic contract on the source read model, not a change to the B0 event envelope.** B0's envelope already carries an `event ID` for transported events, and a domain may well use it as the value of `source_event_id`; but the timeline reads *records*, not in-flight events, so the obligation is that the identity be **readable**, which the envelope alone does not guarantee. Messaging (B5), Pipeline (B6), and any later source domain must honor this when they are designed. **B2 does not specify their storage schema, column names, or implementation** — only the semantics CRM reads.

**Eligibility rule.** A source domain's records are eligible for the timeline only while they expose a stable `source_event_id`. A domain that cannot is **excluded from the timeline** until it can — its records are not converted to entries, and no substitute identity is synthesized on its behalf. Excluding a source is deterministic; guessing an identity for it is not.

**Consequence for a multi-event resource.** `DEAL-4042` emitting `DealCreated`, `DealStageChanged`, and `DealWon` yields `pipeline:<id₁>`, `pipeline:<id₂>`, `pipeline:<id₃>` — three distinct entries whose `source_resource_ref` is the same `DEAL-4042`. The aggregate's public ID appears in `source_resource_ref`, **never** in `entry_id`.

### 2.3 Timeline entry contract (revised)

| Field | Source | Immutable | Notes |
|---|---|---|---|
| `entry_id` | §2.2, shape A or B | ✓ | `ACT-*` for CRM-owned; `<source_domain>:<source_event_id>` for projections. Globally unique across domains by construction. **No `TLE-*` namespace and no new public-ID prefix is minted.** |
| `source_domain` | metadata | ✓ | `crm` \| `messaging` \| `pipeline` \| … |
| `source_event_type` | metadata | ✓ | e.g., `lead_converted`, `message_inbound`, `deal_stage_changed` |
| `source_resource_ref` | metadata | ✓ | e.g., `LEAD-9999`, `DEAL-4042`, `MSG-5000`. Can be repeated across multiple entries. |
| `source_event_id` | source event envelope | ✓ | The immutable event ID from the source domain. **Required** for every cross-domain entry (§2.2.1) and NULL for CRM-owned entries, where `entry_id` already is the identity. It is the deduplication key of §4.2. |
| `occurred_at` | source event | ✓ | The **immutable business event instant** (see §3). |
| `recorded_at` | `crm_activities` commit, or the source record | ✓ | When the entry became durably knowable: the commit instant for a `crm_activities` row, and the source record's own immutable persisted ingestion instant for a cross-domain entry (§2.2.1). **Never the query instant** — a value that changed on every read would make "late-arriving history" undetectable and would not be immutable. |
| `actor` | source event or metadata | ✓ | `EntityRef` to `MEM-*`, or a system label like `system:automation`. Never a raw identity. |
| `summary` | template + args | ✓ | Safe summary, never free text. Generated from template. |
| `change` | source event | ✓ | Before/after, if the source event carries one. For a Task completion: `{field: "status", from: "pending", to: "completed"}`. |
| `target_ref` | source event | ✓ | `EntityRef` to the main subject of the event. For a Task completion: `TSK-1234`. |

**Ordering:** `(occurred_at DESC, entry_id DESC)` — see §3.

### 2.4 `occurred_at` definition

**The immutable business event instant.** NOT a mutable scheduling value.

| Source | `occurred_at` | Example |
|---|---|---|
| **CRM mutation** | The command execution instant (`now()`) | A Task is completed at 14:30:15 UTC → `occurred_at = 2025-01-20T14:30:15Z` |
| **Task lifecycle** | Command instant | Task created, updated, assigned, completed, or cancelled → the command's `now()` |
| **Appointment lifecycle** | Command instant | Scheduled, rescheduled, cancelled, completed, or no-show → the command's `now()` |
| **Task completion** | Completion instant | `CompleteTask` executed at 15:45:00 → `occurred_at = 2025-01-20T15:45:00Z` |
| **Appointment reschedule** | Reschedule command instant — when the move was **decided**, never the new start time | Rescheduled 2pm→3pm at 14:59:00 → `occurred_at = 2025-01-20T14:59:00Z`, not 15:00:00. The timeline records "at 14:59, someone moved this meeting". |
| **Note added** | Note creation instant | `AddNote` executed → `occurred_at = creation instant` |
| **Note removed** | Removal instant | `RemoveNote` executed → `occurred_at = removal instant` |
| **Message (Messaging domain)** | Message send/receive instant | Messaging's event timestamp, not the Lead's processing time |
| **Deal (Pipeline domain)** | Event instant (stage change, won, lost) | Pipeline's event timestamp, not CRM's ingestion time |

**Never use mutable fields:**
- ❌ `task.due_at` — this can change if the task is rescheduled.
- ❌ `appointment.start_at` — this changes when rescheduled.
- ❌ A user's local clock — always UTC.

**Justification:** A task that was due tomorrow but becomes overdue does not retroactively move its creation event backward in the timeline. A meeting rescheduled from 2pm to 3pm does not move the reschedule event forward to 3pm in the history.

### 2.5 A reschedule adds history; it never rewrites it

This is the case the earlier design got wrong, so it is stated as its own rule.

`RescheduleAppointment` on `APT-789`, originally scheduled for 2pm and moved to 3pm at 14:59:

| | `entry_id` | `activity_type` | `occurred_at` | Effect of the reschedule |
|---|---|---|---|---|
| The original scheduling event | `ACT-a…` | `appointment_created` | the instant `ScheduleAppointment` ran | **untouched** |
| The reschedule event | `ACT-b…` (new) | `appointment_rescheduled` | 14:59 — the decision instant | **appended** |

**Three consequences, all required:**

1. A **new** entry is created. The reschedule is its own logical event with its own identity.
2. The **original entry does not move**. Its `occurred_at` is immutable, so its position in the total order is fixed forever. Rescheduling a meeting ten times leaves the original `appointment_created` entry exactly where it always was and adds ten entries after it.
3. Neither entry's `occurred_at` is ever `appointment.start_at`. `start_at` is mutable; using it would mean every reschedule silently relocated historical entries and invalidated every cursor issued before the change — precisely the corruption §3.3 exists to prevent.

The identical rule holds for `task.due_at`: editing a due date writes **NO TIMELINE ACTIVITY ROW** at all (`B2_CRM_ACTIVITY_VOCABULARY.md` §6) and moves no existing entry.

## 3. Total ordering and cursor contract

### 3.1 Total order

The timeline's total order is:

```
ORDER BY occurred_at DESC, entry_id DESC
```

This guarantees:
- **No ties:** Even if two events have the same `occurred_at`, `entry_id DESC` breaks the tie. `entry_id` is a public ID (text) so lexicographic DESC ordering is deterministic.
- **Immutable:** Both `occurred_at` and `entry_id` are immutable after the entry is recorded.
- **Stable:** Repeated queries return the same order.

### 3.2 Cursor encoding

The cursor is an **opaque, deterministic encoding** of `(occurred_at, entry_id)`.

```
cursor = base64url( encode( { occurred_at: "2025-01-20T14:30:15.123456Z", entry_id: "ACT-abc123def456" } ) )
```

**Example (decoded for readability):**
```json
{
  "occurred_at": "2025-01-20T14:30:15.123456Z",
  "entry_id": "ACT-abc123def456"
}
```

Encoded:
```
eyJvY2N1cnJlZF9hdCI6IjIwMjUtMDEtMjBUMTQ6MzA6MTUuMTIzNDU2WiIsImVudHJ5X2lkIjoiQUNULWFiYzEyM2RlZjQ1NiJ9
```

**Cursor validation.** The timeline has exactly **one** order — `(occurred_at DESC, entry_id DESC)` — and no `sort` parameter, so the sort-key and filter-set invalidation rules that `B2_CRM_LIST_QUERY_MODEL.md` applies to `GET /leads` **do not apply here**. Only two validations exist:

- A cursor that does not decode to a well-formed `(occurred_at, entry_id)` pair → `400 VALIDATION_ERROR`.
- A cursor presented against a **different Lead** than the one it was issued for → `400 VALIDATION_ERROR`. The Lead is part of the request path, and honoring a foreign cursor would leak the existence and timing of another Lead's entries.

A cursor is otherwise valid indefinitely: because both components are immutable, a cursor issued a month ago still identifies the same position in the same total order.

**Traversal guarantee:**
- Starting from a cursor, the next page returns entries **strictly after** that cursor in the total order.
- If a newer entry with the same or newer `occurred_at` is inserted, it appears on a future page (or the current page if inserted before the client reads it), **never earlier**.
- If an older entry with an older `occurred_at` is inserted (late-arriving history), it appears on a later page, never on an earlier page.

### 3.3 Cursor stability under insertions

| Scenario | Behavior |
|---|---|
| **Late-arriving CRM entry with older `occurred_at`** | Appears on a later page. No earlier pages are corrupted. |
| **Late-arriving cross-domain entry (e.g., message from a message queue lag)** | Same as above. The cursor's `occurred_at` defines a strict boundary; older entries land on later pages. |
| **New entry exactly at cursor time with different `entry_id`** | Ordering is `(occurred_at DESC, entry_id DESC)`. If two entries have the same `occurred_at` but different `entry_id`, the one with the higher `entry_id` (lexicographically DESC) comes first. The cursor precisely separates them. No skip, no duplicate. |
| **Existing entry's `occurred_at` is mutated** | **Impossible.** `occurred_at` is immutable. |
| **Existing entry is deleted** | **Impossible.** Timeline entries are append-only. |

## 4. Deduplication and idempotency

### 4.1 CRM-owned entries

**Rule:** A CRM command creates exactly one `crm_activities` row. The row has a unique `public_id` (`ACT-*`). Replaying the same command inside the same transaction creates the same row (idempotent by `IdempotencyRecord`).

**Deduplication is a write-side property here.** If a command is retried, the second `crm_activities` row is never written (same transaction, same command); if the transaction rolls back and is retried, the idempotency record replays the same row. One `ACT-*` row exists, so one entry exists. `source_event_id` plays no part: it is null for CRM-owned entries, where `entry_id` is already the identity.

### 4.2 Cross-domain entries

**Pipeline example: `DealCreated`, `DealStageChanged`, `DealWon` — three separate logical events, three separate timeline entries.**

**Entry identity for Pipeline events.** One rule, no branches: `entry_id = pipeline:<source_event_id>` (§2.2, shape B). `DealCreated`, `DealStageChanged`, and `DealWon` on `DEAL-4042` therefore produce three distinct entries that share `source_resource_ref = DEAL-4042`.

B2-FIX.1 removed the earlier two-branch definition, which derived a `change_index` from "the Deal's `version` or a side-effect counter". That branch was not deterministic — an aggregate version repeats across replays and skips across concurrent writes — and it left an implementation agent to invent the counter. It is replaced by the single requirement in §2.2.1.

**Deduplication rule — and where it runs.** The dedup identity is `(source_domain, source_event_id)`, and it is applied **during the read-time merge of §7.2, step 6**. Two candidate source records that resolve to the same `(source_domain, source_event_id)` are the same logical event and yield **exactly one** `TimelineEntry`.

**CRM maintains no cross-domain deduplication store.** There is nothing to write, so there is nothing to keep consistent:

- **Replay and redelivery at the source create no second logical event**, because `source_event_id` is stable across them (§2.2.1). A redelivered event is the same event, so the read merge sees the same identity and produces the same single entry — with no CRM bookkeeping at all.
- If a source read model does expose more than one representation of one logical event, the merge collapses them on `(source_domain, source_event_id)` and keeps one. Which representation survives cannot be observable, because every `TimelineEntry` field is derived from immutable source metadata (§2.2.1), so all candidates project to identical entries.

Deduplication is therefore a **consequence of the identity rule evaluated at read time**, not a persisted mechanism that could drift, fall behind, or be forgotten.

### 4.3 Deduplication across CRM mutations and cross-domain events

**Example: A Task is created (CRM command), and later a message is sent about that task (cross-domain event).**

| Event | Entry Type | Entry Identity | Source | Occurrence |
|---|---|---|---|---|
| `CreateTask` | `crm_activities` | `ACT-1234` | CRM | Task created at 14:30 |
| `TaskCompleted` | `crm_activities` | `ACT-5678` | CRM | Task completed at 15:45 |
| `MessageSent` (re: the task) | Messaging read model | `messaging:<source_event_id>` | Messaging | Message sent at 15:50 |

**No duplication.** Three separate entries, three separate identities. The timeline shows all three. CRM never copies the Message into `crm_activities`; it reads Messaging's own record at query time and converts it to a `TimelineEntry` for that response only. Note that `MSG-9999` is the Message's `source_resource_ref`, **not** its `entry_id`.

**Forbidden pattern:** ❌ CRM should NOT create a duplicate `crm_activities` row of type `message_sent` just because a Message was sent. The message reaches the timeline via Messaging's own domain, not via CRM. This is what `B2_NOTE_ACTIVITY_TIMELINE.md` §3 prohibits.

## 5. Clock skew and future-dated events

### 5.1 The problem this rule closes

`occurred_at` arrives from other domains, and other domains have their own clocks. A single record stamped `2099-01-01` would, under a naive design, sit at the top of every page of the Lead timeline forever, ahead of everything real — and, if it were allowed to move `last_activity_at`, would pin that column to the year 2099 permanently, because `GREATEST()` is monotonic and monotonicity is exactly what makes the poisoning irreversible.

### 5.2 One tolerance, one comparison, re-evaluated at every evaluation

There is **one** constant and **one** comparison. What differs is only *where* it is evaluated. Both evaluation points share the same critical property: **eligibility is never decided once and cached.** It is recomputed from a freshly sampled clock every single time the question is asked — on every timeline read, and on **every** processing attempt at the `last_activity_at` consumer.

```
skew = occurred_at − processing_reference_time
ELIGIBLE  ⇔  skew ≤ CLOCK_SKEW_TOLERANCE
```

#### 5.2.1 `processing_reference_time` — the one canonical clock

`processing_reference_time` is **CRM's trusted server clock, sampled afresh at the start of each evaluation.** For the `last_activity_at` consumer, "each evaluation" means **each processing attempt**: the first delivery, every automatic retry, and every operational replay each sample their own value.

It is explicitly **none** of the following:

| Not | Why it would break the contract |
|---|---|
| the event's `occurred_at` | that is the source's clock, and comparing it to itself makes skew structurally zero |
| any source-supplied timestamp | an untrusted clock cannot be the reference for detecting an untrusted clock |
| the **first-receipt** timestamp | it never advances, so `skew` never shrinks and no retry could ever succeed — see §5.2.2 |
| an immutable `ingested_at` / `recorded_at` column | that is ingestion **metadata** (§5.2.3), not a live clock |
| the previous attempt's reference time | each attempt is independent; carrying the old value forward reproduces the frozen-clock defect |
| any client- or caller-supplied clock | trivially forgeable, and would let a caller force admission |

Formally, for attempt *N*:

```
processing_reference_time_N  =  CRM trusted server clock at the moment attempt N begins
ELIGIBLE_N  ⇔  event.occurred_at ≤ processing_reference_time_N + CLOCK_SKEW_TOLERANCE
```

Nothing about the event changes between attempts — `event_id`, `occurred_at`, `workspace_id` and every source reference are immutable (§2.3). **Only the trusted clock advances**, and that is precisely what makes recovery possible without mutating anything.

#### 5.2.2 Why the sampling rule is load-bearing, not a detail

Suppose `CLOCK_SKEW_TOLERANCE` is 5 minutes and a Pipeline event arrives stamped `occurred_at = 12:10` while CRM's clock reads `12:00`:

| Attempt | `processing_reference_time` | `occurred_at ≤ prt + tolerance`? | Outcome |
|---|---|---|---|
| 1 | `12:00` | `12:10 ≤ 12:05` — no | `RETRY_PENDING`, `last_activity_at` untouched, not acknowledged |
| 2 (later) | `12:06` | `12:10 ≤ 12:11` — **yes** | `ELIGIBLE` → `GREATEST()` applied → committed → acknowledged |

Had attempt 2 reused attempt 1's clock, the comparison would have been `12:10 ≤ 12:05` **forever**: every attempt would fail identically, the retry budget would always exhaust, and the automatic recovery path of §5.5.5 would be unreachable dead code. **That is why "evaluated once, at ingestion" is not an acceptable reading of this rule and is not what it says.** The numbers above are an illustration of the semantics, **not** a frozen production configuration.

#### 5.2.3 Ingestion metadata is not the eligibility clock

A delivery may carry immutable ingestion metadata — when CRM first received it — for audit, observability, or retry-age accounting. That is legitimate and unchanged, and `TimelineEntry.recorded_at` semantics (§2.3) are untouched by this section — it stays the immutable instant an entry became durably knowable, and is **never** the query instant nor an eligibility clock.

**Such a column must never be used as `processing_reference_time`.** The two are separate by construction: ingestion metadata records a fact about the past and is immutable; `processing_reference_time` is a live sample taken now, and its whole purpose is to advance. Confusing them is exactly the defect §5.2.2 rules out.

#### 5.2.4 Properties that hold at both evaluation points

- `CLOCK_SKEW_TOLERANCE` is **one configured constant, workspace-independent and source-independent**, default **300 seconds**. There is no per-provider, per-domain, or per-tenant tolerance; a single number keeps the rule auditable and keeps one misbehaving source from acquiring a bespoke exemption.
- **Past-dated records are always eligible.** Negative skew is normal — an outbox backlog, a retry, a replay after an incident — and the cursor contract in §3.3 already places late-arriving history correctly. Only the *future* direction is bounded.
- `occurred_at` is **never clamped, rewritten, or substituted** at either point. §2.3 declares it immutable, and the total order and every issued cursor depend on that.

| Evaluation point | When `processing_reference_time` is sampled | Effect when `skew > tolerance` | Reversible? |
|---|---|---|---|
| **Timeline read path** (§7.2 step 5) | at each query evaluation — once per request | the source record is not converted to a `TimelineEntry` for this response | **yes — recomputed on every read** |
| **`last_activity_at` consumer** | at the start of **each processing attempt** — first delivery, every retry, every replay | the event does not advance `last_activity_at`, and the delivery is classified `RETRYABLE_CLOCK_SKEW` — a processing failure, **not** a processed event | **yes — re-evaluated against a freshly sampled, later clock on the next attempt** (§5.5). What is irreversible is an *applied* `GREATEST()` write, which is never rolled back |

**CRM-owned entries are structurally exempt.** A `crm_activities` row's `occurred_at` is CRM's own `now()` at command execution, so its skew against CRM's own clock is zero and the check can never reject a CRM command. The rule bites only on cross-domain records.

### 5.3 Timeline eligibility is a read-path filter, and it self-heals

Step 5 of §7.2 evaluates eligibility for every candidate cross-domain record, on every request. Nothing about that decision is stored.

- While a record is future-dated beyond tolerance, **it is absent from the timeline** — no entry, no placeholder, no gap marker, and it takes no cursor position, because it never became an entry.
- It stays owned by its source domain throughout. CRM does not copy it, hold it, mark it, or delete it.
- **Recovery is automatic and needs no mechanism.** The record becomes eligible on the first read whose freshly sampled `processing_reference_time` satisfies `occurred_at ≤ processing_reference_time + tolerance` — either because CRM's clock advanced past the stamp, or because the owning domain corrected the record under its own semantics. It then appears **exactly once**, at its correct position in the total order, with the identical `entry_id` it would always have had, because `entry_id` derives from the stable `source_event_id` (§2.2.1) and never from the moment of admission.
- Because the record was never an entry, no earlier cursor could have passed it, and none is invalidated when it appears. This is the ordinary late-arriving-history case of §3.3.

**No CRM persisted quarantine row exists, and timeline correctness does not depend on one.** CRM may raise an operational alert when it observes an out-of-tolerance record, under the existing operations policy — that is monitoring, and no timeline behavior is conditioned on it.

### 5.4 `last_activity_at` under the same rule

```
last_activity_at := GREATEST(current_last_activity_at, occurred_at)
```

applied **only** to events that pass §5.2 at the consumer **and** belong to the closed qualifying set in `B2_LEAD_AGGREGATE.md` §4. The two filters compose in that order: admission first, qualification second.

- **CRM-owned mutations** apply it inside the mutating transaction; skew is structurally zero.
- **Cross-domain events** apply it in an idempotent consumer keyed by `event_id`.
- **Out-of-order arrival** is safe: if E2 (14:30) arrives before E1 (14:25), `GREATEST()` advances to 14:30 and E1 leaves it there.
- **A rejected event does not mutate the column.** The poisoning path is closed at admission rather than repaired afterwards, because after `GREATEST()` there is nothing left to repair.

**A rejection is a processing failure, not a processed event.** This is the point the whole recovery contract turns on. Admission (§5.2) decides whether the consumer *may* apply `GREATEST()`; it does **not** decide whether the consumer has *finished with* the event. An out-of-tolerance event has not been handled — it has been deferred — and §5.5 states, normatively and exhaustively, what the consumer must then do with it.

### 5.5 Recovery of `last_activity_at` after a future-skew rejection

**Why a recovery contract is required at all.** `last_activity_at` is `AUTHORITATIVE_PERSISTED` (`B2_LEAD_AGGREGATE.md` §4) and drives list sorting, activity recency, and stale-lead surfaces. Unlike the timeline — which persists nothing and therefore re-derives eligibility on every read (§5.3) — the consumer sees each delivery once. **At-least-once delivery guarantees redelivery only until a message is successfully acknowledged; it guarantees nothing after that.** A design in which the consumer rejects a future-skewed event and then acknowledges it would leave `last_activity_at` permanently stale with no mechanism that necessarily corrects it, and no amount of source-side "at-least-once" would repair it. Recovery therefore cannot be asserted; it must be *caused*, by refusing to acknowledge success.

#### 5.5.1 Canonical processing states

Every delivery of a qualifying cross-domain event to the `last_activity_at` consumer resolves to exactly one of three states. There is no fourth state, and no implementation discretion between them.

| State | Entry condition | Effect on `last_activity_at` | Message disposition |
|---|---|---|---|
| `ELIGIBLE` | `occurred_at ≤ processing_reference_time + CLOCK_SKEW_TOLERANCE`, evaluated against **this attempt's** freshly sampled clock (§5.2.1) | `GREATEST()` applied, then committed | processing **completed successfully**; the message is acknowledged **after** commit |
| `RETRY_PENDING` | `occurred_at > processing_reference_time + CLOCK_SKEW_TOLERANCE` on **this** attempt **and** the bounded retry budget of §5.5.3 is not exhausted | **unchanged** | classified `RETRYABLE_CLOCK_SKEW`; processing is **not** reported as successfully completed, so the transport preserves the delivery's retry eligibility and re-delivers it under §5.5.3 |
| `DEAD_LETTERED` | `occurred_at > processing_reference_time + CLOCK_SKEW_TOLERANCE` on **this** attempt **and** the bounded retry budget is exhausted | **unchanged** | terminal for automatic processing: the delivery is recorded as dead-lettered with `reason = CLOCK_SKEW` and an operational alert is raised (§5.5.4). It is **never** reported as successfully processed |

**These are integration-processing states, not CRM domain state.** None of them is a CRM aggregate, a CRM column, a CRM table, or a value any CRM read model, DTO, or API response exposes. `B2_LEAD_AGGREGATE.md` gains no field; §7's list of what CRM does not persist is unchanged. A dead-lettered delivery lives in the async platform's own store (§5.5.6), not in a CRM quarantine aggregate — the FIX.2 prohibition on a CRM quarantine table stands unchanged.

#### 5.5.2 Acknowledgement semantics, stated so no implementer chooses

The disposition is fixed here precisely so that an implementation agent never has to pick between ack-and-drop, an unbounded NACK loop, a bounded retry, and a silent ignore. Exactly one is correct:

| Outcome | Contract |
|---|---|
| `ELIGIBLE` and applied | **SUCCESS / ACK.** Acknowledgement follows `COMMIT`, never precedes it. A crash in between causes a redelivery, which §5.5.5 makes harmless |
| Future-skew, budget remains | **RETRYABLE / NOT ACKNOWLEDGED AS SUCCESSFUL.** The worker must surface a retryable failure for this delivery. It must **not** acknowledge, must **not** discard, must **not** partially apply, and must **not** rewrite, clamp, or substitute `occurred_at` to force eligibility |
| Future-skew, budget exhausted | **DEAD_LETTERED** under §5.5.4. Terminal for *automatic* processing only — replay (§5.5.5) re-enters the same evaluation |

**`DEAD_LETTERED` is not silent success, and it is not deletion.** It is a durable, alerted, operator-visible state from which the original event can be replayed. Ack-and-drop is prohibited outright: it is the exact behavior that produces the permanent staleness this section exists to close.

#### 5.5.3 The retry bound is bounded, and its numbers are not B2's to invent

**The classification is B2's, and B2 makes it here so no implementer has to.** Frozen `BACKEND_RETRY_POLICY.md` does **not** name a clock-skew row in its class table, and B2 does not pretend it does. Left unclassified, an implementer could plausibly file a future-dated timestamp under that table's `Validation` row (retry: **no**, max 1, terminal failure) — which would silently restore ack-and-drop and every defect §5.5 exists to close. B2 therefore decides it normatively:

> **`CLOCK_SKEW` is a RETRYABLE (transient) processing condition, not a validation failure.**

The justification is structural, not a preference: a validation failure fails identically on every attempt, whereas a future-skew rejection is *guaranteed* to stop failing once the trusted clock advances far enough (§5.2.2). It is transient in the strict sense B0's general rule uses.

Having classified it, B2 inherits B0's **generic** transient-retry mechanics rather than inventing its own. **B2 adds no row to B0's table, changes none of its numbers, and registers no amendment** — a classification is not a modification. B2 requires, normatively, that the applied policy has all of:

1. **A finite bound** — a maximum attempt count, a maximum retry age, or both. Unbounded retry is prohibited; a delivery may not be retried forever.
2. **Increasing delay between attempts** — B0's exponential backoff with full jitter. Immediate or fixed-interval re-delivery is prohibited: a future-dated event cannot become eligible faster than wall-clock time advances, so a tight retry loop is pure waste and constitutes a hot loop against the consumer.
3. **A stable event identity across every attempt** — the same `event_id`, the same `occurred_at`, the same `workspace_id`, the same source-domain and aggregate references. An attempt is a re-evaluation of the *same* event, never a new one.
4. **At most one effect on `last_activity_at`** — because the applied operation is `GREATEST()` over an immutable `occurred_at`, N attempts of which one succeeds are indistinguishable from one attempt that succeeds. No attempt counter, no partial application, no double count.
5. **A terminal state on exhaustion** — `DEAD_LETTERED` per §5.5.4, never a silent acknowledgement.

**The concrete attempt count, base delay, and cap remain operational configuration** under B0's standard (default five attempts, `base * 2^(attempt-1)` with full jitter, capped) and are **not** re-frozen here. B2 depends only on the properties above.

**Division of authority:** B2 owns the *semantic classification* (`CLOCK_SKEW` is retryable) and the five properties; **B0** supplies the *generic* transient-retry mechanics; **B12** supplies the concrete scheduler (§5.5.6). No implementation agent has to decide whether a clock-skew failure retries.

**The retry envelope is deliberately not sized to outlast arbitrary skew.** A small skew — a source clock minutes ahead of CRM's — is absorbed inside the retry envelope and recovers automatically with no human involvement. A large skew — a source stamping the year 2099 — will exhaust the budget, and *must*, because the alternative is a delivery held in flight for decades. That case is routed to `DEAD_LETTERED`, where it is visible, alerted, and replayable. Both branches terminate; neither loses the event.

#### 5.5.4 Dead-letter semantics — what B2 requires, and what it does not build

On exhaustion the delivery becomes `DEAD_LETTERED`. B2 states the **semantic requirement only** and specifies no store, schema, broker, scheduler, or tool:

- the dead-lettered delivery remains identifiable by its **original `event_id`** — no new identifier is minted, and the original is not rewritten;
- `reason = CLOCK_SKEW`, distinguishable from the malformed-payload dead-letter reason of `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.5 — a poison payload fails identically forever, whereas a clock-skew rejection is expected to succeed on a later attempt;
- the **`workspace_id` is preserved**, so replay cannot cross a tenant boundary and re-entry is subject to the same workspace scoping as first delivery;
- the **source domain, source event type, and the target aggregate reference** are preserved, so replay resolves to the same Lead;
- `occurred_at` is preserved **verbatim and unclamped** — §5.6 forbids rewriting it here exactly as it forbids rewriting it anywhere else;
- an **operational alert** is raised, and the state is visible on an operational surface. Terminal dead-lettering is never silent.

#### 5.5.5 Replay semantics and the recovery guarantee

A future-skewed event recovers by exactly one of two paths, and both terminate:

- **Path A — automatic bounded retry.** CRM's trusted clock advances past `occurred_at − CLOCK_SKEW_TOLERANCE` while the retry budget still holds. Because each attempt samples its **own** `processing_reference_time` (§5.2.1), the comparison is strictly easier to satisfy on every later attempt, so the first attempt taken after that moment evaluates `ELIGIBLE` and applies `GREATEST()`. **This path is reachable by construction** — nothing about the event has to change, no source has to redeliver, no human acts, and no operator tool is involved.
- **Path B — operational replay from `DEAD_LETTERED`.** After the producer's clock is corrected or enough time has passed, the delivery is replayed from the dead-letter store by the async platform's replay capability.

Replay, on either path, obeys the same rules:

- it **re-evaluates the original event against the same §5.2 eligibility rule** — replay is not an override, and there is no bypass that admits an event still outside tolerance;
- it uses **the same logical event identity** — the same `event_id` and the same `source_event_id`; it **does not synthesize a new business event**, does not emit an event, and does not write a `crm_activities` row;
- if eligible, it applies `GREATEST()` and only then acknowledges success;
- it **creates no timeline entry** — cross-domain timeline entries are read-time projections of the owning domain's records (§7) and no consumer, replayed or not, puts anything on the timeline;
- it is **idempotent**: replaying an event whose effect was already applied leaves `last_activity_at` byte-identical, because `GREATEST()` over an immutable `occurred_at` cannot regress or double-count.

**The guarantee.** No permanent under-count of `last_activity_at` may arise solely because a delivery was future-skewed. Every delivery ends in `ELIGIBLE`-and-applied, or in `RETRY_PENDING` with a further attempt guaranteed, or in `DEAD_LETTERED` with an alert and a replay path. There is no fourth outcome and, in particular, **no path in which a future-skewed event is acknowledged as processed without having been applied.**

#### 5.5.6 Ownership boundary — B2 depends, B12 builds

B2 owns the *semantics*: why `last_activity_at` needs recovery, the eligibility rule, the three processing states, the acknowledgement contract, the idempotency requirement, and the properties the retry/dead-letter/replay capability must have.

**What frozen B0 does and does not already provide.** B0's retry standard requires workers to keep **dead-letter records** and to raise an operational alert on exhaustion, so the terminal state of §5.5.4 rests on an existing frozen requirement. B0 does **not** define an operator **replay** capability, and B2 does not claim it does: Path B therefore depends on a capability that is **specified here but not yet built or frozen anywhere**. This is recorded honestly as a forward B12 dependency rather than assumed. It does not block B2, because B2 fully specifies the semantics that capability must satisfy (§5.5.4, §5.5.5) and because Path A recovers without it; but B12 must deliver replay for the §5.5.5 guarantee to hold end to end in production.

**B12 — Async & Integration Platform — owns the mechanism**, and is not designed here: the queue/broker choice, the retry scheduler, dead-letter persistence and its schema, retention, the operator replay tooling, and any Celery/Redis specifics. B2 records a **forward dependency on that platform capability** and nothing more. No B2 contract names a broker, and no CRM correctness argument in this package depends on which one is chosen — only on the five properties in §5.5.3 and the six in §5.5.4 holding.

#### 5.5.7 The divergence this leaves is bounded, visible, and temporary

Between a rejected delivery and its recovery a record can be visible in the timeline (§5.3 re-admits it on the first valid read) while `last_activity_at` has not yet counted it. This divergence is **permitted while the delivery is `RETRY_PENDING` or `DEAD_LETTERED` awaiting replay, and only then**. A permanent divergence caused by a lost or silently-dropped delivery is **not** permitted and is closed by §5.5.2.

- `last_activity_at` is defined as monotonic over *admitted qualifying events* (`B2_LEAD_AGGREGATE.md` §4), never over the timeline's contents. **`max(timeline.occurred_at) == last_activity_at` is not an invariant of this design and must not be asserted as one** — the two have different domains: the timeline includes non-qualifying records, and `last_activity_at` includes CRM events that are not cross-domain records.
- What *is* required is that the divergence has a terminating cause. Observability must make terminal `DEAD_LETTERED` state visible to operators (§5.5.4), so a divergence that has stopped healing on its own is detected rather than assumed away.

### 5.6 Why suppression rather than clamping

Clamping (`occurred_at := min(occurred_at, processing_reference_time)`) is the obvious alternative and is rejected, because it breaks two guarantees this document is built on:

1. **It mutates `occurred_at`,** which §2.3 declares immutable and which the total order and every issued cursor depend on.
2. **It is not replay-stable.** The same record read at a different time would clamp to a different value, so "same logical event → same entry, same position" would be false. Suppression keeps a re-read a no-op.

A clamped record also looks legitimate forever after, so the underlying clock fault is never noticed. A suppressed one is visible to operators, reversible, and re-admitted automatically once the source is correct.

### 5.7 Status

The eligibility policy was previously deferred as a Class C item and is **decided and closed** as Class A `B2-D-A026` (`B2_DECISION_REGISTER.md` §1). The `last_activity_at` recovery contract of §5.5 is closed as Class A `B2-D-A027`, added by B2-FIX.3 after an audit found that recovery had been *asserted* ("the source redelivers it") rather than *guaranteed*. No implementation agent has to choose a skew policy, a tolerance, an evaluation point, a processing disposition, an acknowledgement rule, a retry bound, or a recovery path.

## 6. Acceptance coverage

Every guarantee in this document is verified by a test defined in `B2_ACCEPTANCE_TEST_MATRIX.md`. The IDs below are the authoritative ones; this table is an index, not a second definition.

| Guarantee | Tests |
|---|---|
| Different events from one source resource get different `entry_id` | AT-TL-2, AT-TL-ID-1, AT-TL-ID-2, AT-TL-ID-3 |
| A source aggregate's public ID is never an `entry_id` | AT-TL-2, AT-TL-ID-2 |
| Cross-domain identities cannot collide | AT-TL-ID-7 |
| Same logical event replayed → same entry | AT-TL-ID-4 (CRM), AT-TL-ID-5 (cross-domain, read-time) |
| Identical `occurred_at` still totally ordered | AT-TL-ID-6, AT-TL-ORDER-1 |
| Ordering keys never mutate | AT-TL-ORDER-3 |
| Cursor traversal skips and duplicates nothing | AT-TL-8, AT-TL-ORDER-2 |
| A reschedule appends history without moving the original entry | AT-TL-ID-8 |
| A mutable due date moves no historical entry | AT-TL-ID-9 |
| CRM-owned event is not double-projected | AT-TL-4, AT-TL-ID-10 |
| Future-dated record is suppressed on the read path, `last_activity_at` unpoisoned | AT-TL-SKEW-1, AT-TL-SKEW-2 |
| Past-dated (late) record is eligible normally | AT-TL-SKEW-3 |
| A record that becomes valid is included exactly once, same `entry_id` | AT-TL-SKEW-4 |
| A future-skewed delivery is never acknowledged as processed, and `last_activity_at` recovers | AT-TL-SKEW-6 |
| Recovery by automatic bounded retry, with one effect and a stable identity | AT-TL-SKEW-7 |
| Recovery by dead-letter plus operational replay, idempotent and identity-preserving | AT-TL-SKEW-8 |
| The consumer disposition is deterministic — no ack-and-drop, no unbounded retry | AT-TL-SKEW-9 |
| Cross-domain entries are never persisted by CRM | AT-TL-4, AT-TL-MERGE-1 |
| `source_resource_ref` is distinct from `source_event_id` and repeats | AT-TL-ID-2, AT-TL-ID-11 |

## 7. Read-model shape and query semantics

**This section is logical. No SQL DDL, no migration, and no executable code is authorized anywhere in B2** (`B2_CRM_DOMAIN_BLUEPRINT.md` §7).

### 7.1 What must be retrievable, and by what key

`crm_activities` is specified as a logical table in `B2_NOTE_ACTIVITY_TIMELINE.md` §2, including its append-only rule and its ordering index `(workspace_id, lead_id, occurred_at DESC, public_id DESC)` — the exact key this document's total order needs. B2-FIX.1 adds no column to it: `entry_id` for a CRM-owned entry **is** `public_id` (§2.2, shape A), so no second identity column exists to drift from the first.

**Cross-domain entries are not persisted by CRM.** `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE`: they are constructed at read time from the owning domain's own records, as `B2_NOTE_ACTIVITY_TIMELINE.md` §3 requires, and exist only for the duration of the response. **CRM has no cross-domain timeline projection table, no dedup store, and no quarantine store**, so there is nothing for a replay to double-write and nothing that can fall out of step with a source domain.

### 7.2 Retrieval semantics — the canonical algorithm

`GET /leads/{id}/timeline` and the first page inside `Lead360.activities[]` are both evaluated by exactly these ten steps, in this order. **No admission, filtering, deduplication, or eligibility step exists anywhere outside this list.** Nothing here writes.

| # | Step | Requirement |
|---|---|---|
| 1 | **Workspace scope** | Every source is filtered by the caller's active `workspace_id` before anything else. A source that cannot be workspace-filtered is not a timeline source. |
| 2 | **Authorization** | The caller holds `lead.view` for the Lead. Each source class is then included only if the caller may read it: `messaging` requires `conversation.view`, `pipeline` requires `deal.view` (`B2_NOTE_ACTIVITY_TIMELINE.md` §3.2). An excluded source contributes nothing — no placeholder, no error, no count. |
| 3 | **Lead/source relationship** | Each admitted source is restricted to records related to this `lead_id` by that source's own declared relationship: `crm_activities.lead_id` directly; a Messaging record through the Conversation linked to the Lead; a Pipeline record through the Deal linked to the Lead. A source record with no such relationship is not a candidate. |
| 4 | **Source eligibility** | A cross-domain record is a candidate only if it exposes a stable `source_event_id` and the rest of the §2.2.1 metadata. A source domain that cannot is excluded wholesale (§2.2.1). `crm_activities` is always eligible. |
| 5 | **Clock-skew eligibility** | `ELIGIBLE ⇔ occurred_at − processing_reference_time ≤ CLOCK_SKEW_TOLERANCE`, where `processing_reference_time` is CRM's trusted server clock sampled at this query's evaluation (§5.2.1). Ineligible candidates are dropped for this response only. CRM-owned rows pass structurally. |
| 6 | **Canonical `TimelineEntry` construction** | Each surviving candidate is converted to the `TimelineEntry` of §2.3 — `entry_id` by §2.2 shape A or B, and every other field read from source metadata. Candidates that resolve to the same `(source_domain, source_event_id)` collapse to **one** entry here (§4.2). This is the only construction site; it is pure and writes nothing. |
| 7 | **Union / merge** | The per-source entry sets are unioned into one set. Sources are peers; none is primary. |
| 8 | **Total ordering** | The merged set is ordered `(occurred_at DESC, entry_id DESC)` — tie-free, deterministic, both components immutable (§3.1). |
| 9 | **Cursor predicate** | If a cursor is supplied, the set is restricted to entries **strictly after** `(occurred_at, entry_id)` in that order. The predicate is applied to **every** source, so no source can leak an entry the cursor already passed. |
| 10 | **Page-size limit** | The limit is applied **after** the merge, never per source, or a chatty source would starve a quiet one. |

Because the order is total and both of its components are immutable, applying the cursor predicate per source (step 9 pushed into steps 1–5) and then merging yields the identical result to merging and then applying it. That equivalence is what lets the read model be implemented either way without changing the contract.

**What is deliberately absent from this algorithm:** there is no CRM projection table to consult, no cross-domain dedup store, no quarantine table, no ingestion queue, and no write of any kind. Every cross-domain property this document guarantees — identity, deduplication, skew eligibility, and recovery — is produced by steps 4, 5 and 6 on every request.

### 7.3 Cursor encoding

The cursor is an opaque, deterministic, URL-safe encoding of the pair `(occurred_at, entry_id)` — nothing else. `occurred_at` is serialized as UTC ISO-8601 with microsecond precision, so that two entries distinguishable in storage remain distinguishable in a cursor. The encoding is not a security boundary: it is opaque so clients do not build on its internals, and every cursor is still validated per §3.2 before use.

## 8. Closure statement

**TIMELINE_ENTRY_IDENTITY = PASS.**
**TIMELINE_TOTAL_ORDER = PASS.**
**TIMELINE_CURSOR_STABILITY = PASS.**
**TIMELINE_DEDUPLICATION = PASS.**
**CROSS_DOMAIN_READ_TIME_MERGE = PASS.**

- Every logical timeline event has a unique, immutable identity in one of two structurally non-colliding shapes; no aggregate public ID is ever an `entry_id`, and no new public-ID namespace is minted.
- The total order `(occurred_at DESC, entry_id DESC)` is deterministic, tie-free, and built from two immutable components.
- The cursor encodes exactly that order tuple and stays valid across insertions, late-arriving history, and replays.
- One logical event yields one entry: CRM-owned events appear once as `ACT-*` and are never re-projected from the underlying Task, Appointment, or Note row; cross-domain events collapse on `(source_domain, source_event_id)` during the read merge and are never copied into `crm_activities`.
- `occurred_at` is the immutable business event instant, never a mutable scheduling field; a reschedule appends history instead of rewriting it.
- Future-dated records are suppressed by a **read-path** eligibility filter under one chosen, source-independent tolerance, so they cannot appear in the timeline; the same tolerance at the consumer keeps `last_activity_at` unpoisoned. Read-path recovery is automatic and needs no mechanism. `last_activity_at` recovery is **caused, not assumed**: a future-skewed delivery is a retryable processing failure that is never acknowledged as successful, so it recovers by bounded automatic retry or, on exhaustion, by alerted dead-letter replay (§5.5). Neither path depends on a CRM persisted quarantine row.
