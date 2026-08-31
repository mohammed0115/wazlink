# B5 — Consent, Opt-In, and Communication Eligibility

> **B5 status:** Target design only. Technical ability to send and permission/policy eligibility to send are two independent gates. Neither implies the other.

## 1. Ownership

> **`B5-D-A016`: `CommunicationConsent` is a B5-owned entity, keyed `(workspace_id, channel, counterparty_phone_e164)`.**

It is not a B2 Contact field. A phone number can be opted out before it is ever linked to a Contact (an inbound "STOP" from an `unknown_contact`), so B2-Contact-keying would be structurally incomplete. B5 owns it because B5 is the domain whose action (sending) the consent state gates.

## 2. Fields

| Field | Type | Notes |
|---|---|---|
| `workspace_id` | UUID FK | required |
| `channel` | enum | `whatsapp` |
| `counterparty_phone_e164` | text | the keyed identity |
| `state` | enum(3) | `unknown` \| `opted_in` \| `opted_out` |
| `source` | enum | `inbound_stop_keyword` \| `provider_signal` \| `operator_manual` \| `import` |
| `evidence_ref` | text, nullable | the `MSG-*` that established this state, if inbound-derived; an operator note reference otherwise |
| `policy_version` | text | which consent-policy version was in effect when this state was recorded (`B5-X-018`-adjacent legal posture) |
| `recorded_at` | timestamptz | immutable |
| `recorded_by_ref` | `MEM-*`, nullable | null for `inbound_stop_keyword`/`provider_signal` |

`CommunicationConsent` rows are **append-only** — a new state change is a new row, never an in-place edit, so the history of consent changes is itself auditable evidence (mirrors `B4_INTELLIGENCE_RUN_STATE_MACHINE.md`'s immutable-history discipline). The **current** state is the most recent row for that key.

## 3. The check — before every send, no exceptions

> **`B5-D-A017`: opt-out is absolute. There is no AI recommendation, automation, or admin override path in Phase 1.**

```
ON SendMessage/SendTemplateMessage admission (B5_OUTBOUND_PIPELINE.md §2 step 6):
  consent = current CommunicationConsent for (workspace, channel, phone)
  IF consent.state == 'opted_out':
      REJECT — 403 PERMISSION_DENIED, details.reason = "recipient_suppressed"
  ELSE:
      proceed (unknown and opted_in both permit sending — WhatsApp's own
      opt-in model is largely provider/business-initiated-conversation-shaped,
      B5-X-018; WazLink does not invent a stricter default-block-until-explicit-
      opt-in rule not evidenced anywhere in frozen product truth)
```

This check runs for **every** admission path — human actor, AI-drafted-then-human-sent (`B5_B4_HANDOFF_CONTRACT.md`), and any future B7-governed automation send (`B5_B6_B7_BOUNDARIES.md` §3) — because it sits in the one shared admission sequence every sender uses (`B5_OUTBOUND_PIPELINE.md` §2). There is no second send path that could bypass it. The brief's explicit question — *"if such override is even allowed"* — is answered: **it is not.** No field, permission, or command in this design admits a send against an `opted_out` recipient, at any privilege level, including `messaging.provider.manage`. Overturning an opt-out (e.g. a customer re-opts-in later) happens by recording a **new** `opted_in` row from a fresh, evidenced signal (§2's `source` enum) — never by deleting or overriding the `opted_out` row.

## 4. Establishing opt-out

| Trigger | `source` |
|---|---|
| Inbound message body matches a configured stop-keyword set (e.g. `STOP`, `إيقاف`) — exact keyword list is Class B, `B5-D-B004` | `inbound_stop_keyword` |
| Meta signals a block/opt-out at the provider level (if the platform exposes one, `B5-X-018`-adjacent) | `provider_signal` |
| An operator manually records suppression (e.g. a legal/support request outside the chat itself) | `operator_manual` |
| A bulk consent import (future, not designed here) | `import` |

## 5. Legal validation boundary

The exact legal requirements for WhatsApp Business opt-in in WazLink's operating jurisdiction(s) — whether affirmative opt-in is required before any message, or whether an inbound-initiated conversation implies sufficient basis to reply — are **not** invented here. `B5-X-018` records this as a required legal validation item. What is architected regardless of that answer: the `state`/`source`/`evidence_ref`/`policy_version` shape is expressive enough to represent whichever policy is confirmed, without a schema change — only the *default* behavior for the `unknown` state might need to flip from "permit" to "block" once §5's legal question resolves, and that is a **configuration value gated by `policy_version`**, not an architectural change.

## 6. Suppression is distinct from opt-out, and both are distinct from consent-unknown

| State | Meaning | Blocks send? |
|---|---|---|
| `opted_out` | recipient explicitly withdrew | yes, absolutely |
| suppressed (operator manual, e.g. a known-bad number or a compliance hold) | recorded via the same table, `source=operator_manual`, treated identically to `opted_out` for the send check — B5 does not maintain a second parallel suppression list | yes |
| `unknown` | no evidence either way | no (§5's default, pending legal confirmation) |
| `opted_in` | explicit or inferred permission established | no |

There is one table, not two, because a second parallel "suppression list" would create exactly the two-mutable-truth-stores risk `B2`'s own domain discipline (`CRM-INV-13`) warns against one layer over — one append-only ledger, one current-state read.
