# 06 — Identity Resolution

> Resolves brief §11. **Resolution is a read. Merging is a governed human command. Neither ever crosses a workspace.**

## 1. What frozen architecture already decided

Two frozen positions bound this design and neither may be quietly overturned:

1. **`B2_CONTACT_MODEL.md` §1** — *"B2 does not build a global Person identity system. There is no cross-workspace person, no identity resolution, no merge-by-email… cross-workspace person resolution would require an identity authority that no B0 domain owns, and would make one tenant's data reachable through another tenant's matching — the exact harm CRM-INV-2 forbids."*
2. **CRM-INV-18** — *"Contact PII is never an identity key. No unique index on `contacts.phone` or `contacts.email`, at any scope."*

**Neither is contradicted by this plan.** `GAP-006` proposes a **workspace-scoped** resolver. B2's refusal was of a *global* identity authority; a per-workspace index is a different object and is already precedented in-corpus by `business_identities` (`B3_BUSINESS_IDENTITY_MODEL.md` §4), which does exactly this for provider identities.

CRM-INV-18 survives because the proposed index is **non-unique and advisory**: it maps an identifier to *candidates*, and never enforces that a phone number identifies exactly one party.

## 2. Identifiers evaluated

| Identifier | Include? | Normalization | Confidence | Rationale |
|---|:--:|---|---|---|
| `phone` | **yes** | E.164 where parseable, else verbatim with `normalized = NULL` — the **exact rule frozen `contacts.phone_normalized` already uses** | high | The primary WhatsApp join key |
| `whatsapp_id` (WA ID / phone ID) | **yes** | provider-verbatim | **highest** — provider-asserted | B5 already attaches provider identity to a Contact; this indexes it |
| `email` | **yes** | `lower(btrim())` — the frozen `contacts.email` rule | medium | Shared mailboxes (`info@…`) are common; never sufficient alone |
| `external_crm_id` | **yes** | verbatim + `system` qualifier | **highest** when present | The correct key for import idempotency |
| `domain` | **no** | — | — | Many tenants share a domain (agencies, franchises); high false-merge risk for no unique value |
| `business_id` | **yes** (as link, not identifier) | — | exact | Already an FK; needs no index row |
| `contact_id` / `customer_id` / `lead_id` | **yes** (as target, not identifier) | — | exact | These are the resolution *result* |

**`domain` is deliberately excluded** — this is the one identifier where competitor practice (E-10) and safety diverge.

## 3. `party_identifiers` — the proposed index

| Column | Notes |
|---|---|
| `workspace_id` | **part of every key; the isolation guarantee is structural** |
| `identifier_kind` | `phone` \| `whatsapp_id` \| `email` \| `external_crm_id` |
| `identifier_normalized` | normalized per §2 |
| `party_type` | `contact` \| `lead` \| `customer` \| `business` — a `customer` target carries its `party_kind`, but resolution logic is **identical for `organization` and `person`**: the walk is always `identifier → Contact → Customer` (`PD-001`), so no person-specific path exists |
| `party_id` | the target row |
| `confidence` | `provider_asserted` \| `human_entered` \| `imported` \| `inferred` |
| `first_seen_at`, `last_seen_at` | |

Index `(workspace_id, identifier_kind, identifier_normalized)` — **non-unique**, by design and per CRM-INV-18.

**There is no global index, no cross-workspace table, and no query path that omits `workspace_id`.** A resolver call without a workspace is not an error condition to handle — it is not expressible in the API.

## 4. Inbound WhatsApp resolution — the required decision table

Brief §11 asks explicitly what happens for each case. Every outcome below is **read-only**; none creates a commercial counterparty.

| Resolved to | What happens | What must NOT happen |
|---|---|---|
| **Known Contact** (1 match) | Conversation links to that Contact; its Lead/Customer context loads into the inbox | — |
| **Known Customer** (via its contacts) | Conversation shows Customer 360 context; AI retrieval scoped to that Customer | Creating a second Customer |
| **Known Lead** | Existing B5 behavior, unchanged | — |
| **Known Business, no Lead** | Conversation opens **unlinked**, with a *suggested action*: "convert this Business to a Lead" | Auto-converting — that is a human pursuit decision (`B2`'s conversion is `business.convert`-gated) |
| **Unknown person** | Conversation opens **unlinked**, with `identity_state = unresolved`. The message is durably received, consent state recorded, and a **proposal** to create a Contact/Lead is offered | **Auto-creating a Lead or Customer.** An inbound message is not consent to be entered into a CRM, and silent creation makes spam a write path |
| **Multiple matches** | `identity_state = ambiguous`; conversation opens unlinked, candidates surfaced for human choice | Picking the "best" match automatically |

**The unresolved and ambiguous cases are the safety-critical ones**, and both resolve to *"open the conversation, resolve nothing, ask a human"*. This mirrors B12's frozen `P-7` handling of a receipt whose binding resolved to zero or several workspaces: *"report only, quarantined — never guessed."* The same discipline, applied one layer up.

## 5. Duplicate detection and merge (`GAP-007`)

**Detection** is advisory and non-blocking — exactly the frozen `AddContact` behavior (`B2_CONTACT_MODEL.md` §4: *"The create still succeeds with `201`. It is a hint, never a gate"*). Import (`GAP-008`) raises the same signal per row without blocking the batch.

**Merge execution is P1, not P0** (`PD-006` APPROVED). The P0 wave ships **advisory detection and merge candidates only**; execution follows later and blocks nothing. When built, merge is a distinct, high-trust, human-only command:

| Property | Rule |
|---|---|
| Trigger | **human only**; never automatic, never AI, never a scheduled sweep |
| Permission | new `customer.merge` — separate from `customer.update`, on the same reasoning B12 used to separate replay from view (*"Reading an incident and re-executing it are different powers"*) |
| Scope | **within one workspace only**; a cross-workspace merge is not authorizable by any role |
| Survivorship | explicit human field-level choice; **no automatic "newest wins"** |
| Reason | mandatory non-empty `reason`, following the frozen `ReplayRequest` precedent (`FI-B12-15`) |
| Lineage | append-only `merge_records`; the losing party is **archived, never deleted**, so B5 conversation references and B9 attribution snapshots stay resolvable |
| Immutables | **no `RevenueEvent` and no attribution snapshot is ever rewritten.** Both are immutable in B9; merge adds lineage beside them, never over them |
| Reversal | **none — `PD-006` APPROVED: merge is irreversible when eventually executed.** This is why execution was moved out of the P0 wave |

**`B2-D-C003`'s two stated conditions are met**: survivorship policy (human, field-level) and conversation-reference migration (archive-not-delete plus lineage, so no reference breaks).

## 6. Confidence and conflict

Resolution returns candidates ordered by `confidence`, and the **caller never auto-selects when more than one candidate exists at the same confidence**. `provider_asserted` (a WhatsApp ID Meta gave us) outranks `human_entered`, which outranks `imported`, which outranks `inferred`. Where two `provider_asserted` identities disagree, the outcome is `ambiguous` — a reportable state, not a guess.

## 7. Domain placement

**A new bounded `identity` app, not an extension of B2.** Three reasons: B2 explicitly disowned identity resolution, so extending B2 would contradict its own stated scope; the resolver must serve B5, imports, forms and the AI agent, none of which should import CRM internals; and keeping it separate preserves B2's frozen invariant surface untouched. The app owns `party_identifiers` and `merge_records` and produces **one** event, `PartiesMerged`. It consumes no events and executes no domain mutations of its own — every merge effect is applied by the owning domain's own command.
