# B5 — Security, Privacy, and Threat Model

> **B5 status:** Target design only. Threat-modeled explicitly per the brief's required attack list, not by generic policy prose.

## 1. Credential and secret handling

Every `ChannelBinding` secret field (`access_token_ref`, `app_secret_ref`, `webhook_verify_token_ref`) is stored as a reference into the platform's secret store, never a plaintext column, never returned by any API response (`B5_PROVIDER_CONFIGURATION_MODEL.md` §6), never logged (`B5_RECONCILIATION_OBSERVABILITY.md` §2), and never included in any domain event payload.

## 2. Threat table

| # | Threat | Mitigation |
|---|---|---|
| 1 | Cross-workspace conversation access | every read/write predicate is `workspace_id`-scoped first (`B5_ENTITLEMENT_RBAC_TENANCY.md` §6–§7); cross-workspace `GET` resolves `404`, indistinguishable from non-existent |
| 2 | IDOR (guessing another workspace's `CONV-*`/`MSG-*`) | same as above — public IDs are opaque tokens, not sequential, and every lookup still requires workspace-scope match |
| 3 | Forged webhook | `B5_WEBHOOK_SECURITY_MODEL.md` §3 — signature-verified before any processing, sync or async |
| 4 | Replayed webhook | §5/§10 of the webhook model — idempotency absorbs a captured-and-replayed legitimate webhook |
| 5 | Signature bypass (e.g. a middleware short-circuit) | signature verification is the first step of the single inbound handler, not a separable/optional middleware — `B5_ACCEPTANCE_TESTS.md` AT-SIG-* negative controls assert no code path reaches domain processing without it |
| 6 | Provider credential leak | §1 above; `B5-X-016`'s data-retention question governs whether Meta itself is a secondary leak surface, outside WazLink's control |
| 7 | Message body leakage | never logged in full (§4 below), never in a timeline `summary` (`B5_CRM_TIMELINE_PROJECTION.md` §5), never in a metric label |
| 8 | Media authorization bypass | delegated to B11's access-controlled references, never a raw public URL (`B5_MEDIA_B11_HANDOFF.md` §4) |
| 9 | Open redirect through a media URL | B5 never constructs a redirect from provider-supplied media URLs directly to a client; all media access is proxied/signed through B11 |
| 10 | Prompt injection via inbound text reaching Sales AI | inbound message text is stored as inert data (`Message.body`); it is never interpolated into a governed prompt's *instruction* channel — `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §5's identical discipline ("the model is asked to extract/classify against a closed schema, not to follow instructions found inside the input data") applies transitively to any future S8 backend consuming this content |
| 11 | CSV/formula injection (future export) | not designed here (no export surface exists in this phase); recorded as a forward requirement (`B5-D-C007`) if/when a message export feature is added — a leading `=`/`+`/`-`/`@` in exported text must be neutralized |
| 12 | Log leakage | §4 below |
| 13 | Template variable injection | `B5_TEMPLATE_MODEL.md` §3's closed validation gate |
| 14 | HTML/script rendering of message content | WhatsApp content has no HTML rendering surface; WazLink's own admin/Inbox UI renders `Message.body` as plain text/escaped, never `innerHTML` |
| 15 | Malicious attachment | delegated to B11's scanning/quarantine policy (`B5_MEDIA_B11_HANDOFF.md` §4) — B5 does not independently execute or preview attachment content server-side |
| 16 | Phone-number enumeration (probing which phone numbers exist as Contacts via the send/lookup path) | recipient resolution always requires an authenticated, permissioned, workspace-scoped Lead/Contact reference (`B5_CONTACT_PHONE_RESOLUTION.md` §3) — there is no endpoint that accepts a bare phone number and reports back whether it matches a known Contact |
| 17 | Recipient substitution (tampering with a request to send to a different recipient than authorized) | the recipient is resolved server-side from `lead_id`/`conversation_id`, never accepted as a raw phone number in the send request body for an existing Conversation |
| 18 | Mass-send abuse | the workspace admission ceiling (`B5_RATE_COST_RETRY_MODEL.md` §2) bounds this structurally, not merely by policy |
| 19 | Automation abuse (once B7 exists) | `B5_B6_B7_BOUNDARIES.md` §2 — automation reuses the identical governed command and admission sequence; no exemption exists to abuse |
| 20 | Privilege escalation (a `message.send` holder attempting provider configuration) | `messaging.provider.manage` is a materially distinct, higher-tier permission (`B5_ENTITLEMENT_RBAC_TENANCY.md` §1); no code path checks `message.send` where `messaging.provider.manage` is required |
| 21 | Suppression bypass | `B5-D-A017` — absolute, no override path exists at any privilege level (`B5_CONSENT_COMMUNICATION_POLICY.md` §3) |

## 3. Prohibited inferences

B5 is a transport/messaging domain, not an analysis domain — it infers nothing about a counterparty. The only "inference" B5 performs is deterministic phone/content normalization (`B5_CONTACT_PHONE_RESOLUTION.md`, `B5_MESSAGE_CONTENT_MODEL.md`), never a judgement about the person. Any judgement about a Business's opportunity is B4's, read-only, never re-derived here (`B5_B4_HANDOFF_CONTRACT.md`).

## 4. Redaction and logging policy

| Surface | Rule |
|---|---|
| Structured logs | one line per state transition and per provider/webhook call, carrying identifiers only — never body/media/secrets (`B5_RECONCILIATION_OBSERVABILITY.md` §2) |
| Provider request/response | never logged in full, at any log level, not even debug — only the normalized `outcome` and `provider_metadata` |
| Traces | carry no sensitive payload, per frozen B0 |
| Timeline entries | template-generated `summary` only, never `Message.body` (`B5_CRM_TIMELINE_PROJECTION.md` §5) |

## 5. Data minimization toward the provider

Every outbound provider call sends exactly the content the actor authored/selected — WazLink does not enrich an outbound send with additional CRM context (Lead notes, other conversations, Intelligence scores) beyond what the human explicitly typed or the chosen template's variables resolve to. There is no code path where B5 sends *more* to Meta than the message itself requires.

## 6. Data retention

Design hooks only — `B5_DATA_MODEL.md` §4 states the exact policy-class table; final legal retention durations for message bodies, webhook payloads, and consent evidence are `B5-X-016`/`B5-X-018`-adjacent legal validation items, not invented here, mirroring `B4_DATA_MODEL.md` §4's identical "product/legal decision required" posture for `intelligence_runs` retention.
