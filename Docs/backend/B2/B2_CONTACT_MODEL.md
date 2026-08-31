# B2 — Contact Model

> **B2 status:** Target design only. Contact is the CRM domain's only Contact-PII-bearing aggregate; every rule below is also a privacy rule.

## 1. What a Contact is — and is not

A Contact is **a way to reach a Business, recorded inside one Workspace**. It is not a person record, not a global identity, and not a CRM user.

**B2 does not build a global Person identity system.** There is no cross-workspace person, no identity resolution, no merge-by-email, and no household/organization graph. Each workspace's contacts are its own. This is a deliberate limit: cross-workspace person resolution would require an identity authority that no B0 domain owns, and would make one tenant's data reachable through another tenant's matching — the exact harm CRM-INV-2 forbids.

## 2. `contacts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | |
| `public_id` | text | `CON-<opaque>`, immutable, unique. **Registered in B0 registry section A** (required by `Lead360.contacts[]`) |
| `workspace_id` | UUID FK → `workspaces.id` | tenant column (CRM-INV-1) |
| `business_id` | UUID null FK → `businesses.id` | the Business this contact belongs to, when known. Nullable so a manually added contact needs no Business |
| `name` | text NOT NULL | 1–160 chars, trimmed, no control characters. **Contact PII** |
| `title` | text null | ≤120 chars, display only. Never an authorization input |
| `phone` | text null | E.164-normalized where parseable, else stored verbatim with `phone_normalized = NULL`. **Contact PII** |
| `phone_normalized` | text null | derived; used for advisory duplicate detection only — **never unique** (CRM-INV-18) |
| `email` | citext null | lowercase + trim only, the same rule B1 applies to `users.email_normalized`. **Contact PII** |
| `source` | text NOT NULL | `discovery_business` \| `manual`. How this contact entered CRM |
| `archived_at` | timestamptz null | soft removal |
| `version` | integer ≥ 1 | ADR-010 |
| `created_at` / `updated_at` | timestamptz | |
| `created_by_membership_id` | UUID FK → `memberships.id` | actor provenance |

**Constraints and indexes**
- Unique `public_id`.
- Check `name <> ''`; check `phone IS NOT NULL OR email IS NOT NULL OR source = 'manual'` — a discovery-derived contact with no reachable detail has no reason to exist.
- Check `email = lower(btrim(email))`.
- Indexes `(workspace_id, business_id)`, `(workspace_id, archived_at)`, `(workspace_id, phone_normalized)` and `(workspace_id, email)` — **both non-unique**, for advisory duplicate detection only.
- Immutable: `id`, `public_id`, `workspace_id`, `created_at`.
- **No unique index on `phone`, `phone_normalized`, or `email` at any scope.** CRM-INV-18.

**`status` is not modelled.** The frozen fixtures carry `status:"active"` and no code path ever changes it (inventory item 23). Its replacement is `archived_at`, which B0 already gives every table.

## 3. Lead ↔ Contact — many-to-many through `lead_contacts`

B0's CRM table group is `leads, contacts, lead_contacts, tasks, appointments`. The join table is **already frozen**, and B2 honors it rather than collapsing to the frozen frontend's 1:1 shape.

| Column | Notes |
|---|---|
| `id` / `workspace_id` | tenant column |
| `lead_id` | FK → `leads.id` `ON DELETE RESTRICT` |
| `contact_id` | FK → `contacts.id` `ON DELETE RESTRICT` |
| `is_primary` | boolean NOT NULL default `false` |
| `linked_at` / `linked_by_membership_id` | provenance of the link |
| `unlinked_at` | timestamptz null — soft unlink |

- Unique `(lead_id, contact_id) WHERE unlinked_at IS NULL` — a Contact links to a Lead at most once.
- **Partial unique `(lead_id) WHERE is_primary AND unlinked_at IS NULL`** — at most one primary contact per Lead. This is what makes "which number does Messaging dial?" a single deterministic answer.
- Index `(workspace_id, contact_id)`.
- A link is valid only when `lead.workspace_id = contact.workspace_id = lead_contacts.workspace_id`. Enforced in the command guard; a cross-workspace `contact_ref` resolves to `404 ENTITY_NOT_FOUND` under Doctrine R-2, never `400`.

## 4. The resolved questions

