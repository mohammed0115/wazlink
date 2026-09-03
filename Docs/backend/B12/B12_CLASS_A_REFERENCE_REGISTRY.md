# B12 — Class-A Reference Registry

> Every frozen fact B12 depends on, with an exact location and the quoted or precisely paraphrased dependency. No entry says "according to B5." `CLASS_A_UNRESOLVED = 0`.

## Method

Each row states: the frozen artifact · its exact location · the fact B12 relies on · the B12 artifact that consumes it · whether B12 **reuses**, **realizes**, **honors a deferral**, or **amends** it. A row is `UNRESOLVED` only if B12's Phase-1 design cannot proceed without an answer it does not have; there are none.

| # | Frozen artifact | Location | Frozen fact B12 depends on | B12 consumer | Treatment |
|---:|---|---|---|---|---|
| 1 | `BACKEND_ARCHITECTURE_DECISIONS.md` | line 18 | *"Redis is limited to broker/cache/short-lived lock duties and is never canonical storage."* | `B12_REDIS_BOUNDARY.md` §1 | **reused verbatim** as `B12-D-A014`'s charter |
| 2 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-004 | Celery selected; *"Kafka and alternative worker frameworks are not justified for Phase 1."* | `B12_QUEUE_TOPOLOGY.md` §5 | **honored** — no second broker |
| 3 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-005 sentence 1 | *"Transactional domain changes and an `OutboxEvent` commit in one transaction."* | `B12_OUTBOX_MODEL.md` §1 | **realized** as `B12-D-A006` |
| 4 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-005 sentence 2 | *"A dispatcher publishes internal work to Celery."* | `B12_OUTBOX_MODEL.md` §3 | realized |
| 5 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-005 sentence 3 | *"External callbacks first enter `WebhookReceipt` and are deduplicated before async processing."* | `B12_WEBHOOK_GATEWAY.md` §1 | realized |
| 6 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 28 | Webhooks row, forbidden coupling **"no direct domain mutation"** | `B12_DOMAIN_FIREWALLS.md` §0 | **reused as charter** |
| 7 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 28 | commands `ReceiveWebhook`, `RetryWebhook`; event `WebhookProcessed` | `B12_COMMAND_EVENT_CATALOG.md` §1-§2 | **names reused verbatim** |
| 8 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 29 | Jobs row, forbidden coupling **"no domain ownership"** | `B12-D-A002` | **reused as charter** |
| 9 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 29 | aggregate `WorkerExecution`; commands `SubmitJob`, `RetryJob`; events `JobSucceeded`/`JobFailed` | `B12_COMMAND_EVENT_CATALOG.md` §1-§2 | **names reused verbatim** |
| 10 | `BACKEND_DOMAIN_OWNERSHIP.md` | "Ownership principles" | *"ORM imports across bounded contexts are not permitted in domain code"* | `B12_DOMAIN_FIREWALLS.md` §0 | honored |
| 11 | `BACKEND_DATA_MODEL.md` | line 26 | *"provider/dedup key unique; payload hash index"* | `B12_DATA_MODEL.md` §2 | **honored verbatim** as two constraints |
| 12 | `BACKEND_DATA_MODEL.md` | line 27 | tables `outbox_events`, `worker_executions`; *"dispatch/status/time"* | `B12_DATA_MODEL.md` §1, §3 | table names reused; three indexes satisfy the note |
| 13 | `BACKEND_DATA_MODEL.md` | line 10 | webhook receipts *"append-oriented and are not casually deleted"* | `B12_DATA_MODEL.md` §2 | honored — no sweep prunes receipts |
| 14 | `BACKEND_DATA_MODEL.md` | line 10 | UUIDv7 `id`, prefixed `public_id`, UTC timestamps, `workspace_id` on tenant-owned records | `B12_DATA_MODEL.md` §0 | inherited |
| 15 | `BACKEND_STATE_MACHINES.md` | WebhookReceipt sentence | *"WebhookReceipt is `received→verified→queued→processed/failed/duplicate`."* | `B12_STATE_MACHINES.md` §2 | **six states adopted unchanged** |
| 16 | `BACKEND_INTEGRATION_BOUNDARIES.md` | line 17 | `WebhookGateway`: *"verify, receipt, hash, deduplicate, enqueue, fast acknowledge"* | `B12_WEBHOOK_GATEWAY.md` §1 | realized clause by clause |
| 17 | `BACKEND_INTEGRATION_BOUNDARIES.md` | lines 8-19 | eleven port names and directions | `B12_PROVIDER_PORT_ARCHITECTURE.md` §1 | **all reused verbatim**, none renamed |
| 18 | `BACKEND_INTEGRATION_BOUNDARIES.md` | `JobQueue` row | Redis/Celery is *"not canonical data"* | `B12_REDIS_BOUNDARY.md` §3 | honored |
| 19 | `BACKEND_INTEGRATION_BOUNDARIES.md` | AI row | *"no direct vendor calls from domains"* | `B12_DOMAIN_FIREWALLS.md` §2 | honored |
| 20 | `BACKEND_INTEGRATION_BOUNDARIES.md` | Tap row | *"webhook-first truth, reconciliation"* | `B12_DOMAIN_FIREWALLS.md` §5 | honored |
| 21 | `BACKEND_INTEGRATION_BOUNDARIES.md` | "Provider lifecycle" | eight adapter obligations | `B12_PROVIDER_PORT_ARCHITECTURE.md` §5 | each bound to an artifact |
| 22 | `BACKEND_INTEGRATION_BOUNDARIES.md` | "Provider lifecycle" | *"Raw payload retention is restricted and time-bounded"* | `B12_WEBHOOK_GATEWAY.md` §7 | honored; duration deferred (`B12-D-B004`) |
| 23 | `BACKEND_INTEGRATION_BOUNDARIES.md` | "Provider lifecycle" | *"Provider callbacks never directly mutate business aggregates outside an application service"* | `B12-D-A002` | **load-bearing** |
| 24 | `BACKEND_INTEGRATION_BOUNDARIES.md` | closing | email/Gmail/Calendar/FCM *"optional/deferred and are not Phase 1 dependencies"* | `B12-D-B010` | deferral honored |
| 25 | `BACKEND_RETRY_POLICY.md` | standard paragraph | backoff `base·2^(attempt-1)` with full jitter, 15m/60m caps, default max 5, then `dead_lettered` + alert | `B12_RETRY_BACKOFF_MODEL.md` §3 | **reused verbatim** |
| 26 | `BACKEND_RETRY_POLICY.md` | class table | nine classes with retry/max/terminal | `B12_RETRY_BACKOFF_MODEL.md` §2 | **reused verbatim**, no row added |
| 27 | `BACKEND_RETRY_POLICY.md` | closing | *"Workers must use timeouts, heartbeats, and dead-letter records"* | `B12_DEAD_LETTER_REPLAY_MODEL.md` §1 | **realized** — the justification for a durable table |
| 28 | `BACKEND_RETRY_POLICY.md` | closing | *"it must not replay an irreversible side effect blindly"* | `B12-D-A020` | **load-bearing** |
| 29 | `BACKEND_TIMEOUT_POLICY.md` | table | eight connect/request/job rows | `B12_CELERY_EXECUTION_MODEL.md` §6 | **reused verbatim** |
| 30 | `BACKEND_TIMEOUT_POLICY.md` | closing | *"Timeouts produce typed retryable errors, never indefinite worker execution."* | `B12_OUTBOUND_HTTP_POLICY.md` §2 | honored |
| 31 | `BACKEND_IDEMPOTENCY_STANDARD.md` | platform standard | key scope, 24h/7d retention, `IDEMPOTENCY_CONFLICT` | `B12_IDEMPOTENCY_MODEL.md` class 1 | **reused unchanged** |
| 32 | `BACKEND_IDEMPOTENCY_STANDARD.md` | worker paragraph | *"Worker execution is idempotent by `(command_id, effect_type)` and checks the target version/state before side effects."* | `B12_CELERY_EXECUTION_MODEL.md` §5 | realized |
| 33 | `BACKEND_IDEMPOTENCY_STANDARD.md` | provider paragraph | *"Provider requests use provider-specific keys derived from the internal idempotency record"* | `B12_IDEMPOTENCY_MODEL.md` §3 | honored, with the evidence caveat of `B12-D-A012` |
| 34 | `BACKEND_IDEMPOTENCY_STANDARD.md` | UpgradeQuote paragraph | *"protected by PostgreSQL, not by a Redis lock"* | `B12_CONCURRENCY_MODEL.md` §1 | **generalized to all nine classes** |
| 35 | `BACKEND_RATE_LIMIT_POLICY.md` | closing | *"Quota enforcement remains transactional and authoritative in PostgreSQL; Redis counters are acceleration/abuse controls, not the source of truth."* | `B12-D-A015` | **load-bearing** |
| 36 | `BACKEND_RATE_LIMIT_POLICY.md` | table | eight rows incl. *"Webhooks \| provider-specific burst protection"* | `B12_RATE_LIMIT_BACKPRESSURE.md` §2 | reused; one row added (`B12-AM-008`) |
| 37 | `BACKEND_RECONCILIATION.md` | doctrine | *"Repairs are explicit, permissioned, idempotent, and audited… must not guess or overwrite a newer authoritative provider state without a documented precedence rule."* | `B12_RECONCILIATION_MODEL.md` §1 | **reused verbatim**; precedence rule supplied |
| 38 | `BACKEND_RECONCILIATION.md` | table | eight domain processes, each with a repair authority | `B12_RECONCILIATION_MODEL.md` §2 | **not absorbed**; one platform row added |
| 39 | `BACKEND_ERROR_CATALOG.md` | code table | `PROVIDER_UNAVAILABLE`, `PROVIDER_RATE_LIMITED`, `WEBHOOK_INVALID_SIGNATURE`, `WEBHOOK_DUPLICATE`, `CONFLICT`, `STALE_VERSION`, `IDEMPOTENCY_CONFLICT`, … | `B12_ERROR_TAXONOMY.md` §1 | **14 reused**, 1 added |
| 40 | `BACKEND_PUBLIC_ID_REGISTRY.md` | section A | `WHR-` → WebhookReceipt, *"Global by provider/event identity"* | `B12_DATA_MODEL.md` §2 | reused verbatim |
| 41 | `BACKEND_PUBLIC_ID_REGISTRY.md` | section B preamble | *"A relational fixture shape alone does not justify a persistent resource"* | `B12-AM-010`, `FB-B12-002`, `FB-B12-011` | **honored** — `INT-` is justified by an API resource, not by the fixture alone; `mock_connected` and the integrity report are refused |
| 42 | `BACKEND_API_CATALOG.md` | line 43 | *"Provider webhooks are internal gateway routes and are not user-facing resource mutations."* | `B12_API_DTO_CONTRACTS.md` §2 | honored |
| 43 | `BACKEND_API_CATALOG.md` | line 47 | *"internal provider webhook routes remain outside this user-facing catalog"* | `B12_API_DTO_CONTRACTS.md` §2 | honored — 3 routes uncounted |
| 44 | `BACKEND_API_STANDARD.md` | line 53 | filtering/sorting only on `GET /deals` and `GET /billing/invoices` | `B12_API_DTO_CONTRACTS.md` §1 | honored — no marker added |
| 45 | `BACKEND_API_STANDARD.md` | line 16 | verbatim: *"`502` provider translation only on provider-dependent operations"*, and *"A local invoice read does not return `402` or `502`."* | `B12_API_DTO_CONTRACTS.md` §5 | honored — 3 of 14 |
| 46 | `BACKEND_SECURITY_ARCHITECTURE.md` | line 12 | *"Provider URL fetches use strict allowlists and SSRF defenses; redirects are not trusted for payment truth"* | `B12_SECURITY_PRIVACY.md` §1 threat 9 | honored — B12 exposes no fetcher |
| 47 | `BACKEND_SECURITY_ARCHITECTURE.md` | line 14 | *"Webhook signatures are verified before persistence/dispatch, with replay protection and **provider-specific deduplication**"* | `B12-D-A030` | **load-bearing** — "provider-specific" is the frozen word the research vindicated |
| 48 | `BACKEND_DATA_GOVERNANCE.md` | — | *"Database constraints and `transaction.atomic` are preferred before distributed locks"* | `B12_CONCURRENCY_MODEL.md` §1 | honored |
| 49 | `BACKEND_TEST_STRATEGY.md` | line 12 | mandatory security tests incl. webhook signature/replay, idempotency conflict, SSRF, cross-workspace | `B12_ACCEPTANCE_TESTS.md` | instances supplied; **no new category** |
| 50 | `BACKEND_OPERATIONS_OBSERVABILITY.md` | alerting | "storage failures", "cross-workspace authorization errors", "quota ledger divergence", "dead letters" page-worthy | `B12_OBSERVABILITY_HANDOFF.md` §4 | bound to concrete signals |
| 51 | `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | classification | private-communications and Contact-PII classes | `B12_SECURITY_PRIVACY.md` §5 | most restrictive applied uniformly |
| 52 | `BACKEND_FAILURE_MATRIX.md` | provider/webhook/worker rows | frozen failure classes | `B12_FAILURE_CATALOG.md` | realized, not contradicted |
| 53 | `B0_BACKEND_BLUEPRINT.md` | app layout | `webhooks/`, `jobs/common` reserved | `B12_IMPLEMENTATION_HANDOFF.md` §2 | confirmed; no new path invented |
| 54 | `B1_AUTHORIZATION_RBAC.md` | §2 line 76 | Settings family contains `integration.manage` | `B12_RBAC_TENANCY.md` §1 | **reused verbatim** |
| 55 | `B1_AUTHORIZATION_RBAC.md` | §3 line 131 | `integration.manage` row `A/A/C/·/·/·`, condition *"secret access never returned to client"* | `B12_RBAC_TENANCY.md` §2, `B12-D-A042` | **reproduced unchanged**; the condition is load-bearing |
| 56 | `B1_AUTHORIZATION_RBAC.md` | §2 namespace rule | permissions `<resource>.<imperative>`, audit `<resource>.<past participle>` | `B12_COMMAND_EVENT_CATALOG.md` §5 | honored |
| 57 | `B1_API_DTO_CONTRACTS.md` | line 308 | the **closed** `CONFLICT` reason vocabulary | `B12-AM-005` | extended additively |
| 58 | `BACKEND_AUTHORIZATION_MATRIX.md` | action matrix | *"Admin… cannot bypass financial audit or tenant isolation"* | `B12_RBAC_TENANCY.md` §2 | the basis of the replay conditional cell |
| 59 | `B3_DECISION_REGISTER.md` | `B3-D-A031` | `MAX_JOB_ATTEMPTS = 3`, *"an architectural safety bound, not configuration"* | `B12_RETRY_BACKOFF_MODEL.md` §1 | **never touched** |
| 60 | `B3_DECISION_REGISTER.md` | `B3-D-A032` | `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`, admission-time, idempotent-safe | `B12-D-A015` | must be PostgreSQL-durable |
| 61 | **`B3_DECISION_REGISTER.md`** | **`B3-D-A031`** | **verbatim source** of: *"Automatic transient retry (frozen B0's per-call backoff/attempt mechanics) is a distinct, unrelated counter: it never increments `attempt_no` and never creates a new Job attempt."* | `B12-D-A017` | **ratified**, not reinterpreted |
| 61a | `B3_RETRY_FAILURE_MODEL.md` | §1 | **supporting substantive evidence** for row 61, in that document's own words: *"The automatic transient retries this document classifies happen inside one Job attempt and never open a new one"*, and *"`attempt_no` advances only on an actor's explicit retry, never automatically."* It is the document `B3-D-A031` cross-references, **not** the one containing that sentence | `B12_RETRY_BACKOFF_MODEL.md` §1 | honored |
| 62 | `B3_DISCOVERY_BLUEPRINT.md` | `B3-INV-11` | every provider path bounded; 50×5=250 per attempt | `B12_RATE_LIMIT_BACKPRESSURE.md` §3 | fan-out never widened |
| 63 | `B4_COST_RATE_LIMIT_MODEL.md` | logical/provider budgets | B4 owns its call budgets | `B12_DOMAIN_FIREWALLS.md` §2 | never exceeded by transport retry |
| 64 | `B5_WEBHOOK_SECURITY_MODEL.md` | §1 | layered ownership: generic receipt vs. WhatsApp-specific verification | `B12_WEBHOOK_GATEWAY.md` §1 | **generalized, not overridden** |
| 65 | `B5_WEBHOOK_SECURITY_MODEL.md` | §2 | `GET` handshake: `hub.mode`, `hub.verify_token` constant-time, echo `hub.challenge`, `403` on mismatch | `B12_WEBHOOK_GATEWAY.md` §5 | routed; B5 keeps semantics |
| 66 | `B5_WEBHOOK_SECURITY_MODEL.md` | §3 (`B5-D-A010`) | *"every inbound webhook POST is signature-verified before any business processing… There is no 'verify later' path."* | `B12-D-A027` | **generalized to every provider** |
| 67 | `B5_WEBHOOK_SECURITY_MODEL.md` | §3 | raw-bytes signature basis; re-serialization invalidates it | `B12_WEBHOOK_SECURITY.md` §2 | kept as the stricter reading (`B12-X-014` PARTIAL) |
| 68 | `B5_WEBHOOK_SECURITY_MODEL.md` | §4 (`B5-D-A011`) | workspace resolution comes only from the verified binding | `B12-D-A031` | **generalized** |
| 69 | `B5_WEBHOOK_SECURITY_MODEL.md` | §5 (`B5-D-A013`) | two dedup layers solving different problems | `B12_WEBHOOK_DEDUP_ORDERING.md` §1 | ratified |
| 70 | `B5_WEBHOOK_SECURITY_MODEL.md` | §6-§7 | malformed and unsupported payloads acknowledged `200` with zero effect | `B12_WEBHOOK_GATEWAY.md` §4 | generalized |
| 71 | `B5_WEBHOOK_SECURITY_MODEL.md` | §10 | replay defence is idempotency, not signature freshness | `B12_WEBHOOK_SECURITY.md` §4 | ratified |
| 72 | `B5_MESSAGE_STATE_MACHINE.md` | §4 | status monotonicity `(message_id, status_value, provider_timestamp)` | `B12-D-A033` | **B5 keeps ordering authority** |
| 73 | `B5_ADMIN_PROVIDER_RUNBOOK.md` | §disable | *"disabling the provider pauses WazLink's own outbound capability, not Meta's inbound delivery"* | `B12-D-A028` | **generalized** |
| 74 | `B5_ADMIN_PROVIDER_RUNBOOK.md` | §rotation | *"The prior credential reference is invalidated, not merely superseded."* | `B12_PROVIDER_CONFIGURATION_MODEL.md` §7 | generalized |
| 75 | `B5_PROVIDER_CONFIGURATION_MODEL.md` | §4 | safe check = token validity, phone/WABA match, scope | `B12-D-A035` | the template |
| 76 | `B5_CONSENT_COMMUNICATION_POLICY.md` | §43 | no field, permission, or command admits a send to an `opted_out` recipient *"at any privilege level"* | `B12_DOMAIN_FIREWALLS.md` §3 | **no B12 replay creates a second send path** |
| 77 | `B7_DATA_MODEL.md` | §6 | `automation_inbox_records` `UNIQUE (workspace_id, source_event_id)`, *"distinct from … `WHR-*`"* | `B12-D-A008`, `B12-D-A009` | **the inbox split, ratified** |
| 78 | `B7_DECISION_REGISTER.md` | `B7-D-A040` | event-run dedup identity excludes `rule_revision_id` | `B12_INBOX_MODEL.md` §4 | not centralized |
| 79 | `B7_B12_ASYNC_BOUNDARY.md` | whole | event delivery + liveness reconciliation only; the wakeup sweep is *"removed, not deferred to a footnote"* | `B12_DOMAIN_FIREWALLS.md` §4 | **honored literally** |
| 80 | `B8_CHECKOUT_PAYMENT_MODEL.md` | §redirect (`B8-X-011`) | *"the redirect alone does not prove payment success… must make a `/charge` request"* | `B12_UNKNOWN_OUTCOME_MODEL.md` §2 | corroborated by `B12-X-008` |
| 81 | `B8_CHECKOUT_PAYMENT_MODEL.md` | §flow | `PaymentSucceeded`/`SubscriptionActivated` produced **exclusively** by B8 commands | `B12_DOMAIN_FIREWALLS.md` §5 | **load-bearing** |
| 82 | `B8_CHECKOUT_PAYMENT_MODEL.md` | `billing_customers` | webhook workspace resolution by `provider_customer_ref`, *"never by trusting a `workspace_id` embedded in the provider payload"* | `B12-D-A031` | ratified |
| 83 | `B8_B12_ASYNC_BOUNDARY.md` | §1-§2 | B12 owns *"the generic scheduler/queue mechanics"*; B8 owns the business semantics | `B12_SCHEDULING_MODEL.md` §1 | **the split implemented** |
| 84 | `B8_WEBHOOK_MODEL.md` | §3 | a receipt resolving to zero or several workspaces is quarantined and alerted, *"never guessed"* | `B12_WEBHOOK_SECURITY.md` §3 | generalized |
| 85 | `B9_B12_ASYNC_BOUNDARY.md` | §1 | *"B9's financial write paths are entirely synchronous… No revenue is ever created by a worker"* | `B12-D-A005` | **honored — no async path into B9** |
| 86 | `B9_B12_ASYNC_BOUNDARY.md` | §21 | no timer-driven financial action | `B12_SCHEDULING_MODEL.md` §2 | honored |
| 87 | `B10_DECISION_REGISTER.md` | `B10-D-B001` | ZATCA artifact format gated; B10 dormant | `B12-D-B006` | deferral honored |
| 88 | `B10_*` | `B10-D-A019` | provider fail-closed doctrine: an unrecognized status is never optimistically success | `B12-D-A023` | generalized |
| 89 | `B11_STORAGE_PROVIDER_BOUNDARY.md` | §3 | four error classes before crossing the boundary | `B12-D-A023` | **generalized to every provider** |
| 90 | `B11_STORAGE_PROVIDER_BOUNDARY.md` | §4 | *"For any operation classified `unknown`, the next step is `stat_object`, not a blind repeat."* | `B12-D-A020` | **generalized to every provider** |
| 91 | `B11_STORAGE_PROVIDER_BOUNDARY.md` | §2 | `delete_object` is idempotent by port contract | `B12_UNKNOWN_OUTCOME_MODEL.md` §2 | consumed |
| 92 | `B11_B12_ASYNC_BOUNDARY.md` | §1 | *"B11's user-facing write paths are entirely synchronous"* | `B12-D-A005` | honored |
| 93 | `B11_B12_ASYNC_BOUNDARY.md` | §5 | five negative controls, incl. no lifecycle change from a purge-worker failure | `B12_DOMAIN_FIREWALLS.md` §8 | satisfied |
| 94 | `B11_RESEARCH_REGISTER.md` | `B11-X-007` | storage provider capabilities UNRESOLVED | `B12-X-015` | **inherited, not re-opened** |

`CLASS_A_REFERENCE_COUNT = 95`. `CLASS_A_UNRESOLVED = 0`. `SEMANTICALLY_WRONG_CLASS_A_REFS = 0`.

**B12-FIX.1 corrected two locations and added one row.** Row 45's quotation marks previously wrapped a *paraphrase*; it now carries the frozen sentence verbatim from its real line. Row 61 previously attributed a verbatim quote to `B3_RETRY_FAILURE_MODEL.md` §1 — the document `B3-D-A031` *cross-references* — rather than to `B3_DECISION_REGISTER.md`, which actually contains it. The dependency was always sound and semantically correct; the *location* was not, and this registry promises an exact location. Row 61a now records the supporting document in its own right, which is why the count moves 94 → 95.

## Why zero unresolved

Every row above is one of four things: a fact **reused verbatim**, a requirement **realized** by a named B12 artifact, a **deferral honored** as the frozen phase stated it, or a change **covered by a listed controlled amendment**. None is an open question B12's Phase-1 design waits on. The four genuinely open external questions in this pack (`B12-X-010`…`013`) are **provider capabilities**, not frozen contracts — they live in `B12_PROVIDER_RESEARCH_REGISTER.md`, they are all rated `UNRESOLVED`, and the design was built not to need any of them (`B12-D-A012`, `B12-D-A024`).
