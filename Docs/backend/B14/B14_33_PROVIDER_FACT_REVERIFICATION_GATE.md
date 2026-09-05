# B14_33 — Provider Fact Re-verification Gate (`FI-B12-12`)

> **Added by `B14-FIX.1` to close `V-06` (F).** `B13_B14_BOUNDARY.md` §4: *"B13 grants B14 **no shortcut** to skip re-verifying the four load-bearing provider facts B12 already flagged (`FI-B12-12`'s re-verification gate)."* The identifier appeared **nowhere** in the pre-fix pack, and `B13_IMPLEMENTATION_HANDOFF.md` §1 gate 6 remains **open**.

## 1. The frozen gate, read directly

`B13_FROZEN_INPUT_INVENTORY.md` `FI-B12-12` anchors `B12_PROVIDER_RESEARCH_REGISTER.md` — *"15 external facts (9 `VERIFIED`, 1 `PARTIAL`, 5 `UNRESOLVED`, 0 `CONTRADICTED`); **re-verification gate for `B12-X-001/005/006/014`**."*

`B12_PROVIDER_RESEARCH_REGISTER.md` §4, verbatim:

> *"Every `VERIFIED` fact is a **snapshot of documentation on the date of this pass**, not a permanent truth. `B12_IMPLEMENTATION_HANDOFF.md` §1 makes re-verification of `B12-X-001`, `005`, `006`, and `014` a pre-implementation gate, because **a change to a signature scheme or a retry bound would invalidate a load-bearing control** rather than merely a comment."*

**B14 may not waive this gate, and does not.** The four facts are exactly `B12-X-001`, `B12-X-005`, `B12-X-006`, `B12-X-014` — not a paraphrase, and not the wider 15-fact register.

## 2. Why these four and not the other eleven

Each is **load-bearing**: a control's correctness depends on it, not merely a comment. The other eleven are either `UNRESOLVED` (and the design already refuses to depend on them — `B12-D-A012`) or non-structural.

## 3. The four facts

### `B12-X-001` — Meta inbound webhook authentication · `VERIFIED`

| Field | Value |
|---|---|
| **Fact** | *"We sign all Event Notification payloads with a **SHA256** signature and include the signature in the request's `X-Hub-Signature-256` header, preceded with `sha256=`."* Validation: generate SHA256 over the payload with the **App Secret**; compare against the header value after `sha256=` |
| **Authoritative source** | `developers.facebook.com/docs/graph-api/webhooks/getting-started` |
| **Slice** | **I6** (Messaging / WhatsApp) |
| **Source type** | Provider's own primary documentation. **Not** a blog, SDK comment, StackOverflow answer or LLM recollection |
| **Verification evidence** | URL, retrieval date, and the **quoted clause** recorded in the slice evidence package (`B14_24` §3) |
| **Latest safe point** | **Before the first line of `adapters/whatsapp` verification code** |
| **If it changed** | **Adapter implementation only.** The header name, algorithm or prefix changes inside `adapters/whatsapp`. `B12_WEBHOOK_GATEWAY.md`'s verify-before-parse ordering, receipt/dedup model and fail-closed rule are **unchanged** |
| **Architecture impact** | **None** — `B12-D-A022` already refuses a universal provider interface, and `B12-D-A030` already makes verification an adapter responsibility |
| **Failure behaviour** | Slice **stops**. Signature verification is never implemented from memory. Absent a verified scheme the connection stays `configuration_required` and **must not be enabled** (`B12-D-A054`) |

### `B12-X-005` — Tap inbound webhook authentication · `VERIFIED`

| Field | Value |
|---|---|
| **Fact** | HMAC-SHA256 under header **`hashstring`**, computed with the **Secret API Key** over a **field concatenation** — for charges `"x_id"+id+"x_amount"+amount+"x_currency"+currency+"x_gateway_reference"+…+"x_status"+status+"x_created"+created` |
| **Authoritative source** | `developers.tap.company/docs/webhook` |
| **Slice** | **I9** (Billing + Tap) |
| **Why load-bearing** | B12 calls it *"**the single most design-shaping fact in this pack**"* — **Tap signs *fields*, Meta signs the *payload***, so a universal "HMAC the raw body" verifier is wrong for Tap and vice-versa. It is the evidence behind `B12-D-A030` |
| **Latest safe point** | Before any `adapters/tap` verification code |
| **If it changed** | **Adapter implementation only** — *unless* Tap moved to whole-body signing, which would **not** invalidate `B12-D-A030` either; that decision is already the general case |
| **Architecture impact** | **None.** A change here **strengthens** rather than undermines the frozen refusal to share a verification implementation |
| **Failure behaviour** | I9 stops. Tap connection stays `configuration_required`; **checkout unavailable, platform unaffected** (`B14_17` §5) |
| **Secondary consequence** | `B12-X-012` (no Tap event ID, no idempotency header) is `UNRESOLVED`; dedup therefore uses tier-2 identity `(provider, object_id, status, created)` **derived from Tap's own signed fields**. If `B12-X-005`'s field set changes, **the dedup identity must be re-derived with it** — they are coupled |

### `B12-X-006` — Tap callback retry bound · `VERIFIED`

