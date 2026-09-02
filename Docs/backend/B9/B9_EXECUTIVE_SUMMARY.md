# B9 — Finance, Revenue & Attribution — Executive Summary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **Design-only. No implementation, migration, or frontend change is contained or authorized.**

## 1. What B9 is

B9 is the domain that finally *creates* recognized revenue — the thing B2, B3, B6, B7 and B8 each proved, in their own firewall documents, that they could not.

It owns five entities across five tables, and answers exactly two questions: **how much revenue did this workspace recognize**, and **which acquisition source earned it**. It answers them from an immutable register and nothing else.

## 2. The invariant, and how it is now enforced from the inside

Six frozen documents state some form of `Won Deal ≠ Recognized Revenue`. Every earlier domain proved it could not push revenue. B9 proves the complementary half — that it does not pull:

| Mechanism | Consequence |
|---|---|
| **Zero consumed events** (`B9-D-A002`) | `DealWon`, `PaymentSucceeded`, `SubscriptionActivated`, `InvoiceIssued` reach **no B9 handler**, because none is registered. Not "the handler is careful" — there is no handler |
| **Amounts are caller assertions** (`B9-D-A006`) | `gross`/`net`/`currency` are mandatory inputs. `Deal.value`, `Plan.price` and `Payment.amount` are never read in the recognition path |
| **Source validation is existence-only** | Resolving a `DEAL-*` confirms it exists in-workspace; not one field of it is copied into a monetary column |
| **Human actor required** (`B9-D-A008`) | Every financial row names a real membership. Automation holds no B9 permission, with or without approval |
| **Platform billing categorically excluded** (`B9-D-A021`) | A WazLink `PAY-*`/`INV-BILL-*` is rejected `B9-AF-007` |

The strongest clause in the pack is an absence: a domain with no event subscription cannot be made to react by mistake.

## 3. The five decisions that shaped everything else

**Ledger scope is a register, not an accounting system** (`B9-D-A003`). Double-entry GL and revenue-subledger designs were considered and rejected: no frozen document contains an account, a journal, a debit, a credit, or a period close. What the frozen contracts *do* describe — append-only tables, a `RecordRevenueEvent`/`ReverseRevenueEvent` pair, and a metric defined as a sum over `recognized_at` — is a register fold. B9 builds that and explicitly disowns AP, AR, bank reconciliation, payroll, inventory, tax and customer invoicing.

**Recognition is manual, and that is the design** (`B9-D-A008`). ADR-007 permits an "explicitly approved recognition rule"; Phase 1 defines none. This is what makes the firewall structural rather than procedural, and it matches a frozen frontend that has no recognition surface at all.

**Nothing is ever edited or deleted** (`B9-D-A010`). A correction is a compensating pair — reverse, then re-recognize — so the original 1,000 SAR fact stays permanently visible beside the 300 SAR that took part of it back. The only mutable column in the whole financial surface is `status`, and it is a derived fold recomputed under the same row lock that writes the reversal.

**A reversal's net is derived, not supplied** (`B9-D-A033`, `B9-D-A034`, `B9-D-A040`). The caller sends `gross`; B9 allocates the net from the event's own gross→net ratio by running total, so **exhausting gross always exhausts net**, and `reversed` requires both folds. This replaces a rule that let a caller send `gross=1000, net=1` against a `1000/800` event — passing every bound, flipping the status to `reversed`, and leaving 799 net revenue standing on an event the register called fully reversed, unreversible, with its source released for a second recognition on top of it.

The **converse** is not true, and `B9-FIX.2` stopped claiming it was. Rounding can exhaust the net fold while a gross residual remains — one ordinary reversal of `999.9999` against a `1000/500` event does it — and under `B9-FIX.1` that residual was unreversible, stranding the event as `partially_reversed` forever with its source locked. A reversal may now derive `net = 0`, but **only** as the terminal gross-cleanup: it must consume the exact remaining gross and net must already be exhausted. Every other zero-net reversal is still refused. Reversing the whole remaining gross always succeeds, so no event can be stranded.

**Attribution has two candidate sources, not one** (`B9-D-A035`, `B9-D-A036`). Recorded touchpoints and B3's immutable `discovery_results` — the **visible** ones, `filtered = false`, since a filtered row is B3 audit evidence rather than a delivered acquisition result (`B9-D-A044`) — compete in a single total order. This is what makes Track A work at all: B9 consumes no events and B3 cannot write B9's tables, so a touchpoint-only model would have required a human to re-type, per business, a fact B3 had already stored. B9 reads it instead — no writer, no system actor, no subscription.

**Recognition and attribution are independent** (`B9-D-A013`). `Recognized = Attributed + Unattributed`, exactly. Missing provenance is a data-quality signal, never a reason to lose revenue.

**Attribution is snapshotted, not recomputed** (`B9-D-A014`). ADR-008 requires *deterministic* first-touch attribution, and a figure that changes when a Lead is merged is not deterministic.

## 4. A defect found in the frozen frontend, and rejected

