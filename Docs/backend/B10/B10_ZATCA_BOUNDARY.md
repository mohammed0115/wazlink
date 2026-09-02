# B10 — ZATCA Adapter Boundary

> Design only. No ZATCA credentials, SDK calls, or provider code are implemented in B10. Realizes the frozen `TaxProvider` port name already named in `BACKEND_INTEGRATION_BOUNDARIES.md` ("ZATCA/FATOORAH | `TaxProvider` | outbound + status | Tax | TaxInvoice separate from Payment/Invoice; exact legal mapping requires official validation").

## 1. Purpose

`TaxProvider` is the provider-neutral port. No ZATCA-specific field, endpoint, or payload shape ever appears in a B10 domain model, DTO, or command signature — only in a future adapter implementation (out of scope for B10; design only). This mirrors `B8_PAYMENT_PROVIDER_PORT.md`'s relationship to `B8_TAP_PROVIDER_BOUNDARY.md` exactly.

## 2. Port interface (conceptual — no code authored)

| Operation | Input (provider-neutral) | Output (provider-neutral) |
|---|---|---|
| `validate_configuration(legal_entity_id)` | legal entity identity, `credential_ref` | `{configured: boolean, environment, last_checked_at}` — no secret value |
| `onboard_compliance_csid(legal_entity_id, otp)` | one-time onboarding credential | opaque `compliance_csid_ref` (gated `REQUIRES OFFICIAL ZATCA VALIDATION`, `B10-D-B003`) |
| `submit_for_clearance(tax_invoice)` | normalized document (all fields from `TaxInvoice`/`TaxInvoiceLine`, provider-neutral shape) | cleared document reference, cryptographic stamp (opaque), normalized outcome |
| `submit_for_reporting(tax_invoice)` | same shape | acknowledgement reference, normalized outcome |
| `retrieve_submission_status(submission_ref)` | opaque ref | normalized outcome |

Every output crossing this port is normalized (§3) before it reaches any B10 command. No raw ZATCA payload, HTTP header, or SDK object crosses it — identical discipline to `B8_PAYMENT_PROVIDER_PORT.md` §2.

## 3. Submission routing — clearance vs. reporting (`B10-D-A018`, corrected under `B10-FIX.1`)

**`B10-FIX.1` correction.** The prior revision of this table routed by `document_type` alone (`standard_invoice`/`debit_note` → clearance, `simplified_invoice`/`credit_note` → reporting), which conflated two independent dimensions: the document's economic direction (invoice vs. credit note vs. debit note — UNCL1001 codes `388`/`381`/`383`) and its **standard-vs-simplified classification** (a document subtype independent of type code — confirmed against official ZATCA-adjacent technical material describing the UNCL1001 `388` type code with sub-values `01`=standard/`02`=simplified, and a document-subtype-code convention (`0100000` standard/business, `0200000` simplified/consumer) that applies orthogonally to whichever base type code the document carries). Independent re-research (`B10-X-002` re-verified, `B10-X-014` added, `B10-FIX.1`) confirms the actual, mechanically-determined rule is:

> **A credit note or debit note is routed by the `invoice_classification` it inherits from the original document it corrects — never by whether it is a credit note or a debit note.**

Routing is therefore keyed on `invoice_classification` (§`B10_DOMAIN_MODEL.md` §3, `B10_INVOICE_MODEL.md` §1a — separated from `document_kind` under this same fix), not on `document_type`/`document_kind` alone:

| `invoice_classification` | Applies to | Path | Timing | Confidence |
|---|---|---|---|---|
| `standard` | `standard_invoice`; `credit_note` referencing a `standard` document; `debit_note` referencing a `standard` document | clearance (real-time, pre-delivery validation) | synchronous within the submission attempt | `PARTIAL`, strengthened (`B10-X-002`, re-verified under `B10-FIX.1`) — multiple independently-concordant technical sources, several citing exact UNCL1001 type codes (`388`/`381`/`383`) and the standard/simplified subtype convention (`0100000`/`0200000`), consistently state the classification-inherits-from-original principle; the official XML Implementation Standard PDF was located and fetched but could not be rendered to readable text by any tool available in this pass, so this is **not** promoted to `VERIFIED` — see `B10_RESEARCH_REGISTER.md` `B10-X-002`/`B10-X-014` for the full evidentiary basis and its honest limits |
| `simplified` | `simplified_invoice`; `credit_note` referencing a `simplified` document; `debit_note` referencing a `simplified` document | reporting (post-delivery, within a bounded window commonly cited as 24 hours, `B10-X-004`, `PARTIAL`) | within that bounded window | `PARTIAL`, strengthened, for the classification-determines-route principle (same basis as above); `PARTIAL`, unchanged, for the exact 24-hour figure (`B10-X-004`) |

**`document_kind` (`standard_invoice`\|`simplified_invoice`\|`credit_note`\|`debit_note`, renamed from the pre-FIX.1 `document_type`) never appears as an input to this routing decision** — it determines the UNCL1001 base type code (`388`/`381`/`383`) presented to the provider, and nothing about clearance-vs-reporting. Only `invoice_classification` (`standard`\|`simplified`) does. This routing table is still the concrete mechanism gated behind `B10-D-B001` for its exact wire-level mechanics (which fields, which endpoint, which payload shape) — the *classification-determines-route* principle itself, and the fact that `document_kind` is not an input to it, are Phase-1 architecture decided now on the strength of the multiply-corroborated (though still `PARTIAL`, not primary-source-confirmed) evidence above, and are no longer left as an unresearched invention the way the pre-FIX.1 note-type-keyed rule was.

## 4. What never crosses the port

The ZATCA credential/certificate itself (adapter-internal only, injected from environment/secret management, §`B10_ZATCA_SECURITY_CREDENTIALS.md`); raw XML/UBL payloads beyond what is normalized into `tax_submissions`' typed columns; any field not already present on `TaxInvoice`/`TaxInvoiceLine`.

## 5. Submission authority (`B10-D-A011`)

Only the system-actor command `SubmitTaxDocumentForProcessing`, itself gated on `TaxProfile.zatca_applicability = enabled`, may invoke §2's submission operations. `RetryTaxSubmission` is the sole retry path (§`B10_ZATCA_FAILURE_RETRY_MODEL.md`) and never constructs a new `TaxInvoice`. No manual "submit now" endpoint bypasses this gate.

## 6. Domain states are not copies of provider states

`tax_invoices.zatca_status` (§`B10_INVOICE_STATE_MACHINE.md` §2) is derived from the normalized outcome the port returns, never a direct copy of a ZATCA-specific status code — mirrors `B8_PAYMENT_PROVIDER_PORT.md` §5's identical discipline for `Subscription.status` vs. Tap.

## 7. Dormant by construction while not applicable

When `zatca_applicability ∈ {unknown, not_applicable}`, no B10 code path ever calls any §2 operation — there is no conditional "skip if not configured" branch inside submission logic, because `SubmitTaxDocumentForProcessing` is never invoked at all in that state (§`B10_TAX_APPLICABILITY_MODEL.md` §3, `B10_INVOICE_MODEL.md` §4). The platform requires zero ZATCA credentials to operate correctly in this mode (brief §40).