| Field | Value |
|---|---|
| **Fact** | *"If the POST URL is not accessible, the posting of the response payload will be failed. There will be **two more retry attempts** before the status of the POST is updated as ERROR."* — **three total attempts** |
| **Authoritative source** | `developers.tap.company/docs/webhook` |
| **Slice** | **I9** |
| **Why load-bearing** | *"Decisive and asymmetric with Meta."* Three attempts means **a WazLink outage can permanently lose a payment callback** — which is why B8's `retrieve_charge` reconciliation is **the guarantee, not an optimization** (`B12-D-A025`). Meta redelivers for 36 h; Tap does not |
| **Latest safe point** | Before I9's reconciliation design is implemented |
| **If it decreased** | Reconciliation becomes **more** load-bearing. `B12-D-A025` holds a fortiori; monitoring tightens |
| **If it increased materially** | `B12-D-A025` **still holds** — reconciliation is never downgraded to an optimization on a more generous retry bound, because a bound is not a guarantee. **Removing reconciliation on this basis is a rejection ground** |
| **Architecture impact** | **None in either direction** — by design, the control does not depend on the bound's value, only on its finiteness |
| **Failure behaviour** | I9 stops if the retry semantics can no longer be established at all |

### `B12-X-014` — Meta signature byte basis · `PARTIAL`

| Field | Value |
|---|---|
| **Fact** | Whether the signature is computed over the **raw bytes** rather than a re-serialized body. `B12-X-001`'s page states algorithm, header and secret but **does not state the byte basis** |
| **Status** | **`PARTIAL`** — B12 keeps frozen `B5_WEBHOOK_SECURITY_MODEL.md` §3's **stricter raw-bytes reading**, which is *"correct under both interpretations"*, and flags confirmation as a pre-implementation gate **rather than asserting the provider documents it** |
| **Slice** | **I6** |
| **Latest safe point** | Before `adapters/whatsapp` verification code |
| **If confirmed raw-bytes** | Nothing changes — the implementation already assumes it |
| **If confirmed otherwise** | **Still nothing changes.** The strict reading is safe either way; B14 **does not relax** to a re-serialized basis on such a finding, because re-serialization is attacker-influenceable |
| **Architecture impact** | **None** |
| **Implementation obligation** | The request's **raw body must be captured before any parsing** and verified byte-for-byte. A framework that re-serializes before verification is **prohibited** |
| **Failure behaviour** | If the raw body cannot be captured before parse, **the slice stops** — this is the frozen verify-before-parse ordering (`FI-B12-17`) |

## 4. Discharge procedure

For each fact, inside its own slice and **before** the code that depends on it:

1. Fetch the provider's **own** documentation at the URL above.
2. Record **URL, retrieval date, and the quoted clause** in the slice evidence package.
3. Compare against the frozen quote in `B12_PROVIDER_RESEARCH_REGISTER.md`.
4. Classify: **`UNCHANGED`** · **`CHANGED_ADAPTER_ONLY`** · **`CHANGED_ARCHITECTURAL`**.
5. `UNCHANGED` or `CHANGED_ADAPTER_ONLY` ⇒ proceed, evidence attached.
6. **`CHANGED_ARCHITECTURAL` ⇒ stop.** Escalate to CTO. **The slice may not proceed, and no B12 document may be edited by the implementing agent** (`B14_24` rule 4).

**No LLM recollection, cached summary or third-party article discharges this gate.** Only the provider's current primary documentation counts.

## 5. Standing obligation — the gate does not close permanently

A discharge is itself a dated snapshot. It is re-run:

| Trigger | Scope |
|---|---|
| Before the **first production enablement** of that provider | that provider's facts |
| On any provider-announced breaking change | that provider's facts |
| On a signature-verification failure rate above `CB-19` with no local cause | that provider's facts |
| **Annually** | all four |

`B14_30` §4's production gate requires a current discharge for **every enabled** provider.

## 6. Relationship to the other provider work

`B14_10` §6's *implementation-time verification* rows (Places surface, Tap API, OpenAI shapes, scraping vendor) are a **broader, weaker** obligation: they prevent guessed contracts. **This gate is narrower and stronger** — four named facts whose change would invalidate a load-bearing control. Satisfying `B14_10` §6 does **not** discharge `FI-B12-12`; they are recorded and evidenced separately.

## 7. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-FIB12-1` | I6 evidence package | Inspect | Discharge records for **`B12-X-001` and `B12-X-014`** with URL, date and quoted clause |
| `T-FIB12-2` | I9 evidence package | Inspect | Discharge records for **`B12-X-005` and `B12-X-006`** |
| `T-FIB12-3` **(NC)** | WhatsApp webhook | Send a body whose re-serialization differs from the raw bytes | Verification uses **raw bytes**; the re-serialized form does **not** validate |
| `T-FIB12-4` **(NC)** | Tap webhook | Present a valid **whole-body** HMAC instead of the `hashstring` field concatenation | **Rejected** — Tap's verifier is field-based and is not interchangeable with Meta's |
| `T-FIB12-5` **(NC)** | Codebase | Grep for a shared signature-verification implementation across adapters | **None** — verification is per-adapter (`B12-D-A030`) |
| `T-FIB12-6` | Production gate | Check every enabled provider | A **current** discharge record exists; a stale or missing one **blocks the gate** |
| `T-FIB12-7` **(NC)** | I9 | Attempt to remove `retrieve_charge` reconciliation citing a longer retry bound | **Rejection ground** — `B12-D-A025` does not depend on the bound's value |
