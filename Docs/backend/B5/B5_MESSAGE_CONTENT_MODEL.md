# B5 — Message Content Model

> **B5 status:** Target design only. Added beyond the brief's base document list because the content-type taxonomy is substantial enough to warrant its own home, mirroring how B4 split `B4_SIGNAL_TAXONOMY.md` out of `B4_SCORING_MODEL.md`. Referenced from `B5_MESSAGE_MODEL.md` §2, `B5_PROVIDER_ABSTRACTION.md` §4, `B5_INBOUND_PIPELINE.md` §5, `B5_MEDIA_B11_HANDOFF.md` §2.

## 1. The closed content-type set

> **`B5-D-A006`'s companion: nine canonical content types. A provider payload that does not map to one of these normalizes to `unsupported`, never to a guessed nearest type.**

| `content_type` | Carries | Provider payload maps from |
|---|---|---|
| `text` | `body` | plain text message |
| `template` | `template_snapshot` | an outbound template send (`B5_TEMPLATE_MODEL.md`) |
| `image` | `media[]` (one item), optional `body` as caption | image attachment |
| `document` | `media[]` (one item), optional `body` as caption/filename | document attachment |
| `audio` | `media[]` (one item) | audio/voice note |
| `video` | `media[]` (one item), optional `body` as caption | video attachment |
| `location` | `body` holds a normalized `"lat,lng[,label]"` string | shared location |
| `contact_card` | `body` holds a normalized structured contact summary (name/phone), never a raw vCard blob | shared contact |
| `unsupported` | `body=null`, raw provider type preserved only in `provider_metadata` | anything the adapter cannot normalize into the above eight |

`CONTENT_TYPE_COUNT = 9`.

## 2. Normalization is mandatory, not best-effort

Every inbound payload passes through the adapter's normalization step (`B5_PROVIDER_ABSTRACTION.md` §4) before it becomes a domain `Message`. There is no code path where a raw, unnormalized provider payload is stored as `Message.body`. This mirrors `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4's "no free-form mutation" discipline: the provider's literal payload shape never becomes WazLink's own domain truth verbatim.

## 3. What is preserved for audit without becoming business truth

`provider_metadata` (on the owning `MessageDelivery`, `B5_MESSAGE_STATE_MACHINE.md`) retains enough of the raw provider type/shape to diagnose a misclassification or an `unsupported` result — but this field is operator-scoped (`B5_ENTITLEMENT_RBAC_TENANCY.md` §4), never part of any actor-facing DTO, and never treated as a second source of truth for `content_type`.

## 4. Location and contact-card safety

Both are structurally reduced to safe, bounded scalar/string data at normalization time — WazLink never stores or renders a raw provider-supplied structured payload as HTML, and a `location`/`contact_card` message is never eligible to carry an attachment or template snapshot (the type is exclusive with `media[]`/`template_snapshot` by construction).

## 5. Extensibility

`B5-D-B006` (Class B): the nine-type roster may grow if Meta's own content taxonomy grows (e.g. interactive/list messages) — the *existence* of a closed, versioned content-type set is Class A; the exact roster is extensible the same "existence A, roster B" pattern this corpus uses throughout (`B4_SIGNAL_TAXONOMY.md` §4's identical framing).