The frontend contains two layers that disagree. The older `data.js` (S2) **drops** any recognized event whose provenance chain is incomplete, then computes "revenue" by summing what survived, then asserts that attribution equals revenue — an identity that holds only because the numerator and denominator were made the same number (`FB-B9-005`, `FB-B9-006`, `FB-B9-007`).

The newer `analytics-engine.js` (S10) independently corrects all three: unattributed is computed as a **residual** of the recognized amount, recognition is summed over all events regardless of attribution, and missing attribution is demoted to a data-quality counter (`FB-B9-021`, `FB-B9-022`, `FB-B9-023`). The Analytics UI renders total, attributed, unattributed and over-attributed side by side, flagging over-attribution as a danger state (`FB-B9-026`, `FB-B9-027`).

B9 adopts the newer semantics and **explicitly rejects** the older ones. Had the older layer been treated as authoritative, B9 would have shipped a model in which losing a Lead record silently reduces reported revenue.

One further conflict was found and adjudicated: `analytics-engine.js` labels its model `multi_touch_weighted`, while frozen ADR-008 fixes Phase 1 at first-touch. The label is on a mock projection whose own data is uniformly `first_touch` with weight 1; the frozen ADR governs (`FB-B9-020`).

## 5. Counters

```
B9_DOCUMENT_COUNT = 36              B9_UNEXPECTED_FILES = 0

FRONTEND_BEHAVIOR_COUNT = 53        A 35 / B 6 / C 7 / D 5
OWNED_ENTITY_COUNT = 5              REFERENCED_ENTITY_COUNT = 16
                                    DECLARED_NON_DEPENDENCY_COUNT = 2

COMMAND_COUNT = 5                   frozen-reused 3, additive 2
PRODUCED_EVENT_COUNT = 6            frozen-reused 3, additive 3
CONSUMED_EVENT_COUNT = 0            deliberate (B9-D-A002)
PUBLIC_API_OPERATION_COUNT = 14     2 frozen paths, 12 additive
REUSED_PERMISSION_COUNT = 1         ADDITIVE_PERMISSION_COUNT = 6

FAILURE_SCENARIO_COUNT = 36         contiguous, 0 duplicates, 0 gaps
ACCEPTANCE_TEST_COUNT = 295         29 categories, 205 negative controls
CLASS_A 44/0   CLASS_B 12/0   CLASS_C 6/0
CONTROLLED_AMENDMENTS = 13          10 additive, 3 clarifications, 0 non-additive
FROZEN_ARTIFACTS_AFFECTED = 11     contract-bearing; metric in amendments §1a
RESEARCH_FACT_COUNT = 20            19 verified, 1 unresolved, 0 contradicted

B0_DRIFT … B8_DRIFT = 0             IMPLEMENTATION_LEAKAGE = 0
all authority-leak counters = 0     B10/B11/B12_FILES_CREATED = 0
```

## 6. The thirteen controlled amendments

Ten additive, three compatible clarifications, **zero non-additive**, across **eleven** contract-bearing frozen artifacts (`B9_CONTROLLED_AMENDMENTS.md` §1a defines the metric, enumerates all eleven, and names the three downstream-synchronization files it deliberately excludes). They add six finance permissions (frozen B1 has none), register the `REVR-` and `FRC-` public-ID prefixes, add two tables to the frozen Revenue/Attribution group, add the missing Revenue row to the frozen reconciliation process table, register twelve additive API operations, expose a read-only B8 `Refund` fact through the exact mechanism B8's own boundary prescribes, clarify what the frozen *"where status recognized"* qualifier means, add response codes to two frozen operations, add **optional** query parameters to the frozen `getAttribution`, record how the frozen *"valid touchpoint"* phrase is read, and reconcile one frozen document's abbreviated *"reversals"* against another's *"revenue_reversals"*.

**Zero non-additive is a result, not a target, and `B9-FIX.2` had to earn it twice.** `B9-FIX.1` had made `currency` a *required* parameter on the frozen `getAttribution`, whose frozen definition declares `"parameters": []` — a genuinely breaking change, registered nowhere, while `B9-AM-007` simultaneously claimed the operation was reused with unchanged request schemas. The correction was to withdraw the requirement, not to reclassify it: `currency` is now optional and defaults to the workspace's presentation currency, a default frozen `BACKEND_ANALYTICS_SEMANTICS.md` and frozen `B1_IDENTITY_DATA_MODEL.md` already fix (`B9-AM-012`, `B9-R-020`). Separately, `B9-AM-013` registers an assessment `B9-FIX.1` never made — whether letting B3 `discovery_results` compete in first-touch changes the frozen analytics semantics — and states the exact population where the two readings disagree, so the classification can be contested on evidence rather than accepted on assertion.

Seven candidates were examined and **rejected as designs** precisely because each would have been non-additive: renaming `RecordRevenueEvent`, re-adding typed `deal_id`/`payment_id` columns, making `RevenueEvent` mutable, subscribing to `PaymentSucceeded`, reclassifying `SRC-*` out of the frozen registry's §B, minting unregistered opaque tokens as public IDs, and requiring `currency` on a frozen operation. The last three were removed by redesign rather than registered.

All thirteen require CTO approval **before** implementation. B9 applies none.

