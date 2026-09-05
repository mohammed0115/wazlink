# 14 — Knowledge Base Plan

> **Status: Scheduled **after P0** (G3), as the grounding source for `GAP-014`.**

> Resolves brief §19. **Reuses B11 storage entirely. Creates no second file truth.**

## 1. Model

`kb_articles` — `id`, `public_id` `KBA-*` (`CA-03`), `workspace_id`, `title`, `body`, `status` (`draft|published|archived`), `category`, `current_version`, `published_at`, `archived_at`, `version`, timestamps, `created_by_membership_id`.

`kb_article_versions` — append-only snapshots: `article_id`, `version_number`, `title`, `body`, `authored_by_membership_id`, `created_at`. **Never updated, never deleted** — the same append-only discipline B9 applies to its registers, so an AI answer citing version 3 stays explainable after version 4 ships.

`kb_sources` — links an article to supporting `file_assets` via B11's `file_attachments` with `subject_type='kb_article'`. **B11 owns the bytes; knowledge owns the meaning.**

## 2. Lifecycle and AI retrieval

`draft → published → archived`, with `archived → draft` for revision.

**Only `published` articles are retrievable by the AI agent.** A draft is a work in progress; letting it ground a customer answer would publish it by accident. Archived articles remain readable by humans (history) and are excluded from retrieval.

**Every AI answer carries citations** — a list of `KBA-*` references with version numbers. An answer that retrieves nothing is rendered as **ungrounded** and is explicitly not presented as authoritative. This is the knowledge-base analogue of B9's *unattributed but fully recognized* posture: the absence of provenance is reported, never hidden.

**Retrieval is workspace-scoped.** `workspace_id` is part of every retrieval query. Cross-workspace retrieval is not expressible, which also forecloses the cross-tenant cache-poisoning risk `B4-D-A028` already prohibits for intelligence results.

## 3. Freshness

`published_at` and `current_version` are surfaced to the agent and to the human reviewing a proposal, so a reply grounded in a year-old article is visibly so. **No automatic staleness expiry** is proposed — silently un-publishing content because a timer fired would remove answers with no human decision. A staleness *report* in Analytics (`GAP-023`) is the safe form.

## 4. Deletion

**Archive-only**, consistent with B11's `B11-D-A015` (*no row is ever hard-deleted in Phase 1*) and B2's archive lifecycle. Archiving an article removes it from retrieval immediately; its versions and citations survive, so historical AI answers remain explainable. Source files follow B11's own deletion and orphan-cleanup model unchanged — knowledge never deletes a `file_asset`, it only unlinks.

## 5. Permissions

`knowledge.view` (all roles) · `knowledge.manage` (Owner/Admin/Manager). Publishing is deliberately manager-level: a published article grounds customer-facing AI answers, which makes publication a consequential act rather than ordinary content editing.

## 6. External sources

`ExternalSource` (crawling a website into the KB) is **not adopted**. It duplicates `B4-D-C008` (*"website/content enrichment … a separate capability"*), introduces an outbound-fetch surface with SSRF exposure that B13 would have to re-govern, and has no verified requirement. Recorded as rejected, not deferred.