| Question | Answer |
|---|---|
| **One Contact across multiple Leads?** | **Yes**, through `lead_contacts`. A clinic's reception number is one Contact; if the same Business is archived and re-converted, the new Lead links the same Contact rather than duplicating the PII. This is why B0 modelled a join table. |
| **Is a Business Contact copied into the Lead?** | **No — it is linked.** The Contact row belongs to the workspace and references the Business; the Lead references the Contact. Copying would create two mutable copies of one phone number. |
| **Reference or snapshot?** | **Reference.** Correcting a phone number must fix it everywhere it is used. There is no contact snapshot: unlike provenance (which records a *decision*), a contact detail is a *current fact*, and a stale copy is a wrong number, not history. |
| **Duplicate email?** | **Allowed.** No unique index. A workspace may hold several contacts sharing `info@clinic.example`. |
| **Duplicate phone?** | **Allowed.** Shared reception lines, franchise head-office numbers, and call-centre numbers are legitimately shared. |
| **How is duplication surfaced then?** | `AddContact` performs a **non-blocking** advisory lookup on `(workspace_id, phone_normalized)` and `(workspace_id, email)` and returns matches in `Contact.duplicate_candidates[]` (`EntityRef[]`, capped at 5). The create still succeeds with `201`. It is a hint, never a gate (`B2-D-C003` covers a future merge flow). |
| **Manual contact?** | **Supported.** `POST /leads/{id}/contacts` with `source = 'manual'`. This is a `MISSING_TARGET_CONTRACT` in the frozen tree (inventory item 21): Lead 360 renders contacts but offers no way to add one, and a Lead whose Business carried no phone or email would otherwise be permanently uncontactable. |
| **Provider-derived contact?** | **Supported and distinguished** by `source = 'discovery_business'`. Messaging may later attach a provider identity (WABA/phone ID) to a Contact; that identity is **Messaging-owned** and is not a `contacts` column. |

## 5. Contact creation during conversion

The frozen conversion creates at most one Contact when the Business carries a phone or an email (`data.js:587`). B2 preserves the behavior and fixes two defects it contains.

Inside the conversion transaction, when `business.phone` or `business.email` is present:
1. Look for an existing non-archived Contact in this workspace with `business_id = :b` and `source = 'discovery_business'`.
2. If found, **link it** (`is_primary = true`) rather than creating a second copy. *(The frozen code always inserts, so re-conversion after archive would duplicate the PII.)*
3. Otherwise create a Contact with `source = 'discovery_business'`, `business_id`, `phone`, `email`, and `name = business.name`, then link it as primary.
4. `title` is left **NULL**. *(The frozen code writes a constant Arabic string, "جهة اتصال رئيسية" — a UI label, not data. Persisting a label as a job title makes every discovery contact claim a role nobody stated.)*
5. Emit `ContactAdded`; append a `crm_activities` entry.

When the Business carries neither detail, **no Contact is created** and the Lead is valid with zero contacts — exactly the frozen behavior, which Lead 360 renders as "no contactable party in the current Business".

## 6. Commands

| Command | Permission | Guard | Version | Event |
|---|---|---|---|---|
| `AddContact` | `lead.update` | Lead not archived; at least one of `name`+(`phone`\|`email`); workspace match; advisory duplicate scan | creates at `version = 1` | `ContactAdded` |
| `UpdateContact` | `lead.update` | Contact not archived; `If-Match` | bump | `ContactUpdated` |
| `RemoveContact` | `lead.update` | link exists; `If-Match` on the Contact | bump | `ContactRemoved` |

**Why `lead.update` and not a new `contact.*` permission.** Contacts have no independent management surface, no independent list route, and no lifecycle a role would be granted separately; every mutation happens in service of working a Lead. Minting `contact.create`/`contact.update`/`contact.delete` would add three authorization codes, three matrix rows, and three amendment items to B1's frozen catalog for a resource nobody manages on its own. If a standalone address book is ever built, that is the moment to mint them (`B2-D-C007`).

**`RemoveContact` is an unlink, not a delete.** It sets `lead_contacts.unlinked_at` and leaves the `contacts` row intact, because Messaging conversations reference `contact_id` and a hard delete would break conversation history. When the unlinked link was primary, the Lead is left with **no** primary contact — B2 does **not** auto-promote another contact, because picking a new primary is a human decision and silent promotion would change which number a later message reaches.

## 7. PII posture

| Datum | Class (B0) | Stored | Logged | Returned |
|---|---|---|---|---|
| `name` | Contact PII | plaintext | **never** | to `lead.view` holders |
| `phone`, `phone_normalized` | Contact PII | plaintext | **never** | to `lead.view` holders |
| `email` | Contact PII | plaintext (citext) | **never** | to `lead.view` holders |
| `title` | Contact PII (low) | plaintext | never | yes |

Contact details are returned **unmasked** to `lead.view` holders, because Lead 360 renders `contact.phone || contact.email` directly and the product's purpose is to let a salesperson call the number. Whether a **Viewer** (whose `lead.view` cell is `conditional`) should instead see masked details is a genuine privacy decision B2 does not invent; it is `B2-D-C008`, the direct analogue of B1's `B1-D-012`. Until it is made, the `conditional` condition on `lead.view` for Viewer is *read-only workspace scope*, i.e. unmasked — which is the frozen behavior.

Contact PII **never** appears in an event payload, an outbox row, a Celery argument, a log line, or an audit `details` blob. Events carry `CON-*` only, and `ContactUpdated` audit records which **field names** changed, never their values.
