# B13 — Webhook Security (Operational Contract)

> Design only. Preserves `B12_WEBHOOK_SECURITY.md` and `B12_WEBHOOK_GATEWAY.md` (`FI-B12-02`) and every provider-specific verification document (`B5_WEBHOOK_SECURITY_MODEL.md`, `B8_TAP_PROVIDER_BOUNDARY.md`) verbatim. B13 does **not** invent a universal webhook verifier — B12 already proved that assumption wrong for this exact provider pair (`FI-B12-02`, `B12-D-A030`). This document is the operational and incident-response layer around the frozen verification design.

## 1. The five rules, restated as an operational checklist

From `B12-D-A029` (`FI-B12-02`):

1. Verify before anything — no parse, enqueue, or domain code before verification succeeds.
2. Never trust the body for identity — workspace/tenant resolved from *which secret verified*, never a payload field.
3. Constant-time comparison, always.
4. Never store a signature next to the body it signs.
5. A provider object ID is a lookup key, never an authorization claim.

Every operational procedure below (deployment, incident response, monitoring) assumes these five hold structurally in the implementation; B13 adds no sixth rule and weakens none of the five.

## 2. Per-provider verification — no universal scheme

| | Meta WhatsApp Cloud API | Tap Payments |
|---|---|---|
| Header | `X-Hub-Signature-256` (`sha256=` prefix) | `hashstring` |
| Signed over | the raw payload body | a field concatenation (`x_id`, `x_amount`, `x_currency`, `x_gateway_reference`, `x_payment_reference`, `x_status`, `x_created`) |
| Basis confirmed | `B12-X-001`, VERIFIED | `B12-X-005`, VERIFIED |
| Retry generosity | ~36 hours, provider explicitly instructs consumer to dedup (`B12-X-003`) | **3 total attempts**, then `ERROR` (`B12-X-006`) — a lost callback is lost **permanently** |

The asymmetric retry generosity is the operationally decisive fact: **Tap's 3-attempt bound means WazLink's own reconciliation (`retrieve_charge`, `FI-B8-01`) is the payment-truth guarantee, not an optimization.** Any incident that delays webhook processing for Tap for more than a few minutes risks permanently lost delivery confirmation, which is why `B13_INCIDENT_MANAGEMENT.md` classes a webhook-ingress outage during a payment campaign as SEV-2 minimum, escalating to SEV-1 if it persists past Tap's retry window.

## 3. Ingress gates and DoS resistance

Size, content-type, and rate gates run **before** HMAC computation, so an unauthenticated flood cannot force unbounded CPU work — signature verification on an oversized body is itself a denial-of-service vector (`FI-B12-02`). Production values:

| Gate | Value | Class |
|---|---|---|
| Body size ceiling | provider-documented maximum plus safety margin (exact figure is a `B14` implementation detail, bounded by `WEBHOOK_MAX_BODY_BYTES`, `FI-B12-04`) | B13-D-B008, Class B |
| Ingress rate limit | per-provider-route abuse limit, distinct from the domain's own message/payment volume (`B12-AM-008`) | `B13_RATE_LIMIT_ABUSE_MODEL.md` §5 |
| Content-Type check | must match the provider's documented type exactly | inherited, `FI-B12-02` §5 |

## 4. Tenant binding — production monitoring

Workspace resolution from the verified binding (§7 of `B13_AUTHORIZATION_TENANCY.md`) is a correctness property, but its **failure mode** is an operational signal: a receipt resolving to zero or multiple bindings is quarantined and opens a `P-7` reconciliation case (`FI-B12-07`). Production alerting binds this to a page-worthy signal — `webhook_binding_unresolved_total` rising above a low baseline indicates either a misconfiguration (a workspace disconnected a binding without updating the provider console) or an attempted cross-tenant forgery attempt, and both warrant operator triage (`B13_RUNBOOKS.md` §"Suspected cross-tenant access").

## 5. Replay defense in production

