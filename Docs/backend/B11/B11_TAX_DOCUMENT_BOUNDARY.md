# B11 — Tax Document Boundary (B10)

> Design only. B10 is frozen. B11 modifies nothing in it and asserts nothing about ZATCA, statutory obligation, or legal retention.

## 1. The firewall, stated first

> **`B11-D-A023` (authority half).** A `FileAsset` never determines whether a tax document is **issued**, **reported**, **cleared**, **accepted**, or **rejected**. Those five facts live in `tax_invoices.status`, `tax_invoices.zatca_status`, and `tax_submissions` — B10-owned, and B11 has no write path, no read dependency, and no inference rule touching any of them.

Restating B10's own firewall one domain further, in B11's terms:

> **A STORED ARTIFACT IS NOT A TAX FACT.** The existence of bytes does not mean a document was issued. The absence of bytes does not mean it was not. A `failed` or `archived` artifact does not invalidate an accepted submission, and an `available` artifact does not make an unsubmitted document compliant.

`B10_AUTHORITY_LEAKS = 0` rests on this section plus `B11_DOMAIN_ATTACHMENT_MODEL.md` §5.

## 2. Phase 1: B10 produces no artifact, and B11 says so plainly

B10's Phase-1 posture is **dormant**. `TaxProfile.zatca_applicability` starts at `unknown` and reaches `not_applicable` only through an explicit, Owner-only, audited command (`B10-D-A002`/`A016`); under `not_applicable` no `TaxInvoice` is ever created at all (`B10-D-A005`). The XML/UBL/QR/cryptographic-stamp specification that would define what an artifact even *is* remains gated `REQUIRES OFFICIAL ZATCA VALIDATION` under `B10-D-B001`.

**Therefore `subject_type='tax_document_artifact'` is DECLARED with no Phase-1 producer.** B11 does not invent an artifact format, does not claim B10 will produce one, and does not build a code path that runs today. What it does do is settle three things now, while they are cheap, so that the moment B10's `enabled` path is implemented there is no scramble and no re-architecture:

| Settled now | Value |
|---|---|
| Subject type | `tax_document_artifact`, in the closed enum (`B11_DOMAIN_ATTACHMENT_MODEL.md` §3) |
| Retention class | `legal` — never swept, never purged by B11 (§3) |
| Access class | `private`, `file.download` plus B10's own `tax.view`, composed exactly as `AttachFile` composes permissions |

## 3. Retention: B11 defers, and cannot override

> **`B11-D-A023` (retention half).** `file_assets.retention_class ∈ {product, legal}`. Only `product` is eligible for the orphan sweeper, the purge grace timer, or any automatic deletion. A `legal`-class file is **never** deleted by any B11 worker, sweep, timer, or operator command — including `DeleteAsset`, which returns `403 PERMISSION_DENIED` on a `legal`-class file regardless of the caller's role.

Three distinct retention concepts are kept apart, per §21 of the brief:

| Concept | Who decides | B11's role |
|---|---|---|
| **Product retention** — how long WazLink keeps an ordinary user attachment | WazLink product | B11 implements it (`B11_DELETION_RETENTION_MODEL.md` §6), with proposed values marked `PRODUCT DECISION REQUIRED` |
| **Business retention** — how long a workspace wants its own data | the customer, through explicit deletion | B11 honors `DeleteAsset` on `product`-class files |
| **Legal/regulatory retention** — how long a statutory document must be kept | **outside WazLink's engineering authority entirely** | B11 refuses to delete, and defers |

**The exact legal retention period for tax artifacts in the relevant jurisdiction is UNRESOLVED** (`B11-X-008`, `B11-D-B009`). B10 records the same gap independently as `B10-D-B004` ("exact retention durations for tax/invoice records — unresolved … product/legal decision, not invented"). B11 does not resolve it, does not guess it, and — critically — does not *need* it, because the fail-safe is "never delete," which is correct under every possible value the answer could take. A too-long retention is a storage cost; a too-short one is a compliance failure. B11 chooses the cost.

This is the structural guarantee that B11 cannot override B10's retention policy: there is no B11 code path that deletes a `legal`-class file, so there is nothing for a future B10 policy to have to defend against.

## 4. Who would create such a file, and how

When B10's `enabled` path is eventually implemented, the flow is fixed by this document and requires no new B11 design:

1. B10's own tax service generates the artifact bytes (format per `B10-D-B001`, still gated).
2. B10 calls `CreateUpload` under a system actor with `retention_class='legal'`, then `UploadFileContent`/`FinalizeUpload` — the ordinary path, with the ordinary validation.
3. B10 calls `AttachFile(file, subject_type='tax_document_artifact', subject_id=<TAX-*>)`.
4. B10 stores the returned `FILE-*` on its own row, under its own schema, by its own decision. **B11 does not tell B10 what to store or where.**

`retention_class` is set at `CreateUpload` and is **immutable thereafter**. It cannot be downgraded from `legal` to `product` by any command, which closes the obvious attack of relabelling a statutory record to make it sweepable.

## 5. Storage usage

A `legal`-class artifact is counted in **physical** provider usage and excluded from **logical/product** workspace usage (`B11_STORAGE_USAGE_MODEL.md` §5). The reason is not accounting convenience: the workspace neither chose to store it nor may delete it, so charging it against a workspace's product allowance would bill a customer for a document WazLink is obliged to keep on its own behalf. The two figures are separately reported and never assumed equal.

## 6. Negative controls

`AT-B11TAX-1` **(NC)**: a B11 command, worker, event handler, or reconciliation repair writing `tax_invoices`, `tax_invoice_lines`, `tax_submissions`, `tax_profiles`, or `legal_entities` — fails.
`AT-B11TAX-2` **(NC)**: any B11 logic that reads a `FileAsset`'s lifecycle state to infer a tax document's issued/reported/cleared/accepted/rejected status — fails.
`AT-B11TAX-3` **(NC)**: `DeleteAsset`, the orphan sweeper, the purge worker, or any operator command removing or scheduling removal of a `legal`-class file — fails.
`AT-B11TAX-4` **(NC)**: a command mutating `retention_class` after creation, in either direction — fails.
`AT-B11TAX-5` **(NC)**: any B11 document asserting a specific statutory retention period, ZATCA obligation, or compliance status — fails.
