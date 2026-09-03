# B12 — Webhook Security

> Design only. The most security-critical document in the pack. Every claim about a provider's scheme is backed by `B12_PROVIDER_RESEARCH_REGISTER.md`.

## 1. The five rules

> **`B12-D-A029`.**
> 1. **Verify before anything.** No parse, no enqueue, no domain code before verification succeeds.
> 2. **Never trust the body for identity.** Workspace, tenant, and authorization are resolved from *which secret verified*, never from a field inside the payload.
> 3. **Constant-time comparison**, always.
> 4. **Never store a signature next to the body it signs.**
> 5. **A provider object ID is a lookup key, never an authorization claim.**

## 2. Verification is per-provider — there is no universal scheme

The research finding that most shapes this design: **the two Phase-1 providers sign fundamentally different things.**

| | Meta WhatsApp Cloud API | Tap Payments |
|---|---|---|
| Header | `X-Hub-Signature-256`, value prefixed `sha256=` | `hashstring` |
| Algorithm | HMAC-SHA256 | HMAC-SHA256 |
| Secret | app secret | Secret API Key |
| **Signed over** | **the payload body** | **a field concatenation**: `"x_id"+id+"x_amount"+amount+"x_currency"+currency+"x_gateway_reference"+…+"x_status"+status+"x_created"+created` |
| Evidence | `B12-X-001` (VERIFIED, Meta primary docs) | `B12-X-005` (VERIFIED, Tap primary docs) |

> **`B12-D-A030`. Because Tap signs selected fields rather than the body, a generic "HMAC the raw body" verifier is wrong for Tap and a generic "concatenate documented fields" verifier is wrong for Meta. Verification is therefore an adapter responsibility with a shared *contract*, not a shared *implementation*.**

This is exactly the "fake lookalike" trap `B12_PROVIDER_PORT_ARCHITECTURE.md` §2 warns about, caught by primary-source research rather than by assumption. A universal verifier would have silently failed one provider or, worse, been "fixed" by relaxing it.

**Tap's field-concatenation scheme has a consequence worth stating:** the signature covers only the enumerated fields. Any field *outside* the concatenation is unauthenticated and must never be trusted for an authorization or routing decision — only `id`, `amount`, `currency`, `gateway_reference`, `payment_reference`, `status`, and `created` are covered for charges. B12 records this as a constraint, not a complaint.

**Meta's raw-body basis:** frozen `B5_WEBHOOK_SECURITY_MODEL.md` §3 requires verification against *"the literal bytes Meta sent, before any JSON parsing occurs"*, warning that middleware which parses and re-serializes invalidates the signature. Meta's own getting-started page confirms the header, algorithm, and secret but **does not explicitly state the raw-byte basis** (`B12-X-014`, PARTIAL). B12 keeps B5's stricter reading — raw bytes — because it is safe under both interpretations, and flags the residual as a pre-implementation verification item rather than asserting Meta documents it.

## 3. Tenant binding

> **`B12-D-A031`. Workspace resolution is a *consequence of which secret verified*, never a value read from the payload.**

```
resolve(request):
    candidate_binding = lookup by the provider identifier in the path/payload
    verified          = verify(request, candidate_binding.secret_ref)   # §2
    IF NOT verified: 401, STOP
    workspace_id      = candidate_binding.workspace_id                  # from the BINDING
```

The provider identifier (`phone_number_id`, `provider_customer_ref`) is usable as a **lookup key** only because the signature was then verified **against that same binding's own secret**. An attacker claiming binding X while signing with binding Y's secret fails verification against X's secret. Frozen `B5-D-A011` states this for messaging and `B8_CHECKOUT_PAYMENT_MODEL.md` states it for billing (*"an inbound Tap webhook resolves its workspace by looking up `provider_customer_ref`/`provider_agreement_ref` here, never by trusting a `workspace_id` embedded in the provider payload"*). B12 ratifies both.

**Zero or multiple bindings resolve.** A receipt that resolves to no workspace, or to more than one, is **quarantined and alerted, never guessed** — frozen `B8_WEBHOOK_MODEL.md` §3's rule, generalized. The receipt is stored with `workspace_id = NULL` and a reconciliation case is opened (class `P-7`). `WEBHOOK_TENANT_BINDING_GAPS = 0`; negative controls `AT-B12WH-4`, `AT-B12WH-5`.

## 4. Replay defence

HMAC has no inherent freshness. A captured, correctly-signed payload replayed later still verifies. The mitigation is **idempotency, not signature freshness** — frozen `B5_WEBHOOK_SECURITY_MODEL.md` §10 states this position explicitly and deliberately.

| Provider | Timestamp binding in the signature? | Defence |
|---|---|---|
| Meta | not documented (`B12-X-014`) | dedup on `(provider, provider_event_id)` + payload hash |
| Tap | `x_created` **is inside the signed concatenation** (`B12-X-005`) | dedup, **plus** an optional freshness window on `created` once its exact semantics are confirmed pre-implementation |

Where a provider does support timestamp binding, B12 may add a freshness window as **defence in depth** — never as the primary control, because the primary control must work for providers that do not.

## 5. Ingress gates, before verification

| Gate | Rule | Failure |
|---|---|---|
| Route | provider from the URL path only | `404`, no receipt |
| Content-Type | must match the provider's documented type | `415` |
| Body size | hard ceiling, enforced while streaming | `413` |
| Ingress rate | per-provider-route abuse limit (`B12-AM-008`) | `429` with `Retry-After` |

These run **before** the HMAC computation so that an unauthenticated flood cannot force unbounded CPU work — signature verification on a 500 MB body is itself a denial-of-service vector.

## 6. IP allow-lists

**Not used in Phase 1.** An allow-list is only sound where the provider publishes stable, versioned ranges and commits to them; neither Meta nor Tap does in the documentation read this pass. An allow-list built on guessed ranges silently drops legitimate callbacks after a provider's infrastructure change — for Tap, permanently, given its three-attempt retry bound. Recorded as `B12-D-B007` (deferred, evidence-gated), not as an oversight.

## 7. Secret handling

The verification secret is resolved from `integration_connections.<credential>_ref` at verification time and never: logged, cached in a task payload, stored on the receipt, returned by any API, or included in an error. Rotation invalidates the prior reference rather than superseding it — frozen `B5_ADMIN_PROVIDER_RUNBOOK.md` §rotation: *"The prior credential reference is invalidated, not merely superseded."*

## 8. Audit

Every attempt — accepted or rejected — records `request_id`, resolved binding (once known), outcome (`accepted` | `invalid_signature` | `malformed` | `unsupported_event` | `duplicate` | `unresolved_binding`), and provider event identifiers. **Never** the raw body, the secret, the signature, or message content. Frozen `B5_WEBHOOK_SECURITY_MODEL.md` §9's discipline, generalized.
