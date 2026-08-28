# WazLink Backend Integration Boundaries

> Architecture only. Provider adapters, credentials, calls, and deployment are not implemented in B0.

## Boundary rule

Domain modules depend on stable internal ports and normalized DTOs. Only integration adapters know vendor SDKs, authentication, provider status vocabulary, pagination, rate limits, and raw payload shape. Adapters return typed success/error results and attach request ID, provider request ID, cost metadata, and retry classification.

| Provider | Internal port | Inbound/outbound | Canonical boundary | Phase 1 notes |
|---|---|---|---|---|
| Google Places API (New) | `PlacesProvider` | outbound | Discovery/Business | normalize text/location, paginate, map provider ID, cache safely, cost-track; official field/cost limits require validation |
| Scraper engine | `ScrapingProvider` | outbound + callback | Scraping | submit/poll/cancel/webhook/normalize; provider fields remain raw/provenance metadata |
| Meta WhatsApp Cloud API | `MessagingProvider` | outbound + webhook | Messaging/Webhooks | WABA/phone ID, signed callbacks, provider message ID, ordering, session/template rules |
| OpenAI/AI Gateway | `AIProvider` behind `AIService` | outbound | Intelligence/Copilot | prompt version, model, usage, cost, latency, safety status, timeout, no direct vendor calls from domains |
| Tap Payments | `PaymentProvider` | outbound + webhook | Billing/Payments | hosted/tokenized session, provider status, signature, webhook-first truth, reconciliation |
| ZATCA/FATOORA | `TaxProvider` | outbound + status | Tax | TaxInvoice separate from Payment/Invoice; exact legal mapping requires official validation |
| Hostinger storage | `FileStorageProvider` | outbound | Files | blob only, signed/proxied access, checksum, MIME/size/quarantine |
| Redis/Celery | `JobQueue` | internal | Jobs | broker, short lock, rate-limit counter, safe cache; not canonical data |
| Webhook gateway | `WebhookGateway` | inbound | Webhooks | verify, receipt, hash, deduplicate, enqueue, fast acknowledge |
| Sentry | `ErrorReporter` | outbound | Observability | scrub PII, environment/release/request correlation |
| OpenTelemetry | `Tracer` | outbound | Observability | trace HTTP/DB/Redis/worker/provider/webhook/payment without sensitive payloads |

## Provider lifecycle

Each adapter has connect/configuration validation, request normalization, finite timeout, retry classification, response normalization, provider-error mapping, cost/usage recording, and audit correlation. Raw payload retention is restricted and time-bounded. Provider callbacks never directly mutate business aggregates outside an application service.

Email, Gmail, Google Calendar, FCM, and other advanced integrations are optional/deferred and are not Phase 1 dependencies. No legal, data-locality, PCI, or ZATCA compliance claim is made by this architecture; formal validation is required before implementation.