## 7. Honest limits

**External research was performed in the `B9-FIX.1` pass** against official primary sources — IFRS 15, the SOCPA/Saudi jurisdiction profile, ZATCA e-invoicing, the ISO-4217 maintenance agency, and Tap's refund API. It changed **no** design decision, which is what "the design does not depend on it" was supposed to mean, now tested rather than asserted. One question remains UNRESOLVED (the active ISO-4217 code register) and nothing depends on it. B9 makes **no** compliance claim of any kind, and `AT-MON-5` **(NC)** exists so a verified fact is never quietly restated as one.

The research did earn its keep once: confirming that a Tap partial refund carries its own amount is why B9 reads a `Refund` fact rather than inferring one from `Payment.status`.

Eight residual risks are stated rather than hidden (`B9_FAILURE_MODE_ANALYSIS.md` §4, `R-1`…`R-8`) — chief among them that a human can recognize revenue that was never earned. No system can validate a commercial assertion it has no evidence for; B9's answer is permission separation, mandatory resolvable evidence, immutable history and a full audit trail, not a pretence of validation.

`B9_FAILURE_MODE_ANALYSIS.md` §5 lists what would falsify this design, so a reviewer can disagree with the trades rather than discover them later.

## 8. Status

B9 is design-only and grants no implementation authorization. `IMPLEMENTATION_HANDOFF = PASS`: all 28 handoff questions (`B9_IMPLEMENTATION_READINESS.md` §1) are answerable from this pack alone, with no policy left for an implementer to invent.

`B9-FIX.1` remediated one CRITICAL and nine MAJOR findings from independent verification. The CRITICAL one is worth naming plainly, because it is the kind of defect this whole domain exists to prevent: independently-bounded reversal amounts let recognized revenue be silently misstated through the ordinary, fully-authorized command path, with every negative control passing. The fix removes the input rather than adding a check.

`B9-FIX.2` remediated four MAJOR, six MINOR and two INFO findings from a second, fresh independent verification. Three are worth naming, because each is a *different* way a design can be wrong while reading as correct:

- **An asserted invariant whose converse was never proved.** `Σ gross = G ⟹ Σ net = N` was written as `⟺`. The forward direction is a theorem; the reverse is false on rounding, and the state it declared impossible was reachable by one ordinary command — leaving an event permanently `partially_reversed` with its source locked. Both the self-adversarial analysis and the first audit checked only the safe direction.
- **A breaking change described as compatible.** Requiring a parameter on an operation whose frozen definition declares `"parameters": []` is not additive, and saying "no previously-successful request becomes a failure" beside it did not make it so.
- **A gap closed in name only.** Op 6 was added specifically so the frozen per-event surfaces could be served, and still omitted two of the fields they render — so the export rule it was introduced to satisfy remained unsatisfied.

None of the three was found by re-reading the pack's own claims. All three were found by going back to the frozen contract and the frontend source and checking the claims against them.

`B9-FIX.2a` remediated a **third** fresh independent countersign, which re-proved the financial core from first principles — the reversal arithmetic across ten mandated cases, the terminal gross-cleanup, the two-fold reversal rule, recognition and reversal concurrency, the firewall, tenancy, monetary RBAC, and the frozen `getAttribution` contract — and found **no CRITICAL and no substantive design defect**. `B9-AM-012` and `B9-AM-013` were both confirmed correctly classified on the frozen evidence.

What it found instead was that the pack's *account of itself* had drifted from the pack, and the lesson generalises past the individual lines:

- **The verifier was exempting itself.** `B9_VERIFICATION_MATRIX.md` still asserted the withdrawn `B9-FIX.1` rule that `currency` is a *required* parameter — the precise change `B9-FIX.2` withdrew, and the one `AT-API-14` **(NC)** forbids — inside the document claiming `STALE_COUNTERS = 0` and `FALSE_COMPATIBILITY_CLAIMS = 0`. The sweeps had used it as the checker and never run it against itself. §7a of that file now makes the verifier verified last, and by the same sweeps.
- **A counter with no metric drifts every time it is recounted.** `FROZEN_ARTIFACTS_AFFECTED` was wrong twice in the same way — "9" above a list of ten, then "10" above a list of eleven — because nobody had said what "affected" meant. It is now defined before it is stated, both sets are enumerated, and `AT-DOM-4` checks the count against the list.
- **Two rules the pack relied on but never stated.** The workspace presentation currency is **mutable** under frozen B1, so the omitted-`currency` default needed a resolution instant (`B9-D-A043`: request time; it selects, it never converts; an as-of rule is unbuildable because no currency history exists). And a `filtered = true` `discovery_results` row was a first-touch candidate purely by omission — now decided, exclusively, on frozen B3's own visible/evidence line (`B9-D-A044`).
- **An acceptance stimulus that could not fire.** `AT-REVR-25` reversed `gross = 0.00005`, which `B9-AF-008` rejects for scale before the `B9-AF-029` it asserted could ever be reached. Replaced with a reachable scale-4 case that is genuinely non-terminal.

No architectural decision was reopened; every hardened financial rule is unchanged.
