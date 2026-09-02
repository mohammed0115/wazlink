# B8 — Privacy & Data Minimization

> Design only. Adopts the frozen data-classification table (`BACKEND_PRIVACY_AND_DATA_HANDLING.md`) verbatim; this document applies it to B8's specific tables.

## 1. What WazLink actually needs to store

Per frozen doctrine ("prefer Tap-hosted/tokenized flow to reduce PCI scope"): **no card PAN, CVV, or full card number is ever collected or stored** by any B8 table. `payments`/`billing_customers` store only opaque provider references (`provider_payment_ref`, `provider_customer_ref`, `provider_agreement_ref`) — the payment instrument itself remains entirely Tap-held. `EntitlementOverrideCreate.reason` and audit records are the only free-text fields B8 introduces; both are operator-authored, not customer PII.

## 2. Classification (per frozen table)

| B8 data | Frozen class | Handling |
|---|---|---|
| `Payment.amount`, `.currency`, `.status`, `provider_payment_ref` | Financial | strict `billing.view`/`payment.manage` permission; immutable audit |
| `payment_attempts`, `refunds` | Financial | same; append-only |
| `webhook_receipts` payload (Tap events, consumed not owned by B8) | Provider payloads | restricted JSONB, short retention, hash/reference — owned by the Webhooks domain, B8 only reads the normalized projection |
| `subscriptions`, `upgrade_quotes`, `invoices` | Financial | strict billing permission; immutable audit |
| `entitlement_overrides.reason` | Operational (admin-authored) | scrubbed of PII by policy (operators are instructed not to paste customer PII into `reason`; not machine-enforced beyond field length limits) |
| `plans`, `plan_versions`, `quota_definitions` | Public/internal catalog | no PII, no restriction beyond normal read auth |

## 3. Minimal webhook retention

Per `B8_WEBHOOK_MODEL.md` §8: only the fields needed for normalization (charge id, status, amount, currency, timestamps) are retained beyond the immediate processing window; the full raw Tap JSON body is not durably stored by B8 (it may exist transiently in the Webhooks domain's own short-retention `webhook_receipts.raw_payload_hash`/reference per that domain's own policy, which B8 does not redefine).

## 4. Retention

Proposed starting points, consistent with `BACKEND_PRIVACY_AND_DATA_HANDLING.md`'s "Default retention must be a product/legal decision": financial records (`payments`, `invoices`, `refunds`, `subscriptions` history) — policy-defined, longer retention, never auto-deleted absent legal/product sign-off (`B8-D-B009`, unresolved, matches frozen ADR-012's stance). `entitlement_overrides` — retained for the life of the workspace plus the standard audit retention window (unresolved exact duration, same class). On `WorkspaceDeletionRequested` (§`B8_COMMAND_EVENT_CATALOG.md` §3), B8 participates in the scheduled, audited purge workflow already named in `BACKEND_ROLLOUT_MIGRATION.md`/`BACKEND_OPERATIONS_OBSERVABILITY.md` — financial/audit records are anonymized rather than hard-deleted where legal retention applies, never silently erased.

## 5. Safe logging and redaction

No B8 log statement includes a full provider payload, a secret, or a card-shaped value (§`B8_SECURITY_THREAT_MODEL.md` T13). Structured logs reference `Payment.public_id`/`Subscription.public_id` and decimal amounts only — never a `provider_payment_ref` alongside anything that could re-identify the underlying card. Admin/export views mask nothing further for B8 (there is no phone/email on any B8 table) but inherit the platform-wide "never include secrets or raw card data" rule.

## 6. No document here makes a legal compliance claim

Consistent with every prior phase's disclaimer — Saudi data locality, PCI-DSS scope reduction claims, and exact retention durations remain `PRODUCT / LEGAL DECISION REQUIRED` per ADR-012, restated rather than resolved by B8.
