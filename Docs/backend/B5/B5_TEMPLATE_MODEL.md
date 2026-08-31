# B5 — Message Templates

> **B5 status:** Target design only. WazLink template metadata is a synced mirror; Meta remains the sole authority over approval.

## 1. Two distinct concepts, not one

> **`B5-D-A019`: `TemplateDefinition` (the current, re-syncable catalog entry) and `MessageTemplateSnapshot` (the immutable content actually sent) are separate. Neither substitutes for the other.**

| Concept | Mutability | Purpose |
|---|---|---|
| `TemplateDefinition` | mutable, re-synced from Meta on a schedule and on-demand | "what templates can I choose from right now, and are they currently approved?" |
| `MessageTemplateSnapshot` | immutable, embedded on the `Message` that used it | "what did this specific historical message actually say, even if the template has since changed or been disabled?" |

Without this separation, a template edited or disabled at Meta after a message was sent would silently rewrite what history shows was said — the exact defect `B4_INTELLIGENCE_RUN_STATE_MACHINE.md`'s immutable-run discipline exists to prevent one layer over.

## 2. `TemplateDefinition` fields

| Field | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal PK |
| `public_id` | `TPL-*` | **new prefix** — `B5_CONTROLLED_AMENDMENTS.md` item 5 |
| `workspace_id` | UUID FK | required — templates are approved per WABA, and a WABA is bound to one workspace (`B5-D-A012`) |
| `channel_binding_id` | FK | which binding this template belongs to |
| `provider_template_name` | text | Meta's own template name |
| `provider_template_id` | text, nullable | Meta's own opaque ID, if exposed (`B5-X-008`) |
| `language` | text | Meta's language code |
| `category` | enum | closed set pending `B5-X-008` confirmation (e.g. `MARKETING`/`UTILITY`/`AUTHENTICATION`) |
| `status` | enum | closed set pending `B5-X-008` (`APPROVED`/`REJECTED`/`PENDING`/`PAUSED`/`DISABLED`) |
| `components` | JSONB | structured header/body/footer/button definitions as synced |
| `variable_slots` | JSONB | the ordered/named placeholder contract a send must satisfy (§3) |
| `last_synced_at` | timestamptz | |
| `sync_status` | enum | `fresh` \| `stale` \| `sync_failed` |

## 3. Variable safety — a hard validation gate

> **`B5-D-B005` (Class B — the exact validation rule set is tunable; its existence is Class A, `B5-D-A019`'s companion): every outbound template send is validated against `TemplateDefinition.variable_slots` before admission.**

| Attack | Mitigation |
|---|---|
| Missing variable | rejected — `422 VALIDATION_ERROR`, `template_variable_missing` |
| Extra/unexpected variable | rejected — the schema is closed, mirroring `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4's `additionalProperties:false` discipline |
| Wrong order/name | rejected — slots are matched by name/position per `variable_slots`, never positionally guessed |
| Oversized value | rejected against a configured max length per slot |
| Unsafe URL in a URL-typed slot | validated against an allow-listed scheme (`https://` only) before send; a raw/unescaped value is never interpolated into a button URL unchecked |
| Cross-workspace data substitution | structurally impossible — every value source (Lead/Contact/Business fields) is resolved within the same `workspace_id` the template send is admitted under; no cross-tenant field reference exists in the variable-resolution path |
| Secret insertion | the variable-resolution source set is a closed, documented list of permitted fields (Lead/Contact/Business display fields only); it never includes a token, credential, or internal identifier — mirrors `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1 |
| Untrusted HTML/script rendering | template variables are plain text substitution into a WhatsApp message body — there is no HTML-rendering surface in WhatsApp content, and WazLink's own admin/preview UI must escape variable values as plain text, never `innerHTML` |

**Provider approval does not make user-supplied variables safe** — this is the headline principle the brief names explicitly. Meta approves the *template structure*; it has no visibility into what a specific send substitutes into it. Every validation in this table runs on WazLink's own side, at send-admission time, regardless of the template's approval status.

## 4. `MessageTemplateSnapshot` — what gets embedded on the Message

```
MessageTemplateSnapshot = {
  provider_template_name, language, category (as of send time),
  resolved_components: [ ... ],   -- the actual rendered header/body/footer/buttons
                                     with variables substituted, exactly as sent
  template_definition_id,          -- which TemplateDefinition version this came from
  synced_status_at_send_time
}
```

This is embedded on the `Message` (`B5_MESSAGE_MODEL.md` §2, `template_snapshot`), immutable from that point on. A later `TemplateDefinition` sync that changes `components`, or a status change to `DISABLED`/`REJECTED`, never touches an already-sent `Message`'s snapshot.

## 5. Sync

`SyncProviderTemplates` (`B5_COMMAND_EVENT_CATALOG.md` §2) is an operator/scheduled command that refreshes `TemplateDefinition` rows from Meta's template list. It writes only `TemplateDefinition` — never `MessageTemplateSnapshot`, never `Message`. A sync that discovers a template is now `DISABLED` does not retroactively affect any message already sent using it (§1), and does not retroactively fail any in-flight send that was admitted before the status change — an in-flight send that the provider itself then rejects surfaces normally through `B5_MESSAGE_STATE_MACHINE.md`'s `failed` state with `failure_code=template_unavailable`.

## 6. Stale / rejected / disabled templates at send time

| `TemplateDefinition.status` at admission | Behavior |
|---|---|
| `APPROVED` | admitted normally |
| `PENDING` | rejected — `422 VALIDATION_ERROR`, `template_not_approved` (never sent speculatively) |
| `REJECTED`, `PAUSED`, `DISABLED` | rejected — same code, `details.reason` distinguishes the specific status |
| `sync_status = stale` beyond a configured age (Class B) | admission still uses the last-known `status`; a stale sync is an observability signal (`B5_RECONCILIATION_OBSERVABILITY.md` §1), not itself a send-blocking condition — blocking sends on staleness alone would punish a workspace for WazLink's own sync lag, not a real template problem |

## 7. Ownership boundary, restated

`TemplateDefinition.status` is a **mirror**, never authoritative over Meta's actual approval state. A send that WazLink believes is `APPROVED` can still be rejected by the provider at send time (the mirror is out of sync) — this is `B5_RATE_COST_RETRY_MODEL.md` §3's `template_rejected_at_provider` failure class, handled exactly as any other provider rejection, not as an internal contradiction requiring special handling.
