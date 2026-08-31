# B5 — Contact / Phone Identity Resolution

> **B5 status:** Target design only. `B2 Contact` remains authoritative. B5 resolves recipients; it does not become a second Contact store.

## 1. Normalization

Every phone number B5 touches — inbound sender, outbound recipient, `ChannelBinding.display_phone_e164` — is normalized to E.164 before any lookup, comparison, or storage. Normalization is applied once, at the boundary (webhook ingestion or send-request validation), never re-derived ad hoc downstream. A phone number that cannot be normalized to a valid E.164 form is rejected at that boundary (`422 VALIDATION_ERROR`, `invalid_phone_format`) rather than stored malformed.

## 2. Source and provenance

| Source | Trust level |
|---|---|
| B2 `Contact.phone` (verified through CRM's own data entry/import) | authoritative for linking — B5 reads it, never writes it |
| Provider-observed `wa_id` on an inbound webhook | provider-asserted, not independently verified by WazLink; used for lookup, recorded as `Conversation.counterparty_phone_e164`'s source-of-truth for *that Conversation*, but never written back into B2's `Contact.phone` |
| An outbound send's resolved recipient | derived from `Contact.phone` at send time (§3) |

`B5-D-A0xx`-adjacent note: B5 has no "primary vs. alternate phone" concept of its own — that ranking, if it exists, is B2's Contact model's concern. B5 resolves against whatever phone B2 currently reports and does not second-guess it.

## 3. Resolution at send time

```
resolve_recipient(lead_id, contact_id?) =
    IF contact_id given: use Contact.phone (B2-owned, read-only)
    ELSE: use the Lead's primary Contact per B2's own resolution rule
    IF no resolvable phone: 404 ENTITY_NOT_FOUND, "no_whatsapp_capable_contact"
```

B5 never guesses a phone number from Business-level fields (`business.phone`) for an outbound send once a Lead/Contact exists — B2's Contact is the authoritative recipient identity once conversion has happened. A pre-conversion "message this Business" affordance does not exist in the frozen frontend and is not designed here (`B5-D-A002`).

## 4. WhatsApp-capable status

The frozen frontend already carries a Business-level `whatsapp: boolean` flag (`B4_SIGNAL_TAXONOMY.md`'s `missing_whatsapp` signal source). This is a B3/B4-owned **presence signal about the Business**, not a fact about a specific Contact's phone being WhatsApp-registered — WazLink has no reliable way to confirm a given phone number is WhatsApp-capable before attempting to send to it (Meta does not expose a pre-send capability check as part of this design's confirmed surface, `B5-X-002`-adjacent). B5 therefore does not gate sends on a "verified WhatsApp-capable" flag; a send to a non-WhatsApp number simply fails at the provider with a specific `failure_code` (`invalid_recipient`), surfaced normally through `B5_MESSAGE_STATE_MACHINE.md`'s `failed` state.

## 5. Unknown inbound number

Already resolved precisely in `B5_INBOUND_PIPELINE.md` §2–§3: `sender_type=unknown_contact`, `Conversation.contact_id=null`, no fabricated Contact is created.

## 6. Contact linking (after the fact)

If an operator later links an `unknown_contact` phone to a real Contact (a B2 action, not a B5 one), B5's target design does **not** retroactively rewrite historical `Message.sender_type`/`sender_ref` (`B5_IDEMPOTENCY_CONCURRENCY.md` §3) — immutability of admitted content applies to sender resolution exactly as it applies to body content. The **Conversation**'s `contact_id`, however, is not immutable in the same way: it may be updated going forward once B2 establishes the link, so that *future* messages resolve correctly, while past messages retain the resolution that was true when they arrived. This is recorded as `B5-D-B003` (Class B — the exact update mechanism/trigger for `Conversation.contact_id` is an implementation-preparation detail; the *principle* that history is never rewritten is Class A, inherited from `B5-D-A004`).

## 7. Contact phone changes

If B2's Contact record changes phone number, existing Conversations keyed on the **old** `counterparty_phone_e164` are unaffected (`B5-D-A002`'s companion: Conversation identity is fixed at creation) — a phone change on the Contact does not retroactively merge or redirect an existing Conversation. A **new** message to/from the new number resolves to a **new** Conversation identity per `B5_CONVERSATION_MODEL.md` §3's key. Merging the two Conversations' histories, if ever desired, is an explicit future operator action (`B5-D-C004`, Class C) — never automatic, mirroring `B4_B3_ACQUISITION_BOUNDARY.md` §4's identical "never blend automatically" discipline for merged Businesses.

## 8. Future merge behavior

Not designed here beyond §7's "never automatic" statement — `B5-D-C004`.

## 9. No global customer identity from a phone number, restated

`B5-D-A031`: a phone number is never treated as a cross-workspace identity. Two different workspaces independently discovering/messaging the same real-world phone number produce two fully independent Conversation histories with zero shared state (`B5_ENTITLEMENT_RBAC_TENANCY.md` §5).
