# B5 — WhatsApp External Validation Register

> **B5 status:** Target design only. Provider and legal facts B5 must not invent. None blocks design closure — each is isolated behind the `MessagingProvider` adapter boundary (`B5_PROVIDER_ABSTRACTION.md`) or a configuration value, so learning the answer changes no contract in this package.

| ID | Item | Isolated behind |
|---|---|---|
| `B5-X-001` | current Meta Cloud API version, base URL, and versioning/deprecation policy | the adapter, not designed here |
| `B5-X-002` | exact send-message endpoint request/response schema (text, media, template, interactive) | `B5_PROVIDER_ABSTRACTION.md` §2–§3's normalized contract; the raw schema is adapter detail |
| `B5-X-003` | phone-number-ID vs. WABA-ID semantics and their exact relationship | `ChannelBinding` (`B5_PROVIDER_CONFIGURATION_MODEL.md` §2) stores both as opaque configured values |
| `B5-X-004` | access-token model (permanent system-user token vs. expiring token), rotation mechanics | `B5_PROVIDER_CONFIGURATION_MODEL.md` §4 |
| `B5-X-005` | webhook subscription model and the exact `GET` verification handshake fields (`hub.mode`, `hub.verify_token`, `hub.challenge`) | `B5_WEBHOOK_SECURITY_MODEL.md` §2 defines the abstract flow; exact field names are adapter detail |
| `B5-X-006` | exact webhook signature scheme (header name, algorithm, canonicalization of the raw body) | `B5_WEBHOOK_SECURITY_MODEL.md` §3's `X-Hub-Signature-256`-shaped placeholder; must be confirmed against current Meta documentation before implementation |
| `B5-X-007` | inbound/status webhook payload schema, including how a status webhook nests `statuses[]` and how an inbound message nests `messages[]` | `B5_PROVIDER_ABSTRACTION.md` §4's normalized shape is the only thing the domain sees; the adapter owns the raw shape |
| `B5-X-008` | template category/status taxonomy (e.g. `MARKETING`/`UTILITY`/`AUTHENTICATION`; `APPROVED`/`REJECTED`/`PENDING`/`PAUSED`/`DISABLED`) and template component schema (header/body/footer/buttons, variable placeholders) | `TemplateDefinition` (`B5_TEMPLATE_MODEL.md` §2) stores the synced values as opaque enums pending confirmation of the exact closed set |
| `B5-X-009` | media upload/download flow, temporary URL expiry window, supported MIME types and size limits per media kind | `B5_MEDIA_B11_HANDOFF.md` §3 |
| `B5-X-010` | the customer-service-window duration and the exact rules for what resets/extends it | `B5_CUSTOMER_SERVICE_WINDOW.md` §2 — the evaluator's *existence* and four-outcome shape is Class A; the duration constant is this external item, **not** hard-coded |
| `B5-X-011` | template requirement rules outside the active window (which content types are permitted free-form vs. template-only) | `B5_CUSTOMER_SERVICE_WINDOW.md` §3 |
| `B5-X-012` | Meta's own throughput/messaging-limit tiers (per phone number, quality-rating-gated) and how a workspace's tier is discovered/changes | `B5_RATE_COST_RETRY_MODEL.md` §2 keeps this structurally distinct from WazLink's own workspace ceiling |
| `B5-X-013` | Meta's quality-rating system and its effect on sending ability (e.g. throttling, number flagging) | `B5_RECONCILIATION_OBSERVABILITY.md` §1 exposes an observability signal for it; the rating mechanics themselves are external |
| `B5-X-014` | Meta's own error-code taxonomy and which errors are transient vs. terminal | `B5_RATE_COST_RETRY_MODEL.md` §3's classification table maps the *normalized* outcome; the literal error-code-to-class mapping table is adapter detail requiring confirmation |
| `B5-X-015` | provider-side retry/idempotency guidance (does Meta itself deduplicate a resubmitted identical send?) | governs whether `B5_IDEMPOTENCY_CONCURRENCY.md` §4's ambiguous-timeout handling can ever safely resubmit; assumed **no** until confirmed (§ below) |
| `B5-X-016` | data retention / data-usage terms for message content Meta itself may retain | governs whether `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §5's input-minimization posture needs strengthening; **must be confirmed before implementation** |
| `B5-X-017` | regional / data-residency implications of routing WhatsApp traffic through Meta, inheriting B3's and B4's identical unresolved Saudi data-locality question (`B3-X-008`, `B4-X-008`) | not resolved here, escalated the same way |
| `B5-X-018` | opt-in/consent legal requirements specific to WhatsApp Business messaging in the applicable jurisdiction(s) | `B5_CONSENT_COMMUNICATION_POLICY.md` §5 records this as a legal validation item, not an architectural assumption |

**Assumption stated pending `B5-X-015`:** until Meta's own duplicate-send behavior is confirmed, B5 assumes **no** provider-side deduplication and never resubmits an ambiguous-timeout send without going through reconciliation first (`B5_OUTBOUND_PIPELINE.md` §4, `B5-D-A015`) — the conservative assumption, not the convenient one.

**`EXTERNAL_VALIDATION_ITEM_COUNT = 18`.** B5 invents no legal conclusion or provider fact for any of these, mirroring `B3_SECURITY_PRIVACY_LEGAL.md` §8 / `B4_EXTERNAL_VALIDATION_REGISTER.md`'s identical discipline. No B5 contract in this corpus depends on any of the above being answered a particular way — learning the answer changes an adapter or a configuration value, never a domain table, DTO field, or state machine.
