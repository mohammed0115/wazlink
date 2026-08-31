# B5 — Acceptance Test Pack

> **B5 status:** Target design only. Implementation-independent. `**NC**` rows are negative controls: an implementation that fails the cited invariant must fail these, not merely happen to pass the positive rows.
>
> **`B5-FIX.1` note on test kind.** Not every row below is a runtime end-to-end test, and this pack does not claim otherwise. Four kinds appear: `RUNTIME_BEHAVIOR` (exercises a running implementation — the large majority), `STATIC_ARCHITECTURE` (inspects code/schema structure without executing a request — e.g. "search for a forbidden FK"), `DOCUMENT_CONSISTENCY` (checks that one design document's claim matches another document's or a frozen source's actual text — e.g. `AT-AMEND-*`), and `EXTERNAL_VALIDATION_GATE` (checks that an unconfirmed external fact is correctly isolated behind a config value/adapter, not baked into domain logic — `AT-EXT-*`). Category headers below are annotated with their kind where a category is not predominantly `RUNTIME_BEHAVIOR`.

## 1. Domain — AT-DOM (`STATIC_ARCHITECTURE`)

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DOM-1 | any B5 write path | inspect | writes only B5-owned tables | `B5-D-A001` |
| AT-DOM-2 | any B5 table | search for a `deals`/`pipeline_stages`/`revenue_events` FK | none exists | `B5-D-A024`, `B5-D-A033` |
| AT-DOM-3 | any B5 table | search for a `businesses`/`discovery_results` write credential | none exists | `B5_DOMAIN_OWNERSHIP.md` §5 |
| AT-DOM-4 **NC** | — | an implementation writing `leads`/`contacts` from a B5 command | rejected at design review — no B5 command targets a B2 table | `B5-D-A001` |
| AT-DOM-5 **NC** | — | an implementation where any B5 event handler or command writes a `revenue_events` row, or a Message/Conversation event carries a field a downstream consumer could mistake for recognized/attributed revenue | rejected at design review — no B5 table has a foreign key toward Billing/Revenue, and `AT-DOM-2` already fails first if attempted | `B5-D-A033` |

## 2. Conversation — AT-CONV

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONV-1 | no existing Conversation for `(workspace, channel, lead, phone)` | inbound or outbound admission | new `CONV-*` created | `B5-D-A003` |
| AT-CONV-2 | existing `open` Conversation for that key | new inbound/outbound | reused, same `CONV-*` | `B5-D-A003` |
| AT-CONV-3 | existing `closed` Conversation, new inbound arrives | inspect | reopened (`closed→open`), same `CONV-*`, no new row | `B5_CONVERSATION_MODEL.md` §4 |
| AT-CONV-4 | `open` Conversation, unread inbound present | `ArchiveConversation` | `409 CONFLICT`, `unread_messages_present` | `B5_CONVERSATION_MODEL.md` §5 |
| AT-CONV-5 | `open` Conversation, zero unread | `ArchiveConversation` | `status=closed` | §5 |
| AT-CONV-6 | `closed` Conversation | `ReopenConversation` | `status=open`, no Message created | FB-11 |
| AT-CONV-7 | reassign to current owner | `AssignConversation` | no-op, no activity row | FB-19 |
| AT-CONV-8 **NC** | — | an implementation maintaining `unread_count` as a cached column updated ad hoc rather than computed at read time | drift-prone under concurrent webhook writes — rejected at design review | `B5-D-A029` |
| AT-CONV-9 **NC** | — | an implementation permitting two simultaneously `open` Conversations for the identical `(workspace, channel, lead, phone)` | AT-CONV-1/2 fail — this is the brief's explicit duplicate-conversation negative control, resolving FB-26 | `B5-D-A003` |

## 3. Message — AT-MSG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-MSG-1 | Message admitted | inspect | `body`/`content_type`/`media`/`template_snapshot` set once, immutable thereafter | `B5-D-A004` |
| AT-MSG-2 | outbound Message `failed` | `retry` | same `MSG-*` re-submitted, no new row | FB-08 |
| AT-MSG-3 | any Message | inspect | `status` derives from `MessageDelivery` history, never independently writable | `B5-D-A005` |
| AT-MSG-4 | reply context supplied | inspect | `reply_to_message_id` resolves within the same `conversation_id` only | `B5_MESSAGE_MODEL.md` §4 |
| AT-MSG-5 **NC** | — | an implementation editing `body` on an already-`sent` Message | AT-MSG-1 fails | `B5-D-A004` |

## 4. State machine — AT-STATE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-STATE-1 | new admission | inspect | `status=queued` | transition 1 |
| AT-STATE-2 | worker dispatches | inspect | `status=submitted` | transition 2 |
| AT-STATE-3 | provider returns `provider_message_id` | inspect | `status=sent` | transition 3 |
| AT-STATE-4 | delivery webhook | inspect | `status=delivered` | transition 7 |
| AT-STATE-5 | read webhook | inspect | `status=read` | transition 9 |
| AT-STATE-6 | `read` arrives while `status=sent` | inspect | `delivered` inferred first, then `read` — both recorded | §4 exception |
| AT-STATE-7 | `delivered` arrives after `status=failed` | inspect | not applied; `MessageDelivery` recorded, `Message.status` unchanged — this is the **domain-layer** legality test (does the state machine itself refuse the transition); contrast `AT-STAT-3`, which tests the **observability-layer** side effect of the identical event (the metric increment), not the domain outcome | §4 |
| AT-STATE-8 | duplicate `delivered` callback | inspect | idempotent no-op on `status`, new audit row still appended | §4 |
| AT-STATE-9 | `queued` Message | `CancelMessage` | `status=cancelled` | transition 10 |
| AT-STATE-10 | `submitted` Message | `CancelMessage` | rejected — `409 CONFLICT`, `message_not_cancellable` | §2 |
| AT-STATE-11 **NC** | — | an implementation applying an out-of-table transition (e.g. `failed→delivered`) directly | AT-STATE-7 fails | §4 |
| AT-STATE-12 **NC** | — | an implementation sharing one status enum across inbound and outbound | `"read"` becomes ambiguous — rejected at design review | `B5-D-A006`/`A007` |

## 5. Inbound — AT-IN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IN-1 | phone matches known Contact+Lead | inbound webhook | Message admitted, `sender_type=contact` | `B5_INBOUND_PIPELINE.md` §2 |
| AT-IN-2 | phone matches no known Contact, Lead resolvable | inbound webhook | Message admitted, `sender_type=unknown_contact`, `contact_id=null` | §2, FB-06 |
| AT-IN-3 | phone matches multiple Contacts | inbound webhook | deterministic tie-break applied, never arbitrary | §2 |
| AT-IN-4 | inbound media | inbound webhook | Message admitted immediately, `fetch_status=pending`, never blocked on fetch | §5 |
| AT-IN-5 | unsupported content kind | inbound webhook | `content_type=unsupported`, `body=null`, never mistyped as `text` | §5 |
| AT-IN-6 | reply context references an unknown local message | inbound webhook | `reply_to_message_id=null`, ingestion still succeeds | §4 |
| AT-IN-7 **NC** | — | an implementation dropping an inbound message because no Contact link exists yet | AT-IN-2 fails — the brief's "known Contact but no Lead" / unknown-inbound negative control | §2 |

## 6. Outbound — AT-OUT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OUT-1 | admission sequence, all gates pass | `SendMessage` | `202`, Message `queued`, durably persisted **before** any provider call | `B5_OUTBOUND_PIPELINE.md` §1 |
| AT-OUT-2 | DB committed, outbox relay delayed | observe | Message still eventually dispatched — no loss | §3 |
| AT-OUT-3 | provider call succeeds, worker crashes before commit | worker restart | re-reads delivery history, does not re-call provider if a result was captured | §3, `B5_IDEMPOTENCY_CONCURRENCY.md` §5 |
| AT-OUT-4 | provider timeout, retry budget remains | observe | automatic retry, same Message, same content | §4 |
| AT-OUT-5 | provider timeout, budget exhausted | observe | `submitted` until reconciliation resolves; never immediately `failed` | §4 |
| AT-OUT-6 **NC** | — | an implementation resending a fresh provider call after every ambiguous timeout without checking reconciliation first | this is the brief's explicit "ambiguous provider timeout does not blindly duplicate send" negative control | `B5-D-A015` |

## 7. Webhook — AT-WH

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-WH-1 | `GET` verification, correct `verify_token` | handshake | `hub.challenge` echoed, `200` | `B5_WEBHOOK_SECURITY_MODEL.md` §2 |
| AT-WH-2 | `GET` verification, wrong token | handshake | `403`, no challenge echoed | §2 |
| AT-WH-3 | valid signature, well-formed, unrecognized `event_kind` | POST | `200`, recorded, zero domain effect | §7 |
| AT-WH-4 | valid signature, malformed payload | POST | `200`, recorded as `malformed`, zero domain effect | §6 |
| AT-WH-5 | duplicate webhook delivery (same `provider_event_id`), both signature-valid | POST twice | the **generic receipt layer's** own dedup key rejects the second delivery before B5 domain code runs at all — the mechanism under test is the receipt-layer key, not the domain outcome (contrast `AT-IDEM-3`, which tests the domain-level guarantee directly, independent of which layer stopped the duplicate) | §5 |
| AT-WH-6 **NC** | — | an implementation processing a webhook asynchronously before signature verification completes | this is the brief's explicit "failed signature payload is not processed asynchronously" negative control | `B5-D-A010` |
| AT-WH-7 **NC** | — | an implementation that admits a second `Message` (or a second `MessageDelivery` counted as a distinct business effect) when the identical provider callback is delivered twice, regardless of which layer's dedup key is credited | this is the brief's explicit "duplicate provider callback cannot duplicate Message" negative control — fails if either `AT-WH-5` or `AT-IDEM-3`'s guarantee is absent | `B5-D-A013`, `B5_IDEMPOTENCY_CONCURRENCY.md` §1 |

## 8. Signature — AT-SIG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SIG-1 | correctly signed payload | verify | accepted, proceeds to domain processing | `B5_WEBHOOK_SECURITY_MODEL.md` §3 |
| AT-SIG-2 | incorrectly signed payload | verify | `401`, never reaches domain processing | §3 |
| AT-SIG-3 | signature computed against re-serialized (not raw) body | verify | fails — the implementation must verify against raw bytes | §3 |
| AT-SIG-4 | payload signed with binding Y's secret, claiming binding X's `phone_number_id` | verify + resolve | signature check fails against X's own secret; never resolves to X's workspace | `B5_WEBHOOK_SECURITY_MODEL.md` §4 |
| AT-SIG-5 **NC** | — | an implementation trusting a `workspace_id`-shaped field inside the webhook body | this is the brief's explicit "webhook body cannot choose workspace" negative control | `B5-D-A011` |
| AT-SIG-6 **NC** | — | an implementation logging the `app_secret_ref` value at any level | fails `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1/§4 | — |

## 9. Idempotency — AT-IDEM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IDEM-1 | request replayed under same `Idempotency-Key` | submit twice | identical stored response, one Message | `B5-D-A022` |
| AT-IDEM-2 | two concurrent requests, same `Idempotency-Key` | submit simultaneously | one admitted, one replayed | §3 |
| AT-IDEM-3 | duplicate webhook, same `provider_event_id`, hypothetically both reaching domain processing (i.e. even if the receipt-layer key in `AT-WH-5` were absent) | deliver twice | the **status-application monotonicity key** (`message_id`/`status_value`/`provider_timestamp`) still absorbs the second application as a no-op — a second, independent layer of defense, not a restatement of `AT-WH-5`'s receipt-layer test | `B5-D-A013` |
| AT-IDEM-4 | duplicate `MessageDelivery` write (retry race) | write twice | unique `(message_id, attempt_sequence)` absorbs the second write as a no-op | `B5_IDEMPOTENCY_CONCURRENCY.md` §1 |
| AT-IDEM-5 **NC** | — | an implementation with no `Idempotency-Key` enforcement on `SendMessage` | a double-click sends twice — fails `B5-D-A022` | — |

## 10. Concurrency — AT-CONC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONC-1 | two agents send simultaneously, same Conversation | submit both | both admitted as distinct Messages | `B5_IDEMPOTENCY_CONCURRENCY.md` §3 |
| AT-CONC-2 | two inbound webhooks, same Conversation, different messages | deliver both | both admitted, ordered by `created_at` | §3 |
| AT-CONC-3 | first-contact race (inbound and outbound resolve the same new Conversation key simultaneously) | both paths | exactly one `CONV-*` created, unique-constraint-backed | §3 |
| AT-CONC-4 | `MarkConversationRead` races a new inbound message | both concurrently | the new inbound message remains unread; no lost update | §3 |
| AT-CONC-5 | archive races an incoming message | both concurrently | Conversation reopens as part of the same transaction that admits the message — never dropped | `B5_CONVERSATION_MODEL.md` §4 |
| AT-CONC-6 **NC** | — | an implementation that can silently drop a message arriving during an archive transition | AT-CONC-5 fails | — |

## 11. Status — AT-STAT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-STAT-1 | any `MessageDelivery` write | inspect | `provider_metadata` present, operator-scoped only | `B5_ENTITLEMENT_RBAC_TENANCY.md` §4 |
| AT-STAT-2 | `failed` Message | actor-facing read | `failure_code` only, never raw provider error text | `B5_RATE_COST_RETRY_MODEL.md` §3 |
| AT-STAT-3 | status regression attempt (any of `AT-STATE-7`'s scenario or its siblings) | webhook delivered | `status_regression_attempts_total` incremented and the attempt is operator-visible — this is the **observability-layer** test (is the regression surfaced for an operator to notice); the domain-layer refusal itself is `AT-STATE-7`'s assertion, not repeated here | `B5_MESSAGE_STATE_MACHINE.md` §4 |

## 12. Template — AT-TPL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TPL-1 | `TemplateDefinition.status=APPROVED` | `SendTemplateMessage` | admitted | `B5_TEMPLATE_MODEL.md` §6 |
| AT-TPL-2 | `status=PENDING`/`REJECTED`/`DISABLED` | `SendTemplateMessage` | rejected, `template_not_approved` | §6 |
| AT-TPL-3 | send succeeds | inspect resulting Message | `template_snapshot` embedded, immutable | §4, `B5-D-A019` |
| AT-TPL-4 | `TemplateDefinition` later edited/disabled | inspect a prior sent Message | `template_snapshot` unaffected | §1 |
| AT-TPL-5 | missing required variable | `SendTemplateMessage` | `422`, `template_variable_missing` | §3 |
| AT-TPL-6 | extra unexpected variable | `SendTemplateMessage` | rejected — closed schema | §3 |
| AT-TPL-7 | unsafe URL in a URL-typed slot | `SendTemplateMessage` | rejected — scheme allow-list | §3 |
| AT-TPL-8 **NC** | — | an implementation trusting Meta's template approval as sufficient safety for user-supplied variables | fails AT-TPL-5/6/7 — this is the brief's explicit "provider approval does not make variables safe" negative control | §3 |

## 13. Media — AT-MEDIA

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-MEDIA-1 | inbound media | ingest | admitted immediately, `fetch_status=pending`, not blocking | `B5_MEDIA_B11_HANDOFF.md` §3 |
| AT-MEDIA-2 | B11 fetch succeeds | observe | `file_asset_ref` populated, `fetch_status=stored` | §3 |
| AT-MEDIA-3 | temporary URL expires before fetch | observe | `fetch_status=expired`, surfaced, never silently hidden | §3 |
| AT-MEDIA-4 | outbound attachment | send | delegated to B11's `CreateUpload`, B5 never stores raw bytes itself | §1 |
| AT-MEDIA-5 **NC** | — | an implementation storing media bytes directly in a B5 table | fails `B5-D-A020` | — |

## 14. Consent — AT-CONSENT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONSENT-1 | recipient `opted_out` | `SendMessage` | `403 PERMISSION_DENIED`, `recipient_suppressed` | `B5-D-A017` |
| AT-CONSENT-2 | recipient `unknown` | `SendMessage` | permitted (default, pending `B5-X-018`) | `B5_CONSENT_COMMUNICATION_POLICY.md` §3 |
| AT-CONSENT-3 | inbound stop-keyword | ingest | `CommunicationConsent` row `opted_out`, `source=inbound_stop_keyword` | §4 |
| AT-CONSENT-4 | opted-out recipient, admin attempts send via `messaging.provider.manage` | `SendMessage` | still `403 PERMISSION_DENIED` — no privilege level overrides it | `B5-D-A017` |
| AT-CONSENT-5 **NC** | — | an implementation exposing any admin override flag that bypasses the opt-out check | this is the brief's explicit "opt-out cannot be bypassed by AI/automation/admin" negative control | `B5-D-A017` |

## 15. Policy (customer-service window) — AT-POL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-POL-1 | last inbound within window | evaluate | `FREE_FORM_ALLOWED` | `B5_CUSTOMER_SERVICE_WINDOW.md` §2 |
| AT-POL-2 | last inbound outside window | evaluate | `TEMPLATE_REQUIRED` | §2 |
| AT-POL-3 | `TEMPLATE_REQUIRED`, free-form attempted | `SendMessage` | `422`, `template_required`, no silent auto-conversion to a template | §3 |
| AT-POL-4 | no inbound history at all | evaluate | `UNKNOWN_REQUIRES_VALIDATION`, treated as `TEMPLATE_REQUIRED` | §3 |
| AT-POL-5 | window check vs. consent check ordering | trace admission | consent evaluated before window | `B5_OUTBOUND_PIPELINE.md` §2 |

## 16. Contact/phone — AT-CONTACT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONTACT-1 | phone in non-normalized form | any ingestion | normalized to E.164 before storage/lookup | `B5_CONTACT_PHONE_RESOLUTION.md` §1 |
| AT-CONTACT-2 | unnormalizable phone | outbound request | `422`, `invalid_phone_format` | §1 |
| AT-CONTACT-3 | B2 Contact phone changes | inspect existing Conversation | unaffected, keeps old key | §7 |
| AT-CONTACT-4 | same phone, two workspaces | resolve in each | two fully independent histories — actor-visible resolution outcome (contrast `AT-TEN-2`, which tests the same fact at the underlying query/schema-scoping level) | `B5-D-A031` |
| AT-CONTACT-5 **NC** | — | an implementation resolving a Contact by phone alone, without a `workspace_id` predicate | AT-CONTACT-4 fails | `B5-D-A031` |

## 17. Lead 360 — AT-L360

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-L360-1 | Lead has conversations | `GET /leads/{id}/conversations` | list returned, read-only, no message created | FB-24, `B5_B2_CRM_LEAD360_HANDOFF.md` §1 |
| AT-L360-2 | never-messaged Lead | same call | empty list, not an error | — |
| AT-L360-3 | Business converts to Lead | inspect | no B5 side effect fires | §3 |
| AT-L360-4 **NC** | — | an implementation copying `Message` content into a `leads`/`Lead360` column | fails `B5_B2_CRM_LEAD360_HANDOFF.md` §6 | — |

## 18. CRM timeline — AT-TL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TL-1 | inbound message received | inspect B5's exposed record | `source_event_id` present, stable, replay-safe | `B5-D-A023` |
| AT-TL-2 | three Messaging events on one Conversation | inspect | three distinct `source_event_id`s, `source_resource_ref` repeats | `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1 |
| AT-TL-3 | `delivered`/`read` transitions | check timeline eligibility | **not** timeline-eligible (§2's table) | `B5_CRM_TIMELINE_PROJECTION.md` §2 |
| AT-TL-4 | any timeline-eligible fact | inspect `summary` | template-generated, never `Message.body`/phone/email | §5 |
| AT-TL-5 | caller lacks `conversation.view` | request Lead timeline | messaging entries absent, no placeholder, no error | §6 |
| AT-TL-6 **NC** | — | an implementation writing a `crm_activities` row directly from a B5 command | fails `B5-D-A023` — this is the brief's explicit "no second CRM activity truth" negative control | — |
| AT-TL-7 **NC** | — | an implementation using `MSG-*`/`CONV-*` as the `entry_id` | violates B2's frozen rule that an aggregate's public ID is never an `entry_id` | `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1 |

## 19. B4 handoff — AT-B4

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B4-1 | B4 `Recommendation` exists | inspect | no field/flag admits a send | `B5-D-A021` |
| AT-B4-2 | Copilot-drafted reply inserted into composer | inspect | `senderType` remains `user`, `assistance` tag set | FB-30/FB-31 |
| AT-B4-3 | stale Copilot recommendation | attempt reply-insertion | blocked at the UI/API layer until re-analysis | FB-32 |
| AT-B4-4 **NC** | — | an implementation where a B4 run ID is accepted as a `SendMessage` authorization parameter | this is the brief's explicit "B4 recommendation cannot send directly" negative control | `B5-D-A021` |

## 20. B6 boundary — AT-B6

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B6-1 | any B5 command | search for a `DEAL-*`/stage write | none | `B5-D-A024` |
| AT-B6-2 | any B5 event | inspect | none implies a Deal outcome | `B5_B6_B7_BOUNDARIES.md` §1 |
| AT-B6-3 **NC** | — | an implementation where a Message-sent event auto-creates or auto-advances a Deal | fails `B5-D-A024` — this is the brief's explicit "B6 state cannot be mutated by B5" negative control | — |

## 21. B7 boundary — AT-B7

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B7-1 | a hypothetical future automation caller | `SendMessage` | passes through the identical admission sequence as a human actor | `B5-D-A025` |
| AT-B7-2 | automation attempts to bypass consent | `SendMessage` | still blocked at the consent gate | `B5_B6_B7_BOUNDARIES.md` §2 |
| AT-B7-3 **NC** | — | an implementation exposing a second "automation send" command/endpoint that skips any admission-sequence step | this is the brief's explicit "future B7 automation bypasses consent" negative control | `B5-D-A025` |

## 22. Entitlement — AT-ENT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-ENT-1 | provider not configured | `SendMessage` | `403`, `provider_not_configured`, before any provider call | `B5-D-A026` |
| AT-ENT-2 | provider configured, feature not entitled | `SendMessage` | `403 ENTITLEMENT_LOCKED` | §5 |
| AT-ENT-3 | all five gates independently toggled | matrix test | each gate alone can block; none is redundant with another | `B5_ENTITLEMENT_RBAC_TENANCY.md` §5 |
| AT-ENT-4 **NC** | — | an implementation trusting a client-supplied `can_send` boolean | fails AT-ENT-1/2 — no such flag is ever trusted server-side | — |

## 23. RBAC — AT-RBAC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RBAC-1 | `viewer`-equivalent (`conversation.view` only) | `GET` conversations | allowed | `B5_ENTITLEMENT_RBAC_TENANCY.md` §1 |
| AT-RBAC-2 | `conversation.view` only | `SendMessage` | `403` | §1 |
| AT-RBAC-3 | `sales`, own-assigned Conversation | `AssignConversation`(re-assign)/`Archive` | allowed | §2 |
| AT-RBAC-4 | `sales`, colleague's Conversation | same actions | `403` | §2 |
| AT-RBAC-5 | `message.send` only | `UpdateProviderConfiguration` | `403` — credential handling needs `messaging.provider.manage` | §1 |
| AT-RBAC-6 **NC** | — | an implementation letting `message.send` also grant provider configuration | fails AT-RBAC-5 | `B5-D-A034` |

## 24. Tenancy — AT-TEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TEN-1 | every persisted table | inspect schema | `workspace_id` present, no exception | `B5_ENTITLEMENT_RBAC_TENANCY.md` §6 |
| AT-TEN-2 | identical phone in two workspaces | operate at the **row/table-scoping level** (every query predicate) in each | zero shared state at the schema/lookup-key level — this is the general tenancy-isolation test, applicable to any B5 table; contrast `AT-CONTACT-4`, which tests the same fact at the **Conversation/Contact-resolution outcome** level (does the actor-visible result cross-link), not the underlying query scoping | §7 |
| AT-TEN-3 | cross-workspace `GET /conversations/{id}` | attempt | `404`, indistinguishable from non-existent — this is the **tenancy-invariant** framing (every table's `workspace_id` predicate is enforced); contrast `AT-API-2` (the concrete HTTP/DTO-contract-level assertion for this specific endpoint) and `AT-SEC-2` (the general security-threat-model statement covering any ID type, not just Conversation) | §7 |
| AT-TEN-4 | same provider `provider_message_id` under two different `ChannelBinding`s | inspect | not conflated — uniqueness is per-binding | `B5-D-A032` |
| AT-TEN-5 **NC** | — | an implementation with any cache keyed on phone/provider-message-ID alone, no workspace/binding component | fails AT-TEN-2/4 — this is the brief's explicit cross-workspace-collision negative control | — |
| AT-TEN-6 **NC** | — | an implementation resolving a `ChannelBinding` (credentials, `phone_number_id`, webhook secret) with no `workspace_id` predicate applied first — e.g. a lookup keyed only on `phone_number_id` without also verifying the result's `workspace_id` matches the caller's, or a credential cache shared across workspaces | this is the brief's explicit "provider credential/channel binding cannot cross workspace boundaries" negative control — fails `B5_PROVIDER_CONFIGURATION_MODEL.md` §8's "no code path reads a `ChannelBinding` without a `workspace_id` in scope" | `B5-D-A012`, `B5_PROVIDER_CONFIGURATION_MODEL.md` §8 |

## 25. Rate — AT-RATE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RATE-1 | workspace at 299 admissions this hour | 300th request | admitted | `B5-D-A028` |
| AT-RATE-2 | workspace at 300 admissions | 301st request | `429`, `messaging_rate_limited`, before any provider call | §2 |
| AT-RATE-3 | rate-limited request | inspect | consent/window checks still ran first, in order | `B5_OUTBOUND_PIPELINE.md` §2 |
| AT-RATE-4 **NC** | — | an implementation with no workspace/hour admission limiter at all | this is the brief's explicit "unbounded provider spend" negative control | `B5-D-A028` |

## 26. Retry — AT-RETRY

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RETRY-1 | provider call fails transiently | observe | retried automatically ≤3 times total | `B5-D-A027` |
| AT-RETRY-2 | validation failure (bad request) | observe | not retried automatically | `B5_RATE_COST_RETRY_MODEL.md` §3 |
| AT-RETRY-3 (`DOCUMENT_CONSISTENCY`, not a runtime test) | retry ceiling documentation | inspect `B5_RATE_COST_RETRY_MODEL.md` §4 | states the ceiling is B5-owned, layered under B0's higher generic ceilings — never claims the number derives from B0's literal ceiling | `B5-D-A027` |
| AT-RETRY-4 **NC** | — | an implementation letting a B5 provider call fall back to B0's generic 5/6-attempt ceiling | exceeds `MAX_SEND_ATTEMPTS_PER_MESSAGE=3` — fails `B5-D-A027` | — |

## 27. Cost — AT-COST

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-COST-1 | `queued` Message cancelled | inspect workspace admission counter | **not** decremented/refunded | `B5_RATE_COST_RETRY_MODEL.md` §6 |
| AT-COST-2 | `cost_units` unknown from adapter | inspect | `null`, never defaulted to `0` | §7 |
| AT-COST-3 | repeated `send → cancel → send` cycling | observe | each `send` still consumes an admission slot; no free cycling emerges | §6 |
| AT-COST-4 **NC** | — | an implementation refunding the admission counter on cancellation | this is the brief's explicit "cancellation refund creates a spend loop" negative control | `B5-D-A027` |

## 28. Reconciliation — AT-RECON

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RECON-1 | Message stuck `submitted` past the bounded window | reconciliation runs | resolves to `sent` (mapping found) or `failed` (`ambiguous_unconfirmed`) | `B5_RECONCILIATION_OBSERVABILITY.md` §3 |
| AT-RECON-2 | reconciliation re-run on an already-resolved case | run again | idempotent, no change | §3 |
| AT-RECON-3 | template status drift detected | trigger | targeted re-sync of that specific template | `B5_TEMPLATE_MODEL.md` §7 |
| AT-RECON-4 **NC** | — | an implementation polling indefinitely with no bounded window | fails the "bounded" property | §3 |

## 29. Observability — AT-OBS

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OBS-1 | any completed send | trace `status → MessageDelivery[] → provider_metadata → admission decision` | every link resolvable from stored fields | `B5_RECONCILIATION_OBSERVABILITY.md` §5 |
| AT-OBS-2 | metric labels | inspect | closed enums/identifiers only, no secret, no body | §1 |
| AT-OBS-3 | operator diagnostic access | inspect | `provider_request_id` reachable only at the operator surface, audited on access | `B5_ENTITLEMENT_RBAC_TENANCY.md` §4 |

## 30. Security — AT-SEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SEC-1 | any API response | inspect | no `ChannelBinding` secret field ever present | `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §1 |
| AT-SEC-2 | cross-workspace ID guess, any B5 ID type (`CONV-*`/`MSG-*`/`TPL-*`, not only Conversation) | attempt | `404`, indistinguishable from non-existent — the general IDOR-threat-class statement; contrast `AT-TEN-3` (the tenancy-invariant framing) and `AT-API-2` (the concrete single-endpoint contract test) | §2 item 1–2 |
| AT-SEC-3 | inbound text containing adversarial instructions | ingest, later consumed by a hypothetical AI feature | stored as inert data; never interpolated into a prompt's instruction channel | §2 item 10 |
| AT-SEC-4 **NC** | — | an implementation returning a distinguishable error for "exists in another workspace" vs. "does not exist" | fails AT-SEC-2 | — |

## 31. Privacy — AT-PRIV

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PRIV-1 | any log line | inspect | no message body, no media bytes, no secret | `B5_SECURITY_PRIVACY_THREAT_MODEL.md` §4 |
| AT-PRIV-2 | any timeline entry | inspect | no phone, no email, no body (§`B5_CRM_TIMELINE_PROJECTION.md` §5) | — |
| AT-PRIV-3 **NC** | — | an implementation logging the full webhook payload at debug level | this is the brief's explicit "provider secret never appears in response/log/event" negative control, extended to bodies | — |

## 32. API — AT-API

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-API-1 | no messages yet | `GET /conversations/{id}/messages` | `200`, empty list, not an error | `B5_API_DTO_CONTRACTS.md` §1.6 |
| AT-API-2 | foreign-workspace Conversation ID | `GET /conversations/{id}` specifically | `404` — the concrete single-endpoint HTTP contract test (contrast `AT-TEN-3`/`AT-SEC-2`'s broader framings of the identical underlying invariant) | §1.5 |
| AT-API-3 | `POST /messages/{id}/cancel`, stale `version` | submit | `409 STALE_VERSION` | §1.3 |
| AT-API-4 | any response DTO | inspect | `additionalProperties: false` | frozen DTO discipline |
| AT-API-5 **NC** | — | an implementation echoing a secret field on `PUT /messaging/provider/configuration`'s response | fails `B5_API_DTO_CONTRACTS.md` §4 | — |

## 33. DTO — AT-DTO

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DTO-1 | `Message` with `content_type=text` | inspect | `template_snapshot`/`media` both null | `B5_API_DTO_CONTRACTS.md` §3 |
| AT-DTO-2 | `Message` with `content_type=template` | inspect | `template_snapshot` present, `body`/`media` null | §3 |
| AT-DTO-3 | `ProviderConfigurationStatus` | inspect | no field named/shaped like a secret | §3 |

## 34. Event — AT-EVT

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EVT-1 | outbound Message reaches `sent` | inspect outbox | `MessageSent` emitted once | `B5_COMMAND_EVENT_CATALOG.md` §3 |
| AT-EVT-2 | `queued→submitted`/`delivered→read` transitions | search outbox | no event published for either | §3 |
| AT-EVT-3 | any B5 event | inspect envelope | matches the frozen B0 sentence verbatim | §5 |
| AT-EVT-4 | any B5 event | inspect | `CONSUMED_EVENT_COUNT` referenced by any B5 handler | `0` |

## 35. Amendment — AT-AMEND (`DOCUMENT_CONSISTENCY`)

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-AMEND-1 | `B5_CONTROLLED_AMENDMENTS.md` bundle | inspect | every item traces to a Class A decision | `B5_CONTROLLED_AMENDMENTS.md` §3 |
| AT-AMEND-2 | `TPL-` prefix proposal | check against `BACKEND_PUBLIC_ID_REGISTRY.md` | no collision in Section A, B, or C | §1 item 5 |
| AT-AMEND-3 | `conversation.view`/`message.send` reuse (`B5-FIX.1`) | check against `B1_AUTHORIZATION_RBAC.md` §2–§3 directly | both names and both role matrices match frozen B1 exactly — neither is re-defined, re-keyed, or supplemented with an undeclared condition | §1 item 4 |

## 36. External validation — AT-EXT (`EXTERNAL_VALIDATION_GATE`)

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EXT-1 | any `B5-X-*` item | inspect | isolated behind an adapter or config value, no domain table/DTO depends on its answer | `B5_WHATSAPP_EXTERNAL_VALIDATION_REGISTER.md` |
| AT-EXT-2 **NC** | — | an implementation hard-coding a specific customer-service-window duration into domain logic instead of `B5-X-010`-sourced configuration | fails `B5_CUSTOMER_SERVICE_WINDOW.md` §2 | — |

## 37. Counts

```
ACCEPTANCE_TEST_COUNT = 179   (corrected from 176 by B5-FIX.1 — three new NC rows added:
                                AT-DOM-5, AT-WH-7, AT-TEN-6)
ACCEPTANCE_CATEGORY_COUNT = 36   (unchanged — no new category, only new rows in existing ones)
DUPLICATE_ACCEPTANCE_TESTS = 0
Negative controls = 37   (corrected from 34 by B5-FIX.1)
```

Recomputed mechanically (`grep -c` over `^\| AT-` rows, `**NC**` markers within rows, and `##` category headings — the `## 37. Counts` summary section itself is excluded from the category count).

**`B5-FIX.1` changelog:** added `AT-DOM-5` (Message/messaging event cannot create RevenueEvent — `NC-1`), `AT-WH-7` (duplicate provider callback cannot duplicate Message — `NC-2`), `AT-TEN-6` (provider credential/channel binding cannot cross workspace — `NC-3`); none of the three replaces or removes an existing test. Reconciled `AT-RBAC-5`/`AT-RBAC-6` and `AT-AMEND-3` to the corrected `conversation.view`/`message.send` reuse. Differentiated four near-duplicate pairs the independent audit flagged (`AT-WH-5`/`AT-IDEM-3`, `AT-TEN-2`/`AT-CONTACT-4`, `AT-SEC-2`/`AT-API-2`/`AT-TEN-3`, `AT-STATE-7`/`AT-STAT-3`) so each row's observable assertion is now explicit about which layer/framing it tests, rather than silently restating a sibling row — none was deleted. Labeled the `AT-DOM`, `AT-AMEND`, and `AT-EXT` categories, and `AT-RETRY-3` individually, with their test kind (`STATIC_ARCHITECTURE`/`DOCUMENT_CONSISTENCY`/`EXTERNAL_VALIDATION_GATE`) so they are not misrepresented as runtime E2E behavior.

Every Class A decision in `B5_DECISION_REGISTER.md` §1, every failure scenario in `B5_FAILURE_SCENARIOS.md`, and every frontend behavior classified `A` in `B5_FRONTEND_TRACEABILITY_MATRIX.md` maps to at least one row above.
