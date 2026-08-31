# B5 — Inbound Message Pipeline

> **B5 status:** Target design only. Continues where `B5_WEBHOOK_SECURITY_MODEL.md` leaves off — a verified, workspace-resolved, deduplicated normalized event.

## 1. The full flow

```
Meta
 → generic Webhooks gateway (receipt, WHR-*, dedup, fast ack)
 → B5 signature verification + workspace resolution (B5_WEBHOOK_SECURITY_MODEL.md §3-4)
 → normalized inbound event (B5_PROVIDER_ABSTRACTION.md §4)
 → counterparty phone resolution (B5_CONTACT_PHONE_RESOLUTION.md §3)
 → Conversation resolution/reopen (B5_CONVERSATION_MODEL.md §3-4)
 → Message persistence
 → CRM timeline exposure (source_event_id, B5_CRM_TIMELINE_PROJECTION.md)
 → unread state (computed, B5_CONVERSATION_MODEL.md §7)
 → BusinessIntelligenceCompleted-style domain event: InboundMessageReceived (B5_COMMAND_EVENT_CATALOG.md §3)
```

## 2. Counterparty resolution cases

| Case | Resolution |
|---|---|
| Phone matches an existing B2 Contact linked to an existing Lead, with an existing Conversation for `(workspace, channel, lead, phone)` | reuse that Conversation (reopening if `closed`, `B5_CONVERSATION_MODEL.md` §4); `sender_type=contact`, `sender_ref=CON-*` |
| Phone matches an existing Contact/Lead, no Conversation yet for this exact key | create a new Conversation (§3) |
| Phone matches a Contact linked to **no** Lead (a bare Contact, if B2's model permits one) | **not created** — B5 requires `lead_id` (`B5-D-A002`); the message is held at the generic receipt layer's own retention only and surfaced as an operator-visible "unlinked inbound" signal (`B5_RECONCILIATION_OBSERVABILITY.md` §1), not silently dropped and not force-linked to a guessed Lead |
| Phone matches **multiple** Contacts (a data-quality case B2 itself should prevent, but B5 does not assume it cannot happen) | resolution is deterministic, not arbitrary: the most-recently-active Lead with a Conversation on this exact phone wins; if none has one yet, the ambiguity is surfaced to an operator rather than guessed — `B5_FAILURE_SCENARIOS.md` B5-DF-017 |
| Phone matches **no** known Contact | `sender_type=unknown_contact`, `sender_ref=null`, `Conversation.contact_id=null` (FB-03/FB-06 — the frozen, already-demonstrated case). **A Conversation is still not created without a `lead_id`** — see §3 |
| Same phone number, different workspace | fully independent resolution per workspace; never cross-checked (`B5-D-A031`, `B5_ENTITLEMENT_RBAC_TENANCY.md` §5) |
| Duplicate phone numbers within one workspace (two Contacts sharing a phone, a B2 data-quality case) | not B5's to prevent or repair — B5 resolves deterministically per the multiple-match rule above and records which Contact it picked; correcting the underlying duplication is B2's concern |

## 3. The unknown-inbound-number question — where does the Conversation go?

`B5-D-A002` requires `lead_id`. An unresolved phone number (no Contact, therefore no Lead) genuinely has nowhere authoritative to attach. `B5-D-C003` (Class C, `B5_DECISION_REGISTER.md` §4) records two candidate resolutions for a later phase — an "unassigned inbound" holding area with no Conversation until a human links it to a Lead, or a lightweight auto-provisioned Lead — and deliberately does **not** pick one now: the frozen frontend shows exactly one unknown-inbound fixture (`CONV-3044`, `MSG-3044-1`) and it **already has** a `lead_id` (`LEAD-1220`) despite `contactId:null` — meaning the frozen product truth is "unknown *contact*, known *Lead*," not "unknown Lead entirely." B5 therefore designs only the demonstrated case (unknown Contact, known Lead — §2's `unknown_contact` row) as Class A, and defers the genuinely-unlinked case as Class C rather than inventing an unevidenced Lead-creation side effect, which would risk exactly the kind of automatic-Lead-fabrication B0's "no Lead auto-create" prohibition (inherited from B3) warns against by analogy.

## 4. Reply context

If the inbound payload carries a provider reply/context reference, it is resolved against `MessageDelivery.provider_message_id` of a prior outbound message in the same Conversation and recorded as `Message.reply_to_message_id` (`B5_MESSAGE_MODEL.md` §4). An unresolvable reply context (references a message B5 has no record of — e.g. pre-dating this Conversation's history in WazLink) is stored as `reply_to_message_id=null` with the raw provider context preserved in `provider_metadata` only; it never blocks ingestion of the message itself.

## 5. Media, unsupported content, malformed event

| Case | Behavior |
|---|---|
| Inbound media | `MessageMedia` metadata persisted immediately; the durable bytes fetch from Meta's temporary URL is delegated to B11 per `B5_MEDIA_B11_HANDOFF.md` §3 — the Message is admitted with `media[]` referencing a `pending`/`fetching` media state, never blocked on the fetch completing |
| Unsupported content type (a provider content kind WazLink's closed `content_type` enum, `B5_MESSAGE_CONTENT_MODEL.md` §1, does not cover) | admitted as `content_type=unsupported`, original provider type preserved in `provider_metadata`, `body=null` — visible in the thread as "unsupported message received," never dropped and never mis-typed as `text` |
| Malformed event (fails `B5_WEBHOOK_SECURITY_MODEL.md` §6) | no Message created; handled entirely at the webhook layer, never reaches this pipeline |
| Provider retry of an already-processed inbound message (duplicate `provider_event_id`) | absorbed at `B5_WEBHOOK_SECURITY_MODEL.md` §5's dedup layer; no second Message row |
| Provider-retracted/deleted message (if the provider signals this) | recorded as a new `MessageDelivery`-equivalent marker on the original Message (`retracted: true` metadata) — the original content is **not** deleted from WazLink's own durable record; retention/legal deletion is a separate concern (`B5_DATA_MODEL.md` §6), not an automatic reaction to a provider-side retraction signal |
| Status webhook arrives before the corresponding local Message/provider-mapping exists (a race between B5's own `sent` transition committing and Meta's `delivered` webhook arriving first) | held via the generic Webhooks receipt layer's own redelivery (Meta retries webhooks that receive a non-2xx or are received before the referenced state exists is not typical — but if it occurs, the status update is retried by `B5_RECONCILIATION_OBSERVABILITY.md` §4's gap-detection rather than dropped): the webhook is acknowledged, recorded, and re-evaluated once the local `provider_message_id` mapping exists, never silently discarded |

## 6. Job-completion precondition — there is none

Unlike B3's Discovery results, an inbound message has no upstream "job" to wait on. The only preconditions are §1's pipeline steps themselves — signature valid, workspace resolved, Conversation resolvable per §2–§3.

## 7. No cross-workspace lookup, restated

Every lookup in §2 is executed with `workspace_id` fixed by `B5_WEBHOOK_SECURITY_MODEL.md` §4's resolution, before any Contact/Lead query runs. There is no code path in this pipeline that queries Contacts or Leads without a `workspace_id` predicate already applied.
