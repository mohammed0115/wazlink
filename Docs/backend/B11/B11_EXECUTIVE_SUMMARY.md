# B11 — Files & Storage — Executive Summary

> **B11 is NOT closed.** It is uncommitted and awaits independent CTO verification. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B11/` holds the B11 Files & Storage target-design package — **35 documents**. It is **additive**: it modifies no frozen B0–B10 file and no frontend file. B0–B9 remain at the SHAs `BACKEND_DOCUMENTATION_INDEX.md` already records, and the B10 pack is committed at the frozen baseline `8ca5d77e4119c0687395dfc269c3a692941d5441`, which is this pass's `HEAD` and `origin/main`.

## What B11 found before designing anything

B11 inherits an unusually well-specified skeleton and an unusually under-specified provider. Frozen B0 named the Files domain in **twenty-one** separate places — the domain row, the `file_assets` table with its two constraints, the five-state `FileAsset` machine, the `FILE-` public-ID prefix, the `FileStorageProvider` port, three DTO names, two live OpenAPI operations, the `FILE_TYPE_NOT_ALLOWED` error code, a retry row, a timeout row, a failure-matrix row, and a whole security paragraph. B1 froze `file.upload`/`file.download` and a download-URL rule. B2 declared CRM attachments explicitly out of Phase-1 scope. **B5 pre-committed an entire symmetric handoff** (`B5_MEDIA_B11_HANDOFF.md`) stating five requirements B11 owes it. B11's task was to fill that skeleton in — and, in three places, to notice that the skeleton contradicted itself or promised something B11 cannot deliver, and say so.

## The central design problem, and its resolution

Frozen B0 says WazLink uses "Hostinger platform storage." Research during this pass (`B11-X-001`, read from Hostinger's own page) established that **Hostinger publishes no managed object-storage product** — its S3-compatible offering is a self-hosted Docker template deployed onto a customer VPS, whose pre-signed-URL, content-length-enforcement, and checksum behavior is documented nowhere this pass could read (`B11-X-007`, `UNRESOLVED`).

The tempting move was to design a direct-to-storage upload with pre-signed URLs and assume the capability exists. B11 refuses it. **Phase 1 is application-proxied upload (`B11-D-A007`)** — not because proxying is elegant, but because every integrity property this pack promises is *derivable* under proxying and merely *asserted* under pre-signing: the server computes SHA-256 over the bytes it actually forwarded, detects the content type from the content, and aborts mid-stream at the size ceiling. The `FileStorageProvider` port carries an explicit `supports_presigned_upload()` predicate, so adopting the faster flow later is an adapter swap that changes **no state machine, command, DTO, table, or acceptance test** (`B11-D-B004`).

The payoff is stated plainly because it is the reason `CLASS_A_UNRESOLVED = 0` is honest: Phase 1 uses only `put`/`stat`/`open`/`delete`/`list` — five operations any S3-compatible store, or a plain filesystem, provides. **Every provider-dependent question was pushed into Class B by choosing an upload flow that does not need the answer.**

## What B11 designed

**Two orthogonal state machines, not one.** The frozen five-state `FileAsset` lifecycle (`pending→available/quarantined/failed→archived`) is adopted **unchanged**, and byte disposition becomes a separate five-state machine (`unwritten`/`present`/`purge_pending`/`purged`/`purge_failed`). They share no trigger and no guard, which is what makes §20's requirement structural: **a provider delete failure cannot resurrect access, because `archived` has no exit transition anywhere in this pack and `PurgeFileObject` writes no lifecycle field at all.** Six candidate states from the brief — `UPLOADED`, `READY`, `DELETING`, `DELETED`, `EXPIRED`, `PENDING_UPLOAD` — were each considered and rejected by name.

**Identity that cannot expire.** `FILE-` is already registered, so B11 mints **zero new prefixes**. Three candidates were considered and rejected. A provider media ID is never a WazLink file identity; a URL is never identity in any form; a checksum is never identity, because byte equality is not asset identity.

**Integrity that fails closed.** SHA-256 computed server-side in flight, written once at finalize, and **never updated** — a re-verification mismatch quarantines the file rather than rewriting the hash, because rewriting would turn integrity detection into integrity laundering. A provider ETag is explicitly disqualified, on AWS's own words (`B11-X-002`, `VERIFIED`): it *"may or may not be an MD5 digest"* and never is for a multipart upload, so an ETag check fails silently on exactly the large objects most worth checking.

**Content typing in three columns, never one.** `declared` (client claim, evidence only), `detected` (server finding), `canonical` (what every DTO sees). The canonical column is **never null**, because frozen B0 makes `FileAsset.content_type` required on a `201` emitted before any byte exists: while `pending` it carries the *validated provisional* type — the allow-list member the declared value matched, which decides nothing and governs nothing — and finalize overwrites it, once, with the verified detected type. Validated is not trusted, and the frozen contract is satisfiable in every lifecycle state without relaxing it. A `.pdf` that detects as HTML is **rejected**, not silently reclassified. Extension is a third, weaker cross-check that never gates on its own. SVG is excluded from the allow-list as a class, because `nosniff` by design makes a browser honor a declared `image/svg+xml` (`B11-X-003`, `VERIFIED`) — the header cannot save you from a type you chose to accept.

**Storage keys with no user input at all.** `<env>/w/<workspace_uuid>/<yyyy>/<mm>/<file_uuid>` — a pure function of two server UUIDs and a date. Path traversal is impossible because there is nothing to sanitize. The key is allocated once and immutable forever, which is what makes unknown-outcome handling safe: a retried write, a retried delete, and a post-timeout `stat` all address the identical object, so **no retry can create a second one** — and the rule is `stat` before any repeat of a mutating call, never a blind retry.

**Attachments that are never authority.** A hybrid model: a B11-owned `file_attachments` reference count with a **closed two-value subject enum**, plus the subject domain's own field where a frozen contract established one. Not nullable FKs, which the brief forbids. Attach and detach mint **no new permission** — they compose `file.upload` with the subject domain's own write permission, which is both the anti-explosion move and the correct rule, since a Viewer can then read an attached file and can never attach one.

**Deletion that is a tombstone by construction.** Soft-delete plus asynchronous purge, and the archived row *is* the tombstone — no `file_assets` row is ever hard-deleted in Phase 1, by anything.

**Cleanup that refuses to guess.** Six orphan classes; three of them (`O-4` a file whose attachments were all detached, `O-6` a provider object with no row, and a dangling attachment subject) are **never auto-cleaned**, because a detachment may itself be the thing under review and a stray object is as likely to be a *lost row* as a leaked one — in which case deleting it destroys a customer's only copy. The sweeper has no privileged path: it invokes the ordinary guarded, audited commands, so a file it may not delete is simply not deleted.

## Firewalls, restated a domain further

> **A STORED ARTIFACT IS NOT A DOMAIN FACT.** A `FileAsset` never determines whether a Message was delivered, a tax document was cleared, a payment succeeded, revenue was recognized, or a Lead is qualified. The converse holds equally: a subject's state never changes a file's lifecycle. B11 has zero write path to any B5, B8, B9, B10, B2, or B6 table. Full proof: `B11_DOMAIN_ATTACHMENT_MODEL.md` §5, `B11_MESSAGING_MEDIA_BOUNDARY.md`, `B11_TAX_DOCUMENT_BOUNDARY.md`, `B11_BILLING_QUOTA_BOUNDARY.md`.

Two boundaries deserve naming. **B8 keeps entitlement truth absolutely**: frozen B8 has five quota metrics, none of them storage, and its own document says a sixth needs a controlled amendment. **B11 does not file it** — inventing per-plan storage allowances with no product input and no frontend evidence would be exactly the error the public-ID registry warns against one layer up. B11 enforces instead a uniform, plan-independent *platform safety ceiling*, which is an abuse control of the same class as the frozen API rate limit, and returns the frozen `QUOTA_EXHAUSTED`. **B10 keeps tax truth absolutely**, and B11 goes further: a `legal`-class file is undeletable by any command, worker, timer, or operator, and `retention_class` is immutable in both directions. The statutory retention period is unresolved (`B11-X-008`) — and cannot become blocking, because "never delete" is correct under every possible answer.

## The three places B11 had to tell the truth rather than inherit it

1. **B5 was promised a scanner it will not get.** `B5_MEDIA_B11_HANDOFF.md` §4 says B5 "inherits B11's" content-safety scanning policy. B11 performs **no malware scanning in Phase 1** (`B11-D-A024`) — which is contract-compliant, since frozen `BACKEND_SECURITY_ARCHITECTURE.md` says "malware scanning **where available**" — but leaving the sentence unqualified would let it read as a promise. `B11-AM-007` files the clarification, names the six compensating controls, and gives `quarantine` a *working* Phase-1 producer (operator hold) so the containment mechanism is exercised rather than dormant.
2. **The frozen API catalog and the frozen OpenAPI disagree** about what `POST /files/uploads` and `GET /files/{id}/download` return. `B11-AM-003` resolves it as a compatible clarification under which both frozen descriptions become simultaneously true, rather than inheriting the ambiguity.
3. **The frozen `CONFLICT` reason vocabulary is closed**, and B11 needs three new values. `B11-AM-009` registers them in the same pass that uses them — the omission B10 had to be audited into fixing.

## Numbers, derived rather than asserted

**12 controlled amendments** — 10 additive, 2 compatible clarifications, **0 non-additive** — across 14 frozen artifacts, none applied. **26 Class A decisions, 0 unresolved**; 10 Class B; 4 Class C. **3 new error codes**, with **8 of 12** candidate codes absorbed into existing ones. **2 permissions reused, 2 added**, with 5 candidate operations composed rather than granted codes. **Zero new public-ID prefix.** **129 acceptance tests across 26 categories, 88 of them negative controls.** **9 research facts** — 2 `VERIFIED` from primary vendor/standards documentation fetched in this pass, 4 `PARTIAL`, 3 `UNRESOLVED`, 0 `CONTRADICTED`; none of the unresolved items blocks Phase 1.

## Frontend evidence

`client/src` contains **no `<input type="file">`, no `FileReader`, no drag-and-drop, and no server upload call of any kind.** The only attach affordance is a hardcoded chip in the messaging composer; the only two `Blob` uses build CSV entirely client-side; every avatar is a first-letter initial; the invoice download button is permanently disabled; and the billing usage panel renders exactly the five frozen metrics with no storage figure. Eleven behaviors, individually itemized — a real count, neither padded to resemble a larger phase nor shrunk to hide that the evidence for a client upload surface is thin. Every one of them is reflected in a decision rather than designed around. See `B11_FRONTEND_BEHAVIOR_INVENTORY.md`.

## What remains open, and why it is safe

`PROVIDER_BOUNDARY_READY` is the pack's one `CONDITIONAL` (`B11_IMPLEMENTATION_READINESS.md` §3): the deployed target's pre-signed, checksum-header, object-lock, lifecycle, and at-rest-encryption behavior is unverified. An implementation could ship step 1 of the sequence on a **local-filesystem adapter** and pass every integrity, validation, and tenancy test in this pack. That is what "unresolved but non-blocking" means here, stated concretely rather than asserted.

B11 is design-only and grants no implementation authorization.
