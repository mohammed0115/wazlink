# B10 — Dual-Track Compatibility

> Design only. Realizes `B10-D-A020` (§`B10_DECISION_REGISTER.md`). Brief §39 requires B10 to work identically for Track A (Discovery-acquired customers) and Track B (existing/imported/manual customers).

## 1. B10's only upstream dependency is B8's `Invoice`

`TaxInvoice.source_ref` points exclusively at a B8 commercial `Invoice` (`INV-BILL-*`), consumed via the frozen `InvoiceIssued` event (`B10_B8_BILLING_BOUNDARY.md` §3). B8's own `Invoice` issuance already requires no `DiscoveryJob`, no Maps-sourced `Business`, and no AI-intelligence provenance — a workspace's subscription billing is identical regardless of how its leads/deals arrived. B10 therefore inherits this independence for free; it does not need to design anything new to achieve it.

## 2. What B10 explicitly never requires

No B10 command, event, or DTO ever references `DiscoveryJob`, `Business` (Maps-sourced), `AutomationRule`, `RevenueEvent.source_type="deal"` and its provenance chain, or any Intelligence-domain artifact. `TaxInvoice`'s buyer identity comes from `Workspace` + optional `TaxBuyerProfile` (§`B10_LEGAL_ENTITY_TAX_PROFILE.md` §4) — both exist identically for Track A and Track B workspaces.

## 3. Track A / Track B are indistinguishable to B10

A `TaxInvoice`'s generation, content, applicability gating, and submission behavior are computed entirely from `(TaxProfile current state, B8 Invoice fields, optional TaxBuyerProfile)` — none of which carries a Track A/B discriminator. Two workspaces with identical subscription/billing history produce byte-identical `TaxInvoice` content regardless of how each workspace originally acquired its customers.

## 4. Negative control

`AT-B10DT-1`: construct a `TaxInvoice` for a workspace whose only CRM data arrived via manual/imported entry (zero `DiscoveryJob` rows, zero Maps-sourced `Business` rows) — assert identical successful behavior to a Discovery-acquired workspace's equivalent invoice.

```
(no B10-specific counter required beyond the negative control above; B10 introduces no Track-differentiated logic to leak)
```
