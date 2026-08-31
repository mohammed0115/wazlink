# B5 — Controlled Amendments

> **B5 status:** Target design only. B5 does not edit any frozen file. For every item below: the frozen text, the target text, the classification, and the composition order.
>
> **B5-FIX.1 correction:** item 4 below originally claimed `conversation.view` and `messaging.send` as new permission rows to add to frozen `B1_AUTHORIZATION_RBAC.md`, stating that file had "no `conversation.*`/`messaging.*` row." Independent audit found this false — both `conversation.view` and `message.send` already exist there, `message.send` tracing further to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23. Item 4 is corrected below to `REUSE` both verbatim and add only `messaging.manage`/`messaging.provider.manage`. Item 2's command-count breakdown is also corrected (2 frozen + 10 additive, not 4 + 8).

## 1. The bundle — 6 operations, 5 decisions, across 5 frozen artifacts

Following B2/B3/B4's exact counting discipline:

- **`CONTROLLED_AMENDMENT_OPERATION_COUNT = 6`** — the discrete rows below.
- **`CONTROLLED_AMENDMENT_DECISION_COUNT = 5`** — `B5-D-A028` (item 3), `B5-D-A034` (item 4), the data-model extension (item 1, a direct consequence of `B5-D-A001`'s entity list, no separate top-level ID), the command/event catalog extension (item 2, a direct consequence of `B5_COMMAND_EVENT_CATALOG.md`'s own §2–§3, no separate top-level ID), and the new public-ID prefix (item 5, a direct consequence of `B5-D-A019`'s `TemplateDefinition` need).
- **`CONTROLLED_AMENDMENT_TARGET_ARTIFACT_COUNT = 5`** — `BACKEND_DATA_MODEL.md`, `BACKEND_COMMAND_EVENT_CATALOG.md`, `BACKEND_RATE_LIMIT_POLICY.md`, `B1_AUTHORIZATION_RBAC.md`, `BACKEND_PUBLIC_ID_REGISTRY.md`.

| # | ID | Frozen artifact | Current frozen state | B5 target | Classification | Timing |
|---:|---|---|---|---|---|---|
| 1 | — (consequence of `B5-D-A001`) | `BACKEND_DATA_MODEL.md` — Messaging row | *"Messaging \| conversations, participants, messages, message_deliveries \| workspace/public_id; provider_message_id unique; conversation/status/time index"* | add `message_media` (embedded), `template_definitions`, `communication_consents`, `channel_bindings`, `messaging_usage_records` to the table-group list; refine the `provider_message_id` uniqueness note to `(workspace_id, channel_binding_id, provider_message_id)` (`B5-D-A032`) | `ADDITIVE` — extends the table-group list and sharpens an existing uniqueness note; no existing table/constraint is removed or narrowed | before implementation |
| 2 | — (consequence of `B5_COMMAND_EVENT_CATALOG.md` §2–§3) | `BACKEND_COMMAND_EVENT_CATALOG.md` — command/event enumeration | `SendMessage, ReceiveMessage` (commands); `MessageSent, MessageReceived` in the event list, `MessageDelivered`/`MessageFailed` implied by the Messaging data-model row | `SendMessage`/`ReceiveMessage` retained and fully specified (`COMPATIBLE_REFINEMENT`); **10 additive commands** (`SendTemplateMessage`, `CancelMessage`, `ApplyProviderMessageStatus`, `MarkConversationRead`, `ArchiveConversation`, `ReopenConversation`, `AssignConversation`, `SyncProviderTemplates`, `UpdateProviderConfiguration`, `CheckProviderConfiguration` — 2 frozen + 10 additive = 12 total per `B5_COMMAND_EVENT_CATALOG.md` §2's count); 4 additive events (`ConversationCreated`, `ConversationAssigned`, `ConversationClosed`, `ConversationReopened`) alongside the 4 frozen event names, retained and specified | `COMPATIBLE_REFINEMENT` for the 2 frozen names; `ADDITIVE` for every new command/event | before implementation |
| 3 | `B5-D-A028` | `BACKEND_RATE_LIMIT_POLICY.md` | no messaging-specific row exists; only `Discovery submit`, `AI analysis`, `General API`, etc. | add `Messaging send — 300/hour/workspace plus quota`, key `workspace` | `ADDITIVE` — extends the table with one new row; no existing row's number changes | before implementation |
| 4 | `B5-D-A034` (revised, `B5-FIX.1`) | `B1_AUTHORIZATION_RBAC.md` — permission table | **`conversation.view` and `message.send` ALREADY EXIST** (§2 "Conversations"/"Messages" rows, §3 role matrix), `message.send` tracing further to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23. The original B5 pass incorrectly stated no `conversation.*`/`messaging.*` row existed — corrected here after independent audit | **REUSE** `conversation.view` and `message.send` verbatim, unchanged; **add only** `messaging.manage`, `messaging.provider.manage` | `NO_CHANGE_REQUIRED` for `conversation.view`/`message.send` (frozen text is not touched, not re-added, not re-defined); `ADDITIVE` for `messaging.manage`/`messaging.provider.manage` only — extends the table with two new rows; no existing cell changes. **Special note:** neither `conversation.view` nor `message.send` was ever B5's to name — both are frozen B1/B0 permissions B5 reuses; B5 does not introduce a competing `messaging.view` or `messaging.send` for the identical authority | before implementation |
| 5 | — (consequence of `B5-D-A019`) | `BACKEND_PUBLIC_ID_REGISTRY.md` — Section A | no `TPL-` row exists anywhere in the frozen registry (checked by direct inspection, all 56 classified prefixes) | add `TPL-` — `TemplateDefinition`, Messaging-owned, workspace-scoped | `ADDITIVE` (new prefix, not a reclassification — unlike B4's `ANL-` §B→§A move, this is a genuinely new resource with no prior fixture-only existence) | before implementation |
| 6 | — (consequence of `B5-D-A023`) | none — informational only | `B2_TIMELINE_IDENTITY_MODEL.md`/`B2_NOTE_ACTIVITY_TIMELINE.md` already name `messaging` as an eligible `source_domain` and `message_inbound` as an example `source_event_type` | B5 honors both verbatim (`B5_CRM_TIMELINE_PROJECTION.md` §2–§4) — **no amendment needed**, listed here only to record that compatibility was checked, not assumed | `NO_CHANGE_REQUIRED` | — |

## 2. The items that are not purely additive, stated plainly

**None are `NON_ADDITIVE_CONTROLLED_CHANGE`.** Unlike B4 (which had to rename and re-key a frozen table because Lead-keying was actively incorrect), B0's Messaging row was already written compatibly with everything B5 needs — `SendMessage`/`ReceiveMessage`/`MessageSent`/`MessageReceived` are generic enough to specify rather than contradict, and the aggregate/table-group shape (`Conversation`; `conversations, participants, messages, deliveries`) already matches B5's target exactly. B5's amendment bundle is the most purely additive of the five phases in this corpus so far, and this is stated as a checked conclusion, not assumed from the absence of an obvious conflict.

## 3. What every item satisfies

1. **The decision is already made.** No item leaves an implementation agent a choice; §1 states the exact target shape.
2. **Each is classified honestly** — `ADDITIVE`, `COMPATIBLE_REFINEMENT`, or `NO_CHANGE_REQUIRED`. No item is labeled additive if it would rename, re-key, or narrow an existing frozen sentence — none does.
3. **It is traceable.** Each maps to a Class A decision (`B5_DECISION_REGISTER.md` §1) and to the frozen frontend evidence that requires it.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied.

## 4. Amendment composition — dependency order

> **Canonical order, binding on this bundle exactly as it was on B2's, B3's, and B4's: `B0 → B1 → B2 → B3 → B4 → B5`, each applied against the *effective* (post-prior-amendment) state of a shared artifact, never against stale pre-amendment text.**

### 4.1 Overlapping-artifact check

| Artifact | Touched by an earlier bundle? | Does B5 touch it? | Overlap risk |
|---|---|---|---|
| `BACKEND_DATA_MODEL.md` | yes — B2 (CRM row), B3 (Discovery row), B4 (Intelligence row) | yes (Messaging row) | **none** — four disjoint rows of the same table-inventory list, the identical "different rows, no shared sentence" pattern B2/B3/B4 already established for their own mutual overlap on this file |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | yes — B3 (Discovery-scoped additive rows), B4 (Intelligence-scoped additive rows + `AnalyzeLead`/`LeadIntelligenceCompleted` resolution) | yes (Messaging-scoped rows) | **none** — B5 adds Messaging-scoped entries and refines the two Messaging-named frozen commands/events only; it does not touch `AnalyzeLead`, any Discovery command, or any row B3/B4 already amended |
| `BACKEND_RATE_LIMIT_POLICY.md` | untouched by B1–B4's *amendment* bundles (B4 adopted the existing AI-analysis row verbatim rather than amending it) | yes (item 3) | none — first amendment to this file in the series |
| `B1_AUTHORIZATION_RBAC.md` | yes — B4 (added `intelligence.view`/`intelligence.run`) | yes (item 4) — but only for the two genuinely new rows (`messaging.manage`, `messaging.provider.manage`); `conversation.view`/`message.send` are reused, unread-only, no textual edit at all | **none** — B4 added Intelligence-scoped rows; B5 adds two Messaging-scoped rows and reuses two pre-existing ones; no B5 edit touches a sentence B4 (or any prior bundle) wrote, and no B5 edit touches the frozen `conversation.view`/`message.send` rows either |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | yes — B1 (`MEM-`/`WINV-`), B2 (`NOTE-`), B4 (`ANL-` reclassification) | yes (item 5, `TPL-`) | **none** — each prior touch and B5's touch are disjoint rows/reclassifications; `TPL-` collides with nothing in Section A, B, or C (checked by direct inspection) |

**No artifact both B5 and an earlier bundle amend with a textual edit to the same sentence.** `B5_AMENDMENT_REVERSION_PATHS = 0` for this bundle.

### 4.2 What this means for approval

B5's bundle may be approved independently of B1's, B2's, B3's, and B4's, in any order or together — there is no artifact where B5's amendment must be applied *against the effective post-B1–B4 text* the way B3's `BACKEND_API_CATALOG.md` amendment once had to be applied against B2's. This is stated as a checked conclusion (§4.1's table), not assumed.

## 5. Blocking rules until the bundle is applied

- **No B5 implementation may proceed** against any target in §1.
- **No frozen file may be edited** to match a target in §1.
- The bundle is approved **as a whole** — partial application would leave, for example, `message.send` with no rate-limit row to bound the action it authorizes.