HMAC has no inherent freshness (`FI-B12-02` §4; `FI-B5-01` §10). Replay is defended by **idempotency** — dedup on the receipt's unique key (`(provider, dedup_key)`, binding-scoped per `B12-D-A056`) — not by a freshness window, because Meta's scheme does not document timestamp binding. Where Tap's `x_created` (inside the signed set) eventually gets confirmed semantics, a freshness window may be added as **defense in depth**, never as the primary control (`FI-B12-02` §4). This is a Class B tuning decision (`B13-D-B009`), not architecture.

## 6. Cross-workspace webhook attack surface — production checklist

| Attack | Defense | Verified by |
|---|---|---|
| Forge a webhook claiming another tenant's binding | signature must verify against *that binding's own secret*; claiming binding X while signing with binding Y's secret fails verification against X | `AT-B13WH-4` |
| Replay a captured payload later | dedup on `(provider, dedup_key)`, binding-scoped | `AT-B13WH-5` |
| Poison another tenant's dedup identity | `dedup_key` prefixed by the verifying binding | `AT-B13WH-6` |
| Flood the ingress endpoint pre-verification | size/content-type/rate gates before HMAC | `AT-B13WH-7` |
| Use a provider object ID to claim authorization | provider IDs are lookup keys only | `AT-B13WH-8` |

## 7. Secret handling in the webhook path

The verification secret is resolved from `integration_connections.<credential>_ref` at verification time and never logged, cached in a task payload, stored on the receipt, returned by any API, or included in an error (`FI-B12-02` §7). Rotation invalidates the prior reference rather than superseding it (`B13_SECRETS_MANAGEMENT.md` §7).

## 8. Audit and observability

Every attempt — accepted or rejected — records `request_id`, resolved binding (once known), outcome (`accepted`/`invalid_signature`/`malformed`/`unsupported_event`/`duplicate`/`unresolved_binding`), and provider event identifiers — never the raw body, secret, signature, or message content (`FI-B12-02` §8). `webhook.rejected` is deliberately an **audit entry**, not an event, so an attacker cannot generate unbounded event-bus traffic by sending forged callbacks (`FI-B12-05`). Production metric: `webhook_verification_failed_total{provider}`, bound to the frozen "signature failures" page-worthy alert class (`FI-B0-15`).

## 9. Incident response for webhook-specific events

| Signal | Response |
|---|---|
| Sustained rise in `webhook_verification_failed_total{provider}` | Investigate: provider-side credential rotation not yet reflected in WazLink, or an active forgery attempt. Never respond by relaxing verification. See `B13_RUNBOOKS.md` §"WhatsApp outage" / §"Tap/payment unknown outcome" |
| `webhook_binding_unresolved_total` rising for one workspace | Check whether that workspace's provider-side binding (phone number, Tap customer reference) changed without a corresponding WazLink reconfiguration | `B13_RUNBOOKS.md` §"Suspected cross-tenant access" |
| Ingress endpoint under volumetric load | Ingress rate gate should already be absorbing this; if it is not, this is a deployment-layer (proxy/WAF) response, not an application-layer code change | `B13_DEPLOYMENT_SECURITY.md` §2 |

## 10. What B13 does not add

No IP allow-listing (Phase 1 explicitly rejects this — neither Meta nor Tap publishes stable committed ranges, `B12-D-B007`), no universal verifier, no timestamp-freshness requirement beyond what §5 already scopes as defense-in-depth, and no change to either provider's signed-field set.

## 11. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13WH-1` | Signature verification runs before any parse/enqueue/domain code |
| `AT-B13WH-2` | Signature comparison is constant-time |
| `AT-B13WH-3` | A malformed-but-verified payload acknowledges `200` with zero domain effect |
| `AT-B13WH-4`…`AT-B13WH-8` | the cross-tenant attack table, §6 |
| `AT-B13WH-9` | Ingress gates (size, content-type, rate) reject before HMAC computation on an oversized body |
| `AT-B13WH-10` | A webhook received while the target provider connection is `disabled` is still receipted (never silently dropped) but produces zero domain effect, restating `FI-B12-02`'s "disabled providers still receipted" rule |
